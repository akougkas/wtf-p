#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const publishMode = process.argv.includes('--publish');
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  reset: '\x1b[0m'
};

let failures = 0;

function pass(message) {
  process.stdout.write(`  ${colors.green}✓${colors.reset} ${message}\n`);
}

function fail(message, detail = '') {
  failures++;
  process.stderr.write(`  ${colors.red}✗${colors.reset} ${message}\n`);
  if (detail) process.stderr.write(`    ${colors.dim}${detail}${colors.reset}\n`);
}

function warn(message) {
  process.stdout.write(`  ${colors.yellow}⚠${colors.reset} ${message}\n`);
}

function section(title) {
  process.stdout.write(`\n${title}\n`);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
    input: '',
    maxBuffer: 32 * 1024 * 1024,
    timeout: options.timeout || 180000,
    stdio: options.inherit ? 'inherit' : 'pipe'
  });
}

function commandPassed(command, args, label, options = {}) {
  const result = run(command, args, options);
  if (result.error) {
    fail(label, result.error.message);
    return false;
  }
  if (result.status !== 0) {
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
    fail(label, output.slice(-1600));
    return false;
  }
  pass(label);
  return true;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

process.stdout.write(`${colors.green}WTF-P ${publishMode ? 'publish ' : ''}preflight${colors.reset}\n`);

section('Package contract');
const packageJson = readJson('package.json');
if (packageJson.name === 'wtf-p' && packageJson.version) pass(`package identity is wtf-p@${packageJson.version}`);
else fail('package.json must declare the wtf-p package and a version');
if (packageJson.engines?.node === '>=20.0.0') pass('Node.js support floor is explicit (>=20)');
else fail('package.json must declare engines.node >=20.0.0');
if (packageJson.bin?.wtfp === 'bin/install.js' && packageJson.bin?.['wtf-p-uninstall'] === 'bin/uninstall.js') {
  pass('install and uninstall binaries are declared');
} else {
  fail('package binary declarations are incomplete');
}

for (const relativePath of ['bin/install.js', 'bin/uninstall.js', 'scripts/preflight.js', 'scripts/release.js']) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} exists`);
    continue;
  }
  const executable = (fs.statSync(absolutePath).mode & 0o111) !== 0;
  if (executable) pass(`${relativePath} is executable`);
  else fail(`${relativePath} must be executable`);
}

const requiredArtifacts = [
  'protocol/catalog.json',
  'protocol/project/README.md',
  'vendors/clio/clio-coder-extension.yaml',
  'vendors/claude/.claude-plugin/marketplace.json',
  'vendors/codex/.agents/plugins/marketplace.json',
  'vendors/copilot/marketplace.json',
  'vendors/copilot/project/.github/copilot-instructions.md',
  'vendors/copilot/project/.github/prompts/wtfp-new-paper.prompt.md',
  'vendors/opencode/.wtfp-generated.json',
  'vendors/antigravity/plugin.json',
  'vendors/gemini/gemini-extension.json'
];
const missingArtifacts = requiredArtifacts.filter((relativePath) => !fs.existsSync(path.join(ROOT, relativePath)));
if (missingArtifacts.length === 0) pass('all canonical and native envelope entry points exist');
else fail('native envelope entry points are missing', missingArtifacts.join(', '));

section('Determinism and regression suite');
commandPassed('npm', ['run', 'check:adapters'], 'generated adapters exactly match canonical sources');
commandPassed('npm', ['run', 'test:all'], 'unit, ownership, compatibility, and integration suites pass', { timeout: 300000 });

section('Publish archive');
const packed = run('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { timeout: 120000 });
if (packed.error || packed.status !== 0) {
  fail('npm can build the release archive', packed.error?.message || `${packed.stdout || ''}${packed.stderr || ''}`.trim());
} else {
  try {
    const report = JSON.parse(packed.stdout);
    const entry = report[0];
    const files = new Set((entry.files || []).map((file) => file.path));
    const requiredPackedFiles = [
      'bin/install.js',
      'bin/uninstall.js',
      'protocol/catalog.json',
      'vendors/clio/clio-coder-extension.yaml',
      'vendors/claude/.claude-plugin/marketplace.json',
      'vendors/codex/.agents/plugins/marketplace.json',
      'vendors/copilot/marketplace.json',
      'vendors/copilot/project/.github/copilot-instructions.md',
      'vendors/copilot/project/.github/prompts/wtfp-new-paper.prompt.md',
      'vendors/antigravity/plugin.json',
      'vendors/gemini/gemini-extension.json'
    ];
    const absent = requiredPackedFiles.filter((relativePath) => !files.has(relativePath));
    const forbiddenPrefixes = [
      'vendors/claude/mcp/',
      'vendors/claude/skills/wtfp/',
      'evaluation/'
    ];
    const forbidden = [...files].filter((relativePath) =>
      forbiddenPrefixes.some((prefix) => relativePath.startsWith(prefix))
    );
    if (absent.length === 0 && forbidden.length === 0) {
      pass(`archive contains ${files.size} files (${entry.size} compressed bytes, ${entry.unpackedSize} unpacked bytes)`);
    } else {
      if (absent.length > 0) fail('archive omits required runtime files', absent.join(', '));
      if (forbidden.length > 0) fail('archive contains forbidden or evaluator-only files', forbidden.join(', '));
    }
  } catch (error) {
    fail('npm pack returned parseable JSON', error.message);
  }
}

section('Repository state');
const diffCheck = run('git', ['diff', '--check']);
if (!diffCheck.error && diffCheck.status === 0) pass('tracked changes contain no whitespace errors');
else fail('git diff --check passes', `${diffCheck.stdout || ''}${diffCheck.stderr || ''}`.trim());

if (publishMode) {
  const status = run('git', ['status', '--porcelain']);
  if (!status.error && status.status === 0 && !status.stdout.trim()) pass('working tree is clean');
  else fail('publish mode requires a clean working tree', status.stdout.trim());

  const expectedTag = `v${packageJson.version}`;
  const exactTag = run('git', ['describe', '--tags', '--exact-match', 'HEAD']);
  if (!exactTag.error && exactTag.status === 0 && exactTag.stdout.trim() === expectedTag) {
    pass(`HEAD has exact release tag ${expectedTag}`);
  } else {
    fail(`publish mode requires exact tag ${expectedTag}`);
  }

  commandPassed('npm', ['whoami'], 'npm authentication is available');
} else {
  warn('registry authentication, clean-tree, and exact-tag checks require `npm run preflight -- --publish`');
}

process.stdout.write(`\n${'='.repeat(52)}\n`);
if (failures === 0) {
  pass(publishMode ? 'release archive is ready to publish' : 'development preflight passed');
  process.exit(0);
}

fail(`${failures} preflight check${failures === 1 ? '' : 's'} failed`);
process.exit(1);
