const fs = require('fs');
const path = require('path');
const os = require('os');
const MANIFEST = require('../lib/manifest');
const {
  isValidPath,
  expandTilde,
  getPathLabel,
  getBackupPath,
  writeVersionFile,
  detectInstallation,
  createRL,
  prompt
} = require('../lib/utils');

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
  if (envDir) {
    return expandTilde(envDir);
  }

  return path.join(os.homedir(), vendorConfig.defaultDir);
}

/**
 * Process file content with path replacement
 */
function processContent(srcPath, pathPrefix) {
  if (srcPath.endsWith('.md') || srcPath.endsWith('.json')) {
    let content = fs.readFileSync(srcPath, 'utf8');
    return content.replace(/~\/\.claude\//g, pathPrefix);
  }
  return null;
}

/**
 * Collect files from a manifest component
 */
function collectComponentFiles(component, destBase, files = []) {
  if (!fs.existsSync(component.src)) return files;

  function recurse(currentSrc, currentRel) {
    const entries = fs.readdirSync(currentSrc, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(currentSrc, entry.name);
      const relPath = path.join(currentRel, entry.name);
      const destPath = path.join(destBase, component.dest, relPath);

      if (entry.isDirectory()) {
        recurse(srcPath, relPath);
      } else {
        files.push({ 
          src: srcPath, 
          dest: destPath, 
          name: entry.name,
          componentId: component.id 
        });
      }
    }
  }

  recurse(component.src, '.');
  return files;
}

/**
 * Install files with conflict resolution
 */
async function installWithConflictResolution(files, pathPrefix, targetDir, options) {
  const { out, hasForce, hasBackupAll, isInteractive, showExplanations } = options;
  const c = out.colors;
  const rl = createRL();
  let globalChoice = null;
  const stats = { installed: 0, skipped: 0, backed: 0 };

  const existingFiles = files.filter(f => fs.existsSync(f.dest));

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

  for (const file of files) {
    const exists = fs.existsSync(file.dest);
    const relDest = file.dest.replace(os.homedir(), '~').replace(process.cwd(), '.');

    fs.mkdirSync(path.dirname(file.dest), { recursive: true });

    if (exists && !hasForce && !hasBackupAll) {
      let choice = globalChoice;

      if (!choice && isInteractive) {
        const answer = await prompt(rl,
          `  ${c.yellow('?')} ${c.dim(relDest)} exists. [o]verwrite/[s]kip/[b]ackup/[a]ll: `
        );

        if (answer.startsWith('a')) {
          const allAnswer = await prompt(rl,
            `    Apply to all: [o]verwrite/[s]kip/[b]ackup: `
          );
          if (allAnswer.startsWith('o')) globalChoice = 'overwrite';
          else if (allAnswer.startsWith('b')) globalChoice = 'backup';
          else globalChoice = 'skip';
          choice = globalChoice;
        } else if (answer.startsWith('o')) {
          choice = 'overwrite';
        } else if (answer.startsWith('b')) {
          choice = 'backup';
        } else {
          choice = 'skip';
        }
      } else if (!choice) {
        choice = 'skip';
      }

      if (choice === 'skip') {
        out.verbose(`  ${c.dim('○')} Skipped ${c.dim(relDest)}`);
        stats.skipped++;
        continue;
      }

      if (choice === 'backup') {
        const backupPath = getBackupPath(file.dest);
        fs.copyFileSync(file.dest, backupPath);
        out.log(`  ${c.cyan('↻')} Backed up to ${c.dim(path.basename(backupPath))}`);
        stats.backed++;
      }
    } else if (exists && hasBackupAll) {
      const backupPath = getBackupPath(file.dest);
      fs.copyFileSync(file.dest, backupPath);
      out.verbose(`  ${c.cyan('↻')} Backed up ${c.dim(relDest)}`);
      stats.backed++;
    }

    // Safety: never overwrite a non-WTF-P plugin.json
    if (file.name === 'plugin.json' && file.componentId === 'plugin' && exists) {
      try {
        const existing = JSON.parse(fs.readFileSync(file.dest, 'utf8'));
        if (existing.name && existing.name !== 'wtf-p' && existing.name !== 'write-the-f-paper') {
          out.verbose(`  ${c.yellow('!')} ${c.dim(relDest)} belongs to another plugin — skipped`);
          stats.skipped++;
          continue;
        }
      } catch { /* corrupt JSON — safe to overwrite */ }
    }

    const content = processContent(file.src, pathPrefix);
    if (content !== null) {
      fs.writeFileSync(file.dest, content);
    } else {
      fs.copyFileSync(file.src, file.dest);
    }

    if (!exists) {
      out.verbose(`  ${c.green('+')} ${c.dim(relDest)}`);
    } else {
      out.verbose(`  ${c.green('✓')} ${c.dim(relDest)}`);
    }
    stats.installed++;
  }

  rl.close();
  return stats;
}

/**
 * Main install logic
 * @param {string} runtime - 'claude' | 'gemini' | 'claude-local'
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
    out.error(`Unknown runtime: ${runtime}`);
    process.exit(1);
  }

  // Resolve Target Directory using the Vendor Strategy
  const targetDir = getVendorDir(runtime, explicitConfigDir);
  const isGlobal = runtime !== 'claude-local';
  const locationLabel = getPathLabel(targetDir, isGlobal);

  // Validate path
  if (!isValidPath(targetDir)) {
    out.error(`Invalid path: ${targetDir}`);
    process.exit(1);
  }

  const pathPrefix = isGlobal
    ? (explicitConfigDir ? `${targetDir}/` : `~/${vendorConfig.defaultDir}/`)
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

  vendorConfig.components.forEach(component => {
    // Check --only filters
    if (onlyInstall !== 'all') {
      const allowedIds = [onlyInstall];
      // Legacy mapping: 'commands' includes 'skills'
      if (onlyInstall === 'commands') allowedIds.push('skills');
      
      if (!allowedIds.includes(component.id)) {
        return;
      }
    }
    
    // DEBUG LOG
    // console.log(`Collecting: ${component.id} from ${component.src}`);
    
    collectComponentFiles(component, targetDir, allFiles);
  });
  
  // DEBUG
  // console.log(`Total files found: ${allFiles.length}`);

  // Install with conflict resolution
  const stats = await installWithConflictResolution(allFiles, pathPrefix, targetDir, options);

  // Write version tracking file
  writeVersionFile(targetDir, pkg.version, allFiles);

  // Summary
  if (!hasQuiet) {
    out.log(`
  ${c.green('Done!')} ${c.dim(`[${vendorConfig.name}]`)} Installed: ${stats.installed}, Skipped: ${stats.skipped}, Backed up: ${stats.backed}

  Run ${c.cyan('/wtfp:help')} in ${vendorConfig.name} to get started.
`);

    if (showExplanations && !isUpdate) {
      out.log(`  ${c.yellow('Get started:')}`);
      out.log(`    ${c.cyan('/wtfp:new-paper')}      Define your paper's vision and structure`);
      out.log(`    ${c.cyan('/wtfp:progress')}       See where you are and what's next`);
      out.log(`    ${c.cyan('/wtfp:help')}           Browse all available commands\n`);
    }
  }
}

module.exports = install;