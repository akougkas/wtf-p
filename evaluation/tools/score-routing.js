#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { SchemaRegistry, validateInstance } = require('../lib/json-schema');

const repositoryRoot = path.resolve(__dirname, '../..');
const evaluationRoot = path.join(repositoryRoot, 'evaluation');
const schemasRoot = path.join(evaluationRoot, 'v1', 'schemas');
const casesFile = path.join(evaluationRoot, 'v1', 'routing', 'cases.json');
const explicitFile = path.join(evaluationRoot, 'v1', 'routing', 'explicit-actions.json');
const clientSurfacesFile = path.join(evaluationRoot, 'v1', 'routing', 'client-surfaces.json');
const matrixFile = path.join(evaluationRoot, 'v1', 'matrix', 'budget.json');
const routingManifestFile = path.join(evaluationRoot, 'v1', 'routing', 'manifest.json');

const RESOURCE_KIND_ORDER = Object.freeze([
  'skill',
  'action-reference',
  'action-contract',
  'workflow',
  'schema',
  'template'
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function rate(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function mean(values) {
  const present = values.filter(value => value !== null);
  return present.length === 0 ? null : present.reduce((total, value) => total + value, 0) / present.length;
}

function routeLabel(route) {
  if (!route) return 'unobservable';
  if (route.kind === 'none') return 'none';
  if (route.kind === 'operation') return `operation:${route.action}`;
  return `skill:${route.skill}/${route.action}`;
}

function routeEqual(left, right) {
  if (!left || !right || left.kind !== right.kind) return false;
  if (left.kind === 'none') return true;
  if (left.action !== right.action) return false;
  return left.kind !== 'skill' || left.skill === right.skill;
}

function routeSkillEqual(left, right) {
  if (!left || !right) return false;
  if (left.kind === 'skill') return right.kind === 'skill' && left.skill === right.skill;
  return right.kind !== 'skill';
}

function routeAccepted(definition, actual) {
  const expected = definition.expected.route || definition.expected;
  if (definition.category === 'product-operation') {
    return actual.kind === 'none' || routeEqual(expected, actual);
  }
  return routeEqual(expected, actual);
}

function projectSchemasForAction(action) {
  const schemas = new Set();
  const uris = [...action.reads, ...action.produces.map(output => output.uri)];
  for (const uri of uris) {
    if (uri === 'project://manifest') schemas.add('manifest');
    else if (uri === 'project://config') schemas.add('config');
    else if (uri === 'project://state') schemas.add('state');
    else if (uri === 'project://decisions') schemas.add('decisions');
    else if (uri === 'project://structure/outline') schemas.add('outline');
    else if (uri.startsWith('project://sections/')) schemas.add('section');
    else if (uri.startsWith('project://sources/')) schemas.add('source');
    else if (uri.startsWith('project://evidence/')) schemas.add('evidence');
    else if (uri.startsWith('project://checkpoints/')) schemas.add('checkpoint');
    else if (uri.startsWith('project://validations/')) schemas.add('validation');
  }
  return [...schemas].sort();
}

function resource(kind, resourcePath) {
  return { kind, path: resourcePath };
}

function sortResources(resources) {
  return [...resources].sort((left, right) => {
    const kindOrder = RESOURCE_KIND_ORDER.indexOf(left.kind) - RESOURCE_KIND_ORDER.indexOf(right.kind);
    return kindOrder || left.path.localeCompare(right.path);
  });
}

function actionContract(actionId) {
  return readJson(path.join(repositoryRoot, 'protocol', 'actions', `${actionId}.json`));
}

function canonicalResources(definition, selectedRoute = null) {
  const route = selectedRoute || definition.expected.route || definition.expected;
  if (route.kind === 'none') return [];
  const action = actionContract(route.action);
  const resources = [];
  if (route.kind === 'skill') {
    resources.push(resource('skill', `protocol/skills/${route.skill}/SKILL.md`));
    // This is deliberately identified as one monolithic per-skill reference. It is
    // not represented as a fictitious per-action file.
    resources.push(resource('action-reference', `protocol/skills/${route.skill}/references/actions.md`));
  }
  resources.push(resource('action-contract', `protocol/actions/${route.action}.json`));
  resources.push(resource('workflow', `protocol/workflows/${route.action}.md`));
  const schemas = projectSchemasForAction(action);
  if (schemas.length > 0) {
    resources.push(resource('schema', 'protocol/project/schemas/common.schema.json'));
    for (const schema of schemas) {
      resources.push(resource('schema', `protocol/project/schemas/${schema}.schema.json`));
      resources.push(resource('template', `protocol/project/templates/${schema}.json`));
    }
  }
  return sortResources(resources);
}

function canonicalCapabilities(definition, selectedRoute = null) {
  const route = selectedRoute || definition.expected.route || definition.expected;
  if (route.kind === 'none') return [];
  return [...actionContract(route.action).requirements.capabilities].sort();
}

function clientSurface(target) {
  const surface = readJson(clientSurfacesFile).targets.find(item => item.target === target);
  if (!surface) throw new Error(`unknown client routing selector profile ${target}`);
  return surface;
}

function expandSelectorTemplate(template, fields) {
  let output = template;
  for (const name of ['skill', 'action', 'separator', 'arguments']) {
    output = output.split(`{${name}}`).join(fields[name] ?? '');
  }
  if (/\{(?:skill|action|separator|arguments)\}/u.test(output)) {
    throw new Error(`selector template retained an unresolved placeholder: ${output}`);
  }
  return output;
}

function materializeNativeInput(definition, target) {
  if (!definition.explicit) return definition.semanticInput;
  const surface = clientSurface(target);
  const expected = definition.expected.route || definition.expected;
  const selector = expected.kind === 'operation' ? surface.explicit.operations : surface.explicit.academic;
  if (selector.selector_kind === 'unsupported') return null;
  const fields = {
    skill: expected.skill || '',
    action: expected.action,
    separator: definition.arguments.length > 0 ? ' ' : '',
    arguments: definition.arguments
  };
  return expandSelectorTemplate(selector.template, fields);
}

function definitionCatalog(target = null) {
  const cases = readJson(casesFile).cases;
  const explicit = readJson(explicitFile).actions;
  const definitions = new Map();
  for (const testCase of cases) {
    definitions.set(testCase.id, {
      id: testCase.id,
      category: testCase.category,
      expected: testCase.expected,
      semanticInput: testCase.prompt,
      input: testCase.prompt,
      explicit: false,
      targetSkill: testCase.tags.find(tag => tag.startsWith('target-'))?.slice('target-'.length) || null
    });
  }
  for (const action of explicit) {
    definitions.set(`explicit-${action.id}`, {
      id: `explicit-${action.id}`,
      category: 'explicit-action',
      expected: action.expected,
      semanticInput: `${action.id}${action.arguments.length > 0 ? ` ${action.arguments}` : ''}`,
      input: action.invocation,
      arguments: action.arguments,
      explicit: true,
      targetSkill: action.expected.skill || null
    });
  }
  if (target) {
    for (const definition of definitions.values()) {
      definition.input = materializeNativeInput(definition, target);
      definition.input_supported = definition.input !== null;
    }
  }
  return definitions;
}

function schemaRegistry() {
  const schemaFiles = fs.readdirSync(schemasRoot)
    .filter(name => name.endsWith('.schema.json'))
    .map(name => path.join(schemasRoot, name));
  return new SchemaRegistry(schemaFiles);
}

function validateAgainst(document, schemaName) {
  const registry = schemaRegistry();
  const schemaFile = path.join(schemasRoot, schemaName);
  return validateInstance(document, registry.get(schemaFile), schemaFile, registry);
}

function validateObservationDocument(document) {
  return validateAgainst(document, 'routing-observations.schema.json');
}

function containedPath(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function observationEvidence(document) {
  return [
    document.run.case_isolation.evidence,
    ...document.observations.flatMap(observation => [
      observation.evidence,
      observation.selector.evidence,
      observation.route.evidence,
      observation.activation.evidence,
      observation.arguments.evidence,
      observation.disclosure.evidence,
      observation.cost.evidence,
      ...observation.disclosure.resources.map(item => item.evidence),
      ...observation.disclosure.capabilities.map(item => item.evidence)
    ]),
    document.cost.evidence
  ];
}

function verifyEvidenceBundle(document, evidenceRoot) {
  if (!evidenceRoot) throw new Error('paid or native routing evidence requires a contained evidence root');
  const root = path.resolve(evidenceRoot);
  let rootReal;
  try {
    rootReal = fs.realpathSync(root);
  } catch {
    throw new Error(`routing evidence root is missing: ${root}`);
  }
  if (!fs.statSync(rootReal).isDirectory()) throw new Error(`routing evidence root is not a directory: ${root}`);
  for (const claim of observationEvidence(document)) {
    if (claim.assessor.kind === 'model') {
      throw new Error(`routing evidence ${claim.locator} is a candidate-model self-report`);
    }
    if (path.isAbsolute(claim.locator) || claim.locator.includes('://')) {
      throw new Error(`routing evidence locator must be relative: ${claim.locator}`);
    }
    const file = path.resolve(root, claim.locator);
    if (!containedPath(root, file)) throw new Error(`routing evidence escapes its root: ${claim.locator}`);
    let stat;
    try {
      stat = fs.lstatSync(file);
    } catch {
      throw new Error(`routing evidence is missing: ${claim.locator}`);
    }
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(`routing evidence must be a regular non-symlink file: ${claim.locator}`);
    }
    const real = fs.realpathSync(file);
    if (!containedPath(rootReal, real)) {
      throw new Error(`routing evidence resolves outside its root: ${claim.locator}`);
    }
    const actual = sha256(fs.readFileSync(file));
    if (actual !== claim.sha256) {
      throw new Error(`routing evidence digest differs for ${claim.locator}: ${actual} != ${claim.sha256}`);
    }
  }
}

function verifyRoutingSuite(document) {
  const manifest = readJson(routingManifestFile);
  const manifestSha = sha256(fs.readFileSync(routingManifestFile));
  for (const [label, actual, expected] of [
    ['routing suite id', document.suite.id, manifest.id],
    ['routing suite version', document.suite.version, manifest.version],
    ['routing suite manifest digest', document.suite.manifest_sha256, manifestSha]
  ]) {
    if (actual !== expected) throw new Error(`${label} differs: ${actual} != ${expected}`);
  }
  if (document.suite.selector_profile !== document.suite.target) {
    throw new Error(`routing selector profile differs from target: ${document.suite.selector_profile} != ${document.suite.target}`);
  }
  clientSurface(document.suite.selector_profile);
  for (const corpus of manifest.corpora) {
    const file = path.resolve(repositoryRoot, corpus.path);
    if (!containedPath(repositoryRoot, file) || sha256(fs.readFileSync(file)) !== corpus.sha256) {
      throw new Error(`routing corpus digest differs: ${corpus.path}`);
    }
  }
  const casesSha = manifest.corpora.find(item => item.path.endsWith('/cases.json')).sha256;
  const explicitSha = manifest.corpora.find(item => item.path.endsWith('/explicit-actions.json')).sha256;
  const surfacesSha = sha256(fs.readFileSync(clientSurfacesFile));
  if (manifest.fixture.evaluator_oracles_sha256 !== sha256(Buffer.from(`${casesSha}\n${explicitSha}\n${surfacesSha}`))) {
    throw new Error('routing client selector surface digest differs from fixture oracle binding');
  }
  const envelope = manifest.generated_envelopes.find(item => item.target === document.suite.target);
  if (!envelope) throw new Error(`routing suite has no generated envelope for ${document.suite.target}`);
  const envelopeFile = path.resolve(repositoryRoot, envelope.path);
  if (!containedPath(repositoryRoot, envelopeFile) || sha256(fs.readFileSync(envelopeFile)) !== envelope.manifest_sha256) {
    throw new Error(`generated envelope inventory digest differs: ${envelope.path}`);
  }
  const generated = readJson(envelopeFile);
  if (generated.sourceHash !== envelope.source_sha256) {
    throw new Error(`generated envelope source hash differs for ${document.suite.target}`);
  }
  const fixtureFields = [
    'id', 'version', 'model_inputs_sha256', 'evaluator_oracles_sha256', 'aggregate_sha256'
  ];
  for (const field of fixtureFields) {
    if (document.run.fixture[field] !== manifest.fixture[field]) {
      throw new Error(`routing fixture ${field} differs: ${document.run.fixture[field]} != ${manifest.fixture[field]}`);
    }
  }
  for (const [field, expected] of [
    ['project_protocol_version', manifest.project_protocol_version],
    ['adapter_compiler_version', manifest.adapter_compiler_version],
    ['wtfp_commit', manifest.wtfp_commit],
    ['source_sha256', envelope.source_sha256]
  ]) {
    if (document.run.protocol[field] !== expected) {
      throw new Error(`routing protocol ${field} differs: ${document.run.protocol[field]} != ${expected}`);
    }
  }
  const binary = document.run.client.binary;
  let binaryStat;
  try {
    binaryStat = fs.lstatSync(binary.path);
  } catch {
    throw new Error(`routing client binary is missing: ${binary.path}`);
  }
  if (!binaryStat.isFile() || binaryStat.isSymbolicLink()) {
    throw new Error(`routing client binary must be a regular non-symlink file: ${binary.path}`);
  }
  const binarySha = sha256(fs.readFileSync(binary.path));
  if (binarySha !== binary.sha256) {
    throw new Error(`routing client binary digest differs: ${binarySha} != ${binary.sha256}`);
  }
  return { manifest, envelope };
}

function sameResources(expected, observed) {
  const actual = sortResources(observed
    .filter(item => item.status === 'loaded')
    .map(({ kind, path: resourcePath }) => ({ kind, path: resourcePath })));
  return expected.length === actual.length && expected.every((item, index) =>
    item.kind === actual[index].kind && item.path === actual[index].path
  );
}

function sameCapabilities(expected, observed) {
  const available = observed.filter(item => item.status === 'available').map(item => item.id).sort();
  return expected.length === available.length && expected.every((item, index) => item === available[index]);
}

function emptyBucket() {
  return { definitions: 0, observed: 0, accepted: 0, failed: 0 };
}

function incrementBucket(map, key, accepted, observable = true) {
  if (!map.has(key)) map.set(key, emptyBucket());
  const bucket = map.get(key);
  bucket.definitions += 1;
  if (observable) {
    bucket.observed += 1;
    bucket.accepted += Number(accepted === true);
    bucket.failed += Number(accepted === false);
  }
}

function serializeBuckets(map, keyName) {
  return [...map.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, bucket]) => ({
    [keyName]: key,
    ...bucket,
    accuracy: rate(bucket.accepted, bucket.observed)
  }));
}

function expectedRoute(definition) {
  return definition.expected.route || definition.expected;
}

function routeSkillAccepted(definition, actual) {
  const expected = expectedRoute(definition);
  if (!actual) return false;
  if (expected.kind === 'skill') return actual.kind === 'skill' && actual.skill === expected.skill;
  return actual.kind !== 'skill';
}

function claimOutcome(claim, definition, observation, surface, disclosureExact) {
  const expected = expectedRoute(definition);
  const explicitSelector = expected.kind === 'operation'
    ? surface.explicit.operations
    : surface.explicit.academic;
  if (claim === 'selector-accepted') {
    if (!definition.explicit) return 'not-applicable';
    if (explicitSelector.selector_kind === 'unsupported' ||
        ['unsupported', 'unobservable'].includes(observation.selector.status)) return 'inconclusive-capability';
    return observation.selector.status === 'accepted' ? 'pass' : 'fail';
  }
  if (claim === 'route-skill') {
    const supported = definition.explicit
      ? explicitSelector.selector_kind !== 'unsupported' && surface.observability.route !== 'unobservable'
      : surface.implicit.route_granularity !== 'unobservable';
    if (!supported || observation.route.signal === 'unobservable' || !observation.route.value) {
      return 'inconclusive-capability';
    }
    return routeSkillAccepted(definition, observation.route.value) ? 'pass' : 'fail';
  }
  if (claim === 'route-action') {
    if (expected.kind === 'none') return 'not-applicable';
    const supported = definition.explicit
      ? ['action', 'operation'].includes(explicitSelector.granularity) &&
        ['observable', 'explicit-only'].includes(surface.observability.action)
      : surface.observability.action === 'observable';
    if (!supported || observation.route.signal === 'unobservable' || !observation.route.value ||
        observation.route.granularity !== 'action') return 'inconclusive-capability';
    return routeEqual(expected, observation.route.value) ? 'pass' : 'fail';
  }
  if (claim === 'suggestion') {
    if (definition.explicit || surface.implicit.expected_signal !== 'suggested') return 'not-applicable';
    if (observation.route.signal === 'unobservable') return 'inconclusive-capability';
    if (expected.kind === 'skill') {
      return observation.route.signal === 'suggested' && routeSkillAccepted(definition, observation.route.value)
        ? 'pass' : 'fail';
    }
    return observation.route.signal === 'none' && routeSkillAccepted(definition, observation.route.value)
      ? 'pass' : 'fail';
  }
  if (claim === 'activation') {
    if (expected.kind !== 'skill') return 'not-applicable';
    const expectedStatus = definition.explicit ? 'loaded' : surface.implicit.expected_activation;
    if (expectedStatus === 'unobservable' || observation.activation.status === 'unobservable') {
      return 'inconclusive-capability';
    }
    if (observation.activation.status !== expectedStatus) return 'fail';
    if (expectedStatus === 'loaded' && observation.activation.skill !== expected.skill) return 'fail';
    if (observation.activation.skill !== null && observation.activation.skill !== expected.skill) return 'fail';
    return 'pass';
  }
  if (claim === 'arguments') {
    if (!definition.explicit) return 'not-applicable';
    const argumentMode = expected.kind === 'skill' ? surface.explicit.academic.arguments :
      explicitSelector.selector_kind === 'action-command' ? 'expanded' : 'unobservable';
    if (argumentMode !== 'expanded' || observation.arguments.status === 'unobservable') {
      return 'inconclusive-capability';
    }
    if (observation.arguments.status !== 'observed') return 'fail';
    return observation.arguments.value === definition.arguments ? 'pass' : 'fail';
  }
  if (claim === 'resources') {
    if (!definition.explicit || expected.kind === 'none') return 'not-applicable';
    if (!['observable', 'explicit-only'].includes(surface.observability.resources) ||
        observation.disclosure.status === 'unobservable' || disclosureExact === null) {
      return 'inconclusive-capability';
    }
    return disclosureExact ? 'pass' : 'fail';
  }
  if (claim === 'cost') {
    if (observation.cost.status === 'unavailable') return 'inconclusive-capability';
    if (surface.cost_policy.status === 'metered' && observation.cost.status !== 'metered') return 'fail';
    return Number.isFinite(observation.cost.amount) && observation.cost.currency === 'USD' ? 'pass' : 'fail';
  }
  throw new Error(`unknown routing claim ${claim}`);
}

function summarizeClaims(requiredClaims, caseClaims) {
  return requiredClaims.map(id => {
    const applicable = caseClaims.flatMap(item => item.claims).filter(item => item.id === id && item.status !== 'not-applicable');
    const counts = {
      applicable: applicable.length,
      passed: applicable.filter(item => item.status === 'pass').length,
      failed: applicable.filter(item => item.status === 'fail').length,
      inconclusive: applicable.filter(item => item.status === 'inconclusive-capability').length
    };
    const disposition = counts.failed > 0 ? 'fail' :
      counts.inconclusive > 0 || counts.applicable === 0 ? 'inconclusive-capability' : 'pass';
    return { id, ...counts, disposition };
  });
}

function resolveMatrixConstraint(document, rowId) {
  if (!rowId) return null;
  const matrix = readJson(matrixFile);
  const schemaErrors = validateAgainst(matrix, 'budget-matrix.schema.json');
  if (schemaErrors.length > 0) throw new Error(`budget matrix schema failed:\n${schemaErrors.join('\n')}`);
  const binding = document.run.matrix_binding;
  if (!binding) throw new Error('matrix-constrained scoring requires run.matrix_binding');
  if (binding.matrix_id !== matrix.id || binding.matrix_version !== matrix.version || binding.row_id !== rowId) {
    throw new Error(`run matrix binding does not match ${matrix.id}/v${matrix.version}/${rowId}`);
  }
  const matrixSha = sha256(fs.readFileSync(matrixFile));
  if (binding.sha256 !== matrixSha) throw new Error(`budget matrix digest differs: ${binding.sha256} != ${matrixSha}`);
  const row = matrix.rows.find(item => item.id === rowId);
  if (!row) throw new Error(`unknown budget matrix row ${rowId}`);
  if (!['planned', 'completed'].includes(row.status)) {
    throw new Error(`budget matrix row ${rowId} is ${row.status}, so it cannot score observations`);
  }
  const identities = [
    ['client name', document.run.client.name, row.client.name],
    ['requested client version', document.run.client.requested_version, row.client.version],
    ['requested model id', document.run.model.requested_id, row.model.id],
    ['requested model version', document.run.model.requested_version, row.model.version],
    ['effort', document.run.effort, row.effort],
    ['evidence level', document.run.evidence_level, row.evidence_level],
    ['adapter target', document.suite.target, row.adapter_target],
    ['selector profile', document.suite.selector_profile, row.selector_profile],
    ['permission policy', document.run.permission_policy, row.permission_policy],
    ['environment policy', document.run.execution.environment_policy, row.environment_policy],
    ['client source commit', document.run.protocol.client_commit, row.client.commit]
  ];
  for (const [label, actual, expected] of identities) {
    if (actual !== expected) throw new Error(`${label} silently substituted: ${actual} != ${expected}`);
  }
  const actualIdentities = [
    ['client version', document.run.client.actual_version, row.client.version],
    ['model id', document.run.model.actual_id, row.model.id],
    ['model version', document.run.model.actual_version, row.model.version]
  ];
  if (!row.allow_substitution) {
    const substituted = actualIdentities.find(([, actual, expected]) => actual !== expected && actual !== 'unavailable');
    if (substituted) {
      throw new Error(`budget matrix row ${rowId} forbids ${substituted[0]} substitution: ${substituted[1]} != ${substituted[2]}`);
    }
  }
  const identityInconclusive = actualIdentities.some(([, actual]) => actual === 'unavailable');
  if (document.observations.length > row.maximum_paid_cases) {
    throw new Error(`budget matrix paid-case ceiling exceeded: ${document.observations.length} > ${row.maximum_paid_cases}`);
  }
  const pricedCases = document.observations.filter(observation => observation.cost.status !== 'unavailable');
  const unpricedCases = document.observations.filter(observation => observation.cost.status === 'unavailable');
  if (document.cost.priced_cases !== pricedCases.length || document.cost.unpriced_cases !== unpricedCases.length ||
      document.cost.priced_cases + document.cost.unpriced_cases !== document.observations.length) {
    throw new Error('routing aggregate cost case counts do not match per-case provenance');
  }
  for (const observation of pricedCases) {
    if (observation.cost.currency !== matrix.currency) {
      throw new Error(`budget matrix currency differs for ${observation.case_id}: ${observation.cost.currency} != ${matrix.currency}`);
    }
  }
  if (unpricedCases.length > 0) {
    if (document.cost.status !== 'unavailable') {
      throw new Error(`routing aggregate cost must be unavailable while ${unpricedCases.length} case costs are unavailable`);
    }
  } else {
    const aggregateStatus = pricedCases.some(observation => observation.cost.status === 'estimated')
      ? 'estimated' : 'metered';
    if (document.cost.status !== aggregateStatus) {
      throw new Error(`routing aggregate cost provenance differs: ${document.cost.status} != ${aggregateStatus}`);
    }
    if (document.cost.currency !== matrix.currency) {
      throw new Error(`budget matrix currency differs: ${document.cost.currency} != ${matrix.currency}`);
    }
    const observedCost = pricedCases.reduce((sum, observation) => sum + observation.cost.amount, 0);
    if (Math.abs(observedCost - document.cost.amount) > 1e-9) {
      throw new Error(`routing case costs do not sum to total: ${observedCost} != ${document.cost.amount}`);
    }
  }
  if (row.cost_policy.status !== 'unavailable' && document.cost.status !== row.cost_policy.status) {
    throw new Error(`budget matrix cost provenance differs: ${document.cost.status} != ${row.cost_policy.status}`);
  }
  if (document.cost.status !== 'unavailable') {
    if (row.cost_policy.maximum_usd !== null && document.cost.amount > row.cost_policy.maximum_usd) {
      throw new Error(`budget matrix cost exceeded: ${document.cost.amount} > ${row.cost_policy.maximum_usd} ${matrix.currency}`);
    }
  }
  const observedLatency = document.observations.reduce((sum, observation) => sum + observation.latency_ms, 0);
  if (observedLatency !== document.latency_ms) {
    throw new Error(`routing case latencies do not sum to total: ${observedLatency} != ${document.latency_ms}`);
  }
  if (!['fresh-process-per-case', 'fresh-session-per-case'].includes(document.run.case_isolation.strategy) ||
      !document.run.case_isolation.session_ids_unique || document.run.case_isolation.conversational_memory_shared) {
    throw new Error('routing matrix requires fresh unique case sessions with no shared conversational memory');
  }
  for (const pair of document.run.profile_hashes) {
    if (pair.before_sha256 === null || pair.after_sha256 === null || !pair.unchanged ||
        pair.before_sha256 !== pair.after_sha256) {
      throw new Error(`normal profile changed or was not hashable: ${pair.label}`);
    }
  }
  return { matrix, row, identityInconclusive };
}

function scoreObservations(document, options = {}) {
  const schemaErrors = validateObservationDocument(document);
  if (schemaErrors.length > 0) {
    throw new Error(`routing observation schema failed:\n${schemaErrors.join('\n')}`);
  }
  if (options.allowPartial && !options.matrixRow) {
    throw new Error('partial scoring is allowed only through a checked-in budget matrix row');
  }

  const suite = verifyRoutingSuite(document);
  if (document.run.evidence_level !== 'static-lint') verifyEvidenceBundle(document, options.evidenceRoot);
  const definitions = definitionCatalog(document.suite.selector_profile);
  const matrixConstraint = resolveMatrixConstraint(document, options.matrixRow || null);
  const requiredIds = matrixConstraint
    ? new Set(matrixConstraint.row.case_ids)
    : new Set(definitions.keys());
  for (const id of requiredIds) {
    if (!definitions.has(id)) throw new Error(`budget matrix contains unknown routing case ${id}`);
  }

  const observedIds = new Set();
  const sessionIds = new Set();
  const counters = {
    implicit: 0,
    implicitRouteObservable: 0,
    implicitAccepted: 0,
    implicitActionObservable: 0,
    implicitExact: 0,
    expectedSkill: 0,
    expectedSkillObservable: 0,
    correctSkill: 0,
    falseNegative: 0,
    falseNegativeNone: 0,
    falseNegativeNonSkill: 0,
    wrongNeighbor: 0,
    expectedNonSkill: 0,
    expectedNonSkillObservable: 0,
    academicFalsePositive: 0,
    product: 0,
    productRouteObservable: 0,
    productAccepted: 0,
    productAcademicSkillRoute: 0,
    productWrongOperation: 0,
    suggestionApplicable: 0,
    suggestionObservable: 0,
    suggestionCorrect: 0,
    activationApplicable: 0,
    activationObservable: 0,
    activationConformant: 0,
    explicit: 0,
    explicitRouteObservable: 0,
    explicitRoute: 0,
    explicitArgumentsObserved: 0,
    explicitArgumentsExact: 0,
    explicitBypassObservable: 0,
    explicitBypassExact: 0,
    disclosureObserved: 0,
    disclosurePartial: 0,
    disclosureUnobservable: 0,
    disclosureExact: 0,
    disclosureFailed: 0
  };
  const categoryBuckets = new Map();
  const targetSkillBuckets = new Map();
  const expectedSkillBuckets = new Map();
  const explicitSkillBuckets = new Map();
  const confusion = new Map();
  const cases = [];
  const surface = clientSurface(document.suite.selector_profile);

  for (const observation of document.observations) {
    if (observedIds.has(observation.case_id)) throw new Error(`duplicate observation ${observation.case_id}`);
    if (matrixConstraint && !requiredIds.has(observation.case_id)) {
      throw new Error(`observation ${observation.case_id} is outside budget matrix row ${matrixConstraint.row.id}`);
    }
    observedIds.add(observation.case_id);
    const definition = definitions.get(observation.case_id);
    if (!definition) throw new Error(`unknown routing case ${observation.case_id}`);
    if (!definition.input_supported) {
      throw new Error(`${observation.case_id}: selector profile ${document.suite.selector_profile} does not support this native input`);
    }
    const expectedInputSha = sha256(Buffer.from(definition.input, 'utf8'));
    if (observation.input_sha256 !== expectedInputSha) {
      throw new Error(`routing input digest differs for ${observation.case_id}`);
    }
    if (observation.project_snapshot_sha256 !== suite.manifest.fixture.project_snapshot_sha256) {
      throw new Error(`routing project snapshot differs for ${observation.case_id}`);
    }
    if (sessionIds.has(observation.session_id)) {
      throw new Error(`case session isolation violated by reused session ${observation.session_id}`);
    }
    sessionIds.add(observation.session_id);

    const expectedRoute = definition.expected.route || definition.expected;
    const observedRoute = observation.route.value;
    const routeObservable = observation.route.signal !== 'unobservable' && observedRoute !== null;
    const skillAccepted = routeObservable && routeSkillAccepted(definition, observedRoute);
    const actionObservable = routeObservable && observation.route.granularity === 'action';
    const accepted = routeObservable
      ? actionObservable ? routeAccepted(definition, observedRoute) : skillAccepted
      : null;
    // A client such as Codex can natively prove only
    // { kind: "skill", action: null }. Complete that partial route from the
    // fixture oracle when the skill agrees; never attempt a null action lookup.
    // Fully observed routes (including an allowed implicit `none`) retain the
    // existing route-relative disclosure semantics.
    const disclosureRoute = observedRoute?.kind === 'skill' && observedRoute.action === null
      ? expectedRoute
      : observedRoute || expectedRoute;
    const expectedResources = canonicalResources(definition, disclosureRoute);
    const expectedCapabilities = canonicalCapabilities(definition, disclosureRoute);
    const expectedResourceKeys = new Set(expectedResources.map(item => `${item.kind}\0${item.path}`));
    const expectedCapabilityIds = new Set(expectedCapabilities);
    const disclosureContradiction = observation.disclosure.resources.some(item =>
      (item.status === 'loaded' && !expectedResourceKeys.has(`${item.kind}\0${item.path}`)) ||
      (item.status === 'not-loaded' && expectedResourceKeys.has(`${item.kind}\0${item.path}`))
    ) || observation.disclosure.capabilities.some(item =>
      (item.status === 'available' && !expectedCapabilityIds.has(item.id)) ||
      (item.status === 'unavailable' && expectedCapabilityIds.has(item.id))
    );
    let disclosureExact = null;
    if (observation.disclosure.status === 'observed') {
      counters.disclosureObserved += 1;
      disclosureExact = sameResources(expectedResources, observation.disclosure.resources) &&
        sameCapabilities(expectedCapabilities, observation.disclosure.capabilities) &&
        observation.disclosure.resources.every(item => item.status === 'loaded') &&
        observation.disclosure.capabilities.every(item => item.status === 'available');
      counters.disclosureExact += Number(disclosureExact);
      counters.disclosureFailed += Number(!disclosureExact);
    } else if (observation.disclosure.status === 'partially-observed') {
      counters.disclosurePartial += 1;
      disclosureExact = disclosureContradiction ? false : null;
      counters.disclosureFailed += Number(disclosureContradiction);
    } else {
      counters.disclosureUnobservable += 1;
      if (observation.disclosure.resources.some(item => item.status !== 'unobservable') ||
          observation.disclosure.capabilities.some(item => item.status !== 'unobservable')) {
        throw new Error(`${observation.case_id}: unobservable disclosure contains an asserted fact`);
      }
      disclosureExact = null;
    }

    const argumentObserved = observation.arguments.status === 'observed';
    const argumentExact = definition.explicit && argumentObserved
      ? observation.arguments.value === definition.arguments
      : null;
    if (definition.explicit) {
      counters.explicit += 1;
      counters.explicitRouteObservable += Number(actionObservable);
      counters.explicitRoute += Number(actionObservable && routeAccepted(definition, observedRoute));
      counters.explicitArgumentsObserved += Number(argumentObserved);
      counters.explicitArgumentsExact += Number(argumentExact === true);
      const bypassObservable = actionObservable && argumentObserved;
      const bypassExact = bypassObservable && accepted === true && argumentExact === true;
      counters.explicitBypassObservable += Number(bypassObservable);
      counters.explicitBypassExact += Number(bypassExact);
      incrementBucket(explicitSkillBuckets, definition.targetSkill || 'product-operation', bypassExact, bypassObservable);
    } else {
      counters.implicit += 1;
      counters.implicitRouteObservable += Number(routeObservable);
      counters.implicitAccepted += Number(accepted === true);
      counters.implicitActionObservable += Number(actionObservable);
      counters.implicitExact += Number(actionObservable && routeEqual(expectedRoute, observedRoute));
      incrementBucket(categoryBuckets, definition.category, accepted, routeObservable);
      if (definition.targetSkill) incrementBucket(targetSkillBuckets, definition.targetSkill, accepted, routeObservable);
      if (expectedRoute.kind === 'skill') {
        counters.expectedSkill += 1;
        const correctSkill = routeObservable && observedRoute.kind === 'skill' && observedRoute.skill === expectedRoute.skill;
        counters.expectedSkillObservable += Number(routeObservable);
        counters.correctSkill += Number(correctSkill);
        counters.falseNegative += Number(routeObservable && !correctSkill);
        counters.falseNegativeNone += Number(routeObservable && observedRoute.kind === 'none');
        counters.falseNegativeNonSkill += Number(routeObservable && observedRoute.kind !== 'skill');
        counters.wrongNeighbor += Number(routeObservable && observedRoute.kind === 'skill' && observedRoute.skill !== expectedRoute.skill);
        if (!expectedSkillBuckets.has(expectedRoute.skill)) {
          expectedSkillBuckets.set(expectedRoute.skill,
            { expected: 0, observable: 0, correct: 0, false_negative: 0, wrong_neighbor: 0 });
        }
        const bucket = expectedSkillBuckets.get(expectedRoute.skill);
        bucket.expected += 1;
        bucket.observable += Number(routeObservable);
        bucket.correct += Number(correctSkill);
        bucket.false_negative += Number(routeObservable && !correctSkill);
        bucket.wrong_neighbor += Number(routeObservable && observedRoute.kind === 'skill' && observedRoute.skill !== expectedRoute.skill);
      } else {
        counters.expectedNonSkill += 1;
        counters.expectedNonSkillObservable += Number(routeObservable);
        counters.academicFalsePositive += Number(routeObservable && observedRoute.kind === 'skill');
      }
      if (surface.implicit.expected_signal === 'suggested') {
        counters.suggestionApplicable += 1;
        counters.suggestionObservable += Number(routeObservable);
        const suggestionCorrect = expectedRoute.kind === 'skill'
          ? observation.route.signal === 'suggested' && skillAccepted
          : observation.route.signal === 'none' && skillAccepted;
        counters.suggestionCorrect += Number(routeObservable && suggestionCorrect);
      }
      if (expectedRoute.kind === 'skill' && surface.implicit.expected_activation !== 'unobservable') {
        counters.activationApplicable += 1;
        const activationObservable = observation.activation.status !== 'unobservable';
        const activationConformant = activationObservable &&
          observation.activation.status === surface.implicit.expected_activation &&
          (observation.activation.status !== 'loaded' || observation.activation.skill === expectedRoute.skill) &&
          (observation.activation.skill === null || observation.activation.skill === expectedRoute.skill);
        counters.activationObservable += Number(activationObservable);
        counters.activationConformant += Number(activationConformant);
      }
      if (definition.category === 'product-operation') {
        counters.product += 1;
        counters.productRouteObservable += Number(routeObservable);
        counters.productAccepted += Number(accepted === true);
        counters.productAcademicSkillRoute += Number(routeObservable && observedRoute.kind === 'skill');
        counters.productWrongOperation += Number(
          routeObservable && observedRoute.kind === 'operation' && observedRoute.action !== expectedRoute.action
        );
      }
    }

    const confusionKey = `${routeLabel(expectedRoute)}\0${routeLabel(observedRoute)}`;
    confusion.set(confusionKey, (confusion.get(confusionKey) || 0) + 1);
    cases.push({
      id: definition.id,
      mode: definition.explicit ? 'explicit' : 'implicit',
      category: definition.category,
      target_skill: definition.targetSkill,
      expected_route: routeLabel(expectedRoute),
      actual_route: routeLabel(observedRoute),
      route_acceptable: accepted,
      route_signal: observation.route.signal,
      route_granularity: observation.route.granularity,
      activation: observation.activation.status,
      activation_conformant: !definition.explicit && expectedRoute.kind === 'skill' &&
        surface.implicit.expected_activation !== 'unobservable' && observation.activation.status !== 'unobservable'
        ? observation.activation.status === surface.implicit.expected_activation &&
          (observation.activation.status !== 'loaded' || observation.activation.skill === expectedRoute.skill) &&
          (observation.activation.skill === null || observation.activation.skill === expectedRoute.skill)
        : null,
      selector: observation.selector.status,
      disclosure: observation.disclosure.status,
      disclosure_exact: disclosureExact,
      arguments_exact: definition.explicit ? argumentExact : null,
      claims: []
    });
    const currentCase = cases[cases.length - 1];
    const requiredClaims = matrixConstraint ? matrixConstraint.row.required_claims : [];
    currentCase.claims = requiredClaims.map(id => ({
      id,
      status: claimOutcome(id, definition, observation, surface, disclosureExact)
    }));
  }

  const missingRequired = [...requiredIds].filter(id => !observedIds.has(id)).sort();
  const unbudgetedMissing = [...definitions.keys()].filter(id => !observedIds.has(id)).sort();
  const claimSummaries = summarizeClaims(matrixConstraint ? matrixConstraint.row.required_claims : [], cases);
  const routeBySkill = [...expectedSkillBuckets.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([skill, bucket]) => ({
      skill,
      ...bucket,
      route_accuracy: rate(bucket.correct, bucket.observable),
      false_negative_rate: rate(bucket.false_negative, bucket.observable),
      wrong_neighbor_rate: rate(bucket.wrong_neighbor, bucket.observable)
    }));
  const claimFailure = claimSummaries.some(item => item.disposition === 'fail');
  const claimInconclusive = claimSummaries.some(item => item.disposition === 'inconclusive-capability');
  const routingFailures = matrixConstraint ? claimFailure :
    cases.some(item => item.route_acceptable === false || item.arguments_exact === false);
  const disclosureFailures = matrixConstraint ?
    claimSummaries.some(item => item.id === 'resources' && item.disposition === 'fail') :
    cases.some(item => item.disclosure_exact === false);
  const missingArgumentEvidence = counters.explicitArgumentsObserved !== counters.explicit;
  const completeForScope = missingRequired.length === 0;
  const disclosureInconclusive = matrixConstraint
    ? claimSummaries.some(item => item.id === 'resources' && item.disposition === 'inconclusive-capability')
    : counters.disclosurePartial + counters.disclosureUnobservable > 0;
  const routingHardFailure = routingFailures || !completeForScope;
  const disclosureHardFailure = disclosureFailures;
  const hardFailure = routingHardFailure || disclosureHardFailure;
  const identityInconclusive = matrixConstraint?.identityInconclusive === true;
  const capabilityInconclusive = matrixConstraint
    ? claimInconclusive || identityInconclusive
    : missingArgumentEvidence || disclosureInconclusive;
  const routingCapabilityInconclusive = matrixConstraint
    ? identityInconclusive || claimSummaries.some(item =>
      item.id !== 'resources' && item.disposition === 'inconclusive-capability')
    : missingArgumentEvidence;
  const routingDisposition = routingHardFailure
    ? 'fail'
    : routingCapabilityInconclusive ? 'inconclusive-capability' : 'pass';
  const disclosureDisposition = disclosureHardFailure
    ? 'fail'
    : disclosureInconclusive ? 'inconclusive-capability' : 'pass';
  const passing = !hardFailure && !capabilityInconclusive;

  const score = {
    schema: 'wtfp.evaluation.routing-score/v1',
    run: document.run,
    cost: document.cost,
    latency_ms: document.latency_ms,
    scope: matrixConstraint ? {
      kind: 'budget-matrix',
      matrix_id: matrixConstraint.matrix.id,
      matrix_version: matrixConstraint.matrix.version,
      row_id: matrixConstraint.row.id
    } : { kind: 'full-corpus' },
    required_claims: claimSummaries,
    counts: {
      definitions: definitions.size,
      required_for_scope: requiredIds.size,
      observed: observedIds.size,
      missing_for_scope: missingRequired.length,
      missing_from_full_corpus: unbudgetedMissing.length
    },
    implicit: {
      counts: {
        definitions: [...definitions.values()].filter(item => !item.explicit).length,
        observed: counters.implicit,
        route_observable: counters.implicitRouteObservable,
        accepted: counters.implicitAccepted,
        action_observable: counters.implicitActionObservable,
        exact_action: counters.implicitExact,
        expected_skill: counters.expectedSkill,
        observable_expected_skill: counters.expectedSkillObservable,
        correct_skill: counters.correctSkill,
        false_negative: counters.falseNegative,
        false_negative_none: counters.falseNegativeNone,
        false_negative_non_skill: counters.falseNegativeNonSkill,
        wrong_neighbor: counters.wrongNeighbor,
        expected_non_skill: counters.expectedNonSkill,
        observable_expected_non_skill: counters.expectedNonSkillObservable,
        academic_false_positive: counters.academicFalsePositive,
        suggestion_applicable: counters.suggestionApplicable,
        suggestion_observable: counters.suggestionObservable,
        suggestion_correct: counters.suggestionCorrect,
        activation_applicable: counters.activationApplicable,
        activation_observable: counters.activationObservable,
        activation_conformant: counters.activationConformant
      },
      metrics: {
        observable_route_accuracy: rate(counters.implicitAccepted, counters.implicitRouteObservable),
        observable_exact_action_rate: rate(counters.implicitExact, counters.implicitActionObservable),
        micro_skill_route_accuracy: rate(counters.correctSkill, counters.expectedSkillObservable),
        macro_skill_route_accuracy: mean(routeBySkill.map(item => item.route_accuracy)),
        false_positive_rate: rate(counters.academicFalsePositive, counters.expectedNonSkillObservable),
        false_negative_rate: rate(counters.falseNegative, counters.expectedSkillObservable),
        non_skill_false_negative_rate: rate(counters.falseNegativeNonSkill, counters.expectedSkillObservable),
        wrong_neighbor_route_rate: rate(counters.wrongNeighbor, counters.expectedSkillObservable),
        suggestion_accuracy: rate(counters.suggestionCorrect, counters.suggestionObservable),
        activation_state_conformance_rate: rate(counters.activationConformant, counters.activationObservable)
      },
      route_by_expected_skill: routeBySkill,
      per_target_skill: serializeBuckets(targetSkillBuckets, 'skill'),
      per_category: serializeBuckets(categoryBuckets, 'category'),
      product_operations: {
        observed: counters.product,
        route_observable: counters.productRouteObservable,
        accepted_none_or_matching_operation: counters.productAccepted,
        academic_skill_routes: counters.productAcademicSkillRoute,
        wrong_operations: counters.productWrongOperation,
        allowed_route_rate: rate(counters.productAccepted, counters.productRouteObservable),
        academic_skill_route_rate: rate(counters.productAcademicSkillRoute, counters.productRouteObservable)
      },
      confusion: [...confusion.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, count]) => {
        const [expected, actual] = key.split('\0');
        return { expected, actual, count };
      })
    },
    explicit: {
      counts: {
        definitions: [...definitions.values()].filter(item => item.explicit).length,
        observed: counters.explicit,
        route_observable: counters.explicitRouteObservable,
        route_exact: counters.explicitRoute,
        arguments_observed: counters.explicitArgumentsObserved,
        arguments_exact: counters.explicitArgumentsExact,
        bypass_observable: counters.explicitBypassObservable,
        bypass_exact: counters.explicitBypassExact
      },
      metrics: {
        observable_action_accuracy: rate(counters.explicitRoute, counters.explicitRouteObservable),
        observable_argument_accuracy: rate(counters.explicitArgumentsExact, counters.explicitArgumentsObserved),
        observable_bypass_accuracy: rate(counters.explicitBypassExact, counters.explicitBypassObservable)
      },
      per_owner: serializeBuckets(explicitSkillBuckets, 'owner')
    },
    progressive_disclosure: {
      observed: counters.disclosureObserved,
      partially_observed: counters.disclosurePartial,
      unobservable: counters.disclosureUnobservable,
      exact: counters.disclosureExact,
      failed: counters.disclosureFailed,
      exact_rate_among_observable: rate(counters.disclosureExact, counters.disclosureObserved),
      capability_inconclusive: disclosureInconclusive
    },
    routing_disposition: routingDisposition,
    disclosure_disposition: disclosureDisposition,
    disposition: hardFailure ? 'fail' : capabilityInconclusive ? 'inconclusive-capability' : 'pass',
    passing,
    complete_for_scope: completeForScope,
    missing_cases: missingRequired,
    cases
  };
  const scoreErrors = validateAgainst(score, 'routing-score.schema.json');
  if (scoreErrors.length > 0) throw new Error(`routing score schema failed:\n${scoreErrors.join('\n')}`);
  return score;
}

function usage() {
  return 'Usage: node evaluation/tools/score-routing.js [--matrix-row <row-id>] <observations.json>';
}

function main(argv = process.argv.slice(2)) {
  const matrixIndex = argv.indexOf('--matrix-row');
  let matrixRow = null;
  const files = [...argv];
  if (matrixIndex !== -1) {
    matrixRow = argv[matrixIndex + 1] || null;
    files.splice(matrixIndex, 2);
  }
  if (argv.includes('--allow-partial')) {
    process.stderr.write('routing scoring failed: --allow-partial is unsafe; use --matrix-row with a checked-in budget row\n');
    return 2;
  }
  if (files.length !== 1 || (matrixIndex !== -1 && !matrixRow)) {
    process.stderr.write(`${usage()}\n`);
    return 2;
  }
  try {
    const inputFile = path.resolve(files[0]);
    const score = scoreObservations(readJson(inputFile), {
      matrixRow,
      evidenceRoot: path.dirname(inputFile)
    });
    process.stdout.write(`${JSON.stringify(score, null, 2)}\n`);
    if (score.disposition === 'pass') return 0;
    if (score.disposition === 'inconclusive-capability') return 3;
    return 1;
  } catch (error) {
    process.stderr.write(`routing scoring failed: ${error.message}\n`);
    return 2;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  canonicalCapabilities,
  canonicalResources,
  clientSurface,
  definitionCatalog,
  main,
  materializeNativeInput,
  projectSchemasForAction,
  routeAccepted,
  routeEqual,
  scoreObservations,
  validateObservationDocument
};
