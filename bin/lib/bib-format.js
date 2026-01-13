const fs = require('fs');

/**
 * WTF-P BibTeX Formatter
 * Standardizes BibTeX entries to the project's strict template.
 * Handles missing fields and assigns provenance metadata.
 * 
 * Usage:
 *   node bib-format.js "<bibtex_entry>"
 *   node bib-format.js --file <bib_file> <key>
 */

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
  // Simple extractor for the key
  const regex = new RegExp(`@\\w+\\s*{\\s*${KEY_ARG}\\s*,[\\s\\S]*?\\n}`, 'm');
  const match = content.match(regex);
  if (match) {
    rawEntry = match[0];
  } else {
    console.error(`Key ${KEY_ARG} not found in ${INPUT}`);
    process.exit(1);
  }
} else {
  rawEntry = INPUT; // Assume raw string passed
}

// --- Parsing Logic ---

function parseField(text, field) {
  // Regex to find field="value" or field={value}
  const regex = new RegExp(`${field}\\s*=\\s*[{"']([\\s\\S]*?)[}"']\\s*[,}]`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function parseEntryType(text) {
  const match = text.match(/@(\w+)\s*{
/);
  return match ? match[1].toLowerCase() : 'misc';
}

function parseKey(text) {
  const match = text.match(/@\w+\s*{\s*([^,]+),/);
  return match ? match[1].trim() : 'unknown_key';
}

// --- Formatting Logic ---

const entryType = parseEntryType(rawEntry);
const key = parseKey(rawEntry);

// Extract existing values or null
const data = {
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
  // Preserve custom fields if they exist
  bibtex_show: parseField(rawEntry, 'bibtex_show'),
  selected: parseField(rawEntry, 'selected'),
  projects: parseField(rawEntry, 'projects')
};

// --- Provenance & Defaults ---

let status = 'official';
const missingFields = [];

if (!data.doi) {
  status = 'incomplete';
  missingFields.push('doi');
}
if (!data.abstract) {
  if (status !== 'incomplete') status = 'partial'; // Abstract is nice-to-have
}

// Default values for the Template
const formatted = {
  abbr: data.abbr || "",
  entry_type: entryType === 'inproceedings' ? 'conference' : (entryType === 'article' ? 'journal' : entryType),
  author: data.author || "{MISSING_AUTHOR}",
  abstract: data.abstract || "",
  booktitle: data.booktitle || "{MISSING_VENUE}",
  title: data.title || "{MISSING_TITLE}",
  year: data.year || "{????}",
  month: data.month || "",
  publisher: data.publisher || "",
  volume: data.volume || "",
  number: data.number || "",
  pages: data.pages || "",
  keywords: data.keywords || "",
  doi: data.doi || "",
  url: data.url || (data.doi ? `https://doi.org/${data.doi}` : ""),
  html: data.html || (data.doi ? `https://doi.org/${data.doi}` : ""),
  pdf: "paper.pdf", // Placeholder
  google_scholar_id: "",
  additional_info: "",
  bibtex_show: data.bibtex_show || "true",
  selected: data.selected || "false",
  projects: data.projects || "",
  
  // Custom tracking fields
  wtfp_status: status,
  wtfp_missing: missingFields.length > 0 ? missingFields.join(',') : ""
};

// Reconstruct BibTeX
const output = `@${entryType}{${key},
  abbr="${formatted.abbr}",
  entry_type="${formatted.entry_type}",
  author="${formatted.author}",
  abstract="${formatted.abstract}",
  booktitle="${formatted.booktitle}",
  title="${formatted.title}",
  year="${formatted.year}",
  month="${formatted.month}",
  publisher="${formatted.publisher}",
  volume="${formatted.volume}",
  number="${formatted.number}",
  pages="${formatted.pages}",
  keywords="${formatted.keywords}",
  doi="${formatted.doi}",
  url="${formatted.url}",
  html="${formatted.html}",
  pdf="${formatted.pdf}",
  google_scholar_id="${formatted.google_scholar_id}",
  additional_info="${formatted.additional_info}",
  bibtex_show="${formatted.bibtex_show}",
  selected="${formatted.selected}",
  projects="${formatted.projects}",
  wtfp_status="${formatted.wtfp_status}",
  wtfp_missing="${formatted.wtfp_missing}"
}`;

console.log(output);
