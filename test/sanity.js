#!/usr/bin/env node
/**
 * Basic sanity check for npm package
 * Verifies structure without running install
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
let failed = false;
let passed = 0;
let failedCount = 0;

console.log('=== Sanity Tests ===\n');

function check(condition, msg) {
  if (condition) {
    console.log(`\x1b[32m✓\x1b[0m ${msg}`);
    passed++;
  } else {
    console.log(`\x1b[31m✗\x1b[0m ${msg}`);
    failed = true;
    failedCount++;
  }
}

// Package structure
check(fs.existsSync(path.join(root, 'bin/install.js')), 'bin/install.js exists');
check(fs.existsSync(path.join(root, 'bin/uninstall.js')), 'bin/uninstall.js exists');
check(fs.existsSync(path.join(root, 'vendors/claude/commands')), 'vendors/claude/commands exists');
check(fs.existsSync(path.join(root, 'core/write-the-f-paper')), 'core/write-the-f-paper exists');
check(fs.existsSync(path.join(root, 'LICENSE')), 'LICENSE exists');

// Package.json fields
const pkg = require(path.join(root, 'package.json'));
check(pkg.name === 'wtf-p', 'package name is wtf-p');
check(pkg.bin && pkg.bin.wtfp, 'bin.wtfp defined');
check(pkg.bin && pkg.bin['wtf-p-uninstall'], 'bin.wtf-p-uninstall defined');
check(pkg.files && pkg.files.includes('bin'), 'files includes bin');
check(pkg.license === 'MIT', 'license is MIT');

// Mutating CLI entrypoints must only be checked in disposable child processes.
// Requiring either one in this process could modify the developer's profile if
// an import guard regresses.
const cliEntrypoints = ['install.js', 'uninstall.js'];
const probeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-sanity-'));
const probeHome = path.join(probeRoot, 'home');
const probeCwd = path.join(probeRoot, 'cwd');
const probeTmp = path.join(probeRoot, 'tmp');
fs.mkdirSync(probeCwd, { recursive: true });
fs.mkdirSync(probeTmp, { recursive: true });

const probeEnv = {
  ...process.env,
  HOME: probeHome,
  USERPROFILE: probeHome,
  XDG_CONFIG_HOME: path.join(probeRoot, 'xdg', 'config'),
  XDG_DATA_HOME: path.join(probeRoot, 'xdg', 'data'),
  XDG_STATE_HOME: path.join(probeRoot, 'xdg', 'state'),
  XDG_CACHE_HOME: path.join(probeRoot, 'xdg', 'cache'),
  CLAUDE_CONFIG_DIR: path.join(probeRoot, 'clients', 'claude'),
  GEMINI_CLI_HOME: path.join(probeRoot, 'clients', 'gemini'),
  OPENCODE_CONFIG_DIR: path.join(probeRoot, 'clients', 'opencode'),
  CODEX_HOME: path.join(probeRoot, 'clients', 'codex'),
  CLIO_CODER_CONFIG_DIR: path.join(probeRoot, 'clients', 'clio'),
  COPILOT_HOME: path.join(probeRoot, 'clients', 'copilot'),
  ANTIGRAVITY_HOME: path.join(probeRoot, 'clients', 'antigravity'),
  TMPDIR: probeTmp,
  TEMP: probeTmp,
  TMP: probeTmp,
  FORCE_COLOR: '',
  NO_COLOR: '1'
};

try {
  for (const name of cliEntrypoints) {
    const entrypoint = path.join(root, 'bin', name);
    const syntax = spawnSync(process.execPath, ['--check', entrypoint], {
      cwd: probeCwd,
      encoding: 'utf8',
      env: probeEnv,
      timeout: 10000
    });
    check(syntax.status === 0 && !syntax.error, `bin/${name} is valid Node.js`);

    const imported = spawnSync(process.execPath, ['-e', 'require(process.argv[1])', entrypoint], {
      cwd: probeCwd,
      encoding: 'utf8',
      env: probeEnv,
      input: '',
      timeout: 10000
    });
    check(imported.status === 0 && !imported.error, `bin/${name} is import-safe`);
  }
} finally {
  fs.rmSync(probeRoot, { recursive: true, force: true });
}

// Commands exist
const commands = fs.readdirSync(path.join(root, 'vendors/claude/commands'));
check(commands.includes('help.md'), 'help.md command exists');
check(commands.includes('new-paper.md'), 'new-paper.md command exists');
check(commands.length >= 10, `${commands.length} commands found`);

// Workflows exist
const workflows = fs.readdirSync(path.join(root, 'core/write-the-f-paper/workflows'));
check(workflows.length >= 5, `${workflows.length} workflows found`);

// Multi-runtime support
check(fs.existsSync(path.join(root, 'vendors/gemini')), 'vendors/gemini exists');
check(fs.existsSync(path.join(root, 'vendors/opencode')), 'vendors/opencode exists');
check(fs.existsSync(path.join(root, 'bin/lib/manifest.js')), 'manifest.js exists');

// Agents exist
const agents = fs.readdirSync(path.join(root, 'vendors/claude/agents/wtfp'));
check(agents.length >= 10, `${agents.length} agents found`);

console.log(`\n=== Sanity Results: ${passed} passed, ${failedCount} failed ===\n`);

process.exit(failed ? 1 : 0);
