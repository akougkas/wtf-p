const https = require('https');
const querystring = require('querystring');

/**
 * SerpAPI Google Scholar Wrapper
 * 
 * Provides access to Google Scholar data via SerpAPI.
 * Used for high-value "seminal" queries to get citation velocity and cluster IDs.
 * 
 * Env:
 *  - SERPAPI_KEY: Required for operation.
 */

const HOST = 'serpapi.com';
const PATH = '/search';

const usage = {
  queries: 0,
  // Default budget: 100 queries/month (~$5)
  monthlyBudget: 100,
  
  canQuery() {
    return this.queries < this.monthlyBudget;
  },
  
  recordQuery() {
    this.queries++;
    if (this.queries % 10 === 0) {
      // console.error(`[Scholar] API usage: ${this.queries}/${this.monthlyBudget}`);
    }
  }
};

function getApiKey() {
  return process.env.SERPAPI_KEY;
}

function isAvailable() {
  return !!getApiKey();
}

function request(params) {
  return new Promise((resolve, reject) => {
    const key = getApiKey();
    if (!key) {
      return reject(new Error('SERPAPI_KEY not set'));
    }
    if (!usage.canQuery()) {
      return reject(new Error('Monthly budget exceeded'));
    }

    usage.recordQuery();

    const q = querystring.stringify({
      ...params,
      api_key: key,
      engine: 'google_scholar'
    });

    const options = {
      hostname: HOST,
      path: `${PATH}?${q}`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`SerpAPI Error: ${res.statusCode} ${data}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Search Google Scholar
 * @param {string} query 
 * @param {Object} options { yearLow, yearHigh, limit }
 */
async function search(query, options = {}) {
  const params = {
    q: query,
    num: options.limit || 10
  };
  
  if (options.yearLow) params.as_ylo = options.yearLow;
  if (options.yearHigh) params.as_yhi = options.yearHigh;

  const data = await request(params);
  return (data.organic_results || []).map(mapResult);
}

/**
 * Get paper by Cluster ID
 * @param {string} clusterId 
 */
async function getByClusterId(clusterId) {
  const data = await request({ cluster: clusterId });
  // When searching by cluster, it returns list of versions.
  // We usually want the first one or metadata about the cluster.
  // SerpAPI "cluster" usually returns "organic_results" which are the versions.
  const results = data.organic_results || [];
  if (results.length > 0) return mapResult(results[0]);
  return null;
}

/**
 * Get citing papers
 * @param {string} clusterId 
 * @param {number} limit 
 */
async function getCitingPapers(clusterId, limit = 10) {
  const data = await request({ 
    cites: clusterId,
    num: limit 
  });
  return (data.organic_results || []).map(mapResult);
}

function mapResult(item) {
  // Extract cluster ID
  let clusterId = null;
  // Try to find it in links or specific fields if SerpAPI provides it directly
  // SerpAPI usually puts it in inline_links -> cited_by -> serpapi_link (cites=ID)
  // or versions -> serpapi_link (cluster=ID)
  
  if (item.inline_links && item.inline_links.cited_by && item.inline_links.cited_by.serpapi_link) {
    const match = item.inline_links.cited_by.serpapi_link.match(/cites=(\w+)/);
    if (match) clusterId = match[1];
  }
  
  return {
    source: 'google_scholar',
    title: item.title,
    clusterId: clusterId || item.cluster_id, // Sometimes provided directly
    link: item.link,
    snippet: item.snippet,
    publication_info: item.publication_info,
    citationCount: item.inline_links && item.inline_links.cited_by ? item.inline_links.cited_by.total : 0,
    year: extractYear(item.publication_info ? item.publication_info.summary : ''),
    authors: extractAuthors(item.publication_info ? item.publication_info.summary : ''),
    venue: extractVenue(item.publication_info ? item.publication_info.summary : '')
  };
}

function extractYear(summary) {
  const match = summary.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : null;
}

function extractAuthors(summary) {
  // "A Author, B Author - Venue, 2020 - publisher"
  if (!summary) return [];
  const parts = summary.split('-');
  if (parts.length > 0) {
    return parts[0].split(',').map(s => ({ name: s.trim() }));
  }
  return [];
}

function extractVenue(summary) {
  if (!summary) return null;
  const parts = summary.split('-');
  if (parts.length > 1) {
    // "Venue, Year" usually
    return parts[1].split(',')[0].trim();
  }
  return null;
}

module.exports = {
  isAvailable,
  search,
  getByClusterId,
  getCitingPapers,
  usage
};
