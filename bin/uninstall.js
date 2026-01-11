#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const magenta = '\x1b[35m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

// Get version from package.json
let version = 'unknown';
try {
  const pkg = require('../package.json');
  version = pkg.version;
} catch {
  // Running standalone
}

const banner = `
${magenta}██╗    ██╗████████╗███████╗      ██████╗
██║    ██║╚══██╔══╝██╔════╝      ██╔══██╗
██║ █╗ ██║   ██║   █████╗  █████╗██████╔╝
██║███╗██║   ██║   ██╔══╝  ╚════╝██╔═══╝
╚███╔███╔╝   ██║   ██║           ██║
 ╚══╝╚══╝    ╚═╝   ╚═╝           ╚═╝${reset}

  ${cyan}WTF-P Uninstaller${reset} ${dim}v${version}${reset}
`;

// Parse args
const args = process.argv.slice(2);
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');
const hasForce = args.includes('--force') || args.includes('-f');
const hasBackup = args.includes('--backup') || args.includes('-b');
const hasDryRun = args.includes('--dry-run') || args.includes('-n');
const hasCleanBackups = args.includes('--clean-backups');

// Parse --config-dir argument
function parseConfigDirArg() {
  const configDirIndex = args.findIndex(arg => arg === '--config-dir' || arg === '-c');
  if (configDirIndex !== -1) {
    const nextArg = args[configDirIndex + 1];
    if (!nextArg || nextArg.startsWith('-')) {
      console.error(`  ${yellow}--config-dir requires a path argument${reset}`);
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
const hasHelp = args.includes('--help') || args.includes('-h');

console.log(banner);

// Show help if requested
if (hasHelp) {
  console.log(`  ${yellow}Usage:${reset} npx wtf-p-uninstall [options]

  ${yellow}Options:${reset}
    ${cyan}-g, --global${reset}              Uninstall from Claude config directory
    ${cyan}-l, --local${reset}               Uninstall from ./.claude in current directory
    ${cyan}-c, --config-dir <path>${reset}   Specify custom Claude config directory
    ${cyan}-f, --force${reset}               Skip confirmation prompts
    ${cyan}-b, --backup${reset}              Backup files before removing
    ${cyan}-n, --dry-run${reset}             Show what would be removed without removing
    ${cyan}--clean-backups${reset}           Also remove .backup-* files from prior installs
    ${cyan}-h, --help${reset}                Show this help message

  ${yellow}What gets removed:${reset}
    ${dim}commands/wtfp/${reset}         - WTF-P slash commands
    ${dim}write-the-f-paper/${reset}     - WTF-P skill and workflows

  ${yellow}What stays intact:${reset}
    ${dim}CLAUDE.md${reset}               - Your personal instructions (never touched)
    ${dim}commands/${reset}               - Other slash commands you may have
    ${dim}settings.json${reset}           - Your Claude settings
    ${dim}Other directories${reset}       - Any other config or plugins

  ${yellow}Examples:${reset}
    ${dim}# Interactive uninstall from ~/.claude${reset}
    npx wtf-p-uninstall --global

    ${dim}# Preview what would be removed${reset}
    npx wtf-p-uninstall --global --dry-run

    ${dim}# Backup before removing${reset}
    npx wtf-p-uninstall --global --backup

    ${dim}# Also clean up backup files from prior installs${reset}
    npx wtf-p-uninstall --global --clean-backups

    ${dim}# Uninstall from custom location${reset}
    npx wtf-p-uninstall --global --config-dir ~/.claude-research
`);
  process.exit(0);
}

/**
 * Expand ~ to home directory
 */
function expandTilde(filePath) {
  if (filePath && filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Create readline interface for prompts
 */
function createRL() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompt user with a question
 */
function prompt(rl, question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim().toLowerCase()));
  });
}

/**
 * Generate backup directory path with timestamp
 */
function getBackupDir(claudeDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return path.join(claudeDir, `.wtfp-backup-${timestamp}`);
}

/**
 * Recursively collect all files in a directory
 */
function collectFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
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
      // Check for .wtfp-backup-* directories
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

/**
 * Detect what's installed
 */
function detectInstallation(claudeDir) {
  const wtfpCommands = path.join(claudeDir, 'commands', 'wtfp');
  const wtfpSkill = path.join(claudeDir, 'write-the-f-paper');

  const installed = {
    commands: fs.existsSync(wtfpCommands) ? wtfpCommands : null,
    skill: fs.existsSync(wtfpSkill) ? wtfpSkill : null,
    commandFiles: [],
    skillFiles: []
  };

  if (installed.commands) {
    installed.commandFiles = collectFiles(installed.commands);
  }
  if (installed.skill) {
    installed.skillFiles = collectFiles(installed.skill);
  }

  return installed;
}

/**
 * Uninstall from the specified directory
 */
async function uninstall(isGlobal) {
  const configDir = expandTilde(explicitConfigDir) || expandTilde(process.env.CLAUDE_CONFIG_DIR);
  const defaultGlobalDir = configDir || path.join(os.homedir(), '.claude');
  const claudeDir = isGlobal
    ? defaultGlobalDir
    : path.join(process.cwd(), '.claude');

  const locationLabel = isGlobal
    ? claudeDir.replace(os.homedir(), '~')
    : claudeDir.replace(process.cwd(), '.');

  console.log(`  Checking ${cyan}${locationLabel}${reset} for WTF-P installation...\n`);

  // Detect installation
  const installed = detectInstallation(claudeDir);
  const totalFiles = installed.commandFiles.length + installed.skillFiles.length;

  if (!installed.commands && !installed.skill) {
    console.log(`  ${yellow}No WTF-P installation found in ${locationLabel}${reset}\n`);

    // Check for backups if requested
    if (hasCleanBackups) {
      const backups = findBackupFiles(claudeDir);
      if (backups.length > 0) {
        console.log(`  Found ${backups.length} backup file(s)/folder(s) to clean:\n`);
        for (const b of backups.slice(0, 10)) {
          console.log(`    ${dim}${b.replace(claudeDir, '.')}${reset}`);
        }
        if (backups.length > 10) {
          console.log(`    ${dim}... and ${backups.length - 10} more${reset}`);
        }
        console.log();

        if (!hasDryRun && !hasForce) {
          const rl = createRL();
          const answer = await prompt(rl, `  Remove these backup files? [y/N]: `);
          rl.close();
          if (answer !== 'y' && answer !== 'yes') {
            console.log(`\n  ${yellow}Aborted.${reset}\n`);
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
            console.log(`  ${red}-${reset} ${dim}${b.replace(claudeDir, '.')}${reset}`);
          }
          console.log(`\n  ${green}Cleaned ${backups.length} backup file(s).${reset}\n`);
        } else {
          console.log(`  ${yellow}Dry run: would remove ${backups.length} backup file(s).${reset}\n`);
        }
      } else {
        console.log(`  No backup files found.\n`);
      }
    }
    return;
  }

  // Show what will be removed
  console.log(`  ${yellow}Found WTF-P installation:${reset}\n`);

  if (installed.commands) {
    console.log(`    ${cyan}commands/wtfp/${reset} (${installed.commandFiles.length} files)`);
  }
  if (installed.skill) {
    console.log(`    ${cyan}write-the-f-paper/${reset} (${installed.skillFiles.length} files)`);
  }
  console.log();

  // Check for backups to clean (only outside wtfp directories since those get removed anyway)
  let backups = [];
  if (hasCleanBackups) {
    const allBackups = findBackupFiles(claudeDir);
    // Filter out backups inside directories we're already removing
    backups = allBackups.filter(b => {
      if (installed.commands && b.startsWith(installed.commands)) return false;
      if (installed.skill && b.startsWith(installed.skill)) return false;
      return true;
    });
    if (backups.length > 0) {
      console.log(`    ${dim}+ ${backups.length} backup file(s) outside wtfp dirs will also be removed${reset}\n`);
    }
  }

  // Dry run stops here
  if (hasDryRun) {
    console.log(`  ${yellow}Dry run: would remove ${totalFiles} file(s) in 2 directories.${reset}\n`);
    return;
  }

  // Confirm unless --force
  if (!hasForce) {
    const rl = createRL();
    const answer = await prompt(rl, `  Remove ${totalFiles} file(s)? [y/N]: `);
    rl.close();

    if (answer !== 'y' && answer !== 'yes') {
      console.log(`\n  ${yellow}Aborted.${reset}\n`);
      return;
    }
    console.log();
  }

  // Backup if requested
  if (hasBackup) {
    const backupDir = getBackupDir(claudeDir);
    fs.mkdirSync(backupDir, { recursive: true });

    if (installed.commands) {
      const dest = path.join(backupDir, 'commands', 'wtfp');
      copyDir(installed.commands, dest);
    }
    if (installed.skill) {
      const dest = path.join(backupDir, 'write-the-f-paper');
      copyDir(installed.skill, dest);
    }

    const backupLabel = backupDir.replace(os.homedir(), '~').replace(process.cwd(), '.');
    console.log(`  ${cyan}↻${reset} Backed up to ${dim}${backupLabel}${reset}\n`);
  }

  // Remove directories
  if (installed.commands) {
    removeDir(installed.commands);
    console.log(`  ${red}-${reset} ${dim}commands/wtfp/${reset}`);

    // Clean up empty commands dir
    const commandsDir = path.join(claudeDir, 'commands');
    if (fs.existsSync(commandsDir)) {
      const remaining = fs.readdirSync(commandsDir);
      if (remaining.length === 0) {
        fs.rmdirSync(commandsDir);
        console.log(`  ${red}-${reset} ${dim}commands/${reset} ${dim}(empty)${reset}`);
      }
    }
  }

  if (installed.skill) {
    removeDir(installed.skill);
    console.log(`  ${red}-${reset} ${dim}write-the-f-paper/${reset}`);
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
    console.log(`  ${red}-${reset} ${dim}${backups.length} backup file(s)${reset}`);
  }

  console.log(`
  ${green}Done!${reset} WTF-P has been uninstalled.

  ${dim}Your CLAUDE.md and other configs remain untouched.${reset}

  To reinstall: ${cyan}npx wtf-p --global${reset}
`);
}

/**
 * Prompt for uninstall location
 */
async function promptLocation() {
  const rl = createRL();

  const configDir = expandTilde(explicitConfigDir) || expandTilde(process.env.CLAUDE_CONFIG_DIR);
  const globalPath = configDir || path.join(os.homedir(), '.claude');
  const globalLabel = globalPath.replace(os.homedir(), '~');
  const localPath = path.join(process.cwd(), '.claude');

  // Check what's installed where
  const globalInstalled = detectInstallation(globalPath);
  const localInstalled = detectInstallation(localPath);

  const hasGlobalInstall = globalInstalled.commands || globalInstalled.skill;
  const hasLocalInstall = localInstalled.commands || localInstalled.skill;

  if (!hasGlobalInstall && !hasLocalInstall) {
    console.log(`  ${yellow}No WTF-P installation found.${reset}\n`);
    console.log(`  Checked:`);
    console.log(`    ${dim}${globalLabel}${reset}`);
    console.log(`    ${dim}./.claude${reset}\n`);
    rl.close();
    return;
  }

  console.log(`  ${yellow}Where would you like to uninstall from?${reset}\n`);

  if (hasGlobalInstall) {
    const count = globalInstalled.commandFiles.length + globalInstalled.skillFiles.length;
    console.log(`  ${cyan}1${reset}) Global ${dim}(${globalLabel})${reset} - ${count} files`);
  } else {
    console.log(`  ${dim}1) Global (${globalLabel}) - not installed${reset}`);
  }

  if (hasLocalInstall) {
    const count = localInstalled.commandFiles.length + localInstalled.skillFiles.length;
    console.log(`  ${cyan}2${reset}) Local  ${dim}(./.claude)${reset} - ${count} files`);
  } else {
    console.log(`  ${dim}2) Local (./.claude) - not installed${reset}`);
  }
  console.log();

  const answer = await prompt(rl, `  Choice: `);
  rl.close();

  if (answer === '1' && hasGlobalInstall) {
    await uninstall(true);
  } else if (answer === '2' && hasLocalInstall) {
    await uninstall(false);
  } else {
    console.log(`\n  ${yellow}Invalid choice or no installation at that location.${reset}\n`);
  }
}

// Main
async function main() {
  if (hasGlobal && hasLocal) {
    console.error(`  ${yellow}Cannot specify both --global and --local${reset}`);
    process.exit(1);
  } else if (explicitConfigDir && hasLocal) {
    console.error(`  ${yellow}Cannot use --config-dir with --local${reset}`);
    process.exit(1);
  } else if (hasGlobal) {
    await uninstall(true);
  } else if (hasLocal) {
    await uninstall(false);
  } else {
    await promptLocation();
  }
}

main().catch(err => {
  console.error(`  ${red}Error:${reset} ${err.message}`);
  process.exit(1);
});
