#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const createTag = args.has('--tag');
const push = args.has('--push');

function usage() {
  process.stdout.write(`WTF-P release finalizer

Usage:
  npm run release -- --dry-run
  npm run release -- --tag
  npm run release -- --tag --push

This script never edits versions or changelog prose and never publishes to npm.
Prepare those reviewable changes first, regenerate adapters, and commit them.

Options:
  --dry-run  Validate and print the release commands without changing Git
  --tag      Create the annotated v<package-version> tag
  --push     Push HEAD to origin/main and the tag (requires --tag)
  --help     Show this help
`);
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
    input: '',
    maxBuffer: 32 * 1024 * 1024,
    timeout: options.timeout || 300000,
    stdio: options.inherit ? 'inherit' : 'pipe'
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = `${result.stdout || ''}${result.stderr || ''}`.trim();
    throw new Error(`${command} ${commandArgs.join(' ')} failed${detail ? `:\n${detail}` : ''}`);
  }
  return result;
}

function output(command, commandArgs, options) {
  return run(command, commandArgs, options).stdout.trim();
}

if (args.has('--help') || args.has('-h')) {
  usage();
  process.exit(0);
}
for (const argument of args) {
  if (!['--dry-run', '--tag', '--push'].includes(argument)) {
    process.stderr.write(`Unknown option: ${argument}\n\n`);
    usage();
    process.exit(2);
  }
}
if (push && !createTag) {
  process.stderr.write('--push requires --tag so an untagged release cannot be pushed.\n');
  process.exit(2);
}
if (dryRun && (createTag || push)) {
  process.stderr.write('--dry-run cannot be combined with --tag or --push.\n');
  process.exit(2);
}

try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const version = packageJson.version;
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`package.json contains an invalid release version: ${version}`);
  }
  const tag = `v${version}`;
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`^## \\[${escapedVersion}\\](?: - \\d{4}-\\d{2}-\\d{2})?$`, 'm').test(changelog)) {
    throw new Error(`CHANGELOG.md has no release heading for ${version}`);
  }

  process.stdout.write(`Finalizing WTF-P ${version}\n`);
  run('npm', ['run', 'preflight'], { inherit: true });

  const branch = output('git', ['branch', '--show-current']);
  const status = output('git', ['status', '--porcelain']);
  const head = output('git', ['rev-parse', 'HEAD']);
  const tagLookup = run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { allowFailure: true });
  const existingTagCommit = tagLookup.status === 0
    ? output('git', ['rev-list', '-n', '1', tag])
    : null;

  process.stdout.write(`\nBranch: ${branch || '(detached)'}\nCommit: ${head}\nTag:    ${tag}\n`);

  if (dryRun) {
    if (status) process.stdout.write('\nDry-run note: the working tree is not clean yet.\n');
    if (branch !== 'main') process.stdout.write(`Dry-run note: final release tagging must occur on main (currently ${branch || 'detached'}).\n`);
    if (existingTagCommit) process.stdout.write(`Dry-run note: ${tag} already points to ${existingTagCommit}.\n`);
    process.stdout.write(`\nFinal commands after merge and review:\n  npm run release -- --tag\n  npm run preflight -- --publish\n  npm publish${version.includes('-') ? ' --tag next' : ''}\n`);
    process.exit(0);
  }

  if (!createTag) {
    process.stdout.write('\nValidation passed. Re-run with --tag after reviewing the commit.\n');
    process.exit(0);
  }
  if (status) throw new Error('release tagging requires a clean working tree');
  if (branch !== 'main') throw new Error(`release tagging requires main; current branch is ${branch || 'detached'}`);
  if (existingTagCommit && existingTagCommit !== head) {
    throw new Error(`${tag} already points to ${existingTagCommit}, not HEAD ${head}`);
  }
  if (!existingTagCommit) {
    run('git', ['tag', '-a', tag, '-m', `Release ${tag}`]);
    process.stdout.write(`Created annotated tag ${tag}.\n`);
  } else {
    process.stdout.write(`${tag} already points to HEAD; no tag mutation needed.\n`);
  }

  if (push) {
    run('git', ['push', 'origin', 'HEAD:main'], { inherit: true });
    run('git', ['push', 'origin', tag], { inherit: true });
    process.stdout.write(`Pushed main and ${tag}.\n`);
  } else {
    process.stdout.write(`Tag remains local. Push explicitly with:\n  npm run release -- --tag --push\n`);
  }
  process.stdout.write(`Before publishing:\n  npm run preflight -- --publish\n  npm publish${version.includes('-') ? ' --tag next' : ''}\n`);
} catch (error) {
  process.stderr.write(`Release finalization failed: ${error.message}\n`);
  process.exit(1);
}
