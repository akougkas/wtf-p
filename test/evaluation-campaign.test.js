#!/usr/bin/env node

'use strict';

// Deterministic checks of the versioned Clio campaign runner. A fake Clio stands
// in for the real CLI, so nothing here needs credentials, a model, or a built
// Clio; the opt-in native integration test covers the real build.

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const runner = require('../evaluation/tools/run-clio-campaign');
const deskTrust = require('../evaluation/lib/desk-trust');

const CAMPAIGN_FILE = path.join(ROOT, 'evaluation/v2/campaigns/clio-0.6.2-reference.json');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-campaign-test-'));
let passed = 0;

async function test(name, run) {
  await run();
  passed += 1;
  console.log(`✓ ${name}`);
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function tree(directory) {
  if (!fs.existsSync(directory)) return [];
  const out = [];
  const visit = (relative) => {
    for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) visit(child);
      else out.push(`${child}:${sha256(fs.readFileSync(path.join(directory, child)))}`);
    }
  };
  visit('');
  return out.sort();
}

/** A fake built Clio whose `run` behavior is chosen by FAKE_CLIO_MODE. */
function fakeClio(name, body) {
  const dist = path.join(scratch, name, 'dist');
  fs.mkdirSync(path.join(dist, 'cli'), { recursive: true });
  const entry = path.join(dist, 'cli', 'index.js');
  fs.writeFileSync(entry, `'use strict';
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('Clio Coder 0.6.2'); process.exit(0); }
${body}
`);
  return entry;
}

/**
 * A root as prepare leaves it, bound to this checkout, the fake Clio and the
 * fixture. The fake build is unpinned, and the test tree may be dirty, so the
 * record says both, as prepare does when the operator allows them.
 */
function preparedRoot(name, entry, change = (prepared) => prepared) {
  const campaign = runner.loadCampaign(CAMPAIGN_FILE);
  const root = path.join(scratch, name);
  fs.mkdirSync(path.join(root, 'workspace'), { recursive: true });
  for (const session of ['S1', 'S2']) {
    for (const directory of Object.values(runner.profilePaths(root, session))) {
      if (directory.startsWith(root)) fs.mkdirSync(directory, { recursive: true });
    }
  }
  fs.writeFileSync(path.join(root, 'workspace', 'project-brief.md'), 'A brief.\n');
  const identity = runner.clioIdentity(entry, campaign);
  const wtfp = runner.wtfpIdentity();
  fs.writeFileSync(path.join(root, 'prepared.json'), `${JSON.stringify(change({
    schema: 'wtfp.evaluation.campaign-prepared/v2',
    campaign: { id: campaign.id, version: campaign.version, sha256: sha256(fs.readFileSync(CAMPAIGN_FILE)) },
    wtfp,
    allow_dirty: wtfp.package_tree !== 'clean',
    clio: identity.observed,
    clio_unpinned: identity.mismatches,
    fixture: { ...runner.fixtureIdentity(campaign), evaluator_oracles_copied: false },
    workspace: 'workspace',
    workspace_sha256: runner.workspaceDigest(path.join(root, 'workspace')),
    workspace_head: runner.workspaceHead(path.join(root, 'workspace')),
    checks: [{ name: 'desk-package-tests', passed: true, detail: null }]
  }), null, 2)}\n`);
  return root;
}

/** Lines a fake Clio prints and records it writes into its workspace, as JavaScript source. */
const frame = (value) => `console.log(${JSON.stringify(JSON.stringify(value))});`;
const planningWrite = (relative, value) => `{ const f = require('path').join(process.cwd(), '.planning', ${JSON.stringify(relative)}); require('fs').mkdirSync(require('path').dirname(f), { recursive: true }); require('fs').writeFileSync(f, ${JSON.stringify(JSON.stringify(value))}); }`;
const measured = (costUsd) => frame({ type: 'agent_end', messageCount: 2, usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 15, costUsd, apiCalls: 1, measured: true } });

function privateSource(name, text) {
  const file = path.join(scratch, 'operator', name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, { mode: 0o600 });
  return file;
}

async function withEnv(values, run) {
  const saved = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function main() {
  const campaign = runner.loadCampaign(CAMPAIGN_FILE);
  const executeEnv = {
    WTFP_CAMPAIGN_CONFIRM: runner.confirmValue(campaign),
    WTFP_CAMPAIGN_CLIO_SETTINGS_SOURCE: privateSource('settings.yaml', 'targets: {}\n'),
    WTFP_CAMPAIGN_CLIO_CREDENTIALS_SOURCE: privateSource('credentials.yaml', 'secret-value-that-must-be-wiped\n')
  };
  const selection = { target: 'operator-target', model: 'operator-model', effort: 'medium', budgetUsd: 5 };

  await test('the campaign validates, pins the qualified Clio build, and keeps the v1 fixture meaning', async () => {
    assert.strictEqual(campaign.status, 'awaiting-resources');
    assert.deepStrictEqual([campaign.model.target, campaign.model.model, campaign.model.effort, campaign.budget.ceiling], [null, null, null, null]);
    assert.strictEqual(campaign.clio.source.commit, 'e4b3c7b18e20db767cdc92139b85dac6d1219d1a');
    const v1 = JSON.parse(fs.readFileSync(path.join(ROOT, campaign.fixture.path, 'manifest.json'), 'utf8'));
    assert.strictEqual(campaign.fixture.model_inputs_sha256, v1.model_inputs_sha256);
    const drifted = path.join(scratch, 'drifted.json');
    fs.writeFileSync(drifted, JSON.stringify({ ...campaign, fixture: { ...campaign.fixture, model_inputs_sha256: '0'.repeat(64) } }));
    assert.throws(() => runner.loadCampaign(drifted), /new meaning needs a new fixture version/);
    const loosened = path.join(scratch, 'loosened.json');
    fs.writeFileSync(loosened, JSON.stringify({ ...campaign, permissions: { ...campaign.permissions, headless_author_gates: 'auto-approve' } }));
    assert.throws(() => runner.loadCampaign(loosened), /not a valid campaign/);
  });

  await test('plan is credential-free, writes nothing, and names what the operator still has to select', async () => {
    const entry = fakeClio('fake-plan', 'process.exit(3);');
    const before = tree(path.join(scratch, 'fake-plan'));
    const planned = await withEnv({ WTFP_CAMPAIGN_CLIO_CREDENTIALS_SOURCE: '/nonexistent/credentials.yaml' }, () => runner.plan(campaign, { entry }));
    assert.strictEqual(planned.credential_free, true);
    assert.deepStrictEqual(planned.resources_missing, ['model.target', 'model.model', 'model.effort', 'budget.ceiling']);
    assert.ok(planned.clio.mismatches.some(item => /entry sha256/.test(item)), 'a build other than the pinned one is reported');
    assert.strictEqual(planned.steps.find(step => step.step === 'plan').headless_expectation, 'author-unavailable');
    assert.strictEqual(planned.steps.find(step => step.step === 'resume').session, 'S2');
    assert.deepStrictEqual(tree(path.join(scratch, 'fake-plan')), before);
  });

  await test('prepare refuses an unpinned Clio build before it creates anything', async () => {
    const entry = fakeClio('fake-unpinned', '');
    const root = path.join(scratch, 'never-created');
    assert.throws(() => runner.prepare(campaign, { entry, root }), /unpinned Clio build/);
    assert.ok(!fs.existsSync(root));
  });

  await test('execute refuses without the operator\'s selection, acknowledgement and private resources', async () => {
    const entry = fakeClio('fake-refusals', 'process.exit(0);');
    const root = preparedRoot('refusals', entry);
    await assert.rejects(runner.execute(campaign, { root, entry }), /operator's --target/);
    await assert.rejects(runner.execute(campaign, { root, entry, ...selection, budgetUsd: undefined }), /--budget-usd/);
    await assert.rejects(runner.execute(campaign, { root, entry, ...selection }), /set WTFP_CAMPAIGN_CONFIRM=/);
    const inside = path.join(root, 'credentials.yaml');
    fs.writeFileSync(inside, 'x');
    await assert.rejects(withEnv({ ...executeEnv, WTFP_CAMPAIGN_CLIO_CREDENTIALS_SOURCE: inside }, () => runner.execute(campaign, { root, entry, ...selection })), /outside the run root/);
    assert.ok(!fs.existsSync(path.join(root, 'run.json')));
    assert.throws(() => runner.parseArgs(['execute', '--api-key', 'x']), /unknown option|credentials only/);
  });

  await test('a headless author gate stops the run as a typed unavailable result and the credential is wiped', async () => {
    const entry = fakeClio('fake-gate', `
console.log(JSON.stringify({ type: 'session' }));
console.log(JSON.stringify({ type: 'tool_end', tool: 'extension_wtfp__gate', result: 'extension_wtfp__gate: no operator can answer an interview here' }));
console.log(JSON.stringify({ type: 'turn_end', usage: { inputTokens: 10, outputTokens: 5 } }));
process.exit(0);`);
    const root = preparedRoot('gate', entry);
    const run = await withEnv(executeEnv, () => runner.execute(campaign, { root, entry, ...selection }));
    assert.strictEqual(run.outcome, 'blocked-author-unavailable');
    assert.deepStrictEqual(run.steps.map(step => [step.step, step.outcome]), [['initialize', 'author-unavailable']]);
    assert.deepStrictEqual(run.cost, { status: 'unavailable', usd: null }, 'missing cost is unavailable, never zero');
    assert.strictEqual(run.credentials_removed, true);
    assert.ok(!fs.existsSync(path.join(runner.profilePaths(root).CLIO_CODER_CONFIG_DIR, 'credentials.yaml')));
    const recorded = fs.readFileSync(path.join(root, 'run.json'), 'utf8');
    assert.doesNotMatch(recorded, /secret-value-that-must-be-wiped/);
    assert.deepStrictEqual(run.selection, { target: 'operator-target', model: 'operator-model', effort: 'medium', budget_usd: 5, selected_by: 'operator' });
  });

  await test('a step that outlives its timeout is stopped with its process group and recorded as partial', async () => {
    const marker = path.join(scratch, 'grandchild.pid');
    const entry = fakeClio('fake-slow', `
const { spawn } = require('child_process');
const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
require('fs').writeFileSync(${JSON.stringify(marker)}, String(child.pid));
setTimeout(() => {}, 60000);`);
    const root = preparedRoot('slow', entry);
    const run = await withEnv(executeEnv, () => runner.execute(campaign, { root, entry, ...selection, timeoutMinutes: 0.02 }));
    assert.strictEqual(run.outcome, 'timed-out');
    assert.strictEqual(run.steps.length, 1);
    assert.strictEqual(run.steps[0].process_group.quiesced, true);
    const grandchild = Number(fs.readFileSync(marker, 'utf8'));
    assert.throws(() => process.kill(grandchild, 0), /ESRCH/, 'the step left a process running');
    assert.strictEqual(run.credentials_removed, true);
  });

  await test('cost comes from measured segments and worker receipt provenance, and unknown cost is never zero', async () => {
    const ok = { exitCode: 0, signal: null, timedOut: false, latencyMs: 1, processGroup: {} };
    const usage = (fields) => `${JSON.stringify({ type: 'agent_end', usage: { costUsd: 0.25, measured: true, ...fields } })}\n`;
    assert.deepStrictEqual(runner.classifyStep(ok, usage({}), '').cost, { status: 'reported', usd: 0.25, sources: { main_segments: 1, worker_receipts: 0 } });
    assert.strictEqual(runner.classifyStep(ok, usage({ measured: false }), '').cost.status, 'unavailable');
    assert.strictEqual(runner.classifyStep(ok, usage({ estimated: true }), '').cost.status, 'estimated');
    assert.strictEqual(runner.classifyStep(ok, '', '').cost.usd, null, 'no usage at all is unavailable, not zero');
    const receipt = (costProvenance) => ({ receipts: [{ file: 'r.json', receipt: { costUsd: 0.5, costProvenance, targetId: 't', wireModelId: 'm' } }] });
    assert.deepStrictEqual(runner.classifyStep(ok, usage({}), '', receipt('known')).cost, { status: 'reported', usd: 0.75, sources: { main_segments: 1, worker_receipts: 1 } });
    assert.strictEqual(runner.classifyStep(ok, usage({}), '', receipt('unknown')).cost.status, 'unavailable');
    const failed = runner.classifyStep({ ...ok, exitCode: 1 }, '', 'boom');
    assert.strictEqual(failed.outcome, 'failed');
  });

  await test('execute runs only on the campaign, build, candidate, checks and workspace that prepare bound', async () => {
    const entry = fakeClio('fake-bound', 'process.exit(0);');
    const attempt = (root, extra = {}) => withEnv(executeEnv, () => runner.execute(campaign, { root, entry, ...selection, ...extra }));
    const edited = path.join(scratch, 'edited-campaign.json');
    fs.writeFileSync(edited, `${fs.readFileSync(CAMPAIGN_FILE, 'utf8')} `);
    await assert.rejects(attempt(preparedRoot('bound-campaign', entry), { campaignFile: edited }), /campaign definition changed since prepare/);
    await assert.rejects(attempt(preparedRoot('bound-checks', entry, (prepared) => ({ ...prepared, checks: [{ name: 'desk-registered', passed: false }] }))), /did not pass every native check/);
    await assert.rejects(attempt(preparedRoot('bound-no-checks', entry, (prepared) => ({ ...prepared, checks: [] }))), /did not pass every native check/);
    const moved = preparedRoot('bound-workspace', entry);
    fs.writeFileSync(path.join(moved, 'workspace', 'planted.md'), 'x');
    await assert.rejects(attempt(moved), /workspace changed since prepare/);
    fs.rmSync(path.join(moved, 'workspace', 'planted.md'));
    fs.mkdirSync(path.join(moved, 'workspace', 'empty'));
    await assert.rejects(attempt(moved), /workspace changed since prepare/, 'an empty directory counts');
    await assert.rejects(attempt(preparedRoot('bound-candidate', entry, (prepared) => ({ ...prepared, wtfp: { ...prepared.wtfp, commit: '0'.repeat(40) } }))), /WTF-P candidate changed/);
    await assert.rejects(attempt(preparedRoot('bound-build', entry, (prepared) => ({ ...prepared, clio: { ...prepared.clio, dist_sha256: '0'.repeat(64) } }))), /Clio build changed since prepare/);
    await assert.rejects(attempt(preparedRoot('bound-pinned', entry, (prepared) => ({ ...prepared, clio_unpinned: [] }))), /unpinned Clio build/);
    await assert.rejects(attempt(preparedRoot('bound-timeout', entry), { timeoutMinutes: campaign.budget.timeout_minutes_per_step + 1 }), /at most the campaign's/);
    for (const name of ['bound-campaign', 'bound-checks', 'bound-workspace', 'bound-candidate', 'bound-build', 'bound-pinned', 'bound-timeout']) {
      assert.ok(!fs.existsSync(path.join(scratch, name, 'run.json')), `${name} ran nothing`);
      assert.ok(!fs.existsSync(path.join(runner.profilePaths(path.join(scratch, name)).CLIO_CODER_CONFIG_DIR, 'credentials.yaml')), `${name} copied no credential`);
    }
  });

  await test('every step runs without retrieval tools inside the run home, and a network tool call is a policy violation', async () => {
    const envFile = path.join(scratch, 'step-env.json');
    const entry = fakeClio('fake-network', `require('fs').writeFileSync(${JSON.stringify(envFile)}, JSON.stringify(process.env));
${frame({ type: 'tool_execution_start', toolCallId: 'c1', toolName: 'web_fetch', args: { url: 'https://example.invalid' } })}
${measured(0.01)}
process.exit(0);`);
    const run = await withEnv(executeEnv, () => runner.execute(campaign, { root: preparedRoot('network', entry), entry, ...selection }));
    const env = JSON.parse(fs.readFileSync(envFile, 'utf8'));
    assert.strictEqual(env.CLIO_CODER_DISABLE_RETRIEVE_TOOLS, '1');
    assert.strictEqual(env.CLIO_CODER_REQUIRE_HOME_PREFIX, '1');
    assert.strictEqual(run.outcome, 'policy-violation');
    assert.deepStrictEqual(run.steps[0].tools, { calls: { web_fetch: 1 }, network_calls: 1, blocked_calls: 0 });
  });

  await test('a gated step is never completed while its gate is pending or answered without a sealed author answer', async () => {
    const checkpoint = JSON.parse(fs.readFileSync(path.join(ROOT, 'protocol/project/templates/checkpoint.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'protocol/project/templates/manifest.json'), 'utf8'));
    const pending = fakeClio('fake-pending', `${planningWrite('project.json', manifest)}
${planningWrite(`checkpoints/${checkpoint.id}.json`, { ...checkpoint, blocking: true, status: 'pending' })}
${measured(0.01)}
process.exit(0);`);
    const waiting = await withEnv(executeEnv, () => runner.execute(campaign, { root: preparedRoot('pending', pending), entry: pending, ...selection }));
    assert.strictEqual(waiting.outcome, 'blocked-author-unavailable');
    assert.deepStrictEqual(waiting.steps[0].gates, { pending: [checkpoint.id], unconfirmed: [] });
    const forged = fakeClio('fake-forged', `${planningWrite('project.json', manifest)}
${planningWrite(`checkpoints/${checkpoint.id}.json`, { ...checkpoint, blocking: true, status: 'resolved', resolution: { resolved_by: 'author', selected_option: checkpoint.options[0].id, summary: 'Written by the agent.', resolved_at: '2026-10-14T12:00:00Z' } })}
${measured(0.01)}
process.exit(0);`);
    const violated = await withEnv(executeEnv, () => runner.execute(campaign, { root: preparedRoot('forged', forged), entry: forged, ...selection }));
    assert.strictEqual(violated.outcome, 'integrity-violation');
    assert.deepStrictEqual(violated.steps[0].gates, { pending: [], unconfirmed: [checkpoint.id] });
  });

  await test('a signal during a step records it cancelled, and an unmeasurable cost stops the run', async () => {
    // The step exits cleanly when the runner stops it, so only the runner knows it was interrupted.
    const entry = fakeClio('fake-signal', `${measured(0.01)}
process.on('SIGTERM', () => process.exit(0));
process.kill(process.ppid, 'SIGINT');
setTimeout(() => process.exit(0), 2000);`);
    const cancelled = await withEnv(executeEnv, () => runner.execute(campaign, { root: preparedRoot('signal', entry), entry, ...selection }));
    assert.strictEqual(cancelled.outcome, 'cancelled');
    assert.deepStrictEqual(cancelled.steps.map(step => [step.outcome, step.exit_code]), [['cancelled', 0]]);
    assert.strictEqual(cancelled.credentials_removed, true);
    // A second signal exits the runner, and the run is still on record. A detached grandchild keeps the
    // step's output open, so the step never returns and only the runner's own exit can record the run.
    const started = path.join(scratch, 'stubborn.started');
    const stubborn = fakeClio('fake-stubborn', `process.on('SIGTERM', () => {});
const holder = require('child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: ['ignore', 'inherit', 'inherit'] });
require('fs').writeFileSync(${JSON.stringify(started)}, String(holder.pid));
setInterval(() => {}, 1000);`);
    const root = preparedRoot('stubborn', stubborn);
    const child = require('child_process').spawn(process.execPath, [path.join(ROOT, 'evaluation/tools/run-clio-campaign.js'), 'execute', '--root', root, '--clio-entry', stubborn,
      '--target', selection.target, '--model', selection.model, '--effort', selection.effort, '--budget-usd', String(selection.budgetUsd)],
    { env: { ...process.env, ...executeEnv }, stdio: 'ignore' });
    const closed = new Promise(resolve => child.on('close', code => resolve(code)));
    for (let tries = 0; tries < 200 && !fs.existsSync(started); tries += 1) await new Promise(resolve => setTimeout(resolve, 50));
    child.kill('SIGINT');
    await new Promise(resolve => setTimeout(resolve, 200));
    child.kill('SIGINT');
    const code = await closed;
    process.kill(Number(fs.readFileSync(started, 'utf8')), 'SIGKILL');
    assert.strictEqual(code, 130);
    const recorded = JSON.parse(fs.readFileSync(path.join(root, 'run.json'), 'utf8'));
    assert.strictEqual(recorded.outcome, 'cancelled');
    assert.strictEqual(recorded.credentials_removed, true);
    const unmetered = fakeClio('fake-unmetered', `${frame({ type: 'agent_end', usage: { costUsd: 0, measured: false } })}
process.exit(0);`);
    const stopped = await withEnv(executeEnv, () => runner.execute(campaign, { root: preparedRoot('unmetered', unmetered), entry: unmetered, ...selection }));
    assert.strictEqual(stopped.outcome, 'stopped-cost-unavailable');
    assert.deepStrictEqual(stopped.cost, { status: 'unavailable', usd: null });
    assert.strictEqual(stopped.steps.length, 1);
  });

  await test('the run records the models Clio reports and worker receipts, and says effort is unobservable', async () => {
    const entry = fakeClio('fake-models', `${frame({ type: 'message_end', message: { role: 'assistant', provider: 'operator-target', model: 'operator-model', content: [] } })}
${measured(0.02)}
{ const dir = require('path').join(process.env.CLIO_CODER_STATE_DIR, 'receipts'); require('fs').mkdirSync(dir, { recursive: true });
  require('fs').writeFileSync(require('path').join(dir, 'run-1.json'), JSON.stringify({ runId: 'run-1', targetId: 'worker-target', wireModelId: 'worker-model', costUsd: 0.03, costProvenance: 'known' })); }
process.exit(0);`);
    const root = preparedRoot('models', entry);
    const run = await withEnv(executeEnv, () => runner.execute(campaign, { root, entry, ...selection, budgetUsd: 0.04 }));
    assert.strictEqual(run.outcome, 'stopped-budget');
    assert.deepStrictEqual(run.steps[0].observed_models, [{ target: 'operator-target', model: 'operator-model' }, { target: 'worker-target', model: 'worker-model' }]);
    assert.strictEqual(run.steps[0].model_observation, 'differs', 'a worker on another model is not the selected model');
    assert.deepStrictEqual(run.cost, { status: 'reported', usd: 0.05 });
    assert.strictEqual(run.effort_observation.status, 'unobservable');
    assert.strictEqual(run.workspace.initial_sha256, JSON.parse(fs.readFileSync(path.join(root, 'prepared.json'), 'utf8')).workspace_sha256);
  });

  await test('credential copies are wiped without following links, logs are scrubbed, and an unfinished run exits non-zero', async () => {
    const secret = 'sk-campaign-secret-0123456789abcdef';
    const source = privateSource('leaky-credentials.yaml', `providers:\n  key: ${secret}\n`);
    const outside = path.join(scratch, 'outside-target.txt');
    fs.writeFileSync(outside, 'keep me');
    const entry = fakeClio('fake-leak', `const fs = require('fs'); const path = require('path');
const config = process.env.CLIO_CODER_CONFIG_DIR;
fs.copyFileSync(path.join(config, 'credentials.yaml'), path.join(config, 'credentials.yaml.bak'));
fs.symlinkSync(${JSON.stringify(outside)}, path.join(config, 'credentials.yaml.link'));
console.log(fs.readFileSync(path.join(config, 'credentials.yaml'), 'utf8'));
${measured(0.01)}
process.exit(1);`);
    const root = preparedRoot('leak', entry);
    const cli = require('child_process').spawnSync(process.execPath, [path.join(ROOT, 'evaluation/tools/run-clio-campaign.js'), 'execute', '--root', root, '--clio-entry', entry,
      '--target', selection.target, '--model', selection.model, '--effort', selection.effort, '--budget-usd', String(selection.budgetUsd)],
    { env: { ...process.env, ...executeEnv, WTFP_CAMPAIGN_CLIO_CREDENTIALS_SOURCE: source }, encoding: 'utf8', timeout: 60000 });
    assert.strictEqual(cli.status, 3, cli.stderr);
    const run = JSON.parse(fs.readFileSync(path.join(root, 'run.json'), 'utf8'));
    assert.strictEqual(run.outcome, 'failed');
    assert.strictEqual(run.credentials_removed, true);
    assert.deepStrictEqual(fs.readdirSync(runner.profilePaths(root).CLIO_CODER_CONFIG_DIR).filter(name => name.startsWith('credentials')), []);
    assert.strictEqual(fs.readFileSync(outside, 'utf8'), 'keep me', 'a link is removed, never written through');
    assert.ok(run.logs_redacted >= 1);
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'logs', 'initialize', 'stdout.jsonl'), 'utf8'), new RegExp(secret));
  });

  await test('a fixture stays pinned: oracle drift and a schema change under a sealed manifest both fail', async () => {
    const drifted = path.join(scratch, 'oracle-drift.json');
    fs.writeFileSync(drifted, JSON.stringify({ ...campaign, fixture: { ...campaign.fixture, evaluator_oracles_sha256: '0'.repeat(64) } }));
    assert.throws(() => runner.loadCampaign(drifted), /evaluator oracles changed/);
    const { checkFixture } = require('../evaluation/tools/hash-fixtures');
    const copy = path.join(scratch, 'fixture-copy');
    fs.cpSync(path.join(ROOT, campaign.fixture.path), copy, { recursive: true });
    assert.strictEqual(checkFixture(copy).valid, true);
    const descriptor = JSON.parse(fs.readFileSync(path.join(copy, 'fixture.json'), 'utf8'));
    fs.writeFileSync(path.join(copy, 'fixture.json'), JSON.stringify({ ...descriptor, schema: 'wtfp.evaluation.user-acceptance/v1' }));
    assert.match(checkFixture(copy).reason, /changed its schema/);
  });

  await test('collect verifies desk seals independently and never writes into the workspace', async () => {
    const entry = fakeClio('fake-collect', 'process.exit(0);');
    const root = preparedRoot('collect', entry);
    const workspace = path.join(root, 'workspace');
    const planning = path.join(workspace, '.planning');
    const templates = path.join(ROOT, 'protocol/project/templates');
    const put = (relative, value) => {
      fs.mkdirSync(path.dirname(path.join(planning, relative)), { recursive: true });
      fs.writeFileSync(path.join(planning, relative), `${JSON.stringify(value, null, 2)}\n`);
    };
    for (const name of ['manifest', 'config', 'state', 'decisions']) {
      put(name === 'manifest' ? 'project.json' : `${name}.json`, JSON.parse(fs.readFileSync(path.join(templates, `${name}.json`), 'utf8')));
    }
    const checkpoint = JSON.parse(fs.readFileSync(path.join(templates, 'checkpoint.json'), 'utf8'));
    const asked = { ...checkpoint };
    delete asked.status;
    const key = crypto.randomBytes(32);
    const store = path.join(runner.profilePaths(root).CLIO_CODER_STATE_DIR, 'extensions', 'wtfp', 'store.json');
    fs.mkdirSync(path.dirname(store), { recursive: true });
    fs.writeFileSync(store, JSON.stringify({ version: 1, entries: { 'seal-key': { value: key.toString('hex'), version: 1 } } }));
    const interaction = {
      schema: 'wtfp.project.interaction/v1',
      id: 'interaction-answer',
      project_id: checkpoint.project_id,
      kind: 'checkpoint-answer',
      subject_uri: `project://checkpoints/${checkpoint.id}`,
      channel: 'attested-interview',
      outcome: 'selected',
      selected_option: checkpoint.options[0].id,
      presented: { content_sha256: sha256(runner.canonical(asked)), options: checkpoint.options.map(option => option.id) },
      asked_at: '2026-10-14T12:00:00Z',
      answered_at: '2026-10-14T12:01:00Z'
    };
    const seal = { method: 'hmac-sha256', key_id: sha256(key).slice(0, 16), mac: crypto.createHmac('sha256', key).update(runner.canonical(interaction)).digest('hex') };
    put('interactions/interaction-answer.json', { ...interaction, seal });
    put('interactions/interaction-forged.json', { ...interaction, id: 'interaction-forged', selected_option: checkpoint.options[1].id, seal });
    put('interactions/interaction-elsewhere.json', { ...interaction, id: 'interaction-elsewhere', seal: { ...seal, key_id: 'f'.repeat(16) } });
    const resolution = { resolved_by: 'author', selected_option: checkpoint.options[0].id, summary: 'Answered at the desk.', resolved_at: '2026-10-14T12:01:00Z' };
    put(`checkpoints/${checkpoint.id}.json`, { ...checkpoint, status: 'resolved', resolution });
    put('checkpoints/checkpoint-hand-edited.json', { ...checkpoint, id: 'checkpoint-hand-edited', status: 'resolved', resolution });
    // Each of these carries a valid seal under the profile's key, yet none is the author's answer to what the checkpoint now records.
    const answered = (id, fields = {}, change = (record) => record) => {
      const record = { ...checkpoint, id };
      const asked = { ...record };
      delete asked.status;
      put(`interactions/interaction-${id}.json`, deskTrust.seal({ ...interaction, id: `interaction-${id}`, subject_uri: `project://checkpoints/${id}`, presented: { ...interaction.presented, content_sha256: sha256(runner.canonical(asked)) }, ...fields }, key));
      put(`checkpoints/${id}.json`, change({ ...record, status: 'resolved', resolution }));
    };
    answered('checkpoint-swapped', {}, (record) => ({ ...record, resolution: { ...resolution, selected_option: checkpoint.options[1].id } }));
    answered('checkpoint-rewritten', {}, (record) => ({ ...record, request: 'A question the author never saw.' }));
    answered('checkpoint-deferred', { outcome: 'kept-pending', selected_option: undefined });
    answered('checkpoint-elsewhere', { project_id: 'another-project' });
    answered('checkpoint-prompted', { channel: 'host-prompt' });
    answered('checkpoint-waived', { outcome: 'waived', selected_option: undefined }, (record) => ({ ...record, status: 'waived', resolution: { resolved_by: 'author', summary: 'Waived at the desk.', resolved_at: '2026-10-14T12:01:00Z' } }));
    put('checkpoints/checkpoint-policy.json', { ...checkpoint, id: 'checkpoint-policy', blocking: false, status: 'resolved', resolution: { resolved_by: 'policy', summary: 'The default applies.', resolved_at: '2026-10-14T12:01:00Z' } });
    const before = tree(workspace);
    const report = runner.collect(campaign, { root });
    assert.deepStrictEqual(tree(workspace), before);
    assert.strictEqual(report.evaluator_mutation.changed, false);
    assert.ok(report.evaluator_mutation.wrote_only.startsWith('evidence'));
    const seals = Object.fromEntries(report.interactions.filter(item => !item.id.startsWith('interaction-checkpoint-')).map(item => [item.id, item.seal]));
    assert.deepStrictEqual(seals, { 'interaction-answer': 'valid', 'interaction-elsewhere': 'foreign', 'interaction-forged': 'invalid' });
    assert.deepStrictEqual(report.unattested_author_resolutions.sort(), ['checkpoint-deferred', 'checkpoint-elsewhere', 'checkpoint-hand-edited', 'checkpoint-prompted', 'checkpoint-rewritten', 'checkpoint-swapped']);
    const trust = Object.fromEntries(report.decisions.map(item => [item.checkpoint, item.trust]));
    assert.strictEqual(trust[checkpoint.id], 'attested');
    assert.strictEqual(trust['checkpoint-waived'], 'attested');
    assert.deepStrictEqual(report.waived, [{ checkpoint: 'checkpoint-waived', trust: 'attested' }]);
    assert.deepStrictEqual(report.policy_resolutions, [{ checkpoint: 'checkpoint-policy', blocking: false }]);
    assert.ok(report.evidence_levels.includes('observed-author'));
    assert.strictEqual(report.workspace_chain.prepared, JSON.parse(fs.readFileSync(path.join(root, 'prepared.json'), 'utf8')).workspace_sha256);
    assert.strictEqual(report.workspace_chain.collected, report.evaluator_mutation.workspace_before);
    assert.strictEqual(report.workspace_chain.run_final, null, 'no run, no run digest');
  });

  await test('the comparative study stays a draft until every owner decision is made, and its rules are enforced', async () => {
    const { loadStudy } = require('../evaluation/lib/study');
    const file = path.join(ROOT, 'evaluation/v2/studies/clio-reliability-comparison.json');
    const { study, pending } = loadStudy(file);
    assert.strictEqual(study.status, 'draft');
    assert.deepStrictEqual(pending.sort(), ['analysis.thresholds', 'assessment.assessors', 'comparators', 'execution.budget_per_run_usd', 'execution.models', 'execution.repetitions', 'tasks.count']);
    const variant = (name, change) => {
      const target = path.join(scratch, `${name}.json`);
      fs.writeFileSync(target, JSON.stringify(change(JSON.parse(JSON.stringify(study)))));
      return target;
    };
    assert.throws(() => loadStudy(variant('frozen-early', value => ({ ...value, status: 'frozen' }))), /cannot be frozen while decisions are pending/);
    assert.throws(() => loadStudy(variant('gateless', value => ({ ...value, ablations: [{ ...value.ablations[0], keeps_production_author_gates: false }] }))), /not a valid study/);
    assert.throws(() => loadStudy(variant('self-judging', value => ({ ...value, assessment: { ...value.assessment, model_judges: 'allowed' } }))), /not a valid study/);
    assert.throws(() => loadStudy(variant('hidden-null', value => ({ ...value, analysis: { ...value.analysis, null_results: 'omitted' } }))), /not a valid study/);
    assert.throws(() => loadStudy(variant('no-baseline', value => ({ ...value, conditions: value.conditions.map(condition => (condition.wtfp === 'none' ? { ...condition, wtfp: 'plugin-only' } : condition)) }))), /baseline without WTF-P/);
    assert.throws(() => loadStudy(variant('secondary-primary', value => ({ ...value, hypotheses: [{ ...value.hypotheses[0], primary_outcome: 'latency' }] }))), /declared primary outcome/);
    assert.throws(() => loadStudy(variant('unknown-host', value => ({ ...value, conditions: value.conditions.map(condition => ({ ...condition, host: 'clio-9.9.9' })) }))), /unknown campaign/);
  });

  fs.rmSync(scratch, { recursive: true, force: true });
  console.log(`\n${passed} campaign runner checks passed.`);
}

main().catch(error => {
  console.error(error.stack || error.message);
  fs.rmSync(scratch, { recursive: true, force: true });
  process.exitCode = 1;
});
