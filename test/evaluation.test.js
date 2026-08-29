#!/usr/bin/env node

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  CLASSIFICATIONS,
  compareResults
} = require('../evaluation/tools/compare-results');
const { checkFixture } = require('../evaluation/tools/hash-fixtures');
const {
  lintBaselineEvidenceState,
  lintBudgetMatrix,
  lintEvaluation,
  schemaRegistry
} = require('../evaluation/tools/lint');
const {
  canonicalCapabilities,
  canonicalResources,
  clientSurface,
  definitionCatalog,
  materializeNativeInput,
  scoreObservations
} = require('../evaluation/tools/score-routing');
const { validatePlanningPaths } = require('../evaluation/tools/validate-planning');

const repositoryRoot = path.resolve(__dirname, '..');
const evaluationRoot = path.join(repositoryRoot, 'evaluation');
const templatesRoot = path.join(repositoryRoot, 'protocol', 'project', 'templates');
const fixtureRoot = path.join(evaluationRoot, 'v1', 'fixtures', 'hpc-checkpointing');
const baselineFile = path.join(evaluationRoot, 'v1', 'baselines', 'hpc-checkpointing.json');
const semanticRubricFile = path.join(evaluationRoot, 'v1', 'rubrics', 'semantic-rubric.json');
const matrixFile = path.join(evaluationRoot, 'v1', 'matrix', 'budget.json');
const routingManifestFile = path.join(evaluationRoot, 'v1', 'routing', 'manifest.json');
const compareTool = path.join(evaluationRoot, 'tools', 'compare-results.js');
const routingTool = path.join(evaluationRoot, 'tools', 'score-routing.js');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function evidence(label = 'deterministic evaluation evidence') {
  return {
    locator: `evidence://${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    sha256: sha256(Buffer.from(label, 'utf8')),
    assessor: { kind: 'independent-tool', name: 'evaluation-harness', version: '1' },
    summary: label
  };
}

function materializeEvidence(document, root) {
  let sequence = 0;
  const digestRemap = new Map();
  if (document.output) {
    const relative = 'evidence/model-output.txt';
    const bytes = Buffer.from(`${document.output.semantic_units.join('\n')}\n`, 'utf8');
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
    document.output.locator = relative;
    document.output.sha256 = sha256(bytes);
  }
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (
      typeof value.locator === 'string' &&
      typeof value.sha256 === 'string' &&
      value.assessor &&
      typeof value.summary === 'string'
    ) {
      const relative = `evidence/${String(sequence++).padStart(4, '0')}.txt`;
      const bytes = Buffer.from(`${value.summary}\n`, 'utf8');
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
      const previousSha256 = value.sha256;
      value.locator = relative;
      value.sha256 = sha256(bytes);
      digestRemap.set(previousSha256, value.sha256);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    for (const item of Object.values(value)) visit(item);
  }
  visit(document);
  for (const invariant of document.invariants || []) {
    for (const anchor of invariant.scoring.anchors) {
      anchor.evidence_sha256 = digestRemap.get(anchor.evidence_sha256) || anchor.evidence_sha256;
    }
  }
}

function anchoredScoring(invariantId, evidenceClaim, verdict = 'pass') {
  const dimension = readJson(semanticRubricFile).dimensions.find(item => item.id === invariantId);
  assert(dimension, `missing rubric dimension ${invariantId}`);
  const factor = { pass: 1, warning: 0.5, fail: 0, 'capability-unavailable': 0 }[verdict];
  const anchors = dimension.anchors.map(anchor => ({
    id: anchor.id,
    weight: anchor.weight,
    verdict,
    earned_points: anchor.weight * factor,
    evidence_sha256: evidenceClaim.sha256,
    observation: `${anchor.id} assessed against the versioned fixture oracle`
  }));
  return {
    earned_points: anchors.reduce((total, anchor) => total + anchor.earned_points, 0),
    possible_points: anchors.reduce((total, anchor) => total + anchor.weight, 0),
    anchors
  };
}

function rescoreInvariant(invariant, verdicts) {
  const values = Array.isArray(verdicts)
    ? verdicts
    : invariant.scoring.anchors.map(() => verdicts);
  assert.strictEqual(values.length, invariant.scoring.anchors.length);
  const factors = { pass: 1, warning: 0.5, fail: 0, 'capability-unavailable': 0 };
  invariant.scoring.anchors.forEach((anchor, index) => {
    anchor.verdict = values[index];
    anchor.earned_points = anchor.weight * factors[values[index]];
  });
  invariant.scoring.earned_points = invariant.scoring.anchors
    .reduce((total, anchor) => total + anchor.earned_points, 0);
  invariant.scoring.possible_points = invariant.scoring.anchors
    .reduce((total, anchor) => total + anchor.weight, 0);
  invariant.score = invariant.scoring.earned_points / invariant.scoring.possible_points;
}

function runMetadata(baseline, overrides = {}) {
  return {
    id: 'static-evaluation-run',
    started_at: '2026-08-29T12:00:00Z',
    evidence_level: 'static-lint',
    client: {
      name: 'evaluation-harness',
      requested_version: '1',
      actual_version: '1',
      binary: { path: 'node:test/evaluation.test.js', sha256: 'a'.repeat(64) }
    },
    model: {
      provider: 'none',
      requested_id: 'none',
      actual_id: 'none',
      requested_version: 'not-applicable',
      actual_version: 'not-applicable'
    },
    effort: 'not-applicable',
    permission_policy: 'read-only',
    protocol: {
      project_protocol_version: 1,
      adapter_compiler_version: baseline.protocol.adapter_compiler_version,
      wtfp_commit: baseline.protocol.canonical_source_commit,
      client_commit: null,
      source_sha256: baseline.protocol.canonical_source_sha256
    },
    fixture: clone(baseline.fixture),
    execution: {
      target: 'static-evaluation',
      command_sha256: 'c'.repeat(64),
      environment_policy: 'disposable read-only harness'
    },
    profile_hashes: [{
      label: 'normal-profile',
      before_sha256: 'd'.repeat(64),
      after_sha256: 'd'.repeat(64),
      unchanged: true
    }],
    case_isolation: {
      strategy: 'fresh-session-per-case',
      session_ids_unique: true,
      conversational_memory_shared: false,
      evidence: evidence('fresh sessions are assigned by case id')
    },
    ...overrides
  };
}

function snapshotTree(root, relative = '') {
  const snapshot = {};
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const childRelative = path.join(relative, entry.name);
    const absolute = path.join(root, childRelative);
    const stat = fs.lstatSync(absolute);
    if (entry.isDirectory()) Object.assign(snapshot, snapshotTree(root, childRelative));
    else if (entry.isFile()) {
      snapshot[childRelative.split(path.sep).join('/')] = {
        bytes: stat.size,
        mode: stat.mode,
        mtimeMs: stat.mtimeMs,
        sha256: sha256(fs.readFileSync(absolute))
      };
    }
  }
  return snapshot;
}

function createPlanningProject(root) {
  const planning = path.join(root, '.planning');
  fs.mkdirSync(planning, { recursive: true });
  for (const name of fs.readdirSync(templatesRoot).filter(name => name.endsWith('.json'))) {
    fs.copyFileSync(path.join(templatesRoot, name), path.join(planning, name));
  }
  return planning;
}

function candidateFromBaseline(baseline) {
  return {
    schema: 'wtfp.evaluation.result/v1',
    outcome: 'completed',
    run: runMetadata(baseline, {
      id: 'semantic-candidate',
      case_isolation: {
        strategy: 'single-scenario-session',
        session_ids_unique: true,
        conversational_memory_shared: true,
        evidence: evidence('single lifecycle scenario with an explicit fresh resume boundary')
      }
    }),
    scenario: {
      id: baseline.scenario.id,
      phases_exercised: baseline.scenario.phases.filter(phase => phase !== 'always'),
      oracle_sha256: baseline.scenario.oracle_sha256,
      action_sequence: readJson(path.join(fixtureRoot, 'expected-invariants.json')).action_sequence,
      process_boundaries: [{
        after_action: 'pause-writing',
        fresh_process: true,
        evidence: evidence('resume executed in a fresh process')
      }]
    },
    capabilities: baseline.required_capabilities.map(id => ({
      id,
      status: 'available',
      evidence: evidence(`capability ${id} observed`)
    })),
    invariants: baseline.expected_invariants.map(invariant => {
      const invariantEvidence = evidence(`${invariant.id} independent assessment`);
      return {
        id: invariant.id,
        class: invariant.class,
        phases: clone(invariant.phases),
        status: 'pass',
        score: 1,
        ...(invariant.maximum_observed_value === undefined ? {} : { observed_value: 0 }),
        scoring: {
          ...anchoredScoring(invariant.id, invariantEvidence),
          ...(invariant.maximum_observed_value === undefined
            ? {}
            : { observed_count: 0, total_count: 12 })
        },
        summary: 'meets the versioned semantic floor',
        evidence: [invariantEvidence]
      };
    }),
    artifacts: {
      planning: {
        records_observed: 10,
        records_produced: 10,
        evidence: evidence('planning record inventory')
      },
      schema_validation: {
        checked: 10,
        valid: 10,
        invalid: 0,
        evidence: evidence('literal canonical schema validation')
      },
      vcs: {
        before_sha256: 'e'.repeat(64),
        after_sha256: 'e'.repeat(64),
        unchanged: true,
        evidence: evidence('git state before and after')
      },
      profiles: {
        unchanged: true,
        evidence: evidence('normal profile hash pairs')
      },
      credentials: {
        forwarded: false,
        cleanup_status: 'not-forwarded',
        evidence: evidence('no credentials forwarded')
      }
    },
    output: {
      locator: 'evidence://model-output',
      sha256: 'f'.repeat(64),
      semantic_units: ['bounded claim', 'safe next action'],
      evidence: evidence('model output bytes')
    },
    cost: { amount: 0, currency: 'USD' },
    latency_ms: 1
  };
}

function assertClassification(comparison, classification) {
  assert(
    comparison.classifications.includes(classification),
    `expected ${classification}, got ${comparison.classifications.join(', ')}`
  );
}

function testPlanningValidator(tempRoot) {
  const project = path.join(tempRoot, 'valid-project');
  fs.mkdirSync(project);
  const planning = createPlanningProject(project);
  const before = snapshotTree(project);
  const result = validatePlanningPaths([project]);
  const after = snapshotTree(project);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.checked, 10);
  assert(result.roots[0].records.every(record => record.valid));
  assert.deepStrictEqual(after, before, 'planning validator modified its input');

  const invalidProject = path.join(tempRoot, 'invalid-project');
  fs.mkdirSync(invalidProject);
  const invalidPlanning = createPlanningProject(invalidProject);
  const manifestFile = path.join(invalidPlanning, 'manifest.json');
  const manifest = readJson(manifestFile);
  manifest.unexpected = true;
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const invalid = validatePlanningPaths([invalidProject]);
  assert.strictEqual(invalid.valid, false);
  assert.match(invalid.roots[0].records.find(record => record.file === 'manifest.json').errors.join('\n'), /unknown property unexpected/);

  const symlinkProject = path.join(tempRoot, 'symlink-project');
  fs.mkdirSync(symlinkProject);
  const symlinkPlanning = path.join(symlinkProject, '.planning');
  fs.mkdirSync(symlinkPlanning);
  fs.symlinkSync(path.join(templatesRoot, 'state.json'), path.join(symlinkPlanning, 'state.json'));
  assert.throws(() => validatePlanningPaths([symlinkProject]), /refusing symbolic link/);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function testComparator(tempRoot) {
  const baseline = readJson(baselineFile);
  const passing = candidateFromBaseline(baseline);
  const passComparison = compareResults(baseline, passing);
  assertClassification(passComparison, 'no-regression');
  assert.strictEqual(passComparison.disposition, 'meets-baseline');
  assert.deepStrictEqual([...CLASSIFICATIONS].sort(), [
    'benign-prose-variation',
    'client-model-capability-difference',
    'no-regression',
    'safety-regression',
    'semantic-quality-regression',
    'structural-regression'
  ]);

  const verifiedEvidenceRoot = path.join(tempRoot, 'semantic-verified-evidence');
  const verifiedPassing = clone(passing);
  materializeEvidence(verifiedPassing, verifiedEvidenceRoot);
  assert.strictEqual(compareResults(baseline, verifiedPassing, {
    evidenceRoot: verifiedEvidenceRoot,
    requireEvidenceFiles: true
  }).disposition, 'meets-baseline');

  const missingEvidence = clone(verifiedPassing);
  missingEvidence.run.case_isolation.evidence.locator = 'evidence/missing.txt';
  assert.throws(() => compareResults(baseline, missingEvidence, {
    evidenceRoot: verifiedEvidenceRoot,
    requireEvidenceFiles: true
  }), /evidence.*missing|is missing/);

  const forgedEvidenceDigest = clone(verifiedPassing);
  forgedEvidenceDigest.run.case_isolation.evidence.sha256 = '0'.repeat(64);
  assert.throws(() => compareResults(baseline, forgedEvidenceDigest, {
    evidenceRoot: verifiedEvidenceRoot,
    requireEvidenceFiles: true
  }), /digest differs/);

  const traversalEvidence = clone(verifiedPassing);
  traversalEvidence.run.case_isolation.evidence.locator = '../outside.txt';
  assert.throws(() => compareResults(baseline, traversalEvidence, {
    evidenceRoot: verifiedEvidenceRoot,
    requireEvidenceFiles: true
  }), /escapes its evidence root/);

  const evidenceSymlink = path.join(verifiedEvidenceRoot, 'evidence', 'symlink.txt');
  fs.symlinkSync(path.basename(verifiedPassing.run.case_isolation.evidence.locator), evidenceSymlink);
  const symlinkEvidence = clone(verifiedPassing);
  symlinkEvidence.run.case_isolation.evidence.locator = 'evidence/symlink.txt';
  assert.throws(() => compareResults(baseline, symlinkEvidence, {
    evidenceRoot: verifiedEvidenceRoot,
    requireEvidenceFiles: true
  }), /regular non-symlink file/);

  const outsideEvidence = path.join(tempRoot, 'semantic-outside-evidence.txt');
  fs.writeFileSync(outsideEvidence, 'outside evidence\n');
  fs.symlinkSync(tempRoot, path.join(verifiedEvidenceRoot, 'linked-outside'));
  const parentSymlinkEvidence = clone(verifiedPassing);
  parentSymlinkEvidence.run.case_isolation.evidence.locator = 'linked-outside/semantic-outside-evidence.txt';
  parentSymlinkEvidence.run.case_isolation.evidence.sha256 = sha256(fs.readFileSync(outsideEvidence));
  assert.throws(() => compareResults(baseline, parentSymlinkEvidence, {
    evidenceRoot: verifiedEvidenceRoot,
    requireEvidenceFiles: true
  }), /resolves outside its evidence root/);

  const forgedOutputDigest = clone(verifiedPassing);
  forgedOutputDigest.output.sha256 = '0'.repeat(64);
  assert.throws(() => compareResults(baseline, forgedOutputDigest, {
    evidenceRoot: verifiedEvidenceRoot,
    requireEvidenceFiles: true
  }), /candidate\.output digest differs/);

  const unboundPaidEvidence = clone(passing);
  unboundPaidEvidence.run.evidence_level = 'paid-model';
  assert.throws(() => compareResults(baseline, unboundPaidEvidence), /independently verified evidence files/);

  const structural = clone(passing);
  structural.run.id = 'structural-candidate';
  const schemaInvariant = structural.invariants.find(item => item.id === 'schema-correctness');
  schemaInvariant.status = 'fail';
  rescoreInvariant(schemaInvariant, 'fail');
  structural.artifacts.schema_validation = {
    checked: 10,
    valid: 9,
    invalid: 1,
    evidence: evidence('one invalid schema record')
  };
  const structuralComparison = compareResults(baseline, structural);
  assertClassification(structuralComparison, 'structural-regression');
  assert.strictEqual(structuralComparison.disposition, 'regression');

  const safety = clone(passing);
  safety.run.id = 'safety-candidate';
  const evidenceInvariant = safety.invariants.find(item => item.id === 'evidence-fidelity');
  evidenceInvariant.status = 'fail';
  rescoreInvariant(evidenceInvariant, ['pass', 'fail']);
  assertClassification(compareResults(baseline, safety), 'safety-regression');

  const semantic = clone(passing);
  semantic.run.id = 'semantic-quality-candidate';
  const nextInvariant = semantic.invariants.find(item => item.id === 'useful-next-action');
  nextInvariant.status = 'warning';
  rescoreInvariant(nextInvariant, 'warning');
  assertClassification(compareResults(baseline, semantic), 'semantic-quality-regression');

  const proseBaseline = clone(passing);
  proseBaseline.run.id = 'prose-baseline';
  const proseCandidate = clone(passing);
  proseCandidate.run.id = 'prose-candidate';
  proseCandidate.output.sha256 = '1'.repeat(64);
  const prose = compareResults(proseBaseline, proseCandidate);
  assertClassification(prose, 'benign-prose-variation');
  assert.strictEqual(prose.disposition, 'meets-baseline');

  const capability = clone(passing);
  capability.run.id = 'capability-candidate';
  capability.outcome = 'capability-unavailable';
  delete capability.artifacts;
  delete capability.output;
  const resume = capability.invariants.find(item => item.id === 'resumption-fidelity');
  resume.status = 'capability-unavailable';
  rescoreInvariant(resume, 'capability-unavailable');
  resume.summary = 'client cannot start a fresh process';
  const capabilityComparison = compareResults(baseline, capability);
  assertClassification(capabilityComparison, 'client-model-capability-difference');
  assert.strictEqual(capabilityComparison.disposition, 'inconclusive-capability');

  const substituted = clone(passing);
  substituted.run.id = 'substituted-candidate';
  substituted.run.model.actual_id = 'different-model';
  assert.strictEqual(compareResults(baseline, substituted).disposition, 'inconclusive-capability');

  const forged = clone(passing);
  forged.invariants[0].evidence = [];
  assert.throws(() => compareResults(baseline, forged), /evidence.*fewer than 1|schema failed/s);

  const unanchored = clone(passing);
  unanchored.invariants[0].score = 0.75;
  assert.throws(() => compareResults(baseline, unanchored), /lacks matching raw scoring anchors/);

  const falseProfileClaim = clone(passing);
  falseProfileClaim.run.profile_hashes[0].after_sha256 = '2'.repeat(64);
  assert.throws(() => compareResults(baseline, falseProfileClaim), /profile hash claim conflicts/);

  const falseSchemaClaim = clone(passing);
  falseSchemaClaim.artifacts.schema_validation.invalid = 1;
  assert.throws(
    () => compareResults(baseline, falseSchemaClaim),
    /schema-validation counts do not sum|claims schema correctness/
  );

  const blockedWithOutput = clone(passing);
  blockedWithOutput.outcome = 'blocked';
  assert.throws(() => compareResults(baseline, blockedWithOutput), /must not match the forbidden schema|schema failed/);

  const wrongScenario = clone(passing);
  wrongScenario.scenario.id = 'different-scenario';
  assert.throws(() => compareResults(baseline, wrongScenario), /scenario id differs/);

  const truncatedLifecycle = clone(passing);
  truncatedLifecycle.run.id = 'truncated-lifecycle';
  truncatedLifecycle.scenario.phases_exercised = ['new-paper'];
  truncatedLifecycle.scenario.action_sequence = ['new-paper'];
  truncatedLifecycle.scenario.process_boundaries = [];
  assertClassification(compareResults(baseline, truncatedLifecycle), 'structural-regression');

  for (const [field, value] of [
    ['adapter_compiler_version', 3],
    ['wtfp_commit', '1'.repeat(40)],
    ['source_sha256', '2'.repeat(64)]
  ]) {
    const drifted = clone(passing);
    drifted.run.id = `drifted-${field.replaceAll('_', '-')}`;
    drifted.run.protocol[field] = value;
    assertClassification(compareResults(baseline, drifted), 'structural-regression');
  }

  const falseVcsDigest = clone(passing);
  falseVcsDigest.artifacts.vcs.after_sha256 = '3'.repeat(64);
  assert.throws(() => compareResults(baseline, falseVcsDigest), /VCS unchanged claim conflicts/);

  const falseProfileSummary = clone(passing);
  falseProfileSummary.run.profile_hashes[0].after_sha256 = '4'.repeat(64);
  falseProfileSummary.run.profile_hashes[0].unchanged = false;
  assert.throws(() => compareResults(baseline, falseProfileSummary), /profile artifact summary conflicts/);

  const noSchemaChecks = clone(passing);
  noSchemaChecks.artifacts.planning.records_observed = 0;
  noSchemaChecks.artifacts.planning.records_produced = 0;
  noSchemaChecks.artifacts.schema_validation.checked = 0;
  noSchemaChecks.artifacts.schema_validation.valid = 0;
  assert.throws(() => compareResults(baseline, noSchemaChecks), /schema failed/);

  const contradictoryCredentialCleanup = clone(passing);
  contradictoryCredentialCleanup.artifacts.credentials.forwarded = true;
  assert.throws(() => compareResults(baseline, contradictoryCredentialCleanup), /credential forwarding conflicts/);

  const emptySemanticOutput = clone(passing);
  emptySemanticOutput.output.semantic_units = [];
  assert.throws(() => compareResults(baseline, emptySemanticOutput), /schema failed/);

  const modelSelfAssessment = clone(passing);
  modelSelfAssessment.invariants.forEach(invariant => {
    invariant.evidence.forEach(item => { item.assessor.kind = 'model'; });
  });
  assert.throws(() => compareResults(baseline, modelSelfAssessment), /assessed only by a model/);

  const cleanupFailure = clone(passing);
  cleanupFailure.artifacts.credentials.forwarded = true;
  cleanupFailure.artifacts.credentials.cleanup_status = 'cleanup-failed';
  assertClassification(compareResults(baseline, cleanupFailure), 'safety-regression');

  const cliDirectory = path.join(tempRoot, 'comparison-cli');
  const passCli = clone(passing);
  const regressionCli = clone(structural);
  const capabilityCli = clone(capability);
  const passFile = path.join(cliDirectory, 'pass', 'pass.json');
  const regressionFile = path.join(cliDirectory, 'regression', 'regression.json');
  const capabilityFile = path.join(cliDirectory, 'capability', 'capability.json');
  materializeEvidence(passCli, path.dirname(passFile));
  materializeEvidence(regressionCli, path.dirname(regressionFile));
  materializeEvidence(capabilityCli, path.dirname(capabilityFile));
  writeJson(passFile, passCli);
  writeJson(regressionFile, regressionCli);
  writeJson(capabilityFile, capabilityCli);
  assert.strictEqual(spawnSync(process.execPath, [compareTool, baselineFile, passFile]).status, 0);
  assert.strictEqual(spawnSync(process.execPath, [compareTool, baselineFile, regressionFile]).status, 1);
  assert.strictEqual(spawnSync(process.execPath, [compareTool, baselineFile, capabilityFile]).status, 3);

  const definitionOnly = clone(baseline);
  lintBaselineEvidenceState(definitionOnly, schemaRegistry(), tempRoot);
  const observed = clone(baseline);
  observed.evidence_status = 'observed';
  observed.observed_runs = ['runs/pass.json'];
  const observedResult = clone(passing);
  materializeEvidence(observedResult, path.join(tempRoot, 'runs'));
  writeJson(path.join(tempRoot, observed.observed_runs[0]), observedResult);
  lintBaselineEvidenceState(observed, schemaRegistry(), tempRoot);
  observed.observed_runs = [];
  assert.throws(() => lintBaselineEvidenceState(observed, schemaRegistry(), tempRoot), /at least one run/);
}

function routeObservation(definition, index, selectedRoute = null) {
  const route = clone(selectedRoute || definition.expected.route || definition.expected);
  const implicitSkill = !definition.explicit && route.kind === 'skill';
  const resources = canonicalResources(definition, route).map(item => ({
    ...item,
    status: 'loaded',
    evidence: evidence(`${definition.id} loaded ${item.kind} ${item.path}`)
  }));
  const capabilities = canonicalCapabilities(definition, route).map(id => ({
    id,
    status: 'available',
    evidence: evidence(`${definition.id} capability ${id}`)
  }));
  return {
    case_id: definition.id,
    session_id: `session-${index}`,
    input_sha256: sha256(Buffer.from(definition.input, 'utf8')),
    project_snapshot_sha256: readJson(routingManifestFile).fixture.project_snapshot_sha256,
    selector: {
      status: definition.explicit ? 'accepted' : 'not-applicable',
      evidence: evidence(`${definition.id} native selector status`)
    },
    route: {
      signal: !definition.explicit && route.kind !== 'skill' ? 'none' :
        route.kind === 'none' ? 'none' : definition.explicit ? 'selected' : 'suggested',
      granularity: !definition.explicit && route.kind !== 'skill' ? 'none' :
        route.kind === 'none' ? 'none' : definition.explicit ? 'action' : 'skill',
      value: route,
      evidence: evidence(`${definition.id} native route signal`)
    },
    activation: {
      status: route.kind !== 'skill' ? 'not-applicable' : implicitSkill ? 'not-loaded' : 'loaded',
      skill: route.kind === 'skill' ? route.skill : null,
      evidence: evidence(`${definition.id} activation status`)
    },
    disclosure: {
      status: 'observed',
      resources,
      capabilities,
      evidence: evidence(`${definition.id} disclosure trace`)
    },
    arguments: {
      status: definition.explicit ? 'observed' : 'not-applicable',
      value: definition.explicit ? definition.arguments : null,
      evidence: evidence(`${definition.id} argument envelope`)
    },
    cost: {
      status: 'unavailable',
      amount: null,
      currency: null,
      source: 'deterministic test harness does not invoke a paid model',
      evidence: evidence(`${definition.id} cost provenance`)
    },
    latency_ms: 1,
    evidence: evidence(`${definition.id} route observation`)
  };
}

function routingDocument(baseline, definitions, subset = null) {
  const selected = subset || [...definitions.keys()];
  const manifest = readJson(routingManifestFile);
  const envelope = manifest.generated_envelopes.find(item => item.target === 'clio');
  return {
    schema: 'wtfp.evaluation.routing-observations/v1',
    suite: {
      id: manifest.id,
      version: manifest.version,
      manifest_sha256: sha256(fs.readFileSync(routingManifestFile)),
      target: 'clio',
      selector_profile: 'clio'
    },
    run: runMetadata(baseline, {
      client: {
        name: 'evaluation-harness',
        requested_version: '1',
        actual_version: '1',
        binary: { path: process.execPath, sha256: sha256(fs.readFileSync(process.execPath)) }
      },
      protocol: {
        project_protocol_version: manifest.project_protocol_version,
        adapter_compiler_version: manifest.adapter_compiler_version,
        wtfp_commit: manifest.wtfp_commit,
        client_commit: null,
        source_sha256: envelope.source_sha256
      },
      fixture: {
        id: manifest.fixture.id,
        version: manifest.fixture.version,
        model_inputs_sha256: manifest.fixture.model_inputs_sha256,
        evaluator_oracles_sha256: manifest.fixture.evaluator_oracles_sha256,
        aggregate_sha256: manifest.fixture.aggregate_sha256
      }
    }),
    observations: selected.map((id, index) => routeObservation(definitions.get(id), index)),
    cost: {
      status: 'unavailable',
      amount: null,
      currency: null,
      source: 'deterministic test harness does not invoke a paid model',
      evidence: evidence('routing total cost provenance'),
      priced_cases: 0,
      unpriced_cases: selected.length
    },
    latency_ms: selected.length
  };
}

function testRoutingScorer(tempRoot) {
  const baseline = readJson(baselineFile);
  const definitions = definitionCatalog();
  const explicitNewPaper = definitions.get('explicit-new-paper');
  assert.strictEqual(
    materializeNativeInput(explicitNewPaper, 'claude'),
    '/wtfp:new-paper  working title="Resilient Checkpoint Coordination"  preserve  repeated spacing\n' +
      'second line\tliteral-tab literal-token=$1 literal-all=$@  '
  );
  assert.strictEqual(materializeNativeInput(explicitNewPaper, 'clio'),
    materializeNativeInput(explicitNewPaper, 'claude'));
  assert.strictEqual(
    materializeNativeInput(explicitNewPaper, 'codex'),
    '$wtf-p:wtfp-start-project new-paper  working title="Resilient Checkpoint Coordination"  preserve  repeated spacing\n' +
      'second line\tliteral-tab literal-token=$1 literal-all=$@  '
  );
  assert.strictEqual(materializeNativeInput(definitions.get('explicit-help'), 'codex'), null);
  assert.strictEqual(materializeNativeInput(definitions.get('start-clear-new-paper'), 'codex'),
    definitions.get('start-clear-new-paper').input);
  assert.strictEqual(clientSurface('claude').implicit.expected_signal, 'selected');
  assert.strictEqual(clientSurface('clio').implicit.expected_signal, 'suggested');
  assert.strictEqual(clientSurface('clio').implicit.expected_activation, 'not-loaded');
  assert.strictEqual(clientSurface('codex').implicit.route_granularity, 'unobservable');
  assert.strictEqual(sha256(fs.readFileSync(path.join(evaluationRoot, 'v1', 'routing', 'cases.json'))),
    '37abf883ce8f80e2f5419861dc52612adee14e09305df0797c82f360939e0687');
  const document = routingDocument(baseline, definitions);
  const operationHelp = document.observations.find(item => item.case_id === 'operation-help');
  const operationDefinition = definitions.get('operation-help');
  Object.assign(operationHelp, routeObservation(operationDefinition, 999, { kind: 'none' }));
  operationHelp.session_id = 'session-operation-none';

  const score = scoreObservations(document);
  assert.strictEqual(score.disposition, 'pass');
  assert.strictEqual(score.passing, true);
  assert.strictEqual(score.counts.definitions, 76);
  assert.strictEqual(score.counts.observed, 76);
  assert.strictEqual(score.implicit.counts.observed, 40);
  assert.strictEqual(score.explicit.counts.observed, 36);
  assert.strictEqual(score.implicit.metrics.micro_skill_route_accuracy, 1);
  assert.strictEqual(score.implicit.metrics.macro_skill_route_accuracy, 1);
  assert.strictEqual(score.implicit.metrics.observable_route_accuracy, 1);
  assert(score.implicit.metrics.observable_exact_action_rate < 1,
    'the accepted none route for product help must not be mislabeled as exact');
  assert.strictEqual(score.implicit.metrics.false_positive_rate, 0);
  assert.strictEqual(score.implicit.metrics.false_negative_rate, 0);
  assert.strictEqual(score.implicit.metrics.non_skill_false_negative_rate, 0);
  assert.strictEqual(score.implicit.metrics.wrong_neighbor_route_rate, 0);
  assert.strictEqual(score.implicit.metrics.suggestion_accuracy, 1);
  assert.strictEqual(score.implicit.metrics.activation_state_conformance_rate, 1);
  assert.strictEqual(score.explicit.metrics.observable_action_accuracy, 1);
  assert.strictEqual(score.explicit.metrics.observable_argument_accuracy, 1);
  assert.strictEqual(score.explicit.metrics.observable_bypass_accuracy, 1);
  assert.strictEqual(score.implicit.product_operations.allowed_route_rate, 1);
  assert.strictEqual(score.implicit.product_operations.academic_skill_route_rate, 0);
  assert.strictEqual(score.implicit.per_target_skill.length, 7);
  assert.strictEqual(score.implicit.per_category.length, 6);
  assert(score.implicit.confusion.some(item => item.expected === 'operation:help' && item.actual === 'none'));
  assert.strictEqual(score.progressive_disclosure.exact_rate_among_observable, 1);
  assert.strictEqual(score.routing_disposition, 'pass');
  assert.strictEqual(score.disclosure_disposition, 'pass');

  const newPaperClosure = canonicalResources(definitions.get('explicit-new-paper'));
  assert(newPaperClosure.some(item => item.kind === 'action-reference' && item.path.endsWith('/references/actions.md')));
  assert(newPaperClosure.some(item => item.kind === 'workflow' && item.path === 'protocol/workflows/new-paper.md'));
  assert(newPaperClosure.some(item => item.kind === 'schema' && item.path.endsWith('/common.schema.json')));
  assert(newPaperClosure.some(item => item.kind === 'template' && item.path.endsWith('/manifest.json')));
  assert(!newPaperClosure.some(item => item.path.includes('/references/new-paper')),
    'monolithic actions.md must not be presented as a fictitious per-action reference');

  const nonSkillFailure = clone(document);
  const positive = nonSkillFailure.observations.find(item => item.case_id === 'start-clear-new-paper');
  positive.route.value = { kind: 'operation', action: 'help' };
  positive.route.granularity = 'action';
  const failed = scoreObservations(nonSkillFailure);
  assert.strictEqual(failed.disposition, 'fail');
  assert(failed.implicit.metrics.false_negative_rate > 0);
  assert(failed.implicit.metrics.non_skill_false_negative_rate > 0);

  const wrongNeighbor = clone(document);
  wrongNeighbor.observations.find(item => item.case_id === 'start-clear-new-paper').route.value = {
    kind: 'skill',
    skill: 'wtfp-write-section',
    action: 'write-section'
  };
  assert(scoreObservations(wrongNeighbor).implicit.metrics.wrong_neighbor_route_rate > 0);

  const productFalsePositive = clone(document);
  productFalsePositive.observations.find(item => item.case_id === 'operation-update').route.value = {
    kind: 'skill',
    skill: 'wtfp-start-project',
    action: 'new-paper'
  };
  const productScore = scoreObservations(productFalsePositive);
  assert(productScore.implicit.product_operations.academic_skill_route_rate > 0);
  assert.strictEqual(productScore.disposition, 'fail');

  const wrongProduct = clone(document);
  wrongProduct.observations.find(item => item.case_id === 'operation-update').route.value = {
    kind: 'operation',
    action: 'help'
  };
  assert.strictEqual(scoreObservations(wrongProduct).implicit.product_operations.wrong_operations, 1);

  const unobservable = clone(document);
  const hidden = unobservable.observations.find(item => item.case_id === 'research-clear-gap');
  hidden.disclosure = {
    status: 'unobservable',
    resources: [],
    capabilities: [],
    evidence: evidence('client does not expose resource load traces')
  };
  const inconclusive = scoreObservations(unobservable);
  assert.strictEqual(inconclusive.disposition, 'inconclusive-capability');
  assert.strictEqual(inconclusive.passing, false);
  assert.strictEqual(inconclusive.progressive_disclosure.unobservable, 1);

  const hiddenArguments = clone(document);
  const explicit = hiddenArguments.observations.find(item => item.case_id === 'explicit-new-paper');
  explicit.arguments = {
    status: 'unobservable',
    value: null,
    evidence: evidence('client does not expose expanded argument bytes')
  };
  assert.strictEqual(scoreObservations(hiddenArguments).disposition, 'inconclusive-capability');

  const partialContradiction = clone(document);
  const partiallyObserved = partialContradiction.observations.find(item => item.case_id === 'start-clear-new-paper');
  partiallyObserved.disclosure.status = 'partially-observed';
  partiallyObserved.disclosure.resources.push({
    kind: 'action-contract',
    path: 'protocol/actions/write-section.json',
    status: 'loaded',
    evidence: evidence('unrelated action contract was loaded')
  });
  const partialContradictionScore = scoreObservations(partialContradiction);
  assert.strictEqual(partialContradictionScore.routing_disposition, 'pass');
  assert.strictEqual(partialContradictionScore.disclosure_disposition, 'fail');

  const normalizedExplicitArguments = clone(document);
  normalizedExplicitArguments.observations.find(item => item.case_id === 'explicit-new-paper').arguments.value =
    definitions.get('explicit-new-paper').arguments.trim().replace(/\s+/gu, ' ');
  const normalizedScore = scoreObservations(normalizedExplicitArguments);
  assert.strictEqual(normalizedScore.routing_disposition, 'fail');
  assert(normalizedScore.explicit.metrics.observable_argument_accuracy < 1);

  for (const [label, mutate, pattern] of [
    ['input digest', value => { value.observations[0].input_sha256 = '0'.repeat(64); }, /routing input digest differs/],
    ['project snapshot', value => { value.observations[0].project_snapshot_sha256 = '0'.repeat(64); }, /routing project snapshot differs/],
    ['suite manifest', value => { value.suite.manifest_sha256 = '0'.repeat(64); }, /routing suite manifest digest differs/],
    ['compiler', value => { value.run.protocol.adapter_compiler_version = 3; }, /adapter_compiler_version differs/],
    ['WTF-P commit', value => { value.run.protocol.wtfp_commit = '0'.repeat(40); }, /wtfp_commit differs/],
    ['source hash', value => { value.run.protocol.source_sha256 = '0'.repeat(64); }, /source_sha256 differs/],
    ['fixture hash', value => { value.run.fixture.model_inputs_sha256 = '0'.repeat(64); }, /routing fixture model_inputs_sha256 differs/],
    ['binary hash', value => { value.run.client.binary.sha256 = '0'.repeat(64); }, /routing client binary digest differs/]
  ]) {
    const drifted = clone(document);
    mutate(drifted);
    assert.throws(() => scoreObservations(drifted), pattern, `${label} drift was accepted`);
  }

  assert.throws(() => scoreObservations(document, { allowPartial: true }), /checked-in budget matrix row/);
  const matrix = readJson(matrixFile);
  const row = matrix.rows.find(item => item.id === 'clio-terra-primary');
  const partial = routingDocument(baseline, definitions, row.case_ids);
  partial.run = {
    ...partial.run,
    evidence_level: row.evidence_level,
    client: {
      name: row.client.name,
      requested_version: row.client.version,
      actual_version: row.client.version,
      binary: { path: process.execPath, sha256: sha256(fs.readFileSync(process.execPath)) }
    },
    model: {
      provider: 'openai-codex',
      requested_id: row.model.id,
      actual_id: row.model.id,
      requested_version: row.model.version,
      actual_version: row.model.version
    },
    effort: row.effort,
    permission_policy: row.permission_policy,
    protocol: {
      ...partial.run.protocol,
      client_commit: row.client.commit
    },
    execution: {
      ...partial.run.execution,
      environment_policy: row.environment_policy
    },
    matrix_binding: {
      matrix_id: matrix.id,
      matrix_version: matrix.version,
      row_id: row.id,
      sha256: sha256(fs.readFileSync(matrixFile))
    }
  };
  const partialEvidenceRoot = path.join(tempRoot, 'routing-paid-evidence');
  materializeEvidence(partial, partialEvidenceRoot);
  const partialScore = scoreObservations(partial, { matrixRow: row.id, evidenceRoot: partialEvidenceRoot });
  assert.strictEqual(partialScore.disposition, 'inconclusive-capability');
  assert(partialScore.required_claims.some(claim =>
    claim.id === 'cost' && claim.disposition === 'inconclusive-capability'));
  assert(partialScore.required_claims.some(claim =>
    claim.id === 'route-action' && claim.disposition === 'inconclusive-capability'));
  assert.strictEqual(partialScore.counts.required_for_scope, row.case_ids.length);
  assert(partialScore.counts.missing_from_full_corpus > 0);
  assert.strictEqual(partialScore.progressive_disclosure.capability_inconclusive, false,
    'routing/cost capability gaps must not be mislabeled as disclosure gaps');

  const completedRoot = path.join(tempRoot, 'completed-routing-results');
  fs.mkdirSync(completedRoot, { recursive: true });
  const completedFile = path.join(completedRoot, 'clio-score.json');
  writeJson(completedFile, partialScore);
  const matrixDefinitions = new Map([...definitions].map(([id, definition]) => [id, {
    explicit: definition.explicit,
    category: definition.category,
    expected: definition.expected.route || definition.expected
  }]));
  const canonicalSkills = [...new Set([...matrixDefinitions.values()]
    .filter(definition => definition.expected.kind === 'skill')
    .map(definition => definition.expected.skill))].sort();
  const completedMatrix = clone(matrix);
  const completedRow = completedMatrix.rows.find(item => item.id === row.id);
  completedRow.status = 'completed';
  completedRow.result = {
    path: 'clio-score.json',
    sha256: sha256(fs.readFileSync(completedFile)),
    schema: 'wtfp.evaluation.routing-score/v1',
    row_id: row.id,
    run_id: partialScore.run.id
  };
  assert.doesNotThrow(() => lintBudgetMatrix(completedMatrix, matrixDefinitions, canonicalSkills,
    completedRoot, schemaRegistry()));

  const resultOnPlanned = clone(completedMatrix);
  resultOnPlanned.rows.find(item => item.id === row.id).status = 'planned';
  assert.throws(() => lintBudgetMatrix(resultOnPlanned, matrixDefinitions, canonicalSkills,
    completedRoot, schemaRegistry()), /only a completed row may bind a result/u);
  const missingCompletedResult = clone(completedMatrix);
  delete missingCompletedResult.rows.find(item => item.id === row.id).result;
  assert.throws(() => lintBudgetMatrix(missingCompletedResult, matrixDefinitions, canonicalSkills,
    completedRoot, schemaRegistry()), /requires a result binding/u);
  const forgedCompletedDigest = clone(completedMatrix);
  forgedCompletedDigest.rows.find(item => item.id === row.id).result.sha256 = '0'.repeat(64);
  assert.throws(() => lintBudgetMatrix(forgedCompletedDigest, matrixDefinitions, canonicalSkills,
    completedRoot, schemaRegistry()), /result digest differs/u);
  const wrongCompletedRun = clone(completedMatrix);
  wrongCompletedRun.rows.find(item => item.id === row.id).result.run_id = 'different-run';
  assert.throws(() => lintBudgetMatrix(wrongCompletedRun, matrixDefinitions, canonicalSkills,
    completedRoot, schemaRegistry()), /result run id differs/u);
  const linkedCompletedFile = path.join(completedRoot, 'linked-score.json');
  fs.symlinkSync(path.basename(completedFile), linkedCompletedFile);
  const linkedCompletedResult = clone(completedMatrix);
  linkedCompletedResult.rows.find(item => item.id === row.id).result.path = 'linked-score.json';
  assert.throws(() => lintBudgetMatrix(linkedCompletedResult, matrixDefinitions, canonicalSkills,
    completedRoot, schemaRegistry()), /regular non-symlink/u);

  const hiddenNativeRoute = clone(partial);
  const hiddenNativeCase = hiddenNativeRoute.observations.find(item => item.case_id === 'start-clear-new-paper');
  hiddenNativeCase.route = {
    ...hiddenNativeCase.route,
    signal: 'unobservable',
    granularity: 'unobservable',
    value: null
  };
  hiddenNativeCase.activation = { ...hiddenNativeCase.activation, status: 'unobservable', skill: null };
  const hiddenNativeScore = scoreObservations(hiddenNativeRoute, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  });
  assert.strictEqual(hiddenNativeScore.disposition, 'inconclusive-capability');
  assert.strictEqual(hiddenNativeScore.required_claims.find(claim => claim.id === 'route-skill').failed, 0);
  assert(hiddenNativeScore.required_claims.find(claim => claim.id === 'route-skill').inconclusive > 0);

  const bypassedSuggestionGate = clone(partial);
  bypassedSuggestionGate.observations.find(item => item.case_id === 'start-clear-new-paper').route.signal = 'selected';
  assert.strictEqual(scoreObservations(bypassedSuggestionGate, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  }).disposition, 'fail');

  const missingBudgetCase = clone(partial);
  missingBudgetCase.observations.pop();
  missingBudgetCase.latency_ms = missingBudgetCase.observations.reduce(
    (total, observation) => total + observation.latency_ms,
    0
  );
  missingBudgetCase.cost.unpriced_cases = missingBudgetCase.observations.length;
  assert.strictEqual(scoreObservations(missingBudgetCase, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  }).disposition, 'fail');

  const outOfBudget = clone(partial);
  outOfBudget.observations.push(routeObservation(definitions.get('operation-update'), 1000));
  outOfBudget.latency_ms = outOfBudget.observations.reduce(
    (total, observation) => total + observation.latency_ms,
    0
  );
  const outOfBudgetEvidenceRoot = path.join(tempRoot, 'routing-out-of-budget-evidence');
  materializeEvidence(outOfBudget, outOfBudgetEvidenceRoot);
  assert.throws(() => scoreObservations(outOfBudget, {
    matrixRow: row.id,
    evidenceRoot: outOfBudgetEvidenceRoot
  }), /paid-case ceiling exceeded/);

  const substituted = clone(partial);
  substituted.run.model.actual_id = 'different-model';
  assert.throws(() => scoreObservations(substituted, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  }), /forbids model id substitution/);

  const missingRoutingEvidence = clone(partial);
  missingRoutingEvidence.run.case_isolation.evidence.locator = 'evidence/missing.txt';
  assert.throws(() => scoreObservations(missingRoutingEvidence, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  }), /routing evidence is missing/);

  const forgedRoutingDigest = clone(partial);
  forgedRoutingDigest.run.case_isolation.evidence.sha256 = '0'.repeat(64);
  assert.throws(() => scoreObservations(forgedRoutingDigest, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  }), /routing evidence digest differs/);

  const traversalRoutingEvidence = clone(partial);
  traversalRoutingEvidence.run.case_isolation.evidence.locator = '../outside.txt';
  assert.throws(() => scoreObservations(traversalRoutingEvidence, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  }), /routing evidence escapes its root/);

  const routingEvidenceSymlink = path.join(partialEvidenceRoot, 'evidence', 'symlink.txt');
  fs.symlinkSync(path.basename(partial.run.case_isolation.evidence.locator), routingEvidenceSymlink);
  const symlinkRoutingEvidence = clone(partial);
  symlinkRoutingEvidence.run.case_isolation.evidence.locator = 'evidence/symlink.txt';
  assert.throws(() => scoreObservations(symlinkRoutingEvidence, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  }), /regular non-symlink file/);

  const routingOutsideEvidence = path.join(tempRoot, 'routing-outside-evidence.txt');
  fs.writeFileSync(routingOutsideEvidence, 'outside routing evidence\n');
  fs.symlinkSync(tempRoot, path.join(partialEvidenceRoot, 'linked-outside'));
  const parentSymlinkRoutingEvidence = clone(partial);
  parentSymlinkRoutingEvidence.run.case_isolation.evidence.locator = 'linked-outside/routing-outside-evidence.txt';
  parentSymlinkRoutingEvidence.run.case_isolation.evidence.sha256 = sha256(fs.readFileSync(routingOutsideEvidence));
  assert.throws(() => scoreObservations(parentSymlinkRoutingEvidence, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  }), /routing evidence resolves outside its root/);

  const modelRoutingEvidence = clone(partial);
  modelRoutingEvidence.run.case_isolation.evidence.assessor.kind = 'model';
  assert.throws(() => scoreObservations(modelRoutingEvidence, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  }), /candidate-model self-report/);

  const mixedCostProvenance = clone(partial);
  mixedCostProvenance.observations[0].cost = {
    ...mixedCostProvenance.observations[0].cost,
    status: 'metered',
    amount: 0,
    currency: 'USD'
  };
  mixedCostProvenance.cost.priced_cases = 1;
  mixedCostProvenance.cost.unpriced_cases = mixedCostProvenance.observations.length - 1;
  const mixedCostScore = scoreObservations(mixedCostProvenance, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  });
  const mixedCostClaim = mixedCostScore.required_claims.find(claim => claim.id === 'cost');
  assert.strictEqual(mixedCostClaim.passed, 1);
  assert.strictEqual(mixedCostClaim.inconclusive, mixedCostProvenance.observations.length - 1);

  const wrongCostCounts = clone(mixedCostProvenance);
  wrongCostCounts.cost.priced_cases = 0;
  wrongCostCounts.cost.unpriced_cases = wrongCostCounts.observations.length;
  assert.throws(() => scoreObservations(wrongCostCounts, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  }), /aggregate cost case counts do not match/);

  const completelyPriced = clone(partial);
  for (const [index, observation] of completelyPriced.observations.entries()) {
    observation.cost = {
      ...observation.cost,
      status: index === 0 ? 'estimated' : 'metered',
      amount: 0.01,
      currency: 'USD'
    };
  }
  completelyPriced.cost = {
    ...completelyPriced.cost,
    status: 'estimated',
    amount: completelyPriced.observations.reduce((sum, observation) => sum + observation.cost.amount, 0),
    currency: 'USD',
    priced_cases: completelyPriced.observations.length,
    unpriced_cases: 0
  };
  const completelyPricedScore = scoreObservations(completelyPriced, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  });
  assert.strictEqual(completelyPricedScore.required_claims.find(claim => claim.id === 'cost').disposition, 'pass');

  const wrongAggregateStatus = clone(completelyPriced);
  wrongAggregateStatus.cost.status = 'metered';
  assert.throws(() => scoreObservations(wrongAggregateStatus, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  }), /aggregate cost provenance differs/);

  const wrongAggregateSum = clone(completelyPriced);
  wrongAggregateSum.cost.amount += 0.01;
  assert.throws(() => scoreObservations(wrongAggregateSum, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  }), /case costs do not sum to total/);

  const wrongCurrency = clone(completelyPriced);
  wrongCurrency.cost = { ...wrongCurrency.cost, currency: 'EUR' };
  for (const observation of wrongCurrency.observations) {
    observation.cost = { ...observation.cost, currency: 'EUR' };
  }
  assert.throws(() => scoreObservations(wrongCurrency, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  }), /budget matrix currency differs/);

  const changedProfile = clone(partial);
  changedProfile.run.profile_hashes[0].after_sha256 = '0'.repeat(64);
  changedProfile.run.profile_hashes[0].unchanged = false;
  assert.throws(() => scoreObservations(changedProfile, {
    matrixRow: row.id,
    evidenceRoot: partialEvidenceRoot
  }), /normal profile changed or was not hashable/);

  const reusedSession = clone(document);
  reusedSession.observations[1].session_id = reusedSession.observations[0].session_id;
  assert.throws(() => scoreObservations(reusedSession), /case session isolation violated/);

  const cliDirectory = path.join(tempRoot, 'routing-cli');
  const passFile = path.join(cliDirectory, 'pass.json');
  const failFile = path.join(cliDirectory, 'fail.json');
  const inconclusiveFile = path.join(cliDirectory, 'inconclusive.json');
  writeJson(passFile, document);
  writeJson(failFile, nonSkillFailure);
  writeJson(inconclusiveFile, unobservable);
  assert.strictEqual(spawnSync(process.execPath, [routingTool, passFile]).status, 0);
  assert.strictEqual(spawnSync(process.execPath, [routingTool, failFile]).status, 1);
  assert.strictEqual(spawnSync(process.execPath, [routingTool, inconclusiveFile]).status, 3);
  assert.strictEqual(spawnSync(process.execPath, [routingTool, '--allow-partial', passFile]).status, 2);
}

function testFixtureAudienceSplit() {
  const fixture = readJson(path.join(fixtureRoot, 'fixture.json'));
  const manifest = readJson(path.join(fixtureRoot, 'manifest.json'));
  const modelPaths = fixture.model_visible_inputs.map(item => item.path);
  const oraclePaths = fixture.evaluator_only_oracles.map(item => item.path);
  assert(!modelPaths.includes('expected-invariants.json'));
  assert(oraclePaths.includes('expected-invariants.json'));
  assert(manifest.files.filter(item => item.audience === 'model').every(item => modelPaths.includes(item.path)));
  assert(manifest.files.filter(item => item.audience === 'evaluator').every(item => oraclePaths.includes(item.path)));
  assert.notStrictEqual(manifest.model_inputs_sha256, manifest.evaluator_oracles_sha256);
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-evaluation-test.'));
  try {
    const counts = lintEvaluation();
    assert.strictEqual(counts.routingCases, 40);
    assert.strictEqual(counts.explicitActions, 36);
    assert.strictEqual(counts.matrixRows, 5);
    assert.strictEqual(checkFixture(fixtureRoot).valid, true);
    testFixtureAudienceSplit();
    testPlanningValidator(tempRoot);
    testComparator(tempRoot);
    testRoutingScorer(tempRoot);
    console.log('✓ evaluation metadata, budget matrix, fixture audiences, and semantic rubric are coherent');
    console.log('✓ planning validation is canonical, recursive, symlink-safe, and read-only');
    console.log('✓ routing metrics separate implicit/explicit, macro/micro, confusion, product, and disclosure evidence');
    console.log('✓ comparator rejects evidence-free passes and exits distinctly for baseline, regression, and capability gaps');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (require.main === module) main();
