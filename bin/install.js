#!/usr/bin/env node

const path = require('path');
const {
  createOutput,
  createRL,
  prompt,
} = require('./lib/utils');

// Get version from package.json
const pkg = require('../package.json');

// Command modules
const showStatus = require('./commands/status');
const runDoctor = require('./commands/doctor');
const runUpdate = require('./commands/update');
const install = require('./commands/install-logic');
const showList = require('./commands/list');

// ============ Argument Parsing ============ 

const args = process.argv.slice(2);

// Detect subcommand
const subcommands = ['status', 'doctor', 'update'];
const subcommand = args.find(arg => !arg.startsWith('-') && subcommands.includes(arg));
const subcommandIndex = args.indexOf(subcommand);
if (subcommandIndex !== -1) {
  args.splice(subcommandIndex, 1);
}

// Parse flags
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');
const hasForce = args.includes('--force') || args.includes('-f');
const hasBackupAll = args.includes('--backup-all') || args.includes('-b');
const hasHelp = args.includes('--help') || args.includes('-h');
const hasVersion = args.includes('--version') || args.includes('-v');
const hasList = args.includes('--list');
const hasNoColor = args.includes('--no-color');
const hasQuiet = args.includes('--quiet') || args.includes('-q');
const hasVerbose = args.includes('--verbose');
const hasBeginner = args.includes('--beginner');
const hasAdvanced = args.includes('--advanced');

function parseConfigDirArg() {
  const configDirIndex = args.findIndex(arg => arg === '--config-dir' || arg === '-c');
  if (configDirIndex !== -1) {
    const nextArg = args[configDirIndex + 1];
    if (nextArg && !nextArg.startsWith('-')) return nextArg;
  }
  const configDirArg = args.find(arg => arg.startsWith('--config-dir=') || arg.startsWith('-c='));
  if (configDirArg) return configDirArg.split('=')[1];
  return null;
}

function parseOnlyArg() {
  const onlyArg = args.find(arg => arg.startsWith('--only='));
  if (onlyArg) return onlyArg.split('=')[1];
  return 'all';
}

const options = {
  explicitConfigDir: parseConfigDirArg(),
  onlyInstall: parseOnlyArg(),
  hasGlobal,
  hasLocal,
  hasForce,
  hasBackupAll,
  hasQuiet,
  hasVerbose,
  hasBeginner,
  hasAdvanced,
  isInteractive: process.stdout.isTTY && process.stdin.isTTY && !hasQuiet && !hasAdvanced,
};
options.showExplanations = options.hasBeginner || (options.isInteractive && !options.hasAdvanced);

const useColors = !hasNoColor && (process.stdout.isTTY || process.env.FORCE_COLOR);
const out = createOutput({ quiet: hasQuiet, verbose: hasVerbose, useColors });
options.out = out;

// ============ Banner ============ 

const banner = `
${out.colors.magenta('██╗    ██╗████████╗███████╗      ██████╗')}
${out.colors.magenta('██║    ██║╚══██╔══╝██╔════╝      ██╔══██╗')}
${out.colors.magenta('██║ █╗ ██║   ██║   █████╗  █████╗██████╔╝')}
${out.colors.magenta('██║███╗██║   ██║   ██╔══╝  ╚════╝██╔═══╝')}
${out.colors.magenta('╚███╔███╔╝   ██║   ██║           ██║')}
${out.colors.magenta(' ╚══╝╚══╝    ╚═╝   ╚═╝           ╚═╝')}

  ${out.colors.cyan('Write The F***ing Paper')} ${out.colors.dim(`v${pkg.version}`)}
  Context engineering for academic writing.
`;

// ============ Help Text ============ 

function showHelp() {
  const c = out.colors;
  console.log(banner);
  console.log(`  ${c.yellow('Usage:')} npx wtf-p [command] [options] 

  ${c.yellow('Commands:')}
    ${c.cyan('status')}                    Show current installation state
    ${c.cyan('doctor')}                    Diagnose installation issues
    ${c.cyan('update')}                    Update existing installation

  ${c.yellow('Install Options:')}
    ${c.cyan('-g, --global')}              Install globally (to Claude config directory)
    ${c.cyan('-l, --local')}               Install locally (to ./.claude in current directory)
    ${c.cyan('-c, --config-dir <path>')}   Specify custom Claude config directory
    ${c.cyan('-f, --force')}               Overwrite all existing files without prompting
    ${c.cyan('-b, --backup-all')}          Backup all existing files before overwriting
    ${c.cyan('--only=<type>')}             Install only: commands, workflows, or all

  ${c.yellow('Output Options:')}
    ${c.cyan('--beginner')}                Show detailed explanations
    ${c.cyan('--advanced')}                Minimal output, skip confirmations
    ${c.cyan('--no-color')}                Disable colored output
    ${c.cyan('-q, --quiet')}               Suppress non-essential output
    ${c.cyan('--verbose')}                 Show detailed progress

  ${c.yellow('Other:')}
    ${c.cyan('-v, --version')}             Show version information
    ${c.cyan('-h, --help')}                Show this help message

  ${c.yellow('Examples:')}
    ${c.dim('# Interactive install with prompts')}
    npx wtf-p

    ${c.dim('# Quick global install')}
    npx wtf-p --global --advanced

  ${c.yellow('After installation:')}
    Run ${c.cyan('/wtfp:help')} in Claude Code to get started.
`);
}

// ============ Main ============ 

async function main() {
  if (hasVersion) {
    console.log(`wtf-p v${pkg.version}`);
    return;
  }

  if (hasHelp) {
    showHelp();
    return;
  }

  // Handle --list
  if (hasList) {
    if (!hasQuiet) console.log(banner);
    showList(options);
    return;
  }

  if (subcommand === 'status') {
    if (!hasQuiet) console.log(banner);
    await showStatus(options, pkg);
    return;
  }

  if (subcommand === 'doctor') {
    if (!hasQuiet) console.log(banner);
    await runDoctor(options);
    return;
  }

  if (subcommand === 'update') {
    if (!hasQuiet) console.log(banner);
    await runUpdate(options, pkg, install);
    return;
  }

  // Default: Install
  if (!hasQuiet) console.log(banner);

  if (hasGlobal) {
    await install(true, false, options, pkg);
  } else if (hasLocal) {
    await install(false, false, options, pkg);
  } else if (options.isInteractive) {
    const rl = createRL();
    out.log(`  ${out.colors.yellow('Where would you like to install?')} 
`);
    out.log(`  ${out.colors.cyan('1)')} Global (~/.claude) - available in all projects`);
    out.log(`  ${out.colors.cyan('2)')} Local  (./.claude) - this project only
`);
    
    const answer = await prompt(rl, `  Choice ${out.colors.dim('[1]')}: `);
    rl.close();
    
    const choice = answer || '1';
    await install(choice !== '2', false, options, pkg);
  } else {
    await install(true, false, options, pkg);
  }
}

main().catch(err => {
  out.error(err.message);
  if (hasVerbose) console.error(err.stack);
  process.exit(1);
});