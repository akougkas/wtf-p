const fs = require('fs');

/**
 * WTF-P BibTeX Formatter
 * Standardizes BibTeX entries to the project's strict template.
 * Handles missing fields and assigns provenance metadata.
 */

// --- Parsing Logic ---

function parseField(text, field) {
  // Regex to find field="value" or field={value}
  const regex = new RegExp(`\\b${field}\\s*=\\s*[{"']([\\s\\S]*?)[}"']\\s*[,}]`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function parseEntryType(text) {
  const match = text.match(/@(\w+)\s*{/);
  return match ? match[1].toLowerCase() : 'misc';
}

function parseKey(text) {
  const match = text.match(/@\w+\s*{\s*([^,]+),/);
  return match ? match[1].trim() : 'unknown_key';
}

function parse(rawEntry) {
  const entryType = parseEntryType(rawEntry);
  const key = parseKey(rawEntry);

  return {
    key,
    entryType,
    author: parseField(rawEntry, 'author'),
    title: parseField(rawEntry, 'title'),
    booktitle: parseField(rawEntry, 'booktitle') || parseField(rawEntry, 'journal'),
    year: parseField(rawEntry, 'year'),
    month: parseField(rawEntry, 'month'),
    abstract: parseField(rawEntry, 'abstract'),
    publisher: parseField(rawEntry, 'publisher'),
    volume: parseField(rawEntry, 'volume'),
    number: parseField(rawEntry, 'number'),
    pages: parseField(rawEntry, 'pages'),
    doi: parseField(rawEntry, 'doi'),
    url: parseField(rawEntry, 'url'),
    keywords: parseField(rawEntry, 'keywords'),
    abbr: parseField(rawEntry, 'abbr'),
    bibtex_show: parseField(rawEntry, 'bibtex_show'),
    selected: parseField(rawEntry, 'selected'),
    projects: parseField(rawEntry, 'projects')
  };
}

// --- Formatting Logic ---

function format(data, provenance = {}) {
  // Determine Status
  let status = provenance.wtfp_status || 'official';
  const missingFields = [];

  if (!data.doi) {
    status = 'incomplete';
    missingFields.push('doi');
  }
  if (!data.author || data.author === '{MISSING_AUTHOR}') {
    status = 'incomplete';
    missingFields.push('author');
  }
  if (!data.booktitle || data.booktitle === '{MISSING_VENUE}') {
     missingFields.push('venue');
  }
  if (!data.abstract) {
    if (status !== 'incomplete') status = 'partial'; 
    missingFields.push('abstract');
  }

  // Use provided provenance or defaults
  const wtfp_source = provenance.wtfp_source || '';
  const wtfp_citations = provenance.wtfp_citations || '';
  const wtfp_velocity = provenance.wtfp_velocity || '';
  const wtfp_s2_id = provenance.wtfp_s2_id || '';
  const wtfp_scholar_id = provenance.wtfp_scholar_id || '';
  const wtfp_fetched = provenance.wtfp_fetched || new Date().toISOString().split('T')[0];

  const entryType = data.entryType === 'inproceedings' ? 'conference' : (data.entryType === 'article' ? 'journal' : data.entryType || 'misc');
  
  // Clean fields
  const clean = (val, fallback = "") => val || fallback;

  return `@${entryType}{${data.key || 'unknown'},
  abbr="${clean(data.abbr)}",
  entry_type="${entryType}",
  author="${clean(data.author, "{MISSING_AUTHOR}")}",
  abstract="${clean(data.abstract)}",
  booktitle="${clean(data.booktitle, "{MISSING_VENUE}")}",
  title="${clean(data.title, "{MISSING_TITLE}")}",
  year="${clean(data.year, "{????}")}",
  month="${clean(data.month)}",
  publisher="${clean(data.publisher)}",
  volume="${clean(data.volume)}",
  number="${clean(data.number)}",
  pages="${clean(data.pages)}",
  keywords="${clean(data.keywords)}",
  doi="${clean(data.doi)}",
  url="${clean(data.url, data.doi ? `https://doi.org/${data.doi}` : "")}",
  html="${clean(data.html, data.doi ? `https://doi.org/${data.doi}` : "")}",
  pdf="${clean(data.pdf, "paper.pdf")}",
  google_scholar_id="${clean(data.google_scholar_id)}",
  additional_info="${clean(data.additional_info)}",
  bibtex_show="${clean(data.bibtex_show, "true")}",
  selected="${clean(data.selected, "false")}",
  projects="${clean(data.projects)}",
  wtfp_status="${status}",
  wtfp_source="${wtfp_source}",
  wtfp_citations="${wtfp_citations}",
  wtfp_velocity="${wtfp_velocity}",
  wtfp_s2_id="${wtfp_s2_id}",
  wtfp_scholar_id="${wtfp_scholar_id}",
  wtfp_fetched="${wtfp_fetched}",
  wtfp_missing="${missingFields.join(',')}"
}`;
}

// --- CLI Handling ---

if (require.main === module) {
  const MODE = process.argv[2];
  const INPUT = process.argv[3];
  const KEY_ARG = process.argv[4];

  if (!MODE) {
    console.error('Usage: node bib-format.js <raw_string|--file> <content|filepath> [key]');
    process.exit(1);
  }

  let rawEntry = '';

  if (MODE === '--file') {
    if (!fs.existsSync(INPUT)) {
      console.error(`File not found: ${INPUT}`);
      process.exit(1);
    }
    const content = fs.readFileSync(INPUT, 'utf8');
    const regex = new RegExp(`@\w+\s*{\s*${KEY_ARG}\s*,[\s\S]*?\n}`, 'm');
    const match = content.match(regex);
    if (match) {
      rawEntry = match[0];
    } else {
      console.error(`Key ${KEY_ARG} not found in ${INPUT}`);
      process.exit(1);
    }
  } else {
    rawEntry = INPUT;
  }

  const parsed = parse(rawEntry);
  console.log(format(parsed));
}

module.exports = { parse, format };