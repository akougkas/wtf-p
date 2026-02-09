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
const MANIFEST = require('./lib/manifest');

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
const hasClaude = args.includes('--claude');
const hasGemini = args.includes('--gemini');
const hasOpenCode = args.includes('--opencode');
const hasAll = args.includes('--all');
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
  console.log(`  ${c.yellow('Usage:')} npx wtf-p uninstall [options]

  ${c.yellow('Options:')}
    ${c.cyan('-g, --global')}              Uninstall from home directory
    ${c.cyan('-l, --local')}               Uninstall from current project
    ${c.cyan('--claude')}                  Uninstall from Claude Code
    ${c.cyan('--gemini')}                  Uninstall from Gemini CLI
    ${c.cyan('--opencode')}                Uninstall from OpenCode
    ${c.cyan('--all')}                     Uninstall from all tools
    ${c.cyan('-c, --config-dir <path>')}   Uninstall from a custom directory
    ${c.cyan('-f, --force')}               Skip confirmation prompts
    ${c.cyan('-b, --backup')}              Backup files before removing
    ${c.cyan('-n, --dry-run')}             Preview what would be removed
    ${c.cyan('--clean-backups')}           Also remove backup files from prior installs
    ${c.cyan('--no-color')}                Disable colored output
    ${c.cyan('-q, --quiet')}               Suppress non-essential output
    ${c.cyan('-h, --help')}                Show this help

  ${c.yellow('What gets removed:')}
    ${c.dim('commands/wtfp/')}         Slash commands (/wtfp:*)
    ${c.dim('write-the-f-paper/')}     Writing system files
    ${c.dim('agents/wtfp/')}           Agent definitions
    ${c.dim('skills/wtfp/')}           Skill definitions
    ${c.dim('.claude-plugin/')}        Plugin manifest
    ${c.dim('.wtfp-version')}          Version tracking file

  ${c.yellow('What stays intact:')}
    ${c.dim('CLAUDE.md')}               Your personal instructions (never touched)
    ${c.dim('commands/')}               Other slash commands you added
    ${c.dim('settings.json')}           Your tool settings
    ${c.dim('Everything else')}         Nothing outside WTF-P is modified

  ${c.yellow('Examples:')}
    ${c.dim('# Preview what would be removed')}
    npx wtf-p uninstall --global --dry-run

    ${c.dim('# Backup then remove')}
    npx wtf-p uninstall --global --backup

    ${c.dim('# Remove from all tools at once')}
    npx wtf-p uninstall --all

    ${c.dim('# Also clean up leftover backup files')}
    npx wtf-p uninstall --global --clean-backups
`);
  process.exit(0);
}

// ============ Utilities ============

/**
 * Get vendor-specific config directory
 */
function getVendorDir(runtime, explicitConfigDir) {
  // Handle 'claude-local' special case
  if (runtime === 'claude-local') {
    return path.join(process.cwd(), '.claude');
  }

  const vendorConfig = MANIFEST[runtime];
  if (!vendorConfig) {
    return null;
  }

  if (explicitConfigDir) {
    return expandTilde(explicitConfigDir);
  }

  const envDir = process.env[vendorConfig.configDirEnv];
  if (envDir) {
    return expandTilde(envDir);
  }

  return path.join(os.homedir(), vendorConfig.defaultDir);
}

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
 * Uninstall from the specified runtime
 * @param {string} runtime - 'claude' | 'gemini' | 'opencode' | 'claude-local'
 */
async function uninstall(runtime) {
  const isLocal = runtime === 'claude-local';
  const vendorKey = isLocal ? 'claude' : runtime;
  const vendorConfig = MANIFEST[vendorKey];

  if (!vendorConfig) {
    out.error(`Unknown runtime: ${runtime}`);
    return;
  }

  const targetDir = getVendorDir(runtime, explicitConfigDir);
  const locationLabel = getPathLabel(targetDir, !isLocal);

  out.log(`  Checking ${c.cyan(locationLabel)} for WTF-P installation...\n`);

  // Detect installation
  const installed = detectInstallation(targetDir);
  const totalFiles = installed.commandFiles.length + installed.workflowFiles.length + installed.skillFiles.length
    + (installed.agentFiles || []).length + (installed.mcpFiles || []).length + (installed.binFiles || []).length;

  if (!installed.hasCommands && !installed.hasWorkflows && !installed.hasSkills) {
    out.log(`  ${c.yellow('No WTF-P installation found in ' + locationLabel)}\n`);

    // Check for backups if requested
    if (hasCleanBackups) {
      const backups = findBackupFiles(targetDir);
      if (backups.length > 0) {
        out.log(`  Found ${backups.length} backup file(s)/folder(s) to clean:\n`);
        for (const b of backups.slice(0, 10)) {
          out.log(`    ${c.dim(b.replace(targetDir, '.'))}`);
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
            out.log(`  ${c.red('-')} ${c.dim(b.replace(targetDir, '.'))}`);
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

  const commandsDir = path.join(targetDir, 'commands', 'wtfp');
  const workflowsDir = path.join(targetDir, 'write-the-f-paper');
  const skillsDir = path.join(targetDir, 'skills', 'wtfp');
  const agentsDir = path.join(targetDir, 'agents', 'wtfp');
  const mcpDir = path.join(targetDir, 'mcp');
  const binDir = path.join(targetDir, 'bin');
  const pluginDir = path.join(targetDir, '.claude-plugin');
  const wtfpPluginFile = path.join(pluginDir, 'plugin.json');

  if (installed.hasCommands) {
    out.log(`    ${c.cyan('commands/wtfp/')} (${installed.commandFiles.length} files)`);
  }
  if (installed.hasWorkflows) {
    out.log(`    ${c.cyan('write-the-f-paper/')} (${installed.workflowFiles.length} files)`);
  }
  if (installed.hasSkills) {
    out.log(`    ${c.cyan('skills/wtfp/')} (${installed.skillFiles.length} files)`);
  }
  if (fs.existsSync(agentsDir)) {
    out.log(`    ${c.cyan('agents/wtfp/')} (agent definitions)`);
  }
  if (fs.existsSync(mcpDir)) {
    out.log(`    ${c.cyan('mcp/')} (MCP server)`);
  }
  if (fs.existsSync(binDir)) {
    out.log(`    ${c.cyan('bin/')} (scripts)`);
  }
  if (fs.existsSync(wtfpPluginFile)) {
    out.log(`    ${c.cyan('.claude-plugin/plugin.json')} (WTF-P plugin manifest)`);
  }
  if (installed.version) {
    out.log(`    ${c.cyan(VERSION_FILE)} (version tracking)`);
  }
  out.log('');

  // Check for backups to clean
  let backups = [];
  if (hasCleanBackups) {
    const allBackups = findBackupFiles(targetDir);
    backups = allBackups.filter(b => {
      if (installed.hasCommands && b.startsWith(commandsDir)) return false;
      if (installed.hasSkills && b.startsWith(skillsDir)) return false;
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
    const backupDirPath = getBackupDir(targetDir);
    fs.mkdirSync(backupDirPath, { recursive: true });

    if (installed.hasCommands) {
      copyDir(commandsDir, path.join(backupDirPath, 'commands', 'wtfp'));
    }
    if (installed.hasWorkflows) {
      copyDir(workflowsDir, path.join(backupDirPath, 'write-the-f-paper'));
    }
    if (installed.hasSkills) {
      copyDir(skillsDir, path.join(backupDirPath, 'skills', 'wtfp'));
    }
    if (fs.existsSync(agentsDir)) {
      copyDir(agentsDir, path.join(backupDirPath, 'agents', 'wtfp'));
    }
    if (fs.existsSync(mcpDir)) {
      copyDir(mcpDir, path.join(backupDirPath, 'mcp'));
    }
    if (fs.existsSync(binDir)) {
      copyDir(binDir, path.join(backupDirPath, 'bin'));
    }
    if (fs.existsSync(wtfpPluginFile)) {
      fs.mkdirSync(path.join(backupDirPath, '.claude-plugin'), { recursive: true });
      fs.copyFileSync(wtfpPluginFile, path.join(backupDirPath, '.claude-plugin', 'plugin.json'));
    }

    const backupLabel = backupDirPath.replace(os.homedir(), '~').replace(process.cwd(), '.');
    out.log(`  ${c.cyan('↻')} Backed up to ${c.dim(backupLabel)}\n`);
  }

  // Remove directories — only WTF-P subdirectories, never parent dirs with user content

  // Helper: remove a wtfp subdir and clean up empty parent
  function removeWtfpSubdir(subdir, parentDir, label) {
    if (!fs.existsSync(subdir)) return;
    removeDir(subdir);
    out.log(`  ${c.red('-')} ${c.dim(label)}`);

    // Clean up parent only if empty (no user content remains)
    if (parentDir && fs.existsSync(parentDir)) {
      try {
        const remaining = fs.readdirSync(parentDir);
        if (remaining.length === 0) {
          fs.rmdirSync(parentDir);
          out.log(`  ${c.red('-')} ${c.dim(path.basename(parentDir) + '/')} ${c.dim('(empty)')}`);
        }
      } catch { /* ignore */ }
    }
  }

  if (installed.hasCommands) {
    removeWtfpSubdir(commandsDir, path.join(targetDir, 'commands'), 'commands/wtfp/');
  }

  if (installed.hasWorkflows) {
    removeDir(workflowsDir);
    out.log(`  ${c.red('-')} ${c.dim('write-the-f-paper/')}`);
  }

  if (installed.hasSkills) {
    removeWtfpSubdir(skillsDir, path.join(targetDir, 'skills'), 'skills/wtfp/');
  }

  // Remove agents/wtfp/ (added in v0.5.0)
  if (fs.existsSync(agentsDir)) {
    removeWtfpSubdir(agentsDir, path.join(targetDir, 'agents'), 'agents/wtfp/');
  }

  // Remove mcp/ (WTF-P research server)
  if (fs.existsSync(mcpDir)) {
    removeDir(mcpDir);
    out.log(`  ${c.red('-')} ${c.dim('mcp/')}`);
  }

  // Remove bin/ (WTF-P scripts installed to config dir)
  if (fs.existsSync(binDir)) {
    removeDir(binDir);
    out.log(`  ${c.red('-')} ${c.dim('bin/')}`);
  }

  // Remove only WTF-P's plugin.json, not the entire .claude-plugin/ dir
  // (user may have their own plugin configs there)
  if (fs.existsSync(wtfpPluginFile)) {
    try {
      const pluginData = JSON.parse(fs.readFileSync(wtfpPluginFile, 'utf8'));
      if (pluginData.name === 'wtf-p' || pluginData.name === 'write-the-f-paper') {
        fs.unlinkSync(wtfpPluginFile);
        out.log(`  ${c.red('-')} ${c.dim('.claude-plugin/plugin.json')}`);

        // Only remove .claude-plugin/ if empty after our file is gone
        try {
          const remaining = fs.readdirSync(pluginDir);
          if (remaining.length === 0) {
            fs.rmdirSync(pluginDir);
            out.log(`  ${c.red('-')} ${c.dim('.claude-plugin/')} ${c.dim('(empty)')}`);
          }
        } catch { /* ignore */ }
      }
    } catch {
      // Can't parse plugin.json — leave it alone for safety
    }
  }

  // Remove version file
  const versionFile = path.join(targetDir, VERSION_FILE);
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
  ${c.green('Done!')} WTF-P has been removed from ${vendorConfig.name}.

  ${c.dim('Your personal config files were not touched.')}

  To reinstall later: ${c.cyan('npx wtf-p')}
`);
}

/**
 * Prompt for uninstall location - shows all runtimes with installation status
 */
async function promptLocation() {
  const rl = createRL();

  // Check installations for all runtimes
  const runtimes = Object.keys(MANIFEST);
  const installations = {};
  let anyInstalled = false;

  for (const runtime of runtimes) {
    const targetDir = getVendorDir(runtime, null);
    const installed = detectInstallation(targetDir);
    const hasInstall = installed.hasCommands || installed.hasWorkflows || installed.hasSkills;
    const count = installed.commandFiles.length + installed.workflowFiles.length + installed.skillFiles.length;
    installations[runtime] = { installed, hasInstall, count, targetDir };
    if (hasInstall) anyInstalled = true;
  }

  // Also check local .claude
  const localPath = path.join(process.cwd(), '.claude');
  const localInstalled = detectInstallation(localPath);
  const hasLocalInstall = localInstalled.hasCommands || localInstalled.hasWorkflows || localInstalled.hasSkills;
  const localCount = localInstalled.commandFiles.length + localInstalled.workflowFiles.length + localInstalled.skillFiles.length;
  if (hasLocalInstall) anyInstalled = true;

  if (!anyInstalled) {
    out.log(`  ${c.yellow('No WTF-P installation found.')}\n`);
    out.log(`  Checked:`);
    for (const runtime of runtimes) {
      const label = getPathLabel(installations[runtime].targetDir, true);
      out.log(`    ${c.dim(label)}`);
    }
    out.log(`    ${c.dim('./.claude')}\n`);
    rl.close();
    return;
  }

  out.log(`  ${c.yellow('Where would you like to uninstall from?')}\n`);

  let optionNum = 1;
  const options = [];

  // Show runtime options
  for (const runtime of runtimes) {
    const { hasInstall, count, targetDir } = installations[runtime];
    const label = getPathLabel(targetDir, true);
    const vendorName = MANIFEST[runtime].name;

    if (hasInstall) {
      out.log(`  ${c.cyan(optionNum + ')')} ${vendorName} ${c.dim('(' + label + ')')} - ${count} files`);
      options.push({ num: optionNum, runtime });
    } else {
      out.log(`  ${c.dim(optionNum + ') ' + vendorName + ' (' + label + ') - not installed')}`);
    }
    optionNum++;
  }

  // Show local option
  if (hasLocalInstall) {
    out.log(`  ${c.cyan(optionNum + ')')} Local ${c.dim('(./.claude)')} - ${localCount} files`);
    options.push({ num: optionNum, runtime: 'claude-local' });
  } else {
    out.log(`  ${c.dim(optionNum + ') Local (./.claude) - not installed')}`);
  }
  optionNum++;

  // Show "all" option if multiple installations
  const installedCount = options.length;
  if (installedCount > 1) {
    out.log(`  ${c.cyan(optionNum + ')')} All installed runtimes`);
    options.push({ num: optionNum, runtime: 'all-installed' });
  }

  out.log('');

  const answer = await prompt(rl, `  Choice: `);
  rl.close();

  const selected = options.find(o => o.num === parseInt(answer, 10));

  if (!selected) {
    out.log(`\n  ${c.yellow('Invalid choice or no installation at that location.')}\n`);
    return;
  }

  if (selected.runtime === 'all-installed') {
    // Uninstall from all installed runtimes
    for (const opt of options) {
      if (opt.runtime !== 'all-installed') {
        await uninstall(opt.runtime);
      }
    }
  } else {
    await uninstall(selected.runtime);
  }
}

// ============ Main ============

async function main() {
  // Validate conflicting flags
  const runtimeFlags = [hasGlobal, hasLocal, hasClaude, hasGemini, hasOpenCode, hasAll].filter(Boolean).length;
  if (runtimeFlags > 1 && !hasAll) {
    out.error('Pick one tool at a time, or use --all to uninstall from everything');
    process.exit(1);
  }
  if (explicitConfigDir && hasLocal) {
    out.error('Cannot use --config-dir with --local');
    process.exit(1);
  }

  // Handle --all first
  if (hasAll) {
    for (const runtime of Object.keys(MANIFEST)) {
      await uninstall(runtime);
    }
    return;
  }

  // Handle specific runtime flags
  if (hasClaude || hasGlobal) {
    await uninstall('claude');
  } else if (hasGemini) {
    await uninstall('gemini');
  } else if (hasOpenCode) {
    await uninstall('opencode');
  } else if (hasLocal) {
    await uninstall('claude-local');
  } else {
    // Interactive mode
    await promptLocation();
  }
}

main().catch(err => {
  out.error(err.message);
  process.exit(1);
});
