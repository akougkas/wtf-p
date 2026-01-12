#!/usr/bin/env node
/**
 * Path handling and version tracking tests
 * Covers: spaces, symlinks, tilde expansion, version files
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Import from shared utilities
const {
  expandTilde,
  normalizePath,
  isValidPath,
  getClaudeDir,
  getPathLabel,
  readInstalledVersion,
  writeVersionFile,
  detectInstallation,
  createColors,
  createOutput
} = require('../bin/lib/utils');

const root = path.join(__dirname, '..');
let failed = false;
let passed = 0;

function check(condition, msg) {
  if (condition) {
    console.log(`✓ ${msg}`);
    passed++;
  } else {
    console.log(`✗ ${msg}`);
    failed = true;
  }
}

function cleanup(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('\n=== Path Handling Tests ===\n');

// Test 1: Tilde expansion
console.log('--- Tilde Expansion ---');
check(expandTilde('~/.claude') === path.join(os.homedir(), '.claude'), 'expands ~ to homedir');
check(expandTilde('~/') === os.homedir(), 'expands ~/ alone (no trailing slash)');
check(expandTilde('/absolute/path') === '/absolute/path', 'leaves absolute paths unchanged');
check(expandTilde('./relative') === './relative', 'leaves relative paths unchanged');
check(expandTilde(null) === null, 'handles null');
check(expandTilde(undefined) === undefined, 'handles undefined');
check(expandTilde('') === '', 'handles empty string');
check(expandTilde('~notuser/path') === '~notuser/path', 'does not expand ~user syntax');

// Test 2: Path normalization
console.log('\n--- Path Normalization ---');
check(normalizePath('~/.claude') === path.join(os.homedir(), '.claude'), 'normalizes tilde path');
check(normalizePath('./relative') === path.resolve('./relative'), 'resolves relative to absolute');
check(path.isAbsolute(normalizePath('somedir')), 'converts to absolute path');

// Test 3: Path validation
console.log('\n--- Path Validation ---');
check(isValidPath('/valid/path'), 'accepts valid absolute path');
check(isValidPath('./valid/relative'), 'accepts valid relative path');
check(!isValidPath(null), 'rejects null');
check(!isValidPath(undefined), 'rejects undefined');
check(!isValidPath(''), 'rejects empty string');
check(!isValidPath('/path/with\0null'), 'rejects null bytes');
check(!isValidPath('a'.repeat(2000)), 'rejects excessively long paths');

// Test 4: Paths with spaces
console.log('\n--- Paths with Spaces ---');
const tempBase = path.join(os.tmpdir(), 'wtfp-test-' + Date.now());
const spacePath = path.join(tempBase, 'path with spaces', 'subdir');

try {
  fs.mkdirSync(spacePath, { recursive: true });
  check(fs.existsSync(spacePath), 'creates dir with spaces');

  const testFile = path.join(spacePath, 'test file.txt');
  fs.writeFileSync(testFile, 'test content');
  check(fs.existsSync(testFile), 'creates file in spaced path');
  check(fs.readFileSync(testFile, 'utf8') === 'test content', 'reads file from spaced path');

  cleanup(tempBase);
  check(!fs.existsSync(tempBase), 'cleans up spaced path');
} catch (err) {
  console.log(`✗ spaces test failed: ${err.message}`);
  failed = true;
  cleanup(tempBase);
}

// Test 5: Symlinks (Unix only)
if (process.platform !== 'win32') {
  console.log('\n--- Symlink Handling ---');
  const symlinkBase = path.join(os.tmpdir(), 'wtfp-symlink-' + Date.now());
  const realDir = path.join(symlinkBase, 'real');
  const linkDir = path.join(symlinkBase, 'link');

  try {
    fs.mkdirSync(realDir, { recursive: true });
    fs.symlinkSync(realDir, linkDir);
    check(fs.existsSync(linkDir), 'symlink created');

    const resolvedLink = normalizePath(linkDir);
    check(resolvedLink === realDir, 'resolves symlink to real path');

    cleanup(symlinkBase);
  } catch (err) {
    console.log(`✗ symlink test failed: ${err.message}`);
    failed = true;
    cleanup(symlinkBase);
  }
}

// Test 6: Install dry-run with spaced path
console.log('\n--- Install with Spaced Path (dry-run) ---');
const installTestBase = path.join(os.tmpdir(), 'wtfp install test ' + Date.now());
const installTestDir = path.join(installTestBase, '.claude');

try {
  fs.mkdirSync(installTestDir, { recursive: true });
  check(fs.existsSync(installTestDir), 'target dir with spaces created');

  // We'd run install here with --config-dir but that modifies real state
  // For now, just verify the path handling works
  const normalized = normalizePath(installTestDir);
  check(fs.existsSync(normalized), 'normalized spaced path exists');

  cleanup(installTestBase);
} catch (err) {
  console.log(`✗ install path test failed: ${err.message}`);
  failed = true;
  cleanup(installTestBase);
}

// Test 7: Version tracking
console.log('\n--- Version Tracking ---');
const versionTestDir = path.join(os.tmpdir(), 'wtfp-version-' + Date.now());
const versionClaudeDir = path.join(versionTestDir, '.claude');

try {
  fs.mkdirSync(versionClaudeDir, { recursive: true });

  // Test no version file
  const noVersion = readInstalledVersion(versionClaudeDir);
  check(noVersion === null, 'returns null when no version file');

  // Test write + read version
  const mockFiles = [
    { dest: path.join(versionClaudeDir, 'commands/wtfp/help.md') },
    { dest: path.join(versionClaudeDir, 'write-the-f-paper/workflows/test.md') }
  ];

  // Create the files first for checksum
  fs.mkdirSync(path.join(versionClaudeDir, 'commands/wtfp'), { recursive: true });
  fs.mkdirSync(path.join(versionClaudeDir, 'write-the-f-paper/workflows'), { recursive: true });
  fs.writeFileSync(mockFiles[0].dest, '# Help');
  fs.writeFileSync(mockFiles[1].dest, '# Test');

  writeVersionFile(versionClaudeDir, '0.2.0', mockFiles);

  const readBack = readInstalledVersion(versionClaudeDir);
  check(readBack !== null, 'reads version file');
  check(readBack.version === '0.2.0', 'version matches');
  check(readBack.files === 2, 'file count matches');
  check(readBack.manifest.length === 2, 'manifest has entries');
  check(readBack.installedAt, 'has installedAt timestamp');

  // Test detectInstallation
  const detection = detectInstallation(versionClaudeDir);
  check(detection.hasCommands === true, 'detects commands');
  check(detection.hasWorkflows === true, 'detects workflows');
  check(detection.version === '0.2.0', 'detects version');
  check(detection.partial === false, 'not partial');

  cleanup(versionTestDir);
} catch (err) {
  console.log(`✗ version test failed: ${err.message}`);
  failed = true;
  cleanup(versionTestDir);
}

// Test 8: Output utilities
console.log('\n--- Output Utilities ---');
const colorsOn = createColors(true);
const colorsOff = createColors(false);

check(colorsOn.cyan('test').includes('\x1b['), 'colors enabled includes escape codes');
check(colorsOff.cyan('test') === 'test', 'colors disabled returns plain text');

const output = createOutput({ quiet: true });
// Can't easily test console output, but check the object exists
check(typeof output.log === 'function', 'output.log is function');
check(typeof output.verbose === 'function', 'output.verbose is function');
check(typeof output.error === 'function', 'output.error is function');

// Test 9: getClaudeDir utility
console.log('\n--- getClaudeDir ---');
const globalDir = getClaudeDir(null, true);
check(globalDir === path.join(os.homedir(), '.claude'), 'default global is ~/.claude');

const localDir = getClaudeDir(null, false);
check(localDir === path.join(process.cwd(), '.claude'), 'local is ./.claude');

const customDir = getClaudeDir('/custom/path', true);
check(customDir === '/custom/path', 'explicit config dir used');

// Test 10: getPathLabel utility
console.log('\n--- getPathLabel ---');
const homeLabel = getPathLabel(path.join(os.homedir(), '.claude'), true);
check(homeLabel === '~/.claude', 'replaces homedir with ~');

const cwdLabel = getPathLabel(path.join(process.cwd(), '.claude'), false);
check(cwdLabel === './.claude', 'replaces cwd with .');

// Summary
console.log(`\n=== Results: ${passed} passed${failed ? ', FAILURES detected' : ''} ===\n`);
process.exit(failed ? 1 : 0);
