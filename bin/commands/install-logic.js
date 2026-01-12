const fs = require('fs');
const path = require('path');
const os = require('os');
const { 
  isValidPath, 
  getClaudeDir, 
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
 * Collect files to install
 */
function collectInstallFiles(srcDir, destDir, files = []) {
  if (!fs.existsSync(srcDir)) return files;

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      collectInstallFiles(srcPath, destPath, files);
    } else {
      files.push({ src: srcPath, dest: destPath, name: entry.name });
    }
  }

  return files;
}

/**
 * Install files with conflict resolution
 */
async function installWithConflictResolution(files, pathPrefix, claudeDir, options) {
  const { out, hasForce, hasBackupAll, isInteractive, showExplanations } = options;
  const c = out.colors;
  const rl = createRL();
  let globalChoice = null;
  const stats = { installed: 0, skipped: 0, backed: 0 };

  const existingFiles = files.filter(f => fs.existsSync(f.dest));

  if (existingFiles.length > 0 && !hasForce && !hasBackupAll && isInteractive) {
    const relPath = getPathLabel(claudeDir, true);
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
        // Non-interactive with existing file and no force: skip
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

  const src = path.join(__dirname, '../..');
  const claudeDir = getClaudeDir(explicitConfigDir, isGlobal);
  const locationLabel = getPathLabel(claudeDir, isGlobal);

  // Validate path
  if (!isValidPath(claudeDir)) {
    out.error(`Invalid path: ${claudeDir}`);
    process.exit(1);
  }

  const pathPrefix = isGlobal
    ? (explicitConfigDir ? `${claudeDir}/` : '~/.claude/')
    : './.claude/';

  if (!hasQuiet) {
    out.log(`  Installing to ${c.cyan(locationLabel)}
`);
  }

  // Collect files
  const allFiles = [];

  // 1. Core Workflows
  if (onlyInstall === 'all' || onlyInstall === 'workflows') {
    const workflowSrc = path.join(src, 'core', 'write-the-f-paper');
    const workflowDest = path.join(claudeDir, 'write-the-f-paper');
    collectInstallFiles(workflowSrc, workflowDest, allFiles);
  }

  // 2. Claude Commands
  if (onlyInstall === 'all' || onlyInstall === 'commands') {
    const commandSrc = path.join(src, 'vendors', 'claude', 'commands', 'wtfp');
    const commandDest = path.join(claudeDir, 'commands', 'wtfp');
    collectInstallFiles(commandSrc, commandDest, allFiles);
  }

  // 3. Claude Skills (always with commands for now)
  if (onlyInstall === 'all' || onlyInstall === 'commands' || onlyInstall === 'skills') {
    const skillSrc = path.join(src, 'vendors', 'claude', 'skills', 'wtfp');
    const skillDest = path.join(claudeDir, 'skills', 'wtfp');
    collectInstallFiles(skillSrc, skillDest, allFiles);
  }

  // 4. Claude Plugin Manifest
  if (onlyInstall === 'all') {
    const pluginSrc = path.join(src, 'vendors', 'claude', '.claude-plugin');
    const pluginDest = path.join(claudeDir, '.claude-plugin');
    collectInstallFiles(pluginSrc, pluginDest, allFiles);
  }

  // Install with conflict resolution
  const stats = await installWithConflictResolution(allFiles, pathPrefix, claudeDir, options);

  // Write version tracking file
  writeVersionFile(claudeDir, pkg.version, allFiles);

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
