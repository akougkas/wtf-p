const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

function combinedOutput(result) {
  return `${result.stdout || ''}${result.stderr || ''}`.trim();
}

function conciseOutput(result) {
  const output = combinedOutput(result);
  if (output.length <= 1200) return output;
  return output.slice(-1200);
}

function antigravityHome(targetDir) {
  const resolved = path.resolve(targetDir);
  if (path.basename(resolved) !== 'config' || path.basename(path.dirname(resolved)) !== '.gemini') {
    return null;
  }
  return path.dirname(path.dirname(resolved));
}

function nativeEnvironment(runtime, targetDir, baseEnvironment = process.env) {
  const environment = { ...baseEnvironment };
  if (runtime === 'claude') {
    environment.CLAUDE_CONFIG_DIR = targetDir;
  } else if (runtime === 'codex') {
    environment.CODEX_HOME = targetDir;
  } else if (runtime === 'copilot') {
    environment.COPILOT_HOME = targetDir;
    environment.COPILOT_OFFLINE = 'true';
  } else if (runtime === 'antigravity') {
    const home = antigravityHome(targetDir);
    if (!home) return null;
    environment.HOME = home;
  }
  return environment;
}

function clioProbeContext(baseEnvironment = process.env) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-clio-probe-'));
  fs.chmodSync(root, 0o700);
  const directory = (name) => path.join(root, name);
  const environment = {
    PATH: baseEnvironment.PATH || '',
    HOME: root,
    USERPROFILE: root,
    XDG_CONFIG_HOME: directory('xdg-config'),
    XDG_DATA_HOME: directory('xdg-data'),
    XDG_STATE_HOME: directory('xdg-state'),
    XDG_CACHE_HOME: directory('xdg-cache'),
    TMPDIR: directory('tmp'),
    CLIO_CODER_HOME: directory('clio-home'),
    CLIO_CODER_CONFIG_DIR: directory('clio-config'),
    CLIO_CODER_DATA_DIR: directory('clio-data'),
    CLIO_CODER_STATE_DIR: directory('clio-state'),
    CLIO_CODER_CACHE_DIR: directory('clio-cache'),
    CLIO_CODER_BIN_DIR: directory('clio-bin'),
    CLIO_CODER_REQUIRE_HOME_PREFIX: '1',
    NO_COLOR: '1'
  };
  for (const name of ['LANG', 'LC_ALL', 'TERM', 'SystemRoot', 'WINDIR', 'PATHEXT']) {
    if (baseEnvironment[name]) environment[name] = baseEnvironment[name];
  }
  for (const value of Object.values(environment)) {
    if (typeof value === 'string' && value.startsWith(`${root}${path.sep}`)) {
      fs.mkdirSync(value, { recursive: true });
    }
  }
  return {
    environment,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}

function execute(command, args, environment, options = {}) {
  const runner = options.runner || spawnSync;
  const result = runner(command, args, {
    cwd: options.cwd || process.cwd(),
    env: environment,
    encoding: 'utf8',
    input: '',
    timeout: options.timeout || DEFAULT_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
    windowsHide: true
  });

  if (result.error && result.error.code === 'ENOENT') {
    return { status: 'unavailable', command, args, output: '' };
  }
  if (result.error) {
    throw new Error(`${command} ${args.join(' ')} could not run: ${result.error.message}`);
  }
  if (result.status !== 0) {
    if (options.allowAlreadyAbsent && isAlreadyAbsent(result)) {
      return {
        status: 'already-absent',
        command,
        args,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        output: combinedOutput(result)
      };
    }
    const detail = conciseOutput(result);
    throw new Error(
      `${command} ${args.join(' ')} failed with exit ${result.status}${detail ? `: ${detail}` : ''}`
    );
  }
  return {
    status: 'ok',
    command,
    args,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    output: combinedOutput(result)
  };
}

function nativeCommands(runtime, targetDir, native) {
  const source = path.join(targetDir, native.source);
  if (runtime === 'clio') {
    return {
      executable: 'clio-coder',
      install: [],
      verify: ['extensions', 'discover', source, '--json'],
      uninstall: []
    };
  }
  if (runtime === 'claude') {
    return {
      executable: 'claude',
      install: [
        ['plugin', 'marketplace', 'add', source, '--scope', 'user'],
        ['plugin', 'install', native.selector, '--scope', 'user', '-y']
      ],
      verify: ['plugin', 'list', '--json'],
      uninstall: [
        ['plugin', 'uninstall', native.selector, '--scope', 'user', '-y'],
        ['plugin', 'marketplace', 'remove', native.marketplace, '--scope', 'user']
      ]
    };
  }
  if (runtime === 'codex') {
    return {
      executable: 'codex',
      install: [
        ['plugin', 'marketplace', 'add', source],
        ['plugin', 'add', native.selector, '--json']
      ],
      verify: ['plugin', 'list', '--json'],
      uninstall: [
        ['plugin', 'remove', native.selector, '--json'],
        ['plugin', 'marketplace', 'remove', native.marketplace]
      ]
    };
  }
  if (runtime === 'copilot') {
    return {
      executable: 'copilot',
      install: [
        ['plugin', 'marketplace', 'add', source],
        ['plugin', 'install', native.selector]
      ],
      verify: ['plugin', 'list'],
      uninstall: [
        ['plugin', 'uninstall', native.selector],
        ['plugin', 'marketplace', 'remove', native.marketplace]
      ]
    };
  }
  if (runtime === 'antigravity') {
    return {
      executable: 'agy',
      install: [['plugin', 'install', source]],
      verify: ['plugin', 'list'],
      uninstall: [['plugin', 'uninstall', native.plugin]]
    };
  }
  return null;
}

function marketplaceListArguments(runtime) {
  return runtime === 'copilot'
    ? ['plugin', 'marketplace', 'list']
    : ['plugin', 'marketplace', 'list', '--json'];
}

function antigravityPluginState(targetDir) {
  const pluginDirectory = path.join(targetDir, 'plugins', 'wtf-p');
  if (!fs.existsSync(pluginDirectory)) return 'missing';
  const stat = fs.lstatSync(pluginDirectory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) return 'foreign';
  return fs.existsSync(path.join(pluginDirectory, '.wtfp-generated.json'))
    ? 'wtfp'
    : 'foreign';
}

function stripAnsi(value) {
  return String(value || '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
}

function inspectMarketplace(runtime, native, source, result) {
  if (runtime === 'claude') {
    let marketplaces;
    try {
      marketplaces = JSON.parse(result.stdout);
    } catch {
      throw new Error(`claude plugin marketplace list returned invalid JSON: ${conciseOutput(result)}`);
    }
    const existing = Array.isArray(marketplaces)
      ? marketplaces.find(marketplace => marketplace.name === native.marketplace)
      : null;
    if (!existing) return 'missing';
    const existingSource = existing.installLocation || existing.path;
    if (typeof existingSource === 'string' && path.resolve(existingSource) === path.resolve(source)) {
      return 'same';
    }
    throw new Error(
      `Claude marketplace name ${native.marketplace} is already registered to ${existingSource || 'another source'}`
    );
  }

  if (runtime === 'codex') {
    let listing;
    try {
      listing = JSON.parse(result.stdout);
    } catch {
      throw new Error(`codex plugin marketplace list returned invalid JSON: ${conciseOutput(result)}`);
    }
    const marketplaces = Array.isArray(listing.marketplaces) ? listing.marketplaces : [];
    const existing = marketplaces.find(marketplace => marketplace.name === native.marketplace);
    if (!existing) return 'missing';
    const existingSource = existing.root || existing.marketplaceSource?.source;
    if (typeof existingSource === 'string' && path.resolve(existingSource) === path.resolve(source)) {
      return 'same';
    }
    throw new Error(
      `Codex marketplace name ${native.marketplace} is already registered to ${existingSource || 'another source'}`
    );
  }

  const clean = stripAnsi(result.output);
  const localPattern = /^\s*[•*]\s+(\S+)\s+\(Local:\s*(.+?)\)\s*$/gm;
  let match;
  while ((match = localPattern.exec(clean)) !== null) {
    if (match[1] !== native.marketplace) continue;
    if (path.resolve(match[2]) === path.resolve(source)) return 'same';
    throw new Error(
      `Copilot marketplace name ${native.marketplace} is already registered to ${match[2]}`
    );
  }
  const namedPattern = new RegExp(`^\\s*[•*]\\s+${native.marketplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+\\(`, 'm');
  if (namedPattern.test(clean)) {
    throw new Error(`Copilot marketplace name ${native.marketplace} is already registered to another source`);
  }
  return 'missing';
}

function verifyRegistration(runtime, native, result) {
  if (runtime === 'clio') {
    let discovered;
    try {
      discovered = JSON.parse(result.stdout);
    } catch {
      return { compatible: false, reason: `Clio discovery returned invalid JSON: ${conciseOutput(result)}` };
    }
    const candidate = Array.isArray(discovered)
      ? discovered[0]
      : (Array.isArray(discovered?.candidates) ? discovered.candidates[0] : discovered);
    const resources = candidate?.resources || candidate?.manifest?.resources;
    const diagnostics = Array.isArray(candidate?.diagnostics) ? candidate.diagnostics : [];
    const errors = diagnostics.filter(diagnostic => diagnostic?.type === 'error');
    if (!candidate || candidate.valid !== true || errors.length > 0 || !resources) {
      return {
        compatible: false,
        reason: errors[0]?.message || 'Clio did not return a valid normalized extension manifest'
      };
    }
    for (const [kind, expected] of Object.entries(native.requiredResources || {})) {
      if (resources[kind] !== expected) {
        return {
          compatible: false,
          reason: `Clio does not preserve resources.${kind}=${expected}`
        };
      }
    }
    return { compatible: true };
  }

  if (runtime === 'claude') {
    let listing;
    try {
      listing = JSON.parse(result.stdout);
    } catch {
      throw new Error(`claude plugin list returned invalid JSON: ${conciseOutput(result)}`);
    }
    if (!Array.isArray(listing) ||
        !listing.some(plugin => plugin.id === native.selector && plugin.enabled !== false)) {
      throw new Error(`Claude did not report ${native.selector} as installed and enabled after registration`);
    }
    return { compatible: true };
  }

  if (runtime === 'codex') {
    let listing;
    try {
      listing = JSON.parse(result.stdout);
    } catch {
      throw new Error(`codex plugin list returned invalid JSON: ${conciseOutput(result)}`);
    }
    const installed = Array.isArray(listing.installed) ? listing.installed : [];
    if (!installed.some(plugin => plugin.pluginId === native.selector && plugin.installed !== false)) {
      throw new Error(`Codex did not report ${native.selector} as installed after registration`);
    }
    return { compatible: true };
  }

  if (!result.output.includes(native.plugin)) {
    throw new Error(`${runtime} did not report ${native.plugin} after native registration`);
  }
  return { compatible: true };
}

function activateNativeRegistration(runtime, targetDir, native, options = {}) {
  if (!native) return { status: 'not-required', results: [] };
  const commands = nativeCommands(runtime, targetDir, native);
  if (!commands) return { status: 'not-required', results: [] };
  const clioProbe = runtime === 'clio'
    ? clioProbeContext(options.environment || process.env)
    : null;
  const environment = clioProbe
    ? clioProbe.environment
    : nativeEnvironment(runtime, targetDir, options.environment);
  if (!environment) {
    return {
      status: 'deferred',
      reason: `Antigravity can only activate a target shaped like <home>/.gemini/config: ${targetDir}`,
      results: []
    };
  }

  try {
    const results = [];
    let installCommands = commands.install;
    let marketplaceAdded = false;
    let pluginAdded = false;

    function compensate() {
      const failures = [];
      const rollbackCommands = [];
      if (pluginAdded && commands.uninstall[0]) rollbackCommands.push(commands.uninstall[0]);
      if (marketplaceAdded && commands.uninstall.length > 1) {
        rollbackCommands.push(commands.uninstall[commands.uninstall.length - 1]);
      }
      let pluginRollbackFailed = false;
      for (const args of rollbackCommands) {
        if (pluginRollbackFailed && args === commands.uninstall[commands.uninstall.length - 1]) {
          failures.push('native marketplace was preserved because plugin rollback did not complete');
          continue;
        }
        try {
          const result = execute(commands.executable, args, environment, {
            ...options,
            allowAlreadyAbsent: true
          });
          results.push(result);
          if (result.status === 'unavailable') {
            throw new Error(`${commands.executable} became unavailable during native registration rollback`);
          }
          if (args === commands.uninstall[0]) pluginAdded = false;
          if (args === commands.uninstall[commands.uninstall.length - 1]) marketplaceAdded = false;
        } catch (error) {
          failures.push(error.message);
          if (args === commands.uninstall[0]) pluginRollbackFailed = true;
        }
      }
      return failures;
    }

    function activationResult(status, extra = {}) {
      return {
        status,
        executable: commands.executable,
        results,
        ...extra,
        // The installer keeps this handle alive until its ownership receipt is
        // durable. It removes only registry state created by this invocation.
        rollback: compensate
      };
    }

    function registrationIsPresent(result) {
      try {
        verifyRegistration(runtime, native, result);
        return true;
      } catch (error) {
        if (/did not report/.test(error.message)) return false;
        throw error;
      }
    }

    try {
      if (runtime === 'claude' || runtime === 'codex' || runtime === 'copilot') {
        const source = path.join(targetDir, native.source);
        const marketplaceListArgs = marketplaceListArguments(runtime);
        const marketplaceList = execute(commands.executable, marketplaceListArgs, environment, options);
        if (marketplaceList.status === 'unavailable') {
          return activationResult('unavailable');
        }
        results.push(marketplaceList);
        const marketplaceState = inspectMarketplace(runtime, native, source, marketplaceList);
        const priorVerification = execute(commands.executable, commands.verify, environment, options);
        if (priorVerification.status === 'unavailable') {
          return activationResult('unavailable');
        }
        results.push(priorVerification);
        if (registrationIsPresent(priorVerification)) {
          return activationResult('registered');
        }
        if (marketplaceState === 'same') {
          installCommands = commands.install.slice(1);
        }
      } else if (runtime === 'antigravity') {
        if (antigravityPluginState(targetDir) === 'foreign') {
          throw new Error('Antigravity already has a non-WTF-P plugin named wtf-p; native registration was not changed');
        }
        const priorVerification = execute(commands.executable, commands.verify, environment, options);
        if (priorVerification.status === 'unavailable') return activationResult('unavailable');
        results.push(priorVerification);
        if (registrationIsPresent(priorVerification)) return activationResult('registered');
      }

      for (const args of installCommands) {
        const addsMarketplace = args === commands.install[0] && commands.install.length > 1;
        // Preflight established that this exact registration did not exist.
        // Record rollback intent before spawning so a command that mutates and
        // then exits nonzero is still compensated.
        if (addsMarketplace) marketplaceAdded = true;
        else pluginAdded = true;

        const result = execute(commands.executable, args, environment, options);
        if (result.status === 'unavailable') {
          // ENOENT means this individual command never started. Preserve any
          // earlier successful rollback intent, but clear this attempt.
          if (addsMarketplace) marketplaceAdded = false;
          else pluginAdded = false;
          const rollbackFailures = compensate();
          if (rollbackFailures.length > 0) {
            const error = new Error(`${commands.executable} became unavailable and native registration rollback did not complete`);
            error.nativeRollbackFailures = rollbackFailures;
            throw error;
          }
          return activationResult('unavailable');
        }
        results.push(result);
      }
      let verification;
      try {
        verification = execute(commands.executable, commands.verify, environment, options);
      } catch (error) {
        if (runtime !== 'clio') throw error;
        return {
          status: 'incompatible',
          executable: commands.executable,
          reason: error.message,
          results
        };
      }
      if (verification.status === 'unavailable') {
        const rollbackFailures = compensate();
        if (rollbackFailures.length > 0) {
          const error = new Error(`${commands.executable} became unavailable and native registration rollback did not complete`);
          error.nativeRollbackFailures = rollbackFailures;
          throw error;
        }
        return activationResult('unavailable');
      }
      results.push(verification);
      const verified = verifyRegistration(runtime, native, verification);
      if (verified.compatible === false) {
        return {
          status: 'incompatible',
          executable: commands.executable,
          reason: verified.reason,
          results
        };
      }
      return activationResult(runtime === 'clio' ? 'compatible' : 'registered');
    } catch (error) {
      const failures = Array.isArray(error.nativeRollbackFailures)
        ? error.nativeRollbackFailures
        : compensate();
      if (failures.length > 0) {
        error.message += `; native registration rollback also failed: ${failures.join('; ')}`;
        error.nativeRollbackFailures = failures;
      }
      throw error;
    }
  } finally {
    if (clioProbe) clioProbe.cleanup();
  }
}

function isAlreadyAbsent(result) {
  return /not (?:installed|found|registered|configured)|unknown (?:plugin|marketplace)|no imported plugin/i
    .test(combinedOutput(result));
}

function deactivateNativeRegistration(runtime, targetDir, native, options = {}) {
  if (!native) return { status: 'not-required', results: [] };
  if (runtime === 'clio') return { status: 'not-required', results: [] };
  const commands = nativeCommands(runtime, targetDir, native);
  if (!commands) return { status: 'not-required', results: [] };
  const environment = nativeEnvironment(runtime, targetDir, options.environment);
  if (!environment) return { status: 'deferred', results: [] };

  const results = [];
  if (runtime === 'claude' || runtime === 'codex' || runtime === 'copilot') {
    const marketplaceList = execute(
      commands.executable,
      marketplaceListArguments(runtime),
      environment,
      options
    );
    if (marketplaceList.status === 'unavailable') {
      return { status: 'unavailable', executable: commands.executable, results };
    }
    results.push(marketplaceList);
    const source = path.join(targetDir, native.source);
    if (inspectMarketplace(runtime, native, source, marketplaceList) === 'missing') {
      return {
        status: 'unregistered',
        executable: commands.executable,
        alreadyAbsent: true,
        results
      };
    }
  } else if (runtime === 'antigravity') {
    const pluginState = antigravityPluginState(targetDir);
    if (pluginState === 'foreign') {
      throw new Error('Antigravity plugin wtf-p is not marked as a generated WTF-P adapter; native registration was preserved');
    }
    if (pluginState === 'missing') {
      return {
        status: 'unregistered',
        executable: commands.executable,
        alreadyAbsent: true,
        results
      };
    }
  }

  for (const args of commands.uninstall) {
    const result = execute(commands.executable, args, environment, {
      ...options,
      allowAlreadyAbsent: true
    });
    if (result.status === 'unavailable') {
      return { status: 'unavailable', executable: commands.executable, results };
    }
    results.push(result);
  }
  return { status: 'unregistered', executable: commands.executable, results };
}

module.exports = {
  activateNativeRegistration,
  antigravityHome,
  clioProbeContext,
  deactivateNativeRegistration,
  nativeEnvironment
};
