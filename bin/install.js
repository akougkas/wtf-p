#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  expandTilde,
  normalizePath,
  isValidPath,
  getClaudeDir,
  getPathLabel,
  readInstalledVersion,
  writeVersionFile,
  detectInstallation,
  collectFiles,
  createColors,
  createOutput,
  createRL,
  prompt,
  getBackupPath
} = require('./lib/utils');

// Get version from package.json
const pkg = require('../package.json');

// ============ Argument Parsing ============

const args = process.argv.slice(2);

// Detect subcommand (first non-flag argument)
const subcommand = args.find(arg => !arg.startsWith('-') && ['status', 'doctor', 'update'].includes(arg));
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

// Parse --only argument
function parseOnlyArg() {
  const onlyArg = args.find(arg => arg.startsWith('--only='));
  if (onlyArg) {
    const value = onlyArg.split('=')[1];
    if (!['commands', 'workflows', 'all'].includes(value)) {
      console.error('  --only must be: commands, workflows, or all');
      process.exit(1);
    }
    return value;
  }
  return 'all';
}

const explicitConfigDir = parseConfigDirArg();
const onlyInstall = parseOnlyArg();

// Determine if interactive mode (TTY + not quiet/advanced)
const isTTY = process.stdout.isTTY && process.stdin.isTTY;
const isInteractive = isTTY && !hasQuiet && !hasAdvanced;
const showExplanations = hasBeginner || (isInteractive && !hasAdvanced);

// Setup output helpers
const useColors = !hasNoColor && (isTTY || process.env.FORCE_COLOR);
const out = createOutput({ quiet: hasQuiet, verbose: hasVerbose, useColors });
const c = out.colors;

// ============ Banner ============

const banner = `
${c.magenta('██╗    ██╗████████╗███████╗      ██████╗')}
${c.magenta('██║    ██║╚══██╔══╝██╔════╝      ██╔══██╗')}
${c.magenta('██║ █╗ ██║   ██║   █████╗  █████╗██████╔╝')}
${c.magenta('██║███╗██║   ██║   ██╔══╝  ╚════╝██╔═══╝')}
${c.magenta('╚███╔███╔╝   ██║   ██║           ██║')}
${c.magenta(' ╚══╝╚══╝    ╚═╝   ╚═╝           ╚═╝')}

  ${c.cyan('Write The F***ing Paper')} ${c.dim(`v${pkg.version}`)}
  Context engineering for academic writing.
`;

// ============ Help Text ============

function showHelp() {
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
    ${c.cyan('--list')}                    Preview what would be installed
    ${c.cyan('-v, --version')}             Show version information
    ${c.cyan('-h, --help')}                Show this help message

  ${c.yellow('Examples:')}
    ${c.dim('# Interactive install with prompts')}
    npx wtf-p

    ${c.dim('# Quick global install')}
    npx wtf-p --global --advanced

    ${c.dim('# Install only commands')}
    npx wtf-p --global --only=commands

    ${c.dim('# Check installation status')}
    npx wtf-p status

    ${c.dim('# Diagnose issues')}
    npx wtf-p doctor

  ${c.yellow('After installation:')}
    Run ${c.cyan('/wtfp:help')} in Claude Code to get started.
`);
}

// ============ Version Info ============

async function showVersion() {
  console.log(`wtf-p v${pkg.version}`);

  // Check for updates (non-blocking)
  try {
    const { execSync } = require('child_process');
    const latest = execSync('npm view wtf-p version 2>/dev/null', { encoding: 'utf8' }).trim();
    if (latest && latest !== pkg.version) {
      console.log(`${c.yellow('Update available:')} ${pkg.version} → ${c.green(latest)}`);
      console.log(`Run: ${c.cyan('npx wtf-p update')}`);
    }
  } catch {
    // Ignore - can't check npm
  }
}

// ============ Status Command ============

async function showStatus() {
  if (!hasQuiet) console.log(banner);

  const locations = [];

  // Check global
  const globalDir = getClaudeDir(explicitConfigDir, true);
  const globalDetection = detectInstallation(globalDir);
  locations.push({
    label: 'Global',
    path: globalDir,
    pathLabel: getPathLabel(globalDir, true),
    ...globalDetection
  });

  // Check local if different
  const localDir = getClaudeDir(null, false);
  if (localDir !== globalDir) {
    const localDetection = detectInstallation(localDir);
    locations.push({
      label: 'Local',
      path: localDir,
      pathLabel: getPathLabel(localDir, false),
      ...localDetection
    });
  }

  out.log(`  ${c.yellow('WTF-P Installation Status')}\n`);

  for (const loc of locations) {
    const installed = loc.hasCommands || loc.hasSkill;

    out.log(`  ${c.cyan(loc.label)} ${c.dim(`(${loc.pathLabel})`)}`);

    if (!installed) {
      out.log(`    ${c.dim('Not installed')}\n`);
      continue;
    }

    // Version
    if (loc.version) {
      const versionLabel = loc.version === 'legacy' ? 'legacy (pre-0.2.0)' : loc.version;
      out.log(`    Version: ${c.green(versionLabel)}`);
    }

    // Components
    const components = [];
    if (loc.hasCommands) components.push(`commands (${loc.commandFiles.length} files)`);
    if (loc.hasSkill) components.push(`workflows (${loc.skillFiles.length} files)`);
    out.log(`    Installed: ${components.join(', ')}`);

    // Warnings
    if (loc.partial) {
      out.log(`    ${c.yellow('⚠ Partial installation detected')}`);
    }
    if (loc.corrupt) {
      out.log(`    ${c.red('⚠ Corrupt version file')}`);
    }

    out.log('');
  }

  // Check for updates
  try {
    const { execSync } = require('child_process');
    const latest = execSync('npm view wtf-p version 2>/dev/null', { encoding: 'utf8' }).trim();
    if (latest && latest !== pkg.version) {
      out.log(`  ${c.yellow('Update available:')} ${pkg.version} → ${c.green(latest)}`);
      out.log(`  Run: ${c.cyan('npx wtf-p update --global')}\n`);
    }
  } catch {
    // Ignore
  }
}

// ============ Doctor Command ============

async function runDoctor() {
  if (!hasQuiet) console.log(banner);

  out.log(`  ${c.yellow('WTF-P Installation Doctor')}\n`);

  const issues = [];
  const checks = [];

  // Check 1: Node.js version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  if (nodeMajor < 16) {
    issues.push(`Node.js ${nodeVersion} is below minimum (16.7.0)`);
    checks.push({ name: 'Node.js version', status: 'fail', detail: nodeVersion });
  } else {
    checks.push({ name: 'Node.js version', status: 'pass', detail: nodeVersion });
  }

  // Check 2: Claude directory exists
  const globalDir = getClaudeDir(explicitConfigDir, true);
  if (fs.existsSync(globalDir)) {
    checks.push({ name: 'Claude config directory', status: 'pass', detail: getPathLabel(globalDir, true) });
  } else {
    checks.push({ name: 'Claude config directory', status: 'warn', detail: 'Does not exist (will be created on install)' });
  }

  // Check 3: Write permissions
  const testDir = globalDir.replace(/\.claude$/, '.claude-test-' + Date.now());
  try {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'test'), 'test');
    fs.rmSync(testDir, { recursive: true });
    checks.push({ name: 'Write permissions', status: 'pass', detail: 'Can write to config directory' });
  } catch (err) {
    issues.push(`Cannot write to ${getPathLabel(globalDir, true)}: ${err.message}`);
    checks.push({ name: 'Write permissions', status: 'fail', detail: err.message });
  }

  // Check 4: Installation state
  const detection = detectInstallation(globalDir);
  if (detection.hasCommands || detection.hasSkill) {
    if (detection.partial) {
      issues.push('Partial installation detected - some files are missing');
      checks.push({ name: 'Installation integrity', status: 'warn', detail: 'Partial install' });
    } else if (detection.corrupt) {
      issues.push('Version file is corrupt - reinstall recommended');
      checks.push({ name: 'Installation integrity', status: 'warn', detail: 'Corrupt version file' });
    } else {
      checks.push({ name: 'Installation integrity', status: 'pass', detail: `v${detection.version}` });
    }
  } else {
    checks.push({ name: 'Installation integrity', status: 'info', detail: 'Not installed' });
  }

  // Check 5: CLAUDE_CONFIG_DIR env var
  const configDirEnv = process.env.CLAUDE_CONFIG_DIR;
  if (configDirEnv) {
    const expanded = normalizePath(configDirEnv);
    if (fs.existsSync(expanded)) {
      checks.push({ name: 'CLAUDE_CONFIG_DIR', status: 'pass', detail: expanded });
    } else {
      issues.push(`CLAUDE_CONFIG_DIR points to non-existent path: ${configDirEnv}`);
      checks.push({ name: 'CLAUDE_CONFIG_DIR', status: 'warn', detail: `${configDirEnv} (does not exist)` });
    }
  } else {
    checks.push({ name: 'CLAUDE_CONFIG_DIR', status: 'info', detail: 'Not set (using default)' });
  }

  // Output results
  for (const check of checks) {
    let icon, color;
    switch (check.status) {
      case 'pass': icon = '✓'; color = c.green; break;
      case 'fail': icon = '✗'; color = c.red; break;
      case 'warn': icon = '⚠'; color = c.yellow; break;
      default: icon = 'ℹ'; color = c.cyan;
    }
    out.log(`  ${color(icon)} ${check.name}: ${c.dim(check.detail)}`);
  }

  out.log('');

  if (issues.length > 0) {
    out.log(`  ${c.yellow('Issues found:')}`);
    for (const issue of issues) {
      out.log(`    ${c.yellow('•')} ${issue}`);
    }
    out.log('');
    out.log(`  ${c.dim('Run')} ${c.cyan('npx wtf-p --global --force')} ${c.dim('to reinstall')}\n`);
  } else {
    out.log(`  ${c.green('No issues found!')}\n`);
  }
}

// ============ Update Command ============

async function runUpdate() {
  if (!hasQuiet) console.log(banner);

  out.log(`  ${c.yellow('Checking for updates...')}\n`);

  // Find installed location
  const globalDir = getClaudeDir(explicitConfigDir, true);
  const localDir = getClaudeDir(null, false);

  let targetDir = null;
  let isGlobal = true;

  const globalDetection = detectInstallation(globalDir);
  const localDetection = detectInstallation(localDir);

  if (hasGlobal || (!hasLocal && (globalDetection.hasCommands || globalDetection.hasSkill))) {
    targetDir = globalDir;
    isGlobal = true;
  } else if (hasLocal || (localDetection.hasCommands || localDetection.hasSkill)) {
    targetDir = localDir;
    isGlobal = false;
  }

  if (!targetDir) {
    out.log(`  ${c.yellow('No existing installation found.')}`);
    out.log(`  Run ${c.cyan('npx wtf-p --global')} to install.\n`);
    return;
  }

  const detection = isGlobal ? globalDetection : localDetection;
  const currentVersion = detection.version === 'legacy' ? '0.0.0' : detection.version;

  out.log(`  Current: ${c.dim(`v${currentVersion}`)} in ${c.dim(getPathLabel(targetDir, isGlobal))}`);
  out.log(`  Package: ${c.dim(`v${pkg.version}`)}`);

  if (pkg.version === currentVersion) {
    out.log(`\n  ${c.green('Already up to date!')}\n`);
    return;
  }

  out.log(`\n  ${c.cyan('Updating...')}\n`);

  // Run install with backup
  await install(isGlobal, true);
}

// ============ List Command ============

function showList() {
  if (!hasQuiet) console.log(banner);

  const src = path.join(__dirname, '..');
  const wtfpSrc = path.join(src, 'commands', 'wtfp');
  const skillSrc = path.join(src, 'write-the-f-paper');

  const files = [];

  if (onlyInstall === 'all' || onlyInstall === 'commands') {
    const commandFiles = collectFiles(wtfpSrc);
    for (const f of commandFiles) {
      files.push({ type: 'command', path: f.replace(wtfpSrc, 'commands/wtfp') });
    }
  }

  if (onlyInstall === 'all' || onlyInstall === 'workflows') {
    const skillFiles = collectFiles(skillSrc);
    for (const f of skillFiles) {
      files.push({ type: 'workflow', path: f.replace(skillSrc, 'write-the-f-paper') });
    }
  }

  out.log(`  ${c.yellow('Files to install:')}\n`);

  const commands = files.filter(f => f.type === 'command');
  const workflows = files.filter(f => f.type === 'workflow');

  if (commands.length > 0) {
    out.log(`  ${c.cyan('Commands')} (${commands.length} files):`);
    for (const f of commands.slice(0, 10)) {
      out.log(`    ${c.dim(f.path)}`);
    }
    if (commands.length > 10) {
      out.log(`    ${c.dim(`... and ${commands.length - 10} more`)}`);
    }
    out.log('');
  }

  if (workflows.length > 0) {
    out.log(`  ${c.cyan('Workflows')} (${workflows.length} files):`);
    for (const f of workflows.slice(0, 10)) {
      out.log(`    ${c.dim(f.path)}`);
    }
    if (workflows.length > 10) {
      out.log(`    ${c.dim(`... and ${workflows.length - 10} more`)}`);
    }
    out.log('');
  }

  out.log(`  Total: ${files.length} files\n`);
}

// ============ Installation ============

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
function collectInstallFiles(srcDir, destDir, pathPrefix, files = []) {
  if (!fs.existsSync(srcDir)) return files;

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      collectInstallFiles(srcPath, destPath, pathPrefix, files);
    } else {
      files.push({ src: srcPath, dest: destPath, name: entry.name });
    }
  }

  return files;
}

/**
 * Install files with conflict resolution
 */
async function installWithConflictResolution(files, pathPrefix, claudeDir) {
  const rl = createRL();
  let globalChoice = null;
  const stats = { installed: 0, skipped: 0, backed: 0 };

  const existingFiles = files.filter(f => fs.existsSync(f.dest));

  if (existingFiles.length > 0 && !hasForce && !hasBackupAll && isInteractive) {
    const relPath = getPathLabel(claudeDir, true);
    out.log(`  ${c.yellow(`Found ${existingFiles.length} existing WTF-P file(s) in ${relPath}`)}\n`);

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
 * Main install function
 */
async function install(isGlobal, isUpdate = false) {
  const src = path.join(__dirname, '..');
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
    out.log(`  Installing to ${c.cyan(locationLabel)}\n`);
  }

  // Collect files based on --only flag
  const allFiles = [];

  if (onlyInstall === 'all' || onlyInstall === 'commands') {
    const wtfpSrc = path.join(src, 'commands', 'wtfp');
    const wtfpDest = path.join(claudeDir, 'commands', 'wtfp');
    collectInstallFiles(wtfpSrc, wtfpDest, pathPrefix, allFiles);
  }

  if (onlyInstall === 'all' || onlyInstall === 'workflows') {
    const skillSrc = path.join(src, 'write-the-f-paper');
    const skillDest = path.join(claudeDir, 'write-the-f-paper');
    collectInstallFiles(skillSrc, skillDest, pathPrefix, allFiles);
  }

  // Install with conflict resolution
  const stats = await installWithConflictResolution(allFiles, pathPrefix, claudeDir);

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

/**
 * Prompt for install location (interactive mode)
 */
async function promptLocation() {
  const rl = createRL();

  const globalPath = getClaudeDir(explicitConfigDir, true);
  const globalLabel = getPathLabel(globalPath, true);

  out.log(`  ${c.yellow('Where would you like to install?')}
`);

  if (showExplanations) {
    out.log(`  ${c.cyan('1)')} Global ${c.dim(`(${globalLabel})`)} - available in all projects`);
    out.log(`     ${c.dim('Recommended for most users')}`);
    out.log(`  ${c.cyan('2)')} Local  ${c.dim('(./.claude)')} - this project only`);
    out.log(`     ${c.dim('Useful for project-specific configurations')}`);
  } else {
    out.log(`  ${c.cyan('1)')} Global ${c.dim(`(${globalLabel})`)} - available in all projects`);
    out.log(`  ${c.cyan('2)')} Local  ${c.dim('(./.claude)')} - this project only`);
  }
  out.log('');

  const answer = await prompt(rl, `  Choice ${c.dim('[1]')}: `);
  rl.close();

  const choice = answer || '1';
  const isGlobal = choice !== '2';
  await install(isGlobal);
}

// ============ Main ============

async function main() {
  // Handle --version
  if (hasVersion) {
    await showVersion();
    return;
  }

  // Handle --help
  if (hasHelp) {
    showHelp();
    return;
  }

  // Handle subcommands
  if (subcommand === 'status') {
    await showStatus();
    return;
  }

  if (subcommand === 'doctor') {
    await runDoctor();
    return;
  }

  if (subcommand === 'update') {
    await runUpdate();
    return;
  }

  // Handle --list
  if (hasList) {
    showList();
    return;
  }

  // Show banner for install
  if (!hasQuiet) {
    console.log(banner);
  }

  // Validate conflicting flags
  if (hasGlobal && hasLocal) {
    out.error('Cannot specify both --global and --local');
    process.exit(1);
  }
  if (explicitConfigDir && hasLocal) {
    out.error('Cannot use --config-dir with --local');
    process.exit(1);
  }
  if (hasForce && hasBackupAll) {
    out.error('Cannot use both --force and --backup-all');
    process.exit(1);
  }
  if (hasBeginner && hasAdvanced) {
    out.error('Cannot use both --beginner and --advanced');
    process.exit(1);
  }

  // Run install
  if (hasGlobal) {
    await install(true);
  } else if (hasLocal) {
    await install(false);
  } else if (isInteractive) {
    await promptLocation();
  } else {
    // Non-interactive default: global
    await install(true);
  }
}

main().catch(err => {
  out.error(err.message);
  if (hasVerbose) {
    console.error(err.stack);
  }
  process.exit(1);
});
