const fs = require('fs');
const path = require('path');
const os = require('os');
const MANIFEST = require('../lib/manifest');
const { activateNativeRegistration } = require('../lib/native-registration');
const {
  expandTilde,
  getPathLabel,
  getBackupPath,
  writeVersionFile,
  detectInstallation,
  createRL,
  prompt
} = require('../lib/utils');
const {
  assertGuardMatchesTarget,
  assertTargetGuard,
  assertOwnedAbsolutePath,
  atomicWriteFile,
  createOwnedDirectory,
  createTargetGuard,
  materializeTargetGuard,
  readOwnedRegularSnapshot,
  removeCreatedDirectories,
  sha256Buffer
} = require('../lib/ownership');

/**
 * Get vendor-specific config directory
 */
function getVendorDir(runtime, explicitConfigDir) {
  // Handle 'claude-local' special case
  if (runtime === 'claude-local') {
    return path.join(process.cwd(), '.claude');
  }

  const vendorConfig = MANIFEST[runtime];
  if (!vendorConfig) {
    throw new Error(`Unknown runtime: ${runtime}`);
  }

  if (explicitConfigDir) {
    return expandTilde(explicitConfigDir);
  }

  const envDir = process.env[vendorConfig.configDirEnv];
  if (typeof envDir === 'string' && envDir.trim().length > 0) {
    const resolvedEnvironmentRoot = expandTilde(envDir);
    return vendorConfig.envSubdir
      ? path.join(resolvedEnvironmentRoot, vendorConfig.envSubdir)
      : resolvedEnvironmentRoot;
  }

  return path.join(os.homedir(), vendorConfig.defaultDir);
}

/**
 * Process file content with path replacement
 */
function processContent(srcPath, pathPrefix, sourceBytes = null) {
  const textExtensions = new Set(['.md', '.json', '.toml', '.yaml', '.yml', '.js', '.mjs', '.cjs', '.txt']);
  if (textExtensions.has(path.extname(srcPath).toLowerCase())) {
    const content = sourceBytes === null
      ? fs.readFileSync(srcPath, 'utf8')
      : Buffer.from(sourceBytes).toString('utf8');
    return content.replace(/~\/\.claude\//g, pathPrefix);
  }
  return null;
}

function identityOf(stat) {
  return `${String(stat.dev)}:${String(stat.ino)}`;
}

function pathIsWithin(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function readSourceSnapshot(file) {
  const rootStat = fs.lstatSync(file.sourceRootPath);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory() || identityOf(rootStat) !== file.sourceRootIdentity) {
    throw new Error(`Package component root changed during installation planning: ${file.sourceRootPath}`);
  }
  const currentRoot = fs.realpathSync(file.sourceRootPath);
  if (currentRoot !== file.sourceRoot) {
    throw new Error(`Package component root was redirected during installation planning: ${file.sourceRootPath}`);
  }

  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  const descriptor = fs.openSync(file.src, flags);
  try {
    const before = fs.fstatSync(descriptor);
    if (!before.isFile()) throw new Error(`Package source is not a regular file: ${file.src}`);
    const canonicalSource = fs.realpathSync(file.src);
    if (!pathIsWithin(file.sourceRoot, canonicalSource) || canonicalSource === file.sourceRoot) {
      throw new Error(`Package source escaped its component root: ${file.src}`);
    }
    const bytes = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor);
    if (identityOf(before) !== identityOf(after) || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
      throw new Error(`Package source changed while it was being read: ${file.src}`);
    }
    const pathStat = fs.lstatSync(file.src);
    if (pathStat.isSymbolicLink() || !pathStat.isFile() || identityOf(pathStat) !== identityOf(before)) {
      throw new Error(`Package source path changed while it was being read: ${file.src}`);
    }
    return { bytes, mode: before.mode & 0o777 };
  } finally {
    fs.closeSync(descriptor);
  }
}

/**
 * Collect files from a manifest component
 */
function collectComponentFiles(component, destBase, files = []) {
  let componentStat;
  try {
    componentStat = fs.lstatSync(component.src);
  } catch (error) {
    if (error.code === 'ENOENT') return files;
    throw error;
  }
  if (componentStat.isSymbolicLink()) {
    throw new Error(`Refusing symbolic-link package component root: ${component.src}`);
  }
  if (!componentStat.isDirectory()) {
    throw new Error(`Package component root is not a directory: ${component.src}`);
  }
  const sourceRoot = fs.realpathSync(component.src);
  const sourceRootIdentity = identityOf(componentStat);

  function recurse(currentSrc, currentRel) {
    const currentStat = fs.lstatSync(currentSrc);
    const currentRealPath = fs.realpathSync(currentSrc);
    if (currentStat.isSymbolicLink() || !currentStat.isDirectory() || !pathIsWithin(sourceRoot, currentRealPath)) {
      throw new Error(`Refusing redirected package directory: ${currentSrc}`);
    }
    const entries = fs.readdirSync(currentSrc, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    
    for (const entry of entries) {
      const srcPath = path.join(currentSrc, entry.name);
      const relPath = path.join(currentRel, entry.name);
      const destPath = path.join(destBase, component.dest, relPath);

      const entryStat = fs.lstatSync(srcPath);
      if (entryStat.isSymbolicLink()) {
        throw new Error(`Refusing symbolic link in package component: ${srcPath}`);
      } else if (entryStat.isDirectory()) {
        recurse(srcPath, relPath);
      } else if (entryStat.isFile()) {
        const topLevel = relPath.split(path.sep)[0];
        files.push({ 
          src: srcPath, 
          dest: destPath, 
          name: entry.name,
          componentId: component.componentIds?.[topLevel] || component.id,
          sourceRoot,
          sourceRootPath: component.src,
          sourceRootIdentity
        });
      } else {
        throw new Error(`Refusing unsupported package entry: ${srcPath}`);
      }
    }
  }

  recurse(component.src, '.');
  return files;
}

/**
 * Expand a generated bundle into the exact legacy --only projection requested
 * by the caller. A complete install consumes the bundle root once; selective
 * installs traverse only declared top-level roots and remain partial.
 */
function componentsForSelection(vendorConfig, onlyInstall) {
  if (onlyInstall === 'all') return vendorConfig.components;
  const selected = [];

  for (const component of vendorConfig.components) {
    if (component.id === onlyInstall ||
        (onlyInstall === 'commands' && component.id === 'skills')) {
      selected.push(component);
      continue;
    }

    const roots = component.selectionRoots?.[onlyInstall];
    if (!Array.isArray(roots)) continue;
    for (const root of roots) {
      selected.push({
        ...component,
        id: component.componentIds?.[root] || onlyInstall,
        src: path.join(component.src, root),
        dest: path.join(component.dest, root),
        selectionRoots: undefined,
        componentIds: undefined
      });
    }
  }

  return selected;
}

/**
 * Install files with conflict resolution
 */
async function installWithConflictResolution(files, pathPrefix, targetDir, options) {
  const { out, hasForce, hasBackupAll, isInteractive, showExplanations } = options;
  const c = out.colors;
  let rl = null;
  let globalChoice = null;
  const stats = { installed: 0, skipped: 0, backed: 0 };
  const plan = [];
  const targetGuard = options.targetGuard || createTargetGuard(targetDir);

  assertTargetGuard(targetGuard);
  for (const file of files) {
    assertOwnedAbsolutePath(targetDir, file.dest, targetGuard);
  }

  const existingFiles = files.filter(file => Boolean(
    readOwnedRegularSnapshot(targetDir, file.dest, targetGuard, { allowMissing: true })
  ));

  if (existingFiles.length > 0 && !hasForce && !hasBackupAll && isInteractive) {
    const relPath = getPathLabel(targetDir, true);
    out.log(`  ${c.yellow(`Found ${existingFiles.length} existing file(s) in ${relPath}`)}
`);

    if (showExplanations) {
      out.log(`  ${c.dim('For each file, choose:')}`);
      out.log(`  ${c.dim('[o]verwrite  Replace with new version')}`);
      out.log(`  ${c.dim('[s]kip       Keep your existing file')}`);
      out.log(`  ${c.dim('[b]ackup     Save existing, then install new')}`);
      out.log(`  ${c.dim('[a]ll        Apply same choice to all remaining')}\n`);
    }
  }

  try {
    for (const file of files) {
      const existingSnapshot = readOwnedRegularSnapshot(
        targetDir,
        file.dest,
        targetGuard,
        { allowMissing: true }
      );
      const exists = Boolean(existingSnapshot);
      const relDest = file.dest.replace(os.homedir(), '~').replace(process.cwd(), '.');

      // A shared plugin manifest may belong to another package. Make this
      // decision before creating a backup or mutating any path.
      if (file.name === 'plugin.json' && file.componentId === 'plugin' && exists) {
        try {
          const existing = JSON.parse(existingSnapshot.bytes.toString('utf8'));
          if (existing.name && existing.name !== 'wtf-p' && existing.name !== 'write-the-f-paper') {
            out.verbose(`  ${c.yellow('!')} ${c.dim(relDest)} belongs to another plugin — skipped`);
            stats.skipped++;
            continue;
          }
        } catch {
          // Invalid JSON cannot establish third-party ownership. Normal
          // conflict handling still defaults to preserving it.
        }
      }

      let choice = exists ? 'skip' : 'create';
      if (exists && hasBackupAll) {
        choice = 'backup';
      } else if (exists && hasForce) {
        choice = 'overwrite';
      } else if (exists && globalChoice) {
        choice = globalChoice;
      } else if (exists && isInteractive) {
        if (!rl) rl = createRL();
        const answer = await prompt(rl,
          `  ${c.yellow('?')} ${c.dim(relDest)} exists. [o]verwrite/[s]kip/[b]ackup/[a]ll: `
        );

        if (answer.startsWith('a')) {
          const allAnswer = await prompt(rl, '    Apply to all: [o]verwrite/[s]kip/[b]ackup: ');
          if (allAnswer.startsWith('o')) globalChoice = 'overwrite';
          else if (allAnswer.startsWith('b')) globalChoice = 'backup';
          else globalChoice = 'skip';
          choice = globalChoice;
        } else if (answer.startsWith('o')) {
          choice = 'overwrite';
        } else if (answer.startsWith('b')) {
          choice = 'backup';
        }
      }

      if (choice === 'skip') {
        out.verbose(`  ${c.dim('○')} Skipped ${c.dim(relDest)}`);
        stats.skipped++;
        continue;
      }

      const source = readSourceSnapshot(file);
      const processed = processContent(file.src, pathPrefix, source.bytes);
      const content = processed === null ? source.bytes : Buffer.from(processed, 'utf8');
      plan.push({
        ...file,
        exists,
        choice,
        content,
        sourceMode: source.mode,
        relDest,
        existingHash: existingSnapshot ? existingSnapshot.sha256 : null,
        existingIdentity: existingSnapshot ? existingSnapshot.identityKey : null
      });
    }
  } finally {
    if (rl) rl.close();
  }

  const applied = [];
  const createdDirectories = [];
  let rolledBack = false;
  let rollbackFailures = [];

  function uniqueBackupPath(destination) {
    const initial = getBackupPath(destination);
    if (!fs.existsSync(initial)) return initial;
    let index = 2;
    let candidate = `${initial}.${index}`;
    while (fs.existsSync(candidate)) {
      index++;
      candidate = `${initial}.${index}`;
    }
    return candidate;
  }

  function ensureOwnedDirectory(directory) {
    assertTargetGuard(targetGuard);
    let current = path.resolve(directory);
    const resolvedTarget = path.resolve(targetDir);
    const missing = [];
    while (current === resolvedTarget || current.startsWith(resolvedTarget + path.sep)) {
      try {
        const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink() || !stat.isDirectory()) {
          throw new Error(`Destination parent is not a real directory: ${current}`);
        }
        break;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        missing.push(current);
      }
      if (current === resolvedTarget) break;
      current = path.dirname(current);
    }

    for (const missingDirectory of missing.reverse()) {
      createdDirectories.push(createOwnedDirectory(targetGuard, missingDirectory));
    }
    assertTargetGuard(targetGuard);
  }

  function rollback() {
    if (rolledBack) return rollbackFailures;
    rolledBack = true;
    rollbackFailures = [];

    for (const record of [...applied].reverse()) {
      try {
        assertOwnedAbsolutePath(targetDir, record.dest, targetGuard);
        if (record.writeApplied) {
          const currentSnapshot = readOwnedRegularSnapshot(
            targetDir,
            record.dest,
            targetGuard,
            { allowMissing: true }
          );
          if (!currentSnapshot || currentSnapshot.sha256 !== record.installedHash ||
              (record.installedIdentity && currentSnapshot.identityKey !== record.installedIdentity)) {
            throw new Error('destination changed after publication; concurrent content was preserved');
          }
          assertTargetGuard(targetGuard);
          if (record.existed) {
            atomicWriteFile(record.dest, record.previousContent, {
              mode: record.previousMode,
              targetGuard
            });
          } else {
            fs.unlinkSync(record.dest);
            assertTargetGuard(targetGuard);
          }
        }
      } catch (error) {
        rollbackFailures.push({ path: record.dest, message: error.message });
      }

      try {
        if (record.backupPath && fs.existsSync(record.backupPath)) {
          assertOwnedAbsolutePath(targetDir, record.backupPath, targetGuard);
          const backupSnapshot = readOwnedRegularSnapshot(
            targetDir,
            record.backupPath,
            targetGuard,
            { allowMissing: true }
          );
          if (!backupSnapshot || backupSnapshot.sha256 !== record.backupHash ||
              (record.backupIdentity && backupSnapshot.identityKey !== record.backupIdentity)) {
            throw new Error('transaction backup changed; it was preserved');
          }
          assertTargetGuard(targetGuard);
          fs.unlinkSync(record.backupPath);
          assertTargetGuard(targetGuard);
        }
      } catch (error) {
        rollbackFailures.push({ path: record.backupPath, message: error.message });
      }
    }

    rollbackFailures.push(...removeCreatedDirectories(createdDirectories, targetGuard));
    return rollbackFailures;
  }

  try {
    if (plan.length > 0 && !targetGuard.targetIdentity) {
      createdDirectories.push(...materializeTargetGuard(targetGuard));
    }
    for (const item of plan) {
      // Recheck immediately before mutation to catch a newly introduced
      // symlink in a previously validated destination path.
      assertTargetGuard(targetGuard);
      assertOwnedAbsolutePath(targetDir, item.dest, targetGuard);
      const currentSnapshot = readOwnedRegularSnapshot(
        targetDir,
        item.dest,
        targetGuard,
        { allowMissing: true }
      );
      if (Boolean(currentSnapshot) !== item.exists) {
        throw new Error(`Destination changed while installation was being planned: ${item.relDest}`);
      }
      const previousContent = currentSnapshot ? currentSnapshot.bytes : null;
      if (currentSnapshot && (currentSnapshot.sha256 !== item.existingHash ||
          currentSnapshot.identityKey !== item.existingIdentity)) {
        throw new Error(`Destination content changed while installation was being planned: ${item.relDest}`);
      }
      const previousMode = currentSnapshot ? currentSnapshot.mode : undefined;
      const sourceMode = item.sourceMode;
      const appliedRecord = {
        dest: item.dest,
        componentId: item.componentId,
        action: item.exists ? 'replaced' : 'created',
        backupPath: null,
        existed: item.exists,
        previousContent,
        previousMode,
        writeApplied: false,
        installedHash: sha256Buffer(item.content),
        installedIdentity: null,
        backupHash: null,
        backupIdentity: null
      };
      applied.push(appliedRecord);

      ensureOwnedDirectory(path.dirname(item.dest));
      assertOwnedAbsolutePath(targetDir, item.dest, targetGuard);

      if (item.choice === 'backup') {
        appliedRecord.backupPath = uniqueBackupPath(item.dest);
        assertOwnedAbsolutePath(targetDir, appliedRecord.backupPath, targetGuard);
        try {
          atomicWriteFile(appliedRecord.backupPath, previousContent, {
            mode: previousMode,
            mustNotExist: true,
            targetGuard
          });
        } catch (error) {
          const backupSnapshot = (() => {
            try {
              return readOwnedRegularSnapshot(
                targetDir,
                appliedRecord.backupPath,
                targetGuard,
                { allowMissing: true }
              );
            } catch {
              return null;
            }
          })();
          if (error.published || (backupSnapshot && backupSnapshot.sha256 === item.existingHash)) {
            appliedRecord.backupHash = item.existingHash;
            if (backupSnapshot) appliedRecord.backupIdentity = backupSnapshot.identityKey;
          }
          throw error;
        }
        appliedRecord.backupHash = item.existingHash;
        appliedRecord.backupIdentity = readOwnedRegularSnapshot(
          targetDir,
          appliedRecord.backupPath,
          targetGuard
        ).identityKey;
        stats.backed++;
        out.log(`  ${c.cyan('↻')} Backed up to ${c.dim(path.basename(appliedRecord.backupPath))}`);
      }

      if (item.exists) {
        const immediate = readOwnedRegularSnapshot(targetDir, item.dest, targetGuard, { allowMissing: true });
        if (!immediate || immediate.sha256 !== item.existingHash || immediate.identityKey !== item.existingIdentity) {
          throw new Error(`Destination content changed immediately before write: ${item.relDest}`);
        }
      } else {
        if (readOwnedRegularSnapshot(targetDir, item.dest, targetGuard, { allowMissing: true })) {
          throw new Error(`Destination appeared immediately before write: ${item.relDest}`);
        }
      }

      try {
        atomicWriteFile(item.dest, item.content, {
          mode: previousMode || sourceMode,
          mustNotExist: !item.exists,
          targetGuard
        });
        appliedRecord.writeApplied = true;
      } catch (error) {
        let publishedSnapshot = null;
        try {
          publishedSnapshot = readOwnedRegularSnapshot(targetDir, item.dest, targetGuard, { allowMissing: true });
        } catch {
          // The root or parent may have changed; publication state is still
          // carried by the atomic helper for conservative rollback reporting.
        }
        if (error.published || (publishedSnapshot && publishedSnapshot.sha256 === appliedRecord.installedHash)) {
          appliedRecord.writeApplied = true;
          if (publishedSnapshot) appliedRecord.installedIdentity = publishedSnapshot.identityKey;
        }
        throw error;
      }
      const installedSnapshot = readOwnedRegularSnapshot(targetDir, item.dest, targetGuard);
      if (installedSnapshot.sha256 !== appliedRecord.installedHash) {
        throw new Error(`Published destination failed verification: ${item.relDest}`);
      }
      appliedRecord.installedIdentity = installedSnapshot.identityKey;
      assertTargetGuard(targetGuard);

      out.verbose(`  ${item.exists ? c.green('✓') : c.green('+')} ${c.dim(item.relDest)}`);
      stats.installed++;
    }
  } catch (error) {
    const failures = rollback();
    if (failures.length > 0) {
      error.message += `; rollback also failed for ${failures.length} path(s)`;
      error.rollbackFailures = failures;
    }
    throw error;
  }

  return {
    ...stats,
    writtenFiles: applied.map(({
      previousContent,
      previousMode,
      existed,
      writeApplied,
      installedHash,
      installedIdentity,
      backupHash,
      backupIdentity,
      ...record
    }) => record),
    rollback,
    commit() {
      rolledBack = true;
    }
  };
}

/**
 * Main install logic
 * @param {string} runtime - A manifest target id, or the legacy 'claude-local' target
 * @param {boolean} isUpdate - Whether this is an update operation
 * @param {object} options - CLI options
 * @param {object} pkg - Package.json contents
 */
async function install(runtime, isUpdate, options, pkg) {
  const { out, explicitConfigDir, hasQuiet, onlyInstall, showExplanations } = options;
  const c = out.colors;

  // Handle 'claude-local' by mapping to 'claude' vendor config
  const vendorKey = runtime === 'claude-local' ? 'claude' : runtime;
  const vendorConfig = MANIFEST[vendorKey];

  if (!vendorConfig) {
    throw new Error(`Unknown runtime: ${runtime}`);
  }

  // Resolve and canonicalize the target before deriving any destination.
  const unresolvedTargetDir = getVendorDir(runtime, explicitConfigDir);
  const targetGuard = options.targetGuard || createTargetGuard(unresolvedTargetDir);
  assertGuardMatchesTarget(unresolvedTargetDir, targetGuard);
  const targetDir = targetGuard.path;
  const isGlobal = runtime !== 'claude-local';
  const locationLabel = getPathLabel(targetDir, isGlobal);

  const configuredByEnvironment = typeof process.env[vendorConfig.configDirEnv] === 'string' &&
    process.env[vendorConfig.configDirEnv].trim().length > 0;
  const pathPrefix = isGlobal
    ? ((explicitConfigDir || configuredByEnvironment)
      ? `${targetDir}${path.sep}`
      : `~/${vendorConfig.defaultDir}/`)
    : `./.claude/`;

  // ---- Cross-installation conflict detection ----
  // If installing locally, warn if a global install already exists (and vice versa).
  // Claude Code loads commands from BOTH ~/.claude/ and ./.claude/, causing duplicates.
  if (vendorKey === 'claude' && !explicitConfigDir) {
    const globalDir = path.join(os.homedir(), '.claude');
    const localDir = path.join(process.cwd(), '.claude');

    if (runtime === 'claude-local') {
      // Installing local — check if global exists
      const globalInstall = detectInstallation(globalDir);
      if (globalInstall.hasCommands) {
        out.log(`  ${c.yellow('⚠ WTF-P is already installed globally')} ${c.dim('(' + getPathLabel(globalDir, true) + ')')}`);
        out.log(`    Installing locally too will cause every command to appear twice.`);
        out.log('');
        out.log(`    ${c.cyan('Options:')}`);
        out.log(`      • Use your global install as-is (recommended)`);
        out.log(`      • Remove global first: ${c.dim('npx wtf-p uninstall --global')}`);
        out.log(`      • Continue anyway (commands will be duplicated)`);
        out.log('');

        if (options.isInteractive && !options.hasForce) {
          const rl = createRL();
          const answer = await prompt(rl, `  Continue with local install? [y/N]: `);
          rl.close();
          if (answer !== 'y' && answer !== 'yes') {
            out.log(`\n  ${c.yellow('Aborted.')} Using global install.\n`);
            return;
          }
          out.log('');
        } else if (!options.hasForce) {
          out.log(`  ${c.yellow('Aborted.')} Use --force to install anyway.\n`);
          return;
        }
      }
    } else if (runtime === 'claude') {
      // Installing global — check if local exists in cwd
      const localInstall = detectInstallation(localDir);
      if (localInstall.hasCommands && globalDir !== localDir) {
        out.log(`  ${c.yellow('⚠ WTF-P is also installed locally')} ${c.dim('(' + getPathLabel(localDir, false) + ')')}`);
        out.log(`    Commands may appear twice in this directory.`);
        out.log(`    To fix: ${c.dim('npx wtf-p uninstall --local')}`);
        out.log('');
      }
    }
  }

  if (!hasQuiet) {
    out.log(`  Installing to ${c.cyan(locationLabel)}
`);
  }

  // Collect files based on Manifest
  const allFiles = [];

  componentsForSelection(vendorConfig, onlyInstall).forEach(component => {
    // DEBUG LOG
    // console.log(`Collecting: ${component.id} from ${component.src}`);
    
    collectComponentFiles(component, targetDir, allFiles);
  });
  
  // DEBUG
  // console.log(`Total files found: ${allFiles.length}`);

  // Install with conflict resolution
  const stats = await installWithConflictResolution(allFiles, pathPrefix, targetDir, {
    ...options,
    targetGuard
  });

  // A no-op update must not claim a newer version. When files were written,
  // receipt creation is part of the transaction and any failure rolls them
  // back to their prior bytes.
  if (stats.writtenFiles.length > 0) {
    try {
      writeVersionFile(targetDir, pkg.version, stats.writtenFiles, {
        runtime: vendorKey,
        scope: isGlobal ? (explicitConfigDir ? 'custom' : 'user') : 'project',
        skipped: stats.skipped,
        selectionComplete: onlyInstall === 'all',
        adapterVersion: 1,
        generatorVersion: 1,
        targetGuard
      });
      stats.commit();
    } catch (error) {
      const failures = stats.rollback();
      if (failures.length > 0) {
        error.message += `; rollback also failed for ${failures.length} path(s)`;
        error.rollbackFailures = failures;
      }
      throw error;
    }
  } else {
    stats.commit();
  }

  let nativeActivation = { status: 'not-required', results: [] };
  if (onlyInstall === 'all' && vendorConfig.native) {
    try {
      nativeActivation = activateNativeRegistration(vendorKey, targetDir, vendorConfig.native);
    } catch (error) {
      error.message = `WTF-P files are safely staged in ${targetDir}, but native ${vendorConfig.name} registration failed: ${error.message}`;
      throw error;
    }
    if (nativeActivation.status === 'unavailable' && !hasQuiet) {
      out.warn(`${nativeActivation.executable} is not installed; the WTF-P bundle is staged but native registration is pending.`);
    } else if (nativeActivation.status === 'deferred' && !hasQuiet) {
      out.warn(`${nativeActivation.reason}. The WTF-P bundle is staged but native registration is pending.`);
    }
  }

  // Summary
  if (!hasQuiet) {
    if (stats.installed === 0) {
      out.log(`
  ${c.yellow('No files changed.')} ${c.dim(`[${vendorConfig.name}]`)} Skipped: ${stats.skipped}
`);
    } else {
      out.log(`
  ${c.green('Done!')} ${c.dim(`[${vendorConfig.name}]`)} Installed: ${stats.installed}, Skipped: ${stats.skipped}, Backed up: ${stats.backed}

  Run ${c.cyan('/wtfp:help')} in ${vendorConfig.name} to get started.
`);
    }

    if (stats.installed > 0 && showExplanations && !isUpdate) {
      out.log(`  ${c.yellow('Get started:')}`);
      out.log(`    ${c.cyan('/wtfp:new-paper')}      Define your paper's vision and structure`);
      out.log(`    ${c.cyan('/wtfp:progress')}       See where you are and what's next`);
      out.log(`    ${c.cyan('/wtfp:help')}           Browse all available commands\n`);
    }
  }

  return { ...stats, nativeActivation, targetDir };
}

module.exports = install;
module.exports.getVendorDir = getVendorDir;
module.exports.processContent = processContent;
module.exports.collectComponentFiles = collectComponentFiles;
module.exports.componentsForSelection = componentsForSelection;
module.exports.installWithConflictResolution = installWithConflictResolution;
