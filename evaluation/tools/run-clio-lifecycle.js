#!/usr/bin/env node

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const { checkFixture } = require('./hash-fixtures');
const { validatePlanningPaths } = require('./validate-planning');
const {
  ACTION_SEQUENCE,
  PHASE_RULES,
  PROJECT_ID,
  SECTION_ID,
  buildActionPlan,
  canonicalJson,
  checkLifecycleRecords,
  checkMutationBoundary,
  diffSnapshots,
  extractInvocationArguments,
  hashTree,
  isContained,
  parseJsonLines,
  readPlanningRecords,
  sha256,
  snapshotProject,
  walkFiles
} = require('../lib/clio-lifecycle');

const repositoryRoot = path.resolve(__dirname, '../..');
const fixtureRoot = path.join(repositoryRoot, 'evaluation', 'v1', 'fixtures', 'hpc-checkpointing');
const DEFAULT_TARGET = 'openai-codex';
const DEFAULT_MODEL = 'gpt-5.6-terra';
const DEFAULT_EFFORT = 'xhigh';
const DEFAULT_TIMEOUT_MINUTES = 20;
const DEFAULT_BUDGET_USD = 20;
const PREPARED_FILE = 'prepared.json';
const RUN_SCHEMA = 'wtfp.evaluation.clio-lifecycle-run/v1';
const ROTATED_CREDENTIAL_READ_APPROVAL = Symbol('rotated-credential-read-approval');
const COST_PROVENANCES = Object.freeze(['known', 'known_free', 'estimated', 'unknown']);
const OPENAI_CODEX_RUNTIME_POLICY = Object.freeze({
  target: DEFAULT_TARGET,
  model: DEFAULT_MODEL,
  effort: DEFAULT_EFFORT,
  runtime_id: 'openai-codex',
  runtime_kind: 'http',
  api_family: 'openai-codex-responses',
  auth: 'oauth'
});
const REQUIRED_DISPATCH = Object.freeze({
  'create-outline': Object.freeze(['wtfp-outliner']),
  'plan-section': Object.freeze(['wtfp-section-planner', 'wtfp-plan-checker']),
  'write-section': Object.freeze(['wtfp-section-writer', 'wtfp-argument-verifier']),
  'review-section': Object.freeze(['wtfp-section-reviewer'])
});
const WORKER_RESULT_CONTRACTS = Object.freeze({
  'wtfp-outliner': Object.freeze({ kind: 'mutation-report', action: 'create-outline', validationRole: null }),
  'wtfp-section-planner': Object.freeze({ kind: 'mutation-report', action: 'plan-section', validationRole: null }),
  'wtfp-plan-checker': Object.freeze({ kind: 'verifier-report', action: 'plan-section', validationRole: 'plan-checker' }),
  'wtfp-section-writer': Object.freeze({ kind: 'mutation-report', action: 'write-section', validationRole: null }),
  'wtfp-argument-verifier': Object.freeze({ kind: 'verifier-report', action: 'write-section', validationRole: 'argument-verifier' }),
  'wtfp-section-reviewer': Object.freeze({ kind: 'verifier-report', action: 'review-section', validationRole: 'section-reviewer' })
});

function exactRuntimePolicy(options) {
  for (const key of ['target', 'model', 'effort']) {
    if (options[key] !== OPENAI_CODEX_RUNTIME_POLICY[key]) {
      throw new Error(`lifecycle evaluator certifies only ${key}=${OPENAI_CODEX_RUNTIME_POLICY[key]}`);
    }
  }
  return { ...OPENAI_CODEX_RUNTIME_POLICY };
}

function usage() {
  return [
    'Usage:',
    '  node evaluation/tools/run-clio-lifecycle.js --dry-run [options]',
    '  node evaluation/tools/run-clio-lifecycle.js --prepare [--root <new-path>] [options]',
    '  node evaluation/tools/run-clio-lifecycle.js --execute --root <prepared-path> [options]',
    '',
    'Required source options (or matching environment variables):',
    '  --binary <path>       Clio entry file (WTFP_CLIO_BINARY)',
    '  --clio-source <path>  coordinated Clio source root (WTFP_CLIO_SOURCE)',
    '',
    'Other options:',
    '  --extension <path>    generated Clio extension (default: vendors/clio)',
    '  --target <id>         exact target (default: openai-codex)',
    '  --model <id>          exact model (default: gpt-5.6-terra)',
    '  --effort <level>      exact thinking effort (default: xhigh)',
    '  --timeout-minutes <n> per-action timeout (default: 20)',
    '  --budget-usd <n>      stop-before-next-action campaign ceiling (default: 20)',
    '',
    'Execution credentials are intentionally unavailable as flags. Set both',
    'WTFP_CLIO_SETTINGS_SOURCE and WTFP_CLIO_CREDENTIALS_SOURCE in the environment;',
    'their contents are copied into the contained root with mode 0600 and never logged.',
    'Optional WTFP_LIFECYCLE_PROFILE_PATHS is a path-delimiter-separated list of',
    'additional normal-profile files to hash before and after execution.',
    '',
    '--dry-run performs read-only source inspection and prints the exact command plan.',
    '--prepare creates a mode-0700 root, committed fixture, isolated Clio directories,',
    'extension installation, and credential-free native discovery/fleet evidence.',
    '--execute is the only mode that calls a paid model and refuses an unprepared root.'
  ].join('\n');
}

function parseNumber(value, label, minimumExclusive = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= minimumExclusive) {
    throw new Error(`${label} must be greater than ${minimumExclusive}`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    mode: null,
    root: null,
    binary: process.env.WTFP_CLIO_BINARY || null,
    clioSource: process.env.WTFP_CLIO_SOURCE || null,
    extension: path.join(repositoryRoot, 'vendors', 'clio'),
    target: DEFAULT_TARGET,
    model: DEFAULT_MODEL,
    effort: DEFAULT_EFFORT,
    timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
    budgetUsd: DEFAULT_BUDGET_USD
  };

  const valued = new Set([
    '--root', '--binary', '--clio-source', '--extension', '--target', '--model', '--effort',
    '--timeout-minutes', '--budget-usd'
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (['--help', '-h'].includes(argument)) return { help: true };
    if (['--dry-run', '--prepare', '--execute'].includes(argument)) {
      if (options.mode) throw new Error('choose exactly one of --dry-run, --prepare, or --execute');
      options.mode = argument.slice(2);
      continue;
    }
    if (!valued.has(argument)) throw new Error(`unknown option ${argument}`);
    const value = argv[index + 1];
    if (!value) throw new Error(`${argument} requires a value`);
    index += 1;
    const key = {
      '--root': 'root',
      '--binary': 'binary',
      '--clio-source': 'clioSource',
      '--extension': 'extension',
      '--target': 'target',
      '--model': 'model',
      '--effort': 'effort'
    }[argument];
    if (key) options[key] = value;
    else if (argument === '--timeout-minutes') options.timeoutMinutes = parseNumber(value, argument);
    else options.budgetUsd = parseNumber(value, argument);
  }

  if (!options.mode) throw new Error('choose one of --dry-run, --prepare, or --execute');
  if (!options.binary) throw new Error('--binary or WTFP_CLIO_BINARY is required');
  if (!options.clioSource) throw new Error('--clio-source or WTFP_CLIO_SOURCE is required');
  if (options.mode === 'execute' && !options.root) throw new Error('--execute requires --root');
  for (const key of ['binary', 'clioSource', 'extension']) options[key] = path.resolve(options[key]);
  if (options.root) options.root = path.resolve(options.root);
  return options;
}

function assertRegularFile(file, label) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label} must be a regular non-symlink file: ${file}`);
}

function assertDirectory(directory, label) {
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${label} must be a non-symlink directory: ${directory}`);
  }
}

function commandResult(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repositoryRoot,
    env: options.env || process.env,
    encoding: 'utf8',
    maxBuffer: options.maxBuffer || 32 * 1024 * 1024,
    timeout: options.timeout || 60000,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${path.basename(command)} exited ${result.status}`);
  }
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function gitRead(root, args) {
  return commandResult('git', ['-C', root, ...args]).stdout.trim();
}

function gitMetadata(root) {
  const status = commandResult('git', ['-C', root, 'status', '--porcelain=v1', '-z']).stdout;
  return {
    commit: gitRead(root, ['rev-parse', 'HEAD']),
    branch: gitRead(root, ['branch', '--show-current']) || null,
    dirty: status.length > 0,
    status_entry_count: status.split('\0').filter(Boolean).length,
    status_sha256: sha256(Buffer.from(status, 'utf8'))
  };
}

function evaluationRuntimeBinding() {
  const files = [
    'evaluation/lib/clio-lifecycle.js',
    'evaluation/lib/fixture-hashes.js',
    'evaluation/lib/json-schema.js',
    'evaluation/tools/hash-fixtures.js',
    'evaluation/tools/run-clio-lifecycle.js',
    'evaluation/tools/validate-planning.js'
  ].map(relative => {
    const absolute = path.join(repositoryRoot, relative);
    return { path: relative, bytes: fs.statSync(absolute).size, sha256: sha256(fs.readFileSync(absolute)) };
  });
  return { files, sha256: sha256(Buffer.from(JSON.stringify(files), 'utf8')) };
}

function inspectSources(options) {
  assertRegularFile(options.binary, 'Clio binary');
  assertDirectory(options.clioSource, 'Clio source');
  assertDirectory(options.extension, 'Clio extension');
  const clioDistRoot = path.join(options.clioSource, 'dist');
  assertDirectory(clioDistRoot, 'Clio dist root');
  if (!isContained(clioDistRoot, options.binary)) {
    throw new Error('Clio binary must be contained in the matching source dist tree');
  }
  const clioDist = hashTree(clioDistRoot);
  const clioModulesRoot = path.join(options.clioSource, 'node_modules');
  assertDirectory(clioModulesRoot, 'Clio runtime node_modules root');
  const clioModules = hashTree(clioModulesRoot, {
    // npm's command shims are symlinks back into packages whose target bytes
    // are already authenticated below. The Clio entry never executes .bin.
    exclude: relative => relative === '.bin' || relative.startsWith('.bin/')
  });
  assertRegularFile(process.execPath, 'Node.js executable');
  const fixtureCheck = checkFixture(fixtureRoot);
  if (!fixtureCheck.valid) throw new Error(`fixture hash check failed: ${fixtureCheck.reason}`);
  const fixtureManifest = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'manifest.json'), 'utf8'));
  const generatedFile = path.join(options.extension, '.wtfp-generated.json');
  const generated = JSON.parse(fs.readFileSync(generatedFile, 'utf8'));
  const routingManifestFile = path.join(repositoryRoot, 'evaluation', 'v1', 'routing', 'manifest.json');
  return {
    wtfp: {
      ...gitMetadata(repositoryRoot),
      protocol_sha256: hashTree(path.join(repositoryRoot, 'protocol')).sha256,
      extension_sha256: hashTree(options.extension).sha256,
      extension_inventory_entries: generated.files?.length || generated.inventory?.length || null,
      generator_version: generated.generatorVersion || generated.generator_version || generated.generator?.version || null,
      generator_source_sha256: generated.sourceHash || null,
      generated_manifest_sha256: sha256(fs.readFileSync(generatedFile)),
      routing_manifest_sha256: sha256(fs.readFileSync(routingManifestFile)),
      evaluation_runtime: evaluationRuntimeBinding()
    },
    clio: {
      ...gitMetadata(options.clioSource),
      source_sha256: hashTree(options.clioSource, {
        exclude: relative => relative === '.git' || relative.startsWith('.git/') ||
          relative === 'node_modules' || relative.startsWith('node_modules/') ||
          relative === 'dist' || relative.startsWith('dist/')
      }).sha256,
      dist: {
        sha256: clioDist.sha256,
        entries: clioDist.files.length
      },
      runtime_modules: {
        sha256: clioModules.sha256,
        entries: clioModules.files.length,
        excluded: ['.bin/']
      },
      node: {
        path: process.execPath,
        sha256: sha256(fs.readFileSync(process.execPath)),
        bytes: fs.statSync(process.execPath).size,
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      binary: {
        path: options.binary,
        dist_relative_path: path.relative(clioDistRoot, options.binary).split(path.sep).join('/'),
        sha256: sha256(fs.readFileSync(options.binary)),
        bytes: fs.statSync(options.binary).size
      }
    },
    fixture: {
      id: fixtureManifest.fixture_id,
      version: fixtureManifest.fixture_version,
      model_inputs_sha256: fixtureManifest.model_inputs_sha256,
      evaluator_oracles_sha256: fixtureManifest.evaluator_oracles_sha256,
      aggregate_sha256: fixtureManifest.aggregate_sha256,
      files: fixtureManifest.files
    }
  };
}

function buildPlan(options, sources, root = '<disposable-root>') {
  const actions = buildActionPlan(options);
  const runtimePolicy = exactRuntimePolicy(options);
  const environment = isolatedPaths(root, options.clioSource, 'S1');
  const resumeEnvironment = isolatedPaths(root, options.clioSource, 'S2');
  return {
    schema: 'wtfp.evaluation.clio-lifecycle-plan/v1',
    scenario: 'hpc-checkpointing-lifecycle',
    fixture: sources.fixture,
    source: sources,
    client: {
      name: 'Clio Coder',
      binary_path: options.binary,
      binary_sha256: sources.clio.binary.sha256,
      source_root: options.clioSource,
      source_commit: sources.clio.commit
    },
    requested: {
      target: options.target,
      model: options.model,
      effort: options.effort,
      mutation_autonomy: 'auto-edit',
      read_only_autonomy: 'read-only',
      permission_policy: 'headless asks denied; exact project writes granted per invocation',
      network_tools: false,
      vcs_tools: false,
      main_runtime: runtimePolicy,
      worker_runtime: runtimePolicy,
      receipt_policy: {
        main_actions: ACTION_SEQUENCE.length,
        worker_dispatches: Object.values(REQUIRED_DISPATCH).flat().length,
        maximum_total_receipts: ACTION_SEQUENCE.length + Object.values(REQUIRED_DISPATCH).flat().length,
        exact_agent_allowlist_per_action: true
      },
      maximum_cost_usd: options.budgetUsd,
      cost_ceiling_interpretation: 'stop-before-next-action ceiling over valid client-reported numeric receipt amounts; not a provider-billing hard cap',
      per_action_timeout_minutes: options.timeoutMinutes
    },
    isolation: {
      root,
      mode: '0700',
      environment,
      session_environments: { S1: environment, S2: resumeEnvironment },
      require_home_prefix: true,
      network_tools_disabled: true,
      S2_client_state_isolated_from_S1: true,
      inherited_credential_environment: false,
      effective_settings: 'sealed minimal local-only policy prepared and native-inspected; operator settings bytes are never imported',
      credentials_transport: 'mode-0600 isolated credentials.yaml copied from environment-named source at execute time',
      normal_profiles: 'sha256 before/after; contents never recorded'
    },
    extension: {
      source_root: options.extension,
      sha256: sources.wtfp.extension_sha256,
      install_scope: 'isolated-user',
      native_checks: [
        'extensions discover', 'extensions install', 'extensions list', 'agents --all',
        'fleet list', 'fleet validate wtfp-plan-section', 'fleet graph wtfp-plan-section',
        'fleet validate wtfp-draft-review', 'fleet graph wtfp-draft-review', 'fleet status'
      ]
    },
    sessions: {
      S1: { actions: ACTION_SEQUENCE.slice(0, 7), first_action_starts_fresh: true },
      process_boundary: { after: 'pause-writing', new_process: true, new_session: true, hidden_memory: false },
      S2: { actions: ACTION_SEQUENCE.slice(7), first_action_starts_fresh: true }
    },
    fixture_hook: {
      after: 'create-outline',
      mutations: [
        { from: 'project-brief.md', to: '.planning/sections/evaluation/context.md', byte_exact: true },
        { from: 'benchmark-observations.md', to: '.planning/sections/evaluation/research.md', byte_exact: true }
      ]
    },
    actions,
    stop_conditions: [
      'nonzero client exit', 'argument-byte mismatch', 'schema-invalid planning record',
      'cross-record invariant failure', 'undeclared project mutation', 'HEAD/index/refs change',
      'normal-profile hash change', 'credential cleanup failure', 'cost ceiling reached'
    ],
    semantic_assessment: 'independent review required; the runner records structural and safety evidence without self-awarding semantic quality'
  };
}

function isolatedPaths(root, clioSource, session = 'S1') {
  if (!['S1', 'S2'].includes(session)) throw new Error(`unsupported lifecycle session ${session}`);
  const second = session === 'S2';
  const xdgRoot = path.join(root, second ? 'xdg-s2' : 'xdg');
  return {
    HOME: path.join(root, second ? 'home-s2' : 'home'),
    XDG_CONFIG_HOME: path.join(xdgRoot, 'config'),
    XDG_DATA_HOME: path.join(xdgRoot, 'data'),
    XDG_STATE_HOME: path.join(xdgRoot, 'state'),
    XDG_CACHE_HOME: path.join(xdgRoot, 'cache'),
    TMPDIR: path.join(root, second ? 'tmp-s2' : 'tmp'),
    CLIO_CODER_HOME: path.join(root, 'clio'),
    CLIO_CODER_CONFIG_DIR: path.join(root, 'clio', 'config'),
    CLIO_CODER_DATA_DIR: path.join(root, 'clio', second ? 'data-s2' : 'data'),
    CLIO_CODER_STATE_DIR: path.join(root, 'clio', second ? 'state-s2' : 'state'),
    CLIO_CODER_CACHE_DIR: path.join(root, 'clio', second ? 'cache-s2' : 'cache'),
    CLIO_CODER_BIN_DIR: path.join(root, 'clio', 'bin'),
    CLIO_CODER_REQUIRE_HOME_PREFIX: '1',
    CLIO_CODER_NO_NETWORK_TOOLS: '1',
    CLIO_CODER_PACKAGE_ROOT: clioSource
  };
}

function sanitizedChildEnv(paths) {
  const environment = {
    // Do not expose operator-local shims, movable client symlinks, or package
    // manager bins to a paid run. Clio itself is launched by an authenticated
    // absolute entry path and any runtime child can use this exact Node binary.
    PATH: [path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter)
  };
  const inheritedAllowlist = [
    'LANG', 'LANGUAGE', 'LC_ALL', 'LC_CTYPE', 'TZ',
    'TERM', 'COLORTERM', 'NO_COLOR', 'FORCE_COLOR'
  ];
  for (const key of inheritedAllowlist) {
    if (typeof process.env[key] === 'string') environment[key] = process.env[key];
  }
  Object.assign(environment, paths);
  return environment;
}

const SESSION_PRIVATE_PATH_KEYS = Object.freeze([
  'HOME',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_STATE_HOME',
  'XDG_CACHE_HOME',
  'TMPDIR',
  'CLIO_CODER_DATA_DIR',
  'CLIO_CODER_STATE_DIR',
  'CLIO_CODER_CACHE_DIR'
]);

function sessionPrivateState(paths, root) {
  const surfaces = SESSION_PRIVATE_PATH_KEYS.map(key => {
    const directory = paths[key];
    if (!isContained(root, directory)) throw new Error(`${key} escaped the disposable lifecycle root`);
    assertDirectory(directory, `${key} session-private root`);
    const entries = snapshotProject(directory);
    return {
      key,
      path: path.relative(root, directory).split(path.sep).join('/'),
      entries: Object.keys(entries).length,
      sha256: sha256(Buffer.from(JSON.stringify(canonicalJson(entries)), 'utf8'))
    };
  });
  return {
    pristine: surfaces.every(surface => surface.entries === 0),
    sha256: sha256(Buffer.from(JSON.stringify(canonicalJson(surfaces)), 'utf8')),
    surfaces
  };
}

function makePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function writePrivate(file, bytes) {
  makePrivateDirectory(path.dirname(file));
  fs.writeFileSync(file, bytes, { mode: 0o600, flag: 'w' });
  fs.chmodSync(file, 0o600);
}

function writePrivateExclusive(file, bytes) {
  makePrivateDirectory(path.dirname(file));
  fs.writeFileSync(file, bytes, { mode: 0o600, flag: 'wx' });
  fs.chmodSync(file, 0o600);
}

function openPrivateCredential(file, bytes) {
  makePrivateDirectory(path.dirname(file));
  const flags = fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR |
    (fs.constants.O_NOFOLLOW || 0);
  const descriptor = fs.openSync(file, flags, 0o600);
  try {
    let offset = 0;
    while (offset < bytes.length) {
      offset += fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
    }
    fs.fsyncSync(descriptor);
    fs.fchmodSync(descriptor, 0o600);
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.nlink !== 1) {
      throw new Error('isolated credential descriptor was not a singly linked regular file at installation');
    }
    return {
      descriptor,
      device: stat.dev,
      inode: stat.ino,
      links: stat.nlink,
      original_bytes: bytes.length,
      identity_verified: false,
      links_before_overwrite: null,
      link_count_anomaly: false,
      overwritten_bytes: 0,
      wiped: false,
      closed: false
    };
  } catch (error) {
    try { fs.closeSync(descriptor); } catch { /* retain the original error */ }
    try { fs.unlinkSync(file); } catch { /* retain the original error */ }
    throw error;
  }
}

function wipeCredentialHandle(handle) {
  if (!handle) return {
    handle_present: false,
    descriptor_identity_verified: false,
    descriptor_wiped: false,
    descriptor_closed: false,
    links_before_overwrite: null,
    link_count_anomaly: false,
    overwritten_bytes: 0
  };
  if (handle.wiped && handle.closed) {
    return {
      handle_present: true,
      descriptor_identity_verified: handle.identity_verified === true,
      descriptor_wiped: true,
      descriptor_closed: true,
      links_before_overwrite: handle.links_before_overwrite,
      link_count_anomaly: handle.link_count_anomaly === true,
      overwritten_bytes: handle.overwritten_bytes
    };
  }
  let overwritten = 0;
  try {
    const stat = fs.fstatSync(handle.descriptor);
    if (!stat.isFile() || stat.dev !== handle.device || stat.ino !== handle.inode) {
      throw new Error('retained credential descriptor identity changed before overwrite');
    }
    handle.identity_verified = true;
    handle.links_before_overwrite = stat.nlink;
    handle.link_count_anomaly = stat.nlink > 1;
    const length = Math.max(stat.size, handle.original_bytes);
    const zeroes = Buffer.alloc(Math.min(Math.max(length, 1), 64 * 1024));
    while (overwritten < length) {
      const count = Math.min(zeroes.length, length - overwritten);
      fs.writeSync(handle.descriptor, zeroes, 0, count, overwritten);
      overwritten += count;
    }
    fs.ftruncateSync(handle.descriptor, 0);
    fs.fsyncSync(handle.descriptor);
    handle.overwritten_bytes = overwritten;
    handle.wiped = true;
  } finally {
    if (!handle.closed) {
      fs.closeSync(handle.descriptor);
      handle.closed = true;
    }
  }
  return {
    handle_present: true,
    descriptor_identity_verified: handle.identity_verified === true,
    descriptor_wiped: true,
    descriptor_closed: handle.closed === true,
    links_before_overwrite: handle.links_before_overwrite,
    link_count_anomaly: handle.link_count_anomaly === true,
    overwritten_bytes: overwritten
  };
}

function writeJsonPrivate(file, value) {
  writePrivate(file, `${JSON.stringify(value, null, 2)}\n`);
}

function minimalEvaluationSettings(options) {
  const policy = exactRuntimePolicy(options);
  return {
    version: 1,
    autonomy: 'auto-edit',
    targets: [{ id: policy.target, runtime: policy.runtime_id, defaultModel: policy.model }],
    runtimePlugins: [],
    orchestrator: { target: policy.target, model: policy.model, thinkingLevel: policy.effort },
    background: { target: null, model: null, thinkingLevel: 'off' },
    memory: { intervention: { enabled: false, everyNTools: 10, windowSteps: 8, maxTokens: 400, timeoutMs: 180000 } },
    watchdog: { enabled: false },
    workers: {
      default: { target: policy.target, model: policy.model, thinkingLevel: policy.effort, node: 'local' },
      profiles: {},
      rosters: {},
      agentBindings: {},
      maxRetries: 0,
      onPermission: 'deny',
      escalation: { timeoutMs: 120000, fallback: 'deny' },
      resilienceCooldownMs: 15000
    },
    fleet: { nodes: [] },
    routing: { activeRoles: [], activePostures: [], agentAutomation: { activeAgentRoles: [] } },
    scope: [],
    library: { catalog: null, remote: null, confirmedRemote: null, sync: false },
    skills: { trustProjectCompatRoots: false },
    attribution: { gitCommits: false },
    delegation: {
      agents: [],
      defaults: {
        connectTimeoutMs: 30000,
        turnTimeoutMs: 300000,
        permissionTimeoutMs: 120000,
        toolGovernance: 'clio-policy'
      }
    },
    compaction: { auto: false, threshold: 0.8, excludeLastTurns: 6 },
    retry: { enabled: false, maxRetries: 0, baseDelayMs: 2000, maxDelayMs: 60000, streamStallMs: 180000 }
  };
}

function createRoot(requested) {
  if (requested) {
    if (fs.existsSync(requested)) throw new Error(`refusing existing prepare root: ${requested}`);
    fs.mkdirSync(requested, { mode: 0o700 });
    fs.chmodSync(requested, 0o700);
    return requested;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-clio-lifecycle.'));
  fs.chmodSync(root, 0o700);
  return root;
}

function initializeFixture(projectRoot, fixture) {
  makePrivateDirectory(projectRoot);
  const modelFiles = fixture.files.filter(file => file.audience === 'model');
  for (const file of modelFiles) {
    const source = path.join(fixtureRoot, file.path);
    const destination = path.join(projectRoot, file.path);
    fs.copyFileSync(source, destination);
    fs.chmodSync(destination, 0o600);
    if (sha256(fs.readFileSync(destination)) !== file.sha256) {
      throw new Error(`fixture copy hash mismatch for ${file.path}`);
    }
  }
  if (fs.existsSync(path.join(projectRoot, 'expected-invariants.json'))) {
    throw new Error('evaluator-only oracle leaked into model project');
  }

  const gitEnvironment = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_DATE: '2026-08-29T12:00:00Z',
    GIT_COMMITTER_DATE: '2026-08-29T12:00:00Z'
  };
  commandResult('git', ['init', '--quiet', '--initial-branch=lifecycle-control', '--template='], {
    cwd: projectRoot,
    env: gitEnvironment
  });
  commandResult('git', ['add', '--', ...modelFiles.map(file => file.path)], { cwd: projectRoot, env: gitEnvironment });
  commandResult('git', [
    '-c', 'user.name=WTF-P Evaluation Harness',
    '-c', 'user.email=eval.invalid@wtf-p.invalid',
    '-c', 'commit.gpgsign=false',
    'commit', '--quiet', '--message', 'test: initialize immutable lifecycle fixture'
  ], { cwd: projectRoot, env: gitEnvironment });
  return {
    commit: gitRead(projectRoot, ['rev-parse', 'HEAD']),
    content: snapshotProject(projectRoot)
  };
}

function gitControlSnapshot(projectRoot) {
  const gitRoot = path.join(projectRoot, '.git');
  const fileHash = relative => {
    const file = path.join(gitRoot, relative);
    return fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null;
  };
  const refsRoot = path.join(gitRoot, 'refs');
  return {
    head_sha256: fileHash('HEAD'),
    index_sha256: fileHash('index'),
    packed_refs_sha256: fileHash('packed-refs'),
    refs_sha256: fs.existsSync(refsRoot) ? hashTree(refsRoot).sha256 : sha256(Buffer.alloc(0)),
    git_directory_sha256: hashTree(gitRoot).sha256
  };
}

function gitControlEqual(left, right) {
  return ['head_sha256', 'index_sha256', 'packed_refs_sha256', 'refs_sha256', 'git_directory_sha256']
    .every(key => left[key] === right[key]);
}

function nativeCommand({ name, binary, args, cwd, env, evidenceRoot }) {
  const started = Date.now();
  const result = commandResult(process.execPath, [binary, ...args], { cwd, env, allowFailure: true });
  const stdoutFile = path.join(evidenceRoot, 'native', `${name}.stdout`);
  const stderrFile = path.join(evidenceRoot, 'native', `${name}.stderr`);
  writePrivate(stdoutFile, result.stdout);
  writePrivate(stderrFile, result.stderr);
  return {
    name,
    executable: process.execPath,
    argv: [binary, ...args],
    argv_sha256: sha256(Buffer.from(JSON.stringify([binary, ...args]), 'utf8')),
    exit_code: result.status,
    latency_ms: Date.now() - started,
    stdout: { path: path.relative(path.dirname(evidenceRoot), stdoutFile), bytes: Buffer.byteLength(result.stdout), sha256: sha256(result.stdout) },
    stderr: { path: path.relative(path.dirname(evidenceRoot), stderrFile), bytes: Buffer.byteLength(result.stderr), sha256: sha256(result.stderr) }
  };
}

function fleetBoundaryProbe(clioSource, installedExtension) {
  const dist = path.join(clioSource, 'dist');
  assertDirectory(dist, 'Clio dist root');
  const moduleName = fs.readdirSync(dist).filter(name => /^chunk-[A-Z0-9]+\.js$/u.test(name)).sort()
    .find(name => {
      const source = fs.readFileSync(path.join(dist, name), 'utf8');
      return source.includes('function writeBoundaryCovers(') &&
        source.includes('parseFleetContract') && source.includes('writeBoundaryCovers,');
    });
  if (!moduleName) throw new Error('matching Clio build does not expose canonical fleet-boundary helpers');
  const moduleFile = path.join(dist, moduleName);
  const fleetFiles = {
    plan: path.join(installedExtension, 'fleets', 'wtfp-plan-section.md'),
    draft: path.join(installedExtension, 'fleets', 'wtfp-draft-review.md')
  };
  for (const [name, file] of Object.entries(fleetFiles)) assertRegularFile(file, `installed ${name} fleet`);
  const probeSource = [
    'import fs from "node:fs";',
    'import { pathToFileURL } from "node:url";',
    'const moduleFile = process.argv[1];',
    'const fleetFiles = JSON.parse(process.argv[2]);',
    'const api = await import(pathToFileURL(moduleFile).href);',
    'const read = file => api.parseFleetContract(fs.readFileSync(file, "utf8"), file);',
    'const plan = read(fleetFiles.plan);',
    'const draft = read(fleetFiles.draft);',
    'const boundary = (contract, id) => api.fleetStepBoundaries(contract).find(item => item.id === id)?.writes;',
    'const planWrites = boundary(plan, "plan");',
    'const draftWrites = boundary(draft, "draft");',
    'const checks = {',
    '  plan_exact_boundary: JSON.stringify(planWrites) === JSON.stringify([".planning/"]),',
    '  plan_covers_nested_plan: api.writeBoundaryCovers(planWrites, ".planning/sections/evaluation/plans/initial.md"),',
    '  plan_covers_state: api.writeBoundaryCovers(planWrites, ".planning/state.json"),',
    '  plan_rejects_manuscript: !api.writeBoundaryCovers(planWrites, "paper/evaluation.md"),',
    '  draft_exact_boundary: JSON.stringify(draftWrites) === JSON.stringify([".planning/", "paper/"]),',
    '  draft_covers_manuscript: api.writeBoundaryCovers(draftWrites, "paper/evaluation.md"),',
    '  draft_covers_nested_validation: api.writeBoundaryCovers(draftWrites, ".planning/validations/evaluation-draft.json"),',
    '  draft_rejects_fixture_material: !api.writeBoundaryCovers(draftWrites, "project-brief.md")',
    '};',
    'process.stdout.write(JSON.stringify({ plan: { name: plan.name, writes: planWrites }, draft: { name: draft.name, writes: draftWrites }, checks, valid: Object.values(checks).every(Boolean) }));'
  ].join('\n');
  const result = commandResult(process.execPath, [
    '--input-type=module', '--eval', probeSource, moduleFile, JSON.stringify(fleetFiles)
  ], { cwd: installedExtension, allowFailure: true });
  let probe;
  try {
    probe = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`canonical fleet-boundary probe returned malformed JSON (${error.message})`);
  }
  return {
    ...probe,
    exit_code: result.status,
    stderr_sha256: sha256(Buffer.from(result.stderr, 'utf8')),
    implementation: {
      module: path.relative(clioSource, moduleFile).split(path.sep).join('/'),
      sha256: sha256(fs.readFileSync(moduleFile)),
      helpers: ['parseFleetContract', 'fleetStepBoundaries', 'writeBoundaryCovers']
    }
  };
}

function runNativePreflight(options, root, env) {
  const evidenceRoot = path.join(root, 'evidence');
  const projectRoot = path.join(root, 'project');
  const commands = [
    ['version', ['--version']],
    ['config-inspect', ['config', 'inspect', '--json']],
    ['extension-discover', ['extensions', 'discover', options.extension, '--json']],
    ['extension-install', ['extensions', 'install', options.extension, '--user', '--json']],
    ['extension-list', ['extensions', 'list', '--all', '--user', '--json']],
    ['agents-all', ['agents', '--json', '--all']],
    ['fleet-list', ['fleet', 'list']],
    ['fleet-plan-validate', ['fleet', 'validate', 'wtfp-plan-section', '--json']],
    ['fleet-plan-graph', ['fleet', 'graph', 'wtfp-plan-section', '--json']],
    ['fleet-draft-validate', ['fleet', 'validate', 'wtfp-draft-review', '--json']],
    ['fleet-draft-graph', ['fleet', 'graph', 'wtfp-draft-review', '--json']],
    ['fleet-status', ['fleet', 'status', '--json']]
  ];
  const results = [];
  let containmentFailure = null;
  for (const [name, args] of commands) {
    try {
      assertContainedPrivateDirectory(root, env.CLIO_CODER_CONFIG_DIR, 'isolated Clio config root');
    } catch (error) {
      containmentFailure = `before ${name}: ${error.message}`;
      break;
    }
    results.push(nativeCommand({
      name,
      binary: options.binary,
      args,
      cwd: projectRoot,
      env,
      evidenceRoot
    }));
    try {
      assertContainedPrivateDirectory(root, env.CLIO_CODER_CONFIG_DIR, 'isolated Clio config root');
    } catch (error) {
      containmentFailure = `after ${name}: ${error.message}`;
      break;
    }
  }
  const byName = new Map(results.map(result => [result.name, result]));
  const stdout = name => byName.has(name)
    ? fs.readFileSync(path.join(evidenceRoot, 'native', `${name}.stdout`), 'utf8')
    : '';
  const errors = results.filter(result => result.exit_code !== 0)
    .map(result => `${result.name}: exited ${result.exit_code}`);
  if (containmentFailure) errors.push(`native command sequence stopped on config-root substitution (${containmentFailure})`);
  const parseJson = name => {
    try {
      return JSON.parse(stdout(name));
    } catch (error) {
      errors.push(`${name}: invalid JSON (${error.message})`);
      return null;
    }
  };
  const agents = parseJson('agents-all');
  const inspectedConfig = parseJson('config-inspect');
  const inspectedSettings = new Map(Array.isArray(inspectedConfig?.settings)
    ? inspectedConfig.settings.map(entry => [entry.key, entry.value]) : []);
  const expectedSettings = minimalEvaluationSettings(options);
  if (!Array.isArray(inspectedConfig?.issues) || inspectedConfig.issues.length > 0) {
    errors.push('config-inspect: isolated evaluation settings reported issues');
  }
  for (const [key, expected] of Object.entries(expectedSettings)) {
    if (JSON.stringify(canonicalJson(inspectedSettings.get(key))) !== JSON.stringify(canonicalJson(expected))) {
      errors.push(`config-inspect: effective ${key} did not match the sealed minimal evaluation policy`);
    }
  }
  const expectedAgents = [
    'wtfp-argument-verifier', 'wtfp-citation-expert', 'wtfp-citation-formatter',
    'wtfp-coherence-checker', 'wtfp-outliner', 'wtfp-plan-checker',
    'wtfp-prose-polisher', 'wtfp-research-synthesizer', 'wtfp-section-planner',
    'wtfp-section-reviewer', 'wtfp-section-writer'
  ];
  const observedAgents = new Set(Array.isArray(agents)
    ? agents.filter(agent => agent.source === 'extension').map(agent => agent.id) : []);
  for (const id of expectedAgents) {
    if (!observedAgents.has(id)) errors.push(`agents-all: missing extension agent ${id}`);
  }
  const extensionList = parseJson('extension-list');
  const extension = extensionList?.extensions?.find(item => item.id === 'wtfp');
  if (!extension?.enabled || !extension?.effective || (extension.diagnostics || []).length > 0) {
    errors.push('extension-list: WTF-P is not enabled, effective, and diagnostic-free');
  }
  for (const name of ['fleet-plan-validate', 'fleet-draft-validate']) {
    const validation = parseJson(name);
    if (validation?.valid !== true) {
      errors.push(`${name}: ${validation?.diagnostics?.join('; ') || 'valid was not true'}`);
    }
  }
  const fleetList = stdout('fleet-list');
  for (const name of ['wtfp-plan-section', 'wtfp-draft-review']) {
    if (!fleetList.includes(`${name}  extension  valid`)) errors.push(`fleet-list: ${name} is not extension/valid`);
  }
  let fleetBoundaries = null;
  try {
    if (containmentFailure) throw new Error('config-root containment failed before fleet-boundary probing');
    fleetBoundaries = fleetBoundaryProbe(
      options.clioSource,
      path.join(root, 'clio', 'config', 'extensions', 'wtfp')
    );
    if (fleetBoundaries.exit_code !== 0 || fleetBoundaries.valid !== true) {
      errors.push('canonical fleet-boundary probe did not prove corrected directory-root coverage');
    }
  } catch (error) {
    errors.push(`canonical fleet-boundary probe failed: ${error.message}`);
  }
  return {
    schema: 'wtfp.evaluation.clio-native-preflight/v1',
    valid: errors.length === 0,
    checks: {
      minimal_settings_exact: Object.keys(expectedSettings).every(key =>
        JSON.stringify(canonicalJson(inspectedSettings.get(key))) === JSON.stringify(canonicalJson(expectedSettings[key]))),
      command_count: results.length,
      all_exit_zero: results.every(result => result.exit_code === 0),
      expected_extension_agents: expectedAgents.length,
      observed_extension_agents: expectedAgents.filter(id => observedAgents.has(id)).length,
      extension_effective: Boolean(extension?.enabled && extension?.effective),
      fleet_list_declares_valid: ['wtfp-plan-section', 'wtfp-draft-review']
        .every(name => fleetList.includes(`${name}  extension  valid`)),
      fleet_validate_compiles_agents: ['fleet-plan-validate', 'fleet-draft-validate']
        .every(name => {
          try { return JSON.parse(stdout(name)).valid === true; } catch { return false; }
        }),
      fleet_graph_exit_zero: ['fleet-plan-graph', 'fleet-draft-graph']
        .every(name => byName.get(name)?.exit_code === 0),
      fleet_directory_write_boundaries: fleetBoundaries?.valid === true
    },
    fleet_boundaries: fleetBoundaries,
    errors,
    commands: results
  };
}

function prepare(options, sources) {
  const root = createRoot(options.root);
  const paths = isolatedPaths(root, options.clioSource, 'S1');
  const resumePaths = isolatedPaths(root, options.clioSource, 'S2');
  for (const directory of [
    ...[paths, resumePaths].flatMap(sessionPaths => Object.entries(sessionPaths)
      .filter(([key]) => key === 'HOME' || key === 'TMPDIR' || key.startsWith('XDG_') ||
        (key.startsWith('CLIO_CODER_') && key.endsWith('_DIR'))).map(([, value]) => value)),
    path.join(root, 'evidence'),
    path.join(root, 'project')
  ]) makePrivateDirectory(directory);

  const fixture = initializeFixture(path.join(root, 'project'), sources.fixture);
  const gitControl = gitControlSnapshot(path.join(root, 'project'));
  const plan = buildPlan(options, sources, root);
  const normalProfilePaths = profilePathList();
  const normalProfilesBefore = snapshotProfiles(normalProfilePaths);
  writeJsonPrivate(path.join(root, 'evidence', 'normal-profiles-prepare-pre.json'), normalProfilesBefore);
  for (const action of plan.actions) {
    writePrivate(path.join(root, 'evidence', 'invocations', `${String(action.index).padStart(2, '0')}-${action.action}.txt`), action.invocation);
  }
  const isolatedSettingsPath = path.join(paths.CLIO_CODER_CONFIG_DIR, 'settings.yaml');
  const effectiveSettings = minimalEvaluationSettings(options);
  writeJsonPrivate(isolatedSettingsPath, effectiveSettings);
  const effectiveSettingsSha256 = sha256(fs.readFileSync(isolatedSettingsPath));
  const env = sanitizedChildEnv(paths);
  const native = runNativePreflight(options, root, env);
  const nativeCredentialPath = path.join(paths.CLIO_CODER_CONFIG_DIR, 'credentials.yaml');
  let nativeConfigContained = true;
  try {
    assertContainedPrivateDirectory(root, paths.CLIO_CODER_CONFIG_DIR, 'isolated Clio config root');
  } catch (error) {
    nativeConfigContained = false;
    native.errors.push(`native preflight changed config-root containment: ${error.message}`);
  }
  const nativeCredentialObserved = nativeConfigContained && pathEntryExists(nativeCredentialPath);
  const nativeCredentialMetadata = nativeCredentialObserved
    ? (() => {
      const stat = fs.lstatSync(nativeCredentialPath);
      return {
        kind: stat.isSymbolicLink() ? 'symlink' : stat.isFile() ? 'file' : 'other',
        bytes: stat.isFile() ? stat.size : null,
        mode: (stat.mode & 0o777).toString(8).padStart(4, '0'),
        contents_inspected: false
      };
    })()
    : null;
  const nativeCredentialCleanup = cleanupCredentialArtifactsSafe(
    paths.CLIO_CODER_CONFIG_DIR,
    nativeCredentialPath,
    root
  );
  try {
    assertContainedPrivateDirectory(root, paths.CLIO_CODER_CONFIG_DIR, 'isolated Clio config root');
  } catch (error) {
    nativeConfigContained = false;
    native.errors.push(`native credential cleanup left an untrusted config root: ${error.message}`);
  }
  const nativeCredentialDestinationAbsent = nativeConfigContained
    ? !pathEntryExists(nativeCredentialPath)
    : null;
  const projectAfterNative = snapshotProject(path.join(root, 'project'));
  const nativeProjectChanges = diffSnapshots(fixture.content, projectAfterNative);
  const gitAfterNative = gitControlSnapshot(path.join(root, 'project'));
  const normalProfilesAfter = snapshotProfiles(normalProfilePaths);
  const resumeStateAfterNative = sessionPrivateState(resumePaths, root);
  const receiptsAfterNative = collectReceipts(root);
  writeJsonPrivate(path.join(root, 'evidence', 'normal-profiles-prepare-post.json'), normalProfilesAfter);
  native.project_mutations = nativeProjectChanges;
  native.git_control = {
    before: gitControl,
    after: gitAfterNative,
    unchanged: gitControlEqual(gitControl, gitAfterNative)
  };
  native.normal_profiles = {
    before: normalProfilesBefore,
    after: normalProfilesAfter,
    unchanged: profilesEqual(normalProfilesBefore, normalProfilesAfter)
  };
  native.credential_artifacts = {
    observed: nativeCredentialObserved,
    metadata: nativeCredentialMetadata,
    forwarded: false,
    cleanup: nativeCredentialCleanup,
    containment_verified: nativeConfigContained,
    destination_absent: nativeCredentialDestinationAbsent
  };
  if (nativeProjectChanges.length > 0) native.errors.push('native preflight mutated the fixture project');
  if (!native.git_control.unchanged) native.errors.push('native preflight changed the fixture Git control plane');
  if (!native.normal_profiles.unchanged) native.errors.push('native preflight changed a normal client profile');
  if (nativeCredentialCleanup.status !== 'securely-removed' || !nativeCredentialCleanup.absent ||
    nativeCredentialDestinationAbsent !== true) {
    native.errors.push('native preflight credential artifacts were not securely removed');
  }
  if (!resumeStateAfterNative.pristine) native.errors.push('native preflight contaminated the fresh S2 client-state surface');
  if (receiptsAfterNative.receipts.length > 0) native.errors.push('credential-free native preflight unexpectedly produced receipts');
  let effectiveSettingsAfterNativeSha256 = null;
  try {
    effectiveSettingsAfterNativeSha256 = containedPrivateFileSha256(
      root,
      paths.CLIO_CODER_CONFIG_DIR,
      isolatedSettingsPath,
      'sealed minimal evaluation settings'
    );
  } catch (error) {
    native.errors.push(`native preflight settings containment failed: ${error.message}`);
  }
  if (effectiveSettingsAfterNativeSha256 !== effectiveSettingsSha256) {
    native.errors.push('native preflight changed the sealed minimal evaluation settings');
  }
  native.fresh_session_state = resumeStateAfterNative;
  native.receipts = { count: receiptsAfterNative.receipts.length, cost: receiptsAfterNative.cost };
  const nativeEvidenceFile = path.join(root, 'evidence', 'native-preflight.json');
  const clientVersion = fs.readFileSync(path.join(root, 'evidence', 'native', 'version.stdout'), 'utf8').trim();
  const installedExtension = path.join(paths.CLIO_CODER_CONFIG_DIR, 'extensions', 'wtfp');
  let installedHash = null;
  if (nativeConfigContained) {
    assertContainedPrivateDirectory(root, paths.CLIO_CODER_CONFIG_DIR, 'isolated Clio config root');
    assertDirectory(installedExtension, 'installed WTF-P extension');
    installedHash = hashTree(installedExtension).sha256;
  }
  if (installedHash !== sources.wtfp.extension_sha256) {
    native.errors.push(`installed extension hash ${installedHash} != source ${sources.wtfp.extension_sha256}`);
  }
  native.valid = native.errors.length === 0;
  writeJsonPrivate(nativeEvidenceFile, native);

  const prepared = {
    schema: 'wtfp.evaluation.clio-lifecycle-prepared/v1',
    created_at: new Date().toISOString(),
    root,
    root_mode: (fs.statSync(root).mode & 0o777).toString(8).padStart(4, '0'),
    plan_sha256: sha256(Buffer.from(JSON.stringify(canonicalJson(plan)), 'utf8')),
    source: sources,
    fixture_commit: fixture.commit,
    fixture_initial_snapshot_sha256: sha256(Buffer.from(JSON.stringify(canonicalJson(fixture.content)), 'utf8')),
    git_control: gitControl,
    installed_extension_sha256: installedHash,
    effective_settings_sha256: effectiveSettingsSha256,
    effective_settings_policy_sha256: sha256(Buffer.from(JSON.stringify(canonicalJson(effectiveSettings)), 'utf8')),
    fresh_session_initial_sha256: resumeStateAfterNative.sha256,
    native_preflight_sha256: sha256(fs.readFileSync(nativeEvidenceFile)),
    client_version: clientVersion,
    normal_profiles: native.normal_profiles,
    native_preflight_valid: native.valid,
    native_preflight_errors: native.errors,
    native_checks: native.commands,
    paid_execution_ready: native.valid,
    credentials_forwarded: false,
    oracle_present_in_project: false
  };
  writeJsonPrivate(path.join(root, 'evidence', 'run-plan.json'), plan);
  writeJsonPrivate(path.join(root, 'evidence', PREPARED_FILE), prepared);
  return { root, prepared, plan };
}

function profilePathList(settingsSource = null, credentialsSource = null) {
  const normalHome = os.homedir();
  const defaults = [
    path.join(normalHome, '.config', 'clio-coder', 'settings.yaml'),
    path.join(normalHome, '.config', 'clio-coder', 'credentials.yaml'),
    path.join(normalHome, '.codex', 'config.toml'),
    path.join(normalHome, '.codex', 'auth.json')
  ];
  const extras = (process.env.WTFP_LIFECYCLE_PROFILE_PATHS || '')
    .split(path.delimiter).filter(Boolean).map(item => path.resolve(item));
  return [...new Set([...defaults, ...extras, settingsSource, credentialsSource]
    .filter(Boolean).map(item => path.resolve(item)))].sort();
}

function snapshotProfiles(paths) {
  return paths.map(file => {
    if (!fs.existsSync(file)) return { path: file, present: false, sha256: null, bytes: 0 };
    const stat = fs.lstatSync(file);
    if (stat.isDirectory()) {
      const tree = hashTree(file, { rejectSymlinks: false });
      return { path: file, present: true, kind: 'directory', sha256: tree.sha256, entries: tree.files.length };
    }
    const resolved = stat.isSymbolicLink() ? fs.realpathSync(file) : file;
    const resolvedStat = fs.statSync(resolved);
    if (!resolvedStat.isFile()) return { path: file, present: true, kind: 'other', sha256: null };
    return {
      path: file,
      resolved_path: resolved,
      present: true,
      kind: stat.isSymbolicLink() ? 'symlink-file' : 'file',
      bytes: resolvedStat.size,
      mode: (resolvedStat.mode & 0o777).toString(8).padStart(4, '0'),
      sha256: sha256(fs.readFileSync(resolved))
    };
  });
}

function profilesEqual(before, after) {
  return JSON.stringify(canonicalJson(before)) === JSON.stringify(canonicalJson(after));
}

function verifyPrepared(options, currentSources) {
  const root = options.root;
  assertDirectory(root, 'prepared root');
  if ((fs.statSync(root).mode & 0o077) !== 0) throw new Error('prepared root is not mode 0700');
  const file = path.join(root, 'evidence', PREPARED_FILE);
  assertRegularFile(file, 'prepared evidence');
  const prepared = JSON.parse(fs.readFileSync(file, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(path.join(root, 'evidence', 'run-plan.json'), 'utf8'));
  if (prepared.root !== root || plan.isolation.root !== root) throw new Error('prepared root identity mismatch');
  if (prepared.native_preflight_valid !== true || prepared.paid_execution_ready !== true) {
    throw new Error('native Clio preflight is not valid; paid execution is refused');
  }
  const optionChecks = [
    ['binary path', options.binary, plan.client.binary_path],
    ['Clio source path', options.clioSource, plan.client.source_root],
    ['extension path', options.extension, plan.extension.source_root],
    ['target', options.target, plan.requested.target],
    ['model', options.model, plan.requested.model],
    ['effort', options.effort, plan.requested.effort],
    ['budget', options.budgetUsd, plan.requested.maximum_cost_usd],
    ['timeout', options.timeoutMinutes, plan.requested.per_action_timeout_minutes]
  ];
  for (const [label, actual, expected] of optionChecks) {
    if (actual !== expected) throw new Error(`${label} differs from the inspected prepared plan`);
  }
  if (prepared.plan_sha256 !== sha256(Buffer.from(JSON.stringify(canonicalJson(plan)), 'utf8'))) {
    throw new Error('prepared plan digest mismatch');
  }
  const nativeEvidenceFile = path.join(root, 'evidence', 'native-preflight.json');
  assertRegularFile(nativeEvidenceFile, 'native preflight evidence');
  if (sha256(fs.readFileSync(nativeEvidenceFile)) !== prepared.native_preflight_sha256) {
    throw new Error('native preflight evidence changed after preparation');
  }
  for (const [label, expected, actual] of [
    ['WTF-P commit', prepared.source.wtfp.commit, currentSources.wtfp.commit],
    ['protocol', prepared.source.wtfp.protocol_sha256, currentSources.wtfp.protocol_sha256],
    ['extension', prepared.source.wtfp.extension_sha256, currentSources.wtfp.extension_sha256],
    ['generated envelope inventory', prepared.source.wtfp.generated_manifest_sha256, currentSources.wtfp.generated_manifest_sha256],
    ['generator source', prepared.source.wtfp.generator_source_sha256, currentSources.wtfp.generator_source_sha256],
    ['routing manifest', prepared.source.wtfp.routing_manifest_sha256, currentSources.wtfp.routing_manifest_sha256],
    ['evaluation runtime', prepared.source.wtfp.evaluation_runtime.sha256, currentSources.wtfp.evaluation_runtime.sha256],
    ['Clio commit', prepared.source.clio.commit, currentSources.clio.commit],
    ['Clio source', prepared.source.clio.source_sha256, currentSources.clio.source_sha256],
    ['Clio executable dist tree', prepared.source.clio.dist.sha256, currentSources.clio.dist.sha256],
    ['Clio installed runtime modules', prepared.source.clio.runtime_modules.sha256, currentSources.clio.runtime_modules.sha256],
    ['Node.js executable', prepared.source.clio.node.sha256, currentSources.clio.node.sha256],
    ['Node.js version', prepared.source.clio.node.version, currentSources.clio.node.version],
    ['Clio binary', prepared.source.clio.binary.sha256, currentSources.clio.binary.sha256],
    ['fixture', prepared.source.fixture.aggregate_sha256, currentSources.fixture.aggregate_sha256]
  ]) {
    if (expected !== actual) throw new Error(`${label} changed after preparation`);
  }
  const installed = path.join(root, 'clio', 'config', 'extensions', 'wtfp');
  assertContainedPrivateDirectory(root, path.join(root, 'clio', 'config'), 'prepared Clio config root');
  if (hashTree(installed).sha256 !== prepared.installed_extension_sha256) {
    throw new Error('installed extension changed after preparation');
  }
  const isolatedSettings = path.join(root, 'clio', 'config', 'settings.yaml');
  if (containedPrivateFileSha256(
    root,
    path.join(root, 'clio', 'config'),
    isolatedSettings,
    'prepared minimal evaluation settings'
  ) !== prepared.effective_settings_sha256 ||
    sha256(Buffer.from(JSON.stringify(canonicalJson(minimalEvaluationSettings(options))), 'utf8')) !==
      prepared.effective_settings_policy_sha256) {
    throw new Error('minimal evaluation settings changed after preparation');
  }
  const projectRoot = path.join(root, 'project');
  const currentProject = snapshotProject(projectRoot);
  const currentProjectSha256 = sha256(Buffer.from(JSON.stringify(canonicalJson(currentProject)), 'utf8'));
  if (currentProjectSha256 !== prepared.fixture_initial_snapshot_sha256) {
    throw new Error('prepared fixture project changed before execution');
  }
  if (!gitControlEqual(prepared.git_control, gitControlSnapshot(projectRoot))) {
    throw new Error('prepared fixture Git control plane changed before execution');
  }
  for (const file of currentSources.fixture.files.filter(entry => entry.audience === 'model')) {
    const candidate = path.join(projectRoot, file.path);
    assertRegularFile(candidate, `prepared fixture input ${file.path}`);
    if (sha256(fs.readFileSync(candidate)) !== file.sha256) {
      throw new Error(`prepared fixture input changed: ${file.path}`);
    }
  }
  for (const forbidden of ['expected-invariants.json', 'fixture.json', 'manifest.json']) {
    if (fs.existsSync(path.join(projectRoot, forbidden))) throw new Error(`evaluator-only fixture file leaked: ${forbidden}`);
  }
  if (pathEntryExists(path.join(root, 'clio', 'config', 'credentials.yaml'))) {
    throw new Error('isolated credentials existed before authorized forwarding');
  }
  const resumeState = sessionPrivateState(isolatedPaths(root, options.clioSource, 'S2'), root);
  if (!resumeState.pristine || resumeState.sha256 !== prepared.fresh_session_initial_sha256) {
    throw new Error('fresh S2 client-state surface changed before execution');
  }
  if (collectReceipts(root).receipts.length !== 0) {
    throw new Error('prepared root contains receipts before paid execution');
  }
  const executionMarker = path.join(root, 'evidence', 'execution-started.json');
  if (fs.existsSync(executionMarker)) throw new Error('prepared campaign has already started; refusing paid replay');
  return { prepared, plan };
}

function collectCredentialCandidates(text) {
  const values = new Set();
  try {
    const visit = value => {
      if (typeof value === 'string' && value.length >= 16) values.add(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(JSON.parse(text));
  } catch {
    for (const line of text.split(/\r?\n/u)) {
      const match = line.match(/^\s*[^#:\n]+:\s*["']?(.+?)["']?\s*$/u);
      if (match && match[1].length >= 16 && !/^\$\{/u.test(match[1])) values.add(match[1]);
    }
  }
  return [...values].sort((left, right) => right.length - left.length);
}

function scanAndRedactCredentialValues(root, credentialFile, candidates) {
  const findings = [];
  const anomalies = [];
  let entries;
  try {
    entries = walkFiles(root, { rejectSymlinks: false });
  } catch (error) {
    return {
      valid: false,
      scanned_files: 0,
      scanned_bytes: 0,
      findings,
      anomalies: [{ path: null, reason: `tree traversal failed: ${error.message}` }]
    };
  }
  let scannedBytes = 0;
  let scannedFiles = 0;
  for (const entry of entries) {
    if (entry.absolute === credentialFile) continue;
    if (entry.kind !== 'file') {
      anomalies.push({ path: entry.path, reason: `unscanned ${entry.kind} entry` });
      continue;
    }
    if (entry.stat.nlink !== 1) {
      anomalies.push({ path: entry.path, reason: 'unscanned multiply linked file', links: entry.stat.nlink });
      continue;
    }
    if (entry.stat.size > 128 * 1024 * 1024) {
      anomalies.push({ path: entry.path, reason: 'unscanned file exceeds 128 MiB safety ceiling', bytes: entry.stat.size });
      continue;
    }
    let content;
    try {
      content = fs.readFileSync(entry.absolute);
    } catch (error) {
      anomalies.push({ path: entry.path, reason: `read failed: ${error.message}` });
      continue;
    }
    scannedFiles += 1;
    scannedBytes += content.length;
    let redacted = content;
    let replacements = 0;
    for (const candidate of candidates) {
      if (!candidate) continue;
      const needle = Buffer.from(candidate, 'utf8');
      const replacement = Buffer.from('[REDACTED-CREDENTIAL]', 'utf8');
      const segments = [];
      let cursor = 0;
      let found = redacted.indexOf(needle, cursor);
      if (found === -1) continue;
      while (found !== -1) {
        segments.push(redacted.subarray(cursor, found), replacement);
        replacements += 1;
        cursor = found + needle.length;
        found = redacted.indexOf(needle, cursor);
      }
      segments.push(redacted.subarray(cursor));
      redacted = Buffer.concat(segments);
    }
    if (replacements > 0) {
      try {
        writePrivate(entry.absolute, redacted);
        findings.push({ path: path.relative(root, entry.absolute), replacements });
      } catch (error) {
        anomalies.push({ path: entry.path, reason: `redaction write failed: ${error.message}` });
      }
    }
  }
  return {
    valid: anomalies.length === 0,
    scanned_files: scannedFiles,
    scanned_bytes: scannedBytes,
    findings,
    anomalies
  };
}

function pathEntryExists(file) {
  try {
    fs.lstatSync(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function assertContainedPrivateDirectory(root, directory, label) {
  const absoluteRoot = path.resolve(root);
  const absoluteDirectory = path.resolve(directory);
  if (!isContained(absoluteRoot, absoluteDirectory)) throw new Error(`${label} escaped its disposable root`);
  const rootStat = fs.lstatSync(absoluteRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory() || (rootStat.mode & 0o077) !== 0) {
    throw new Error(`${label} disposable root changed type or permissions`);
  }
  const relative = path.relative(absoluteRoot, absoluteDirectory);
  let cursor = absoluteRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink() || !stat.isDirectory() || (stat.mode & 0o077) !== 0) {
      throw new Error(`${label} contains a symbolic, non-directory, or non-private ancestor`);
    }
  }
  const rootReal = fs.realpathSync(absoluteRoot);
  const directoryReal = fs.realpathSync(absoluteDirectory);
  if (!isContained(rootReal, directoryReal)) throw new Error(`${label} resolves outside its disposable root`);
  return directoryReal;
}

function bindContainedPrivateDirectory(root, directory, label) {
  const absoluteRoot = path.resolve(root);
  const absoluteDirectory = path.resolve(directory);
  assertContainedPrivateDirectory(absoluteRoot, absoluteDirectory, label);
  const relative = path.relative(absoluteRoot, absoluteDirectory);
  const paths = [absoluteRoot];
  let cursor = absoluteRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    paths.push(cursor);
  }
  return Object.freeze({
    root: absoluteRoot,
    directory: absoluteDirectory,
    entries: Object.freeze(paths.map(entryPath => {
      const stat = fs.lstatSync(entryPath);
      return Object.freeze({
        path: entryPath,
        realpath: fs.realpathSync(entryPath),
        device: stat.dev,
        inode: stat.ino
      });
    }))
  });
}

function assertContainedPrivateDirectoryBinding(binding, label) {
  if (!binding || !Array.isArray(binding.entries) || binding.entries.length === 0) {
    throw new Error(`${label} has no pre-execution directory binding`);
  }
  for (const entry of binding.entries) {
    const stat = fs.lstatSync(entry.path);
    if (stat.isSymbolicLink() || !stat.isDirectory() || (stat.mode & 0o077) !== 0 ||
        stat.dev !== entry.device || stat.ino !== entry.inode || fs.realpathSync(entry.path) !== entry.realpath) {
      throw new Error(`${label} directory binding changed: ${entry.path}`);
    }
  }
  assertContainedPrivateDirectory(binding.root, binding.directory, label);
  return binding.directory;
}

function readContainedPrivateFileEvidence(root, directory, file, label, options = {}) {
  const maxBytes = options.maxBytes ?? 128 * 1024 * 1024;
  if (options.approveCredentialRotation === true && pruneInactiveProcessGroups().length > 0) {
    throw new Error(`${label} rotation approval requires every owned process group to be quiescent`);
  }
  const absoluteDirectory = path.resolve(directory);
  const absoluteFile = path.resolve(file);
  if (!isContained(absoluteDirectory, absoluteFile) || absoluteFile === absoluteDirectory) {
    throw new Error(`${label} escaped its private directory`);
  }
  if (options.directoryBinding &&
      (options.directoryBinding.root !== path.resolve(root) ||
       options.directoryBinding.directory !== absoluteDirectory)) {
    throw new Error(`${label} directory binding does not match the requested root and directory`);
  }
  const validateDirectory = () => options.directoryBinding
    ? assertContainedPrivateDirectoryBinding(options.directoryBinding, `${label} directory`)
    : assertContainedPrivateDirectory(root, absoluteDirectory, `${label} directory`);
  validateDirectory();
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  const descriptor = fs.openSync(absoluteFile, flags);
  try {
    const openedStat = fs.fstatSync(descriptor);
    if (!openedStat.isFile() || openedStat.nlink !== 1 || (openedStat.mode & 0o077) !== 0) {
      throw new Error(`${label} must be a singly linked private regular file`);
    }
    if (openedStat.size > maxBytes) throw new Error(`${label} exceeds its ${maxBytes}-byte read ceiling`);
    validateDirectory();
    const pathStat = fs.lstatSync(absoluteFile);
    const descriptorStat = fs.fstatSync(descriptor);
    if (pathStat.isSymbolicLink() || !pathStat.isFile() ||
        pathStat.dev !== descriptorStat.dev || pathStat.ino !== descriptorStat.ino ||
        descriptorStat.dev !== openedStat.dev || descriptorStat.ino !== openedStat.ino ||
        descriptorStat.nlink !== 1 || (descriptorStat.mode & 0o077) !== 0) {
      throw new Error(`${label} identity, link count, or permissions changed before read`);
    }
    const bytes = fs.readFileSync(descriptor);
    return {
      bytes,
      device: descriptorStat.dev,
      inode: descriptorStat.ino,
      links: descriptorStat.nlink,
      mode: descriptorStat.mode & 0o777,
      size: descriptorStat.size,
      sha256: sha256(bytes),
      bounded_read_succeeded: true,
      credential_rotation_approval: options.approveCredentialRotation === true
        ? ROTATED_CREDENTIAL_READ_APPROVAL
        : null
    };
  } finally {
    fs.closeSync(descriptor);
  }
}

function readContainedPrivateFile(root, directory, file, label, maxBytes = 128 * 1024 * 1024) {
  return readContainedPrivateFileEvidence(root, directory, file, label, { maxBytes }).bytes;
}

function containedPrivateFileSha256(root, directory, file, label) {
  return sha256(readContainedPrivateFile(root, directory, file, label));
}

function assertCleanupDirectory(options) {
  if (!options.configRoot) return;
  if (options.directoryBinding) {
    if (options.directoryBinding.directory !== path.resolve(options.configRoot) ||
        (options.disposableRoot && options.directoryBinding.root !== path.resolve(options.disposableRoot))) {
      throw new Error('isolated Clio config-root binding does not match cleanup paths');
    }
    assertContainedPrivateDirectoryBinding(options.directoryBinding, 'isolated Clio config root');
  } else if (options.disposableRoot) {
    assertContainedPrivateDirectory(options.disposableRoot, options.configRoot, 'isolated Clio config root');
  } else {
    assertDirectory(options.configRoot, 'isolated Clio config root');
  }
}

function unlinkSafeCleanupLink(file, options, blocking, expectedStat = null) {
  try {
    assertCleanupDirectory(options);
    const observed = fs.lstatSync(file);
    if (expectedStat && (observed.dev !== expectedStat.dev || observed.ino !== expectedStat.ino)) {
      return { status: 'cleanup-failed', method: 'identity-changed-before-safe-unlink', absent: false };
    }
    const symbolic = observed.isSymbolicLink();
    const multiplyLinked = observed.isFile() && observed.nlink > 1;
    if (!symbolic && !multiplyLinked) {
      return { status: 'cleanup-failed', method: 'refused-substituted-singleton', absent: false };
    }
    assertCleanupDirectory(options);
    const verified = fs.lstatSync(file);
    if (verified.dev !== observed.dev || verified.ino !== observed.ino ||
        verified.isSymbolicLink() !== symbolic ||
        (multiplyLinked && (!verified.isFile() || verified.nlink <= 1))) {
      return { status: 'cleanup-failed', method: 'identity-changed-before-safe-unlink', absent: false };
    }
    fs.unlinkSync(file);
    assertCleanupDirectory(options);
    return {
      status: blocking ? 'cleanup-failed' : 'securely-removed',
      method: blocking
        ? symbolic ? 'unlink-substituted-symlink-without-following' : 'unlink-multiply-linked-without-overwrite'
        : symbolic ? 'unlink-symlink-without-following' : 'unlink-multiply-linked-without-overwrite',
      absent: !pathEntryExists(file)
    };
  } catch (error) {
    return { status: 'cleanup-failed', method: 'safe-unlink-failed', absent: false, error: error.message };
  }
}

function secureRemove(file, options = {}) {
  const cleanupOptions = {
    configRoot: options.configRoot || null,
    disposableRoot: options.disposableRoot || null,
    directoryBinding: options.directoryBinding || null
  };
  try {
    if (cleanupOptions.configRoot &&
        (!isContained(cleanupOptions.configRoot, file) || path.resolve(file) === path.resolve(cleanupOptions.configRoot))) {
      throw new Error('credential cleanup path escaped its config root');
    }
    assertCleanupDirectory(cleanupOptions);
    if (!pathEntryExists(file)) return { status: 'securely-removed', method: 'already-absent', absent: true };
  } catch (error) {
    return { status: 'cleanup-failed', method: 'containment-check-failed', absent: false, error: error.message };
  }
  const initialStat = fs.lstatSync(file);
  if (initialStat.isSymbolicLink()) {
    return unlinkSafeCleanupLink(file, cleanupOptions, Boolean(options.expected), initialStat);
  }
  if (!initialStat.isFile()) return { status: 'cleanup-failed', method: 'refused-non-file', absent: false };
  if (initialStat.nlink > 1) return unlinkSafeCleanupLink(file, cleanupOptions, true, initialStat);
  const expectedInode = !options.expected ||
    (initialStat.dev === options.expected.device && initialStat.ino === options.expected.inode);
  const approvedRotation = options.approvedRotated;
  const approvedRotatedInode = Boolean(options.expected && !expectedInode && options.directoryBinding &&
    approvedRotation?.bounded_read_succeeded === true && approvedRotation.device === initialStat.dev &&
    approvedRotation.credential_rotation_approval === ROTATED_CREDENTIAL_READ_APPROVAL &&
    approvedRotation.inode === initialStat.ino && approvedRotation.links === 1 &&
    approvedRotation.mode === 0o600 && approvedRotation.size === initialStat.size &&
    (initialStat.mode & 0o777) === 0o600);
  if (options.expected && !expectedInode && !approvedRotatedInode) {
    return { status: 'cleanup-failed', method: 'refused-substituted-singleton', absent: false };
  }

  try { options.hooks?.beforeOpen?.(); } catch (error) {
    return { status: 'cleanup-failed', method: 'before-open-hook-failed', absent: false, error: error.message };
  }
  let descriptor;
  try {
    assertCleanupDirectory(cleanupOptions);
    descriptor = fs.openSync(file, fs.constants.O_RDWR | (fs.constants.O_NOFOLLOW || 0));
  } catch (error) {
    const changed = unlinkSafeCleanupLink(file, cleanupOptions, true);
    return { ...changed, open_error: error.message };
  }

  let result;
  try {
    const openedStat = fs.fstatSync(descriptor);
    assertCleanupDirectory(cleanupOptions);
    const pathStat = fs.lstatSync(file);
    if (!openedStat.isFile() || openedStat.dev !== initialStat.dev || openedStat.ino !== initialStat.ino ||
        openedStat.nlink !== 1 || (openedStat.mode & 0o777) !== 0o600 ||
        pathStat.isSymbolicLink() || !pathStat.isFile() ||
        pathStat.dev !== openedStat.dev || pathStat.ino !== openedStat.ino ||
        pathStat.nlink !== 1 || (pathStat.mode & 0o777) !== 0o600) {
      result = unlinkSafeCleanupLink(file, cleanupOptions, true, pathStat);
    } else {
      const size = openedStat.size;
      const zeroes = Buffer.alloc(Math.min(Math.max(size, 1), 1024 * 1024));
      for (let pass = 0; pass < 3; pass += 1) {
        let offset = 0;
        while (offset < size) {
          const length = Math.min(zeroes.length, size - offset);
          fs.writeSync(descriptor, zeroes, 0, length, offset);
          offset += length;
        }
        fs.fsyncSync(descriptor);
      }
      fs.ftruncateSync(descriptor, 0);
      fs.fsyncSync(descriptor);
      try { options.hooks?.beforeUnlink?.(); } catch (error) {
        result = { status: 'cleanup-failed', method: 'before-unlink-hook-failed', absent: false, error: error.message };
      }
      if (!result) {
        assertCleanupDirectory(cleanupOptions);
        const finalPathStat = fs.lstatSync(file);
        const finalDescriptorStat = fs.fstatSync(descriptor);
        if (finalPathStat.isSymbolicLink() || !finalPathStat.isFile() ||
            finalPathStat.dev !== finalDescriptorStat.dev || finalPathStat.ino !== finalDescriptorStat.ino ||
            finalPathStat.nlink !== 1 || (finalPathStat.mode & 0o777) !== 0o600 ||
            finalDescriptorStat.dev !== openedStat.dev || finalDescriptorStat.ino !== openedStat.ino ||
            finalDescriptorStat.nlink !== 1 || (finalDescriptorStat.mode & 0o777) !== 0o600) {
          result = unlinkSafeCleanupLink(file, cleanupOptions, true, finalPathStat);
        } else {
          assertCleanupDirectory(cleanupOptions);
          fs.unlinkSync(file);
          assertCleanupDirectory(cleanupOptions);
          result = {
            status: 'securely-removed',
            method: approvedRotatedInode ? 'rotated-inode' : 'descriptor-overwrite-fsync-truncate-unlink',
            inode_disposition: approvedRotatedInode ? 'rotated-inode' : 'owned-inode',
            absent: !pathEntryExists(file)
          };
        }
      }
    }
  } catch (error) {
    result = { status: 'cleanup-failed', method: 'descriptor-cleanup-failed', absent: false, error: error.message };
  } finally {
    try { fs.closeSync(descriptor); } catch { /* preserve the cleanup result */ }
  }
  return result;
}

function cleanupCredentialArtifacts(configRoot, primary, disposableRoot = null, options = {}) {
  const directoryBinding = options.directoryBinding || null;
  assertCleanupDirectory({ configRoot, disposableRoot, directoryBinding });
  const candidates = walkFiles(configRoot, { rejectSymlinks: false })
    .filter(entry => {
      const name = path.basename(entry.path);
      return name === 'credentials.yaml' || name.startsWith('credentials.yaml.') ||
        name.startsWith('.credentials.yaml.tmp-');
    })
    .map(entry => entry.absolute);
  if (pathEntryExists(primary) && !candidates.includes(primary)) candidates.push(primary);
  const files = [...new Set(candidates)].sort();
  const results = files.map(file => ({
    path: path.relative(configRoot, file),
    ...secureRemove(file, {
      configRoot,
      disposableRoot,
      directoryBinding,
      expected: file === primary ? options.expected : null,
      approvedRotated: file === primary ? options.approvedRotated : null
    })
  }));
  const allRemoved = results.every(result => result.status === 'securely-removed' && result.absent);
  return {
    status: allRemoved ? 'securely-removed' : 'cleanup-failed',
    absent: files.every(file => !pathEntryExists(file)),
    files: results,
    method: results.map(result => result.method).join(',') || 'already-absent'
  };
}

function cleanupCredentialArtifactsSafe(
  configRoot,
  primary,
  disposableRoot = null,
  credentialHandle = null,
  approvedRotated = null
) {
  let descriptorWipe;
  try {
    descriptorWipe = wipeCredentialHandle(credentialHandle);
  } catch (error) {
    return {
      status: 'cleanup-failed',
      absent: false,
      files: [],
      method: 'descriptor-wipe-failed',
      handle_present: Boolean(credentialHandle),
      descriptor_identity_verified: credentialHandle?.identity_verified === true,
      descriptor_wiped: credentialHandle?.wiped === true,
      descriptor_closed: credentialHandle?.closed === true,
      links_before_overwrite: credentialHandle?.links_before_overwrite ?? null,
      link_count_anomaly: credentialHandle?.link_count_anomaly === true,
      directory_binding_verified: false,
      error: error.message
    };
  }
  if (pruneInactiveProcessGroups().length > 0) {
    return {
      status: 'cleanup-failed',
      absent: false,
      files: [],
      method: 'refused-active-process-groups',
      directory_binding_verified: false,
      ...descriptorWipe
    };
  }
  try {
    let directoryBindingVerified = false;
    if (credentialHandle?.directory_binding) {
      assertContainedPrivateDirectoryBinding(
        credentialHandle.directory_binding,
        'isolated Clio config root'
      );
      directoryBindingVerified = true;
    } else if (disposableRoot) {
      assertContainedPrivateDirectory(disposableRoot, configRoot, 'isolated Clio config root');
    }
    const stat = fs.lstatSync(configRoot);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      return { status: 'cleanup-failed', absent: false, files: [], method: 'refused-changed-config-root', ...descriptorWipe };
    }
    const pathnameCleanup = cleanupCredentialArtifacts(configRoot, primary, disposableRoot, {
      directoryBinding: credentialHandle?.directory_binding || null,
      expected: credentialHandle ? { device: credentialHandle.device, inode: credentialHandle.inode } : null,
      approvedRotated
    });
    const combined = {
      ...pathnameCleanup,
      ...descriptorWipe,
      directory_binding_verified: directoryBindingVerified
    };
    if (descriptorWipe.link_count_anomaly) {
      combined.status = 'cleanup-failed';
      combined.method = [pathnameCleanup.method, 'retained-descriptor-link-count-anomaly'].filter(Boolean).join(',');
    }
    return combined;
  } catch (error) {
    return {
      status: 'cleanup-failed',
      absent: false,
      files: [],
      method: 'cleanup-exception',
      ...descriptorWipe,
      directory_binding_verified: false,
      error: error.message
    };
  }
}

function isForbiddenToolName(name) {
  return /(?:^|[-_.])(bash|shell|terminal|git|vcs|network|browser|web|http|fetch|curl|wget)(?:$|[-_.])/iu.test(name);
}

function eventToolAudit(events, roots) {
  const calls = events.filter(event => event.type === 'tool_execution_start');
  const ends = new Map(events.filter(event => event.type === 'tool_execution_end')
    .map(event => [event.toolCallId, event]));
  const errors = [];
  const tools = new Map();
  const dispatch = [];
  const fileMutations = [];
  for (const event of calls) {
    const name = event.toolName || 'unknown';
    tools.set(name, (tools.get(name) || 0) + 1);
    if (isForbiddenToolName(name)) errors.push(`forbidden tool invoked: ${name}`);
    if (name === 'dispatch') {
      const agents = [];
      const collectAgents = (value, key = '') => {
        if (typeof value === 'string' && /(?:^|_)(?:agent|agent_id|recipe|recipe_id)$/iu.test(key)) agents.push(value);
        else if (Array.isArray(value)) value.forEach(item => collectAgents(item, key));
        else if (value && typeof value === 'object') {
          for (const [childKey, child] of Object.entries(value)) collectAgents(child, childKey);
        }
      };
      collectAgents(event.args || {});
      const end = ends.get(event.toolCallId);
      const terminalSuccess = Boolean(end && end.isError !== true && end.outcome === 'ok');
      const details = end?.result?.details;
      const terminalRunIds = Array.isArray(details?.terminalRunIds)
        ? details.terminalRunIds.filter(value => typeof value === 'string') : [];
      const assignmentIds = Array.isArray(details?.assignmentIds)
        ? details.assignmentIds.filter(value => typeof value === 'string') : [];
      const runs = Array.isArray(details?.runs) ? details.runs.filter(value => value && typeof value === 'object').map(run => ({
        run_id: typeof run.runId === 'string' ? run.runId : null,
        agent_id: typeof run.agentId === 'string' ? run.agentId : null,
        exit_code: Number.isInteger(run.exitCode) ? run.exitCode : null,
        receipt_path: typeof run.receiptPath === 'string' ? run.receiptPath : null,
        receipt_integrity_ok: run.receiptIntegrity?.ok === true
      })) : [];
      if (!event.toolCallId) errors.push('dispatch tool call omitted toolCallId');
      if (terminalSuccess) {
        if (!details || terminalRunIds.length === 0 || runs.length === 0) {
          errors.push('successful dispatch omitted terminal run details');
        }
        if (terminalRunIds.length !== new Set(terminalRunIds).size) {
          errors.push('successful dispatch repeated a terminal run id');
        }
        if (runs.some(run => !run.run_id || !run.agent_id || run.exit_code !== 0 || !run.receipt_integrity_ok)) {
          errors.push('successful dispatch contained an incomplete, failed, or integrity-invalid run projection');
        }
        const projected = runs.map(run => run.run_id).sort();
        if (JSON.stringify(projected) !== JSON.stringify([...terminalRunIds].sort())) {
          errors.push('successful dispatch terminalRunIds did not match projected runs');
        }
      }
      const task = typeof event.args?.task === 'string' ? event.args.task : null;
      dispatch.push({
        args_sha256: sha256(Buffer.from(JSON.stringify(event.args || {}), 'utf8')),
        agents: [...new Set(agents)].sort(),
        action: event.args?.action || null,
        target: typeof event.args?.target === 'string' ? event.args.target : null,
        model: typeof event.args?.model === 'string' ? event.args.model : null,
        thinking_level: typeof event.args?.thinking_level === 'string' ? event.args.thinking_level : null,
        node: typeof event.args?.node === 'string' ? event.args.node : null,
        task_bytes: task === null ? null : Buffer.byteLength(task, 'utf8'),
        task_sha256: task === null ? null : sha256(Buffer.from(task, 'utf8')),
        synchronous_singular: task !== null && event.args?.tasks === undefined &&
          event.args?.detach !== true && event.args?.mode === undefined && event.args?.review === undefined,
        completed: Boolean(end),
        is_error: end?.isError === true,
        outcome: end?.outcome || null,
        terminal_success: terminalSuccess,
        assignment_ids: assignmentIds,
        terminal_run_ids: terminalRunIds,
        runs,
        result_sha256: end ? sha256(Buffer.from(JSON.stringify(end.result || null), 'utf8')) : null
      });
    }
    const observedPaths = [];
    const visit = (value, key = '') => {
      const pathKey = /(?:^|_)(?:path|paths|file|files|cwd|directory|destination)$/iu.test(key) ||
        /(?:Path|File|Directory|Destination)$/u.test(key);
      if (typeof value === 'string' && pathKey) {
        const absolute = path.isAbsolute(value) ? path.resolve(value) : path.resolve(roots.project, value);
        if (key !== 'cwd') observedPaths.push(absolute);
        const authorizedRoots = [roots.project, roots.extension, ...(roots.additional || [])].filter(Boolean);
        if (!authorizedRoots.some(root => isContained(root, absolute))) {
          errors.push(`${name}: path escaped authorized roots (${key})`);
        }
      } else if (Array.isArray(value)) value.forEach(item => visit(item, key));
      else if (value && typeof value === 'object') {
        for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
      }
    };
    visit(event.args || {});
    if (/(?:^|[-_.])(write|edit|patch|artifact|delete|remove|move|rename)(?:$|[-_.])/iu.test(name)) {
      fileMutations.push({
        tool: name,
        paths: [...new Set(observedPaths)].sort(),
        args_sha256: sha256(Buffer.from(JSON.stringify(event.args || {}), 'utf8'))
      });
    }
  }
  return {
    valid: errors.length === 0,
    call_count: calls.length,
    tools: Object.fromEntries([...tools.entries()].sort()),
    file_mutations: fileMutations,
    dispatch,
    errors
  };
}

function checkToolMutationBoundary(action, toolAudits, projectRoot) {
  const rule = PHASE_RULES[action];
  const errors = [];
  const mutations = toolAudits.flatMap(audit => audit.file_mutations || []);
  for (const mutation of mutations) {
    if (mutation.paths.length === 0) {
      errors.push(`${action}: ${mutation.tool} mutation path was not observable`);
      continue;
    }
    for (const absolute of mutation.paths) {
      if (!isContained(projectRoot, absolute)) {
        errors.push(`${action}: ${mutation.tool} targeted a non-project path`);
        continue;
      }
      const relative = path.relative(projectRoot, absolute).split(path.sep).join('/');
      if (!rule.allowed.some(pattern => pattern.test(relative))) {
        errors.push(`${action}: ${mutation.tool} targeted undeclared path ${relative}`);
      }
    }
  }
  return { valid: errors.length === 0, mutations, errors };
}

function clioStateRoots(root) {
  return [path.join(root, 'clio', 'state'), path.join(root, 'clio', 'state-s2')];
}

function auditFiles(root) {
  return clioStateRoots(root).flatMap(stateRoot => {
    const auditRoot = path.join(stateRoot, 'audit');
    if (!fs.existsSync(auditRoot)) return [];
    return walkFiles(auditRoot).filter(entry => entry.path.endsWith('.jsonl')).map(entry => ({
      ...entry,
      evidencePath: path.relative(root, entry.absolute).split(path.sep).join('/')
    }));
  });
}

function snapshotAuditOffsets(root) {
  return Object.fromEntries(auditFiles(root).map(entry => [entry.evidencePath, entry.stat.size]));
}

function auditEventsSince(root, offsets) {
  const events = [];
  const errors = [];
  for (const entry of auditFiles(root)) {
    const start = offsets[entry.evidencePath] || 0;
    if (entry.stat.size < start) {
      errors.push(`${entry.evidencePath}: audit log shrank during action`);
      continue;
    }
    if (entry.stat.size === start) continue;
    const descriptor = fs.openSync(entry.absolute, 'r');
    try {
      const bytes = Buffer.alloc(entry.stat.size - start);
      fs.readSync(descriptor, bytes, 0, bytes.length, start);
      const parsed = parseJsonLines(bytes.toString('utf8'));
      errors.push(...parsed.errors.map(error => `${entry.evidencePath}: ${error}`));
      const seen = new Set();
      for (const audit of parsed.events.filter(item => item.kind === 'tool_call')) {
        const identity = `${audit.tool || ''}:${sha256(Buffer.from(JSON.stringify(audit.args || {}), 'utf8'))}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        events.push({ type: 'tool_execution_start', toolName: audit.tool, args: audit.args || {} });
      }
    } finally {
      fs.closeSync(descriptor);
    }
  }
  return { events, errors };
}

function parseWorkerJsonObject(text) {
  if (typeof text !== 'string' || text.trim().length === 0) return null;
  const trimmed = text.trim();
  const candidates = [trimmed];
  const fenced = /```[A-Za-z0-9_-]*\s*\n?([\s\S]*?)```/u.exec(trimmed)?.[1]?.trim();
  if (fenced) candidates.push(fenced);
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(trimmed.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    } catch {
      // Clio's contract reader also proceeds to the next bounded candidate.
    }
  }
  return null;
}

function hasOnlyKeys(value, allowed) {
  const keys = new Set(allowed);
  return Object.keys(value).every(key => keys.has(key));
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseWorkerChecks(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const checks = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
      !hasOnlyKeys(entry, ['name', 'passed', 'evidence']) ||
      !nonEmptyString(entry.name) || typeof entry.passed !== 'boolean' || !nonEmptyString(entry.evidence)) {
      return null;
    }
    checks.push({ name: entry.name, passed: entry.passed, evidence: entry.evidence });
  }
  return checks;
}

function parseWorkerResult(receipt, contract) {
  const errors = [];
  const output = receipt.output;
  const outputText = receipt.output_text;
  if (!output || output.state !== 'final' || output.truncated !== false ||
    !Number.isSafeInteger(output.bytes) || output.bytes < 1 ||
    !Number.isSafeInteger(output.captured_bytes) || output.captured_bytes !== output.bytes ||
    typeof outputText !== 'string' || Buffer.byteLength(outputText, 'utf8') !== output.bytes ||
    !/^[a-f0-9]{64}$/u.test(output.sha256 || '') || output.sha256 !== sha256(Buffer.from(outputText, 'utf8'))) {
    errors.push(`${receipt.agent_id}: receipt did not carry one complete, untruncated, hash-bound final output`);
    return { valid: false, result: null, summary: null, errors };
  }
  const value = parseWorkerJsonObject(outputText);
  if (value === null) {
    errors.push(`${receipt.agent_id}: final output did not contain a JSON object`);
    return { valid: false, result: null, summary: null, errors };
  }
  if (contract.kind === 'verifier-report') {
    const checks = parseWorkerChecks(value.checks);
    if (!hasOnlyKeys(value, ['verdict', 'checks']) ||
      (value.verdict !== 'pass' && value.verdict !== 'fail') || checks === null ||
      (value.verdict === 'pass') !== checks.every(check => check.passed)) {
      errors.push(`${receipt.agent_id}: final output did not match the exact verifier-report contract`);
      return { valid: false, result: null, summary: null, errors };
    }
    const result = { verdict: value.verdict, checks };
    return {
      valid: true,
      result,
      summary: {
        kind: contract.kind,
        verdict: result.verdict,
        check_count: checks.length,
        checks_sha256: sha256(Buffer.from(JSON.stringify(canonicalJson(checks)), 'utf8'))
      },
      errors
    };
  }
  const checks = parseWorkerChecks(value.validations);
  const authoredFieldsValid = ['commitMessage', 'summary'].every(field =>
    value[field] === undefined || value[field] === null || typeof value[field] === 'string');
  if (!hasOnlyKeys(value, ['mutatedPaths', 'validations', 'commitMessage', 'summary']) ||
    !Array.isArray(value.mutatedPaths) || value.mutatedPaths.length === 0 ||
    value.mutatedPaths.some(item => !nonEmptyString(item)) ||
    new Set(value.mutatedPaths).size !== value.mutatedPaths.length || checks === null || !authoredFieldsValid) {
    errors.push(`${receipt.agent_id}: final output did not match the exact non-empty mutation-report contract`);
    return { valid: false, result: null, summary: null, errors };
  }
  const result = { mutatedPaths: [...value.mutatedPaths], validations: checks };
  return {
    valid: true,
    result,
    summary: {
      kind: contract.kind,
      mutated_paths: [...result.mutatedPaths],
      validation_count: checks.length,
      all_validations_passed: checks.every(check => check.passed),
      validations_sha256: sha256(Buffer.from(JSON.stringify(canonicalJson(checks)), 'utf8'))
    },
    errors
  };
}

function reconcileVerifierResult(action, contract, parsed, records) {
  const errors = [];
  const matches = Array.isArray(records) ? records.filter(record =>
    record.type === 'validation' && record.value?.action_id === action &&
    record.value?.validator_role === contract.validationRole) : [];
  if (matches.length !== 1) {
    errors.push(`${contract.validationRole}: expected exactly one canonical validation record, observed ${matches.length}`);
    return { valid: false, validation_path: null, status: null, checks_exact: false, errors };
  }
  const record = matches[0];
  const expectedStatus = parsed.verdict === 'pass' ? ['passed'] : ['issues-found', 'failed'];
  if (!expectedStatus.includes(record.value.status)) {
    errors.push(`${contract.validationRole}: canonical validation status did not preserve worker verdict ${parsed.verdict}`);
  }
  const persisted = Array.isArray(record.value.checks) ? record.value.checks : [];
  let checksExact = persisted.length === parsed.checks.length;
  if (checksExact) {
    for (const [index, workerCheck] of parsed.checks.entries()) {
      const canonical = persisted[index];
      const expectedCheckStatus = workerCheck.passed ? 'passed' : 'failed';
      if (!canonical || canonical.summary !== workerCheck.name || canonical.status !== expectedCheckStatus ||
        !Array.isArray(canonical.evidence) || canonical.evidence.length !== 1 ||
        canonical.evidence[0] !== workerCheck.evidence) {
        checksExact = false;
        break;
      }
    }
  }
  if (!checksExact) {
    errors.push(`${contract.validationRole}: canonical validation checks did not exactly preserve worker name, order, verdict, and evidence`);
  }
  return {
    valid: errors.length === 0,
    validation_path: record.path,
    status: record.value.status,
    checks_exact: checksExact,
    errors
  };
}

function reconcileMutationResult(receipt, parsed, evidence) {
  const errors = [];
  const projectRoot = evidence?.projectRoot;
  const mutation = evidence?.mutation;
  const schemaValidation = evidence?.schemaValidation;
  if (!projectRoot || !mutation || !schemaValidation) {
    errors.push(`${receipt.agent_id}: deterministic mutation/schema evidence was unavailable`);
    return { valid: false, paths: [], grounding: 'unavailable', errors };
  }
  if (mutation.valid !== true) errors.push(`${receipt.agent_id}: aggregate action mutation boundary failed`);
  if (schemaValidation.valid !== true) errors.push(`${receipt.agent_id}: independent planning schema validation failed`);
  const changedFiles = new Set((mutation.changes || []).filter(change =>
    change.before?.kind === 'file' || change.after?.kind === 'file').map(change => change.path));
  const paths = [];
  const lexicalRoot = path.resolve(projectRoot);
  let realRoot;
  try {
    realRoot = fs.realpathSync(lexicalRoot);
  } catch (error) {
    errors.push(`${receipt.agent_id}: project root realpath was unavailable (${error.message})`);
    return { valid: false, paths, grounding: 'unavailable', errors };
  }
  for (const reported of parsed.mutatedPaths) {
    if (reported.includes('\\') || reported.includes('\0')) {
      errors.push(`${receipt.agent_id}: mutation report path used a nonportable spelling: ${reported}`);
      continue;
    }
    const reportedAbsolute = path.isAbsolute(reported);
    const absolute = reportedAbsolute ? path.resolve(reported) : path.resolve(projectRoot, reported);
    if (!isContained(lexicalRoot, absolute) || absolute === lexicalRoot) {
      errors.push(`${receipt.agent_id}: mutation report path escaped the project: ${reported}`);
      continue;
    }
    let existing = absolute;
    while (!fs.existsSync(existing)) {
      const parent = path.dirname(existing);
      if (parent === existing) break;
      existing = parent;
    }
    let realExisting;
    try {
      realExisting = fs.realpathSync(existing);
    } catch (error) {
      errors.push(`${receipt.agent_id}: mutation report path parent realpath was unavailable (${reported}: ${error.message})`);
      continue;
    }
    if (!isContained(realRoot, realExisting) && realExisting !== realRoot) {
      errors.push(`${receipt.agent_id}: mutation report path escaped the project through its realpath: ${reported}`);
      continue;
    }
    const relative = path.relative(projectRoot, absolute).split(path.sep).join('/');
    paths.push(relative);
    if ((!reportedAbsolute && relative !== reported.replace(/^\.\//u, '')) || !changedFiles.has(relative)) {
      errors.push(`${receipt.agent_id}: claimed mutation was not present in the aggregate action diff: ${reported}`);
    }
  }
  if (!parsed.validations.every(check => check.passed)) {
    errors.push(`${receipt.agent_id}: mutation report carried a failed self-validation`);
  }
  const grounding = receipt.result_contract?.quality === 'pass'
    ? 'clio-run-grounded-and-aggregate-diff'
    : 'aggregate-diff-only-clio-unmeasured';
  return { valid: errors.length === 0, paths, grounding, errors };
}

function auditStructuredWorkerResult(action, receipt, evidence) {
  const errors = [];
  const contract = WORKER_RESULT_CONTRACTS[receipt?.agent_id];
  if (!contract || contract.action !== action) {
    return { valid: false, agent_id: receipt?.agent_id || null, errors: ['worker result contract did not match lifecycle action'] };
  }
  const fact = receipt.result_contract;
  const expectedSource = new RegExp(`^agent-result-contract:${contract.kind}:[a-f0-9]{64}$`, 'u');
  if (!fact || fact.conformance !== 'pass' || fact.quality === 'fail' ||
    (fact.quality !== 'pass' && fact.quality !== 'unmeasured') ||
    !expectedSource.test(fact.sourceId || '') || !/^[a-f0-9]{64}$/u.test(fact.validatorDigest || '')) {
    errors.push(`${receipt.agent_id}: result-contract fact was missing, mismatched, non-conformant, or quality-failed`);
  }
  const grounding = receipt.validation_grounding;
  if (grounding !== null && grounding !== undefined) {
    const groundingValid = Number.isSafeInteger(grounding.claimed) && grounding.claimed > 0 &&
      Number.isSafeInteger(grounding.grounded) && grounding.grounded >= 0 && grounding.grounded <= grounding.claimed &&
      Array.isArray(grounding.ungrounded) && grounding.ungrounded.every(nonEmptyString) &&
      (grounding.basis === 'no-command-executed' || grounding.basis === 'unmatched-command');
    if (!groundingValid) errors.push(`${receipt.agent_id}: sealed validation-grounding fact was malformed`);
    if (groundingValid && fact?.quality === 'pass' && grounding.basis === 'no-command-executed' &&
      grounding.ungrounded.length > 0) {
      errors.push(`${receipt.agent_id}: client pass contradicted its no-command validation-grounding fact`);
    }
  }
  const parsed = parseWorkerResult(receipt, contract);
  errors.push(...parsed.errors);
  let reconciliation = { valid: false, errors: ['structured result was not parseable'] };
  if (parsed.result !== null) {
    if (contract.kind === 'verifier-report') {
      if (parsed.result.verdict !== 'pass') {
        errors.push(`${receipt.agent_id}: required checker/verifier/reviewer verdict was not pass`);
      }
      if (fact?.quality !== parsed.result.verdict &&
        !(parsed.result.verdict === 'pass' && fact?.quality === 'unmeasured')) {
        errors.push(`${receipt.agent_id}: sealed result-contract quality contradicted its parsed verdict`);
      }
      reconciliation = reconcileVerifierResult(action, contract, parsed.result, evidence?.records);
    } else {
      reconciliation = reconcileMutationResult(receipt, parsed.result, evidence);
    }
    errors.push(...reconciliation.errors);
  }
  return {
    valid: errors.length === 0,
    agent_id: receipt.agent_id,
    contract_kind: contract.kind,
    sealed_quality: fact?.quality || null,
    quality_interpretation: fact?.quality === 'pass'
      ? grounding?.ungrounded?.length > 0
        ? 'client-labeled-pass-with-unmatched-validation-claims'
        : grounding
          ? 'client-labeled-pass-with-grounded-validation-claims'
          : 'client-labeled-pass-without-validation-grounding-fact'
      : fact?.quality === 'unmeasured' ? 'unmeasured-not-promoted' : 'failed',
    validation_grounding: grounding || null,
    output: receipt.output || null,
    result: parsed.summary,
    reconciliation,
    errors
  };
}

function requiredDispatchAudit(action, toolAudit, receipts = [], runtimePolicy = OPENAI_CODEX_RUNTIME_POLICY, evidence = null) {
  const requirements = REQUIRED_DISPATCH[action] || [];
  const calls = toolAudit.dispatch || [];
  const successfulCalls = calls.filter(item => item.terminal_success);
  const successful = new Set(successfulCalls.flatMap(item => item.agents));
  const workers = receipts.filter(receipt => receipt.agent_id !== 'main-agent');
  const receiptAgents = new Set();
  const errors = [];
  const orderedReceipts = [];
  const structuredResults = [];
  if (calls.length !== requirements.length) {
    errors.push(`${action}: expected exactly ${requirements.length} dispatch calls, observed ${calls.length}`);
  }
  if (successfulCalls.length !== requirements.length) {
    errors.push(`${action}: expected exactly ${requirements.length} successful dispatch calls, observed ${successfulCalls.length}`);
  }
  if (workers.length !== requirements.length) {
    errors.push(`${action}: expected exactly ${requirements.length} worker receipts, observed ${workers.length}`);
  }
  for (const [index, agent] of requirements.entries()) {
    const call = calls[index];
    if (!call || call.agents.length !== 1 || call.agents[0] !== agent || !call.terminal_success) {
      errors.push(`${action}: dispatch ${index + 1} was not one successful exact call to ${agent}`);
      continue;
    }
    if (!call.synchronous_singular) {
      errors.push(`${action}: ${agent} dispatch was not one synchronous singular assignment`);
    }
    for (const [field, expected] of [
      ['target', runtimePolicy.target], ['model', runtimePolicy.model], ['thinking_level', runtimePolicy.effort],
      ['node', 'local']
    ]) {
      if (call[field] !== expected) errors.push(`${action}: ${agent} dispatch ${field} did not equal ${expected}`);
    }
    if (call.assignment_ids.length !== 1 || call.terminal_run_ids.length !== 1 || call.runs.length !== 1) {
      errors.push(`${action}: ${agent} dispatch did not produce exactly one terminal run`);
      continue;
    }
    const projectedRun = call.runs[0];
    const receipt = workers.find(candidate => candidate.run_id === call.terminal_run_ids[0]);
    if (!receipt || receipt.agent_id !== agent || projectedRun.run_id !== receipt.run_id || projectedRun.agent_id !== agent) {
      errors.push(`${action}: ${agent} terminal run was not bound to its sealed worker receipt`);
      continue;
    }
    orderedReceipts.push(receipt);
    if (receipt.task_sha256 !== call.task_sha256 || receipt.task_bytes !== call.task_bytes) {
      errors.push(`${action}: ${agent} worker receipt task did not match the dispatch assignment`);
    }
    if (receipt.lineage?.rootRunId !== call.assignment_ids[0] ||
      receipt.lineage?.parentRunId !== call.assignment_ids[0] || receipt.lineage?.attempt !== 0 ||
      receipt.lineage?.depth !== 1) {
      errors.push(`${action}: ${agent} worker lineage did not match the exact no-retry dispatch assignment`);
    }
    if (receipt.outcome !== 'succeeded' || receipt.exit_code !== 0 ||
      receipt.integrity_verification?.valid !== true || receipt.result_contract?.conformance !== 'pass') {
      errors.push(`${action}: no sealed successful contract-conformant receipt for ${agent}`);
    }
    const structuredResult = auditStructuredWorkerResult(action, receipt, evidence);
    structuredResults.push(structuredResult);
    errors.push(...structuredResult.errors.map(error => `${action}: ${error}`));
    if (receipt.outcome === 'succeeded' && receipt.exit_code === 0 &&
      receipt.integrity_verification?.valid === true && structuredResult.valid) {
      receiptAgents.add(receipt.agent_id);
    }
    for (const [field, expected] of [
      ['target', runtimePolicy.target], ['model', runtimePolicy.model],
      ['runtime_id', runtimePolicy.runtime_id], ['runtime_kind', runtimePolicy.runtime_kind]
    ]) {
      if (receipt[field] !== expected) errors.push(`${action}: ${agent} receipt ${field} did not equal ${expected}`);
    }
    if (receipt.runtime?.requested_effort !== runtimePolicy.effort ||
      receipt.runtime?.effective_effort !== runtimePolicy.effort ||
      receipt.runtime?.auth !== runtimePolicy.auth || receipt.runtime?.auth_required !== true ||
      receipt.runtime?.api_family !== runtimePolicy.api_family || receipt.runtime?.runtime_tier !== 'cloud' ||
      !Array.isArray(receipt.runtime?.diagnostics) || receipt.runtime.diagnostics.some(item => item?.severity === 'error')) {
      errors.push(`${action}: ${agent} sealed runtime resolution did not match the prepared worker policy`);
    }
    if (receipt.node?.id !== 'local' || receipt.node?.kind !== 'local') {
      errors.push(`${action}: ${agent} sealed receipt did not bind execution to the local node`);
    }
  }
  for (let index = 1; index < orderedReceipts.length; index += 1) {
    const priorEnd = Date.parse(orderedReceipts[index - 1].ended_at);
    const nextStart = Date.parse(orderedReceipts[index].started_at);
    if (!Number.isFinite(priorEnd) || !Number.isFinite(nextStart) || priorEnd > nextStart) {
      errors.push(`${action}: ${requirements[index - 1]} did not terminate before ${requirements[index]} started`);
    }
  }
  const extraAgents = [...successful].filter(agent => !requirements.includes(agent));
  if (extraAgents.length) errors.push(`${action}: successful unrequested dispatch agents: ${extraAgents.join(', ')}`);
  const allowedRunIds = new Set(successfulCalls.flatMap(call => call.terminal_run_ids));
  const extraWorkers = workers.filter(receipt => !allowedRunIds.has(receipt.run_id));
  if (extraWorkers.length) {
    errors.push(`${action}: unrequested worker receipts: ${extraWorkers.map(receipt => receipt.run_id).join(', ')}`);
  }
  return {
    valid: errors.length === 0,
    required_agents: requirements,
    successful_agents: [...successful].sort(),
    contract_receipt_agents: [...receiptAgents].sort(),
    terminal_run_ids: [...allowedRunIds].sort(),
    structured_results: structuredResults,
    errors
  };
}

function auditLogSummary(root, roots) {
  const files = auditFiles(root);
  if (files.length === 0) return { valid: true, entries: 0, files: [], tool_audit: eventToolAudit([], roots) };
  const events = [];
  const parseErrors = [];
  const seen = new Set();
  for (const file of files) {
    const parsed = parseJsonLines(fs.readFileSync(file.absolute, 'utf8'));
    parseErrors.push(...parsed.errors.map(error => `${file.evidencePath}: ${error}`));
    for (const entry of parsed.events.filter(item => item.kind === 'tool_call')) {
      const identity = `${entry.correlationId || ''}:${entry.tool || ''}:${sha256(Buffer.from(JSON.stringify(entry.args || {}), 'utf8'))}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      events.push({ type: 'tool_execution_start', toolName: entry.tool, args: entry.args || {} });
    }
  }
  const toolAudit = eventToolAudit(events, roots);
  return {
    valid: parseErrors.length === 0 && toolAudit.valid,
    entries: events.length,
    files: files.map(file => ({ path: file.evidencePath, bytes: file.stat.size, sha256: sha256(fs.readFileSync(file.absolute)) })),
    parse_errors: parseErrors,
    tool_audit: toolAudit
  };
}

function substituteSessionArgs(args, sessions) {
  return args.map(argument => argument === '{{S1}}' ? sessions.S1 : argument === '{{S2}}' ? sessions.S2 : argument);
}

const activeProcessGroups = new Set();

function processGroupAlive(pid) {
  if (!pid || process.platform === 'win32') return false;
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function pruneInactiveProcessGroups() {
  for (const pid of activeProcessGroups) {
    if (!processGroupAlive(pid)) activeProcessGroups.delete(pid);
  }
  return [...activeProcessGroups];
}

function signalProcessGroup(pid, signal, child = null) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') child?.kill(signal);
    else process.kill(-pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function installExecutionSignalHandlers(emergencyCleanup) {
  const state = { signal: null, count: 0 };
  let forceTimer = null;
  let cleanupTimer = null;
  const handlers = new Map();
  const cleanupAfterQuiescence = () => {
    if (pruneInactiveProcessGroups().length > 0) {
      cleanupTimer ||= setTimeout(() => {
        cleanupTimer = null;
        cleanupAfterQuiescence();
      }, 100);
      cleanupTimer.unref();
      return;
    }
    try { emergencyCleanup(); } catch { /* best effort after owned children have stopped */ }
    if (state.count > 1) process.exit(128 + (state.signal === 'SIGINT' ? 2 : 15));
  };
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const handler = () => {
      state.signal ||= signal;
      state.count += 1;
      for (const pid of activeProcessGroups) {
        try { signalProcessGroup(pid, state.count > 1 ? 'SIGKILL' : 'SIGTERM'); } catch { /* best effort */ }
      }
      cleanupAfterQuiescence();
      forceTimer ||= setTimeout(() => {
        for (const pid of activeProcessGroups) {
          try { signalProcessGroup(pid, 'SIGKILL'); } catch { /* best effort */ }
        }
        cleanupAfterQuiescence();
      }, 10000);
      forceTimer.unref();
    };
    handlers.set(signal, handler);
    process.on(signal, handler);
  }
  return {
    state,
    remove() {
      if (forceTimer) clearTimeout(forceTimer);
      if (cleanupTimer) clearTimeout(cleanupTimer);
      for (const [signal, handler] of handlers) process.removeListener(signal, handler);
    }
  };
}

async function quiesceProcessGroup(pid, child, timedOut) {
  if (process.platform === 'win32' || !pid) {
    return { owned: process.platform !== 'win32', quiesced: true, term_sent: timedOut, kill_sent: false };
  }
  for (let attempt = 0; attempt < 10 && processGroupAlive(pid); attempt += 1) await delay(100);
  let termSent = timedOut;
  let killSent = false;
  if (processGroupAlive(pid)) {
    signalProcessGroup(pid, 'SIGTERM', child);
    termSent = true;
    for (let attempt = 0; attempt < 20 && processGroupAlive(pid); attempt += 1) await delay(100);
  }
  if (processGroupAlive(pid)) {
    signalProcessGroup(pid, 'SIGKILL', child);
    killSent = true;
    for (let attempt = 0; attempt < 20 && processGroupAlive(pid); attempt += 1) await delay(100);
  }
  return { owned: true, quiesced: !processGroupAlive(pid), term_sent: termSent, kill_sent: killSent };
}

function stateSurfaceDigest(root) {
  const surfaces = [
    path.join(root, 'clio', 'state'), path.join(root, 'clio', 'state-s2'),
    path.join(root, 'clio', 'data'), path.join(root, 'clio', 'data-s2')
  ];
  return sha256(Buffer.from(JSON.stringify(surfaces.map(surface => fs.existsSync(surface)
    ? { surface: path.relative(root, surface), sha256: hashTree(surface, { rejectSymlinks: false }).sha256 }
    : { surface: path.relative(root, surface), sha256: null })), 'utf8'));
}

async function waitForStateQuiescence(root) {
  let previous = stateSurfaceDigest(root);
  let stable = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await delay(250);
    const current = stateSurfaceDigest(root);
    if (current === previous) stable += 1;
    else stable = 0;
    previous = current;
    if (stable >= 2) return { quiesced: true, digest: current, waited_ms: (attempt + 1) * 250 };
  }
  return { quiesced: false, digest: previous, waited_ms: 3000 };
}

async function spawnCaptured({ executable, argv, cwd, env, stdoutFile, stderrFile, timeoutMs }) {
  makePrivateDirectory(path.dirname(stdoutFile));
  const stdout = fs.createWriteStream(stdoutFile, { flags: 'wx', mode: 0o600 });
  const stderr = fs.createWriteStream(stderrFile, { flags: 'wx', mode: 0o600 });
  const started = Date.now();
  return new Promise(resolve => {
    const child = spawn(executable, argv, {
      cwd,
      env,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const pid = child.pid || null;
    if (pid) activeProcessGroups.add(pid);
    child.stdout.pipe(stdout);
    child.stderr.pipe(stderr);
    let timedOut = false;
    let killTimer = null;
    let processOutcome = null;
    let streamsFinished = 0;
    let settled = false;
    let settling = false;
    const finish = async () => {
      if (settled || processOutcome === null || streamsFinished < 2) return;
      if (settling) return;
      settling = true;
      const processGroup = await quiesceProcessGroup(pid, child, timedOut);
      if (pid && processGroup.quiesced) activeProcessGroups.delete(pid);
      settled = true;
      const ended = Date.now();
      resolve({
        ...processOutcome,
        timedOut,
        startedAt: new Date(started).toISOString(),
        endedAt: new Date(ended).toISOString(),
        latencyMs: ended - started,
        processGroup
      });
    };
    stdout.on('finish', () => { streamsFinished += 1; finish(); });
    stderr.on('finish', () => { streamsFinished += 1; finish(); });
    const timer = setTimeout(() => {
      timedOut = true;
      signalProcessGroup(pid, 'SIGTERM', child);
      killTimer = setTimeout(() => signalProcessGroup(pid, 'SIGKILL', child), 5000);
      killTimer.unref();
    }, timeoutMs);
    child.on('error', error => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      processOutcome = { pid, exitCode: null, signal: null, error: error.message };
      if (!stdout.writableEnded) stdout.end();
      if (!stderr.writableEnded) stderr.end();
      void finish();
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      processOutcome = { pid, exitCode: code, signal, error: null };
      void finish();
    });
  });
}

function summarizeReceiptCosts(receipts) {
  const errors = [];
  const byProvenance = Object.fromEntries(COST_PROVENANCES.map(provenance => [provenance, {
    receipts: 0,
    client_reported_usd: 0
  }]));
  for (const receipt of receipts) {
    if (!receipt.cost_present || !Number.isFinite(receipt.cost_usd) || receipt.cost_usd < 0) {
      errors.push(`${receipt.id}: costUsd is missing, nonfinite, or negative`);
      continue;
    }
    if (!COST_PROVENANCES.includes(receipt.cost_provenance)) {
      errors.push(`${receipt.id}: costProvenance is missing or unsupported`);
      continue;
    }
    if (receipt.cost_provenance === 'known_free' && receipt.cost_usd !== 0) {
      errors.push(`${receipt.id}: known_free receipt reported nonzero costUsd`);
    }
    byProvenance[receipt.cost_provenance].receipts += 1;
    byProvenance[receipt.cost_provenance].client_reported_usd += receipt.cost_usd;
  }
  return {
    valid: errors.length === 0,
    receipt_count: receipts.length,
    client_reported_numeric_total_usd: receipts.reduce((sum, receipt) =>
      sum + (Number.isFinite(receipt.cost_usd) && receipt.cost_usd >= 0 ? receipt.cost_usd : 0), 0),
    provider_known_usd: byProvenance.known.client_reported_usd,
    known_free_usd: byProvenance.known_free.client_reported_usd,
    estimated_usd: byProvenance.estimated.client_reported_usd,
    unknown_provenance_numeric_usd: byProvenance.unknown.client_reported_usd,
    by_provenance: byProvenance,
    interpretation: 'Client-reported receipt values grouped by sealed provenance; unknown is not measured and missing is invalid.',
    errors
  };
}

function collectReceipts(root) {
  const receiptFiles = clioStateRoots(root).flatMap(stateRoot => {
    const receiptsRoot = path.join(stateRoot, 'receipts');
    if (!fs.existsSync(receiptsRoot)) return [];
    return walkFiles(receiptsRoot).filter(entry => entry.path.endsWith('.json'));
  });
  if (receiptFiles.length === 0) return {
    receipts: [],
    inventory_errors: [],
    cost: summarizeReceiptCosts([]),
    total_latency_ms: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    reasoning_tokens: 0,
    tool_calls: 0
  };
  const receipts = receiptFiles.map(entry => {
    const value = JSON.parse(fs.readFileSync(entry.absolute, 'utf8'));
    const task = typeof value.task === 'string' ? value.task : null;
    const rawOutput = value.output && typeof value.output === 'object' && !Array.isArray(value.output)
      ? value.output : null;
    const outputText = typeof rawOutput?.text === 'string' ? rawOutput.text : null;
    const output = rawOutput === null ? null : {
      state: rawOutput.state || null,
      bytes: Number.isSafeInteger(rawOutput.bytes) ? rawOutput.bytes : null,
      captured_bytes: outputText === null ? null : Buffer.byteLength(outputText, 'utf8'),
      truncated: typeof rawOutput.truncated === 'boolean' ? rawOutput.truncated : null,
      sha256: outputText === null ? null : sha256(Buffer.from(outputText, 'utf8'))
    };
    const receipt = {
      id: path.basename(entry.path, '.json'),
      path: path.relative(root, entry.absolute).split(path.sep).join('/'),
      sha256: sha256(fs.readFileSync(entry.absolute)),
      run_id: typeof value.runId === 'string' ? value.runId : null,
      filename_matches_run_id: typeof value.runId === 'string' && value.runId === path.basename(entry.path, '.json'),
      agent_id: value.agentId || null,
      request_origin: value.requestOrigin || null,
      session_id: value.sessionId || null,
      target: value.targetId || null,
      model: value.wireModelId || null,
      runtime_id: value.runtimeId || null,
      runtime_kind: value.runtimeKind || null,
      node: value.node && typeof value.node === 'object'
        ? { id: value.node.id || null, kind: value.node.kind || null } : null,
      outcome: value.outcome || null,
      exit_code: Number.isInteger(value.exitCode) ? value.exitCode : null,
      client_version: value.clioVersion || null,
      cost_present: Object.prototype.hasOwnProperty.call(value, 'costUsd'),
      cost_usd: typeof value.costUsd === 'number' && Number.isFinite(value.costUsd) && value.costUsd >= 0
        ? value.costUsd : null,
      cost_provenance: COST_PROVENANCES.includes(value.costProvenance) ? value.costProvenance : null,
      started_at: value.startedAt || null,
      ended_at: value.endedAt || null,
      task_bytes: task === null ? null : Buffer.byteLength(task, 'utf8'),
      task_sha256: task === null ? null : sha256(Buffer.from(task, 'utf8')),
      compiled_prompt_hash: value.compiledPromptHash || null,
      static_composition_hash: value.staticCompositionHash || null,
      prompt_signature: value.promptSignature || null,
      tool_signature: value.toolSignature || null,
      input_tokens: value.inputTokenCount || 0,
      output_tokens: value.outputTokenCount || 0,
      cache_read_tokens: value.cacheReadTokenCount || 0,
      reasoning_tokens: value.reasoningTokenCount || 0,
      tool_calls: value.toolCalls || 0,
      tool_stats: value.toolStats || [],
      skill_activations: value.skillActivations || [],
      lineage: value.lineage || null,
      verification: value.verification || null,
      result_contract: value.quality?.resultContract || null,
      typed_validations: value.quality?.typedValidations || [],
      validation_grounding: value.validationGrounding || null,
      output,
      autonomy: value.autonomyEnforcement || null,
      runtime: value.runtimeResolution ? {
        target: value.runtimeResolution.targetId,
        model: value.runtimeResolution.wireModelId,
        requested_effort: value.runtimeResolution.requestedThinkingLevel,
        effective_effort: value.runtimeResolution.effectiveThinkingLevel,
        auth: value.runtimeResolution.auth,
        auth_required: value.runtimeResolution.authRequired,
        runtime_id: value.runtimeResolution.runtimeId,
        runtime_kind: value.runtimeResolution.runtimeKind,
        api_family: value.runtimeResolution.apiFamily,
        runtime_tier: value.runtimeResolution.runtimeTier,
        diagnostics: Array.isArray(value.runtimeResolution.diagnostics) ? value.runtimeResolution.diagnostics : null
      } : null,
      integrity: value.integrity || null
    };
    Object.defineProperty(receipt, 'task_text', { value: task, enumerable: false, writable: false });
    Object.defineProperty(receipt, 'output_text', { value: outputText, enumerable: false, writable: false });
    return receipt;
  }).sort((left, right) => left.id.localeCompare(right.id));
  const toMs = receipt => receipt.started_at && receipt.ended_at
    ? Math.max(0, Date.parse(receipt.ended_at) - Date.parse(receipt.started_at)) : 0;
  const runIds = receipts.map(receipt => receipt.run_id).filter(Boolean);
  const duplicateRunIds = [...new Set(runIds.filter((runId, index) => runIds.indexOf(runId) !== index))].sort();
  const inventoryErrors = [
    ...receipts.filter(receipt => !receipt.run_id || !receipt.filename_matches_run_id)
      .map(receipt => `${receipt.id}: filename did not equal sealed runId`),
    ...duplicateRunIds.map(runId => `duplicate sealed runId across receipt roots: ${runId}`)
  ];
  return {
    receipts,
    inventory_errors: inventoryErrors,
    cost: summarizeReceiptCosts(receipts),
    total_latency_ms: receipts.reduce((sum, receipt) => sum + toMs(receipt), 0),
    input_tokens: receipts.reduce((sum, receipt) => sum + receipt.input_tokens, 0),
    output_tokens: receipts.reduce((sum, receipt) => sum + receipt.output_tokens, 0),
    cache_read_tokens: receipts.reduce((sum, receipt) => sum + receipt.cache_read_tokens, 0),
    reasoning_tokens: receipts.reduce((sum, receipt) => sum + receipt.reasoning_tokens, 0),
    tool_calls: receipts.reduce((sum, receipt) => sum + receipt.tool_calls, 0)
  };
}

function receiptEnvelope(root, receipt) {
  const candidates = [
    path.join(root, 'clio', 'data', 'evidence', `run-${receipt.run_id}`, 'trace.raw.jsonl'),
    path.join(root, 'clio', 'data-s2', 'evidence', `run-${receipt.run_id}`, 'trace.raw.jsonl')
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const parsed = parseJsonLines(fs.readFileSync(file, 'utf8'));
    if (parsed.errors.length) throw new Error(`${receipt.id}: malformed run ledger (${parsed.errors.join('; ')})`);
    const ledger = parsed.events.find(entry => entry.kind === 'run-ledger' && entry.runId === receipt.run_id);
    if (ledger?.envelope) return { envelope: ledger.envelope, path: path.relative(root, file).split(path.sep).join('/') };
  }
  return null;
}

async function loadReceiptVerifier(clioSource) {
  const dist = path.join(clioSource, 'dist');
  assertDirectory(dist, 'Clio dist root');
  const candidates = fs.readdirSync(dist).filter(name => /^chunk-[A-Z0-9]+\.js$/u.test(name)).sort();
  for (const name of candidates) {
    const file = path.join(dist, name);
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes('function verifyReceiptIntegrity(') || !source.includes('verifyReceiptIntegrity')) continue;
    const module = await import(pathToFileURL(file).href);
    if (typeof module.verifyReceiptIntegrity === 'function') {
      return {
        verify: module.verifyReceiptIntegrity,
        module: path.relative(clioSource, file).split(path.sep).join('/'),
        sha256: sha256(fs.readFileSync(file))
      };
    }
  }
  throw new Error('matching Clio build does not expose receipt integrity verification');
}

async function verifyReceiptDelta(root, before, after, clioSource) {
  const prior = new Map(before.receipts.map(receipt => [receipt.path, receipt.sha256]));
  const current = new Map(after.receipts.map(receipt => [receipt.path, receipt.sha256]));
  const receipts = after.receipts.filter(receipt => !prior.has(receipt.path));
  const errors = [...(after.inventory_errors || [])];
  for (const [receiptPath, digest] of prior) {
    if (!current.has(receiptPath)) errors.push(`${receiptPath}: prior receipt disappeared during paid action`);
    else if (current.get(receiptPath) !== digest) errors.push(`${receiptPath}: prior receipt changed during paid action`);
  }
  if (receipts.length === 0) {
    return {
      valid: false,
      receipts,
      verifier: null,
      errors: [...errors, 'paid action produced no new receipt'],
      cost: summarizeReceiptCosts([])
    };
  }
  let verifier;
  try {
    verifier = await loadReceiptVerifier(clioSource);
  } catch (error) {
    return { valid: false, receipts, verifier: null, errors: [error.message] };
  }
  for (const receipt of receipts) {
    if (typeof receipt.task_text !== 'string' || receipt.task_bytes === null || receipt.task_sha256 === null) {
      errors.push(`${receipt.id}: sealed receipt task identity is missing`);
    }
    for (const field of ['compiled_prompt_hash', 'static_composition_hash', 'prompt_signature', 'tool_signature']) {
      if (!/^[a-f0-9]{64}$/u.test(receipt[field] || '')) errors.push(`${receipt.id}: ${field} is missing or malformed`);
    }
    const started = Date.parse(receipt.started_at);
    const ended = Date.parse(receipt.ended_at);
    if (!Number.isFinite(started) || !Number.isFinite(ended) || started > ended) {
      errors.push(`${receipt.id}: receipt timestamps are missing, unparsable, or reversed`);
    }
    if (receipt.integrity?.algorithm !== 'sha256' || !/^[a-f0-9]{64}$/u.test(receipt.integrity?.digest || '')) {
      errors.push(`${receipt.id}: missing or malformed receipt integrity seal`);
      continue;
    }
    const source = receiptEnvelope(root, receipt);
    if (!source) {
      errors.push(`${receipt.id}: run-ledger envelope is missing`);
      continue;
    }
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(root, receipt.path), 'utf8'));
    } catch (error) {
      errors.push(`${receipt.id}: receipt became unreadable (${error.message})`);
      continue;
    }
    const integrity = verifier.verify(raw, source.envelope);
    receipt.integrity_verification = {
      valid: integrity?.ok === true,
      reason: integrity?.ok === true ? null : integrity?.reason || 'unknown integrity failure',
      ledger: source.path
    };
    if (!receipt.integrity_verification.valid) {
      errors.push(`${receipt.id}: receipt integrity failed (${receipt.integrity_verification.reason})`);
    }
  }
  const cost = summarizeReceiptCosts(receipts);
  if (!cost.valid) errors.push(...cost.errors);
  return {
    valid: errors.length === 0,
    receipts,
    verifier: { module: verifier.module, sha256: verifier.sha256 },
    errors,
    cost
  };
}

function materializeSectionInputs(root, projectRoot) {
  const before = snapshotProject(projectRoot);
  const recordsBefore = readPlanningRecords(projectRoot);
  const auditOffsets = snapshotAuditOffsets(root);
  const directory = path.join(projectRoot, '.planning', 'sections', SECTION_ID);
  assertDirectory(directory, 'evaluation section directory');
  const copies = [
    ['project-brief.md', 'context.md'],
    ['benchmark-observations.md', 'research.md']
  ].map(([sourceName, destinationName]) => {
    const source = path.join(projectRoot, sourceName);
    const destination = path.join(directory, destinationName);
    if (fs.existsSync(destination)) throw new Error(`refusing existing fixture-derived input ${destination}`);
    fs.copyFileSync(source, destination);
    fs.chmodSync(destination, 0o600);
    const sourceHash = sha256(fs.readFileSync(source));
    const destinationHash = sha256(fs.readFileSync(destination));
    if (sourceHash !== destinationHash) throw new Error(`fixture-derived copy mismatch: ${destinationName}`);
    return {
      source: path.relative(projectRoot, source),
      destination: path.relative(projectRoot, destination),
      sha256: destinationHash,
      bytes: fs.statSync(destination).size,
      exact: true
    };
  });
  const after = snapshotProject(projectRoot);
  const mutation = checkMutationBoundary('fixture-section-inputs', before, after, recordsBefore, readPlanningRecords(projectRoot));
  const report = {
    schema: 'wtfp.evaluation.fixture-section-inputs/v1',
    actor: 'evaluation-harness',
    model_mutation: false,
    valid: mutation.valid,
    copies,
    mutation
  };
  writeJsonPrivate(path.join(root, 'evidence', 'transitions', '03a-fixture-section-inputs.json'), report);
  if (!report.valid) throw new Error('fixture section-input materialization violated its boundary');
  return report;
}

function lockRecords(records, types) {
  return Object.fromEntries(records.filter(record => types.includes(record.type)).map(record => [record.path, record.sha256]));
}

function checkRecordLocks(records, locks) {
  const current = new Map(records.map(record => [record.path, record.sha256]));
  const errors = [];
  for (const [file, digest] of Object.entries(locks)) {
    if (current.get(file) !== digest) errors.push(`immutable lifecycle record changed: ${file}`);
  }
  return errors;
}

function initialUserMessageText(events) {
  const event = events.find(candidate => candidate.type === 'message_start' && candidate.message?.role === 'user');
  if (!event) return null;
  const blocks = (event.message.content || []).filter(block => block.type === 'text' && typeof block.text === 'string');
  return blocks.length === 1 ? blocks[0].text : null;
}

function invocationArgumentsFromText(text) {
  if (typeof text !== 'string') return null;
  const open = '<invocation_arguments>\n';
  const close = '\n</invocation_arguments>';
  const start = text.lastIndexOf(open);
  if (start === -1) return null;
  const end = text.indexOf(close, start + open.length);
  return end === -1 ? null : text.slice(start + open.length, end);
}

function mainReceiptBinding(receipt, events, actionPlan, processResult, runtimePolicy) {
  const errors = [];
  const userText = initialUserMessageText(events);
  const task = receipt?.task_text;
  const taskIsSuffix = typeof userText === 'string' && typeof task === 'string' && userText.endsWith(task);
  const taskArguments = invocationArgumentsFromText(task);
  if (!taskIsSuffix) errors.push(`${actionPlan.action}: sealed main receipt task was not an exact suffix of the initial user message`);
  if (taskArguments !== actionPlan.invocation_arguments) {
    errors.push(`${actionPlan.action}: sealed main receipt did not contain the exact invocation arguments`);
  }
  const processStart = Date.parse(processResult.startedAt);
  const processEnd = Date.parse(processResult.endedAt);
  const receiptStart = Date.parse(receipt?.started_at);
  const receiptEnd = Date.parse(receipt?.ended_at);
  const timestampBound = [processStart, processEnd, receiptStart, receiptEnd].every(Number.isFinite) &&
    processStart <= receiptStart && receiptStart <= receiptEnd && receiptEnd <= processEnd;
  if (!timestampBound) errors.push(`${actionPlan.action}: sealed main receipt timestamps escaped the owned process interval`);
  for (const [field, expected] of [
    ['target', runtimePolicy.target], ['model', runtimePolicy.model],
    ['runtime_id', runtimePolicy.runtime_id], ['runtime_kind', runtimePolicy.runtime_kind]
  ]) {
    if (receipt?.[field] !== expected) errors.push(`${actionPlan.action}: main receipt ${field} did not equal ${expected}`);
  }
  if (receipt?.runtime?.target !== runtimePolicy.target || receipt?.runtime?.model !== runtimePolicy.model ||
    receipt?.runtime?.runtime_id !== runtimePolicy.runtime_id || receipt?.runtime?.runtime_kind !== runtimePolicy.runtime_kind ||
    receipt?.runtime?.requested_effort !== runtimePolicy.effort ||
    receipt?.runtime?.effective_effort !== runtimePolicy.effort ||
    receipt?.runtime?.auth !== runtimePolicy.auth || receipt?.runtime?.auth_required !== true ||
    receipt?.runtime?.api_family !== runtimePolicy.api_family || receipt?.runtime?.runtime_tier !== 'cloud' ||
    !Array.isArray(receipt?.runtime?.diagnostics) || receipt.runtime.diagnostics.some(item => item?.severity === 'error')) {
    errors.push(`${actionPlan.action}: sealed main runtime resolution did not match the prepared policy`);
  }
  if (receipt?.lineage?.parentRunId !== null || receipt?.lineage?.rootRunId !== receipt?.run_id ||
    receipt?.lineage?.attempt !== 0 || receipt?.lineage?.depth !== 0) {
    errors.push(`${actionPlan.action}: main receipt lineage did not identify an independent root run`);
  }
  return {
    valid: errors.length === 0,
    receipt_id: receipt?.id || null,
    run_id: receipt?.run_id || null,
    initial_user_bytes: userText === null ? null : Buffer.byteLength(userText, 'utf8'),
    initial_user_sha256: userText === null ? null : sha256(Buffer.from(userText, 'utf8')),
    task_bytes: receipt?.task_bytes ?? null,
    task_sha256: receipt?.task_sha256 ?? null,
    task_suffix_offset_characters: taskIsSuffix ? userText.length - task.length : null,
    task_is_exact_suffix: taskIsSuffix,
    invocation_arguments_exact: taskArguments === actionPlan.invocation_arguments,
    timestamps_within_process: timestampBound,
    errors
  };
}

function verifierRecordTiming(action, records, receipts, processResult) {
  const role = {
    'create-outline': 'outliner',
    'plan-section': 'plan-checker',
    'write-section': 'argument-verifier',
    'review-section': 'section-reviewer'
  }[action] || null;
  if (!role) return { valid: true, role: null, errors: [] };
  const validation = records.filter(record => record.type === 'validation' &&
    record.value.action_id === action && record.value.validator_role === role);
  const workerAgent = (REQUIRED_DISPATCH[action] || []).at(-1);
  const worker = receipts.find(receipt => receipt.agent_id === workerAgent);
  const errors = [];
  const executedAt = validation.length === 1 ? Date.parse(validation[0].value.executed_at) : NaN;
  const workerEndedAt = Date.parse(worker?.ended_at);
  const processEndedAt = Date.parse(processResult.endedAt);
  if (validation.length !== 1 || !worker || ![executedAt, workerEndedAt, processEndedAt].every(Number.isFinite) ||
    executedAt < workerEndedAt || executedAt > processEndedAt) {
    errors.push(`${action}: ${role} validation timestamp was not after its terminal specialist receipt within the action process`);
  }
  return {
    valid: errors.length === 0,
    role,
    worker_agent: workerAgent,
    worker_receipt_id: worker?.id || null,
    worker_ended_at: worker?.ended_at || null,
    validation_path: validation.length === 1 ? validation[0].path : null,
    validation_executed_at: validation.length === 1 ? validation[0].value.executed_at : null,
    errors
  };
}

async function runAction({
  actionPlan, options, root, plan, env, sessions, oracle, previousRecords, initialGit, locks, clientVersion
}) {
  const projectRoot = path.join(root, 'project');
  assertContainedPrivateDirectory(root, env.CLIO_CODER_CONFIG_DIR, 'isolated Clio config root');
  const before = snapshotProject(projectRoot);
  const recordsBefore = readPlanningRecords(projectRoot);
  const auditOffsets = snapshotAuditOffsets(root);
  const receiptsBefore = collectReceipts(root);
  const prefix = `${String(actionPlan.index).padStart(2, '0')}-${actionPlan.action}`;
  const stdoutFile = path.join(root, 'evidence', 'events', `${prefix}.jsonl`);
  const stderrFile = path.join(root, 'evidence', 'events', `${prefix}.stderr`);
  const argv = substituteSessionArgs(actionPlan.cli.argv, sessions);
  if (argv.includes(null) || argv.some(argument => /^\{\{/u.test(String(argument)))) {
    throw new Error(`${actionPlan.action}: requested session is unavailable`);
  }
  const processResult = await spawnCaptured({
    executable: actionPlan.cli.executable,
    argv,
    cwd: projectRoot,
    env,
    stdoutFile,
    stderrFile,
    timeoutMs: actionPlan.cli.timeout_ms
  });
  if (!processResult.processGroup.quiesced || pruneInactiveProcessGroups().length > 0) {
    throw new Error(`${actionPlan.action}: owned process group did not quiesce; post-process reads are refused`);
  }
  assertContainedPrivateDirectory(root, env.CLIO_CODER_CONFIG_DIR, 'isolated Clio config root');
  const stateQuiescence = await waitForStateQuiescence(root);
  const parsed = parseJsonLines(fs.readFileSync(stdoutFile, 'utf8'));
  const session = parsed.events.find(event => event.type === 'session') || null;
  if (actionPlan.session === 'new:S1') sessions.S1 = session?.id || null;
  if (actionPlan.session === 'new:S2') sessions.S2 = session?.id || null;
  const actualArguments = extractInvocationArguments(parsed.events);
  const argumentEvidence = {
    expected_bytes: actionPlan.arguments_bytes,
    actual_bytes: actualArguments === null ? null : Buffer.byteLength(actualArguments, 'utf8'),
    expected_sha256: actionPlan.arguments_sha256,
    actual_sha256: actualArguments === null ? null : sha256(Buffer.from(actualArguments, 'utf8')),
    exact: actualArguments === actionPlan.invocation_arguments,
    literal_quote_count: actualArguments === null ? 0 : [...actualArguments].filter(character => character === '"').length,
    repeated_space_preserved: actualArguments?.includes('  ') || false,
    literal_tab_preserved: actualArguments?.includes('\t') || false,
    literal_dollar_one_preserved: actualArguments?.includes('$1') || false
  };
  const after = snapshotProject(projectRoot);
  const recordsAfter = readPlanningRecords(projectRoot);
  const mutation = checkMutationBoundary(actionPlan.action, before, after, recordsBefore, recordsAfter);
  const schemaValidation = validatePlanningPaths([projectRoot]);
  const invariants = checkLifecycleRecords(projectRoot, oracle.decisions, actionPlan.action, previousRecords);
  const gitAfter = gitControlSnapshot(projectRoot);
  const installedExtensionRoot = path.join(root, 'clio', 'config', 'extensions', 'wtfp');
  const toolAudit = eventToolAudit(parsed.events, {
    project: projectRoot,
    extension: installedExtensionRoot,
    additional: []
  });
  const appendedAudit = auditEventsSince(root, auditOffsets);
  const workerToolAudit = eventToolAudit(appendedAudit.events, {
    project: projectRoot,
    extension: installedExtensionRoot,
    additional: []
  });
  if (appendedAudit.errors.length) workerToolAudit.errors.push(...appendedAudit.errors);
  workerToolAudit.valid = workerToolAudit.errors.length === 0;
  const toolMutationBoundary = checkToolMutationBoundary(actionPlan.action, [toolAudit, workerToolAudit], projectRoot);
  let receiptAudit;
  try {
    const receiptsAfter = collectReceipts(root);
    receiptAudit = await verifyReceiptDelta(root, receiptsBefore, receiptsAfter, options.clioSource);
  } catch (error) {
    receiptAudit = {
      valid: false,
      receipts: [],
      verifier: null,
      errors: [`receipt collection failed: ${error.message}`],
      cost: { valid: false, errors: ['receipt collection failed'] }
    };
  }
  const runtimePolicy = plan.requested.main_runtime;
  const expectedClientVersion = clientVersion.replace(/^Clio Coder\s+/u, '');
  const requiredWorkers = REQUIRED_DISPATCH[actionPlan.action] || [];
  if (receiptAudit.receipts.length !== 1 + requiredWorkers.length) {
    receiptAudit.errors.push(`${actionPlan.action}: expected exactly ${1 + requiredWorkers.length} new receipts, observed ${receiptAudit.receipts.length}`);
  }
  const processStart = Date.parse(processResult.startedAt);
  const processEnd = Date.parse(processResult.endedAt);
  for (const receipt of receiptAudit.receipts) {
    const receiptStart = Date.parse(receipt.started_at);
    const receiptEnd = Date.parse(receipt.ended_at);
    if (![processStart, processEnd, receiptStart, receiptEnd].every(Number.isFinite) ||
      receiptStart < processStart || receiptEnd > processEnd || receiptStart > receiptEnd) {
      receiptAudit.errors.push(`${receipt.id}: receipt timestamps escaped the owned action process interval`);
    }
  }
  const mainReceipts = receiptAudit.receipts.filter(receipt =>
    receipt.agent_id === 'main-agent' && receipt.request_origin === 'user' && receipt.session_id === session?.id);
  if (mainReceipts.length !== 1) {
    receiptAudit.errors.push(`expected exactly one main-agent receipt for session ${session?.id || 'missing'}, observed ${mainReceipts.length}`);
  }
  for (const receipt of mainReceipts) {
    if (receipt.client_version !== expectedClientVersion) receiptAudit.errors.push(`${receipt.id}: main receipt client version mismatch`);
    if (receipt.outcome !== 'succeeded' || receipt.exit_code !== 0) receiptAudit.errors.push(`${receipt.id}: main receipt did not succeed`);
  }
  for (const receipt of receiptAudit.receipts.filter(receipt => receipt.agent_id !== 'main-agent')) {
    if (receipt.client_version !== expectedClientVersion) receiptAudit.errors.push(`${receipt.id}: worker receipt client version mismatch`);
  }
  const mainBinding = mainReceiptBinding(mainReceipts[0], parsed.events, actionPlan, processResult, runtimePolicy);
  receiptAudit.errors.push(...mainBinding.errors);
  receiptAudit.valid = receiptAudit.errors.length === 0;
  const dispatchBoundary = requiredDispatchAudit(
    actionPlan.action,
    toolAudit,
    receiptAudit.receipts,
    plan.requested.worker_runtime,
    { projectRoot, mutation, records: recordsAfter, schemaValidation }
  );
  const verifierTiming = verifierRecordTiming(actionPlan.action, recordsAfter, receiptAudit.receipts, processResult);
  const lockErrors = checkRecordLocks(recordsAfter, locks);
  const sessionErrors = [];
  if (!session?.id) sessionErrors.push('Clio session event missing');
  if (session?.target !== options.target) sessionErrors.push(`actual target ${session?.target} != ${options.target}`);
  if (session?.model !== options.model) sessionErrors.push(`actual model ${session?.model} != ${options.model}`);
  if (actionPlan.session === 'resume:S1' && session?.id !== sessions.S1) sessionErrors.push('S1 session identity changed');
  if (actionPlan.session === 'resume:S2' && session?.id !== sessions.S2) sessionErrors.push('S2 session identity changed');
  if (actionPlan.action === 'resume-writing' && session?.id === sessions.S1) sessionErrors.push('resume reused hidden S1 session');

  const valid = processResult.exitCode === 0 && !processResult.timedOut && processResult.processGroup.quiesced &&
    stateQuiescence.quiesced && parsed.errors.length === 0 &&
    argumentEvidence.exact && mutation.valid && schemaValidation.valid && invariants.valid &&
    gitControlEqual(initialGit, gitAfter) && toolAudit.valid && workerToolAudit.valid &&
    toolMutationBoundary.valid && dispatchBoundary.valid && verifierTiming.valid &&
    receiptAudit.valid && mainBinding.valid && lockErrors.length === 0 && sessionErrors.length === 0;
  const report = {
    schema: 'wtfp.evaluation.clio-lifecycle-transition/v1',
    action: actionPlan.action,
    process: processResult,
    state_quiescence: stateQuiescence,
    session,
    process_boundary: true,
    expected_session: actionPlan.session,
    argument_evidence: argumentEvidence,
    jsonl_parse_errors: parsed.errors,
    mutation,
    schema_validation: schemaValidation,
    cross_record_invariants: invariants,
    record_lock_errors: lockErrors,
    git_control: { initial: initialGit, after: gitAfter, unchanged: gitControlEqual(initialGit, gitAfter) },
    tool_audit: toolAudit,
    worker_tool_audit: workerToolAudit,
    tool_mutation_boundary: toolMutationBoundary,
    dispatch_boundary: dispatchBoundary,
    verifier_record_timing: verifierTiming,
    main_receipt_binding: mainBinding,
    receipt_audit: receiptAudit,
    session_errors: sessionErrors,
    stdout: { path: path.relative(root, stdoutFile), bytes: fs.statSync(stdoutFile).size, sha256: sha256(fs.readFileSync(stdoutFile)) },
    stderr: { path: path.relative(root, stderrFile), bytes: fs.statSync(stderrFile).size, sha256: sha256(fs.readFileSync(stderrFile)) },
    valid
  };
  writeJsonPrivate(path.join(root, 'evidence', 'transitions', `${prefix}.json`), report);
  return { report, records: recordsAfter, events: parsed.events };
}

async function execute(options, sources) {
  const { prepared, plan } = verifyPrepared(options, sources);
  const root = options.root;
  const projectRoot = path.join(root, 'project');
  const paths = isolatedPaths(root, options.clioSource, 'S1');
  const resumePaths = isolatedPaths(root, options.clioSource, 'S2');
  const environments = {
    S1: sanitizedChildEnv(paths),
    S2: sanitizedChildEnv(resumePaths)
  };
  const settingsSource = process.env.WTFP_CLIO_SETTINGS_SOURCE;
  const credentialsSource = process.env.WTFP_CLIO_CREDENTIALS_SOURCE;
  if (!settingsSource || !credentialsSource) {
    throw new Error('execute requires WTFP_CLIO_SETTINGS_SOURCE and WTFP_CLIO_CREDENTIALS_SOURCE');
  }
  const settingsPath = path.resolve(settingsSource);
  const credentialsPath = path.resolve(credentialsSource);
  assertRegularFile(settingsPath, 'settings source');
  assertRegularFile(credentialsPath, 'credentials source');
  if (settingsPath === credentialsPath) throw new Error('settings and credentials sources must be distinct files');
  if (isContained(root, settingsPath) || isContained(root, credentialsPath)) {
    throw new Error('settings and credentials sources must remain outside the disposable destination root');
  }
  const profilePaths = profilePathList(settingsPath, credentialsPath);
  const profilesBefore = snapshotProfiles(profilePaths);
  writeJsonPrivate(path.join(root, 'evidence', 'normal-profiles-pre.json'), profilesBefore);
  writeJsonPrivate(path.join(root, 'evidence', 'execution-started.json'), {
    schema: 'wtfp.evaluation.clio-lifecycle-execution-start/v1',
    started_at: new Date().toISOString(),
    prepared_sha256: sha256(fs.readFileSync(path.join(root, 'evidence', PREPARED_FILE))),
    settings_source_sha256: sha256(fs.readFileSync(settingsPath)),
    effective_settings_sha256: prepared.effective_settings_sha256,
    settings_source_behavior_imported: false,
    credentials_source_sha256: sha256(fs.readFileSync(credentialsPath)),
    credential_source_recorded_in_profile_inventory: true,
    credential_contents_recorded: false
  });

  const isolatedSettings = path.join(paths.CLIO_CODER_CONFIG_DIR, 'settings.yaml');
  const isolatedCredentials = path.join(paths.CLIO_CODER_CONFIG_DIR, 'credentials.yaml');
  const oracle = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'expected-invariants.json'), 'utf8'));
  let credentialHandle = null;
  let approvedRotatedCredential = null;
  const signalGuard = installExecutionSignalHandlers(() =>
    cleanupCredentialArtifactsSafe(
      paths.CLIO_CODER_CONFIG_DIR,
      isolatedCredentials,
      root,
      credentialHandle,
      approvedRotatedCredential
    ));
  let credentialCandidates;
  try {
    if (containedPrivateFileSha256(
      root,
      paths.CLIO_CODER_CONFIG_DIR,
      isolatedSettings,
      'sealed minimal evaluation settings'
    ) !== prepared.effective_settings_sha256) {
      throw new Error('sealed minimal evaluation settings changed before credential forwarding');
    }
    const credentialDirectoryBinding = bindContainedPrivateDirectory(
      root,
      paths.CLIO_CODER_CONFIG_DIR,
      'isolated Clio config root'
    );
    const credentialBytes = fs.readFileSync(credentialsPath);
    credentialHandle = openPrivateCredential(isolatedCredentials, credentialBytes);
    credentialHandle.directory_binding = credentialDirectoryBinding;
    credentialCandidates = collectCredentialCandidates(credentialBytes.toString('utf8'));
  } catch (error) {
    cleanupCredentialArtifactsSafe(paths.CLIO_CODER_CONFIG_DIR, isolatedCredentials, root, credentialHandle);
    signalGuard.remove();
    throw error;
  }
  const initialGit = prepared.git_control;
  let previousRecords = [];
  const sessions = { S1: null, S2: null };
  const locks = {};
  const transitions = [];
  const eventSummaries = [];
  let fixtureHook = null;
  let sessionBoundaryState = null;
  let stoppedReason = null;
  let cleanup = { status: 'cleanup-failed', method: 'not-attempted', absent: false };
  let credentialScan = { valid: false, scanned_files: 0, scanned_bytes: 0, findings: [], anomalies: [] };
  let credentialArtifactAnomalies = [];
  let isolatedCredentialsFinalSha256 = null;
  let isolatedSettingsFinalSha256 = null;
  let configRootTrustedAfterExecution = false;
  const started = Date.now();

  try {
    for (const actionPlan of plan.actions) {
      if (signalGuard.state.signal) {
        stoppedReason = `operator interruption ${signalGuard.state.signal}`;
        break;
      }
      assertContainedPrivateDirectory(root, paths.CLIO_CODER_CONFIG_DIR, 'isolated Clio config root');
      const currentReceipts = collectReceipts(root);
      if (!currentReceipts.cost.valid) {
        stoppedReason = `invalid receipt cost evidence before ${actionPlan.action}`;
        break;
      }
      if (currentReceipts.cost.client_reported_numeric_total_usd >= options.budgetUsd) {
        stoppedReason = `cost ceiling reached before ${actionPlan.action}`;
        break;
      }
      if (actionPlan.action === 'resume-writing') {
        const observed = sessionPrivateState(resumePaths, root);
        sessionBoundaryState = {
          schema: 'wtfp.evaluation.clio-session-boundary/v1',
          checked_at: new Date().toISOString(),
          expected_initial_sha256: prepared.fresh_session_initial_sha256,
          observed,
          valid: observed.pristine && observed.sha256 === prepared.fresh_session_initial_sha256
        };
        writeJsonPrivate(path.join(root, 'evidence', 'session-boundary.json'), sessionBoundaryState);
        if (!sessionBoundaryState.valid) {
          stoppedReason = 'fresh S2 client-state surface was contaminated before resume';
          break;
        }
      }
      const outcome = await runAction({
        actionPlan,
        options,
        root,
        plan,
        env: actionPlan.session.endsWith('S2') ? environments.S2 : environments.S1,
        sessions,
        oracle,
        previousRecords,
        initialGit,
        locks,
        clientVersion: prepared.client_version
      });
      const profileCheckpoint = snapshotProfiles(profilePaths);
      const profileCheckpointUnchanged = profilesEqual(profilesBefore, profileCheckpoint);
      let settingsCheckpointSha256 = null;
      let settingsCheckpointError = null;
      try {
        if (pruneInactiveProcessGroups().length > 0) {
          throw new Error('settings checkpoint refused while an owned process group remained active');
        }
        settingsCheckpointSha256 = containedPrivateFileSha256(
          root,
          paths.CLIO_CODER_CONFIG_DIR,
          isolatedSettings,
          'sealed minimal evaluation settings'
        );
      } catch (error) {
        settingsCheckpointError = error.message;
      }
      const settingsCheckpointUnchanged =
        settingsCheckpointSha256 === prepared.effective_settings_sha256;
      outcome.report.normal_profile_checkpoint = {
        after_action: actionPlan.action,
        unchanged: profileCheckpointUnchanged,
        external_concurrent_edits_invalidate_measurement: true,
        observed: profileCheckpoint
      };
      outcome.report.effective_settings_checkpoint = {
        unchanged: settingsCheckpointUnchanged,
        sha256: settingsCheckpointSha256,
        error: settingsCheckpointError
      };
      if (!profileCheckpointUnchanged || !settingsCheckpointUnchanged) outcome.report.valid = false;
      writeJsonPrivate(path.join(root, 'evidence', 'transitions',
        `${String(actionPlan.index).padStart(2, '0')}-${actionPlan.action}.json`), outcome.report);
      transitions.push(outcome.report);
      eventSummaries.push({ action: actionPlan.action, tool_audit: outcome.report.tool_audit });
      previousRecords = outcome.records;
      if (actionPlan.action === 'new-paper') Object.assign(locks, lockRecords(previousRecords, ['decisions']));
      if (actionPlan.action === 'map-project') Object.assign(locks, lockRecords(previousRecords, ['source', 'evidence']));
      if (actionPlan.action === 'create-outline') {
        Object.assign(locks, lockRecords(previousRecords, ['outline']));
        if (!outcome.report.valid) {
          stoppedReason = `${actionPlan.action} transition failed validation`;
          break;
        }
        fixtureHook = materializeSectionInputs(root, projectRoot);
      }
      if (!outcome.report.valid) {
        stoppedReason = signalGuard.state.signal
          ? `operator interruption ${signalGuard.state.signal}`
          : `${actionPlan.action} transition failed validation`;
        break;
      }
    }
  } catch (error) {
    stoppedReason = `harness exception: ${error.message}`;
  } finally {
    try {
      if (pruneInactiveProcessGroups().length > 0) {
        throw new Error('credential artifact scan refused while an owned process group remained active');
      }
      assertContainedPrivateDirectory(root, paths.CLIO_CODER_CONFIG_DIR, 'isolated Clio config root');
      configRootTrustedAfterExecution = true;
      isolatedSettingsFinalSha256 = containedPrivateFileSha256(
        root,
        paths.CLIO_CODER_CONFIG_DIR,
        isolatedSettings,
        'sealed minimal evaluation settings'
      );
      if (pathEntryExists(isolatedCredentials)) {
        const finalCredentialEvidence = readContainedPrivateFileEvidence(
          root,
          paths.CLIO_CODER_CONFIG_DIR,
          isolatedCredentials,
          'isolated Clio credentials',
          {
            maxBytes: 16 * 1024 * 1024,
            directoryBinding: credentialHandle?.directory_binding || null,
            approveCredentialRotation: true
          }
        );
        approvedRotatedCredential = finalCredentialEvidence;
        const finalCredentialBytes = finalCredentialEvidence.bytes;
        isolatedCredentialsFinalSha256 = finalCredentialEvidence.sha256;
        credentialCandidates = [...new Set([
          ...credentialCandidates,
          ...collectCredentialCandidates(finalCredentialBytes.toString('utf8'))
        ])].sort((left, right) => right.length - left.length);
      }
      credentialScan = scanAndRedactCredentialValues(root, isolatedCredentials, credentialCandidates);
    } catch (error) {
      credentialScan = {
        valid: false,
        scanned_files: 0,
        scanned_bytes: 0,
        findings: [],
        anomalies: [{ path: null, reason: `credential artifact scan failed: ${error.message}` }]
      };
    }
    cleanup = cleanupCredentialArtifactsSafe(
      paths.CLIO_CODER_CONFIG_DIR,
      isolatedCredentials,
      root,
      credentialHandle,
      approvedRotatedCredential
    );
  }

  if (pruneInactiveProcessGroups().length > 0) {
    signalGuard.remove();
    throw new Error('owned Clio process group remained active; all post-execution filesystem reads are refused');
  }

  const profilesAfter = snapshotProfiles(profilePaths);
  writeJsonPrivate(path.join(root, 'evidence', 'normal-profiles-post.json'), profilesAfter);
  const profileUnchanged = profilesEqual(profilesBefore, profilesAfter);
  const effectiveSettingsUnchanged =
    isolatedSettingsFinalSha256 === prepared.effective_settings_sha256;
  const aggregateRoots = {
    project: projectRoot,
    extension: path.join(root, 'clio', 'config', 'extensions', 'wtfp'),
    additional: []
  };
  let receipts;
  let aggregateAudit;
  try {
    if (!configRootTrustedAfterExecution) throw new Error('Clio config-root containment was not trusted after execution');
    assertContainedPrivateDirectory(root, paths.CLIO_CODER_CONFIG_DIR, 'isolated Clio config root');
    receipts = collectReceipts(root);
    aggregateAudit = auditLogSummary(root, aggregateRoots);
  } catch (error) {
    const reason = `post-execution Clio evidence collection refused: ${error.message}`;
    receipts = {
      receipts: [],
      inventory_errors: [reason],
      cost: { ...summarizeReceiptCosts([]), valid: false, errors: [reason] },
      total_latency_ms: 0,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      reasoning_tokens: 0,
      tool_calls: 0
    };
    aggregateAudit = {
      valid: false,
      entries: 0,
      files: [],
      parse_errors: [reason],
      tool_audit: { ...eventToolAudit([], aggregateRoots), valid: false, errors: [reason] }
    };
  }
  const forbiddenReceiptTools = [...new Set(receipts.receipts.flatMap(receipt =>
    (receipt.tool_stats || []).map(tool => tool.tool).filter(isForbiddenToolName)))].sort();
  const finalGit = gitControlSnapshot(projectRoot);
  const finalSchema = fs.existsSync(path.join(projectRoot, '.planning'))
    ? validatePlanningPaths([projectRoot])
    : { valid: false, checked: 0, roots: [] };
  const exercisedSequence = transitions.map(transition => transition.action);
  const completedSequence = transitions.filter(transition => transition.process.exitCode === 0 &&
    !transition.process.timedOut && transition.process.processGroup.quiesced &&
    transition.state_quiescence.quiesced).map(transition => transition.action);
  const validSequence = transitions.filter(transition => transition.valid).map(transition => transition.action);
  const sequenceComplete = JSON.stringify(validSequence) === JSON.stringify(ACTION_SEQUENCE);
  const sessionBoundaryValid = Boolean(sessions.S1 && sessions.S2 && sessions.S1 !== sessions.S2);
  const runtimePolicy = plan.requested.main_runtime;
  const identityErrors = receipts.receipts.flatMap(receipt => {
    const errors = [];
    for (const [field, expected] of [
      ['target', runtimePolicy.target], ['model', runtimePolicy.model],
      ['runtime_id', runtimePolicy.runtime_id], ['runtime_kind', runtimePolicy.runtime_kind]
    ]) {
      if (receipt[field] !== expected) errors.push(`${receipt.id}: ${field} ${receipt[field]} != ${expected}`);
    }
    if (receipt.runtime?.requested_effort !== runtimePolicy.effort ||
      receipt.runtime?.effective_effort !== runtimePolicy.effort || receipt.runtime?.auth !== runtimePolicy.auth ||
      receipt.runtime?.auth_required !== true || receipt.runtime?.api_family !== runtimePolicy.api_family ||
      receipt.runtime?.runtime_tier !== 'cloud' || !Array.isArray(receipt.runtime?.diagnostics) ||
      receipt.runtime.diagnostics.some(item => item?.severity === 'error')) {
      errors.push(`${receipt.id}: sealed runtime resolution did not match the prepared policy`);
    }
    if (receipt.client_version !== prepared.client_version.replace(/^Clio Coder\s+/u, '')) {
      errors.push(`${receipt.id}: client version ${receipt.client_version} != ${prepared.client_version}`);
    }
    return errors;
  });
  if (!profileUnchanged) stoppedReason ||= 'normal profile hashes changed';
  if (!effectiveSettingsUnchanged) stoppedReason ||= 'sealed minimal evaluation settings changed during execution';
  if (cleanup.status !== 'securely-removed' || !cleanup.absent) stoppedReason ||= 'credential cleanup failed';
  if (!credentialScan.valid) stoppedReason ||= 'credential artifact scan coverage was incomplete';
  if (credentialScan.findings.length) stoppedReason ||= 'credential value appeared in isolated artifacts and was redacted';
  if (credentialArtifactAnomalies.length) stoppedReason ||= 'isolated credential artifact changed type';
  if (!gitControlEqual(initialGit, finalGit)) stoppedReason ||= 'Git control plane changed';
  if (!sessionBoundaryValid && exercisedSequence.includes('resume-writing')) stoppedReason ||= 'fresh session boundary failed';
  if (exercisedSequence.includes('resume-writing') && sessionBoundaryState?.valid !== true) {
    stoppedReason ||= 'fresh S2 state boundary failed';
  }
  if (!receipts.cost.valid) stoppedReason ||= 'receipt cost evidence was invalid';
  if (receipts.cost.client_reported_numeric_total_usd > options.budgetUsd) {
    stoppedReason ||= 'client-reported campaign cost ceiling exceeded';
  }
  if (sequenceComplete && receipts.receipts.length !== plan.requested.receipt_policy.maximum_total_receipts) {
    stoppedReason ||= 'completed sequence did not produce the exact prepared receipt count';
  }
  if (identityErrors.length) stoppedReason ||= 'actual client/model/effort identity differed from the prepared target';
  if (!aggregateAudit.valid) stoppedReason ||= 'aggregate Clio audit log violated tool or containment policy';
  if (forbiddenReceiptTools.length) stoppedReason ||= 'receipt reported a forbidden tool';

  const result = {
    schema: RUN_SCHEMA,
    outcome: sequenceComplete && !stoppedReason ? 'completed' : 'blocked',
    started_at: new Date(started).toISOString(),
    ended_at: new Date().toISOString(),
    latency_ms: Date.now() - started,
    stopped_reason: stoppedReason,
    exact_source: sources,
    client: {
      name: 'Clio Coder',
      version: prepared.client_version,
      binary_path: options.binary,
      binary_sha256: sources.clio.binary.sha256,
      source_commit: sources.clio.commit,
      target: options.target,
      model: options.model,
      effort: options.effort,
      identity_errors: identityErrors
    },
    requested: plan.requested,
    fixture: {
      id: plan.fixture.id,
      version: plan.fixture.version,
      fixture_commit: prepared.fixture_commit,
      model_inputs_sha256: plan.fixture.model_inputs_sha256,
      evaluator_oracle_sha256: plan.fixture.evaluator_oracles_sha256,
      oracle_exposed_to_model: false
    },
    actions_planned: ACTION_SEQUENCE,
    actions_exercised: exercisedSequence,
    actions_completed: completedSequence,
    actions_valid: validSequence,
    sessions: {
      S1: sessions.S1,
      S2: sessions.S2,
      distinct: sessionBoundaryValid,
      resume_started_fresh: sessionBoundaryValid,
      process_per_action: true,
      client_state_boundary: sessionBoundaryState
    },
    transitions: transitions.map(transition => ({
      action: transition.action,
      valid: transition.valid,
      latency_ms: transition.process.latencyMs,
      session_id: transition.session?.id || null,
      argument_evidence: transition.argument_evidence,
      schema_checked: transition.schema_validation.checked,
      schema_valid: transition.schema_validation.valid,
      planning_records: transition.cross_record_invariants.record_count,
      mutation_count: transition.mutation.changes.length,
      tool_calls: transition.tool_audit.call_count,
      dispatch_count: transition.tool_audit.dispatch.length,
      required_dispatch_agents: transition.dispatch_boundary.required_agents,
      contract_receipt_agents: transition.dispatch_boundary.contract_receipt_agents,
      receipt_count: transition.receipt_audit.receipts.length,
      receipt_cost: transition.receipt_audit.cost,
      process_group_quiesced: transition.process.processGroup.quiesced,
      state_quiesced: transition.state_quiescence.quiesced,
      evidence: `evidence/transitions/${String(ACTION_SEQUENCE.indexOf(transition.action) + 1).padStart(2, '0')}-${transition.action}.json`
    })),
    fixture_hook: fixtureHook,
    receipts,
    tool_activity: eventSummaries,
    aggregate_tool_audit: aggregateAudit,
    forbidden_receipt_tools: forbiddenReceiptTools,
    fleet_activity: {
      paid_fleet_runs: 0,
      native_contract_evidence: 'evidence/native-preflight.json',
      note: 'Lifecycle actions may dispatch extension agents; fleet contracts are validated and graphed but are not substituted for canonical state transitions.'
    },
    steering: { required: false, events: [], note: 'No steering channel is configured; any future intervention must be recorded explicitly.' },
    final_schema_validation: finalSchema,
    git_control: { before: initialGit, after: finalGit, unchanged: gitControlEqual(initialGit, finalGit) },
    normal_profiles: { before: profilesBefore, after: profilesAfter, unchanged: profileUnchanged },
    credentials: {
      forwarded: true,
      transport: 'isolated mode-0600 credentials.yaml',
      source_path_recorded_in_profile_inventory: true,
      source_contents_recorded: false,
      settings_sha256: isolatedSettingsFinalSha256,
      settings_source_behavior_imported: false,
      effective_settings_unchanged: effectiveSettingsUnchanged,
      credentials_sha256: profilesBefore.find(item => item.path === credentialsPath)?.sha256 || null,
      isolated_final_sha256: isolatedCredentialsFinalSha256,
      isolated_credential_refreshed: isolatedCredentialsFinalSha256 !== null &&
        isolatedCredentialsFinalSha256 !== (profilesBefore.find(item => item.path === credentialsPath)?.sha256 || null),
      artifact_scan: credentialScan,
      artifact_anomalies: credentialArtifactAnomalies,
      cleanup
    },
    semantic_assessment: {
      status: 'pending-independent-review',
      note: 'Structural checks do not self-attest evidence fidelity, unsupported-claim rate, or academic quality.'
    },
    interruption: { signal: signalGuard.state.signal, count: signalGuard.state.count }
  };
  writeJsonPrivate(path.join(root, 'evidence', 'lifecycle-result.json'), result);
  signalGuard.remove();
  return result;
}

async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return 0;
    }
    const sources = inspectSources(options);
    if (options.mode === 'dry-run') {
      process.stdout.write(`${JSON.stringify(buildPlan(options, sources), null, 2)}\n`);
      return 0;
    }
    if (options.mode === 'prepare') {
      const result = prepare(options, sources);
      process.stdout.write(`${JSON.stringify({
        mode: result.prepared.paid_execution_ready ? 'prepared' : 'prepared-blocked',
        root: result.root,
        plan: path.join(result.root, 'evidence', 'run-plan.json'),
        native_evidence: path.join(result.root, 'evidence', 'native-preflight.json'),
        native_preflight_valid: result.prepared.native_preflight_valid,
        paid_execution_ready: result.prepared.paid_execution_ready,
        credentials_forwarded: false,
        paid_model_calls: 0
      }, null, 2)}\n`);
      return result.prepared.paid_execution_ready ? 0 : 1;
    }
    const result = await execute(options, sources);
    process.stdout.write(`${JSON.stringify({
      outcome: result.outcome,
      actions_completed: result.actions_completed,
      client_reported_cost: result.receipts.cost,
      result: path.join(options.root, 'evidence', 'lifecycle-result.json'),
      profiles_unchanged: result.normal_profiles.unchanged,
      credentials_cleanup: result.credentials.cleanup.status
    }, null, 2)}\n`);
    return result.outcome === 'completed' ? 0 : 1;
  } catch (error) {
    const root = options?.root;
    process.stderr.write(root
      ? `lifecycle harness failed; inspect contained evidence under ${path.join(root, 'evidence')}\n`
      : 'lifecycle harness failed before a disposable root was established\n');
    return 2;
  }
}

if (require.main === module) {
  main().then(code => {
    process.exitCode = code;
  });
}

module.exports = {
  auditStructuredWorkerResult,
  buildPlan,
  auditLogSummary,
  auditEventsSince,
  bindContainedPrivateDirectory,
  collectCredentialCandidates,
  collectReceipts,
  cleanupCredentialArtifacts,
  cleanupCredentialArtifactsSafe,
  containedPrivateFileSha256,
  collectReceipts,
  createRoot,
  eventToolAudit,
  execute,
  fleetBoundaryProbe,
  gitControlEqual,
  gitControlSnapshot,
  initializeFixture,
  inspectSources,
  isolatedPaths,
  installExecutionSignalHandlers,
  isForbiddenToolName,
  mainReceiptBinding,
  minimalEvaluationSettings,
  materializeSectionInputs,
  openPrivateCredential,
  parseArgs,
  prepare,
  profilesEqual,
  readContainedPrivateFile,
  readContainedPrivateFileEvidence,
  checkToolMutationBoundary,
  requiredDispatchAudit,
  runNativePreflight,
  runAction,
  sanitizedChildEnv,
  sessionPrivateState,
  scanAndRedactCredentialValues,
  secureRemove,
  spawnCaptured,
  snapshotAuditOffsets,
  snapshotProfiles,
  summarizeReceiptCosts,
  usage,
  verifyReceiptDelta,
  verifyPrepared
};
