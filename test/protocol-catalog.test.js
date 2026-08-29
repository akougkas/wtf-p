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
