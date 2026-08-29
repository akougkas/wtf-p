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
const { createTargetGuard, isSameOrAncestor } = require('./lib/ownership');

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
let configDirParseError = null;

function parseConfigDirArg() {
  const configDirIndex = args.findIndex(arg => arg === '--config-dir' || arg === '-c');
  if (configDirIndex !== -1) {
    const nextArg = args[configDirIndex + 1];
    if (nextArg && !nextArg.startsWith('-')) return nextArg;
    configDirParseError = '--config-dir requires a non-empty path argument';
    return null;
  }
  const configDirArg = args.find(arg => arg.startsWith('--config-dir=') || arg.startsWith('-c='));
  if (configDirArg) {
    const value = configDirArg.slice(configDirArg.indexOf('=') + 1);
    if (value) return value;
    configDirParseError = '--config-dir requires a non-empty path argument';
  }
  return null;
}

function parseOnlyArg() {
  const onlyArg = args.find(arg => arg.startsWith('--only='));
  if (onlyArg) return onlyArg.split('=')[1];
  return 'all';
}

function validateArguments() {
  if (subcommand === 'uninstall') return;
  const booleanFlags = new Set([
    '--global', '-g', '--local', '-l', '--gemini', '--opencode', '--all',
    '--force', '-f', '--backup-all', '-b', '--help', '-h', '--version', '-v',
    '--list', '--no-color', '--quiet', '-q', '--verbose', '--beginner', '--advanced'
  ]);
  const validOnlyValues = new Set([
    'all', 'commands', 'workflows', 'skills', 'agents', 'mcp', 'scripts', 'plugin'
  ]);
  let configCount = 0;
  let onlyCount = 0;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--config-dir' || argument === '-c') {
      configCount++;
      index++;
      if (index >= args.length || !args[index] || args[index].startsWith('-')) {
        throw new Error('--config-dir requires a non-empty path argument');
      }
      continue;
    }
    if (argument.startsWith('--config-dir=') || argument.startsWith('-c=')) {
      configCount++;
      if (!argument.slice(argument.indexOf('=') + 1)) {
        throw new Error('--config-dir requires a non-empty path argument');
      }
      continue;
    }
    if (argument.startsWith('--only=')) {
      onlyCount++;
      const value = argument.slice('--only='.length);
      if (!validOnlyValues.has(value)) {
        throw new Error(`Unknown --only component: ${value || '(empty)'}`);
      }
      continue;
    }
    if (argument === '--only') {
      throw new Error('--only must use the form --only=<component>');
    }
    if (!booleanFlags.has(argument)) throw new Error(`Unknown command or argument: ${argument}`);
  }

  if (configCount > 1) throw new Error('--config-dir may only be provided once');
  if (onlyCount > 1) throw new Error('--only may only be provided once');
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
  validateArguments();
  if (configDirParseError) {
    throw new Error(configDirParseError);
  }

  if (hasGlobal && hasLocal) {
    throw new Error('Choose either --global or --local, not both');
  }
  if (hasGlobal && (hasGemini || hasOpenCode || hasAll)) {
    throw new Error('--global selects Claude and cannot be combined with another target');
  }
  if (hasLocal && (hasGemini || hasOpenCode || hasAll)) {
    throw new Error('--local currently requires the Claude target');
  }
  if (hasGemini && hasOpenCode) {
    throw new Error('Choose one target, or use --all');
  }
  if (hasAll && (hasGemini || hasOpenCode)) {
    throw new Error('--all cannot be combined with another target selector');
  }
  if (hasAll && options.explicitConfigDir) {
    throw new Error('--all cannot share one --config-dir across incompatible clients');
  }

  if (hasVersion) {
    console.log(`wtf-p v${pkg.version}`);
    return;
  }

  async function installAllTargets() {
    const targets = ['claude', 'gemini', 'opencode'].map(runtime => ({
      runtime,
      guard: createTargetGuard(install.getVendorDir(runtime, null))
    }));
    for (let left = 0; left < targets.length; left++) {
      for (let right = left + 1; right < targets.length; right++) {
        const leftPath = targets[left].guard.path;
        const rightPath = targets[right].guard.path;
        if (isSameOrAncestor(leftPath, rightPath) || isSameOrAncestor(rightPath, leftPath)) {
          throw new Error(`All-target install roots overlap (${leftPath} and ${rightPath}); configure distinct client roots before installing`);
        }
      }
    }
    for (const target of targets) {
      await install(target.runtime, false, { ...options, targetGuard: target.guard }, pkg);
    }
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
    await installAllTargets();
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
      await installAllTargets();
    } else if (choice === '3') {
      await install('opencode', false, options, pkg);
    } else if (choice === '2') {
      await install('gemini', false, options, pkg);
    } else {
      await install('claude', false, options, pkg);
    }
  } else {
    throw new Error('Noninteractive installation requires an explicit target or scope. Use --local, --global, --gemini, --opencode, or --all.');
  }
}

if (require.main === module) {
  main().catch(err => {
    out.error(err.message);
    if (hasVerbose) console.error(err.stack);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  options,
  showHelp,
  validateArguments
};
