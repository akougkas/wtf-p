#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const INSTALL = path.join(ROOT, 'bin', 'install.js');
const UNINSTALL = path.join(ROOT, 'bin', 'uninstall.js');
const RECEIPT = '.wtfp-version';
const MANIFEST = require('../bin/lib/manifest');
const { GENERATOR_VERSION } = require('../bin/lib/adapter-metadata');
const installLogic = require('../bin/commands/install-logic');
const uninstallLogic = require('../bin/uninstall');
const {
  activateNativeRegistration,
  deactivateNativeRegistration
} = require('../bin/lib/native-registration');

const MODERN_TARGETS = {
  clio: {
    configDirEnv: 'CLIO_CODER_CONFIG_DIR',
    defaultDir: '.config/clio-coder',
    source: path.join(ROOT, 'vendors', 'clio'),
    destination: 'extensions/wtf-p',
    resource: '.',
    component: 'extension'
  },
  codex: {
    configDirEnv: 'CODEX_HOME',
    defaultDir: '.codex',
    source: path.join(ROOT, 'vendors', 'codex'),
    destination: 'marketplaces/wtfp',
    resource: 'plugins/wtf-p',
    component: 'bundle'
  },
  copilot: {
    configDirEnv: 'COPILOT_HOME',
    defaultDir: '.copilot',
    source: path.join(ROOT, 'vendors', 'copilot'),
    destination: 'marketplaces/wtfp',
    resource: 'plugins/wtf-p',
    component: 'bundle'
  },
  antigravity: {
    configDirEnv: 'ANTIGRAVITY_HOME',
    defaultDir: '.gemini/config',
    source: path.join(ROOT, 'vendors', 'antigravity'),
    destination: 'sources/wtf-p',
    resource: '.',
    component: 'bundle'
  }
};

const ALL_TARGETS = [
  'antigravity',
  'claude',
  'clio',
  'codex',
  'copilot',
  'gemini',
  'opencode'
];

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-modern-targets-'));
let passed = 0;

function record(name, test) {
  test();
  passed++;
  console.log(`\x1b[32m✓\x1b[0m ${name}`);
}

function isolatedEnvironment() {
  const home = path.join(testRoot, 'home');
  return {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: path.join(testRoot, 'xdg', 'config'),
    XDG_DATA_HOME: path.join(testRoot, 'xdg', 'data'),
    XDG_STATE_HOME: path.join(testRoot, 'xdg', 'state'),
    XDG_CACHE_HOME: path.join(testRoot, 'xdg', 'cache'),
    CLAUDE_CONFIG_DIR: path.join(testRoot, 'clients', 'claude'),
    CLIO_CODER_CONFIG_DIR: path.join(testRoot, 'clients', 'clio'),
    CODEX_HOME: path.join(testRoot, 'clients', 'codex'),
    COPILOT_HOME: path.join(testRoot, 'clients', 'copilot'),
    GEMINI_CLI_HOME: path.join(testRoot, 'clients', 'gemini'),
    OPENCODE_CONFIG_DIR: path.join(testRoot, 'clients', 'opencode'),
    ANTIGRAVITY_HOME: path.join(testRoot, 'clients', 'antigravity'),
    FORCE_COLOR: '',
    NO_COLOR: '1'
  };
}

function run(entrypoint, argv, overrides = {}) {
  const result = spawnSync(process.execPath, [entrypoint, ...argv], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...isolatedEnvironment(), ...overrides },
    input: '',
    timeout: 30000
  });
  return {
    ...result,
    output: `${result.stdout || ''}${result.stderr || ''}`
  };
}

function assertSuccess(result, context) {
  assert.ifError(result.error);
  assert.strictEqual(result.status, 0, `${context}\n${result.output}`);
}

function assertFailure(result, pattern, context) {
  assert.ifError(result.error);
  assert.notStrictEqual(result.status, 0, `${context} unexpectedly succeeded`);
  assert.match(result.output, pattern, result.output);
}

function listRegularFiles(root) {
  const files = [];

  function visit(current, relative) {
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      const nextRelative = path.join(relative, entry.name);
      const stat = fs.lstatSync(absolute);
      assert.strictEqual(stat.isSymbolicLink(), false, `generated bundle contains a symlink: ${absolute}`);
      if (stat.isDirectory()) visit(absolute, nextRelative);
      else if (stat.isFile()) files.push(nextRelative.split(path.sep).join('/'));
      else assert.fail(`generated bundle contains an unsupported entry: ${absolute}`);
    }
  }

  visit(root, '');
  return files;
}

function assertPortableContract(root, context) {
  const files = listRegularFiles(root);
  const skills = files.filter(file => /^skills\/wtfp-[^/]+\/SKILL\.md$/.test(file));
  const commands = files.filter(file => /^actions\/[^/]+\.json$/.test(file));
  const agents = files.filter(file => /^roles\/[^/]+\.md$/.test(file));
  assert.strictEqual(skills.length, 7, `${context} must contain exactly seven portable skills`);
  assert.strictEqual(commands.length, 36, `${context} must contain exactly 36 canonical actions`);
  assert.strictEqual(agents.length, 11, `${context} must contain exactly 11 portable roles`);
}

function withEnvironment(changes, test) {
  const previous = new Map();
  for (const [name, value] of Object.entries(changes)) {
    previous.set(name, process.env[name]);
    if (value === null) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    return test();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function createNativeRunner(runtime, native, targetDir) {
  const state = { marketplace: false, plugin: false, calls: [] };
  const source = path.join(targetDir, native.source);

  function result(status = 0, stdout = '', stderr = '') {
    return { status, stdout, stderr, error: null };
  }

  function runner(command, args) {
    state.calls.push([command, ...args]);
    const joined = args.join(' ');

    if (joined.startsWith('plugin marketplace list')) {
      if (runtime === 'claude') {
        return result(0, JSON.stringify(state.marketplace ? [{
          name: native.marketplace,
          path: source,
          installLocation: source
        }] : []));
      }
      if (runtime === 'codex') {
        return result(0, JSON.stringify({
          marketplaces: state.marketplace ? [{ name: native.marketplace, root: source }] : []
        }));
      }
      return result(0, state.marketplace
        ? `Registered marketplaces:\n  • ${native.marketplace} (Local: ${source})\n`
        : 'Registered marketplaces:\n');
    }

    if (joined.startsWith('plugin marketplace add')) {
      state.marketplace = true;
      return result();
    }
    if (joined.startsWith('plugin marketplace remove')) {
      if (!state.marketplace) return result(1, '', `Marketplace ${native.marketplace} is not registered`);
      state.marketplace = false;
      return result();
    }

    if (joined.startsWith('plugin install') ||
        (runtime === 'codex' && joined.startsWith('plugin add')) ||
        (runtime === 'antigravity' && joined.startsWith('plugin install'))) {
      state.plugin = true;
      return result(0, `${native.plugin} installed\n`);
    }
    if (joined.startsWith('plugin uninstall') || joined.startsWith('plugin remove')) {
      if (!state.plugin) return result(1, '', `Plugin ${native.plugin} is not installed`);
      state.plugin = false;
      return result();
    }
    if (joined.startsWith('plugin list')) {
      if (runtime === 'claude') {
        return result(0, JSON.stringify(state.plugin
          ? [{ id: native.selector, enabled: true }]
          : []));
      }
      if (runtime === 'codex') {
        return result(0, JSON.stringify({
          installed: state.plugin ? [{ pluginId: native.selector, installed: true }] : [],
          available: []
        }));
      }
      return result(0, state.plugin ? `${native.plugin}\n` : 'No plugins installed\n');
    }

    throw new Error(`Unexpected fake ${runtime} command: ${command} ${joined}`);
  }

  return { runner, state };
}

try {
  record('manifest exposes seven distinct first-class runtime ids', () => {
    assert.deepStrictEqual(Object.keys(MANIFEST).sort(), ALL_TARGETS);
  });

  record('current Gemini and OpenCode roots match their official client layouts', () => {
    assert.strictEqual(MANIFEST.gemini.configDirEnv, 'GEMINI_CLI_HOME');
    assert.strictEqual(MANIFEST.gemini.envSubdir, '.gemini');
    assert.strictEqual(MANIFEST.gemini.defaultDir, '.gemini');
    assert.deepStrictEqual(MANIFEST.gemini.discovery, {
      kind: 'directory',
      path: 'extensions/wtf-p'
    });
    assert.strictEqual(MANIFEST.opencode.defaultDir, '.config/opencode');

    const geminiHomeOverride = path.join(testRoot, 'gemini-home-override');
    withEnvironment({ GEMINI_CLI_HOME: geminiHomeOverride }, () => {
      const expected = path.join(geminiHomeOverride, '.gemini');
      assert.strictEqual(installLogic.getVendorDir('gemini', null), expected);
      assert.strictEqual(uninstallLogic.getVendorDir('gemini', null), expected);
    });
  });

  record('every generated adapter carries the complete portable contract', () => {
    const resourceRoots = {
      antigravity: path.join(ROOT, 'vendors', 'antigravity'),
      claude: path.join(ROOT, 'vendors', 'claude'),
      clio: path.join(ROOT, 'vendors', 'clio'),
      codex: path.join(ROOT, 'vendors', 'codex', 'plugins', 'wtf-p'),
      copilot: path.join(ROOT, 'vendors', 'copilot', 'plugins', 'wtf-p'),
      gemini: path.join(ROOT, 'vendors', 'gemini'),
      opencode: path.join(ROOT, 'vendors', 'opencode')
    };
    for (const [runtime, resourceRoot] of Object.entries(resourceRoots)) {
      assertPortableContract(resourceRoot, `${runtime} generated adapter`);
    }
  });

  record('native marketplace lifecycle is idempotent and collision-safe', () => {
    for (const runtime of ['claude', 'codex', 'copilot', 'antigravity']) {
      const native = MANIFEST[runtime].native;
      const targetDir = runtime === 'antigravity'
        ? path.join(testRoot, 'native-fake', runtime, '.gemini', 'config')
        : path.join(testRoot, 'native-fake', runtime);
      const fake = createNativeRunner(runtime, native, targetDir);
      const options = { runner: fake.runner, environment: {} };

      assert.strictEqual(
        activateNativeRegistration(runtime, targetDir, native, options).status,
        'registered'
      );
      assert.strictEqual(
        activateNativeRegistration(runtime, targetDir, native, options).status,
        'registered'
      );
      if (native.marketplace) {
        const adds = fake.state.calls.filter(call => call.slice(1, 4).join(' ') === 'plugin marketplace add');
        assert.strictEqual(adds.length, 1, `${runtime} should add its marketplace only once`);
      }
      const pluginAdds = fake.state.calls.filter(call => {
        const args = call.slice(1).join(' ');
        return args.startsWith('plugin install') ||
          (runtime === 'codex' && args.startsWith('plugin add'));
      });
      assert.strictEqual(pluginAdds.length, 1, `${runtime} should install its plugin only once`);
      assert.strictEqual(
        deactivateNativeRegistration(runtime, targetDir, native, options).status,
        'unregistered'
      );
      assert.strictEqual(
        deactivateNativeRegistration(runtime, targetDir, native, options).status,
        'unregistered'
      );
    }

    for (const runtime of ['claude', 'codex', 'copilot']) {
      const native = MANIFEST[runtime].native;
      const targetDir = path.join(testRoot, 'native-collision', runtime);
      const foreignSource = path.join(testRoot, 'foreign', runtime);
      let mutationAttempted = false;
      const runner = (command, args) => {
        if (args.join(' ').startsWith('plugin marketplace list')) {
          if (runtime === 'claude') {
            return { status: 0, stdout: JSON.stringify([{
              name: native.marketplace,
              path: foreignSource,
              installLocation: foreignSource
            }]), stderr: '' };
          }
          if (runtime === 'codex') {
            return { status: 0, stdout: JSON.stringify({
              marketplaces: [{ name: native.marketplace, root: foreignSource }]
            }), stderr: '' };
          }
          return {
            status: 0,
            stdout: `Registered marketplaces:\n  • ${native.marketplace} (Local: ${foreignSource})\n`,
            stderr: ''
          };
        }
        mutationAttempted = true;
        return { status: 0, stdout: '', stderr: '' };
      };
      assert.throws(
        () => activateNativeRegistration(runtime, targetDir, native, { runner, environment: {} }),
        /already registered to/
      );
      assert.strictEqual(mutationAttempted, false, `${runtime} mutated a colliding marketplace`);
    }
  });

  record('Clio capability probing is isolated and fails closed on missing resource kinds', () => {
    const native = MANIFEST.clio.native;
    const targetDir = path.join(testRoot, 'native-fake', 'clio');
    const expectedSource = path.join(targetDir, native.source);
    let observedEnvironment = null;
    const compatibleRunner = (command, args, options) => {
      assert.strictEqual(command, 'clio-coder');
      assert.deepStrictEqual(args, ['extensions', 'discover', expectedSource, '--json']);
      observedEnvironment = options.env;
      return {
        status: 0,
        stdout: JSON.stringify({
          candidates: [{
            valid: true,
            manifest: { resources: native.requiredResources },
            diagnostics: []
          }]
        }),
        stderr: ''
      };
    };
    const compatible = activateNativeRegistration('clio', targetDir, native, {
      runner: compatibleRunner,
      environment: { PATH: process.env.PATH, SECRET_SENTINEL: 'must-not-leak' }
    });
    assert.strictEqual(compatible.status, 'compatible');
    assert.strictEqual(observedEnvironment.SECRET_SENTINEL, undefined);
    assert.strictEqual(observedEnvironment.CLIO_CODER_REQUIRE_HOME_PREFIX, '1');
    assert.ok(observedEnvironment.CLIO_CODER_STATE_DIR.startsWith(os.tmpdir()));
    assert.strictEqual(fs.existsSync(observedEnvironment.HOME), false, 'Clio probe home was not removed');

    const incompatible = activateNativeRegistration('clio', targetDir, native, {
      runner: () => ({
        status: 0,
        stdout: JSON.stringify({
          candidates: [{
            valid: true,
            manifest: { resources: { skills: 'skills', prompts: 'prompts' } },
            diagnostics: []
          }]
        }),
        stderr: ''
      }),
      environment: { PATH: process.env.PATH }
    });
    assert.strictEqual(incompatible.status, 'incompatible');
    assert.match(incompatible.reason, /resources\.agents/);
  });

  record('native registration compensates a partial marketplace transaction', () => {
    const runtime = 'claude';
    const native = MANIFEST[runtime].native;
    const targetDir = path.join(testRoot, 'native-rollback', runtime);
    const fake = createNativeRunner(runtime, native, targetDir);
    const runner = (command, args, options) => {
      if (args.join(' ').startsWith('plugin install')) {
        fake.state.calls.push([command, ...args]);
        fake.state.plugin = true;
        return { status: 9, stdout: '', stderr: 'injected plugin install failure', error: null };
      }
      return fake.runner(command, args, options);
    };
    assert.throws(
      () => activateNativeRegistration(runtime, targetDir, native, { runner, environment: {} }),
      /injected plugin install failure/
    );
    assert.strictEqual(fake.state.marketplace, false, 'new marketplace survived failed activation');
    assert.strictEqual(fake.state.plugin, false, 'plugin survived failed activation');
    assert.ok(fake.state.calls.some(call => call.slice(1, 4).join(' ') === 'plugin marketplace remove'));
  });

  record('native activation rollback removes only state created by that activation', () => {
    const runtime = 'claude';
    const native = MANIFEST[runtime].native;
    const targetDir = path.join(testRoot, 'native-exact-rollback', runtime);
    const created = createNativeRunner(runtime, native, targetDir);
    const activation = activateNativeRegistration(runtime, targetDir, native, {
      runner: created.runner,
      environment: {}
    });
    assert.strictEqual(activation.status, 'registered');
    assert.deepStrictEqual(activation.rollback(), []);
    assert.strictEqual(created.state.marketplace, false);
    assert.strictEqual(created.state.plugin, false);

    const preexisting = createNativeRunner(runtime, native, targetDir);
    preexisting.state.plugin = true;
    const retained = activateNativeRegistration(runtime, targetDir, native, {
      runner: preexisting.runner,
      environment: {}
    });
    assert.strictEqual(retained.status, 'registered');
    assert.deepStrictEqual(retained.rollback(), []);
    assert.strictEqual(preexisting.state.marketplace, false);
    assert.strictEqual(preexisting.state.plugin, true, 'rollback removed a pre-existing plugin');
    assert.strictEqual(
      preexisting.state.calls.some(call => call.slice(1, 3).join(' ') === 'plugin install'),
      false,
      'activation reinstalled a pre-existing plugin'
    );
  });

  record('native rollback surfaces an unavailable executable without claiming cleanup', () => {
    const runtime = 'claude';
    const native = MANIFEST[runtime].native;
    const targetDir = path.join(testRoot, 'native-unavailable-rollback', runtime);
    const fake = createNativeRunner(runtime, native, targetDir);
    let disappeared = false;
    const runner = (command, args, options) => {
      if (disappeared) {
        return { status: null, stdout: '', stderr: '', error: { code: 'ENOENT' } };
      }
      if (args.join(' ').startsWith('plugin install')) {
        fake.state.calls.push([command, ...args]);
        disappeared = true;
        return { status: null, stdout: '', stderr: '', error: { code: 'ENOENT' } };
      }
      return fake.runner(command, args, options);
    };
    let failure;
    try {
      activateNativeRegistration(runtime, targetDir, native, { runner, environment: {} });
    } catch (error) {
      failure = error;
    }
    assert.ok(failure, 'activation falsely reported a clean unavailable result');
    assert.match(failure.message, /rollback did not complete/);
    assert.ok(failure.nativeRollbackFailures.length > 0);
    assert.strictEqual(fake.state.marketplace, true, 'fixture should retain the unremovable marketplace');
  });

  record('plugin rollback failure preserves its marketplace source', () => {
    const runtime = 'claude';
    const native = MANIFEST[runtime].native;
    const targetDir = path.join(testRoot, 'native-plugin-rollback-failure', runtime);
    const fake = createNativeRunner(runtime, native, targetDir);
    let failPluginRemoval = false;
    const runner = (command, args, options) => {
      if (failPluginRemoval && args.join(' ').startsWith('plugin uninstall')) {
        fake.state.calls.push([command, ...args]);
        return { status: 7, stdout: '', stderr: 'injected uninstall failure', error: null };
      }
      return fake.runner(command, args, options);
    };
    const activation = activateNativeRegistration(runtime, targetDir, native, {
      runner,
      environment: {}
    });
    failPluginRemoval = true;
    const failures = activation.rollback();
    assert.ok(failures.some((failure) => /injected uninstall failure/.test(failure)));
    assert.ok(failures.some((failure) => /marketplace was preserved/.test(failure)));
    assert.strictEqual(fake.state.plugin, true);
    assert.strictEqual(fake.state.marketplace, true);
    assert.strictEqual(
      fake.state.calls.some(call => call.slice(1, 4).join(' ') === 'plugin marketplace remove'),
      false,
      'rollback orphaned a plugin by removing its marketplace'
    );
  });

  record('receipt failure compensates native registration before rolling back staged files', () => {
    const fakeBin = path.join(testRoot, 'transaction-native-bin');
    const statePath = path.join(testRoot, 'transaction-native-state.json');
    const targetDir = path.join(testRoot, 'transaction-receipt-failure');
    const source = path.join(targetDir, MANIFEST.claude.native.source);
    fs.mkdirSync(fakeBin, { recursive: true });
    const executable = path.join(fakeBin, 'claude');
    fs.writeFileSync(executable, `#!/usr/bin/env node
const fs = require('fs');
const statePath = process.env.WTFP_NATIVE_STATE;
const source = process.env.WTFP_NATIVE_SOURCE;
const receiptPath = process.env.WTFP_RECEIPT_PATH;
const args = process.argv.slice(2).join(' ');
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
  : { marketplace: false, plugin: false };
if (args.startsWith('plugin marketplace list')) {
  process.stdout.write(JSON.stringify(state.marketplace ? [{ name: 'wtfp', path: source, installLocation: source }] : []));
} else if (args.startsWith('plugin marketplace add')) {
  state.marketplace = true;
} else if (args.startsWith('plugin marketplace remove')) {
  state.marketplace = false;
} else if (args.startsWith('plugin install')) {
  state.plugin = true;
} else if (args.startsWith('plugin uninstall')) {
  state.plugin = false;
} else if (args.startsWith('plugin list')) {
  process.stdout.write(JSON.stringify(state.plugin ? [{ id: 'wtfp@wtfp', enabled: true }] : []));
  if (state.plugin) fs.mkdirSync(receiptPath, { recursive: true });
} else {
  process.stderr.write('unexpected command: ' + args);
  process.exitCode = 2;
}
fs.writeFileSync(statePath, JSON.stringify(state));
`);
    fs.chmodSync(executable, 0o755);

    const result = run(INSTALL, [
      'install', 'claude',
      '--config-dir', targetDir,
      '--force', '--advanced', '--quiet', '--no-color'
    ], {
      PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
      WTFP_NATIVE_STATE: statePath,
      WTFP_NATIVE_SOURCE: source,
      WTFP_RECEIPT_PATH: path.join(targetDir, RECEIPT)
    });
    assertFailure(result, /ownership receipt failed/, 'transactional receipt failure');
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(statePath, 'utf8')), {
      marketplace: false,
      plugin: false
    });
    assert.deepStrictEqual(fs.readdirSync(targetDir), [RECEIPT]);
  });

  record('a conflicted partial bundle is never newly registered as native', () => {
    const fakeBin = path.join(testRoot, 'partial-native-bin');
    const calledPath = path.join(testRoot, 'partial-native-called');
    const targetDir = path.join(testRoot, 'partial-native-target');
    const preserved = path.join(targetDir, 'marketplaces', 'wtfp', '.wtfp-generated.json');
    fs.mkdirSync(fakeBin, { recursive: true });
    fs.mkdirSync(path.dirname(preserved), { recursive: true });
    fs.writeFileSync(preserved, 'operator-owned conflict\n');
    const executable = path.join(fakeBin, 'claude');
    fs.writeFileSync(executable, `#!/usr/bin/env node
require('fs').writeFileSync(process.env.WTFP_NATIVE_CALLED, process.argv.slice(2).join(' '));
process.exitCode = 91;
`);
    fs.chmodSync(executable, 0o755);

    const result = run(INSTALL, [
      'install', 'claude',
      '--config-dir', targetDir,
      '--advanced', '--quiet', '--no-color'
    ], {
      PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
      WTFP_NATIVE_CALLED: calledPath
    });
    assertSuccess(result, 'partial bundle install');
    assert.strictEqual(fs.existsSync(calledPath), false, 'partial bundle invoked native registration');
    assert.strictEqual(fs.readFileSync(preserved, 'utf8'), 'operator-owned conflict\n');
    const receipt = JSON.parse(fs.readFileSync(path.join(targetDir, RECEIPT), 'utf8'));
    assert.strictEqual(receipt.partial, true);
    assert.strictEqual(
      receipt.files.some((entry) => entry.path === 'marketplaces/wtfp/.wtfp-generated.json'),
      false,
      'receipt claimed ownership of the preserved conflict'
    );
  });

  record('Claude, Gemini, and OpenCode full installs include their generated adapter roots', () => {
    const installedRoots = {
      claude: 'marketplaces/wtfp',
      gemini: 'extensions/wtf-p',
      opencode: '.'
    };
    for (const [runtime, generatedRoot] of Object.entries(installedRoots)) {
      const targetDir = path.join(testRoot, 'complete-generated', runtime);
      const result = run(INSTALL, [
        'install', runtime,
        '--config-dir', targetDir,
        '--force', '--advanced', '--quiet', '--no-color'
      ]);
      assertSuccess(result, `${runtime} complete generated install`);
      const installedRoot = path.join(targetDir, generatedRoot);
      assert.ok(fs.existsSync(path.join(installedRoot, '.wtfp-generated.json')));
      assertPortableContract(installedRoot, `${runtime} installed adapter`);
    }
  });

  for (const [runtime, expected] of Object.entries(MODERN_TARGETS)) {
    record(`${runtime} points at its generated self-contained bundle`, () => {
      const target = MANIFEST[runtime];
      assert.ok(target, `missing ${runtime} manifest`);
      assert.strictEqual(target.configDirEnv, expected.configDirEnv);
      assert.strictEqual(target.defaultDir, expected.defaultDir);
      assert.strictEqual(target.components.length, 1);
      assert.strictEqual(target.components[0].id, expected.component);
      assert.strictEqual(target.components[0].src, expected.source);
      assert.strictEqual(target.components[0].dest, expected.destination);
      assert.strictEqual(target.components[0].type, 'dir');
    });

    record(`${runtime} resolves explicit, environment, and default roots consistently`, () => {
      const explicit = path.join(testRoot, 'explicit', runtime);
      const environment = path.join(testRoot, 'environment', runtime);
      withEnvironment({ [expected.configDirEnv]: environment }, () => {
        assert.strictEqual(installLogic.getVendorDir(runtime, explicit), explicit);
        assert.strictEqual(uninstallLogic.getVendorDir(runtime, explicit), explicit);
        assert.strictEqual(installLogic.getVendorDir(runtime, null), environment);
        assert.strictEqual(uninstallLogic.getVendorDir(runtime, null), environment);
      });
      withEnvironment({ [expected.configDirEnv]: null }, () => {
        const defaultRoot = path.join(os.homedir(), expected.defaultDir);
        assert.strictEqual(installLogic.getVendorDir(runtime, null), defaultRoot);
        assert.strictEqual(uninstallLogic.getVendorDir(runtime, null), defaultRoot);
      });
    });
  }

  record('help documents positional vNext grammar and every compatibility selector', () => {
    const result = run(INSTALL, ['--help', '--no-color']);
    assertSuccess(result, 'installer help');
    assert.match(result.output, /wtf-p install <target>/);
    for (const target of ALL_TARGETS) {
      assert.match(result.output, new RegExp(`\\b${target}\\b`), `help omits ${target}`);
    }
    for (const flag of ['--clio', '--claude', '--codex', '--copilot', '--opencode', '--antigravity', '--gemini']) {
      assert.ok(result.output.includes(flag) || result.output.includes('--<target>'), `help omits ${flag}`);
    }
    assert.match(result.output, /deprecated alias/);
  });

  record('noninteractive install still fails closed without explicit intent', () => {
    const noTarget = run(INSTALL, ['--advanced', '--quiet', '--no-color']);
    assertFailure(noTarget, /requires an explicit target or scope/i, 'targetless install');
    const configOnly = run(INSTALL, [
      '--advanced', '--quiet', '--no-color', '--config-dir', path.join(testRoot, 'config-only')
    ]);
    assertFailure(configOnly, /requires an explicit target or scope/i, 'config-only install');
    assert.strictEqual(fs.existsSync(path.join(testRoot, 'config-only')), false);
  });

  record('positional targets reject unknown, duplicate, and mixed selectors', () => {
    assertFailure(
      run(INSTALL, ['install', 'unknown-client', '--advanced', '--quiet']),
      /Unknown install target: unknown-client/,
      'unknown positional target'
    );
    assertFailure(
      run(INSTALL, ['install', 'clio', 'codex', '--advanced', '--quiet']),
      /exactly one target/,
      'duplicate positional targets'
    );
    assertFailure(
      run(INSTALL, ['install', 'clio', '--clio', '--advanced', '--quiet']),
      /either `install <target>` or a compatibility target flag/,
      'mixed target forms'
    );
  });

  record('removed MCP component selector fails before creating a target', () => {
    const targetDir = path.join(testRoot, 'removed-mcp-component');
    const result = run(INSTALL, [
      'install', 'claude', '--only=mcp', '--config-dir', targetDir,
      '--advanced', '--quiet', '--no-color'
    ]);
    assertFailure(result, /Unknown --only component: mcp/, 'removed MCP component selector');
    assert.strictEqual(fs.existsSync(targetDir), false);
  });

  record('modern compatibility target flags dispatch without implicit fallback', () => {
    for (const runtime of ALL_TARGETS) {
      const nonMatchingComponent = runtime === 'clio' ? 'plugin' : 'extension';
      const targetDir = path.join(testRoot, 'compatibility-flags', runtime);
      const result = run(INSTALL, [
        `--${runtime}`,
        `--only=${nonMatchingComponent}`,
        '--config-dir', targetDir,
        '--advanced', '--quiet', '--no-color'
      ]);
      assertSuccess(result, `${runtime} compatibility selector`);
      assert.strictEqual(
        fs.existsSync(targetDir),
        false,
        `${runtime} selector unexpectedly installed another runtime's component`
      );
    }
  });

  record('all-target planning rejects overlapping client roots before writing', () => {
    const overlapRoot = path.join(testRoot, 'overlap');
    const result = run(INSTALL, ['--all', '--advanced', '--quiet', '--no-color'], {
      CLIO_CODER_CONFIG_DIR: path.join(overlapRoot, 'client'),
      CODEX_HOME: path.join(overlapRoot, 'client', 'nested')
    });
    assertFailure(result, /install roots overlap/i, 'overlapping all-target install');
    assert.strictEqual(fs.existsSync(overlapRoot), false);
  });

  record('uninstall parser recognizes every target and preserves legacy aliases', () => {
    for (const runtime of ALL_TARGETS) {
      const parsed = uninstallLogic.parseArgs([`--${runtime}`, '--dry-run']);
      assert.strictEqual(parsed.selectedTarget, runtime);
    }
    assert.strictEqual(uninstallLogic.parseArgs(['--global', '--dry-run']).hasGlobal, true);
    assert.strictEqual(uninstallLogic.parseArgs(['--local', '--dry-run']).hasLocal, true);
    assert.throws(
      () => uninstallLogic.parseArgs(['--clio', '--codex']),
      /Choose one target/
    );
  });

  for (const [runtime, expected] of Object.entries(MODERN_TARGETS)) {
    record(`${runtime} installs its bundle with a v2 receipt and uninstalls exact owned files`, () => {
      assert.ok(fs.existsSync(expected.source), `generated ${runtime} bundle is missing: ${expected.source}`);
      const sourceFiles = listRegularFiles(expected.source);
      assert.ok(sourceFiles.length > 0, `generated ${runtime} bundle is empty`);

      const targetDir = path.join(testRoot, 'roundtrip', runtime);
      const installResult = run(INSTALL, [
        'install', runtime,
        '--config-dir', targetDir,
        '--force', '--advanced', '--quiet', '--no-color'
      ]);
      assertSuccess(installResult, `${runtime} install`);

      const reinstallResult = run(INSTALL, [
        'install', runtime,
        '--config-dir', targetDir,
        '--force', '--advanced', '--quiet', '--no-color'
      ]);
      assertSuccess(reinstallResult, `${runtime} idempotent reinstall`);

      const receiptPath = path.join(targetDir, RECEIPT);
      assert.ok(fs.existsSync(receiptPath), `${runtime} install omitted its receipt`);
      const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
      assert.strictEqual(receipt.schemaVersion, 2);
      assert.strictEqual(receipt.runtime, runtime);
      assert.strictEqual(receipt.scope, 'custom');
      assert.strictEqual(receipt.partial, false);
      assert.strictEqual(receipt.adapterVersion, 1);
      assert.strictEqual(receipt.generatorVersion, GENERATOR_VERSION);
      assert.strictEqual(receipt.files.length, sourceFiles.length);
      const allowedComponents = new Set([
        expected.component,
        ...Object.values(MANIFEST[runtime].components[0].componentIds || {})
      ]);
      assert.ok(receipt.files.every(file => allowedComponents.has(file.component)));

      for (const relative of sourceFiles) {
        const installedRelative = path.posix.join(expected.destination, relative);
        assert.ok(
          receipt.files.some(file => file.path === installedRelative),
          `${runtime} receipt omits ${installedRelative}`
        );
        assert.ok(fs.existsSync(path.join(targetDir, ...installedRelative.split('/'))));
      }

      assertPortableContract(
        path.join(targetDir, expected.destination, expected.resource),
        `${runtime} installed adapter`
      );

      const sentinel = path.join(targetDir, 'user-owned-sentinel.txt');
      fs.writeFileSync(sentinel, `${runtime} user data\n`);
      const uninstallResult = run(UNINSTALL, [
        `--${runtime}`,
        '--config-dir', targetDir,
        '--yes', '--quiet', '--no-color'
      ]);
      assertSuccess(uninstallResult, `${runtime} uninstall`);

      const repeatedUninstall = run(UNINSTALL, [
        `--${runtime}`,
        '--config-dir', targetDir,
        '--yes', '--quiet', '--no-color'
      ]);
      assertSuccess(repeatedUninstall, `${runtime} idempotent repeated uninstall`);
      assert.strictEqual(fs.existsSync(receiptPath), false, `${runtime} receipt survived complete uninstall`);
      assert.strictEqual(fs.readFileSync(sentinel, 'utf8'), `${runtime} user data\n`);
      for (const relative of sourceFiles) {
        const installedRelative = path.posix.join(expected.destination, relative);
        assert.strictEqual(
          fs.existsSync(path.join(targetDir, ...installedRelative.split('/'))),
          false,
          `${runtime} owned file survived uninstall: ${installedRelative}`
        );
      }
    });
  }

  console.log(`\n${passed} modern target tests passed.`);
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true });
}
