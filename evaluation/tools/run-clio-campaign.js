#!/usr/bin/env node

'use strict';

// Runner for versioned Clio campaigns (evaluation/v2). `plan` and `prepare`
// need no credentials and run no model. `execute` runs the campaign lifecycle
// headless with resources the operator selects for that run, on exactly the
// campaign, Clio build, WTF-P candidate and workspace that `prepare` bound;
// every author gate it reaches is reported as a typed unavailable result,
// never answered. `collect` verifies a prepared workspace independently of the
// desk with the desk's own trust rules (evaluation/lib/desk-trust.js),
// including sealed author answers from an interactive session in the same
// profile. Each stage records the workspace digest it found, so the three
// form a chain. The historical evaluation/v1 runners and evidence are not used
// or changed.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { SchemaRegistry, validateInstance } = require('../lib/json-schema');
const { inventoryFixture } = require('../lib/fixture-hashes');
const deskTrust = require('../lib/desk-trust');
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
// Everything that decides what a campaign run means: the packages, the
// desk, the evaluator and its campaign definitions, and the build scripts.
const PACKAGE_PATHS = ['bin', 'protocol', 'vendors', 'clio', 'evaluation', 'scripts', 'package.json'];
// Clio's retrieval tools; disabled for every step, and any call to one is a policy violation.
const NETWORK_TOOLS = new Set(['web_fetch', 'web_read']);
// Clio's switches for a step: no retrieval tools, and every Clio directory under the run's CLIO_CODER_HOME.
const STEP_GUARDS = { CLIO_CODER_DISABLE_RETRIEVE_TOOLS: '1', CLIO_CODER_REQUIRE_HOME_PREFIX: '1' };
const GIT_ENV = { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

const { canonical } = deskTrust;

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
  if (fixture.evaluator_oracles_sha256 !== campaign.fixture.evaluator_oracles_sha256) {
    throw new Error(`${campaign.fixture.path} evaluator oracles changed since the campaign pinned them; a new meaning needs a new fixture version`);
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

/** The fixture as the repository holds it: the last commit that touched it, whether it is clean, and its pinned digests. */
function fixtureIdentity(campaign) {
  const git = (args) => spawnSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' });
  const commit = git(['log', '-1', '--format=%H', '--', campaign.fixture.path]);
  const status = git(['status', '--porcelain', '--', campaign.fixture.path]);
  const inventory = inventoryFixture(path.join(ROOT, campaign.fixture.path));
  return {
    path: campaign.fixture.path,
    source_commit: commit.status === 0 && commit.stdout.trim() ? commit.stdout.trim() : null,
    tree: status.status !== 0 ? 'unknown' : status.stdout.trim() === '' ? 'clean' : 'dirty',
    model_inputs_sha256: inventory.model_inputs_sha256,
    evaluator_oracles_sha256: inventory.evaluator_oracles_sha256
  };
}

/** The workspace checkout's HEAD, so a commit or reset in the workspace shows beside its file digest. */
function workspaceHead(workspace) {
  const head = spawnSync('git', ['-C', workspace, 'rev-parse', '--verify', '--quiet', 'HEAD'], { encoding: 'utf8', env: { ...process.env, ...GIT_ENV } });
  return head.status === 0 ? head.stdout.trim() : null;
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
  const fixture = fixtureIdentity(campaign);
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
  const gitEnv = { ...process.env, ...GIT_ENV };
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
  // Discovery is separate evidence from validity and from any `fleet run` outcome.
  const listed = native(['playbook', 'list'], workspace);
  record('playbook-list', listed, ['wtfp-plan-section', 'wtfp-draft-review'].every(name => new RegExp(`^${name}\\s+plugin\\s+valid\\b`, 'mu').test(listed.stdout)), null);
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
    allow_dirty: wtfp.package_tree !== 'clean',
    fixture: { ...fixture, evaluator_oracles_copied: false },
    workspace: path.relative(root, workspace),
    workspace_sha256: workspaceDigest(workspace),
    workspace_head: workspaceHead(workspace),
    checks,
    native_observations: observations,
    interactive_session: {
      note: 'Run Clio interactively in this profile to answer author gates; collect verifies what the desk sealed.',
      environment: profilePaths(root, 'S1'),
      command: `${options.entry} (cwd ${workspace})`
    }
  };
  // A root whose checks failed holds no prepared.json, so execute can never run on it.
  if (!checks.every(check => check.passed)) {
    writeJson(path.join(root, 'prepare-failed.json'), prepared);
    throw new Error(`native discovery failed: ${checks.filter(check => !check.passed).map(check => check.name).join(', ')}; see ${path.join(root, 'prepare-failed.json')}`);
  }
  writeJson(path.join(root, 'prepared.json'), prepared);
  return { root, prepared };
}

/**
 * SHA-256 over every entry below the workspace: file bytes, link targets,
 * directories (so an empty one counts) and anything else by kind. The
 * checkout's .git is left to `workspaceHead`, because git rewrites its own
 * index on a read-only `git status`.
 */
function workspaceDigest(workspace) {
  const lines = [];
  const visit = (relative) => {
    for (const entry of fs.readdirSync(path.join(workspace, relative), { withFileTypes: true })) {
      if (relative === '' && entry.name === '.git') continue;
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      const absolute = path.join(workspace, child);
      if (entry.isSymbolicLink()) lines.push(`link ${child} -> ${fs.readlinkSync(absolute)}`);
      else if (entry.isDirectory()) {
        lines.push(`dir ${child}/`);
        visit(child);
      } else if (entry.isFile()) lines.push(`file ${child} ${sha256(fs.readFileSync(absolute))}`);
      else lines.push(`other ${child}`);
    }
  };
  visit('');
  return sha256(lines.sort().join('\n'));
}

// --- execute ------------------------------------------------------------------------

function readJsonQuietly(file) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile()) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** The JSON records in one .planning directory; unreadable or linked files are skipped, never trusted. */
function readRecords(directory) {
  if (!fs.existsSync(directory) || !fs.lstatSync(directory).isDirectory()) return [];
  return fs.readdirSync(directory).filter(name => name.endsWith('.json') && !name.startsWith('.')).sort()
    .map(name => readJsonQuietly(path.join(directory, name)))
    .filter(record => record !== null && typeof record === 'object' && !Array.isArray(record));
}

/** The desk's seal key from the run's extension store, read the way the desk stores it. */
function sealKey(root) {
  const stored = readJsonQuietly(path.join(profilePaths(root).CLIO_CODER_STATE_DIR, 'extensions', 'wtfp', 'store.json'));
  const value = stored && stored.entries && stored.entries['seal-key'] && stored.entries['seal-key'].value;
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value) ? Buffer.from(value, 'hex') : null;
}

/** Every checkpoint in the workspace with the trust the desk would give its recorded state. */
function deskState(root, workspace) {
  const planning = path.join(workspace, '.planning');
  const manifest = readJsonQuietly(path.join(planning, 'project.json'));
  const projectId = manifest && typeof manifest.id === 'string' ? manifest.id : null;
  const key = sealKey(root);
  const interactions = readRecords(path.join(planning, 'interactions')).filter(record => record.schema === 'wtfp.project.interaction/v1');
  const checkpoints = readRecords(path.join(planning, 'checkpoints')).filter(record => typeof record.id === 'string');
  return {
    key,
    projectId,
    interactions,
    checkpoints: checkpoints.map(record => ({ record, ...deskTrust.trustOf(record, interactions, key, projectId) }))
  };
}

/** Blocking gates still waiting on the author, and recorded answers no sealed author answer stands behind. */
function gateSummary(state) {
  const blocking = state.checkpoints.filter(entry => entry.record.blocking === true);
  return {
    pending: blocking.filter(entry => entry.trust === 'pending').map(entry => entry.record.id),
    unconfirmed: blocking.filter(entry => ['unattested', 'foreign', 'policy'].includes(entry.trust)).map(entry => entry.record.id)
  };
}

function listReceipts(directory) {
  if (!fs.existsSync(directory)) return new Set();
  return new Set(fs.readdirSync(directory).filter(name => name.endsWith('.json')));
}

/** Receipts of the workers a step dispatched: the ones that appeared while it ran. */
function newReceipts(directory, before) {
  return [...listReceipts(directory)].filter(name => !before.has(name)).sort()
    .map(name => ({ file: name, receipt: readJsonQuietly(path.join(directory, name)) }));
}

/**
 * Cost from where Clio says it came from. A main-agent segment counts when its
 * usage is measured and not estimated; a worker receipt by its sealed
 * provenance. Anything unmeasured or unknown makes the step's cost
 * unavailable, never zero; an estimate is reported as one.
 */
function stepCost(segments, receipts) {
  const parts = [
    ...segments.map(usage => ({
      usd: usage.costUsd,
      provenance: usage.measured === true && usage.estimated !== true ? 'known' : usage.estimated === true ? 'estimated' : 'unknown'
    })),
    ...receipts.map(({ receipt }) => ({ usd: receipt ? receipt.costUsd : null, provenance: receipt ? receipt.costProvenance : 'unknown' }))
  ];
  const usable = parts.length > 0 && parts.every(part => Number.isFinite(part.usd) && part.usd >= 0 && ['known', 'known_free', 'estimated'].includes(part.provenance));
  const status = !usable ? 'unavailable' : parts.some(part => part.provenance === 'estimated') ? 'estimated' : 'reported';
  return {
    status,
    usd: status === 'unavailable' ? null : parts.reduce((sum, part) => sum + part.usd, 0),
    sources: { main_segments: segments.length, worker_receipts: receipts.length }
  };
}

/**
 * One step's outcome from its process result, its JSON event stream, the
 * receipts of the workers it dispatched and the gates it left. A blocking gate
 * still pending is an author the session could not ask; a recorded answer
 * with no sealed author answer behind it is an integrity violation; neither is
 * ever a completed action.
 */
function classifyStep(result, stdoutText, stderrText, context = {}) {
  const frames = [];
  for (const line of stdoutText.split('\n')) {
    if (!line.trim()) continue;
    try { frames.push(JSON.parse(line)); } catch { /* non-JSON progress lines are kept only in the raw log */ }
  }
  const events = frames.filter(frame => frame !== null && typeof frame === 'object');
  const text = `${stdoutText}\n${stderrText}`;
  const receipts = context.receipts || [];
  const gates = context.gates || { pending: [], unconfirmed: [] };
  const tools = {};
  let networkCalls = 0;
  let blockedCalls = 0;
  for (const event of events) {
    if (event.type === 'tool_execution_start') {
      const name = String(event.toolName ?? event.tool ?? event.name ?? 'unknown');
      tools[name] = (tools[name] || 0) + 1;
      if (NETWORK_TOOLS.has(name)) networkCalls += 1;
    } else if (event.type === 'tool_execution_end' && event.outcome === 'blocked') blockedCalls += 1;
  }
  const segments = events.filter(event => event.type === 'agent_end' && event.usage && typeof event.usage === 'object').map(event => event.usage);
  const models = [
    ...events.filter(event => event.type === 'message_end' && event.message && event.message.role === 'assistant')
      .map(event => ({ source: 'main', target: event.message.provider ?? null, model: event.message.model ?? null })),
    ...receipts.map(({ file, receipt }) => ({ source: `receipt ${file}`, target: receipt ? receipt.targetId ?? null : null, model: receipt ? receipt.wireModelId ?? null : null }))
  ];
  const distinct = [...new Map(models.map(item => [`${item.target}\u0000${item.model}`, { target: item.target, model: item.model }])).values()];
  const selected = context.selection ? context.selection.model : null;
  let outcome = 'completed';
  if (context.cancelled || (result.signal && !result.timedOut)) outcome = 'cancelled';
  else if (result.timedOut) outcome = 'timed-out';
  else if (networkCalls > 0) outcome = 'policy-violation';
  else if (gates.unconfirmed.length > 0) outcome = 'integrity-violation';
  else if (gates.pending.length > 0 || HEADLESS_GATE.test(text)) outcome = 'author-unavailable';
  else if (result.exitCode !== 0) outcome = 'failed';
  const cost = stepCost(segments, receipts);
  return {
    outcome,
    exit_code: result.exitCode,
    signal: result.signal,
    latency_ms: result.latencyMs,
    process_group: result.processGroup,
    events: events.length,
    tools: { calls: tools, network_calls: networkCalls, blocked_calls: blockedCalls },
    gates,
    observed_models: distinct,
    model_observation: distinct.length === 0 ? 'unobserved' : selected !== null && distinct.every(item => item.model === selected) ? 'matches' : 'differs',
    cost,
    cost_usd: cost.usd,
    cost_status: cost.status
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

/** Overwrites and removes a credential copy, never following a link; a link is only removed. */
function wipe(file) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    return;
  }
  if (stat.isFile()) {
    const handle = fs.openSync(file, 'r+');
    try {
      fs.writeSync(handle, Buffer.alloc(stat.size), 0, stat.size, 0);
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
  }
  fs.unlinkSync(file);
}

/** The credential copy and any backup or temporary sibling a tool left beside it. */
function wipeCredentials(config) {
  if (!fs.existsSync(config)) return;
  for (const name of fs.readdirSync(config)) if (/^credentials\.yaml/u.test(name)) wipe(path.join(config, name));
}

/** Secret-looking values in the operator's credentials, to search the run's own logs for. */
function secretTokens(text) {
  return [...new Set(text.match(/[A-Za-z0-9_\-+/=.]{16,}/gu) || [])];
}

/** Replaces any credential value found in the run's logs; returns how many files held one. */
function redactLogs(directory, tokens) {
  if (tokens.length === 0 || !fs.existsSync(directory)) return 0;
  let redacted = 0;
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) {
        const content = fs.readFileSync(file, 'utf8');
        let scrubbed = content;
        for (const token of tokens) scrubbed = scrubbed.split(token).join('[REDACTED]');
        if (scrubbed !== content) {
          fs.writeFileSync(file, scrubbed);
          redacted += 1;
        }
      }
    }
  };
  visit(directory);
  return redacted;
}

/** Refuses to run unless the campaign, Clio build, WTF-P candidate, fixture and workspace are the ones prepare bound. */
function boundRun(campaign, options, root, prepared) {
  const campaignFile = options.campaignFile || DEFAULT_CAMPAIGN;
  if (prepared.schema !== 'wtfp.evaluation.campaign-prepared/v2' || !prepared.campaign || prepared.campaign.id !== campaign.id || prepared.campaign.version !== campaign.version) {
    throw new Error('the prepared root belongs to another campaign');
  }
  if (sha256(fs.readFileSync(campaignFile)) !== prepared.campaign.sha256) throw new Error('the campaign definition changed since prepare; prepare a new root');
  if (!Array.isArray(prepared.checks) || prepared.checks.length === 0 || !prepared.checks.every(check => check.passed === true)) {
    throw new Error('prepare did not pass every native check on this root; prepare a new root');
  }
  const identity = clioIdentity(options.entry, campaign);
  if (identity.mismatches.length > 0 && !(Array.isArray(prepared.clio_unpinned) && prepared.clio_unpinned.length > 0)) {
    throw new Error(`refusing to execute on an unpinned Clio build: ${identity.mismatches.join('; ')}`);
  }
  for (const key of ['version', 'entry_sha256', 'dist_sha256', 'node']) {
    if (!prepared.clio || identity.observed[key] !== prepared.clio[key]) throw new Error(`the Clio build changed since prepare (${key})`);
  }
  const wtfp = wtfpIdentity();
  if (!prepared.wtfp || wtfp.commit !== prepared.wtfp.commit || canonical(wtfp.packages) !== canonical(prepared.wtfp.packages)) {
    throw new Error('the WTF-P candidate changed since prepare; prepare a new root');
  }
  if (wtfp.package_tree !== 'clean' && prepared.allow_dirty !== true) throw new Error('the WTF-P package tree is dirty; commit the candidate and prepare a new root');
  const fixture = fixtureIdentity(campaign);
  if (!prepared.fixture || fixture.model_inputs_sha256 !== prepared.fixture.model_inputs_sha256 || fixture.evaluator_oracles_sha256 !== prepared.fixture.evaluator_oracles_sha256) {
    throw new Error('the fixture changed since prepare; prepare a new root');
  }
  const workspace = path.join(root, prepared.workspace);
  const initial = workspaceDigest(workspace);
  if (initial !== prepared.workspace_sha256) throw new Error('the workspace changed since prepare; prepare a new root');
  if ((prepared.workspace_head ?? null) !== workspaceHead(workspace)) throw new Error('the workspace checkout moved since prepare; prepare a new root');
  return { identity, wtfp, fixture, workspace, initial };
}

async function execute(campaign, options) {
  const root = path.resolve(options.root);
  const preparedFile = path.join(root, 'prepared.json');
  if (!fs.existsSync(preparedFile)) throw new Error(`${root} has no prepared.json; run prepare first`);
  const prepared = readJson(preparedFile);
  if (!prepared.campaign || prepared.campaign.id !== campaign.id || prepared.campaign.version !== campaign.version) throw new Error('the prepared root belongs to another campaign');
  for (const key of ['target', 'model', 'effort']) {
    if (!options[key]) throw new Error(`execute needs the operator's --${key} for this run`);
  }
  if (!Number.isFinite(options.budgetUsd) || options.budgetUsd <= 0) throw new Error('execute needs the operator\'s --budget-usd ceiling');
  const ceiling = campaign.budget.timeout_minutes_per_step;
  const timeoutMinutes = options.timeoutMinutes === undefined ? ceiling : options.timeoutMinutes;
  if (!Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0 || timeoutMinutes > ceiling) {
    throw new Error(`--timeout-minutes must be above 0 and at most the campaign's ${ceiling} minutes per step`);
  }
  if (process.env[CONFIRM_ENV] !== confirmValue(campaign)) {
    throw new Error(`execute runs a model at the operator's expense; set ${CONFIRM_ENV}=${confirmValue(campaign)} to proceed`);
  }
  if (fs.existsSync(path.join(root, 'run.json')) || fs.existsSync(path.join(root, 'logs'))) throw new Error('this root already holds a run; prepare a new root');
  const bound = boundRun(campaign, options, root, prepared);
  const { workspace } = bound;
  const config = profilePaths(root).CLIO_CODER_CONFIG_DIR;
  const resources = [
    copyPrivateSource(SETTINGS_ENV, path.join(config, 'settings.yaml'), root),
    copyPrivateSource(CREDENTIALS_ENV, path.join(config, 'credentials.yaml'), root)
  ];
  const secrets = secretTokens(fs.readFileSync(path.join(config, 'credentials.yaml'), 'utf8'));
  const receipts = path.join(profilePaths(root).CLIO_CODER_STATE_DIR, 'receipts');
  const run = {
    schema: 'wtfp.evaluation.campaign-run/v2',
    campaign: prepared.campaign,
    evidence_level: 'observed-model',
    clio: bound.identity.observed,
    clio_unpinned: bound.identity.mismatches,
    wtfp: bound.wtfp,
    fixture: bound.fixture,
    selection: { target: options.target, model: options.model, effort: options.effort, budget_usd: options.budgetUsd, selected_by: 'operator' },
    effort_observation: { status: 'unobservable', reason: 'Clio 0.6.2 run streams and worker receipts do not report the thinking level a run used.' },
    step_environment: { ...STEP_GUARDS, network_sandbox: 'none: retrieval tools are removed, but bash and provider traffic are not sandboxed' },
    timeout_minutes: timeoutMinutes,
    resources,
    workspace: { prepared_sha256: prepared.workspace_sha256, initial_sha256: bound.initial, head: workspaceHead(workspace) },
    started_at: new Date().toISOString(),
    steps: [],
    outcome: 'running'
  };
  let spent = 0;
  let costStatus = 'reported';
  let persisted = false;
  const persist = () => {
    if (persisted) return;
    persisted = true;
    wipeCredentials(config);
    run.ended_at = new Date().toISOString();
    if (run.outcome === 'running') run.outcome = 'cancelled';
    run.cost ??= costStatus === 'unavailable' ? { status: 'unavailable', usd: null } : { status: costStatus, usd: spent };
    run.credentials_removed = !fs.readdirSync(config).some(name => /^credentials\.yaml/u.test(name));
    run.logs_redacted = redactLogs(path.join(root, 'logs'), secrets);
    writeJson(path.join(root, 'run.json'), run);
  };
  // The first signal stops the step and the loop records it; a second exits the process, so the run is recorded first, as cancelled.
  const signals = installExecutionSignalHandlers(() => {
    wipeCredentials(config);
    if (signals.state.count > 1) persist();
  });
  try {
    for (const step of campaign.lifecycle) {
      if (signals.state.signal) { run.outcome = 'cancelled'; break; }
      const env = { ...sanitizedChildEnv(profilePaths(root, step.session)), ...STEP_GUARDS };
      env.PATH = [path.join(root, 'clio', 'bin'), env.PATH].join(path.delimiter);
      const logs = path.join(root, 'logs', step.step);
      const before = listReceipts(receipts);
      const startDigest = workspaceDigest(workspace);
      const result = await spawnCaptured({
        executable: process.execPath,
        argv: [options.entry, 'run', '--target', options.target, '--model', options.model, '--thinking', options.effort, '--autonomy', campaign.permissions.autonomy, '--json-events', 'full', prompt(step)],
        cwd: workspace,
        env,
        stdoutFile: path.join(logs, 'stdout.jsonl'),
        stderrFile: path.join(logs, 'stderr.log'),
        timeoutMs: timeoutMinutes * 60000
      });
      const classified = classifyStep(result, fs.readFileSync(path.join(logs, 'stdout.jsonl'), 'utf8'), fs.readFileSync(path.join(logs, 'stderr.log'), 'utf8'), {
        receipts: newReceipts(receipts, before),
        gates: gateSummary(deskState(root, workspace)),
        selection: options,
        cancelled: Boolean(signals.state.signal)
      });
      if (classified.cost.status === 'unavailable') costStatus = 'unavailable';
      else {
        spent += classified.cost.usd;
        if (classified.cost.status === 'estimated' && costStatus === 'reported') costStatus = 'estimated';
      }
      run.steps.push({
        step: step.step, action: step.action, session: step.session, prompt: prompt(step), author_gate: step.author_gate,
        ...classified,
        workspace_before_sha256: startDigest,
        workspace_sha256: workspaceDigest(workspace),
        workspace_head: workspaceHead(workspace)
      });
      if (classified.outcome !== 'completed') {
        run.outcome = classified.outcome === 'author-unavailable' ? 'blocked-author-unavailable' : classified.outcome;
        break;
      }
      // A ceiling that cannot be measured cannot be enforced, so the run stops rather than spend blind.
      if (costStatus === 'unavailable') { run.outcome = 'stopped-cost-unavailable'; break; }
      if (spent >= options.budgetUsd) { run.outcome = 'stopped-budget'; break; }
    }
    if (run.outcome === 'running') run.outcome = 'completed';
  } finally {
    signals.remove();
    run.cost = costStatus === 'unavailable' ? { status: 'unavailable', usd: null } : { status: costStatus, usd: spent };
    persist();
  }
  return run;
}

// --- collect ------------------------------------------------------------------------

/** Verifies a desk seal without the desk, by the desk's own rule. */
function verifySeal(record, key) {
  const state = deskTrust.sealState(record, key);
  return state === 'foreign' && !key ? 'no-key' : state;
}

/**
 * Independent verification of a campaign workspace. It reads, hashes and
 * copies; it never writes into the workspace, and it reports that the
 * workspace digest is unchanged by its own work. A recorded answer counts as
 * the author's only under the desk's trust rule: the newest interaction for
 * that checkpoint, given at the desk's interview, for this project, for
 * exactly what the checkpoint asks and the option it records, sealed under
 * this profile's key.
 */
function collect(campaign, options) {
  const root = path.resolve(options.root);
  const prepared = readJson(path.join(root, 'prepared.json'));
  const workspace = path.join(root, prepared.workspace);
  const before = workspaceDigest(workspace);
  const planning = path.join(workspace, '.planning');
  const state = deskState(root, workspace);
  const schemas = fs.existsSync(planning) ? validatePlanningPaths([workspace], { coverage: true }) : null;
  const interactions = state.interactions.map(record => ({
    id: record.id,
    kind: record.kind,
    subject: record.subject_uri,
    outcome: record.outcome,
    ...(record.selected_option ? { selected_option: record.selected_option } : {}),
    answered_at: record.answered_at,
    channel: record.channel,
    seal: verifySeal(record, state.key)
  }));
  const decisions = state.checkpoints.filter(entry => entry.trust !== 'snapshot').map(entry => ({
    checkpoint: entry.record.id,
    status: entry.record.status,
    blocking: entry.record.blocking === true,
    resolved_by: entry.record.resolution ? entry.record.resolution.resolved_by : null,
    ...(entry.record.resolution && entry.record.resolution.selected_option ? { selected_option: entry.record.resolution.selected_option } : {}),
    trust: entry.trust,
    attested_by: entry.answer ? entry.answer.id : null
  }));
  const runFile = path.join(root, 'run.json');
  const run = fs.existsSync(runFile) ? readJson(runFile) : null;
  const lastStep = run && run.steps.length > 0 ? run.steps[run.steps.length - 1] : null;
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
    evidence_levels: decisions.some(item => item.trust === 'attested') ? ['native-discovery', 'observed-author'] : ['native-discovery'],
    seal_key: state.key ? 'present' : 'absent',
    records: schemas ? { valid: schemas.valid, checked: schemas.checked } : null,
    coverage: schemas && schemas.coverage ? schemas.coverage.map(item => ({ valid: item.valid, findings: item.findings, claims: item.claims, scope: item.scope })) : [],
    interactions,
    decisions,
    unattested_author_resolutions: decisions.filter(item => ['unattested', 'foreign'].includes(item.trust)).map(item => item.checkpoint),
    waived: decisions.filter(item => item.status === 'waived').map(item => ({ checkpoint: item.checkpoint, trust: item.trust })),
    policy_resolutions: decisions.filter(item => item.trust === 'policy').map(item => ({ checkpoint: item.checkpoint, blocking: item.blocking })),
    workspace_chain: {
      prepared: prepared.workspace_sha256,
      run_initial: run ? run.workspace.initial_sha256 : null,
      run_final: lastStep ? lastStep.workspace_sha256 : null,
      collected: before,
      prepared_matches_run: run ? run.workspace.prepared_sha256 === prepared.workspace_sha256 && run.workspace.initial_sha256 === prepared.workspace_sha256 : null,
      changed_since_run: lastStep ? lastStep.workspace_sha256 !== before : null,
      head: workspaceHead(workspace)
    },
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
  // A run that did not complete is not a success, whatever it recorded.
  return options.command === 'execute' && output.outcome !== 'completed' ? 3 : 0;
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
  fixtureIdentity,
  loadCampaign,
  parseArgs,
  plan,
  prepare,
  profilePaths,
  verifySeal,
  workspaceDigest,
  workspaceHead,
  wtfpIdentity
};
