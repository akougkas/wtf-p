#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  expandTilde,
  normalizePath,
  getClaudeDir,
  getPathLabel,
  detectInstallation,
  collectFiles,
  createColors,
  createOutput,
  createRL,
  prompt,
  VERSION_FILE
} = require('./lib/utils');

// Get version from package.json
let version = 'unknown';
try {
  const pkg = require('../package.json');
  version = pkg.version;
} catch {
  // Running standalone
}

// ============ Argument Parsing ============

const args = process.argv.slice(2);
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');
const hasForce = args.includes('--force') || args.includes('-f');
const hasBackup = args.includes('--backup') || args.includes('-b');
const hasDryRun = args.includes('--dry-run') || args.includes('-n');
const hasCleanBackups = args.includes('--clean-backups');
const hasHelp = args.includes('--help') || args.includes('-h');
const hasNoColor = args.includes('--no-color');
const hasQuiet = args.includes('--quiet') || args.includes('-q');

// Parse --config-dir argument
function parseConfigDirArg() {
  const configDirIndex = args.findIndex(arg => arg === '--config-dir' || arg === '-c');
  if (configDirIndex !== -1) {
    const nextArg = args[configDirIndex + 1];
    if (!nextArg || nextArg.startsWith('-')) {
      console.error('  --config-dir requires a path argument');
      process.exit(1);
    }
    return nextArg;
  }
  const configDirArg = args.find(arg => arg.startsWith('--config-dir=') || arg.startsWith('-c='));
  if (configDirArg) {
    return configDirArg.split('=')[1];
  }
  return null;
}

const explicitConfigDir = parseConfigDirArg();

// Setup output helpers
const isTTY = process.stdout.isTTY && process.stdin.isTTY;
const useColors = !hasNoColor && (isTTY || process.env.FORCE_COLOR);
const out = createOutput({ quiet: hasQuiet, useColors });
const c = out.colors;

// ============ Banner ============

const banner = `
${c.magenta('██╗    ██╗████████╗███████╗      ██████╗')}
${c.magenta('██║    ██║╚══██╔══╝██╔════╝      ██╔══██╗')}
${c.magenta('██║ █╗ ██║   ██║   █████╗  █████╗██████╔╝')}
${c.magenta('██║███╗██║   ██║   ██╔══╝  ╚════╝██╔═══╝')}
${c.magenta('╚███╔███╔╝   ██║   ██║           ██║')}
${c.magenta(' ╚══╝╚══╝    ╚═╝   ╚═╝           ╚═╝')}

  ${c.cyan('WTF-P Uninstaller')} ${c.dim(`v${version}`)}
`;

if (!hasQuiet) {
  console.log(banner);
}

// ============ Help Text ============

if (hasHelp) {
  console.log(`  ${c.yellow('Usage:')} npx wtf-p-uninstall [options]

  ${c.yellow('Options:')}
    ${c.cyan('-g, --global')}              Uninstall from Claude config directory
    ${c.cyan('-l, --local')}               Uninstall from ./.claude in current directory
    ${c.cyan('-c, --config-dir <path>')}   Specify custom Claude config directory
    ${c.cyan('-f, --force')}               Skip confirmation prompts
    ${c.cyan('-b, --backup')}              Backup files before removing
    ${c.cyan('-n, --dry-run')}             Show what would be removed without removing
    ${c.cyan('--clean-backups')}           Also remove .backup-* files from prior installs
    ${c.cyan('--no-color')}                Disable colored output
    ${c.cyan('-q, --quiet')}               Suppress non-essential output
    ${c.cyan('-h, --help')}                Show this help message

  ${c.yellow('What gets removed:')}
    ${c.dim('commands/wtfp/')}         - WTF-P slash commands
    ${c.dim('write-the-f-paper/')}     - WTF-P skill and workflows
    ${c.dim('.wtfp-version')}          - Version tracking file

  ${c.yellow('What stays intact:')}
    ${c.dim('CLAUDE.md')}               - Your personal instructions (never touched)
    ${c.dim('commands/')}               - Other slash commands you may have
    ${c.dim('settings.json')}           - Your Claude settings
    ${c.dim('Other directories')}       - Any other config or plugins

  ${c.yellow('Examples:')}
    ${c.dim('# Interactive uninstall from ~/.claude')}
    npx wtf-p-uninstall --global

    ${c.dim('# Preview what would be removed')}
    npx wtf-p-uninstall --global --dry-run

    ${c.dim('# Backup before removing')}
    npx wtf-p-uninstall --global --backup

    ${c.dim('# Also clean up backup files from prior installs')}
    npx wtf-p-uninstall --global --clean-backups

    ${c.dim('# Uninstall from custom location')}
    npx wtf-p-uninstall --global --config-dir ~/.claude-research
`);
  process.exit(0);
}

// ============ Utilities ============

/**
 * Generate backup directory path with timestamp
 */
function getBackupDir(claudeDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return path.join(claudeDir, `.wtfp-backup-${timestamp}`);
}

/**
 * Recursively remove directory
 */
function removeDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Copy directory recursively
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Find backup files in a directory
 */
function findBackupFiles(dir, backups = []) {
  if (!fs.existsSync(dir)) return backups;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.wtfp-backup-')) {
        backups.push(fullPath);
      } else {
        findBackupFiles(fullPath, backups);
      }
    } else if (entry.name.includes('.backup-')) {
      backups.push(fullPath);
    }
  }
  return backups;
}

// ============ Uninstall Logic ============

/**
 * Uninstall from the specified directory
 */
async function uninstall(isGlobal) {
  const claudeDir = getClaudeDir(explicitConfigDir, isGlobal);
  const locationLabel = getPathLabel(claudeDir, isGlobal);

  out.log(`  Checking ${c.cyan(locationLabel)} for WTF-P installation...\n`);

  // Detect installation
  const installed = detectInstallation(claudeDir);
  const totalFiles = installed.commandFiles.length + installed.skillFiles.length;

  if (!installed.hasCommands && !installed.hasSkill) {
    out.log(`  ${c.yellow('No WTF-P installation found in ' + locationLabel)}\n`);

    // Check for backups if requested
    if (hasCleanBackups) {
      const backups = findBackupFiles(claudeDir);
      if (backups.length > 0) {
        out.log(`  Found ${backups.length} backup file(s)/folder(s) to clean:\n`);
        for (const b of backups.slice(0, 10)) {
          out.log(`    ${c.dim(b.replace(claudeDir, '.'))}`);
        }
        if (backups.length > 10) {
          out.log(`    ${c.dim('... and ' + (backups.length - 10) + ' more')}`);
        }
        out.log('');

        if (!hasDryRun && !hasForce) {
          const rl = createRL();
          const answer = await prompt(rl, `  Remove these backup files? [y/N]: `);
          rl.close();
          if (answer !== 'y' && answer !== 'yes') {
            out.log(`\n  ${c.yellow('Aborted.')}\n`);
            return;
          }
        }

        if (!hasDryRun) {
          for (const b of backups) {
            if (fs.statSync(b).isDirectory()) {
              removeDir(b);
            } else {
              fs.unlinkSync(b);
            }
            out.log(`  ${c.red('-')} ${c.dim(b.replace(claudeDir, '.'))}`);
          }
          out.log(`\n  ${c.green('Cleaned ' + backups.length + ' backup file(s).')}\n`);
        } else {
          out.log(`  ${c.yellow('Dry run: would remove ' + backups.length + ' backup file(s).')}\n`);
        }
      } else {
        out.log(`  No backup files found.\n`);
      }
    }
    return;
  }

  // Show what will be removed
  out.log(`  ${c.yellow('Found WTF-P installation:')}\n`);

  const commandsDir = path.join(claudeDir, 'commands', 'wtfp');
  const skillDir = path.join(claudeDir, 'write-the-f-paper');

  if (installed.hasCommands) {
    out.log(`    ${c.cyan('commands/wtfp/')} (${installed.commandFiles.length} files)`);
  }
  if (installed.hasSkill) {
    out.log(`    ${c.cyan('write-the-f-paper/')} (${installed.skillFiles.length} files)`);
  }
  if (installed.version) {
    out.log(`    ${c.cyan(VERSION_FILE)} (version tracking)`);
  }
  out.log('');

  // Check for backups to clean
  let backups = [];
  if (hasCleanBackups) {
    const allBackups = findBackupFiles(claudeDir);
    backups = allBackups.filter(b => {
      if (installed.hasCommands && b.startsWith(commandsDir)) return false;
      if (installed.hasSkill && b.startsWith(skillDir)) return false;
      return true;
    });
    if (backups.length > 0) {
      out.log(`    ${c.dim('+ ' + backups.length + ' backup file(s) outside wtfp dirs will also be removed')}\n`);
    }
  }

  // Dry run stops here
  if (hasDryRun) {
    out.log(`  ${c.yellow('Dry run: would remove ' + totalFiles + ' file(s) in 2 directories.')}\n`);
    return;
  }

  // Confirm unless --force
  if (!hasForce) {
    const rl = createRL();
    const answer = await prompt(rl, `  Remove ${totalFiles} file(s)? [y/N]: `);
    rl.close();

    if (answer !== 'y' && answer !== 'yes') {
      out.log(`\n  ${c.yellow('Aborted.')}\n`);
      return;
    }
    out.log('');
  }

  // Backup if requested
  if (hasBackup) {
    const backupDir = getBackupDir(claudeDir);
    fs.mkdirSync(backupDir, { recursive: true });

    if (installed.hasCommands) {
      const dest = path.join(backupDir, 'commands', 'wtfp');
      copyDir(commandsDir, dest);
    }
    if (installed.hasSkill) {
      const dest = path.join(backupDir, 'write-the-f-paper');
      copyDir(skillDir, dest);
    }

    const backupLabel = backupDir.replace(os.homedir(), '~').replace(process.cwd(), '.');
    out.log(`  ${c.cyan('↻')} Backed up to ${c.dim(backupLabel)}\n`);
  }

  // Remove directories
  if (installed.hasCommands) {
    removeDir(commandsDir);
    out.log(`  ${c.red('-')} ${c.dim('commands/wtfp/')}`);

    // Clean up empty commands dir
    const parentCommandsDir = path.join(claudeDir, 'commands');
    if (fs.existsSync(parentCommandsDir)) {
      const remaining = fs.readdirSync(parentCommandsDir);
      if (remaining.length === 0) {
        fs.rmdirSync(parentCommandsDir);
        out.log(`  ${c.red('-')} ${c.dim('commands/')} ${c.dim('(empty)')}`);
      }
    }
  }

  if (installed.hasSkill) {
    removeDir(skillDir);
    out.log(`  ${c.red('-')} ${c.dim('write-the-f-paper/')}`);
  }

  // Remove version file
  const versionFile = path.join(claudeDir, VERSION_FILE);
  if (fs.existsSync(versionFile)) {
    fs.unlinkSync(versionFile);
    out.log(`  ${c.red('-')} ${c.dim(VERSION_FILE)}`);
  }

  // Clean backups if requested
  if (hasCleanBackups && backups.length > 0) {
    for (const b of backups) {
      if (fs.statSync(b).isDirectory()) {
        removeDir(b);
      } else {
        fs.unlinkSync(b);
      }
    }
    out.log(`  ${c.red('-')} ${c.dim(backups.length + ' backup file(s)')}`);
  }

  out.log(`
  ${c.green('Done!')} WTF-P has been uninstalled.

  ${c.dim('Your CLAUDE.md and other configs remain untouched.')}

  To reinstall: ${c.cyan('npx wtf-p --global')}
`);
}

/**
 * Prompt for uninstall location
 */
async function promptLocation() {
  const rl = createRL();

  const globalPath = getClaudeDir(explicitConfigDir, true);
  const globalLabel = getPathLabel(globalPath, true);
  const localPath = getClaudeDir(null, false);

  // Check what's installed where
  const globalInstalled = detectInstallation(globalPath);
  const localInstalled = detectInstallation(localPath);

  const hasGlobalInstall = globalInstalled.hasCommands || globalInstalled.hasSkill;
  const hasLocalInstall = localInstalled.hasCommands || localInstalled.hasSkill;

  if (!hasGlobalInstall && !hasLocalInstall) {
    out.log(`  ${c.yellow('No WTF-P installation found.')}\n`);
    out.log(`  Checked:`);
    out.log(`    ${c.dim(globalLabel)}`);
    out.log(`    ${c.dim('./.claude')}\n`);
    rl.close();
    return;
  }

  out.log(`  ${c.yellow('Where would you like to uninstall from?')}\n`);

  if (hasGlobalInstall) {
    const count = globalInstalled.commandFiles.length + globalInstalled.skillFiles.length;
    out.log(`  ${c.cyan('1)')} Global ${c.dim('(' + globalLabel + ')')} - ${count} files`);
  } else {
    out.log(`  ${c.dim('1) Global (' + globalLabel + ') - not installed')}`);
  }

  if (hasLocalInstall) {
    const count = localInstalled.commandFiles.length + localInstalled.skillFiles.length;
    out.log(`  ${c.cyan('2)')} Local  ${c.dim('(./.claude)')} - ${count} files`);
  } else {
    out.log(`  ${c.dim('2) Local (./.claude) - not installed')}`);
  }
  out.log('');

  const answer = await prompt(rl, `  Choice: `);
  rl.close();

  if (answer === '1' && hasGlobalInstall) {
    await uninstall(true);
  } else if (answer === '2' && hasLocalInstall) {
    await uninstall(false);
  } else {
    out.log(`\n  ${c.yellow('Invalid choice or no installation at that location.')}\n`);
  }
}

// ============ Main ============

async function main() {
  if (hasGlobal && hasLocal) {
    out.error('Cannot specify both --global and --local');
    process.exit(1);
  }
  if (explicitConfigDir && hasLocal) {
    out.error('Cannot use --config-dir with --local');
    process.exit(1);
  }

  if (hasGlobal) {
    await uninstall(true);
  } else if (hasLocal) {
    await uninstall(false);
  } else {
    await promptLocation();
  }
}

main().catch(err => {
  out.error(err.message);
  process.exit(1);
});
