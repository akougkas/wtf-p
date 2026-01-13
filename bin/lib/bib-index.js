const fs = require('fs');
const path = require('path');

/**
 * WTF-P Bibliography Indexer
 * Indexes and retrieves BibTeX entries without loading the entire file into context.
 * 
 * Usage:
 *   node bib-index.js index <bib_file>
 *   node bib-index.js get <bib_file> <citation_key>
 *   node bib-index.js search <bib_file> <query>
 */

const COMMAND = process.argv[2];
const BIB_FILE = process.argv[3];
const ARG = process.argv[4];

if (!COMMAND || !BIB_FILE) {
  console.error('Usage: node bib-index.js <command> <bib_file> [arg]');
  process.exit(1);
}

if (!fs.existsSync(BIB_FILE)) {
  console.error(`Error: Bibliography file not found: ${BIB_FILE}`);
  process.exit(1);
}

const content = fs.readFileSync(BIB_FILE, 'utf8');

// Simple BibTeX Regex: Matches @type{key, ...}
// This is a rough parser, sufficient for standard files.
const ENTRY_REGEX = /@(\w+)\s*\{\s*([^,]+),([^@]*)\}/g;

function parseEntries(text) {
  const entries = [];
  let match;
  while ((match = ENTRY_REGEX.exec(text)) !== null) {
    const fullText = match[0];
    const type = match[1];
    const key = match[2].trim();
    const body = match[3];
    
    // Extract title specifically for indexing
    const titleMatch = body.match(/title\s*=\s*[{"'](.+?)[}"']/i);
    const title = titleMatch ? titleMatch[1] : 'Unknown Title';
    
    // Extract year
    const yearMatch = body.match(/year\s*=\s*[{"']?(\d+)[}"']?/i);
    const year = yearMatch ? yearMatch[1] : '????';

    entries.push({ key, type, title, year, fullText: `@${type}{${key},${body}}` });
  }
  return entries;
}

const entries = parseEntries(content);

if (COMMAND === 'index') {
  // Return a summary of keys
  const index = entries.map(e => ({ key: e.key, title: e.title, year: e.year }));
  console.log(JSON.stringify(index, null, 2));
} 
else if (COMMAND === 'get') {
  if (!ARG) {
    console.error('Error: Missing citation key');
    process.exit(1);
  }
  const entry = entries.find(e => e.key === ARG);
  if (entry) {
    console.log(entry.fullText);
  } else {
    console.error(`Error: Entry '${ARG}' not found.`);
    process.exit(1);
  }
}
else if (COMMAND === 'search') {
  if (!ARG) {
    console.error('Error: Missing search query');
    process.exit(1);
  }
  const query = ARG.toLowerCase();
  const results = entries.filter(e => 
    e.title.toLowerCase().includes(query) || 
    e.key.toLowerCase().includes(query) ||
    e.fullText.toLowerCase().includes(query)
  );
  // Return full entries for search results (up to a limit?)
  console.log(JSON.stringify(results.map(e => ({ key: e.key, title: e.title, year: e.year })), null, 2));
}
else {
  console.error(`Unknown command: ${COMMAND}`);
  process.exit(1);
}
