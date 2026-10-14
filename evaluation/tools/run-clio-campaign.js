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
// A tool call naming the desk's seal store is an attempt on the key that makes answers attestable.
const STORE_ACCESS = /extensions[\\/]+wtfp[\\/]+store\.json|seal-key/u;
// What a step's cost covers: Clio's sealed receipts, the main agent's and every dispatched worker's.
const COST_SCOPE = 'Clio run receipts: the main agent and every worker it dispatched. Model calls Clio records outside receipts, such as compaction, are not counted, and Clio 0.6.2 takes no cost ceiling, so the budget is enforced between steps.';
// Operator-selected Clio files a run copies in; they and any copy Clio makes of them are wiped at the end.
const PRIVATE_FILES = /^\.?(?:credentials|settings)\.yaml/u;
const SCAN_LIMIT = 64 * 1024 * 1024;
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

/** The desk's package tests passed only if the run exited 0 and reported no failure. */
function deskTestsPassed(result) {
  return result.status === 0 && /ℹ fail 0\b/u.test(`${result.stdout}${result.stderr}`) && /ℹ pass [1-9]/u.test(`${result.stdout}${result.stderr}`);
}

/**
 * What steps actually launch: the Clio entry, the `clio-coder` wrapper the
 * desk and installer find on PATH, and the two installed WTF-P packages.
 */
function launcherIdentity(root, entry, pluginRoot, deskRoot) {
  const wrapper = path.join(root, 'clio', 'bin', 'clio-coder');
  const digest = (directory) => (directory && fs.existsSync(directory) ? directoryDigest(directory) : null);
  return {
    entry,
    entry_sha256: entry && fs.existsSync(entry) ? sha256(fs.readFileSync(entry)) : null,
    dist_sha256: entry && fs.existsSync(entry) ? directoryDigest(path.dirname(path.dirname(entry))) : null,
    wrapper_sha256: fs.existsSync(wrapper) ? sha256(fs.readFileSync(wrapper)) : null,
    plugin_root: pluginRoot,
    plugin_sha256: digest(pluginRoot),
    desk_root: deskRoot,
    desk_sha256: digest(deskRoot)
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
  const passed = deskTestsPassed(deskTests);
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
    launcher: launcherIdentity(root, options.entry, plugin ? plugin.rootPath : null, desk ? desk.rootPath : null),
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
      // Each entry is one JSON array, so no name can forge another entry's line.
      if (entry.isSymbolicLink()) lines.push(JSON.stringify(['link', child, fs.readlinkSync(absolute)]));
      else if (entry.isDirectory()) {
        lines.push(JSON.stringify(['dir', child]));
        visit(child);
      } else if (entry.isFile()) lines.push(JSON.stringify(['file', child, sha256(fs.readFileSync(absolute))]));
      else lines.push(JSON.stringify(['other', child]));
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
 * Cost from Clio's sealed receipts and the provenance each one carries: the
 * main agent's receipt, which `clio-coder run` writes for the whole turn, and
 * every dispatched worker's. A stream's `measured` flag says only that token
 * usage was reported, never what it cost, so it is not used. No main-agent
 * receipt, or any unknown provenance, makes the step's cost unavailable,
 * never zero; an estimate is reported as one.
 */
function stepCost(receipts) {
  const parts = receipts.map(({ receipt }) => ({
    main: Boolean(receipt && receipt.agentId === 'main-agent'),
    usd: receipt ? receipt.costUsd : null,
    provenance: receipt ? receipt.costProvenance : 'unknown'
  }));
  const usable = parts.some(part => part.main) &&
    parts.every(part => Number.isFinite(part.usd) && part.usd >= 0 && ['known', 'known_free', 'estimated'].includes(part.provenance));
  const status = !usable ? 'unavailable' : parts.some(part => part.provenance === 'estimated') ? 'estimated' : 'reported';
  return {
    status,
    usd: status === 'unavailable' ? null : parts.reduce((sum, part) => sum + part.usd, 0),
    sources: { main_receipts: parts.filter(part => part.main).length, worker_receipts: parts.filter(part => !part.main).length },
    scope: COST_SCOPE
  };
}

/**
 * The models that served a step as the providers reported them, never as
 * requested: a main-agent message's `responseModel` and each worker call's
 * `responseModelIdObservation`. A call without a report is counted, not
 * assumed to be the requested model.
 */
/** The model id a Clio response-model observation reports, or null when it reports none. */
function reportedModel(observation) {
  if (!observation || typeof observation !== 'object') return null;
  if (observation.state === 'reported' && typeof observation.reportedModelId === 'string') return observation.reportedModelId;
  if (observation.state === 'legacy-difference-only' && typeof observation.differingModelId === 'string') return observation.differingModelId;
  return null;
}

function modelObservation(messages, receipts, selected) {
  const workers = receipts.map(({ receipt }) => receipt).filter(receipt => receipt && receipt.agentId !== 'main-agent');
  const calls = [
    // Clio records a provider's report on the message itself for some API families and as responseModel for others.
    ...messages.map(message => reportedModel(message.responseModelIdObservation) ?? (typeof message.responseModel === 'string' ? message.responseModel : null)),
    // A run-aggregate row sums a worker's calls; it is not one more call.
    ...workers.flatMap(receipt => (Array.isArray(receipt.upstreamResponses) ? receipt.upstreamResponses : [])
      .filter(response => response && response.usageScope !== 'run-aggregate')
      .map(response => reportedModel(response.responseModelIdObservation) ?? (typeof response.differingResponseModelId === 'string' ? response.differingResponseModelId : null)))
  ];
  const reported = [...new Set(calls.filter(model => typeof model === 'string'))].sort();
  const unreported = calls.filter(model => model === null).length;
  return {
    requested: [...new Set([...messages.map(message => message.model), ...workers.map(receipt => receipt.wireModelId)].filter(model => typeof model === 'string'))].sort(),
    reported,
    calls: calls.length,
    unreported_calls: unreported,
    status: reported.length === 0 ? 'unobserved' : reported.some(model => model !== selected) ? 'differs' : unreported > 0 ? 'partial' : 'matches'
  };
}

/** The thinking level Clio resolved for the main agent and what providers reported they used. */
function effortObservation(messages, receipts) {
  const main = receipts.map(({ receipt }) => receipt).filter(receipt => receipt && receipt.agentId === 'main-agent' && receipt.runtimeResolution);
  const distinct = (values) => [...new Set(values.filter(value => typeof value === 'string'))].sort();
  const effective = distinct(main.map(receipt => receipt.runtimeResolution.effectiveThinkingLevel));
  return {
    requested: distinct(main.map(receipt => receipt.runtimeResolution.requestedThinkingLevel)),
    effective,
    provider_reported: distinct(messages.map(message => message.providerThinkingLevel)),
    status: effective.length > 0 ? 'observed' : 'unobserved'
  };
}

/**
 * One step's outcome from its process result, its JSON event stream, the
 * receipts Clio sealed for it and the project state it left, all judged
 * structurally. A step that ran a network tool or reached for the seal store
 * violated the campaign's policy. A recorded answer no sealed author answer
 * stands behind, or an interaction record added by a headless step, which no
 * author could have given, is an integrity violation. A step that failed is
 * failed whatever else it left. A blocking gate still pending is an author the
 * session could not ask, and a gated step that raised no gate skipped its
 * author; neither is ever a completed action.
 */
function classifyStep(result, stdoutText, stderrText, context = {}) {
  const frames = [];
  for (const line of stdoutText.split('\n')) {
    if (!line.trim()) continue;
    try { frames.push(JSON.parse(line)); } catch { /* non-JSON progress lines are kept only in the raw log */ }
  }
  const events = frames.filter(frame => frame !== null && typeof frame === 'object');
  const receipts = context.receipts || [];
  const gates = context.gates || { pending: [], unconfirmed: [] };
  const added = context.interactionsAdded || [];
  const tools = {};
  let networkCalls = 0;
  let storeCalls = 0;
  let blockedCalls = 0;
  for (const event of events) {
    if (event.type === 'tool_execution_start') {
      const name = String(event.toolName ?? event.tool ?? event.name ?? 'unknown');
      tools[name] = (tools[name] || 0) + 1;
      if (NETWORK_TOOLS.has(name)) networkCalls += 1;
      if (STORE_ACCESS.test(JSON.stringify(event.args ?? {}))) storeCalls += 1;
    } else if (event.type === 'tool_execution_end' && event.outcome === 'blocked') blockedCalls += 1;
  }
  const messages = events.filter(event => event.type === 'message_end' && event.message && event.message.role === 'assistant').map(event => event.message);
  const gated = Boolean(context.step && context.step.author_gate);
  let outcome = 'completed';
  if (context.cancelled || (result.signal && !result.timedOut)) outcome = 'cancelled';
  else if (result.timedOut) outcome = 'timed-out';
  else if (networkCalls > 0 || storeCalls > 0) outcome = 'policy-violation';
  else if (gates.unconfirmed.length > 0 || added.length > 0) outcome = 'integrity-violation';
  else if (result.exitCode !== 0) outcome = 'failed';
  else if (gates.pending.length > 0) outcome = 'author-unavailable';
  else if (gated) outcome = 'gate-not-raised';
  const cost = stepCost(receipts);
  const models = modelObservation(messages, receipts, context.selection ? context.selection.model : null);
  return {
    outcome,
    exit_code: result.exitCode,
    signal: result.signal,
    latency_ms: result.latencyMs,
    process_group: result.processGroup,
    events: events.length,
    // A provider error is not a model's output, so it is not counted as an observed call.
    model_calls: messages.filter(message => message.stopReason !== 'error').length + receipts.filter(({ receipt }) => receipt && receipt.agentId !== 'main-agent').length,
    tools: { calls: tools, network_calls: networkCalls, store_calls: storeCalls, blocked_calls: blockedCalls },
    gates,
    interactions_added: added,
    observed_models: models.reported,
    model_observation: models,
    effort_observation: effortObservation(messages, receipts),
    receipts: receipts.map(({ file }) => file),
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
  if (stat.isDirectory()) throw new Error(`${path.basename(file)} is a directory, not a copy the run made; left in place`);
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

/** The operator's settings and credentials copies, and any backup or temporary sibling Clio left beside them; returns what it could not wipe. */
function wipePrivate(config) {
  const failures = [];
  if (!fs.existsSync(config)) return failures;
  for (const name of fs.readdirSync(config)) {
    if (!PRIVATE_FILES.test(name)) continue;
    try {
      wipe(path.join(config, name));
    } catch (error) {
      failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return failures;
}

const RUN_MARKER = 'WTFP_CAMPAIGN_RUN';

/**
 * Stops every process still carrying this run's marker: anything a step left
 * running, detached or not, once the step is over. Linux only; elsewhere the
 * record says the sweep did not run. A process that dropped its environment
 * cannot be found this way.
 */
function sweepRun(marker) {
  if (process.platform !== 'linux' || !fs.existsSync('/proc')) return { swept: false, killed: [] };
  const killed = [];
  for (const name of fs.readdirSync('/proc')) {
    if (!/^\d+$/u.test(name) || Number(name) === process.pid) continue;
    let environ;
    try {
      environ = fs.readFileSync(`/proc/${name}/environ`, 'utf8');
    } catch {
      continue;
    }
    if (!environ.split('\0').includes(`${RUN_MARKER}=${marker}`)) continue;
    try {
      process.kill(Number(name), 'SIGKILL');
      killed.push(Number(name));
    } catch {
      // Already gone.
    }
  }
  return { swept: true, killed };
}

/**
 * Takes the desk's seal key out of the profile for the length of a run. Every
 * file a step's processes can name, they can read, so the key lives only in
 * this process's memory while headless steps run. A runner killed outright
 * loses it, and earlier answers then read as unconfirmed until the author
 * confirms them again: that fails closed.
 */
function holdStore(file) {
  let bytes = null;
  try {
    if (fs.lstatSync(file).isFile()) bytes = fs.readFileSync(file);
  } catch {
    return null;
  }
  if (bytes !== null) wipe(file);
  return bytes;
}

/** Puts the held key back; a store a step created in the meantime is set aside and reported. */
function restoreStore(file, bytes) {
  let recreated = null;
  if (fs.existsSync(file)) {
    recreated = `${file}.made-during-run-${crypto.randomUUID()}`;
    fs.renameSync(file, recreated);
  }
  if (bytes !== null) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes, { mode: 0o600 });
  }
  return recreated;
}

/** Secret-looking values in the operator's credentials, to search the run's own logs for. */
function secretTokens(text, minimum = 8) {
  return [...new Set(text.match(new RegExp(`[A-Za-z0-9_\\-+/=.]{${minimum},}`, 'gu')) || [])];
}

const SECRET_KEY = /auth|header|token|secret|passw|api[-_]?key|bearer|cookie|credential/iu;

/**
 * The values in a settings file that sit under an authentication key. Model
 * ids and URLs stay out: redacting them would erase the very evidence a run
 * records about which model it called.
 */
function settingsSecrets(text) {
  const stack = [];
  const values = [];
  for (const line of text.split('\n')) {
    const match = /^(\s*)(?:-\s*)?([^:#\s][^:#]*?)\s*:\s*(.*?)\s*$/u.exec(line);
    if (!match) continue;
    const indent = match[1].length;
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
    stack.push({ indent, key: match[2] });
    const value = match[3].replace(/^["']|["']$/gu, '');
    if (value && stack.some(entry => SECRET_KEY.test(entry.key))) values.push(value);
  }
  return values.flatMap(value => secretTokens(value));
}

/**
 * Searches files under `directory` for the operator's secret values. With
 * `redact`, it replaces each one; without, it only reports. Links are never
 * followed, and a file too large to scan is listed rather than assumed clean.
 */
function scanSecrets(directory, tokens, redact) {
  const found = [];
  const unscanned = [];
  if (tokens.length === 0 || !fs.existsSync(directory)) return { found, unscanned };
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) {
        if (fs.statSync(file).size > SCAN_LIMIT) { unscanned.push(file); continue; }
        const content = fs.readFileSync(file, 'utf8');
        if (!tokens.some(token => content.includes(token))) continue;
        found.push(file);
        if (redact) {
          let scrubbed = content;
          for (const token of tokens) scrubbed = scrubbed.split(token).join('[REDACTED]');
          fs.writeFileSync(file, scrubbed);
        }
      }
    }
  };
  visit(directory);
  return { found, unscanned };
}

/** The interaction record files in the workspace, by name. */
function interactionFiles(workspace) {
  const directory = path.join(workspace, '.planning', 'interactions');
  return fs.existsSync(directory) && fs.lstatSync(directory).isDirectory() ? new Set(fs.readdirSync(directory).filter(name => name.endsWith('.json'))) : new Set();
}

/** Refuses to start a step on a launcher or installed package other than the one prepare bound. */
function verifyLauncher(root, prepared, entry) {
  const bound = prepared.launcher;
  if (!bound) throw new Error('the prepared root records no launcher identity; prepare a new root');
  const now = launcherIdentity(root, entry, bound.plugin_root, bound.desk_root);
  for (const key of ['entry', 'entry_sha256', 'dist_sha256', 'wrapper_sha256', 'plugin_sha256', 'desk_sha256']) {
    if (now[key] !== bound[key]) throw new Error(`the launcher changed since prepare (${key}); prepare a new root`);
  }
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
  verifyLauncher(root, prepared, options.entry);
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
  // Every credential value is a secret, and so is a settings value under an auth key, such as a target's headers.
  const secrets = [...new Set([
    ...secretTokens(fs.readFileSync(path.join(config, 'credentials.yaml'), 'utf8')),
    ...settingsSecrets(fs.readFileSync(path.join(config, 'settings.yaml'), 'utf8'))
  ])];
  const receipts = path.join(profilePaths(root).CLIO_CODER_STATE_DIR, 'receipts');
  const storeFile = path.join(profilePaths(root).CLIO_CODER_STATE_DIR, 'extensions', 'wtfp', 'store.json');
  const preparedSha = sha256(fs.readFileSync(preparedFile));
  const marker = crypto.randomUUID();
  const run = {
    schema: 'wtfp.evaluation.campaign-run/v2',
    campaign: prepared.campaign,
    evidence_level: 'pending',
    clio: bound.identity.observed,
    clio_unpinned: bound.identity.mismatches,
    wtfp: bound.wtfp,
    fixture: bound.fixture,
    selection: { target: options.target, model: options.model, effort: options.effort, budget_usd: options.budgetUsd, selected_by: 'operator' },
    step_environment: { ...STEP_GUARDS, network_sandbox: 'none: retrieval tools are removed, but bash and provider traffic are not sandboxed' },
    timeout_minutes: timeoutMinutes,
    resources,
    workspace: { prepared_sha256: prepared.workspace_sha256, initial_sha256: bound.initial, head: workspaceHead(workspace) },
    prepared_record_sha256: preparedSha,
    started_at: new Date().toISOString(),
    steps: [],
    outcome: 'running'
  };
  let spent = 0;
  let costStatus = 'reported';
  let persisted = false;
  let held = null;
  const integrity = [];
  const attempt = (label, work) => {
    try {
      return work();
    } catch (error) {
      integrity.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  };
  const persist = () => {
    if (persisted) return;
    persisted = true;
    run.ended_at = new Date().toISOString();
    if (run.outcome === 'running') run.outcome = 'cancelled';
    run.cost ??= costStatus === 'unavailable' ? { status: 'unavailable', usd: null, scope: COST_SCOPE } : { status: costStatus, usd: spent, scope: COST_SCOPE };
    // Model evidence is claimed only for a run in which a model call was actually seen.
    run.evidence_level = run.steps.some(step => step.model_calls > 0) ? 'observed-model' : 'no-model-call-observed';
    // Nothing a step left running may outlive the run, and the key returns only after it is gone.
    run.processes_swept_at_end = attempt('sweep', () => sweepRun(marker)) ?? { swept: false, killed: [] };
    const made = attempt('seal store', () => restoreStore(storeFile, held));
    if (made) integrity.push(`a seal store was created during the run and set aside as ${path.relative(root, made)}`);
    run.seal_store = { held_during_run: held !== null, restored: held !== null && !integrity.some(item => item.startsWith('seal store')) };
    const unwiped = attempt('wipe', () => wipePrivate(config)) ?? [];
    run.credentials_removed = fs.existsSync(config) && !fs.readdirSync(config).some(name => PRIVATE_FILES.test(name) && fs.lstatSync(path.join(config, name)).isFile());
    if (unwiped.length > 0) run.unwiped = unwiped;
    const redacted = [path.join(root, 'logs'), path.join(root, 'clio')].map(directory => attempt('redaction', () => scanSecrets(directory, secrets, true)) ?? { found: [], unscanned: [directory] });
    const workspaceSecrets = attempt('workspace scan', () => scanSecrets(workspace, secrets, false)) ?? { found: [], unscanned: [workspace] };
    run.secrets = {
      redacted_files: redacted.flatMap(item => item.found).map(file => path.relative(root, file)),
      in_workspace: workspaceSecrets.found.map(file => path.relative(root, file)),
      unscanned: [...redacted, workspaceSecrets].flatMap(item => item.unscanned).map(file => path.relative(root, file))
    };
    // The run's own records are the runner's: a step that wrote or changed them tampered with the evidence.
    const target = path.join(root, 'run.json');
    if (fs.existsSync(target)) {
      const aside = `run.json.written-during-run-${crypto.randomUUID()}`;
      fs.renameSync(target, path.join(root, aside));
      integrity.push(`run.json was written during the run and set aside as ${aside}`);
    }
    if (sha256(fs.readFileSync(preparedFile)) !== preparedSha) integrity.push('prepared.json changed during the run');
    if (integrity.length > 0) {
      run.integrity = integrity;
      run.outcome = 'integrity-violation';
    }
    const staging = path.join(root, `.run.json.${crypto.randomUUID()}.partial`);
    writeJson(staging, run);
    fs.renameSync(staging, target);
  };
  // The first signal stops the step and the loop records it; a second exits the process, so the run is recorded first, as cancelled.
  const signals = installExecutionSignalHandlers(() => {
    wipePrivate(config);
    if (signals.state.count > 1) persist();
  });
  try {
    held = holdStore(storeFile);
    for (const step of campaign.lifecycle) {
      if (signals.state.signal) { run.outcome = 'cancelled'; break; }
      const env = { ...sanitizedChildEnv(profilePaths(root, step.session)), ...STEP_GUARDS, [RUN_MARKER]: marker };
      env.PATH = [path.join(root, 'clio', 'bin'), env.PATH].join(path.delimiter);
      const logs = path.join(root, 'logs', step.step);
      verifyLauncher(root, prepared, options.entry);
      // The step's log directory is new or the run stops: a step may not prepare the next one's logs.
      fs.mkdirSync(path.join(root, 'logs'), { recursive: true, mode: 0o700 });
      fs.mkdirSync(logs, { mode: 0o700 });
      const before = listReceipts(receipts);
      const interactionsBefore = interactionFiles(workspace);
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
        interactionsAdded: [...interactionFiles(workspace)].filter(name => !interactionsBefore.has(name)).sort(),
        step,
        selection: options,
        cancelled: Boolean(signals.state.signal)
      });
      if (classified.cost.status === 'unavailable') costStatus = 'unavailable';
      else {
        spent += classified.cost.usd;
        if (classified.cost.status === 'estimated' && costStatus === 'reported') costStatus = 'estimated';
      }
      const swept = sweepRun(marker);
      run.steps.push({
        step: step.step, action: step.action, session: step.session, prompt: prompt(step), author_gate: step.author_gate,
        ...classified,
        processes_swept: swept,
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
  } catch (error) {
    // A failure of the runner itself is its own outcome, never a cancellation.
    run.outcome = 'runner-error';
    run.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    signals.remove();
    run.cost = costStatus === 'unavailable' ? { status: 'unavailable', usd: null, scope: COST_SCOPE } : { status: costStatus, usd: spent, scope: COST_SCOPE };
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
 * the author's only under the desk's trust rule: the newest interaction that
 * matches the checkpoint's recorded outcome, given at the desk's interview, for
 * this project and exactly what the checkpoint asks, sealed under this
 * profile's key. An interaction that appeared during a headless execute step
 * is never the author's, whatever its seal says: no author was there.
 */
function collect(campaign, options) {
  const root = path.resolve(options.root);
  const prepared = readJson(path.join(root, 'prepared.json'));
  const workspace = path.join(root, prepared.workspace);
  const before = workspaceDigest(workspace);
  const planning = path.join(workspace, '.planning');
  const state = deskState(root, workspace);
  let schemas = null;
  let schemaError = null;
  try {
    schemas = fs.existsSync(planning) ? validatePlanningPaths([workspace], { coverage: true }) : null;
  } catch (error) {
    // The validator refuses to follow a link; that is a finding about the project, not a reason to stop collecting.
    schemaError = error instanceof Error ? error.message : String(error);
  }
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
  const runFile = path.join(root, 'run.json');
  const run = fs.existsSync(runFile) ? readJson(runFile) : null;
  const headless = new Set((run ? run.steps : []).flatMap(step => (step.interactions_added || []).map(name => name.replace(/\.json$/u, ''))));
  const decisions = state.checkpoints.filter(entry => entry.trust !== 'snapshot').map(entry => {
    const fromHeadless = entry.answer && headless.has(entry.answer.id);
    return {
      checkpoint: entry.record.id,
      status: entry.record.status,
      blocking: entry.record.blocking === true,
      resolved_by: entry.record.resolution ? entry.record.resolution.resolved_by : null,
      ...(entry.record.resolution && entry.record.resolution.selected_option ? { selected_option: entry.record.resolution.selected_option } : {}),
      trust: fromHeadless ? 'sealed-during-headless-step' : entry.trust,
      attested_by: entry.answer && !fromHeadless ? entry.answer.id : null
    };
  });
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
    records: schemaError ? { valid: false, error: schemaError } : schemas ? { valid: schemas.valid, checked: schemas.checked } : null,
    coverage: schemas && schemas.coverage ? schemas.coverage.map(item => ({ valid: item.valid, findings: item.findings, claims: item.claims, scope: item.scope })) : [],
    interactions,
    decisions,
    unattested_author_resolutions: decisions.filter(item => ['unattested', 'foreign', 'sealed-during-headless-step'].includes(item.trust)).map(item => item.checkpoint),
    headless_interactions: [...headless].sort(),
    waived: decisions.filter(item => item.status === 'waived').map(item => ({ checkpoint: item.checkpoint, trust: item.trust })),
    policy_resolutions: decisions.filter(item => item.trust === 'policy').map(item => ({ checkpoint: item.checkpoint, blocking: item.blocking })),
    workspace_chain: {
      prepared: prepared.workspace_sha256,
      run_initial: run ? run.workspace.initial_sha256 : null,
      run_final: lastStep ? lastStep.workspace_sha256 : null,
      collected: before,
      prepared_matches_run: run ? run.workspace.prepared_sha256 === prepared.workspace_sha256 && run.workspace.initial_sha256 === prepared.workspace_sha256 : null,
      changed_since_run: lastStep ? lastStep.workspace_sha256 !== before : null,
      prepared_unchanged_since_run: run ? sha256(fs.readFileSync(path.join(root, 'prepared.json'))) === run.prepared_record_sha256 : null,
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
  deskTestsPassed,
  directoryDigest,
  execute,
  fixtureIdentity,
  launcherIdentity,
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
