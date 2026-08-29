const assert = require('assert');
const ranker = require('../../bin/lib/citation-ranker');

console.log('Running citation-ranker tests...');

// Test 1: scoreVenue
assert.strictEqual(ranker.scoreVenue('NeurIPS 2023'), 1.0, 'NeurIPS should be Tier 1');
assert.strictEqual(ranker.scoreVenue('International Conference on Machine Learning'), 1.0, 'ICML should be Tier 1');
assert.strictEqual(ranker.scoreVenue('arXiv preprint'), 0.3, 'arXiv should be Tier 3');
assert.strictEqual(ranker.scoreVenue('Random Journal'), 0.5, 'Unknown should be 0.5');

// Test 2: calculateVelocity
const referenceDate = new Date('2026-01-15T12:00:00Z');
const currentYear = referenceDate.getUTCFullYear();
// Paper published 2 years ago (24 months) with 240 citations = 10/month
assert.strictEqual(ranker.calculateVelocity(240, currentYear - 2, referenceDate), 10, 'Velocity calc incorrect');
assert.throws(
  () => ranker.calculateVelocity(0, currentYear - 2, new Date('invalid')),
  /referenceDate must be a valid Date/,
  'invalid explicit clocks must fail closed'
);
const previousTimezone = process.env.TZ;
const boundaryDate = new Date('2026-01-01T00:30:00Z');
const boundaryVelocities = ['UTC', 'America/Chicago'].map((timezone) => {
  process.env.TZ = timezone;
  return ranker.calculateVelocity(240, 2024, boundaryDate);
});
if (previousTimezone === undefined) delete process.env.TZ;
else process.env.TZ = previousTimezone;
assert.deepStrictEqual(
  boundaryVelocities,
  [10, 10],
  'an explicit UTC clock must produce the same velocity across host timezones'
);

// Test 3: calculateScore - Seminal vs Recent
const seminal = {
  title: "Seminal Paper",
  citationCount: 50000,
  year: 2017,
  venue: "NeurIPS"
};

const recent = {
  title: "Recent Paper",
  citationCount: 50,
  year: currentYear,
  venue: "NeurIPS"
};

const seminalScore = ranker.calculateScore(seminal, 'seminal', referenceDate);
const recentScore = ranker.calculateScore(recent, 'recent', referenceDate);

// Seminal intent should favor high citations
assert.ok(seminalScore > 0.5, 'Seminal score should be high for highly cited paper');

// Recent intent should favor new papers even with low citations
const recentScoreWithSeminalIntent = ranker.calculateScore(recent, 'seminal', referenceDate);
assert.ok(recentScore > recentScoreWithSeminalIntent, 'Recent intent should score new paper higher than seminal intent');

// Test 4: Rank
const papers = [
  { id: 1, citationCount: 10, year: 2010, venue: "Unknown" }, // Old, low cite
  { id: 2, citationCount: 10000, year: 2018, venue: "NeurIPS" }, // Seminal
  { id: 3, citationCount: 100, year: currentYear, venue: "CVPR" } // Recent, hot
];

const rankedSeminal = ranker.rank([...papers], 'seminal', referenceDate);
assert.strictEqual(rankedSeminal[0].id, 2, 'Seminal ranking should pick high citations');
assert.throws(
  () => ranker.rank([], 'balanced', new Date('invalid')),
  /referenceDate must be a valid Date/,
  'rank must validate an explicit clock even when there are no papers'
);

const rankedRecent = ranker.rank([...papers], 'recent', referenceDate);
// Depending on weights, the recent one might be 1 or 2, but definitely not 3 (old)
// Recency (0.4) + Velocity vs Citation (0.2).
// ID 3: Age 0 -> Recency 1.0. Citations 100.
// ID 2: Age ~8 -> Recency 0.2. Citations 10000.
// Let's check logic:
// ID 3: 0.2*cit + 0.3*vel + 0.4*1.0 + 0.1*1.0
// ID 2: 0.2*citHigh + 0.3*velHigh + 0.4*0.2 + 0.1*1.0
// It's possible ID 2 still wins if citations are massive. But ID 3 should beat ID 1.
assert.notStrictEqual(rankedRecent[0].id, 1, 'Old low-cite paper should not win recent');

console.log('✔ All citation-ranker tests passed');
