#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rolesDirectory = path.join(__dirname, '..', 'protocol', 'roles');

const expected = new Map([
  ['outliner', 'mutation-report'],
  ['section-planner', 'mutation-report'],
  ['plan-checker', 'verifier-report'],
  ['section-writer', 'mutation-report'],
  ['argument-verifier', 'verifier-report'],
  ['section-reviewer', 'verifier-report'],
  ['coherence-checker', 'verifier-report'],
  ['prose-polisher', 'mutation-report'],
  ['research-synthesizer', 'mutation-report'],
  ['citation-expert', 'mutation-report'],
  ['citation-formatter', 'mutation-report']
]);

const requiredSections = [
  'Purpose',
  'Capability classes',
  'Inputs',
  'Procedure',
  'Boundaries',
  'Result contract'
];

const requiredResultFields = [
  'schema',
  'role',
  'action',
  'status',
  'summary',
  'artifacts',
  'issues',
  'next_actions',
  'effects_applied'
];

const forbidden = [
  ['vendor-specific assistant name', /\bclaude\b/i],
  ['vendor or company name', /\banthropic\b/i],
  ['vendor-specific model tier', /\b(?:sonnet|opus|haiku)\b/i],
  ['host tool allowlist', /allowed[-_]tools/i],
  ['host profile path', /~[\\/]\.claude/i],
  ['vendor source path', /\bvendors[\\/]/i],
  ['host interaction tool', /AskUserQuestion/i],
  ['host-prefixed capability', /\bmcp__/i],
  ['host web tool', /\bWeb(?:Search|Fetch)\b/],
  ['host orchestration element', /<\/?task\b/i],
  ['host orchestration call', /\bTask\s*\(/],
  ['host agent selector', /\bsubagent_type\b/i]
];

function frontmatterValue(source, key) {
  const match = source.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  return match && match[1];
}

function validateRole(slug, executionClass, source) {
  const expectedContract = `wtfp.role.${slug}/v1`;

  assert.strictEqual(frontmatterValue(source, 'id'), slug, `${slug}: stable lookup id`);
  assert.strictEqual(
    frontmatterValue(source, 'contract'),
    expectedContract,
    `${slug}: versioned contract id`
  );
  assert.strictEqual(
    frontmatterValue(source, 'execution_class'),
    executionClass,
    `${slug}: execution class`
  );
  assert.strictEqual(
    frontmatterValue(source, 'result_schema'),
    'protocol://schemas/role-result.schema.json',
    `${slug}: portable result schema`
  );

  for (const section of requiredSections) {
    assert.match(source, new RegExp(`^## ${section}$`, 'm'), `${slug}: missing ${section} section`);
  }

  for (const field of requiredResultFields) {
    assert.match(
      source,
      new RegExp('^[-*] `' + field + '`:', 'm'),
      `${slug}: result contract must describe ${field}`
    );
  }

  assert.match(source, /\bproject:\/\//, `${slug}: must use project-scoped logical resources`);
  assert.match(source, /\bprotocol:\/\//, `${slug}: must use protocol-scoped logical resources`);
  assert.match(source, /\bcapability class(?:es)?\b/i, `${slug}: must declare capability classes`);
  assert.match(source, /\b(?:do not|never) commit\b/i, `${slug}: commit boundary must be explicit`);
  assert.match(source, /\b(?:delete|destructive)\b/i, `${slug}: deletion boundary must be explicit`);
  assert.match(
    source,
    /\b(?:do not|never) (?:solicit|prompt|contact|directly prompt|request input from|initiate human interaction)\b/i,
    `${slug}: worker-side human interaction boundary must be explicit`
  );

  if (executionClass === 'verifier-report') {
    assert.match(source, /strictly read-only|must not edit/i, `${slug}: verifier must be read-only`);
    assert.match(
      source,
      /effects_applied\`: always an empty list/i,
      `${slug}: verifier effects must always be empty`
    );
  } else {
    assert.match(
      source,
      /may (?:write|modify|create|replace).*authoriz|may be written when authoriz|only when .*authoriz|only when the action contract grants|authorized by the invoking action/i,
      `${slug}: mutation must be tied to an authorized action effect`
    );
  }

  for (const [label, pattern] of forbidden) {
    assert.doesNotMatch(source, pattern, `${slug}: contains ${label}`);
  }
}

function main() {
  const files = fs.readdirSync(rolesDirectory)
    .filter(file => file.endsWith('.md'))
    .sort();

  assert.strictEqual(files.length, 11, 'canonical role set must contain exactly 11 Markdown contracts');
  assert.deepStrictEqual(
    files.map(file => path.basename(file, '.md')).sort(),
    [...expected.keys()].sort(),
    'canonical role filenames must match the supported role catalog'
  );

  const ids = new Set();
  for (const [slug, executionClass] of expected) {
    const source = fs.readFileSync(path.join(rolesDirectory, `${slug}.md`), 'utf8');
    validateRole(slug, executionClass, source);
    const id = frontmatterValue(source, 'id');
    assert(!ids.has(id), `duplicate role id: ${id}`);
    ids.add(id);
    console.log(`✓ ${slug} is a portable ${executionClass} contract`);
  }

  assert.strictEqual(ids.size, 11, 'all canonical role ids must be unique');
  console.log('\n11 portable role contracts passed.');
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
