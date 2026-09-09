const assert = require('assert');
const bibFormat = require('../../bin/lib/bib-format');
const bibIndex = require('../../bin/lib/bib-index');

console.log('Running bib-format tests...');

// Test Data
const paper = {
  key: 'vaswani2017attention',
  entryType: 'inproceedings',
  author: 'Vaswani, Ashish and Shazeer, Noam',
  title: 'Attention Is All You Need',
  booktitle: 'NIPS',
  year: '2017',
  doi: '10.1234/5678',
  abstract: 'Transformer model...'
};

const provenance = {
  wtfp_status: 'official',
  wtfp_source: 'semantic_scholar',
  wtfp_citations: 85000,
  wtfp_velocity: 1100,
  wtfp_fetched: '2026-01-13'
};

// Test 1: default output is standard BibTeX with provenance
const output = bibFormat.format(paper, provenance);
assert.ok(output.startsWith('@inproceedings{vaswani2017attention,'), 'default output uses the standard entry type');
assert.ok(!output.includes('entry_type'), 'default output carries no al-folio site field');
assert.ok(!output.includes('bibtex_show'), 'default output carries no al-folio site field');
assert.ok(output.includes('booktitle = {NIPS}'), 'inproceedings venue is booktitle');
assert.ok(output.includes('wtfp_status = {official}'), 'Should include wtfp_status');
assert.ok(output.includes('wtfp_citations = {85000}'), 'Should include wtfp_citations');
assert.ok(output.includes('wtfp_velocity = {1100}'), 'Should include wtfp_velocity');
assert.ok(output.includes('wtfp_fetched = {2026-01-13}'), 'Should include wtfp_fetched');
assert.ok(output.includes('url = {https://doi.org/10.1234/5678}'), 'DOI derives the URL');

// Test 2: an article uses journal, and al-folio pseudo-types fold back to standard ones
const article = bibFormat.format({ ...paper, entryType: 'journal', booktitle: 'JMLR' }, provenance);
assert.ok(article.startsWith('@article{'), 'journal folds back to article');
assert.ok(article.includes('journal = {JMLR}'), 'article venue is journal');
assert.strictEqual(bibFormat.normalizeEntryType('conference'), 'inproceedings');
assert.strictEqual(bibFormat.normalizeEntryType('Article'), 'article');
assert.strictEqual(bibFormat.normalizeEntryType('weird'), 'misc');

// Test 3: every default entry round-trips through the bib-index parser with a standard type
for (const entryType of ['article', 'inproceedings', 'book', 'phdthesis', 'techreport', 'journal', 'conference', 'unknown']) {
  const formatted = bibFormat.format({ ...paper, key: `rt_${entryType}`, entryType }, provenance);
  const parsed = bibIndex.parseEntries(formatted);
  assert.strictEqual(parsed.length, 1, `${entryType}: one entry must parse back`);
  assert.strictEqual(parsed[0].key, `rt_${entryType}`);
  assert.strictEqual(parsed[0].title, paper.title);
  assert.strictEqual(parsed[0].year, paper.year);
  assert.ok(bibFormat.STANDARD_ENTRY_TYPES.includes(parsed[0].type), `${entryType} projected to non-standard type ${parsed[0].type}`);
  const reparsed = bibFormat.parse(formatted);
  assert.strictEqual(reparsed.entryType, parsed[0].type);
  assert.strictEqual(reparsed.author, paper.author);
  assert.strictEqual(reparsed.doi, paper.doi);
}

// Test 4: wtfp_missing reports every placeholder the body emits
const incomplete = {
  key: 'draft2024',
  title: 'Draft Paper'
  // Missing author, year, venue
};
const outputIncomplete = bibFormat.format(incomplete);
assert.ok(outputIncomplete.includes('wtfp_status = {incomplete}'), 'Should detect incomplete status');
assert.ok(outputIncomplete.includes('wtfp_missing = {doi,author,venue,year,abstract}'), 'Should list missing fields');
assert.ok(outputIncomplete.includes('author = {{MISSING_AUTHOR}}'), 'Should use placeholders');
const bare = bibFormat.format({ key: 'bare' });
assert.ok(bare.includes('title = {{MISSING_TITLE}}') && bare.includes('year = {{????}}'), 'placeholders are emitted');
assert.ok(bare.includes('wtfp_missing = {doi,author,title,venue,year,abstract}'), 'title and year are reported when missing');

// Test 5: the al-folio projection is available only by explicit style
const alFolio = bibFormat.format(paper, provenance, { style: 'al-folio' });
assert.ok(alFolio.startsWith('@conference{vaswani2017attention'), 'al-folio uses its pseudo-type');
assert.ok(alFolio.includes('entry_type="conference"'), 'al-folio carries its site fields');
assert.ok(alFolio.includes('wtfp_missing=""'), 'al-folio reports nothing missing for a complete entry');
assert.throws(() => bibFormat.format(paper, provenance, { style: 'jekyll' }), /unknown bibliography style/);

// Test 6: Parsing (Round trip)
const parsed = bibFormat.parse(output);
assert.strictEqual(parsed.key, 'vaswani2017attention');
assert.strictEqual(parsed.title, 'Attention Is All You Need');

console.log('✔ bib-format tests passed');
