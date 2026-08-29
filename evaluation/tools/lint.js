#!/usr/bin/env node

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { GENERATOR_VERSION } = require('../../bin/lib/adapter-metadata');
const { SchemaRegistry, readJson, validateInstance } = require('../lib/json-schema');
const { compareResults, validateResultIntegrity } = require('./compare-results');
const { checkFixture } = require('./hash-fixtures');
const {
  canonicalCapabilities,
  canonicalResources,
  definitionCatalog,
  materializeNativeInput
} = require('./score-routing');

const repositoryRoot = path.resolve(__dirname, '../..');
const evaluationRoot = path.join(repositoryRoot, 'evaluation');
const versionRoot = path.join(evaluationRoot, 'v1');
const schemasRoot = path.join(versionRoot, 'schemas');
const fixtureRoot = path.join(versionRoot, 'fixtures', 'hpc-checkpointing');
const matrixPath = path.join(versionRoot, 'matrix', 'budget.json');
const routingContextPath = path.join(versionRoot, 'routing', 'context.json');
const routingManifestPath = path.join(versionRoot, 'routing', 'manifest.json');
const clientSurfacesPath = path.join(versionRoot, 'routing', 'client-surfaces.json');

const REQUIRED_CATEGORIES = Object.freeze([
  'clear-positive',
  'paraphrase-positive',
  'boundary-near-miss',
  'explicit-negative',
  'expected-neighbor'
]);

function sorted(values) {
  return [...values].sort();
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function schemaRegistry() {
  const files = fs.readdirSync(schemasRoot)
    .filter(name => name.endsWith('.schema.json'))
    .map(name => path.join(schemasRoot, name));
  return new SchemaRegistry(files);
}

function assertSchemaValid(file, schemaName, registry) {
  const schemaFile = path.join(schemasRoot, schemaName);
  const errors = validateInstance(readJson(file), registry.get(schemaFile), schemaFile, registry);
  assert.deepStrictEqual(errors, [], `${path.relative(repositoryRoot, file)} failed ${schemaName}:\n${errors.join('\n')}`);
}

function loadCatalog() {
  const catalog = readJson(path.join(repositoryRoot, 'protocol', 'catalog.json'));
  const ownership = new Map();
  for (const skill of catalog.skills) {
    for (const action of skill.actions) {
      assert(!ownership.has(action), `${action} appears in more than one canonical skill`);
      ownership.set(action, { kind: 'skill', skill: skill.id });
    }
  }
  for (const action of catalog.operations.actions) ownership.set(action, { kind: 'operation' });
  return { catalog, ownership };
}

function assertRoute(route, ownership, label) {
  if (route.kind === 'none') return;
  assert(ownership.has(route.action), `${label}: unknown action ${route.action}`);
  const canonical = ownership.get(route.action);
  assert.strictEqual(route.kind, canonical.kind, `${label}: ${route.action} has wrong route kind`);
  if (route.kind === 'skill') {
    assert.strictEqual(route.skill, canonical.skill, `${label}: ${route.action} has wrong owning skill`);
  }
}

function assertDisclosure(testCase, ownership) {
  const route = testCase.expected.route;
  const selection = testCase.expected.selection_binding;
  if (route.kind === 'none') {
    assert.strictEqual(selection.skill_selector, null, `${testCase.id}: no-route case selected a skill`);
    assert.deepStrictEqual(selection.action_contract_selectors, [], `${testCase.id}: no-route case selected an action`);
    assert.deepStrictEqual(canonicalResources({ expected: testCase.expected }), []);
    assert.deepStrictEqual(canonicalCapabilities({ expected: testCase.expected }), []);
    return;
  }
  assert.deepStrictEqual(
    selection.action_contract_selectors,
    [`protocol/actions/${route.action}.json`],
    `${testCase.id}: selection must identify exactly one action contract`
  );
  if (route.kind === 'skill') {
    assert.strictEqual(
      selection.skill_selector,
      `protocol/skills/${route.skill}/SKILL.md`,
      `${testCase.id}: selection must identify exactly the owning skill`
    );
  } else {
    assert.strictEqual(selection.skill_selector, null, `${testCase.id}: product operation must not select a skill`);
    assert.strictEqual(ownership.get(route.action).kind, 'operation');
  }
  const closure = canonicalResources({ expected: testCase.expected });
  assert(closure.some(item => item.kind === 'action-contract' && item.path === `protocol/actions/${route.action}.json`));
  assert(closure.some(item => item.kind === 'workflow' && item.path === `protocol/workflows/${route.action}.md`));
  if (route.kind === 'skill') {
    assert(closure.some(item => item.kind === 'action-reference' &&
      item.path === `protocol/skills/${route.skill}/references/actions.md`));
  }
  for (const item of closure) {
    assert(fs.statSync(path.join(repositoryRoot, item.path)).isFile(), `${testCase.id}: missing closure resource ${item.path}`);
  }
}

function lintRouting(cases, ownership, canonicalSkills, operations) {
  const ids = cases.map(testCase => testCase.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'routing case ids must be unique');
  const byTarget = new Map(canonicalSkills.map(skill => [skill, []]));
  const productCases = [];

  for (const testCase of cases) {
    assertRoute(testCase.expected.route, ownership, testCase.id);
    assertDisclosure(testCase, ownership);
    const targetTag = testCase.tags.find(tag => tag.startsWith('target-'));
    if (testCase.category === 'product-operation') {
      productCases.push(testCase);
      assert.strictEqual(targetTag, undefined, `${testCase.id}: product operation must not target an academic skill`);
      assert.strictEqual(testCase.expected.route.kind, 'operation', `${testCase.id}: product case must route to operation`);
      continue;
    }
    assert(targetTag, `${testCase.id}: academic boundary case is missing its target skill tag`);
    const target = targetTag.slice('target-'.length);
    assert(byTarget.has(target), `${testCase.id}: unknown target skill ${target}`);
    byTarget.get(target).push(testCase);

    if (['clear-positive', 'paraphrase-positive'].includes(testCase.category)) {
      assert.strictEqual(testCase.expected.route.kind, 'skill', `${testCase.id}: positive case must activate a skill`);
      assert.strictEqual(testCase.expected.route.skill, target, `${testCase.id}: positive case activated wrong skill`);
    } else if (['boundary-near-miss', 'explicit-negative'].includes(testCase.category)) {
      assert.strictEqual(testCase.expected.route.kind, 'none', `${testCase.id}: negative case must not activate`);
    } else if (testCase.category === 'expected-neighbor') {
      assert.strictEqual(testCase.expected.route.kind, 'skill', `${testCase.id}: neighbor case must activate a skill`);
      assert.notStrictEqual(testCase.expected.route.skill, target, `${testCase.id}: neighbor case activated its boundary target`);
    }
  }

  for (const [skill, skillCases] of byTarget) {
    assert.deepStrictEqual(
      sorted(skillCases.map(testCase => testCase.category)),
      sorted(REQUIRED_CATEGORIES),
      `${skill}: routing corpus must contain exactly one case in every required category`
    );
  }
  assert.deepStrictEqual(
    sorted(productCases.map(testCase => testCase.expected.route.action)),
    sorted(operations),
    'routing corpus must cover exactly the five product operations'
  );
}

function lintExplicitActions(explicit, ownership, actionIds) {
  const ids = explicit.actions.map(action => action.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'explicit action ids must be unique');
  assert.deepStrictEqual(sorted(ids), sorted(actionIds), 'explicit suite must cover every canonical action exactly once');

  for (const action of explicit.actions) {
    assert.strictEqual(
      action.invocation,
      `/wtfp:${action.id}${action.arguments.length > 0 ? ` ${action.arguments}` : ''}`,
      `${action.id}: invocation must preserve exact argument bytes after the command separator`
    );
    assert.strictEqual(action.expected.action, action.id, `${action.id}: explicit route changed the action id`);
    assertRoute(action.expected, ownership, `explicit-${action.id}`);
  }
  assert(explicit.actions.some(action =>
    action.arguments.includes('"') && action.arguments.includes('  ') &&
    action.arguments.startsWith(' ') && action.arguments.endsWith('  ') &&
    action.arguments.includes('\t') && action.arguments.includes('\n') &&
    action.arguments.includes('$1') && action.arguments.includes('$@')
  ), 'explicit routing corpus must exercise quotes, meaningful surrounding/repeated spaces, tabs, newlines, and literal dollar tokens');
  assert(explicit.actions.some(action => action.arguments.length === 0),
    'explicit routing corpus must exercise a command with no arguments');
}

function lintBaselineEvidenceState(baseline, registry, evidenceRoot = evaluationRoot) {
  if (baseline.evidence_status === 'definition-only') {
    assert.deepStrictEqual(baseline.observed_runs, [], 'definition-only baseline cannot cite observed run files');
    return;
  }
  assert.strictEqual(baseline.evidence_status, 'observed');
  assert(baseline.observed_runs.length > 0, 'observed baseline must cite at least one run');
  for (const relative of baseline.observed_runs) {
    const file = path.resolve(evidenceRoot, relative);
    assert(file.startsWith(`${evidenceRoot}${path.sep}`), `observed run escapes evaluation root: ${relative}`);
    assert(fs.statSync(file).isFile(), `observed run is missing: ${relative}`);
    const schemaFile = path.join(schemasRoot, 'result.schema.json');
    const result = readJson(file);
    const errors = validateInstance(result, registry.get(schemaFile), schemaFile, registry);
    assert.deepStrictEqual(errors, [], `${relative} is not a valid observed result:\n${errors.join('\n')}`);
    validateResultIntegrity(result, relative);
    assert.strictEqual(compareResults(baseline, result, {
      evidenceRoot: path.dirname(file),
      requireEvidenceFiles: true
    }).disposition, 'meets-baseline',
      `${relative} does not meet the declared observed baseline`);
  }
}

function lintFixtureAndBaseline(rubric, expected, baseline, registry) {
  const fixture = readJson(path.join(fixtureRoot, 'fixture.json'));
  const decisions = readJson(path.join(fixtureRoot, 'author-decisions.json'));
  const manifest = readJson(path.join(fixtureRoot, 'manifest.json'));
  const hashCheck = checkFixture(fixtureRoot);
  assert(hashCheck.valid, hashCheck.reason);

  assert.strictEqual(expected.fixture_id, fixture.id);
  assert.strictEqual(expected.fixture_version, fixture.version);
  assert.strictEqual(manifest.fixture_id, fixture.id);
  assert.strictEqual(manifest.fixture_version, fixture.version);
  assert.strictEqual(baseline.fixture.id, fixture.id);
  assert.strictEqual(baseline.fixture.version, fixture.version);
  assert.strictEqual(baseline.fixture.model_inputs_sha256, manifest.model_inputs_sha256,
    'baseline must bind exact model-visible input bytes');
  assert.strictEqual(baseline.fixture.evaluator_oracles_sha256, manifest.evaluator_oracles_sha256,
    'baseline must bind exact evaluator-only oracle bytes');
  assert.strictEqual(baseline.fixture.aggregate_sha256, manifest.aggregate_sha256,
    'baseline must bind the complete fixture inventory');
  assert.strictEqual(baseline.scenario.oracle_sha256, manifest.evaluator_oracles_sha256,
    'scenario must bind the evaluator-only oracle without exposing it to the model');
  assert.deepStrictEqual(baseline.scenario.action_sequence, expected.action_sequence,
    'baseline must bind the complete ordered lifecycle sequence');
  assert.deepStrictEqual(baseline.scenario.required_process_boundaries, [{
    after_action: 'pause-writing',
    fresh_process: true
  }], 'baseline must require a fresh process after pause-writing');
  assert.strictEqual(baseline.protocol.adapter_compiler_version, GENERATOR_VERSION);
  assert.strictEqual(
    baseline.protocol.canonical_source_sha256,
    readJson(path.join(repositoryRoot, 'vendors', 'clio', '.wtfp-generated.json')).sourceHash,
    'baseline must bind the exact compiler-v4 canonical source hash'
  );
  lintBaselineEvidenceState(baseline, registry);

  for (const input of [...fixture.model_visible_inputs, ...fixture.evaluator_only_oracles]) {
    assert(fs.statSync(path.join(fixtureRoot, input.path)).isFile(), `fixture input is missing: ${input.path}`);
  }
  const modelPaths = new Set(fixture.model_visible_inputs.map(input => input.path));
  for (const oracle of fixture.evaluator_only_oracles) {
    assert(!modelPaths.has(oracle.path), `evaluator oracle is model-visible: ${oracle.path}`);
  }
  assert.deepStrictEqual(decisions.items, expected.decisions, 'fixture decisions and expected decisions drifted');

  const rubricIds = rubric.dimensions.map(dimension => dimension.id);
  const expectedIds = expected.invariants.map(invariant => invariant.id);
  const baselineIds = baseline.expected_invariants.map(invariant => invariant.id);
  assert.strictEqual(new Set(rubricIds).size, rubricIds.length, 'rubric dimension ids must be unique');
  const globalAnchorIds = new Set();
  for (const dimension of rubric.dimensions) {
    const anchorIds = dimension.anchors.map(anchor => anchor.id);
    assert.strictEqual(new Set(anchorIds).size, anchorIds.length,
      `${dimension.id}: rubric anchor ids must be unique`);
    const weight = dimension.anchors.reduce((total, anchor) => total + anchor.weight, 0);
    assert(Math.abs(weight - 1) < Number.EPSILON * 16,
      `${dimension.id}: rubric anchor weights must sum to one`);
    for (const anchorId of anchorIds) {
      assert(!globalAnchorIds.has(anchorId), `rubric anchor id is reused across dimensions: ${anchorId}`);
      globalAnchorIds.add(anchorId);
    }
  }
  assert.deepStrictEqual(sorted(expectedIds), sorted(rubricIds), 'fixture invariants must match the semantic rubric');
  assert.deepStrictEqual(sorted(baselineIds), sorted(rubricIds), 'baseline invariants must match the semantic rubric');
  const rubricClasses = new Map(rubric.dimensions.map(dimension => [dimension.id, dimension.class]));
  for (const dimension of rubric.dimensions.filter(item => item.measurement === 'rate')) {
    assert(dimension.raw_metric, `${dimension.id}: rate dimension must define its raw metric`);
  }
  for (const invariant of baseline.expected_invariants) {
    assert.strictEqual(invariant.class, rubricClasses.get(invariant.id), `${invariant.id}: baseline class drifted from rubric`);
    const expectedPhase = expected.invariants.find(item => item.id === invariant.id).phase;
    assert.deepStrictEqual(invariant.phases, [expectedPhase], `${invariant.id}: baseline phase drifted from fixture oracle`);
  }
  const unsupported = baseline.expected_invariants.find(invariant => invariant.id === 'unsupported-claim-rate');
  assert.strictEqual(unsupported.maximum_observed_value, 0, 'unsupported-claim baseline must require a literal zero rate');
}

function containedPath(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function lintCompletedRoutingResult(matrix, row, resultRoot, registry) {
  assert(row.result, `${row.id}: completed row requires a result binding`);
  assert.strictEqual(row.result.row_id, row.id, `${row.id}: completed result binding row id differs`);
  const root = fs.realpathSync(resultRoot);
  const file = path.resolve(resultRoot, row.result.path);
  assert(containedPath(resultRoot, file), `${row.id}: completed result escapes its evidence root`);
  const stat = fs.lstatSync(file);
  assert(!stat.isSymbolicLink() && stat.isFile(), `${row.id}: completed result must be a regular non-symlink file`);
  assert(containedPath(root, fs.realpathSync(file)), `${row.id}: completed result resolves outside its evidence root`);
  assert.strictEqual(sha256(fs.readFileSync(file)), row.result.sha256,
    `${row.id}: completed result digest differs`);
  const score = readJson(file);
  assert.strictEqual(score.schema, row.result.schema, `${row.id}: completed result schema differs`);
  const schemaFile = path.join(schemasRoot, 'routing-score.schema.json');
  const errors = validateInstance(score, registry.get(schemaFile), schemaFile, registry);
  assert.deepStrictEqual(errors, [], `${row.id}: completed routing score is invalid:\n${errors.join('\n')}`);
  assert.strictEqual(score.run.id, row.result.run_id, `${row.id}: completed result run id differs`);
  assert.strictEqual(score.scope.kind, 'budget-matrix', `${row.id}: completed result is not matrix-scoped`);
  assert.strictEqual(score.scope.matrix_id, matrix.id, `${row.id}: completed result matrix id differs`);
  assert.strictEqual(score.scope.matrix_version, matrix.version, `${row.id}: completed result matrix version differs`);
  assert.strictEqual(score.scope.row_id, row.id, `${row.id}: completed result score row differs`);
  assert.strictEqual(score.run.matrix_binding.row_id, row.id, `${row.id}: completed result run binding differs`);
  assert.strictEqual(score.complete_for_scope, true, `${row.id}: completed result does not cover its exact case scope`);
}

function lintBudgetMatrix(matrix, definitions, canonicalSkills, resultRoot = evaluationRoot, registry = schemaRegistry()) {
  const ids = matrix.rows.map(row => row.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'budget matrix row ids must be unique');
  for (const row of matrix.rows) {
    assert.strictEqual(row.allow_substitution, false, `${row.id}: silent version substitution must remain forbidden`);
    assert(row.maximum_paid_cases >= row.case_ids.length,
      `${row.id}: paid-case ceiling is smaller than the exact case set`);
    for (const caseId of row.case_ids) assert(definitions.has(caseId), `${row.id}: unknown routing case ${caseId}`);
    if (row.selector_profile !== null) {
      assert(['claude', 'codex', 'clio'].includes(row.selector_profile), `${row.id}: unknown selector profile`);
    }
    if (row.cost_policy.status === 'unavailable') assert.strictEqual(row.cost_policy.maximum_usd, null,
      `${row.id}: unavailable cost cannot claim a USD ceiling`);
    if (['unavailable', 'skipped'].includes(row.status)) {
      assert(row.reason, `${row.id}: ${row.status} row needs an explicit reason`);
      assert.strictEqual(row.case_ids.length, 0, `${row.id}: ${row.status} row cannot imply unobserved coverage`);
      assert.strictEqual(row.maximum_paid_cases, 0, `${row.id}: non-executed row cannot reserve paid cases`);
      assert.strictEqual(row.study_kind, row.status === 'unavailable' ? 'unavailable-target' : 'native-static-only',
        `${row.id}: non-executed study kind is misleading`);
    }
    if (row.status === 'completed') lintCompletedRoutingResult(matrix, row, resultRoot, registry);
    else assert(!Object.prototype.hasOwnProperty.call(row, 'result'),
      `${row.id}: only a completed row may bind a result`);
  }
  for (const client of ['Claude Code', 'Codex CLI', 'Clio Coder']) {
    assert(matrix.rows.some(row => row.client.name === client && ['planned', 'completed'].includes(row.status)),
      `budget matrix is missing a planned or completed primary row for ${client}`);
  }
  const codexPrimary = matrix.rows.find(row => row.id === 'codex-gpt54-primary');
  assert.strictEqual(codexPrimary.study_kind, 'capability-and-behavior',
    'Codex primary must remain a capability/behavior study');
  assert(/not native activation evidence/iu.test(codexPrimary.evidence_interpretation),
    'Codex primary must explicitly disclaim native activation evidence');
  assert(!codexPrimary.required_claims.includes('activation'),
    'Codex primary cannot require an unobservable native activation claim');
  for (const row of matrix.rows.filter(item => ['claude-sonnet-primary', 'clio-terra-primary'].includes(item.id))) {
    assert.strictEqual(row.study_kind, 'routing-behavior', `${row.id}: primary routing study kind changed`);
  }
  assert(matrix.rows.some(row => row.status === 'unavailable'), 'budget matrix must preserve unavailable targets explicitly');
  assert(matrix.rows.some(row => row.status === 'skipped'), 'budget matrix must preserve deliberately skipped targets explicitly');

  const primaryRows = matrix.rows.filter(row => ['planned', 'completed'].includes(row.status) &&
    ['Claude Code', 'Codex CLI', 'Clio Coder'].includes(row.client.name));
  const sharedCore = primaryRows[0].case_ids;
  for (const row of primaryRows) {
    assert.deepStrictEqual(row.case_ids, sharedCore,
      `${row.id}: primary paid rows must use the same ordered cases for cross-client comparison`);
    const selected = row.case_ids.map(id => definitions.get(id));
    assert.strictEqual(row.maximum_paid_cases, row.case_ids.length,
      `${row.id}: primary paid row must bind one paid process per exact case`);
    const implicitSkills = new Set(selected.filter(item => !item.explicit && item.expected.kind === 'skill')
      .map(item => item.expected.skill));
    const explicitSkills = new Set(selected.filter(item => item.explicit && item.expected.kind === 'skill')
      .map(item => item.expected.skill));
    assert.deepStrictEqual(sorted(implicitSkills), sorted(canonicalSkills),
      `${row.id}: paid implicit core must exercise every academic skill`);
    assert.deepStrictEqual(sorted(explicitSkills), sorted(canonicalSkills),
      `${row.id}: paid explicit core must exercise every academic skill`);
    for (const category of ['boundary-near-miss', 'explicit-negative', 'expected-neighbor', 'product-operation']) {
      assert(selected.some(item => item.category === category), `${row.id}: paid core is missing ${category}`);
    }
  }
}

function lintClientSurfaces(surfaces, explicit) {
  assert.deepStrictEqual(surfaces.targets.map(item => item.target), ['claude', 'codex', 'clio'],
    'routing selector profiles must remain ordered and exact');
  const definitions = definitionCatalog();
  for (const target of surfaces.targets.map(item => item.target)) {
    for (const testCase of readJson(path.join(versionRoot, 'routing', 'cases.json')).cases) {
      assert.strictEqual(materializeNativeInput(definitions.get(testCase.id), target), testCase.prompt,
        `${target}/${testCase.id}: implicit input bytes changed`);
    }
    for (const action of explicit.actions) {
      const input = materializeNativeInput(definitions.get(`explicit-${action.id}`), target);
      if (target === 'codex' && action.expected.kind === 'operation') {
        assert.strictEqual(input, null, `${target}/${action.id}: unsupported operation acquired a selector`);
      } else if (target === 'codex') {
        assert.strictEqual(input,
          `$wtf-p:${action.expected.skill} ${action.id}${action.arguments.length > 0 ? ` ${action.arguments}` : ''}`,
          `${target}/${action.id}: native skill mention changed bytes`);
      } else {
        assert.strictEqual(input, action.invocation, `${target}/${action.id}: native action command changed bytes`);
      }
    }
  }
}

function lintRoutingManifest(manifest) {
  const expectedCorpora = [
    'evaluation/v1/routing/cases.json',
    'evaluation/v1/routing/explicit-actions.json',
    'evaluation/v1/matrix/budget.json'
  ];
  assert.deepStrictEqual(manifest.corpora.map(item => item.path), expectedCorpora,
    'routing manifest corpus inventory changed');
  for (const item of manifest.corpora) {
    assert.strictEqual(sha256(fs.readFileSync(path.join(repositoryRoot, item.path))), item.sha256,
      `routing manifest digest changed for ${item.path}`);
  }
  const contextSha = sha256(fs.readFileSync(routingContextPath));
  const casesSha = manifest.corpora.find(item => item.path.endsWith('/cases.json')).sha256;
  const explicitSha = manifest.corpora.find(item => item.path.endsWith('/explicit-actions.json')).sha256;
  const surfacesSha = sha256(fs.readFileSync(clientSurfacesPath));
  assert.strictEqual(manifest.fixture.model_inputs_sha256, contextSha,
    'routing fixture model-input digest changed');
  assert.strictEqual(manifest.fixture.evaluator_oracles_sha256,
    sha256(Buffer.from(`${casesSha}\n${explicitSha}\n${surfacesSha}`)), 'routing fixture oracle digest changed');
  assert.strictEqual(manifest.fixture.aggregate_sha256,
    sha256(Buffer.from(`${contextSha}\n${casesSha}\n${explicitSha}\n${surfacesSha}`)), 'routing fixture aggregate digest changed');
  assert.strictEqual(manifest.fixture.project_snapshot_sha256, sha256(Buffer.from('[]')),
    'routing project must begin with the defined empty snapshot');
  assert.strictEqual(manifest.project_protocol_version, 1);
  assert.strictEqual(manifest.adapter_compiler_version, GENERATOR_VERSION);

  const expectedEnvelopePaths = [
    'vendors/antigravity/.wtfp-generated.json',
    'vendors/claude/.wtfp-generated.json',
    'vendors/clio/.wtfp-generated.json',
    'vendors/codex/.wtfp-generated.json',
    'vendors/codex/plugins/wtf-p/.wtfp-generated.json',
    'vendors/copilot/.wtfp-generated.json',
    'vendors/copilot/plugins/wtf-p/.wtfp-generated.json',
    'vendors/gemini/.wtfp-generated.json',
    'vendors/opencode/.wtfp-generated.json'
  ];
  assert.deepStrictEqual(manifest.generated_envelopes.map(item => item.path), expectedEnvelopePaths,
    'routing manifest must bind all nine generated envelopes');
  assert.strictEqual(new Set(manifest.generated_envelopes.map(item => item.target)).size, 9,
    'routing manifest target ids must be unique');
  for (const item of manifest.generated_envelopes) {
    const file = path.join(repositoryRoot, item.path);
    assert.strictEqual(sha256(fs.readFileSync(file)), item.manifest_sha256,
      `generated envelope inventory changed for ${item.target}`);
    assert.strictEqual(readJson(file).sourceHash, item.source_sha256,
      `generated envelope source hash changed for ${item.target}`);
  }
}

function lintEvaluation() {
  const registry = schemaRegistry();
  const schemaIds = new Set();
  for (const name of fs.readdirSync(schemasRoot).filter(name => name.endsWith('.schema.json')).sort()) {
    const schema = readJson(path.join(schemasRoot, name));
    assert.strictEqual(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', `${name}: wrong dialect`);
    assert(schema.$id, `${name}: missing schema id`);
    assert(!schemaIds.has(schema.$id), `${name}: duplicate schema id ${schema.$id}`);
    schemaIds.add(schema.$id);
  }

  const casesPath = path.join(versionRoot, 'routing', 'cases.json');
  const explicitPath = path.join(versionRoot, 'routing', 'explicit-actions.json');
  const rubricPath = path.join(versionRoot, 'rubrics', 'semantic-rubric.json');
  const fixturePath = path.join(fixtureRoot, 'fixture.json');
  const expectedPath = path.join(fixtureRoot, 'expected-invariants.json');
  const manifestPath = path.join(fixtureRoot, 'manifest.json');
  const baselinePath = path.join(versionRoot, 'baselines', 'hpc-checkpointing.json');

  assertSchemaValid(casesPath, 'routing-cases.schema.json', registry);
  assertSchemaValid(explicitPath, 'explicit-actions.schema.json', registry);
  assertSchemaValid(rubricPath, 'semantic-rubric.schema.json', registry);
  assertSchemaValid(fixturePath, 'fixture.schema.json', registry);
  assertSchemaValid(expectedPath, 'expected-invariants.schema.json', registry);
  assertSchemaValid(manifestPath, 'fixture-hashes.schema.json', registry);
  assertSchemaValid(baselinePath, 'baseline.schema.json', registry);
  assertSchemaValid(matrixPath, 'budget-matrix.schema.json', registry);
  assertSchemaValid(routingContextPath, 'routing-context.schema.json', registry);
  assertSchemaValid(routingManifestPath, 'routing-manifest.schema.json', registry);
  assertSchemaValid(clientSurfacesPath, 'client-routing-surfaces.schema.json', registry);

  const { catalog, ownership } = loadCatalog();
  const canonicalSkills = catalog.skills.map(skill => skill.id);
  const actionIds = catalog.actions.map(action => action.id);
  const cases = readJson(casesPath).cases;
  const explicit = readJson(explicitPath);
  const rubric = readJson(rubricPath);
  const expected = readJson(expectedPath);
  const baseline = readJson(baselinePath);
  const matrix = readJson(matrixPath);
  const routingManifest = readJson(routingManifestPath);
  const clientSurfaces = readJson(clientSurfacesPath);

  assert.strictEqual(catalog.counts.skills, canonicalSkills.length);
  assert.strictEqual(catalog.counts.actions, actionIds.length);
  assert.strictEqual(catalog.counts.operations, catalog.operations.actions.length);
  lintRouting(cases, ownership, canonicalSkills, catalog.operations.actions);
  lintExplicitActions(explicit, ownership, actionIds);
  lintClientSurfaces(clientSurfaces, explicit);
  lintFixtureAndBaseline(rubric, expected, baseline, registry);
  const matrixDefinitions = new Map([
    ...cases.map(testCase => [testCase.id, {
      explicit: false,
      category: testCase.category,
      expected: testCase.expected.route
    }]),
    ...explicit.actions.map(action => [`explicit-${action.id}`, {
      explicit: true,
      category: 'explicit-action',
      expected: action.expected
    }])
  ]);
  lintBudgetMatrix(matrix, matrixDefinitions, canonicalSkills);
  lintRoutingManifest(routingManifest);

  return {
    schemas: schemaIds.size,
    routingCases: cases.length,
    explicitActions: explicit.actions.length,
    skills: canonicalSkills.length,
    operations: catalog.operations.actions.length,
    rubricDimensions: rubric.dimensions.length,
    fixtureFiles: readJson(manifestPath).files.length,
    matrixRows: matrix.rows.length
  };
}

function main() {
  try {
    const counts = lintEvaluation();
    console.log(`✓ validated ${counts.schemas} evaluation data schemas`);
    console.log(`✓ linted ${counts.routingCases} routing cases across ${counts.skills} skills and ${counts.operations} operations`);
    console.log(`✓ mapped ${counts.explicitActions} explicit actions with exact argument and ownership contracts`);
    console.log(`✓ bound ${counts.rubricDimensions} semantic invariants to ${counts.fixtureFiles} hashed fixture files`);
    console.log(`✓ constrained paid and unavailable evidence to ${counts.matrixRows} exact budget-matrix rows`);
    return 0;
  } catch (error) {
    console.error(error.stack || error.message);
    return 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  lintEvaluation,
  lintBaselineEvidenceState,
  lintBudgetMatrix,
  lintExplicitActions,
  lintRouting,
  schemaRegistry
};
