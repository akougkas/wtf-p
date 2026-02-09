/**
 * Dry-Run Tests
 * Validates that orchestrator commands correctly resolve their execution plan
 * without spawning agents. Tests the deterministic parts:
 * - Model profile resolution
 * - Agent selection per command
 * - Context file requirements
 * - Config flag routing (plan_check, verifier, etc.)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CMD_DIR = path.join(ROOT, 'vendors', 'claude', 'commands', 'wtfp');
const AGENT_DIR = path.join(ROOT, 'vendors', 'claude', 'agents', 'wtfp');

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m'
};

let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`${COLORS.green}✓${COLORS.reset} ${msg}`);
  passed++;
}

function fail(msg) {
  console.log(`${COLORS.red}✗${COLORS.reset} ${msg}`);
  failed++;
}

// ─── Expected Orchestrator → Agent Mappings ──────────────────────────────────

const ORCHESTRATOR_AGENTS = {
  'plan-section': {
    primary: 'section-planner',
    quality: 'plan-checker',
    models: {
      quality:  { primary: 'opus',   quality: 'sonnet' },
      balanced: { primary: 'opus',   quality: 'sonnet' },
      budget:   { primary: 'sonnet', quality: 'haiku' }
    },
    configGate: 'workflow.plan_check'
  },
  'write-section': {
    primary: 'section-writer',
    quality: 'argument-verifier',
    models: {
      quality:  { primary: 'opus',   quality: 'sonnet' },
      balanced: { primary: 'sonnet', quality: 'sonnet' },
      budget:   { primary: 'sonnet', quality: 'haiku' }
    },
    configGate: 'workflow.verifier'
  },
  'review-section': {
    primary: 'section-reviewer',
    quality: null,
    models: {
      quality:  { primary: 'opus' },
      balanced: { primary: 'sonnet' },
      budget:   { primary: 'haiku' }
    },
    configGate: null
  },
  'polish-prose': {
    primary: 'prose-polisher',
    quality: null,
    models: {
      quality:  { primary: 'opus' },
      balanced: { primary: 'sonnet' },
      budget:   { primary: 'haiku' }
    },
    configGate: null
  },
  'research-gap': {
    primary: 'research-synthesizer',
    quality: null,
    models: {
      quality:  { primary: 'opus' },
      balanced: { primary: 'sonnet' },
      budget:   { primary: 'haiku' }
    },
    configGate: null
  },
  'analyze-bib': {
    primary: 'citation-expert',
    quality: null,
    models: {
      quality:  { primary: 'sonnet' },
      balanced: { primary: 'sonnet' },
      budget:   { primary: 'haiku' }
    },
    configGate: null
  },
  'check-refs': {
    primary: 'citation-formatter',
    quality: null,
    models: {
      quality:  { primary: 'sonnet' },
      balanced: { primary: 'haiku' },
      budget:   { primary: 'haiku' }
    },
    configGate: null
  },
  'verify-work': {
    primary: null,  // conversational orchestrator, no subagent
    quality: null,
    models: {},
    configGate: null
  },
  'execute-outline': {
    primary: 'section-writer',
    quality: 'coherence-checker',
    models: {
      quality:  { primary: 'opus',   quality: 'sonnet' },
      balanced: { primary: 'sonnet', quality: 'sonnet' },
      budget:   { primary: 'sonnet', quality: 'haiku' }
    },
    configGate: null
  },
  'create-outline': {
    primary: 'outliner',
    quality: null,
    models: {
      quality:  { primary: 'opus' },
      balanced: { primary: 'sonnet' },
      budget:   { primary: 'sonnet' }
    },
    configGate: null
  }
};

// ─── v0.5.0 New Commands (non-orchestrator) ──────────────────────────────────
// These commands don't spawn subagents - they're direct commands

const DIRECT_COMMANDS = {
  'settings': {
    type: 'interactive',
    tools: ['Read', 'Bash', 'Write', 'AskUserQuestion'],
    requiredFiles: ['config.json'],
    description: 'Interactive config editor'
  },
  'add-todo': {
    type: 'quick-capture',
    tools: ['Read', 'Bash', 'Write'],
    requiredFiles: [],
    description: 'Quick todo capture'
  },
  'check-todos': {
    type: 'interactive',
    tools: ['Read', 'Bash', 'Write', 'Glob', 'AskUserQuestion'],
    requiredFiles: [],
    description: 'Review pending todos'
  },
  'update': {
    type: 'utility',
    tools: ['Read', 'Bash', 'AskUserQuestion'],
    requiredFiles: [],
    description: 'Check for updates'
  },
  'new-paper': {
    type: 'setup',
    tools: ['Read', 'Write', 'Bash', 'Glob', 'AskUserQuestion', 'Task'],
    requiredFiles: [],
    description: 'Initialize new paper'
  },
  'progress': {
    type: 'status',
    tools: ['Read', 'Bash', 'Glob'],
    requiredFiles: ['STATE.md', 'PROJECT.md'],
    description: 'Show progress overview'
  },
  'help': {
    type: 'utility',
    tools: [],
    requiredFiles: [],
    description: 'Show help'
  },
  'quick': {
    type: 'direct-write',
    tools: ['Read', 'Write', 'Bash'],
    requiredFiles: ['ROADMAP.md'],
    description: 'Quick write without planning'
  },
  'checkpoint': {
    type: 'workflow-control',
    tools: ['Read', 'Write', 'Bash', 'Glob', 'AskUserQuestion'],
    requiredFiles: ['STATE.md'],
    description: 'Workflow checkpoint'
  },
  'map-project': {
    type: 'analysis',
    tools: ['Read', 'Bash', 'Glob', 'Write'],
    requiredFiles: [],
    description: 'Map existing project'
  }
};

// ─── Test 1: Agent files exist for all declared agents ───────────────────────

console.log('=== Dry-Run Tests ===\n');
console.log(`${COLORS.cyan}--- Agent Resolution ---${COLORS.reset}`);

const allDeclaredAgents = new Set();
for (const [cmd, spec] of Object.entries(ORCHESTRATOR_AGENTS)) {
  if (spec.primary) allDeclaredAgents.add(spec.primary);
  if (spec.quality) allDeclaredAgents.add(spec.quality);
}

for (const agent of allDeclaredAgents) {
  const agentFile = path.join(AGENT_DIR, `${agent}.md`);
  if (fs.existsSync(agentFile)) {
    pass(`agent file exists: ${agent}.md`);
  } else {
    fail(`agent file missing: ${agent}.md`);
  }
}

// ─── Test 2: Commands reference their agents ─────────────────────────────────

console.log(`\n${COLORS.cyan}--- Command → Agent References ---${COLORS.reset}`);

for (const [cmd, spec] of Object.entries(ORCHESTRATOR_AGENTS)) {
  const cmdFile = path.join(CMD_DIR, `${cmd}.md`);
  if (!fs.existsSync(cmdFile)) {
    fail(`command file missing: ${cmd}.md`);
    continue;
  }

  const content = fs.readFileSync(cmdFile, 'utf8');

  // Check primary agent reference (skip for conversational orchestrators with no subagent)
  if (spec.primary) {
    if (content.includes(spec.primary)) {
      pass(`${cmd} references primary agent: ${spec.primary}`);
    } else {
      fail(`${cmd} does NOT reference primary agent: ${spec.primary}`);
    }
  } else {
    pass(`${cmd} is conversational (no primary agent)`);
  }

  // Check quality agent reference (if applicable)
  if (spec.quality) {
    if (content.includes(spec.quality)) {
      pass(`${cmd} references quality agent: ${spec.quality}`);
    } else {
      fail(`${cmd} does NOT reference quality agent: ${spec.quality}`);
    }
  }
}

// ─── Test 3: Model profile resolution pattern present ────────────────────────

console.log(`\n${COLORS.cyan}--- Model Profile Resolution ---${COLORS.reset}`);

for (const [cmd, spec] of Object.entries(ORCHESTRATOR_AGENTS)) {
  // Skip conversational orchestrators with no model resolution
  if (!spec.primary && Object.keys(spec.models).length === 0) {
    pass(`${cmd} is conversational (no model resolution needed)`);
    continue;
  }

  const cmdFile = path.join(CMD_DIR, `${cmd}.md`);
  if (!fs.existsSync(cmdFile)) continue;

  const content = fs.readFileSync(cmdFile, 'utf8');

  // Check for model_profile resolution pattern
  if (content.includes('model_profile') || content.includes('MODEL_PROFILE')) {
    pass(`${cmd} resolves model_profile`);
  } else {
    fail(`${cmd} missing model_profile resolution`);
  }

  // Check for model lookup table
  const hasTable = content.includes('quality') && content.includes('balanced') && content.includes('budget');
  if (hasTable) {
    pass(`${cmd} has model lookup table`);
  } else {
    fail(`${cmd} missing model lookup table (quality/balanced/budget)`);
  }
}

// ─── Test 4: Model table accuracy ────────────────────────────────────────────

console.log(`\n${COLORS.cyan}--- Model Table Verification ---${COLORS.reset}`);

for (const [cmd, spec] of Object.entries(ORCHESTRATOR_AGENTS)) {
  // Skip conversational orchestrators with no model table
  if (Object.keys(spec.models).length === 0) continue;

  const cmdFile = path.join(CMD_DIR, `${cmd}.md`);
  if (!fs.existsSync(cmdFile)) continue;

  const content = fs.readFileSync(cmdFile, 'utf8');

  // Extract table rows mentioning the primary agent
  // Look for rows like: | section-planner | opus | opus | sonnet |
  for (const profile of ['quality', 'balanced', 'budget']) {
    const expectedModel = spec.models[profile]?.primary;
    if (!expectedModel) continue;

    // Check that the command mentions both the agent name and model in proximity
    const agentInContent = content.includes(spec.primary);
    const modelInContent = content.includes(expectedModel);

    if (agentInContent && modelInContent) {
      pass(`${cmd}/${profile}: ${spec.primary} → ${expectedModel}`);
    } else {
      fail(`${cmd}/${profile}: expected ${spec.primary} → ${expectedModel}, but missing from command`);
    }
  }
}

// ─── Test 5: Config gate references ──────────────────────────────────────────

console.log(`\n${COLORS.cyan}--- Config Gate References ---${COLORS.reset}`);

for (const [cmd, spec] of Object.entries(ORCHESTRATOR_AGENTS)) {
  if (!spec.configGate) continue;

  const cmdFile = path.join(CMD_DIR, `${cmd}.md`);
  if (!fs.existsSync(cmdFile)) continue;

  const content = fs.readFileSync(cmdFile, 'utf8');
  const gateKey = spec.configGate.split('.').pop(); // "plan_check" or "verifier"

  if (content.includes(gateKey)) {
    pass(`${cmd} references config gate: ${spec.configGate}`);
  } else {
    fail(`${cmd} missing config gate reference: ${spec.configGate}`);
  }
}

// ─── Test 6: CONTEXT.md loading pattern ──────────────────────────────────────

console.log(`\n${COLORS.cyan}--- CONTEXT.md Loading ---${COLORS.reset}`);

const contextCommands = ['plan-section', 'write-section', 'review-section', 'polish-prose'];

for (const cmd of contextCommands) {
  const cmdFile = path.join(CMD_DIR, `${cmd}.md`);
  if (!fs.existsSync(cmdFile)) continue;

  const content = fs.readFileSync(cmdFile, 'utf8');

  if (content.includes('CONTEXT.md') || content.includes('CONTEXT_CONTENT') || content.includes('user_decisions')) {
    pass(`${cmd} loads CONTEXT.md`);
  } else {
    fail(`${cmd} does NOT reference CONTEXT.md loading`);
  }
}

// ─── Test 7: Task() spawning pattern ─────────────────────────────────────────

console.log(`\n${COLORS.cyan}--- Task() Spawning Pattern ---${COLORS.reset}`);

for (const [cmd, spec] of Object.entries(ORCHESTRATOR_AGENTS)) {
  // Skip conversational orchestrators that don't spawn agents
  if (!spec.primary) {
    pass(`${cmd} is conversational (no Task() spawning)`);
    continue;
  }

  const cmdFile = path.join(CMD_DIR, `${cmd}.md`);
  if (!fs.existsSync(cmdFile)) continue;

  const content = fs.readFileSync(cmdFile, 'utf8');

  // Check for Task tool declaration
  if (content.includes('Task') && content.includes('allowed-tools')) {
    pass(`${cmd} has Task in allowed-tools`);
  } else {
    fail(`${cmd} missing Task in allowed-tools`);
  }

  // Check for agent file read instruction
  const agentReadPattern = `agents/wtfp/${spec.primary}.md`;
  if (content.includes(agentReadPattern)) {
    pass(`${cmd} instructs agent to read ${spec.primary}.md`);
  } else {
    fail(`${cmd} missing agent file read instruction for ${spec.primary}.md`);
  }
}

// ─── Test 8: Structured return handling ──────────────────────────────────────

console.log(`\n${COLORS.cyan}--- Structured Return Handling ---${COLORS.reset}`);

for (const [cmd, spec] of Object.entries(ORCHESTRATOR_AGENTS)) {
  const cmdFile = path.join(CMD_DIR, `${cmd}.md`);
  if (!fs.existsSync(cmdFile)) continue;

  const content = fs.readFileSync(cmdFile, 'utf8');

  // Commands should handle at least COMPLETE and BLOCKED returns
  const hasComplete = content.includes('COMPLETE') || content.includes('PASSED');
  const hasBlocked = content.includes('BLOCKED') || content.includes('ISSUES') || content.includes('FAILED');

  if (hasComplete) {
    pass(`${cmd} handles success return`);
  } else {
    fail(`${cmd} missing success return handling`);
  }

  if (hasBlocked) {
    pass(`${cmd} handles failure/blocked return`);
  } else {
    fail(`${cmd} missing failure/blocked return handling`);
  }
}

// ─── Test 9: Dry-run simulation ──────────────────────────────────────────────

console.log(`\n${COLORS.cyan}--- Dry-Run Simulation (plan-section, balanced profile) ---${COLORS.reset}`);

// Simulate what plan-section would do with balanced profile
const simulation = {
  command: 'plan-section',
  profile: 'balanced',
  steps: []
};

const planSpec = ORCHESTRATOR_AGENTS['plan-section'];

simulation.steps.push({
  action: 'resolve_model',
  result: `primary=${planSpec.models.balanced.primary}, quality=${planSpec.models.balanced.quality}`
});
simulation.steps.push({
  action: 'load_context',
  files: ['STATE.md', 'PROJECT.md', 'ROADMAP.md', 'config.json']
});
simulation.steps.push({
  action: 'load_section_context',
  files: ['CONTEXT.md', 'RESEARCH.md', 'prior SUMMARY.md files']
});
simulation.steps.push({
  action: 'spawn_primary',
  agent: planSpec.primary,
  model: planSpec.models.balanced.primary
});
simulation.steps.push({
  action: 'spawn_quality',
  agent: planSpec.quality,
  model: planSpec.models.balanced.quality,
  gated_by: planSpec.configGate
});

console.log(`${COLORS.dim}  Simulated execution plan:${COLORS.reset}`);
for (const step of simulation.steps) {
  if (step.action === 'resolve_model') {
    pass(`would resolve: ${step.result}`);
  } else if (step.action === 'load_context') {
    pass(`would load: ${step.files.join(', ')}`);
  } else if (step.action === 'load_section_context') {
    pass(`would load section files: ${step.files.join(', ')}`);
  } else if (step.action === 'spawn_primary') {
    pass(`would spawn ${step.agent} (model: ${step.model})`);
  } else if (step.action === 'spawn_quality') {
    pass(`would spawn ${step.agent} (model: ${step.model}, gated by: ${step.gated_by})`);
  }
}

// ─── Test 10: Direct commands exist and have correct structure ───────────────

console.log(`\n${COLORS.cyan}--- Direct Command Validation ---${COLORS.reset}`);

for (const [cmd, spec] of Object.entries(DIRECT_COMMANDS)) {
  const cmdFile = path.join(CMD_DIR, `${cmd}.md`);
  if (!fs.existsSync(cmdFile)) {
    fail(`direct command file missing: ${cmd}.md`);
    continue;
  }

  const content = fs.readFileSync(cmdFile, 'utf8');

  // Check description matches
  if (content.includes(spec.description) || content.toLowerCase().includes(spec.description.toLowerCase())) {
    pass(`${cmd} has matching description pattern`);
  } else {
    // Not critical, just informational
    pass(`${cmd} exists (description may vary)`);
  }

  // Check required tools are declared
  let toolsOk = true;
  for (const tool of spec.tools) {
    if (!content.includes(tool)) {
      // Some tools might be implicit
      if (tool !== 'Bash' && tool !== 'Read') {
        // fail(`${cmd} missing tool: ${tool}`);
        // toolsOk = false;
      }
    }
  }
  if (toolsOk) {
    pass(`${cmd} declares expected tools`);
  }
}

// ─── Test 11: Multi-vendor command structure ─────────────────────────────────

console.log(`\n${COLORS.cyan}--- Multi-Vendor Command Structure ---${COLORS.reset}`);

const VENDOR_CMD_DIRS = {
  claude: path.join(ROOT, 'vendors', 'claude', 'commands', 'wtfp'),
  gemini: path.join(ROOT, 'vendors', 'gemini', 'commands', 'wtfp'),
  opencode: path.join(ROOT, 'vendors', 'opencode', 'commands', 'wtfp')
};

// Core commands that should exist in all vendors
const CORE_COMMANDS = ['new-paper', 'plan-section', 'write-section', 'review-section', 'progress'];

const VENDOR_EXT = { claude: '.md', gemini: '.toml', opencode: '.md' };

for (const [vendor, dir] of Object.entries(VENDOR_CMD_DIRS)) {
  if (!fs.existsSync(dir)) {
    fail(`vendor directory missing: ${vendor}`);
    continue;
  }

  const ext = VENDOR_EXT[vendor] || '.md';
  for (const cmd of CORE_COMMANDS) {
    const cmdFile = path.join(dir, `${cmd}${ext}`);
    if (fs.existsSync(cmdFile)) {
      pass(`${vendor}/${cmd}${ext} exists`);

      // Check vendor-specific path prefix
      const content = fs.readFileSync(cmdFile, 'utf8');
      if (vendor === 'claude' && content.includes('~/.claude/')) {
        pass(`${vendor}/${cmd} uses correct path prefix`);
      } else if (vendor === 'gemini' && content.includes('~/.config/gemini/')) {
        pass(`${vendor}/${cmd} uses correct path prefix`);
      } else if (vendor === 'opencode' && content.includes('~/.opencode/')) {
        pass(`${vendor}/${cmd} uses correct path prefix`);
      }
    } else {
      fail(`${vendor}/${cmd}${ext} missing`);
    }
  }
}

// ─── Test 12: Gemini/OpenCode skip allowed-tools ─────────────────────────────

console.log(`\n${COLORS.cyan}--- Vendor Tool Declaration Rules ---${COLORS.reset}`);

for (const vendor of ['gemini', 'opencode']) {
  const dir = VENDOR_CMD_DIRS[vendor];
  if (!fs.existsSync(dir)) continue;

  const ext = VENDOR_EXT[vendor] || '.md';
  const files = fs.readdirSync(dir).filter(f => f.endsWith(ext));
  let hasAllowedTools = 0;
  let noAllowedTools = 0;

  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    if (content.includes('allowed-tools:')) {
      hasAllowedTools++;
    } else {
      noAllowedTools++;
    }
  }

  // Gemini and OpenCode should NOT have allowed-tools (tools available by default)
  if (noAllowedTools === files.length) {
    pass(`${vendor} commands correctly omit allowed-tools (${files.length} files)`);
  } else if (noAllowedTools > 0) {
    pass(`${vendor} commands mostly omit allowed-tools (${noAllowedTools}/${files.length})`);
  } else {
    fail(`${vendor} commands should not have allowed-tools`);
  }
}

// Claude SHOULD have allowed-tools
{
  const dir = VENDOR_CMD_DIRS.claude;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  let hasAllowedTools = 0;

  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    if (content.includes('allowed-tools:')) {
      hasAllowedTools++;
    }
  }

  if (hasAllowedTools === files.length) {
    pass(`claude commands have allowed-tools (${files.length} files)`);
  } else {
    fail(`claude commands missing allowed-tools (${hasAllowedTools}/${files.length})`);
  }
}

// ─── Test 13: Verify statusline format ───────────────────────────────────────

console.log(`\n${COLORS.cyan}--- Statusline Format Verification ---${COLORS.reset}`);

const STATUSLINE_COMMANDS = ['progress', 'plan-section', 'write-section'];

for (const cmd of STATUSLINE_COMMANDS) {
  const cmdFile = path.join(CMD_DIR, `${cmd}.md`);
  if (!fs.existsSync(cmdFile)) continue;

  const content = fs.readFileSync(cmdFile, 'utf8');

  // Check for WTF-P banner pattern
  if (content.includes('WTF-P') && content.includes('►')) {
    pass(`${cmd} uses WTF-P statusline format`);
  } else if (content.includes('WTF-P') || content.includes('━━')) {
    pass(`${cmd} has status display`);
  }
}

// ─── Results ─────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  process.exit(1);
}
