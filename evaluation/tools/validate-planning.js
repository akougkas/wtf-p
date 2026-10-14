#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const { SchemaRegistry, readJson, validateInstance } = require('../lib/json-schema');
const { analyzeCoverage } = require('../lib/claim-coverage');

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

function validatePlanningPaths(inputs, options = {}) {
  const registry = new SchemaRegistry(schemaFiles());
  const roots = [];
  const coverage = [];
  for (const input of inputs) {
    const resolved = resolveInput(input);
    if (options.coverage) coverage.push(coverageForRoot(resolved));
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
    roots,
    ...(options.coverage ? { coverage } : {})
  };
}

// Structural claim coverage for one planning root, from the same validator the
// Clio desk ships. Manuscripts are read only for citation keys, from the
// project's paper/ directory beside .planning, and never through a link.
function coverageForRoot(resolved) {
  const records = {};
  for (const file of resolved.files) {
    try {
      const value = readJson(file);
      if (value && typeof value.schema === 'string') records[path.relative(resolved.root, file).split(path.sep).join('/')] = value;
    } catch {
      // Unreadable records are already reported by schema validation.
    }
  }
  const byType = (type) => Object.entries(records).filter(([, value]) => value.schema === `wtfp.project.${type}/v1`);
  const manifest = byType('manifest').map(([, value]) => value)[0] || null;
  const outline = byType('outline').map(([, value]) => value)[0] || null;
  const sections = byType('section').map(([, record]) => ({ uri: `project://sections/${record.id}`, record }));
  const keyed = (type, prefix) => Object.fromEntries(byType(type).map(([, record]) => [`project://${prefix}/${record.id}`, record]));
  const projectRoot = path.basename(resolved.root) === '.planning' ? path.dirname(resolved.root) : null;
  const manuscripts = [];
  for (const { record } of projectRoot ? sections : []) {
    const uri = record.artifacts && record.artifacts.manuscript;
    if (typeof uri !== 'string' || !uri.startsWith('project://paper/')) continue;
    const artifact = uri.slice('project://paper/'.length);
    if (artifact.split('/').some(part => part === '' || part === '.' || part === '..')) continue;
    for (const candidate of [artifact, `${artifact}.md`, `${artifact}.tex`, `${artifact}.typ`]) {
      const file = path.join(projectRoot, 'paper', candidate);
      let stat;
      try { stat = fs.lstatSync(file); } catch { continue; }
      if (!stat.isFile()) continue;
      manuscripts.push({ section: record.id, file: `paper/${candidate}`, text: fs.readFileSync(file, 'utf8') });
      break;
    }
  }
  const report = analyzeCoverage({
    projectId: manifest ? manifest.id : null,
    outline,
    sections,
    evidence: keyed('evidence', 'evidence'),
    sources: keyed('source', 'sources'),
    manuscripts
  });
  return {
    planning_root: resolved.root,
    scope: report.scope,
    valid: !report.findings.some(finding => finding.severity === 'blocker' || finding.severity === 'error'),
    findings: report.findings,
    claims: report.claims
  };
}

function usage() {
  return [
    'Usage: node evaluation/tools/validate-planning.js [--json] [--coverage] <project-or-record> [...]',
    '',
    'Directories containing .planning are resolved to that child. The command reads',
    'JSON records recursively and validates each schema discriminator against the',
    'canonical protocol/project/schemas contract. It never modifies its inputs.',
    '--coverage adds structural claim/evidence/source coverage and manuscript citation',
    'keys. It never judges whether a passage supports a claim; that needs a reviewer.'
  ].join('\n');
}

function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  const withCoverage = argv.includes('--coverage');
  const help = argv.includes('--help') || argv.includes('-h');
  const inputs = argv.filter(argument => !['--json', '--coverage', '--help', '-h'].includes(argument));
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
    result = validatePlanningPaths(inputs, { coverage: withCoverage });
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
    for (const report of result.coverage || []) {
      for (const finding of report.findings) {
        process.stdout.write(`${finding.severity.toUpperCase()} ${finding.code} ${finding.subject}: ${finding.message}\n`);
      }
      process.stdout.write(`${report.valid ? 'PASS' : 'FAIL'}: coverage of ${report.claims.length} claim(s) in ${report.planning_root}\n${report.scope}\n`);
    }
  }
  const coverageValid = (result.coverage || []).every(report => report.valid);
  return result.valid && coverageValid ? 0 : 1;
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
