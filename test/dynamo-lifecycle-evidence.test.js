#!/usr/bin/env node

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..');
const evidenceRoot = path.join(
  repositoryRoot,
  'evaluation',
  'v1',
  'evidence',
  'clio-dynamo-lifecycle-blocked'
);

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(evidenceRoot, relative), 'utf8'));
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function test(name, callback) {
  callback();
  process.stdout.write(`✓ ${name}\n`);
}

test('typed blocked evidence validates and compares as an honest regression', () => {
  const baseline = path.join(repositoryRoot, 'evaluation', 'v1', 'baselines', 'hpc-checkpointing.json');
  const result = path.join(evidenceRoot, 'result.json');
  const comparison = spawnSync(process.execPath, [
    'evaluation/tools/compare-results.js', '--json', baseline, result
  ], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    timeout: 30000
  });
  assert.strictEqual(comparison.status, 1, comparison.stderr);
  assert.deepStrictEqual(JSON.parse(comparison.stdout), readJson('comparison.json'));
  assert.strictEqual(readJson('result.json').outcome, 'blocked');
});

test('all five retained records remain byte-exact and literally schema-valid', () => {
  const validation = spawnSync(process.execPath, [
    'evaluation/tools/validate-planning.js', path.join(evidenceRoot, 'records')
  ], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    timeout: 30000
  });
  assert.strictEqual(validation.status, 0, validation.stderr);
  assert.match(validation.stdout, /PASS: 5 planning record\(s\) checked/u);
  const receipt = readJson('evidence/planning-validation.json');
  for (const record of receipt.records) {
    const bytes = fs.readFileSync(path.join(evidenceRoot, record.path));
    assert.strictEqual(bytes.length, record.bytes, record.path);
    assert.strictEqual(sha256(bytes), record.sha256, record.path);
    assert.strictEqual(record.schema_valid, true, record.path);
  }
  assert.deepStrictEqual(receipt.literal_schema_validation, {
    validator: 'evaluation/tools/validate-planning.js',
    read_only: true,
    checked: 5,
    valid: 5,
    invalid: 0,
    errors: []
  });
});

test('the cross-record and forbidden-tool failures remain explicit hard gates', () => {
  const planning = readJson('evidence/planning-validation.json');
  assert.strictEqual(planning.cross_record_validation.valid, false);
  assert.deepStrictEqual(planning.cross_record_validation.errors, [
    'outline word targets total 5600, expected 6000'
  ]);
  const tools = readJson('evidence/tool-mutation-audit.json');
  assert.strictEqual(tools.forbidden_attempts.length, 1);
  assert.strictEqual(tools.forbidden_attempts[0].tool, 'bash');
  assert.strictEqual(tools.forbidden_attempts[0].outcome, 'blocked');
  assert.strictEqual(tools.forbidden_attempts[0].effect_observed, false);
  assert.strictEqual(tools.campaign_hard_failure, true);
});

test('native fleet validation and both local-model attempts are identity-bound', () => {
  const summary = readJson('evidence/run-summary.json');
  assert.strictEqual(summary.fleet_validation['wtfp-plan-section'].valid, true);
  assert.strictEqual(summary.fleet_validation['wtfp-draft-review'].valid, true);
  assert.deepStrictEqual(summary.runs.map(run => run.client_outcome), ['canceled', 'succeeded']);
  assert.deepStrictEqual(summary.runs.map(run => run.trace.retained), [false, false]);
  assert.strictEqual(summary.runs[1].campaign_disposition, 'blocked-before-action-02');
  assert.strictEqual(summary.runtime.reported_model_id, 'qwen3.8-27b');
});

test('normal profiles stayed unchanged and no credential was forwarded', () => {
  const audit = readJson('evidence/git-profile-credential-audit.json');
  assert(audit.normal_profiles.every(profile =>
    profile.unchanged && profile.before_sha256 === profile.after_sha256
  ));
  assert.strictEqual(audit.credentials.forwarded, false);
  assert.strictEqual(audit.credentials.cleanup_status, 'not-forwarded');
  assert.strictEqual(audit.disposable_roots.removed_after_sanitized_evidence_capture, true);
  const baseline = JSON.parse(fs.readFileSync(
    path.join(repositoryRoot, 'evaluation', 'v1', 'baselines', 'hpc-checkpointing.json'),
    'utf8'
  ));
  assert.strictEqual(baseline.evidence_status, 'definition-only');
  assert.deepStrictEqual(baseline.observed_runs, []);
});

process.stdout.write('\n5 Dynamo lifecycle evidence checks passed.\n');
