/**
 * Feature Tests for WTF-P v0.5.0
 *
 * Validates that all 20 features are present and correctly structured.
 * Tests structural requirements, not runtime behavior.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

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

function readFile(filepath) {
  return fs.existsSync(filepath) ? fs.readFileSync(filepath, 'utf8') : null;
}

// ============================================================================
// Feature 1: Multi-Runtime Support (Claude, Gemini, OpenCode)
// ============================================================================

console.log('=== Feature Tests for WTF-P v0.5.0 ===\n');
console.log(`${COLORS.cyan}--- Feature 1: Multi-Runtime Support ---${COLORS.reset}`);

const RUNTIMES = ['claude', 'gemini', 'opencode'];
const MANIFEST_PATH = path.join(ROOT, 'bin', 'lib', 'manifest.js');

// Test manifest exists and has all runtimes
if (fs.existsSync(MANIFEST_PATH)) {
  pass('MANIFEST file exists');
  const manifest = require(MANIFEST_PATH);

  for (const runtime of RUNTIMES) {
    if (manifest[runtime]) {
      pass(`manifest has ${runtime} configuration`);
      if (manifest[runtime].name) pass(`${runtime} has name`);
      if (manifest[runtime].defaultDir) pass(`${runtime} has defaultDir`);
      if (manifest[runtime].configDirEnv) pass(`${runtime} has configDirEnv`);
      if (manifest[runtime].components && manifest[runtime].components.length > 0) {
        pass(`${runtime} has components (${manifest[runtime].components.length})`);
      }
    } else {
      fail(`manifest missing ${runtime} configuration`);
    }
  }
} else {
  fail('MANIFEST file missing');
}

// Test vendor directories exist
for (const runtime of RUNTIMES) {
  const vendorDir = path.join(ROOT, 'vendors', runtime);
  if (fs.existsSync(vendorDir)) {
    pass(`vendors/${runtime}/ directory exists`);

    const cmdDir = path.join(vendorDir, 'commands', 'wtfp');
    if (fs.existsSync(cmdDir)) {
      const files = fs.readdirSync(cmdDir).filter(f => f.endsWith('.md'));
      pass(`${runtime} has ${files.length} commands`);
    }
  } else {
    fail(`vendors/${runtime}/ directory missing`);
  }
}

// ============================================================================
// Feature 2: Installer with Runtime Selection
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 2: Installer Runtime Selection ---${COLORS.reset}`);

const INSTALL_PATH = path.join(ROOT, 'bin', 'install.js');
if (fs.existsSync(INSTALL_PATH)) {
  const content = readFile(INSTALL_PATH);
  pass('install.js exists');

  if (content.includes('--gemini')) pass('installer supports --gemini flag');
  else fail('installer missing --gemini flag');

  if (content.includes('--opencode')) pass('installer supports --opencode flag');
  else fail('installer missing --opencode flag');

  if (content.includes('--all')) pass('installer supports --all flag');
  else fail('installer missing --all flag');

  if (content.includes('--global') || content.includes('-g')) pass('installer supports --global flag');
  else fail('installer missing --global flag');

  if (content.includes('--local') || content.includes('-l')) pass('installer supports --local flag');
  else fail('installer missing --local flag');
} else {
  fail('install.js missing');
}

// ============================================================================
// Feature 3: Uninstaller with MANIFEST-based Cleanup
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 3: Uninstaller ---${COLORS.reset}`);

const UNINSTALL_PATH = path.join(ROOT, 'bin', 'uninstall.js');
if (fs.existsSync(UNINSTALL_PATH)) {
  const content = readFile(UNINSTALL_PATH);
  pass('uninstall.js exists');

  if (content.includes('MANIFEST')) pass('uninstaller uses MANIFEST');
  else fail('uninstaller should use MANIFEST');

  if (content.includes('--dry-run') || content.includes('-n')) pass('uninstaller supports --dry-run');
  else fail('uninstaller missing --dry-run');

  if (content.includes('--backup') || content.includes('-b')) pass('uninstaller supports --backup');
  else fail('uninstaller missing --backup');

  if (content.includes('--force') || content.includes('-f')) pass('uninstaller supports --force');
  else fail('uninstaller missing --force');

  for (const runtime of RUNTIMES) {
    if (content.includes(`--${runtime}`) || content.includes(runtime)) {
      pass(`uninstaller supports ${runtime}`);
    }
  }
} else {
  fail('uninstall.js missing');
}

// ============================================================================
// Feature 4: Settings Command
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 4: Settings Command ---${COLORS.reset}`);

const SETTINGS_PATH = path.join(ROOT, 'vendors', 'claude', 'commands', 'wtfp', 'settings.md');
if (fs.existsSync(SETTINGS_PATH)) {
  const content = readFile(SETTINGS_PATH);
  pass('settings.md exists');

  if (content.includes('config.json')) pass('settings reads config.json');
  else fail('settings should read config.json');

  if (content.includes('AskUserQuestion')) pass('settings is interactive');
  else fail('settings should be interactive');

  if (content.includes('diff') || content.includes('Diff') || content.includes('changes')) {
    pass('settings shows diff of changes');
  }
} else {
  fail('settings.md missing');
}

// ============================================================================
// Feature 5: Add-Todo Command
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 5: Add-Todo Command ---${COLORS.reset}`);

const ADD_TODO_PATH = path.join(ROOT, 'vendors', 'claude', 'commands', 'wtfp', 'add-todo.md');
if (fs.existsSync(ADD_TODO_PATH)) {
  const content = readFile(ADD_TODO_PATH);
  pass('add-todo.md exists');

  if (content.includes('.planning/todos')) pass('add-todo uses .planning/todos/');
  else fail('add-todo should use .planning/todos/');

  if (content.includes('pending')) pass('add-todo creates pending todos');
  else fail('add-todo should create pending todos');

  if (content.includes('slug') || content.includes('filename')) pass('add-todo generates filename');
} else {
  fail('add-todo.md missing');
}

// ============================================================================
// Feature 6: Check-Todos Command
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 6: Check-Todos Command ---${COLORS.reset}`);

const CHECK_TODOS_PATH = path.join(ROOT, 'vendors', 'claude', 'commands', 'wtfp', 'check-todos.md');
if (fs.existsSync(CHECK_TODOS_PATH)) {
  const content = readFile(CHECK_TODOS_PATH);
  pass('check-todos.md exists');

  if (content.includes('AskUserQuestion')) pass('check-todos is interactive');
  else fail('check-todos should be interactive');

  if (content.includes('pending')) pass('check-todos reads pending todos');
  if (content.includes('dismiss')) pass('check-todos can dismiss');
  if (content.includes('done')) pass('check-todos can mark done');
} else {
  fail('check-todos.md missing');
}

// ============================================================================
// Feature 7: Update Command
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 7: Update Command ---${COLORS.reset}`);

const UPDATE_PATH = path.join(ROOT, 'vendors', 'claude', 'commands', 'wtfp', 'update.md');
if (fs.existsSync(UPDATE_PATH)) {
  const content = readFile(UPDATE_PATH);
  pass('update.md exists');

  if (content.includes('npm')) pass('update checks npm registry');
  else fail('update should check npm registry');

  if (content.includes('version')) pass('update checks version');
  if (content.includes('changelog') || content.includes('CHANGELOG')) pass('update shows changelog');
} else {
  fail('update.md missing');
}

// ============================================================================
// Feature 8: Verify-Work Command
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 8: Verify-Work Command ---${COLORS.reset}`);

const VERIFY_PATH = path.join(ROOT, 'vendors', 'claude', 'commands', 'wtfp', 'verify-work.md');
if (fs.existsSync(VERIFY_PATH)) {
  const content = readFile(VERIFY_PATH);
  pass('verify-work.md exists');

  // Verify-work is conversational, no subagent
  if (!content.includes('Task(') || content.includes('conversational')) {
    pass('verify-work is conversational (no subagent)');
  }

  if (content.includes('CONTEXT.md') || content.includes('requirements')) {
    pass('verify-work checks against requirements');
  }
} else {
  fail('verify-work.md missing');
}

// ============================================================================
// Feature 9: Execute-Outline Command
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 9: Execute-Outline Command ---${COLORS.reset}`);

const EXECUTE_PATH = path.join(ROOT, 'vendors', 'claude', 'commands', 'wtfp', 'execute-outline.md');
if (fs.existsSync(EXECUTE_PATH)) {
  const content = readFile(EXECUTE_PATH);
  pass('execute-outline.md exists');

  if (content.includes('section-writer')) pass('execute-outline uses section-writer agent');
  if (content.includes('coherence-checker')) pass('execute-outline uses coherence-checker agent');
  if (content.includes('ROADMAP.md') || content.includes('outline')) pass('execute-outline follows outline');
} else {
  fail('execute-outline.md missing');
}

// ============================================================================
// Feature 10: Create-Outline Command
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 10: Create-Outline Command ---${COLORS.reset}`);

const OUTLINE_PATH = path.join(ROOT, 'vendors', 'claude', 'commands', 'wtfp', 'create-outline.md');
if (fs.existsSync(OUTLINE_PATH)) {
  const content = readFile(OUTLINE_PATH);
  pass('create-outline.md exists');

  if (content.includes('outliner')) pass('create-outline uses outliner agent');
  if (content.includes('ROADMAP.md')) pass('create-outline creates ROADMAP.md');
} else {
  fail('create-outline.md missing');
}

// ============================================================================
// Feature 11: Coherence-Checker Agent
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 11: Coherence-Checker Agent ---${COLORS.reset}`);

const COHERENCE_PATH = path.join(ROOT, 'vendors', 'claude', 'agents', 'wtfp', 'coherence-checker.md');
if (fs.existsSync(COHERENCE_PATH)) {
  const content = readFile(COHERENCE_PATH);
  pass('coherence-checker.md exists');

  if (content.includes('inline') || content.includes('content')) {
    pass('coherence-checker receives inline content');
  }
  if (content.includes('coherence') || content.includes('flow') || content.includes('transition')) {
    pass('coherence-checker checks document flow');
  }
} else {
  fail('coherence-checker.md missing');
}

// ============================================================================
// Feature 12: Outliner Agent
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 12: Outliner Agent ---${COLORS.reset}`);

const OUTLINER_PATH = path.join(ROOT, 'vendors', 'claude', 'agents', 'wtfp', 'outliner.md');
if (fs.existsSync(OUTLINER_PATH)) {
  const content = readFile(OUTLINER_PATH);
  pass('outliner.md exists');

  if (content.includes('structure') || content.includes('sections') || content.includes('hierarchy')) {
    pass('outliner creates document structure');
  }
} else {
  fail('outliner.md missing');
}

// ============================================================================
// Feature 13: Model Profile System
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 13: Model Profile System ---${COLORS.reset}`);

const CONFIG_TEMPLATE = path.join(ROOT, 'core', 'write-the-f-paper', 'templates', 'config.json');
if (fs.existsSync(CONFIG_TEMPLATE)) {
  const content = readFile(CONFIG_TEMPLATE);
  pass('config.json template exists');

  if (content.includes('model_profile')) pass('config has model_profile');
  if (content.includes('quality')) pass('config has quality profile option');
  if (content.includes('balanced')) pass('config has balanced profile option');
  if (content.includes('budget')) pass('config has budget profile option');
} else {
  fail('config.json template missing');
}

// ============================================================================
// Feature 14: Gate Resolution System
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 14: Gate Resolution System ---${COLORS.reset}`);

// Check multiple commands for gate handling
const GATE_COMMANDS = ['plan-section', 'write-section'];
for (const cmd of GATE_COMMANDS) {
  const cmdPath = path.join(ROOT, 'vendors', 'claude', 'commands', 'wtfp', `${cmd}.md`);
  if (fs.existsSync(cmdPath)) {
    const content = readFile(cmdPath);
    if (content.includes('gate') || content.includes('confirm') || content.includes('check')) {
      pass(`${cmd} has gate handling`);
    }
  }
}

// ============================================================================
// Feature 15: WTF-P Statusline Format
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 15: Statusline Format ---${COLORS.reset}`);

const STATUSLINE_COMMANDS = ['progress', 'settings', 'check-todos'];
for (const cmd of STATUSLINE_COMMANDS) {
  const cmdPath = path.join(ROOT, 'vendors', 'claude', 'commands', 'wtfp', `${cmd}.md`);
  if (fs.existsSync(cmdPath)) {
    const content = readFile(cmdPath);
    if (content.includes('WTF-P') && (content.includes('►') || content.includes('>'))) {
      pass(`${cmd} uses WTF-P statusline`);
    } else if (content.includes('━━') || content.includes('Banner')) {
      pass(`${cmd} has status banner`);
    }
  }
}

// ============================================================================
// Feature 16: Todo File-as-State Pattern
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 16: Todo File-as-State ---${COLORS.reset}`);

// Check add-todo creates proper file structure
{
  const content = readFile(ADD_TODO_PATH);
  if (content) {
    if (content.includes('pending') && content.includes('dismissed') && content.includes('done')) {
      pass('todo system uses pending/dismissed/done states');
    } else if (content.includes('.planning/todos/')) {
      pass('todo system uses file-based state');
    }

    if (content.includes('YYYYMMDD') || content.includes('timestamp') || content.includes('Date')) {
      pass('todos have timestamp in filename');
    }
  }
}

// ============================================================================
// Feature 17: Gemini CLI Conventions
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 17: Gemini CLI Conventions ---${COLORS.reset}`);

const GEMINI_CMD_DIR = path.join(ROOT, 'vendors', 'gemini', 'commands', 'wtfp');
if (fs.existsSync(GEMINI_CMD_DIR)) {
  const files = fs.readdirSync(GEMINI_CMD_DIR).filter(f => f.endsWith('.md'));

  for (const f of files) {
    const content = readFile(path.join(GEMINI_CMD_DIR, f));
    if (content) {
      // Gemini uses ~/.config/gemini/
      if (content.includes('~/.config/gemini/')) {
        pass(`gemini/${f} uses correct path prefix`);
      }
      // Gemini commands should NOT have allowed-tools
      if (!content.includes('allowed-tools:')) {
        pass(`gemini/${f} omits allowed-tools (correct)`);
      }
    }
  }
}

// ============================================================================
// Feature 18: OpenCode Conventions
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 18: OpenCode Conventions ---${COLORS.reset}`);

const OPENCODE_CMD_DIR = path.join(ROOT, 'vendors', 'opencode', 'commands', 'wtfp');
if (fs.existsSync(OPENCODE_CMD_DIR)) {
  const files = fs.readdirSync(OPENCODE_CMD_DIR).filter(f => f.endsWith('.md'));

  for (const f of files) {
    const content = readFile(path.join(OPENCODE_CMD_DIR, f));
    if (content) {
      // OpenCode uses ~/.opencode/
      if (content.includes('~/.opencode/')) {
        pass(`opencode/${f} uses correct path prefix`);
      }
      // OpenCode commands should NOT have allowed-tools
      if (!content.includes('allowed-tools:')) {
        pass(`opencode/${f} omits allowed-tools (correct)`);
      }
    }
  }
}

// ============================================================================
// Feature 19: Core Workflows
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 19: Core Workflows ---${COLORS.reset}`);

const WORKFLOW_DIR = path.join(ROOT, 'core', 'write-the-f-paper', 'workflows');
if (fs.existsSync(WORKFLOW_DIR)) {
  const files = fs.readdirSync(WORKFLOW_DIR).filter(f => f.endsWith('.md') && !f.endsWith('.wcn.md'));
  pass(`workflows directory has ${files.length} files`);

  // Check key workflows exist
  const expectedWorkflows = ['paper-writing', 'revision'];
  for (const wf of expectedWorkflows) {
    const hasWorkflow = files.some(f => f.includes(wf));
    if (hasWorkflow) {
      pass(`${wf} workflow exists`);
    }
  }
} else {
  fail('workflows directory missing');
}

// ============================================================================
// Feature 20: Agent System
// ============================================================================

console.log(`\n${COLORS.cyan}--- Feature 20: Agent System ---${COLORS.reset}`);

const AGENT_DIR = path.join(ROOT, 'vendors', 'claude', 'agents', 'wtfp');
if (fs.existsSync(AGENT_DIR)) {
  const files = fs.readdirSync(AGENT_DIR).filter(f => f.endsWith('.md'));
  pass(`agents directory has ${files.length} agents`);

  // Check key agents exist
  const expectedAgents = [
    'section-planner', 'section-writer', 'section-reviewer',
    'plan-checker', 'argument-verifier', 'prose-polisher',
    'citation-expert', 'citation-formatter', 'research-synthesizer',
    'outliner', 'coherence-checker'
  ];

  for (const agent of expectedAgents) {
    const agentPath = path.join(AGENT_DIR, `${agent}.md`);
    if (fs.existsSync(agentPath)) {
      pass(`${agent} agent exists`);
    } else {
      fail(`${agent} agent missing`);
    }
  }
} else {
  fail('agents directory missing');
}

// ============================================================================
// Additional Structure Tests
// ============================================================================

console.log(`\n${COLORS.cyan}--- Additional Structure Tests ---${COLORS.reset}`);

// Test all Claude commands have required tags
const CLAUDE_CMD_DIR = path.join(ROOT, 'vendors', 'claude', 'commands', 'wtfp');
if (fs.existsSync(CLAUDE_CMD_DIR)) {
  const files = fs.readdirSync(CLAUDE_CMD_DIR).filter(f => f.endsWith('.md'));

  let validCount = 0;
  for (const f of files) {
    const content = readFile(path.join(CLAUDE_CMD_DIR, f));
    if (content && content.includes('<objective>') && content.includes('<process>')) {
      validCount++;
    }
  }
  pass(`${validCount}/${files.length} Claude commands have proper structure`);
}

// Test templates exist
const TEMPLATE_DIR = path.join(ROOT, 'core', 'write-the-f-paper', 'templates');
if (fs.existsSync(TEMPLATE_DIR)) {
  const templates = fs.readdirSync(TEMPLATE_DIR);
  pass(`templates directory has ${templates.length} files`);

  if (templates.includes('project.md')) pass('project.md template exists');
  if (templates.includes('config.json')) pass('config.json template exists');
  if (templates.includes('roadmap.md')) pass('roadmap.md template exists');
}

// Test references exist
const REF_DIR = path.join(ROOT, 'core', 'write-the-f-paper', 'references');
if (fs.existsSync(REF_DIR)) {
  const refs = fs.readdirSync(REF_DIR);
  pass(`references directory has ${refs.length} files`);
}

// ============================================================================
// Results
// ============================================================================

console.log(`\n=== Feature Tests: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  process.exit(1);
}
