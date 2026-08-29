/**
 * Installation ownership, containment, and receipt helpers.
 *
 * A receipt is a deletion capability: only a trusted v2 receipt can authorize
 * removal without an explicit force decision. Keep this module independent of
 * CLI output so it can be tested and reused by every target adapter.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PRODUCT = 'wtf-p';
const RECEIPT_FILE = '.wtfp-version';
const RECEIPT_SCHEMA_VERSION = 2;

function pathsEqual(left, right) {
  const normalize = value => {
    const resolved = path.resolve(value);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  return normalize(left) === normalize(right);
}

function isSameOrAncestor(ancestor, candidate) {
  const relative = path.relative(path.resolve(ancestor), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

/**
 * Resolve symlinks in the existing portion of a path while retaining any
 * not-yet-created suffix. This catches an existing parent symlink without
 * requiring the final file or directory to exist.
 */
function canonicalizeProspective(inputPath) {
  let cursor = path.resolve(inputPath);
  const suffix = [];

  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    suffix.unshift(path.basename(cursor));
    cursor = parent;
  }

  let canonicalBase = cursor;
  try {
    canonicalBase = fs.realpathSync(cursor);
  } catch {
    canonicalBase = path.resolve(cursor);
  }

  return path.resolve(canonicalBase, ...suffix);
}

function expandHome(inputPath) {
  if (inputPath === '~') return os.homedir();
  if (inputPath && (inputPath.startsWith('~/') || inputPath.startsWith('~\\'))) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

/**
 * Reject targets broad enough to be a home, workspace, filesystem, or temp
 * root. Descendants such as ~/.claude and <project>/.claude remain valid.
 */
function assertSafeTarget(inputPath, options = {}) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('Installation target must be a non-empty path');
  }
  if (inputPath.includes('\0')) {
    throw new Error('Installation target contains a null byte');
  }
  if (inputPath.length > 1024) {
    throw new Error('Installation target is too long');
  }

  const expanded = expandHome(inputPath);
  const resolved = path.resolve(expanded);
  const canonical = canonicalizeProspective(resolved);
  const home = canonicalizeProspective(options.homeDir || os.homedir());
  const cwd = canonicalizeProspective(options.cwd || process.cwd());
  const temp = canonicalizeProspective(options.tempDir || os.tmpdir());
  const root = path.parse(canonical).root;

  if (pathsEqual(canonical, root)) {
    throw new Error('Refusing to use a filesystem root as an installation target');
  }
  if (isSameOrAncestor(canonical, home)) {
    throw new Error('Refusing to use the home directory or one of its ancestors as an installation target');
  }
  if (isSameOrAncestor(canonical, cwd)) {
    throw new Error('Refusing to use the workspace directory or one of its ancestors as an installation target');
  }
  if (pathsEqual(canonical, temp)) {
    throw new Error('Refusing to use the shared temporary directory as an installation target');
  }
  if (fs.existsSync(resolved) && !fs.statSync(resolved).isDirectory()) {
    throw new Error('Installation target exists and is not a directory');
  }

  // Operate on the canonical root. A requested symlink may resolve to a safe
  // directory, but descendants should never repeatedly traverse that alias.
  return { path: canonical, canonicalPath: canonical, requestedPath: resolved };
}

function fileIdentity(stat) {
  return { dev: String(stat.dev), ino: String(stat.ino) };
}

function identitiesEqual(left, right) {
  return Boolean(left && right && left.dev === right.dev && left.ino === right.ino);
}

/**
 * Pin the nearest existing ancestor and, when present, the target directory.
 * The token must be carried across plan/apply boundaries so a renamed or
 * symlink-swapped root cannot redirect later operations.
 */
function createTargetGuard(inputPath, options = {}) {
  const target = assertSafeTarget(inputPath, options);
  let cursor = target.path;
  const missingDirectories = [];
  let stat = null;

  while (!stat) {
    try {
      stat = fs.lstatSync(cursor);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      missingDirectories.push(cursor);
      const parent = path.dirname(cursor);
      if (parent === cursor) throw new Error('Could not find an existing ancestor for the installation target');
      cursor = parent;
    }
  }

  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error('The nearest existing target ancestor must be a real directory');
  }

  const targetStat = missingDirectories.length === 0 ? stat : null;
  return {
    id: crypto.randomBytes(16).toString('hex'),
    path: target.path,
    canonicalPath: target.canonicalPath,
    anchorPath: cursor,
    anchorIdentity: fileIdentity(stat),
    targetIdentity: targetStat ? fileIdentity(targetStat) : null,
    missingDirectories,
    createdDirectories: new Map(),
    safetyOptions: {
      homeDir: options.homeDir,
      cwd: options.cwd,
      tempDir: options.tempDir
    }
  };
}

function assertGuardMatchesTarget(targetDir, guard) {
  assertTargetGuard(guard);
  const target = assertSafeTarget(targetDir, guard.safetyOptions || {});
  if (!pathsEqual(target.path, guard.path) || !pathsEqual(target.canonicalPath, guard.canonicalPath)) {
    throw new Error('Target directory does not match its identity guard');
  }
  return guard;
}

function registerCreatedDirectory(guard, directory, stat = fs.lstatSync(directory)) {
  if (!guard || !guard.createdDirectories || typeof guard.createdDirectories.set !== 'function') {
    throw new Error('Missing target guard directory registry');
  }
  const resolved = path.resolve(directory);
  const isTargetAncestor = isSameOrAncestor(guard.anchorPath, resolved) && isSameOrAncestor(resolved, guard.path);
  const isTargetDescendant = isSameOrAncestor(guard.path, resolved);
  if ((!isTargetAncestor && !isTargetDescendant) || pathsEqual(resolved, guard.anchorPath)) {
    throw new Error(`Created directory is outside the guarded target: ${directory}`);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Created path is not a real directory: ${directory}`);
  }
  const identity = fileIdentity(stat);
  guard.createdDirectories.set(resolved, identity);
  return { path: resolved, identity, guardId: guard.id };
}

function createOwnedDirectory(guard, directory, options = {}) {
  const resolved = path.resolve(directory);
  const parent = path.dirname(resolved);
  const targetExists = Boolean(guard.targetIdentity);
  if (targetExists) assertTargetGuard(guard);

  const isTargetAncestor = isSameOrAncestor(guard.anchorPath, resolved) && isSameOrAncestor(resolved, guard.path);
  const isTargetDescendant = isSameOrAncestor(guard.path, resolved);
  if ((!isTargetAncestor && !isTargetDescendant) || pathsEqual(resolved, guard.anchorPath)) {
    throw new Error(`Directory is outside the guarded target: ${directory}`);
  }

  const parentStat = fs.lstatSync(parent);
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
    throw new Error(`Directory parent is not a real directory: ${parent}`);
  }
  const registeredParent = guard.createdDirectories.get(parent);
  if (registeredParent && !identitiesEqual(fileIdentity(parentStat), registeredParent)) {
    throw new Error(`Directory parent identity changed: ${parent}`);
  }
  if (pathsEqual(parent, guard.anchorPath) && !identitiesEqual(fileIdentity(parentStat), guard.anchorIdentity)) {
    throw new Error('Installation target ancestor identity changed during directory creation');
  }

  const parentDescriptor = fs.openSync(
    parent,
    fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY || 0) | (fs.constants.O_NOFOLLOW || 0)
  );
  try {
    const openedParent = fs.fstatSync(parentDescriptor);
    if (!identitiesEqual(fileIdentity(openedParent), fileIdentity(parentStat))) {
      throw new Error(`Directory parent changed before creation: ${parent}`);
    }
    const pinnedParent = process.platform === 'linux' && fs.existsSync(`/proc/self/fd/${parentDescriptor}`)
      ? `/proc/self/fd/${parentDescriptor}`
      : parent;
    const pinnedChild = path.join(pinnedParent, path.basename(resolved));
    try {
      fs.mkdirSync(pinnedChild, { mode: options.mode });
    } catch (error) {
      if (error.code === 'EEXIST') {
        throw new Error(`Directory appeared during creation: ${resolved}`);
      }
      throw error;
    }
    const stat = fs.lstatSync(pinnedChild);
    const record = registerCreatedDirectory(guard, resolved, stat);
    const pathStat = fs.lstatSync(resolved);
    if (pathStat.isSymbolicLink() || !pathStat.isDirectory() ||
        !identitiesEqual(fileIdentity(pathStat), record.identity)) {
      throw new Error(`Created directory path changed immediately after creation: ${resolved}`);
    }
    if (targetExists) assertTargetGuard(guard);
    return record;
  } finally {
    fs.closeSync(parentDescriptor);
  }
}

function assertTargetGuard(guard) {
  if (!guard || typeof guard !== 'object') throw new Error('Missing target identity guard');
  const current = assertSafeTarget(guard.path, guard.safetyOptions || {});
  if (!pathsEqual(current.canonicalPath, guard.canonicalPath)) {
    throw new Error('Installation target canonical path changed during the operation');
  }

  const anchorStat = fs.lstatSync(guard.anchorPath);
  if (anchorStat.isSymbolicLink() || !anchorStat.isDirectory() ||
      !identitiesEqual(fileIdentity(anchorStat), guard.anchorIdentity)) {
    throw new Error('Installation target ancestor identity changed during the operation');
  }

  let targetStat = null;
  try {
    targetStat = fs.lstatSync(guard.path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (guard.targetIdentity) {
    if (!targetStat || targetStat.isSymbolicLink() || !targetStat.isDirectory() ||
        !identitiesEqual(fileIdentity(targetStat), guard.targetIdentity)) {
      throw new Error('Installation target identity changed during the operation');
    }
  } else if (targetStat) {
    throw new Error('Installation target appeared after planning and is not owned by this operation');
  }

  return guard;
}

/**
 * Create a previously absent target one directory at a time. mkdir success is
 * the ownership proof; an EEXIST race aborts instead of adopting a directory
 * created by another process.
 */
function materializeTargetGuard(guard) {
  assertTargetGuard(guard);
  if (guard.targetIdentity) return [];

  const created = [];
  try {
    for (const directory of [...guard.missingDirectories].reverse()) {
      created.push(createOwnedDirectory(guard, directory));
    }
    const targetStat = fs.lstatSync(guard.path);
    guard.targetIdentity = fileIdentity(targetStat);
    assertTargetGuard(guard);
    guard.missingDirectories = [];
    return created;
  } catch (error) {
    const cleanupFailures = removeCreatedDirectories(created, guard);
    guard.targetIdentity = null;
    if (cleanupFailures.length > 0) {
      error.message += `; cleanup also failed for ${cleanupFailures.length} created director${cleanupFailures.length === 1 ? 'y' : 'ies'}`;
      error.cleanupFailures = cleanupFailures;
    }
    throw error;
  }
}

function removeCreatedDirectories(records, guard) {
  if (!guard || !guard.createdDirectories || typeof guard.createdDirectories.get !== 'function') {
    throw new Error('A target guard is required to remove created directories');
  }
  const failures = [];
  for (const record of [...records].sort((left, right) => right.path.length - left.path.length)) {
    try {
      const resolved = path.resolve(record.path);
      const registeredIdentity = guard.createdDirectories.get(resolved);
      if (record.guardId !== guard.id || !identitiesEqual(record.identity, registeredIdentity)) {
        throw new Error('directory is not registered to this operation');
      }
      const anchorStat = fs.lstatSync(guard.anchorPath);
      if (anchorStat.isSymbolicLink() || !anchorStat.isDirectory() ||
          !identitiesEqual(fileIdentity(anchorStat), guard.anchorIdentity)) {
        throw new Error('target ancestor identity changed');
      }
      const stat = fs.lstatSync(record.path);
      if (stat.isSymbolicLink() || !stat.isDirectory() ||
          !identitiesEqual(fileIdentity(stat), record.identity)) {
        throw new Error('created directory identity changed');
      }
      if (fs.readdirSync(record.path).length !== 0) {
        throw new Error('created directory is no longer empty');
      }
      const parent = path.dirname(record.path);
      const parentDescriptor = fs.openSync(
        parent,
        fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY || 0) | (fs.constants.O_NOFOLLOW || 0)
      );
      try {
        const pinnedParent = process.platform === 'linux' && fs.existsSync(`/proc/self/fd/${parentDescriptor}`)
          ? `/proc/self/fd/${parentDescriptor}`
          : parent;
        const pinnedSource = path.join(pinnedParent, path.basename(record.path));
        const quarantineName = `.wtfp-remove-${process.pid}-${crypto.randomBytes(8).toString('hex')}`;
        const quarantine = path.join(pinnedParent, quarantineName);
        const immediate = fs.lstatSync(pinnedSource);
        if (immediate.isSymbolicLink() || !immediate.isDirectory() ||
            !identitiesEqual(fileIdentity(immediate), record.identity)) {
          throw new Error('created directory changed immediately before removal');
        }
        fs.renameSync(pinnedSource, quarantine);
        const quarantined = fs.lstatSync(quarantine);
        if (quarantined.isSymbolicLink() || !quarantined.isDirectory() ||
            !identitiesEqual(fileIdentity(quarantined), record.identity)) {
          // The source was swapped between validation and rename. Preserve the
          // unexpected directory under quarantine instead of deleting it.
          throw new Error('created directory was swapped during removal and was preserved');
        }
        if (fs.readdirSync(quarantine).length !== 0) {
          throw new Error('created directory became nonempty during removal and was preserved');
        }
        const final = fs.lstatSync(quarantine);
        if (!identitiesEqual(fileIdentity(final), record.identity)) {
          throw new Error('created directory identity changed in quarantine');
        }
        fs.rmdirSync(quarantine);
      } finally {
        fs.closeSync(parentDescriptor);
      }
      guard.createdDirectories.delete(resolved);
    } catch (error) {
      if (error.code !== 'ENOENT') failures.push({ path: record.path, message: error.message });
    }
  }
  return failures;
}

function normalizeRelativePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string' || inputPath.includes('\0')) {
    throw new Error('Receipt path must be a non-empty relative path');
  }

  const portable = inputPath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (path.posix.isAbsolute(portable) || path.win32.isAbsolute(portable)) {
    throw new Error(`Receipt path must be relative: ${inputPath}`);
  }

  const normalized = path.posix.normalize(portable);
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`Receipt path escapes the installation target: ${inputPath}`);
  }
  return normalized;
}

function relativeOwnedPath(targetDir, absolutePath, targetGuard = null) {
  if (targetGuard) assertGuardMatchesTarget(targetDir, targetGuard);
  const target = targetGuard ? targetGuard.path : assertSafeTarget(targetDir).path;
  const candidate = path.resolve(absolutePath);
  const relative = path.relative(target, candidate);
  return normalizeRelativePath(relative);
}

/**
 * Resolve a receipt-relative path and verify both lexical and realpath-aware
 * containment. Existing symlinks inside the target may not redirect a write or
 * deletion outside the target.
 */
function resolveOwnedPath(targetDir, relativePath, targetGuard = null) {
  if (targetGuard) assertGuardMatchesTarget(targetDir, targetGuard);
  const target = targetGuard
    ? { path: targetGuard.path, canonicalPath: targetGuard.canonicalPath }
    : assertSafeTarget(targetDir);
  const normalized = normalizeRelativePath(relativePath);
  const candidate = path.resolve(target.path, ...normalized.split('/'));

  if (!isSameOrAncestor(target.path, candidate) || pathsEqual(target.path, candidate)) {
    throw new Error(`Path escapes the installation target: ${relativePath}`);
  }

  const canonicalCandidate = canonicalizeProspective(candidate);
  if (!isSameOrAncestor(target.canonicalPath, canonicalCandidate) || pathsEqual(target.canonicalPath, canonicalCandidate)) {
    throw new Error(`Path escapes the installation target through a symlink: ${relativePath}`);
  }

  // The target root itself may intentionally be a symlink, but package-owned
  // descendants must not traverse or replace nested links—even links that
  // currently resolve back inside the root. This keeps write/delete behavior
  // stable and avoids races around directory cleanup.
  let cursor = target.path;
  for (const segment of normalized.split('/')) {
    cursor = path.join(cursor, segment);
    let stat;
    try {
      stat = fs.lstatSync(cursor);
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`Path contains a symbolic link inside the installation target: ${relativePath}`);
    }
  }

  return candidate;
}

function assertOwnedAbsolutePath(targetDir, absolutePath, targetGuard = null) {
  const relative = relativeOwnedPath(targetDir, absolutePath, targetGuard);
  return resolveOwnedPath(targetDir, relative, targetGuard);
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  return sha256Buffer(fs.readFileSync(filePath));
}

function readOwnedRegularSnapshot(targetDir, absolutePath, targetGuard = null, options = {}) {
  const guard = targetGuard || createTargetGuard(targetDir);
  assertGuardMatchesTarget(targetDir, guard);
  const ownedPath = assertOwnedAbsolutePath(targetDir, absolutePath, guard);
  const parent = path.dirname(ownedPath);
  let parentDescriptor;
  try {
    parentDescriptor = fs.openSync(
      parent,
      fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY || 0) | (fs.constants.O_NOFOLLOW || 0)
    );
  } catch (error) {
    if (options.allowMissing && error.code === 'ENOENT') return null;
    throw error;
  }

  let descriptor;
  try {
    const parentIdentity = fileIdentity(fs.fstatSync(parentDescriptor));
    const parentStat = fs.lstatSync(parent);
    if (parentStat.isSymbolicLink() || !parentStat.isDirectory() ||
        !identitiesEqual(fileIdentity(parentStat), parentIdentity)) {
      throw new Error(`Owned file parent changed before read: ${parent}`);
    }
    assertOwnedAbsolutePath(targetDir, absolutePath, guard);
    const pinnedParent = process.platform === 'linux' && fs.existsSync(`/proc/self/fd/${parentDescriptor}`)
      ? `/proc/self/fd/${parentDescriptor}`
      : parent;
    const pinnedPath = path.join(pinnedParent, path.basename(ownedPath));
    try {
      descriptor = fs.openSync(pinnedPath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    } catch (error) {
      if (options.allowMissing && error.code === 'ENOENT') return null;
      throw error;
    }

    const before = fs.fstatSync(descriptor);
    if (!before.isFile()) throw new Error(`Owned path is not a regular file: ${ownedPath}`);
    const bytes = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor);
    if (!identitiesEqual(fileIdentity(before), fileIdentity(after)) ||
        before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
      throw new Error(`Owned file changed while it was being read: ${ownedPath}`);
    }
    const pinnedStat = fs.lstatSync(pinnedPath);
    const pathStat = fs.lstatSync(ownedPath);
    if (pinnedStat.isSymbolicLink() || pathStat.isSymbolicLink() ||
        !pinnedStat.isFile() || !pathStat.isFile() ||
        !identitiesEqual(fileIdentity(pinnedStat), fileIdentity(before)) ||
        !identitiesEqual(fileIdentity(pathStat), fileIdentity(before))) {
      throw new Error(`Owned file path changed while it was being read: ${ownedPath}`);
    }
    assertOwnedAbsolutePath(targetDir, absolutePath, guard);
    const identity = fileIdentity(before);
    return {
      path: ownedPath,
      bytes,
      sha256: sha256Buffer(bytes),
      mode: before.mode & 0o777,
      identity,
      identityKey: `${identity.dev}:${identity.ino}`
    };
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.closeSync(parentDescriptor);
  }
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function isV2ReceiptShape(receipt) {
  return Boolean(
    receipt &&
    typeof receipt === 'object' &&
    !Array.isArray(receipt) &&
    receipt.schemaVersion === RECEIPT_SCHEMA_VERSION &&
    receipt.product === PRODUCT &&
    typeof receipt.version === 'string' &&
    Array.isArray(receipt.files) &&
    receipt.target &&
    typeof receipt.target === 'object' &&
    typeof receipt.target.canonicalPath === 'string' &&
    receipt.target.canonicalPath.length > 0 &&
    receipt.target.canonicalPath.length <= 1024 &&
    !receipt.target.canonicalPath.includes('\0') &&
    path.isAbsolute(receipt.target.canonicalPath) &&
    path.resolve(receipt.target.canonicalPath) === receipt.target.canonicalPath
  );
}

function hasValidV2Entries(receipt) {
  if (!isV2ReceiptShape(receipt)) return false;
  const paths = new Set();
  for (const entry of receipt.files) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !isSha256(entry.sha256)) return false;
    let relative;
    try {
      relative = normalizeRelativePath(entry.path);
    } catch {
      return false;
    }
    if (entry.path !== relative || relative === RECEIPT_FILE || relative.startsWith('.wtfp-backup-') || paths.has(relative)) return false;
    paths.add(relative);
  }

  if (receipt.backups !== undefined) {
    if (!Array.isArray(receipt.backups)) return false;
    const backupPaths = new Set();
    for (const backup of receipt.backups) {
      if (!backup || typeof backup !== 'object' || Array.isArray(backup) || !isSha256(backup.sha256)) return false;
      let backupPath;
      let originalPath;
      try {
        backupPath = normalizeRelativePath(backup.path);
        originalPath = normalizeRelativePath(backup.originalPath);
      } catch {
        return false;
      }
      if (backup.path !== backupPath || backup.originalPath !== originalPath ||
          backupPath === RECEIPT_FILE || backupPaths.has(backupPath) || originalPath === RECEIPT_FILE) return false;
      backupPaths.add(backupPath);
    }
  }
  return true;
}

function isLegacyReceiptShape(receipt) {
  return Boolean(
    receipt &&
    typeof receipt === 'object' &&
    !Array.isArray(receipt) &&
    (receipt.schemaVersion === undefined || receipt.schemaVersion === 1) &&
    (receipt.product === undefined || receipt.product === PRODUCT || receipt.product === 'write-the-f-paper') &&
    typeof receipt.version === 'string' &&
    Array.isArray(receipt.manifest)
  );
}

function readReceipt(targetDir, targetGuard = null) {
  const guard = targetGuard || createTargetGuard(targetDir);
  let receiptPath;
  try {
    receiptPath = resolveOwnedPath(targetDir, RECEIPT_FILE, guard);
  } catch (error) {
    return { receipt: null, corrupt: true, error: error.message };
  }

  try {
    const snapshot = readOwnedRegularSnapshot(targetDir, receiptPath, guard, { allowMissing: true });
    if (!snapshot) return { receipt: null, corrupt: false, error: null, receiptSha256: null };
    const bytes = snapshot.bytes;
    const receipt = JSON.parse(bytes.toString('utf8'));
    if ((!isV2ReceiptShape(receipt) || !hasValidV2Entries(receipt)) && !isLegacyReceiptShape(receipt)) {
      return {
        receipt: null,
        corrupt: true,
        error: 'unsupported or malformed WTF-P receipt schema',
        receiptSha256: snapshot.sha256
      };
    }
    return { receipt, corrupt: false, error: null, receiptSha256: snapshot.sha256 };
  } catch (error) {
    return { receipt: null, corrupt: true, error: error.message, receiptSha256: null };
  }
}

function isTrustedReceipt(receipt, targetDir, targetGuard = null) {
  if (!targetDir) return false;
  let target;
  try {
    if (targetGuard) assertTargetGuard(targetGuard);
    target = targetGuard || assertSafeTarget(targetDir);
  } catch {
    return false;
  }
  return Boolean(
    isV2ReceiptShape(receipt) &&
    hasValidV2Entries(receipt) &&
    pathsEqual(receipt.target.canonicalPath, target.canonicalPath)
  );
}

function getReceiptEntries(receipt, targetDir, targetGuard = null) {
  if (!receipt || typeof receipt !== 'object') return [];

  if (isV2ReceiptShape(receipt)) {
    const trusted = isTrustedReceipt(receipt, targetDir, targetGuard);
    return receipt.files.map(entry => ({ ...entry, trusted }));
  }

  // v0.5 and earlier receipts recorded every planned file, including files the
  // installer skipped. These paths are useful for migration diagnostics but
  // cannot prove ownership and therefore never authorize default deletion.
  if (Array.isArray(receipt.manifest)) {
    return receipt.manifest.map(entry => ({
      path: typeof entry.path === 'string' ? entry.path.replace(/^\.\//, '') : entry.path,
      legacyChecksum: entry.checksum,
      trusted: false
    }));
  }

  return [];
}

function atomicWriteFile(filePath, content, options = {}) {
  const { mustNotExist = false, targetGuard = null, ...writeOptions } = options;
  if (targetGuard) assertOwnedAbsolutePath(targetGuard.path, filePath, targetGuard);
  const parentPath = path.dirname(path.resolve(filePath));
  const leafName = path.basename(filePath);
  const directoryFlags = fs.constants.O_RDONLY |
    (fs.constants.O_DIRECTORY || 0) |
    (fs.constants.O_NOFOLLOW || 0);
  const parentDescriptor = fs.openSync(parentPath, directoryFlags);
  const parentIdentity = fileIdentity(fs.fstatSync(parentDescriptor));
  const parentPathStat = fs.lstatSync(parentPath);
  if (parentPathStat.isSymbolicLink() || !parentPathStat.isDirectory() ||
      !identitiesEqual(fileIdentity(parentPathStat), parentIdentity)) {
    fs.closeSync(parentDescriptor);
    throw new Error(`Destination parent changed before atomic write: ${parentPath}`);
  }
  if (targetGuard) assertOwnedAbsolutePath(targetGuard.path, filePath, targetGuard);

  const pinnedParent = process.platform === 'linux' && fs.existsSync(`/proc/self/fd/${parentDescriptor}`)
    ? `/proc/self/fd/${parentDescriptor}`
    : parentPath;
  const pinnedDestination = path.join(pinnedParent, leafName);
  const suffix = crypto.randomBytes(6).toString('hex');
  const temporaryName = `${leafName}.tmp-${process.pid}-${suffix}`;
  const temporaryPath = path.join(pinnedParent, temporaryName);
  let temporaryIdentity = null;
  let published = false;
  let cleanupError = null;
  try {
    if (targetGuard) assertTargetGuard(targetGuard);
    const requestedMode = writeOptions.mode === undefined ? 0o666 : writeOptions.mode;
    const temporaryDescriptor = fs.openSync(
      temporaryPath,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0),
      requestedMode
    );
    try {
      temporaryIdentity = fileIdentity(fs.fstatSync(temporaryDescriptor));
      fs.writeFileSync(temporaryDescriptor, content, {
        encoding: writeOptions.encoding
      });
    } finally {
      fs.closeSync(temporaryDescriptor);
    }
    if (targetGuard) assertTargetGuard(targetGuard);
    const currentParentStat = fs.lstatSync(parentPath);
    if (currentParentStat.isSymbolicLink() || !currentParentStat.isDirectory() ||
        !identitiesEqual(fileIdentity(currentParentStat), parentIdentity)) {
      throw new Error(`Destination parent changed during atomic write: ${parentPath}`);
    }
    if (mustNotExist) {
      // Linking a complete same-directory temporary file publishes a new file
      // atomically and fails with EEXIST instead of overwriting a raced creator.
      fs.linkSync(temporaryPath, pinnedDestination);
      published = true;
    } else {
      fs.renameSync(temporaryPath, pinnedDestination);
      published = true;
    }
    if (targetGuard) {
      assertTargetGuard(targetGuard);
      const finalParentStat = fs.lstatSync(parentPath);
      if (finalParentStat.isSymbolicLink() || !finalParentStat.isDirectory() ||
          !identitiesEqual(fileIdentity(finalParentStat), parentIdentity)) {
        throw new Error(`Destination parent changed immediately after atomic write: ${parentPath}`);
      }
      assertOwnedAbsolutePath(targetGuard.path, filePath, targetGuard);
    }
  } catch (error) {
    error.published = published;
    error.destination = filePath;
    throw error;
  } finally {
    try {
      let temporaryStat = null;
      try {
        temporaryStat = fs.lstatSync(temporaryPath);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (temporaryStat) {
        if (temporaryStat.isSymbolicLink() || !temporaryIdentity ||
            !identitiesEqual(fileIdentity(temporaryStat), temporaryIdentity)) {
          throw new Error(`Atomic-write temporary path changed unexpectedly: ${filePath}`);
        }
        fs.unlinkSync(temporaryPath);
      }
    } catch (error) {
      cleanupError = error;
    }
    if (cleanupError && published) {
      try {
        const retryStat = fs.lstatSync(temporaryPath);
        if (!retryStat.isSymbolicLink() && temporaryIdentity &&
            identitiesEqual(fileIdentity(retryStat), temporaryIdentity)) {
          fs.unlinkSync(temporaryPath);
          cleanupError = null;
        }
      } catch (error) {
        if (error.code === 'ENOENT') cleanupError = null;
      }
    }
    fs.closeSync(parentDescriptor);
    if (cleanupError) {
      cleanupError.published = published;
      cleanupError.destination = filePath;
      throw cleanupError;
    }
  }

  return { published, cleanupError };
}

function buildReceipt(options) {
  const {
    targetDir,
    version,
    runtime,
    scope,
    writtenFiles,
    skipped = 0,
    selectionComplete = true,
    previousReceipt = null,
    adapterVersion = 1,
    generatorVersion = 1,
    targetGuard: suppliedGuard = null
  } = options;

  if (!Array.isArray(writtenFiles) || writtenFiles.length === 0) {
    throw new Error('Cannot create a receipt without at least one written file');
  }
  const targetGuard = suppliedGuard || createTargetGuard(targetDir);
  assertGuardMatchesTarget(targetDir, targetGuard);

  const now = new Date().toISOString();
  const entries = new Map();

  if (isTrustedReceipt(previousReceipt, targetDir, targetGuard)) {
    for (const previous of previousReceipt.files) {
      try {
        const relative = normalizeRelativePath(previous.path);
        const currentPath = resolveOwnedPath(targetDir, relative, targetGuard);
        const snapshot = readOwnedRegularSnapshot(targetDir, currentPath, targetGuard, { allowMissing: true });
        if (snapshot && isSha256(previous.sha256)) {
          entries.set(relative, { ...previous, path: relative });
        }
      } catch {
        // Ignore malformed or escaped prior entries. A receipt is never allowed
        // to expand its own authority through invalid data.
      }
    }
  }

  const newBackups = [];
  for (const written of writtenFiles) {
    const destination = assertOwnedAbsolutePath(targetDir, written.dest, targetGuard);
    const relative = relativeOwnedPath(targetDir, destination, targetGuard);
    const snapshot = readOwnedRegularSnapshot(targetDir, destination, targetGuard, { allowMissing: true });
    if (!snapshot) throw new Error(`Installed file is missing before receipt creation: ${relative}`);

    entries.set(relative, {
      path: relative,
      sha256: snapshot.sha256,
      component: written.componentId || 'unknown',
      action: written.action || 'created',
      sourceVersion: version,
      installedAt: now
    });

    if (written.backupPath) {
      const backupPath = assertOwnedAbsolutePath(targetDir, written.backupPath, targetGuard);
      const backupSnapshot = readOwnedRegularSnapshot(targetDir, backupPath, targetGuard, { allowMissing: true });
      if (!backupSnapshot) throw new Error(`Installed backup is missing before receipt creation: ${backupPath}`);
      newBackups.push({
        path: relativeOwnedPath(targetDir, backupPath, targetGuard),
        originalPath: relative,
        sha256: backupSnapshot.sha256,
        createdAt: now
      });
    }
  }

  const previousBackups = isTrustedReceipt(previousReceipt, targetDir, targetGuard) && Array.isArray(previousReceipt.backups)
    ? previousReceipt.backups.filter(backup => {
      try {
        const backupPath = resolveOwnedPath(targetDir, backup.path, targetGuard);
        return Boolean(readOwnedRegularSnapshot(targetDir, backupPath, targetGuard, { allowMissing: true }));
      } catch {
        return false;
      }
    })
    : [];

  return {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    product: PRODUCT,
    version,
    target: {
      canonicalPath: targetGuard.canonicalPath
    },
    runtime: runtime || 'unknown',
    scope: scope || 'unknown',
    adapterVersion,
    generatorVersion,
    installedAt: isTrustedReceipt(previousReceipt, targetDir, targetGuard) && previousReceipt.installedAt
      ? previousReceipt.installedAt
      : now,
    updatedAt: now,
    partial: skipped > 0 || !selectionComplete ||
      Array.from(entries.values()).some(entry => entry.sourceVersion !== version),
    files: Array.from(entries.values()).sort((left, right) => left.path.localeCompare(right.path)),
    backups: [...previousBackups, ...newBackups]
  };
}

function writeReceipt(targetDir, receipt, targetGuard = null) {
  const guard = targetGuard || createTargetGuard(targetDir);
  assertGuardMatchesTarget(targetDir, guard);
  if (!fs.existsSync(targetDir)) throw new Error('Installation target must exist before writing its receipt');
  const receiptPath = resolveOwnedPath(targetDir, RECEIPT_FILE, guard);
  let previousContent = null;
  let previousMode = null;
  const previousSnapshot = readOwnedRegularSnapshot(
    targetDir,
    receiptPath,
    guard,
    { allowMissing: true }
  );
  if (previousSnapshot) {
    previousContent = previousSnapshot.bytes;
    previousMode = previousSnapshot.mode;
  }
  const nextContent = Buffer.from(JSON.stringify(receipt, null, 2) + '\n');
  const nextHash = sha256Buffer(nextContent);
  try {
    atomicWriteFile(receiptPath, nextContent, { mode: 0o644, targetGuard: guard });
  } catch (error) {
    if (error.published) {
      try {
        assertTargetGuard(guard);
        const currentStat = fs.lstatSync(receiptPath);
        if (currentStat.isSymbolicLink() || !currentStat.isFile() || sha256File(receiptPath) !== nextHash) {
          throw new Error('published receipt changed before rollback and was preserved');
        }
        if (previousContent === null) {
          fs.unlinkSync(receiptPath);
        } else {
          atomicWriteFile(receiptPath, previousContent, {
            mode: previousMode,
            targetGuard: guard
          });
        }
        assertTargetGuard(guard);
      } catch (rollbackError) {
        error.message += `; receipt rollback failed: ${rollbackError.message}`;
        error.receiptRollbackFailure = rollbackError.message;
      }
    }
    throw error;
  }
  assertTargetGuard(guard);
  return receiptPath;
}

function removeEmptyParents(targetDir, startDir, targetGuard = null) {
  if (targetGuard) assertTargetGuard(targetGuard);
  const target = targetGuard || assertSafeTarget(targetDir);
  let current = path.resolve(startDir);

  while (!pathsEqual(current, target.path) && isSameOrAncestor(target.path, current)) {
    // Resolve every candidate before deletion so an inserted symlink cannot
    // redirect cleanup. rmdirSync itself only removes empty real directories.
    const relative = path.relative(target.path, current);
    resolveOwnedPath(target.path, relative, targetGuard);
    if (!fs.existsSync(current)) break;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) break;
    if (fs.readdirSync(current).length > 0) break;
    if (targetGuard) assertTargetGuard(targetGuard);
    fs.rmdirSync(current);
    if (targetGuard) assertTargetGuard(targetGuard);
    current = path.dirname(current);
  }
}

module.exports = {
  PRODUCT,
  RECEIPT_FILE,
  RECEIPT_SCHEMA_VERSION,
  assertSafeTarget,
  assertGuardMatchesTarget,
  assertTargetGuard,
  assertOwnedAbsolutePath,
  atomicWriteFile,
  buildReceipt,
  canonicalizeProspective,
  createTargetGuard,
  createOwnedDirectory,
  getReceiptEntries,
  hasValidV2Entries,
  isSameOrAncestor,
  isLegacyReceiptShape,
  isTrustedReceipt,
  isV2ReceiptShape,
  normalizeRelativePath,
  materializeTargetGuard,
  removeCreatedDirectories,
  readReceipt,
  readOwnedRegularSnapshot,
  registerCreatedDirectory,
  relativeOwnedPath,
  removeEmptyParents,
  resolveOwnedPath,
  sha256Buffer,
  sha256File,
  writeReceipt
};
