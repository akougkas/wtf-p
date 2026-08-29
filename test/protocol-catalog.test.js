#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const protocolRoot = path.join(root, 'protocol');

function load(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function assertSorted(values, label) {
  assert.deepStrictEqual(values, sorted(values), `${label} must be sorted`);
}

function assertUnique(values, label) {
  assert.strictEqual(new Set(values).size, values.length, `${label} must not contain duplicates`);
}

function resolveProtocolUri(uri) {
  assert.ok(uri.startsWith('protocol://'), `not a protocol URI: ${uri}`);
  return path.join(protocolRoot, uri.slice('protocol://'.length));
}

const catalog = load('protocol/catalog.json');
const aliases = load('protocol/aliases.lock.json');
const effectsRegistry = load('protocol/effects.json');
const toolsRegistry = load('protocol/tools.json');
const toolsSchema = load('protocol/schemas/tools.schema.json');

const workflowIds = sorted(
  fs.readdirSync(path.join(protocolRoot, 'workflows'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.basename(name, '.md'))
);
const catalogIds = catalog.actions.map((action) => action.id);

assert.strictEqual(catalog.schema, 'wtfp.catalog/v1');
assert.deepStrictEqual(catalog.counts, {
  actions: 36,
  domainActions: 31,
  operations: 5,
  skills: 7,
});
assert.strictEqual(workflowIds.length, 36, 'canonical workflow baseline changed; migrate the catalog deliberately');
assert.deepStrictEqual(catalogIds, workflowIds, 'catalog IDs must exactly preserve the 36 stable workflow IDs');
assertSorted(catalogIds, 'catalog actions');
assertUnique(catalogIds, 'catalog actions');

const expectedSkills = [
  'wtfp-deliver-research',
  'wtfp-manage-project',
  'wtfp-plan-section',
  'wtfp-research-literature',
  'wtfp-review-manuscript',
  'wtfp-start-project',
  'wtfp-write-section',
];
const skillIds = catalog.skills.map((skill) => skill.id);
assert.deepStrictEqual(skillIds, expectedSkills);
assertSorted(skillIds, 'skill IDs');
for (const skill of catalog.skills) {
  assertSorted(skill.actions, `${skill.id} actions`);
  assertUnique(skill.actions, `${skill.id} actions`);
}

assert.strictEqual(catalog.operations.id, 'product-operations');
assert.deepStrictEqual(catalog.operations.actions, [
  'contribute',
  'help',
  'report-bug',
  'request-feature',
  'update',
]);

const owners = new Map();
for (const skill of catalog.skills) {
  for (const action of skill.actions) {
    assert.ok(catalogIds.includes(action), `${skill.id} owns unknown action ${action}`);
    assert.ok(!owners.has(action), `${action} has more than one owner`);
    owners.set(action, { kind: 'skill', id: skill.id });
  }
}
for (const action of catalog.operations.actions) {
  assert.ok(catalogIds.includes(action), `operations owns unknown action ${action}`);
  assert.ok(!owners.has(action), `${action} has more than one owner`);
  owners.set(action, { kind: 'operations', id: catalog.operations.id });
}
assert.strictEqual(owners.size, 36, 'every action must have exactly one surface owner');
assert.strictEqual([...owners.values()].filter((owner) => owner.kind === 'skill').length, 31);
assert.strictEqual([...owners.values()].filter((owner) => owner.kind === 'operations').length, 5);

assert.strictEqual(aliases.schema, 'wtfp.aliases/v1');
assert.strictEqual(aliases.aliases.length, 36);
const aliasIds = aliases.aliases.map((entry) => entry.action);
assert.deepStrictEqual(aliasIds, catalogIds);
assertSorted(aliasIds, 'alias actions');
assertUnique(aliasIds, 'alias actions');
for (const entry of aliases.aliases) {
  assert.strictEqual(entry.alias, `wtfp:${entry.action}`, `alias drift for ${entry.action}`);
}

const effectIds = effectsRegistry.effects.map((effect) => effect.id);
const toolIds = toolsRegistry.tools.map((tool) => tool.id);
assertSorted(effectIds, 'effect IDs');
assertSorted(toolIds, 'tool IDs');
assertUnique(effectIds, 'effect IDs');
assertUnique(toolIds, 'tool IDs');

const requiredEffects = [
  'agent.delegate',
  'agent.parallel',
  'artifact.archive',
  'external.issue',
  'filesystem.create',
  'filesystem.delete',
  'filesystem.modify',
  'filesystem.read',
  'filesystem.write',
  'network.fetch',
  'network.search',
  'package.update',
  'tool.execute',
  'user.gate',
  'vcs.branch',
  'vcs.commit',
  'vcs.merge',
];
assert.deepStrictEqual(effectIds, requiredEffects);
for (const effect of effectsRegistry.effects) {
  assert.ok(['none', 'implicit', 'explicit'].includes(effect.consent), `${effect.id} needs a consent policy`);
  assert.ok(
    ['reversible', 'conditionally-reversible', 'irreversible', 'not-applicable'].includes(effect.reversibility),
    `${effect.id} needs a reversibility policy`,
  );
  assert.ok(effect.description.length > 0, `${effect.id} needs a description`);
}

const expectedTools = [
  'bibliography.analyze-impact',
  'bibliography.format',
  'bibliography.index',
  'citation.fetch',
  'citation.rank',
  'citation.scholar-lookup',
  'citation.semantic-scholar',
];
assert.deepStrictEqual(toolIds, expectedTools);
for (const tool of toolsRegistry.tools) {
  assert.match(tool.implementation, /^wtfp:\/\/tools\//, `${tool.id} must use a logical implementation URI`);
  assert.ok(!tool.implementation.includes('/vendors/'), `${tool.id} leaks a vendor path`);
  for (const effect of tool.effects) {
    assert.ok(effectIds.includes(effect), `${tool.id} references unknown effect ${effect}`);
  }
}

assert.deepStrictEqual(
  Object.fromEntries(toolsRegistry.tools.map((tool) => [tool.id, tool.deterministic])),
  {
    'bibliography.analyze-impact': false,
    'bibliography.format': false,
    'bibliography.index': true,
    'citation.fetch': false,
    'citation.rank': false,
    'citation.scholar-lookup': false,
    'citation.semantic-scholar': false,
  },
  'tool determinism must describe observable clock and network dependencies',
);
assert.deepStrictEqual(
  toolsRegistry.tools.find((tool) => tool.id === 'bibliography.analyze-impact').effects,
  ['filesystem.read', 'network.search'],
  'bibliography.analyze-impact must not conceal its Semantic Scholar search',
);
assert.deepStrictEqual(
  toolsRegistry.tools.find((tool) => tool.id === 'citation.fetch').effects,
  ['network.search'],
  'citation.fetch must disclose exactly the provider searches it performs',
);
assert.deepStrictEqual(
  toolsRegistry.tools.find((tool) => tool.id === 'citation.rank').effects,
  [],
  'citation.rank is a pure in-memory transform and must not claim filesystem access',
);
assert.strictEqual(
  toolsSchema.properties.tools.items.properties.effects.minItems,
  undefined,
  'the tool registry schema must permit pure tools with an empty effect list',
);
assert.deepStrictEqual(
  toolsRegistry.tools.find((tool) => tool.id === 'citation.semantic-scholar').effects,
  ['network.fetch', 'network.search'],
  'citation.semantic-scholar must disclose its search and record-fetch methods',
);

const projectMutationEffects = new Set([
  'artifact.archive',
  'filesystem.create',
  'filesystem.delete',
  'filesystem.modify',
  'filesystem.write',
]);

const capabilityByEffect = new Map([
  ['agent.delegate', 'agent.delegate'],
  ['agent.parallel', 'agent.parallel'],
  ['artifact.archive', 'filesystem.write'],
  ['external.issue', 'external.issue'],
  ['filesystem.create', 'filesystem.write'],
  ['filesystem.delete', 'filesystem.delete'],
  ['filesystem.modify', 'filesystem.write'],
  ['filesystem.read', 'filesystem.read'],
  ['filesystem.write', 'filesystem.write'],
  ['network.fetch', 'network.fetch'],
  ['network.search', 'network.search'],
  ['package.update', 'package.update'],
  ['tool.execute', 'tool.execute'],
  ['user.gate', 'user.interaction'],
  ['vcs.branch', 'vcs.branch'],
  ['vcs.commit', 'vcs.commit'],
  ['vcs.merge', 'vcs.merge'],
]);

const mutationEffectsByMode = new Map([
  ['create', ['filesystem.create']],
  ['update', ['filesystem.modify', 'filesystem.write']],
  ['delete', ['filesystem.delete']],
  ['archive', ['artifact.archive']],
]);

for (const catalogEntry of catalog.actions) {
  const action = load(catalogEntry.contract.replace(/^protocol:\/\//, 'protocol/'));
  const capabilities = new Set(action.requirements.capabilities);
  const effects = new Set(action.effects.map((effect) => effect.id));
  const projectOutputs = action.produces.filter((output) => output.uri.startsWith('project://'));

  for (const effect of action.effects) {
    const requiredCapability = capabilityByEffect.get(effect.id);
    assert.ok(requiredCapability, `${action.id} effect ${effect.id} has no capability mapping`);
    assert.ok(
      capabilities.has(requiredCapability),
      `${action.id} declares ${effect.id} without ${requiredCapability} capability`,
    );
  }

  if (projectOutputs.length > 0) {
    assert.ok(
      capabilities.has('filesystem.write') || capabilities.has('filesystem.delete'),
      `${action.id} produces project resources without a write/delete capability`,
    );
    assert.ok(
      [...effects].some((effect) => projectMutationEffects.has(effect)),
      `${action.id} produces project resources without a mutation effect`,
    );
  }
  if (action.tools.length > 0) {
    assert.ok(capabilities.has('tool.execute'), `${action.id} declares tools without tool.execute capability`);
    assert.ok(effects.has('tool.execute'), `${action.id} declares tools without a tool.execute effect`);
    for (const toolId of action.tools) {
      const tool = toolsRegistry.tools.find((entry) => entry.id === toolId);
      for (const toolEffect of tool.effects) {
        assert.ok(
          effects.has(toolEffect),
          `${action.id} invokes ${toolId} without declaring its ${toolEffect} effect`,
        );
        assert.ok(
          capabilities.has(capabilityByEffect.get(toolEffect)),
          `${action.id} invokes ${toolId} without the ${capabilityByEffect.get(toolEffect)} capability`,
        );
      }
    }
  }

  const reads = new Set(action.reads);
  for (const output of projectOutputs) {
    const allowedEffects = mutationEffectsByMode.get(output.mode);
    if (allowedEffects) {
      assert.ok(
        allowedEffects.some((effect) => effects.has(effect)),
        `${action.id} ${output.mode}s ${output.uri} without ${allowedEffects.join(' or ')}`,
      );
    }
    if (output.mode === 'update' || output.mode === 'delete') {
      assert.ok(reads.has(output.uri), `${action.id} must read ${output.uri} before ${output.mode}`);
    }
  }

  for (const delegation of action.delegation) {
    assert.ok(capabilities.has('agent.delegate'), `${action.id} delegates without agent.delegate capability`);
    assert.ok(effects.has('agent.delegate'), `${action.id} delegates without agent.delegate effect`);
    if (delegation.mode === 'parallel') {
      assert.ok(capabilities.has('agent.parallel'), `${action.id} delegates in parallel without agent.parallel capability`);
      assert.ok(effects.has('agent.parallel'), `${action.id} delegates in parallel without agent.parallel effect`);
    }
  }

  assert.ok(
    !action.effects.some((effect) => effect.scope.includes('roles://')),
    `${action.id} effect scopes must use singular role:// URIs`,
  );
}

const checkTodos = load('protocol/actions/check-todos.json');
assert.ok(!checkTodos.requirements.capabilities.includes('filesystem.delete'), 'check-todos must preserve checkpoint history');
assert.ok(!checkTodos.effects.some((effect) => effect.id === 'filesystem.delete'), 'check-todos must not delete todos');
assert.ok(!checkTodos.produces.some((output) => output.mode === 'delete'), 'check-todos must not declare deleted records');

const planSection = load('protocol/actions/plan-section.json');
assert.strictEqual(
  planSection.delegation.find((entry) => entry.role === 'plan-checker')?.mode,
  'required',
  'plan-section must retain an independent required plan-checker pass',
);

function actionOutputUris(action, mode) {
  return new Set(action.produces.filter((output) => output.mode === mode).map((output) => output.uri));
}

function commaSeparatedScope(action, effectId) {
  const effect = action.effects.find((entry) => entry.id === effectId);
  assert.ok(effect, `${action.id} must declare ${effectId}`);
  return effect.scope.split(', ');
}

const mapProject = load('protocol/actions/map-project.json');
assert.deepStrictEqual(
  commaSeparatedScope(mapProject, 'filesystem.create'),
  [...actionOutputUris(mapProject, 'create')],
  'map-project must not classify its state update as a file creation',
);

const createOutline = load('protocol/actions/create-outline.json');
assert.deepStrictEqual(
  commaSeparatedScope(createOutline, 'filesystem.create'),
  [...actionOutputUris(createOutline, 'create')],
  'create-outline must not classify outline and state updates as file creations',
);
assert.deepStrictEqual(
  createOutline.produces.find((output) => output.uri === 'project://decisions'),
  { uri: 'project://decisions', mode: 'update' },
  'create-outline must reconcile author choices captured by its outline interview',
);
assert.deepStrictEqual(
  commaSeparatedScope(createOutline, 'filesystem.write'),
  createOutline.produces.map((output) => output.uri),
  'create-outline write scope must disclose its complete transactional record set',
);
assert.deepStrictEqual(
  commaSeparatedScope(createOutline, 'user.gate'),
  createOutline.produces.map((output) => output.uri),
  'create-outline approval gate must cover the complete transactional record set',
);

assert.ok(
  commaSeparatedScope(planSection, 'filesystem.write').includes('project://checkpoints/{checkpoint}'),
  'plan-section must disclose its blocked-path checkpoint write',
);
assert.ok(
  planSection.reads.includes('project://validations/*'),
  'plan-section must enumerate the bounded validation collection before dispatch',
);
assert.deepStrictEqual(
  commaSeparatedScope(planSection, 'filesystem.read'),
  planSection.reads,
  'plan-section read effects must exactly disclose every prerequisite input',
);
for (const condition of [
  'Exactly one applicable current validation exists with subject_uri project://structure/outline, action_id create-outline, and executed_at greater than or equal to the outline updated_at, and that validation has status passed',
  'project://structure/outline and the target project://sections/{section} record are consistent with all current locked and deferred choices in project://decisions',
]) {
  assert.ok(planSection.requirements.conditions.includes(condition), `plan-section condition drift: ${condition}`);
}
assert.deepStrictEqual(
  planSection.delegation.map((entry) => [entry.role, entry.mode]),
  [['section-planner', 'required'], ['plan-checker', 'required']],
  'plan-section must preserve the required planner-to-checker delegation sequence',
);

const reviewSection = load('protocol/actions/review-section.json');
assert.deepStrictEqual(
  commaSeparatedScope(reviewSection, 'filesystem.write'),
  reviewSection.produces.map((output) => output.uri),
  'review-section write scope must disclose its review, validation, and section outputs',
);

const pauseWriting = load('protocol/actions/pause-writing.json');
assert.deepStrictEqual(
  pauseWriting.produces.find((output) => output.uri === 'project://sections/{section}'),
  { uri: 'project://sections/{section}', mode: 'update' },
  'pause-writing must update the section record that links its handoff and checkpoint',
);
assert.deepStrictEqual(
  commaSeparatedScope(pauseWriting, 'filesystem.create'),
  ['project://sections/{section}/handoff', 'project://checkpoints/{checkpoint}'],
  'pause-writing create effects must be limited to the new handoff and checkpoint',
);
assert.deepStrictEqual(
  commaSeparatedScope(pauseWriting, 'filesystem.modify'),
  ['project://sections/{section}/handoff', 'project://sections/{section}', 'project://state'],
  'pause-writing modify effects must cover a merged handoff and the records that link it',
);
const pauseContinuityReads = [
  'project://decisions',
  'project://structure/outline',
  'project://sections/{section}/plans/{plan}',
  'project://sections/{section}/reviews/{review}',
  'project://sections/{section}/summary',
  'project://sections/{section}/handoff',
  'project://validations/{validation}',
  'project://paper/{artifact}',
];
for (const uri of pauseContinuityReads) {
  assert.ok(pauseWriting.reads.includes(uri), `pause-writing must read ${uri} before preserving continuity`);
}
assert.deepStrictEqual(
  commaSeparatedScope(pauseWriting, 'filesystem.read'),
  pauseWriting.reads,
  'pause-writing read effects must exactly disclose every continuity input',
);
assert.deepStrictEqual(
  pauseWriting.produces.filter((output) => output.uri === 'project://sections/{section}/handoff'),
  [
    { uri: 'project://sections/{section}/handoff', mode: 'create' },
    { uri: 'project://sections/{section}/handoff', mode: 'update' },
  ],
  'pause-writing must deliberately create or merge its durable handoff',
);

const resumeWriting = load('protocol/actions/resume-writing.json');
const resumeFreshnessReads = [
  'project://manifest',
  'project://config',
  'project://decisions',
  'project://structure/outline',
  'project://sections/{section}/plans/{plan}',
  'project://sections/{section}/reviews/{review}',
  'project://validations/{validation}',
  'project://paper/{artifact}',
];
for (const uri of resumeFreshnessReads) {
  assert.ok(resumeWriting.reads.includes(uri), `resume-writing must read ${uri} before declaring a handoff current`);
}
assert.deepStrictEqual(
  commaSeparatedScope(resumeWriting, 'filesystem.read'),
  resumeWriting.reads,
  'resume-writing read effects must exactly disclose every freshness input',
);

const writeSection = load('protocol/actions/write-section.json');
assert.deepStrictEqual(
  writeSection.produces.find((output) => output.uri === 'project://manifest'),
  { uri: 'project://manifest', mode: 'update' },
  'write-section must update the manifest manuscript index after creating an artifact',
);
assert.ok(
  commaSeparatedScope(writeSection, 'filesystem.modify').includes('project://manifest'),
  'write-section must disclose the manifest mutation effect',
);

const progress = load('protocol/actions/progress.json');
const progressReconciliationReads = [
  'project://sections/{section}/plans/{plan}',
  'project://sections/{section}/reviews/{review}',
  'project://sections/{section}/summary',
  'project://sections/{section}/handoff',
  'project://sources/{source}',
  'project://evidence/{evidence}',
  'project://checkpoints/{checkpoint}',
  'project://validations/{validation}',
  'project://paper/{artifact}',
];
for (const uri of progressReconciliationReads) {
  assert.ok(progress.reads.includes(uri), `progress must read ${uri} before reconciling it`);
}
assert.deepStrictEqual(
  commaSeparatedScope(progress, 'filesystem.read'),
  progress.reads,
  'progress read effects must exactly disclose every reconciled resource',
);

const checkRefs = load('protocol/actions/check-refs.json');
const checkRefsMutableInputs = new Set([
  'project://sources/{source}',
  'project://evidence/{evidence}',
  'project://materials/{artifact}',
  'project://paper/{artifact}',
]);
assert.ok(
  !checkRefs.produces.some((output) => checkRefsMutableInputs.has(output.uri)),
  'check-refs is non-destructive: corrections must be emitted as a separate bibliography candidate',
);
assert.ok(!checkRefs.requirements.capabilities.includes('network.fetch'), 'check-refs must not claim record fetches its tools do not perform');
assert.ok(checkRefs.requirements.capabilities.includes('network.search'), 'check-refs must disclose provider searches');
assert.ok(!checkRefs.effects.some((effect) => effect.id === 'network.fetch'), 'check-refs must not declare a selected-record fetch effect');
assert.ok(
  checkRefs.effects.some((effect) => effect.id === 'user.gate' && effect.scope.includes('query set')),
  'check-refs must gate its providers and bounded query set',
);

const analyzeBib = load('protocol/actions/analyze-bib.json');
assert.ok(analyzeBib.requirements.capabilities.includes('network.search'), 'analyze-bib must disclose network search');
assert.ok(analyzeBib.requirements.capabilities.includes('user.interaction'), 'analyze-bib needs an external-search gate');
assert.ok(
  analyzeBib.effects.some((effect) => effect.id === 'user.gate' && effect.scope.includes('provider')),
  'analyze-bib must gate the external provider and query set',
);
for (const uri of ['project://sections/{section}', 'project://evidence/{evidence}']) {
  assert.ok(analyzeBib.reads.includes(uri), `analyze-bib must read ${uri} before section-aware reconciliation`);
}
assert.deepStrictEqual(
  analyzeBib.produces.filter((output) => output.uri === 'project://sources/{source}'),
  [
    { uri: 'project://sources/{source}', mode: 'create' },
    { uri: 'project://sources/{source}', mode: 'update' },
  ],
  'analyze-bib must support creating or reconciling source identities',
);
assert.deepStrictEqual(
  analyzeBib.produces.filter((output) => output.uri === 'project://evidence/{evidence}'),
  [
    { uri: 'project://evidence/{evidence}', mode: 'create' },
    { uri: 'project://evidence/{evidence}', mode: 'update' },
  ],
  'analyze-bib must support creating or reconciling claim mappings',
);
assert.deepStrictEqual(
  commaSeparatedScope(analyzeBib, 'filesystem.create'),
  [...actionOutputUris(analyzeBib, 'create')],
  'analyze-bib create scope must exactly disclose source, evidence, and validation creation',
);
assert.deepStrictEqual(
  commaSeparatedScope(analyzeBib, 'filesystem.modify'),
  [...actionOutputUris(analyzeBib, 'update')],
  'analyze-bib modify scope must exactly disclose source and evidence reconciliation',
);
assert.deepStrictEqual(
  commaSeparatedScope(analyzeBib, 'filesystem.read'),
  analyzeBib.reads,
  'analyze-bib read scope must exactly disclose every analysis input',
);

const roleIds = new Set([
  'argument-verifier',
  'citation-expert',
  'citation-formatter',
  'coherence-checker',
  'outliner',
  'plan-checker',
  'prose-polisher',
  'research-synthesizer',
  'section-planner',
  'section-reviewer',
  'section-writer',
]);

const ownedJsonFiles = [
  path.join(protocolRoot, 'catalog.json'),
  path.join(protocolRoot, 'aliases.lock.json'),
  path.join(protocolRoot, 'effects.json'),
  path.join(protocolRoot, 'tools.json'),
];

for (const catalogEntry of catalog.actions) {
  const contractPath = resolveProtocolUri(catalogEntry.contract);
  assert.ok(fs.existsSync(contractPath), `missing contract ${catalogEntry.contract}`);
  ownedJsonFiles.push(contractPath);

  const action = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const owner = owners.get(action.id);
  assert.strictEqual(action.schema, 'wtfp.action/v1', `${action.id} has the wrong schema`);
  assert.strictEqual(action.id, catalogEntry.id, `${catalogEntry.contract} has the wrong ID`);
  assert.strictEqual(action.alias, `wtfp:${action.id}`, `${action.id} has an unstable alias`);
  assert.ok(action.title && action.description, `${action.id} needs human-readable metadata`);
  assert.ok(action.requirements && Array.isArray(action.requirements.capabilities), `${action.id} needs requirements`);
  assert.ok(Array.isArray(action.requirements.conditions), `${action.id} needs requirement conditions`);
  assert.ok(Array.isArray(action.reads), `${action.id} needs declared reads`);
  assert.ok(Array.isArray(action.produces), `${action.id} needs declared outputs`);
  assert.ok(Array.isArray(action.delegation), `${action.id} needs a delegation recipe`);
  assert.ok(Array.isArray(action.tools), `${action.id} needs declared tools`);
  assert.ok(Array.isArray(action.effects) && action.effects.length > 0, `${action.id} needs semantic effects`);

  if (owner.kind === 'skill') {
    assert.deepStrictEqual(action.surface, { kind: 'skill', skill: owner.id }, `${action.id} surface drift`);
    assert.strictEqual(action.workflow, `wtfp://workflows/${action.id}`, `${action.id} workflow URI drift`);
  } else {
    assert.deepStrictEqual(
      action.surface,
      { kind: 'operations', operation: 'product-operations' },
      `${action.id} operations surface drift`,
    );
    assert.ok(!Object.hasOwn(action, 'workflow'), `${action.id} should not consume a domain workflow`);
  }

  for (const delegation of action.delegation) {
    assert.ok(roleIds.has(delegation.role), `${action.id} references unknown role ${delegation.role}`);
    assert.ok(['required', 'optional', 'parallel'].includes(delegation.mode), `${action.id} has an invalid delegation mode`);
    assert.ok(delegation.purpose, `${action.id} delegation needs a purpose`);
  }
  for (const tool of action.tools) {
    assert.ok(toolIds.includes(tool), `${action.id} references unknown tool ${tool}`);
  }
  for (const effect of action.effects) {
    assert.ok(effectIds.includes(effect.id), `${action.id} references unknown effect ${effect.id}`);
    assert.ok(effect.scope, `${action.id} effect ${effect.id} needs a scope`);
  }
}

const schemaFiles = fs.readdirSync(path.join(protocolRoot, 'schemas'))
  .filter((name) => name.endsWith('.schema.json'))
  .sort();
assert.ok(schemaFiles.length >= 6, 'the protocol needs schemas for its core records');
for (const schemaFile of schemaFiles) {
  const schemaPath = path.join(protocolRoot, 'schemas', schemaFile);
  ownedJsonFiles.push(schemaPath);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  assert.strictEqual(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', `${schemaFile} draft drift`);
  assert.match(schema.$id, /^wtfp\.[a-z-]+\/v1$/, `${schemaFile} needs a stable v1 schema identifier`);
  assert.strictEqual(schema.type, 'object', `${schemaFile} root must be an object`);
  assert.ok(Array.isArray(schema.required) && schema.required.length > 0, `${schemaFile} needs required fields`);
  assert.ok(schema.properties && typeof schema.properties === 'object', `${schemaFile} needs properties`);
}

const forbiddenTokens = [
  '~/.claude',
  'Task(',
  'subagent_type',
  'AskUserQuestion',
  'opus',
  'sonnet',
  'haiku',
];
for (const file of ownedJsonFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const token of forbiddenTokens) {
    assert.ok(!content.includes(token), `${path.relative(root, file)} contains forbidden runtime token ${token}`);
  }
}

console.log('protocol catalog: 36 stable actions, 7 skills, 5 operations, and all references valid');
