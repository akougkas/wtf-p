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
const pkg = require('../package.json');

const banner = `
${magenta}██╗    ██╗████████╗███████╗      ██████╗
██║    ██║╚══██╔══╝██╔════╝      ██╔══██╗
██║ █╗ ██║   ██║   █████╗  █████╗██████╔╝
██║███╗██║   ██║   ██╔══╝  ╚════╝██╔═══╝
╚███╔███╔╝   ██║   ██║           ██║
 ╚══╝╚══╝    ╚═╝   ╚═╝           ╚═╝${reset}

  ${cyan}Write The F***ing Paper${reset} ${dim}v${pkg.version}${reset}
  Context engineering for academic writing.
  Ship papers, not excuses.
`;

// Parse args
const args = process.argv.slice(2);
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');
const hasForce = args.includes('--force') || args.includes('-f');
const hasBackupAll = args.includes('--backup-all') || args.includes('-b');

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
  console.log(`  ${yellow}Usage:${reset} npx wtf-p [options]

  ${yellow}Options:${reset}
    ${cyan}-g, --global${reset}              Install globally (to Claude config directory)
    ${cyan}-l, --local${reset}               Install locally (to ./.claude in current directory)
    ${cyan}-c, --config-dir <path>${reset}   Specify custom Claude config directory
    ${cyan}-f, --force${reset}               Overwrite all existing files without prompting
    ${cyan}-b, --backup-all${reset}          Backup all existing files before overwriting
    ${cyan}-h, --help${reset}                Show this help message

  ${yellow}Conflict Resolution:${reset}
    When existing WTF-P files are detected, you'll be prompted for each:
    ${dim}[o]verwrite${reset}  - Replace with new version
    ${dim}[s]kip${reset}       - Keep existing file
    ${dim}[b]ackup${reset}     - Backup existing, then install new
    ${dim}[a]ll${reset}        - Apply same choice to remaining conflicts

  ${yellow}Examples:${reset}
    ${dim}# Install with prompts for conflicts${reset}
    npx wtf-p --global

    ${dim}# Force overwrite all existing files${reset}
    npx wtf-p --global --force

    ${dim}# Backup all existing files before installing${reset}
    npx wtf-p --global --backup-all

    ${dim}# Install to custom config directory${reset}
    npx wtf-p --global --config-dir ~/.claude-research

  ${yellow}Uninstall:${reset}
    npx wtf-p-uninstall [--global|--local] [--config-dir <path>]

  ${yellow}After installation:${reset}
    Run ${cyan}/wtfp:help${reset} in Claude Code to get started.
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
 * Generate backup path with timestamp
 */
function getBackupPath(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return path.join(dir, `${base}.backup-${timestamp}${ext}`);
}

/**
 * Collect all files that would be installed
 */
function collectFiles(srcDir, destDir, pathPrefix, files = []) {
  if (!fs.existsSync(srcDir)) return files;

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      collectFiles(srcPath, destPath, pathPrefix, files);
    } else {
      files.push({ src: srcPath, dest: destPath, name: entry.name });
    }
  }

  return files;
}

/**
 * Process file content with path replacement
 */
function processContent(srcPath, pathPrefix) {
  if (srcPath.endsWith('.md') || srcPath.endsWith('.json')) {
    let content = fs.readFileSync(srcPath, 'utf8');
    return content.replace(/~\/\.claude\//g, pathPrefix);
  }
  return null; // Binary copy
}

/**
 * Install files with conflict resolution
 */
async function installWithConflictResolution(files, pathPrefix, claudeDir) {
  const rl = createRL();
  let globalChoice = null; // 'overwrite', 'skip', 'backup'
  const stats = { installed: 0, skipped: 0, backed: 0 };

  // Check for existing installation
  const existingFiles = files.filter(f => fs.existsSync(f.dest));

  if (existingFiles.length > 0 && !hasForce && !hasBackupAll) {
    const relPath = claudeDir.replace(os.homedir(), '~');
    console.log(`  ${yellow}Found ${existingFiles.length} existing WTF-P file(s) in ${relPath}${reset}\n`);
  }

  for (const file of files) {
    const exists = fs.existsSync(file.dest);
    const relDest = file.dest.replace(os.homedir(), '~').replace(process.cwd(), '.');

    // Ensure directory exists
    fs.mkdirSync(path.dirname(file.dest), { recursive: true });

    if (exists && !hasForce && !hasBackupAll) {
      let choice = globalChoice;

      if (!choice) {
        const answer = await prompt(rl,
          `  ${yellow}?${reset} ${dim}${relDest}${reset} exists. [o]verwrite/[s]kip/[b]ackup/[a]ll: `
        );

        if (answer.startsWith('a')) {
          // Apply to all: ask which action
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
      }

      if (choice === 'skip') {
        console.log(`  ${dim}○${reset} Skipped ${dim}${relDest}${reset}`);
        stats.skipped++;
        continue;
      }

      if (choice === 'backup') {
        const backupPath = getBackupPath(file.dest);
        fs.copyFileSync(file.dest, backupPath);
        console.log(`  ${cyan}↻${reset} Backed up to ${dim}${path.basename(backupPath)}${reset}`);
        stats.backed++;
      }
    } else if (exists && hasBackupAll) {
      const backupPath = getBackupPath(file.dest);
      fs.copyFileSync(file.dest, backupPath);
      console.log(`  ${cyan}↻${reset} Backed up ${dim}${relDest}${reset}`);
      stats.backed++;
    }

    // Install the file
    const content = processContent(file.src, pathPrefix);
    if (content !== null) {
      fs.writeFileSync(file.dest, content);
    } else {
      fs.copyFileSync(file.src, file.dest);
    }

    if (!exists) {
      console.log(`  ${green}+${reset} ${dim}${relDest}${reset}`);
    } else {
      console.log(`  ${green}✓${reset} ${dim}${relDest}${reset}`);
    }
    stats.installed++;
  }

  rl.close();
  return stats;
}

/**
 * Install to the specified directory
 */
async function install(isGlobal) {
  const src = path.join(__dirname, '..');
  const configDir = expandTilde(explicitConfigDir) || expandTilde(process.env.CLAUDE_CONFIG_DIR);
  const defaultGlobalDir = configDir || path.join(os.homedir(), '.claude');
  const claudeDir = isGlobal
    ? defaultGlobalDir
    : path.join(process.cwd(), '.claude');

  const locationLabel = isGlobal
    ? claudeDir.replace(os.homedir(), '~')
    : claudeDir.replace(process.cwd(), '.');

  const pathPrefix = isGlobal
    ? (configDir ? `${claudeDir}/` : '~/.claude/')
    : './.claude/';

  console.log(`  Installing to ${cyan}${locationLabel}${reset}\n`);

  // Collect all files to install
  const wtfpSrc = path.join(src, 'commands', 'wtfp');
  const wtfpDest = path.join(claudeDir, 'commands', 'wtfp');
  const skillSrc = path.join(src, 'write-the-f-paper');
  const skillDest = path.join(claudeDir, 'write-the-f-paper');

  const allFiles = [
    ...collectFiles(wtfpSrc, wtfpDest, pathPrefix),
    ...collectFiles(skillSrc, skillDest, pathPrefix)
  ];

  // Install with conflict resolution
  const stats = await installWithConflictResolution(allFiles, pathPrefix, claudeDir);

  console.log(`
  ${green}Done!${reset} Installed: ${stats.installed}, Skipped: ${stats.skipped}, Backed up: ${stats.backed}

  Run ${cyan}/wtfp:help${reset} in Claude Code to get started.

  ${yellow}Quick Start:${reset}
    ${cyan}/wtfp:new-paper${reset}      Start a new academic paper
    ${cyan}/wtfp:progress${reset}       Check your writing status
    ${cyan}/wtfp:help${reset}           Show all commands
`);
}

/**
 * Prompt for install location
 */
async function promptLocation() {
  const rl = createRL();

  const configDir = expandTilde(explicitConfigDir) || expandTilde(process.env.CLAUDE_CONFIG_DIR);
  const globalPath = configDir || path.join(os.homedir(), '.claude');
  const globalLabel = globalPath.replace(os.homedir(), '~');

  console.log(`  ${yellow}Where would you like to install?${reset}

  ${cyan}1${reset}) Global ${dim}(${globalLabel})${reset} - available in all projects
  ${cyan}2${reset}) Local  ${dim}(./.claude)${reset} - this project only
`);

  const answer = await prompt(rl, `  Choice ${dim}[1]${reset}: `);
  rl.close();

  const choice = answer || '1';
  const isGlobal = choice !== '2';
  await install(isGlobal);
}

// Main
async function main() {
  if (hasGlobal && hasLocal) {
    console.error(`  ${yellow}Cannot specify both --global and --local${reset}`);
    process.exit(1);
  } else if (explicitConfigDir && hasLocal) {
    console.error(`  ${yellow}Cannot use --config-dir with --local${reset}`);
    process.exit(1);
  } else if (hasForce && hasBackupAll) {
    console.error(`  ${yellow}Cannot use both --force and --backup-all${reset}`);
    process.exit(1);
  } else if (hasGlobal) {
    await install(true);
  } else if (hasLocal) {
    await install(false);
  } else {
    await promptLocation();
  }
}

main().catch(err => {
  console.error(`  ${red}Error:${reset} ${err.message}`);
  process.exit(1);
});
