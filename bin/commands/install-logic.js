const fs = require('fs');
const path = require('path');
const os = require('os');
const MANIFEST = require('../lib/manifest');
const { 
  isValidPath, 
  getClaudeDir, // Legacy support, will refactor
  getPathLabel, 
  getBackupPath, 
  writeVersionFile, 
  createRL, 
  prompt 
} = require('../lib/utils');

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
    out.log(`  ${c.yellow(`Found ${existingFiles.length} existing WTF-P file(s) in ${relPath}`)}
`);

    if (showExplanations) {
      out.log(`  ${c.dim('For each file, choose:')}`);
      out.log(`  ${c.dim('[o]verwrite - Replace with new version')}`);
      out.log(`  ${c.dim('[s]kip      - Keep your existing file')}`);
      out.log(`  ${c.dim('[b]ackup    - Save existing, then install new')}`);
      out.log(`  ${c.dim('[a]ll       - Apply same choice to remaining')}\n`);
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
 */
async function install(isGlobal, isUpdate, options, pkg) {
  const { out, explicitConfigDir, hasQuiet, onlyInstall, showExplanations } = options;
  const c = out.colors;

  // Use Claude vendor by default for now (can be passed as arg later)
  const vendorConfig = MANIFEST.claude;
  
  // Resolve Target Directory using the Vendor Strategy
  // TODO: Use getVendorDir generic
  const targetDir = getClaudeDir(explicitConfigDir, isGlobal);
  const locationLabel = getPathLabel(targetDir, isGlobal);

  // Validate path
  if (!isValidPath(targetDir)) {
    out.error(`Invalid path: ${targetDir}`);
    process.exit(1);
  }

  const pathPrefix = isGlobal
    ? (explicitConfigDir ? `${targetDir}/` : `~/${vendorConfig.defaultDir}/`)
    : `./${vendorConfig.defaultDir}/`;

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
  ${c.green('Done!')} Installed: ${stats.installed}, Skipped: ${stats.skipped}, Backed up: ${stats.backed}

  Run ${c.cyan('/wtfp:help')} in Claude Code to get started.
`);

    if (showExplanations && !isUpdate) {
      out.log(`  ${c.yellow('Quick Start:')}`);
      out.log(`    ${c.cyan('/wtfp:new-paper')}      Start a new academic paper`);
      out.log(`    ${c.cyan('/wtfp:progress')}       Check your writing status`);
      out.log(`    ${c.cyan('/wtfp:help')}           Show all commands\n`);
    }
  }
}

module.exports = install;