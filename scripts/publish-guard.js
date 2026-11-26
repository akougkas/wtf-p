#!/usr/bin/env node

'use strict';

// Runs as prepublishOnly, so a bare `npm publish` cannot skip it. 0.8.3 was
// published from a working tree that held uncommitted desk changes, and the
// prepack adapter check passed because the generated files matched their
// changed sources. A release must be exactly its tagged commit.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', input: '', maxBuffer: 64 * 1024 * 1024, timeout: 120000 });
  if (result.error) throw result.error;
  return result;
}

const problems = [];
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const tag = `v${version}`;

const status = run('git', ['status', '--porcelain', '--untracked-files=all']);
if (status.status !== 0) problems.push(`git status failed: ${status.stderr.trim()}`);
else if (status.stdout.trim()) problems.push(`the working tree is not clean:\n${status.stdout.trimEnd()}`);

const exact = run('git', ['describe', '--tags', '--exact-match', 'HEAD']);
if (exact.status !== 0 || exact.stdout.trim() !== tag) problems.push(`HEAD is not tagged ${tag}${exact.status === 0 ? ` (it is tagged ${exact.stdout.trim()})` : ''}`);

// Ignored files never show as changes, yet npm packs them when they sit under a packaged path.
const packed = run('npm', ['pack', '--dry-run', '--json', '--ignore-scripts']);
if (packed.status !== 0) problems.push(`npm pack --dry-run failed: ${packed.stderr.trim().slice(-800)}`);
else {
  const tracked = new Set(run('git', ['ls-files', '-z']).stdout.split('\0').filter(Boolean));
  const untracked = JSON.parse(packed.stdout)[0].files.map((file) => file.path).filter((file) => !tracked.has(file));
  if (untracked.length > 0) problems.push(`the archive would include files git does not track:\n${untracked.slice(0, 20).join('\n')}`);
}

if (problems.length > 0) {
  process.stderr.write(`Refusing to publish @panstudio/panwrite@${version}:\n- ${problems.join('\n- ')}\nPublish only from a clean checkout of tag ${tag}.\n`);
  process.exit(1);
}
process.stdout.write(`@panstudio/panwrite@${version} is exactly tag ${tag}; publishing.\n`);
