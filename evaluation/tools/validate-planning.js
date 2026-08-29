#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const { SchemaRegistry, readJson, validateInstance } = require('../lib/json-schema');

const repositoryRoot = path.resolve(__dirname, '../..');
const schemasRoot = path.join(repositoryRoot, 'protocol', 'project', 'schemas');
const recordPattern = /^wtfp\.project\.([a-z][a-z0-9-]*)\/v1$/;

function schemaFiles() {
  return fs.readdirSync(schemasRoot)
    .filter(name => name.endsWith('.schema.json'))
    .map(name => path.join(schemasRoot, name));
}

function walkJsonFiles(root, relative = '') {
  const files = [];
  const directory = path.join(root, relative);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const childRelative = path.join(relative, entry.name);
    const absolute = path.join(root, childRelative);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`refusing symbolic link in planning input: ${absolute}`);
    if (entry.isDirectory()) files.push(...walkJsonFiles(root, childRelative));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(absolute);
  }
  return files;
}

function resolveInput(input) {
  const absolute = path.resolve(input);
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) throw new Error(`refusing symbolic-link input: ${absolute}`);
  if (stat.isFile()) return { root: path.dirname(absolute), files: [absolute] };
  if (!stat.isDirectory()) throw new Error(`planning input is neither a file nor directory: ${absolute}`);

  const planning = path.join(absolute, '.planning');
  let root = absolute;
  if (fs.existsSync(planning)) {
    const planningStat = fs.lstatSync(planning);
    if (planningStat.isSymbolicLink()) throw new Error(`refusing symbolic-link planning root: ${planning}`);
    if (!planningStat.isDirectory()) throw new Error(`.planning is not a directory: ${planning}`);
    root = planning;
  }
  return { root, files: walkJsonFiles(root) };
}

function validateRecord(file, root, registry) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  let value;
  try {
    value = readJson(file);
  } catch (error) {
    return {
      file: relative,
      record_type: null,
      valid: false,
      errors: [`$: invalid JSON (${error.message})`]
    };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      file: relative,
      record_type: null,
      valid: false,
      errors: ['$: planning record must be a JSON object']
    };
  }

  const match = typeof value.schema === 'string' && value.schema.match(recordPattern);
  if (!match) {
    return {
      file: relative,
      record_type: null,
      valid: false,
      errors: ['$: missing or unsupported wtfp.project.<record>/v1 schema discriminator']
    };
  }

  const recordType = match[1];
  const schemaFile = path.join(schemasRoot, `${recordType}.schema.json`);
  if (!fs.existsSync(schemaFile)) {
    return {
      file: relative,
      record_type: recordType,
      valid: false,
      errors: [`$: canonical schema is unavailable for record type ${recordType}`]
    };
  }

  const errors = validateInstance(value, registry.get(schemaFile), schemaFile, registry);
  return {
    file: relative,
    record_type: recordType,
    valid: errors.length === 0,
    errors
  };
}

function validatePlanningPaths(inputs) {
  const registry = new SchemaRegistry(schemaFiles());
  const roots = [];
  for (const input of inputs) {
    const resolved = resolveInput(input);
    const records = resolved.files.map(file => validateRecord(file, resolved.root, registry));
    if (records.length === 0) {
      records.push({
        file: '.',
        record_type: null,
        valid: false,
        errors: ['$: no JSON planning records found']
      });
    }
    roots.push({
      input: path.resolve(input),
      planning_root: resolved.root,
      valid: records.every(record => record.valid),
      records
    });
  }

  const checked = roots.reduce((sum, root) => sum + root.records.length, 0);
  return {
    schema: 'wtfp.evaluation.planning-validation/v1',
    valid: roots.every(root => root.valid),
    checked,
    roots
  };
}

function usage() {
  return [
    'Usage: node evaluation/tools/validate-planning.js [--json] <project-or-record> [...]',
    '',
    'Directories containing .planning are resolved to that child. The command reads',
    'JSON records recursively and validates each schema discriminator against the',
    'canonical protocol/project/schemas contract. It never modifies its inputs.'
  ].join('\n');
}

function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  const help = argv.includes('--help') || argv.includes('-h');
  const inputs = argv.filter(argument => !['--json', '--help', '-h'].includes(argument));
  if (help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (inputs.length === 0) {
    process.stderr.write(`${usage()}\n`);
    return 2;
  }

  let result;
  try {
    result = validatePlanningPaths(inputs);
  } catch (error) {
    if (json) {
      process.stdout.write(`${JSON.stringify({
        schema: 'wtfp.evaluation.planning-validation/v1',
        valid: false,
        error: error.message
      }, null, 2)}\n`);
    } else {
      process.stderr.write(`planning validation failed: ${error.message}\n`);
    }
    return 2;
  }

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    for (const root of result.roots) {
      for (const record of root.records) {
        const marker = record.valid ? 'PASS' : 'FAIL';
        process.stdout.write(`${marker} ${path.join(root.planning_root, record.file)}` +
          `${record.record_type ? ` (${record.record_type})` : ''}\n`);
        for (const error of record.errors) process.stdout.write(`  ${error}\n`);
      }
    }
    process.stdout.write(`${result.valid ? 'PASS' : 'FAIL'}: ${result.checked} planning record(s) checked\n`);
  }
  return result.valid ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  resolveInput,
  validatePlanningPaths,
  validateRecord,
  walkJsonFiles
};
