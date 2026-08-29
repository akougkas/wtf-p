#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const projectRoot = path.join(repositoryRoot, 'protocol', 'project');
const schemasRoot = path.join(projectRoot, 'schemas');
const templatesRoot = path.join(projectRoot, 'templates');

const recordNames = [
  'manifest',
  'config',
  'state',
  'source',
  'evidence',
  'decisions',
  'outline',
  'section',
  'checkpoint',
  'validation'
];

const schemaCache = new Map();

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function loadSchema(file) {
  const resolved = path.resolve(file);
  if (!schemaCache.has(resolved)) schemaCache.set(resolved, readJson(resolved));
  return schemaCache.get(resolved);
}

function resolvePointer(document, pointer, source) {
  if (!pointer || pointer === '#') return document;
  assert(pointer.startsWith('#/'), `${source}: unsupported JSON pointer ${pointer}`);
  return pointer.slice(2).split('/').reduce((value, segment) => {
    const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
    assert(value && Object.prototype.hasOwnProperty.call(value, key), `${source}: unresolved pointer ${pointer}`);
    return value[key];
  }, document);
}

function resolveReference(reference, currentSchemaFile) {
  const separator = reference.indexOf('#');
  const filePart = separator === -1 ? reference : reference.slice(0, separator);
  const pointer = separator === -1 ? '' : reference.slice(separator);
  let targetFile = currentSchemaFile;
  if (filePart.startsWith('https://schemas.wtf-p.dev/project/')) {
    const match = filePart.match(/^https:\/\/schemas\.wtf-p\.dev\/project\/([a-z-]+)\/v1$/);
    assert(match, `${currentSchemaFile}: unsupported canonical schema reference ${filePart}`);
    targetFile = path.join(schemasRoot, `${match[1]}.schema.json`);
  } else if (filePart) {
    targetFile = path.resolve(path.dirname(currentSchemaFile), filePart);
  }
  const document = loadSchema(targetFile);
  return { schema: resolvePointer(document, pointer, targetFile), file: targetFile };
}

function validate(instance, schema, schemaFile, location = '$') {
  const errors = [];

  if (schema.$ref) {
    const target = resolveReference(schema.$ref, schemaFile);
    return validate(instance, target.schema, target.file, location);
  }

  for (const child of schema.allOf || []) {
    errors.push(...validate(instance, child, schemaFile, location));
  }
  if (schema.if) {
    const conditionMatches = validate(instance, schema.if, schemaFile, location).length === 0;
    if (conditionMatches && schema.then) errors.push(...validate(instance, schema.then, schemaFile, location));
    if (!conditionMatches && schema.else) errors.push(...validate(instance, schema.else, schemaFile, location));
  }
  if (schema.not && validate(instance, schema.not, schemaFile, location).length === 0) {
    errors.push(`${location}: must not match the forbidden schema`);
  }

  if (Object.prototype.hasOwnProperty.call(schema, 'const') && !deepEqual(instance, schema.const)) {
    errors.push(`${location}: must equal ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.some(item => deepEqual(instance, item))) {
    errors.push(`${location}: must be one of ${schema.enum.map(JSON.stringify).join(', ')}`);
  }

  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = valueType(instance);
    const matches = allowed.some(type => type === actual || (type === 'number' && actual === 'integer'));
    if (!matches) {
      errors.push(`${location}: expected ${allowed.join('|')}, got ${actual}`);
      return errors;
    }
  }

  if (typeof instance === 'string') {
    if (schema.minLength !== undefined && instance.length < schema.minLength) {
      errors.push(`${location}: string is shorter than ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(instance)) {
      errors.push(`${location}: does not match ${schema.pattern}`);
    }
    if (schema.format === 'date-time' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(instance)) {
      errors.push(`${location}: is not an RFC 3339 date-time`);
    }
    if (schema.format === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(instance)) {
      errors.push(`${location}: is not an ISO 8601 date`);
    }
    if (schema.format === 'uri') {
      try {
        new URL(instance);
      } catch {
        errors.push(`${location}: is not an absolute URI`);
      }
    }
  }

  if (typeof instance === 'number') {
    if (schema.minimum !== undefined && instance < schema.minimum) {
      errors.push(`${location}: is below ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && instance > schema.maximum) {
      errors.push(`${location}: is above ${schema.maximum}`);
    }
  }

  if (Array.isArray(instance)) {
    if (schema.minItems !== undefined && instance.length < schema.minItems) {
      errors.push(`${location}: has fewer than ${schema.minItems} items`);
    }
    if (schema.uniqueItems) {
      const serialized = instance.map(item => JSON.stringify(item));
      if (new Set(serialized).size !== serialized.length) errors.push(`${location}: items are not unique`);
    }
    if (schema.items) {
      instance.forEach((item, index) => {
        errors.push(...validate(item, schema.items, schemaFile, `${location}[${index}]`));
      });
    }
  }

  if (instance && typeof instance === 'object' && !Array.isArray(instance)) {
    const properties = schema.properties || {};
    if (schema.minProperties !== undefined && Object.keys(instance).length < schema.minProperties) {
      errors.push(`${location}: has fewer than ${schema.minProperties} properties`);
    }
    for (const required of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(instance, required)) {
        errors.push(`${location}: missing required property ${required}`);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(instance)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          errors.push(`${location}: unknown property ${key}`);
        }
      }
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(instance, key)) {
        errors.push(...validate(instance[key], childSchema, schemaFile, `${location}.${key}`));
      }
    }
  }

  return errors;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertInvalid(name, value, expectedPattern) {
  const schemaFile = path.join(schemasRoot, `${name}.schema.json`);
  const errors = validate(value, loadSchema(schemaFile), schemaFile);
  assert(errors.length > 0, `${name}: invalid fixture unexpectedly passed`);
  assert.match(errors.join('\n'), expectedPattern, `${name}: rejection reason was not specific`);
}

function walkStrings(value, visit, location = '$') {
  if (typeof value === 'string') {
    visit(value, location);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, visit, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) walkStrings(child, visit, `${location}.${key}`);
  }
}

function assertAcyclic(sections) {
  const dependencies = new Map(sections.map(section => [section.id, section.depends_on]));
  const visiting = new Set();
  const visited = new Set();

  function visit(id) {
    if (visited.has(id)) return;
    assert(!visiting.has(id), `outline contains a dependency cycle at ${id}`);
    visiting.add(id);
    for (const dependency of dependencies.get(id) || []) {
      assert(dependencies.has(dependency), `outline section ${id} depends on unknown section ${dependency}`);
      visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of dependencies.keys()) visit(id);
}

function matchesBoundedCollection(selector, uri) {
  assert(selector.endsWith('/*'), `unsupported bounded selector ${selector}`);
  const prefix = selector.slice(0, -2);
  if (!uri.startsWith(`${prefix}/`)) return false;
  const child = uri.slice(prefix.length + 1);
  return child.length > 0 && !child.includes('/');
}

function selectCurrentOutlineValidation(entries, outline) {
  const applicable = entries
    .filter(entry => matchesBoundedCollection('project://validations/*', entry.uri))
    .map(entry => entry.value)
    .filter(record =>
      record.subject_uri === 'project://structure/outline' &&
      record.action_id === 'create-outline'
    );
  if (applicable.length === 0) return { eligible: false, reason: 'missing' };

  const outlineTime = Date.parse(outline.updated_at);
  const current = applicable.filter(record => Date.parse(record.executed_at) >= outlineTime);
  if (current.length === 0) return { eligible: false, reason: 'stale' };
  if (current.length > 1) return { eligible: false, reason: 'ambiguous' };
  if (current[0].status !== 'passed') return { eligible: false, reason: 'nonpassing' };
  return { eligible: true, reason: 'passed', validation: current[0] };
}

function decisionSupersessionErrors(before, after, priorId, replacementId, resolutionTime) {
  const errors = [];
  const priorBefore = before.items.find(item => item.id === priorId);
  const priorAfter = after.items.find(item => item.id === priorId);
  const replacements = after.items.filter(item => item.id === replacementId);
  const replacement = replacements[0];

  if (!priorBefore || priorBefore.disposition !== 'deferred') errors.push('prior item must be deferred');
  if (after.revision !== before.revision + 1) errors.push('revision must advance exactly once');
  if (after.updated_at !== resolutionTime) errors.push('updated_at must equal the actual resolution time');
  if (Date.parse(resolutionTime) <= Date.parse(before.updated_at)) errors.push('resolution timestamp must advance');
  if (before.items.some(item => item.id === replacementId) || replacements.length !== 1) {
    errors.push('replacement ID must be fresh and unique');
  }

  if (!priorAfter || !priorBefore || !deepEqual(priorAfter, { ...priorBefore, disposition: 'superseded' })) {
    errors.push('prior deferred item may change only to superseded');
  }
  if (!replacement) {
    errors.push('replacement item is missing');
  } else {
    if (replacement.authority !== 'author') errors.push('replacement authority must be author');
    if (replacement.disposition !== 'locked') errors.push('replacement must be locked');
    if (replacement.supersedes !== priorId) errors.push('replacement must name the superseded item');
    if (replacement.recorded_at !== resolutionTime) errors.push('recorded_at must equal the actual resolution time');
  }

  const unrelatedBefore = before.items.filter(item => item.id !== priorId);
  const unrelatedAfter = after.items.filter(item => item.id !== priorId && item.id !== replacementId);
  if (!deepEqual(unrelatedAfter, unrelatedBefore)) errors.push('unrelated decisions must remain unchanged');
  return errors;
}

function main() {
  const expectedSchemaFiles = ['common.schema.json', ...recordNames.map(name => `${name}.schema.json`)].sort();
  const expectedTemplateFiles = recordNames.map(name => `${name}.json`).sort();
  assert.deepStrictEqual(fs.readdirSync(schemasRoot).sort(), expectedSchemaFiles, 'project schema catalog changed');
  assert.deepStrictEqual(fs.readdirSync(templatesRoot).sort(), expectedTemplateFiles, 'project template catalog changed');

  const common = loadSchema(path.join(schemasRoot, 'common.schema.json'));
  assert.strictEqual(common.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.strictEqual(common.$id, 'https://schemas.wtf-p.dev/project/common/v1');

  const templates = {};
  for (const name of recordNames) {
    const schemaFile = path.join(schemasRoot, `${name}.schema.json`);
    const schema = loadSchema(schemaFile);
    const template = readJson(path.join(templatesRoot, `${name}.json`));
    templates[name] = template;

    assert.strictEqual(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', `${name}: schema dialect`);
    assert.strictEqual(schema.$id, `https://schemas.wtf-p.dev/project/${name}/v1`, `${name}: canonical schema id`);
    assert.strictEqual(schema.type, 'object', `${name}: root must be an object`);
    assert.strictEqual(schema.additionalProperties, false, `${name}: root must reject unknown properties`);
    assert.strictEqual(template.schema, `wtfp.project.${name}/v1`, `${name}: fixture discriminator`);

    const errors = validate(template, schema, schemaFile);
    assert.deepStrictEqual(errors, [], `${name}: canonical fixture is invalid\n${errors.join('\n')}`);

    const extra = clone(template);
    extra.unexpected_property = true;
    assertInvalid(name, extra, /unknown property unexpected_property/);

    const wrongVersion = clone(template);
    wrongVersion.schema = template.schema.replace('/v1', '/v2');
    assertInvalid(name, wrongVersion, /must equal/);
    console.log(`✓ ${name} schema accepts its fixture and rejects drift`);
  }

  const projectIds = recordNames
    .filter(name => name !== 'manifest')
    .map(name => templates[name].project_id);
  assert(projectIds.every(id => id === templates.manifest.id), 'all fixtures must belong to the manifest project');

  assert.deepStrictEqual(templates.manifest.artifacts, {
    manifest: 'project://manifest',
    config: 'project://config',
    state: 'project://state',
    decisions: 'project://decisions',
    outline: 'project://structure/outline',
    materials: [],
    manuscripts: [],
    deliverables: [],
    archives: []
  });

  const outlineIds = templates.outline.sections.map(section => section.id);
  assert.strictEqual(new Set(outlineIds).size, outlineIds.length, 'outline section ids must be unique');
  assertAcyclic(templates.outline.sections);
  assert.strictEqual(
    templates.outline.sections.reduce((sum, section) => sum + section.word_target, 0),
    templates.outline.target_words,
    'outline section budgets must sum to the document target'
  );
  assert(outlineIds.includes(templates.section.id), 'section fixture must exist in the outline');
  assert.strictEqual(templates.state.progress.sections_total, templates.outline.sections.length);
  assert.strictEqual(templates.state.current_section_uri, `project://sections/${templates.section.id}`);

  const decisionIds = templates.decisions.items.map(item => item.id);
  assert.strictEqual(new Set(decisionIds).size, decisionIds.length, 'decision ids must be unique');
  const optionIds = templates.checkpoint.options.map(option => option.id);
  assert.strictEqual(new Set(optionIds).size, optionIds.length, 'checkpoint option ids must be unique');

  const resolutionTime = '2026-08-28T13:00:00Z';
  const decisionsBefore = clone(templates.decisions);
  const decisionsAfter = clone(decisionsBefore);
  decisionsAfter.revision += 1;
  decisionsAfter.updated_at = resolutionTime;
  decisionsAfter.items.find(item => item.id === 'decision-runtime-benchmarks').disposition = 'superseded';
  decisionsAfter.items.push({
    id: 'decision-runtime-benchmarks-resolved',
    authority: 'author',
    disposition: 'locked',
    statement: 'The outline will reserve one bounded runtime-comparison subsection.',
    rationale: 'The author explicitly resolved the previously deferred outline choice.',
    scope_uri: 'project://structure/outline',
    recorded_at: resolutionTime,
    supersedes: 'decision-runtime-benchmarks'
  });
  assert.deepStrictEqual(
    decisionSupersessionErrors(
      decisionsBefore,
      decisionsAfter,
      'decision-runtime-benchmarks',
      'decision-runtime-benchmarks-resolved',
      resolutionTime
    ),
    [],
    'an explicit author resolution must preserve decision history and append a fresh locked replacement'
  );
  const decisionsSchemaFile = path.join(schemasRoot, 'decisions.schema.json');
  assert.deepStrictEqual(
    validate(decisionsAfter, loadSchema(decisionsSchemaFile), decisionsSchemaFile),
    [],
    'the valid supersession transition must remain schema-valid'
  );

  const driftedPrior = clone(decisionsAfter);
  driftedPrior.items.find(item => item.id === 'decision-runtime-benchmarks').statement = 'Rewritten history';
  assert.match(
    decisionSupersessionErrors(
      decisionsBefore,
      driftedPrior,
      'decision-runtime-benchmarks',
      'decision-runtime-benchmarks-resolved',
      resolutionTime
    ).join('\n'),
    /prior deferred item may change only to superseded/
  );
  const staleResolutionTime = clone(decisionsAfter);
  staleResolutionTime.updated_at = decisionsBefore.updated_at;
  staleResolutionTime.items.at(-1).recorded_at = decisionsBefore.updated_at;
  assert.match(
    decisionSupersessionErrors(
      decisionsBefore,
      staleResolutionTime,
      'decision-runtime-benchmarks',
      'decision-runtime-benchmarks-resolved',
      resolutionTime
    ).join('\n'),
    /updated_at.*actual resolution time[\s\S]*recorded_at.*actual resolution time/
  );
  const reusedReplacement = clone(decisionsAfter);
  reusedReplacement.items.at(-1).id = 'decision-example-order';
  assert.match(
    decisionSupersessionErrors(
      decisionsBefore,
      reusedReplacement,
      'decision-runtime-benchmarks',
      'decision-example-order',
      resolutionTime
    ).join('\n'),
    /replacement ID must be fresh and unique/
  );
  const changedUnrelated = clone(decisionsAfter);
  changedUnrelated.items.find(item => item.id === 'decision-host-neutral-core').disposition = 'deferred';
  assert.match(
    decisionSupersessionErrors(
      decisionsBefore,
      changedUnrelated,
      'decision-runtime-benchmarks',
      'decision-runtime-benchmarks-resolved',
      resolutionTime
    ).join('\n'),
    /unrelated decisions must remain unchanged/
  );
  const unlockedReplacement = clone(decisionsAfter);
  unlockedReplacement.items.at(-1).disposition = 'deferred';
  assert.match(
    decisionSupersessionErrors(
      decisionsBefore,
      unlockedReplacement,
      'decision-runtime-benchmarks',
      'decision-runtime-benchmarks-resolved',
      resolutionTime
    ).join('\n'),
    /replacement must be locked/
  );
  const lockedPriorAttempt = clone(decisionsBefore);
  lockedPriorAttempt.revision += 1;
  lockedPriorAttempt.updated_at = resolutionTime;
  lockedPriorAttempt.items.find(item => item.id === 'decision-host-neutral-core').disposition = 'superseded';
  lockedPriorAttempt.items.push({
    id: 'decision-host-neutral-core-replacement',
    authority: 'author',
    disposition: 'locked',
    statement: 'An attempted replacement of an already locked choice.',
    rationale: 'This negative fixture must be rejected.',
    scope_uri: 'project://manifest',
    recorded_at: resolutionTime,
    supersedes: 'decision-host-neutral-core'
  });
  assert.match(
    decisionSupersessionErrors(
      decisionsBefore,
      lockedPriorAttempt,
      'decision-host-neutral-core',
      'decision-host-neutral-core-replacement',
      resolutionTime
    ).join('\n'),
    /prior item must be deferred/
  );

  const makeOutlineValidation = (id, executedAt, status = 'passed') => {
    const record = clone(templates.validation);
    record.id = id;
    record.subject_uri = 'project://structure/outline';
    record.action_id = 'create-outline';
    record.status = status;
    record.executed_at = executedAt;
    return { uri: `project://validations/${id}`, value: record };
  };
  assert(matchesBoundedCollection('project://validations/*', 'project://validations/outline-current'));
  assert(!matchesBoundedCollection('project://validations/*', 'project://validations'));
  assert(!matchesBoundedCollection('project://validations/*', 'project://validations/archive/outline-current'));
  assert(!matchesBoundedCollection('project://validations/*', 'project://checkpoints/outline-current'));

  const currentValidation = makeOutlineValidation('validation-outline-current', templates.outline.updated_at);
  const nestedNonpassing = makeOutlineValidation('validation-outline-nested', '2026-08-28T13:01:00Z', 'failed');
  nestedNonpassing.uri = 'project://validations/archive/validation-outline-nested';
  const selected = selectCurrentOutlineValidation([currentValidation, nestedNonpassing], templates.outline);
  assert.strictEqual(selected.eligible, true, 'one passed validation at the outline timestamp must be eligible');
  assert.strictEqual(selected.validation.id, 'validation-outline-current');
  assert.deepStrictEqual(selectCurrentOutlineValidation([], templates.outline), {
    eligible: false,
    reason: 'missing'
  });
  assert.deepStrictEqual(
    selectCurrentOutlineValidation([
      makeOutlineValidation('validation-outline-stale', '2026-08-28T12:29:59Z')
    ], templates.outline),
    { eligible: false, reason: 'stale' }
  );
  assert.deepStrictEqual(
    selectCurrentOutlineValidation([
      currentValidation,
      makeOutlineValidation('validation-outline-second', '2026-08-28T12:31:00Z')
    ], templates.outline),
    { eligible: false, reason: 'ambiguous' }
  );
  assert.deepStrictEqual(
    selectCurrentOutlineValidation([
      makeOutlineValidation('validation-outline-issues', '2026-08-28T12:31:00Z', 'issues-found')
    ], templates.outline),
    { eligible: false, reason: 'nonpassing' }
  );

  const snapshot = clone(templates.checkpoint);
  snapshot.id = 'checkpoint-pre-revision';
  snapshot.kind = 'state-snapshot';
  snapshot.status = 'available';
  snapshot.blocking = false;
  snapshot.request = 'Preserve portable state before the approved revision.';
  snapshot.options = [];
  snapshot.snapshot = {
    archive_uri: 'project://archives/checkpoints/checkpoint-pre-revision',
    resources: [{
      uri: 'project://state',
      revision: 1,
      sha256: 'a'.repeat(64)
    }]
  };
  const snapshotSchemaFile = path.join(schemasRoot, 'checkpoint.schema.json');
  assert.deepStrictEqual(
    validate(snapshot, loadSchema(snapshotSchemaFile), snapshotSchemaFile),
    [],
    'portable state snapshot checkpoint must validate'
  );
  const unsafeSnapshot = clone(snapshot);
  unsafeSnapshot.blocking = true;
  assertInvalid('checkpoint', unsafeSnapshot, /must equal false/);
  const interactionWithSnapshot = clone(templates.checkpoint);
  interactionWithSnapshot.snapshot = snapshot.snapshot;
  assertInvalid('checkpoint', interactionWithSnapshot, /forbidden schema/);

  assert.strictEqual(templates.evidence.source_uri, `project://sources/${templates.source.id}`);
  assert(
    templates.section.claims.some(claim =>
      claim.id === templates.evidence.claim_id &&
      claim.evidence_uris.includes(`project://evidence/${templates.evidence.id}`)
    ),
    'evidence fixture must resolve to a declared section claim'
  );
  assert.strictEqual(templates.validation.effects_applied.length, 0, 'persisted validation is read-only');
  assert(Array.isArray(templates.section.artifacts.plans), 'section plan history must be an array');
  assert(Array.isArray(templates.section.artifacts.reviews), 'section review history must be an array');
  assert(Array.isArray(templates.section.checkpoint_uris), 'section checkpoints must be explicitly linked');
  assert(
    fs.existsSync(path.join(repositoryRoot, 'protocol', 'roles', `${templates.validation.validator_role}.md`)),
    'validation fixture must name a canonical verifier role'
  );

  const traversal = clone(templates.manifest);
  traversal.artifacts.outline = 'project://structure/../outside';
  assertInvalid('manifest', traversal, /does not match/);

  const unsafeConfig = clone(templates.config);
  unsafeConfig.safety.destructive_requires_authorization = false;
  assertInvalid('config', unsafeConfig, /must equal true/);

  const ungroundedEvidence = clone(templates.evidence);
  delete ungroundedEvidence.source_uri;
  assertInvalid('evidence', ungroundedEvidence, /missing required property source_uri/);

  const mutatingValidation = clone(templates.validation);
  mutatingValidation.effects_applied = [{ id: 'file.write', scope: 'project://paper/introduction' }];
  assertInvalid('validation', mutatingValidation, /must equal \[\]/);

  const negativeProgress = clone(templates.state);
  negativeProgress.progress.word_count = -1;
  assertInvalid('state', negativeProgress, /below 0/);

  const forbiddenTokens = [
    /\bclaude(?: code)?\b/i,
    /\bcodex\b/i,
    /\bgemini\b/i,
    /\bopencode\b/i,
    /\bantigravity\b/i,
    /\bclio(?: coder)?\b/i,
    /allowed[-_]tools/i,
    /AskUserQuestion/i,
    /~[\\/]\.[A-Za-z0-9_-]+/,
    /\/home\//,
    /\bvendors[\\/]/i
  ];
  const protocolFiles = [];
  for (const directory of [projectRoot, schemasRoot, templatesRoot]) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isFile()) protocolFiles.push(path.join(directory, entry.name));
    }
  }
  for (const file of new Set(protocolFiles)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of forbiddenTokens) {
      assert.doesNotMatch(source, pattern, `${path.relative(repositoryRoot, file)} contains host-specific content`);
    }
  }

  for (const [name, template] of Object.entries(templates)) {
    walkStrings(template, (value, location) => {
      assert(!/^~(?:[\\/]|$)/.test(value), `${name}${location}: home-relative path is forbidden`);
      assert(!/^\/(?!\/)/.test(value), `${name}${location}: absolute filesystem path is forbidden`);
      assert(!/^[A-Za-z]:[\\/]/.test(value), `${name}${location}: drive path is forbidden`);
      if (value.startsWith('project://')) {
        assert.match(
          value,
          /^project:\/\/(?!\.{1,2}(?:\/|$))(?!.*\/\.{1,2}(?:\/|$))[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/,
          `${name}${location}: unsafe logical URI`
        );
      }
    });
  }

  console.log('✓ cross-record identifiers, dependencies, evidence, progress, and safety invariants align');
  console.log('✓ all project resources are host-neutral and path-portable');
  console.log('\n10 portable .planning v1 record contracts passed.');
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
