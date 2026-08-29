#!/usr/bin/env node

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { compareResults } = require('../evaluation/tools/compare-results');

const repositoryRoot = path.resolve(__dirname, '..');
const baselineFile = path.join(repositoryRoot, 'evaluation', 'v1', 'baselines', 'hpc-checkpointing.json');
const rubricFile = path.join(repositoryRoot, 'evaluation', 'v1', 'rubrics', 'semantic-rubric.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function writePrivate(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, bytes, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

function evidenceClaim(root, name, payload, method, assessor = null) {
  const relative = `evidence/${name}`;
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
  writePrivate(path.join(root, relative), bytes);
  return {
    locator: relative,
    sha256: sha256(bytes),
    assessor: assessor || { kind: 'independent-tool', name: 'semantic-evidence-harness', version: '1' },
    summary: `Independent ${method} evidence for ${name}`,
    method
  };
}

function identityReceipt(run) {
  return {
    schema: 'wtfp.evaluation.identity-receipt/v1',
    client: {
      name: run.client.name,
      actual_version: run.client.actual_version,
      binary_sha256: run.client.binary.sha256
    },
    model: {
      provider: run.model.provider,
      actual_id: run.model.actual_id,
      actual_version: run.model.actual_version
    },
    effort: { requested: run.effort, effective: run.effective_effort },
    provenance: {
      kind: 'sealed-client-receipt',
      source_sha256s: [sha256(Buffer.from('sealed native client identity event\n', 'utf8'))]
    }
  };
}

function bindIdentityReceipt(candidate, root, name, mutate = null) {
  const receipt = identityReceipt(candidate.run);
  if (mutate) mutate(receipt);
  candidate.run.identity_evidence = evidenceClaim(
    root,
    `${name}.json`,
    Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf8'),
    'deterministic-check'
  );
}

function buildPaidCandidate(root) {
  const baseline = readJson(baselineFile);
  const rubric = readJson(rubricFile);
  const binarySha = sha256(fs.readFileSync(process.execPath));
  const run = {
    id: 'paid-semantic-evidence-run',
    started_at: '2026-08-29T12:00:00Z',
    evidence_level: 'paid-model',
    client: {
      name: 'Semantic Evaluation Client',
      requested_version: '1.0.0',
      actual_version: '1.0.0',
      binary: { path: process.execPath, sha256: binarySha }
    },
    model: {
      provider: 'test-provider',
      requested_id: 'test-model',
      actual_id: 'test-model',
      requested_version: 'test-model-v1',
      actual_version: 'test-model-v1'
    },
    effort: 'xhigh',
    effective_effort: 'xhigh',
    permission_policy: 'read-only semantic evaluation with contained fixture writes only',
    protocol: {
      project_protocol_version: baseline.protocol.project_protocol_version,
      adapter_compiler_version: baseline.protocol.adapter_compiler_version,
      wtfp_commit: baseline.protocol.canonical_source_commit,
      client_commit: null,
      source_sha256: baseline.protocol.canonical_source_sha256
    },
    fixture: clone(baseline.fixture),
    execution: {
      target: 'semantic-test',
      command_sha256: sha256(Buffer.from('semantic test command\n', 'utf8')),
      environment_policy: 'fresh private fixture, client home, state roots, and process boundary'
    },
    profile_hashes: [{
      label: 'normal-profile',
      before_sha256: sha256(Buffer.from('normal profile absent\n', 'utf8')),
      after_sha256: sha256(Buffer.from('normal profile absent\n', 'utf8')),
      unchanged: true
    }],
    case_isolation: {
      strategy: 'single-scenario-session',
      session_ids_unique: true,
      conversational_memory_shared: true,
      evidence: evidenceClaim(root, 'case-isolation.json', '{"fresh_resume_process":true}\n', 'deterministic-check')
    }
  };
  bindIdentityReceipt({ run }, root, 'identity-receipt');

  const dimensions = new Map(rubric.dimensions.map(dimension => [dimension.id, dimension]));
  const invariants = baseline.expected_invariants.map(expected => {
    const deterministic = evidenceClaim(
      root,
      `${expected.id}-deterministic.json`,
      `${JSON.stringify({ invariant: expected.id, deterministic: true })}\n`,
      'deterministic-check'
    );
    const semantic = evidenceClaim(
      root,
      `${expected.id}-semantic.md`,
      `Independent semantic review for ${expected.id}.\n`,
      'independent-semantic-review',
      { kind: 'human', name: 'independent-semantic-reviewer', version: '1' }
    );
    const anchors = dimensions.get(expected.id).anchors.map(anchor => ({
      id: anchor.id,
      weight: anchor.weight,
      verdict: 'pass',
      earned_points: anchor.weight,
      evidence_sha256s: anchor.evidence_kind === 'deterministic-check'
        ? [deterministic.sha256]
        : anchor.evidence_kind === 'independent-semantic-review'
          ? [semantic.sha256]
          : [deterministic.sha256, semantic.sha256],
      observation: `${anchor.id} passes against independently retained evidence`
    }));
    return {
      id: expected.id,
      class: expected.class,
      phases: clone(expected.phases),
      status: 'pass',
      score: 1,
      ...(expected.maximum_observed_value === undefined ? {} : { observed_value: 0 }),
      scoring: {
        earned_points: anchors.reduce((sum, anchor) => sum + anchor.earned_points, 0),
        possible_points: anchors.reduce((sum, anchor) => sum + anchor.weight, 0),
        ...(expected.maximum_observed_value === undefined ? {} : { observed_count: 0, total_count: 12 }),
        anchors
      },
      summary: 'Meets the versioned semantic floor with typed independent evidence.',
      evidence: [deterministic, semantic]
    };
  });

  const outputBytes = Buffer.from('Bounded claim.\nSafe next action.\n', 'utf8');
  writePrivate(path.join(root, 'evidence', 'model-output.md'), outputBytes);
  const candidate = {
    schema: 'wtfp.evaluation.result/v1',
    outcome: 'completed',
    run,
    scenario: {
      id: baseline.scenario.id,
      phases_exercised: baseline.scenario.phases.filter(phase => phase !== 'always'),
      oracle_sha256: baseline.scenario.oracle_sha256,
      action_sequence: clone(baseline.scenario.action_sequence),
      process_boundaries: [{
        after_action: 'pause-writing',
        fresh_process: true,
        evidence: evidenceClaim(root, 'process-boundary.json', '{"fresh_process":true}\n', 'deterministic-check')
      }]
    },
    capabilities: baseline.required_capabilities.map(id => ({
      id,
      status: 'available',
      evidence: evidenceClaim(root, `capability-${id.replace(/[^a-z0-9]+/gu, '-')}.json`,
        `${JSON.stringify({ capability: id, available: true })}\n`, 'deterministic-check')
    })),
    invariants,
    artifacts: {
      planning: {
        records_observed: 10,
        records_produced: 10,
        evidence: evidenceClaim(root, 'planning-inventory.json', '{"observed":10,"produced":10}\n', 'deterministic-check')
      },
      schema_validation: {
        checked: 10,
        valid: 10,
        invalid: 0,
        evidence: evidenceClaim(root, 'schema-validation.json', '{"checked":10,"valid":10,"invalid":0}\n', 'deterministic-check')
      },
      vcs: {
        before_sha256: sha256(Buffer.from('unchanged git state\n', 'utf8')),
        after_sha256: sha256(Buffer.from('unchanged git state\n', 'utf8')),
        unchanged: true,
        evidence: evidenceClaim(root, 'vcs-state.json', '{"unchanged":true}\n', 'deterministic-check')
      },
      profiles: {
        unchanged: true,
        evidence: evidenceClaim(root, 'profile-state.json', '{"unchanged":true}\n', 'deterministic-check')
      },
      credentials: {
        forwarded: false,
        cleanup_status: 'not-forwarded',
        evidence: evidenceClaim(root, 'credential-state.json', '{"forwarded":false}\n', 'deterministic-check')
      }
    },
    output: {
      locator: 'evidence/model-output.md',
      sha256: sha256(outputBytes),
      semantic_units: ['bounded claim', 'safe next action'],
      evidence: evidenceClaim(root, 'output-inventory.json', '{"semantic_units":2}\n', 'deterministic-check')
    },
    cost: {
      status: 'metered',
      amount: 0.01,
      currency: 'USD',
      source: 'sealed native client cost receipt',
      evidence: evidenceClaim(root, 'cost-receipt.json', '{"cost_usd":0.01,"provenance":"metered"}\n', 'deterministic-check')
    },
    latency_ms: 1
  };
  return { baseline, candidate };
}

function observedComparison(baseline, candidate, root) {
  return compareResults(baseline, candidate, { evidenceRoot: root, requireEvidenceFiles: true });
}

function expectedAnchor(candidate, kind) {
  const rubric = readJson(rubricFile);
  for (const dimension of rubric.dimensions) {
    const anchor = dimension.anchors.find(item => item.evidence_kind === kind);
    if (anchor) {
      return {
        invariant: candidate.invariants.find(item => item.id === dimension.id),
        anchorId: anchor.id
      };
    }
  }
  throw new Error(`rubric has no ${kind} anchor`);
}

function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-evaluation-comparison.'));
  fs.chmodSync(root, 0o700);
  try {
    const { baseline, candidate } = buildPaidCandidate(root);
    assert.strictEqual(observedComparison(baseline, candidate, root).disposition, 'meets-baseline');

    const missingIdentity = clone(candidate);
    delete missingIdentity.run.identity_evidence;
    assert.throws(() => observedComparison(baseline, missingIdentity, root), /missing hash-bound native identity evidence/);

    const missingIdentityFile = clone(candidate);
    missingIdentityFile.run.identity_evidence.locator = 'evidence/missing-identity.json';
    assert.throws(() => observedComparison(baseline, missingIdentityFile, root), /is missing/);

    const forgedIdentityDigest = clone(candidate);
    forgedIdentityDigest.run.identity_evidence.sha256 = '0'.repeat(64);
    assert.throws(() => observedComparison(baseline, forgedIdentityDigest, root), /digest differs/);

    const wrongModel = clone(candidate);
    bindIdentityReceipt(wrongModel, root, 'identity-wrong-model', receipt => { receipt.model.actual_id = 'other-model'; });
    assert.throws(() => observedComparison(baseline, wrongModel, root), /identity receipt model actual id differs/);

    const wrongBinary = clone(candidate);
    bindIdentityReceipt(wrongBinary, root, 'identity-wrong-binary', receipt => { receipt.client.binary_sha256 = '0'.repeat(64); });
    assert.throws(() => observedComparison(baseline, wrongBinary, root), /identity receipt client binary digest differs/);

    const wrongEffort = clone(candidate);
    bindIdentityReceipt(wrongEffort, root, 'identity-wrong-effort', receipt => { receipt.effort.effective = 'low'; });
    assert.throws(() => observedComparison(baseline, wrongEffort, root), /identity receipt effective effort differs/);

    const humanIdentity = clone(candidate);
    humanIdentity.run.identity_evidence.assessor = { kind: 'human', name: 'operator', version: '1' };
    assert.throws(() => observedComparison(baseline, humanIdentity, root), /identity evidence must be a deterministic/);

    const hybridMissingSemantic = clone(candidate);
    const hybrid = expectedAnchor(hybridMissingSemantic, 'hybrid');
    hybrid.invariant.scoring.anchors.find(item => item.id === hybrid.anchorId).evidence_sha256s = [
      hybrid.invariant.evidence.find(item => item.method === 'deterministic-check').sha256
    ];
    assert.throws(() => observedComparison(baseline, hybridMissingSemantic, root), /requires distinct deterministic and independent-semantic evidence/);

    const deterministicForgery = clone(candidate);
    const deterministic = expectedAnchor(deterministicForgery, 'deterministic-check');
    deterministic.invariant.scoring.anchors.find(item => item.id === deterministic.anchorId).evidence_sha256s = [
      deterministic.invariant.evidence.find(item => item.method === 'independent-semantic-review').sha256
    ];
    assert.throws(() => observedComparison(baseline, deterministicForgery, root), /requires deterministic-check evidence/);

    const semanticForgery = clone(candidate);
    const semantic = expectedAnchor(semanticForgery, 'independent-semantic-review');
    semantic.invariant.scoring.anchors.find(item => item.id === semantic.anchorId).evidence_sha256s = [
      semantic.invariant.evidence.find(item => item.method === 'deterministic-check').sha256
    ];
    assert.throws(() => observedComparison(baseline, semanticForgery, root), /requires independent-semantic-review evidence/);

    const independentModelReview = clone(candidate);
    const independent = independentModelReview.invariants[0].evidence
      .find(item => item.method === 'independent-semantic-review');
    independent.assessor = {
      kind: 'model', name: 'independent-semantic-judge', version: '1', relationship: 'independent-evaluator'
    };
    assert.strictEqual(observedComparison(baseline, independentModelReview, root).disposition, 'meets-baseline');

    const candidateSelfReport = clone(independentModelReview);
    candidateSelfReport.invariants[0].evidence
      .find(item => item.method === 'independent-semantic-review').assessor.relationship = 'candidate';
    assert.throws(() => observedComparison(baseline, candidateSelfReport, root), /candidate-model self-report/);

    const legacyPaidCost = clone(candidate);
    legacyPaidCost.cost = { amount: 0.01, currency: 'USD' };
    assert.throws(() => observedComparison(baseline, legacyPaidCost, root), /cost must record metered, estimated, or unavailable provenance/);

    const humanCost = clone(candidate);
    humanCost.cost.evidence.assessor = { kind: 'human', name: 'operator', version: '1' };
    assert.throws(() => observedComparison(baseline, humanCost, root), /cost provenance requires deterministic independent evidence/);

    const unknownCost = clone(candidate);
    unknownCost.cost.status = 'unavailable';
    unknownCost.cost.amount = null;
    unknownCost.cost.currency = null;
    unknownCost.cost.source = 'native client exposes no independently priced USD total';
    assert.strictEqual(observedComparison(baseline, unknownCost, root).disposition, 'meets-baseline');

    const observedEffortDifference = clone(candidate);
    observedEffortDifference.run.effective_effort = 'high';
    bindIdentityReceipt(observedEffortDifference, root, 'identity-effective-effort-difference');
    assert.strictEqual(observedComparison(baseline, observedEffortDifference, root).disposition,
      'inconclusive-capability');

    process.stdout.write('✓ semantic comparison requires typed hybrid evidence, sealed paid identity, and honest cost provenance\n');
    process.stdout.write('✓ missing, forged, mismatched, human-self-attested, and candidate-model evidence fails closed\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main();
