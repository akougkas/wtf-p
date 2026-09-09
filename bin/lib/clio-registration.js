'use strict';

const fs = require('fs');
const path = require('path');
const {
  atomicWriteFile, createTargetGuard, readOwnedRegularSnapshot, resolveOwnedPath, sha256Buffer
} = require('./ownership');

// Native remove is recursive. Never let it broaden the installer's exact-file
// ownership to unowned siblings, backups, symlinks or modified content.
function treeFiles(root) {
  const files = new Map();
  function visit(directory) {
    if (!fs.lstatSync(directory).isDirectory() || fs.lstatSync(directory).isSymbolicLink()) {
      throw new Error(`Clio extension directory is unsafe: ${directory}`);
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files.set(path.relative(root, file).split(path.sep).join('/'), sha256Buffer(fs.readFileSync(file)));
      else throw new Error(`Clio extension contains an unsafe entry: ${file}`);
    }
  }
  if (fs.existsSync(root)) visit(root);
  return files;
}

function sameTree(left, right) {
  return left.size === right.size && [...left].every(([file, hash]) => right.get(file) === hash);
}

function scopeOptions(targetDir, options) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const project = path.resolve(targetDir) === path.join(cwd, '.clio-coder');
  if (options.scope === 'project' && !project) throw new Error('Clio project scope requires <cwd>/.clio-coder');
  return { ...options, cwd, scope: project ? 'project' : 'user' };
}

function stateSnapshot(targetDir, guard, collection = 'extensions') {
  const file = resolveOwnedPath(targetDir, `${collection}/state.json`, guard);
  const snapshot = readOwnedRegularSnapshot(targetDir, file, guard, { allowMissing: true });
  const state = snapshot ? JSON.parse(snapshot.bytes.toString('utf8')) : { version: 1, disabled: [], installed: {} };
  if (state.version !== 1 || !Array.isArray(state.disabled) || !state.installed || typeof state.installed !== 'object' || Array.isArray(state.installed)) {
    throw new Error('Clio extension state is malformed; native registration was not changed');
  }
  return { file, snapshot, state };
}

function installedEntry(result, targetDir, native, scope) {
  const listing = JSON.parse(result.stdout);
  const entries = native.kind === 'clio-plugin' ? listing.plugins : listing.extensions;
  if (!Array.isArray(entries)) throw new Error('Clio list did not return an extensions array');
  return entries.find(entry => entry.id === native.id && entry.scope === scope &&
    typeof entry.rootPath === 'string' && path.resolve(entry.rootPath) === path.join(targetDir, native.source));
}

function activateClio(targetDir, native, suppliedOptions) {
  const options = scopeOptions(targetDir, suppliedOptions);
  const collection = native.kind === 'clio-plugin' ? 'plugins' : 'extensions';
  const { execute, environment } = options;
  const guard = createTargetGuard(targetDir);
  const root = resolveOwnedPath(targetDir, native.source, guard);
  const originalFiles = treeFiles(root);
  const inventoryPath = path.join(root, '.wtfp-generated.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const expected = new Map(inventory.files.map(file => [file.path, file.sha256]));
  expected.set('.wtfp-generated.json', sha256Buffer(fs.readFileSync(inventoryPath)));
  if (inventory.schema !== 'wtfp.generated-adapter/v1' || inventory.target !== (native.kind === 'clio-plugin' ? 'portable-plugin' : 'clio') || !sameTree(expected, originalFiles)) {
    return { status: 'deferred', reason: 'Clio activation requires an intact generated bundle without extra or modified files', results: [] };
  }
  const previous = stateSnapshot(targetDir, guard, collection);
  const results = [];
  const listArgs = [collection, 'list', '--all', '--json'];
  const priorList = execute('clio-coder', listArgs, environment, options);
  if (priorList.status === 'unavailable') return { status: 'unavailable', executable: 'clio-coder', results };
  results.push(priorList);
  const priorEntry = installedEntry(priorList, targetDir, native, options.scope);
  if (priorEntry?.loadable === true && priorEntry.enabled === true && priorEntry.valid === true &&
      priorEntry.compatible === true && priorEntry.diagnostics?.length === 0) {
    return { status: 'registered', executable: 'clio-coder', results };
  }

  // Hold the just-published tree, including its inode identities, until the v2
  // receipt is durable. A failed registration/receipt can restore it before the
  // file transaction rolls back to the previous installation.
  const staging = fs.mkdtempSync(path.join(path.dirname(root), '.wtfp-native-'));
  const source = path.join(staging, 'clio');
  fs.renameSync(root, source);
  let finished = false;
  function rollback() {
    if (finished) return [];
    try {
      const current = stateSnapshot(targetDir, guard, collection);
      const record = current.state.installed[native.id];
      const changedRecord = JSON.stringify(record) !== JSON.stringify(previous.state.installed[native.id]);
      if (changedRecord && record?.source !== source) throw new Error('Clio provenance changed concurrently; recovery tree preserved');
      if (fs.existsSync(root)) {
        if (!sameTree(originalFiles, treeFiles(root))) throw new Error('Clio content changed concurrently; recovery tree preserved');
        if (changedRecord) {
          const removal = execute('clio-coder', [collection, 'remove', native.id, `--${options.scope}`], environment, options);
          results.push(removal);
          if (removal.status === 'unavailable') throw new Error('Clio became unavailable during rollback');
        } else {
          fs.rmSync(root, { recursive: true });
        }
      }
      if (fs.existsSync(root)) throw new Error('Clio rollback did not remove the replacement');
      fs.renameSync(source, root);
      const after = stateSnapshot(targetDir, guard, collection);
      if (previous.state.installed[native.id]) after.state.installed[native.id] = previous.state.installed[native.id];
      else delete after.state.installed[native.id];
      after.state.disabled = after.state.disabled.filter(id => id !== native.id);
      if (previous.state.disabled.includes(native.id)) after.state.disabled.push(native.id);
      if (previous.snapshot || Object.keys(after.state.installed).length || after.state.disabled.length) {
        atomicWriteFile(after.file, `${JSON.stringify(after.state, null, 2)}\n`, { targetGuard: guard });
      } else if (after.snapshot) fs.unlinkSync(after.file);
      fs.rmdirSync(staging);
      finished = true;
      return [];
    } catch (error) {
      return [error.message];
    }
  }
  try {
    const installation = execute('clio-coder', [collection, 'install', source, `--${options.scope}`], environment, options);
    results.push(installation);
    if (installation.status === 'unavailable') throw new Error('Clio became unavailable during installation');
    // New plugin clients preserve an existing disabled preference on install.
    // WTF-P installation requests activation; compensate this alongside the
    // registration if the receipt cannot commit.
    if (native.kind === 'clio-plugin' && previous.state.disabled.includes(native.id)) {
      const enabled = execute('clio-coder', [collection, 'enable', native.id, `--${options.scope}`], environment, options);
      results.push(enabled);
      if (enabled.status === 'unavailable') throw new Error('Clio became unavailable during activation');
    }
    const listed = execute('clio-coder', listArgs, environment, options);
    results.push(listed);
    if (listed.status === 'unavailable') throw new Error('Clio became unavailable during verification');
    const entry = installedEntry(listed, targetDir, native, options.scope);
    if (!entry || entry.enabled !== true || entry.valid !== true || entry.compatible !== true ||
        entry.loadable !== true || !Array.isArray(entry.diagnostics) || entry.diagnostics.length > 0 ||
        !sameTree(originalFiles, treeFiles(root))) {
      throw new Error('Clio did not report the exact WTF-P extension as active with zero diagnostics');
    }
    const registered = stateSnapshot(targetDir, guard, collection).state.installed[native.id];
    if (registered?.source !== source || !/^[a-f0-9]{64}$/i.test(registered?.contentDigest || '')) {
      throw new Error('Clio did not persist WTF-P digest and provenance');
    }
    return {
      status: 'registered', executable: 'clio-coder', results, rollback,
      commit() {
        // Only the private held copy is removed; Clio owns its shared registry.
        finished = true;
        try { fs.rmSync(staging, { recursive: true }); } catch {
          // Receipt publication has committed. A failed cleanup must not undo
          // the active package or invalidate its now-durable ownership receipt.
          return `Clio installation committed; remove the retained staging copy manually: ${staging}`;
        }
      }
    };
  } catch (error) {
    const failures = rollback();
    if (failures.length) error.nativeRollbackFailures = failures;
    throw error;
  }
}

function deactivateClio(targetDir, native, suppliedOptions) {
  const options = scopeOptions(targetDir, suppliedOptions);
  const collection = native.kind === 'clio-plugin' ? 'plugins' : 'extensions';
  const guard = createTargetGuard(targetDir);
  const previous = stateSnapshot(targetDir, guard, collection);
  if (!previous.state.installed[native.id]) return { status: 'not-required', results: [] };
  const root = resolveOwnedPath(targetDir, native.source, guard);
  const ownedFiles = options.ownedFiles;
  if (!ownedFiles || !sameTree(treeFiles(root), ownedFiles)) {
    return { status: 'deferred', reason: 'Clio native removal would include unowned or modified extension files', results: [] };
  }
  const result = options.execute('clio-coder', [collection, 'remove', native.id, `--${options.scope}`], options.environment, options);
  if (result.status === 'unavailable') return { status: 'unavailable', executable: 'clio-coder', results: [] };
  if (fs.existsSync(root) || stateSnapshot(targetDir, guard, collection).state.installed[native.id]) throw new Error('Clio removal did not clear WTF-P content and registration');
  return { status: 'unregistered', executable: 'clio-coder', results: [result] };
}

module.exports = { activateClio, deactivateClio, treeFiles };
