const https = require('https');
const querystring = require('querystring');

/**
 * WTF-P Citation Fetcher
 * Searches for papers using public academic APIs.
 * 
 * Usage:
 *   node citation-fetcher.js "<query>"
 */

const QUERY = process.argv[2];

if (!QUERY) {
  console.error('Usage: node citation-fetcher.js "<query>"');
  process.exit(1);
}

// Using CrossRef API (reliable, no auth required for low volume)
const BASE_URL = 'api.crossref.org';
const PATH = '/works';

const params = {
  query: QUERY,
  rows: 5,
  sort: 'relevance',
  select: 'DOI,title,author,issued,type,container-title,short-container-title,publisher,volume,issue,page,abstract'
};

const options = {
  hostname: BASE_URL,
  path: `${PATH}?${querystring.stringify(params)}`,
  method: 'GET',
  headers: {
    'User-Agent': 'WTF-P/0.4.0 (https://github.com/akougkas/wtf-p; mailto:support@example.com)'
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error(`API Error: ${res.statusCode} - ${data}`);
      process.exit(1);
    }

    try {
      const response = JSON.parse(data);
      const items = response.message.items || [];

      const results = items.map(item => {
        const title = item.title ? item.title[0] : 'Untitled';
        
        // Format authors: Last, First and Last, First
        let authors = 'Unknown';
        if (item.author && Array.isArray(item.author)) {
          authors = item.author.map(a => {
            const given = a.given || '';
            const family = a.family || '';
            return `${family}, ${given}`.trim();
          }).filter(n => n.length > 0).join(' and ');
        }
        if (!authors) authors = 'Unknown';

        const year = item.issued && item.issued['date-parts'] ? item.issued['date-parts'][0][0] : '????';
        const month = item.issued && item.issued['date-parts'] && item.issued['date-parts'][0][1] ? item.issued['date-parts'][0][1] : '';
        const venue = item['container-title'] ? item['container-title'][0] : 'Unknown Venue';
        const abbr = item['short-container-title'] ? item['short-container-title'][0].toLowerCase().replace(/\s+/g, '') : '';
        const doi = item.DOI || '';
        const publisher = item.publisher || '';
        const volume = item.volume || '';
        const number = item.issue || '';
        const pages = item.page || '';
        const abstract = (item.abstract || '').replace(/<[^>]*>?/gm, '').trim(); // Remove XML tags

        // Map Entry Type
        let entryType = 'journal';
        if (item.type === 'proceedings-article') entryType = 'conference';
        else if (item.type === 'book-chapter' || item.type === 'book') entryType = 'book';
        else if (venue.toLowerCase().includes('workshop')) entryType = 'workshop';

        // Generate Key: first_author_surnameYEARpapershorttitle
        let firstAuthorFamily = 'unknown';
        if (item.author && item.author.length > 0 && item.author[0].family) {
          firstAuthorFamily = item.author[0].family.toLowerCase().replace(/[^a-z0-9]/g, '');
        }
        const shortTitle = title.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        const key = `${firstAuthorFamily}${year}${shortTitle}`;

        // Provenance Logic
        let status = 'official';
        const missing = [];
        if (!doi) { status = 'incomplete'; missing.push('doi'); }
        if (authors === 'Unknown') { status = 'incomplete'; missing.push('author'); }
        if (!venue || venue === 'Unknown Venue') { missing.push('venue'); }
        if (!abstract) { 
           if (status === 'official') status = 'partial'; // Abstract is missing but entry is usable
           missing.push('abstract');
        }

        const bibtex = `@${entryType === 'conference' ? 'inproceedings' : 'article'}{${key},
  abbr="${abbr}${year.toString().slice(-2)}",
  entry_type="${entryType}",
  author="${authors}",
  abstract="${abstract}",
  booktitle="${venue}",
  title="${title}",
  year="${year}",
  month="${month}",
  publisher="${publisher}",
  volume="${volume}",
  number="${number}",
  pages="${pages}",
  keywords="",
  doi="${doi}",
  url="https://doi.org/${doi}",
  html="https://doi.org/${doi}",
  pdf="paper.pdf",
  google_scholar_id="",
  additional_info="",
  bibtex_show="true",
  selected="false",
  projects="",
  wtfp_status="${status}",
  wtfp_missing="${missing.join(',')}"
}`;

        return {
          title,
          authors,
          year,
          venue,
          doi,
          bibtex
        };
      });

      console.log(JSON.stringify(results, null, 2));

    } catch (e) {
      console.error('Failed to parse response', e);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
  process.exit(1);
});

req.end();
