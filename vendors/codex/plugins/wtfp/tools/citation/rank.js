/**
 * Citation Ranker
 *
 * Ranks papers based on multidimensional impact score:
 * - Citation Count (Log scaled)
 * - Velocity (Citations per month)
 * - Recency (Decay over time)
 * - Venue (Tiered scoring)
 */

// Venue Tiers
const VENUE_TIERS = {
  TIER_1: [
    // AI/ML
    "neurips", "nips", "icml", "iclr", "cvpr", "iccv", "eccv", "acl", "emnlp", "naacl",
    "aaai", "ijcai", "kdd", "www", "sigir", "chi",
    // Systems
    "osdi", "sosp", "nsdi", "eurosys", "atc", "fast", "sigcomm", "mobicom",
    // Journals
    "nature", "science", "pnas", "cell", "lancet", "nejm", "jama",
    "ieee transactions", "acm computing surveys", "jmlr", "journal of machine learning research"
  ],
  TIER_2: [
    "coling", "wsdm", "cikm", "pakdd", "ijcnn", "icra", "iros",
    "middleware", "cloud", "sc", "hpdc", "cluster"
  ],
  PREPRINT: [
    "arxiv", "biorxiv", "medrxiv", "ssrn", "workshop"
  ]
};

/**
 * Score a venue name
 * @param {string} venue
 * @returns {number} 0.0 to 1.0
 */
function scoreVenue(venue) {
  if (!venue) return 0.2;
  const v = venue.toLowerCase();

  if (VENUE_TIERS.TIER_1.some(t => v.includes(t))) return 1.0;
  if (VENUE_TIERS.TIER_2.some(t => v.includes(t))) return 0.7;
  if (VENUE_TIERS.PREPRINT.some(t => v.includes(t))) return 0.3;

  return 0.5; // Unknown venue default
}

/**
 * Calculate citation velocity
 * @param {number} citations
 * @param {number} year
 * @param {Date} [referenceDate] explicit clock for reproducible evaluation
 * @returns {number} Citations per month
 */
function calculateVelocity(citations, year, referenceDate = new Date()) {
  const now = referenceDate;
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('referenceDate must be a valid Date');
  }
  if (!citations || !year) return 0;
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth(); // 0-11

  // Calculate months since publication (assuming Jan 1st of year)
  // If current year, use months passed. If past year, (diff * 12) + currentMonth.
  let monthsSince = (currentYear - year) * 12 + currentMonth;

  // Guard against divide by zero or negative (future dates)
  monthsSince = Math.max(1, monthsSince);

  return citations / monthsSince;
}

/**
 * Calculate impact score for a paper
 * @param {Object} paper
 * @param {string} intent "seminal" | "recent" | "specific" | "balanced"
 * @param {Date} [referenceDate] explicit clock for reproducible evaluation
 */
function calculateScore(paper, intent = "balanced", referenceDate = new Date()) {
  if (!(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) {
    throw new TypeError('referenceDate must be a valid Date');
  }
  const currentYear = referenceDate.getUTCFullYear();
  const year = paper.year || currentYear;
  const age = Math.max(0, currentYear - year);
  const citations = paper.citationCount || 0;
  const velocity = calculateVelocity(citations, year, referenceDate);

  // Normalize factors (approximate ranges)
  // Citations: log10(100,000) = 5. So score is 0-1.
  const citationScore = Math.min(1, Math.log10(citations + 1) / 5);

  // Velocity: 100 cites/month is huge. Normalize to 0-1.
  const velocityScore = Math.min(1, velocity / 100);

  // Recency: Linear decay over 10 years. 0 if > 10 years old.
  const recencyScore = Math.max(0, 1 - (age / 10));

  const venueScore = scoreVenue(paper.venue);

  // Weights based on intent
  const weights = {
    seminal:  { citation: 0.6, velocity: 0.2, recency: 0.1, venue: 0.1 },
    recent:   { citation: 0.2, velocity: 0.3, recency: 0.4, venue: 0.1 },
    specific: { citation: 0.1, velocity: 0.1, recency: 0.1, venue: 0.1 }, // Ranking less important for specific lookup
    balanced: { citation: 0.4, velocity: 0.3, recency: 0.2, venue: 0.1 }
  };

  const w = weights[intent] || weights.balanced;

  return (
    citationScore * w.citation +
    velocityScore * w.velocity +
    recencyScore * w.recency +
    venueScore * w.venue
  );
}

/**
 * Rank a list of papers
 * @param {Array} papers
 * @param {string} intent
 * @param {Date} [referenceDate] explicit clock for reproducible evaluation
 * @returns {Array} Sorted papers with score attached
 */
function rank(papers, intent = "balanced", referenceDate = new Date()) {
  if (!(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) {
    throw new TypeError('referenceDate must be a valid Date');
  }
  const scored = papers.map(p => ({
    ...p,
    wtfp_score: calculateScore(p, intent, referenceDate),
    wtfp_velocity: calculateVelocity(p.citationCount, p.year, referenceDate)
  }));

  return scored.sort((a, b) => b.wtfp_score - a.wtfp_score);
}

module.exports = {
  rank,
  calculateScore,
  calculateVelocity,
  scoreVenue
};
