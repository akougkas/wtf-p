#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MANIFEST = require('./lib/manifest');
const {
  createOutput,
  createRL,
  detectInstallation,
  expandTilde,
  getPathLabel,
  prompt,
  VERSION_FILE
} = require('./lib/utils');
const {
  PRODUCT,
  assertTargetGuard,
  atomicWriteFile,
  createOwnedDirectory,
  createTargetGuard,
  getReceiptEntries,
  isSameOrAncestor,
  isTrustedReceipt,
  isV2ReceiptShape,
  materializeTargetGuard,
  normalizeRelativePath,
  readReceipt,
  readOwnedRegularSnapshot,
  removeCreatedDirectories,
  removeEmptyParents,
  resolveOwnedPath,
  sha256Buffer,
  sha256File,
  writeReceipt
} = require('./lib/ownership');

let version = 'unknown';
try {
  version = require('../package.json').version;
} catch {
  // The standalone uninstaller can still remove a receipt without package.json.
}

function parseArgs(argv = []) {
  const booleanFlags = new Set([
    '--global', '-g', '--local', '-l', '--claude', '--gemini', '--opencode', '--all',
    '--force', '-f', '--yes', '-y', '--backup', '-b', '--dry-run', '-n',
    '--clean-backups', '--help', '-h', '--no-color', '--quiet', '-q'
  ]);
  let configArguments = 0;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--config-dir' || argument === '-c') {
      configArguments++;
      index++;
      if (index >= argv.length || !argv[index] || argv[index].startsWith('-')) {
        throw new Error('--config-dir requires a non-empty path argument');
      }
      continue;
    }
    if (argument.startsWith('--config-dir=') || argument.startsWith('-c=')) {
      configArguments++;
      if (!argument.slice(argument.indexOf('=') + 1)) {
        throw new Error('--config-dir requires a non-empty path argument');
      }
      continue;
    }
    if (!booleanFlags.has(argument)) throw new Error(`Unknown uninstall argument: ${argument}`);
  }
  if (configArguments > 1) throw new Error('--config-dir may only be provided once');

  const has = (...names) => names.some(name => argv.includes(name));
  const options = {
    hasGlobal: has('--global', '-g'),
    hasLocal: has('--local', '-l'),
    hasClaude: has('--claude'),
    hasGemini: has('--gemini'),
    hasOpenCode: has('--opencode'),
    hasAll: has('--all'),
    hasForce: has('--force', '-f'),
    hasYes: has('--yes', '-y'),
    hasBackup: has('--backup', '-b'),
    hasDryRun: has('--dry-run', '-n'),
    hasCleanBackups: has('--clean-backups'),
    hasHelp: has('--help', '-h'),
    hasNoColor: has('--no-color'),
    hasQuiet: has('--quiet', '-q'),
    explicitConfigDir: null
  };

  const separateIndex = argv.findIndex(arg => arg === '--config-dir' || arg === '-c');
  const joined = argv.find(arg => arg.startsWith('--config-dir=') || arg.startsWith('-c='));
  if (separateIndex !== -1) {
    const value = argv[separateIndex + 1];
    if (!value || value.startsWith('-')) throw new Error('--config-dir requires a non-empty path argument');
    options.explicitConfigDir = value;
  } else if (joined) {
    const value = joined.slice(joined.indexOf('=') + 1);
    if (!value) throw new Error('--config-dir requires a non-empty path argument');
    options.explicitConfigDir = value;
  }

  if (options.hasGlobal && options.hasLocal) {
    throw new Error('Choose either --global or --local, not both');
  }
  if (options.hasGlobal && (options.hasGemini || options.hasOpenCode || options.hasAll)) {
    throw new Error('--global selects Claude and cannot be combined with another target');
  }
  if (options.hasLocal && (options.hasGemini || options.hasOpenCode || options.hasAll)) {
    throw new Error('--local currently requires the Claude target');
  }
  if (options.hasLocal && options.explicitConfigDir) {
    throw new Error('--config-dir cannot be combined with --local');
  }

  const selectedTargets = [options.hasClaude, options.hasGemini, options.hasOpenCode].filter(Boolean).length;
  if (selectedTargets > 1) throw new Error('Choose one target, or use --all');
  if (options.hasAll && selectedTargets > 0) {
    throw new Error('--all cannot be combined with another target selector');
  }
  if (options.hasAll && options.explicitConfigDir) {
    throw new Error('--all cannot share one --config-dir across incompatible clients');
  }
  if (options.explicitConfigDir && !options.hasGlobal && selectedTargets === 0) {
    throw new Error('--config-dir also requires an explicit target such as --claude');
  }

  return options;
}

function getVendorDir(runtime, explicitConfigDir, cwd = process.cwd()) {
  if (runtime === 'claude-local') return path.join(cwd, '.claude');

  const vendorConfig = MANIFEST[runtime];
  if (!vendorConfig) throw new Error(`Unknown runtime: ${runtime}`);
  if (explicitConfigDir) return expandTilde(explicitConfigDir);
  if (process.env[vendorConfig.configDirEnv]) return expandTilde(process.env[vendorConfig.configDirEnv]);
  return path.join(os.homedir(), vendorConfig.defaultDir);
}

function createBanner(out) {
  const c = out.colors;
  return `
${c.magenta('██╗    ██╗████████╗███████╗      ██████╗')}
${c.magenta('██║    ██║╚══██╔══╝██╔════╝      ██╔══██╗')}
${c.magenta('██║ █╗ ██║   ██║   █████╗  █████╗██████╔╝')}
${c.magenta('██║███╗██║   ██║   ██╔══╝  ╚════╝██╔═══╝')}
${c.magenta('╚███╔███╔╝   ██║   ██║           ██║')}
${c.magenta(' ╚══╝╚══╝    ╚═╝   ╚═╝           ╚═╝')}

  ${c.cyan('WTF-P Uninstaller')} ${c.dim(`v${version}`)}
`;
}

function showHelp(out) {
  const c = out.colors;
  console.log(createBanner(out));
  console.log(`  ${c.yellow('Usage:')} npx wtf-p uninstall [options]

  ${c.yellow('Target and scope:')}
    ${c.cyan('-g, --global')}              Claude user installation (legacy alias)
    ${c.cyan('-l, --local')}               Claude installation in ./.claude
    ${c.cyan('--claude')}                  Claude Code user installation
    ${c.cyan('--gemini')}                  Gemini CLI user installation
    ${c.cyan('--opencode')}                OpenCode user installation
    ${c.cyan('--all')}                     Every detected user installation
    ${c.cyan('-c, --config-dir <path>')}   Custom root; requires an explicit target

  ${c.yellow('Safety and output:')}
    ${c.cyan('-n, --dry-run')}             Classify exact receipt paths without changing them
    ${c.cyan('-b, --backup')}              Copy exact removal candidates to an owned backup bundle
    ${c.cyan('--clean-backups')}           Remove unchanged backups recorded by WTF-P
    ${c.cyan('-y, --yes')}                 Confirm removal of unchanged owned files
    ${c.cyan('-f, --force')}               Skip confirmation and remove modified/untrusted receipt files
    ${c.cyan('--no-color')}                Disable colored output
    ${c.cyan('-q, --quiet')}               Suppress non-essential output
    ${c.cyan('-h, --help')}                Show this help

  Uninstall removes exact regular files authorized by ${c.cyan(VERSION_FILE)}. Modified files,
  malformed paths, symlinks, and unowned siblings are preserved by default. Even --force
  never follows an unsafe path or recursively removes a shared directory.
`);
}

function classifyReceiptEntries(targetDir, receipt, force = false, suppliedGuard = null) {
  const targetGuard = suppliedGuard || createTargetGuard(targetDir);
  assertTargetGuard(targetGuard);
  const entries = getReceiptEntries(receipt, targetDir, targetGuard);
  const trustedReceipt = isTrustedReceipt(receipt, targetDir, targetGuard);
  const v2Shape = isV2ReceiptShape(receipt);
  const normalizedCounts = new Map();

  for (const entry of entries) {
    try {
      const normalized = normalizeRelativePath(entry.path);
      normalizedCounts.set(normalized, (normalizedCounts.get(normalized) || 0) + 1);
    } catch {
      // Invalid entries are classified below.
    }
  }

  return entries.map((entry, index) => {
    const item = {
      index,
      entry,
      originalEntry: v2Shape ? receipt.files[index] : receipt.manifest[index],
      path: entry.path,
      absolutePath: null,
      state: 'unsafe',
      reason: null,
      removable: false,
      removed: false
    };

    try {
      item.path = normalizeRelativePath(entry.path);
      if (item.path === VERSION_FILE || item.path.startsWith('.wtfp-backup-')) {
        item.reason = 'receipt control paths cannot own themselves or backup bundles';
        return item;
      }
      if (normalizedCounts.get(item.path) !== 1) {
        item.reason = 'duplicate receipt path';
        return item;
      }
      item.absolutePath = resolveOwnedPath(targetDir, item.path, targetGuard);
      const snapshot = readOwnedRegularSnapshot(targetDir, item.absolutePath, targetGuard, { allowMissing: true });
      if (!snapshot) {
        item.state = 'missing';
        item.reason = 'already absent';
        return item;
      }

      if (!trustedReceipt || !entry.trusted) {
        item.state = 'untrusted';
        item.reason = 'legacy receipts recorded skipped files and cannot prove ownership';
        item.removable = force;
        return item;
      }
      if (typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(entry.sha256)) {
        item.reason = 'missing or malformed SHA-256 ownership hash';
        return item;
      }

      if (snapshot.sha256 === entry.sha256.toLowerCase()) {
        item.state = 'unchanged';
        item.removable = true;
      } else {
        item.state = 'modified';
        item.reason = 'content differs from the installed hash';
        item.removable = force;
      }
    } catch (error) {
      item.state = 'unsafe';
      item.reason = error.message;
    }

    return item;
  });
}

function createUninstallPlan(targetDir, receiptResult, options = {}) {
  const targetGuard = options.targetGuard || createTargetGuard(targetDir);
  assertTargetGuard(targetGuard);
  const safeTarget = targetGuard.path;
  if (receiptResult.corrupt) {
    return {
      targetDir: safeTarget,
      targetGuard,
      receipt: null,
      receiptSha256: receiptResult.receiptSha256 || null,
      trusted: false,
      force: Boolean(options.hasForce),
      corrupt: true,
      error: receiptResult.error,
      items: []
    };
  }

  const receipt = receiptResult.receipt;
  return {
    targetDir: safeTarget,
    targetGuard,
    receipt,
    receiptSha256: receiptResult.receiptSha256 || null,
    trusted: isTrustedReceipt(receipt, safeTarget, targetGuard),
    v2Shape: isV2ReceiptShape(receipt),
    force: Boolean(options.hasForce),
    corrupt: false,
    error: null,
    items: receipt ? classifyReceiptEntries(safeTarget, receipt, options.hasForce, targetGuard) : []
  };
}

function summarizePlan(plan) {
  const summary = {
    unchanged: 0,
    modified: 0,
    untrusted: 0,
    missing: 0,
    unsafe: 0,
    removable: 0
  };
  for (const item of plan.items) {
    summary[item.state] = (summary[item.state] || 0) + 1;
    if (item.removable) summary.removable++;
  }
  return summary;
}

function uniqueBackupDirectory(targetDir, targetGuard) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const nonce = crypto.randomBytes(4).toString('hex');
  return resolveOwnedPath(targetDir, `.wtfp-backup-${stamp}-${nonce}`, targetGuard);
}

function statIdentity(stat) {
  return `${String(stat.dev)}:${String(stat.ino)}`;
}

function assertReceiptUnchanged(plan) {
  if (!plan.receipt || !plan.receiptSha256) {
    throw new Error('Cannot mutate files without a hash-pinned ownership receipt');
  }
  assertTargetGuard(plan.targetGuard);
  const receiptPath = resolveOwnedPath(plan.targetDir, VERSION_FILE, plan.targetGuard);
  const snapshot = readOwnedRegularSnapshot(plan.targetDir, receiptPath, plan.targetGuard, { allowMissing: true });
  if (!snapshot || snapshot.sha256 !== plan.receiptSha256) {
    throw new Error('The ownership receipt changed after uninstall planning; no further files were removed');
  }
  assertTargetGuard(plan.targetGuard);
  return receiptPath;
}

function readRegularSnapshot(plan, item) {
  assertReceiptUnchanged(plan);
  const absolutePath = resolveOwnedPath(plan.targetDir, item.path, plan.targetGuard);
  try {
    const snapshot = readOwnedRegularSnapshot(
      plan.targetDir,
      absolutePath,
      plan.targetGuard,
      { allowMissing: true }
    );
    if (!snapshot) return null;
    assertTargetGuard(plan.targetGuard);
    return {
      absolutePath,
      bytes: snapshot.bytes,
      hash: snapshot.sha256,
      identity: snapshot.identityKey,
      mode: snapshot.mode
    };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function revalidateRemovalItem(plan, item) {
  let snapshot;
  try {
    snapshot = readRegularSnapshot(plan, item);
  } catch (error) {
    item.state = 'unsafe';
    item.removable = false;
    item.reason = error.message;
    return null;
  }

  if (!snapshot) {
    item.state = 'missing';
    item.removable = false;
    item.reason = 'already absent';
    return null;
  }

  item.absolutePath = snapshot.absolutePath;
  if (!plan.trusted || !item.entry.trusted) {
    item.state = 'untrusted';
    item.reason = 'receipt cannot prove ownership for this target';
    item.removable = plan.force;
    return item.removable ? snapshot : null;
  }

  const expectedHash = typeof item.entry.sha256 === 'string' ? item.entry.sha256.toLowerCase() : null;
  if (!expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) {
    item.state = 'unsafe';
    item.removable = false;
    item.reason = 'missing or malformed SHA-256 ownership hash';
    return null;
  }

  if (snapshot.hash !== expectedHash) {
    item.state = 'modified';
    item.reason = 'content changed after uninstall planning';
    item.removable = plan.force;
    return item.removable ? snapshot : null;
  }

  item.state = 'unchanged';
  item.reason = null;
  item.removable = true;
  return snapshot;
}

function ensureGuardedDirectory(targetGuard, directory, createdDirectories) {
  assertTargetGuard(targetGuard);
  const relative = path.relative(targetGuard.path, path.resolve(directory));
  if (relative === '' || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    if (relative === '') return;
    throw new Error(`Backup directory escapes its owned root: ${directory}`);
  }

  let current = targetGuard.path;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      createdDirectories.push(createOwnedDirectory(targetGuard, current));
      stat = fs.lstatSync(current);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Backup parent is not a real directory: ${current}`);
    }
    assertTargetGuard(targetGuard);
  }
}

function createBackupBundle(plan) {
  const candidates = plan.items.filter(item => item.removable);
  if (candidates.length === 0) return null;

  assertReceiptUnchanged(plan);
  const backupDir = uniqueBackupDirectory(plan.targetDir, plan.targetGuard);
  const backupGuard = createTargetGuard(backupDir);
  const createdDirectories = materializeTargetGuard(backupGuard);
  const createdFiles = [];
  const manifest = {
    schemaVersion: 1,
    product: PRODUCT,
    createdAt: new Date().toISOString(),
    files: []
  };

  try {
    for (const item of candidates) {
      const snapshot = revalidateRemovalItem(plan, item);
      if (!snapshot) continue;
      const destination = resolveOwnedPath(backupDir, item.path, backupGuard);
      ensureGuardedDirectory(backupGuard, path.dirname(destination), createdDirectories);
      atomicWriteFile(destination, snapshot.bytes, {
        mode: snapshot.mode,
        mustNotExist: true,
        targetGuard: backupGuard
      });
      createdFiles.push({ path: destination, sha256: snapshot.hash });
      manifest.files.push({ path: item.path, sha256: snapshot.hash });
    }
    if (manifest.files.length === 0) {
      const cleanupFailures = removeCreatedDirectories(createdDirectories, backupGuard);
      if (cleanupFailures.length > 0) throw new Error('Could not remove an empty backup directory safely');
      return null;
    }
    const marker = resolveOwnedPath(backupDir, '.wtfp-backup.json', backupGuard);
    const markerBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
    atomicWriteFile(marker, markerBytes, { mode: 0o644, mustNotExist: true, targetGuard: backupGuard });
    createdFiles.push({ path: marker, sha256: sha256Buffer(markerBytes) });
    return backupDir;
  } catch (error) {
    for (const created of createdFiles.reverse()) {
      try {
        assertTargetGuard(backupGuard);
        if (sha256File(created.path) === created.sha256) fs.unlinkSync(created.path);
      } catch {
        // The original backup error remains primary.
      }
    }
    const cleanupFailures = removeCreatedDirectories(createdDirectories, backupGuard);
    if (cleanupFailures.length > 0) {
      error.message += `; cleanup also preserved ${cleanupFailures.length} changed or nonempty backup director${cleanupFailures.length === 1 ? 'y' : 'ies'}`;
      error.cleanupFailures = cleanupFailures;
    }
    throw error;
  }
}

function classifyRecordedBackups(plan) {
  const { targetDir, receipt, targetGuard, force } = plan;
  if (!isTrustedReceipt(receipt, targetDir, targetGuard) || !Array.isArray(receipt.backups)) return [];
  return receipt.backups.map(backup => {
    const result = { backup, path: backup.path, absolutePath: null, state: 'unsafe', removable: false };
    try {
      result.path = normalizeRelativePath(backup.path);
      result.absolutePath = resolveOwnedPath(targetDir, result.path, targetGuard);
      const snapshot = readOwnedRegularSnapshot(targetDir, result.absolutePath, targetGuard, { allowMissing: true });
      if (!snapshot) {
        result.state = 'missing';
      } else if (backup.sha256 && snapshot.sha256 === backup.sha256) {
        result.state = 'unchanged';
        result.removable = true;
      } else {
        result.state = 'modified';
        result.removable = force;
      }
    } catch {
      result.state = 'unsafe';
    }
    return result;
  });
}

function applyRecordedBackupCleanup(plan, backupItems, dryRun) {
  if (dryRun) return;
  for (const item of backupItems) {
    if (!item.removable || item.state === 'missing') continue;
    try {
      const snapshot = readRegularSnapshot(plan, item);
      if (!snapshot) {
        item.state = 'missing';
        item.removable = false;
        continue;
      }
      const expectedHash = typeof item.backup.sha256 === 'string' ? item.backup.sha256.toLowerCase() : null;
      if (!expectedHash || snapshot.hash !== expectedHash) {
        item.state = 'modified';
        item.removable = plan.force;
        if (!item.removable) continue;
      }
      assertReceiptUnchanged(plan);
      resolveOwnedPath(plan.targetDir, item.path, plan.targetGuard);
      const pathStat = fs.lstatSync(item.absolutePath);
      if (pathStat.isSymbolicLink() || !pathStat.isFile() || statIdentity(pathStat) !== snapshot.identity) {
        throw new Error('recorded backup path changed immediately before removal');
      }
      assertTargetGuard(plan.targetGuard);
      fs.unlinkSync(item.absolutePath);
      item.removed = true;
      removeEmptyParents(plan.targetDir, path.dirname(item.absolutePath), plan.targetGuard);
    } catch (error) {
      item.state = 'unsafe';
      item.error = error.message;
    }
  }
}

function applyUninstallPlan(plan) {
  for (const item of plan.items) {
    if (!item.removable || item.state === 'missing') continue;
    try {
      const snapshot = revalidateRemovalItem(plan, item);
      if (!snapshot) continue;
      assertReceiptUnchanged(plan);
      resolveOwnedPath(plan.targetDir, item.path, plan.targetGuard);
      const stat = fs.lstatSync(item.absolutePath);
      if (stat.isSymbolicLink() || !stat.isFile() || statIdentity(stat) !== snapshot.identity) {
        throw new Error('path changed immediately before removal');
      }
      assertTargetGuard(plan.targetGuard);
      fs.unlinkSync(item.absolutePath);
      assertTargetGuard(plan.targetGuard);
      item.removed = true;
      removeEmptyParents(plan.targetDir, path.dirname(item.absolutePath), plan.targetGuard);
    } catch (error) {
      item.state = 'unsafe';
      item.removable = false;
      item.reason = error.message;
    }
  }
}

function updateReceiptAfterUninstall(plan, backupItems = null) {
  if (!plan.receipt) return;

  const remainingItems = plan.items.filter(item => !item.removed && item.state !== 'missing');
  const remainingBackups = Array.isArray(backupItems)
    ? backupItems
      .filter(item => !item.removed && item.state !== 'missing')
      .map(item => item.backup)
    : (Array.isArray(plan.receipt.backups) ? plan.receipt.backups : []);
  if (!plan.trusted && !plan.force) return;
  const receiptPath = assertReceiptUnchanged(plan);

  if (remainingItems.length === 0 && remainingBackups.length === 0) {
    if (fs.existsSync(receiptPath)) {
      const snapshot = readOwnedRegularSnapshot(plan.targetDir, receiptPath, plan.targetGuard, { allowMissing: true });
      const stat = snapshot ? fs.lstatSync(receiptPath) : null;
      if (snapshot && snapshot.sha256 === plan.receiptSha256 &&
          stat && !stat.isSymbolicLink() && stat.isFile() && statIdentity(stat) === snapshot.identityKey) {
        assertTargetGuard(plan.targetGuard);
        fs.unlinkSync(receiptPath);
        assertTargetGuard(plan.targetGuard);
      }
    }
    return;
  }

  if (plan.trusted) {
    writeReceipt(plan.targetDir, {
      ...plan.receipt,
      status: 'partial-uninstall',
      updatedAt: new Date().toISOString(),
      files: remainingItems.map(item => item.originalEntry),
      backups: remainingBackups
    }, plan.targetGuard);
  } else if (plan.v2Shape) {
    const untrustedV2Receipt = {
      ...plan.receipt,
      status: 'partial-uninstall',
      updatedAt: new Date().toISOString(),
      files: remainingItems.map(item => item.originalEntry),
      backups: remainingBackups
    };
    atomicWriteFile(receiptPath, JSON.stringify(untrustedV2Receipt, null, 2) + '\n', {
      mode: 0o644,
      targetGuard: plan.targetGuard
    });
  } else if (Array.isArray(plan.receipt.manifest)) {
    const legacyReceipt = {
      ...plan.receipt,
      status: 'partial-uninstall',
      updatedAt: new Date().toISOString(),
      manifest: remainingItems.map(item => item.originalEntry)
    };
    atomicWriteFile(receiptPath, JSON.stringify(legacyReceipt, null, 2) + '\n', {
      mode: 0o644,
      targetGuard: plan.targetGuard
    });
  }
}

function printPlan(plan, out, options) {
  const c = out.colors;
  const summary = summarizePlan(plan);
  out.log(`  ${c.yellow('Receipt ownership plan:')}`);
  out.log(`    ${c.green(String(summary.unchanged).padStart(3))} unchanged owned file(s)`);
  out.log(`    ${c.yellow(String(summary.modified).padStart(3))} modified file(s) ${options.hasForce ? '(forced removal)' : '(preserved)'}`);
  out.log(`    ${c.yellow(String(summary.untrusted).padStart(3))} legacy/untrusted file(s) ${options.hasForce ? '(forced removal)' : '(preserved)'}`);
  out.log(`    ${c.dim(String(summary.missing).padStart(3))} already missing file(s)`);
  out.log(`    ${c.red(String(summary.unsafe).padStart(3))} unsafe or malformed path(s) (always preserved)`);
  out.log('');

  for (const item of plan.items.filter(candidate => candidate.state !== 'unchanged').slice(0, 20)) {
    const reason = item.reason ? ` — ${item.reason}` : '';
    out.log(`    ${c.dim(`[${item.state}]`)} ${String(item.path)}${c.dim(reason)}`);
  }
  if (plan.items.filter(candidate => candidate.state !== 'unchanged').length > 20) {
    out.log(`    ${c.dim('... additional exceptional paths omitted')}`);
  }
  if (plan.items.some(candidate => candidate.state !== 'unchanged')) out.log('');

  return summary;
}

async function uninstall(runtime, options, out) {
  const isLocal = runtime === 'claude-local';
  const vendorKey = isLocal ? 'claude' : runtime;
  const vendorConfig = MANIFEST[vendorKey];
  if (!vendorConfig) throw new Error(`Unknown runtime: ${runtime}`);

  const unresolvedTarget = getVendorDir(runtime, options.explicitConfigDir);
  const targetGuard = options.targetGuard || createTargetGuard(unresolvedTarget);
  assertTargetGuard(targetGuard);
  const targetDir = targetGuard.path;
  const locationLabel = getPathLabel(targetDir, !isLocal);
  const c = out.colors;

  out.log(`  Checking ${c.cyan(locationLabel)} for a WTF-P ownership receipt...\n`);
  const receiptResult = readReceipt(targetDir, targetGuard);
  const plan = createUninstallPlan(targetDir, receiptResult, { ...options, targetGuard });

  if (plan.corrupt) {
    out.warn(`The ${VERSION_FILE} receipt is corrupt; no files were removed (${plan.error})`);
    return { status: 'corrupt', plan };
  }

  if (!plan.receipt) {
    const detected = detectInstallation(targetDir);
    if (detected.hasAny) {
      out.warn('WTF-P-shaped files exist, but no ownership receipt can prove who created them.');
      out.log(`  Reinstall explicitly with ${c.cyan('--force --backup-all')} to establish a v2 receipt, then uninstall.\n`);
    } else {
      out.log(`  ${c.yellow('No WTF-P installation receipt found.')}\n`);
    }
    return { status: 'not-installed', plan };
  }

  const summary = printPlan(plan, out, options);
  const backupItems = options.hasCleanBackups && plan.trusted
    ? classifyRecordedBackups(plan)
    : null;

  if (backupItems && backupItems.length > 0) {
    const removableBackups = backupItems.filter(item => item.removable).length;
    const preservedBackups = backupItems.filter(item => !item.removable && item.state !== 'missing').length;
    out.log(`  Recorded backups: ${removableBackups} removable, ${preservedBackups} preserved.\n`);
  }
  const removableBackupCount = backupItems ? backupItems.filter(item => item.removable).length : 0;
  const totalRemovable = summary.removable + removableBackupCount;

  if (options.hasDryRun) {
    out.log(`  ${c.yellow(`Dry run: would remove ${totalRemovable} exact file(s).`)}\n`);
    return { status: 'dry-run', plan, summary };
  }

  if (summary.removable === 0 && (!backupItems || backupItems.every(item => !item.removable))) {
    // Missing entries can be dropped safely so repeated uninstall converges.
    const hasTrackedBackups = Array.isArray(plan.receipt.backups) && plan.receipt.backups.length > 0;
    const needsReceiptUpdate = (!hasTrackedBackups && plan.items.length === 0) ||
      plan.items.some(item => item.state === 'missing') ||
      Boolean(backupItems && backupItems.some(item => item.state === 'missing'));
    if (needsReceiptUpdate) updateReceiptAfterUninstall(plan, backupItems);
    out.log(`  ${c.yellow('No receipt-authorized files can be removed.')}\n`);
    return { status: 'preserved', plan, summary };
  }

  if (!options.hasForce && !options.hasYes) {
    if (!options.isInteractive) {
      throw new Error('Noninteractive uninstall requires --yes for unchanged owned files, or --force for modified/untrusted receipt files. Use --dry-run to inspect safely.');
    }
    const rl = createRL();
    const answer = await prompt(rl, `  Remove ${totalRemovable} exact owned file(s)? [y/N]: `);
    rl.close();
    if (answer !== 'y' && answer !== 'yes') {
      out.log(`\n  ${c.yellow('Aborted.')} No files changed.\n`);
      return { status: 'aborted', plan, summary };
    }
    out.log('');
  }

  if (options.hasBackup) {
    const backupDir = createBackupBundle(plan);
    if (backupDir) out.log(`  ${c.cyan('↻')} Backed up exact candidates to ${c.dim(getPathLabel(backupDir, !isLocal))}\n`);
  }

  applyUninstallPlan(plan);
  applyRecordedBackupCleanup(plan, backupItems || [], false);
  updateReceiptAfterUninstall(plan, backupItems);

  for (const item of plan.items.filter(candidate => candidate.removed)) {
    out.log(`  ${c.red('-')} ${c.dim(item.path)}`);
  }

  const remaining = plan.items.filter(item => !item.removed && item.state !== 'missing');
  if (remaining.length > 0) {
    out.log(`\n  ${c.yellow('Partial uninstall:')} preserved ${remaining.length} modified, untrusted, or unsafe file(s).`);
    out.log(`  Re-run with ${c.cyan('--force')} only if you intend to remove exact modified/legacy receipt files.\n`);
    return { status: 'partial', plan, summary };
  }

  out.log(`\n  ${c.green('Done!')} Removed WTF-P-owned files from ${vendorConfig.name}.`);
  out.log(`  ${c.dim('Unowned files and nonempty shared directories were not touched.')}\n`);
  return { status: 'removed', plan, summary };
}

async function promptLocation(options, out) {
  const installations = [];
  for (const runtime of Object.keys(MANIFEST)) {
    const targetGuard = createTargetGuard(getVendorDir(runtime, null));
    const targetDir = targetGuard.path;
    const receipt = readReceipt(targetDir, targetGuard);
    if (receipt.receipt || receipt.corrupt) installations.push({ runtime, targetDir });
  }

  const localGuard = createTargetGuard(getVendorDir('claude-local', null));
  const localTarget = localGuard.path;
  const localReceipt = readReceipt(localTarget, localGuard);
  if (localReceipt.receipt || localReceipt.corrupt) installations.push({ runtime: 'claude-local', targetDir: localTarget });

  if (installations.length === 0) {
    out.log('  No WTF-P ownership receipts found.\n');
    return;
  }

  const c = out.colors;
  out.log(`  ${c.yellow('Where would you like to uninstall from?')}\n`);
  installations.forEach((installation, index) => {
    const vendorKey = installation.runtime === 'claude-local' ? 'claude' : installation.runtime;
    const label = installation.runtime === 'claude-local'
      ? getPathLabel(installation.targetDir, false)
      : getPathLabel(installation.targetDir, true);
    out.log(`  ${c.cyan(`${index + 1})`)} ${MANIFEST[vendorKey].name} ${c.dim(`(${label})`)}`);
  });
  out.log('');

  const rl = createRL();
  const answer = await prompt(rl, '  Choice: ');
  rl.close();
  const selected = installations[Number.parseInt(answer, 10) - 1];
  if (!selected) {
    out.log(`\n  ${c.yellow('Invalid choice.')}\n`);
    return;
  }
  await uninstall(selected.runtime, options, out);
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const isInteractive = Boolean(process.stdout.isTTY && process.stdin.isTTY && !options.hasQuiet);
  options.isInteractive = isInteractive;
  const useColors = !options.hasNoColor && (process.stdout.isTTY || process.env.FORCE_COLOR);
  const out = createOutput({ quiet: options.hasQuiet, useColors });

  if (options.hasHelp) {
    showHelp(out);
    return;
  }
  if (!options.hasQuiet) console.log(createBanner(out));

  if (options.hasAll) {
    const targets = Object.keys(MANIFEST).map(runtime => ({
      runtime,
      guard: createTargetGuard(getVendorDir(runtime, null))
    }));
    for (let left = 0; left < targets.length; left++) {
      for (let right = left + 1; right < targets.length; right++) {
        const leftPath = targets[left].guard.path;
        const rightPath = targets[right].guard.path;
        if (isSameOrAncestor(leftPath, rightPath) || isSameOrAncestor(rightPath, leftPath)) {
          throw new Error(`--all targets overlap (${leftPath} and ${rightPath}); configure distinct client roots before uninstalling`);
        }
      }
    }
    for (const target of targets) {
      await uninstall(target.runtime, { ...options, targetGuard: target.guard }, out);
    }
    return;
  }
  if (options.hasLocal) return uninstall('claude-local', options, out);
  if (options.hasGemini) return uninstall('gemini', options, out);
  if (options.hasOpenCode) return uninstall('opencode', options, out);
  if (options.hasClaude || options.hasGlobal) return uninstall('claude', options, out);

  if (!isInteractive) {
    throw new Error('Noninteractive uninstall requires an explicit target or scope. Use --local, --global, --claude, --gemini, --opencode, or --all.');
  }
  return promptLocation(options, out);
}

if (require.main === module) {
  main().catch(error => {
    const options = (() => {
      try { return parseArgs(process.argv.slice(2)); } catch { return {}; }
    })();
    const out = createOutput({ quiet: options.hasQuiet, useColors: !options.hasNoColor });
    out.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  applyUninstallPlan,
  classifyReceiptEntries,
  createBackupBundle,
  createUninstallPlan,
  getVendorDir,
  main,
  parseArgs,
  summarizePlan,
  uninstall,
  updateReceiptAfterUninstall
};
