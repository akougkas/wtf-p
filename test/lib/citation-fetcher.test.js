const assert = require('assert');
const fetcher = require('../../bin/lib/citation-fetcher');
const semanticScholar = require('../../bin/lib/semantic-scholar');
const scholar = require('../../bin/lib/scholar-lookup');

console.log('Running citation-fetcher integration tests...');

const originalSemanticScholarSearch = semanticScholar.search;
const originalScholarAvailable = scholar.isAvailable;
let semanticScholarSearchCalls = 0;

async function runTests() {
  try {
    // Keep the required graph offline: five results avoid the CrossRef fallback.
    scholar.isAvailable = () => false;
    semanticScholar.search = async () => {
      semanticScholarSearchCalls += 1;
      return [
      {
        paperId: 's2-attention',
        externalIds: { DOI: '10.5555/3295222.3295349' },
        title: 'Attention Is All You Need',
        abstract: 'A deterministic test fixture.',
        venue: 'NeurIPS',
        year: 2017,
        citationCount: 50000,
        authors: [{ name: 'Ashish Vaswani' }],
        openAccessPdf: null
      },
      ...Array.from({ length: 4 }, (_, index) => ({
        paperId: `s2-fixture-${index}`,
        externalIds: {},
        title: `Fixture Paper ${index}`,
        abstract: 'Offline fixture.',
        venue: 'Unknown',
        year: 2000,
        citationCount: index,
        authors: [{ name: `Author ${index}` }],
        openAccessPdf: null
      }))
      ];
    };

    const result = await fetcher.search('attention is all you need', { limit: 1 });
    
    assert.ok(result.results.length > 0, 'Should find at least one paper');
    const paper = result.results[0];
    
    assert.strictEqual(paper.source, 'semantic_scholar', 'Source should be S2');
    assert.strictEqual(paper.paperId, 's2-attention', 'Ranking should retain the strongest fixture');
    assert.ok(paper.bibtex.includes('wtfp_status'), 'BibTeX should have provenance');
    assert.deepStrictEqual(result.metadata.errors, [], 'Offline fixture should not report provider failures');
    assert.strictEqual(semanticScholarSearchCalls, 1, 'citation.fetch must perform its declared provider search');
    
    console.log('✔ citation-fetcher integration test passed');
  } catch (e) {
    console.error('Test failed:', e);
    process.exitCode = 1;
  } finally {
    semanticScholar.search = originalSemanticScholarSearch;
    scholar.isAvailable = originalScholarAvailable;
  }
}

runTests();
