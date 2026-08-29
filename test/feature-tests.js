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
  check(runtime.components.length === 1, `${id} installs one generated, self-contained bundle`);
  check(fs.existsSync(runtime.components[0].src), `${id} bundle source exists`);
}

section('Canonical protocol');
const catalog = json('protocol/catalog.json');
const tools = json('protocol/tools.json');
check(catalog.schema === 'wtfp.catalog/v1', 'catalog is explicitly versioned');
check(catalog.actions.length === 36, 'catalog exposes 36 stable actions');
check(catalog.skills.length === 7, 'catalog exposes 7 Agent Skills');
check(catalog.operations.actions.length === 5, 'catalog exposes 5 lifecycle operations');
check(tools.tools.length === 7, 'tool registry exposes only 7 declared portable tools');
check(filesAt('protocol/actions', '.json').length === 36, 'every action has a machine-readable contract');
check(filesAt('protocol/workflows', '.md').length === 36, 'every action has a canonical workflow');
check(filesAt('protocol/roles', '.md').length === 11, 'protocol defines 11 semantic specialist roles');
check(recursiveCount('protocol/skills', 'SKILL.md') === 7, 'protocol contains 7 standard Agent Skills');

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
const surfaces = {
  claude: { path: 'vendors/claude/commands', suffix: '.md' },
  copilot: { path: 'vendors/copilot/plugins/wtf-p/commands', suffix: '.md' },
  gemini: { path: 'vendors/gemini/commands/wtfp', suffix: '.toml' },
  opencode: { path: 'vendors/opencode/commands/wtfp', suffix: '.md' },
  antigravity: { path: 'vendors/antigravity/commands', suffix: '.md' },
  clio: { path: 'vendors/clio/prompts/wtfp', suffix: '.md' }
};
for (const [host, spec] of Object.entries(surfaces)) {
  check(filesAt(spec.path, spec.suffix).length === 36, `${host} exposes all 36 native commands`);
}
check(recursiveCount('vendors/codex/plugins/wtf-p/skills', 'SKILL.md') === 7, 'Codex exposes all 7 native skills');
check(recursiveCount('vendors/copilot/plugins/wtf-p/skills', 'SKILL.md') === 7, 'Copilot exposes all 7 native skills');
check(filesAt('vendors/claude/agents/wtfp', '.md').length === 11, 'Claude exposes all 11 native agents');
check(filesAt('vendors/antigravity/agents', '.md').length === 11, 'Antigravity exposes all 11 native agents');

section('Clio-native integration');
check(json('vendors/clio/catalog.json').namespace === 'wtfp', 'Clio extension carries the canonical WTF-P catalog');
check(filesAt('vendors/clio/prompts', '.md').length === 36, 'Clio emits 36 flat compatibility prompts');
check(filesAt('vendors/clio/prompts/wtfp', '.md').length === 36, 'Clio emits 36 namespaced prompts');
check(filesAt('vendors/clio/agents', '.md').length === 11, 'Clio exposes all 11 extension agents');
check(filesAt('vendors/clio/fleets', '.md').length === 2, 'Clio exposes deterministic planning and writing fleets');
check(recursiveCount('vendors/clio/skills', 'SKILL.md') === 7, 'Clio discovers all 7 extension skills');
const clioPrompt = read('vendors/clio/prompts/wtfp/new-paper.md');
check(clioPrompt.includes('${extensionRoot}'), 'Clio resolves protocol resources through its extension root');
check(clioPrompt.includes('$ARGUMENTS'), 'Clio forwards invocation arguments');
check(clioPrompt.includes('manifest.schema.json'), 'Clio prompt binds the relevant portable schema');

section('Marketplaces and lifecycle metadata');
check(json('vendors/claude/.claude-plugin/marketplace.json').name === 'wtfp', 'Claude marketplace is native and namespaced');
check(json('vendors/codex/.agents/plugins/marketplace.json').name === 'wtfp', 'Codex marketplace is native and namespaced');
check(json('vendors/copilot/marketplace.json').name === 'wtfp', 'Copilot marketplace is native and namespaced');
check(json('vendors/antigravity/plugin.json').name === 'wtf-p', 'Antigravity plugin metadata is native and namespaced');

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

section('Compatibility without legacy control state');
check(fs.existsSync(path.join(ROOT, 'core', 'write-the-f-paper')), 'v0.5 core remains packaged for migration compatibility');
const generatedCommands = filesAt('vendors/claude/commands', '.md')
  .map((name) => read(`vendors/claude/commands/${name}`))
  .join('\n');
check(!generatedCommands.includes('STATE.md'), 'v0.6 commands do not use Markdown state as control data');
check(!generatedCommands.includes('ROADMAP.md'), 'v0.6 commands do not use a Markdown roadmap as control data');
check(!generatedCommands.includes('npm view'), 'workflow update checks never run undeclared registry commands');
check(!generatedCommands.includes('git reset'), 'generated commands contain no destructive Git recovery');

console.log(`\n=== Feature Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
