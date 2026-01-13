const fs = require('fs');

/**
 * WTF-P Bibliography Indexer
 * Indexes and retrieves BibTeX entries without loading the entire file into context.
 */

const ENTRY_REGEX = /@(\w+)\s*\{\s*([^,]+),([^@]*)\}/g;

function parseEntries(text) {
  const entries = [];
  let match;
  // Reset regex index just in case
  ENTRY_REGEX.lastIndex = 0;
  
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

function index(content) {
  const entries = parseEntries(content);
  return JSON.stringify(entries.map(e => ({ key: e.key, title: e.title, year: e.year })), null, 2);
}

function getEntry(content, key) {
  const entries = parseEntries(content);
  const entry = entries.find(e => e.key === key);
  return entry ? entry.fullText : null;
}

function search(content, query) {
  const entries = parseEntries(content);
  const q = query.toLowerCase();
  const results = entries.filter(e => 
    e.title.toLowerCase().includes(q) || 
    e.key.toLowerCase().includes(q) ||
    e.fullText.toLowerCase().includes(q)
  );
  return JSON.stringify(results.map(e => ({ key: e.key, title: e.title, year: e.year })), null, 2);
}

// --- CLI Handling ---

if (require.main === module) {
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

  if (COMMAND === 'index') {
    console.log(index(content));
  } 
  else if (COMMAND === 'get') {
    if (!ARG) {
      console.error('Error: Missing citation key');
      process.exit(1);
    }
    const result = getEntry(content, ARG);
    if (result) console.log(result);
    else {
      console.error(`Error: Entry '${ARG}' not found.`);
      process.exit(1);
    }
  }
  else if (COMMAND === 'search') {
    if (!ARG) {
      console.error('Error: Missing search query');
      process.exit(1);
    }
    console.log(search(content, ARG));
  }
  else {
    console.error(`Unknown command: ${COMMAND}`);
    process.exit(1);
  }
}

module.exports = { index, getEntry, search, parseEntries };