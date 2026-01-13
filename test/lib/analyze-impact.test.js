const assert = require('assert');
const analyzer = require('../../bin/lib/analyze-impact');
const s2 = require('../../bin/lib/semantic-scholar');
const bibIndex = require('../../bin/lib/bib-index');
const ranker = require('../../bin/lib/citation-ranker');

const fs = require('fs');

console.log('Running analyze-impact tests...');

// Mock dependencies
const originalS2Search = s2.search;
const originalIndex = bibIndex.index;

async function runTests() {
  const dummyBib = 'dummy.bib';
  fs.writeFileSync(dummyBib, '@article{seminal2017, title={Seminal Paper}}');

  try {
    // Mock Bib Index
    bibIndex.index = () => JSON.stringify([
      { key: 'seminal2017', title: 'Seminal Paper', year: 2017 },
      { key: 'rising2024', title: 'Rising Star', year: 2024 },
      { key: 'old2000', title: 'Old Paper', year: 2000 }
    ]);

    // Mock S2 Search
    s2.search = async (query) => {
      if (query === 'Seminal Paper') {
        return [{ title: 'Seminal Paper', year: 2017, citationCount: 5000, venue: 'NeurIPS' }];
      }
      if (query === 'Rising Star') {
        return [{ title: 'Rising Star', year: 2024, citationCount: 300, venue: 'NeurIPS' }]; // High velocity
      }
      if (query === 'Old Paper') {
        return [{ title: 'Old Paper', year: 2000, citationCount: 10, venue: 'Unknown' }];
      }
      return [];
    };

    // Run analysis
    // We pass a dummy path because we mocked the indexer
    const result = await analyzer.analyze('dummy.bib');

    // Verify Seminal
    assert.strictEqual(result.seminal.length, 1);
    assert.strictEqual(result.seminal[0].key, 'seminal2017');
    
    // Verify Rising
    // Velocity: 100 citations in ~1-2 years. > 10/month.
    assert.strictEqual(result.rising.length, 1);
    assert.strictEqual(result.rising[0].key, 'rising2024');

    // Verify Outdated
    assert.strictEqual(result.outdated.length, 1);
    assert.strictEqual(result.outdated[0].key, 'old2000');

    console.log('✔ analyze-impact tests passed');
  } catch (e) {
    console.error('Test failed:', e);
    process.exit(1);
  } finally {
    s2.search = originalS2Search;
    bibIndex.index = originalIndex;
    if (fs.existsSync(dummyBib)) fs.unlinkSync(dummyBib);
  }
}

runTests();
