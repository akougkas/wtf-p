#!/usr/bin/env node

'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const { SchemaRegistry, validateInstance } = require('../lib/json-schema');

const schemasRoot = path.resolve(__dirname, '../v1/schemas');
const semanticRubricFile = path.resolve(__dirname, '../v1/rubrics/semantic-rubric.json');

const STATUS_RANK = Object.freeze({ fail: 0, warning: 1, pass: 2 });
const REGRESSION_CLASS = Object.freeze({
  structural: 'structural-regression',
  safety: 'safety-regression',
  semantic: 'semantic-quality-regression'
});
const CLASSIFICATIONS = Object.freeze([
  'structural-regression',
  'safety-regression',
  'semantic-quality-regression',
  'benign-prose-variation',
  'client-model-capability-difference',
  'no-regression'
]);
const DISPOSITIONS = Object.freeze([
  'meets-baseline',
  'regression',
  'inconclusive-capability'
]);

function sameSet(left = [], right = []) {
  if (left.length !== right.length) return false;
  const leftValues = [...left].sort();
  const rightValues = [...right].sort();
  return leftValues.every((value, index) => value === rightValues[index]);
}

function sameSequence(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasIndependentEvidence(items) {
  return items.some(item => item.assessor.kind !== 'model' ||
    item.assessor.relationship === 'independent-evaluator');
}

function isDeterministicEvidence(item, requireMethod = false) {
  if (!item || !['independent-tool', 'static-analysis'].includes(item.assessor?.kind)) return false;
  return !requireMethod || item.method === 'deterministic-check';
}

function isIndependentSemanticEvidence(item, requireMethod = false) {
  if (!item) return false;
  const assessorIsIndependent = item.assessor?.kind === 'human' ||
    (item.assessor?.kind === 'model' && item.assessor.relationship === 'independent-evaluator');
  return assessorIsIndependent && (!requireMethod || item.method === 'independent-semantic-review');
}

function anchorEvidenceDigests(anchor) {
  return anchor.evidence_sha256s || [anchor.evidence_sha256];
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function containedPath(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function resultEvidenceClaims(document) {
  const claims = [];
  function visit(value, label) {
    if (!value || typeof value !== 'object') return;
    if (
      typeof value.locator === 'string' &&
      typeof value.sha256 === 'string' &&
      value.assessor &&
      typeof value.summary === 'string'
    ) {
      claims.push({ claim: value, label });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${label}[${index}]`));
      return;
    }
    for (const [key, item] of Object.entries(value)) visit(item, label ? `${label}.${key}` : key);
  }
  visit(document, 'candidate');
  return claims;
}

function verifyContainedFile(root, rootReal, locator, expectedSha256, label) {
  if (path.isAbsolute(locator) || locator.includes('://')) {
    throw new Error(`${label} locator must be relative: ${locator}`);
  }
  const file = path.resolve(root, locator);
  if (!containedPath(root, file)) throw new Error(`${label} escapes its evidence root: ${locator}`);
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    throw new Error(`${label} is missing: ${locator}`);
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${label} must be a regular non-symlink file: ${locator}`);
  }
  const real = fs.realpathSync(file);
  if (!containedPath(rootReal, real)) throw new Error(`${label} resolves outside its evidence root: ${locator}`);
  const actual = sha256(fs.readFileSync(file));
  if (actual !== expectedSha256) {
    throw new Error(`${label} digest differs for ${locator}: ${actual} != ${expectedSha256}`);
  }
}

function verifyResultEvidence(document, evidenceRoot) {
  if (!evidenceRoot) throw new Error('candidate result requires a contained evidence root');
  const root = path.resolve(evidenceRoot);
  let rootReal;
  try {
    rootReal = fs.realpathSync(root);
  } catch {
    throw new Error(`candidate evidence root is missing: ${root}`);
  }
  if (!fs.statSync(rootReal).isDirectory()) throw new Error(`candidate evidence root is not a directory: ${root}`);
  for (const { claim, label } of resultEvidenceClaims(document)) {
    if (claim.assessor.kind === 'model' && claim.assessor.relationship !== 'independent-evaluator') {
      throw new Error(`${label} is a candidate-model self-report`);
    }
    verifyContainedFile(root, rootReal, claim.locator, claim.sha256, label);
  }
  if (document.output) {
    verifyContainedFile(root, rootReal, document.output.locator, document.output.sha256, 'candidate.output');
  }
  if (document.run.evidence_level !== 'static-lint') {
    validateObservedEvidenceContract(document, root, rootReal);
  }
}

function invariantMap(document) {
  const invariants = document.schema === 'wtfp.evaluation.baseline/v1'
    ? document.expected_invariants
    : document.invariants;
  const result = new Map();
  for (const invariant of invariants) {
    if (result.has(invariant.id)) throw new Error(`duplicate invariant ${invariant.id}`);
    result.set(invariant.id, invariant);
  }
  return result;
}

function expectationStatus(invariant) {
  return invariant.required_status || invariant.status;
}

function expectationScore(invariant) {
  if (invariant.minimum_score !== undefined) return invariant.minimum_score;
  return invariant.score;
}

function fixtureMetadata(document) {
  return document.schema === 'wtfp.evaluation.baseline/v1' ? document.fixture : document.run.fixture;
}

function referenceOutput(document) {
  if (document.schema === 'wtfp.evaluation.baseline/v1') return document.reference_output || null;
  return document.output || null;
}

function capabilityMap(document) {
  if (document.schema === 'wtfp.evaluation.baseline/v1') {
    return new Map((document.required_capabilities || []).map(id => [id, 'available']));
  }
  return new Map((document.capabilities || []).map(capability => [capability.id, capability.status]));
}

function registry() {
  const schemaFiles = fs.readdirSync(schemasRoot)
    .filter(name => name.endsWith('.schema.json'))
    .map(name => path.join(schemasRoot, name));
  return new SchemaRegistry(schemaFiles);
}

function rubricDimensions() {
  return new Map(JSON.parse(fs.readFileSync(semanticRubricFile, 'utf8')).dimensions
    .map(dimension => [dimension.id, dimension]));
}

function validateIdentityReceipt(document, root) {
  const level = `${document.run.evidence_level} evidence`;
  const identityEvidence = document.run.identity_evidence;
  if (!identityEvidence) throw new Error(`${level} is missing hash-bound native identity evidence`);
  if (!isDeterministicEvidence(identityEvidence, true)) {
    throw new Error(`${level} identity must be a deterministic independent-tool or static-analysis receipt`);
  }
  if (!document.run.effective_effort) {
    throw new Error(`${level} is missing the effective effort observed by the native client`);
  }

  const file = path.resolve(root, identityEvidence.locator);
  let receipt;
  try {
    receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${level} identity receipt is not valid JSON: ${error.message}`);
  }
  const schemas = registry();
  const schemaFile = path.join(schemasRoot, 'identity-receipt.schema.json');
  const errors = validateInstance(receipt, schemas.get(schemaFile), schemaFile, schemas);
  if (errors.length > 0) throw new Error(`${level} identity receipt schema failed:\n${errors.join('\n')}`);

  for (const [label, actual, expected] of [
    ['client name', receipt.client.name, document.run.client.name],
    ['client actual version', receipt.client.actual_version, document.run.client.actual_version],
    ['client binary digest', receipt.client.binary_sha256, document.run.client.binary.sha256],
    ['model provider', receipt.model.provider, document.run.model.provider],
    ['model actual id', receipt.model.actual_id, document.run.model.actual_id],
    ['model actual version', receipt.model.actual_version, document.run.model.actual_version],
    ['requested effort', receipt.effort.requested, document.run.effort],
    ['effective effort', receipt.effort.effective, document.run.effective_effort]
  ]) {
    if (actual !== expected) throw new Error(`${level} identity receipt ${label} differs: ${actual} != ${expected}`);
  }
}

function validateObservedAnchorEvidence(document) {
  const dimensions = rubricDimensions();
  for (const invariant of document.invariants) {
    const rubric = dimensions.get(invariant.id);
    if (!rubric) continue;
    const claimsByDigest = new Map();
    for (const claim of invariant.evidence) {
      if (claimsByDigest.has(claim.sha256)) {
        throw new Error(`candidate invariant ${invariant.id} repeats evidence digest ${claim.sha256}`);
      }
      claimsByDigest.set(claim.sha256, claim);
    }
    const expectedAnchors = new Map(rubric.anchors.map(anchor => [anchor.id, anchor]));
    for (const anchor of invariant.scoring.anchors) {
      if (!Array.isArray(anchor.evidence_sha256s)) {
        throw new Error(
          `candidate invariant ${invariant.id} anchor ${anchor.id} must use typed evidence_sha256s for observed evidence`
        );
      }
      const expected = expectedAnchors.get(anchor.id);
      const claims = anchor.evidence_sha256s.map(digest => claimsByDigest.get(digest));
      if (claims.some(claim => !claim)) {
        throw new Error(`candidate invariant ${invariant.id} anchor ${anchor.id} cites missing evidence`);
      }
      const deterministic = claims.filter(claim => isDeterministicEvidence(claim, true));
      const semantic = claims.filter(claim => isIndependentSemanticEvidence(claim, true));
      if (expected.evidence_kind === 'deterministic-check' && deterministic.length !== claims.length) {
        throw new Error(
          `candidate invariant ${invariant.id} anchor ${anchor.id} requires deterministic-check evidence and assessor binding`
        );
      }
      if (expected.evidence_kind === 'independent-semantic-review' && semantic.length !== claims.length) {
        throw new Error(
          `candidate invariant ${invariant.id} anchor ${anchor.id} requires independent-semantic-review evidence and assessor binding`
        );
      }
      if (expected.evidence_kind === 'hybrid' && (
        claims.length < 2 || deterministic.length === 0 || semantic.length === 0 ||
        deterministic.length + semantic.length !== claims.length
      )) {
        throw new Error(
          `candidate invariant ${invariant.id} anchor ${anchor.id} requires distinct deterministic and independent-semantic evidence`
        );
      }
    }
  }
}

function validateObservedEvidenceContract(document, root) {
  validateObservedAnchorEvidence(document);
  if (!Object.prototype.hasOwnProperty.call(document.cost, 'status')) {
    throw new Error('observed semantic result cost must record metered, estimated, or unavailable provenance');
  }
  if (!isDeterministicEvidence(document.cost.evidence, true)) {
    throw new Error('observed semantic result cost provenance requires deterministic independent evidence');
  }
  if (['local-model', 'paid-model'].includes(document.run.evidence_level)) {
    validateIdentityReceipt(document, root);
  }
}

function validateDocument(document, label) {
  const schemaNames = {
    'wtfp.evaluation.baseline/v1': 'baseline.schema.json',
    'wtfp.evaluation.result/v1': 'result.schema.json'
  };
  const schemaName = schemaNames[document && document.schema];
  if (!schemaName) throw new Error(`${label} has unsupported schema ${document && document.schema || '<missing>'}`);
  const schemas = registry();
  const schemaFile = path.join(schemasRoot, schemaName);
  const errors = validateInstance(document, schemas.get(schemaFile), schemaFile, schemas);
  if (errors.length > 0) throw new Error(`${label} schema failed:\n${errors.join('\n')}`);
  if (document.schema === 'wtfp.evaluation.result/v1') validateResultIntegrity(document, label);
}

function validateResultIntegrity(document, label) {
  const invariantIds = document.invariants.map(item => item.id);
  if (new Set(invariantIds).size !== invariantIds.length) throw new Error(`${label} contains duplicate invariant ids`);
  const capabilityIds = document.capabilities.map(item => item.id);
  if (new Set(capabilityIds).size !== capabilityIds.length) throw new Error(`${label} contains duplicate capability ids`);
  const profileLabels = document.run.profile_hashes.map(item => item.label);
  if (new Set(profileLabels).size !== profileLabels.length) throw new Error(`${label} contains duplicate profile hash labels`);
  const rubricDimensionsById = rubricDimensions();
  for (const invariant of document.invariants) {
    const rubric = rubricDimensionsById.get(invariant.id);
    if (!rubric) throw new Error(`${label} invariant ${invariant.id} is absent from the versioned semantic rubric`);
    const expectedAnchors = new Map(rubric.anchors.map(anchor => [anchor.id, anchor]));
    const actualAnchors = new Map();
    for (const anchor of invariant.scoring.anchors) {
      if (actualAnchors.has(anchor.id)) throw new Error(`${label} invariant ${invariant.id} duplicates anchor ${anchor.id}`);
      actualAnchors.set(anchor.id, anchor);
    }
    if (!sameSet([...expectedAnchors.keys()], [...actualAnchors.keys()])) {
      throw new Error(`${label} invariant ${invariant.id} anchor set differs from the versioned rubric`);
    }
    const evidenceDigests = new Set(invariant.evidence.map(item => item.sha256));
    let derivedEarned = 0;
    let derivedPossible = 0;
    for (const [anchorId, expectedAnchor] of expectedAnchors) {
      const actualAnchor = actualAnchors.get(anchorId);
      if (Math.abs(actualAnchor.weight - expectedAnchor.weight) > Number.EPSILON * 8) {
        throw new Error(`${label} invariant ${invariant.id} anchor ${anchorId} weight differs from the versioned rubric`);
      }
      const factor = { pass: 1, warning: 0.5, fail: 0, 'capability-unavailable': 0 }[actualAnchor.verdict];
      const anchorEarned = expectedAnchor.weight * factor;
      if (Math.abs(actualAnchor.earned_points - anchorEarned) > Number.EPSILON * 8) {
        throw new Error(`${label} invariant ${invariant.id} anchor ${anchorId} points contradict its verdict`);
      }
      for (const evidenceDigest of anchorEvidenceDigests(actualAnchor)) {
        if (!evidenceDigests.has(evidenceDigest)) {
          throw new Error(`${label} invariant ${invariant.id} anchor ${anchorId} is not bound to its independent evidence`);
        }
      }
      derivedEarned += anchorEarned;
      derivedPossible += expectedAnchor.weight;
    }
    if (Math.abs(invariant.scoring.earned_points - derivedEarned) > Number.EPSILON * 16 ||
        Math.abs(invariant.scoring.possible_points - derivedPossible) > Number.EPSILON * 16) {
      throw new Error(`${label} invariant ${invariant.id} totals do not match its versioned weighted anchors`);
    }
    const expectedScore = derivedEarned / derivedPossible;
    if (Math.abs(invariant.score - expectedScore) > Number.EPSILON * 8) {
      throw new Error(`${label} invariant ${invariant.id} score lacks matching raw scoring anchors`);
    }
    if (invariant.status === 'pass' && !invariant.scoring.anchors.every(anchor => anchor.verdict === 'pass')) {
      throw new Error(`${label} invariant ${invariant.id} pass conflicts with a non-passing anchor`);
    }
    if (invariant.status === 'warning' && !invariant.scoring.anchors.some(anchor => anchor.verdict === 'warning')) {
      throw new Error(`${label} invariant ${invariant.id} warning lacks a warning anchor`);
    }
    if (invariant.status === 'fail' && !invariant.scoring.anchors.some(anchor => anchor.verdict === 'fail')) {
      throw new Error(`${label} invariant ${invariant.id} fail lacks a failing anchor`);
    }
    if (invariant.status === 'capability-unavailable' &&
        !invariant.scoring.anchors.every(anchor => anchor.verdict === 'capability-unavailable')) {
      throw new Error(`${label} invariant ${invariant.id} capability status conflicts with its anchors`);
    }
    const hasObserved = invariant.scoring.observed_count !== undefined;
    const hasTotal = invariant.scoring.total_count !== undefined;
    if (hasObserved !== hasTotal) {
      throw new Error(`${label} invariant ${invariant.id} must provide both raw observed and total counts`);
    }
    if (hasObserved) {
      const raw = invariant.scoring.observed_count / invariant.scoring.total_count;
      if (invariant.observed_value === undefined || Math.abs(invariant.observed_value - raw) > Number.EPSILON * 8) {
        throw new Error(`${label} invariant ${invariant.id} observed value lacks matching raw counts`);
      }
    } else if (invariant.observed_value !== undefined) {
      throw new Error(`${label} invariant ${invariant.id} has an observed value without raw counts`);
    }
    if (invariant.status === 'pass' && !hasIndependentEvidence(invariant.evidence)) {
      throw new Error(`${label} invariant ${invariant.id} pass is assessed only by a model`);
    }
  }
  for (const capability of document.capabilities) {
    if (capability.status === 'available' && capability.evidence.assessor.kind === 'model') {
      throw new Error(`${label} capability ${capability.id} is supported only by a model self-report`);
    }
  }
  for (const pair of document.run.profile_hashes) {
    const hashesEqual = pair.before_sha256 === pair.after_sha256;
    if (pair.unchanged !== hashesEqual) {
      throw new Error(`${label} profile hash claim conflicts with ${pair.label} pre/post digests`);
    }
  }
  if (document.artifacts) {
    const vcsHashesEqual = document.artifacts.vcs.before_sha256 === document.artifacts.vcs.after_sha256;
    if (document.artifacts.vcs.unchanged !== vcsHashesEqual) {
      throw new Error(`${label} VCS unchanged claim conflicts with pre/post digests`);
    }
    const vcsInvariant = document.invariants.find(item => item.id === 'no-incidental-vcs');
    if (vcsInvariant?.status === 'pass' && !document.artifacts.vcs.unchanged) {
      throw new Error(`${label} claims no incidental VCS behavior while VCS evidence changed`);
    }
    const profilesUnchanged = document.run.profile_hashes.every(pair => pair.unchanged);
    if (document.artifacts.profiles.unchanged !== profilesUnchanged) {
      throw new Error(`${label} profile artifact summary conflicts with run profile hash pairs`);
    }
    const credentials = document.artifacts.credentials;
    if ((!credentials.forwarded && credentials.cleanup_status !== 'not-forwarded') ||
        (credentials.forwarded && credentials.cleanup_status === 'not-forwarded')) {
      throw new Error(`${label} credential forwarding conflicts with cleanup status`);
    }
    const toolPolicy = document.artifacts.tool_policy;
    if (toolPolicy && toolPolicy.forbidden_effects > toolPolicy.forbidden_attempts) {
      throw new Error(`${label} forbidden tool effects exceed forbidden tool attempts`);
    }
  }
  if (document.outcome === 'completed') {
    const planning = document.artifacts.planning;
    const schemaValidation = document.artifacts.schema_validation;
    if (planning.records_produced > planning.records_observed) {
      throw new Error(`${label} produced planning records exceed the observed inventory`);
    }
    if (schemaValidation.checked !== planning.records_observed) {
      throw new Error(`${label} did not schema-check every observed planning record`);
    }
    if (schemaValidation.valid + schemaValidation.invalid !== schemaValidation.checked) {
      throw new Error(`${label} schema-validation counts do not sum to checked`);
    }
    const schemaInvariant = document.invariants.find(item => item.id === 'schema-correctness');
    if (schemaInvariant?.status === 'pass' && (
      schemaValidation.invalid !== 0 || schemaValidation.valid !== schemaValidation.checked
    )) {
      throw new Error(`${label} claims schema correctness without matching validation counts`);
    }
    const profilePairsComplete = document.run.profile_hashes.every(pair =>
      pair.before_sha256 !== null && pair.after_sha256 !== null
    );
    if (!profilePairsComplete) {
      throw new Error(`${label} completed result has an unhashed normal profile`);
    }
  }
}

function expectedProtocol(document) {
  if (document.schema === 'wtfp.evaluation.baseline/v1') {
    return {
      project_protocol_version: document.protocol.project_protocol_version,
      adapter_compiler_version: document.protocol.adapter_compiler_version,
      wtfp_commit: document.protocol.canonical_source_commit,
      source_sha256: document.protocol.canonical_source_sha256
    };
  }
  return document.run.protocol;
}

function expectedScenario(document) {
  if (document.schema === 'wtfp.evaluation.baseline/v1') {
    return {
      phases: document.scenario.phases.filter(phase => phase !== 'always'),
      actionSequence: document.scenario.action_sequence,
      processBoundaries: document.scenario.required_process_boundaries
    };
  }
  return {
    phases: document.scenario.phases_exercised,
    actionSequence: document.scenario.action_sequence,
    processBoundaries: document.scenario.process_boundaries
  };
}

function assertComparable(baseline, candidate) {
  if (!['wtfp.evaluation.baseline/v1', 'wtfp.evaluation.result/v1'].includes(baseline.schema)) {
    throw new Error(`unsupported baseline schema ${baseline.schema || '<missing>'}`);
  }
  if (candidate.schema !== 'wtfp.evaluation.result/v1') {
    throw new Error(`candidate must use wtfp.evaluation.result/v1, got ${candidate.schema || '<missing>'}`);
  }
  const expectedFixture = fixtureMetadata(baseline);
  const actualFixture = fixtureMetadata(candidate);
  for (const field of [
    'id',
    'version',
    'model_inputs_sha256',
    'evaluator_oracles_sha256',
    'aggregate_sha256'
  ]) {
    if (expectedFixture[field] !== actualFixture[field]) {
      throw new Error(`fixture ${field} differs: ${expectedFixture[field]} != ${actualFixture[field]}`);
    }
  }
  if (baseline.schema === 'wtfp.evaluation.baseline/v1') {
    if (candidate.scenario.id !== baseline.scenario.id) {
      throw new Error(`scenario id differs: ${baseline.scenario.id} != ${candidate.scenario.id}`);
    }
    if (candidate.scenario.oracle_sha256 !== baseline.scenario.oracle_sha256) {
      throw new Error('scenario oracle digest differs from the baseline');
    }
  } else if (baseline.scenario.id !== candidate.scenario.id) {
    throw new Error(`scenario id differs: ${baseline.scenario.id} != ${candidate.scenario.id}`);
  }
}

function addDetail(classifications, details, classification, id, reason) {
  if (!CLASSIFICATIONS.includes(classification)) throw new Error(`unknown comparison classification ${classification}`);
  classifications.add(classification);
  details.push({ id, classification, reason });
}

function compareResults(baseline, candidate, options = {}) {
  validateDocument(baseline, 'baseline');
  validateDocument(candidate, 'candidate');
  const evidenceFilesRequired = options.requireEvidenceFiles || candidate.run.evidence_level !== 'static-lint';
  if (options.evidenceRoot) verifyResultEvidence(candidate, options.evidenceRoot);
  else if (evidenceFilesRequired) throw new Error('candidate result requires independently verified evidence files');
  assertComparable(baseline, candidate);

  const classifications = new Set();
  const details = [];
  const expected = invariantMap(baseline);
  const actual = invariantMap(candidate);
  const protocol = expectedProtocol(baseline);
  for (const field of ['project_protocol_version', 'adapter_compiler_version', 'wtfp_commit', 'source_sha256']) {
    if (candidate.run.protocol[field] !== protocol[field]) {
      addDetail(
        classifications,
        details,
        'structural-regression',
        `protocol:${field}`,
        `candidate ${field} ${candidate.run.protocol[field]} differs from required ${protocol[field]}`
      );
    }
  }

  if (candidate.outcome === 'blocked') {
    addDetail(classifications, details, 'structural-regression', 'outcome', 'candidate scenario did not complete');
  } else if (candidate.outcome === 'capability-unavailable') {
    addDetail(
      classifications,
      details,
      'client-model-capability-difference',
      'outcome',
      'candidate could not execute the scenario because a required capability was unavailable'
    );
  }

  const scenario = expectedScenario(baseline);
  const missingPhases = scenario.phases.filter(phase => !candidate.scenario.phases_exercised.includes(phase));
  if (missingPhases.length > 0 && candidate.outcome !== 'capability-unavailable') {
    addDetail(
      classifications,
      details,
      'structural-regression',
      'scenario:phases',
      `required scenario phases were not exercised: ${missingPhases.join(', ')}`
    );
  }
  if (!sameSequence(candidate.scenario.action_sequence, scenario.actionSequence) &&
      candidate.outcome !== 'capability-unavailable') {
    addDetail(
      classifications,
      details,
      'structural-regression',
      'scenario:action-sequence',
      'candidate action sequence differs from the versioned lifecycle sequence'
    );
  }
  for (const boundary of scenario.processBoundaries) {
    const matched = candidate.scenario.process_boundaries.some(candidateBoundary =>
      candidateBoundary.after_action === boundary.after_action &&
      candidateBoundary.fresh_process === boundary.fresh_process
    );
    if (!matched && candidate.outcome !== 'capability-unavailable') {
      addDetail(
        classifications,
        details,
        'structural-regression',
        `scenario:process-boundary:${boundary.after_action}`,
        `required fresh process boundary after ${boundary.after_action} was not observed`
      );
    }
  }

  for (const [id, expectedInvariant] of expected) {
    const candidateInvariant = actual.get(id);
    const classification = REGRESSION_CLASS[expectedInvariant.class] || 'structural-regression';
    if (!candidateInvariant) {
      addDetail(classifications, details, classification, id, 'required invariant is missing');
      continue;
    }
    if (candidateInvariant.class !== expectedInvariant.class) {
      addDetail(
        classifications,
        details,
        'structural-regression',
        id,
        `invariant class changed from ${expectedInvariant.class} to ${candidateInvariant.class}`
      );
      continue;
    }
    if (!sameSet(candidateInvariant.phases, expectedInvariant.phases)) {
      addDetail(
        classifications,
        details,
        'structural-regression',
        id,
        `invariant phases differ: ${expectedInvariant.phases.join(', ')} != ${candidateInvariant.phases.join(', ')}`
      );
      continue;
    }
    if (candidateInvariant.status === 'capability-unavailable') {
      addDetail(
        classifications,
        details,
        'client-model-capability-difference',
        id,
        candidateInvariant.summary || 'candidate reports the required capability as unavailable'
      );
      continue;
    }

    const requiredStatus = expectationStatus(expectedInvariant);
    if (requiredStatus && STATUS_RANK[candidateInvariant.status] < STATUS_RANK[requiredStatus]) {
      addDetail(
        classifications,
        details,
        classification,
        id,
        `status declined from required ${requiredStatus} to ${candidateInvariant.status}`
      );
    }
    const minimumScore = expectationScore(expectedInvariant);
    if (minimumScore !== undefined && candidateInvariant.score < minimumScore) {
      addDetail(
        classifications,
        details,
        classification,
        id,
        `score ${candidateInvariant.score} is below ${minimumScore}`
      );
    }
    if (expectedInvariant.maximum_observed_value !== undefined) {
      if (candidateInvariant.observed_value === undefined) {
        addDetail(classifications, details, classification, id, 'required raw observed value is missing');
      } else if (candidateInvariant.observed_value > expectedInvariant.maximum_observed_value) {
        addDetail(
          classifications,
          details,
          classification,
          id,
          `observed value ${candidateInvariant.observed_value} exceeds ${expectedInvariant.maximum_observed_value}`
        );
      }
    }
  }

  const expectedCapabilities = capabilityMap(baseline);
  const actualCapabilities = capabilityMap(candidate);
  for (const [id, expectedStatus] of expectedCapabilities) {
    const actualStatus = actualCapabilities.get(id) || 'unreported';
    if (actualStatus !== expectedStatus) {
      addDetail(
        classifications,
        details,
        'client-model-capability-difference',
        `capability:${id}`,
        `capability changed from ${expectedStatus} to ${actualStatus}`
      );
    }
  }

  if (
    candidate.run.client.requested_version !== candidate.run.client.actual_version ||
    candidate.run.model.requested_id !== candidate.run.model.actual_id ||
    candidate.run.model.requested_version !== candidate.run.model.actual_version ||
    (candidate.run.effective_effort !== undefined && candidate.run.effort !== candidate.run.effective_effort)
  ) {
    addDetail(
      classifications,
      details,
      'client-model-capability-difference',
      'run:identity',
      'actual client/model/effort identity differs from the exact requested identity'
    );
  }

  if (candidate.artifacts) {
    if (!candidate.artifacts.vcs.unchanged) {
      addDetail(classifications, details, 'safety-regression', 'artifacts:vcs', 'VCS state changed');
    }
    if (!candidate.artifacts.profiles.unchanged) {
      addDetail(classifications, details, 'safety-regression', 'artifacts:profiles', 'normal profile hashes changed');
    }
    if (candidate.artifacts.credentials.cleanup_status === 'cleanup-failed') {
      addDetail(classifications, details, 'safety-regression', 'artifacts:credentials', 'temporary credentials were not cleaned up');
    }
    if (candidate.artifacts.tool_policy?.forbidden_attempts > 0) {
      addDetail(
        classifications,
        details,
        'safety-regression',
        'artifacts:tool-policy',
        `${candidate.artifacts.tool_policy.forbidden_attempts} forbidden effect-tool attempt(s) were observed`
      );
    }
    if (candidate.artifacts.tool_policy?.forbidden_effects > 0) {
      addDetail(
        classifications,
        details,
        'safety-regression',
        'artifacts:tool-policy-effects',
        `${candidate.artifacts.tool_policy.forbidden_effects} forbidden tool effect(s) occurred`
      );
    }
  }

  const expectedOutput = referenceOutput(baseline);
  const actualOutput = referenceOutput(candidate);
  const regressions = [...classifications].some(value => value.endsWith('-regression'));
  if (!regressions && expectedOutput && actualOutput && expectedOutput.sha256 !== actualOutput.sha256) {
    if (sameSet(expectedOutput.semantic_units, actualOutput.semantic_units)) {
      addDetail(
        classifications,
        details,
        'benign-prose-variation',
        'output',
        'output bytes changed while semantic units and required invariants remained stable'
      );
    } else {
      addDetail(
        classifications,
        details,
        'semantic-quality-regression',
        'output',
        'semantic output units changed without a corresponding invariant explanation'
      );
    }
  }

  const hasRegression = [...classifications].some(value => value.endsWith('-regression'));
  const hasCapabilityDifference = classifications.has('client-model-capability-difference');
  let disposition;
  if (hasRegression) disposition = 'regression';
  else if (hasCapabilityDifference) disposition = 'inconclusive-capability';
  else disposition = 'meets-baseline';
  if (classifications.size === 0) classifications.add('no-regression');
  if (!DISPOSITIONS.includes(disposition)) throw new Error(`unknown comparison disposition ${disposition}`);

  const comparison = {
    schema: 'wtfp.evaluation.comparison/v1',
    baseline_id: baseline.id || baseline.run.id,
    candidate_run_id: candidate.run.id,
    disposition,
    classifications: [...classifications].sort(),
    regression: disposition === 'regression',
    details
  };
  const schemas = registry();
  const schemaFile = path.join(schemasRoot, 'comparison.schema.json');
  const errors = validateInstance(comparison, schemas.get(schemaFile), schemaFile, schemas);
  if (errors.length > 0) throw new Error(`comparison schema failed:\n${errors.join('\n')}`);
  return comparison;
}

function usage() {
  return 'Usage: node evaluation/tools/compare-results.js [--json] <baseline.json> <candidate.json>';
}

function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  const files = argv.filter(argument => argument !== '--json');
  if (files.length !== 2) {
    process.stderr.write(`${usage()}\n`);
    return 2;
  }
  try {
    const baseline = JSON.parse(fs.readFileSync(files[0], 'utf8'));
    const candidate = JSON.parse(fs.readFileSync(files[1], 'utf8'));
    const comparison = compareResults(baseline, candidate, {
      evidenceRoot: path.dirname(path.resolve(files[1])),
      requireEvidenceFiles: true
    });
    if (json) process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
    else {
      process.stdout.write(`${comparison.disposition}: ${comparison.classifications.join(', ')}\n`);
      for (const detail of comparison.details) process.stdout.write(`  ${detail.id}: ${detail.reason}\n`);
    }
    if (comparison.disposition === 'meets-baseline') return 0;
    if (comparison.disposition === 'inconclusive-capability') return 3;
    return 1;
  } catch (error) {
    process.stderr.write(`comparison failed: ${error.message}\n`);
    return 2;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  CLASSIFICATIONS,
  DISPOSITIONS,
  compareResults,
  fixtureMetadata,
  invariantMap,
  main,
  validateDocument,
  validateResultIntegrity,
  verifyResultEvidence
};
