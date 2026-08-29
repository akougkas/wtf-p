'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function walkFiles(root, relative = '') {
  const files = [];
  const directory = path.join(root, relative);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const childRelative = path.join(relative, entry.name);
    const absolute = path.join(root, childRelative);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`fixture contains a symbolic link: ${absolute}`);
    if (entry.isDirectory()) files.push(...walkFiles(root, childRelative));
    else if (entry.isFile()) files.push(toPosix(childRelative));
    else throw new Error(`fixture contains an unsupported filesystem entry: ${absolute}`);
  }
  return files;
}

function inventoryFixture(fixtureRoot) {
  const descriptor = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'fixture.json'), 'utf8'));
  const modelInputs = new Set(descriptor.model_visible_inputs.map(input => input.path));
  const evaluatorOracles = new Set(descriptor.evaluator_only_oracles.map(input => input.path));
  for (const relative of modelInputs) {
    if (evaluatorOracles.has(relative)) throw new Error(`fixture path has two audiences: ${relative}`);
  }
  const files = walkFiles(fixtureRoot)
    .filter(relative => relative !== 'manifest.json')
    .map(relative => ({
      path: relative,
      bytes: fs.statSync(path.join(fixtureRoot, relative)).size,
      sha256: sha256(fs.readFileSync(path.join(fixtureRoot, relative))),
      audience: relative === 'fixture.json'
        ? 'harness'
        : modelInputs.has(relative)
          ? 'model'
          : evaluatorOracles.has(relative)
            ? 'evaluator'
            : 'undeclared'
    }));
  const undeclared = files.filter(file => file.audience === 'undeclared').map(file => file.path);
  if (undeclared.length > 0) throw new Error(`fixture has undeclared files: ${undeclared.join(', ')}`);
  const actualPaths = new Set(files.map(file => file.path));
  for (const declared of [...modelInputs, ...evaluatorOracles]) {
    if (!actualPaths.has(declared)) throw new Error(`fixture declares a missing file: ${declared}`);
  }
  function digestAudience(audience) {
    const serialized = files.filter(file => file.audience === audience)
      .map(file => `${file.path}\0${file.bytes}\0${file.sha256}\n`).join('');
    return sha256(Buffer.from(serialized, 'utf8'));
  }
  const aggregate = files.map(file => `${file.path}\0${file.bytes}\0${file.sha256}\n`).join('');
  return {
    files,
    model_inputs_sha256: digestAudience('model'),
    evaluator_oracles_sha256: digestAudience('evaluator'),
    aggregate_sha256: sha256(Buffer.from(aggregate, 'utf8'))
  };
}

module.exports = {
  inventoryFixture,
  sha256,
  walkFiles
};
