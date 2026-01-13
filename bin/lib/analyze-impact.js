const fs = require('fs');
const s2 = require('./semantic-scholar');
const ranker = require('./citation-ranker');
const bibIndex = require('./bib-index'); // Assuming this exists or I need to use the one in bin/lib if available

// Check if bib-index exists in bin/lib or I need to implement basic parsing
// The command says `node ~/.claude/bin/bib-index.js`. 
// In this project structure, it is likely `bin/lib/bib-index.js`.

const BIB_INDEX_PATH = './bib-index.js';

/**
 * Impact Analyzer
 * 
 * Analyzes a BibTeX file or JSON index:
 * 1. Fetches metrics for each paper (via S2)
 * 2. Categorizes them (Seminal, Rising, Outdated)
 * 3. Returns summary
 */

async function analyze(filePath) {
  // 1. Index/Parse
  let entries = [];
  try {
    // We'll require bib-index locally if possible
    const indexer = require(BIB_INDEX_PATH);
    const json = indexer.index(fs.readFileSync(filePath, 'utf8'));
    entries = JSON.parse(json);
  } catch (e) {
    // Fallback: simple regex parsing if bib-index lib isn't easily require-able
    console.error("Could not use bib-index, falling back to simple parse", e);
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = /@\w+\s*{\s*([^,]+),[\s\S]*?title\s*=\s*[{"'](.+?)[}"'][\s\S]*?year\s*=\s*[{"'](\d{4})[}"']/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
      entries.push({ key: match[1], title: match[2], year: parseInt(match[3]) });
    }
  }

  const results = {
    seminal: [], // > 1000 citations
    rising: [],  // Velocity > 50/mo, < 1000 total
    outdated: [], // > 10 years, < 50 citations
    unknown: []
  };

  // Process in batches to avoid rate limits
  const BATCH_SIZE = 5;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (entry) => {
      try {
        // Search by title to get metrics (most reliable if DOI missing)
        // Ideally we'd use DOI if we parsed it.
        const papers = await s2.search(entry.title, { limit: 1 });
        if (papers && papers.length > 0) {
          const p = papers[0];
          const velocity = ranker.calculateVelocity(p.citationCount, p.year);
          const age = new Date().getFullYear() - (p.year || new Date().getFullYear());
          
          const enriched = { 
            key: entry.key, 
            title: p.title, 
            year: p.year, 
            citations: p.citationCount, 
            velocity: velocity.toFixed(1) 
          };

          if (p.citationCount > 1000) {
            results.seminal.push(enriched);
          } else if (velocity > 10 && p.citationCount < 1000) { // Threshold adjusted: 50/mo is very high. 10/mo is solid.
            results.rising.push(enriched);
          } else if (age > 15 && p.citationCount < 50) {
             results.outdated.push({ ...enriched, concern: `${age} years old, low citations` });
          } else {
            results.unknown.push(enriched);
          }
        } else {
            results.unknown.push({ key: entry.key, title: entry.title, error: "Not found" });
        }
      } catch (e) {
        results.unknown.push({ key: entry.key, title: entry.title, error: e.message });
      }
    }));
    // Small delay between batches
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Sort
  results.seminal.sort((a,b) => b.citations - a.citations);
  results.rising.sort((a,b) => b.velocity - a.velocity);
  
  return results;
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node analyze-impact.js <bibfile>");
    process.exit(1);
  }
  analyze(file).then(r => console.log(JSON.stringify(r, null, 2)));
}

module.exports = { analyze };
