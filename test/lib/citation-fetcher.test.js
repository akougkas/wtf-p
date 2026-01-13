const assert = require('assert');
const fetcher = require('../../bin/lib/citation-fetcher');

console.log('Running citation-fetcher integration tests...');

async function runTests() {
  try {
    // Test 1: Real search for a known paper
    console.log('Searching for "attention is all you need"...');
    const result = await fetcher.search('attention is all you need', { limit: 1 });
    
    assert.ok(result.results.length > 0, 'Should find at least one paper');
    const paper = result.results[0];
    
    if (paper.source !== 'semantic_scholar') {
        console.warn('Paper source was not S2. Metadata errors:', result.metadata.errors);
    }
    assert.strictEqual(paper.source, 'semantic_scholar', 'Source should be S2');
    assert.ok(paper.bibtex.includes('wtfp_status'), 'BibTeX should have provenance');
    
    // Test 2: Verify CrossRef fallback (force by query or mock?)
    // Hard to force fallback without mocking S2 error. 
    // We'll skip forcing fallback in this simple integration test to avoid flakiness.
    
    // Test 3: Deduplication check (conceptually)
    // If we search for something common, we hopefully don't get duplicates.
    
    console.log('✔ citation-fetcher integration test passed');
  } catch (e) {
    console.error('Test failed:', e);
    process.exit(1);
  }
}

runTests();
