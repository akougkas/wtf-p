const fs = require('fs');
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
    return;
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
    return;
  }

  if (!result.output.includes(native.plugin)) {
    throw new Error(`${runtime} did not report ${native.plugin} after native registration`);
  }
}

function activateNativeRegistration(runtime, targetDir, native, options = {}) {
  if (!native) return { status: 'not-required', results: [] };
  const commands = nativeCommands(runtime, targetDir, native);
  if (!commands) return { status: 'not-required', results: [] };
  const environment = nativeEnvironment(runtime, targetDir, options.environment);
  if (!environment) {
    return {
      status: 'deferred',
      reason: `Antigravity can only activate a target shaped like <home>/.gemini/config: ${targetDir}`,
      results: []
    };
  }

  const results = [];
  let installCommands = commands.install;
  if (runtime === 'claude' || runtime === 'codex' || runtime === 'copilot') {
    const source = path.join(targetDir, native.source);
    const marketplaceListArgs = marketplaceListArguments(runtime);
    const marketplaceList = execute(commands.executable, marketplaceListArgs, environment, options);
    if (marketplaceList.status === 'unavailable') {
      return { status: 'unavailable', executable: commands.executable, results };
    }
    results.push(marketplaceList);
    if (inspectMarketplace(runtime, native, source, marketplaceList) === 'same') {
      installCommands = commands.install.slice(1);
    }
  } else if (runtime === 'antigravity' && antigravityPluginState(targetDir) === 'foreign') {
    throw new Error('Antigravity already has a non-WTF-P plugin named wtf-p; native registration was not changed');
  }

  for (const args of installCommands) {
    const result = execute(commands.executable, args, environment, options);
    if (result.status === 'unavailable') {
      return { status: 'unavailable', executable: commands.executable, results };
    }
    results.push(result);
  }
  const verification = execute(commands.executable, commands.verify, environment, options);
  if (verification.status === 'unavailable') {
    return { status: 'unavailable', executable: commands.executable, results };
  }
  results.push(verification);
  verifyRegistration(runtime, native, verification);
  return { status: 'registered', executable: commands.executable, results };
}

function isAlreadyAbsent(result) {
  return /not (?:installed|found|registered|configured)|unknown (?:plugin|marketplace)|no imported plugin/i
    .test(combinedOutput(result));
}

function deactivateNativeRegistration(runtime, targetDir, native, options = {}) {
  if (!native) return { status: 'not-required', results: [] };
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

  const runner = options.runner || spawnSync;
  for (const args of commands.uninstall) {
    const result = runner(commands.executable, args, {
      cwd: options.cwd || process.cwd(),
      env: environment,
      encoding: 'utf8',
      input: '',
      timeout: options.timeout || DEFAULT_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
      windowsHide: true
    });
    if (result.error && result.error.code === 'ENOENT') {
      return { status: 'unavailable', executable: commands.executable, results };
    }
    if (result.error) {
      throw new Error(`${commands.executable} ${args.join(' ')} could not run: ${result.error.message}`);
    }
    if (result.status !== 0 && !isAlreadyAbsent(result)) {
      const detail = conciseOutput(result);
      throw new Error(
        `${commands.executable} ${args.join(' ')} failed with exit ${result.status}${detail ? `: ${detail}` : ''}`
      );
    }
    results.push({
      status: result.status === 0 ? 'ok' : 'already-absent',
      command: commands.executable,
      args,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      output: combinedOutput(result)
    });
  }
  return { status: 'unregistered', executable: commands.executable, results };
}

module.exports = {
  activateNativeRegistration,
  antigravityHome,
  deactivateNativeRegistration,
  nativeEnvironment
};
