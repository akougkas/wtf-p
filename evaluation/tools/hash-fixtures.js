#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const { inventoryFixture } = require('../lib/fixture-hashes');

const fixturesRoot = path.resolve(__dirname, '../v1/fixtures');

const SEALED_SCHEMA = 'wtfp.evaluation.fixture/v1';

// Closed-world `wtfp.evaluation.fixture/v1` fixtures carry a byte manifest. A
// user-acceptance fixture is a template the user materializes, so its bytes
// are not this tool's to seal. A directory that already holds a manifest
// stays sealed: changing its schema is a check failure, never a way out of it.
function fixtureDirectories() {
  return fs.readdirSync(fixturesRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(fixturesRoot, entry.name))
    .filter(directory => fs.existsSync(path.join(directory, 'manifest.json')) ||
      JSON.parse(fs.readFileSync(path.join(directory, 'fixture.json'), 'utf8')).schema === SEALED_SCHEMA)
    .sort();
}

function expectedManifest(fixtureRoot) {
  const fixtureMetadata = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'fixture.json'), 'utf8'));
  const inventory = inventoryFixture(fixtureRoot);
  return {
    schema: 'wtfp.evaluation.fixture-hashes/v1',
    fixture_id: fixtureMetadata.id,
    fixture_version: fixtureMetadata.version,
    hash_algorithm: 'sha256',
    model_inputs_sha256: inventory.model_inputs_sha256,
    evaluator_oracles_sha256: inventory.evaluator_oracles_sha256,
    aggregate_sha256: inventory.aggregate_sha256,
    files: inventory.files
  };
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function checkFixture(fixtureRoot) {
  const manifestFile = path.join(fixtureRoot, 'manifest.json');
  const expected = expectedManifest(fixtureRoot);
  const schema = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'fixture.json'), 'utf8')).schema;
  if (schema !== SEALED_SCHEMA) {
    return { fixtureRoot, valid: false, expected, reason: `fixture.json changed its schema to ${schema} under a sealed manifest` };
  }
  if (!fs.existsSync(manifestFile)) {
    return { fixtureRoot, valid: false, expected, reason: 'manifest.json is missing' };
  }
  const actual = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  return {
    fixtureRoot,
    valid: stableJson(actual) === stableJson(expected),
    expected,
    reason: stableJson(actual) === stableJson(expected) ? null : 'manifest.json does not match fixture bytes'
  };
}

function main(argv = process.argv.slice(2)) {
  const check = argv.includes('--check');
  const results = fixtureDirectories().map(checkFixture);
  if (!check) {
    const output = Object.fromEntries(results.map(result => [path.basename(result.fixtureRoot), result.expected]));
    process.stdout.write(stableJson(output));
    return 0;
  }

  for (const result of results) {
    process.stdout.write(`${result.valid ? 'PASS' : 'FAIL'} ${path.basename(result.fixtureRoot)}` +
      `${result.reason ? `: ${result.reason}` : ''}\n`);
  }
  return results.every(result => result.valid) ? 0 : 1;
}

if (require.main === module) process.exitCode = main();

module.exports = {
  checkFixture,
  expectedManifest,
  fixtureDirectories
};
