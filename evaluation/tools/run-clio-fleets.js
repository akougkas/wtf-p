#!/usr/bin/env node

'use strict';

/**
 * Fail-closed native Clio gate for the two generated WTF-P fleet contracts.
 * Preparation is credential-free. Paid execution requires a sealed preparation,
 * an exact acknowledgement, and credential source paths supplied only through
 * the environment. See evaluation/FLEETS.md.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const lifecycle = require('./run-clio-lifecycle');
const {
  canonicalJson,
  diffSnapshots,
  hashTree,
  isContained,
  readPlanningRecords,
  sha256,
  snapshotProject,
  walkFiles
} = require('../lib/clio-lifecycle');
const { validatePlanningPaths } = require('./validate-planning');

const repositoryRoot = path.resolve(__dirname, '../..');
const fixtureRoot = path.join(repositoryRoot, 'evaluation', 'v1', 'fixtures', 'hpc-checkpointing');
const seedFile = path.join(repositoryRoot, 'evaluation', 'v1', 'fleets', 'fixture-seed.json');
const generatedExtension = path.join(repositoryRoot, 'vendors', 'clio');

const EXPECTED_CLIO = Object.freeze({
  source: '/tmp/clio-v038-fixed-source.Xbdr8a',
  binary: '/tmp/clio-v038-fixed-source.Xbdr8a/dist/cli/index.js',
  commit: '9b7b80ccbd3d2211d4079bc76558bb06d66a8583',
  tree: '8dbaeec93aff35483c197754d798309d83f0f534',
  source_sha256: 'f463ba10c29e79969f2ac9329b7457460feaf38ef14171719376c15a4f130248',
  binary_sha256: 'f02f31c7480ac4f9532980f8df93e07816111626bdce9879e1ee9e98fd3ec162',
  dist_sha256: 'd03c74299c7fca59bbc9a0f369b51e8fd9c89518528205f6c14f27e7650113ec',
  modules_sha256: 'defb8845b787b478859b414161463f6881182d6e5f40f64d28886f54a064cdf3',
  version: 'Clio Coder 0.3.8'
});

const TARGET = 'openai-codex';
const MODEL = 'gpt-5.6-terra';
const EFFORT = 'xhigh';
const DEFAULT_TIMEOUT_MINUTES = 30;
const DEFAULT_BUDGET_USD = 20;
const PREPARED_FILE = 'fleet-prepared.json';
const PREPARED_SCHEMA = 'wtfp.evaluation.clio-fleets-prepared/v1';
const RESULT_SCHEMA = 'wtfp.evaluation.clio-fleets-run/v1';
const CONFIRMATION_ENV = 'WTFP_FLEETS_CONFIRM_PAID';
const CONFIRMATION = 'I_ACKNOWLEDGE_PAID_CLIO_FLEETS_V1';
const SETTINGS_SOURCE_ENV = 'WTFP_FLEETS_CLIO_SETTINGS_SOURCE';
const CREDENTIALS_SOURCE_ENV = 'WTFP_FLEETS_CLIO_CREDENTIALS_SOURCE';
const PROFILE_PATHS_ENV = 'WTFP_FLEETS_NORMAL_PROFILE_PATHS';
const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
const MAX_EVIDENCE_BYTES = 128 * 1024 * 1024;

const FLEETS = Object.freeze([
  Object.freeze({
    name: 'wtfp-plan-section',
    mutator: 'wtfp-section-planner',
    verifier: 'wtfp-plan-checker',
    mutatorStep: 'plan',
    verifierStep: 'check',
    writes: Object.freeze(['.planning/']),
    exactMutationFiles: Object.freeze(['.planning/sections/evaluation/plans/initial.md']),
    required: Object.freeze([/^\.planning\/sections\/evaluation\/plans\/initial\.md$/u]),
    allowedFiles: Object.freeze([/^\.planning\/sections\/evaluation\/plans\/initial\.md$/u]),
    allowedDirectories: Object.freeze([
      /^\.planning\/sections\/evaluation\/plans$/u
    ])
  }),
  Object.freeze({
    name: 'wtfp-draft-review',
    mutator: 'wtfp-section-writer',
    verifier: 'wtfp-section-reviewer',
    mutatorStep: 'draft',
    verifierStep: 'review',
    writes: Object.freeze(['.planning/', 'paper/']),
    exactMutationFiles: Object.freeze([
      'paper/evaluation.md',
      '.planning/sections/evaluation/summary.md'
    ]),
    required: Object.freeze([
      /^paper\/evaluation\.md$/u,
      /^\.planning\/sections\/evaluation\/summary\.md$/u
    ]),
    allowedFiles: Object.freeze([
      /^paper\/evaluation\.md$/u,
      /^\.planning\/sections\/evaluation\/summary\.md$/u
    ]),
    allowedDirectories: Object.freeze([
      /^paper$/u
    ])
  })
]);

function usage() {
  return [
    'Usage:',
    '  node evaluation/tools/run-clio-fleets.js --dry-run [options]',
    '  node evaluation/tools/run-clio-fleets.js --prepare [--root <new-path>] [options]',
    '  node evaluation/tools/run-clio-fleets.js --execute --root <prepared-path> [options]',
    '',
    'Options:',
    `  --binary <path>       exact Clio entry (default: ${EXPECTED_CLIO.binary})`,
    `  --clio-source <path>  exact coordinated source (default: ${EXPECTED_CLIO.source})`,
    '  --extension <path>    generated extension (default: vendors/clio)',
    `  --timeout-minutes <n> per-fleet timeout (default: ${DEFAULT_TIMEOUT_MINUTES})`,
    `  --budget-usd <n>      stop-before-next-fleet ceiling (default: ${DEFAULT_BUDGET_USD})`,
    '',
    '--dry-run and --prepare never read credentials or call a model. --execute',
    `requires ${CONFIRMATION_ENV}=${CONFIRMATION}, then reads source paths only`,
    `from ${SETTINGS_SOURCE_ENV} and ${CREDENTIALS_SOURCE_ENV}. Credential values`,
    'are forbidden in arguments and are never intentionally retained in evidence.'
  ].join('\n');
}

function parsePositive(value, label, maximum = Number.POSITIVE_INFINITY) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > maximum) {
    throw new Error(`${label} must be greater than zero and at most ${maximum}`);
  }
  return number;
}

function parseArgs(argv, environment = process.env) {
  const options = {
    mode: null,
    root: null,
    binary: EXPECTED_CLIO.binary,
    clioSource: EXPECTED_CLIO.source,
    extension: generatedExtension,
    target: TARGET,
    model: MODEL,
    effort: EFFORT,
    timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
    budgetUsd: DEFAULT_BUDGET_USD
  };
  const modes = new Set(['--dry-run', '--prepare', '--execute']);
  const valued = new Set([
    '--root', '--binary', '--clio-source', '--extension', '--timeout-minutes', '--budget-usd'
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (/credential|api[-_]?key|token|secret/iu.test(argument)) {
      throw new Error(`credential material and credential paths are forbidden as CLI options: ${argument}`);
    }
    if (modes.has(argument)) {
      if (options.mode !== null) throw new Error('choose exactly one mode');
      options.mode = argument.slice(2);
      continue;
    }
    if (!valued.has(argument)) throw new Error(`unknown option ${argument}`);
    const value = argv[index + 1];
    if (value === undefined || value === '') throw new Error(`${argument} requires a value`);
    index += 1;
    if (argument === '--root') options.root = path.resolve(value);
    else if (argument === '--binary') options.binary = path.resolve(value);
    else if (argument === '--clio-source') options.clioSource = path.resolve(value);
    else if (argument === '--extension') options.extension = path.resolve(value);
    else if (argument === '--timeout-minutes') options.timeoutMinutes = parsePositive(value, argument, 60);
    else options.budgetUsd = parsePositive(value, argument, 100);
  }
  if (options.mode === null) throw new Error('choose exactly one of --dry-run, --prepare, or --execute');
  if (options.mode === 'execute' && options.root === null) throw new Error('--execute requires --root');
  for (const key of ['binary', 'clioSource', 'extension']) options[key] = path.resolve(options[key]);
  if (environment[CONFIRMATION_ENV] && options.mode !== 'execute') {
    // An ambient acknowledgement does not turn a credential-free mode into execution.
    options.ambientConfirmationIgnored = true;
  }
  return options;
}

function commandResult(executable, argv, options = {}) {
  const result = spawnSync(executable, argv, {
    cwd: options.cwd || repositoryRoot,
    env: options.env || process.env,
    input: options.input,
    encoding: options.encoding || 'utf8',
    timeout: options.timeout || 60000,
    maxBuffer: options.maxBuffer || 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && options.allowFailure !== true) {
    throw new Error(`${path.basename(executable)} exited ${result.status}`);
  }
  return { exitCode: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function makePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function writePrivate(file, bytes, exclusive = true) {
  makePrivateDirectory(path.dirname(file));
  fs.writeFileSync(file, bytes, { mode: 0o600, flag: exclusive ? 'wx' : 'w' });
  fs.chmodSync(file, 0o600);
}

function writeJsonPrivate(file, value, exclusive = true) {
  writePrivate(file, `${JSON.stringify(value, null, 2)}\n`, exclusive);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function canonicalDigest(value) {
  return sha256(Buffer.from(JSON.stringify(canonicalJson(value)), 'utf8'));
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

function assertPrivateRoot(root, label = 'disposable root') {
  const stat = fs.lstatSync(root);
  if (stat.isSymbolicLink() || !stat.isDirectory() || (stat.mode & 0o077) !== 0) {
    throw new Error(`${label} must remain a mode-0700 non-symlink directory`);
  }
}

function createRoot(requested) {
  if (requested) {
    if (fs.existsSync(requested)) throw new Error(`refusing existing prepare root: ${requested}`);
    fs.mkdirSync(requested, { mode: 0o700 });
    fs.chmodSync(requested, 0o700);
    return requested;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-clio-fleets.'));
  fs.chmodSync(root, 0o700);
  return root;
}

function verifyGeneratedInventory(extension) {
  const envelopeFile = path.join(extension, '.wtfp-generated.json');
  const envelope = readJson(envelopeFile);
  if (envelope.schema !== 'wtfp.generated-adapter/v1' || envelope.target !== 'clio' || envelope.generatorVersion !== 4) {
    throw new Error('generated Clio envelope identity is not compiler v4');
  }
  if (!Array.isArray(envelope.files) || envelope.files.length === 0) {
    throw new Error('generated Clio envelope has no exact inventory');
  }
  const expected = new Map();
  for (const entry of envelope.files) {
    if (!entry || typeof entry.path !== 'string' || !/^[a-f0-9]{64}$/u.test(entry.sha256 || '') ||
        expected.has(entry.path) || path.isAbsolute(entry.path) || entry.path.includes('\\')) {
      throw new Error('generated Clio envelope contains a malformed, duplicate, or nonportable inventory entry');
    }
    expected.set(entry.path, entry.sha256);
  }
  const actualEntries = walkFiles(extension).filter(entry => entry.path !== '.wtfp-generated.json');
  const actual = new Map(actualEntries.map(entry => [entry.path, sha256(fs.readFileSync(entry.absolute))]));
  const errors = [];
  for (const [relative, digest] of expected) {
    if (!actual.has(relative)) errors.push(`missing generated file ${relative}`);
    else if (actual.get(relative) !== digest) errors.push(`digest mismatch for generated file ${relative}`);
  }
  for (const relative of actual.keys()) {
    if (!expected.has(relative)) errors.push(`unowned generated file ${relative}`);
  }
  if (errors.length > 0) throw new Error(errors.join('; '));
  for (const required of [
    'agents/wtfp-section-planner.md', 'agents/wtfp-plan-checker.md',
    'agents/wtfp-section-writer.md', 'agents/wtfp-section-reviewer.md',
    'fleets/wtfp-plan-section.md', 'fleets/wtfp-draft-review.md',
    'project/templates/state.json'
  ]) {
    if (!expected.has(required)) throw new Error(`generated inventory omits required fleet resource ${required}`);
  }
  if (expected.has('state.json') || fs.existsSync(path.join(extension, 'state.json'))) {
    throw new Error('root extension-manager state.json must not be packaged as a resource');
  }
  return {
    schema: envelope.schema,
    generator_version: envelope.generatorVersion,
    source_hash: envelope.sourceHash,
    entries: expected.size,
    envelope_sha256: sha256(fs.readFileSync(envelopeFile)),
    exact: true
  };
}

function runtimeBinding() {
  const relatives = [
    'evaluation/lib/clio-lifecycle.js',
    'evaluation/lib/fixture-hashes.js',
    'evaluation/lib/json-schema.js',
    'evaluation/tools/hash-fixtures.js',
    'evaluation/tools/run-clio-lifecycle.js',
    'evaluation/tools/run-clio-fleets.js',
    'evaluation/tools/validate-planning.js',
    'evaluation/v1/fleets/fixture-seed.json'
  ];
  const files = relatives.map(relative => {
    const absolute = path.join(repositoryRoot, relative);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`fleet evaluator dependency changed type: ${relative}`);
    return { path: relative, bytes: stat.size, sha256: sha256(fs.readFileSync(absolute)) };
  });
  return { files, sha256: canonicalDigest(files) };
}

function inspectSources(options) {
  if (path.resolve(options.extension) !== generatedExtension) {
    throw new Error('fleet evaluator is bound to the current generated vendors/clio extension');
  }
  const lifecycleOptions = {
    ...options,
    mode: 'dry-run',
    target: TARGET,
    model: MODEL,
    effort: EFFORT
  };
  const sources = lifecycle.inspectSources(lifecycleOptions);
  const tree = commandResult('git', ['-C', options.clioSource, 'rev-parse', 'HEAD^{tree}']).stdout.trim();
  const version = commandResult(process.execPath, [options.binary, '--version']).stdout.trim();
  assertExpectedClioIdentity(sources.clio, tree, version);
  const seedStat = fs.lstatSync(seedFile);
  if (seedStat.isSymbolicLink() || !seedStat.isFile()) throw new Error('fleet fixture seed changed type');
  return {
    ...sources,
    clio: { ...sources.clio, tree, reported_version: version },
    wtfp: {
      ...sources.wtfp,
      generated_inventory: verifyGeneratedInventory(options.extension),
      fleet_runtime: runtimeBinding()
    },
    fleet_fixture_seed: {
      path: path.relative(repositoryRoot, seedFile).split(path.sep).join('/'),
      sha256: sha256(fs.readFileSync(seedFile)),
      bytes: seedStat.size,
      schema: readJson(seedFile).schema
    }
  };
}

function assertExpectedClioIdentity(clio, tree, version) {
  const checks = [
    ['Clio commit', clio.commit, EXPECTED_CLIO.commit],
    ['Clio tree', tree, EXPECTED_CLIO.tree],
    ['Clio tracked source', clio.source_sha256, EXPECTED_CLIO.source_sha256],
    ['Clio binary', clio.binary.sha256, EXPECTED_CLIO.binary_sha256],
    ['Clio dist', clio.dist.sha256, EXPECTED_CLIO.dist_sha256],
    ['Clio modules', clio.runtime_modules.sha256, EXPECTED_CLIO.modules_sha256],
    ['Clio version', version, EXPECTED_CLIO.version]
  ];
  for (const [label, actual, expected] of checks) {
    if (actual !== expected) throw new Error(`${label} ${actual} != required ${expected}`);
  }
  if (clio.dirty || clio.status_entry_count !== 0) {
    throw new Error('contained Clio source must remain clean');
  }
  return true;
}

function buildPlan(options, sources, root = '<new-mode-0700-root>') {
  const paths = lifecycle.isolatedPaths(root, options.clioSource, 'S1');
  const fleets = FLEETS.map(fleet => {
    const argv = [
      options.binary, 'fleet', 'run', fleet.name,
      '--var', 'section=evaluation', '--json'
    ];
    return {
      name: fleet.name,
      section: 'evaluation',
      topology: [
        { wave: 1, step: fleet.mutatorStep, kind: 'agent', agent: fleet.mutator, scope: 'workspace', writes: fleet.writes },
        { wave: 2, step: fleet.verifierStep, kind: 'agent', agent: fleet.verifier, scope: 'readonly', writes: [] }
      ],
      expected_receipts: [fleet.mutator, fleet.verifier],
      command: {
        executable: process.execPath,
        argv,
        argv_sha256: sha256(Buffer.from(JSON.stringify(argv), 'utf8')),
        timeout_ms: Math.round(options.timeoutMinutes * 60 * 1000)
      }
    };
  });
  return {
    schema: 'wtfp.evaluation.clio-fleets-plan/v1',
    scenario: 'hpc-checkpointing-native-fleets',
    root,
    source: sources,
    client: {
      name: 'Clio Coder',
      version: EXPECTED_CLIO.version,
      binary: options.binary,
      source: options.clioSource,
      commit: EXPECTED_CLIO.commit,
      target: TARGET,
      model: MODEL,
      effort: EFFORT
    },
    isolation: {
      mode: '0700',
      paths,
      require_home_prefix: true,
      network_tools_disabled: true,
      inherited_credential_environment: false,
      effective_settings: 'sealed minimal local-only policy; operator settings bytes are not imported',
      credentials_transport: 'mode-0600 retained-descriptor copy named only by execute-time environment',
      child_environment_allowlist: ['locale', 'terminal', 'contained HOME/XDG/TMP/CLIO_CODER_*']
    },
    extension: {
      source: options.extension,
      sha256: sources.wtfp.extension_sha256,
      inventory: sources.wtfp.generated_inventory,
      install_scope: 'isolated-user'
    },
    fixture: {
      ...sources.fixture,
      seed: sources.fleet_fixture_seed,
      evaluator_git_initialization: true,
      model_oracle_exposed: false
    },
    requested: {
      target: TARGET,
      model: MODEL,
      effort: EFFORT,
      maximum_cost_usd: options.budgetUsd,
      cost_ceiling_interpretation: 'stop-before-next-fleet over valid client-reported receipt costs',
      timeout_minutes_per_fleet: options.timeoutMinutes,
      section: 'evaluation',
      network: false,
      vcs_tools: false,
      fleet_count: 2,
      expected_receipts: 4
    },
    fleets,
    execution_confirmation: { environment: CONFIRMATION_ENV, exact_value_sha256: sha256(Buffer.from(CONFIRMATION)) },
    stop_conditions: [
      'source or preparation digest mismatch', 'missing explicit paid acknowledgement',
      'nonquiescent owned process group', 'nonzero fleet exit', 'topology or receipt mismatch',
      'result-contract mismatch', 'write-boundary violation or rollback', 'undeclared project mutation',
      'planning schema or cross-record failure', 'Git control-plane change',
      'normal-profile change', 'credential scan or cleanup failure', 'cost ceiling reached'
    ],
    interpretation: 'This direct fleet study tests Clio dispatch, receipt, verifier, and write-boundary behavior. It does not replace canonical slash-action state reconciliation or independent semantic review.'
  };
}

function safeProjectPath(projectRoot, relative, label) {
  if (typeof relative !== 'string' || relative.length === 0 || path.isAbsolute(relative) ||
      relative.includes('\\') || relative.includes('\0')) {
    throw new Error(`${label} must be a nonempty repository-relative POSIX path`);
  }
  const segments = relative.split('/');
  if (segments.some(segment => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`${label} contains an unsafe path segment: ${relative}`);
  }
  const absolute = path.resolve(projectRoot, ...segments);
  if (!isContained(projectRoot, absolute) || absolute === path.resolve(projectRoot)) {
    throw new Error(`${label} escapes the project: ${relative}`);
  }
  return absolute;
}

function initializeSeedProject(projectRoot) {
  makePrivateDirectory(projectRoot);
  const seed = readJson(seedFile);
  if (seed.schema !== 'wtfp.evaluation.clio-fleet-fixture-seed/v1' || seed.version !== 1 ||
      seed.fixture?.id !== 'hpc-checkpointing-paper' || seed.fixture?.version !== 1 ||
      seed.project_id !== 'resilient-checkpoint-coordination' || seed.section_id !== 'evaluation' ||
      seed.expected_outputs?.plan !== FLEETS[0].exactMutationFiles[0] ||
      JSON.stringify([seed.expected_outputs?.manuscript, seed.expected_outputs?.summary]) !==
        JSON.stringify(FLEETS[1].exactMutationFiles)) {
    throw new Error('fleet fixture seed identity is invalid');
  }
  const created = [];
  const modelInputs = ['project-brief.md', 'benchmark-observations.md', 'author-decisions.json'];
  for (const relative of modelInputs) {
    const source = path.join(fixtureRoot, relative);
    const destination = safeProjectPath(projectRoot, relative, 'model fixture input');
    makePrivateDirectory(path.dirname(destination));
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(destination, 0o600);
    if (sha256(fs.readFileSync(source)) !== sha256(fs.readFileSync(destination))) {
      throw new Error(`model fixture copy changed bytes: ${relative}`);
    }
    created.push(relative);
  }
  for (const copy of seed.copies || []) {
    const source = safeProjectPath(projectRoot, copy.source, 'fixture seed copy source');
    const destination = safeProjectPath(projectRoot, copy.destination, 'fixture seed copy destination');
    if (fs.existsSync(destination)) throw new Error(`refusing existing seed destination ${copy.destination}`);
    makePrivateDirectory(path.dirname(destination));
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(destination, 0o600);
    if (sha256(fs.readFileSync(source)) !== sha256(fs.readFileSync(destination))) {
      throw new Error(`fixture-derived copy changed bytes: ${copy.destination}`);
    }
    created.push(copy.destination);
  }
  const recordPaths = new Set();
  for (const record of seed.records || []) {
    if (!record || typeof record !== 'object' || Array.isArray(record) ||
        typeof record.value !== 'object' || record.value === null || Array.isArray(record.value)) {
      throw new Error('fleet fixture seed contains a malformed record');
    }
    if (recordPaths.has(record.path)) throw new Error(`duplicate fleet fixture record ${record.path}`);
    recordPaths.add(record.path);
    const destination = safeProjectPath(projectRoot, record.path, 'fleet fixture record');
    writeJsonPrivate(destination, record.value, true);
    created.push(record.path);
  }
  for (const forbidden of ['expected-invariants.json', 'fixture.json', 'manifest.json']) {
    if (fs.existsSync(path.join(projectRoot, forbidden))) throw new Error(`evaluator oracle leaked into project: ${forbidden}`);
  }
  const schema = validatePlanningPaths([projectRoot]);
  if (!schema.valid) throw new Error('seeded portable project records did not validate');
  const invariant = verifyPortableSeed(projectRoot, seed);
  if (!invariant.valid) throw new Error(`seeded portable project invariants failed: ${invariant.errors.join('; ')}`);

  const gitEnvironment = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_DATE: '2026-08-29T00:00:00Z',
    GIT_COMMITTER_DATE: '2026-08-29T00:00:00Z'
  };
  commandResult('git', ['init', '--quiet', '--initial-branch=fleet-control', '--template='], {
    cwd: projectRoot,
    env: gitEnvironment
  });
  const filePaths = Object.values(snapshotProject(projectRoot))
    .filter(entry => entry.kind === 'file').map(entry => entry.path).sort();
  commandResult('git', ['add', '--', ...filePaths], { cwd: projectRoot, env: gitEnvironment });
  commandResult('git', [
    '-c', 'user.name=WTF-P Evaluation Harness',
    '-c', 'user.email=eval.invalid@wtf-p.invalid',
    '-c', 'commit.gpgsign=false',
    'commit', '--quiet', '--message', 'test: initialize native fleet fixture'
  ], { cwd: projectRoot, env: gitEnvironment });
  return {
    seed,
    created: [...new Set(created)].sort(),
    schema,
    invariant,
    commit: commandResult('git', ['rev-parse', 'HEAD'], { cwd: projectRoot }).stdout.trim(),
    snapshot: snapshotProject(projectRoot),
    git_control: lifecycle.gitControlSnapshot(projectRoot)
  };
}

function verifyPortableSeed(projectRoot, seed = readJson(seedFile)) {
  const errors = [];
  const records = readPlanningRecords(projectRoot);
  const byType = new Map();
  for (const record of records) {
    if (!byType.has(record.type)) byType.set(record.type, []);
    byType.get(record.type).push(record);
  }
  for (const type of ['manifest', 'config', 'state', 'decisions', 'outline', 'section', 'source']) {
    if ((byType.get(type) || []).length !== 1) errors.push(`expected exactly one seeded ${type} record`);
  }
  if ((byType.get('evidence') || []).length !== 3) errors.push('expected exactly three seeded evidence records');
  const values = records.map(record => record.value);
  const projectIds = values.map(value => value.schema === 'wtfp.project.manifest/v1' ? value.id : value.project_id)
    .filter(Boolean);
  if (projectIds.some(id => id !== seed.project_id)) errors.push('seeded records have inconsistent project IDs');
  const manifest = byType.get('manifest')?.[0]?.value;
  const outline = byType.get('outline')?.[0]?.value;
  const state = byType.get('state')?.[0]?.value;
  const section = byType.get('section')?.[0]?.value;
  const decisions = byType.get('decisions')?.[0]?.value;
  if (manifest?.artifacts?.manifest !== 'project://manifest' || manifest?.artifacts?.config !== 'project://config' ||
      manifest?.artifacts?.state !== 'project://state' || manifest?.artifacts?.decisions !== 'project://decisions' ||
      manifest?.artifacts?.outline !== 'project://structure/outline') errors.push('manifest core URI index is inconsistent');
  const expectedMaterials = [
    'project://materials/project-brief.md', 'project://materials/benchmark-observations.md',
    'project://materials/author-decisions.json'
  ].sort();
  if (JSON.stringify([...(manifest?.artifacts?.materials || [])].sort()) !== JSON.stringify(expectedMaterials)) {
    errors.push('manifest model-input index is not exact');
  }
  const sections = outline?.sections || [];
  if (sections.length !== 6 || sections.reduce((sum, entry) => sum + entry.word_target, 0) !== outline?.target_words ||
      outline?.target_words !== 6000) errors.push('outline section count or word budget is incoherent');
  const evaluation = sections.find(entry => entry.id === 'evaluation');
  if (!evaluation || section?.id !== 'evaluation') errors.push('evaluation section is missing');
  for (const field of ['title', 'goal', 'word_target', 'wave']) {
    if (section?.[field] !== evaluation?.[field]) errors.push(`evaluation section ${field} differs from outline`);
  }
  if (JSON.stringify(section?.depends_on) !== JSON.stringify(evaluation?.depends_on) ||
      JSON.stringify((section?.claims || []).map(claim => claim.id)) !== JSON.stringify(evaluation?.claim_ids)) {
    errors.push('evaluation section dependencies or claims differ from outline');
  }
  if (state?.current_section_uri !== 'project://sections/evaluation' || state?.phase !== 'planning' ||
      state?.status !== 'active' || state?.progress?.sections_total !== 6 || state?.progress?.word_target !== 6000 ||
      state?.progress?.word_count !== 0) errors.push('portable state is not coherent at the planning boundary');
  const author = readJson(path.join(projectRoot, 'author-decisions.json')).items || [];
  const actualDecisions = new Map((decisions?.items || []).map(item => [item.id, item]));
  for (const expected of author) {
    const actual = actualDecisions.get(expected.id);
    if (!actual || actual.authority !== 'author' || actual.disposition !== expected.disposition ||
        actual.statement !== expected.statement) errors.push(`author decision changed: ${expected.id}`);
  }
  if (actualDecisions.size !== author.length) errors.push('seed added or omitted an author decision');
  const sourceUris = new Set((byType.get('source') || []).map(record => `project://sources/${record.value.id}`));
  const evidenceUris = new Set((byType.get('evidence') || []).map(record => `project://evidence/${record.value.id}`));
  for (const evidence of byType.get('evidence') || []) {
    if (!sourceUris.has(evidence.value.source_uri)) errors.push(`${evidence.path} has a missing source`);
  }
  for (const claim of section?.claims || []) {
    if ((claim.evidence_uris || []).some(uri => !evidenceUris.has(uri))) errors.push(`${claim.id} has missing evidence`);
  }
  for (const relative of [
    '.planning/sections/evaluation/context.md', '.planning/sections/evaluation/research.md'
  ]) {
    const file = path.join(projectRoot, relative);
    if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink() || !fs.lstatSync(file).isFile()) {
      errors.push(`seeded authored resource is missing: ${relative}`);
    }
  }
  return {
    schema: 'wtfp.evaluation.clio-fleet-seed-invariants/v1',
    valid: errors.length === 0,
    record_count: records.length,
    record_sha256: canonicalDigest(records.map(record => ({ path: record.path, sha256: record.sha256 }))),
    errors
  };
}

function expectedTopology(fleet) {
  return [
    {
      wave: 1,
      steps: [{
        id: fleet.mutatorStep, kind: 'agent', agent: fleet.mutator,
        scope: 'workspace', writes: [...fleet.writes], dependencies: []
      }]
    },
    {
      wave: 2,
      steps: [{
        id: fleet.verifierStep, kind: 'agent', agent: fleet.verifier,
        scope: 'readonly', writes: [], dependencies: [fleet.mutatorStep]
      }]
    }
  ];
}

function auditFleetGraph(fleet, validation, graph) {
  const errors = [];
  if (validation?.valid !== true || validation?.fleet !== fleet.name ||
      !/^[a-f0-9]{64}$/u.test(validation?.planHash || '')) errors.push('native fleet validation was not valid and hash-bound');
  if (graph?.fleet !== fleet.name || graph?.planHash !== validation?.planHash ||
      !Array.isArray(graph?.waves) || !Array.isArray(graph?.loops) || graph.loops.length !== 0) {
    errors.push('native fleet graph identity, hash, waves, or loops were invalid');
  }
  const expected = expectedTopology(fleet);
  if (JSON.stringify(graph?.waves) !== JSON.stringify(expected)) {
    errors.push('native fleet graph did not match the exact two-wave topology and write boundaries');
  }
  for (const wave of graph?.waves || []) {
    for (const step of wave.steps || []) {
      if (step.scope === 'readonly' && (step.writes || []).length !== 0) errors.push('readonly step declared a write boundary');
      if (step.scope === 'workspace' && (step.writes || []).some(entry => !entry.endsWith('/'))) {
        errors.push(`directory write boundary was written as a bare file: ${(step.writes || []).join(', ')}`);
      }
    }
  }
  return { valid: errors.length === 0, expected, validation_plan_hash: validation?.planHash || null, errors };
}

function auditNativeTopology(root) {
  const errors = [];
  const results = [];
  for (const fleet of FLEETS) {
    const stem = fleet.name === 'wtfp-plan-section' ? 'fleet-plan' : 'fleet-draft';
    let validation = null;
    let graph = null;
    try {
      validation = readJson(path.join(root, 'evidence', 'native', `${stem}-validate.stdout`));
      graph = readJson(path.join(root, 'evidence', 'native', `${stem}-graph.stdout`));
    } catch (error) {
      errors.push(`${fleet.name}: native topology output was not valid JSON`);
    }
    const audit = auditFleetGraph(fleet, validation, graph);
    errors.push(...audit.errors.map(error => `${fleet.name}: ${error}`));
    results.push({ fleet: fleet.name, ...audit });
  }
  return { valid: errors.length === 0, fleets: results, errors };
}

function profilePathList(settingsSource = null, credentialsSource = null, environment = process.env) {
  const home = os.homedir();
  const defaults = [
    path.join(home, '.config', 'clio-coder', 'settings.yaml'),
    path.join(home, '.config', 'clio-coder', 'credentials.yaml'),
    path.join(home, '.codex', 'config.toml'),
    path.join(home, '.codex', 'auth.json')
  ];
  const extras = (environment[PROFILE_PATHS_ENV] || '').split(path.delimiter)
    .filter(Boolean).map(file => path.resolve(file));
  return [...new Set([...defaults, ...extras, settingsSource, credentialsSource]
    .filter(Boolean).map(file => path.resolve(file)))].sort();
}

function initializeIsolatedDirectories(root, paths) {
  const directories = [path.join(root, 'evidence'), path.join(root, 'project')];
  for (const [key, value] of Object.entries(paths)) {
    if (key === 'HOME' || key === 'TMPDIR' || key.startsWith('XDG_') ||
        (key.startsWith('CLIO_CODER_') && key.endsWith('_DIR'))) directories.push(value);
  }
  for (const directory of new Set(directories)) {
    if (!isContained(root, directory)) throw new Error(`isolated directory escapes root: ${directory}`);
    makePrivateDirectory(directory);
  }
}

function stableStateDigest(root) {
  const surfaces = [path.join(root, 'clio', 'state'), path.join(root, 'clio', 'data')];
  return canonicalDigest(surfaces.map(surface => fs.existsSync(surface)
    ? { path: path.relative(root, surface), sha256: hashTree(surface, { rejectSymlinks: false }).sha256 }
    : { path: path.relative(root, surface), sha256: null }));
}

async function waitForStateQuiescence(root) {
  let previous = stableStateDigest(root);
  let stable = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 250));
    const current = stableStateDigest(root);
    if (current === previous) stable += 1;
    else stable = 0;
    previous = current;
    if (stable >= 2) return { quiesced: true, digest: current, waited_ms: (attempt + 1) * 250 };
  }
  return { quiesced: false, digest: previous, waited_ms: 3000 };
}

function bindPrivateRoot(root, label = 'bound root') {
  assertPrivateRoot(root, label);
  const stat = fs.lstatSync(root);
  return Object.freeze({
    path: path.resolve(root),
    realpath: fs.realpathSync(root),
    device: stat.dev,
    inode: stat.ino,
    mode: stat.mode & 0o777
  });
}

function validateBoundDirectory(binding, directory, label, requirePrivate = true) {
  const rootStat = fs.lstatSync(binding.path);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory() || rootStat.dev !== binding.device ||
      rootStat.ino !== binding.inode || fs.realpathSync(binding.path) !== binding.realpath ||
      (rootStat.mode & 0o777) !== binding.mode) throw new Error(`${label}: bound root identity changed`);
  const candidate = path.resolve(directory);
  if (!isContained(binding.path, candidate)) throw new Error(`${label}: directory escapes its bound root`);
  let cursor = binding.path;
  const rootReal = binding.realpath;
  for (const segment of path.relative(binding.path, candidate).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink() || !stat.isDirectory() || (requirePrivate && (stat.mode & 0o077) !== 0)) {
      throw new Error(`${label}: ancestor changed type, linkage, or privacy: ${cursor}`);
    }
    const resolved = fs.realpathSync(cursor);
    if (!isContained(rootReal, resolved)) throw new Error(`${label}: ancestor resolves outside bound root`);
  }
  return candidate;
}

function lstatIfPresent(file) {
  try { return fs.lstatSync(file); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function readBoundFile(binding, file, label, options = {}) {
  const maximumBytes = options.maximumBytes ?? MAX_EVIDENCE_BYTES;
  const expectedMode = options.expectedMode ?? null;
  const parent = path.dirname(path.resolve(file));
  validateBoundDirectory(binding, parent, `${label} parent`, options.privateAncestors !== false);
  let descriptor;
  try {
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  } catch (error) {
    throw new Error(`${label}: safe open failed (${error.message})`);
  }
  try {
    const opened = fs.fstatSync(descriptor);
    validateBoundDirectory(binding, parent, `${label} parent`, options.privateAncestors !== false);
    const linked = lstatIfPresent(file);
    validateBoundDirectory(binding, parent, `${label} parent`, options.privateAncestors !== false);
    if (!linked || linked.isSymbolicLink() || !linked.isFile() || !opened.isFile() ||
        linked.dev !== opened.dev || linked.ino !== opened.ino || linked.nlink !== 1 || opened.nlink !== 1) {
      throw new Error(`${label}: pathname and descriptor identity do not name one singly linked regular file`);
    }
    if (expectedMode !== null && ((opened.mode & 0o777) !== expectedMode || (linked.mode & 0o777) !== expectedMode)) {
      throw new Error(`${label}: mode is not ${expectedMode.toString(8).padStart(4, '0')}`);
    }
    if (opened.size > maximumBytes) throw new Error(`${label}: ${opened.size} bytes exceeds ${maximumBytes}`);
    const bytes = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count === 0) throw new Error(`${label}: file ended during bounded read`);
      offset += count;
    }
    const finalDescriptor = fs.fstatSync(descriptor);
    validateBoundDirectory(binding, parent, `${label} parent`, options.privateAncestors !== false);
    const finalLinked = lstatIfPresent(file);
    validateBoundDirectory(binding, parent, `${label} parent`, options.privateAncestors !== false);
    if (!finalLinked || finalLinked.isSymbolicLink() || !finalLinked.isFile() ||
        finalDescriptor.dev !== opened.dev || finalDescriptor.ino !== opened.ino ||
        finalLinked.dev !== opened.dev || finalLinked.ino !== opened.ino ||
        finalDescriptor.size !== opened.size || finalDescriptor.nlink !== 1 || finalLinked.nlink !== 1 ||
        (expectedMode !== null && ((finalDescriptor.mode & 0o777) !== expectedMode ||
          (finalLinked.mode & 0o777) !== expectedMode))) throw new Error(`${label}: file changed during bounded read`);
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

function walkBoundFiles(binding, directory, label, relative = '') {
  validateBoundDirectory(binding, path.join(directory, relative), label, true);
  const output = [];
  for (const name of fs.readdirSync(path.join(directory, relative)).sort()) {
    const childRelative = path.join(relative, name);
    const absolute = path.join(directory, childRelative);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`${label}: symbolic link refused at ${absolute}`);
    if (stat.isDirectory()) output.push(...walkBoundFiles(binding, directory, label, childRelative));
    else if (stat.isFile()) output.push({ absolute, relative: childRelative.split(path.sep).join('/'), stat });
    else throw new Error(`${label}: non-file entry refused at ${absolute}`);
  }
  return output;
}

function readExternalSource(file, label, options = {}) {
  const absolute = path.resolve(file);
  const parent = path.dirname(absolute);
  const parentStat = fs.lstatSync(parent);
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) throw new Error(`${label} parent must be a directory`);
  let descriptor;
  try {
    descriptor = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  } catch (error) {
    throw new Error(`${label} cannot be opened without following links: ${error.message}`);
  }
  try {
    const opened = fs.fstatSync(descriptor);
    const linked = fs.lstatSync(absolute);
    if (linked.isSymbolicLink() || !linked.isFile() || !opened.isFile() || opened.dev !== linked.dev ||
        opened.ino !== linked.ino || opened.nlink !== 1 || linked.nlink !== 1) {
      throw new Error(`${label} must be a singly linked regular non-symlink file`);
    }
    if (options.private === true && (opened.mode & 0o077) !== 0) {
      throw new Error(`${label} must not grant group or other permissions`);
    }
    if (opened.size > MAX_SOURCE_BYTES) throw new Error(`${label} exceeds ${MAX_SOURCE_BYTES} bytes`);
    const bytes = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count === 0) throw new Error(`${label} ended during bounded read`);
      offset += count;
    }
    const final = fs.fstatSync(descriptor);
    const finalLinked = fs.lstatSync(absolute);
    if (final.dev !== opened.dev || final.ino !== opened.ino || final.size !== opened.size || final.nlink !== 1 ||
        finalLinked.isSymbolicLink() || !finalLinked.isFile() || finalLinked.dev !== opened.dev ||
        finalLinked.ino !== opened.ino || finalLinked.nlink !== 1) throw new Error(`${label} changed during bounded read`);
    return { path: absolute, bytes, sha256: sha256(bytes), size: bytes.length, mode: opened.mode & 0o777 };
  } finally {
    fs.closeSync(descriptor);
  }
}

function prepare(options, sources, environment = process.env) {
  const root = createRoot(options.root);
  const rootBinding = bindPrivateRoot(root);
  const paths = lifecycle.isolatedPaths(root, options.clioSource, 'S1');
  initializeIsolatedDirectories(root, paths);
  const fixture = initializeSeedProject(path.join(root, 'project'));
  const plan = buildPlan(options, sources, root);
  const planFile = path.join(root, 'evidence', 'fleet-plan.json');
  writeJsonPrivate(planFile, plan, true);

  const settings = lifecycle.minimalEvaluationSettings(options);
  const settingsFile = path.join(paths.CLIO_CODER_CONFIG_DIR, 'settings.yaml');
  writeJsonPrivate(settingsFile, settings, true);
  const settingsSha256 = sha256(fs.readFileSync(settingsFile));
  const normalPaths = profilePathList(null, null, environment);
  const profilesBefore = lifecycle.snapshotProfiles(normalPaths);
  writeJsonPrivate(path.join(root, 'evidence', 'normal-profiles-prepare-pre.json'), profilesBefore, true);

  const childEnvironment = lifecycle.sanitizedChildEnv(paths);
  const native = lifecycle.runNativePreflight(options, root, childEnvironment);
  const topology = auditNativeTopology(root);
  const credentialFile = path.join(paths.CLIO_CODER_CONFIG_DIR, 'credentials.yaml');
  const credentialObserved = pathEntryExists(credentialFile);
  const credentialCleanup = lifecycle.cleanupCredentialArtifactsSafe(
    paths.CLIO_CODER_CONFIG_DIR,
    credentialFile,
    root
  );
  const projectAfter = snapshotProject(path.join(root, 'project'));
  const projectMutations = diffSnapshots(fixture.snapshot, projectAfter);
  const gitAfter = lifecycle.gitControlSnapshot(path.join(root, 'project'));
  const profilesAfter = lifecycle.snapshotProfiles(normalPaths);
  writeJsonPrivate(path.join(root, 'evidence', 'normal-profiles-prepare-post.json'), profilesAfter, true);
  const receipts = lifecycle.collectReceipts(root);
  let installedHash = null;
  let settingsAfter = null;
  try {
    installedHash = hashTree(path.join(paths.CLIO_CODER_CONFIG_DIR, 'extensions', 'wtfp')).sha256;
    settingsAfter = lifecycle.containedPrivateFileSha256(
      root, paths.CLIO_CODER_CONFIG_DIR, settingsFile, 'sealed fleet settings'
    );
  } catch (error) {
    native.errors.push(`prepared isolated artifact containment failed: ${error.message}`);
  }
  if (!topology.valid) native.errors.push(...topology.errors);
  if (projectMutations.length > 0) native.errors.push('credential-free native preflight mutated the fleet fixture');
  if (!lifecycle.gitControlEqual(fixture.git_control, gitAfter)) native.errors.push('native preflight changed fixture Git control');
  if (!lifecycle.profilesEqual(profilesBefore, profilesAfter)) native.errors.push('native preflight changed a normal profile');
  if (credentialCleanup.status !== 'securely-removed' || credentialCleanup.absent !== true || pathEntryExists(credentialFile)) {
    native.errors.push('native preflight credential placeholder cleanup failed');
  }
  if (receipts.receipts.length !== 0) native.errors.push('credential-free native preflight produced a paid receipt');
  if (installedHash !== sources.wtfp.extension_sha256) native.errors.push('installed extension differs from exact generated source');
  if (settingsAfter !== settingsSha256) native.errors.push('native preflight changed sealed minimal settings');
  native.topology = topology;
  native.project_mutations = projectMutations;
  native.git_control = { before: fixture.git_control, after: gitAfter, unchanged: lifecycle.gitControlEqual(fixture.git_control, gitAfter) };
  native.normal_profiles = { before: profilesBefore, after: profilesAfter, unchanged: lifecycle.profilesEqual(profilesBefore, profilesAfter) };
  native.credential_artifacts = { forwarded: false, observed: credentialObserved, cleanup: credentialCleanup };
  native.receipts = { count: receipts.receipts.length, cost: receipts.cost };
  native.installed_extension_sha256 = installedHash;
  native.valid = native.errors.length === 0;
  const nativeFile = path.join(root, 'evidence', 'fleet-native-preflight.json');
  writeJsonPrivate(nativeFile, native, true);

  const directoryBindings = Object.fromEntries([
    ['config', paths.CLIO_CODER_CONFIG_DIR], ['data', paths.CLIO_CODER_DATA_DIR],
    ['state', paths.CLIO_CODER_STATE_DIR], ['cache', paths.CLIO_CODER_CACHE_DIR]
  ].map(([key, directory]) => {
    const stat = fs.lstatSync(directory);
    return [key, { path: directory, realpath: fs.realpathSync(directory), device: stat.dev, inode: stat.ino, mode: stat.mode & 0o777 }];
  }));
  const prepared = {
    schema: PREPARED_SCHEMA,
    created_at: new Date().toISOString(),
    root,
    root_identity: rootBinding,
    directory_bindings: directoryBindings,
    plan_sha256: canonicalDigest(plan),
    source: sources,
    source_sha256: canonicalDigest(sources),
    fixture: {
      commit: fixture.commit,
      project_snapshot_sha256: canonicalDigest(fixture.snapshot),
      record_sha256: fixture.invariant.record_sha256,
      schema_checked: fixture.schema.checked,
      schema_valid: fixture.schema.valid,
      git_control: fixture.git_control
    },
    settings_sha256: settingsSha256,
    settings_policy_sha256: canonicalDigest(settings),
    installed_extension_sha256: installedHash,
    native_preflight_sha256: sha256(fs.readFileSync(nativeFile)),
    native_preflight_valid: native.valid,
    native_preflight_errors: native.errors,
    normal_profiles: native.normal_profiles,
    credentials_forwarded: false,
    paid_model_calls: 0,
    paid_execution_ready: native.valid
  };
  writeJsonPrivate(path.join(root, 'evidence', PREPARED_FILE), prepared, true);
  return { root, prepared, plan, native };
}

function sameDirectoryIdentity(expected) {
  const stat = fs.lstatSync(expected.path);
  return !stat.isSymbolicLink() && stat.isDirectory() && stat.dev === expected.device && stat.ino === expected.inode &&
    (stat.mode & 0o777) === expected.mode && fs.realpathSync(expected.path) === expected.realpath;
}

function verifyPrepared(options, sources) {
  const root = options.root;
  assertPrivateRoot(root, 'prepared fleet root');
  const preparedFile = path.join(root, 'evidence', PREPARED_FILE);
  const planFile = path.join(root, 'evidence', 'fleet-plan.json');
  const nativeFile = path.join(root, 'evidence', 'fleet-native-preflight.json');
  for (const [file, label] of [[preparedFile, 'prepared seal'], [planFile, 'fleet plan'], [nativeFile, 'native preflight']]) {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label} changed type`);
  }
  const prepared = readJson(preparedFile);
  const plan = readJson(planFile);
  if (prepared.schema !== PREPARED_SCHEMA || prepared.root !== root || plan.root !== root ||
      prepared.native_preflight_valid !== true || prepared.paid_execution_ready !== true || prepared.paid_model_calls !== 0) {
    throw new Error('prepared fleet seal is not execution-ready');
  }
  const rootBinding = bindPrivateRoot(root, 'prepared fleet root');
  for (const field of ['device', 'inode', 'realpath', 'mode']) {
    if (rootBinding[field] !== prepared.root_identity[field]) throw new Error(`prepared root ${field} changed`);
  }
  for (const binding of Object.values(prepared.directory_bindings || {})) {
    if (!sameDirectoryIdentity(binding)) throw new Error(`prepared isolated directory changed identity: ${binding.path}`);
  }
  if (prepared.plan_sha256 !== canonicalDigest(plan) || prepared.source_sha256 !== canonicalDigest(sources) ||
      canonicalDigest(prepared.source) !== canonicalDigest(sources)) throw new Error('prepared plan or source digest changed');
  if (sha256(fs.readFileSync(nativeFile)) !== prepared.native_preflight_sha256) {
    throw new Error('native preflight evidence changed after preparation');
  }
  const optionChecks = [
    ['binary', options.binary, plan.client.binary], ['Clio source', options.clioSource, plan.client.source],
    ['extension', options.extension, plan.extension.source], ['budget', options.budgetUsd, plan.requested.maximum_cost_usd],
    ['timeout', options.timeoutMinutes, plan.requested.timeout_minutes_per_fleet]
  ];
  for (const [label, actual, expected] of optionChecks) if (actual !== expected) throw new Error(`${label} differs from prepared plan`);
  if (hashTree(path.join(root, 'clio', 'config', 'extensions', 'wtfp')).sha256 !== prepared.installed_extension_sha256 ||
      prepared.installed_extension_sha256 !== sources.wtfp.extension_sha256) throw new Error('installed extension changed');
  const settingsFile = path.join(root, 'clio', 'config', 'settings.yaml');
  if (lifecycle.containedPrivateFileSha256(root, path.join(root, 'clio', 'config'), settingsFile, 'fleet settings') !==
      prepared.settings_sha256 || canonicalDigest(lifecycle.minimalEvaluationSettings(options)) !== prepared.settings_policy_sha256) {
    throw new Error('sealed minimal settings changed');
  }
  const projectRoot = path.join(root, 'project');
  if (canonicalDigest(snapshotProject(projectRoot)) !== prepared.fixture.project_snapshot_sha256 ||
      !lifecycle.gitControlEqual(prepared.fixture.git_control, lifecycle.gitControlSnapshot(projectRoot))) {
    throw new Error('prepared fixture or Git control changed before execution');
  }
  const schema = validatePlanningPaths([projectRoot]);
  const invariant = verifyPortableSeed(projectRoot);
  if (!schema.valid || !invariant.valid || invariant.record_sha256 !== prepared.fixture.record_sha256) {
    throw new Error('prepared portable records changed before execution');
  }
  if (pathEntryExists(path.join(root, 'clio', 'config', 'credentials.yaml'))) {
    throw new Error('credentials existed before authorized execute-time forwarding');
  }
  if (lifecycle.collectReceipts(root).receipts.length !== 0) throw new Error('prepared root already contains receipts');
  if (fs.existsSync(path.join(root, 'evidence', 'fleet-execution-started.json'))) {
    throw new Error('prepared fleet root has already started execution');
  }
  return { prepared, plan, rootBinding };
}

function parseFleetStream(text, fleetName) {
  const entries = [];
  const errors = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try { entries.push(JSON.parse(line)); }
    catch { errors.push(`line ${index + 1} was not JSON`); }
  }
  const summaries = entries.filter(entry => entry?.fleet === fleetName && typeof entry.rootId === 'string' &&
    typeof entry.planHash === 'string' && Array.isArray(entry.writeBoundaries));
  const receipts = entries.filter(entry => typeof entry?.runId === 'string' && typeof entry?.agentId === 'string');
  if (summaries.length !== 1) errors.push(`expected exactly one ${fleetName} summary, observed ${summaries.length}`);
  if (receipts.length !== 2) errors.push(`expected exactly two stdout receipts, observed ${receipts.length}`);
  if (entries.length !== receipts.length + summaries.length) errors.push('stdout contained an unrecognized JSON record');
  const summary = summaries[0] || null;
  if (summary) {
    if (!/^[a-f0-9]{64}$/u.test(summary.planHash)) errors.push('fleet summary planHash is malformed');
    for (const field of ['loops', 'revalidated', 'unneeded', 'skipped', 'needsDecision']) {
      if (!Array.isArray(summary[field]) || summary[field].length !== 0) errors.push(`fleet summary ${field} was not empty`);
    }
    if (summary.writeBoundaries.length !== 2 || summary.writeBoundaries.some(boundary =>
      boundary?.violated !== false || !Array.isArray(boundary.failedStepIds) || boundary.failedStepIds.length !== 0 ||
      boundary.detail !== null)) errors.push('fleet summary reported a boundary violation or incomplete two-wave audit');
  }
  return { valid: errors.length === 0, entries: entries.length, receipts, summary, errors };
}

function parseFinalObject(text) {
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
    } catch { /* try the next bounded representation */ }
  }
  return null;
}

function parseChecks(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const output = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(['evidence', 'name', 'passed']) ||
        typeof entry.name !== 'string' || !entry.name.trim() || typeof entry.passed !== 'boolean' ||
        typeof entry.evidence !== 'string' || !entry.evidence.trim()) return null;
    output.push({ name: entry.name, passed: entry.passed, evidence: entry.evidence });
  }
  return output;
}

function auditStructuredResult(receipt, expectedKind, changedFiles = []) {
  const errors = [];
  const output = receipt.output;
  if (!output || output.state !== 'final' || output.truncated !== false || output.bytes !== output.captured_bytes ||
      !Number.isSafeInteger(output.bytes) || output.bytes < 1 || typeof receipt.output_text !== 'string' ||
      Buffer.byteLength(receipt.output_text, 'utf8') !== output.bytes ||
      output.sha256 !== sha256(Buffer.from(receipt.output_text, 'utf8'))) {
    errors.push('receipt lacks one complete, untruncated, hash-bound final output');
  }
  const fact = receipt.result_contract;
  if (!fact || fact.conformance !== 'pass' || fact.quality === 'fail' ||
      !['pass', 'unmeasured'].includes(fact.quality) ||
      !new RegExp(`^agent-result-contract:${expectedKind}:[a-f0-9]{64}$`, 'u').test(fact.sourceId || '') ||
      !/^[a-f0-9]{64}$/u.test(fact.validatorDigest || '')) {
    errors.push('sealed result-contract fact is missing, mismatched, or failed');
  }
  const value = parseFinalObject(receipt.output_text);
  if (!value) errors.push('final output did not contain one JSON object');
  let result = null;
  if (value && expectedKind === 'verifier-report') {
    const checks = parseChecks(value.checks);
    if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(['checks', 'verdict']) ||
        !['pass', 'fail'].includes(value.verdict) || !checks || (value.verdict === 'pass') !== checks.every(check => check.passed)) {
      errors.push('final output did not match the exact verifier-report contract');
    } else {
      result = { kind: expectedKind, verdict: value.verdict, check_count: checks.length, checks_sha256: canonicalDigest(checks) };
      if (value.verdict !== 'pass') errors.push('required independent verifier verdict was not pass');
      if (fact?.quality !== value.verdict && !(value.verdict === 'pass' && fact?.quality === 'unmeasured')) {
        errors.push('sealed result quality contradicts verifier verdict');
      }
    }
  } else if (value && expectedKind === 'mutation-report') {
    const allowedKeys = new Set(['mutatedPaths', 'validations', 'commitMessage', 'summary']);
    const checks = parseChecks(value.validations);
    if (Object.keys(value).some(key => !allowedKeys.has(key)) || !Array.isArray(value.mutatedPaths) ||
        value.mutatedPaths.length === 0 || value.mutatedPaths.some(item => typeof item !== 'string' || !item.trim()) ||
        new Set(value.mutatedPaths).size !== value.mutatedPaths.length || !checks ||
        checks.some(check => !check.passed) ||
        ['commitMessage', 'summary'].some(key => value[key] !== undefined && value[key] !== null && typeof value[key] !== 'string')) {
      errors.push('final output did not match the exact nonempty mutation-report contract');
    } else {
      const normalized = value.mutatedPaths.map(item => item.replace(/^\.\//u, '')).sort();
      const expected = [...changedFiles].sort();
      if (JSON.stringify(normalized) !== JSON.stringify(expected)) {
        errors.push(`reported mutation paths ${normalized.join(', ')} != observed files ${expected.join(', ')}`);
      }
      result = {
        kind: expectedKind,
        mutated_paths: normalized,
        validation_count: checks.length,
        validations_sha256: canonicalDigest(checks)
      };
    }
  }
  return { valid: errors.length === 0, sealed_quality: fact?.quality || null, result, errors };
}

function auditFleetMutation(fleet, before, after) {
  const changes = diffSnapshots(before, after);
  const errors = [];
  const changedFiles = [];
  for (const change of changes) {
    if (change.change === 'deleted') errors.push(`deleted project path ${change.path}`);
    if (change.after?.kind === 'symlink') errors.push(`created symbolic link ${change.path}`);
    const directory = change.before?.kind === 'directory' || change.after?.kind === 'directory';
    if (directory) {
      if (change.change !== 'created' || !fleet.allowedDirectories.some(pattern => pattern.test(change.path))) {
        errors.push(`undeclared directory mutation ${change.change} ${change.path}`);
      }
    } else {
      changedFiles.push(change.path);
      if (!fleet.allowedFiles.some(pattern => pattern.test(change.path))) {
        errors.push(`undeclared file mutation ${change.change} ${change.path}`);
      }
    }
  }
  for (const required of fleet.required) {
    if (!changedFiles.some(relative => required.test(relative))) errors.push(`required output was not created: ${required}`);
  }
  return { valid: errors.length === 0, changes, changed_files: changedFiles.sort(), errors };
}

function auditFleetToolActivity(fleet, root, projectRoot, offsets) {
  const incremental = lifecycle.auditEventsSince(root, offsets);
  const observed = lifecycle.eventToolAudit(incremental.events, {
    project: projectRoot,
    extension: path.join(root, 'clio', 'config', 'extensions', 'wtfp'),
    additional: []
  });
  const errors = [...incremental.errors, ...observed.errors];
  const exact = new Set(fleet.exactMutationFiles);
  if (observed.file_mutations.length === 0) {
    errors.push(`${fleet.name}: no mutation-capable tool call was observable`);
  }
  for (const mutation of observed.file_mutations) {
    if (mutation.paths.length === 0) {
      errors.push(`${fleet.name}: ${mutation.tool} mutation target was not observable`);
      continue;
    }
    for (const absolute of mutation.paths) {
      if (!isContained(projectRoot, absolute)) {
        errors.push(`${fleet.name}: ${mutation.tool} targeted a non-project path`);
        continue;
      }
      const relative = path.relative(projectRoot, absolute).split(path.sep).join('/');
      if (!exact.has(relative)) {
        errors.push(`${fleet.name}: ${mutation.tool} targeted undeclared exact path ${relative}`);
      }
    }
  }
  return {
    valid: errors.length === 0,
    offsets_sha256: canonicalDigest(offsets),
    event_count: incremental.events.length,
    call_count: observed.call_count,
    tools: observed.tools,
    exact_allowed_files: [...fleet.exactMutationFiles],
    file_mutations: observed.file_mutations,
    dispatch: observed.dispatch,
    errors
  };
}

function verdictDigest(verdict) {
  const body = {};
  for (const [key, value] of Object.entries(verdict)) if (key !== 'digest') body[key] = value;
  return sha256(Buffer.from(JSON.stringify(body), 'utf8'));
}

function auditWriteBoundaries(stateBinding, stateRoot, fleet, summary) {
  const errors = [];
  const rootId = summary?.rootId;
  if (typeof rootId !== 'string' || !/^[A-Za-z0-9._-]+$/u.test(rootId)) {
    return { valid: false, root_id: rootId || null, verdicts: [], errors: ['fleet rootId is missing or unsafe'] };
  }
  const directory = path.join(stateRoot, 'write-boundaries', rootId);
  try { validateBoundDirectory(stateBinding, directory, 'write-boundary verdict root', true); }
  catch (error) { return { valid: false, root_id: rootId, verdicts: [], errors: [error.message] }; }
  const entries = walkBoundFiles(stateBinding, directory, 'write-boundary verdict root');
  if (entries.length !== 2) errors.push(`expected two durable boundary verdicts, observed ${entries.length}`);
  const expected = new Map([
    ['wave-1', { stepIds: [fleet.mutatorStep], allow: [...fleet.writes] }],
    ['wave-2', { stepIds: [fleet.verifierStep], allow: [] }]
  ]);
  const verdicts = [];
  for (const entry of entries) {
    let value = null;
    try { value = JSON.parse(readBoundFile(stateBinding, entry.absolute, 'write-boundary verdict').toString('utf8')); }
    catch (error) { errors.push(`${entry.relative}: invalid verdict (${error.message})`); continue; }
    const wanted = expected.get(value.window);
    if (!wanted) errors.push(`${entry.relative}: unexpected window ${value.window}`);
    if (value.version !== 1 || value.digest !== verdictDigest(value) || !/^[a-f0-9]{40}$/u.test(value.baselineHead || '') ||
        value.status !== 'clean' || value.reason !== null || value.detail !== null ||
        !Array.isArray(value.changedPaths) || !Array.isArray(value.violations) || value.violations.length !== 0 ||
        !Array.isArray(value.unattributed) || value.unattributed.length !== 0 ||
        !Array.isArray(value.rolledBack) || value.rolledBack.length !== 0 ||
        !Array.isArray(value.unrecoverable) || value.unrecoverable.length !== 0 ||
        value.attributionComplete !== true) errors.push(`${entry.relative}: verdict was not one sealed clean complete-attribution result`);
    if (wanted && (JSON.stringify(value.stepIds) !== JSON.stringify(wanted.stepIds) ||
      JSON.stringify(value.allow) !== JSON.stringify(wanted.allow))) errors.push(`${entry.relative}: step IDs or allowlist differ from contract`);
    verdicts.push({
      path: path.relative(stateRoot, entry.absolute).split(path.sep).join('/'),
      sha256: sha256(readBoundFile(stateBinding, entry.absolute, 'write-boundary verdict')),
      window: value.window,
      allow: value.allow,
      changed_paths: value.changedPaths,
      status: value.status,
      digest: value.digest
    });
  }
  const summaryWindows = new Map((summary?.writeBoundaries || []).map(item => [item.window, item]));
  for (const window of expected.keys()) {
    const projected = summaryWindows.get(window);
    if (!projected || projected.violated !== false || projected.detail !== null ||
        !Array.isArray(projected.failedStepIds) || projected.failedStepIds.length !== 0) {
      errors.push(`stdout summary did not preserve clean ${window} verdict`);
    }
  }
  return { valid: errors.length === 0, root_id: rootId, verdicts, errors };
}

function auditFleetLedger(stateBinding, stateRoot, fleet, summary, receiptAudit) {
  const errors = [];
  const file = path.join(stateRoot, 'fleet-runs', `${summary?.rootId}.json`);
  let value = null;
  let digest = null;
  try {
    const bytes = readBoundFile(stateBinding, file, 'fleet ledger');
    digest = sha256(bytes);
    value = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    errors.push(`fleet ledger unreadable: ${error.message}`);
    return { valid: false, path: null, sha256: null, errors };
  }
  const stepIds = [fleet.mutatorStep, fleet.verifierStep];
  if (value.version !== 1 || value.id !== summary.rootId || value.fleet !== fleet.name ||
      value.planHash !== summary.planHash || JSON.stringify(value.stepIds) !== JSON.stringify(stepIds) ||
      JSON.stringify(value.vars) !== JSON.stringify({ section: 'evaluation' }) || value.resumedFrom !== null ||
      !value.startedAt || !value.endedAt || Date.parse(value.startedAt) > Date.parse(value.endedAt) ||
      !Array.isArray(value.steps) || value.steps.length !== 2 ||
      JSON.stringify(value.steps.map(step => step.stepId)) !== JSON.stringify(stepIds)) {
    errors.push('fleet ledger identity, variables, chronology, or step topology is invalid');
  }
  const runIds = new Set(receiptAudit.receipts.map(receipt => receipt.run_id));
  for (const step of value.steps || []) {
    if (!runIds.has(step.result?.terminalRunId) || step.result?.succeeded !== true ||
        step.result?.integrityValid !== true || step.result?.boundaryViolated === true || step.result?.failureReason) {
      errors.push(`fleet ledger step ${step.stepId || 'unknown'} is not one successful integrity-valid bounded receipt`);
    }
  }
  return {
    valid: errors.length === 0,
    path: path.relative(stateRoot, file).split(path.sep).join('/'),
    sha256: digest,
    started_at: value.startedAt,
    ended_at: value.endedAt,
    steps: (value.steps || []).map(step => ({ step_id: step.stepId, run_id: step.result?.terminalRunId || null })),
    errors
  };
}

function receiptRaw(stateBinding, root, receipt) {
  const file = path.join(root, receipt.path);
  return JSON.parse(readBoundFile(stateBinding, file, `receipt ${receipt.id}`).toString('utf8'));
}

function auditFleetReceipts({ fleet, stream, delta, changedFiles, stateBinding, root }) {
  const errors = [...(delta.errors || [])];
  const expectedAgents = [fleet.mutator, fleet.verifier];
  const byAgent = new Map();
  const structured = [];
  if (delta.receipts.length !== 2) errors.push(`expected exactly two new receipts, observed ${delta.receipts.length}`);
  for (const receipt of delta.receipts) {
    if (byAgent.has(receipt.agent_id)) errors.push(`duplicate receipt agent ${receipt.agent_id}`);
    byAgent.set(receipt.agent_id, receipt);
  }
  const streamById = new Map(stream.receipts.map(receipt => [receipt.runId, receipt]));
  if (streamById.size !== stream.receipts.length) errors.push('stdout repeated a receipt runId');
  const summary = stream.summary;
  for (const [index, agent] of expectedAgents.entries()) {
    const receipt = byAgent.get(agent);
    if (!receipt) { errors.push(`missing receipt for ${agent}`); continue; }
    let raw = null;
    try { raw = receiptRaw(stateBinding, root, receipt); }
    catch (error) { errors.push(`${agent}: safe receipt read failed (${error.message})`); }
    const projected = streamById.get(receipt.run_id);
    if (!projected || canonicalDigest(projected) !== canonicalDigest(raw)) {
      errors.push(`${agent}: stdout receipt does not equal its durable receipt`);
    }
    if (receipt.request_origin !== 'user' || receipt.outcome !== 'succeeded' || receipt.exit_code !== 0 ||
        receipt.integrity_verification?.valid !== true || receipt.target !== TARGET || receipt.model !== MODEL ||
        receipt.runtime_id !== 'openai-codex' || receipt.runtime_kind !== 'http' || receipt.client_version !== '0.3.8') {
      errors.push(`${agent}: receipt identity, outcome, integrity, target, model, runtime, or client version is wrong`);
    }
    if (receipt.node?.id !== 'local' || receipt.node?.kind !== 'local' ||
        receipt.lineage?.rootRunId !== summary?.rootId || receipt.lineage?.parentRunId !== summary?.rootId ||
        receipt.lineage?.attempt !== 0 || receipt.lineage?.depth !== 1) {
      errors.push(`${agent}: receipt node or fleet lineage is wrong`);
    }
    if (receipt.runtime?.target !== TARGET || receipt.runtime?.model !== MODEL ||
        receipt.runtime?.requested_effort !== EFFORT || receipt.runtime?.effective_effort !== EFFORT ||
        receipt.runtime?.auth !== 'oauth' || receipt.runtime?.auth_required !== true ||
        receipt.runtime?.runtime_id !== 'openai-codex' || receipt.runtime?.runtime_kind !== 'http' ||
        receipt.runtime?.api_family !== 'openai-codex-responses' || receipt.runtime?.runtime_tier !== 'cloud' ||
        !Array.isArray(receipt.runtime?.diagnostics) || receipt.runtime.diagnostics.some(item => item?.severity === 'error')) {
      errors.push(`${agent}: sealed runtime resolution differs from the prepared exact policy`);
    }
    const expectedAutonomy = index === 0 ? 'auto-edit' : 'read-only';
    if (receipt.autonomy?.autonomy !== expectedAutonomy) errors.push(`${agent}: autonomy is not ${expectedAutonomy}`);
    if (typeof receipt.task_text !== 'string' || !receipt.task_text.includes('evaluation') ||
        receipt.task_text.includes('{{section}}') || receipt.task_bytes !== Buffer.byteLength(receipt.task_text || '', 'utf8') ||
        receipt.task_sha256 !== sha256(Buffer.from(receipt.task_text || '', 'utf8'))) {
      errors.push(`${agent}: exact section variable was not rendered into the sealed task`);
    }
    for (const field of ['compiled_prompt_hash', 'static_composition_hash', 'prompt_signature', 'tool_signature']) {
      if (!/^[a-f0-9]{64}$/u.test(receipt[field] || '')) errors.push(`${agent}: ${field} is missing or malformed`);
    }
    const forbidden = (receipt.tool_stats || []).map(item => item.tool)
      .filter(name => lifecycle.isForbiddenToolName(name));
    if (forbidden.length > 0) errors.push(`${agent}: forbidden tools appear in receipt: ${forbidden.join(', ')}`);
    const contract = auditStructuredResult(receipt, index === 0 ? 'mutation-report' : 'verifier-report',
      index === 0 ? changedFiles : []);
    structured.push({ agent, ...contract });
    errors.push(...contract.errors.map(error => `${agent}: ${error}`));
  }
  const ordered = expectedAgents.map(agent => byAgent.get(agent)).filter(Boolean);
  for (let index = 1; index < ordered.length; index += 1) {
    if (Date.parse(ordered[index - 1].ended_at) > Date.parse(ordered[index].started_at)) {
      errors.push(`${expectedAgents[index - 1]} did not finish before ${expectedAgents[index]} started`);
    }
  }
  const expectedRunIds = new Set(delta.receipts.map(receipt => receipt.run_id));
  if ([...streamById.keys()].some(id => !expectedRunIds.has(id))) errors.push('stdout contained a receipt outside the durable delta');
  return {
    valid: errors.length === 0,
    receipts: delta.receipts,
    cost: delta.cost,
    verifier: delta.verifier,
    structured_results: structured,
    errors
  };
}

function countWords(text) {
  return (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/gu) || []).length;
}

function auditArtifactInvariants(projectRoot, fleet) {
  const errors = [];
  const evidence = [];
  if (fleet.name === 'wtfp-plan-section') {
    const directory = path.join(projectRoot, '.planning', 'sections', 'evaluation', 'plans');
    const files = fs.existsSync(directory) ? walkFiles(directory).filter(entry => entry.path.endsWith('.md')) : [];
    const combined = files.map(entry => fs.readFileSync(entry.absolute, 'utf8')).join('\n');
    for (const required of ['41.2', '27.8', '128', 'eight', 'synthetic']) {
      if (!combined.toLowerCase().includes(required.toLowerCase())) errors.push(`plan omitted required closed-world marker ${required}`);
    }
    if (!/(?:variance|uncertainty|confidence interval)/iu.test(combined)) errors.push('plan omitted unavailable uncertainty boundary');
    if (!/(?:universal|production|significance|generaliz)/iu.test(combined)) errors.push('plan omitted forbidden-generalization boundary');
    evidence.push(...files.map(entry => ({ path: path.relative(projectRoot, entry.absolute), sha256: sha256(fs.readFileSync(entry.absolute)) })));
  } else {
    const manuscript = path.join(projectRoot, 'paper', 'evaluation.md');
    const summary = path.join(projectRoot, '.planning', 'sections', 'evaluation', 'summary.md');
    for (const file of [manuscript, summary]) {
      if (!fs.existsSync(file)) { errors.push(`missing required artifact ${path.relative(projectRoot, file)}`); continue; }
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink() || !stat.isFile()) { errors.push(`artifact changed type ${path.relative(projectRoot, file)}`); continue; }
      evidence.push({ path: path.relative(projectRoot, file), sha256: sha256(fs.readFileSync(file)) });
    }
    if (fs.existsSync(manuscript)) {
      const text = fs.readFileSync(manuscript, 'utf8');
      const words = countWords(text);
      if (words < 595 || words > 805) errors.push(`draft word count ${words} is outside the plan role's ±15% target window`);
      for (const required of ['41.2', '27.8', '128', 'eight', 'synthetic']) {
        if (!text.toLowerCase().includes(required.toLowerCase())) errors.push(`draft omitted required closed-world marker ${required}`);
      }
      const forbidden = [
        /statistically significant/iu, /universally (?:faster|better|reliable)/iu,
        /production[- ]proven/iu, /(?:is|was) optimal/iu, /more reliable than/iu,
        /https?:\/\//iu, /\bdoi\s*:/iu
      ];
      for (const pattern of forbidden) if (pattern.test(text)) errors.push(`draft contains forbidden unsupported form ${pattern}`);
    }
  }
  return {
    valid: errors.length === 0,
    checks: 'deterministic closed-world markers only; independent semantic review remains required',
    artifacts: evidence,
    errors
  };
}

function recordLocks(projectRoot) {
  return Object.fromEntries(readPlanningRecords(projectRoot).map(record => [record.path, record.sha256]));
}

function recordsUnchanged(before, projectRoot) {
  const after = recordLocks(projectRoot);
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changes = paths.filter(file => before[file] !== after[file]);
  return { valid: changes.length === 0, before_count: Object.keys(before).length, after_count: Object.keys(after).length, changes };
}

async function runOneFleet({ fleet, index, options, root, env, evidenceBinding, stateBinding, initialGit, profilesBefore,
  profilePaths, receiptsBefore }) {
  const projectRoot = path.join(root, 'project');
  const before = snapshotProject(projectRoot);
  const locks = recordLocks(projectRoot);
  const prefix = `${String(index + 1).padStart(2, '0')}-${fleet.name}`;
  const stdoutFile = path.join(root, 'evidence', 'runs', `${prefix}.stdout.jsonl`);
  const stderrFile = path.join(root, 'evidence', 'runs', `${prefix}.stderr.txt`);
  const argv = [options.binary, 'fleet', 'run', fleet.name, '--var', 'section=evaluation', '--json'];
  validateBoundDirectory(stateBinding, stateBinding.path, `${fleet.name} pre-spawn state root`, true);
  const auditOffsets = lifecycle.snapshotAuditOffsets(root);
  const processResult = await lifecycle.spawnCaptured({
    executable: process.execPath,
    argv,
    cwd: projectRoot,
    env,
    stdoutFile,
    stderrFile,
    timeoutMs: Math.round(options.timeoutMinutes * 60 * 1000)
  });
  if (processResult.processGroup?.quiesced !== true) {
    throw new Error(`${fleet.name}: owned process group did not quiesce`);
  }
  const stateQuiescence = await waitForStateQuiescence(root);
  if (!stateQuiescence.quiesced) throw new Error(`${fleet.name}: Clio state did not quiesce`);
  validateBoundDirectory(stateBinding, stateBinding.path, `${fleet.name} post-quiescence state root`, true);
  const toolActivity = auditFleetToolActivity(fleet, root, projectRoot, auditOffsets);
  const stdout = readBoundFile(evidenceBinding, stdoutFile, `${fleet.name} stdout`).toString('utf8');
  const stream = parseFleetStream(stdout, fleet.name);
  const after = snapshotProject(projectRoot);
  const mutation = auditFleetMutation(fleet, before, after);
  const schema = validatePlanningPaths([projectRoot]);
  const portable = verifyPortableSeed(projectRoot);
  const recordStability = recordsUnchanged(locks, projectRoot);
  const receiptsAfter = lifecycle.collectReceipts(root);
  const delta = await lifecycle.verifyReceiptDelta(root, receiptsBefore, receiptsAfter, options.clioSource);
  const receiptAudit = auditFleetReceipts({
    fleet, stream, delta, changedFiles: mutation.changed_files, stateBinding, root
  });
  const boundaries = auditWriteBoundaries(
    stateBinding, path.join(root, 'clio', 'state'), fleet, stream.summary
  );
  const ledger = auditFleetLedger(
    stateBinding, path.join(root, 'clio', 'state'), fleet, stream.summary, receiptAudit
  );
  const artifacts = auditArtifactInvariants(projectRoot, fleet);
  const gitAfter = lifecycle.gitControlSnapshot(projectRoot);
  const gitUnchanged = lifecycle.gitControlEqual(initialGit, gitAfter);
  const profileCheckpoint = lifecycle.snapshotProfiles(profilePaths);
  const profilesUnchanged = lifecycle.profilesEqual(profilesBefore, profileCheckpoint);
  const errors = [];
  if (processResult.exitCode !== 0 || processResult.timedOut || processResult.error) errors.push('fleet process did not exit zero normally');
  for (const [label, audit] of [
    ['stdout', stream], ['mutation', mutation], ['incremental tool activity', toolActivity],
    ['planning schema', schema], ['portable seed', portable],
    ['record stability', recordStability], ['receipts', receiptAudit], ['write boundaries', boundaries],
    ['fleet ledger', ledger], ['artifact invariants', artifacts]
  ]) if (audit.valid !== true) errors.push(...(audit.errors || audit.changes || []).map(error => `${label}: ${typeof error === 'string' ? error : JSON.stringify(error)}`));
  if (!gitUnchanged) errors.push('Git HEAD, index, refs, or .git tree changed');
  if (!profilesUnchanged) errors.push('normal profile hashes changed');
  return {
    valid: errors.length === 0,
    fleet: fleet.name,
    command: {
      executable: process.execPath,
      argv,
      argv_sha256: sha256(Buffer.from(JSON.stringify(argv), 'utf8')),
      credential_material_in_argv: false
    },
    process: processResult,
    state_quiescence: stateQuiescence,
    stream: {
      valid: stream.valid,
      entries: stream.entries,
      summary: stream.summary,
      errors: stream.errors,
      stdout: { path: path.relative(root, stdoutFile), bytes: fs.statSync(stdoutFile).size, sha256: sha256(fs.readFileSync(stdoutFile)) },
      stderr: { path: path.relative(root, stderrFile), bytes: fs.statSync(stderrFile).size, sha256: sha256(fs.readFileSync(stderrFile)) }
    },
    mutation,
    tool_activity: toolActivity,
    schema_validation: { valid: schema.valid, checked: schema.checked },
    portable_seed: portable,
    record_stability: recordStability,
    receipts: receiptAudit,
    write_boundaries: boundaries,
    fleet_ledger: ledger,
    artifact_invariants: artifacts,
    git_control: { before: initialGit, after: gitAfter, unchanged: gitUnchanged },
    normal_profiles: { unchanged: profilesUnchanged, observed: profileCheckpoint },
    errors,
    receiptsAfter
  };
}

function assertExecutionConfirmation(environment = process.env) {
  if (environment[CONFIRMATION_ENV] !== CONFIRMATION) {
    throw new Error(`paid fleet execution requires exact ${CONFIRMATION_ENV} acknowledgement`);
  }
  return true;
}

function refreshCaptureMetadata(root, transition) {
  for (const kind of ['stdout', 'stderr']) {
    const file = path.join(root, transition.stream[kind].path);
    transition.stream[kind] = {
      path: transition.stream[kind].path,
      bytes: fs.statSync(file).size,
      sha256: sha256(fs.readFileSync(file))
    };
  }
}

async function execute(options, sources, environment = process.env) {
  const { prepared, plan } = verifyPrepared(options, sources);
  assertExecutionConfirmation(environment);
  const root = options.root;
  const projectRoot = path.join(root, 'project');
  const paths = lifecycle.isolatedPaths(root, options.clioSource, 'S1');
  const env = lifecycle.sanitizedChildEnv(paths);
  const settingsSourceName = environment[SETTINGS_SOURCE_ENV];
  const credentialsSourceName = environment[CREDENTIALS_SOURCE_ENV];
  if (!settingsSourceName || !credentialsSourceName) {
    throw new Error(`execute requires ${SETTINGS_SOURCE_ENV} and ${CREDENTIALS_SOURCE_ENV}`);
  }
  const settingsSourcePath = path.resolve(settingsSourceName);
  const credentialsSourcePath = path.resolve(credentialsSourceName);
  if (settingsSourcePath === credentialsSourcePath || isContained(root, settingsSourcePath) ||
      isContained(root, credentialsSourcePath)) throw new Error('forward sources must be distinct and outside the disposable root');

  // The acknowledgement and sealed preparation are checked before these reads.
  const settingsSource = readExternalSource(settingsSourcePath, 'Clio settings source');
  const credentialsSource = readExternalSource(credentialsSourcePath, 'Clio credentials source', { private: true });
  const profilePaths = profilePathList(settingsSourcePath, credentialsSourcePath, environment);
  const profilesBefore = lifecycle.snapshotProfiles(profilePaths);
  const profilesPreFile = path.join(root, 'evidence', 'normal-profiles-execute-pre.json');
  writeJsonPrivate(profilesPreFile, profilesBefore, true);
  const markerFile = path.join(root, 'evidence', 'fleet-execution-started.json');
  writeJsonPrivate(markerFile, {
    schema: 'wtfp.evaluation.clio-fleets-execution-start/v1',
    started_at: new Date().toISOString(),
    prepared_sha256: sha256(fs.readFileSync(path.join(root, 'evidence', PREPARED_FILE))),
    confirmation_sha256: sha256(Buffer.from(CONFIRMATION)),
    settings_source_sha256: settingsSource.sha256,
    settings_source_behavior_imported: false,
    credentials_source_sha256: credentialsSource.sha256,
    source_paths_recorded_only_in_profile_inventory: true,
    credential_contents_recorded: false
  }, true);

  const configRoot = paths.CLIO_CODER_CONFIG_DIR;
  const isolatedSettings = path.join(configRoot, 'settings.yaml');
  const isolatedCredentials = path.join(configRoot, 'credentials.yaml');
  if (lifecycle.containedPrivateFileSha256(root, configRoot, isolatedSettings, 'sealed fleet settings') !==
      prepared.settings_sha256) throw new Error('sealed settings changed immediately before forwarding');
  const configDirectoryBinding = lifecycle.bindContainedPrivateDirectory(root, configRoot, 'fleet Clio config root');
  const evidenceBinding = bindPrivateRoot(path.join(root, 'evidence'), 'fleet evidence root');
  const stateBinding = bindPrivateRoot(paths.CLIO_CODER_STATE_DIR, 'fleet Clio state root');
  const dataBinding = bindPrivateRoot(paths.CLIO_CODER_DATA_DIR, 'fleet Clio data root');
  let credentialHandle = null;
  let approvedRotatedCredential = null;
  let credentialCandidates = lifecycle.collectCredentialCandidates(credentialsSource.bytes.toString('utf8'));
  let credentialScan = { valid: false, scanned_files: 0, scanned_bytes: 0, findings: [], anomalies: [] };
  let cleanup = { status: 'cleanup-failed', absent: false, method: 'not-attempted' };
  let stoppedReason = null;
  const transitions = [];
  const started = Date.now();
  const initialGit = prepared.fixture.git_control;
  let receiptsBefore = lifecycle.collectReceipts(root);
  let settingsFinalSha256 = null;
  let isolatedCredentialsFinalSha256 = null;
  const signalGuard = lifecycle.installExecutionSignalHandlers(() =>
    lifecycle.cleanupCredentialArtifactsSafe(configRoot, isolatedCredentials, root, credentialHandle, approvedRotatedCredential));
  try {
    credentialHandle = lifecycle.openPrivateCredential(isolatedCredentials, credentialsSource.bytes);
    credentialHandle.directory_binding = configDirectoryBinding;
    credentialsSource.bytes.fill(0);
    settingsSource.bytes.fill(0);
    for (const [index, fleet] of FLEETS.entries()) {
      if (signalGuard.state.signal) { stoppedReason = `operator interruption ${signalGuard.state.signal}`; break; }
      if (!sameDirectoryIdentity(prepared.directory_bindings.config) ||
          !sameDirectoryIdentity(prepared.directory_bindings.state) ||
          !sameDirectoryIdentity(prepared.directory_bindings.data)) {
        stoppedReason = 'an isolated Clio directory changed identity before a fleet';
        break;
      }
      if (!receiptsBefore.cost.valid ||
          receiptsBefore.cost.client_reported_numeric_total_usd >= options.budgetUsd) {
        stoppedReason = `cost ceiling reached or receipt cost invalid before ${fleet.name}`;
        break;
      }
      const transition = await runOneFleet({
        fleet,
        index,
        options,
        root,
        env,
        evidenceBinding,
        stateBinding,
        initialGit,
        profilesBefore,
        profilePaths,
        receiptsBefore
      });
      transitions.push(transition);
      receiptsBefore = transition.receiptsAfter;
      if (!transition.valid) {
        stoppedReason = `${fleet.name} failed structural or safety validation`;
        break;
      }
    }
  } catch (error) {
    stoppedReason = `fleet harness exception: ${error.message}`;
  } finally {
    try {
      settingsFinalSha256 = lifecycle.containedPrivateFileSha256(
        root, configRoot, isolatedSettings, 'sealed fleet settings'
      );
      if (pathEntryExists(isolatedCredentials)) {
        const finalCredential = lifecycle.readContainedPrivateFileEvidence(
          root,
          configRoot,
          isolatedCredentials,
          'isolated fleet credentials',
          {
            maxBytes: MAX_SOURCE_BYTES,
            directoryBinding: configDirectoryBinding,
            approveCredentialRotation: true
          }
        );
        approvedRotatedCredential = finalCredential;
        isolatedCredentialsFinalSha256 = finalCredential.sha256;
        credentialCandidates = [...new Set([
          ...credentialCandidates,
          ...lifecycle.collectCredentialCandidates(finalCredential.bytes.toString('utf8'))
        ])].sort((left, right) => right.length - left.length);
        finalCredential.bytes.fill(0);
      }
      credentialScan = lifecycle.scanAndRedactCredentialValues(root, isolatedCredentials, credentialCandidates);
    } catch (error) {
      credentialScan = {
        valid: false,
        scanned_files: 0,
        scanned_bytes: 0,
        findings: [],
        anomalies: [{ path: null, reason: `credential scan failed: ${error.message}` }]
      };
    }
    cleanup = lifecycle.cleanupCredentialArtifactsSafe(
      configRoot, isolatedCredentials, root, credentialHandle, approvedRotatedCredential
    );
    signalGuard.remove();
  }

  // All spawnCaptured calls must have returned a quiesced group before this
  // evidence read. The bound roots additionally refuse ancestor substitution.
  validateBoundDirectory(evidenceBinding, evidenceBinding.path, 'fleet evidence root', true);
  validateBoundDirectory(stateBinding, stateBinding.path, 'fleet state root', true);
  validateBoundDirectory(dataBinding, dataBinding.path, 'fleet data root', true);
  for (const transition of transitions) refreshCaptureMetadata(root, transition);
  const profilesAfter = lifecycle.snapshotProfiles(profilePaths);
  const profileUnchanged = lifecycle.profilesEqual(profilesBefore, profilesAfter);
  writeJsonPrivate(path.join(root, 'evidence', 'normal-profiles-execute-post.json'), profilesAfter, true);
  const finalGit = lifecycle.gitControlSnapshot(projectRoot);
  const gitUnchanged = lifecycle.gitControlEqual(initialGit, finalGit);
  const finalSchema = validatePlanningPaths([projectRoot]);
  const finalPortable = verifyPortableSeed(projectRoot);
  let aggregateAudit;
  try {
    aggregateAudit = lifecycle.auditLogSummary(root, {
      project: projectRoot,
      extension: path.join(configRoot, 'extensions', 'wtfp'),
      additional: []
    });
  } catch (error) {
    aggregateAudit = { valid: false, entries: 0, files: [], parse_errors: [error.message], tool_audit: { valid: false } };
  }
  const finalReceipts = lifecycle.collectReceipts(root);
  const forbiddenReceiptTools = [...new Set(finalReceipts.receipts.flatMap(receipt =>
    (receipt.tool_stats || []).map(item => item.tool).filter(lifecycle.isForbiddenToolName)))].sort();
  const transitionValid = transitions.length === FLEETS.length && transitions.every(transition => transition.valid);
  const credentialCleanupValid = cleanup.status === 'securely-removed' && cleanup.absent === true &&
    !pathEntryExists(isolatedCredentials);
  const errors = [];
  if (!transitionValid) errors.push(stoppedReason || 'both fleets did not complete');
  if (!credentialScan.valid || credentialScan.findings.length > 0 || credentialScan.anomalies.length > 0) {
    errors.push('credential artifact scan was incomplete or found retained credential material');
  }
  if (!credentialCleanupValid) errors.push('credential cleanup was not securely completed');
  if (!profileUnchanged) errors.push('normal profile hashes changed');
  if (!gitUnchanged) errors.push('Git control plane changed');
  if (!finalSchema.valid || !finalPortable.valid) errors.push('final portable planning records are invalid or incoherent');
  if (settingsFinalSha256 !== prepared.settings_sha256) errors.push('sealed minimal settings changed');
  if (!finalReceipts.cost.valid || finalReceipts.receipts.length !== 4) errors.push('final receipt or cost inventory is invalid');
  if (!aggregateAudit.valid) errors.push('aggregate tool audit failed');
  if (forbiddenReceiptTools.length > 0) errors.push('a receipt reports a forbidden shell, VCS, or network tool');
  const result = {
    schema: RESULT_SCHEMA,
    outcome: errors.length === 0 ? 'completed' : 'blocked',
    started_at: new Date(started).toISOString(),
    ended_at: new Date().toISOString(),
    latency_ms: Date.now() - started,
    stopped_reason: errors.length === 0 ? null : (stoppedReason || errors[0]),
    source: sources,
    client: {
      name: 'Clio Coder',
      version: EXPECTED_CLIO.version,
      binary_path: options.binary,
      binary_sha256: sources.clio.binary.sha256,
      source_commit: sources.clio.commit,
      target: TARGET,
      model: MODEL,
      effort: EFFORT
    },
    requested: plan.requested,
    exact_actions: FLEETS.map(fleet => `fleet run ${fleet.name} --var section=evaluation --json`),
    transitions: transitions.map(transition => {
      const { receiptsAfter, ...serializable } = transition;
      return serializable;
    }),
    receipts: {
      count: finalReceipts.receipts.length,
      cost: finalReceipts.cost,
      total_latency_ms: finalReceipts.total_latency_ms,
      input_tokens: finalReceipts.input_tokens,
      output_tokens: finalReceipts.output_tokens,
      cache_read_tokens: finalReceipts.cache_read_tokens,
      reasoning_tokens: finalReceipts.reasoning_tokens,
      tool_calls: finalReceipts.tool_calls
    },
    aggregate_tool_audit: aggregateAudit,
    forbidden_receipt_tools: forbiddenReceiptTools,
    final_schema_validation: { valid: finalSchema.valid, checked: finalSchema.checked },
    final_portable_invariants: finalPortable,
    git_control: { before: initialGit, after: finalGit, unchanged: gitUnchanged },
    normal_profiles: { before: profilesBefore, after: profilesAfter, unchanged: profileUnchanged },
    credentials: {
      forwarded: true,
      transport: 'isolated mode-0600 credentials.yaml with retained descriptor',
      source_paths_in_profile_inventory: true,
      source_contents_recorded: false,
      source_sha256: credentialsSource.sha256,
      isolated_final_sha256: isolatedCredentialsFinalSha256,
      refreshed: isolatedCredentialsFinalSha256 !== null && isolatedCredentialsFinalSha256 !== credentialsSource.sha256,
      artifact_scan: credentialScan,
      cleanup
    },
    settings: {
      operator_source_sha256: settingsSource.sha256,
      operator_behavior_imported: false,
      sealed_minimal_sha256: prepared.settings_sha256,
      unchanged: settingsFinalSha256 === prepared.settings_sha256
    },
    semantic_assessment: {
      status: 'pending-independent-review',
      deterministic_invariants_checked: true,
      note: 'Receipt, boundary, schema, closed-world marker, and unsupported-form checks do not self-award academic quality.'
    },
    credential_cleanup_complete: credentialCleanupValid,
    normal_profiles_unchanged: profileUnchanged,
    errors
  };
  const resultFile = path.join(root, 'evidence', 'fleet-result.json');
  writeJsonPrivate(resultFile, result, true);
  writePrivate(`${resultFile}.sha256`, `${sha256(fs.readFileSync(resultFile))}\n`, true);
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
        native_preflight_valid: result.prepared.native_preflight_valid,
        paid_execution_ready: result.prepared.paid_execution_ready,
        credentials_read: false,
        credentials_forwarded: false,
        paid_model_calls: 0,
        plan: path.join(result.root, 'evidence', 'fleet-plan.json'),
        evidence: path.join(result.root, 'evidence', 'fleet-native-preflight.json')
      }, null, 2)}\n`);
      return result.prepared.paid_execution_ready ? 0 : 1;
    }
    const result = await execute(options, sources);
    process.stdout.write(`${JSON.stringify({
      mode: 'execute',
      outcome: result.outcome,
      fleets_completed: result.transitions.filter(transition => transition.valid).map(transition => transition.fleet),
      receipts: result.receipts.count,
      cost: result.receipts.cost,
      normal_profiles_unchanged: result.normal_profiles_unchanged,
      credential_cleanup_complete: result.credential_cleanup_complete,
      result: path.join(options.root, 'evidence', 'fleet-result.json')
    }, null, 2)}\n`);
    return result.outcome === 'completed' ? 0 : 1;
  } catch (error) {
    const root = options?.root;
    process.stderr.write(root
      ? `clio-fleets harness failed closed; inspect private evidence under ${path.join(root, 'evidence')}\n`
      : 'clio-fleets harness failed before a disposable root was established\n');
    return 2;
  }
}

if (require.main === module) {
  main().then(code => { process.exitCode = code; });
}

module.exports = {
  CONFIRMATION,
  CONFIRMATION_ENV,
  CREDENTIALS_SOURCE_ENV,
  EXPECTED_CLIO,
  FLEETS,
  PROFILE_PATHS_ENV,
  SETTINGS_SOURCE_ENV,
  assertExpectedClioIdentity,
  assertExecutionConfirmation,
  auditArtifactInvariants,
  auditFleetGraph,
  auditFleetLedger,
  auditFleetMutation,
  auditFleetReceipts,
  auditFleetToolActivity,
  auditNativeTopology,
  auditStructuredResult,
  auditWriteBoundaries,
  bindPrivateRoot,
  buildPlan,
  execute,
  initializeSeedProject,
  inspectSources,
  parseArgs,
  parseFleetStream,
  prepare,
  readBoundFile,
  readExternalSource,
  recordsUnchanged,
  verifyGeneratedInventory,
  verifyPortableSeed,
  verifyPrepared,
  verdictDigest,
  waitForStateQuiescence
};
