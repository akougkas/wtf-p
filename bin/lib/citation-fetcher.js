const https = require('https');
const querystring = require('querystring');
const s2 = require('./semantic-scholar');
const scholar = require('./scholar-lookup');
const ranker = require('./citation-ranker');
const bibFormat = require('./bib-format');

/**
 * WTF-P Citation Fetcher v0.4.0
 * 
 * Orchestrates tiered search:
 * 1. Semantic Scholar (Primary, Free)
 * 2. SerpAPI (Optional, Seminal/Paid)
 * 3. CrossRef (Fallback)
 * 
 * Usage:
 *   node citation-fetcher.js "<query>" --intent=<intent> --year=<year>
 */

// --- CrossRef Fallback ---
async function searchCrossRef(query, limit = 5) {
  return new Promise((resolve, reject) => {
    const params = {
      query: query,
      rows: limit,
      sort: 'relevance',
      select: 'DOI,title,author,issued,type,container-title,volume,issue,page,abstract'
    };

    const options = {
      hostname: 'api.crossref.org',
      path: `/works?${querystring.stringify(params)}`,
      method: 'GET',
      headers: {
        'User-Agent': 'WTF-P/0.4.0 (citation-expert)'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve([]);
        try {
          const json = JSON.parse(data);
          const items = json.message.items || [];
          resolve(items.map(mapCrossRefToPaper));
        } catch (e) {
          resolve([]);
        }
      });
    });
    
    req.on('error', () => resolve([]));
    req.end();
  });
}

function mapCrossRefToPaper(item) {
  const title = item.title ? item.title[0] : 'Untitled';
  const year = item.issued && item.issued['date-parts'] ? item.issued['date-parts'][0][0] : null;
  
  return {
    source: 'crossref',
    title: title,
    year: year,
    doi: item.DOI,
    venue: item['container-title'] ? item['container-title'][0] : null,
    authors: (item.author || []).map(a => ({ name: `${a.family}, ${a.given}` })),
    abstract: item.abstract ? item.abstract.replace(/<[^>]*>?/gm, '').trim() : null,
    citationCount: 0, // CrossRef doesn't give citation counts easily
    externalIds: { DOI: item.DOI }
  };
}

// --- Mapper ---

function mapS2ToPaper(item) {
  return {
    source: 'semantic_scholar',
    paperId: item.paperId,
    title: item.title,
    year: item.year,
    venue: item.venue,
    authors: item.authors || [],
    citationCount: item.citationCount || 0,
    abstract: item.abstract,
    externalIds: item.externalIds || {},
    doi: (item.externalIds && item.externalIds.DOI) || null,
    openAccessPdf: item.openAccessPdf
  };
}

function mapScholarToPaper(item) {
  return {
    source: 'google_scholar',
    scholarClusterId: item.clusterId,
    title: item.title,
    year: item.year,
    venue: item.venue,
    authors: item.authors || [],
    citationCount: item.citationCount || 0,
    abstract: item.snippet, // Use snippet as abstract fallback
    externalIds: {},
    doi: null, // Scholar doesn't reliably give DOIs
    openAccessPdf: item.link ? { url: item.link } : null
  };
}

// --- Deduplication ---

function fingerprint(title, year) {
  if (!title) return `unknown::${Math.random()}`;
  const normalized = title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  return `${normalized}::${year || '????'}`;
}

function deduplicatePapers(papers) {
  const seen = new Map();

  for (const paper of papers) {
    // Priority: DOI > S2ID > ScholarID > Fingerprint
    const key = paper.doi 
      || paper.paperId 
      || paper.scholarClusterId
      || fingerprint(paper.title, paper.year);

    if (!seen.has(key)) {
      seen.set(key, paper);
    } else {
      // Merge: prefer richer metadata
      // S2 usually has best metadata (abstracts, verified authors).
      // Scholar has best citation counts.
      // CrossRef has verified DOIs.
      
      const existing = seen.get(key);
      let merged = { ...existing };
      
      // If new one is S2, take its metadata but keep higher citation count
      if (paper.source === 'semantic_scholar') {
        merged = { ...paper, citationCount: Math.max(existing.citationCount, paper.citationCount) };
        if (existing.scholarClusterId) merged.scholarClusterId = existing.scholarClusterId;
      } 
      // If new one is Scholar, just update citation count and maybe ID
      else if (paper.source === 'google_scholar') {
        merged.citationCount = Math.max(merged.citationCount, paper.citationCount);
        merged.scholarClusterId = paper.clusterId;
      }
      
      seen.set(key, merged);
    }
  }

  return Array.from(seen.values());
}

// --- Main Search Logic ---

async function search(query, options = {}) {
  const limit = options.limit || 10;
  const intent = options.intent || 'balanced';
  
  let papers = [];
  const errors = [];
  
  const searchPromises = [];

  // 1. S2 Search (Always)
  searchPromises.push(
    s2.search(query, { limit: limit * 2, year: options.year })
      .then(res => res.map(mapS2ToPaper))
      .catch(e => {
        errors.push(`S2 Error: ${e.message}`);
        return [];
      })
  );
  
  // 2. Scholar Search (Conditional)
  if ((intent === 'seminal' || options.useScholar) && scholar.isAvailable()) {
    searchPromises.push(
      scholar.search(query, { limit: limit, yearLow: options.year, yearHigh: options.year })
        .then(res => res.map(mapScholarToPaper))
        .catch(e => {
          errors.push(`Scholar Error: ${e.message}`);
          return [];
        })
    );
  }

  const results = await Promise.all(searchPromises);
  results.forEach(r => papers.push(...r));

  // 3. CrossRef Fallback (if few results)
  if (papers.length < 5) {
    try {
      const crResults = await searchCrossRef(query, limit);
      papers.push(...crResults);
    } catch (e) {
      errors.push(`CrossRef Error: ${e.message}`);
    }
  }

  // 4. Deduplicate
  const unique = deduplicatePapers(papers);

  // 5. Rank
  const ranked = ranker.rank(unique, intent);

  // 6. Format to BibTeX
  const formatted = ranked.slice(0, limit).map(p => {
    // Generate key
    const firstAuthor = p.authors && p.authors.length > 0 
      ? (p.authors[0].name ? p.authors[0].name.split(',')[0].trim().split(' ').pop().toLowerCase() : 'unknown') 
      : 'unknown';
      
    // Handle S2 author format variants or string parsing
    let familyName = 'unknown';
    if (p.authors && p.authors.length > 0) {
       const nameParts = p.authors[0].name.split(' ');
       familyName = nameParts[nameParts.length - 1].toLowerCase().replace(/[^a-z]/g, '');
    }

    const shortTitle = p.title.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = `${familyName}${p.year || '????'}${shortTitle}`;

    const bibData = {
      key: key,
      entryType: 'article', 
      author: p.authors.map(a => a.name).join(' and '),
      title: p.title,
      year: p.year ? p.year.toString() : null,
      venue: p.venue, 
      booktitle: p.venue,
      abstract: p.abstract,
      doi: p.doi,
      url: p.openAccessPdf ? p.openAccessPdf.url : (p.doi ? `https://doi.org/${p.doi}` : null),
      google_scholar_id: p.scholarClusterId
    };
    
    const provenance = {
      wtfp_status: p.doi ? 'official' : 'partial',
      wtfp_source: p.source,
      wtfp_citations: p.citationCount,
      wtfp_velocity: p.wtfp_velocity,
      wtfp_s2_id: p.paperId,
      wtfp_scholar_id: p.scholarClusterId
    };

    return {
      ...p,
      bibtex: bibFormat.format(bibData, provenance)
    };
  });

  return {
    results: formatted,
    metadata: {
      query,
      total: unique.length,
      returned: formatted.length,
      errors
    }
  };
}


// --- CLI Handling ---

if (require.main === module) {
  const args = process.argv.slice(2);
  const query = args.find(a => !a.startsWith('--'));
  
  if (!query) {
    console.error('Usage: node citation-fetcher.js "<query>" [--intent=seminal] [--year=2023]');
    process.exit(1);
  }

  const intentArg = args.find(a => a.startsWith('--intent='));
  const yearArg = args.find(a => a.startsWith('--year='));
  const limitArg = args.find(a => a.startsWith('--limit='));

  const options = {
    intent: intentArg ? intentArg.split('=')[1] : 'balanced',
    year: yearArg ? yearArg.split('=')[1] : null,
    limit: limitArg ? parseInt(limitArg.split('=')[1]) : 10
  };

  search(query, options).then(result => {
    // console.log(JSON.stringify(result, null, 2));
    // For now, output just the bibtex entries as text for easy reading, or JSON?
    // The previous fetcher output JSON. Let's stick to JSON array of results.
    console.log(JSON.stringify(result.results, null, 2));
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { search };