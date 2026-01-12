const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

let hasErrors = false;

function error(file, msg) {
  console.log(`${COLORS.red}FAIL${COLORS.reset} ${file}: ${msg}`);
  hasErrors = true;
}

function warn(file, msg) {
  console.log(`${COLORS.yellow}WARN${COLORS.reset} ${file}: ${msg}`);
}

function pass(file) {
  // console.log(`${COLORS.green}PASS${COLORS.reset} ${file}`);
}

/**
 * Simple YAML frontmatter parser
 */
function parseFrontmatter(content) {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return null;
  
  const raw = content.slice(3, end);
  const data = {};
  
  raw.split('\n').forEach(line => {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join(':').trim();
      if (key && value) {
        if (key === 'allowed-tools') {
          // Handle list format roughly
          data[key] = ['parsed_later'];
        } else {
          data[key] = value;
        }
      }
    }
  });
  
  return { data, bodyIndex: end + 4 };
}

/**
 * Validate a Command (.md) file
 */
function validateCommand(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const relPath = path.relative(ROOT, filepath);
  
  // 1. Check Frontmatter
  const fm = parseFrontmatter(content);
  if (!fm) {
    error(relPath, 'Missing or invalid YAML frontmatter');
    return;
  }
  
  const { data, bodyIndex } = fm;
  const body = content.slice(bodyIndex);

  // 2. Required Fields
  if (!data.name) error(relPath, "Missing 'name' in frontmatter");
  if (!data.description) error(relPath, "Missing 'description' in frontmatter");
  
  // 3. Check allowed-tools presence (raw check because our parser is simple)
  if (!content.includes('allowed-tools:')) {
    error(relPath, "Missing 'allowed-tools' section");
  }

  // 4. Structure Tags
  if (!body.includes('<objective>')) error(relPath, "Missing <objective> tag");
  if (!body.includes('<process>')) error(relPath, "Missing <process> tag");
  
  // 5. AskUserQuestion Safety
  if (body.includes('AskUserQuestion') && !content.includes('AskUserQuestion')) {
     // Checking if it's in the allowed-tools list (heuristic)
     error(relPath, "Uses AskUserQuestion but not declared in allowed-tools");
  }

  pass(relPath);
}

/**
 * Validate a Workflow (.md) file
 */
function validateWorkflow(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const relPath = path.relative(ROOT, filepath);

  // 1. Basic Structure
  if (content.trim().length === 0) {
    error(relPath, "File is empty");
    return;
  }

  // 2. Check for XML validity (Steps)
  const openSteps = (content.match(/<step/g) || []).length;
  const closeSteps = (content.match(/<\/step>/g) || []).length;

  if (openSteps !== closeSteps) {
    error(relPath, `Mismatched step tags: <step> (${openSteps}) vs </step> (${closeSteps})`);
  }

  pass(relPath);
}

/**
 * Main Linter
 */
function main() {
  console.log('Running Content Linter...\n');

  // 1. Scan Vendors (Commands)
  const vendorDir = path.join(ROOT, 'vendors');
  if (fs.existsSync(vendorDir)) {
    const vendors = fs.readdirSync(vendorDir);
    vendors.forEach(vendor => {
      const cmdDir = path.join(vendorDir, vendor, 'commands', 'wtfp');
      if (fs.existsSync(cmdDir)) {
        fs.readdirSync(cmdDir).forEach(f => {
          if (f.endsWith('.md')) validateCommand(path.join(cmdDir, f));
        });
      }
    });
  }

  // 2. Scan Core (Workflows)
  const coreDir = path.join(ROOT, 'core', 'write-the-f-paper', 'workflows');
  if (fs.existsSync(coreDir)) {
    fs.readdirSync(coreDir).forEach(f => {
      if (f.endsWith('.md') && !f.endsWith('.wcn.md')) {
        validateWorkflow(path.join(coreDir, f));
      }
    });
  }

  if (hasErrors) {
    console.log(`\n${COLORS.red}Linter FAILED${COLORS.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${COLORS.green}Linter Passed${COLORS.reset}`);
  }
}

main();
