#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { sha256, snapshotProject } = require('../evaluation/lib/clio-lifecycle');
const lifecycle = require('../evaluation/tools/run-clio-lifecycle');
const {
  CONFIRMATION,
  CONFIRMATION_ENV,
  EXPECTED_CLIO,
  FLEETS,
  assertExecutionConfirmation,
  auditFleetLedger,
  auditFleetMutation,
  auditFleetReceipts,
  auditFleetToolActivity,
  auditNativeTopology,
  auditStructuredResult,
  auditWriteBoundaries,
  bindPrivateRoot,
  buildPlan,
  initializeSeedProject,
  parseArgs,
  parseFleetStream,
  readExternalSource,
  verdictDigest
} = require('../evaluation/tools/run-clio-fleets');

function makePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function writePrivate(file, contents) {
  makePrivateDirectory(path.dirname(file));
  fs.writeFileSync(file, contents, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

function writeJson(file, value) {
  writePrivate(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fakeSources() {
  return {
    wtfp: {
      commit: 'a'.repeat(40),
      branch: 'feat/agent-platform-modernization',
      extension_sha256: 'b'.repeat(64),
      generated_inventory: {
        schema: 'wtfp.generated-adapter/v1',
        target: 'clio',
        generator_version: 4,
        files: 231,
        sha256: 'c'.repeat(64)
      }
    },
    clio: {
      commit: EXPECTED_CLIO.commit,
      binary: { path: EXPECTED_CLIO.binary, sha256: EXPECTED_CLIO.binary_sha256 }
    },
    fixture: {
      id: 'hpc-checkpointing-paper',
      version: 1,
      model_inputs_sha256: 'd'.repeat(64),
      evaluator_oracles_sha256: 'e'.repeat(64),
      aggregate_sha256: 'f'.repeat(64)
    },
    fleet_fixture_seed: {
      path: 'evaluation/v1/fleets/fixture-seed.json',
      sha256: '1'.repeat(64),
      bytes: 1,
      schema: 'wtfp.evaluation.clio-fleet-fixture-seed/v1'
    }
  };
}

function expectedGraph(fleet, writes = fleet.writes) {
  return {
    fleet: fleet.name,
    planHash: 'a'.repeat(64),
    waves: [
      {
        wave: 1,
        steps: [{
          id: fleet.mutatorStep,
          kind: 'agent',
          agent: fleet.mutator,
          scope: 'workspace',
          writes: [...writes],
          dependencies: []
        }]
      },
      {
        wave: 2,
        steps: [{
          id: fleet.verifierStep,
          kind: 'agent',
          agent: fleet.verifier,
          scope: 'readonly',
          writes: [],
          dependencies: [fleet.mutatorStep]
        }]
      }
    ],
    loops: []
  };
}

function summaryFor(fleet, rootId = `fleet-${fleet.name}`) {
  return {
    fleet: fleet.name,
    rootId,
    planHash: 'a'.repeat(64),
    loops: [],
    revalidated: [],
    unneeded: [],
    skipped: [],
    needsDecision: [],
    writeBoundaries: [
      { window: 'wave-1', violated: false, failedStepIds: [], detail: null },
      { window: 'wave-2', violated: false, failedStepIds: [], detail: null }
    ]
  };
}

function boundaryVerdict(window, stepIds, allow, changedPaths = []) {
  const verdict = {
    version: 1,
    window,
    baselineHead: 'b'.repeat(40),
    stepIds,
    allow,
    changedPaths,
    violations: [],
    unattributed: [],
    rolledBack: [],
    unrecoverable: [],
    attributionComplete: true,
    status: 'clean',
    reason: null,
    detail: null
  };
  verdict.digest = verdictDigest(verdict);
  return verdict;
}

function testDryRunIdentityAndArguments() {
  assert.strictEqual(
    typeof lifecycle.runNativePreflight,
    'function',
    'the fleet prepare path requires the lifecycle native-preflight helper to be exported'
  );
  const options = parseArgs(['--dry-run'], { [CONFIRMATION_ENV]: CONFIRMATION });
  assert.strictEqual(options.mode, 'dry-run');
  assert.strictEqual(options.ambientConfirmationIgnored, true);
  assert.strictEqual(options.binary, EXPECTED_CLIO.binary);
  assert.strictEqual(options.clioSource, EXPECTED_CLIO.source);

  const plan = buildPlan(options, fakeSources());
  assert.strictEqual(plan.schema, 'wtfp.evaluation.clio-fleets-plan/v1');
  assert.strictEqual(plan.client.commit, EXPECTED_CLIO.commit);
  assert.strictEqual(plan.client.target, 'openai-codex');
  assert.strictEqual(plan.client.model, 'gpt-5.6-terra');
  assert.strictEqual(plan.client.effort, 'xhigh');
  assert.strictEqual(plan.isolation.network_tools_disabled, true);
  assert.strictEqual(plan.fixture.model_oracle_exposed, false);
  assert.strictEqual(plan.fleets.length, 2);
  for (const [index, fleet] of FLEETS.entries()) {
    assert.deepStrictEqual(plan.fleets[index].command.argv, [
      EXPECTED_CLIO.binary, 'fleet', 'run', fleet.name,
      '--var', 'section=evaluation', '--json'
    ]);
    assert.deepStrictEqual(plan.fleets[index].topology[0].writes, fleet.writes);
    assert(plan.fleets[index].topology[0].writes.every(entry => entry.endsWith('/')));
    assert(!JSON.stringify(plan.fleets[index].command).match(/credential|secret|token/iu));
  }

  assert.throws(() => parseArgs(['--dry-run', '--prepare']), /exactly one mode/u);
  assert.throws(() => parseArgs(['--execute']), /requires --root/u);
  assert.throws(() => parseArgs(['--dry-run', '--credentials', '/tmp/secret']), /credential material/u);
  assert.throws(() => assertExecutionConfirmation({}), /exact .* acknowledgement/u);
  assert.throws(() => assertExecutionConfirmation({ [CONFIRMATION_ENV]: `${CONFIRMATION} ` }), /acknowledgement/u);
  assert.strictEqual(assertExecutionConfirmation({ [CONFIRMATION_ENV]: CONFIRMATION }), true);
}

function testSeedAndNativeTopology(root) {
  const seeded = initializeSeedProject(path.join(root, 'seed-project'));
  assert.strictEqual(seeded.schema.valid, true);
  assert.strictEqual(seeded.invariant.valid, true);
  assert.strictEqual(seeded.invariant.record_count, 10);
  assert.match(seeded.commit, /^[a-f0-9]{40}$/u);
  assert.deepStrictEqual(seeded.git_control, lifecycle.gitControlSnapshot(path.join(root, 'seed-project')));

  const nativeRoot = path.join(root, 'native-root');
  const nativeEvidence = path.join(nativeRoot, 'evidence', 'native');
  makePrivateDirectory(nativeEvidence);
  for (const fleet of FLEETS) {
    const stem = fleet.name === 'wtfp-plan-section' ? 'fleet-plan' : 'fleet-draft';
    writeJson(path.join(nativeEvidence, `${stem}-validate.stdout`), {
      valid: true,
      fleet: fleet.name,
      planHash: 'a'.repeat(64)
    });
    writeJson(path.join(nativeEvidence, `${stem}-graph.stdout`), expectedGraph(fleet));
  }
  const valid = auditNativeTopology(nativeRoot);
  assert.strictEqual(valid.valid, true, valid.errors.join('; '));

  const planGraph = path.join(nativeEvidence, 'fleet-plan-graph.stdout');
  writeJson(planGraph, expectedGraph(FLEETS[0], ['.planning']));
  const bare = auditNativeTopology(nativeRoot);
  assert.strictEqual(bare.valid, false);
  assert(bare.errors.some(error => error.includes('write boundaries')),
    `bare directory boundary was not rejected: ${bare.errors.join('; ')}`);
}

function testMutationAndResultAuditors() {
  const file = '.planning/sections/evaluation/plans/initial.md';
  const before = {};
  const after = {
    '.planning/sections/evaluation/plans': {
      path: '.planning/sections/evaluation/plans', kind: 'directory', bytes: 0, mode: 0o700, sha256: null
    },
    [file]: { path: file, kind: 'file', bytes: 12, mode: 0o600, sha256: 'a'.repeat(64) }
  };
  const mutation = auditFleetMutation(FLEETS[0], before, after);
  assert.strictEqual(mutation.valid, true, mutation.errors.join('; '));
  const escaped = {
    ...after,
    'outside.md': { path: 'outside.md', kind: 'file', bytes: 1, mode: 0o600, sha256: 'b'.repeat(64) }
  };
  assert.strictEqual(auditFleetMutation(FLEETS[0], before, escaped).valid, false);

  const receipt = (kind, value, quality = 'pass') => {
    const text = JSON.stringify(value);
    return {
      result_contract: {
        sourceId: `agent-result-contract:${kind}:${'c'.repeat(64)}`,
        validatorDigest: 'd'.repeat(64),
        conformance: 'pass',
        quality
      },
      output: {
        state: 'final',
        bytes: Buffer.byteLength(text),
        captured_bytes: Buffer.byteLength(text),
        truncated: false,
        sha256: sha256(Buffer.from(text))
      },
      output_text: text
    };
  };
  const mutationResult = receipt('mutation-report', {
    mutatedPaths: [file],
    validations: [{ name: 'boundary', passed: true, evidence: 'only the planned path changed' }]
  });
  assert.strictEqual(auditStructuredResult(mutationResult, 'mutation-report', [file]).valid, true);
  assert.strictEqual(auditStructuredResult(mutationResult, 'mutation-report', ['other.md']).valid, false);

  const verifierResult = receipt('verifier-report', {
    verdict: 'pass',
    checks: [{ name: 'coverage', passed: true, evidence: 'all obligations were covered' }]
  });
  assert.strictEqual(auditStructuredResult(verifierResult, 'verifier-report').valid, true);
  const failedVerifier = receipt('verifier-report', {
    verdict: 'fail',
    checks: [{ name: 'coverage', passed: false, evidence: 'one obligation was omitted' }]
  }, 'fail');
  assert.strictEqual(auditStructuredResult(failedVerifier, 'verifier-report').valid, false);
}

function writeAuditEvents(root, events) {
  const file = path.join(root, 'clio', 'state', 'audit', '2026-08-29.jsonl');
  writePrivate(file, `${events.map(event => JSON.stringify({
    kind: 'tool_call',
    ...event
  })).join('\n')}\n`);
}

function toolAuditFixture(root, name, events) {
  const fixture = path.join(root, `tool-audit-${name}`);
  const project = path.join(fixture, 'project');
  makePrivateDirectory(project);
  makePrivateDirectory(path.join(fixture, 'clio', 'config', 'extensions', 'wtfp'));
  writeAuditEvents(fixture, events);
  return { fixture, project };
}

function testFleetToolActivityAudit(root) {
  for (const fleet of FLEETS) {
    const valid = toolAuditFixture(root, `valid-${fleet.name}`, fleet.exactMutationFiles.map(relative => ({
      tool: 'write',
      args: { path: relative }
    })));
    const audit = auditFleetToolActivity(fleet, valid.fixture, valid.project, {});
    assert.strictEqual(audit.valid, true, audit.errors.join('; '));
    assert.strictEqual(audit.file_mutations.length, fleet.exactMutationFiles.length);
    assert.deepStrictEqual(audit.exact_allowed_files, [...fleet.exactMutationFiles]);
  }

  const forbidden = toolAuditFixture(root, 'forbidden', [{
    tool: 'bash',
    args: { command: 'printf forbidden' }
  }]);
  const forbiddenAudit = auditFleetToolActivity(FLEETS[0], forbidden.fixture, forbidden.project, {});
  assert.strictEqual(forbiddenAudit.valid, false);
  assert(forbiddenAudit.errors.some(error => error.includes('forbidden tool invoked: bash')));
  assert(forbiddenAudit.errors.some(error => error.includes('no mutation-capable tool call')));

  const unobservable = toolAuditFixture(root, 'unobservable', [{
    tool: 'write',
    args: { content: 'target omitted' }
  }]);
  const unobservableAudit = auditFleetToolActivity(FLEETS[0], unobservable.fixture, unobservable.project, {});
  assert.strictEqual(unobservableAudit.valid, false);
  assert(unobservableAudit.errors.some(error => error.includes('mutation target was not observable')));

  const escapedPath = path.join(root, 'outside-project.md');
  const escaped = toolAuditFixture(root, 'escaped', [{
    tool: 'write',
    args: { path: escapedPath }
  }]);
  const escapedAudit = auditFleetToolActivity(FLEETS[0], escaped.fixture, escaped.project, {});
  assert.strictEqual(escapedAudit.valid, false);
  assert(escapedAudit.errors.some(error => error.includes('path escaped authorized roots')));
  assert(escapedAudit.errors.some(error => error.includes('targeted a non-project path')));

  const undeclared = toolAuditFixture(root, 'undeclared', [{
    tool: 'write',
    args: { path: '.planning/sections/evaluation/plans/extra.md' }
  }]);
  const undeclaredAudit = auditFleetToolActivity(FLEETS[0], undeclared.fixture, undeclared.project, {});
  assert.strictEqual(undeclaredAudit.valid, false);
  assert(undeclaredAudit.errors.some(error => error.includes('targeted undeclared exact path')));
}

function testBoundaryRollbackRegression(root) {
  const stateRoot = path.join(root, 'boundary-state');
  const verdictRoot = path.join(stateRoot, 'write-boundaries', 'fleet-plan');
  makePrivateDirectory(verdictRoot);
  const binding = bindPrivateRoot(stateRoot, 'synthetic fleet state');
  const fleet = FLEETS[0];
  const nested = '.planning/sections/evaluation/plans/initial.md';
  writeJson(path.join(verdictRoot, 'wave-1.json'), boundaryVerdict(
    'wave-1', [fleet.mutatorStep], [...fleet.writes], [nested]
  ));
  writeJson(path.join(verdictRoot, 'wave-2.json'), boundaryVerdict(
    'wave-2', [fleet.verifierStep], []
  ));
  const cleanSummary = summaryFor(fleet, 'fleet-plan');
  const clean = auditWriteBoundaries(binding, stateRoot, fleet, cleanSummary);
  assert.strictEqual(clean.valid, true, clean.errors.join('; '));

  const rolledBack = boundaryVerdict('wave-1', [fleet.mutatorStep], ['.planning'], [nested]);
  Object.assign(rolledBack, {
    violations: [nested],
    rolledBack: [nested],
    status: 'violated',
    reason: 'write-boundary-violation',
    detail: `${nested} is outside literal file boundary .planning`
  });
  rolledBack.digest = verdictDigest(rolledBack);
  writeJson(path.join(verdictRoot, 'wave-1.json'), rolledBack);
  const violationSummary = summaryFor(fleet, 'fleet-plan');
  violationSummary.writeBoundaries[0] = {
    window: 'wave-1', violated: true, failedStepIds: [fleet.mutatorStep], detail: rolledBack.detail
  };
  const rejected = auditWriteBoundaries(binding, stateRoot, fleet, violationSummary);
  assert.strictEqual(rejected.valid, false);
  assert(rejected.errors.some(error => error.includes('not one sealed clean')));
  const stream = parseFleetStream([
    JSON.stringify({ runId: 'one', agentId: fleet.mutator }),
    JSON.stringify({ runId: 'two', agentId: fleet.verifier }),
    JSON.stringify(violationSummary)
  ].join('\n'), fleet.name);
  assert.strictEqual(stream.valid, false, 'a rollback-bearing summary must fail the stdout audit');
}

function rawReceipt(fleet, index, summary, output) {
  const agent = index === 0 ? fleet.mutator : fleet.verifier;
  const runId = `${summary.rootId}-${index + 1}`;
  const text = JSON.stringify(output);
  const started = index === 0 ? '2026-08-29T00:00:00.000Z' : '2026-08-29T00:02:00.000Z';
  const ended = index === 0 ? '2026-08-29T00:01:00.000Z' : '2026-08-29T00:03:00.000Z';
  return {
    runId,
    agentId: agent,
    requestOrigin: 'user',
    sessionId: 'synthetic-session',
    targetId: 'openai-codex',
    wireModelId: 'gpt-5.6-terra',
    runtimeId: 'openai-codex',
    runtimeKind: 'http',
    node: { id: 'local', kind: 'local' },
    outcome: 'succeeded',
    exitCode: 0,
    clioVersion: '0.3.8',
    costUsd: 0,
    costProvenance: 'known_free',
    startedAt: started,
    endedAt: ended,
    task: `Perform the bounded evaluation section ${index === 0 ? 'mutation' : 'verification'}.`,
    compiledPromptHash: '1'.repeat(64),
    staticCompositionHash: '2'.repeat(64),
    promptSignature: '3'.repeat(64),
    toolSignature: '4'.repeat(64),
    inputTokenCount: 10,
    outputTokenCount: 10,
    cacheReadTokenCount: 0,
    reasoningTokenCount: 0,
    toolCalls: 0,
    toolStats: [],
    skillActivations: [],
    lineage: { rootRunId: summary.rootId, parentRunId: summary.rootId, attempt: 0, depth: 1 },
    quality: {
      resultContract: {
        sourceId: `agent-result-contract:${index === 0 ? 'mutation-report' : 'verifier-report'}:${'5'.repeat(64)}`,
        validatorDigest: '6'.repeat(64),
        conformance: 'pass',
        quality: 'pass'
      }
    },
    output: { state: 'final', text, bytes: Buffer.byteLength(text), truncated: false },
    autonomyEnforcement: { autonomy: index === 0 ? 'auto-edit' : 'read-only' },
    runtimeResolution: {
      targetId: 'openai-codex',
      wireModelId: 'gpt-5.6-terra',
      requestedThinkingLevel: 'xhigh',
      effectiveThinkingLevel: 'xhigh',
      auth: 'oauth',
      authRequired: true,
      runtimeId: 'openai-codex',
      runtimeKind: 'http',
      apiFamily: 'openai-codex-responses',
      runtimeTier: 'cloud',
      diagnostics: []
    }
  };
}

function testReceiptAndLedgerAuditors(root) {
  const fleet = FLEETS[0];
  const summary = summaryFor(fleet, 'fleet-receipts');
  const changed = '.planning/sections/evaluation/plans/initial.md';
  const raw = [
    rawReceipt(fleet, 0, summary, {
      mutatedPaths: [changed],
      validations: [{ name: 'boundary', passed: true, evidence: 'only the declared path changed' }]
    }),
    rawReceipt(fleet, 1, summary, {
      verdict: 'pass',
      checks: [{ name: 'coverage', passed: true, evidence: 'the plan covers each supplied observation' }]
    })
  ];
  const receiptRoot = path.join(root, 'receipt-root');
  const stateRoot = path.join(receiptRoot, 'clio', 'state');
  makePrivateDirectory(path.join(stateRoot, 'receipts'));
  for (const receipt of raw) writeJson(path.join(stateRoot, 'receipts', `${receipt.runId}.json`), receipt);
  const binding = bindPrivateRoot(stateRoot, 'synthetic receipt state');
  const collected = lifecycle.collectReceipts(receiptRoot);
  for (const receipt of collected.receipts) {
    receipt.integrity_verification = { valid: true, reason: null, ledger: 'synthetic' };
  }
  const delta = {
    valid: true,
    receipts: collected.receipts,
    verifier: { module: 'synthetic', sha256: '7'.repeat(64) },
    cost: collected.cost,
    errors: []
  };
  const audit = auditFleetReceipts({
    fleet,
    stream: { receipts: raw, summary },
    delta,
    changedFiles: [changed],
    stateBinding: binding,
    root: receiptRoot
  });
  assert.strictEqual(audit.valid, true, audit.errors.join('; '));

  makePrivateDirectory(path.join(stateRoot, 'fleet-runs'));
  writeJson(path.join(stateRoot, 'fleet-runs', `${summary.rootId}.json`), {
    version: 1,
    id: summary.rootId,
    fleet: fleet.name,
    planHash: summary.planHash,
    stepIds: [fleet.mutatorStep, fleet.verifierStep],
    vars: { section: 'evaluation' },
    resumedFrom: null,
    startedAt: '2026-08-29T00:00:00.000Z',
    endedAt: '2026-08-29T00:03:00.000Z',
    steps: [
      { stepId: fleet.mutatorStep, result: { terminalRunId: raw[0].runId, succeeded: true, integrityValid: true, boundaryViolated: false, failureReason: null } },
      { stepId: fleet.verifierStep, result: { terminalRunId: raw[1].runId, succeeded: true, integrityValid: true, boundaryViolated: false, failureReason: null } }
    ]
  });
  const ledger = auditFleetLedger(binding, stateRoot, fleet, summary, audit);
  assert.strictEqual(ledger.valid, true, ledger.errors.join('; '));

  collected.receipts[0].tool_stats = [{ tool: 'git-status', calls: 1 }];
  assert.strictEqual(auditFleetReceipts({
    fleet,
    stream: { receipts: raw, summary },
    delta,
    changedFiles: [changed],
    stateBinding: binding,
    root: receiptRoot
  }).valid, false, 'a forbidden receipt tool must fail the receipt audit');
}

async function testCredentialAndProcessAdversaries(root) {
  const sources = path.join(root, 'credential-sources');
  makePrivateDirectory(sources);
  const privateSource = path.join(sources, 'credentials.yaml');
  writePrivate(privateSource, 'token: synthetic-never-a-real-secret\n');
  const read = readExternalSource(privateSource, 'synthetic credential source', { private: true });
  assert.strictEqual(read.sha256, sha256(Buffer.from('token: synthetic-never-a-real-secret\n')));
  read.bytes.fill(0);

  const sourceSymlink = path.join(sources, 'credential-link.yaml');
  fs.symlinkSync(privateSource, sourceSymlink);
  assert.throws(() => readExternalSource(sourceSymlink, 'synthetic symlink', { private: true }), /without following links/u);
  const externalHardLink = path.join(root, 'external-hard-link.yaml');
  fs.linkSync(privateSource, externalHardLink);
  assert.throws(() => readExternalSource(privateSource, 'synthetic hard link', { private: true }), /singly linked/u);
  fs.unlinkSync(externalHardLink);
  fs.chmodSync(privateSource, 0o640);
  assert.throws(() => readExternalSource(privateSource, 'synthetic visible credential', { private: true }), /group or other/u);
  fs.chmodSync(privateSource, 0o600);

  const rotationRoot = path.join(root, 'atomic-rotation');
  const rotationConfig = path.join(rotationRoot, 'config');
  const credential = path.join(rotationConfig, 'credentials.yaml');
  const temporary = path.join(rotationConfig, '.credentials.yaml.rotation');
  makePrivateDirectory(rotationConfig);
  const binding = lifecycle.bindContainedPrivateDirectory(rotationRoot, rotationConfig, 'rotation config');
  const handle = lifecycle.openPrivateCredential(credential, Buffer.from('token: synthetic-original\n'));
  handle.directory_binding = binding;
  writePrivate(temporary, 'token: synthetic-rotated\n');
  fs.renameSync(temporary, credential);
  const approval = lifecycle.readContainedPrivateFileEvidence(
    rotationRoot, rotationConfig, credential, 'rotated credential',
    { maxBytes: 1024, directoryBinding: binding, approveCredentialRotation: true }
  );
  const cleanup = lifecycle.cleanupCredentialArtifactsSafe(
    rotationConfig, credential, rotationRoot, handle, approval
  );
  approval.bytes.fill(0);
  assert.strictEqual(cleanup.status, 'securely-removed');
  assert.strictEqual(cleanup.absent, true);
  assert(cleanup.files.some(file => file.method === 'rotated-inode'));

  const hardRoot = path.join(root, 'hardlink-cleanup');
  const hardConfig = path.join(hardRoot, 'config');
  const hardCredential = path.join(hardConfig, 'credentials.yaml');
  const sentinel = path.join(root, 'hardlink-sentinel.txt');
  makePrivateDirectory(hardConfig);
  writePrivate(sentinel, 'external sentinel survives\n');
  const sentinelBytes = fs.readFileSync(sentinel);
  fs.linkSync(sentinel, hardCredential);
  const hardCleanup = lifecycle.cleanupCredentialArtifactsSafe(hardConfig, hardCredential, hardRoot);
  assert.strictEqual(hardCleanup.status, 'cleanup-failed');
  assert.strictEqual(fs.existsSync(hardCredential), false);
  assert.deepStrictEqual(fs.readFileSync(sentinel), sentinelBytes);

  const symlinkRoot = path.join(root, 'symlink-cleanup');
  const symlinkConfig = path.join(symlinkRoot, 'config');
  const symlinkCredential = path.join(symlinkConfig, 'credentials.yaml');
  const symlinkSentinel = path.join(root, 'symlink-sentinel.txt');
  makePrivateDirectory(symlinkConfig);
  writePrivate(symlinkSentinel, 'symlink target survives\n');
  const symlinkBytes = fs.readFileSync(symlinkSentinel);
  fs.symlinkSync(symlinkSentinel, symlinkCredential);
  const symlinkCleanup = lifecycle.secureRemove(symlinkCredential, {
    configRoot: symlinkConfig,
    disposableRoot: symlinkRoot,
    expected: { device: -1, inode: -1 }
  });
  assert.strictEqual(symlinkCleanup.status, 'cleanup-failed');
  assert.strictEqual(fs.existsSync(symlinkCredential), false);
  assert.deepStrictEqual(fs.readFileSync(symlinkSentinel), symlinkBytes);

  const activeRoot = path.join(root, 'active-process');
  const activeConfig = path.join(activeRoot, 'config');
  const activeCredential = path.join(activeConfig, 'credentials.yaml');
  makePrivateDirectory(activeConfig);
  writePrivate(activeCredential, 'token: synthetic-active\n');
  const activeBinding = lifecycle.bindContainedPrivateDirectory(activeRoot, activeConfig, 'active config');
  const running = lifecycle.spawnCaptured({
    executable: process.execPath,
    argv: ['-e', 'setInterval(() => {}, 1000)'],
    cwd: activeRoot,
    env: process.env,
    stdoutFile: path.join(activeRoot, 'child.stdout'),
    stderrFile: path.join(activeRoot, 'child.stderr'),
    timeoutMs: 75
  });
  assert.throws(() => lifecycle.readContainedPrivateFileEvidence(
    activeRoot, activeConfig, activeCredential, 'active rotated credential',
    { maxBytes: 1024, directoryBinding: activeBinding, approveCredentialRotation: true }
  ), /process group.*quiescent/u);
  const processResult = await running;
  assert.strictEqual(processResult.timedOut, true);
  assert.strictEqual(processResult.processGroup.quiesced, true);
  assert.strictEqual(processResult.processGroup.term_sent, true);
  assert.strictEqual(lifecycle.secureRemove(activeCredential, {
    configRoot: activeConfig,
    disposableRoot: activeRoot,
    directoryBinding: activeBinding
  }).status, 'securely-removed');
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-evaluation-fleets-test.'));
  fs.chmodSync(root, 0o700);
  try {
    testDryRunIdentityAndArguments();
    testSeedAndNativeTopology(root);
    testMutationAndResultAuditors();
    testFleetToolActivityAudit(root);
    testBoundaryRollbackRegression(root);
    testReceiptAndLedgerAuditors(root);
    await testCredentialAndProcessAdversaries(root);
    console.log('✓ fleet dry-run identity, exact commands, and trailing-slash topology are executable');
    console.log('✓ rollback, mutation, receipt, result-contract, boundary, and ledger audits fail closed');
    console.log('✓ incremental tool audit accepts exact fleet mutations and rejects forbidden, hidden, escaping, or undeclared targets');
    console.log('✓ credential argv, source, rotation, link, and process-quiescence defenses hold');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
