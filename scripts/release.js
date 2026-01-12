#!/usr/bin/env node
/**
 * WTF-P Release Script
 * Automates version bumping, tagging, and publishing
 *
 * Usage:
 *   npm run release [patch|minor|major]
 *   npm run release -- --dry-run
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

let dryRun = false;

function exec(cmd, silent = false) {
  if (dryRun) {
    console.log(`${colors.dim}DRY-RUN: ${cmd}${colors.reset}`);
    return '';
  }
  return execSync(cmd, {
    stdio: silent ? 'pipe' : 'inherit',
    encoding: 'utf8'
  });
}

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function check(condition, msg) {
  if (condition) {
    log(`✓ ${msg}`, 'green');
    return true;
  } else {
    log(`✗ ${msg}`, 'red');
    return false;
  }
}

function section(title) {
  console.log(`\n${'='.repeat(50)}`);
  log(title, 'green');
  console.log('='.repeat(50) + '\n');
}

function confirm(message) {
  if (dryRun) return true;
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(`${message} [y/N]: `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  dryRun = args.includes('--dry-run');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run release [patch|minor|major] [--dry-run]

Arguments:
  patch   - Bump version x.x.x → x.x.z+1 (bug fixes)
  minor   - Bump version x.x.x → x.y+1.0 (new features)
  major   - Bump version x.x.x → x+1.0.0 (breaking changes)

Options:
  --dry-run  - Preview actions without executing
  --help     - Show this help

Examples:
  npm run release patch
  npm run release minor --dry-run
`);
    process.exit(0);
  }

  section('WTF-P Release Process');

  // Parse version type
  const versionType = args.find(a => ['patch', 'minor', 'major'].includes(a));

  if (!versionType) {
    log('Error: Version type required (patch, minor, or major)', 'red');
    console.log('Run: npm run release --help');
    process.exit(1);
  }

  // 1. Pre-flight checks
  section('Pre-Flight Checks');

  try {
    // Check clean working tree
    const status = exec('git status --porcelain', true);
    if (status.trim()) {
      check(false, 'Working tree is clean');
      console.log('\nStaged or unstaged changes found:');
      console.log(status);
      process.exit(1);
    } else {
      check(true, 'Working tree is clean');
    }

    // Check on main branch
    const branch = exec('git rev-parse --abbrev-ref HEAD', true).trim();
    check(branch === 'main', `On main branch (${branch})`);

    // Check preflight passes
    log('Running preflight check...', 'dim');
    try {
      exec('npm run preflight', true);
      check(true, 'Preflight checks passed');
    } catch (e) {
      check(false, 'Preflight checks failed');
      log('Run: npm run preflight', 'yellow');
      process.exit(1);
    }

  } catch (e) {
    log(`Error during pre-flight: ${e.message}`, 'red');
    process.exit(1);
  }

  // 2. Read current version
  section('Version Bump');

  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version;
  log(`Current version: ${currentVersion}`, 'dim');

  // Calculate new version
  const parts = currentVersion.split('.').map(Number);
  if (versionType === 'patch') parts[2]++;
  if (versionType === 'minor') { parts[1]++; parts[2] = 0; }
  if (versionType === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }
  const newVersion = parts.join('.');

  log(`New version: ${newVersion} (${versionType})`, 'green');

  if (!await confirm('Proceed with version bump?')) {
    log('Aborted', 'yellow');
    process.exit(0);
  }

  // 3. Update version in package.json
  section('Update Version');

  if (!dryRun) {
    pkg.version = newVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  } else {
    log(`${colors.dim}DRY-RUN: Would update package.json${colors.reset}`);
  }
  log(`Updated package.json to ${newVersion}`, 'green');

  // Update CHANGELOG if it exists
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    if (!dryRun) {
      const date = new Date().toISOString().split('T')[0];
      const newEntry = `\n## [${newVersion}] - ${date}\n\n### Changes\n- `;
      const currentContent = fs.readFileSync(changelogPath, 'utf8');
      const updatedContent = newEntry + currentContent;
      fs.writeFileSync(changelogPath, updatedContent);
    } else {
      log(`${colors.dim}DRY-RUN: Would update CHANGELOG.md${colors.reset}`);
    }
    log(`Updated CHANGELOG.md`, 'green');
  }

  // 4. Commit and tag
  section('Git Operations');

  const commitMsg = `chore(release): bump version to ${newVersion}`;
  exec(`git add package.json CHANGELOG.md`, true);
  exec(`git commit -m "${commitMsg}"`, true);
  log(`Created commit: ${commitMsg}`, 'green');

  const tagName = `v${newVersion}`;
  exec(`git tag -a ${tagName} -m "Release ${tagName}"`, true);
  log(`Created tag: ${tagName}`, 'green');

  // 5. Push to remote
  section('Push to Remote');

  log(`This will push to origin/main and push tag ${tagName}`, 'yellow');
  if (!await confirm('Push to remote?')) {
    log('Skipping push. Manual push required:', 'yellow');
    log(`  git push origin main && git push origin ${tagName}`, 'dim');
    process.exit(0);
  }

  exec('git push origin main', true);
  exec(`git push origin ${tagName}`, true);
  log(`Pushed to origin/main and tag ${tagName}`, 'green');

  // 6. Publish instructions
  section('Release Complete');

  log(`Version ${newVersion} tagged and pushed!`, 'green');
  console.log(`
Next steps:

${colors.green}Manual publish:${colors.reset}
  npm publish

${colors.green}Automated publish (GitHub Actions):${colors.reset}
  CI/CD will automatically publish in ~2 minutes
  Monitor: https://github.com/akougkas/wtf-p/actions

${colors.dim}To verify:${colors.reset}
  npm view wtf-p
  npm install -g wtf-p@${newVersion}
`);

  // 7. Clean up tarball if it exists
  const tarball = path.join(__dirname, '..', `wtf-p-${newVersion}.tgz`);
  if (fs.existsSync(tarball)) {
    fs.unlinkSync(tarball);
    log(`Cleaned up old tarball: ${tarball}`, 'dim');
  }
}

main().catch(err => {
  log(`Error: ${err.message}`, 'red');
  process.exit(1);
});
