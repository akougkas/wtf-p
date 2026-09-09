'use strict';

const fs = require('fs');
const path = require('path');
const { createTargetGuard, resolveOwnedPath, sha256Buffer } = require('./ownership');

// Clio owns integrity, provenance, drift and enable/disable for an installed
// plugin. WTF-P owns two much smaller things: the exact bytes it publishes
// (its v2 receipt) and the guarantee that the tree handed to Clio is the
// generated bundle and nothing else.
function treeFiles(root) {
  const files = new Map();
  function visit(directory) {
    const stat = fs.lstatSync(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Clio plugin directory is unsafe: ${directory}`);
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files.set(path.relative(root, file).split(path.sep).join('/'), sha256Buffer(fs.readFileSync(file)));
      else throw new Error(`Clio plugin contains an unsafe entry: ${file}`);
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

function generatedBundle(root) {
  const inventoryPath = path.join(root, '.wtfp-generated.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  if (inventory.schema !== 'wtfp.generated-adapter/v1' || inventory.target !== 'portable-plugin') {
    return null;
  }
  const expected = new Map(inventory.files.map(file => [file.path, file.sha256]));
  expected.set('.wtfp-generated.json', sha256Buffer(fs.readFileSync(inventoryPath)));
  return expected;
}

// The one entry WTF-P is allowed to act on: our id, our scope, our path.
function verifiedEntry(stdout, targetDir, native, scope) {
  const entry = JSON.parse(stdout);
  if (!entry || entry.id !== native.id || entry.scope !== scope ||
      typeof entry.rootPath !== 'string' ||
      path.resolve(entry.rootPath) !== path.join(targetDir, native.source)) {
    return null;
  }
  return entry;
}

function installedListEntry(stdout, targetDir, native, scope) {
  const listing = JSON.parse(stdout);
  if (!Array.isArray(listing.plugins)) throw new Error('Clio plugins list did not return a plugins array');
  return listing.plugins.find(entry => entry.id === native.id && entry.scope === scope &&
    typeof entry.rootPath === 'string' && path.resolve(entry.rootPath) === path.join(targetDir, native.source));
}

function active(entry) {
  return Boolean(entry) && entry.enabled === true && entry.valid === true &&
    entry.loadable === true && Array.isArray(entry.diagnostics) && entry.diagnostics.length === 0;
}

function activateClio(targetDir, native, suppliedOptions) {
  const options = scopeOptions(targetDir, suppliedOptions);
  const { execute, environment } = options;
  const guard = createTargetGuard(targetDir);
  const root = resolveOwnedPath(targetDir, native.source, guard);
  const publishedFiles = treeFiles(root);
  const expected = generatedBundle(root);
  if (!expected || !sameTree(expected, publishedFiles)) {
    return {
      status: 'deferred',
      reason: 'Clio activation requires an intact generated bundle without extra or modified files',
      results: []
    };
  }

  const results = [];
  const priorList = execute('clio-coder', ['plugins', 'list', '--all', '--json'], environment, options);
  if (priorList.status === 'unavailable') return { status: 'unavailable', executable: 'clio-coder', results };
  results.push(priorList);
  if (active(installedListEntry(priorList.stdout, targetDir, native, options.scope))) {
    return { status: 'registered', executable: 'clio-coder', results };
  }

  // `plugins install` copies a source into the destination it owns, so the
  // published tree moves aside first. Holding it (inode identities included)
  // until the receipt is durable lets a failed registration put the previous
  // installation back before the file transaction rolls it back.
  const staging = fs.mkdtempSync(path.join(path.dirname(root), '.wtfp-staged-'));
  const source = path.join(staging, 'wtfp');
  fs.renameSync(root, source);
  let finished = false;

  function rollback() {
    if (finished) return [];
    try {
      if (fs.existsSync(root)) {
        if (!sameTree(publishedFiles, treeFiles(root))) {
          throw new Error('Clio content changed concurrently; recovery tree preserved');
        }
        const removal = execute('clio-coder', ['plugins', 'remove', native.id, `--${options.scope}`], environment,
          { ...options, allowAlreadyAbsent: true });
        results.push(removal);
        if (removal.status === 'unavailable') throw new Error('Clio became unavailable during rollback');
      }
      if (fs.existsSync(root)) throw new Error('Clio rollback did not remove the replacement');
      fs.renameSync(source, root);
      fs.rmdirSync(staging);
      finished = true;
      return [];
    } catch (error) {
      return [error.message];
    }
  }

  try {
    const installation = execute('clio-coder', ['plugins', 'install', source, `--${options.scope}`], environment, options);
    results.push(installation);
    if (installation.status === 'unavailable') throw new Error('Clio became unavailable during installation');
    const inspected = execute('clio-coder', ['plugins', 'inspect', native.id, '--json'], environment, options);
    results.push(inspected);
    if (inspected.status === 'unavailable') throw new Error('Clio became unavailable during verification');
    const entry = verifiedEntry(inspected.stdout, targetDir, native, options.scope);
    if (!active(entry) || !sameTree(publishedFiles, treeFiles(root))) {
      throw new Error('Clio did not report the exact WTF-P plugin as active with zero diagnostics');
    }
    return {
      status: 'registered', executable: 'clio-coder', results, rollback,
      commit() {
        // Only the private held copy is removed; Clio owns its installed tree.
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
  const { execute, environment } = options;
  const guard = createTargetGuard(targetDir);
  const listing = execute('clio-coder', ['plugins', 'list', '--all', '--json'], environment, options);
  if (listing.status === 'unavailable') return { status: 'unavailable', executable: 'clio-coder', results: [] };
  if (!installedListEntry(listing.stdout, targetDir, native, options.scope)) {
    return { status: 'not-required', results: [listing] };
  }

  // Native removal is recursive. Run it only when the receipt proves that every
  // file below the installed root is one WTF-P published and nobody changed.
  const root = resolveOwnedPath(targetDir, native.source, guard);
  const ownedFiles = options.ownedFiles;
  if (!ownedFiles || !sameTree(treeFiles(root), ownedFiles)) {
    return { status: 'deferred', reason: 'Clio native removal would include unowned or modified plugin files', results: [listing] };
  }
  const result = execute('clio-coder', ['plugins', 'remove', native.id, `--${options.scope}`], environment, options);
  if (result.status === 'unavailable') return { status: 'unavailable', executable: 'clio-coder', results: [listing] };
  const after = execute('clio-coder', ['plugins', 'list', '--all', '--json'], environment, options);
  if (fs.existsSync(root) || installedListEntry(after.stdout, targetDir, native, options.scope)) {
    throw new Error('Clio removal did not clear WTF-P content and registration');
  }
  return { status: 'unregistered', executable: 'clio-coder', results: [listing, result, after] };
}

module.exports = { activateClio, deactivateClio, treeFiles };
