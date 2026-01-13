const assert = require('assert');
const bibFormat = require('../../bin/lib/bib-format');

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

// Test 1: Format with Provenance
const output = bibFormat.format(paper, provenance);

assert.ok(output.includes('@conference{vaswani2017attention'), 'Should use conference type');
assert.ok(output.includes('wtfp_status="official"'), 'Should include wtfp_status');
assert.ok(output.includes('wtfp_citations="85000"'), 'Should include wtfp_citations');
assert.ok(output.includes('wtfp_velocity="1100"'), 'Should include wtfp_velocity');
assert.ok(output.includes('wtfp_fetched="2026-01-13"'), 'Should include wtfp_fetched');

// Test 2: Missing Fields handling
const incomplete = {
  key: 'draft2024',
  title: 'Draft Paper'
  // Missing author, year, venue
};

const outputIncomplete = bibFormat.format(incomplete);
assert.ok(outputIncomplete.includes('wtfp_status="incomplete"'), 'Should detect incomplete status');
assert.ok(outputIncomplete.includes('wtfp_missing="doi,author,venue,abstract"'), 'Should list missing fields');
assert.ok(outputIncomplete.includes('author="{MISSING_AUTHOR}"'), 'Should use placeholders');

// Test 3: Parsing (Round trip)
const parsed = bibFormat.parse(output);
assert.strictEqual(parsed.key, 'vaswani2017attention');
assert.strictEqual(parsed.title, 'Attention Is All You Need');

console.log('✔ bib-format tests passed');
