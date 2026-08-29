const assert = require('assert');
const analyzer = require('../../bin/lib/analyze-impact');
const s2 = require('../../bin/lib/semantic-scholar');
const bibIndex = require('../../bin/lib/bib-index');
const ranker = require('../../bin/lib/citation-ranker');

const fs = require('fs');
const os = require('os');
const path = require('path');

console.log('Running analyze-impact tests...');

// Mock dependencies
const originalS2Search = s2.search;
const originalIndex = bibIndex.index;
const originalTimezone = process.env.TZ;

async function runTests() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-analyze-impact-'));
  const dummyBib = path.join(tempRoot, 'dummy.bib');
  fs.writeFileSync(dummyBib, '@article{seminal2017, title={Seminal Paper}}');
  const referenceDate = new Date('2026-01-01T00:30:00Z');

  try {
    // Mock Bib Index
    bibIndex.index = () => JSON.stringify([
      { key: 'seminal2017', title: 'Seminal Paper', year: 2017 },
      { key: 'rising2024', title: 'Rising Star', year: 2024 },
      { key: 'old2010', title: 'Old Paper', year: 2010 }
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
        return [{ title: 'Old Paper', year: 2010, citationCount: 10, venue: 'Unknown' }];
      }
      return [];
    };

    // Run analysis
    // We pass a dummy path because we mocked the indexer
    process.env.TZ = 'America/Chicago';
    const result = await analyzer.analyze(dummyBib, { referenceDate, batchDelayMs: 0 });
    await assert.rejects(
      () => analyzer.analyze(dummyBib, { referenceDate: null, batchDelayMs: 0 }),
      /referenceDate must be a valid Date/,
      'invalid explicit clocks must fail closed'
    );

    // Verify Seminal
    assert.strictEqual(result.seminal.length, 1);
    assert.strictEqual(result.seminal[0].key, 'seminal2017');
    
    // Verify Rising
    // Velocity: 300 citations in 24 months at the fixed reference date. > 10/month.
    assert.strictEqual(result.rising.length, 1);
    assert.strictEqual(result.rising[0].key, 'rising2024');

    // Verify Outdated
    assert.strictEqual(result.outdated.length, 1);
    assert.strictEqual(result.outdated[0].key, 'old2010');

    console.log('✔ analyze-impact tests passed');
  } catch (e) {
    console.error('Test failed:', e);
    process.exitCode = 1;
  } finally {
    s2.search = originalS2Search;
    bibIndex.index = originalIndex;
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

runTests();
