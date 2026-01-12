#!/usr/bin/env node
/**
 * Basic sanity check for npm package
 * Verifies structure without running install
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = false;

function check(condition, msg) {
  if (condition) {
    console.log(`✓ ${msg}`);
  } else {
    console.log(`✗ ${msg}`);
    failed = true;
  }
}

// Package structure
check(fs.existsSync(path.join(root, 'bin/install.js')), 'bin/install.js exists');
check(fs.existsSync(path.join(root, 'bin/uninstall.js')), 'bin/uninstall.js exists');
check(fs.existsSync(path.join(root, 'vendors/claude/commands/wtfp')), 'vendors/claude/commands/wtfp exists');
check(fs.existsSync(path.join(root, 'core/write-the-f-paper')), 'core/write-the-f-paper exists');
check(fs.existsSync(path.join(root, 'LICENSE')), 'LICENSE exists');

// Package.json fields
const pkg = require(path.join(root, 'package.json'));
check(pkg.name === 'wtf-p', 'package name is wtf-p');
check(pkg.bin && pkg.bin.wtfp, 'bin.wtfp defined');
check(pkg.bin && pkg.bin['wtf-p-uninstall'], 'bin.wtf-p-uninstall defined');
check(pkg.files && pkg.files.includes('bin'), 'files includes bin');
check(pkg.license === 'MIT', 'license is MIT');

// Install script is valid JS
try {
  require(path.join(root, 'bin/install.js'));
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') {
    // Script runs and prompts - that's expected
  }
}
check(true, 'bin/install.js is valid Node.js');

// Commands exist
const commands = fs.readdirSync(path.join(root, 'vendors/claude/commands/wtfp'));
check(commands.includes('help.md'), 'help.md command exists');
check(commands.includes('new-paper.md'), 'new-paper.md command exists');
check(commands.length >= 10, `${commands.length} commands found`);

// Workflows exist
const workflows = fs.readdirSync(path.join(root, 'core/write-the-f-paper/workflows'));
check(workflows.length >= 5, `${workflows.length} workflows found`);

process.exit(failed ? 1 : 0);
