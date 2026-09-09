#!/usr/bin/env node
'use strict';

// Opt-in integration against an explicitly supplied built Clio CLI. Never use
// the normal profile or resolve an ambient binary as the subject of this test.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { createHash } = require('crypto');
const { clioProbeContext } = require('../bin/lib/native-registration');
const ROOT = path.resolve(__dirname, '..');
const entry = process.env.WTFP_CLIO_ENTRY;
assert.ok(entry && path.isAbsolute(entry), 'WTFP_CLIO_ENTRY must name an explicit absolute built CLI file');
assert.ok(fs.statSync(entry).isFile());
const probe = clioProbeContext({ PATH: '/usr/bin:/bin' });
const scratch = probe.environment.HOME;
const wrapperDir = path.join(scratch, 'bin');
fs.mkdirSync(wrapperDir);
fs.writeFileSync(path.join(wrapperDir, 'clio-coder'), `#!${process.execPath}\nrequire(${JSON.stringify(entry)});\n`, { mode: 0o755 });
const env = { ...probe.environment, PATH: `${wrapperDir}${path.delimiter}/usr/bin:/bin` };
function run(file, args, cwd) {
  const result = spawnSync(process.execPath, [file, ...args], { cwd, env, encoding: 'utf8', timeout: 60000 });
  assert.ifError(result.error);
  assert.strictEqual(result.status, 0, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function native(args, cwd) { return run(entry, args, cwd); }
function hash(file) { return createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
try {
  console.log(JSON.stringify({ cli: entry, entrySha256: hash(entry), version: native(['--version'], scratch).trim() }));
  for (const project of [false, true]) {
    const cwd = path.join(scratch, project ? 'project-workspace' : 'user-workspace');
    fs.mkdirSync(cwd);
    // Fleet write boundaries require an existing checkout. This is fixture
    // setup, not a WTF-P action initializing a researcher's repository.
    for (const args of [['init', '--quiet'], ['-c', 'user.name=WTF-P Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '--allow-empty', '-m', 'fixture']]) {
      const git = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
      assert.strictEqual(git.status, 0, git.stderr);
    }
    const target = project ? path.join(cwd, '.clio-coder') : env.CLIO_CODER_CONFIG_DIR;
    const scope = project ? 'project' : 'user';
    const args = ['install', 'clio', '--config-dir', target, '--advanced', '--force', '--no-color'];
    const candidate = JSON.parse(native(['plugins', 'inspect', path.join(ROOT, 'vendors/plugin'), '--json'], cwd));
    assert.strictEqual(candidate.valid, true, JSON.stringify(candidate));
    run(path.join(ROOT, 'bin/install.js'), args, cwd);
    const receipt = JSON.parse(fs.readFileSync(path.join(target, '.wtfp-version')));
    assert.ok(receipt.files.every(item => item.path.startsWith('plugins/wtfp/')));
    for (const item of receipt.files) assert.strictEqual(hash(path.join(target, item.path)), item.sha256);
    const listing = JSON.parse(native(['plugins', 'list', '--all', '--json'], cwd));
    const plugin = listing.plugins.find(item => item.id === 'wtfp' && item.scope === scope);
    for (const flag of ['valid', 'enabled', 'compatible', 'effective', 'loadable']) assert.strictEqual(plugin?.[flag], true, JSON.stringify(plugin));
    assert.deepStrictEqual(plugin.diagnostics, []);
    const installedRoot = path.join(target, 'plugins/wtfp');
    const agents = native(['agents'], cwd);
    const manifest = JSON.parse(fs.readFileSync(path.join(installedRoot, 'plugin.json')));
    const recipes = manifest.extensions['ai.iowarp.clio'].components.filter(item => item.kind === 'agent');
    assert.strictEqual(recipes.length, 11);
    for (const recipe of recipes) assert.ok(agents.includes(`wtfp-${recipe.id}`), `missing native recipe ${recipe.id}: ${agents}`);
    for (const fleet of ['wtfp-plan-section', 'wtfp-draft-review']) {
      native(['fleet', 'validate', fleet], cwd);
    }
    const stateFile = path.join(target, 'plugins/state.json');
    const before = fs.readFileSync(stateFile);
    run(path.join(ROOT, 'bin/install.js'), args, cwd);
    assert.ok(before.equals(fs.readFileSync(stateFile)), 'idempotent reinstall changed native registration');
    native(['plugins', 'disable', 'wtfp', `--${scope}`], cwd);
    run(path.join(ROOT, 'bin/install.js'), args, cwd);
    const reactivated = JSON.parse(native(['plugins', 'list', '--all', '--json'], cwd)).plugins.find(item => item.id === 'wtfp' && item.scope === scope);
    assert.strictEqual(reactivated?.loadable, true);
    run(path.join(ROOT, 'bin/uninstall.js'), ['--clio', '--config-dir', target, '--yes', '--no-color'], cwd);
    assert.ok(!fs.existsSync(installedRoot));
    assert.ok(!fs.existsSync(path.join(target, '.wtfp-version')));
    assert.ok(!JSON.parse(native(['plugins', 'list', '--all', '--json'], cwd)).plugins.some(item => item.id === 'wtfp' && item.scope === scope));
    console.log(`PASS ${scope}: standard inspect, exact receipt, active discovery, agents, both fleets, idempotence, reactivation, native removal`);
  }
} finally { probe.cleanup(); }
