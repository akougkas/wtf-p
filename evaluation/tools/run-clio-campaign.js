#!/usr/bin/env node

'use strict';

// Runner for versioned Clio campaigns (evaluation/v2). `plan` and `prepare`
// need no credentials and run no model. `execute` runs the campaign lifecycle
// headless with resources the operator selects for that run; every author gate
// it reaches is reported as a typed unavailable result, never answered.
// `collect` verifies a prepared workspace independently of the desk, including
// sealed author answers from an interactive session in the same profile. The
// historical evaluation/v1 runners and evidence are not used or changed.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { SchemaRegistry, validateInstance } = require('../lib/json-schema');
const { inventoryFixture } = require('../lib/fixture-hashes');
const { analyzeCoverage } = require('../lib/claim-coverage');
const { validatePlanningPaths } = require('./validate-planning');
const {
  createRoot,
  installExecutionSignalHandlers,
  sanitizedChildEnv,
  spawnCaptured
} = require('./run-clio-lifecycle');

const ROOT = path.resolve(__dirname, '../..');
const DEFAULT_CAMPAIGN = path.join(ROOT, 'evaluation/v2/campaigns/clio-0.6.2-reference.json');
const CAMPAIGN_SCHEMA = path.join(ROOT, 'evaluation/v2/schemas/campaign.schema.json');
const CONFIRM_ENV = 'WTFP_CAMPAIGN_CONFIRM';
const CREDENTIALS_ENV = 'WTFP_CAMPAIGN_CLIO_CREDENTIALS_SOURCE';
const SETTINGS_ENV = 'WTFP_CAMPAIGN_CLIO_SETTINGS_SOURCE';
const HEADLESS_GATE = /no operator can answer an interview here|headless session/u;
const PACKAGE_PATHS = ['bin', 'protocol', 'vendors', 'clio', 'evaluation/lib', 'package.json'];

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).filter(key => value[key] !== undefined).sort()
      .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
}

function confirmValue(campaign) {
  return `I_ACKNOWLEDGE_MODEL_EXECUTION_${campaign.id.toUpperCase().replace(/[^A-Z0-9]+/gu, '_')}_V${campaign.version}`;
}

// --- identities -----------------------------------------------------------------

/** SHA-256 of the sorted `<sha256>  ./<path>` listing of every file below a directory, links refused. */
function directoryDigest(root) {
  const lines = [];
  const visit = (relative) => {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`refusing symbolic link in ${root}: ${child}`);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) lines.push([child, sha256(fs.readFileSync(path.join(root, child)))]);
    }
  };
  visit('');
  lines.sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0));
  return sha256(lines.map(([file, digest]) => `${digest}  ./${file}\n`).join(''));
}

function loadCampaign(file = DEFAULT_CAMPAIGN) {
  const campaign = readJson(file);
  const registry = new SchemaRegistry([CAMPAIGN_SCHEMA]);
  const errors = validateInstance(campaign, registry.get(CAMPAIGN_SCHEMA), CAMPAIGN_SCHEMA, registry);
  if (errors.length > 0) throw new Error(`${path.relative(ROOT, file)} is not a valid campaign: ${errors[0]}`);
  const fixture = inventoryFixture(path.join(ROOT, campaign.fixture.path));
  if (fixture.model_inputs_sha256 !== campaign.fixture.model_inputs_sha256) {
    throw new Error(`${campaign.fixture.path} model inputs changed since the campaign pinned them; a new meaning needs a new fixture version`);
  }
  const actions = new Set(readJson(path.join(ROOT, 'protocol/catalog.json')).actions.map(action => action.id));
  for (const step of campaign.lifecycle) {
    if (!actions.has(step.action)) throw new Error(`campaign step ${step.step} names unknown action ${step.action}`);
  }
  for (const pkg of campaign.wtfp.packages) {
    const inventory = readJson(path.join(ROOT, pkg.path, '.wtfp-generated.json'));
    if (inventory.target !== pkg.inventory_target) throw new Error(`${pkg.path} is not the ${pkg.inventory_target} envelope`);
  }
  return campaign;
}

function wtfpIdentity() {
  const git = (args) => spawnSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' });
  const head = git(['rev-parse', 'HEAD']);
  const status = git(['status', '--porcelain', '--', ...PACKAGE_PATHS]);
  return {
    commit: head.status === 0 ? head.stdout.trim() : null,
    package_tree: status.status !== 0 ? 'unknown' : status.stdout.trim() === '' ? 'clean' : 'dirty',
    packages: Object.fromEntries(['vendors/plugin', 'vendors/clio-extension'].map(relative => {
      const inventory = readJson(path.join(ROOT, relative, '.wtfp-generated.json'));
      return [relative, { target: inventory.target, source_sha256: inventory.sourceHash }];
    }))
  };
}

/** The identity of a built Clio entry, compared with what the campaign pins. */
function clioIdentity(entry, campaign) {
  if (!entry || !path.isAbsolute(entry)) throw new Error('the Clio entry must be an absolute path to a built dist/cli/index.js');
  const stat = fs.lstatSync(entry);
  if (!stat.isFile()) throw new Error(`${entry} is not a regular file`);
  const dist = path.dirname(path.dirname(entry));
  // A throwaway home keeps the probe from ever resolving the operator's profile.
  const scratch = fs.mkdtempSync(path.join(require('os').tmpdir(), 'wtfp-campaign-probe-'));
  let version;
  try {
    version = spawnSync(process.execPath, [entry, '--version'], {
      encoding: 'utf8', timeout: 30000,
      env: { PATH: '/usr/bin:/bin', HOME: scratch, XDG_CONFIG_HOME: scratch, XDG_DATA_HOME: scratch, XDG_STATE_HOME: scratch, XDG_CACHE_HOME: scratch, CLIO_CODER_HOME: scratch }
    });
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  const observed = {
    entry,
    version: version.status === 0 ? version.stdout.trim() : null,
    entry_sha256: sha256(fs.readFileSync(entry)),
    dist_sha256: directoryDigest(dist),
    node: process.version
  };
  const pinned = campaign.clio.build;
  const mismatches = [
    ...(observed.version === `Clio Coder ${campaign.clio.version}` ? [] : [`version ${observed.version} is not Clio Coder ${campaign.clio.version}`]),
    ...(observed.entry_sha256 === pinned.entry_sha256 ? [] : [`entry sha256 ${observed.entry_sha256} is not ${pinned.entry_sha256}`]),
    ...(observed.dist_sha256 === pinned.dist_sha256 ? [] : [`dist sha256 ${observed.dist_sha256} is not ${pinned.dist_sha256}`]),
    ...(observed.node === pinned.node ? [] : [`node ${observed.node} is not ${pinned.node}`])
  ];
  return { observed, mismatches };
}

function prompt(step) {
  return `/wtfp:${step.action}${step.arguments ? ` ${step.arguments}` : ''}`;
}

/** What one run of this campaign would do, computed without credentials, a model, or any write. */
function plan(campaign, options = {}) {
  const missing = [
    ...(['target', 'model', 'effort'].filter(key => !options[key] && !campaign.model[key]).map(key => `model.${key}`)),
    ...(options.budgetUsd === undefined && campaign.budget.ceiling === null ? ['budget.ceiling'] : [])
  ];
  return {
    schema: 'wtfp.evaluation.campaign-plan/v2',
    campaign: { id: campaign.id, version: campaign.version, status: campaign.status },
    wtfp: wtfpIdentity(),
    clio: options.entry ? clioIdentity(options.entry, campaign) : { pinned: campaign.clio, observed: null },
    fixture: campaign.fixture,
    permissions: campaign.permissions,
    steps: campaign.lifecycle.map(step => ({
      step: step.step,
      session: step.session,
      prompt: prompt(step),
      author_gate: step.author_gate,
      headless_expectation: step.author_gate ? 'author-unavailable' : 'runs-or-fails'
    })),
    resources_missing: missing,
    credential_free: true,
    acknowledgement: { variable: CONFIRM_ENV, value: confirmValue(campaign) }
  };
}

// --- prepare ------------------------------------------------------------------------

function profilePaths(root, session = 'S1') {
  const second = session === 'S2';
  return {
    HOME: path.join(root, second ? 'home-s2' : 'home'),
    XDG_CONFIG_HOME: path.join(root, second ? 'xdg-s2' : 'xdg', 'config'),
    XDG_DATA_HOME: path.join(root, second ? 'xdg-s2' : 'xdg', 'data'),
    XDG_STATE_HOME: path.join(root, second ? 'xdg-s2' : 'xdg', 'state'),
    XDG_CACHE_HOME: path.join(root, second ? 'xdg-s2' : 'xdg', 'cache'),
    TMPDIR: path.join(root, second ? 'tmp-s2' : 'tmp'),
    CLIO_CODER_HOME: path.join(root, 'clio'),
    CLIO_CODER_CONFIG_DIR: path.join(root, 'clio', 'config'),
    // The extension store, and with it the desk's seal key, lives in the
    // state directory both sessions share; their data and caches stay apart.
    CLIO_CODER_STATE_DIR: path.join(root, 'clio', 'state'),
    CLIO_CODER_DATA_DIR: path.join(root, 'clio', second ? 'data-s2' : 'data'),
    CLIO_CODER_CACHE_DIR: path.join(root, 'clio', second ? 'cache-s2' : 'cache'),
    CLIO_CODER_BIN_DIR: path.join(root, 'clio', 'bin'),
    NO_COLOR: '1'
  };
}

function nativeRunner(root, entry, session = 'S1') {
  const env = { ...sanitizedChildEnv(profilePaths(root, session)) };
  env.PATH = [path.join(root, 'clio', 'bin'), env.PATH].join(path.delimiter);
  return (args, cwd, timeout = 120000) => {
    const result = spawnSync(process.execPath, [entry, ...args], { cwd, env, encoding: 'utf8', timeout });
    return { args, status: result.status, stdout: result.stdout || '', stderr: result.stderr || '', error: result.error ? result.error.message : null };
  };
}

function prepare(campaign, options) {
  const identity = clioIdentity(options.entry, campaign);
  if (identity.mismatches.length > 0 && !options.allowUnpinned) {
    throw new Error(`refusing to prepare on an unpinned Clio build: ${identity.mismatches.join('; ')}`);
  }
  const wtfp = wtfpIdentity();
  if (wtfp.package_tree !== 'clean' && !options.allowDirty) {
    throw new Error('refusing to prepare from a dirty WTF-P package tree; commit the candidate first');
  }
  const root = createRoot(options.root);
  for (const session of ['S1', 'S2']) {
    for (const directory of Object.values(profilePaths(root, session))) {
      if (directory.startsWith(root)) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    }
  }
  // The product installer and the desk find Clio as `clio-coder` on PATH.
  fs.writeFileSync(path.join(root, 'clio', 'bin', 'clio-coder'),
    `#!${process.execPath}\nconst r = require('child_process').spawnSync(process.execPath, [${JSON.stringify(options.entry)}, ...process.argv.slice(2)], { stdio: 'inherit' });\nprocess.exit(r.status ?? 1);\n`,
    { mode: 0o755 });
  const workspace = path.join(root, 'workspace');
  fs.mkdirSync(workspace, { mode: 0o700 });
  const fixtureRoot = path.join(ROOT, campaign.fixture.path);
  const descriptor = readJson(path.join(fixtureRoot, 'fixture.json'));
  // Only model-visible inputs enter the workspace; evaluator oracles stay out.
  for (const input of descriptor.model_visible_inputs) {
    fs.copyFileSync(path.join(fixtureRoot, input.path), path.join(workspace, input.path));
  }
  const gitEnv = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  for (const args of [['init', '--quiet'], ['-c', 'user.name=WTF-P Campaign', '-c', 'user.email=campaign@example.invalid', 'commit', '--quiet', '--allow-empty', '-m', 'fixture']]) {
    // Playbook write boundaries need a checkout; this is fixture setup, not an action effect.
    const git = spawnSync('git', args, { cwd: workspace, env: gitEnv, encoding: 'utf8' });
    if (git.status !== 0) throw new Error(`fixture checkout failed: ${git.stderr}`);
  }
  const native = nativeRunner(root, options.entry);
  const installEnv = { ...sanitizedChildEnv(profilePaths(root)) };
  installEnv.PATH = [path.join(root, 'clio', 'bin'), installEnv.PATH].join(path.delimiter);
  const install = spawnSync(process.execPath, [path.join(ROOT, 'bin/install.js'), 'install', 'clio', '--config-dir', profilePaths(root).CLIO_CODER_CONFIG_DIR, '--advanced', '--force', '--no-color'],
    { cwd: workspace, env: installEnv, encoding: 'utf8', timeout: 300000 });
  const observations = [{ args: ['wtf-p', 'install', 'clio'], status: install.status, stdout_sha256: sha256(install.stdout || ''), stderr_tail: (install.stderr || '').slice(-400) }];
  if (install.status !== 0) throw new Error(`WTF-P installation failed in the campaign profile: ${(install.stdout || '') + (install.stderr || '')}`);
  const checks = [];
  const record = (name, result, ok, detail) => {
    observations.push({ args: result.args, status: result.status, stdout_sha256: sha256(result.stdout) });
    checks.push({ name, passed: Boolean(ok), detail });
  };
  const inspected = native(['library', 'inspect', 'plugin:wtfp', '--user', '--json'], workspace);
  const plugin = inspected.status === 0 ? JSON.parse(inspected.stdout) : null;
  record('plugin-registered', inspected, plugin && plugin.valid && plugin.enabled && plugin.diagnostics.length === 0, plugin ? `${plugin.version} ${plugin.rootPath}` : inspected.stderr);
  const extensions = native(['extensions', 'list', '--user', '--json'], workspace);
  const desk = extensions.status === 0 ? JSON.parse(extensions.stdout).extensions.find(item => item.id === 'wtfp') : null;
  record('desk-registered', extensions, desk && desk.valid && desk.enabled && desk.plugin === 'wtfp' && desk.diagnostics.length === 0, desk ? desk.rootPath : extensions.stderr);
  for (const playbook of ['wtfp-plan-section', 'wtfp-draft-review']) {
    const validated = native(['playbook', 'validate', playbook, '--json'], workspace);
    record(`playbook-validate-${playbook}`, validated, validated.status === 0, null);
    const graph = native(['playbook', 'graph', playbook, '--json'], workspace);
    record(`playbook-graph-${playbook}`, graph, graph.status === 0 && !/"\.planning\/"/u.test(graph.stdout), null);
  }
  const deskRoot = desk ? desk.rootPath : path.join(profilePaths(root).CLIO_CODER_CONFIG_DIR, 'extensions', 'wtfp');
  const deskTests = native(['extensions', 'test', deskRoot], workspace, 600000);
  const passed = /ℹ fail 0/u.test(deskTests.stdout + deskTests.stderr);
  record('desk-package-tests', deskTests, passed, (deskTests.stdout.match(/ℹ (?:tests|pass|fail) \d+/gu) || []).join(', '));
  const prepared = {
    schema: 'wtfp.evaluation.campaign-prepared/v2',
    campaign: { id: campaign.id, version: campaign.version, sha256: sha256(fs.readFileSync(options.campaignFile || DEFAULT_CAMPAIGN)) },
    prepared_at: new Date().toISOString(),
    evidence_level: 'native-discovery',
    wtfp,
    clio: identity.observed,
    clio_unpinned: identity.mismatches,
    fixture: { path: campaign.fixture.path, model_inputs_sha256: campaign.fixture.model_inputs_sha256, evaluator_oracles_copied: false },
    workspace: path.relative(root, workspace),
    workspace_sha256: workspaceDigest(workspace),
    checks,
    native_observations: observations,
    interactive_session: {
      note: 'Run Clio interactively in this profile to answer author gates; collect verifies what the desk sealed.',
      environment: profilePaths(root, 'S1'),
      command: `${options.entry} (cwd ${workspace})`
    }
  };
  writeJson(path.join(root, 'prepared.json'), prepared);
  if (!checks.every(check => check.passed)) {
    throw new Error(`native discovery failed: ${checks.filter(check => !check.passed).map(check => check.name).join(', ')}; see ${path.join(root, 'prepared.json')}`);
  }
  return { root, prepared };
}

function workspaceDigest(workspace) {
  const lines = [];
  const visit = (relative) => {
    for (const entry of fs.readdirSync(path.join(workspace, relative), { withFileTypes: true })) {
      if (relative === '' && entry.name === '.git') continue;
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) lines.push(`link ${child}`);
      else if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) lines.push(`${sha256(fs.readFileSync(path.join(workspace, child)))}  ${child}`);
    }
  };
  visit('');
  return sha256(lines.sort().join('\n'));
}

// --- execute ------------------------------------------------------------------------

/**
 * One step's outcome from its process result and JSON event stream. An author
 * gate the session could not ask is its own typed outcome; it is never counted
 * as a completed action or as an answer.
 */
function classifyStep(result, stdoutText, stderrText) {
  const events = [];
  for (const line of stdoutText.split('\n')) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); } catch { /* non-JSON progress lines are kept only in the raw log */ }
  }
  const text = `${stdoutText}\n${stderrText}`;
  const usage = events.map(event => event && (event.usage || (event.data && event.data.usage))).filter(Boolean);
  const costs = usage.map(item => item.costUsd).filter(value => typeof value === 'number' && Number.isFinite(value));
  const cost = costs.length > 0 && costs.length === usage.length ? costs.reduce((sum, value) => sum + value, 0) : null;
  let outcome = 'completed';
  if (result.timedOut) outcome = 'timed-out';
  else if (result.signal) outcome = 'cancelled';
  else if (HEADLESS_GATE.test(text)) outcome = 'author-unavailable';
  else if (result.exitCode !== 0) outcome = 'failed';
  return {
    outcome,
    exit_code: result.exitCode,
    signal: result.signal,
    latency_ms: result.latencyMs,
    process_group: result.processGroup,
    events: events.length,
    cost_usd: cost,
    cost_status: cost === null ? 'unavailable' : 'reported'
  };
}

function copyPrivateSource(variable, destination, root) {
  const source = process.env[variable];
  if (!source || !path.isAbsolute(source)) throw new Error(`${variable} must name an absolute file the operator selected for this campaign`);
  const resolved = fs.realpathSync(source);
  if (resolved === root || resolved.startsWith(`${root}${path.sep}`)) throw new Error(`${variable} must lie outside the run root`);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile()) throw new Error(`${variable} is not a regular file`);
  fs.copyFileSync(resolved, destination, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(destination, 0o600);
  return { variable, sha256: sha256(fs.readFileSync(destination)) };
}

function wipe(file) {
  if (!fs.existsSync(file)) return;
  const size = fs.statSync(file).size;
  fs.writeFileSync(file, Buffer.alloc(size));
  fs.unlinkSync(file);
}

async function execute(campaign, options) {
  const root = path.resolve(options.root);
  const preparedFile = path.join(root, 'prepared.json');
  if (!fs.existsSync(preparedFile)) throw new Error(`${root} has no prepared.json; run prepare first`);
  const prepared = readJson(preparedFile);
  if (prepared.campaign.id !== campaign.id || prepared.campaign.version !== campaign.version) throw new Error('the prepared root belongs to another campaign');
  for (const key of ['target', 'model', 'effort']) {
    if (!options[key]) throw new Error(`execute needs the operator's --${key} for this run`);
  }
  if (!Number.isFinite(options.budgetUsd) || options.budgetUsd <= 0) throw new Error('execute needs the operator\'s --budget-usd ceiling');
  if (process.env[CONFIRM_ENV] !== confirmValue(campaign)) {
    throw new Error(`execute runs a model at the operator's expense; set ${CONFIRM_ENV}=${confirmValue(campaign)} to proceed`);
  }
  const identity = clioIdentity(options.entry, campaign);
  if (identity.observed.dist_sha256 !== prepared.clio.dist_sha256 || identity.observed.entry_sha256 !== prepared.clio.entry_sha256) {
    throw new Error('the Clio build changed since prepare');
  }
  if (fs.existsSync(path.join(root, 'run.json'))) throw new Error('this root already holds a run; prepare a new root');
  const config = profilePaths(root).CLIO_CODER_CONFIG_DIR;
  const resources = [
    copyPrivateSource(SETTINGS_ENV, path.join(config, 'settings.yaml'), root),
    copyPrivateSource(CREDENTIALS_ENV, path.join(config, 'credentials.yaml'), root)
  ];
  const run = {
    schema: 'wtfp.evaluation.campaign-run/v2',
    campaign: prepared.campaign,
    evidence_level: 'observed-model',
    selection: { target: options.target, model: options.model, effort: options.effort, budget_usd: options.budgetUsd, selected_by: 'operator' },
    resources,
    started_at: new Date().toISOString(),
    steps: [],
    outcome: 'running'
  };
  const workspace = path.join(root, prepared.workspace);
  const signals = installExecutionSignalHandlers(() => {
    wipe(path.join(config, 'credentials.yaml'));
  });
  let spent = 0;
  let costKnown = true;
  try {
    for (const step of campaign.lifecycle) {
      if (signals.state.signal) { run.outcome = 'cancelled'; break; }
      const env = { ...sanitizedChildEnv(profilePaths(root, step.session)) };
      env.PATH = [path.join(root, 'clio', 'bin'), env.PATH].join(path.delimiter);
      const logs = path.join(root, 'logs', step.step);
      const result = await spawnCaptured({
        executable: process.execPath,
        argv: [options.entry, 'run', '--target', options.target, '--model', options.model, '--thinking', options.effort, '--autonomy', campaign.permissions.autonomy, '--json-events', 'full', prompt(step)],
        cwd: workspace,
        env,
        stdoutFile: path.join(logs, 'stdout.jsonl'),
        stderrFile: path.join(logs, 'stderr.log'),
        timeoutMs: (options.timeoutMinutes || campaign.budget.timeout_minutes_per_step) * 60000
      });
      const classified = classifyStep(result, fs.readFileSync(path.join(logs, 'stdout.jsonl'), 'utf8'), fs.readFileSync(path.join(logs, 'stderr.log'), 'utf8'));
      if (classified.cost_usd === null) costKnown = false;
      else spent += classified.cost_usd;
      run.steps.push({ step: step.step, action: step.action, session: step.session, prompt: prompt(step), author_gate: step.author_gate, ...classified, workspace_sha256: workspaceDigest(workspace) });
      if (classified.outcome !== 'completed') {
        run.outcome = classified.outcome === 'author-unavailable' ? 'blocked-author-unavailable' : classified.outcome;
        break;
      }
      if (costKnown && spent >= options.budgetUsd) { run.outcome = 'stopped-budget'; break; }
    }
    if (run.outcome === 'running') run.outcome = 'completed';
  } finally {
    signals.remove();
    wipe(path.join(config, 'credentials.yaml'));
    run.ended_at = new Date().toISOString();
    run.cost = costKnown ? { status: 'reported', usd: spent } : { status: 'unavailable', usd: null };
    run.credentials_removed = !fs.existsSync(path.join(config, 'credentials.yaml'));
    writeJson(path.join(root, 'run.json'), run);
  }
  return run;
}

// --- collect ------------------------------------------------------------------------

/** Verifies a desk seal without the desk: HMAC-SHA-256 over the canonical record without its seal. */
function verifySeal(record, key) {
  const seal = record.seal;
  if (!seal || typeof seal.mac !== 'string') return 'unsealed';
  if (!key) return 'no-key';
  if (seal.key_id !== sha256(key).slice(0, 16)) return 'foreign';
  const body = { ...record };
  delete body.seal;
  const expected = crypto.createHmac('sha256', key).update(canonical(body)).digest('hex');
  return expected === seal.mac ? 'valid' : 'invalid';
}

function readRecords(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter(name => name.endsWith('.json') && !name.startsWith('.'))
    .sort().map(name => readJson(path.join(directory, name)));
}

/**
 * Independent verification of a campaign workspace. It reads, hashes and
 * copies; it never writes into the workspace, and it reports that the
 * workspace digest is unchanged by its own work.
 */
function collect(campaign, options) {
  const root = path.resolve(options.root);
  const prepared = readJson(path.join(root, 'prepared.json'));
  const workspace = path.join(root, prepared.workspace);
  const before = workspaceDigest(workspace);
  const planning = path.join(workspace, '.planning');
  const storeFile = path.join(profilePaths(root).CLIO_CODER_STATE_DIR, 'extensions', 'wtfp', 'store.json');
  let key = null;
  if (fs.existsSync(storeFile)) {
    const stored = readJson(storeFile).entries?.['seal-key']?.value;
    if (typeof stored === 'string' && /^[a-f0-9]{64}$/u.test(stored)) key = Buffer.from(stored, 'hex');
  }
  const schemas = fs.existsSync(planning) ? validatePlanningPaths([workspace], { coverage: true }) : null;
  const interactions = readRecords(path.join(planning, 'interactions')).map(record => ({
    id: record.id,
    kind: record.kind,
    subject: record.subject_uri,
    outcome: record.outcome,
    ...(record.selected_option ? { selected_option: record.selected_option } : {}),
    answered_at: record.answered_at,
    channel: record.channel,
    seal: verifySeal(record, key)
  }));
  const checkpoints = readRecords(path.join(planning, 'checkpoints'));
  const decisions = checkpoints.filter(record => record.kind !== 'state-snapshot').map(record => ({
    checkpoint: record.id,
    status: record.status,
    blocking: record.blocking,
    resolved_by: record.resolution ? record.resolution.resolved_by : null,
    attested_by: interactions.filter(item => item.subject === `project://checkpoints/${record.id}` && item.seal === 'valid').map(item => item.id)
  }));
  const evidence = path.join(root, 'evidence', `collect-${new Date().toISOString().replace(/[:.]/gu, '-')}`);
  fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
  for (const relative of ['.planning', 'paper']) {
    const source = path.join(workspace, relative);
    if (fs.existsSync(source)) fs.cpSync(source, path.join(evidence, relative), { recursive: true, verbatimSymlinks: true });
  }
  const after = workspaceDigest(workspace);
  const report = {
    schema: 'wtfp.evaluation.campaign-collect/v2',
    campaign: prepared.campaign,
    collected_at: new Date().toISOString(),
    evidence_levels: interactions.some(item => item.seal === 'valid') ? ['native-discovery', 'observed-author'] : ['native-discovery'],
    seal_key: key ? 'present' : 'absent',
    records: schemas ? { valid: schemas.valid, checked: schemas.checked } : null,
    coverage: schemas && schemas.coverage ? schemas.coverage.map(item => ({ valid: item.valid, findings: item.findings, claims: item.claims, scope: item.scope })) : [],
    interactions,
    decisions,
    unattested_author_resolutions: decisions.filter(item => item.resolved_by === 'author' && item.attested_by.length === 0).map(item => item.checkpoint),
    evaluator_mutation: { workspace_before: before, workspace_after: after, changed: before !== after, wrote_only: path.relative(root, evidence) }
  };
  writeJson(path.join(evidence, 'collect.json'), report);
  return report;
}

// --- command line -------------------------------------------------------------------

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    const value = () => {
      const next = rest[index + 1];
      if (next === undefined || next.startsWith('--')) throw new Error(`${argument} needs a value`);
      index += 1;
      return next;
    };
    if (argument === '--campaign') options.campaignFile = path.resolve(value());
    else if (argument === '--root') options.root = path.resolve(value());
    else if (argument === '--clio-entry') options.entry = value();
    else if (argument === '--target') options.target = value();
    else if (argument === '--model') options.model = value();
    else if (argument === '--effort') options.effort = value();
    else if (argument === '--budget-usd') options.budgetUsd = Number(value());
    else if (argument === '--timeout-minutes') options.timeoutMinutes = Number(value());
    else if (argument === '--json') options.json = true;
    else throw new Error(`unknown option ${argument}`);
    if (/credential|api[-_]?key|token|secret/iu.test(String(rest[index]))) throw new Error('pass credentials only through their environment variable, never on the command line');
  }
  return options;
}

function usage() {
  return [
    'Usage: node evaluation/tools/run-clio-campaign.js <plan|prepare|execute|collect> [options]',
    '',
    '  plan     [--clio-entry <abs>]                 identities and steps; no credentials, no writes',
    '  prepare  --root <new dir> --clio-entry <abs>  disposable profile, both packages, native discovery',
    '  execute  --root <prepared> --clio-entry <abs> --target <t> --model <m> --effort <e> --budget-usd <n>',
    `           needs ${CONFIRM_ENV}, ${SETTINGS_ENV} and ${CREDENTIALS_ENV}; author gates come back author-unavailable`,
    '  collect  --root <prepared>                    independent verification of records and sealed answers',
    '',
    `Default campaign: ${path.relative(ROOT, DEFAULT_CAMPAIGN)}`
  ].join('\n');
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (!['plan', 'prepare', 'execute', 'collect'].includes(options.command)) {
    process.stderr.write(`${usage()}\n`);
    return 2;
  }
  const campaign = loadCampaign(options.campaignFile);
  let output;
  if (options.command === 'plan') output = plan(campaign, options);
  else if (options.command === 'prepare') output = prepare(campaign, options).prepared;
  else if (options.command === 'execute') output = await execute(campaign, options);
  else output = collect(campaign, options);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  main().then(code => { process.exitCode = code; }, error => {
    process.stderr.write(`campaign: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  canonical,
  classifyStep,
  clioIdentity,
  collect,
  confirmValue,
  directoryDigest,
  execute,
  loadCampaign,
  parseArgs,
  plan,
  prepare,
  profilePaths,
  verifySeal,
  workspaceDigest
};
