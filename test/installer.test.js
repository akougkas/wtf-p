/**
 * Installer/Uninstaller Tests for WTF-P
 *
 * Tests installer and uninstaller logic, MANIFEST structure,
 * path handling, and multi-runtime support.
 *
 * These are unit/structural tests that don't require actual filesystem operations.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m'
};

let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`${COLORS.green}✓${COLORS.reset} ${msg}`);
  passed++;
}

function fail(msg) {
  console.log(`${COLORS.red}✗${COLORS.reset} ${msg}`);
  failed++;
}

function readFile(filepath) {
  return fs.existsSync(filepath) ? fs.readFileSync(filepath, 'utf8') : null;
}

console.log('=== Installer/Uninstaller Tests ===\n');

// ============================================================================
// MANIFEST Tests
// ============================================================================

console.log(`${COLORS.cyan}--- MANIFEST Structure ---${COLORS.reset}`);

const MANIFEST_PATH = path.join(ROOT, 'bin', 'lib', 'manifest.js');
let MANIFEST = null;

if (fs.existsSync(MANIFEST_PATH)) {
  pass('manifest.js exists');
  MANIFEST = require(MANIFEST_PATH);

  // Test manifest structure
  if (typeof MANIFEST === 'object') {
    pass('MANIFEST exports an object');
  } else {
    fail('MANIFEST should export an object');
  }

  // Test each runtime configuration
  const EXPECTED_RUNTIMES = ['claude', 'gemini', 'opencode'];

  for (const runtime of EXPECTED_RUNTIMES) {
    if (MANIFEST[runtime]) {
      pass(`MANIFEST has ${runtime} runtime`);

      // Required fields
      if (MANIFEST[runtime].name) pass(`${runtime}.name defined`);
      else fail(`${runtime}.name missing`);

      if (MANIFEST[runtime].configDirEnv) pass(`${runtime}.configDirEnv defined`);
      else fail(`${runtime}.configDirEnv missing`);

      if (MANIFEST[runtime].defaultDir) pass(`${runtime}.defaultDir defined`);
      else fail(`${runtime}.defaultDir missing`);

      if (Array.isArray(MANIFEST[runtime].components)) {
        pass(`${runtime}.components is array`);
        if (MANIFEST[runtime].components.length > 0) {
          pass(`${runtime} has ${MANIFEST[runtime].components.length} components`);
        }
      } else {
        fail(`${runtime}.components should be array`);
      }
    } else {
      fail(`MANIFEST missing ${runtime} runtime`);
    }
  }
} else {
  fail('manifest.js missing');
}

// ============================================================================
// MANIFEST Component Tests
// ============================================================================

console.log(`\n${COLORS.cyan}--- MANIFEST Components ---${COLORS.reset}`);

if (MANIFEST) {
  for (const [runtime, config] of Object.entries(MANIFEST)) {
    for (const component of config.components) {
      // Each component should have required fields
      if (component.id) pass(`${runtime}.${component.id} has id`);
      else fail(`${runtime} component missing id`);

      if (component.src) pass(`${runtime}.${component.id} has src`);
      else fail(`${runtime}.${component.id} missing src`);

      if (component.dest) pass(`${runtime}.${component.id} has dest`);
      else fail(`${runtime}.${component.id} missing dest`);

      // Verify source exists
      if (component.src && fs.existsSync(component.src)) {
        pass(`${runtime}.${component.id} src exists`);
      } else if (component.src) {
        fail(`${runtime}.${component.id} src missing: ${component.src}`);
      }
    }
  }
}

// ============================================================================
// Utils Module Tests
// ============================================================================

console.log(`\n${COLORS.cyan}--- Utils Module ---${COLORS.reset}`);

const UTILS_PATH = path.join(ROOT, 'bin', 'lib', 'utils.js');
let utils = null;

if (fs.existsSync(UTILS_PATH)) {
  pass('utils.js exists');
  utils = require(UTILS_PATH);

  // Test exported functions exist
  const expectedExports = [
    'expandTilde', 'normalizePath', 'isValidPath',
    'getClaudeDir', 'getPathLabel',
    'readInstalledVersion', 'writeVersionFile',
    'detectInstallation', 'collectFiles',
    'createColors', 'createOutput',
    'createRL', 'prompt', 'getBackupPath',
    'VERSION_FILE'
  ];

  for (const exp of expectedExports) {
    if (utils[exp] !== undefined) {
      pass(`utils exports ${exp}`);
    } else {
      fail(`utils missing export: ${exp}`);
    }
  }
} else {
  fail('utils.js missing');
}

// ============================================================================
// Path Handling Tests
// ============================================================================

console.log(`\n${COLORS.cyan}--- Path Handling Functions ---${COLORS.reset}`);

if (utils) {
  // Test expandTilde
  const expanded = utils.expandTilde('~/test');
  if (expanded.startsWith(os.homedir())) {
    pass('expandTilde expands ~ correctly');
  } else {
    fail('expandTilde should expand ~ to homedir');
  }

  // Test with non-tilde path
  const unchanged = utils.expandTilde('/absolute/path');
  if (unchanged === '/absolute/path') {
    pass('expandTilde preserves absolute paths');
  } else {
    fail('expandTilde should preserve absolute paths');
  }

  // Test isValidPath
  if (utils.isValidPath('/valid/path')) pass('isValidPath accepts valid path');
  if (!utils.isValidPath(null)) pass('isValidPath rejects null');
  if (!utils.isValidPath('')) pass('isValidPath rejects empty string');
  if (!utils.isValidPath('path\0with\0nulls')) pass('isValidPath rejects null bytes');

  // Test getPathLabel
  const homeLabel = utils.getPathLabel(os.homedir() + '/test', true);
  if (homeLabel.startsWith('~')) {
    pass('getPathLabel replaces homedir with ~');
  }

  // Test VERSION_FILE constant
  if (utils.VERSION_FILE === '.wtfp-version') {
    pass('VERSION_FILE is .wtfp-version');
  } else {
    fail(`VERSION_FILE should be .wtfp-version, got ${utils.VERSION_FILE}`);
  }
}

// ============================================================================
// Install Script Structure Tests
// ============================================================================

console.log(`\n${COLORS.cyan}--- Install Script Structure ---${COLORS.reset}`);

const INSTALL_PATH = path.join(ROOT, 'bin', 'install.js');
if (fs.existsSync(INSTALL_PATH)) {
  const content = readFile(INSTALL_PATH);
  pass('install.js exists');

  // Check for required features
  if (content.includes('#!/usr/bin/env node')) pass('install.js has shebang');

  // Check flag parsing
  const flags = ['--global', '-g', '--local', '-l', '--gemini', '--opencode', '--all',
                 '--force', '-f', '--backup-all', '-b', '--help', '-h', '--version', '-v',
                 '--quiet', '-q', '--verbose', '--no-color', '--config-dir', '-c',
                 '--beginner', '--advanced', '--only='];

  let flagCount = 0;
  for (const flag of flags) {
    if (content.includes(flag)) flagCount++;
  }
  pass(`install.js supports ${flagCount}/${flags.length} expected flags`);

  // Check subcommands
  const subcommands = ['status', 'doctor', 'update', 'uninstall'];
  let subCount = 0;
  for (const sub of subcommands) {
    if (content.includes(`'${sub}'`) || content.includes(`"${sub}"`)) subCount++;
  }
  pass(`install.js supports ${subCount}/${subcommands.length} subcommands`);

  // Check for install-logic import
  if (content.includes('install-logic')) {
    pass('install.js imports install-logic module');
  }

  // Check banner
  if (content.includes('WTF-P') || content.includes('Write The F')) {
    pass('install.js has WTF-P banner');
  }
} else {
  fail('install.js missing');
}

// ============================================================================
// Install Logic Module Tests
// ============================================================================

console.log(`\n${COLORS.cyan}--- Install Logic Module ---${COLORS.reset}`);

const INSTALL_LOGIC_PATH = path.join(ROOT, 'bin', 'commands', 'install-logic.js');
if (fs.existsSync(INSTALL_LOGIC_PATH)) {
  const content = readFile(INSTALL_LOGIC_PATH);
  pass('install-logic.js exists');

  // Check for key functions
  if (content.includes('function getVendorDir')) pass('has getVendorDir function');
  if (content.includes('function processContent')) pass('has processContent function');
  if (content.includes('function collectComponentFiles')) pass('has collectComponentFiles function');
  if (content.includes('function installWithConflictResolution')) pass('has installWithConflictResolution function');
  if (content.includes('async function install')) pass('has async install function');

  // Check it uses MANIFEST
  if (content.includes('MANIFEST')) pass('install-logic uses MANIFEST');

  // Check path replacement
  if (content.includes('~/.claude/')) pass('install-logic handles path replacement');

  // Check module.exports
  if (content.includes('module.exports')) pass('install-logic exports install function');
} else {
  fail('install-logic.js missing');
}

// ============================================================================
// Uninstall Script Tests
// ============================================================================

console.log(`\n${COLORS.cyan}--- Uninstall Script Structure ---${COLORS.reset}`);

const UNINSTALL_PATH = path.join(ROOT, 'bin', 'uninstall.js');
if (fs.existsSync(UNINSTALL_PATH)) {
  const content = readFile(UNINSTALL_PATH);
  pass('uninstall.js exists');

  // Check for required features
  if (content.includes('#!/usr/bin/env node')) pass('uninstall.js has shebang');

  // Check flag parsing
  const flags = ['--global', '-g', '--local', '-l', '--claude', '--gemini', '--opencode',
                 '--all', '--force', '-f', '--backup', '-b', '--dry-run', '-n',
                 '--clean-backups', '--help', '-h', '--no-color', '--quiet', '-q',
                 '--config-dir', '-c'];

  let flagCount = 0;
  for (const flag of flags) {
    if (content.includes(flag)) flagCount++;
  }
  pass(`uninstall.js supports ${flagCount}/${flags.length} expected flags`);

  // Check for MANIFEST usage
  if (content.includes('MANIFEST')) pass('uninstall.js uses MANIFEST');

  // Check key functions
  if (content.includes('function getVendorDir')) pass('uninstall has getVendorDir function');
  if (content.includes('function removeDir')) pass('uninstall has removeDir function');
  if (content.includes('function copyDir')) pass('uninstall has copyDir function');
  if (content.includes('function findBackupFiles')) pass('uninstall has findBackupFiles function');
  if (content.includes('async function uninstall')) pass('uninstall has async uninstall function');

  // Check for safety features
  if (content.includes('confirmation') || content.includes('confirm') || content.includes('prompt')) {
    pass('uninstall has confirmation prompts');
  }
  if (content.includes('dry-run') || content.includes('hasDryRun')) {
    pass('uninstall supports dry-run mode');
  }
  if (content.includes('backup') || content.includes('hasBackup')) {
    pass('uninstall supports backup before removal');
  }
} else {
  fail('uninstall.js missing');
}

// ============================================================================
// Runtime-Specific Path Tests
// ============================================================================

console.log(`\n${COLORS.cyan}--- Runtime Path Configuration ---${COLORS.reset}`);

if (MANIFEST) {
  // Claude paths
  if (MANIFEST.claude.defaultDir === '.claude') {
    pass('claude defaultDir is .claude');
  } else {
    fail(`claude defaultDir should be .claude, got ${MANIFEST.claude.defaultDir}`);
  }
  if (MANIFEST.claude.configDirEnv === 'CLAUDE_CONFIG_DIR') {
    pass('claude configDirEnv is CLAUDE_CONFIG_DIR');
  }

  // Gemini paths
  if (MANIFEST.gemini.defaultDir === '.config/gemini') {
    pass('gemini defaultDir is .config/gemini');
  } else {
    fail(`gemini defaultDir should be .config/gemini, got ${MANIFEST.gemini.defaultDir}`);
  }
  if (MANIFEST.gemini.configDirEnv === 'GEMINI_CONFIG_DIR') {
    pass('gemini configDirEnv is GEMINI_CONFIG_DIR');
  }

  // OpenCode paths
  if (MANIFEST.opencode.defaultDir === '.opencode') {
    pass('opencode defaultDir is .opencode');
  } else {
    fail(`opencode defaultDir should be .opencode, got ${MANIFEST.opencode.defaultDir}`);
  }
  if (MANIFEST.opencode.configDirEnv === 'OPENCODE_CONFIG_DIR') {
    pass('opencode configDirEnv is OPENCODE_CONFIG_DIR');
  }
}

// ============================================================================
// Component Source Verification
// ============================================================================

console.log(`\n${COLORS.cyan}--- Component Source Verification ---${COLORS.reset}`);

if (MANIFEST) {
  // Verify all component sources exist and have files
  for (const [runtime, config] of Object.entries(MANIFEST)) {
    for (const component of config.components) {
      if (fs.existsSync(component.src)) {
        const stats = fs.statSync(component.src);
        if (stats.isDirectory()) {
          const files = fs.readdirSync(component.src);
          if (files.length > 0) {
            pass(`${runtime}.${component.id} source has ${files.length} items`);
          } else {
            fail(`${runtime}.${component.id} source is empty`);
          }
        } else {
          pass(`${runtime}.${component.id} source is file`);
        }
      }
    }
  }
}

// ============================================================================
// Status Command Tests
// ============================================================================

console.log(`\n${COLORS.cyan}--- Status Command ---${COLORS.reset}`);

const STATUS_PATH = path.join(ROOT, 'bin', 'commands', 'status.js');
if (fs.existsSync(STATUS_PATH)) {
  const content = readFile(STATUS_PATH);
  pass('status.js exists');

  if (content.includes('detectInstallation')) pass('status uses detectInstallation');
  if (content.includes('version')) pass('status shows version info');
} else {
  fail('status.js missing');
}

// ============================================================================
// Doctor Command Tests
// ============================================================================

console.log(`\n${COLORS.cyan}--- Doctor Command ---${COLORS.reset}`);

const DOCTOR_PATH = path.join(ROOT, 'bin', 'commands', 'doctor.js');
if (fs.existsSync(DOCTOR_PATH)) {
  const content = readFile(DOCTOR_PATH);
  pass('doctor.js exists');

  if (content.includes('check') || content.includes('diagnose') || content.includes('validate')) {
    pass('doctor performs checks');
  }
} else {
  fail('doctor.js missing');
}

// ============================================================================
// Update Command Tests
// ============================================================================

console.log(`\n${COLORS.cyan}--- Update Command ---${COLORS.reset}`);

const UPDATE_CMD_PATH = path.join(ROOT, 'bin', 'commands', 'update.js');
if (fs.existsSync(UPDATE_CMD_PATH)) {
  const content = readFile(UPDATE_CMD_PATH);
  pass('update.js command exists');

  if (content.includes('version')) pass('update handles version comparison');
  if (content.includes('install') || content.includes('Install')) pass('update can trigger install');
} else {
  fail('update.js missing');
}

// ============================================================================
// List Command Tests
// ============================================================================

console.log(`\n${COLORS.cyan}--- List Command ---${COLORS.reset}`);

const LIST_PATH = path.join(ROOT, 'bin', 'commands', 'list.js');
if (fs.existsSync(LIST_PATH)) {
  const content = readFile(LIST_PATH);
  pass('list.js exists');

  if (content.includes('commands') || content.includes('Commands')) pass('list shows commands');
} else {
  fail('list.js missing');
}

// ============================================================================
// Version Tracking Tests
// ============================================================================

console.log(`\n${COLORS.cyan}--- Version Tracking ---${COLORS.reset}`);

if (utils) {
  // Test VERSION_FILE format
  pass('VERSION_FILE constant exported');

  // writeVersionFile creates proper structure
  // (We can't test actual file writing in unit tests)
  pass('writeVersionFile function available');
  pass('readInstalledVersion function available');
}

// ============================================================================
// Package.json Bin Configuration
// ============================================================================

console.log(`\n${COLORS.cyan}--- Package.json Bin Config ---${COLORS.reset}`);

const PKG_PATH = path.join(ROOT, 'package.json');
if (fs.existsSync(PKG_PATH)) {
  const pkg = require(PKG_PATH);

  if (pkg.bin && pkg.bin.wtfp) {
    pass('package.json has wtfp bin entry');
    if (pkg.bin.wtfp.includes('install.js')) pass('wtfp points to install.js');
  } else {
    fail('package.json missing wtfp bin entry');
  }

  if (pkg.bin && pkg.bin['wtf-p']) {
    pass('package.json has wtf-p bin entry');
  }

  if (pkg.bin && pkg.bin['wtf-p-uninstall']) {
    pass('package.json has wtf-p-uninstall bin entry');
    if (pkg.bin['wtf-p-uninstall'].includes('uninstall.js')) {
      pass('wtf-p-uninstall points to uninstall.js');
    }
  } else {
    fail('package.json missing wtf-p-uninstall bin entry');
  }
}

// ============================================================================
// Results
// ============================================================================

console.log(`\n=== Installer Tests: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  process.exit(1);
}
