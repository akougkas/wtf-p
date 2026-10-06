'use strict';

const fs = require('fs');
const path = require('path');
const { createTargetGuard, resolveOwnedPath, sha256Buffer } = require('./ownership');

// Clio owns integrity, provenance, drift and enable/disable for an installed
// plugin or extension. WTF-P owns two much smaller things: the exact bytes it
// publishes (its v2 receipt) and the guarantee that each tree handed to Clio
// is the generated package and nothing else.
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

function generatedBundle(root, target = 'portable-plugin') {
  const inventoryPath = path.join(root, '.wtfp-generated.json');
  if (!fs.existsSync(inventoryPath)) return null;
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  if (inventory.schema !== 'wtfp.generated-adapter/v1' || inventory.target !== target) {
    return null;
  }
  const expected = new Map(inventory.files.map(file => [file.path, file.sha256]));
  expected.set('.wtfp-generated.json', sha256Buffer(fs.readFileSync(inventoryPath)));
  return expected;
}

// Compare roots by their real path so a symlinked config directory still
// matches whether Clio reports the lexical or the canonical root.
function sameRoot(reported, expected) {
  const canonical = (candidate) => {
    try {
      return fs.realpathSync(candidate);
    } catch {
      return path.resolve(candidate);
    }
  };
  return path.resolve(reported) === path.resolve(expected) || canonical(reported) === canonical(expected);
}

// The one entry WTF-P is allowed to act on: our id, our scope, our path.
function verifiedEntry(stdout, targetDir, native, scope) {
  const entry = JSON.parse(stdout);
  if (!installedRecord(entry) || entry.id !== native.id || entry.scope !== scope ||
      !sameRoot(entry.rootPath, path.join(targetDir, native.source))) {
    return null;
  }
  return entry;
}

function installedRecord(entry) {
  return entry && typeof entry === 'object' && !Array.isArray(entry) &&
    typeof entry.id === 'string' && entry.id.length > 0 &&
    (entry.kind === undefined || entry.kind === 'plugin') &&
    ['user', 'project'].includes(entry.scope) &&
    typeof entry.rootPath === 'string' && path.isAbsolute(entry.rootPath) &&
    typeof entry.valid === 'boolean' && typeof entry.enabled === 'boolean' &&
    Array.isArray(entry.diagnostics);
}

function installedListEntry(stdout, targetDir, native, scope) {
  const listing = JSON.parse(stdout);
  if (!listing || !Array.isArray(listing.entries) || !Array.isArray(listing.diagnostics)) {
    throw new Error('Clio library list did not return entries and diagnostics arrays');
  }
  const installed = [];
  for (const entry of listing.entries) {
    if (!entry || typeof entry.kind !== 'string' || typeof entry.name !== 'string' ||
        !entry.name || !Array.isArray(entry.installed)) {
      throw new Error('Clio library list returned a malformed library entry');
    }
    if (entry.kind !== 'plugin') continue;
    for (const copy of entry.installed) {
      if (!installedRecord(copy) || copy.id !== entry.name) {
        throw new Error('Clio library list returned a malformed installed plugin');
      }
      installed.push(copy);
    }
  }
  // Catalog availability is not registration. Only an installed copy with all
  // three ownership coordinates can authorize native lifecycle operations.
  const matches = installed.filter(entry => entry.id === native.id && entry.scope === scope &&
    sameRoot(entry.rootPath, path.join(targetDir, native.source)));
  if (matches.length > 1) throw new Error('Clio library list returned duplicate installed plugin identities');
  return matches[0];
}

function installedExtensionEntry(stdout, targetDir, native, scope) {
  const listing = JSON.parse(stdout);
  if (!listing || !Array.isArray(listing.extensions)) {
    throw new Error('Clio extensions list did not return an extensions array');
  }
  for (const entry of listing.extensions) {
    if (!installedRecord(entry)) throw new Error('Clio extensions list returned a malformed installed extension');
  }
  const matches = listing.extensions.filter(entry => entry.id === native.id && entry.scope === scope &&
    sameRoot(entry.rootPath, path.join(targetDir, native.source)));
  if (matches.length > 1) throw new Error('Clio extensions list returned duplicate installed extension identities');
  return matches[0];
}

// The two Clio packages WTF-P installs, plugin first. Each is its own Clio
// install with its own lifecycle command, generated inventory and checks.
function clioPackages(native) {
  const plugin = {
    noun: 'plugin', command: 'library', id: native.id, source: native.source, inventory: 'portable-plugin',
    deferral: 'Clio activation requires an intact generated bundle without extra or modified files',
    list: () => ['library', 'list', '--kind', 'plugin', '--json'],
    listed: (stdout, targetDir, scope) => installedListEntry(stdout, targetDir, native, scope),
    // `inspect` returns the installed record for the explicitly selected scope.
    verify: scope => ['library', 'inspect', native.id, `--${scope}`, '--json'],
    verified: (stdout, targetDir, scope) => verifiedEntry(stdout, targetDir, native, scope)
  };
  if (!native.extension) return [plugin];
  const extension = native.extension;
  const listed = (stdout, targetDir, scope) => installedExtensionEntry(stdout, targetDir, extension, scope);
  return [plugin, {
    noun: 'extension', command: 'extensions', id: extension.id, source: extension.source, inventory: 'clio-extension',
    deferral: 'Clio extension activation requires an intact generated extension without extra or modified files',
    list: scope => ['extensions', 'list', `--${scope}`, '--json'],
    listed,
    verify: scope => ['extensions', 'list', `--${scope}`, '--json'],
    verified: listed
  }];
}

// Registration is what WTF-P is responsible for. Whether the operator has a
// package switched on is Clio's state and their decision, so it is reported,
// never asserted and never changed.
function registered(entry) {
  return Boolean(entry) && entry.valid === true &&
    Array.isArray(entry.diagnostics) && entry.diagnostics.length === 0;
}

function disabledNotice(pkg, scope) {
  return `Clio reports ${pkg.id} as installed but disabled. WTF-P does not change that preference; run clio-coder ${pkg.command} enable ${pkg.id} --${scope} to switch it back on.`;
}

// Install the plugin, then the extension. A failure in the second compensates
// the first, and the returned compensator undoes both in reverse order.
function activateClio(targetDir, native, suppliedOptions) {
  const options = scopeOptions(targetDir, suppliedOptions);
  const activated = [];
  try {
    for (const pkg of clioPackages(native)) {
      const result = activatePackage(targetDir, pkg, options);
      activated.push(result);
      if (result.status !== 'registered') break;
    }
  } catch (error) {
    const failures = activated.reverse().flatMap(result => typeof result.rollback === 'function' ? result.rollback() : []);
    if (failures.length) error.nativeRollbackFailures = [...(error.nativeRollbackFailures || []), ...failures];
    throw error;
  }
  if (activated.length === 1) return activated[0];
  const last = activated[activated.length - 1];
  const notices = activated.map(result => result.notice).filter(Boolean);
  return {
    status: last.status, executable: 'clio-coder',
    ...(last.reason ? { reason: last.reason } : {}),
    results: activated.flatMap(result => result.results),
    ...(notices.length ? { notice: notices.join(' ') } : {}),
    rollback() {
      return [...activated].reverse().flatMap(result => typeof result.rollback === 'function' ? result.rollback() : []);
    },
    commit() {
      const warnings = activated.map(result => typeof result.commit === 'function' ? result.commit() : undefined).filter(Boolean);
      return warnings.length ? warnings.join('; ') : undefined;
    }
  };
}

function activatePackage(targetDir, pkg, options) {
  const { execute, environment } = options;
  const guard = createTargetGuard(targetDir);
  const root = resolveOwnedPath(targetDir, pkg.source, guard);
  const publishedFiles = treeFiles(root);
  const expected = generatedBundle(root, pkg.inventory);
  if (!expected || !sameTree(expected, publishedFiles)) {
    return { status: 'deferred', reason: pkg.deferral, results: [] };
  }

  const results = [];
  const priorList = execute('clio-coder', pkg.list(options.scope), environment, options);
  if (priorList.status === 'unavailable') return { status: 'unavailable', executable: 'clio-coder', results };
  results.push(priorList);
  const priorEntry = pkg.listed(priorList.stdout, targetDir, options.scope);
  if (registered(priorEntry)) {
    return {
      status: 'registered', executable: 'clio-coder', results,
      ...(priorEntry.enabled === false ? { notice: disabledNotice(pkg, options.scope) } : {})
    };
  }

  // `library install` copies a source into the destination it owns, so the
  // published tree moves aside first. Holding it (inode identities included)
  // until the receipt is durable lets a failed registration put the previous
  // installation back before the file transaction rolls it back.
  const staging = fs.mkdtempSync(path.join(path.dirname(root), '.wtfp-staged-'));
  const source = path.join(staging, pkg.id);
  fs.renameSync(root, source);
  let finished = false;

  function rollback() {
    if (finished) return [];
    try {
      if (fs.existsSync(root)) {
        if (!sameTree(publishedFiles, treeFiles(root))) {
          throw new Error('Clio content changed concurrently; recovery tree preserved');
        }
        const removal = execute('clio-coder', [pkg.command, 'remove', pkg.id, `--${options.scope}`, '--json'], environment,
          { ...options, allowAlreadyAbsent: true });
        results.push(removal);
        if (removal.status === 'unavailable') throw new Error('Clio became unavailable during rollback');
      }
      if (fs.existsSync(root)) throw new Error('Clio rollback did not remove the replacement');
      const after = execute('clio-coder', pkg.list(options.scope), environment, options);
      results.push(after);
      if (after.status === 'unavailable' || pkg.listed(after.stdout, targetDir, options.scope)) {
        throw new Error('Clio rollback did not clear the replacement registration');
      }
      fs.renameSync(source, root);
      fs.rmdirSync(staging);
      finished = true;
      return [];
    } catch (error) {
      return [error.message];
    }
  }

  try {
    const installation = execute('clio-coder', [pkg.command, 'install', source, `--${options.scope}`, '--json'], environment, options);
    results.push(installation);
    if (installation.status === 'unavailable') throw new Error('Clio became unavailable during installation');
    const inspected = execute('clio-coder', pkg.verify(options.scope), environment, options);
    results.push(inspected);
    if (inspected.status === 'unavailable') throw new Error('Clio became unavailable during verification');
    const entry = pkg.verified(inspected.stdout, targetDir, options.scope);
    if (!registered(entry) || !sameTree(publishedFiles, treeFiles(root))) {
      throw new Error(`Clio did not report the exact WTF-P ${pkg.noun} as installed and valid with zero diagnostics`);
    }
    if (priorEntry && priorEntry.enabled !== entry.enabled) {
      throw new Error(`Clio installation changed the existing WTF-P ${pkg.noun} enabled preference`);
    }
    return {
      status: 'registered', executable: 'clio-coder', results, rollback,
      ...(entry.enabled === false ? { notice: disabledNotice(pkg, options.scope) } : {}),
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

// Remove the extension, then the plugin, each only when the receipt proves it.
// `ownedFiles` maps receipt paths below the target to their published hashes.
function deactivateClio(targetDir, native, suppliedOptions) {
  const options = scopeOptions(targetDir, suppliedOptions);
  const removed = [];
  for (const pkg of clioPackages(native).reverse()) {
    const prefix = `${pkg.source}/`;
    const ownedFiles = options.ownedFiles && new Map([...options.ownedFiles]
      .filter(([file]) => file.startsWith(prefix))
      .map(([file, hash]) => [file.slice(prefix.length), hash]));
    const result = deactivatePackage(targetDir, pkg, { ...options, ownedFiles });
    if (result.status === 'unavailable') return result;
    removed.push(result);
  }
  if (removed.length === 1) return removed[0];
  const deferred = removed.find(result => result.status === 'deferred');
  const results = removed.flatMap(result => result.results);
  if (deferred) return { status: 'deferred', reason: deferred.reason, results };
  return removed.some(result => result.status === 'unregistered')
    ? { status: 'unregistered', executable: 'clio-coder', results }
    : { status: 'not-required', results };
}

function deactivatePackage(targetDir, pkg, options) {
  const { execute, environment } = options;
  const guard = createTargetGuard(targetDir);
  const listing = execute('clio-coder', pkg.list(options.scope), environment, options);
  if (listing.status === 'unavailable') return { status: 'unavailable', executable: 'clio-coder', results: [] };
  if (!pkg.listed(listing.stdout, targetDir, options.scope)) {
    return { status: 'not-required', results: [listing] };
  }

  // Native removal is recursive. Run it only when the receipt proves that every
  // file below the installed root is one WTF-P published and nobody changed.
  const root = resolveOwnedPath(targetDir, pkg.source, guard);
  const ownedFiles = options.ownedFiles;
  if (!ownedFiles || !sameTree(treeFiles(root), ownedFiles)) {
    return { status: 'deferred', reason: `Clio native removal would include unowned or modified ${pkg.noun} files`, results: [listing] };
  }
  const result = execute('clio-coder', [pkg.command, 'remove', pkg.id, `--${options.scope}`, '--json'], environment, options);
  if (result.status === 'unavailable') return { status: 'unavailable', executable: 'clio-coder', results: [listing] };
  const after = execute('clio-coder', pkg.list(options.scope), environment, options);
  if (after.status === 'unavailable' || fs.existsSync(root) || pkg.listed(after.stdout, targetDir, options.scope)) {
    throw new Error('Clio removal did not clear WTF-P content and registration');
  }
  return { status: 'unregistered', executable: 'clio-coder', results: [listing, result, after] };
}

module.exports = { activateClio, deactivateClio, treeFiles };
