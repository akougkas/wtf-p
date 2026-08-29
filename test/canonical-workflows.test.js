#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const protocolRoot = path.join(repositoryRoot, 'protocol');
const workflowsRoot = path.join(protocolRoot, 'workflows');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function resolveProtocolUri(uri, label) {
  assert.match(uri, /^protocol:\/\/[a-z0-9][a-z0-9._/-]*$/, `${label} must be a logical protocol:// URI`);
  const relativePath = uri.slice('protocol://'.length);
  assert.ok(!relativePath.split('/').includes('..'), `${label} must not traverse outside the protocol root`);

  const resolved = path.resolve(protocolRoot, relativePath);
  assert.ok(
    resolved.startsWith(`${protocolRoot}${path.sep}`),
    `${label} must resolve inside the protocol root`,
  );
  return resolved;
}

function splitWorkflow(source, fileName) {
  assert.ok(!source.includes('\r'), `${fileName} must use LF line endings`);

  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(match, `${fileName} must start with a closed YAML frontmatter block`);

  const lines = match[1].split('\n');
  assert.strictEqual(lines.length, 3, `${fileName} frontmatter must contain exactly three fields`);

  const fields = {};
  for (const line of lines) {
    const field = line.match(/^([a-z][a-z0-9_-]*): ([^\s].*)$/);
    assert.ok(field, `${fileName} has malformed frontmatter: ${line}`);
    assert.ok(
      !Object.prototype.hasOwnProperty.call(fields, field[1]),
      `${fileName} repeats frontmatter field ${field[1]}`,
    );
    fields[field[1]] = field[2];
  }

  assert.deepStrictEqual(
    Object.keys(fields),
    ['schema', 'action', 'source'],
    `${fileName} frontmatter fields and order are part of the canonical format`,
  );
  return { fields, body: match[2] };
}

const forbiddenSyntax = [
  ['vendor name Anthropic', /\banthropic\b/i],
  ['vendor runtime Claude', /\bclaude(?:\s+code)?\b/i],
  ['vendor runtime Codex', /\bcodex\b/i],
  ['vendor runtime Gemini', /\bgemini(?:\s+cli)?\b/i],
  ['vendor runtime Copilot', /\b(?:github\s+)?copilot\b/i],
  ['vendor runtime OpenCode', /\bopen[ -]?code\b/i],
  ['vendor runtime Clio', /\bclio(?:\s+coder)?\b/i],
  ['vendor runtime Antigravity', /\banti[ -]?gravity\b/i],
  ['vendor model OpenAI', /\bopenai\b/i],
  ['vendor model family GPT', /\bgpt(?:-[a-z0-9.]+)?\b/i],
  ['vendor model family Sonnet', /\bsonnet\b/i],
  ['vendor model family Opus', /\bopus\b/i],
  ['vendor model family Haiku', /\bhaiku\b/i],
  ['Claude command frontmatter', /\b(?:allowed-tools|argument-hint|disable-model-invocation)\s*:/i],
  ['runtime argument placeholder', /\$ARGUMENTS\b/],
  ['runtime plugin-root placeholder', /(?:\$\{[A-Z0-9_]*PLUGIN_ROOT\}|\$[A-Z0-9_]*PLUGIN_ROOT\b)/],
  ['runtime user-question tool', /\bAskUserQuestion\b/],
  ['runtime slash-command tool', /\bSlashCommand\b/],
  ['runtime todo tool', /\bTodoWrite\b/],
  ['vendor Task invocation', /\bTask\s*\(/],
  ['vendor agent-spawn invocation', /\bspawn_agent\s*\(/i],
  ['vendor subagent selector', /\bsubagent_type\b/i],
  ['vendor role-class selector', /\brole_class\b/i],
  ['vendor background-execution selector', /\brun_in_background\b/i],
  ['home environment variable', /(?:\$\{HOME\}|\$HOME\b)/],
  ['home-relative path', /(^|[\s`'"(])~[\\/]/m],
  ['home environment access', /\bprocess\.env\.HOME\b|%(?:HOME|USERPROFILE)%|\$USERPROFILE\b/i],
  ['absolute user-home path', /\/(?:home\/[A-Za-z0-9._-]+|Users\/[A-Za-z0-9._-]+|root)\//],
  ['Windows user-home path', /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\/],
  ['vendor home path', /(?:^|[\\/])\.(?:claude|codex|gemini)(?:[\\/]|\b)/im],
  ['OpenCode home path', /\.config[\\/]opencode(?:[\\/]|\b)/i],
  ['physical vendor resource path', /(?:^|[\s`'"(@])(?:\.\.\/|\.\/)*(?:vendor|vendors)\//im],
  ['physical core resource path', /(?:^|[\s`'"(@])(?:\.\.\/|\.\/)*core\//im],
];

const catalog = readJson(path.join(protocolRoot, 'catalog.json'));
assert.strictEqual(catalog.schema, 'wtfp.catalog/v1', 'catalog schema drift');
assert.strictEqual(catalog.actions.length, 36, 'the canonical catalog must contain exactly 36 actions');

const actionIds = catalog.actions.map((entry) => entry.id);
assert.strictEqual(new Set(actionIds).size, 36, 'catalog action IDs must be unique');
assert.deepStrictEqual(actionIds, sorted(actionIds), 'catalog actions must stay deterministically sorted');

const owningSkillByAction = new Map();
for (const skill of catalog.skills) {
  for (const action of skill.actions) {
    owningSkillByAction.set(action, skill.id);
  }
}

const workflowEntries = fs.readdirSync(workflowsRoot, { withFileTypes: true });
const workflowFiles = sorted(
  workflowEntries.map((entry) => {
    assert.ok(entry.isFile(), `protocol/workflows must be flat; found ${entry.name}`);
    assert.match(entry.name, /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.md$/, `unexpected workflow entry ${entry.name}`);
    return entry.name;
  }),
);
const expectedWorkflowFiles = actionIds.map((action) => `${action}.md`);
assert.deepStrictEqual(
  workflowFiles,
  expectedWorkflowFiles,
  'protocol/workflows must contain exactly one Markdown workflow for every catalog action',
);

for (const action of actionIds) {
  const fileName = `${action}.md`;
  const workflowPath = path.join(workflowsRoot, fileName);
  const source = fs.readFileSync(workflowPath, 'utf8');
  const { fields, body } = splitWorkflow(source, fileName);
  const contract = readJson(path.join(protocolRoot, 'actions', `${action}.json`));

  assert.strictEqual(fields.schema, 'wtfp.workflow/v1', `${fileName} schema drift`);
  assert.strictEqual(fields.action, action, `${fileName} frontmatter action must match its filename`);
  assert.strictEqual(fields.source, 'wtfp.protocol', `${fileName} must identify the canonical protocol source`);
  assert.ok(body.trim().length > 0, `${fileName} must have a non-empty workflow body`);

  const readLine = body.match(/^Read: (.+)\.$/m);
  const produceLine = body.match(/^Produce: (.+)\.$/m);
  assert.ok(readLine, `${fileName} must declare its record reads`);
  assert.ok(produceLine, `${fileName} must declare its record outputs`);

  const workflowReads = [...readLine[1].matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  if (workflowReads.length > 0) {
    assert.deepStrictEqual(workflowReads, contract.reads, `${fileName} record reads drift from its action contract`);
  } else {
    assert.strictEqual(action, 'checkpoint', `${fileName} may not use an implicit read declaration`);
    assert.match(readLine[1], /declared portable records/, 'checkpoint must bound its dynamic snapshot reads');
  }

  const workflowOutputs = produceLine[1] === 'none'
    ? []
    : [...produceLine[1].matchAll(/`([^`]+)` \((create|update|delete|archive|display)(?: [^)]+)?\)/g)]
      .map((match) => ({ uri: match[1], mode: match[2] }));
  assert.deepStrictEqual(workflowOutputs, contract.produces, `${fileName} record outputs drift from its action contract`);

  const owningSkill = owningSkillByAction.get(action);
  if (owningSkill) {
    assert.ok(
      body.includes(`@protocol://skills/${owningSkill}/SKILL.md`),
      `${fileName} must activate its owning skill`,
    );
    assert.ok(
      body.includes(`@protocol://skills/${owningSkill}/references/actions.md`),
      `${fileName} must load its detailed action procedure`,
    );
  }

  for (const [label, pattern] of forbiddenSyntax) {
    assert.doesNotMatch(source, pattern, `${fileName} contains ${label}`);
  }

  const includeLines = (body.match(/^\s*@\S+\s*$/gm) || []).filter((line) => {
    const reference = line.trim().slice(1);
    return reference.includes('://') || reference.includes('/') || reference.startsWith('.') || reference.startsWith('~');
  });
  for (const includeLine of includeLines) {
    const reference = includeLine.trim().slice(1);
    assert.match(
      reference,
      /^(?:protocol|project):\/\/[A-Za-z0-9.][A-Za-z0-9._{}/-]*\/?$/,
      `${fileName} resource includes must use logical protocol:// or project:// URIs: ${includeLine.trim()}`,
    );
    assert.ok(!reference.split('/').includes('..'), `${fileName} resource include must not traverse: ${reference}`);
  }

  const uriReferences = body.match(/\b[a-z][a-z0-9+.-]*:\/\/[^\s<>()`"']+/gi) || [];
  for (const rawReference of uriReferences) {
    const reference = rawReference.replace(/[.,;:!?]+$/, '');
    if (reference.startsWith('https://')) {
      assert.match(
        reference,
        /^(?:https:\/\/github\.com\/akougkas\/wtf-p(?:\/[A-Za-z0-9._{}?=&%#/-]*)?|https:\/\/cli\.github\.com\/?)$/,
        `${fileName} external resource must be an approved WTF-P or GitHub CLI resource`,
      );
      continue;
    }
    assert.match(
      reference,
      /^(?:protocol|project|invocation|package):\/\/[A-Za-z0-9.][A-Za-z0-9._{}-]*(?:\/[A-Za-z0-9._{}-]+)*(?:\/\*|\/)?$/,
      `${fileName} may refer only to declared logical resources: ${reference}`,
    );
    assert.ok(!reference.split('/').includes('..'), `${fileName} resource URI must not traverse: ${reference}`);
  }
}

const portableResourceFiles = [
  ...fs.readdirSync(path.join(protocolRoot, 'actions')).map((name) => path.join(protocolRoot, 'actions', name)),
  ...fs.readdirSync(path.join(protocolRoot, 'roles')).map((name) => path.join(protocolRoot, 'roles', name)),
  ...workflowFiles.map((name) => path.join(workflowsRoot, name)),
];
for (const skill of catalog.skills) {
  portableResourceFiles.push(path.join(protocolRoot, 'skills', skill.id, 'SKILL.md'));
  portableResourceFiles.push(path.join(protocolRoot, 'skills', skill.id, 'references', 'actions.md'));
}

const projectUriVocabulary = [
  /^project:\/\/(?:manifest|config|state|decisions|structure\/outline)$/,
  /^project:\/\/(?:sources|evidence|checkpoints|validations)\/[A-Za-z0-9{}._-]+$/,
  /^project:\/\/validations\/\*$/,
  /^project:\/\/sections\/[A-Za-z0-9{}._-]+(?:\/(?:context|research|summary|handoff|plans\/[A-Za-z0-9{}._-]+|reviews\/[A-Za-z0-9{}._-]+))?$/,
  /^project:\/\/(?:materials|paper)\/[A-Za-z0-9{}._/-]+$/,
  /^project:\/\/deliverables\/[A-Za-z0-9{}._-]+\/[A-Za-z0-9{}._/-]+$/,
  /^project:\/\/archives\/[A-Za-z0-9{}._-]+\/[A-Za-z0-9{}._/-]+$/,
];
const declaredProjectUri = (uri) => projectUriVocabulary.some((pattern) => pattern.test(uri));
assert.ok(declaredProjectUri('project://validations/*'), 'bounded validation collection selector must be canonical');
for (const malformed of [
  'project://validations/foo*bar',
  'project://validations/archive/*',
  'project://sections/eval*/plans/{plan}',
]) {
  assert.ok(!declaredProjectUri(malformed), `wildcard must be one terminal bounded collection segment: ${malformed}`);
}
const legacyProjectTokens = [
  '.planning/PROJECT.md',
  '.planning/ROADMAP.md',
  '.planning/STATE.md',
  'wtfp.project.config/v0.5',
  'model_profile',
  'commit_docs',
  'branching_strategy',
  'squash_on_merge',
  'project://planning/',
  'project://brief',
  'project://bibliography/',
];

for (const file of portableResourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const label = path.relative(repositoryRoot, file);
  for (const token of legacyProjectTokens) {
    assert.ok(!source.includes(token), `${label} contains legacy project protocol token ${token}`);
  }
  for (const uri of source.match(/project:\/\/[A-Za-z0-9*{}._/-]+/g) || []) {
    assert.ok(
      declaredProjectUri(uri),
      `${label} uses undeclared portable project URI ${uri}`,
    );
  }
  assert.doesNotMatch(
    source,
    /^\s*(?:git|gh)\s+(?:init|add|commit|branch|checkout|switch|merge|push|tag|pr\s+create|issue\s+create)\b/gm,
    `${label} must not contain an executable VCS or publication command`,
  );
}

for (const catalogEntry of catalog.actions) {
  const contract = readJson(resolveProtocolUri(catalogEntry.contract, `${catalogEntry.id} contract`));
  const vcsCapabilities = contract.requirements.capabilities.filter((capability) => capability.startsWith('vcs.'));
  const vcsEffects = contract.effects.filter((effect) => effect.id.startsWith('vcs.'));
  if (vcsCapabilities.length === 0 && vcsEffects.length === 0) continue;

  assert.strictEqual(
    contract.id,
    'contribute',
    `${contract.id} must return VCS work as a handoff instead of declaring incidental VCS effects`,
  );
  assert.deepStrictEqual(
    sorted(vcsCapabilities),
    sorted(vcsEffects.map((effect) => effect.id)),
    'contribute VCS capabilities and semantic effects must agree',
  );
  assert.ok(
    contract.effects.some((effect) => effect.id === 'user.gate' && /branch|commit/i.test(effect.scope)),
    'contribute must gate its exact branch and commit decisions',
  );
}

const operationIds = new Set(catalog.operations.actions);
assert.strictEqual(operationIds.size, 5, 'the catalog must retain exactly five product operations');

for (const catalogEntry of catalog.actions) {
  const contractPath = resolveProtocolUri(catalogEntry.contract, `${catalogEntry.id} contract`);
  assert.ok(fs.existsSync(contractPath), `missing action contract ${catalogEntry.contract}`);

  const contract = readJson(contractPath);
  assert.strictEqual(contract.id, catalogEntry.id, `${catalogEntry.contract} action ID drift`);
  if (operationIds.has(catalogEntry.id)) {
    assert.ok(
      !Object.prototype.hasOwnProperty.call(contract, 'workflow'),
      `${catalogEntry.id} is a product operation and must not consume a domain workflow`,
    );
    continue;
  }

  assert.strictEqual(
    contract.workflow,
    `wtfp://workflows/${catalogEntry.id}`,
    `${catalogEntry.id} must declare its canonical workflow URI`,
  );

  const workflowName = contract.workflow.slice('wtfp://workflows/'.length);
  const workflowPath = path.resolve(workflowsRoot, `${workflowName}.md`);
  assert.ok(
    workflowPath.startsWith(`${workflowsRoot}${path.sep}`),
    `${catalogEntry.id} workflow URI must resolve inside protocol/workflows`,
  );
  assert.ok(fs.existsSync(workflowPath), `${catalogEntry.id} workflow URI does not resolve to Markdown`);
  assert.strictEqual(workflowPath, path.join(workflowsRoot, `${catalogEntry.id}.md`));
}

console.log('canonical workflow contracts passed (36 workflows)');
