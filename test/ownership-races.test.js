#!/usr/bin/env node

const assert = require('assert');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ownership = require('../bin/lib/ownership');
const {
  applyUninstallPlan,
  createUninstallPlan
} = require('../bin/uninstall');
const {
  collectComponentFiles,
  installWithConflictResolution
} = require('../bin/commands/install-logic');

const ROOT = path.resolve(__dirname, '..');
const INSTALL = path.join(ROOT, 'bin', 'install.js');
const UNINSTALL = path.join(ROOT, 'bin', 'uninstall.js');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
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

function makeReceipt(target, relativePath, filePath) {
  return {
    schemaVersion: 2,
    product: 'wtf-p',
    version: 'test',
    target: { canonicalPath: fs.realpathSync(target) },
    runtime: 'claude',
    scope: 'custom',
    partial: false,
    files: [{
      path: relativePath,
      sha256: ownership.sha256File(filePath),
      component: 'test',
      action: 'created',
      sourceVersion: 'test',
      installedAt: new Date(0).toISOString()
    }],
    backups: []
  };
}

function writeReceipt(target, receipt) {
  return write(
    path.join(target, '.wtfp-version'),
    JSON.stringify(receipt, null, 2) + '\n'
  );
}

function quietOutput() {
  const identity = value => String(value);
  return {
    colors: new Proxy({}, { get: () => identity }),
    log() {},
    verbose() {},
    warn() {},
    error() {}
  };
}

function spawnNode(args, cwd, env) {
  return spawnSync(process.execPath, args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 30000
  });
}

async function main() {
  console.log('=== Ownership Race and Fault-Injection Tests ===\n');
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-races-'));
  const fakeHome = mkdir(path.join(sandbox, 'home'));
  const project = mkdir(path.join(sandbox, 'project'));
  const isolatedEnv = {
    ...process.env,
    HOME: fakeHome,
    USERPROFILE: fakeHome,
    XDG_CONFIG_HOME: path.join(fakeHome, '.config'),
    XDG_DATA_HOME: path.join(fakeHome, '.local', 'share'),
    XDG_STATE_HOME: path.join(fakeHome, '.local', 'state'),
    XDG_CACHE_HOME: path.join(fakeHome, '.cache'),
    CLAUDE_CONFIG_DIR: path.join(fakeHome, 'claude'),
    GEMINI_CLI_HOME: path.join(fakeHome, 'gemini'),
    OPENCODE_CONFIG_DIR: path.join(fakeHome, 'opencode')
  };
  delete isolatedEnv.FORCE_COLOR;

  try {
    await test('atomic publication cannot follow a swapped nested parent outside the target', () => {
      const target = mkdir(path.join(sandbox, 'atomic-parent-target'));
      const parent = mkdir(path.join(target, 'commands'));
      const movedParent = path.join(target, 'commands-moved');
      const outside = mkdir(path.join(sandbox, 'atomic-parent-outside'));
      const sentinel = write(path.join(outside, 'sentinel.txt'), 'outside-original\n');
      const destination = path.join(parent, 'probe.txt');
      const guard = ownership.createTargetGuard(target);
      const originalOpen = fs.openSync;
      let swapped = false;

      fs.openSync = function patchedOpen(filePath, ...args) {
        if (!swapped && typeof filePath === 'string' && path.basename(filePath).startsWith('probe.txt.tmp-')) {
          swapped = true;
          fs.renameSync(parent, movedParent);
          fs.symlinkSync(outside, parent, 'dir');
        }
        return originalOpen.call(fs, filePath, ...args);
      };
      try {
        assert.throws(
          () => ownership.atomicWriteFile(destination, 'payload\n', { targetGuard: guard }),
          /parent changed|symbolic link|symlink/i
        );
      } finally {
        fs.openSync = originalOpen;
      }

      assert.ok(swapped, 'fault hook ran');
      assert.strictEqual(fs.readFileSync(sentinel, 'utf8'), 'outside-original\n');
      assert.ok(!fs.existsSync(path.join(outside, 'probe.txt')));
      assert.deepStrictEqual(fs.readdirSync(movedParent), []);
    });

    await test('exclusive temporary creation refuses a pre-existing symlink', () => {
      const target = mkdir(path.join(sandbox, 'atomic-temp-target'));
      const outside = mkdir(path.join(sandbox, 'atomic-temp-outside'));
      const sentinel = write(path.join(outside, 'sentinel.txt'), 'outside-original\n');
      const destination = path.join(target, 'file.txt');
      const guard = ownership.createTargetGuard(target);
      const suffixBytes = Buffer.from('010203040506', 'hex');
      const suffix = suffixBytes.toString('hex');
      const temporary = `${destination}.tmp-${process.pid}-${suffix}`;
      fs.symlinkSync(sentinel, temporary);
      const originalRandomBytes = crypto.randomBytes;
      crypto.randomBytes = size => size === 6 ? Buffer.from(suffixBytes) : originalRandomBytes(size);
      try {
        assert.throws(
          () => ownership.atomicWriteFile(destination, 'payload\n', { targetGuard: guard }),
          /exist|temporary/i
        );
      } finally {
        crypto.randomBytes = originalRandomBytes;
      }
      assert.strictEqual(fs.readFileSync(sentinel, 'utf8'), 'outside-original\n');
      assert.ok(!fs.existsSync(destination));
      assert.ok(fs.lstatSync(temporary).isSymbolicLink());
    });

    await test('guard-aware APIs reject a different target and arbitrary cleanup records', () => {
      const targetA = mkdir(path.join(sandbox, 'guard-a'));
      const targetB = mkdir(path.join(sandbox, 'guard-b'));
      const guardA = ownership.createTargetGuard(targetA);
      assert.throws(() => ownership.resolveOwnedPath(targetB, 'x.txt', guardA), /does not match/i);
      assert.throws(
        () => ownership.atomicWriteFile(path.join(targetB, 'x.txt'), 'no\n', { targetGuard: guardA }),
        /escapes|does not match/i
      );
      const arbitrary = mkdir(path.join(sandbox, 'arbitrary-empty'));
      const stat = fs.lstatSync(arbitrary);
      const failures = ownership.removeCreatedDirectories([{
        path: arbitrary,
        identity: { dev: String(stat.dev), ino: String(stat.ino) },
        guardId: guardA.id
      }], guardA);
      assert.strictEqual(failures.length, 1);
      assert.ok(fs.existsSync(arbitrary));
      assert.ok(!fs.existsSync(path.join(targetB, 'x.txt')));
    });

    await test('uninstall target-root replacement cannot redirect deletion', () => {
      const target = mkdir(path.join(sandbox, 'uninstall-swap-target'));
      const owned = write(path.join(target, 'bin', 'owned.js'), 'owned\n');
      writeReceipt(target, makeReceipt(target, 'bin/owned.js', owned));
      const guard = ownership.createTargetGuard(target);
      const receiptResult = ownership.readReceipt(target, guard);
      const plan = createUninstallPlan(target, receiptResult, { targetGuard: guard });
      const moved = `${target}-moved`;
      const outside = mkdir(path.join(sandbox, 'uninstall-swap-outside'));
      const outsideFile = write(path.join(outside, 'bin', 'owned.js'), 'outside\n');
      fs.renameSync(target, moved);
      fs.symlinkSync(outside, target, 'dir');

      applyUninstallPlan(plan);
      assert.strictEqual(fs.readFileSync(outsideFile, 'utf8'), 'outside\n');
      assert.strictEqual(fs.readFileSync(path.join(moved, 'bin', 'owned.js'), 'utf8'), 'owned\n');
      assert.strictEqual(plan.items[0].state, 'unsafe');
    });

    await test('uninstall re-hashes immediately and preserves a post-plan edit', () => {
      const target = mkdir(path.join(sandbox, 'uninstall-rehash-target'));
      const owned = write(path.join(target, 'owned.md'), 'installed\n');
      writeReceipt(target, makeReceipt(target, 'owned.md', owned));
      const guard = ownership.createTargetGuard(target);
      const plan = createUninstallPlan(target, ownership.readReceipt(target, guard), { targetGuard: guard });
      fs.writeFileSync(owned, 'concurrent user edit\n');
      applyUninstallPlan(plan);
      assert.strictEqual(fs.readFileSync(owned, 'utf8'), 'concurrent user edit\n');
      assert.strictEqual(plan.items[0].state, 'modified');
      assert.strictEqual(plan.items[0].removed, false);
    });

    await test('uninstall preserves files when its authorizing receipt changes', () => {
      const target = mkdir(path.join(sandbox, 'receipt-race-target'));
      const owned = write(path.join(target, 'owned.md'), 'installed\n');
      const receiptPath = writeReceipt(target, makeReceipt(target, 'owned.md', owned));
      const guard = ownership.createTargetGuard(target);
      const plan = createUninstallPlan(target, ownership.readReceipt(target, guard), { targetGuard: guard });
      fs.appendFileSync(receiptPath, ' ');
      applyUninstallPlan(plan);
      assert.strictEqual(fs.readFileSync(owned, 'utf8'), 'installed\n');
      assert.strictEqual(plan.items[0].state, 'unsafe');
      assert.match(plan.items[0].reason, /receipt changed/i);
    });

    await test('installer rollback preserves a concurrent edit of an earlier destination', async () => {
      const source = mkdir(path.join(sandbox, 'rollback-source'));
      write(path.join(source, 'a.md'), 'new a\n');
      write(path.join(source, 'b.md'), 'new b\n');
      const target = mkdir(path.join(sandbox, 'rollback-concurrent-target'));
      const destA = write(path.join(target, 'commands', 'a.md'), 'old a\n');
      const files = collectComponentFiles({ id: 'commands', src: source, dest: 'commands' }, target);
      const guard = ownership.createTargetGuard(target);
      const originalOpen = fs.openSync;
      let injected = false;
      fs.openSync = function patchedOpen(filePath, ...args) {
        if (!injected && typeof filePath === 'string' && path.basename(filePath).startsWith('b.md.tmp-')) {
          injected = true;
          fs.writeFileSync(destA, 'concurrent user edit\n');
          const error = new Error('injected second-file publication failure');
          error.code = 'EIO';
          throw error;
        }
        return originalOpen.call(fs, filePath, ...args);
      };
      let caught = null;
      try {
        await installWithConflictResolution(files, '/isolated/', target, {
          out: quietOutput(),
          hasForce: true,
          hasBackupAll: false,
          isInteractive: false,
          showExplanations: false,
          targetGuard: guard
        });
      } catch (error) {
        caught = error;
      } finally {
        fs.openSync = originalOpen;
      }
      assert.ok(caught, 'installation failed as injected');
      assert.ok(injected, 'fault hook ran');
      assert.strictEqual(fs.readFileSync(destA, 'utf8'), 'concurrent user edit\n');
      assert.ok(Array.isArray(caught.rollbackFailures) && caught.rollbackFailures.length > 0);
    });

    await test('a transient post-publication temp cleanup failure leaves no residual temp file', async () => {
      const source = mkdir(path.join(sandbox, 'publication-source'));
      write(path.join(source, 'new.md'), 'new payload\n');
      const target = mkdir(path.join(sandbox, 'publication-target'));
      mkdir(path.join(target, 'commands'));
      const files = collectComponentFiles({ id: 'commands', src: source, dest: 'commands' }, target);
      const guard = ownership.createTargetGuard(target);
      const originalUnlink = fs.unlinkSync;
      let injected = false;
      fs.unlinkSync = function patchedUnlink(filePath, ...args) {
        if (!injected && typeof filePath === 'string' && path.basename(filePath).includes('.tmp-')) {
          injected = true;
          const error = new Error('injected transient unlink failure');
          error.code = 'EIO';
          throw error;
        }
        return originalUnlink.call(fs, filePath, ...args);
      };
      try {
        const result = await installWithConflictResolution(files, '/isolated/', target, {
          out: quietOutput(),
          hasForce: true,
          hasBackupAll: false,
          isInteractive: false,
          showExplanations: false,
          targetGuard: guard
        });
        result.commit();
      } finally {
        fs.unlinkSync = originalUnlink;
      }
      assert.ok(injected, 'fault hook ran');
      assert.strictEqual(fs.readFileSync(path.join(target, 'commands', 'new.md'), 'utf8'), 'new payload\n');
      assert.ok(!fs.readdirSync(path.join(target, 'commands')).some(name => name.includes('.tmp-')));
    });

    await test('directory cleanup quarantines rather than deletes a raced replacement', () => {
      const target = mkdir(path.join(sandbox, 'cleanup-target'));
      const guard = ownership.createTargetGuard(target);
      const created = path.join(target, 'created');
      const record = ownership.createOwnedDirectory(guard, created);
      const moved = path.join(target, 'created-owned-moved');
      const originalRename = fs.renameSync;
      let injected = false;
      fs.renameSync = function patchedRename(source, destination, ...args) {
        if (!injected && path.basename(source) === 'created' && path.basename(destination).startsWith('.wtfp-remove-')) {
          injected = true;
          originalRename.call(fs, source, moved);
          fs.mkdirSync(source);
          fs.writeFileSync(path.join(source, 'user-sentinel.txt'), 'preserve me\n');
        }
        return originalRename.call(fs, source, destination, ...args);
      };
      let failures;
      try {
        failures = ownership.removeCreatedDirectories([record], guard);
      } finally {
        fs.renameSync = originalRename;
      }
      assert.ok(injected, 'fault hook ran');
      assert.strictEqual(failures.length, 1);
      assert.ok(fs.existsSync(moved));
      const quarantine = fs.readdirSync(target).find(name => name.startsWith('.wtfp-remove-'));
      assert.ok(quarantine, 'raced replacement was preserved under quarantine');
      assert.strictEqual(fs.readFileSync(path.join(target, quarantine, 'user-sentinel.txt'), 'utf8'), 'preserve me\n');
    });

    await test('malformed v2 and unsupported future receipts fail closed', () => {
      const target = mkdir(path.join(sandbox, 'receipt-schema-target'));
      write(path.join(target, '.wtfp-version'), JSON.stringify({
        schemaVersion: 2,
        product: 'wtf-p',
        version: 'test',
        target: { canonicalPath: fs.realpathSync(target) },
        files: [{ path: '../escape', sha256: 'not-a-hash' }]
      }));
      assert.strictEqual(ownership.readReceipt(target).corrupt, true);

      write(path.join(target, '.wtfp-version'), JSON.stringify({
        schemaVersion: 3,
        product: 'wtf-p',
        version: 'future',
        manifest: []
      }));
      assert.strictEqual(ownership.readReceipt(target).corrupt, true);
    });

    await test('noninteractive mutation requires confirmation and unknown CLI input fails before writes', () => {
      const target = mkdir(path.join(sandbox, 'noninteractive-target'));
      const owned = write(path.join(target, 'owned.md'), 'installed\n');
      writeReceipt(target, makeReceipt(target, 'owned.md', owned));
      const noConfirmation = spawnNode([
        UNINSTALL,
        '--claude', '--config-dir', target, '--no-color'
      ], project, isolatedEnv);
      assert.notStrictEqual(noConfirmation.status, 0);
      assert.match(noConfirmation.stderr, /requires --yes/i);
      assert.strictEqual(fs.readFileSync(owned, 'utf8'), 'installed\n');

      const typoTarget = path.join(sandbox, 'typo-target');
      const typo = spawnNode([
        INSTALL,
        'typo', '--global', '--config-dir', typoTarget, '--no-color'
      ], project, isolatedEnv);
      assert.notStrictEqual(typo.status, 0);
      assert.match(typo.stderr, /unknown command or argument/i);
      assert.ok(!fs.existsSync(typoTarget));

      const badOnly = spawnNode([
        INSTALL,
        '--global', '--config-dir', typoTarget, '--only=imaginary', '--no-color'
      ], project, isolatedEnv);
      assert.notStrictEqual(badOnly.status, 0);
      assert.match(badOnly.stderr, /unknown --only component/i);
      assert.ok(!fs.existsSync(typoTarget));
    });

    await test('all-target operations reject equal client roots before mutation', () => {
      const overlap = path.join(sandbox, 'overlap-target');
      const env = {
        ...isolatedEnv,
        CLAUDE_CONFIG_DIR: overlap,
        GEMINI_CLI_HOME: overlap,
        OPENCODE_CONFIG_DIR: overlap
      };
      const installResult = spawnNode([INSTALL, '--all', '--advanced', '--no-color'], project, env);
      assert.notStrictEqual(installResult.status, 0);
      assert.match(installResult.stderr, /roots overlap/i);
      assert.ok(!fs.existsSync(overlap));

      const uninstallResult = spawnNode([UNINSTALL, '--all', '--dry-run', '--no-color'], project, env);
      assert.notStrictEqual(uninstallResult.status, 0);
      assert.match(uninstallResult.stderr, /targets overlap/i);
      assert.ok(!fs.existsSync(overlap));
    });
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }

  console.log(`\n=== Race Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
