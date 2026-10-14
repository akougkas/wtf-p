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
function preparedRoot(name, entry, change = (prepared) => prepared, campaignFile = CAMPAIGN_FILE) {
  const campaign = runner.loadCampaign(campaignFile);
  const root = path.join(scratch, name);
  fs.mkdirSync(path.join(root, 'workspace'), { recursive: true });
  for (const session of ['S1', 'S2']) {
    for (const directory of Object.values(runner.profilePaths(root, session))) {
      if (directory.startsWith(root)) fs.mkdirSync(directory, { recursive: true });
    }
  }
  fs.writeFileSync(path.join(root, 'workspace', 'project-brief.md'), 'A brief.\n');
  fs.writeFileSync(path.join(root, 'clio', 'bin', 'clio-coder'), `#!${process.execPath}\n// launches ${entry}\n`, { mode: 0o755 });
  const identity = runner.clioIdentity(entry, campaign);
  const wtfp = runner.wtfpIdentity();
  fs.writeFileSync(path.join(root, 'prepared.json'), `${JSON.stringify(change({
    schema: 'wtfp.evaluation.campaign-prepared/v2',
    campaign: { id: campaign.id, version: campaign.version, sha256: sha256(fs.readFileSync(campaignFile)) },
    wtfp,
    allow_dirty: wtfp.package_tree !== 'clean',
    clio: identity.observed,
    clio_unpinned: identity.mismatches,
    fixture: { ...runner.fixtureIdentity(campaign), evaluator_oracles_copied: false },
    workspace: 'workspace',
    workspace_sha256: runner.workspaceDigest(path.join(root, 'workspace')),
    workspace_head: runner.workspaceHead(path.join(root, 'workspace')),
    launcher: runner.launcherIdentity(root, entry, null, null),
    checks: [{ name: 'desk-package-tests', passed: true, detail: null }]
  }), null, 2)}\n`);
  return root;
}

/** Lines a fake Clio prints and records it writes into its workspace, as JavaScript source. */
const frame = (value) => `console.log(${JSON.stringify(JSON.stringify(value))});`;
const planningWrite = (relative, value) => `{ const f = require('path').join(process.cwd(), '.planning', ${JSON.stringify(relative)}); require('fs').mkdirSync(require('path').dirname(f), { recursive: true }); require('fs').writeFileSync(f, ${JSON.stringify(JSON.stringify(value))}); }`;
const measured = (costUsd) => frame({ type: 'agent_end', messageCount: 2, usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 15, costUsd, apiCalls: 1, measured: true } });
/** A receipt as Clio seals one into the run's state directory. */
const receiptWrite = (name, receipt) => `{ const dir = require('path').join(process.env.CLIO_CODER_STATE_DIR, 'receipts'); require('fs').mkdirSync(dir, { recursive: true }); require('fs').writeFileSync(require('path').join(dir, ${JSON.stringify(`${name}.json`)}), ${JSON.stringify(JSON.stringify(receipt))}); }`;
const mainReceipt = (costUsd, costProvenance = 'known') => receiptWrite(`main-${costUsd}`, { runId: `main-${costUsd}`, agentId: 'main-agent', targetId: 'operator-target', wireModelId: 'operator-model', costUsd, costProvenance, runtimeResolution: { requestedThinkingLevel: 'medium', effectiveThinkingLevel: 'medium' } });
const checkpointTemplate = JSON.parse(fs.readFileSync(path.join(ROOT, 'protocol/project/templates/checkpoint.json'), 'utf8'));
const manifestTemplate = JSON.parse(fs.readFileSync(path.join(ROOT, 'protocol/project/templates/manifest.json'), 'utf8'));
/** A fake step that raises one blocking gate and leaves it pending, as a headless gated step should. */
const raisesGate = `${planningWrite('project.json', manifestTemplate)}
${planningWrite(`checkpoints/${checkpointTemplate.id}.json`, { ...checkpointTemplate, blocking: true, status: 'pending' })}`;

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
  /** The campaign with only ungated steps, for cases a gated first step would stop before they are reached. */
  const ungatedFile = path.join(scratch, 'ungated.campaign.json');
  fs.writeFileSync(ungatedFile, JSON.stringify({ ...campaign, lifecycle: campaign.lifecycle.filter(step => step.author_gate === null).slice(0, 2) }));
  const ungated = runner.loadCampaign(ungatedFile);

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
    const executing = path.join(scratch, 'executing.json');
    fs.writeFileSync(executing, JSON.stringify({ ...campaign, permissions: { ...campaign.permissions, code_execution: 'allowed' } }));
    assert.throws(() => runner.loadCampaign(executing), /not a valid campaign/, 'a campaign cannot let a step run programs');
    assert.strictEqual(campaign.permissions.code_execution, 'denied');
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
    const entry = fakeClio('fake-gate', `${raisesGate}
console.log(JSON.stringify({ type: 'session' }));
process.exit(0);`);
    const root = preparedRoot('gate', entry);
    const run = await withEnv(executeEnv, () => runner.execute(campaign, { root, entry, ...selection }));
    assert.strictEqual(run.outcome, 'blocked-author-unavailable');
    assert.deepStrictEqual(run.steps.map(step => [step.step, step.outcome]), [['initialize', 'author-unavailable']]);
    assert.deepStrictEqual([run.cost.status, run.cost.usd], ['unavailable', null], 'missing cost is unavailable, never zero');
    assert.strictEqual(run.evidence_level, 'no-model-call-observed', 'no model call seen, so no model evidence is claimed');
    assert.match(run.isolation.model_code_execution, /^withheld: /, 'every run record says what it cannot vouch for');
    assert.match(run.isolation.record_integrity, /rest on Clio enforcing the tool limits/);
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

  await test('cost comes only from sealed receipts by their provenance, and unknown cost is never zero', async () => {
    const ok = { exitCode: 0, signal: null, timedOut: false, latencyMs: 1, processGroup: {} };
    const segment = `${JSON.stringify({ type: 'agent_end', usage: { costUsd: 0.25, measured: true } })}\n`;
    const main = (costUsd, costProvenance) => ({ file: 'main.json', receipt: { agentId: 'main-agent', costUsd, costProvenance } });
    const worker = (costUsd, costProvenance) => ({ file: 'worker.json', receipt: { agentId: 'wtfp-section-writer', costUsd, costProvenance } });
    const cost = (receipts) => { const result = runner.classifyStep(ok, segment, '', { receipts }).cost; return [result.status, result.usd]; };
    assert.deepStrictEqual(cost([]), ['unavailable', null], 'a measured segment without a receipt is not a cost');
    assert.deepStrictEqual(cost([main(0.25, 'known')]), ['reported', 0.25], 'the main receipt already covers the segment; it is not added twice');
    assert.deepStrictEqual(cost([main(0.25, 'known'), worker(0.5, 'known_free')]), ['reported', 0.75]);
    assert.deepStrictEqual(cost([main(0.25, 'estimated')]), ['estimated', 0.25]);
    assert.deepStrictEqual(cost([main(0, 'unknown')]), ['unavailable', null]);
    assert.deepStrictEqual(cost([worker(0.5, 'known')]), ['unavailable', null], 'without the main agent\'s receipt the step is not accounted for');
    const failed = runner.classifyStep({ ...ok, exitCode: 1 }, 'a headless session was mentioned', 'boom');
    assert.strictEqual(failed.outcome, 'failed', 'text in the output never decides an outcome');
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
    // Entry names cannot forge another entry: a file named like two listing lines digests differently from the two files.
    const twoFiles = path.join(scratch, 'digest-two');
    const oneFile = path.join(scratch, 'digest-one');
    fs.mkdirSync(twoFiles);
    fs.mkdirSync(oneFile);
    fs.writeFileSync(path.join(twoFiles, 'p'), 'P');
    fs.writeFileSync(path.join(twoFiles, 'q'), 'Q');
    fs.writeFileSync(path.join(oneFile, `p ${sha256('P')}\nfile q`), 'Q');
    assert.notStrictEqual(runner.workspaceDigest(oneFile), runner.workspaceDigest(twoFiles));
    for (const name of ['bound-campaign', 'bound-checks', 'bound-workspace', 'bound-candidate', 'bound-build', 'bound-pinned', 'bound-timeout']) {
      assert.ok(!fs.existsSync(path.join(scratch, name, 'run.json')), `${name} ran nothing`);
      assert.ok(!fs.existsSync(path.join(runner.profilePaths(path.join(scratch, name)).CLIO_CODER_CONFIG_DIR, 'credentials.yaml')), `${name} copied no credential`);
    }
  });

  await test('every step runs without retrieval tools inside the run home, and a network tool call is a policy violation', async () => {
    const envFile = path.join(scratch, 'step-env.json');
    const argvFile = path.join(scratch, 'step-argv.json');
    const entry = fakeClio('fake-network', `require('fs').writeFileSync(${JSON.stringify(envFile)}, JSON.stringify(process.env));
require('fs').writeFileSync(${JSON.stringify(argvFile)}, JSON.stringify(args));
${frame({ type: 'tool_execution_start', toolCallId: 'c1', toolName: 'web_fetch', args: { url: 'https://example.invalid' } })}
${measured(0.01)}
process.exit(0);`);
    const run = await withEnv(executeEnv, () => runner.execute(campaign, { root: preparedRoot('network', entry), entry, ...selection }));
    const env = JSON.parse(fs.readFileSync(envFile, 'utf8'));
    assert.strictEqual(env.CLIO_CODER_DISABLE_RETRIEVE_TOOLS, '1');
    assert.strictEqual(env.CLIO_CODER_REQUIRE_HOME_PREFIX, '1');
    assert.strictEqual(run.outcome, 'policy-violation');
    assert.deepStrictEqual(run.steps[0].tools, { calls: { web_fetch: 1 }, network_calls: 1, store_calls: 0, execution_calls: 0, blocked_calls: 0 });
    // Neither the main agent nor a worker it dispatches holds a tool that runs a program.
    const argv = JSON.parse(fs.readFileSync(argvFile, 'utf8'));
    const listed = (flag) => { const at = argv.indexOf(flag); assert.ok(at > 0, `the step passes ${flag}`); return argv[at + 1].split(','); };
    assert.deepStrictEqual(listed('--allow-tools'), [...runner.MAIN_TOOLS]);
    assert.deepStrictEqual(listed('--delegate-tools'), [...runner.WORKER_TOOLS]);
    for (const tool of [...runner.EXECUTION_TOOLS, 'web_fetch', 'web_read', 'configure_clio', 'consult']) {
      assert.ok(!runner.MAIN_TOOLS.includes(tool) && !runner.WORKER_TOOLS.includes(tool), `no step holds ${tool}`);
    }
    assert.deepStrictEqual(run.step_environment.tools, { main: [...runner.MAIN_TOOLS], delegated: [...runner.WORKER_TOOLS] });
    // The main agent holds every desk tool by the name Clio gives it, and nothing the desk does not declare.
    const manifest = fs.readFileSync(path.join(ROOT, 'clio/clio-coder-extension.yaml'), 'utf8');
    const deskTools = [...manifest.split(/^  tools:$/m)[1].matchAll(/^    - name: ([a-z_]+)$/gm)].map(match => `extension_wtfp__${match[1]}`);
    assert.deepStrictEqual(runner.MAIN_TOOLS.filter(tool => tool.startsWith('extension_')), deskTools);
  });

  await test('a step that runs a program violates the campaign policy, whether the main agent or a worker ran it', async () => {
    const ok = { exitCode: 0, signal: null, timedOut: false, latencyMs: 1, processGroup: {} };
    const main = { file: 'main.json', receipt: { agentId: 'main-agent', costUsd: 0.01, costProvenance: 'known' } };
    const lines = (...events) => events.map(event => JSON.stringify(event)).join('\n');
    const start = (id, toolName) => ({ type: 'tool_execution_start', toolCallId: id, toolName, args: { command: 'node --test planted.test.js' } });
    const outcome = (stdout, receipts = [main]) => { const step = runner.classifyStep(ok, stdout, '', { receipts }); return [step.outcome, step.tools.execution_calls]; };
    assert.deepStrictEqual(outcome(lines(start('c1', 'read'))), ['completed', 0]);
    for (const tool of runner.EXECUTION_TOOLS) assert.deepStrictEqual(outcome(lines(start('c1', tool))), ['policy-violation', 1], `${tool} by the main agent`);
    assert.deepStrictEqual(outcome(lines(start('c1', 'bash'), { type: 'tool_execution_end', toolCallId: 'c1', outcome: 'blocked' })), ['completed', 0], 'a call Clio blocked did not run');
    assert.deepStrictEqual(outcome(lines(start('c1', 'bash'), { type: 'tool_execution_end', toolCallId: 'c2', outcome: 'blocked' })), ['policy-violation', 1], 'another call\'s block does not excuse this one');
    const worker = (toolStats) => ({ file: 'worker.json', receipt: { agentId: 'wtfp-section-writer', costUsd: 0, costProvenance: 'known_free', toolStats } });
    assert.deepStrictEqual(outcome('', [main, worker([{ tool: 'verify', count: 2, ok: 2, errors: 0, blocked: 0 }])]), ['policy-violation', 2], 'a worker that ran verify');
    assert.deepStrictEqual(outcome('', [main, worker([{ tool: 'bash', count: 1, ok: 0, errors: 0, blocked: 1 }, { tool: 'read', count: 3, ok: 3, errors: 0, blocked: 0 }])]), ['completed', 0], 'a worker call Clio blocked did not run');
  });

  await test('prepare refuses a WTF-P recipe that declares a tool a step\'s workers may not hold', async () => {
    assert.deepStrictEqual(runner.recipeToolsOutside(path.join(ROOT, 'vendors/plugin')), [], 'the shipped recipes fit the delegated tools');
    const plugin = path.join(scratch, 'grown-plugin');
    fs.cpSync(path.join(ROOT, 'vendors/plugin/ai.iowarp.clio/agents'), path.join(plugin, 'ai.iowarp.clio/agents'), { recursive: true });
    const recipe = path.join(plugin, 'ai.iowarp.clio/agents/wtfp-section-reviewer.md');
    fs.writeFileSync(recipe, fs.readFileSync(recipe, 'utf8').replace('optional: [grep,', 'optional: [verify, grep,'));
    assert.deepStrictEqual(runner.recipeToolsOutside(plugin), ['wtfp-section-reviewer: verify']);
    const writer = path.join(plugin, 'ai.iowarp.clio/agents/wtfp-section-writer.md');
    fs.writeFileSync(writer, fs.readFileSync(writer, 'utf8').replace('{anyOf: [write, edit]}', '{anyOf: [write, edit, bash]}'));
    assert.deepStrictEqual(runner.recipeToolsOutside(plugin), ['wtfp-section-reviewer: verify', 'wtfp-section-writer: bash']);
    fs.writeFileSync(writer, fs.readFileSync(writer, 'utf8').replace(/^tools: .*$/m, 'tools:\n  required: [bash]'));
    assert.match(runner.recipeToolsOutside(plugin).join('\n'), /wtfp-section-writer\.md: tools not declared/);
    assert.match(runner.recipeToolsOutside(path.join(scratch, 'no-plugin')).join(''), /no WTF-P recipes/);
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
    // A gated step that raises no gate skipped its author.
    const skipper = fakeClio('fake-skipper', `${mainReceipt(0.01)}
process.exit(0);`);
    const skipped = await withEnv(executeEnv, () => runner.execute(campaign, { root: preparedRoot('skipped', skipper), entry: skipper, ...selection }));
    assert.deepStrictEqual([skipped.outcome, skipped.steps.length], ['gate-not-raised', 1]);
    // No author can answer during a headless step, so an interaction it adds is never the author's, even under a valid seal.
    const key = crypto.randomBytes(32);
    const resolution = { resolved_by: 'author', selected_option: checkpoint.options[0].id, summary: 'Minted in a headless step.', resolved_at: '2026-10-14T12:01:00Z' };
    const asked = { ...checkpoint, blocking: true };
    delete asked.status;
    const sealedAnswer = deskTrust.seal({
      schema: 'wtfp.project.interaction/v1', id: 'interaction-minted', project_id: manifest.id, kind: 'checkpoint-answer',
      subject_uri: `project://checkpoints/${checkpoint.id}`, channel: 'attested-interview', outcome: 'selected', selected_option: checkpoint.options[0].id,
      presented: { content_sha256: sha256(runner.canonical(asked)), options: checkpoint.options.map(option => option.id) }, asked_at: '2026-10-14T12:00:00Z', answered_at: '2026-10-14T12:01:00Z'
    }, key);
    const minted = fakeClio('fake-minted', `${planningWrite('project.json', manifest)}
${planningWrite(`checkpoints/${checkpoint.id}.json`, { ...checkpoint, blocking: true, status: 'resolved', resolution })}
${planningWrite('interactions/interaction-minted.json', sealedAnswer)}
process.exit(0);`);
    const mintedRoot = preparedRoot('minted', minted);
    const store = path.join(runner.profilePaths(mintedRoot).CLIO_CODER_STATE_DIR, 'extensions', 'wtfp', 'store.json');
    fs.mkdirSync(path.dirname(store), { recursive: true });
    fs.writeFileSync(store, JSON.stringify({ version: 1, entries: { 'seal-key': { value: key.toString('hex'), version: 1 } } }));
    const mintedRun = await withEnv(executeEnv, () => runner.execute(campaign, { root: mintedRoot, entry: minted, ...selection }));
    assert.strictEqual(mintedRun.outcome, 'integrity-violation');
    assert.deepStrictEqual(mintedRun.steps[0].interactions_added, ['interaction-minted.json']);
    const mintedReport = runner.collect(campaign, { root: mintedRoot });
    assert.deepStrictEqual(mintedReport.headless_interactions, ['interaction-minted']);
    assert.deepStrictEqual(mintedReport.decisions.map(item => [item.checkpoint, item.trust, item.attested_by]), [[checkpoint.id, 'sealed-during-headless-step', null]]);
    assert.ok(!mintedReport.evidence_levels.includes('observed-author'), 'a seal minted with no author present is not author evidence');
    // Reaching for the seal store is a policy violation whatever tool does it.
    const reaching = fakeClio('fake-reaching', `${frame({ type: 'tool_execution_start', toolCallId: 'c1', toolName: 'bash', args: { command: 'cat ../clio/state/extensions/wtfp/store.json' } })}
process.exit(0);`);
    const reached = await withEnv(executeEnv, () => runner.execute(campaign, { root: preparedRoot('reaching', reaching), entry: reaching, ...selection }));
    assert.deepStrictEqual([reached.outcome, reached.steps[0].tools.store_calls], ['policy-violation', 1]);
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
    assert.strictEqual(code, 130);
    assert.throws(() => process.kill(Number(fs.readFileSync(started, 'utf8')), 0), /ESRCH/, 'the run swept the detached process it left');
    const recorded = JSON.parse(fs.readFileSync(path.join(root, 'run.json'), 'utf8'));
    assert.strictEqual(recorded.outcome, 'cancelled');
    assert.strictEqual(recorded.credentials_removed, true);
    const unmetered = fakeClio('fake-unmetered', `${mainReceipt(0, 'unknown')}
process.exit(0);`);
    const stopped = await withEnv(executeEnv, () => runner.execute(ungated, { root: preparedRoot('unmetered', unmetered, undefined, ungatedFile), entry: unmetered, ...selection, campaignFile: ungatedFile }));
    assert.strictEqual(stopped.outcome, 'stopped-cost-unavailable');
    assert.deepStrictEqual([stopped.cost.status, stopped.cost.usd], ['unavailable', null]);
    assert.strictEqual(stopped.steps.length, 1);
  });

  await test('the run records the models providers reported, never the ones requested, and the effort Clio resolved', async () => {
    const entry = fakeClio('fake-models', `${frame({ type: 'message_end', message: { role: 'assistant', provider: 'operator-target', model: 'operator-model', responseModel: 'operator-model-2026', providerThinkingLevel: 'medium', content: [] } })}
${frame({ type: 'message_end', message: { role: 'assistant', provider: 'operator-target', model: 'operator-model', content: [] } })}
${mainReceipt(0.02)}
${receiptWrite('worker-1', { runId: 'worker-1', agentId: 'wtfp-section-writer', targetId: 'worker-target', wireModelId: 'operator-model', costUsd: 0.03, costProvenance: 'known', upstreamResponses: [{ requestedModelId: 'operator-model', providerResponseId: 'resp-1', responseModelIdObservation: { state: 'not-observed' } }] })}
process.exit(0);`);
    const root = preparedRoot('models', entry, undefined, ungatedFile);
    const run = await withEnv(executeEnv, () => runner.execute(ungated, { root, entry, ...selection, budgetUsd: 0.04, campaignFile: ungatedFile }));
    assert.strictEqual(run.outcome, 'stopped-budget');
    const [step] = run.steps;
    assert.deepStrictEqual(step.model_observation, { requested: ['operator-model'], reported: ['operator-model-2026'], calls: 3, unreported_calls: 2, status: 'differs' });
    assert.deepStrictEqual(step.effort_observation, { requested: ['medium'], effective: ['medium'], provider_reported: ['medium'], status: 'observed' });
    assert.deepStrictEqual([run.cost.status, run.cost.usd], ['reported', 0.05]);
    assert.strictEqual(run.evidence_level, 'observed-model');
    assert.strictEqual(run.workspace.initial_sha256, JSON.parse(fs.readFileSync(path.join(root, 'prepared.json'), 'utf8')).workspace_sha256);
    assert.strictEqual(runner.collect(ungated, { root }).workspace_chain.prepared_unchanged_since_run, true);
    fs.appendFileSync(path.join(root, 'prepared.json'), ' ');
    assert.strictEqual(runner.collect(ungated, { root }).workspace_chain.prepared_unchanged_since_run, false, 'a rewritten prepared.json shows');
  });

  await test('a model is observed by whichever report its provider family gives, and only real calls count', async () => {
    const ok = { exitCode: 0, signal: null, timedOut: false, latencyMs: 1, processGroup: {} };
    const lines = [
      { type: 'message_end', message: { role: 'assistant', model: 'm', responseModelIdObservation: { state: 'reported', reportedModelId: 'm-responses' }, content: [] } },
      { type: 'message_end', message: { role: 'assistant', model: 'm', stopReason: 'error', content: [] } }
    ].map(line => JSON.stringify(line)).join('\n');
    const worker = { file: 'w.json', receipt: { agentId: 'wtfp-section-writer', wireModelId: 'm', upstreamResponses: [
      { requestedModelId: 'm', providerResponseId: 'r1', responseModelIdObservation: { state: 'not-observed' }, differingResponseModelId: 'm-fallback' },
      { requestedModelId: 'm', providerResponseId: 'r2', responseModelIdObservation: { state: 'legacy-difference-only', differingModelId: 'm-legacy' } },
      { requestedModelId: 'm', usageScope: 'run-aggregate', responseModelIdObservation: { state: 'not-observed' } },
      { requestedModelId: 'm', usage: { input: 0, output: 0, totalTokens: 0 }, responseModelIdObservation: { state: 'reported', reportedModelId: 'm-err' } }
    ] } };
    const step = runner.classifyStep(ok, lines, '', { receipts: [worker], selection: { model: 'm' } });
    assert.deepStrictEqual(step.model_observation.reported, ['m-fallback', 'm-legacy', 'm-responses']);
    assert.deepStrictEqual([step.model_observation.calls, step.model_observation.unreported_calls], [3, 0], 'neither the aggregate row nor a provider error is a call');
    assert.strictEqual(step.model_calls, 2, 'a provider error is not an observed model call');
    const failedWorker = { file: 'f.json', receipt: { agentId: 'wtfp-section-writer', upstreamResponses: [{ requestedModelId: 'm', usage: { input: 120, output: 0, totalTokens: 120 }, responseModelIdObservation: { state: 'not-observed' } }] } };
    assert.strictEqual(runner.classifyStep(ok, '', '', { receipts: [failedWorker] }).model_calls, 0, 'a worker whose only call failed served nothing');
    const usageless = { file: 'u.json', receipt: { agentId: 'wtfp-section-writer', upstreamResponses: [
      { requestedModelId: 'm', providerResponseId: 'r1', responseModelIdObservation: { state: 'reported', reportedModelId: 'm' } },
      { requestedModelId: 'm', responseModelIdObservation: { state: 'reported', reportedModelId: 'other-model' } }
    ] } };
    assert.strictEqual(runner.classifyStep(ok, '', '', { receipts: [usageless], selection: { model: 'm' } }).model_observation.status, 'differs', 'a reply Clio recorded without usage is still a call that counts');
  });

  await test('the seal key is out of reach while headless steps run, and nothing a step leaves running outlives the run', async () => {
    const probe = path.join(scratch, 'store-probe.json');
    const late = path.join(scratch, 'late-interaction.json');
    const entry = fakeClio('fake-keyless', `${mainReceipt(0.01)}
const store = require('path').join(process.env.CLIO_CODER_STATE_DIR, 'extensions', 'wtfp', 'store.json');
require('fs').writeFileSync(${JSON.stringify(probe)}, JSON.stringify({ present: require('fs').existsSync(store) }));
require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(`setTimeout(() => require('fs').writeFileSync(${JSON.stringify(late)}, 'minted'), 1500)`)}], { detached: true, stdio: 'ignore' }).unref();
process.exit(0);`);
    const root = preparedRoot('keyless', entry, undefined, ungatedFile);
    const store = path.join(runner.profilePaths(root).CLIO_CODER_STATE_DIR, 'extensions', 'wtfp', 'store.json');
    fs.mkdirSync(path.dirname(store), { recursive: true });
    const stored = JSON.stringify({ version: 1, entries: { 'seal-key': { value: 'a'.repeat(64), version: 1 } } });
    fs.writeFileSync(store, stored);
    const run = await withEnv(executeEnv, () => runner.execute(ungated, { root, entry, ...selection, campaignFile: ungatedFile }));
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(probe, 'utf8')), { present: false }, 'a step never sees the store');
    assert.strictEqual(fs.readFileSync(store, 'utf8'), stored, 'the key is back, byte for byte');
    assert.deepStrictEqual(run.seal_store, { held_during_run: true, restored: true });
    assert.ok(run.steps[0].processes_swept.killed.length >= 1, 'the detached process was swept');
    await new Promise(resolve => setTimeout(resolve, 2000));
    assert.ok(!fs.existsSync(late), 'the swept process wrote nothing after the step');
    // A store a step creates is not the author's key: it is set aside and the run fails integrity.
    const maker = fakeClio('fake-store-maker', `${mainReceipt(0.01)}
const store = require('path').join(process.env.CLIO_CODER_STATE_DIR, 'extensions', 'wtfp', 'store.json');
require('fs').mkdirSync(require('path').dirname(store), { recursive: true });
require('fs').writeFileSync(store, '{}');
process.exit(0);`);
    const made = await withEnv(executeEnv, () => runner.execute(ungated, { root: preparedRoot('store-maker', maker, undefined, ungatedFile), entry: maker, ...selection, campaignFile: ungatedFile }));
    assert.strictEqual(made.outcome, 'integrity-violation');
    assert.match(made.integrity.join(' '), /seal store or its directory was created or replaced during the run/);
  });

  await test('the key returns to a real file, the build\'s dependencies are bound, and the run record survives a hostile step', async () => {
    // A step that plants a dangling link at the store path, or replaces its directory with a link, gets neither the key nor a clean run.
    const landing = path.join(scratch, 'store-landing.json');
    const planter = fakeClio('fake-planter', `${mainReceipt(0.01)}
require('fs').symlinkSync(${JSON.stringify(landing)}, require('path').join(process.env.CLIO_CODER_STATE_DIR, 'extensions', 'wtfp', 'store.json'));
process.exit(0);`);
    const plantRoot = preparedRoot('planter', planter, undefined, ungatedFile);
    const store = path.join(runner.profilePaths(plantRoot).CLIO_CODER_STATE_DIR, 'extensions', 'wtfp', 'store.json');
    fs.mkdirSync(path.dirname(store), { recursive: true });
    fs.writeFileSync(store, 'held-key');
    const planted = await withEnv(executeEnv, () => runner.execute(ungated, { root: plantRoot, entry: planter, ...selection, campaignFile: ungatedFile }));
    assert.strictEqual(planted.outcome, 'integrity-violation');
    assert.ok(!fs.existsSync(landing), 'the key was never written through the planted link');
    assert.ok(fs.lstatSync(store).isFile() && fs.readFileSync(store, 'utf8') === 'held-key');
    const elsewhere = path.join(scratch, 'store-dir-elsewhere');
    fs.mkdirSync(elsewhere);
    const mover = fakeClio('fake-dir-mover', `${mainReceipt(0.01)}
const fs = require('fs'); const path = require('path');
const dir = path.join(process.env.CLIO_CODER_STATE_DIR, 'extensions', 'wtfp');
fs.renameSync(dir, dir + '-old');
fs.symlinkSync(${JSON.stringify(elsewhere)}, dir);
process.exit(0);`);
    const moveRoot = preparedRoot('dir-mover', mover, undefined, ungatedFile);
    const moveStore = path.join(runner.profilePaths(moveRoot).CLIO_CODER_STATE_DIR, 'extensions', 'wtfp', 'store.json');
    fs.mkdirSync(path.dirname(moveStore), { recursive: true });
    fs.writeFileSync(moveStore, 'held-key');
    const moved = await withEnv(executeEnv, () => runner.execute(ungated, { root: moveRoot, entry: mover, ...selection, campaignFile: ungatedFile }));
    assert.strictEqual(moved.outcome, 'integrity-violation');
    assert.deepStrictEqual(fs.readdirSync(elsewhere), [], 'the key was never written into the linked directory');
    assert.strictEqual(fs.readFileSync(moveStore, 'utf8'), 'held-key');
    // A step that changes anything the build loads from its package root, dependencies or rules beside dist/, is caught before the next step.
    const dependent = fakeClio('fake-dependent', `const dep = require(require('path').join(__dirname, '..', '..', 'node_modules', 'dep.js'));
console.log(JSON.stringify({ type: 'note', dep }));
${mainReceipt(0.01)}
require('fs').writeFileSync(require('path').join(__dirname, '..', '..', 'damage-control-rules.yaml'), 'packs: []\\n');
process.exit(0);`);
    fs.mkdirSync(path.join(scratch, 'fake-dependent', 'node_modules'));
    fs.writeFileSync(path.join(scratch, 'fake-dependent', 'node_modules', 'dep.js'), 'module.exports = "original";');
    fs.writeFileSync(path.join(scratch, 'fake-dependent', 'damage-control-rules.yaml'), 'packs: [default]\n');
    const dependentRoot = preparedRoot('dependent', dependent, undefined, ungatedFile);
    await assert.rejects(withEnv(executeEnv, () => runner.execute(ungated, { root: dependentRoot, entry: dependent, ...selection, campaignFile: ungatedFile })), /launcher changed since prepare \(package_sha256\)/);
    // A step that makes the runner's own files unreadable still leaves a run record, failing closed.
    const locker = fakeClio('fake-locker', `${mainReceipt(0.01)}
require('fs').chmodSync(require('path').join(process.env.CLIO_CODER_HOME, '..', 'prepared.json'), 0);
require('fs').chmodSync(process.env.CLIO_CODER_CONFIG_DIR, 0);
require('fs').chmodSync(require('path').join(process.env.CLIO_CODER_HOME, '..'), 0o500);
process.exit(0);`);
    const lockRoot = preparedRoot('locker', locker, undefined, ungatedFile);
    try {
      const locked = await withEnv(executeEnv, () => runner.execute(ungated, { root: lockRoot, entry: locker, ...selection, campaignFile: ungatedFile }));
      assert.strictEqual(locked.outcome, 'integrity-violation');
      assert.strictEqual(locked.credentials_removed, false, 'copies it could not reach are never reported removed');
      assert.ok(fs.existsSync(path.join(lockRoot, 'run.json')));
    } finally {
      fs.chmodSync(lockRoot, 0o700);
      fs.chmodSync(path.join(lockRoot, 'prepared.json'), 0o600);
      fs.chmodSync(runner.profilePaths(lockRoot).CLIO_CODER_CONFIG_DIR, 0o700);
    }
  });

  await test('a step that swaps the run root or carries off a credential copy gets neither the key nor the secret', async () => {
    // Swapping the run root for a link is caught, and the key is not restored into the stand-in.
    const landing = path.join(scratch, 'root-landing');
    const swapper = fakeClio('fake-root-swapper', `${mainReceipt(0.01)}
const fs = require('fs'); const path = require('path');
const root = path.resolve(process.env.CLIO_CODER_HOME, '..');
const landing = ${JSON.stringify(landing)};
fs.mkdirSync(path.join(landing, 'clio', 'config'), { recursive: true });
fs.copyFileSync(path.join(root, 'prepared.json'), path.join(landing, 'prepared.json'));
fs.renameSync(root, root + '-old');
fs.symlinkSync(path.join(root + '-old', 'logs'), path.join(landing, 'logs'));
fs.symlinkSync(path.join(root + '-old', 'workspace'), path.join(landing, 'workspace'));
fs.symlinkSync(landing, root);
process.exit(0);`);
    const oneStepFile = path.join(scratch, 'one-step.campaign.json');
    fs.writeFileSync(oneStepFile, JSON.stringify({ ...ungated, lifecycle: ungated.lifecycle.slice(0, 1) }));
    const oneStep = runner.loadCampaign(oneStepFile);
    const swapRoot = preparedRoot('root-swapper', swapper, undefined, oneStepFile);
    const store = path.join(runner.profilePaths(swapRoot).CLIO_CODER_STATE_DIR, 'extensions', 'wtfp', 'store.json');
    fs.mkdirSync(path.dirname(store), { recursive: true });
    fs.writeFileSync(store, 'held-key');
    const swapped = await withEnv(executeEnv, () => runner.execute(oneStep, { root: swapRoot, entry: swapper, ...selection, campaignFile: oneStepFile }));
    assert.strictEqual(swapped.outcome, 'integrity-violation');
    assert.match(swapped.integrity.join(' '), /run root was replaced/);
    assert.deepStrictEqual(swapped.seal_store, { held_during_run: true, restored: false }, 'a key not restored is never recorded as restored');
    assert.ok(!fs.existsSync(path.join(landing, 'clio', 'state', 'extensions', 'wtfp', 'store.json')), 'the key is not written into the stand-in root');
    assert.strictEqual(swapped.credentials_removed, false);
    assert.ok(fs.readFileSync(path.join(`${swapRoot}-old`, 'clio', 'config', 'credentials.yaml')).every(byte => byte === 0), 'the copy left behind was zeroed');
    // A copy a step moves elsewhere is zeroed through the descriptor the runner kept, and never reported removed.
    const stash = path.join(scratch, 'stashed-credentials.yaml');
    const mover = fakeClio('fake-copy-mover', `${mainReceipt(0.01)}
require('fs').renameSync(require('path').join(process.env.CLIO_CODER_CONFIG_DIR, 'credentials.yaml'), ${JSON.stringify(stash)});
process.exit(0);`);
    const moved = await withEnv(executeEnv, () => runner.execute(ungated, { root: preparedRoot('copy-mover', mover, undefined, ungatedFile), entry: mover, ...selection, campaignFile: ungatedFile }));
    assert.strictEqual(moved.credentials_removed, false);
    assert.match(moved.copies_zeroed_elsewhere, /zeroed in place/);
    assert.ok(fs.readFileSync(stash).every(byte => byte === 0), 'the moved copy no longer holds the secret');
  });

  await test('secrets are every credential value and every settings value under an auth key, in any YAML form, and nothing else', async () => {
    assert.deepStrictEqual(runner.settingsSecrets('targets: { t: { model: long-model-identifier, headers: { X-Custom: flow-token-123456 } } }'), ['flow-token-123456']);
    assert.deepStrictEqual(runner.settingsSecrets('t:\n  model: long-model-identifier\n  Authorization: >-\n    Bearer block-scalar-987654\n'), ['block-scalar-987654']);
    assert.deepStrictEqual(runner.settingsSecrets('t:\n  tokens:\n    - sequence-token-1234\n'), ['sequence-token-1234']);
    assert.deepStrictEqual(runner.settingsSecrets('t:\n  tokens:\n  - same-indent-secret-1234\n'), ['same-indent-secret-1234']);
    assert.deepStrictEqual(runner.settingsSecrets('t:\n  headers: {\n    X-Custom: multiline-flow-secret-1234\n  }\n  model: long-model-identifier\n'), ['multiline-flow-secret-1234']);
    assert.deepStrictEqual(runner.settingsSecrets('t:\n  auth:\n    oauthProfile: anthropic-max\n    apiKeyRef: anthropic-key\n    apiKeyEnvVar: ANTHROPIC_API_KEY\n    headers:\n      Authorization: Bearer header-secret-1234\n'),
      ['header-secret-1234'], 'names of secrets, such as profiles, refs and environment variables, are evidence');
    assert.deepStrictEqual(runner.settingsSecrets('agents:\n  external:\n    env: { GITHUB_AUTH: ghp-secret-value-123456789 }\n'), ['ghp-secret-value-123456789'], 'an auth-named key anywhere holds a secret');
    assert.deepStrictEqual(runner.settingsSecrets('t:\n  auth:\n    headers: {\n      "X-A": "{",\n      X-Custom: custom-secret-123456789\n    }\n  model: claude-opus-model-2026\n'),
      ['custom-secret-123456789'], 'a bracket inside a quoted string is text, and the model id after the map stays evidence');
    assert.deepStrictEqual(runner.settingsSecrets('t:\n  auth:\n    headers:\n      apiKeyRef: header-value-123456789\n'), ['header-value-123456789'], 'a reference name is a reference only directly under auth');
    assert.deepStrictEqual(runner.settingsSecrets('targets:\n  - id: a\n    wireModels: [\n      claude-opus-4-1, # pinned [see notes\n      claude-sonnet-4\n    ]\n    auth:\n      headers:\n        X-Key: comment-secret-123456789\nurl: https://api.example.com/v1\n'),
      ['comment-secret-123456789'], 'a comment inside a multi-line flow collection is not structure');
    assert.deepStrictEqual(runner.settingsSecrets('t:\n  headers: { "X-Note": "see #1 {", X-Custom: quoted-hash-123456789 }\n  model: claude-opus-model-2026\n'), ['quoted-hash-123456789'], 'a # inside quotes is not a comment');
    assert.deepStrictEqual(runner.settingsSecrets('fleet:\n  profiles:\n    authoring:\n      target: anthropic\n      model: claude-opus-4-1-20250805\n'), [], 'a key that merely contains auth is not a secret');
    assert.deepStrictEqual(runner.settingsSecrets('integrations:\n  externalAgents:\n    env: { OPENAI_KEY: sk-openai-secret-123456, OPENAI_BASE_URL: https://example.invalid/v1 }\n'), ['sk-openai-secret-123456'], 'a NAME_KEY variable holds a secret; a URL does not');
    assert.deepStrictEqual(runner.settingsSecrets('t:\n  headers:\n    - { Authorization: sequence-flow-1234 }\n  models:\n    - { id: long-model-identifier }\n'), ['sequence-flow-1234']);
    assert.deepStrictEqual(runner.credentialSecrets('anthropic:\n  type: api_key\n  key: sk-ant-secret-1234\n  updatedAt: 2026-10-14T12:00:00Z\nopenrouter:\n  type: oauth\n  access: access-token-1234\n  refresh: refresh-token-1234\n  expires: 1760000000000\n'),
      ['sk-ant-secret-1234', 'access-token-1234', 'refresh-token-1234'], 'provider names, types and timestamps stay in the evidence');
  });

  await test('a step cannot rewrite the build, prepare the next step\'s logs, forge the run record, or block cleanup', async () => {
    const swapper = fakeClio('fake-swapper', `${mainReceipt(0.01)}
require('fs').appendFileSync(__filename, '\\n// rewritten by a step\\n');
process.exit(0);`);
    const swapRoot = preparedRoot('swapper', swapper, undefined, ungatedFile);
    await assert.rejects(withEnv(executeEnv, () => runner.execute(ungated, { root: swapRoot, entry: swapper, ...selection, campaignFile: ungatedFile })), /launcher changed since prepare \(entry_sha256\)/);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(swapRoot, 'run.json'), 'utf8')).outcome, 'runner-error');
    const next = ungated.lifecycle[1].step;
    const trapper = fakeClio('fake-trapper', `${mainReceipt(0.01)}
const logs = require('path').join(process.env.CLIO_CODER_HOME, '..', 'logs', ${JSON.stringify(next)});
require('fs').mkdirSync(logs, { recursive: true });
require('fs').writeFileSync(require('path').join(logs, 'stdout.jsonl'), 'planted');
process.exit(0);`);
    const trapRoot = preparedRoot('trapper', trapper, undefined, ungatedFile);
    await assert.rejects(withEnv(executeEnv, () => runner.execute(ungated, { root: trapRoot, entry: trapper, ...selection, campaignFile: ungatedFile })), /EEXIST/);
    const trapped = JSON.parse(fs.readFileSync(path.join(trapRoot, 'run.json'), 'utf8'));
    assert.deepStrictEqual([trapped.outcome, trapped.steps.length, trapped.credentials_removed], ['runner-error', 1, true]);
    const forger = fakeClio('fake-forger', `${mainReceipt(0.01)}
require('fs').writeFileSync(require('path').join(process.env.CLIO_CODER_HOME, '..', 'run.json'), JSON.stringify({ outcome: 'completed', steps: [] }));
require('fs').mkdirSync(require('path').join(process.env.CLIO_CODER_CONFIG_DIR, 'credentials.yaml.d'));
process.exit(0);`);
    const forgeRoot = preparedRoot('forger', forger, undefined, ungatedFile);
    const forged = await withEnv(executeEnv, () => runner.execute(ungated, { root: forgeRoot, entry: forger, ...selection, campaignFile: ungatedFile }));
    assert.strictEqual(forged.outcome, 'integrity-violation');
    assert.match(forged.integrity.join(' '), /run\.json was written during the run/);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(forgeRoot, 'run.json'), 'utf8')).outcome, 'integrity-violation', 'the runner\'s record is the one on disk');
    assert.match(forged.unwiped.join(' '), /credentials\.yaml\.d: .*directory/);
    assert.strictEqual(forged.credentials_removed, true, 'the real copies were still wiped');
  });

  await test('every step launches the build and packages prepare bound, and a runner failure is recorded as one', async () => {
    const entry = fakeClio('fake-launcher', `${mainReceipt(0.01)}
require('fs').appendFileSync(require('path').join(process.env.CLIO_CODER_HOME, 'bin', 'clio-coder'), '// swapped\\n');
process.exit(0);`);
    const root = preparedRoot('launcher', entry, undefined, ungatedFile);
    await assert.rejects(withEnv(executeEnv, () => runner.execute(ungated, { root, entry, ...selection, campaignFile: ungatedFile })), /launcher changed since prepare \(wrapper_sha256\)/);
    const run = JSON.parse(fs.readFileSync(path.join(root, 'run.json'), 'utf8'));
    assert.deepStrictEqual([run.outcome, run.steps.length], ['runner-error', 1], 'the step that ran is kept and the run is not called cancelled');
    assert.strictEqual(run.credentials_removed, true);
    const moved = preparedRoot('launcher-entry', entry, (prepared) => ({ ...prepared, launcher: { ...prepared.launcher, entry: '/elsewhere/dist/cli/index.js' } }));
    await assert.rejects(withEnv(executeEnv, () => runner.execute(campaign, { root: moved, entry, ...selection })), /launcher changed since prepare \(entry\)/);
    assert.ok(!fs.existsSync(path.join(moved, 'run.json')), 'a moved launcher is refused before anything runs');
    assert.ok(!fs.existsSync(path.join(runner.profilePaths(moved).CLIO_CODER_CONFIG_DIR, 'credentials.yaml')));
    // Prepare counts the desk's package tests as passed only on a clean exit that ran and failed nothing.
    assert.strictEqual(runner.deskTestsPassed({ status: 0, stdout: 'ℹ pass 31\nℹ fail 0\n', stderr: '' }), true);
    assert.strictEqual(runner.deskTestsPassed({ status: 1, stdout: 'ℹ pass 31\nℹ fail 0\n', stderr: '' }), false);
    assert.strictEqual(runner.deskTestsPassed({ status: 0, stdout: 'ℹ pass 0\nℹ fail 0\n', stderr: '' }), false);
    assert.strictEqual(runner.deskTestsPassed({ status: 0, stdout: 'ℹ pass 30\nℹ fail 01\n', stderr: '' }), false);
  });

  await test('credential copies are wiped without following links, logs are scrubbed, and an unfinished run exits non-zero', async () => {
    const secret = 'sk-campaign-secret-0123456789abcdef';
    const header = 'Bearer settings-header-0123456789abcdef';
    const source = privateSource('leaky-credentials.yaml', `providers:\n  key: ${secret}\n`);
    const settings = privateSource('leaky-settings.yaml', `targets:\n  t:\n    model: operator-model-long-identifier-2026\n    auth:\n      headers:\n        Authorization: ${header}\n`);
    const outside = path.join(scratch, 'outside-target.txt');
    fs.writeFileSync(outside, 'keep me');
    const entry = fakeClio('fake-leak', `const fs = require('fs'); const path = require('path');
const config = process.env.CLIO_CODER_CONFIG_DIR;
fs.copyFileSync(path.join(config, 'credentials.yaml'), path.join(config, 'credentials.yaml.bak'));
fs.copyFileSync(path.join(config, 'settings.yaml'), path.join(config, '.settings.yaml.tmp-1'));
fs.symlinkSync(${JSON.stringify(outside)}, path.join(config, 'credentials.yaml.link'));
console.log(fs.readFileSync(path.join(config, 'credentials.yaml'), 'utf8'));
console.log(fs.readFileSync(path.join(config, 'settings.yaml'), 'utf8'));
fs.writeFileSync(path.join(process.cwd(), 'leaked.md'), ${JSON.stringify(header)});
${measured(0.01)}
process.exit(1);`);
    const root = preparedRoot('leak', entry);
    const cli = require('child_process').spawnSync(process.execPath, [path.join(ROOT, 'evaluation/tools/run-clio-campaign.js'), 'execute', '--root', root, '--clio-entry', entry,
      '--target', selection.target, '--model', selection.model, '--effort', selection.effort, '--budget-usd', String(selection.budgetUsd)],
    { env: { ...process.env, ...executeEnv, WTFP_CAMPAIGN_CLIO_CREDENTIALS_SOURCE: source, WTFP_CAMPAIGN_CLIO_SETTINGS_SOURCE: settings }, encoding: 'utf8', timeout: 60000 });
    assert.strictEqual(cli.status, 3, cli.stderr);
    const run = JSON.parse(fs.readFileSync(path.join(root, 'run.json'), 'utf8'));
    assert.strictEqual(run.outcome, 'failed');
    assert.strictEqual(run.credentials_removed, true);
    assert.deepStrictEqual(fs.readdirSync(runner.profilePaths(root).CLIO_CODER_CONFIG_DIR).filter(name => /credentials|settings/.test(name)), []);
    assert.strictEqual(fs.readFileSync(outside, 'utf8'), 'keep me', 'a link is removed, never written through');
    assert.ok(run.secrets.redacted_files.includes(path.join('logs', 'initialize', 'stdout.jsonl')));
    const log = fs.readFileSync(path.join(root, 'logs', 'initialize', 'stdout.jsonl'), 'utf8');
    assert.doesNotMatch(log, new RegExp(secret));
    assert.doesNotMatch(log, /settings-header-0123456789abcdef/);
    assert.match(log, /operator-model-long-identifier-2026/, 'a model id in settings is evidence, not a secret');
    assert.deepStrictEqual(run.secrets.in_workspace, [path.join('workspace', 'leaked.md')], 'a secret in the measured workspace is reported, not edited');
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
    // A link in .planning is a finding about the project, not a reason to stop collecting.
    fs.symlinkSync(path.join(planning, 'project.json'), path.join(planning, 'linked.json'));
    const linked = runner.collect(campaign, { root });
    assert.strictEqual(linked.records.valid, false);
    assert.match(linked.records.error, /symbolic link/);
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
    const decided = (value) => ({ ...value, status: 'frozen', decisions: value.decisions.map(decision => ({ ...decision, status: 'decided' })), tasks: { ...value.tasks, count: 12 } });
    assert.throws(() => loadStudy(variant('frozen-placeholders', value => ({
      ...decided(value),
      execution: { ...value.execution, models: [], repetitions: 0, budget_per_run_usd: -1 },
      assessment: { ...value.assessment, assessors: 1 },
      analysis: { ...value.analysis, thresholds: 'chosen after looking at the data' }
    }))), /unusable values for execution\.models, execution\.repetitions, execution\.budget_per_run_usd, assessment\.assessors, analysis\.thresholds/);
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
