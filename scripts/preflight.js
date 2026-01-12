#!/usr/bin/env node
/**
 * Preflight Check for NPM Publishing
 * Verifies package is ready to publish
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  reset: '\x1b[0m'
};

let failed = 0;

function check(condition, msg) {
  if (condition) {
    console.log(`  ${colors.green}✓${colors.reset} ${msg}`);
  } else {
    console.log(`  ${colors.red}✗${colors.reset} ${msg}`);
    failed++;
  }
}

function warn(msg) {
  console.log(`  ${colors.yellow}⚠${colors.reset} ${msg}`);
}

console.log(`${colors.green}WTF-P Preflight Check${colors.reset}\n`);

// 1. Executable permissions
console.log('Checking file permissions...');
const exeFiles = ['bin/install.js', 'bin/uninstall.js'];
for (const file of exeFiles) {
  const stats = fs.statSync(file);
  const mode = stats.mode & parseInt('777', 8);
  check(mode === parseInt('755', 8), `${file} is executable (755)`);
}
console.log('');

// 2. Tag/Commit mismatch
console.log('Checking git tag alignment...');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const expectedTag = `v${pkg.version}`;
  const latestTag = execSync('git describe --tags --abbrev=0 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
  const tagCommit = latestTag ? execSync(`git rev-list -1 ${latestTag}`, { encoding: 'utf8' }).trim() : '';
  const headCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

  if (latestTag) {
    check(tagCommit === headCommit, `Tag ${latestTag} matches HEAD commit`);
    if (tagCommit !== headCommit) {
      console.log(`    ${colors.dim}Tag commit: ${tagCommit}${colors.reset}`);
      console.log(`    ${colors.dim}HEAD commit: ${headCommit}${colors.reset}`);
    }
  } else {
    warn(`No git tag found (expected ${expectedTag})`);
  }
} catch (e) {
  warn('Could not check git tags');
}
console.log('');

// 3. NPM Login
console.log('Checking NPM authentication...');
try {
  const username = execSync('npm whoami 2>/dev/null', { encoding: 'utf8' }).trim();
  check(true, `Logged in as ${username}`);
} catch (e) {
  check(false, 'Not logged in to NPM (run `npm login`)');
}
console.log('');

// 4. Run npm test
console.log('Running npm test...');
try {
  execSync('npm test', { stdio: 'pipe', encoding: 'utf8' });
  check(true, 'npm test passed');
} catch (e) {
  check(false, 'npm test failed');
}
console.log('');

// 5. npm pack dry-run
console.log('Checking package contents...');
try {
  const output = execSync('npm pack --dry-run', { encoding: 'utf8' });
  check(true, 'Package contents verified');
  const fileCount = (output.match(/\.md|\.js|\.yaml|\.json/g) || []).length;
  console.log(`    ${colors.dim}${fileCount} files will be packaged${colors.reset}`);
} catch (e) {
  check(false, 'npm pack failed');
}
console.log('');

// 6. Check for secrets
console.log('Checking for potential secrets...');
const secretPatterns = [
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /aws[_-]?access/i,
  /private[_-]?key/i
];

const binFiles = fs.readdirSync('bin').map(f => path.join('bin', f));
const templateFiles = fs.readdirSync(path.join('write-the-f-paper', 'templates'))
  .map(f => path.join('write-the-f-paper', 'templates', f));
const filesToCheck = [...binFiles, ...templateFiles].filter(f => fs.statSync(f).isFile());

let foundSecrets = false;
for (const file of filesToCheck) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of secretPatterns) {
    if (pattern.test(content) && !content.includes('CLAUDE_CONFIG_DIR')) {
      warn(`Potential secret pattern in ${file}`);
      foundSecrets = true;
      break;
    }
  }
}

if (!foundSecrets) {
  check(true, 'No obvious secrets found in package files');
} else {
  warn('Review potential secrets above manually');
}
console.log('');

// 7. Verify package structure
console.log('Verifying package structure...');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
check(pkg.name && pkg.version, 'package.json has name and version');
check(pkg.bin && pkg.bin.wtfp, 'package.json has bin.wtfp entry');
check(Array.isArray(pkg.files), 'package.json has files array');
check(pkg.license, 'package.json has license field');
console.log('');

// 8. Check README
console.log('Checking documentation...');
check(fs.existsSync('README.md'), 'README.md exists');
check(fs.existsSync('LICENSE'), 'LICENSE exists');
check(fs.existsSync('CHANGELOG.md'), 'CHANGELOG.md exists');
console.log('');

// Summary
console.log(`${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`${colors.green}✓ All checks passed! Ready to publish.${colors.reset}`);
  console.log(`\n  Run: npm publish\n`);
  process.exit(0);
} else {
  console.log(`${colors.red}✗ ${failed} check(s) failed. Fix issues above.${colors.reset}`);
  process.exit(1);
}
