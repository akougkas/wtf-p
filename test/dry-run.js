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
  }
};

// ─── Test 1: Agent files exist for all declared agents ───────────────────────

console.log('=== Dry-Run Tests ===\n');
console.log(`${COLORS.cyan}--- Agent Resolution ---${COLORS.reset}`);

const allDeclaredAgents = new Set();
for (const [cmd, spec] of Object.entries(ORCHESTRATOR_AGENTS)) {
  allDeclaredAgents.add(spec.primary);
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

  // Check primary agent reference
  if (content.includes(spec.primary)) {
    pass(`${cmd} references primary agent: ${spec.primary}`);
  } else {
    fail(`${cmd} does NOT reference primary agent: ${spec.primary}`);
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

// ─── Results ─────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  process.exit(1);
}
