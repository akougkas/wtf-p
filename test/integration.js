#!/usr/bin/env node
/**
 * Integration tests for WTF-P CLI
 * Tests the full install/status/update/uninstall cycle
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
let failed = false;
let passed = 0;
let testDir;

function check(condition, msg) {
  if (condition) {
    console.log(`✓ ${msg}`);
    passed++;
  } else {
    console.log(`✗ ${msg}`);
    failed = true;
  }
}

function cleanup() {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

function run(cmd, opts = {}) {
  const fullCmd = `node ${path.join(root, 'bin', 'install.js')} ${cmd}`;
  try {
    return execSync(fullCmd, {
      encoding: 'utf8',
      env: { ...process.env, ...opts.env },
      cwd: opts.cwd || root,
      stdio: opts.stdio || 'pipe'
    });
  } catch (err) {
    if (opts.expectFail) return err.stdout || err.message;
    throw err;
  }
}

function runUninstall(cmd, opts = {}) {
  const fullCmd = `node ${path.join(root, 'bin', 'uninstall.js')} ${cmd}`;
  try {
    return execSync(fullCmd, {
      encoding: 'utf8',
      env: { ...process.env, ...opts.env },
      cwd: opts.cwd || root,
      stdio: opts.stdio || 'pipe'
    });
  } catch (err) {
    if (opts.expectFail) return err.stdout || err.message;
    throw err;
  }
}

// Setup test directory
testDir = path.join(os.tmpdir(), 'wtfp-integration-' + Date.now());
const claudeDir = path.join(testDir, '.claude');

console.log('\n=== WTF-P Integration Tests ===\n');
console.log(`Test directory: ${testDir}\n`);

try {
  // Test 1: Fresh install to custom config dir
  console.log('--- Fresh Install ---');
  const installOutput = run(`--global --force --no-color --config-dir "${claudeDir}"`);
  check(installOutput.includes('Done!'), 'install completes successfully');
  check(fs.existsSync(path.join(claudeDir, 'commands', 'wtfp')), 'commands installed');
  check(fs.existsSync(path.join(claudeDir, 'write-the-f-paper')), 'workflows installed');
  check(fs.existsSync(path.join(claudeDir, '.wtfp-version')), 'version file created');

  // Verify version file contents
  const versionData = JSON.parse(fs.readFileSync(path.join(claudeDir, '.wtfp-version'), 'utf8'));
  check(versionData.version === '0.1.0', 'version file has correct version');
  check(versionData.installedAt, 'version file has installedAt');
  check(Array.isArray(versionData.manifest), 'version file has manifest');

  // Test 2: Status command
  console.log('\n--- Status Command ---');
  const statusOutput = run(`status --no-color --config-dir "${claudeDir}"`);
  check(statusOutput.includes('Installation Status'), 'status shows header');
  check(statusOutput.includes('0.1.0'), 'status shows version');
  check(statusOutput.includes('commands'), 'status shows commands');
  check(statusOutput.includes('workflows'), 'status shows workflows');

  // Test 3: Doctor command
  console.log('\n--- Doctor Command ---');
  const doctorOutput = run(`doctor --no-color --config-dir "${claudeDir}"`);
  check(doctorOutput.includes('Installation Doctor'), 'doctor shows header');
  check(doctorOutput.includes('Node.js version'), 'doctor checks node version');
  check(doctorOutput.includes('Write permissions'), 'doctor checks write permissions');
  check(doctorOutput.includes('No issues found'), 'doctor finds no issues');

  // Test 4: Update command (same version)
  console.log('\n--- Update Command ---');
  const updateOutput = run(`update --no-color --config-dir "${claudeDir}"`);
  check(updateOutput.includes('Already up to date'), 'update detects same version');

  // Test 5: List command
  console.log('\n--- List Command ---');
  const listOutput = run('--list --no-color');
  check(listOutput.includes('Files to install'), 'list shows header');
  check(listOutput.includes('Commands'), 'list shows commands section');
  check(listOutput.includes('Workflows'), 'list shows workflows section');
  check(listOutput.includes('Total:'), 'list shows total');

  // Test 6: Selective install (--only=commands)
  console.log('\n--- Selective Install ---');
  const onlyDir = path.join(testDir, '.claude-only');
  const onlyOutput = run(`--global --force --no-color --only=commands --config-dir "${onlyDir}"`);
  check(onlyOutput.includes('Done!'), 'selective install completes');
  check(fs.existsSync(path.join(onlyDir, 'commands', 'wtfp')), 'commands installed');
  check(!fs.existsSync(path.join(onlyDir, 'write-the-f-paper')), 'workflows NOT installed');

  // Test 7: Uninstall dry-run
  console.log('\n--- Uninstall Dry-Run ---');
  const dryRunOutput = runUninstall(`--global --dry-run --no-color --config-dir "${claudeDir}"`);
  check(dryRunOutput.includes('Dry run'), 'dry-run outputs dry-run message');
  check(dryRunOutput.includes('would remove'), 'dry-run shows what would be removed');
  check(fs.existsSync(path.join(claudeDir, 'commands', 'wtfp')), 'files NOT removed in dry-run');

  // Test 8: Uninstall with backup
  console.log('\n--- Uninstall with Backup ---');
  const backupOutput = runUninstall(`--global --force --backup --no-color --config-dir "${claudeDir}"`);
  check(backupOutput.includes('Done!'), 'uninstall completes');
  check(backupOutput.includes('Backed up'), 'backup was created');
  check(!fs.existsSync(path.join(claudeDir, 'commands', 'wtfp')), 'commands removed');
  check(!fs.existsSync(path.join(claudeDir, 'write-the-f-paper')), 'workflows removed');
  check(!fs.existsSync(path.join(claudeDir, '.wtfp-version')), 'version file removed');

  // Verify backup exists
  const backupDirs = fs.readdirSync(claudeDir).filter(d => d.startsWith('.wtfp-backup-'));
  check(backupDirs.length > 0, 'backup directory created');

  // Test 9: Reinstall after uninstall
  console.log('\n--- Reinstall After Uninstall ---');
  const reinstallOutput = run(`--global --force --no-color --config-dir "${claudeDir}"`);
  check(reinstallOutput.includes('Done!'), 'reinstall completes');
  check(fs.existsSync(path.join(claudeDir, 'commands', 'wtfp')), 'commands reinstalled');
  check(fs.existsSync(path.join(claudeDir, 'write-the-f-paper')), 'workflows reinstalled');

  // Test 10: Help and Version
  console.log('\n--- Help and Version ---');
  const helpOutput = run('--help --no-color');
  check(helpOutput.includes('Usage:'), 'help shows usage');
  check(helpOutput.includes('Commands:'), 'help shows commands');
  check(helpOutput.includes('status'), 'help mentions status');
  check(helpOutput.includes('doctor'), 'help mentions doctor');
  check(helpOutput.includes('update'), 'help mentions update');

  const versionOutput = run('--version');
  check(versionOutput.includes('0.1.0'), 'version shows current version');

  // Test 11: Path with spaces
  console.log('\n--- Path with Spaces ---');
  const spacedDir = path.join(testDir, 'path with spaces', '.claude');
  const spacedOutput = run(`--global --force --no-color --config-dir "${spacedDir}"`);
  check(spacedOutput.includes('Done!'), 'install to spaced path completes');
  check(fs.existsSync(path.join(spacedDir, 'commands', 'wtfp')), 'commands installed in spaced path');

  // Test 12: Quiet mode
  console.log('\n--- Quiet Mode ---');
  const quietDir = path.join(testDir, '.claude-quiet');
  const quietOutput = run(`--global --force --quiet --config-dir "${quietDir}"`);
  check(!quietOutput.includes('WTF'), 'quiet mode suppresses banner');
  check(fs.existsSync(path.join(quietDir, 'commands', 'wtfp')), 'install still works in quiet mode');

  cleanup();

} catch (err) {
  console.error(`\n✗ Test error: ${err.message}`);
  if (err.stack) console.error(err.stack);
  failed = true;
  cleanup();
}

// Summary
console.log(`\n=== Results: ${passed} passed${failed ? ', FAILURES detected' : ''} ===\n`);
process.exit(failed ? 1 : 0);
