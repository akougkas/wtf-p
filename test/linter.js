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
let passCount = 0;
let warnCount = 0;
let failCount = 0;

// Vendor-specific validation rules
// Claude requires allowed-tools; Gemini and OpenCode do not (tools available by default)
// Gemini uses TOML command format; Claude and OpenCode use Markdown with YAML frontmatter
const VENDOR_RULES = {
  claude: { requiresAllowedTools: true, commandFormat: 'md' },
  gemini: { requiresAllowedTools: false, commandFormat: 'toml' },
  opencode: { requiresAllowedTools: false, commandFormat: 'md' }
};

function error(file, msg) {
  console.log(`${COLORS.red}FAIL${COLORS.reset} ${file}: ${msg}`);
  hasErrors = true;
  failCount++;
}

function warn(file, msg) {
  console.log(`${COLORS.yellow}WARN${COLORS.reset} ${file}: ${msg}`);
  warnCount++;
}

function pass(file) {
  // console.log(`${COLORS.green}PASS${COLORS.reset} ${file}`);
  passCount++;
}

/**
 * Extract vendor name from file path
 */
function getVendorFromPath(filepath) {
  const relPath = path.relative(ROOT, filepath);
  const match = relPath.match(/^vendors\/([^/]+)\//);
  return match ? match[1] : null;
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
 * Simple TOML parser for command files
 * Extracts description and prompt fields
 */
function parseTomlCommand(content) {
  const data = {};
  
  // Extract description = "..."
  const descMatch = content.match(/^description\s*=\s*"([^"]*)"/m);
  if (descMatch) data.description = descMatch[1];
  
  // Extract prompt (multiline string between ''' or """)
  const promptMatch = content.match(/^prompt\s*=\s*'''([\s\S]*?)'''/m) ||
                      content.match(/^prompt\s*=\s*"""([\s\S]*?)"""/m);
  if (promptMatch) data.prompt = promptMatch[1];
  
  return data;
}

/**
 * Validate a Gemini TOML Command file
 */
function validateTomlCommand(filepath, vendor = null) {
  const content = fs.readFileSync(filepath, 'utf8');
  const relPath = path.relative(ROOT, filepath);

  // 1. Parse TOML
  const data = parseTomlCommand(content);

  // 2. Required Fields
  if (!data.description) error(relPath, "Missing 'description' in TOML");
  if (!data.prompt) {
    error(relPath, "Missing 'prompt' in TOML");
    return;
  }

  // 3. Structure Tags (in prompt body)
  if (!data.prompt.includes('<objective>')) error(relPath, "Missing <objective> tag in prompt");
  if (!data.prompt.includes('<process>')) error(relPath, "Missing <process> tag in prompt");

  pass(relPath);
}

/**
 * Validate a Command (.md) file
 */
function validateCommand(filepath, vendor = null) {
  const content = fs.readFileSync(filepath, 'utf8');
  const relPath = path.relative(ROOT, filepath);
  const vendorName = vendor || getVendorFromPath(filepath) || 'claude';
  const vendorRules = VENDOR_RULES[vendorName] || VENDOR_RULES.claude;

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

  // 3. Check allowed-tools presence (vendor-specific)
  // Claude requires allowed-tools; Gemini and OpenCode do not (tools available by default)
  if (vendorRules.requiresAllowedTools && !content.includes('allowed-tools:')) {
    error(relPath, "Missing 'allowed-tools' section");
  }

  // 4. Structure Tags
  if (!body.includes('<objective>')) error(relPath, "Missing <objective> tag");
  if (!body.includes('<process>')) error(relPath, "Missing <process> tag");

  // 5. AskUserQuestion Safety (only for Claude which has allowed-tools)
  if (vendorRules.requiresAllowedTools) {
    if (body.includes('AskUserQuestion') && !content.includes('AskUserQuestion')) {
       // Checking if it's in the allowed-tools list (heuristic)
       error(relPath, "Uses AskUserQuestion but not declared in allowed-tools");
    }
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
 * Validate an Agent (.md) file
 */
function validateAgent(filepath, vendor = null) {
  const content = fs.readFileSync(filepath, 'utf8');
  const relPath = path.relative(ROOT, filepath);
  const vendorName = vendor || getVendorFromPath(filepath) || 'claude';
  const vendorRules = VENDOR_RULES[vendorName] || VENDOR_RULES.claude;

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

  // 3. Check allowed-tools presence (vendor-specific)
  // Claude requires allowed-tools; Gemini and OpenCode do not
  if (vendorRules.requiresAllowedTools && !content.includes('allowed-tools:')) {
    error(relPath, "Missing 'allowed-tools' section");
  }

  // 4. Agent-specific: must have role definition (<role> tag or # heading)
  if (!body.includes('<role>') && !body.match(/^#\s+/m)) {
    error(relPath, "Missing <role> tag or heading");
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
      const vendorRules = VENDOR_RULES[vendor] || VENDOR_RULES.claude;
      if (fs.existsSync(cmdDir)) {
        fs.readdirSync(cmdDir).forEach(f => {
          if (vendorRules.commandFormat === 'toml' && f.endsWith('.toml')) {
            validateTomlCommand(path.join(cmdDir, f), vendor);
          } else if (f.endsWith('.md')) {
            validateCommand(path.join(cmdDir, f), vendor);
          }
        });
      }

      // 1b. Scan Agents
      const agentDir = path.join(vendorDir, vendor, 'agents', 'wtfp');
      if (fs.existsSync(agentDir)) {
        fs.readdirSync(agentDir).forEach(f => {
          if (f.endsWith('.md')) validateAgent(path.join(agentDir, f), vendor);
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

  // Summary
  console.log(`\n=== Linter Results: ${passCount} passed, ${failCount} failed, ${warnCount} warnings ===\n`);

  if (hasErrors) {
    console.log(`${COLORS.red}Linter FAILED${COLORS.reset}`);
    process.exit(1);
  } else {
    console.log(`${COLORS.green}Linter Passed${COLORS.reset}`);
  }
}

main();
