const fs = require('fs');
const path = require('path');
const { getClaudeDir, normalizePath, getPathLabel, detectInstallation } = require('../lib/utils');

async function runDoctor(options) {
  const { out, explicitConfigDir } = options;
  const c = out.colors;

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
  if (detection.hasCommands || detection.hasWorkflows || detection.hasSkills) {
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

module.exports = runDoctor;
