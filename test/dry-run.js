/**
 * Portable workflow dry-run contracts.
 *
 * The v0.6 protocol delegates semantic roles and lets each active host choose
 * concrete models. These checks deliberately exercise that contract instead
 * of preserving the Claude-specific model tables and Markdown control files
 * used by the v0.5 implementation.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ACTION_DIR = path.join(ROOT, 'protocol', 'actions');
const ROLE_DIR = path.join(ROOT, 'protocol', 'roles');
const CLAUDE_COMMAND_DIR = path.join(ROOT, 'vendors', 'claude', 'commands');
const CLAUDE_AGENT_DIR = path.join(ROOT, 'vendors', 'claude', 'agents', 'wtfp');
const UNAVAILABLE_MARKER = 'WTFP_ACTION_UNAVAILABLE';

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m'
};

let passed = 0;
let failed = 0;

function pass(message) {
  console.log(`${COLORS.green}✓${COLORS.reset} ${message}`);
  passed += 1;
}

function fail(message) {
  console.log(`${COLORS.red}✗${COLORS.reset} ${message}`);
  failed += 1;
}

function check(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function section(title) {
  console.log(`\n${COLORS.cyan}--- ${title} ---${COLORS.reset}`);
}

const actions = fs.readdirSync(ACTION_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => readJson(path.join(ACTION_DIR, name)));
const claudeAvailability = new Map(
  readJson(path.join(ROOT, 'vendors', 'claude', 'compatibility', 'action-availability.json'))
    .actions.map((entry) => [entry.id, entry.status])
);

console.log('=== Portable Workflow Dry-Run Tests ===');

section('Canonical action and role resolution');
check(actions.length === 36, `loaded all 36 canonical actions (${actions.length})`);

const delegatedRoles = new Set();
for (const action of actions) {
  for (const delegation of action.delegation || []) delegatedRoles.add(delegation.role);
}

for (const role of [...delegatedRoles].sort()) {
  check(fs.existsSync(path.join(ROLE_DIR, `${role}.md`)), `canonical role exists: ${role}`);
  check(fs.existsSync(path.join(CLAUDE_AGENT_DIR, `${role}.md`)), `Claude projects native agent: ${role}`);
}
check(delegatedRoles.size === 11, `resolved all 11 semantic roles (${delegatedRoles.size})`);

section('Canonical-to-Claude command projection');
for (const action of actions) {
  const file = path.join(CLAUDE_COMMAND_DIR, `${action.id}.md`);
  if (!fs.existsSync(file)) {
    fail(`Claude command exists: ${action.alias}`);
    continue;
  }

  const source = fs.readFileSync(file, 'utf8');
  const needsDelegation = (action.delegation || []).length > 0;
  const available = claudeAvailability.get(action.id) === 'available';
  const hasTask = /^\s*- Task\s*$/m.test(source);
  const actionBinding = `@\${CLAUDE_PLUGIN_ROOT}/actions/${action.id}.json`;

  check(source.includes(`from protocol/actions/${action.id}`), `${action.alias} retains canonical provenance`);
  check(
    available ? source.includes(actionBinding) : source.includes(UNAVAILABLE_MARKER) && !source.includes(actionBinding),
    available ? `${action.alias} binds its exact action contract` : `${action.alias} fails closed without an action binding`
  );
  check(
    available ? source.includes('$ARGUMENTS') : !source.includes('$ARGUMENTS'),
    available ? `${action.alias} forwards invocation input` : `${action.alias} refuses invocation input`
  );
  check(
    hasTask === (available && needsDelegation),
    available ? `${action.alias} grants delegation exactly when declared` : `${action.alias} grants no delegation`
  );
  check(!/\b(?:opus|sonnet|haiku|gpt-[0-9]|gemini-[0-9])\b/i.test(source), `${action.alias} leaves model choice to Claude`);
}

section('Portable execution-plan simulation');
const scenario = readJson(path.join(ACTION_DIR, 'plan-section.json'));
const projected = fs.readFileSync(path.join(CLAUDE_COMMAND_DIR, 'plan-section.md'), 'utf8');
const simulatedReads = new Set(scenario.reads);
const simulatedWrites = new Map(scenario.produces.map((entry) => [entry.uri, entry.mode]));
const simulatedRoles = scenario.delegation.map((entry) => `${entry.role}:${entry.mode}`);

console.log(`${COLORS.dim}  /wtfp:plan-section dry-run, no mutation performed${COLORS.reset}`);
check(simulatedReads.has('project://manifest'), 'would resolve the portable project manifest');
check(simulatedReads.has('project://sections/{section}/context'), 'would resolve linked author context');
check(simulatedReads.has('project://sources/{source}'), 'would load source provenance');
check(simulatedWrites.get('project://sections/{section}/plans/{plan}') === 'create', 'would create an immutable section plan');
check(simulatedWrites.get('project://sections/{section}') === 'update', 'would update the existing section record');
check(simulatedRoles.includes('section-planner:required'), 'would require the section-planner role');
check(simulatedRoles.includes('plan-checker:required'), 'would require an independent plan-checker pass');
check(projected.includes('schema-validate before a write'), 'would schema-validate before mutation');
check(projected.includes('Do not initialize a repository'), 'would prohibit incidental VCS effects');
check(projected.includes('on approval'), 'would cross the declared user gate before mutation');

section('Cross-host invocation and command shape');
const hosts = {
  claude: { dir: path.join(ROOT, 'vendors', 'claude', 'commands'), file: (id) => `${id}.md`, args: '$ARGUMENTS', availability: 'vendors/claude/compatibility/action-availability.json' },
  copilot: { dir: path.join(ROOT, 'vendors', 'copilot', 'plugins', 'wtf-p', 'commands'), file: (id) => `wtfp-${id}.md`, args: '$ARGUMENTS', availability: 'vendors/copilot/plugins/wtf-p/compatibility/action-availability.json' },
  opencode: { dir: path.join(ROOT, 'vendors', 'opencode', 'commands', 'wtfp'), file: (id) => `${id}.md`, args: '$ARGUMENTS', availability: 'vendors/opencode/compatibility/action-availability.json' },
  antigravity: { dir: path.join(ROOT, 'vendors', 'antigravity', 'commands'), file: (id) => `wtfp-${id}.md`, args: '$ARGUMENTS', availability: 'vendors/antigravity/compatibility/action-availability.json' },
  gemini: { dir: path.join(ROOT, 'vendors', 'gemini', 'commands', 'wtfp'), file: (id) => `${id}.toml`, args: '{{args}}', availability: 'vendors/gemini/compatibility/action-availability.json' },
  clio: { dir: path.join(ROOT, 'vendors', 'clio', 'prompts', 'wtfp'), file: (id) => `${id}.md`, args: '$ARGUMENTS', availability: 'vendors/clio/compatibility/action-availability.json' }
};

for (const [host, spec] of Object.entries(hosts)) {
  const availability = new Map(readJson(path.join(ROOT, spec.availability)).actions.map((entry) => [entry.id, entry.status]));
  const files = actions.map((action) => ({ action, file: path.join(spec.dir, spec.file(action.id)) }));
  const allExist = files.every((entry) => fs.existsSync(entry.file));
  check(allExist, `${host} exposes all 36 stable commands`);
  check(allExist && files.every(({ action, file }) => {
    const source = fs.readFileSync(file, 'utf8');
    return availability.get(action.id) === 'available'
      ? source.includes(spec.args) && !source.includes(UNAVAILABLE_MARKER)
      : !source.includes(spec.args) && source.includes(UNAVAILABLE_MARKER);
  }), `${host} forwards arguments only to executable commands and refuses blocked routes`);
}

section('Legacy assumptions are absent from generated commands');
const generatedClaude = actions
  .map((action) => fs.readFileSync(path.join(CLAUDE_COMMAND_DIR, `${action.id}.md`), 'utf8'))
  .join('\n');
check(!generatedClaude.includes('~/.claude/'), 'commands do not hard-code a Claude home path');
check(!generatedClaude.includes('STATE.md'), 'commands do not use legacy Markdown state');
check(!generatedClaude.includes('PROJECT.md'), 'commands do not use legacy Markdown project control state');
check(!generatedClaude.includes('ROADMAP.md'), 'commands do not use legacy Markdown roadmap control state');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
