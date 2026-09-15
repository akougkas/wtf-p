/**
 * WTF-P v0.6 structural feature tests.
 *
 * Runtime behavior, installer races, schemas, and deterministic generation are
 * covered by focused suites. This file protects the product-level feature set
 * presented to users across all supported agent hosts.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = require(path.join(ROOT, 'bin', 'lib', 'manifest.js'));
const packageJson = require(path.join(ROOT, 'package.json'));

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

let passed = 0;
let failed = 0;

function check(condition, message) {
  const color = condition ? COLORS.green : COLORS.red;
  const marker = condition ? '✓' : '✗';
  console.log(`${color}${marker}${COLORS.reset} ${message}`);
  if (condition) passed += 1;
  else failed += 1;
}

function section(title) {
  console.log(`\n${COLORS.cyan}--- ${title} ---${COLORS.reset}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function filesAt(relativePath, suffix) {
  const dir = path.join(ROOT, relativePath);
  return fs.readdirSync(dir).filter((name) => !suffix || name.endsWith(suffix));
}

function recursiveCount(relativePath, basename) {
  const root = path.join(ROOT, relativePath);
  let count = 0;
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (!basename || entry.name === basename) count += 1;
    }
  };
  visit(root);
  return count;
}

console.log(`=== Feature Tests for WTF-P ${packageJson.version} ===`);

section('First-class agent hosts');
const runtimeIds = ['claude', 'clio', 'codex', 'copilot', 'gemini', 'opencode', 'antigravity'];
check(Object.keys(MANIFEST).sort().join(',') === runtimeIds.slice().sort().join(','), 'manifest exposes exactly seven runtime ids');
for (const id of runtimeIds) {
  const runtime = MANIFEST[id];
  check(Boolean(runtime && runtime.name && runtime.defaultDir && runtime.configDirEnv), `${id} has a complete runtime definition`);
  // Codex additionally publishes its generated TOML agents to $CODEX_HOME/agents/.
  check(runtime.components.length === (id === 'codex' ? 2 : 1), `${id} installs one generated, self-contained bundle${id === 'codex' ? ' plus its native agents' : ''}`);
  check(fs.existsSync(runtime.components[0].src), `${id} bundle source exists`);
}
const claudeBundle = MANIFEST.claude.components[0];
check(!Object.hasOwn(claudeBundle.selectionRoots, 'mcp'), 'Claude does not advertise an unowned MCP install scope');
check(!Object.hasOwn(claudeBundle.componentIds, 'mcp'), 'Claude cannot classify stale MCP files for delivery');
const obsoleteMcpRoot = path.join(ROOT, 'vendors', 'claude', 'mcp');
check(
  !fs.existsSync(obsoleteMcpRoot) || recursiveCount('vendors/claude/mcp') === 0,
  'obsolete Claude research MCP prototype has no deliverable files'
);
check(packageJson.files.includes('!vendors/claude/mcp/**'), 'npm archive excludes obsolete Claude MCP artifacts');
const obsoleteClaudeSkillRoot = path.join(ROOT, 'vendors', 'claude', 'skills', 'wtfp');
check(
  !fs.existsSync(obsoleteClaudeSkillRoot) || recursiveCount('vendors/claude/skills/wtfp') === 0,
  'obsolete unowned Claude skill namespace has no deliverable files'
);
check(
  packageJson.files.includes('!vendors/claude/skills/wtfp/**'),
  'npm archive excludes the obsolete unowned Claude skill namespace'
);
check(
  !Object.hasOwn(packageJson.peerDependencies || {}, '@marp-team/marp-cli'),
  'package has no obsolete Marp peer dependency'
);

section('Canonical protocol');
const catalog = json('protocol/catalog.json');
const tools = json('protocol/tools.json');
check(catalog.schema === 'wtfp.catalog/v1', 'catalog is explicitly versioned');
// Counts derive from the catalog's own declaration and cross-check the
// protocol tree; the literal lock lives in test/protocol-catalog.test.js.
check(catalog.actions.length === catalog.counts.actions, `catalog exposes its declared ${catalog.counts.actions} stable actions`);
check(catalog.skills.length === catalog.counts.skills, `catalog exposes its declared ${catalog.counts.skills} Agent Skills`);
check(catalog.operations.actions.length === catalog.counts.operations, `catalog exposes its declared ${catalog.counts.operations} lifecycle operations`);
check(tools.tools.every((tool) => fs.existsSync(path.join(ROOT, 'bin', 'lib', `${tool.legacyName}.js`))), 'every declared portable tool has an implementation');
check(filesAt('protocol/actions', '.json').length === catalog.actions.length, 'every action has a machine-readable contract');
check(filesAt('protocol/workflows', '.md').length === catalog.actions.length, 'every action has a canonical workflow');
const delegatedRoleIds = new Set(catalog.actions.flatMap((entry) => json(`protocol/actions/${entry.id}.json`).delegation.map((item) => item.role)));
check(filesAt('protocol/roles', '.md').length === delegatedRoleIds.size, `protocol defines exactly the ${delegatedRoleIds.size} roles that actions delegate to`);
check(recursiveCount('protocol/skills', 'SKILL.md') === catalog.skills.length, `protocol contains the ${catalog.skills.length} catalogued Agent Skills`);

section('Portable project state');
const schemaFiles = filesAt('protocol/project/schemas', '.schema.json');
const templateFiles = filesAt('protocol/project/templates', '.json');
check(schemaFiles.length >= 10, `portable v1 project model includes ${schemaFiles.length} schemas`);
check(templateFiles.length >= 10, `portable v1 project model includes ${templateFiles.length} templates`);
const projectReadme = read('protocol/project/README.md');
check(projectReadme.includes('project://manifest'), 'project protocol defines logical resource URIs');
check(projectReadme.includes('Read and validate the JSON record before mutation'), 'project protocol requires validation before mutation');
check(projectReadme.includes('state-snapshot'), 'project protocol defines portable checkpoint snapshots');
check(!projectReadme.includes('git reset'), 'checkpoint recovery does not depend on destructive Git state');

section('Generated native surfaces');
// Inventories are derived from canonical content, not asserted as literals.
const actionCount = json('protocol/catalog.json').actions.length;
const roleCount = filesAt('protocol/roles', '.md').length;
const skillCount = recursiveCount('protocol/skills', 'SKILL.md');
const surfaces = {
  claude: { path: 'vendors/claude/commands', suffix: '.md' },
  copilot: { path: 'vendors/copilot/plugins/wtfp/commands', suffix: '.md' },
  gemini: { path: 'vendors/gemini/commands/wtfp', suffix: '.toml' },
  opencode: { path: 'vendors/opencode/commands/wtfp', suffix: '.md' },
  antigravity: { path: 'vendors/antigravity/commands', suffix: '.md' },
  clio: { path: 'vendors/plugin/ai.iowarp.clio/prompts/wtfp', suffix: '.md' }
};
for (const [host, spec] of Object.entries(surfaces)) {
  check(filesAt(spec.path, spec.suffix).length === actionCount, `${host} exposes all ${actionCount} native commands`);
}
check(recursiveCount('vendors/codex/plugins/wtfp/skills', 'SKILL.md') === skillCount, `Codex exposes all ${skillCount} native skills`);
check(recursiveCount('vendors/copilot/plugins/wtfp/skills', 'SKILL.md') === skillCount, `Copilot exposes all ${skillCount} native skills`);
check(recursiveCount('vendors/claude/skills', 'SKILL.md') === skillCount, `Claude exposes exactly the ${skillCount} inventory-owned native skills`);
check(filesAt('vendors/claude/agents', '.md').length === roleCount, `Claude exposes all ${roleCount} native agents at the top level Claude Code discovers`);
check(filesAt('vendors/antigravity/agents', '.md').length === roleCount, `Antigravity exposes all ${roleCount} native agents`);
check(filesAt('vendors/gemini/agents', '.md').length === roleCount, `Gemini exposes all ${roleCount} native agents at the top level its loader reads`);
check(filesAt('vendors/codex/plugins/wtfp/agents', '.toml').length === roleCount, `Codex exposes all ${roleCount} native TOML agents`);
check(filesAt('vendors/claude/output-styles', '.md').length === 1, 'Claude ships the academic writing output style');
check(fs.existsSync(path.join(ROOT, 'vendors/claude/hooks/hooks.json')), 'Claude ships the write-guard hooks');
check(fs.existsSync(path.join(ROOT, 'vendors/antigravity/rules/wtfp-project-state.md')), 'Antigravity ships the project-state rule');

section('Clio-native integration');
check(json('vendors/plugin/catalog.json').namespace === 'wtfp', 'the canonical plugin carries the WTF-P catalog');
check(filesAt('vendors/plugin/ai.iowarp.clio/prompts/wtfp', '.md').length === actionCount, `the canonical plugin emits ${actionCount} namespaced Clio prompts`);
check(filesAt('vendors/plugin/ai.iowarp.clio/prompts', '.md').length === 0, 'the canonical plugin publishes no flat prompt aliases');
check(filesAt('vendors/plugin/ai.iowarp.clio/agents', '.md').length === roleCount, `the canonical plugin exposes all ${roleCount} Clio agents`);
check(filesAt('vendors/plugin/ai.iowarp.clio/fleets', '.md').length === 2, 'the canonical plugin exposes deterministic planning and writing fleets');
check(recursiveCount('vendors/plugin/skills', 'SKILL.md') === skillCount, `the canonical plugin discovers all ${skillCount} skills`);
const clioPrompt = read('vendors/plugin/ai.iowarp.clio/prompts/wtfp/new-paper.md');
check(clioPrompt.includes('${pluginRoot}'), 'Clio resolves protocol resources through its plugin root');
check(clioPrompt.includes('$ARGUMENTS'), 'Clio forwards invocation arguments');
check(clioPrompt.includes('manifest.schema.json'), 'Clio prompt binds the relevant portable schema');

section('Marketplaces and lifecycle metadata');
check(json('vendors/claude/.claude-plugin/marketplace.json').name === 'wtfp', 'Claude marketplace is native and namespaced');
check(json('vendors/codex/.agents/plugins/marketplace.json').name === 'wtfp', 'Codex marketplace is native and namespaced');
check(json('vendors/copilot/marketplace.json').name === 'wtfp', 'Copilot marketplace is native and namespaced');
check(json('vendors/antigravity/plugin.json').name === 'wtfp', 'Antigravity plugin metadata is native and namespaced');

section('Safe installation and release posture');
const installer = read('bin/install.js');
const uninstaller = read('bin/uninstall.js');
for (const id of runtimeIds) {
  check(installer.includes(`--${id}`), `installer documents --${id}`);
  check(uninstaller.includes(`--${id}`), `uninstaller documents --${id}`);
}
check(uninstaller.includes('--dry-run'), 'uninstall supports read-only ownership planning');
check(installer.includes('Noninteractive installation requires an explicit target or scope'), 'noninteractive installation requires explicit intent');
check(read('scripts/release.js').includes('--publish'), 'publishing requires an explicit release flag');
check(packageJson.engines.node.startsWith('>=20'), 'package requires a maintained Node.js runtime');
check(packageJson.scripts.prepack === 'npm run check:adapters', 'package creation refuses stale generated adapters');

section('Repository-root marketplaces');
const rootMarketplaces = {
  '.claude-plugin/marketplace.json': { plugin: 'wtfp', source: (entry) => entry.source, target: 'vendors/claude/.claude-plugin/plugin.json' },
  '.agents/plugins/marketplace.json': { plugin: 'wtfp', source: (entry) => entry.source.path, target: 'vendors/codex/plugins/wtfp/plugin.json' },
  '.github/plugin/marketplace.json': { plugin: 'wtfp', source: (entry) => entry.source, target: 'vendors/copilot/plugins/wtfp/.claude-plugin/plugin.json' }
};
for (const [file, expected] of Object.entries(rootMarketplaces)) {
  const marketplace = json(file);
  check(marketplace.name === 'wtf-p', `${file} is the wtf-p marketplace`);
  const entry = (marketplace.plugins || []).find((plugin) => plugin.name === expected.plugin);
  check(Boolean(entry), `${file} lists the ${expected.plugin} plugin`);
  const source = entry ? expected.source(entry) : '';
  check(typeof source === 'string' && source.startsWith('./') && !source.includes('..'), `${file} uses a contained relative source`);
  check(Boolean(source) && fs.existsSync(path.join(ROOT, source)) && fs.existsSync(path.join(ROOT, expected.target)), `${file} points at a committed envelope with a manifest`);
  check(!entry || !('version' in entry), `${file} does not pin a version that the envelope manifest already carries`);
}

section('Compatibility without legacy control state');
check(!fs.existsSync(path.join(ROOT, 'core')), 'no v0.5 core tree remains in the package');
const generatedCommands = filesAt('vendors/claude/commands', '.md')
  .map((name) => read(`vendors/claude/commands/${name}`))
  .join('\n');
check(!generatedCommands.includes('STATE.md'), 'v0.6 commands do not use Markdown state as control data');
check(!generatedCommands.includes('ROADMAP.md'), 'v0.6 commands do not use a Markdown roadmap as control data');
check(!generatedCommands.includes('npm view'), 'workflow update checks never run undeclared registry commands');
check(!generatedCommands.includes('git reset'), 'generated commands contain no destructive Git recovery');

console.log(`\n=== Feature Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
