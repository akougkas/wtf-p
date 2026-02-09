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
const subcommands = ['status', 'doctor', 'update', 'uninstall'];
const subcommand = args.find(arg => !arg.startsWith('-') && subcommands.includes(arg));
const subcommandIndex = args.indexOf(subcommand);
if (subcommandIndex !== -1) {
  args.splice(subcommandIndex, 1);
}

// Parse flags
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');
const hasGemini = args.includes('--gemini');
const hasOpenCode = args.includes('--opencode');
const hasAll = args.includes('--all');
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
  Academic writing commands for your AI coding assistant.
`;

// ============ Help Text ============ 

function showHelp() {
  const c = out.colors;
  console.log(banner);
  console.log(`  ${c.yellow('Usage:')} npx wtf-p [command] [options] 

  ${c.yellow('Commands:')}
    ${c.cyan('status')}                    Show installation status
    ${c.cyan('doctor')}                    Check for installation problems
    ${c.cyan('update')}                    Update to latest version
    ${c.cyan('uninstall')}                 Remove WTF-P

  ${c.yellow('Install Options:')}
    ${c.cyan('-g, --global')}              Install to your home directory (recommended)
    ${c.cyan('-l, --local')}               Install to current project only
    ${c.cyan('--gemini')}                  Install for Gemini CLI
    ${c.cyan('--opencode')}                Install for OpenCode
    ${c.cyan('--all')}                     Install for all supported tools
    ${c.cyan('-c, --config-dir <path>')}   Install to a custom directory
    ${c.cyan('-f, --force')}               Overwrite existing files without asking
    ${c.cyan('-b, --backup-all')}          Backup existing files before overwriting
    ${c.cyan('--only=<type>')}             Install only: commands, workflows, or all

  ${c.yellow('Output Options:')}
    ${c.cyan('--beginner')}                Show detailed explanations
    ${c.cyan('--advanced')}                Minimal output, skip confirmations
    ${c.cyan('--no-color')}                Disable colored output
    ${c.cyan('-q, --quiet')}               Suppress non-essential output
    ${c.cyan('--verbose')}                 Show detailed progress

  ${c.yellow('Other:')}
    ${c.cyan('-v, --version')}             Show version
    ${c.cyan('-h, --help')}                Show this help

  ${c.yellow('Examples:')}
    ${c.dim('# Install with interactive prompts')}
    npx wtf-p

    ${c.dim('# Quick global install (no prompts)')}
    npx wtf-p --global --advanced

  ${c.yellow('After installing:')}
    Open your AI assistant and run ${c.cyan('/wtfp:help')} to see all commands.
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

  if (subcommand === 'uninstall') {
    // Delegate to uninstall script with remaining args
    const { execFileSync } = require('child_process');
    const uninstallArgs = process.argv.slice(2).filter(a => a !== 'uninstall');
    try {
      execFileSync(process.execPath, [path.join(__dirname, 'uninstall.js'), ...uninstallArgs], { stdio: 'inherit' });
    } catch (e) {
      process.exit(e.status || 1);
    }
    return;
  }

  // Default: Install
  if (!hasQuiet) console.log(banner);

  if (hasAll) {
    // Install for all supported runtimes
    await install('claude', false, options, pkg);
    await install('gemini', false, options, pkg);
    await install('opencode', false, options, pkg);
  } else if (hasGemini) {
    await install('gemini', false, options, pkg);
  } else if (hasOpenCode) {
    await install('opencode', false, options, pkg);
  } else if (hasGlobal) {
    await install('claude', false, options, pkg);
  } else if (hasLocal) {
    await install('claude-local', false, options, pkg);
  } else if (options.isInteractive) {
    const rl = createRL();
    out.log(`  ${out.colors.yellow('Which tool do you use for AI-assisted coding?')}
`);
    out.log(`  ${out.colors.cyan('1)')} Claude Code ${out.colors.dim('(~/.claude)')}`);
    out.log(`  ${out.colors.cyan('2)')} Gemini CLI ${out.colors.dim('(~/.config/gemini)')}`);
    out.log(`  ${out.colors.cyan('3)')} OpenCode ${out.colors.dim('(~/.opencode)')}`);
    out.log(`  ${out.colors.cyan('4)')} All of the above
`);

    const answer = await prompt(rl, `  Choice ${out.colors.dim('[1]')}: `);
    rl.close();

    const choice = answer || '1';
    if (choice === '4') {
      await install('claude', false, options, pkg);
      await install('gemini', false, options, pkg);
      await install('opencode', false, options, pkg);
    } else if (choice === '3') {
      await install('opencode', false, options, pkg);
    } else if (choice === '2') {
      await install('gemini', false, options, pkg);
    } else {
      await install('claude', false, options, pkg);
    }
  } else {
    await install('claude', false, options, pkg);
  }
}

main().catch(err => {
  out.error(err.message);
  if (hasVerbose) console.error(err.stack);
  process.exit(1);
});