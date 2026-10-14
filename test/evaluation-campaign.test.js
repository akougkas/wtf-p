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

function preparedRoot(name, entry) {
  const campaign = runner.loadCampaign(CAMPAIGN_FILE);
  const root = path.join(scratch, name);
  fs.mkdirSync(path.join(root, 'workspace'), { recursive: true });
  for (const session of ['S1', 'S2']) {
    for (const directory of Object.values(runner.profilePaths(root, session))) {
      if (directory.startsWith(root)) fs.mkdirSync(directory, { recursive: true });
    }
  }
  fs.writeFileSync(path.join(root, 'prepared.json'), `${JSON.stringify({
    schema: 'wtfp.evaluation.campaign-prepared/v2',
    campaign: { id: campaign.id, version: campaign.version },
    clio: runner.clioIdentity(entry, campaign).observed,
    workspace: 'workspace'
  }, null, 2)}\n`);
  return root;
}

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

  await test('reported costs are summed only when every step reports one', async () => {
    const step = (cost) => runner.classifyStep({ exitCode: 0, signal: null, timedOut: false, latencyMs: 1, processGroup: {} },
      `${JSON.stringify({ type: 'turn_end', usage: { costUsd: cost } })}\n`, '');
    assert.strictEqual(step(0.25).cost_usd, 0.25);
    assert.strictEqual(step(null).cost_status, 'unavailable');
    const failed = runner.classifyStep({ exitCode: 1, signal: null, timedOut: false, latencyMs: 1, processGroup: {} }, '', 'boom');
    assert.strictEqual(failed.outcome, 'failed');
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
    const before = tree(workspace);
    const report = runner.collect(campaign, { root });
    assert.deepStrictEqual(tree(workspace), before);
    assert.strictEqual(report.evaluator_mutation.changed, false);
    assert.ok(report.evaluator_mutation.wrote_only.startsWith('evidence'));
    const seals = Object.fromEntries(report.interactions.map(item => [item.id, item.seal]));
    assert.deepStrictEqual(seals, { 'interaction-answer': 'valid', 'interaction-elsewhere': 'foreign', 'interaction-forged': 'invalid' });
    assert.deepStrictEqual(report.unattested_author_resolutions, ['checkpoint-hand-edited']);
    assert.ok(report.evidence_levels.includes('observed-author'));
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
