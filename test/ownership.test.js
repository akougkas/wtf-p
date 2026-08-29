#!/usr/bin/env node

const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INSTALL = path.join(ROOT, 'bin', 'install.js');
const UNINSTALL = path.join(ROOT, 'bin', 'uninstall.js');
const {
  assertSafeTarget,
  sha256File
} = require('../bin/lib/ownership');
const { classifyReceiptEntries } = require('../bin/uninstall');
const { collectComponentFiles } = require('../bin/commands/install-logic');
const MANIFEST = require('../bin/lib/manifest');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`\x1b[32m✓\x1b[0m ${name}`);
  } catch (error) {
    failed++;
    console.error(`\x1b[31m✗\x1b[0m ${name}`);
    console.error(`  ${error.stack || error.message}`);
  }
}

function mkdir(directory) {
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function write(filePath, content) {
  mkdir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
  return filePath;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walkFiles(directory, root = directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walkFiles(fullPath, root, files);
    else files.push(path.relative(root, fullPath).split(path.sep).join('/'));
  }
  return files.sort();
}

function spawnNode(args, options) {
  return spawnSync(process.execPath, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    input: options.input,
    timeout: 30000
  });
}

function assertSuccess(result, label) {
  assert.strictEqual(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
}

function assertFailure(result, label) {
  assert.notStrictEqual(
    result.status,
    0,
    `${label} unexpectedly succeeded\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
}

console.log('=== Ownership and Containment Tests ===\n');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-ownership-'));
const fakeHome = mkdir(path.join(sandbox, 'home'));
const project = mkdir(path.join(sandbox, 'project'));
const targets = mkdir(path.join(sandbox, 'targets'));
const outside = mkdir(path.join(sandbox, 'outside'));
const outsideSentinel = write(path.join(outside, 'sentinel.txt'), 'outside-stays-intact\n');
const isolatedEnv = {
  ...process.env,
  HOME: fakeHome,
  USERPROFILE: fakeHome,
  XDG_CONFIG_HOME: path.join(fakeHome, '.config'),
  XDG_DATA_HOME: path.join(fakeHome, '.local', 'share'),
  XDG_STATE_HOME: path.join(fakeHome, '.local', 'state'),
  XDG_CACHE_HOME: path.join(fakeHome, '.cache'),
  CLAUDE_CONFIG_DIR: path.join(fakeHome, 'claude-config'),
  GEMINI_CLI_HOME: path.join(fakeHome, 'gemini-config'),
  OPENCODE_CONFIG_DIR: path.join(fakeHome, 'opencode-config')
};
delete isolatedEnv.FORCE_COLOR;
delete isolatedEnv.NO_COLOR;

try {
  test('CLI modules are silent and side-effect free when imported', () => {
    const before = walkFiles(sandbox);
    for (const script of [INSTALL, UNINSTALL]) {
      const result = spawnNode(['-e', 'require(process.argv[1])', script], {
        cwd: project,
        env: isolatedEnv
      });
      assertSuccess(result, `import ${path.basename(script)}`);
      assert.strictEqual(result.stdout, '');
      assert.strictEqual(result.stderr, '');
    }
    assert.deepStrictEqual(walkFiles(sandbox), before);
  });

  test('bare noninteractive install and uninstall fail without writing', () => {
    const before = walkFiles(sandbox);
    const installResult = spawnNode([INSTALL, '--no-color'], { cwd: project, env: isolatedEnv });
    const uninstallResult = spawnNode([UNINSTALL, '--no-color'], { cwd: project, env: isolatedEnv });
    assertFailure(installResult, 'bare install');
    assertFailure(uninstallResult, 'bare uninstall');
    assert.match(installResult.stderr, /explicit target or scope/i);
    assert.match(uninstallResult.stderr, /explicit target or scope/i);
    assert.deepStrictEqual(walkFiles(sandbox), before);
  });

  test('doctor never treats a custom config root as disposable scratch space', () => {
    const doctorTarget = mkdir(path.join(targets, 'custom-doctor-root'));
    const sentinel = write(path.join(doctorTarget, 'user-settings.json'), '{"keep":true}\n');
    const result = spawnNode([
      INSTALL,
      'doctor',
      '--config-dir', doctorTarget,
      '--no-color'
    ], { cwd: project, env: isolatedEnv });
    assertSuccess(result, 'doctor custom-root check');
    assert.strictEqual(fs.readFileSync(sentinel, 'utf8'), '{"keep":true}\n');
    assert.deepStrictEqual(fs.readdirSync(doctorTarget), ['user-settings.json']);
  });

  test('broad and symlinked-dangerous target roots are rejected', () => {
    assert.throws(() => assertSafeTarget(path.parse(project).root, { homeDir: fakeHome, cwd: project }), /filesystem root/i);
    assert.throws(() => assertSafeTarget(fakeHome, { homeDir: fakeHome, cwd: project }), /home directory/i);
    assert.throws(() => assertSafeTarget(project, { homeDir: fakeHome, cwd: project }), /workspace directory/i);

    const homeLink = path.join(sandbox, 'home-link');
    fs.symlinkSync(fakeHome, homeLink, 'dir');
    assert.throws(() => assertSafeTarget(homeLink, { homeDir: fakeHome, cwd: project }), /home directory/i);
    assert.doesNotThrow(() => assertSafeTarget(path.join(fakeHome, '.claude'), { homeDir: fakeHome, cwd: project }));
  });

  test('package component collection refuses source symlinks', () => {
    const sourceRoot = mkdir(path.join(sandbox, 'source-component'));
    write(path.join(sourceRoot, 'regular.md'), 'safe\n');
    fs.symlinkSync(outsideSentinel, path.join(sourceRoot, 'linked.md'));
    assert.throws(() => collectComponentFiles({
      id: 'test',
      src: sourceRoot,
      dest: 'component'
    }, path.join(targets, 'source-test')), /symbolic link/i);
  });

  const target = path.join(targets, 'claude');
  const unownedHelp = write(path.join(target, 'commands', 'wtfp', 'help.md'), 'user-owned-help\n');
  const foreignPlugin = write(
    path.join(target, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'someone-else' }, null, 2) + '\n'
  );

  test('fresh install records only actual writes with SHA-256', () => {
    const result = spawnNode([
      INSTALL,
      '--global',
      '--config-dir', target,
      '--quiet',
      '--no-color'
    ], { cwd: project, env: isolatedEnv });
    assertSuccess(result, 'fresh custom install');

    assert.strictEqual(fs.readFileSync(unownedHelp, 'utf8'), 'user-owned-help\n');
    assert.strictEqual(readJson(foreignPlugin).name, 'someone-else');

    const receiptPath = path.join(target, '.wtfp-version');
    const receipt = readJson(receiptPath);
    assert.strictEqual(receipt.schemaVersion, 2);
    assert.strictEqual(receipt.product, 'wtf-p');
    assert.strictEqual(receipt.target.canonicalPath, fs.realpathSync(target));
    assert.strictEqual(receipt.runtime, 'claude');
    assert.strictEqual(receipt.scope, 'custom');
    assert.ok(receipt.files.length > 50);
    assert.ok(!receipt.files.some(file => file.path === 'commands/wtfp/help.md'));
    assert.ok(!receipt.files.some(file => file.path === '.claude-plugin/plugin.json'));

    const paths = new Set();
    for (const file of receipt.files) {
      assert.match(file.path, /^(?!\/)(?!\.\.\/).+/);
      assert.match(file.sha256, /^[a-f0-9]{64}$/);
      assert.ok(!paths.has(file.path), `duplicate receipt path: ${file.path}`);
      paths.add(file.path);
      assert.strictEqual(sha256File(path.join(target, ...file.path.split('/'))), file.sha256);
    }

    const planned = [];
    for (const component of MANIFEST.claude.components) {
      collectComponentFiles(component, target, planned);
    }
    assert.strictEqual(receipt.files.length, planned.length);
    assert.ok(receipt.files.every(file => file.path.startsWith('marketplaces/wtfp/')));
    assert.ok(!receipt.files.some(file => file.path.startsWith('plugins/cache/')));
    assert.ok(!receipt.files.some(file => file.path === 'settings.json' || file.path === '.claude.json'));
  });

  test('all-skipped reinstall leaves receipt bytes unchanged', () => {
    const receiptPath = path.join(target, '.wtfp-version');
    const before = fs.readFileSync(receiptPath);
    const result = spawnNode([
      INSTALL,
      '--global',
      '--config-dir', target,
      '--quiet',
      '--no-color'
    ], { cwd: project, env: isolatedEnv });
    assertSuccess(result, 'all-skipped reinstall');
    assert.deepStrictEqual(fs.readFileSync(receiptPath), before);
  });

  test('nested destination symlink aborts before any package write', () => {
    const symlinkTarget = mkdir(path.join(targets, 'symlink-target'));
    const escapedMarketplace = mkdir(path.join(outside, 'escaped-marketplace'));
    fs.symlinkSync(escapedMarketplace, path.join(symlinkTarget, 'marketplaces'), 'dir');

    const result = spawnNode([
      INSTALL,
      '--global',
      '--config-dir', symlinkTarget,
      '--force',
      '--quiet',
      '--no-color'
    ], { cwd: project, env: isolatedEnv });
    assertFailure(result, 'symlink containment install');
    assert.match(result.stderr, /symlink|symbolic link/i);
    assert.deepStrictEqual(walkFiles(symlinkTarget), ['marketplaces']);
    assert.deepStrictEqual(walkFiles(escapedMarketplace), []);
    assert.strictEqual(fs.readFileSync(outsideSentinel, 'utf8'), 'outside-stays-intact\n');
  });

  test('receipt commit failure rolls back every package file', () => {
    const rollbackTarget = mkdir(path.join(targets, 'rollback-target'));
    mkdir(path.join(rollbackTarget, '.wtfp-version'));
    const priorFile = write(
      path.join(rollbackTarget, 'marketplaces', 'wtfp', 'core', 'templates', 'config.json'),
      '{"user":"preimage"}\n'
    );

    const result = spawnNode([
      INSTALL,
      '--global',
      '--config-dir', rollbackTarget,
      '--backup-all',
      '--quiet',
      '--no-color'
    ], { cwd: project, env: isolatedEnv });
    assertFailure(result, 'receipt failure install');
    assert.deepStrictEqual(fs.readdirSync(rollbackTarget).sort(), ['.wtfp-version', 'marketplaces']);
    assert.deepStrictEqual(fs.readdirSync(path.join(rollbackTarget, '.wtfp-version')), []);
    assert.strictEqual(fs.readFileSync(priorFile, 'utf8'), '{"user":"preimage"}\n');
    assert.deepStrictEqual(fs.readdirSync(path.dirname(priorFile)), ['config.json']);
  });

  test('dry-run is byte-preserving and uninstall backup contains exact candidates', () => {
    const dryTarget = mkdir(path.join(targets, 'dry-run'));
    const owned = write(path.join(dryTarget, 'bin', 'owned.js'), 'owned bytes\n');
    const sibling = write(path.join(dryTarget, 'bin', 'user.js'), 'user bytes\n');
    const receiptPath = write(path.join(dryTarget, '.wtfp-version'), JSON.stringify({
      schemaVersion: 2,
      product: 'wtf-p',
      version: 'test',
      target: { canonicalPath: fs.realpathSync(dryTarget) },
      runtime: 'claude',
      scope: 'custom',
      files: [{
        path: 'bin/owned.js',
        sha256: sha256File(owned),
        component: 'scripts',
        action: 'created',
        sourceVersion: 'test',
        installedAt: new Date(0).toISOString()
      }],
      backups: []
    }, null, 2) + '\n');
    const beforeFiles = walkFiles(dryTarget);
    const beforeOwned = fs.readFileSync(owned);
    const beforeReceipt = fs.readFileSync(receiptPath);

    const dryRun = spawnNode([
      UNINSTALL,
      '--claude',
      '--config-dir', dryTarget,
      '--dry-run',
      '--yes',
      '--no-color'
    ], { cwd: project, env: isolatedEnv });
    assertSuccess(dryRun, 'dry-run uninstall');
    assert.deepStrictEqual(walkFiles(dryTarget), beforeFiles);
    assert.deepStrictEqual(fs.readFileSync(owned), beforeOwned);
    assert.deepStrictEqual(fs.readFileSync(receiptPath), beforeReceipt);

    const backed = spawnNode([
      UNINSTALL,
      '--claude',
      '--config-dir', dryTarget,
      '--backup',
      '--yes',
      '--no-color'
    ], { cwd: project, env: isolatedEnv });
    assertSuccess(backed, 'backup uninstall');
    assert.ok(!fs.existsSync(owned));
    assert.ok(fs.existsSync(sibling));
    assert.ok(!fs.existsSync(receiptPath));
    const bundleName = fs.readdirSync(dryTarget).find(name => name.startsWith('.wtfp-backup-'));
    assert.ok(bundleName, 'owned backup bundle was created');
    const bundle = path.join(dryTarget, bundleName);
    assert.strictEqual(fs.readFileSync(path.join(bundle, 'bin', 'owned.js'), 'utf8'), 'owned bytes\n');
    const marker = readJson(path.join(bundle, '.wtfp-backup.json'));
    assert.strictEqual(marker.product, 'wtf-p');
    assert.deepStrictEqual(marker.files.map(file => file.path), ['bin/owned.js']);
  });

  test('uninstall preserves modified files and every unowned sibling', () => {
    const receipt = readJson(path.join(target, '.wtfp-version'));
    const modifiedEntry = receipt.files.find(file => file.path === 'commands/wtfp/new-paper.md') || receipt.files[0];
    const modifiedPath = path.join(target, ...modifiedEntry.path.split('/'));
    fs.appendFileSync(modifiedPath, '\nuser modification\n');

    const sentinels = [
      write(path.join(target, 'bin', 'user-sentinel'), 'user bin\n'),
      write(path.join(target, 'mcp', 'user-sentinel'), 'user mcp\n'),
      write(path.join(target, 'commands', 'wtfp', 'custom-user-command.md'), 'user command\n')
    ];

    const result = spawnNode([
      UNINSTALL,
      '--claude',
      '--config-dir', target,
      '--yes',
      '--no-color'
    ], { cwd: project, env: isolatedEnv });
    assertSuccess(result, 'ordinary exact uninstall');
    assert.match(result.stdout, /Partial uninstall/i);
    assert.ok(fs.existsSync(modifiedPath));
    assert.strictEqual(fs.readFileSync(unownedHelp, 'utf8'), 'user-owned-help\n');
    assert.strictEqual(readJson(foreignPlugin).name, 'someone-else');
    for (const sentinel of sentinels) assert.ok(fs.existsSync(sentinel));

    const residual = readJson(path.join(target, '.wtfp-version'));
    assert.strictEqual(residual.status, 'partial-uninstall');
    assert.deepStrictEqual(residual.files.map(file => file.path), [modifiedEntry.path]);
    assert.strictEqual(residual.files[0].sha256, modifiedEntry.sha256);

    const receiptBytes = fs.readFileSync(path.join(target, '.wtfp-version'));
    const repeat = spawnNode([
      UNINSTALL,
      '--claude',
      '--config-dir', target,
      '--yes',
      '--no-color'
    ], { cwd: project, env: isolatedEnv });
    assertSuccess(repeat, 'idempotent partial uninstall');
    assert.deepStrictEqual(fs.readFileSync(path.join(target, '.wtfp-version')), receiptBytes);

    const forced = spawnNode([
      UNINSTALL,
      '--claude',
      '--config-dir', target,
      '--force',
      '--no-color'
    ], { cwd: project, env: isolatedEnv });
    assertSuccess(forced, 'forced modified-file uninstall');
    assert.ok(!fs.existsSync(modifiedPath));
    assert.ok(!fs.existsSync(path.join(target, '.wtfp-version')));
    assert.ok(fs.existsSync(path.join(target, 'bin', 'user-sentinel')));
    assert.ok(fs.existsSync(path.join(target, 'mcp', 'user-sentinel')));
    assert.ok(fs.existsSync(path.join(target, 'commands', 'wtfp', 'custom-user-command.md')));
  });

  test('legacy receipt is diagnostic by default and exact under force', () => {
    const legacyTarget = mkdir(path.join(targets, 'legacy'));
    const legacyCandidate = write(path.join(legacyTarget, 'bin', 'candidate.js'), 'possibly user owned\n');
    const sibling = write(path.join(legacyTarget, 'bin', 'unowned.js'), 'definitely user owned\n');
    write(path.join(legacyTarget, '.wtfp-version'), JSON.stringify({
      version: '0.5.0',
      manifest: [{ path: './bin/candidate.js', checksum: 'legacy' }]
    }, null, 2));

    const ordinary = spawnNode([
      UNINSTALL,
      '--claude',
      '--config-dir', legacyTarget,
      '--yes',
      '--no-color'
    ], { cwd: project, env: isolatedEnv });
    assertSuccess(ordinary, 'conservative legacy uninstall');
    assert.ok(fs.existsSync(legacyCandidate));
    assert.ok(fs.existsSync(sibling));

    const forced = spawnNode([
      UNINSTALL,
      '--claude',
      '--config-dir', legacyTarget,
      '--force',
      '--no-color'
    ], { cwd: project, env: isolatedEnv });
    assertSuccess(forced, 'forced legacy uninstall');
    assert.ok(!fs.existsSync(legacyCandidate));
    assert.ok(fs.existsSync(sibling));
    assert.ok(!fs.existsSync(path.join(legacyTarget, '.wtfp-version')));
  });

  test('malformed and escaping receipt entries are always unsafe', () => {
    const malformedTarget = mkdir(path.join(targets, 'malformed'));
    const receipt = {
      schemaVersion: 2,
      product: 'wtf-p',
      version: 'test',
      target: { canonicalPath: fs.realpathSync(malformedTarget) },
      files: [
        { path: '../outside/sentinel.txt', sha256: sha256File(outsideSentinel) },
        { path: '/absolute/file', sha256: '0'.repeat(64) },
        { path: '.wtfp-version', sha256: '0'.repeat(64) },
        { path: 'duplicate.txt', sha256: '0'.repeat(64) },
        { path: 'duplicate.txt', sha256: '0'.repeat(64) }
      ]
    };
    const classified = classifyReceiptEntries(malformedTarget, receipt, true);
    assert.strictEqual(classified.length, 5);
    assert.ok(classified.every(item => item.state === 'unsafe'));
    assert.ok(classified.every(item => !item.removable));
    assert.strictEqual(fs.readFileSync(outsideSentinel, 'utf8'), 'outside-stays-intact\n');
  });
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}

console.log(`\n=== Ownership Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exitCode = 1;
