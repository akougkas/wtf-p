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
const ROOT = path.resolve(__dirname, '..');

// A disposable, credential-free Clio profile. Nothing here reads or writes the
// operator's real configuration, data, state, or cache roots.
function clioProbeContext() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-clio-native-'));
  fs.chmodSync(root, 0o700);
  const directory = (name) => path.join(root, name);
  const environment = {
    PATH: '/usr/bin:/bin',
    HOME: root,
    USERPROFILE: root,
    XDG_CONFIG_HOME: directory('xdg-config'),
    XDG_DATA_HOME: directory('xdg-data'),
    XDG_STATE_HOME: directory('xdg-state'),
    XDG_CACHE_HOME: directory('xdg-cache'),
    TMPDIR: directory('tmp'),
    CLIO_CODER_HOME: root,
    CLIO_CODER_CONFIG_DIR: directory('clio-config'),
    CLIO_CODER_DATA_DIR: directory('clio-data'),
    CLIO_CODER_STATE_DIR: directory('clio-state'),
    CLIO_CODER_CACHE_DIR: directory('clio-cache'),
    CLIO_CODER_BIN_DIR: directory('clio-bin'),
    NO_COLOR: '1'
  };
  for (const value of Object.values(environment)) {
    if (typeof value === 'string' && value.startsWith(`${root}${path.sep}`)) {
      fs.mkdirSync(value, { recursive: true });
    }
  }
  return { environment, cleanup() { fs.rmSync(root, { recursive: true, force: true }); } };
}
const entry = process.env.WTFP_CLIO_ENTRY;
assert.ok(entry && path.isAbsolute(entry), 'WTFP_CLIO_ENTRY must name an explicit absolute built CLI file');
assert.ok(fs.statSync(entry).isFile());
const probe = clioProbeContext();
const scratch = probe.environment.HOME;
const wrapperDir = path.join(scratch, 'bin');
fs.mkdirSync(wrapperDir);
fs.writeFileSync(path.join(wrapperDir, 'clio-coder'), `#!${process.execPath}
const args = process.argv.slice(2);
if (process.env.WTFP_TEST_INSPECT_FAILURE === '1' && args[0] === 'library' && args[1] === 'inspect') {
  console.error('injected verification failure after real native installation'); process.exit(1);
}
const result = require('child_process').spawnSync(process.execPath, [${JSON.stringify(entry)}, ...args], {stdio:'inherit'});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
`, { mode: 0o755 });
const env = { ...probe.environment, PATH: `${wrapperDir}${path.delimiter}/usr/bin:/bin` };
function run(file, args, cwd) {
  const result = spawnSync(process.execPath, [file, ...args], { cwd, env, encoding: 'utf8', timeout: 60000 });
  assert.ifError(result.error);
  assert.strictEqual(result.status, 0, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  result.combined = `${result.stdout}${result.stderr}`;
  return result.stdout;
}
function runCombined(file, args, cwd) {
  const result = spawnSync(process.execPath, [file, ...args], { cwd, env, encoding: 'utf8', timeout: 60000 });
  assert.ifError(result.error);
  assert.strictEqual(result.status, 0, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return `${result.stdout}${result.stderr}`;
}
function native(args, cwd) { return run(entry, args, cwd); }
function hash(file) { return createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function installedCopies(listing) {
  assert.ok(Array.isArray(listing.entries), JSON.stringify(listing));
  assert.deepStrictEqual(listing.diagnostics, []);
  return listing.entries.flatMap(item => {
    assert.strictEqual(item.kind, 'plugin');
    assert.ok(Array.isArray(item.installed));
    for (const copy of item.installed) {
      assert.strictEqual(copy.id, item.name);
      assert.ok(['user', 'project'].includes(copy.scope));
      assert.ok(path.isAbsolute(copy.rootPath));
    }
    return item.installed;
  });
}
const installer = path.join(ROOT, 'bin/install.js');
const uninstaller = path.join(ROOT, 'bin/uninstall.js');
try {
  console.log(JSON.stringify({ cli: entry, entrySha256: hash(entry), version: native(['--version'], scratch).trim() }));
  const help = native(['library', '--help'], scratch);
  for (const command of ['install', 'inspect', 'list', 'remove', 'enable', 'disable']) {
    assert.ok(help.includes(`clio-coder library ${command}`), `built CLI does not offer library ${command}`);
  }
  assert.match(help, /--dry-run/);
  const claudeCandidate = JSON.parse(native(['library', 'inspect', path.join(ROOT, 'vendors/claude'), '--user', '--json'], scratch));
  assert.strictEqual(claudeCandidate.valid, true, JSON.stringify(claudeCandidate));
  console.log('PASS library contract precheck and Claude-envelope portable manifest inspection');
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
    const candidate = JSON.parse(native(['library', 'inspect', path.join(ROOT, 'vendors/plugin'), `--${scope}`, '--json'], cwd));
    assert.strictEqual(candidate.valid, true, JSON.stringify(candidate));
    const preview = JSON.parse(native(['library', 'install', path.join(ROOT, 'vendors/plugin'), `--${scope}`, '--dry-run', '--json'], cwd));
    assert.strictEqual(preview.confirmed, false, JSON.stringify(preview));
    assert.ok(!fs.existsSync(path.join(target, 'plugins/wtfp')), 'dry-run installed a package');
    run(path.join(ROOT, 'bin/install.js'), args, cwd);
    const receipt = JSON.parse(fs.readFileSync(path.join(target, '.wtfp-version')));
    assert.ok(receipt.files.every(item => item.path.startsWith('plugins/wtfp/')));
    for (const item of receipt.files) assert.strictEqual(hash(path.join(target, item.path)), item.sha256);
    const listing = JSON.parse(native(['library', 'list', '--kind', 'plugin', '--json'], cwd));
    const plugin = installedCopies(listing).find(item => item.id === 'wtfp' && item.scope === scope);
    for (const flag of ['valid', 'enabled', 'compatible', 'effective', 'loadable']) assert.strictEqual(plugin?.[flag], true, JSON.stringify(plugin));
    const inspected = JSON.parse(native(['library', 'inspect', 'wtfp', `--${scope}`, '--json'], cwd));
    assert.strictEqual(inspected.id, 'wtfp');
    assert.strictEqual(inspected.scope, scope);
    assert.strictEqual(path.resolve(inspected.rootPath), path.join(target, 'plugins/wtfp'));
    assert.deepStrictEqual(inspected.diagnostics, []);
    assert.deepStrictEqual(plugin.diagnostics, []);
    assert.strictEqual(inspected.trust, 'trusted', 'first-party CLI install must not inherit foreign trust');
    const installedRoot = path.join(target, 'plugins/wtfp');
    const agents = native(['agents'], cwd);
    const manifest = JSON.parse(fs.readFileSync(path.join(installedRoot, 'plugin.json')));
    const recipes = manifest.extensions['ai.iowarp.clio'].components.filter(item => item.kind === 'agent');
    const roleCount = fs.readdirSync(path.join(ROOT, 'protocol', 'roles')).filter(file => file.endsWith('.md')).length;
    assert.strictEqual(recipes.length, roleCount);
    const skills = JSON.parse(native(['library', 'skills', '--all', '--json'], cwd));
    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'protocol/catalog.json')));
    for (const skill of catalog.skills) {
      assert.ok(skills.skills.some(item => item.name === skill.id), `missing runtime skill ${skill.id}`);
    }
    for (const recipe of recipes) assert.ok(agents.includes(`wtfp-${recipe.id}`), `missing native recipe ${recipe.id}: ${agents}`);
    for (const fleet of ['wtfp-plan-section', 'wtfp-draft-review']) {
      native(['fleet', 'validate', fleet], cwd);
      native(['fleet', 'graph', fleet], cwd);
    }
    assert.match(native(['run', '/wtfp:help'], cwd), /wtfp:new-paper/);

    // Clio marks a prompt unavailable when any packaged reference in its body
    // fails to resolve inside the installed root, which is how a missing
    // template silently disables an advertised route. Apply the host's rule to
    // every installed prompt and agent against the real installed package.
    const componentPaths = new Map(manifest.extensions['ai.iowarp.clio'].components
      .map(item => [`${item.kind}:${item.id}`, item.path]));
    let resolvedReferences = 0;
    function assertReferencesResolve(file) {
      const body = fs.readFileSync(file, 'utf8');
      for (const match of body.matchAll(/\$\{(pluginRoot|extensionRoot|component:([^}]+))\}(\/[A-Za-z0-9._~%+@/-]*)?/g)) {
        const relative = match[2] === undefined ? '' : componentPaths.get(match[2]);
        assert.ok(relative !== undefined, `${file}: unresolved component reference ${match[2]}`);
        const resolved = path.resolve(installedRoot, `.${relative ? `/${relative}` : ''}${match[3] || ''}`);
        assert.ok(resolved === installedRoot || resolved.startsWith(`${installedRoot}${path.sep}`),
          `${file}: packaged reference escapes the installed root: ${match[0]}`);
        assert.ok(fs.existsSync(resolved), `${file}: packaged reference does not resolve: ${match[0]}`);
        resolvedReferences++;
      }
    }
    function walk(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (entry.name.endsWith('.md')) assertReferencesResolve(file);
      }
    }
    for (const kind of ['prompts', 'agents', 'fleets']) {
      walk(path.join(installedRoot, 'ai.iowarp.clio', kind));
    }
    assert.ok(resolvedReferences > 0, 'no packaged references were checked');

    // The four advertised document routes must reach a real packaged scaffold.
    const documentRoutes = {
      'new-paper': ['templates/paper-outline.md', 'templates/grant-proposal-outline.md'],
      'create-outline': ['templates/paper-outline.md', 'templates/grant-proposal-outline.md'],
      'create-poster': ['templates/poster.md'],
      'create-slides': ['templates/slides.md']
    };
    for (const [action, templates] of Object.entries(documentRoutes)) {
      const prompt = fs.readFileSync(path.join(installedRoot, 'ai.iowarp.clio/prompts/wtfp', `${action}.md`), 'utf8');
      assert.doesNotMatch(prompt, /^WTFP_ACTION_UNAVAILABLE$/m, `${action}: advertised route is not executable`);
      for (const template of templates) {
        assert.ok(prompt.includes('${pluginRoot}/' + template), `${action}: does not bind ${template}`);
        assert.ok(fs.existsSync(path.join(installedRoot, template)), `${action}: ${template} is not installed`);
      }
    }
    console.log(`  ${scope}: ${resolvedReferences} packaged references resolve inside the installed root`);
    console.log(JSON.stringify({ scope, rootPath: inspected.rootPath, valid: inspected.valid,
      enabled: inspected.enabled, trust: inspected.trust, receiptFiles: receipt.files.length,
      agents: recipes.length, skills: catalog.skills.length, fleets: 2 }));
    const stateFile = path.join(target, 'plugins/state.json');
    const before = fs.readFileSync(stateFile);
    run(path.join(ROOT, 'bin/install.js'), args, cwd);
    assert.ok(before.equals(fs.readFileSync(stateFile)), 'idempotent reinstall changed native registration');
    // Enable/disable is the operator's switch and Clio's state. A reinstall
    // must report it, not silently flip it back on.
    native(['library', 'disable', 'wtfp', `--${scope}`, '--json'], cwd);
    const afterDisable = runCombined(path.join(ROOT, 'bin/install.js'), args, cwd);
    assert.match(afterDisable, /installed but disabled/);
    const stillDisabled = installedCopies(JSON.parse(native(['library', 'list', '--kind', 'plugin', '--json'], cwd))).find(item => item.id === 'wtfp' && item.scope === scope);
    assert.strictEqual(stillDisabled?.enabled, false, 'reinstall re-enabled a plugin the operator disabled');
    // A stale native digest forces the registration path again. Clio must
    // retain the existing preference when replacing that registration.
    const staleState = JSON.parse(fs.readFileSync(stateFile));
    staleState.installed.wtfp.contentDigest = '0'.repeat(64);
    fs.writeFileSync(stateFile, JSON.stringify(staleState));
    assert.match(runCombined(installer, args, cwd), /installed but disabled/);
    const repaired = JSON.parse(native(['library', 'inspect', 'wtfp', `--${scope}`, '--json'], cwd));
    assert.strictEqual(repaired.valid, true);
    assert.strictEqual(repaired.enabled, false);
    native(['library', 'enable', 'wtfp', `--${scope}`, '--json'], cwd);
    run(path.join(ROOT, 'bin/uninstall.js'), ['--clio', '--config-dir', target, '--yes', '--no-color'], cwd);
    assert.ok(!fs.existsSync(installedRoot));
    assert.ok(!fs.existsSync(path.join(target, '.wtfp-version')));
    assert.ok(!installedCopies(JSON.parse(native(['library', 'list', '--kind', 'plugin', '--json'], cwd))).some(item => item.id === 'wtfp' && item.scope === scope));
    console.log(`PASS ${scope}: standard inspect, exact receipt, active discovery, agents, both fleets, idempotence, preserved disable preference, native removal`);
  }
  const coexist = path.join(scratch, 'coexist-workspace');
  fs.mkdirSync(coexist);
  const projectTarget = path.join(coexist, '.clio-coder');
  const userTarget = env.CLIO_CODER_CONFIG_DIR;
  const installArgs = target => ['install', 'clio', '--config-dir', target, '--advanced', '--force', '--no-color'];
  run(installer, installArgs(projectTarget), coexist);
  const projectState = fs.readFileSync(path.join(projectTarget, 'plugins/state.json'));
  run(installer, installArgs(userTarget), coexist);
  assert.ok(projectState.equals(fs.readFileSync(path.join(projectTarget, 'plugins/state.json'))));
  const copies = installedCopies(JSON.parse(native(['library', 'list', '--kind', 'plugin', '--json'], coexist))).filter(item => item.id === 'wtfp');
  assert.deepStrictEqual(copies.map(item => item.scope).sort(), ['project', 'user']);
  for (const scope of ['user', 'project']) {
    const selected = JSON.parse(native(['library', 'inspect', 'wtfp', `--${scope}`, '--json'], coexist));
    assert.strictEqual(selected.scope, scope);
    assert.strictEqual(selected.valid, true);
    assert.strictEqual(selected.rootPath, path.join(scope === 'user' ? userTarget : projectTarget, 'plugins/wtfp'));
    const filtered = installedCopies(JSON.parse(native(['library', 'list', '--kind', 'plugin', `--${scope}`, '--json'], coexist))).filter(item => item.id === 'wtfp');
    assert.deepStrictEqual(filtered.map(item => item.scope), [scope]);
  }
  run(uninstaller, ['--clio', '--config-dir', userTarget, '--yes', '--no-color'], coexist);
  assert.ok(projectState.equals(fs.readFileSync(path.join(projectTarget, 'plugins/state.json'))));
  assert.strictEqual(JSON.parse(native(['library', 'inspect', 'wtfp', '--project', '--json'], coexist)).valid, true);
  run(uninstaller, ['--clio', '--config-dir', projectTarget, '--yes', '--no-color'], coexist);
  console.log('PASS coexistence: both installed copies listed, exact scoped inspect/list, user removal preserves project registration');
  for (const scope of ['user', 'project']) {
    const target = scope === 'user' ? userTarget : projectTarget;
    const failed = spawnSync(process.execPath, [installer, ...installArgs(target)], {
      cwd: coexist, env: { ...env, WTFP_TEST_INSPECT_FAILURE: '1' }, encoding: 'utf8', timeout: 60000
    });
    assert.ifError(failed.error);
    assert.notStrictEqual(failed.status, 0);
    assert.match(failed.stdout + failed.stderr, /injected verification failure/);
    assert.doesNotMatch(failed.stdout + failed.stderr, /native rollback also failed/);
    assert.ok(!fs.existsSync(path.join(target, 'plugins/wtfp')));
    assert.ok(!fs.existsSync(path.join(target, '.wtfp-version')));
    assert.ok(!JSON.parse(fs.readFileSync(path.join(target, 'plugins/state.json'))).installed.wtfp);
    assert.ok(!installedCopies(JSON.parse(native(['library', 'list', '--kind', 'plugin', '--json'], coexist))).some(item => item.id === 'wtfp' && item.scope === scope));
    console.log(`PASS ${scope}: real native install/remove compensates injected verification failure; no files, receipt, or registration remain`);
  }
} finally { probe.cleanup(); }
