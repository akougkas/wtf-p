const https = require('https');
const querystring = require('querystring');

/**
 * Semantic Scholar API Wrapper
 * 
 * Provides search and lookup capabilities for Semantic Scholar Graph API v1.
 * Handles rate limiting with exponential backoff.
 * 
 * Env:
 *  - S2_API_KEY: Optional API key for higher rate limits.
 */

const API_KEY = process.env.S2_API_KEY;
const BASE_HOST = 'api.semanticscholar.org';
const BASE_PATH = '/graph/v1';

const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 16000
};

class SemanticScholarError extends Error {
  constructor(message, statusCode, retryAfter) {
    super(message);
    this.name = 'SemanticScholarError';
    this.statusCode = statusCode;
    this.retryAfter = retryAfter;
  }
}

/**
 * Sleep helper
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Make an HTTP request with retry logic
 */
async function request(endpoint, params = {}) {
  const query = querystring.stringify(params);
  const path = `${BASE_PATH}${endpoint}?${query}`;
  
  let attempt = 0;

  while (attempt <= RETRY_CONFIG.maxRetries) {
    try {
      return await doRequest(path);
    } catch (error) {
      if (error instanceof SemanticScholarError && error.statusCode === 429) {
        attempt++;
        if (attempt > RETRY_CONFIG.maxRetries) throw error;
        
        // Use Retry-After header if available, else exponential backoff
        const delay = error.retryAfter 
          ? parseInt(error.retryAfter, 10) * 1000 
          : Math.min(RETRY_CONFIG.maxDelay, RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1));
        
        // console.error(`[S2] Rate limited. Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}

function doRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_HOST,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'WTF-P/0.4.0 (citation-expert)',
      }
    };

    if (API_KEY) {
      options.headers['x-api-key'] = API_KEY;
    }

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => data += chunk);

      res.on('end', () => {
        if (res.statusCode === 429) {
          const retryAfter = res.headers['retry-after'];
          return reject(new SemanticScholarError('Rate limit exceeded', 429, retryAfter));
        }

        if (res.statusCode >= 400) {
          return reject(new SemanticScholarError(`API Error: ${res.statusCode} ${data}`, res.statusCode));
        }

        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`Request failed: ${e.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    
    // Set a reasonable timeout (10s)
    req.setTimeout(10000);
    req.end();
  });
}

/**
 * Search for papers
 * @param {string} query 
 * @param {Object} options 
 */
async function search(query, options = {}) {
  const limit = Math.min(options.limit || 10, 100);
  const fields = options.fields || [
    'paperId', 'externalIds', 'title', 'abstract', 'venue', 'year', 
    'citationCount', 'influentialCitationCount', 'authors', 
    'publicationTypes', 'openAccessPdf'
  ];

  const params = {
    query,
    limit,
    fields: fields.join(',')
  };

  if (options.year) params.year = options.year;

  const response = await request('/paper/search', params);
  return response.data || [];
}

/**
 * Get paper by ID
 * @param {string} id - S2 PaperId, DOI, ArXivId, etc.
 * @param {string[]} fields 
 */
async function getPaper(id, fields = []) {
  const defaultFields = [
    'paperId', 'externalIds', 'title', 'abstract', 'venue', 'year', 
    'citationCount', 'influentialCitationCount', 'authors', 
    'publicationTypes', 'openAccessPdf'
  ];
  
  const params = {
    fields: (fields.length > 0 ? fields : defaultFields).join(',')
  };

  return await request(`/paper/${id}`, params);
}

/**
 * Get citations for a paper
 * @param {string} paperId 
 * @param {number} limit 
 */
async function getCitations(paperId, limit = 20) {
  const params = {
    limit,
    fields: 'title,year,citationCount,authors' // Minimal fields for citations
  };
  
  const response = await request(`/paper/${paperId}/citations`, params);
  return response.data || [];
}

module.exports = {
  search,
  getPaper,
  getCitations,
  SemanticScholarError
};
