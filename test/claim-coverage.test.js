#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { analyzeCoverage, citationKeys, indexRecords, unsupportedRequired, STRUCTURAL_SCOPE } = require('../evaluation/lib/claim-coverage');

const templates = path.join(__dirname, '..', 'protocol', 'project', 'templates');
const read = (name) => JSON.parse(fs.readFileSync(path.join(templates, `${name}.json`), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));

const PROJECT = 'portable-research-demo';

function source(id, overrides = {}) {
  return {
    ...clone(read('source')),
    id,
    citation_key: id.replace(/^source-/, ''),
    ...overrides,
    provenance: { ...read('source').provenance, ...(overrides.provenance || {}) }
  };
}

function evidence(id, claim, sourceId, overrides = {}) {
  return { ...clone(read('evidence')), id, claim_id: claim, source_uri: `project://sources/${sourceId}`, ...overrides };
}

function claim(id, evidenceIds, overrides = {}) {
  return {
    id,
    statement: `Statement of ${id}.`,
    status: 'drafted',
    evidence_required: true,
    evidence_uris: evidenceIds.map(item => `project://evidence/${item}`),
    ...overrides
  };
}

function project(claims, evidenceRecords, sourceRecords, manuscripts = []) {
  const section = { ...clone(read('section')), claims };
  return {
    projectId: PROJECT,
    outline: read('outline'),
    sections: [{ uri: `project://sections/${section.id}`, record: section }],
    evidence: Object.fromEntries(evidenceRecords.map(item => [`project://evidence/${item.id}`, item])),
    sources: Object.fromEntries(sourceRecords.map(item => [`project://sources/${item.id}`, item])),
    manuscripts
  };
}

const codes = (report) => report.findings.map(item => `${item.severity}:${item.code}`);
const supportOf = (report, id) => report.claims.find(item => item.claim === id).support;

function check(name, run) {
  run();
  console.log(`✓ ${name}`);
}

check('the canonical templates form one fully supported claim', () => {
  const sectionRecord = read('section');
  const report = analyzeCoverage({
    projectId: PROJECT,
    outline: read('outline'),
    sections: [{ uri: `project://sections/${sectionRecord.id}`, record: sectionRecord }],
    evidence: { [`project://evidence/${read('evidence').id}`]: read('evidence') },
    sources: { [`project://sources/${read('source').id}`]: read('source') }
  });
  assert.strictEqual(report.scope, STRUCTURAL_SCOPE);
  assert.match(report.scope, /independent review/);
  const supported = report.claims.filter(item => item.support === 'full').map(item => item.claim);
  assert(supported.includes('claim-portable-state'), JSON.stringify(report.claims));
});

check('full-text support from a verified source is full; abstract support is partial and flagged', () => {
  const full = source('source-full');
  const abstract = source('source-abstract', { provenance: { inspection_depth: 'abstract' } });
  const report = analyzeCoverage(project(
    [claim('claim-full', ['evidence-full']), claim('claim-abstract', ['evidence-abstract'])],
    [evidence('evidence-full', 'claim-full', 'source-full'), evidence('evidence-abstract', 'claim-abstract', 'source-abstract', { inspection_depth: 'abstract' })],
    [full, abstract]
  ));
  assert.strictEqual(supportOf(report, 'claim-full'), 'full');
  assert.strictEqual(supportOf(report, 'claim-abstract'), 'partial');
  assert.deepStrictEqual(codes(report), ['info:support-abstract-only']);
});

check('a required claim with no evidence, or none that qualifies, is unsupported with a specific finding', () => {
  const report = analyzeCoverage(project(
    [claim('claim-bare', []), claim('claim-planned', [], { status: 'planned' }), claim('claim-optional', [], { evidence_required: false })],
    [],
    []
  ));
  assert.deepStrictEqual(codes(report), ['error:evidence-missing', 'warning:evidence-missing']);
  assert.deepStrictEqual(unsupportedRequired(report, 'introduction').sort(), ['claim-bare', 'claim-planned']);
});

check('dangling, cross-project, mismatched and dangling-source evidence each produce their own finding', () => {
  const report = analyzeCoverage(project(
    [claim('claim-x', ['evidence-missing', 'evidence-foreign', 'evidence-other-claim', 'evidence-no-source'])],
    [
      evidence('evidence-foreign', 'claim-x', 'source-ok', { project_id: 'another-project' }),
      evidence('evidence-other-claim', 'claim-y', 'source-ok'),
      evidence('evidence-no-source', 'claim-x', 'source-gone')
    ],
    [source('source-ok')]
  ));
  assert.deepStrictEqual(codes(report).sort(), [
    'error:evidence-claim-mismatch',
    'error:evidence-cross-project',
    'error:evidence-dangling',
    'error:source-dangling',
    'error:support-missing'
  ]);
  assert.strictEqual(supportOf(report, 'claim-x'), 'none');
});

check('a search candidate, a metadata-only inspection or an overstated inspection depth never becomes support', () => {
  const report = analyzeCoverage(project(
    [claim('claim-candidate', ['evidence-candidate']), claim('claim-metadata', ['evidence-metadata']), claim('claim-overstated', ['evidence-overstated'])],
    [
      evidence('evidence-candidate', 'claim-candidate', 'source-candidate'),
      evidence('evidence-metadata', 'claim-metadata', 'source-metadata', { inspection_depth: 'metadata' }),
      evidence('evidence-overstated', 'claim-overstated', 'source-metadata', { inspection_depth: 'full-text' })
    ],
    [
      source('source-candidate', { status: 'provisional', provenance: { discovered_via: 'scholarly-index', inspection_depth: 'metadata' } }),
      source('source-metadata', { provenance: { inspection_depth: 'metadata' } })
    ]
  ));
  for (const id of ['claim-candidate', 'claim-metadata', 'claim-overstated']) assert.strictEqual(supportOf(report, id), 'none', id);
  const found = codes(report);
  assert(found.includes('warning:source-provisional'), found.join());
  assert(found.includes('warning:inspection-metadata-only'), found.join());
  assert(found.includes('error:inspection-exceeds-source'), found.join());
});

check('a valid DOI on a retracted or unavailable source is structural identity, not support', () => {
  const report = analyzeCoverage(project(
    [claim('claim-retracted', ['evidence-retracted'], { status: 'verified' }), claim('claim-unavailable', ['evidence-unavailable'])],
    [evidence('evidence-retracted', 'claim-retracted', 'source-retracted'), evidence('evidence-unavailable', 'claim-unavailable', 'source-unavailable')],
    [source('source-retracted', { status: 'retracted' }), source('source-unavailable', { status: 'unavailable' })]
  ));
  const found = codes(report);
  assert(found.includes('blocker:source-retracted'), found.join());
  assert(found.includes('error:source-unavailable'), found.join());
  assert(found.includes('blocker:support-missing'), 'a verified claim without support is a blocker');
});

check('contradictory evidence marks the claim contested and blocks a verified label it cannot carry', () => {
  const report = analyzeCoverage(project(
    [claim('claim-contested', ['evidence-for', 'evidence-against']), claim('claim-refuted', ['evidence-refuting'], { status: 'verified' })],
    [
      evidence('evidence-for', 'claim-contested', 'source-a'),
      evidence('evidence-against', 'claim-contested', 'source-b', { relation: 'contradicts' }),
      evidence('evidence-refuting', 'claim-refuted', 'source-b', { relation: 'contradicts' })
    ],
    [source('source-a'), source('source-b')]
  ));
  assert.strictEqual(supportOf(report, 'claim-contested'), 'full');
  assert.strictEqual(report.claims.find(item => item.claim === 'claim-contested').contested, true);
  const found = codes(report);
  assert(found.includes('blocker:verified-against-evidence'), found.join());
  assert(found.includes('blocker:support-missing'), found.join());
});

check('a contested claim is not ready to draft, whether its contradiction is linked or only on record', () => {
  const report = analyzeCoverage(project(
    [
      claim('claim-linked', ['evidence-for', 'evidence-against']),
      claim('claim-unlinked', ['evidence-for-unlinked']),
      claim('claim-planned', ['evidence-for-planned', 'evidence-against-planned'], { status: 'planned' })
    ],
    [
      evidence('evidence-for', 'claim-linked', 'source-a'),
      evidence('evidence-against', 'claim-linked', 'source-b', { relation: 'contradicts' }),
      evidence('evidence-for-unlinked', 'claim-unlinked', 'source-a'),
      evidence('evidence-against-unlinked', 'claim-unlinked', 'source-b', { relation: 'contradicts' }),
      evidence('evidence-for-planned', 'claim-planned', 'source-a'),
      evidence('evidence-against-planned', 'claim-planned', 'source-b', { relation: 'contradicts' })
    ],
    [source('source-a'), source('source-b')]
  ));
  const found = codes(report);
  assert(found.includes('error:evidence-contradicts'), found.join());
  assert(found.includes('error:evidence-contradicts-unlinked'), found.join());
  assert(found.includes('warning:evidence-contradicts'), 'a planned claim is warned, not failed');
  assert.strictEqual(report.claims.find(item => item.claim === 'claim-unlinked').contested, true);
  assert.deepStrictEqual(unsupportedRequired(report, 'introduction').sort(), ['claim-linked', 'claim-planned', 'claim-unlinked']);
});

check('a claim id names one claim in the project, so a reused id supports neither claim', () => {
  const base = project([claim('claim-shared', ['evidence-shared'])], [evidence('evidence-shared', 'claim-shared', 'source-a')], [source('source-a')]);
  const other = { ...clone(base.sections[0].record), id: 'methods', claims: [claim('claim-shared', ['evidence-shared'], { statement: 'An unrelated claim.' })] };
  const report = analyzeCoverage({ ...base, sections: [...base.sections, { uri: 'project://sections/methods', record: other }] });
  assert.deepStrictEqual(report.claims.map(item => `${item.section}/${item.support}`).sort(), ['introduction/none', 'methods/none']);
  assert.strictEqual(codes(report).filter(code => code === 'error:claim-id-duplicate').length, 2);
});

check('records the loader leaves out are reported, and an id carried twice names neither record', () => {
  const { byUri, ignored } = indexRecords([
    { file: 'evidence/a.json', record: { id: 'evidence-one' } },
    { file: 'evidence/b.json', record: { id: 'evidence-one' } },
    { file: 'evidence/c.json', record: { id: 'evidence-two' } }
  ], 'evidence');
  assert.deepStrictEqual(Object.keys(byUri), ['project://evidence/evidence-two']);
  assert.deepStrictEqual(ignored.map(item => item.file), ['evidence/a.json', 'evidence/b.json']);
  const report = analyzeCoverage({ ...project([], [], []), ignored: [...ignored, { file: 'evidence/d.json', reason: 'it fails its schema' }] });
  assert.deepStrictEqual(codes(report), ['error:record-ignored', 'error:record-ignored', 'error:record-ignored']);
});

check('primary-data inspection needs a source inspected as primary data', () => {
  const report = analyzeCoverage(project(
    [claim('claim-overstated', ['evidence-overstated'])],
    [evidence('evidence-overstated', 'claim-overstated', 'source-paper', { inspection_depth: 'primary-data' })],
    [source('source-paper', { provenance: { inspection_depth: 'full-text' } })]
  ));
  assert.strictEqual(supportOf(report, 'claim-overstated'), 'none');
  assert(codes(report).includes('error:inspection-exceeds-source'), codes(report).join());
});

check('author-provided primary data supports a claim like inspected literature', () => {
  const report = analyzeCoverage(project(
    [claim('claim-measured', ['evidence-measured'])],
    [evidence('evidence-measured', 'claim-measured', 'source-lab-data', { inspection_depth: 'primary-data', locator: { kind: 'record', value: 'runs/2026-09-30.csv' } })],
    [source('source-lab-data', { kind: 'dataset', identifiers: { local_id: 'lab-data' }, provenance: { discovered_via: 'author-provided', inspection_depth: 'primary-data' } })]
  ));
  assert.strictEqual(supportOf(report, 'claim-measured'), 'full');
  assert.deepStrictEqual(codes(report), []);
});

check('manuscript citation keys must resolve to a usable source record', () => {
  assert.deepStrictEqual(citationKeys('See [@smith2024; @doe2023] and `@code` mail a@b.org.\n```\n@inside\n```', 'paper/intro.md'), ['doe2023', 'smith2024']);
  assert.deepStrictEqual(citationKeys('As \\citep[p.~3]{smith2024, doe2023}. % \\cite{commented}', 'paper/intro.tex'), ['doe2023', 'smith2024']);
  assert.deepStrictEqual(citationKeys('#cite(<smith2024>) and @doe2023', 'paper/intro.typ'), ['doe2023', 'smith2024']);
  const report = analyzeCoverage(project(
    [],
    [],
    [source('source-smith2024'), source('source-gone2020', { status: 'unavailable' })],
    [{ section: 'introduction', file: 'paper/introduction.md', text: 'Known [@smith2024], unknown [@nobody2021], lost [@gone2020].' }]
  ));
  assert.deepStrictEqual(codes(report).sort(), ['error:citation-unavailable', 'error:citation-unresolved']);
  const strays = analyzeCoverage(project(
    [],
    [],
    [
      source('source-candidate2025', { status: 'provisional' }),
      source('source-foreign2024', { project_id: 'another-project' }),
      source('source-twin2023'),
      source('source-twin2023-copy', { citation_key: 'twin2023' })
    ],
    [{ section: 'introduction', file: 'paper/introduction.md', text: 'See [@candidate2025], [@foreign2024] and [@twin2023].' }]
  ));
  assert.deepStrictEqual(codes(strays).sort(), ['error:citation-ambiguous', 'error:citation-cross-project', 'error:citation-provisional']);
});
