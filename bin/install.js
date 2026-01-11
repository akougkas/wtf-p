#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
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

// Parse --config-dir argument
function parseConfigDirArg() {
  const configDirIndex = args.findIndex(arg => arg === '--config-dir' || arg === '-c');
  if (configDirIndex !== -1) {
    const nextArg = args[configDirIndex + 1];
    // Error if --config-dir is provided without a value or next arg is another flag
    if (!nextArg || nextArg.startsWith('-')) {
      console.error(`  ${yellow}--config-dir requires a path argument${reset}`);
      process.exit(1);
    }
    return nextArg;
  }
  // Also handle --config-dir=value format
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
    ${cyan}-h, --help${reset}                Show this help message

  ${yellow}Examples:${reset}
    ${dim}# Install to default ~/.claude directory${reset}
    npx wtf-p --global

    ${dim}# Install to custom config directory${reset}
    npx wtf-p --global --config-dir ~/.claude-research

    ${dim}# Using environment variable${reset}
    CLAUDE_CONFIG_DIR=~/.claude-research npx wtf-p --global

    ${dim}# Install to current project only${reset}
    npx wtf-p --local

  ${yellow}After installation:${reset}
    Run ${cyan}/wtfp:help${reset} in Claude Code to get started.
`);
  process.exit(0);
}

/**
 * Expand ~ to home directory (shell doesn't expand in env vars passed to node)
 */
function expandTilde(filePath) {
  if (filePath && filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Recursively copy directory, replacing paths in .md files
 */
function copyWithPathReplacement(srcDir, destDir, pathPrefix) {
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyWithPathReplacement(srcPath, destPath, pathPrefix);
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.json')) {
      // Replace ~/.claude/ with the appropriate prefix in markdown and json files
      let content = fs.readFileSync(srcPath, 'utf8');
      content = content.replace(/~\/\.claude\//g, pathPrefix);
      fs.writeFileSync(destPath, content);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Install to the specified directory
 */
function install(isGlobal) {
  const src = path.join(__dirname, '..');
  // Priority: explicit --config-dir arg > CLAUDE_CONFIG_DIR env var > default ~/.claude
  const configDir = expandTilde(explicitConfigDir) || expandTilde(process.env.CLAUDE_CONFIG_DIR);
  const defaultGlobalDir = configDir || path.join(os.homedir(), '.claude');
  const claudeDir = isGlobal
    ? defaultGlobalDir
    : path.join(process.cwd(), '.claude');

  const locationLabel = isGlobal
    ? claudeDir.replace(os.homedir(), '~')
    : claudeDir.replace(process.cwd(), '.');

  // Path prefix for file references
  // Use actual path when CLAUDE_CONFIG_DIR is set, otherwise use ~ shorthand
  const pathPrefix = isGlobal
    ? (configDir ? `${claudeDir}/` : '~/.claude/')
    : './.claude/';

  console.log(`  Installing to ${cyan}${locationLabel}${reset}\n`);

  // Create commands directory
  const commandsDir = path.join(claudeDir, 'commands');
  fs.mkdirSync(commandsDir, { recursive: true });

  // Copy commands/wtfp with path replacement
  const wtfpSrc = path.join(src, 'commands', 'wtfp');
  const wtfpDest = path.join(commandsDir, 'wtfp');
  copyWithPathReplacement(wtfpSrc, wtfpDest, pathPrefix);
  console.log(`  ${green}✓${reset} Installed commands/wtfp`);

  // Copy write-the-f-paper skill with path replacement
  const skillSrc = path.join(src, 'write-the-f-paper');
  const skillDest = path.join(claudeDir, 'write-the-f-paper');
  copyWithPathReplacement(skillSrc, skillDest, pathPrefix);
  console.log(`  ${green}✓${reset} Installed write-the-f-paper`);

  console.log(`
  ${green}Done!${reset} Run ${cyan}/wtfp:help${reset} in Claude Code to get started.

  ${yellow}Quick Start:${reset}
    ${cyan}/wtfp:new-paper${reset}      Start a new academic paper
    ${cyan}/wtfp:progress${reset}       Check your writing status
    ${cyan}/wtfp:help${reset}           Show all commands
`);
}

/**
 * Prompt for install location
 */
function promptLocation() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const configDir = expandTilde(explicitConfigDir) || expandTilde(process.env.CLAUDE_CONFIG_DIR);
  const globalPath = configDir || path.join(os.homedir(), '.claude');
  const globalLabel = globalPath.replace(os.homedir(), '~');

  console.log(`  ${yellow}Where would you like to install?${reset}

  ${cyan}1${reset}) Global ${dim}(${globalLabel})${reset} - available in all projects
  ${cyan}2${reset}) Local  ${dim}(./.claude)${reset} - this project only
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    rl.close();
    const choice = answer.trim() || '1';
    const isGlobal = choice !== '2';
    install(isGlobal);
  });
}

// Main
if (hasGlobal && hasLocal) {
  console.error(`  ${yellow}Cannot specify both --global and --local${reset}`);
  process.exit(1);
} else if (explicitConfigDir && hasLocal) {
  console.error(`  ${yellow}Cannot use --config-dir with --local${reset}`);
  process.exit(1);
} else if (hasGlobal) {
  install(true);
} else if (hasLocal) {
  install(false);
} else {
  promptLocation();
}
