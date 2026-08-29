#!/usr/bin/env node

'use strict';

/**
 * Credential-free preparation and capability-aware execution gate for the
 * routing matrix. Paid execution is reachable only from an exact sealed
 * preparation, with an explicit operator acknowledgement, and only for claims
 * that the checked-in native client surface says are observable. See
 * evaluation/ROUTING.md.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const repositoryRoot = path.resolve(__dirname, '../..');
const matrixFile = path.join(repositoryRoot, 'evaluation', 'v1', 'matrix', 'budget.json');
const manifestFile = path.join(repositoryRoot, 'evaluation', 'v1', 'routing', 'manifest.json');
const casesFile = path.join(repositoryRoot, 'evaluation', 'v1', 'routing', 'cases.json');
const explicitFile = path.join(repositoryRoot, 'evaluation', 'v1', 'routing', 'explicit-actions.json');
const clientSurfacesFile = path.join(repositoryRoot, 'evaluation', 'v1', 'routing', 'client-surfaces.json');
const runnerFile = __filename;
const scorerFile = path.join(repositoryRoot, 'evaluation', 'tools', 'score-routing.js');
const schemaValidatorFile = path.join(repositoryRoot, 'evaluation', 'lib', 'json-schema.js');
const schemasRoot = path.join(repositoryRoot, 'evaluation', 'v1', 'schemas');
const protocolRoot = path.join(repositoryRoot, 'protocol');

const PREPARED_SCHEMA = 'wtfp.evaluation.routing-prepared/v1';
const PREPARED_FILE = 'prepared.json';
const EXECUTION_CONFIRMATION = 'I_ACKNOWLEDGE_PAID_ROUTING_MATRIX_V1';
const EXECUTION_CONFIRMATION_ENV = 'WTFP_ROUTING_CONFIRM_PAID';
const DEFAULT_CASE_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_CAPTURE_BYTES = 128 * 1024 * 1024;
const ROUTING_CONTROL_INSTRUCTIONS = [
  'This is a routing-only behavioral evaluation.',
  'Identify the native WTF-P route or suggestion and load only the minimum routing resource the client normally requires.',
  'Do not perform the requested academic or product task.',
  'Do not mutate files or version control, do not use a shell, and do not use the network.',
  'After the first route signal, return a brief route statement and stop.'
].join(' ');
const PRIMARY_ROWS = Object.freeze([
  'claude-sonnet-primary',
  'codex-gpt54-primary',
  'clio-terra-primary'
]);
const EXPECTED_SKILLS = Object.freeze([
  'wtfp-deliver-research',
  'wtfp-manage-project',
  'wtfp-plan-section',
  'wtfp-research-literature',
  'wtfp-review-manuscript',
  'wtfp-start-project',
  'wtfp-write-section'
]);

const GENERATED_INVENTORY_BINDINGS = Object.freeze([
  ['antigravity', 'vendors/antigravity/.wtfp-generated.json'],
  ['claude', 'vendors/claude/.wtfp-generated.json'],
  ['clio', 'vendors/clio/.wtfp-generated.json'],
  ['codex-marketplace', 'vendors/codex/.wtfp-generated.json'],
  ['codex', 'vendors/codex/plugins/wtf-p/.wtfp-generated.json'],
  ['copilot-marketplace', 'vendors/copilot/.wtfp-generated.json'],
  ['copilot', 'vendors/copilot/plugins/wtf-p/.wtfp-generated.json'],
  ['gemini', 'vendors/gemini/.wtfp-generated.json'],
  ['opencode', 'vendors/opencode/.wtfp-generated.json']
]);

const GENERATOR_SOURCE_PATHS = Object.freeze([
  'CONTRIBUTING.md',
  'bin/lib/adapter-compiler.js',
  'bin/lib/adapter-metadata.js',
  'scripts/build-adapters.js'
]);

// OpenCode creates this local ignore file in its client cache projection. It is
// neither tracked nor authenticated by the adapter inventory and is not loaded
// as extension content. No other protocol/vendor file is exempted.
const SOURCE_PROJECTION_EXCLUSIONS = Object.freeze(new Set([
  'vendors/opencode/.gitignore'
]));

const KNOWN_DEFAULTS = Object.freeze({
  claude: '/home/akougkas/.local/share/claude/versions/2.1.251',
  codex: '/home/akougkas/.codex/packages/standalone/releases/0.144.1-x86_64-unknown-linux-musl/bin/codex',
  clio: '/tmp/clio-v038-fixed-source.Xbdr8a/dist/cli/index.js',
  clioSource: '/tmp/clio-v038-fixed-source.Xbdr8a'
});

const CLIENT_SURFACES = Object.freeze({
  claude: {
    clientName: 'Claude Code',
    binaryEnv: 'WTFP_ROUTING_CLAUDE_BINARY',
    expectedVersion: '2.1.251',
    expectedBinarySha256: 'fd5f10ff0eb58daec04900466b143ea98aab50abf208a422bc008eaec13f61f7',
    versionPattern: /^2\.1\.251(?:\s|$)/u,
    envelopeTarget: 'claude',
    adapterRoot: 'vendors/claude'
  },
  codex: {
    clientName: 'Codex CLI',
    binaryEnv: 'WTFP_ROUTING_CODEX_BINARY',
    expectedVersion: '0.144.1',
    expectedBinarySha256: 'a96f944d1a596dbfb7fdd84f482be5c50e34b04bb371126840d873e4ebf26902',
    versionPattern: /^codex-cli 0\.144\.1(?:\s|$)/u,
    envelopeTarget: 'codex',
    adapterRoot: 'vendors/codex/plugins/wtf-p'
  },
  clio: {
    clientName: 'Clio Coder',
    binaryEnv: 'WTFP_ROUTING_CLIO_BINARY',
    expectedVersion: '0.3.8',
    expectedBinarySha256: 'f02f31c7480ac4f9532980f8df93e07816111626bdce9879e1ee9e98fd3ec162',
    expectedDistTreeSha256: '27472f9b7253dc6608d70fbe623e4953896a9f0899ead00aa5faad1c783acae7',
    versionPattern: /^Clio Coder 0\.3\.8(?:\s|$)/u,
    envelopeTarget: 'clio',
    adapterRoot: 'vendors/clio'
  }
});

const CLIENT_SURFACE_DOCUMENT = JSON.parse(fs.readFileSync(clientSurfacesFile, 'utf8'));
const CAPABILITY_SURFACES = Object.freeze(Object.fromEntries(
  CLIENT_SURFACE_DOCUMENT.targets.map(surface => [surface.target, Object.freeze(surface)])
));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}

function canonicalBytes(value) {
  return Buffer.from(JSON.stringify(canonical(value)), 'utf8');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isContained(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function containedFile(root, relative, label = 'file') {
  if (path.isAbsolute(relative)) throw new Error(`${label} must be relative: ${relative}`);
  const file = path.resolve(root, relative);
  if (!isContained(root, file)) throw new Error(`${label} escapes its root: ${relative}`);
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label} must be a regular non-symlink file: ${file}`);
  return file;
}

function makePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function writePrivate(file, value, exclusive = false) {
  makePrivateDirectory(path.dirname(file));
  fs.writeFileSync(file, value, { mode: 0o600, flag: exclusive ? 'wx' : 'w' });
  fs.chmodSync(file, 0o600);
}

function writeJsonPrivate(file, value, exclusive = false) {
  writePrivate(file, `${JSON.stringify(value, null, 2)}\n`, exclusive);
}

function assertPrivateDirectory(directory, label) {
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${label} is not a regular directory: ${directory}`);
  if ((stat.mode & 0o777) !== 0o700) throw new Error(`${label} is not mode 0700: ${directory}`);
}

function resolveExecutable(input, label) {
  if (!input) throw new Error(`${label} binary is required`);
  let requested = input;
  if (!input.includes(path.sep)) {
    const match = (process.env.PATH || '').split(path.delimiter)
      .map(directory => path.join(directory, input))
      .find(file => {
        try { return fs.statSync(file).isFile(); } catch { return false; }
      });
    if (!match) throw new Error(`${label} binary was not found on PATH: ${input}`);
    requested = match;
  }
  const absolute = path.resolve(requested);
  const resolved = fs.realpathSync(absolute);
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error(`${label} binary is not a regular file: ${resolved}`);
  return {
    requested_path: absolute,
    path: resolved,
    sha256: sha256(fs.readFileSync(resolved)),
    bytes: stat.size
  };
}

function usage() {
  return [
    'Usage:',
    '  node evaluation/tools/run-routing-matrix.js [--dry-run] [options]',
    '  node evaluation/tools/run-routing-matrix.js --prepare [--root <new-path>] [options]',
    '  node evaluation/tools/run-routing-matrix.js --execute --root <prepared-path> [options]',
    '',
    'Options:',
    '  --row <matrix-row>       repeat to select rows (default: the three primary rows)',
    '  --claude-binary <path>   exact Claude binary (or WTFP_ROUTING_CLAUDE_BINARY)',
    '  --codex-binary <path>    exact Codex binary (or WTFP_ROUTING_CODEX_BINARY)',
    '  --clio-binary <path>     exact fixed Clio entry (or WTFP_ROUTING_CLIO_BINARY)',
    '  --clio-source <path>     exact coordinated source (or WTFP_ROUTING_CLIO_SOURCE)',
    '  --timeout-minutes <n>    per-case paid timeout (default: 10)',
    '',
    'No mode means --dry-run. --dry-run and --prepare never call a model and never',
    'read credentials. --execute revalidates a sealed preparation before looking',
    'up credential-source environment variables, then additionally requires',
    `${EXECUTION_CONFIRMATION_ENV}=${EXECUTION_CONFIRMATION}.`,
    'Credential paths are never accepted in argv; see evaluation/ROUTING.md.'
  ].join('\n');
}

function parseArgs(argv, environment = process.env) {
  const options = {
    mode: 'dry-run',
    modeExplicit: false,
    root: null,
    rows: [],
    binaries: {
      claude: environment.WTFP_ROUTING_CLAUDE_BINARY || KNOWN_DEFAULTS.claude,
      codex: environment.WTFP_ROUTING_CODEX_BINARY || KNOWN_DEFAULTS.codex,
      clio: environment.WTFP_ROUTING_CLIO_BINARY || KNOWN_DEFAULTS.clio
    },
    clioSource: environment.WTFP_ROUTING_CLIO_SOURCE || KNOWN_DEFAULTS.clioSource,
    timeoutMs: DEFAULT_CASE_TIMEOUT_MS
  };
  const modes = new Set(['--dry-run', '--prepare', '--execute']);
  const valued = new Set([
    '--root', '--row', '--claude-binary', '--codex-binary', '--clio-binary', '--clio-source', '--timeout-minutes'
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (/credential|api[-_]?key|token|secret/iu.test(argument)) {
      throw new Error(`credential material and credential paths are forbidden as CLI options: ${argument}`);
    }
    if (modes.has(argument)) {
      if (options.modeExplicit) throw new Error('choose at most one of --dry-run, --prepare, or --execute');
      options.mode = argument.slice(2);
      options.modeExplicit = true;
      continue;
    }
    if (!valued.has(argument)) throw new Error(`unknown option ${argument}`);
    const value = argv[index + 1];
    if (value === undefined || value === '') throw new Error(`${argument} requires a value`);
    index += 1;
    if (argument === '--root') options.root = path.resolve(value);
    else if (argument === '--row') options.rows.push(value);
    else if (argument === '--claude-binary') options.binaries.claude = value;
    else if (argument === '--codex-binary') options.binaries.codex = value;
    else if (argument === '--clio-binary') options.binaries.clio = value;
    else if (argument === '--clio-source') options.clioSource = value;
    else {
      const minutes = Number(value);
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 60) {
        throw new Error('--timeout-minutes must be greater than zero and at most 60');
      }
      options.timeoutMs = Math.round(minutes * 60 * 1000);
    }
  }
  if (options.mode === 'execute' && !options.root) throw new Error('--execute requires --root');
  if (options.rows.length === 0) options.rows = [...PRIMARY_ROWS];
  if (new Set(options.rows).size !== options.rows.length) throw new Error('matrix rows must not be repeated');
  options.clioSource = path.resolve(options.clioSource);
  return options;
}

function commandResult(executable, argv, options = {}) {
  const result = spawnSync(executable, argv, {
    cwd: options.cwd || repositoryRoot,
    env: options.env || process.env,
    input: options.input,
    encoding: null,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: options.timeout || 60000,
    maxBuffer: options.maxBuffer || 64 * 1024 * 1024
  });
  if (result.error) throw result.error;
  return {
    exit_code: result.status,
    signal: result.signal,
    stdout: result.stdout || Buffer.alloc(0),
    stderr: result.stderr || Buffer.alloc(0)
  };
}

function gitResult(root, argv) {
  const result = commandResult('git', ['-C', root, ...argv]);
  if (result.exit_code !== 0) throw new Error(`git ${argv.join(' ')} failed in ${root}`);
  return result.stdout.toString('utf8').trim();
}

function gitWorktreeState(root) {
  const status = commandResult('git', [
    '-C', root, 'status', '--porcelain=v1', '-z', '--untracked-files=all'
  ]);
  const staged = commandResult('git', [
    '-C', root, 'diff', '--cached', '--binary', '--no-ext-diff', '--no-textconv', '--'
  ]);
  const unstaged = commandResult('git', [
    '-C', root, 'diff', '--binary', '--no-ext-diff', '--no-textconv', '--'
  ]);
  const untracked = commandResult('git', ['-C', root, 'ls-files', '--others', '--exclude-standard', '-z']);
  for (const result of [status, staged, unstaged, untracked]) {
    if (result.exit_code !== 0) throw new Error(`cannot hash Git-visible worktree state in ${root}`);
  }
  const untrackedInventory = untracked.stdout.toString('utf8').split('\0').filter(Boolean).sort().map(relative => {
    const absolute = path.resolve(root, relative);
    if (!isContained(root, absolute)) throw new Error(`untracked path escapes repository: ${relative}`);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      const target = Buffer.from(fs.readlinkSync(absolute), 'utf8');
      return { path: relative, type: 'symlink', mode: stat.mode & 0o777, sha256: sha256(target) };
    }
    if (!stat.isFile()) throw new Error(`untracked Git-visible path is not a regular file: ${relative}`);
    const bytes = fs.readFileSync(absolute);
    return { path: relative, type: 'file', mode: stat.mode & 0o777, bytes: bytes.length, sha256: sha256(bytes) };
  });
  const digest = sha256(canonicalBytes({
    status_sha256: sha256(status.stdout),
    staged_diff_sha256: sha256(staged.stdout),
    unstaged_diff_sha256: sha256(unstaged.stdout),
    untracked: untrackedInventory
  }));
  return {
    dirty: status.stdout.length > 0,
    status_sha256: sha256(status.stdout),
    status_entry_count: status.stdout.toString('utf8').split('\0').filter(Boolean).length,
    worktree_state_sha256: digest,
    untracked_file_count: untrackedInventory.length
  };
}

function gitMetadata(root) {
  const worktree = gitWorktreeState(root);
  return {
    commit: gitResult(root, ['rev-parse', 'HEAD']),
    tree: gitResult(root, ['rev-parse', 'HEAD^{tree}']),
    branch: gitResult(root, ['branch', '--show-current']) || null,
    object_format: gitResult(root, ['rev-parse', '--show-object-format']),
    ...worktree
  };
}

function gitCommitBytes(root, commit, relative) {
  if (path.isAbsolute(relative) || !isContained(root, path.join(root, relative))) {
    throw new Error(`canonical Git path escapes repository: ${relative}`);
  }
  const result = commandResult('git', ['-C', root, 'show', `${commit}:${relative}`]);
  if (result.exit_code !== 0) throw new Error(`canonical commit ${commit} does not contain ${relative}`);
  return result.stdout;
}

function gitTreeEntries(root, commit, pathspecs) {
  const result = commandResult('git', [
    '-C', root, 'ls-tree', '-r', '-z', '--full-tree', commit, '--', ...pathspecs
  ]);
  if (result.exit_code !== 0) throw new Error(`cannot inspect canonical source tree ${commit}`);
  const entries = new Map();
  for (const record of result.stdout.toString('utf8').split('\0').filter(Boolean)) {
    const match = record.match(/^(\d{6}) ([^ ]+) ([a-f0-9]+)\t(.+)$/u);
    if (!match) throw new Error(`malformed canonical tree entry: ${record}`);
    const [, mode, type, object, relative] = match;
    if (type !== 'blob' || (mode !== '100644' && mode !== '100755')) {
      throw new Error(`canonical projection contains unsupported ${type}/${mode}: ${relative}`);
    }
    if (entries.has(relative)) throw new Error(`canonical projection repeats ${relative}`);
    entries.set(relative, { path: relative, mode, object });
  }
  return entries;
}

function walkProjectionFiles(root, relativeRoot) {
  const output = [];
  function visit(relative) {
    const absolute = path.join(root, relative);
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const child = path.join(relative, entry.name);
      const normalized = child.split(path.sep).join('/');
      const stat = fs.lstatSync(path.join(root, child));
      if (stat.isSymbolicLink()) throw new Error(`source projection contains a symlink: ${normalized}`);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) output.push(normalized);
      else throw new Error(`source projection contains a special file: ${normalized}`);
    }
  }
  visit(relativeRoot);
  return output;
}

function gitBlobObjectId(bytes, objectFormat) {
  if (objectFormat !== 'sha1' && objectFormat !== 'sha256') {
    throw new Error(`unsupported Git object format ${objectFormat}`);
  }
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return crypto.createHash(objectFormat).update(header).update(bytes).digest('hex');
}

function assertCanonicalCommitAncestor(root, canonicalCommit) {
  if (!/^[a-f0-9]{40}$/u.test(canonicalCommit)) {
    throw new Error(`canonical source commit is not a full SHA-1: ${canonicalCommit}`);
  }
  const resolved = commandResult('git', ['-C', root, 'rev-parse', '--verify', `${canonicalCommit}^{commit}`]);
  if (resolved.exit_code !== 0 || resolved.stdout.toString('utf8').trim() !== canonicalCommit) {
    throw new Error(`canonical source commit does not exist: ${canonicalCommit}`);
  }
  const head = gitResult(root, ['rev-parse', 'HEAD']);
  const ancestor = commandResult('git', ['-C', root, 'merge-base', '--is-ancestor', canonicalCommit, head]);
  if (ancestor.exit_code !== 0) {
    throw new Error(`canonical source commit ${canonicalCommit} is not an ancestor of WTF-P HEAD ${head}`);
  }
  return head;
}

function verifyCanonicalSourceProjection(root, manifest) {
  const canonicalCommit = manifest.wtfp_commit;
  const head = assertCanonicalCommitAncestor(root, canonicalCommit);
  const objectFormat = gitResult(root, ['rev-parse', '--show-object-format']);
  const expectedBindings = GENERATED_INVENTORY_BINDINGS.map(([target, inventoryPath]) => ({
    target, path: inventoryPath
  }));
  const actualBindings = (manifest.generated_envelopes || []).map(item => ({ target: item.target, path: item.path }));
  if (canonicalBytes(actualBindings).compare(canonicalBytes(expectedBindings)) !== 0) {
    throw new Error('routing manifest does not bind the exact nine generated inventories');
  }

  const canonicalTools = JSON.parse(gitCommitBytes(root, canonicalCommit, 'protocol/tools.json').toString('utf8'));
  const toolSources = (canonicalTools.tools || []).map(tool => {
    if (!/^[a-z0-9-]+$/u.test(tool.legacyName || '')) {
      throw new Error(`canonical tool has unsafe legacyName: ${tool.legacyName}`);
    }
    return `bin/lib/${tool.legacyName}.js`;
  });
  if (new Set(toolSources).size !== toolSources.length) throw new Error('canonical tool sources are not unique');
  const explicitSources = [...new Set([...GENERATOR_SOURCE_PATHS, ...toolSources])].sort();
  const canonical = gitTreeEntries(root, canonicalCommit, ['protocol', 'vendors', ...explicitSources]);
  for (const relative of explicitSources) {
    if (!canonical.has(relative)) throw new Error(`canonical generator source is missing: ${relative}`);
  }

  let authenticatedEntries = 0;
  const authenticatedHashes = new Map();
  for (let bindingIndex = 0; bindingIndex < GENERATED_INVENTORY_BINDINGS.length; bindingIndex += 1) {
    const [target, inventoryPath] = GENERATED_INVENTORY_BINDINGS[bindingIndex];
    if (!canonical.has(inventoryPath)) throw new Error(`${target} canonical generated inventory is missing`);
    const inventoryBytes = gitCommitBytes(root, canonicalCommit, inventoryPath);
    const inventory = JSON.parse(inventoryBytes.toString('utf8'));
    const manifestBinding = manifest.generated_envelopes[bindingIndex];
    if (sha256(inventoryBytes) !== manifestBinding.manifest_sha256 ||
        inventory.sourceHash !== manifestBinding.source_sha256 ||
        inventory.generatorVersion !== manifest.adapter_compiler_version) {
      throw new Error(`${target} routing manifest binding differs from the canonical generated inventory`);
    }
    const adapterRoot = path.posix.dirname(inventoryPath);
    const seen = new Set();
    for (const item of inventory.files || []) {
      if (typeof item.path !== 'string' || path.posix.isAbsolute(item.path)) {
        throw new Error(`${target} canonical inventory has an unsafe entry path`);
      }
      const normalized = path.posix.normalize(item.path);
      if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../') || seen.has(normalized)) {
        throw new Error(`${target} canonical inventory has a repeated or escaping entry: ${item.path}`);
      }
      seen.add(normalized);
      const projected = path.posix.join(adapterRoot, normalized);
      if (!canonical.has(projected)) {
        throw new Error(`${target} canonical inventory entry is absent from its source tree: ${item.path}`);
      }
      if (!/^[a-f0-9]{64}$/u.test(item.sha256 || '')) {
        throw new Error(`${target} canonical inventory entry has no SHA-256: ${item.path}`);
      }
      if (authenticatedHashes.has(projected) && authenticatedHashes.get(projected) !== item.sha256) {
        throw new Error(`generated inventories disagree on ${projected}`);
      }
      authenticatedHashes.set(projected, item.sha256);
      authenticatedEntries += 1;
    }
  }

  const canonicalPrefixPaths = [...canonical.keys()]
    .filter(relative => relative === 'protocol' || relative.startsWith('protocol/') ||
      relative === 'vendors' || relative.startsWith('vendors/'))
    .sort();
  const currentPrefixPaths = [
    ...walkProjectionFiles(root, 'protocol'),
    ...walkProjectionFiles(root, 'vendors')
  ].filter(relative => !SOURCE_PROJECTION_EXCLUSIONS.has(relative)).sort();
  if (canonicalBytes(currentPrefixPaths).compare(canonicalBytes(canonicalPrefixPaths)) !== 0) {
    throw new Error('protocol/vendor source projection file set drifted from the canonical source commit');
  }

  const inventory = [];
  for (const entry of [...canonical.values()].sort((left, right) => left.path.localeCompare(right.path))) {
    const file = containedFile(root, entry.path, 'canonical source projection');
    const stat = fs.statSync(file);
    const mode = (stat.mode & 0o111) === 0 ? '100644' : '100755';
    const bytes = fs.readFileSync(file);
    const object = gitBlobObjectId(bytes, objectFormat);
    if (mode !== entry.mode || object !== entry.object) {
      throw new Error(`canonical source projection drift: ${entry.path}`);
    }
    inventory.push({ path: entry.path, mode, bytes: bytes.length, sha256: sha256(bytes) });
  }
  const projectedHashes = new Map(inventory.map(item => [item.path, item.sha256]));
  for (const [relative, expected] of authenticatedHashes) {
    if (projectedHashes.get(relative) !== expected) {
      throw new Error(`authenticated generated entry digest drift: ${relative}`);
    }
  }

  const canonicalPackage = JSON.parse(gitCommitBytes(root, canonicalCommit, 'package.json').toString('utf8'));
  const currentPackage = readJson(containedFile(root, 'package.json', 'package metadata'));
  if (currentPackage.version !== canonicalPackage.version) {
    throw new Error(`package version generator input drift: ${currentPackage.version} != ${canonicalPackage.version}`);
  }
  const projectionSha256 = sha256(canonicalBytes({
    files: inventory,
    package_version: currentPackage.version
  }));
  return {
    schema: 'wtfp.evaluation.canonical-source-projection/v1',
    canonical_commit: canonicalCommit,
    actual_head: head,
    ancestor_verified: true,
    sha256: projectionSha256,
    files: inventory.length,
    protocol_files: canonicalPrefixPaths.filter(item => item.startsWith('protocol/')).length,
    vendor_files: canonicalPrefixPaths.filter(item => item.startsWith('vendors/')).length,
    generator_source_files: GENERATOR_SOURCE_PATHS.length,
    tool_source_files: toolSources.length,
    generated_inventories: GENERATED_INVENTORY_BINDINGS.length,
    authenticated_generated_entries: authenticatedEntries,
    package_version: currentPackage.version
  };
}

function repositoryIdentity(root, manifest) {
  const canonicalSource = verifyCanonicalSourceProjection(root, manifest);
  const repository = {
    ...gitMetadata(root),
    canonical_source: canonicalSource
  };
  if (repository.commit !== canonicalSource.actual_head) {
    throw new Error('WTF-P HEAD changed while canonical source identity was inspected');
  }
  return repository;
}

function assertRepositoryIdentity(expected, root, manifest) {
  const actual = repositoryIdentity(root, manifest);
  if (canonicalBytes(actual).compare(canonicalBytes(expected)) !== 0) {
    throw new Error('WTF-P HEAD, dirty state, or canonical source projection changed during evaluation');
  }
  return actual;
}

function trackedTreeDigest(root) {
  const names = commandResult('git', ['-C', root, 'ls-files', '-z']);
  if (names.exit_code !== 0) throw new Error(`cannot list tracked source files in ${root}`);
  const files = names.stdout.toString('utf8').split('\0').filter(Boolean).sort();
  const inventory = files.map(relative => {
    const file = containedFile(root, relative, 'tracked source');
    const stat = fs.statSync(file);
    return { path: relative, bytes: stat.size, sha256: sha256(fs.readFileSync(file)) };
  });
  return { sha256: sha256(canonicalBytes(inventory)), files: inventory.length };
}

function executionContractDigests() {
  return {
    scorer_sha256: sha256(fs.readFileSync(scorerFile)),
    schema_validator_sha256: sha256(fs.readFileSync(schemaValidatorFile)),
    schemas_tree_sha256: hashTree(schemasRoot),
    protocol_tree_sha256: hashTree(protocolRoot)
  };
}

function assertExecutionContract(expected, actual = executionContractDigests()) {
  if (canonicalBytes(actual).compare(canonicalBytes(expected)) !== 0) {
    throw new Error('routing scorer, schema, or canonical protocol contract changed after preparation');
  }
}

function definitionCatalog(_cases = null, _explicit = null, target = null) {
  const scorer = require('./score-routing');
  return scorer.definitionCatalog(target);
}

function materializeNativeInput(definition, target) {
  const scorer = require('./score-routing');
  return scorer.materializeNativeInput(definition, target);
}

function verifyGeneratedEnvelope(manifest, target) {
  const binding = manifest.generated_envelopes.find(item => item.target === target);
  if (!binding) throw new Error(`routing manifest has no generated envelope for ${target}`);
  const inventoryFile = containedFile(repositoryRoot, binding.path, `${target} generated inventory`);
  const inventoryBytes = fs.readFileSync(inventoryFile);
  const inventoryDigest = sha256(inventoryBytes);
  if (inventoryDigest !== binding.manifest_sha256) {
    throw new Error(`${target} generated inventory drift: ${inventoryDigest} != ${binding.manifest_sha256}`);
  }
  const inventory = JSON.parse(inventoryBytes.toString('utf8'));
  if (inventory.generatorVersion !== manifest.adapter_compiler_version) {
    throw new Error(`${target} generator version drift`);
  }
  if (inventory.sourceHash !== binding.source_sha256) throw new Error(`${target} sourceHash drift`);
  const adapterRoot = path.dirname(inventoryFile);
  const seen = new Set();
  for (const item of inventory.files || []) {
    if (seen.has(item.path)) throw new Error(`${target} inventory repeats ${item.path}`);
    seen.add(item.path);
    const file = containedFile(adapterRoot, item.path, `${target} inventory entry`);
    const digest = sha256(fs.readFileSync(file));
    if (digest !== item.sha256) throw new Error(`${target} generated file drift: ${item.path}`);
  }
  return {
    target,
    path: inventoryFile,
    manifest_sha256: inventoryDigest,
    source_sha256: inventory.sourceHash,
    generator_version: inventory.generatorVersion,
    inventory_entries: seen.size,
    adapter_root: adapterRoot
  };
}

function loadSuite(selectedRows = PRIMARY_ROWS) {
  const matrixBytes = fs.readFileSync(matrixFile);
  const manifestBytes = fs.readFileSync(manifestFile);
  const matrix = JSON.parse(matrixBytes.toString('utf8'));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const cases = readJson(casesFile);
  const explicit = readJson(explicitFile);
  const catalog = definitionCatalog(cases, explicit);
  if (CLIENT_SURFACE_DOCUMENT.schema !== 'wtfp.evaluation.client-routing-surfaces/v1' ||
      CLIENT_SURFACE_DOCUMENT.version !== 1) {
    throw new Error('unsupported checked-in client routing surface contract');
  }
  if (new Set(CLIENT_SURFACE_DOCUMENT.targets.map(item => item.target)).size !==
      CLIENT_SURFACE_DOCUMENT.targets.length) {
    throw new Error('client routing surface contract repeats a target');
  }
  const corpusDigests = [];
  for (const corpus of manifest.corpora) {
    const file = containedFile(repositoryRoot, corpus.path, 'routing corpus');
    const actual = sha256(fs.readFileSync(file));
    if (actual !== corpus.sha256) throw new Error(`routing corpus drift: ${corpus.path}`);
    corpusDigests.push({ path: corpus.path, sha256: actual });
  }
  const rows = selectedRows.map(id => {
    const row = matrix.rows.find(candidate => candidate.id === id);
    if (!row) throw new Error(`unknown matrix row ${id}`);
    if (row.status !== 'planned' || row.evidence_level !== 'paid-model') {
      throw new Error(`matrix row ${id} is not a planned paid-model row`);
    }
    if (row.allow_substitution !== false) throw new Error(`matrix row ${id} permits substitution`);
    if (!CLIENT_SURFACES[row.adapter_target] || !CAPABILITY_SURFACES[row.adapter_target]) {
      throw new Error(`unsupported primary adapter ${row.adapter_target}`);
    }
    if (row.selector_profile !== row.adapter_target) {
      throw new Error(`matrix row ${id} selector profile differs from its adapter target`);
    }
    if (!Array.isArray(row.required_claims) || row.required_claims.length === 0) {
      throw new Error(`matrix row ${id} has no explicit evidence claims`);
    }
    if (!Number.isInteger(row.maximum_paid_cases) || row.maximum_paid_cases < row.case_ids.length) {
      throw new Error(`matrix row ${id} paid-case ceiling is below its immutable case set`);
    }
    if (new Set(row.case_ids).size !== row.case_ids.length) throw new Error(`matrix row ${id} repeats a case id`);
    for (const caseId of row.case_ids) {
      if (!catalog.has(caseId)) throw new Error(`matrix row ${id} names unknown case ${caseId}`);
    }
    return row;
  });
  if (new Set(selectedRows).size !== selectedRows.length) throw new Error('selected rows are not unique');
  const envelopes = Object.fromEntries(rows.map(row => {
    const surface = CLIENT_SURFACES[row.adapter_target];
    return [row.id, verifyGeneratedEnvelope(manifest, surface.envelopeTarget)];
  }));
  const targetCatalogs = Object.fromEntries([...new Set(rows.map(row => row.adapter_target))]
    .map(target => [target, definitionCatalog(null, null, target)]));
  for (const row of rows) {
    for (const caseId of row.case_ids) {
      const definition = targetCatalogs[row.adapter_target].get(caseId);
      if (!definition || definition.input_supported === false || typeof definition.input !== 'string') {
        throw new Error(`${row.id}/${caseId} has no supported native selector projection`);
      }
    }
  }
  const repository = repositoryIdentity(repositoryRoot, manifest);
  return {
    matrix,
    matrix_sha256: sha256(matrixBytes),
    manifest,
    manifest_sha256: sha256(manifestBytes),
    corpora: corpusDigests,
    catalog,
    target_catalogs: targetCatalogs,
    rows,
    client_surfaces: CLIENT_SURFACE_DOCUMENT,
    client_surfaces_sha256: sha256(fs.readFileSync(clientSurfacesFile)),
    envelopes,
    repository
  };
}

function hashTree(root, relative = '') {
  if (!fs.existsSync(root)) return sha256(Buffer.from('[]', 'utf8'));
  const inventory = [];
  function visit(currentRelative) {
    const directory = path.join(root, currentRelative);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const childRelative = path.join(currentRelative, entry.name);
      const normalized = childRelative.split(path.sep).join('/');
      const absolute = path.join(root, childRelative);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) throw new Error(`refusing symlink in hashed tree: ${absolute}`);
      if (entry.isDirectory()) visit(childRelative);
      else if (entry.isFile()) inventory.push({
        path: normalized,
        bytes: stat.size,
        mode: stat.mode & 0o777,
        sha256: sha256(fs.readFileSync(absolute))
      });
      else throw new Error(`refusing non-file tree entry: ${absolute}`);
    }
  }
  visit(relative);
  return sha256(canonicalBytes(inventory));
}

function profileObject(file) {
  if (!fs.existsSync(file)) return { present: false };
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) {
    const target = fs.realpathSync(file);
    const targetStat = fs.statSync(target);
    if (!targetStat.isFile()) return { present: true, kind: 'symlink-other', target_sha256: sha256(Buffer.from(target)) };
    return {
      present: true,
      kind: 'symlink-file',
      bytes: targetStat.size,
      content_sha256: sha256(fs.readFileSync(target)),
      target_sha256: sha256(Buffer.from(target))
    };
  }
  if (stat.isFile()) return {
    present: true,
    kind: 'file',
    bytes: stat.size,
    mode: stat.mode & 0o777,
    content_sha256: sha256(fs.readFileSync(file))
  };
  if (stat.isDirectory()) return { present: true, kind: 'directory', tree_sha256: hashTree(file) };
  return { present: true, kind: 'other', mode: stat.mode & 0o777 };
}

function profileDigest(file) {
  return sha256(canonicalBytes(profileObject(file)));
}

function profilePrefixDigest(directory, prefix) {
  if (!fs.existsSync(directory)) return sha256(canonicalBytes([]));
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    return sha256(canonicalBytes({ directory: profileObject(directory) }));
  }
  const inventory = fs.readdirSync(directory).filter(name => name.startsWith(prefix)).sort()
    .map(name => ({ name, object: profileObject(path.join(directory, name)) }));
  return sha256(canonicalBytes(inventory));
}

function profileSpecs(environment = process.env, normalHome = os.homedir(), includeForwardSources = false) {
  const specs = [
    ['claude-root-state', path.join(normalHome, '.claude.json')],
    ['claude-root-state-backups', normalHome, { prefix: '.claude.json.backup' }],
    ['claude-credentials', path.join(normalHome, '.claude', '.credentials.json')],
    ['claude-settings', path.join(normalHome, '.claude', 'settings.json')],
    ['codex-auth', path.join(normalHome, '.codex', 'auth.json')],
    ['codex-config', path.join(normalHome, '.codex', 'config.toml')],
    ['clio-settings', path.join(normalHome, '.config', 'clio-coder', 'settings.yaml')],
    ['clio-credentials', path.join(normalHome, '.config', 'clio-coder', 'credentials.yaml')]
  ];
  const credentialSources = [
    ['claude-forward-source', environment.WTFP_ROUTING_CLAUDE_CREDENTIALS_SOURCE],
    ['codex-forward-source', environment.WTFP_ROUTING_CODEX_CREDENTIALS_SOURCE],
    ['clio-settings-forward-source', environment.WTFP_ROUTING_CLIO_SETTINGS_SOURCE],
    ['clio-credentials-forward-source', environment.WTFP_ROUTING_CLIO_CREDENTIALS_SOURCE]
  ];
  if (includeForwardSources) {
    specs.push(...credentialSources.filter(([, file]) => Boolean(file))
      .map(([label, file]) => [label, path.resolve(file)]));
  }
  const extras = (environment.WTFP_ROUTING_NORMAL_PROFILE_PATHS || '')
    .split(path.delimiter).filter(Boolean).map((file, index) => [`extra-${index + 1}`, path.resolve(file)]);
  specs.push(...extras);
  const labels = new Set();
  return specs.filter(([label]) => {
    if (labels.has(label)) return false;
    labels.add(label);
    return true;
  });
}

function snapshotProfiles(specs) {
  return specs.map(([label, file, options]) => ({
    label,
    sha256: options?.prefix ? profilePrefixDigest(file, options.prefix) : profileDigest(file)
  }));
}

function compareProfiles(before, after) {
  const latter = new Map(after.map(item => [item.label, item.sha256]));
  return before.map(item => ({
    label: item.label,
    before_sha256: item.sha256,
    after_sha256: latter.get(item.label) || null,
    unchanged: latter.get(item.label) === item.sha256
  }));
}

function isolatedPaths(caseRoot, client, clioSource = null) {
  const xdg = path.join(caseRoot, 'xdg');
  const common = {
    HOME: path.join(caseRoot, 'home'),
    XDG_CONFIG_HOME: path.join(xdg, 'config'),
    XDG_DATA_HOME: path.join(xdg, 'data'),
    XDG_STATE_HOME: path.join(xdg, 'state'),
    XDG_CACHE_HOME: path.join(xdg, 'cache'),
    TMPDIR: path.join(caseRoot, 'tmp'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null'
  };
  if (client === 'claude') common.CLAUDE_CONFIG_DIR = path.join(caseRoot, 'client', 'claude');
  else if (client === 'codex') common.CODEX_HOME = path.join(caseRoot, 'client', 'codex');
  else if (client === 'clio') {
    const clio = path.join(caseRoot, 'client', 'clio');
    Object.assign(common, {
      CLIO_CODER_HOME: clio,
      CLIO_CODER_CONFIG_DIR: path.join(clio, 'config'),
      CLIO_CODER_DATA_DIR: path.join(clio, 'data'),
      CLIO_CODER_STATE_DIR: path.join(clio, 'state'),
      CLIO_CODER_CACHE_DIR: path.join(clio, 'cache'),
      CLIO_CODER_BIN_DIR: path.join(clio, 'bin'),
      CLIO_CODER_REQUIRE_HOME_PREFIX: '1',
      CLIO_CODER_NO_NETWORK_TOOLS: '1',
      CLIO_CODER_TURN_TOOL_CALL_BUDGET: '1',
      CLIO_CODER_PACKAGE_ROOT: clioSource
    });
  } else throw new Error(`unknown client ${client}`);
  return common;
}

function sanitizedEnvironment(paths, inherited = process.env) {
  const output = {};
  for (const key of ['PATH', 'LANG', 'LANGUAGE', 'LC_ALL', 'LC_CTYPE', 'TZ', 'TERM', 'NO_COLOR']) {
    if (typeof inherited[key] === 'string') output[key] = inherited[key];
  }
  return Object.assign(output, paths);
}

function initializeIsolatedDirectories(paths) {
  for (const [key, value] of Object.entries(paths)) {
    if (key === 'HOME' || key === 'TMPDIR' || key.startsWith('XDG_') || key.endsWith('_DIR') || key.endsWith('_HOME')) {
      makePrivateDirectory(value);
    }
  }
}

function assertIsolatedLayout(layout) {
  assertPrivateDirectory(layout.root, 'case root');
  const rootReal = fs.realpathSync(layout.root);
  const directories = [layout.project, layout.evidence];
  for (const [key, value] of Object.entries(layout.paths)) {
    if (key === 'HOME' || key === 'TMPDIR' || key.startsWith('XDG_') || key.endsWith('_DIR') || key.endsWith('_HOME')) {
      directories.push(value);
    }
  }
  for (const directory of new Set(directories)) {
    if (!isContained(layout.root, directory)) throw new Error(`isolated directory escapes case root: ${directory}`);
    assertPrivateDirectory(directory, 'isolated directory');
    if (!isContained(rootReal, fs.realpathSync(directory))) {
      throw new Error(`isolated directory resolves outside case root: ${directory}`);
    }
  }
}

function createRoot(requested) {
  if (requested) {
    if (fs.existsSync(requested)) throw new Error(`refusing existing prepare root: ${requested}`);
    fs.mkdirSync(requested, { mode: 0o700 });
    fs.chmodSync(requested, 0o700);
    return requested;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-routing-matrix.'));
  fs.chmodSync(root, 0o700);
  return root;
}

function createCaseLayout(root, rowId, index, definition, client, clioSource) {
  const leaf = `${String(index + 1).padStart(2, '0')}-${definition.id}`;
  const caseRoot = path.join(root, 'rows', rowId, 'cases', leaf);
  if (fs.existsSync(caseRoot)) throw new Error(`refusing existing case root: ${caseRoot}`);
  makePrivateDirectory(caseRoot);
  const project = path.join(caseRoot, 'project');
  const evidence = path.join(caseRoot, 'evidence');
  makePrivateDirectory(project);
  makePrivateDirectory(evidence);
  const paths = isolatedPaths(caseRoot, client, clioSource);
  initializeIsolatedDirectories(paths);
  if (typeof definition.input !== 'string' || typeof definition.semanticInput !== 'string') {
    throw new Error(`${definition.id} has no supported native and semantic input projection for ${client}`);
  }
  const input = Buffer.from(definition.input, 'utf8');
  const semanticInput = Buffer.from(definition.semanticInput, 'utf8');
  const inputFile = path.join(evidence, 'native-input.txt');
  const semanticInputFile = path.join(evidence, 'semantic-input.txt');
  writePrivate(inputFile, input, true);
  writePrivate(semanticInputFile, semanticInput, true);
  const snapshot = hashTree(project);
  return {
    root: caseRoot,
    project,
    evidence,
    input_file: inputFile,
    native_input_file: inputFile,
    semantic_input_file: semanticInputFile,
    input_sha256: sha256(input),
    input_bytes: input.length,
    native_input_sha256: sha256(input),
    native_input_bytes: input.length,
    semantic_input_sha256: sha256(semanticInput),
    semantic_input_bytes: semanticInput.length,
    project_snapshot_sha256: snapshot,
    paths
  };
}

function clientInvocation(client, binary, row, caseLayout, definition) {
  const input = definition.input;
  let executable = binary.path;
  let argv;
  let inputTransport;
  let stdin = null;
  if (client === 'claude') {
    const maximumUsd = row.cost_policy.maximum_usd;
    const perCaseBudget = Number.isFinite(maximumUsd)
      ? Math.max(0.01, maximumUsd / row.maximum_paid_cases) : null;
    argv = [
      '--restricted', '--strict-mcp-config', '--mcp-config', '{}', '--no-chrome',
      '--plugin-dir', path.join(repositoryRoot, 'vendors', 'claude'),
      '--tools', 'Skill,Read,Glob,Grep', '--model', row.model.id, '--effort', row.effort,
      '--permission-mode', 'dontAsk', '--no-session-persistence',
      '--append-system-prompt', ROUTING_CONTROL_INSTRUCTIONS,
      '--max-budget-usd', String(perCaseBudget), '--output-format', 'stream-json',
      '--verbose', '--print', input
    ];
    inputTransport = 'single-spawn-argument';
  } else if (client === 'codex') {
    argv = [
      '-a', 'never', 'exec', '-C', caseLayout.project, '-s', 'read-only', '-m', row.model.id,
      '-c', 'model_reasoning_effort="xhigh"', '-c', 'web_search="disabled"',
      '-c', 'memories.use_memories=false', '-c', 'analytics.enabled=false',
      '-c', 'features.multi_agent=false',
      '-c', `developer_instructions=${JSON.stringify(ROUTING_CONTROL_INSTRUCTIONS)}`,
      '--ephemeral', '--ignore-rules', '--skip-git-repo-check', '--json', '-'
    ];
    stdin = Buffer.from(input, 'utf8');
    inputTransport = 'exact-stdin';
  } else if (client === 'clio') {
    executable = process.execPath;
    argv = [
      binary.path, '--no-context-files', 'run', '--target', 'openai-codex', '--model', row.model.id,
      '--thinking', row.effort, '--autonomy', 'read-only', '--json', '--json-events', 'full', input
    ];
    inputTransport = 'single-spawn-argument';
  } else throw new Error(`unsupported client ${client}`);
  const redactedArgv = argv.map(value => value === input ? `<raw-input:${caseLayout.input_sha256}>` : value);
  return {
    executable,
    executable_sha256: executable === binary.path ? binary.sha256 : sha256(fs.readFileSync(executable)),
    argv,
    argv_display: redactedArgv,
    argv_sha256: sha256(canonicalBytes(argv)),
    stdin,
    stdin_sha256: stdin ? sha256(stdin) : null,
    input_transport: inputTransport,
    cwd: caseLayout.project,
    required_evidence: {
      unique_session_id: true,
      full_native_events: true,
      native_route_not_model_self_report: true,
      capability_contract: row.required_claims,
      selector_profile: row.selector_profile,
      exact_arguments_when_observable: definition.explicit &&
        CAPABILITY_SURFACES[client].observability.arguments === 'explicit-only',
      latency_ms: true,
      cost_policy: row.cost_policy,
      project_snapshot_unchanged: true,
      normal_profiles_unchanged: true,
      no_mutation_network_or_shell_tool: true
    },
    routing_control_instructions_sha256: client === 'clio' ? null : sha256(Buffer.from(ROUTING_CONTROL_INSTRUCTIONS))
  };
}

function nativeCommands(client, binary, caseLayout) {
  if (client === 'claude') {
    const plugin = path.join(repositoryRoot, 'vendors', 'claude');
    return [
      ['version', binary.path, ['--version']],
      ['plugin-validate', binary.path, ['plugin', 'validate', '--strict', plugin]],
      ['marketplace-add', binary.path, ['plugin', 'marketplace', 'add', plugin, '--scope', 'user']],
      ['plugin-install', binary.path, ['plugin', 'install', 'wtfp@wtfp', '--scope', 'user', '--yes']],
      ['plugin-list', binary.path, ['plugin', 'list', '--json']],
      ['plugin-details', binary.path, ['plugin', 'details', 'wtfp@wtfp']]
    ];
  }
  if (client === 'codex') {
    const marketplace = path.join(repositoryRoot, 'vendors', 'codex');
    return [
      ['version', binary.path, ['--version']],
      ['marketplace-add', binary.path, ['plugin', 'marketplace', 'add', marketplace, '--json']],
      ['plugin-add', binary.path, ['plugin', 'add', 'wtf-p@wtfp', '--json']],
      ['plugin-list', binary.path, ['plugin', 'list', '--json']],
      ['prompt-input', binary.path, [
        'debug', 'prompt-input', '-c', 'web_search="disabled"', '-c', 'memories.use_memories=false',
        fs.readFileSync(caseLayout.input_file, 'utf8')
      ]]
    ];
  }
  if (client === 'clio') {
    const extension = path.join(repositoryRoot, 'vendors', 'clio');
    const node = process.execPath;
    const prefix = [binary.path];
    const controlProject = path.join(caseLayout.root, 'native-control-project');
    const git = resolveExecutable('git', 'Git control').path;
    return [
      ['control-git-init', git, ['init', '--quiet', '--initial-branch=routing-native', '--template='], controlProject],
      ['version', node, [...prefix, '--version'], caseLayout.project],
      ['extension-discover', node, [...prefix, 'extensions', 'discover', extension, '--json'], caseLayout.project],
      ['extension-install', node, [...prefix, 'extensions', 'install', extension, '--user', '--json'], caseLayout.project],
      ['extension-list', node, [...prefix, 'extensions', 'list', '--all', '--json'], caseLayout.project],
      ['skills-list', node, [...prefix, 'skills', 'list', '--all', '--json'], caseLayout.project],
      ['agents-list', node, [...prefix, 'agents', '--all', '--json'], caseLayout.project],
      ['fleet-plan-validate', node, [...prefix, 'fleet', 'validate', 'wtfp-plan-section', '--json'], controlProject],
      ['fleet-plan-graph', node, [...prefix, 'fleet', 'graph', 'wtfp-plan-section', '--json'], controlProject],
      ['fleet-draft-validate', node, [...prefix, 'fleet', 'validate', 'wtfp-draft-review', '--json'], controlProject],
      ['fleet-draft-graph', node, [...prefix, 'fleet', 'graph', 'wtfp-draft-review', '--json'], controlProject]
    ];
  }
  throw new Error(`unsupported client ${client}`);
}

function validateNativePreflight(client, outputs, row) {
  const errors = [];
  for (const output of outputs) {
    if (output.exit_code !== 0) errors.push(`${output.name} exited ${output.exit_code}`);
  }
  const text = name => outputs.find(item => item.name === name)?.stdout_text || '';
  const version = text('version').trim();
  if (!CLIENT_SURFACES[client].versionPattern.test(version)) {
    errors.push(`version substituted: ${JSON.stringify(version)} != ${row.client.version}`);
  }
  if (client === 'claude') {
    const inventory = text('plugin-list');
    const details = text('plugin-details');
    if (!inventory.includes('wtfp') || !details.includes('wtfp')) errors.push('Claude native plugin inventory omitted wtfp');
  } else if (client === 'codex') {
    const inventory = text('plugin-list');
    const promptInput = text('prompt-input');
    if (!inventory.includes('wtf-p') || !inventory.includes('wtfp')) errors.push('Codex plugin is not installed and enabled');
    for (const skill of EXPECTED_SKILLS) {
      if (!promptInput.includes(`wtf-p:${skill}`)) errors.push(`Codex prompt input omitted wtf-p:${skill}`);
    }
    const fullSkillMarkers = (promptInput.match(/<!-- Generated by WTF-P/gu) || []).length;
    if (fullSkillMarkers > 0) errors.push('Codex initial prompt unexpectedly disclosed full WTF-P skill bodies');
  } else if (client === 'clio') {
    const discovery = text('extension-discover');
    const list = text('extension-list');
    if (!discovery.includes('"valid"') || !discovery.includes('wtfp')) errors.push('Clio discovery omitted a valid WTF-P candidate');
    if (!list.includes('wtfp')) errors.push('Clio extension list omitted wtfp');
    for (const skill of EXPECTED_SKILLS) {
      if (!text('skills-list').includes(skill)) errors.push(`Clio skill list omitted ${skill}`);
    }
    for (const fleet of ['wtfp-plan-section', 'wtfp-draft-review']) {
      if (!text(`fleet-${fleet === 'wtfp-plan-section' ? 'plan' : 'draft'}-validate`).includes('"valid":true') &&
          !text(`fleet-${fleet === 'wtfp-plan-section' ? 'plan' : 'draft'}-validate`).includes('"valid": true')) {
        errors.push(`Clio fleet validation did not prove ${fleet} valid`);
      }
    }
  }
  return { valid: errors.length === 0, version, errors };
}

function runNativePreflight(client, binary, row, caseLayout, environment) {
  const nativeRoot = path.join(caseLayout.evidence, 'native');
  makePrivateDirectory(nativeRoot);
  if (client === 'clio') makePrivateDirectory(path.join(caseLayout.root, 'native-control-project'));
  const outputs = [];
  for (const [name, executable, argv, commandCwd] of nativeCommands(client, binary, caseLayout)) {
    const started = process.hrtime.bigint();
    const result = commandResult(executable, argv, { cwd: commandCwd || caseLayout.project, env: environment });
    const latency = Number((process.hrtime.bigint() - started) / 1000000n);
    const stdoutFile = path.join(nativeRoot, `${name}.stdout`);
    const stderrFile = path.join(nativeRoot, `${name}.stderr`);
    writePrivate(stdoutFile, result.stdout);
    writePrivate(stderrFile, result.stderr);
    outputs.push({
      name,
      executable,
      executable_sha256: sha256(fs.readFileSync(executable)),
      argv_sha256: sha256(canonicalBytes(argv)),
      cwd: commandCwd || caseLayout.project,
      exit_code: result.exit_code,
      signal: result.signal,
      latency_ms: latency,
      stdout: { file: path.relative(caseLayout.evidence, stdoutFile), sha256: sha256(result.stdout), bytes: result.stdout.length },
      stderr: { file: path.relative(caseLayout.evidence, stderrFile), sha256: sha256(result.stderr), bytes: result.stderr.length },
      stdout_text: result.stdout.toString('utf8')
    });
  }
  const validation = validateNativePreflight(client, outputs, row);
  const record = {
    schema: 'wtfp.evaluation.routing-native-preflight/v1',
    client,
    case_id: path.basename(caseLayout.root).replace(/^\d+-/u, ''),
    valid: validation.valid,
    actual_version: validation.version,
    errors: validation.errors,
    selector_profile: row.selector_profile,
    discovery_observability: CAPABILITY_SURFACES[client].observability.discovery,
    activation_observability: CAPABILITY_SURFACES[client].observability.activation,
    disclosure_observability: CAPABILITY_SURFACES[client].observability.resources,
    commands: outputs.map(({ stdout_text, ...output }) => output)
  };
  const file = path.join(caseLayout.evidence, 'native-preflight.json');
  writeJsonPrivate(file, record, true);
  return { record, sha256: sha256(fs.readFileSync(file)) };
}

function inspectClients(options, suite) {
  const binaries = {};
  for (const row of suite.rows) {
    const client = row.adapter_target;
    if (!binaries[client]) {
      binaries[client] = resolveExecutable(options.binaries[client], CLIENT_SURFACES[client].clientName);
      if (binaries[client].sha256 !== CLIENT_SURFACES[client].expectedBinarySha256) {
        throw new Error(`${CLIENT_SURFACES[client].clientName} binary digest substituted: ` +
          `${binaries[client].sha256} != ${CLIENT_SURFACES[client].expectedBinarySha256}`);
      }
    }
  }
  let clioSource = null;
  if (suite.rows.some(row => row.adapter_target === 'clio')) {
    const stat = fs.lstatSync(options.clioSource);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Clio source must be a non-symlink directory: ${options.clioSource}`);
    const sourceMetadata = gitMetadata(options.clioSource);
    if (sourceMetadata.dirty) throw new Error('Clio coordinated source must be clean');
    const packageRoot = path.resolve(path.dirname(binaries.clio.path), '..', '..');
    const packageStat = fs.lstatSync(packageRoot);
    if (packageStat.isSymbolicLink() || !packageStat.isDirectory()) {
      throw new Error(`Clio package root must be a non-symlink directory: ${packageRoot}`);
    }
    if (fs.realpathSync(packageRoot) !== fs.realpathSync(options.clioSource)) {
      throw new Error('Clio binary must come from the exact coordinated source root');
    }
    const distTreeSha256 = hashTree(path.join(packageRoot, 'dist'));
    if (distTreeSha256 !== CLIENT_SURFACES.clio.expectedDistTreeSha256) {
      throw new Error(`Clio distribution tree substituted: ${distTreeSha256} != ` +
        CLIENT_SURFACES.clio.expectedDistTreeSha256);
    }
    clioSource = {
      root: options.clioSource,
      package_root: packageRoot,
      ...sourceMetadata,
      tracked_tree: trackedTreeDigest(options.clioSource),
      dist_tree_sha256: distTreeSha256
    };
    const expected = suite.rows.find(row => row.adapter_target === 'clio').client.commit;
    if (clioSource.commit !== expected) throw new Error(`Clio source commit substituted: ${clioSource.commit} != ${expected}`);
  }
  for (const row of suite.rows) {
    const client = row.adapter_target;
    const args = client === 'clio' ? [binaries[client].path, '--version'] : ['--version'];
    const executable = client === 'clio' ? process.execPath : binaries[client].path;
    const result = commandResult(executable, args, { env: sanitizedEnvironment({}) });
    const version = result.stdout.toString('utf8').trim();
    if (result.exit_code !== 0 || !CLIENT_SURFACES[client].versionPattern.test(version)) {
      throw new Error(`${CLIENT_SURFACES[client].clientName} version substituted: ${JSON.stringify(version)}`);
    }
    binaries[client].version = version;
  }
  return { binaries, clioSource };
}

function surfaceAssessment(row) {
  const surface = CAPABILITY_SURFACES[row.selector_profile];
  const blockers = [];
  if (!surface) blockers.push(`selector profile ${row.selector_profile} is not defined`);
  if (surface && row.cost_policy.status !== surface.cost_policy.status) {
    blockers.push(`matrix cost policy ${row.cost_policy.status} differs from surface ${surface.cost_policy.status}`);
  }
  if (row.case_ids.length > row.maximum_paid_cases) {
    blockers.push(`case count ${row.case_ids.length} exceeds paid-case ceiling ${row.maximum_paid_cases}`);
  }
  const limitations = surface ? Object.entries(surface.observability)
    .filter(([, value]) => value === 'unobservable' || value === 'partially-observable' || value === 'explicit-only')
    .map(([claim, value]) => `${claim}:${value}`) : [];
  return {
    client: row.adapter_target,
    selector_profile: row.selector_profile,
    implicit: surface?.implicit || null,
    explicit: surface?.explicit || null,
    observability: surface?.observability || null,
    cost_policy: surface?.cost_policy || null,
    required_claims: [...row.required_claims],
    limitations,
    paid_execution_ready: blockers.length === 0,
    blockers
  };
}

function buildDryPlan(options, suite, clients) {
  return {
    schema: 'wtfp.evaluation.routing-plan/v1',
    mode: options.mode,
    paid_model_calls: false,
    routing_manifest_sha256: suite.manifest_sha256,
    matrix_sha256: suite.matrix_sha256,
    client_surfaces_sha256: suite.client_surfaces_sha256,
    runner_sha256: sha256(fs.readFileSync(runnerFile)),
    execution_contract: executionContractDigests(),
    repository: suite.repository,
    clio_source: clients.clioSource,
    rows: suite.rows.map(row => ({
      id: row.id,
      client: row.client,
      model: row.model,
      effort: row.effort,
      permission_policy: row.permission_policy,
      environment_policy: row.environment_policy,
      maximum_paid_cases: row.maximum_paid_cases,
      cost_policy: row.cost_policy,
      case_ids: [...row.case_ids],
      inputs: row.case_ids.map(caseId => {
        const definition = suite.target_catalogs[row.adapter_target].get(caseId);
        return {
          case_id: caseId,
          semantic_sha256: sha256(Buffer.from(definition.semanticInput, 'utf8')),
          semantic_bytes: Buffer.byteLength(definition.semanticInput, 'utf8'),
          native_sha256: sha256(Buffer.from(definition.input, 'utf8')),
          native_bytes: Buffer.byteLength(definition.input, 'utf8'),
          selector_supported: definition.input_supported !== false
        };
      }),
      binary: clients.binaries[row.adapter_target],
      generated_envelope: suite.envelopes[row.id],
      surface: surfaceAssessment(row)
    })),
    aggregate: {
      rows: suite.rows.length,
      cases: suite.rows.reduce((sum, row) => sum + row.case_ids.length, 0),
      executable_rows: suite.rows.filter(row => surfaceAssessment(row).paid_execution_ready).length,
      paid_execution_ready: suite.rows.every(row => surfaceAssessment(row).paid_execution_ready)
    }
  };
}

function prepare(options, suite, clients, environment = process.env) {
  assertRepositoryIdentity(suite.repository, repositoryRoot, suite.manifest);
  const root = createRoot(options.root);
  const profileList = profileSpecs(environment);
  const profilesBefore = snapshotProfiles(profileList);
  const plan = buildDryPlan({ ...options, mode: 'prepare' }, suite, clients);
  const preparedCases = [];
  let nativeValid = true;
  for (const row of suite.rows) {
    const client = row.adapter_target;
    const binary = clients.binaries[client];
    for (let index = 0; index < row.case_ids.length; index += 1) {
      const definition = suite.target_catalogs[client].get(row.case_ids[index]);
      const layout = createCaseLayout(root, row.id, index, definition, client,
        clients.clioSource?.package_root || null);
      if (layout.project_snapshot_sha256 !== suite.manifest.fixture.project_snapshot_sha256) {
        throw new Error(`fresh project hash differs for ${row.id}/${definition.id}`);
      }
      const childEnv = sanitizedEnvironment(layout.paths, environment);
      const invocation = clientInvocation(client, binary, row, layout, definition);
      const commandManifest = {
        schema: 'wtfp.evaluation.routing-command/v1',
        row_id: row.id,
        case_id: definition.id,
        client,
        binary,
        model: row.model,
        effort: row.effort,
        permission_policy: row.permission_policy,
        semantic_input: {
          file: 'semantic-input.txt',
          sha256: layout.semantic_input_sha256,
          bytes: layout.semantic_input_bytes
        },
        native_input: {
          file: 'native-input.txt',
          sha256: layout.native_input_sha256,
          bytes: layout.native_input_bytes,
          transport: invocation.input_transport
        },
        command: {
          executable: invocation.executable,
          executable_sha256: invocation.executable_sha256,
          argv: invocation.argv_display,
          argv_sha256: invocation.argv_sha256,
          stdin_sha256: invocation.stdin_sha256,
          cwd: layout.project
        },
        environment: {
          inherited_allowlist: ['PATH', 'LANG', 'LANGUAGE', 'LC_ALL', 'LC_CTYPE', 'TZ', 'TERM', 'NO_COLOR'],
          isolated_keys: Object.keys(layout.paths).sort(),
          credential_keys_present: Object.keys(childEnv).filter(key => /KEY|TOKEN|CREDENTIAL|SECRET/iu.test(key))
        },
        required_evidence: invocation.required_evidence,
        surface: surfaceAssessment(row)
      };
      const commandFile = path.join(layout.evidence, 'command.json');
      writeJsonPrivate(commandFile, commandManifest, true);
      const caseProfilesBefore = snapshotProfiles(profileList);
      const projectBefore = hashTree(layout.project);
      const native = runNativePreflight(client, binary, row, layout, childEnv);
      const projectAfter = hashTree(layout.project);
      const caseProfilesAfter = snapshotProfiles(profileList);
      const profilePairs = compareProfiles(caseProfilesBefore, caseProfilesAfter);
      const caseValid = native.record.valid && projectBefore === projectAfter &&
        profilePairs.every(pair => pair.unchanged) &&
        fs.readFileSync(layout.input_file).equals(Buffer.from(definition.input, 'utf8'));
      nativeValid &&= caseValid;
      const caseRecord = {
        row_id: row.id,
        case_id: definition.id,
        case_root: layout.root,
        session_nonce: crypto.randomUUID(),
        semantic_input_sha256: layout.semantic_input_sha256,
        semantic_input_bytes: layout.semantic_input_bytes,
        native_input_sha256: layout.native_input_sha256,
        native_input_bytes: layout.native_input_bytes,
        input_sha256: layout.native_input_sha256,
        input_bytes: layout.native_input_bytes,
        project_before_sha256: projectBefore,
        project_after_sha256: projectAfter,
        project_unchanged: projectBefore === projectAfter,
        normal_profile_hashes: profilePairs,
        command_sha256: sha256(fs.readFileSync(commandFile)),
        native_preflight_sha256: native.sha256,
        native_preflight_valid: native.record.valid,
        paid_execution_ready: surfaceAssessment(row).paid_execution_ready,
        blockers: surfaceAssessment(row).blockers
      };
      const recordFile = path.join(layout.evidence, 'case-prepared.json');
      writeJsonPrivate(recordFile, caseRecord, true);
      preparedCases.push({ ...caseRecord, record_sha256: sha256(fs.readFileSync(recordFile)) });
    }
  }
  const profilesAfter = snapshotProfiles(profileList);
  const profilePairs = compareProfiles(profilesBefore, profilesAfter);
  if (!profilePairs.every(pair => pair.unchanged)) nativeValid = false;
  assertRepositoryIdentity(suite.repository, repositoryRoot, suite.manifest);
  const prepared = {
    schema: PREPARED_SCHEMA,
    created_at: new Date().toISOString(),
    root,
    root_mode: (fs.statSync(root).mode & 0o777).toString(8).padStart(4, '0'),
    paid_model_calls: 0,
    credentials_read: false,
    routing_manifest_sha256: suite.manifest_sha256,
    matrix_sha256: suite.matrix_sha256,
    client_surfaces_sha256: suite.client_surfaces_sha256,
    runner_sha256: sha256(fs.readFileSync(runnerFile)),
    execution_contract: executionContractDigests(),
    repository: suite.repository,
    clio_source: clients.clioSource,
    binaries: clients.binaries,
    envelopes: suite.envelopes,
    normal_profile_hashes: profilePairs,
    native_preflight_valid: nativeValid,
    paid_execution_ready: suite.rows.every(row => surfaceAssessment(row).paid_execution_ready),
    rows: suite.rows.map(row => ({
      id: row.id,
      case_ids: [...row.case_ids],
      surface: surfaceAssessment(row)
    })),
    cases: preparedCases
  };
  const evidenceRoot = path.join(root, 'evidence');
  makePrivateDirectory(evidenceRoot);
  writeJsonPrivate(path.join(evidenceRoot, 'run-plan.json'), plan, true);
  const preparedFile = path.join(evidenceRoot, PREPARED_FILE);
  writeJsonPrivate(preparedFile, prepared, true);
  writePrivate(path.join(evidenceRoot, `${PREPARED_FILE}.sha256`), `${sha256(fs.readFileSync(preparedFile))}\n`, true);
  if (!nativeValid) throw new Error(`native preparation failed closed; retained evidence at ${root}`);
  return { root, prepared };
}

function verifySealedJson(file) {
  const digestFile = `${file}.sha256`;
  const expected = fs.readFileSync(digestFile, 'utf8').trim();
  const actual = sha256(fs.readFileSync(file));
  if (!/^[a-f0-9]{64}$/u.test(expected) || expected !== actual) throw new Error(`sealed evidence digest mismatch: ${file}`);
  return readJson(file);
}

function verifyPrepared(options, suite, clients, environment = process.env) {
  assertPrivateDirectory(options.root, 'prepared root');
  const preparedFile = path.join(options.root, 'evidence', PREPARED_FILE);
  const prepared = verifySealedJson(preparedFile);
  if (prepared.schema !== PREPARED_SCHEMA || prepared.root !== options.root) throw new Error('prepared root identity mismatch');
  for (const [label, actual, expected] of [
    ['routing manifest', suite.manifest_sha256, prepared.routing_manifest_sha256],
    ['budget matrix', suite.matrix_sha256, prepared.matrix_sha256],
    ['client routing surfaces', suite.client_surfaces_sha256, prepared.client_surfaces_sha256],
    ['runner', sha256(fs.readFileSync(runnerFile)), prepared.runner_sha256]
  ]) if (actual !== expected) throw new Error(`${label} changed after preparation`);
  assertExecutionContract(prepared.execution_contract);
  if (prepared.native_preflight_valid !== true || prepared.paid_execution_ready !== true ||
      !prepared.normal_profile_hashes.every(pair => pair.unchanged)) {
    throw new Error('prepared root did not pass native, capability, project, and profile gates');
  }
  for (const row of suite.rows) {
    const prior = prepared.rows.find(item => item.id === row.id);
    if (!prior || JSON.stringify(prior.case_ids) !== JSON.stringify(row.case_ids)) {
      throw new Error(`matrix case ids changed after preparation for ${row.id}`);
    }
    const binary = clients.binaries[row.adapter_target];
    const priorBinary = prepared.binaries[row.adapter_target];
    if (!priorBinary || binary.path !== priorBinary.path || binary.sha256 !== priorBinary.sha256) {
      throw new Error(`${row.adapter_target} binary changed after preparation`);
    }
    const envelope = suite.envelopes[row.id];
    if (canonicalBytes(envelope).compare(canonicalBytes(prepared.envelopes[row.id])) !== 0) {
      throw new Error(`${row.adapter_target} generated envelope changed after preparation`);
    }
  }
  if (clients.clioSource && canonicalBytes(clients.clioSource).compare(canonicalBytes(prepared.clio_source)) !== 0) {
    throw new Error('Clio source changed after preparation');
  }
  if (canonicalBytes(suite.repository).compare(canonicalBytes(prepared.repository)) !== 0) {
    throw new Error('WTF-P HEAD, dirty state, or canonical source projection changed after preparation');
  }
  const profileNow = snapshotProfiles(profileSpecs(environment));
  const priorProfiles = prepared.normal_profile_hashes.map(item => ({ label: item.label, sha256: item.after_sha256 }));
  const currentPairs = compareProfiles(priorProfiles, profileNow);
  if (!currentPairs.every(pair => pair.unchanged)) throw new Error('a normal client profile changed after preparation');
  for (const item of prepared.cases) {
    const row = suite.rows.find(candidate => candidate.id === item.row_id);
    const definition = row && suite.target_catalogs[row.adapter_target].get(item.case_id);
    if (!definition) throw new Error(`prepared case no longer exists: ${item.case_id}`);
    if (item.native_preflight_valid !== true || item.project_unchanged !== true || item.paid_execution_ready !== true ||
        item.blockers.length > 0 || !item.normal_profile_hashes.every(pair => pair.unchanged)) {
      throw new Error(`prepared case did not pass all gates: ${item.case_id}`);
    }
    const layout = reconstructCaseLayout(item, row.adapter_target, clients.clioSource?.package_root || null);
    assertIsolatedLayout(layout);
    const evidence = path.join(item.case_root, 'evidence');
    const inputFile = path.join(evidence, 'native-input.txt');
    const semanticInputFile = path.join(evidence, 'semantic-input.txt');
    const input = fs.readFileSync(inputFile);
    const semanticInput = fs.readFileSync(semanticInputFile);
    if (!input.equals(Buffer.from(definition.input, 'utf8')) || sha256(input) !== item.native_input_sha256 ||
        !semanticInput.equals(Buffer.from(definition.semanticInput, 'utf8')) ||
        sha256(semanticInput) !== item.semantic_input_sha256) {
      throw new Error(`raw input changed after preparation: ${item.case_id}`);
    }
    const commandFile = path.join(evidence, 'command.json');
    if (sha256(fs.readFileSync(commandFile)) !== item.command_sha256) throw new Error(`command changed: ${item.case_id}`);
    const nativeFile = path.join(evidence, 'native-preflight.json');
    if (sha256(fs.readFileSync(nativeFile)) !== item.native_preflight_sha256) throw new Error(`native evidence changed: ${item.case_id}`);
    const casePreparedFile = path.join(evidence, 'case-prepared.json');
    if (sha256(fs.readFileSync(casePreparedFile)) !== item.record_sha256) {
      throw new Error(`case preparation receipt changed: ${item.case_id}`);
    }
    const project = path.join(item.case_root, 'project');
    if (hashTree(project) !== item.project_after_sha256) throw new Error(`project changed after preparation: ${item.case_id}`);
  }
  assertRepositoryIdentity(prepared.repository, repositoryRoot, suite.manifest);
  return prepared;
}

function parseJsonLines(bytes) {
  const output = [];
  for (const [index, line] of Buffer.from(bytes).toString('utf8').split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try { output.push(JSON.parse(line)); }
    catch (error) { throw new Error(`invalid JSON event at line ${index + 1}: ${error.message}`); }
  }
  return output;
}

function assertRegularSource(file, label, destinationRoot = null) {
  const absolute = path.resolve(file);
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${label} must be a regular non-symlink file`);
  }
  if (destinationRoot && isContained(destinationRoot, absolute)) {
    throw new Error(`${label} must remain outside the disposable destination root`);
  }
  return absolute;
}

function collectCredentialCandidates(bytes) {
  const text = Buffer.from(bytes).toString('utf8');
  const values = new Set();
  const visit = value => {
    if (typeof value === 'string' && value.length >= 12) values.add(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  try { visit(JSON.parse(text)); }
  catch {
    for (const line of text.split(/\r?\n/u)) {
      const match = line.match(/^\s*[^#:\n]+:\s*["']?(.+?)["']?\s*$/u);
      if (match && match[1].length >= 12 && !/^\$\{/u.test(match[1])) values.add(match[1]);
    }
  }
  return [...values].sort((left, right) => right.length - left.length);
}

function replaceBufferValue(buffer, candidate) {
  const needle = Buffer.from(candidate, 'utf8');
  if (needle.length === 0 || buffer.indexOf(needle) === -1) return { buffer, replacements: 0 };
  const replacement = Buffer.from('[REDACTED-CREDENTIAL]', 'utf8');
  const pieces = [];
  let cursor = 0;
  let replacements = 0;
  for (;;) {
    const index = buffer.indexOf(needle, cursor);
    if (index === -1) break;
    pieces.push(buffer.subarray(cursor, index), replacement);
    cursor = index + needle.length;
    replacements += 1;
  }
  pieces.push(buffer.subarray(cursor));
  return { buffer: Buffer.concat(pieces), replacements };
}

function redactCredentialValues(bytes, candidates) {
  let output = Buffer.from(bytes);
  let replacements = 0;
  for (const candidate of candidates) {
    const result = replaceBufferValue(output, candidate);
    output = result.buffer;
    replacements += result.replacements;
  }
  return { buffer: output, replacements };
}

function walkRegularFiles(root) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) throw new Error(`refusing symlink in disposable execution state: ${absolute}`);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push({ absolute, stat });
      else throw new Error(`refusing special file in disposable execution state: ${absolute}`);
    }
  }
  visit(root);
  return files;
}

function scanAndRedactCredentialValues(root, excludedFiles, candidates) {
  const excluded = new Set(excludedFiles.map(file => path.resolve(file)));
  const findings = [];
  for (const entry of walkRegularFiles(root)) {
    if (excluded.has(entry.absolute)) continue;
    if (entry.stat.size > MAX_CAPTURE_BYTES) {
      findings.push({
        path: path.relative(root, entry.absolute).split(path.sep).join('/'),
        replacements: null,
        error: `file exceeds credential scan ceiling (${entry.stat.size} > ${MAX_CAPTURE_BYTES})`
      });
      continue;
    }
    const original = fs.readFileSync(entry.absolute);
    const redacted = redactCredentialValues(original, candidates);
    if (redacted.replacements === 0) continue;
    writePrivate(entry.absolute, redacted.buffer);
    findings.push({
      path: path.relative(root, entry.absolute).split(path.sep).join('/'),
      replacements: redacted.replacements
    });
  }
  return findings;
}

function credentialBindings(client, paths, environment, caseRoot) {
  const bindings = [];
  const add = (sourceKey, destination, label, required = true, sensitive = true) => {
    const source = environment[sourceKey];
    if (!source) {
      if (required) throw new Error(`${client} execution requires ${sourceKey}`);
      return;
    }
    bindings.push({
      source_key: sourceKey,
      source: assertRegularSource(source, label, caseRoot),
      destination,
      destination_root: caseRoot,
      label,
      sensitive
    });
  };
  if (client === 'claude') {
    add('WTFP_ROUTING_CLAUDE_CREDENTIALS_SOURCE', path.join(paths.CLAUDE_CONFIG_DIR, '.credentials.json'),
      'Claude credential source');
  } else if (client === 'codex') {
    add('WTFP_ROUTING_CODEX_CREDENTIALS_SOURCE', path.join(paths.CODEX_HOME, 'auth.json'),
      'Codex credential source');
  } else if (client === 'clio') {
    add('WTFP_ROUTING_CLIO_SETTINGS_SOURCE', path.join(paths.CLIO_CODER_CONFIG_DIR, 'settings.yaml'),
      'Clio settings source');
    add('WTFP_ROUTING_CLIO_CREDENTIALS_SOURCE', path.join(paths.CLIO_CODER_CONFIG_DIR, 'credentials.yaml'),
      'Clio credential source');
  } else throw new Error(`unsupported credential client ${client}`);
  if (new Set(bindings.map(binding => binding.source)).size !== bindings.length) {
    throw new Error(`${client} credential/config sources must be distinct files`);
  }
  return bindings;
}

function installCredentialBindings(bindings) {
  const candidates = [];
  const records = [];
  const installedDestinations = [];
  try {
    for (const binding of bindings) {
      const destinationRoot = binding.destination_root;
      if (!destinationRoot || !isContained(destinationRoot, binding.destination)) {
        throw new Error(`${binding.label} destination escapes its case root`);
      }
      bindCredentialRoot(binding);
      validateCredentialParent(binding);
      if (fs.existsSync(binding.destination)) throw new Error(`${binding.label} destination already exists`);
      const bytes = fs.readFileSync(binding.source);
      const flags = fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR |
        (fs.constants.O_NOFOLLOW || 0);
      const descriptor = fs.openSync(binding.destination, flags, 0o600);
      try {
        fs.fchmodSync(descriptor, 0o600);
        const opened = fs.fstatSync(descriptor);
        binding.runtime_handle = {
          descriptor,
          device: opened.dev,
          inode: opened.ino,
          original_bytes: bytes.length,
          wiped: false,
          closed: false
        };
        validateCredentialParent(binding);
        const linked = fs.lstatSync(binding.destination);
        if (!linked.isFile() || linked.isSymbolicLink() || opened.dev !== linked.dev || opened.ino !== linked.ino ||
            opened.nlink !== 1 || linked.nlink !== 1 || (opened.mode & 0o777) !== 0o600 ||
            (linked.mode & 0o777) !== 0o600) {
          throw new Error(`${binding.label} destination changed during exclusive creation`);
        }
        let offset = 0;
        while (offset < bytes.length) offset += fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
        fs.fsyncSync(descriptor);
        const written = fs.fstatSync(descriptor);
        const current = fs.lstatSync(binding.destination);
        if (written.dev !== current.dev || written.ino !== current.ino || written.nlink !== 1 ||
            current.nlink !== 1 || (written.mode & 0o777) !== 0o600 || (current.mode & 0o777) !== 0o600) {
          throw new Error(`${binding.label} destination changed while credential bytes were installed`);
        }
      } catch (error) {
        if (binding.runtime_handle) {
          try { wipeCredentialBinding(binding); } catch { /* retain original error */ }
        } else {
          try { fs.closeSync(descriptor); } catch { /* retain original error */ }
        }
        try {
          validateCredentialParent(binding);
          const current = fs.lstatSync(binding.destination);
          const handle = binding.runtime_handle;
          if (!current.isSymbolicLink() && current.isFile() && handle &&
              current.dev === handle.device && current.ino === handle.inode) fs.unlinkSync(binding.destination);
        } catch { /* never follow or unlink an unvalidated replacement */ }
        throw error;
      }
      activeCredentialDestinations.add(binding.destination);
      activeCredentialHandles.set(binding.destination, binding);
      installedDestinations.push(binding.destination);
      if (binding.sensitive) candidates.push(...collectCredentialCandidates(bytes));
      records.push({
        label: binding.label,
        source_sha256: sha256(bytes),
        bytes: bytes.length,
        destination_mode: (fs.fstatSync(descriptor).mode & 0o777).toString(8).padStart(4, '0')
      });
    }
  } catch (error) {
    // Descriptor-based wiping remains safe even if a same-user adversary
    // substitutes an ancestor after installation. Path cleanup is attempted
    // only after cleanupCredentialBindings revalidates the contained parent.
    try { cleanupCredentialBindings(bindings.filter(item => installedDestinations.includes(item.destination))); }
    catch { /* retain original installation error */ }
    throw error;
  }
  return { candidates: [...new Set(candidates)], records };
}

function wipeCredentialBinding(binding) {
  const handle = binding.runtime_handle;
  if (!handle) return { overwritten_bytes: 0, handle_present: false };
  if (handle.wiped && handle.closed) return { overwritten_bytes: handle.original_bytes, handle_present: true };
  let overwritten = 0;
  try {
    const stat = fs.fstatSync(handle.descriptor);
    const length = Math.max(stat.size, handle.original_bytes);
    const zeros = Buffer.alloc(Math.min(Math.max(length, 1), 64 * 1024));
    while (overwritten < length) {
      const chunk = Math.min(zeros.length, length - overwritten);
      fs.writeSync(handle.descriptor, zeros, 0, chunk, overwritten);
      overwritten += chunk;
    }
    fs.ftruncateSync(handle.descriptor, 0);
    fs.fsyncSync(handle.descriptor);
    handle.wiped = true;
  } finally {
    if (!handle.closed) {
      fs.closeSync(handle.descriptor);
      handle.closed = true;
    }
  }
  return { overwritten_bytes: overwritten, handle_present: true };
}

function validateCredentialParent(binding) {
  const parent = path.dirname(binding.destination);
  validateBoundContainedDirectory(
    binding.runtime_root,
    parent,
    `${binding.label} credential parent`,
    true
  );
  return parent;
}

function bindCredentialRoot(binding) {
  const root = path.resolve(binding.destination_root);
  if (binding.runtime_root) {
    validateBoundContainedDirectory(binding.runtime_root, root, `${binding.label} case root`, true);
    return binding.runtime_root;
  }
  const lexical = fs.lstatSync(root);
  if (lexical.isSymbolicLink() || !lexical.isDirectory() || (lexical.mode & 0o777) !== 0o700) {
    throw new Error(`${binding.label} case root must be a non-symlink mode-0700 directory`);
  }
  const realpath = fs.realpathSync(root);
  const resolved = fs.statSync(realpath);
  if (!resolved.isDirectory() || lexical.dev !== resolved.dev || lexical.ino !== resolved.ino) {
    throw new Error(`${binding.label} case root identity is inconsistent`);
  }
  binding.runtime_root = Object.freeze({
    path: root,
    realpath,
    device: lexical.dev,
    inode: lexical.ino
  });
  return binding.runtime_root;
}

function validateBoundContainedDirectory(rootIdentity, directory, label, requirePrivate = false) {
  if (!rootIdentity) throw new Error(`${label} has no pre-launch case-root identity`);
  const root = path.resolve(rootIdentity.path);
  const candidate = path.resolve(directory);
  if (!isContained(root, candidate)) throw new Error(`${label} escapes its bound case root`);
  const rootNow = fs.lstatSync(root);
  if (rootNow.isSymbolicLink() || !rootNow.isDirectory() ||
      rootNow.dev !== rootIdentity.device || rootNow.ino !== rootIdentity.inode ||
      fs.realpathSync(root) !== rootIdentity.realpath || (rootNow.mode & 0o777) !== 0o700) {
    throw new Error(`${label} case-root identity changed after credential installation`);
  }
  const relative = path.relative(root, candidate);
  let current = root;
  for (const component of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`${label} contains a non-directory or symlink ancestor: ${current}`);
    }
    if (requirePrivate && (stat.mode & 0o777) !== 0o700) {
      throw new Error(`${label} ancestor is not mode 0700: ${current}`);
    }
    const currentReal = fs.realpathSync(current);
    if (!isContained(rootIdentity.realpath, currentReal)) {
      throw new Error(`${label} ancestor resolves outside its bound case root: ${current}`);
    }
  }
  return candidate;
}

const POST_RUN_READ_GUARD = Symbol('post-run-read-guard');

function establishPostRunReadBoundary(processResult) {
  if (processResult?.process_group?.quiesced !== true || activeProcessGroups.size !== 0) {
    throw new Error('post-run evidence reads require a quiescent owned process group');
  }
  return POST_RUN_READ_GUARD;
}

function requirePostRunReadGuard(guard) {
  if (guard !== POST_RUN_READ_GUARD) {
    throw new Error('post-run evidence read attempted without a quiescence guard');
  }
}

function readBoundContainedFile(rootIdentity, file, label, options = {}) {
  const maximumBytes = options.maximum_bytes ?? MAX_CAPTURE_BYTES;
  const expectedMode = options.expected_mode ?? null;
  validateBoundContainedDirectory(rootIdentity, path.dirname(file), `${label} parent`, options.private_ancestors === true);
  let descriptor;
  try {
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  } catch (error) {
    throw new Error(`${label} cannot be opened safely after client exit: ${error.message}`);
  }
  try {
    const opened = fs.fstatSync(descriptor);
    // Opening by path can follow a substituted ancestor even when O_NOFOLLOW
    // protects the final component. Revalidate the private contained parent
    // after the open and bind the descriptor back to the current path before
    // reading any bytes.
    validateBoundContainedDirectory(
      rootIdentity,
      path.dirname(file),
      `${label} parent`,
      options.private_ancestors === true
    );
    const linked = lstatIfPresent(file);
    validateBoundContainedDirectory(
      rootIdentity,
      path.dirname(file),
      `${label} parent`,
      options.private_ancestors === true
    );
    if (!linked || linked.isSymbolicLink() || !linked.isFile() || !opened.isFile() ||
        opened.dev !== linked.dev || opened.ino !== linked.ino) {
      throw new Error(`${label} changed identity before post-run scanning`);
    }
    if (opened.nlink !== 1 || linked.nlink !== 1) {
      throw new Error(`${label} is multiply linked after client exit`);
    }
    if (expectedMode !== null &&
        ((opened.mode & 0o777) !== expectedMode || (linked.mode & 0o777) !== expectedMode)) {
      throw new Error(`${label} is not mode ${expectedMode.toString(8).padStart(4, '0')} after client exit`);
    }
    if (opened.size > maximumBytes) {
      throw new Error(`${label} exceeds scan ceiling (${opened.size} > ${maximumBytes})`);
    }
    const bytes = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count === 0) throw new Error(`${label} ended during post-run scanning`);
      offset += count;
    }
    const finalOpened = fs.fstatSync(descriptor);
    validateBoundContainedDirectory(
      rootIdentity,
      path.dirname(file),
      `${label} parent`,
      options.private_ancestors === true
    );
    const finalLinked = lstatIfPresent(file);
    validateBoundContainedDirectory(
      rootIdentity,
      path.dirname(file),
      `${label} parent`,
      options.private_ancestors === true
    );
    if (!finalLinked || finalLinked.isSymbolicLink() || !finalLinked.isFile() ||
        finalOpened.dev !== finalLinked.dev || finalOpened.ino !== finalLinked.ino ||
        finalOpened.dev !== opened.dev || finalOpened.ino !== opened.ino ||
        finalOpened.size !== opened.size || finalOpened.nlink !== 1 || finalLinked.nlink !== 1 ||
        (expectedMode !== null && ((finalOpened.mode & 0o777) !== expectedMode ||
          (finalLinked.mode & 0o777) !== expectedMode))) {
      throw new Error(`${label} changed during post-run scanning`);
    }
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

function readCredentialBindingForRedaction(binding, guard) {
  requirePostRunReadGuard(guard);
  return readBoundContainedFile(binding.runtime_root, binding.destination, binding.label, {
    maximum_bytes: MAX_CAPTURE_BYTES,
    expected_mode: 0o600,
    private_ancestors: true
  });
}

function cleanupCredentialBindings(bindings) {
  if (activeProcessGroups.size > 0) {
    return {
      results: bindings.map(binding => ({
        label: binding.label,
        file: path.basename(binding.destination),
        removed: false,
        blocked: true,
        error: `credential cleanup blocked while ${activeProcessGroups.size} owned process group(s) remain live`
      })),
      valid: false
    };
  }
  const results = [];
  for (const binding of bindings) {
    let wipe;
    try { wipe = wipeCredentialBinding(binding); }
    catch (error) {
      results.push({ label: binding.label, file: path.basename(binding.destination), removed: false,
        error: `credential descriptor wipe failed: ${error.message}` });
      continue;
    }
    let parent;
    try { parent = validateCredentialParent(binding); }
    catch (error) {
      results.push({ label: binding.label, file: path.basename(binding.destination), removed: false,
        ...wipe, error: error.message });
      continue;
    }
    const base = path.basename(binding.destination);
    const candidates = fs.existsSync(parent) ? fs.readdirSync(parent)
      .filter(name => name === base || name.startsWith(`${base}.`) || name.startsWith(`.${base}.tmp-`))
      .map(name => path.join(parent, name)) : [];
    if (candidates.length === 0) candidates.push(binding.destination);
    let bindingPathRemoved = false;
    for (const file of candidates) {
      try {
        const removed = secureRemove(file, {
          root: binding.destination_root,
          root_identity: binding.runtime_root,
          label: binding.label,
          expected: file === binding.destination ? {
            device: binding.runtime_handle?.device,
            inode: binding.runtime_handle?.inode
          } : null
        });
        results.push({ label: binding.label, file: path.basename(file), ...wipe, ...removed });
        if (removed.removed) {
          activeCredentialDestinations.delete(file);
          activeCredentialHandles.delete(file);
          if (file === binding.destination) bindingPathRemoved = true;
        }
      } catch (error) {
        results.push({ label: binding.label, file: path.basename(file), removed: false, error: error.message });
      }
    }
    if (bindingPathRemoved) {
      activeCredentialDestinations.delete(binding.destination);
      activeCredentialHandles.delete(binding.destination);
    }
  }
  return { results, valid: results.every(result => result.removed === true && !result.unsafe_type) };
}

const activeProcessGroups = new Set();
const activeCredentialDestinations = new Set();
const activeCredentialHandles = new Map();

function noteOwnedProcessGroup(pid) {
  if (pid) activeProcessGroups.add(pid);
}

function finalizeOwnedProcessGroup(pid, processGroup) {
  if (pid && processGroup?.quiesced === true) activeProcessGroups.delete(pid);
  return activeProcessGroups.size;
}

function activeProcessGroupCount() {
  return activeProcessGroups.size;
}

function processGroupAlive(pid) {
  if (!pid || process.platform === 'win32') return false;
  try { process.kill(-pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
}

function signalProcessGroup(pid, signal, child = null) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') child?.kill(signal);
    else process.kill(-pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function quiesceProcessGroup(pid, child, timedOut) {
  if (process.platform === 'win32' || !pid) {
    return { owned: process.platform !== 'win32', quiesced: true, term_sent: timedOut, kill_sent: false };
  }
  for (let attempt = 0; attempt < 10 && processGroupAlive(pid); attempt += 1) await delay(100);
  let termSent = timedOut;
  let killSent = false;
  if (processGroupAlive(pid)) {
    signalProcessGroup(pid, 'SIGTERM', child);
    termSent = true;
    for (let attempt = 0; attempt < 20 && processGroupAlive(pid); attempt += 1) await delay(100);
  }
  if (processGroupAlive(pid)) {
    signalProcessGroup(pid, 'SIGKILL', child);
    killSent = true;
    for (let attempt = 0; attempt < 20 && processGroupAlive(pid); attempt += 1) await delay(100);
  }
  return { owned: true, quiesced: !processGroupAlive(pid), term_sent: termSent, kill_sent: killSent };
}

function installExecutionSignalHandlers(emergencyCleanup) {
  const state = { signal: null, count: 0 };
  const handlers = new Map();
  let forceTimer = null;
  let cleanupTask = null;
  const waitThenCleanup = async () => {
    for (const pid of [...activeProcessGroups]) {
      const processGroup = await quiesceProcessGroup(pid, null, true);
      finalizeOwnedProcessGroup(pid, processGroup);
    }
    if (activeProcessGroups.size === 0) emergencyCleanup();
  };
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const handler = () => {
      state.signal ||= signal;
      state.count += 1;
      for (const pid of activeProcessGroups) {
        try { signalProcessGroup(pid, state.count > 1 ? 'SIGKILL' : 'SIGTERM'); } catch { /* best effort */ }
      }
      cleanupTask ||= waitThenCleanup().catch(() => { /* campaign finally records incomplete cleanup */ });
      if (state.count === 1) {
        forceTimer ||= setTimeout(() => {
          for (const pid of activeProcessGroups) {
            try { signalProcessGroup(pid, 'SIGKILL'); } catch { /* best effort */ }
          }
        }, 10000);
        forceTimer.unref();
      }
    };
    handlers.set(signal, handler);
    process.on(signal, handler);
  }
  return {
    state,
    get cleanupTask() { return cleanupTask; },
    remove() {
      if (forceTimer) clearTimeout(forceTimer);
      for (const [signal, handler] of handlers) process.removeListener(signal, handler);
    }
  };
}

async function spawnCaptured({
  executable, argv, cwd, env, stdin = null, timeoutMs = DEFAULT_CASE_TIMEOUT_MS, onSpawn = null
}) {
  const started = Date.now();
  return new Promise(resolve => {
    const child = spawn(executable, argv, {
      cwd,
      env,
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const pid = child.pid || null;
    noteOwnedProcessGroup(pid);
    if (pid && onSpawn) onSpawn(pid);
    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let overflow = false;
    let settled = false;
    let timedOut = false;
    let killTimer = null;
    const capture = (chunks, kind) => chunk => {
      const bytes = kind === 'stdout' ? stdoutBytes += chunk.length : stderrBytes += chunk.length;
      if (bytes > MAX_CAPTURE_BYTES) {
        overflow = true;
        signalProcessGroup(pid, 'SIGTERM', child);
        return;
      }
      chunks.push(Buffer.from(chunk));
    };
    child.stdout.on('data', capture(stdoutChunks, 'stdout'));
    child.stderr.on('data', capture(stderrChunks, 'stderr'));
    if (stdin) child.stdin.end(stdin);
    else child.stdin.end();
    const timer = setTimeout(() => {
      timedOut = true;
      signalProcessGroup(pid, 'SIGTERM', child);
      killTimer = setTimeout(() => signalProcessGroup(pid, 'SIGKILL', child), 5000);
      killTimer.unref();
    }, timeoutMs);
    child.on('error', async error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      const processGroup = await quiesceProcessGroup(pid, child, timedOut);
      finalizeOwnedProcessGroup(pid, processGroup);
      resolve({
        pid, exit_code: null, signal: null, error: error.message, timed_out: timedOut, capture_overflow: overflow,
        latency_ms: Date.now() - started, process_group: processGroup,
        stdout: Buffer.concat(stdoutChunks), stderr: Buffer.concat(stderrChunks)
      });
    });
    child.on('close', async (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      const processGroup = await quiesceProcessGroup(pid, child, timedOut);
      finalizeOwnedProcessGroup(pid, processGroup);
      resolve({
        pid, exit_code: code, signal, error: null, timed_out: timedOut, capture_overflow: overflow,
        latency_ms: Date.now() - started, process_group: processGroup,
        stdout: Buffer.concat(stdoutChunks), stderr: Buffer.concat(stderrChunks)
      });
    });
  });
}

function collectClioReceipts(paths, rootIdentity) {
  const receiptsRoot = path.join(paths.CLIO_CODER_STATE_DIR, 'receipts');
  if (!fs.existsSync(receiptsRoot)) return [];
  return walkRegularFiles(receiptsRoot)
    .filter(entry => entry.absolute.endsWith('.json'))
    .map(entry => {
      const bytes = readBoundContainedFile(rootIdentity, entry.absolute, 'Clio receipt', {
        maximum_bytes: MAX_CAPTURE_BYTES
      });
      const raw = JSON.parse(bytes.toString('utf8'));
      return {
        file: entry.absolute,
        sha256: sha256(bytes),
        raw,
        id: raw.id || raw.runId || path.basename(entry.absolute, '.json'),
        session_id: raw.sessionId || null,
        target: raw.targetId || null,
        model: raw.wireModelId || null,
        client_version: raw.clioVersion || null,
        cost_usd: Number.isFinite(raw.costUsd) ? raw.costUsd : null,
        cost_provenance: raw.costProvenance || 'unknown',
        outcome: raw.outcome || null,
        exit_code: Number.isInteger(raw.exitCode) ? raw.exitCode : null,
        skill_activations: raw.skillActivations || [],
        tool_stats: raw.toolStats || [],
        runtime: raw.runtimeResolution || null,
        integrity: raw.integrity || null
      };
    });
}

function clioReceiptEnvelope(paths, receipt, rootIdentity) {
  const file = path.join(paths.CLIO_CODER_DATA_DIR, 'evidence', `run-${receipt.id}`, 'trace.raw.jsonl');
  if (!lstatIfPresent(file)) return null;
  const bytes = readBoundContainedFile(rootIdentity, file, 'Clio receipt envelope', {
    maximum_bytes: MAX_CAPTURE_BYTES
  });
  const events = parseJsonLines(bytes);
  const ledger = events.find(event => event.kind === 'run-ledger' && event.runId === receipt.id);
  return ledger?.envelope ? { file, envelope: ledger.envelope } : null;
}

async function loadClioReceiptVerifier(clioSource) {
  const dist = path.join(clioSource, 'dist');
  const stat = fs.lstatSync(dist);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Clio dist root changed type');
  for (const name of fs.readdirSync(dist).filter(item => /^chunk-[A-Z0-9]+\.js$/u.test(item)).sort()) {
    const file = path.join(dist, name);
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes('function verifyReceiptIntegrity(')) continue;
    return { file, sha256: sha256(fs.readFileSync(file)) };
  }
  throw new Error('matching Clio build does not expose receipt integrity verification');
}

const CLIO_RECEIPT_VERIFIER_SCRIPT = [
  'import fs from "node:fs";',
  'const input = JSON.parse(fs.readFileSync(0, "utf8"));',
  'const module = await import(process.argv[1]);',
  'if (typeof module.verifyReceiptIntegrity !== "function") throw new Error("verifier export missing");',
  'process.stdout.write(JSON.stringify(module.verifyReceiptIntegrity(input.receipt, input.envelope)));'
].join('\n');

function clioReceiptSemanticErrors(receipt) {
  const errors = [];
  if (receipt.outcome !== 'succeeded') errors.push(`Clio receipt outcome is ${receipt.outcome || 'missing'}`);
  if (receipt.exit_code !== 0) errors.push(`Clio receipt exit code is ${receipt.exit_code}`);
  if (receipt.integrity?.algorithm !== 'sha256' || !/^[a-f0-9]{64}$/u.test(receipt.integrity?.digest || '')) {
    errors.push('Clio receipt integrity seal is missing or malformed');
  }
  return errors;
}

async function verifyClioReceipt(paths, clioSource, guard, rootIdentity) {
  requirePostRunReadGuard(guard);
  validateBoundContainedDirectory(rootIdentity, paths.CLIO_CODER_STATE_DIR, 'Clio state root', true);
  validateBoundContainedDirectory(rootIdentity, paths.CLIO_CODER_DATA_DIR, 'Clio data root', true);
  const receiptsRoot = path.join(paths.CLIO_CODER_STATE_DIR, 'receipts');
  if (fs.existsSync(receiptsRoot)) {
    validateBoundContainedDirectory(rootIdentity, receiptsRoot, 'Clio receipt root');
  }
  const receipts = collectClioReceipts(paths, rootIdentity);
  if (receipts.length !== 1) {
    return { valid: false, receipt: receipts[0] || null, errors: [`expected one Clio receipt, observed ${receipts.length}`] };
  }
  const receipt = receipts[0];
  const errors = clioReceiptSemanticErrors(receipt);
  const envelopeParent = path.join(paths.CLIO_CODER_DATA_DIR, 'evidence', `run-${receipt.id}`);
  if (fs.existsSync(envelopeParent)) {
    validateBoundContainedDirectory(rootIdentity, envelopeParent, 'Clio receipt envelope root');
  }
  const envelope = clioReceiptEnvelope(paths, receipt, rootIdentity);
  if (!envelope) errors.push('Clio run-ledger envelope is missing');
  let verifierRecord = null;
  if (errors.length === 0) {
    const verifier = await loadClioReceiptVerifier(clioSource);
    const isolatedVerifierEnv = sanitizedEnvironment({
      HOME: paths.HOME,
      TMPDIR: paths.TMPDIR,
      XDG_CONFIG_HOME: paths.XDG_CONFIG_HOME,
      XDG_DATA_HOME: paths.XDG_DATA_HOME,
      XDG_STATE_HOME: paths.XDG_STATE_HOME,
      XDG_CACHE_HOME: paths.XDG_CACHE_HOME
    });
    const invocation = commandResult(process.execPath, [
      '--input-type=module', '-e', CLIO_RECEIPT_VERIFIER_SCRIPT, pathToFileURL(verifier.file).href
    ], {
      cwd: paths.HOME,
      env: isolatedVerifierEnv,
      input: Buffer.from(JSON.stringify({ receipt: receipt.raw, envelope: envelope.envelope }), 'utf8')
    });
    let result = null;
    if (invocation.exit_code === 0) {
      try { result = JSON.parse(invocation.stdout.toString('utf8')); }
      catch { /* recorded below as invalid */ }
    }
    verifierRecord = {
      module: path.relative(clioSource, verifier.file).split(path.sep).join('/'),
      sha256: verifier.sha256,
      runner_sha256: sha256(Buffer.from(CLIO_RECEIPT_VERIFIER_SCRIPT)),
      isolated_process: true,
      exit_code: invocation.exit_code,
      stderr_sha256: sha256(invocation.stderr),
      valid: invocation.exit_code === 0 && result?.ok === true,
      reason: invocation.exit_code === 0 && result?.ok === true ? null :
        result?.reason || `isolated verifier exited ${invocation.exit_code}`
    };
    if (!verifierRecord.valid) errors.push(`Clio receipt integrity failed: ${verifierRecord.reason}`);
  }
  return {
    valid: errors.length === 0,
    receipt,
    errors,
    verifier: verifierRecord,
    ledger: envelope ? path.relative(paths.CLIO_CODER_HOME, envelope.file).split(path.sep).join('/') : null
  };
}

function walkValues(value, visitor) {
  visitor(value);
  if (Array.isArray(value)) for (const item of value) walkValues(item, visitor);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) walkValues(item, visitor);
}

function textValues(value) {
  const values = [];
  walkValues(value, item => { if (typeof item === 'string') values.push(item); });
  return values;
}

function normalizeSkill(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/(?:wtf-p:)?(wtfp-(?:deliver-research|manage-project|plan-section|research-literature|review-manuscript|start-project|write-section))/u);
  return match ? match[1] : null;
}

function expectedRoute(definition) {
  return definition?.expected?.route || definition?.expected || { kind: 'none' };
}

function nativeAssistantTexts(events) {
  const values = [];
  for (const event of events) {
    const role = event.message?.role || event.role ||
      (event.type === 'item.completed' && event.item?.type === 'agent_message' ? 'assistant' : null);
    if (role !== 'assistant') continue;
    if (typeof event.text === 'string') values.push(event.text);
    if (typeof event.item?.text === 'string') values.push(event.item.text);
    if (event.message) values.push(...textValues(event.message));
  }
  return values;
}

function nativeUserTexts(events) {
  const values = [];
  for (const event of events) {
    const role = event.message?.role || event.role;
    if (role === 'user' && event.message) values.push(...textValues(event.message));
  }
  return values;
}

function clioExpandedResourcePath(value) {
  const normalized = value.split(path.sep).join('/');
  for (const prefix of ['skills/', 'actions/', 'workflows/', 'project/schemas/', 'project/templates/']) {
    const marker = `/${prefix}`;
    const index = normalized.lastIndexOf(marker);
    if (index !== -1) return `protocol/${normalized.slice(index + 1)}`;
    if (normalized.startsWith(prefix)) return `protocol/${normalized}`;
  }
  return null;
}

function resourceKind(resourcePath) {
  if (/^protocol\/skills\/[^/]+\/SKILL\.md$/u.test(resourcePath)) return 'skill';
  if (/^protocol\/skills\/[^/]+\/references\/actions\.md$/u.test(resourcePath)) return 'action-reference';
  if (resourcePath.startsWith('protocol/actions/')) return 'action-contract';
  if (resourcePath.startsWith('protocol/workflows/')) return 'workflow';
  if (resourcePath.startsWith('protocol/project/schemas/')) return 'schema';
  if (resourcePath.startsWith('protocol/project/templates/')) return 'template';
  return null;
}

function receiptCost(receipt, fallbackSource) {
  const provenance = receipt?.cost_provenance || receipt?.costProvenance || 'unknown';
  const amount = receipt?.cost_usd ?? receipt?.costUsd ?? receipt?.cost?.usd ?? null;
  if (['known', 'known_free'].includes(provenance) && Number.isFinite(amount)) {
    return { status: 'metered', amount, currency: 'USD', source: `${fallbackSource}; provenance=${provenance}` };
  }
  if (provenance === 'estimated' && Number.isFinite(amount)) {
    return { status: 'estimated', amount, currency: 'USD', source: `${fallbackSource}; provenance=estimated` };
  }
  return { status: 'unavailable', amount: null, currency: null, source: `${fallbackSource}; provenance=${provenance}` };
}

function classifyNativeActivity(value, observation) {
  walkValues(value, item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const type = String(item.type || item.event || item.kind || '').toLowerCase();
    const name = String(item.name || item.tool || item.tool_name || '').toLowerCase();
    const combined = `${type}\0${name}`;
    if (/(?:bash|shell|terminal|command_execution|command-execution)/u.test(combined)) observation.shell_used = true;
    if (/(?:web_search|web-search|webfetch|web_fetch|fetch|network)/u.test(combined)) observation.network_used = true;
    if (/(?:file_change|file-change|write|edit|patch|delete|move|rename)/u.test(combined)) {
      observation.mutation_used = true;
    }
  });
}

function observeNativeTrace(client, events, receipt = null, definition = null) {
  const routeExpected = expectedRoute(definition);
  const scorer = require('./score-routing');
  const expectedResources = definition && routeExpected.kind !== 'none' ? scorer.canonicalResources(definition) : [];
  const expectedCapabilities = definition && routeExpected.kind !== 'none' ? scorer.canonicalCapabilities(definition) : [];
  const observation = {
    client,
    selector: {
      status: definition?.explicit ? (definition.input_supported === false ? 'unsupported' :
        'unobservable') : 'not-applicable',
      basis: definition?.explicit
        ? ['native selector resolution requires a typed client event']
        : ['ambient routing input']
    },
    route: { signal: 'unobservable', granularity: 'unobservable', value: null, basis: [] },
    activation: {
      status: routeExpected.kind === 'skill' ? 'unobservable' : 'not-applicable', skill: null, basis: []
    },
    arguments: { status: definition?.explicit ? 'unobservable' : 'not-applicable', value: null },
    disclosure: {
      status: 'unobservable',
      resources: expectedResources.map(item => ({ ...item, status: 'unobservable' })),
      capabilities: expectedCapabilities.map(id => ({ id, status: 'unobservable' }))
    },
    session_id: null,
    cost: { status: 'unavailable', amount: null, currency: null, source: `${client} native surface has no priced receipt` },
    actual: { client_version: null, model_id: null, effort: null },
    shell_used: false,
    network_used: false,
    mutation_used: false,
    model_self_reports_ignored: 0
  };
  const assistantTexts = nativeAssistantTexts(events);
  const userTexts = nativeUserTexts(events);
  let claudeSkill = null;
  for (const event of events) {
    classifyNativeActivity(event, observation);
    const type = String(event.type || event.event || event.kind || '').toLowerCase();
    if (type === 'session' || type === 'thread.started' || type === 'system') {
      observation.session_id ||= event.id || event.session_id || event.sessionId || event.thread_id || null;
      observation.actual.client_version ||= event.clioVersion || event.version || null;
      observation.actual.model_id ||= event.model || event.target_model || null;
    }
    if (client === 'claude') {
      walkValues(event, item => {
        if (!item || typeof item !== 'object') return;
        const blockType = String(item.type || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();
        if (blockType === 'tool_use' && name === 'skill') {
          claudeSkill ||= normalizeSkill(item.input?.skill || item.input?.name || item.input?.command || '');
        }
      });
    }
    if (client === 'claude' && type === 'result') {
      observation.session_id ||= event.session_id || null;
      const cost = event.total_cost_usd ?? event.cost_usd;
      if (Number.isFinite(cost)) {
        observation.cost = { status: 'metered', amount: cost, currency: 'USD', source: 'Claude Code result event cost_usd' };
      }
    }
  }

  if (client === 'claude') {
    if (claudeSkill) {
      if (!definition?.explicit) {
        observation.route = {
          signal: 'selected', granularity: 'skill', value: { kind: 'skill', skill: claudeSkill, action: null },
          basis: ['typed Claude Skill tool_use event']
        };
      }
      observation.activation = { status: 'loaded', skill: claudeSkill, basis: ['typed Claude Skill tool_use event'] };
      observation.disclosure.status = 'partially-observed';
      observation.disclosure.resources = observation.disclosure.resources.map(item => ({
        ...item,
        status: item.kind === 'skill' && item.path.includes(`/${claudeSkill}/`) ? 'loaded' : 'unobservable'
      }));
    } else if (!definition?.explicit) {
      observation.route = { signal: 'none', granularity: 'none', value: { kind: 'none' }, basis: ['no typed Skill use'] };
      if (routeExpected.kind === 'skill') {
        observation.activation = { status: 'not-loaded', skill: null, basis: ['no typed Skill tool_use event'] };
      }
    }
  } else if (client === 'codex') {
    observation.cost = {
      status: 'unavailable', amount: null, currency: null,
      source: 'Codex ChatGPT-auth JSONL exposes token usage without independently priced USD cost'
    };
    if (!definition?.explicit) {
      observation.route = { signal: 'unobservable', granularity: 'unobservable', value: null,
        basis: ['Codex JSONL has no documented typed implicit routing event'] };
    }
  } else if (client === 'clio') {
    const rawReceipt = receipt?.raw || receipt;
    const activations = rawReceipt?.skillActivations || receipt?.skill_activations || [];
    const skills = activations.map(item => normalizeSkill(item.name || item.skill || item.path || item)).filter(Boolean);
    observation.session_id ||= rawReceipt?.sessionId || receipt?.session_id || null;
    observation.actual.client_version ||= rawReceipt?.clioVersion || receipt?.client_version || null;
    observation.actual.model_id ||= rawReceipt?.wireModelId || receipt?.model || null;
    observation.actual.effort ||= rawReceipt?.runtimeResolution?.effectiveThinkingLevel || receipt?.runtime?.effectiveThinkingLevel || null;
    observation.cost = receiptCost(receipt, 'Clio sealed run receipt costProvenance');

    if (!definition?.explicit) {
      const suggestions = assistantTexts.flatMap(text => [...text.matchAll(/^Suggested skill:\s*\/skill\s+([^,\s\n]+)/gmu)]
        .map(match => normalizeSkill(match[1])).filter(Boolean));
      if (suggestions.length > 0) {
        observation.route = {
          signal: 'suggested', granularity: 'skill',
          value: { kind: 'skill', skill: suggestions[0], action: null },
          basis: ['Clio routing-policy Suggested skill line in native assistant event']
        };
      } else {
        observation.route = { signal: 'none', granularity: 'none', value: { kind: 'none' },
          basis: ['no Clio routing-policy suggestion line'] };
      }
      observation.activation = skills.length === 0
        ? { status: 'not-loaded', skill: null, basis: ['sealed Clio receipt skillActivations is empty'] }
        : { status: 'loaded', skill: skills[0], basis: ['sealed Clio receipt skillActivations'] };
    }

    const expanded = userTexts.find(value => value.includes('<invocation_arguments>')) || null;
    if (expanded && definition?.explicit) {
      const exactBlocks = [
        `<invocation_arguments>\n${definition.arguments}\n</invocation_arguments>`,
        `<invocation_arguments>${definition.arguments}</invocation_arguments>`
      ];
      const exactBlock = exactBlocks.find(block => expanded.includes(block)) || null;
      const resourceEnvelope = exactBlock ? expanded.replace(exactBlock, '<invocation_arguments>[removed]</invocation_arguments>') : '';
      if (exactBlock) {
        observation.selector = { status: 'accepted', basis: ['exact Clio native expansion event'] };
        observation.route = {
          signal: 'selected', granularity: 'action', value: { ...routeExpected },
          basis: ['exact Clio /wtfp action expansion event']
        };
        observation.arguments = { status: 'observed', value: definition.arguments };
      }
      const observedPaths = new Set([...resourceEnvelope.matchAll(/<file name="([^"]+)">/gu)]
        .map(resourceMatch => clioExpandedResourcePath(resourceMatch[1])).filter(Boolean));
      if (resourceEnvelope.includes(`Generated by WTF-P adapter compiler v4 from protocol/actions/${routeExpected.action}`)) {
        observedPaths.add(`protocol/workflows/${routeExpected.action}.md`);
      }
      const actionContractLoaded = observedPaths.has(`protocol/actions/${routeExpected.action}.json`);
      observation.disclosure.resources = expectedResources.map(item => ({
        ...item,
        status: observedPaths.has(item.path) ? 'loaded' : 'unobservable'
      }));
      observation.disclosure.capabilities = expectedCapabilities.map(id => ({
        id,
        status: actionContractLoaded ? 'available' : 'unobservable'
      }));
      const allDisclosureObserved = observation.disclosure.resources.every(item => item.status === 'loaded') &&
        observation.disclosure.capabilities.every(item => item.status === 'available');
      const anyDisclosureObserved = observation.disclosure.resources.some(item => item.status === 'loaded') ||
        observation.disclosure.capabilities.some(item => item.status === 'available');
      observation.disclosure.status = allDisclosureObserved ? 'observed' :
        anyDisclosureObserved ? 'partially-observed' : 'unobservable';
      const skillResource = observation.disclosure.resources.find(item => item.kind === 'skill' && item.status === 'loaded');
      if (routeExpected.kind === 'skill') {
        observation.activation = skillResource
          ? { status: 'loaded', skill: routeExpected.skill, basis: ['expanded native user event contains bound skill resource'] }
          : skills.length > 0
            ? { status: 'loaded', skill: skills[0], basis: ['sealed Clio receipt skillActivations'] }
            : { status: 'unobservable', skill: null, basis: ['no typed skill-load evidence'] };
      }
    }
  }
  for (const text of assistantTexts) {
    if (/\b(?:I\s+)?(?:selected|used|activated)\b[^\n]*\bskill\b/iu.test(text)) {
      observation.model_self_reports_ignored += 1;
    }
  }
  return observation;
}

function assertScorableObservation(observation, definition, profilePairs, projectBefore, projectAfter, row = null) {
  const errors = [];
  const expected = expectedRoute(definition);
  if (!observation.session_id) errors.push('native session receipt is missing');
  if (observation.shell_used) errors.push('model shell use was observed');
  if (observation.network_used) errors.push('model network-tool use was observed');
  if (observation.mutation_used) errors.push('model mutation-tool use was observed');
  if (projectBefore !== projectAfter) errors.push('project changed');
  if (!profilePairs.every(pair => pair.unchanged)) errors.push('normal profile changed');
  if (definition.explicit && observation.selector.status === 'rejected') errors.push('native selector was rejected');
  if (row?.cost_policy.status === 'metered' &&
      (observation.cost.status !== 'metered' || !Number.isFinite(observation.cost.amount))) {
    errors.push('metered cost receipt is missing');
  }
  if (observation.route.value?.kind === 'skill' && expected.kind === 'skill' &&
      observation.route.value.skill !== expected.skill) errors.push('native skill differs');
  if (errors.length > 0) throw new Error(`routing observation is not scorable: ${errors.join('; ')}`);
}

function assertPaidExecutionSupported(prepared, beforeCredentialRead = null) {
  const blockers = (prepared.rows || []).flatMap(row => (row.surface?.blockers || [])
    .map(reason => `${row.id}: ${reason}`));
  if (prepared.native_preflight_valid !== true) blockers.push('top-level native preflight is not valid');
  if (prepared.paid_execution_ready !== true) blockers.push('top-level capability gate is not ready');
  if (!(prepared.normal_profile_hashes || []).every(pair => pair.unchanged === true)) {
    blockers.push('top-level normal-profile gate is not valid');
  }
  for (const item of prepared.cases || []) {
    if (item.native_preflight_valid !== true) blockers.push(`${item.case_id}: native preflight is not valid`);
    if (item.project_unchanged !== true) blockers.push(`${item.case_id}: project changed during preparation`);
    if (item.paid_execution_ready !== true) blockers.push(`${item.case_id}: capability gate is not ready`);
    if ((item.blockers || []).length > 0) blockers.push(...item.blockers.map(reason => `${item.case_id}: ${reason}`));
    if (!(item.normal_profile_hashes || []).every(pair => pair.unchanged === true)) {
      blockers.push(`${item.case_id}: normal profile changed during preparation`);
    }
  }
  if (blockers.length > 0) {
    throw new Error(`paid execution refused before credential access:\n${blockers.map(item => `- ${item}`).join('\n')}`);
  }
  if (beforeCredentialRead) beforeCredentialRead();
}

function cleanupPathParent(file, options = {}) {
  const parent = path.dirname(file);
  if (!options.root) return parent;
  if (!isContained(options.root, file)) throw new Error(`${options.label || 'credential'} cleanup path escapes its root`);
  if (options.root_identity) {
    validateBoundContainedDirectory(
      options.root_identity,
      parent,
      `${options.label || 'credential'} cleanup parent`,
      true
    );
    return parent;
  }
  assertPrivateDirectory(parent, `${options.label || 'credential'} cleanup parent`);
  const rootReal = fs.realpathSync(options.root);
  const parentReal = fs.realpathSync(parent);
  if (!isContained(rootReal, parentReal)) {
    throw new Error(`${options.label || 'credential'} cleanup parent escapes its root`);
  }
  return parent;
}

function lstatIfPresent(file) {
  try { return fs.lstatSync(file); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function unlinkCleanupName(file, options, unsafeType, existed = true) {
  cleanupPathParent(file, options);
  const current = lstatIfPresent(file);
  if (current) fs.unlinkSync(file);
  return {
    removed: lstatIfPresent(file) === null,
    existed,
    overwritten_bytes: 0,
    unsafe_type: unsafeType
  };
}

function secureRemove(file, options = {}) {
  cleanupPathParent(file, options);
  const initial = lstatIfPresent(file);
  if (!initial) {
    return options.expected
      ? { removed: true, existed: false, overwritten_bytes: 0, unsafe_type: 'missing-original' }
      : { removed: true, existed: false, overwritten_bytes: 0 };
  }
  if (initial.isSymbolicLink()) return unlinkCleanupName(file, options, 'symlink');
  if (!initial.isFile()) return unlinkCleanupName(file, options, 'special-file');

  let descriptor;
  try {
    descriptor = fs.openSync(file, fs.constants.O_RDWR | (fs.constants.O_NOFOLLOW || 0));
  } catch (error) {
    const raced = lstatIfPresent(file);
    if (raced?.isSymbolicLink()) return unlinkCleanupName(file, options, 'symlink');
    throw error;
  }
  let opened;
  let linked;
  let rotatedInode = false;
  try {
    opened = fs.fstatSync(descriptor);
    cleanupPathParent(file, options);
    linked = lstatIfPresent(file);
    const samePathInode = linked?.isFile() && !linked.isSymbolicLink() &&
      opened.dev === linked.dev && opened.ino === linked.ino;
    const expectedInode = !options.expected ||
      (opened.dev === options.expected.device && opened.ino === options.expected.inode);
    const expectedMode = options.expected_mode ?? (options.expected ? 0o600 : null);
    const modeSafe = expectedMode === null ||
      ((opened.mode & 0o777) === expectedMode && (linked?.mode & 0o777) === expectedMode);
    let unsafeType = null;
    if (!samePathInode) unsafeType = 'substituted-inode';
    else if (opened.nlink !== 1 || linked.nlink !== 1) unsafeType = 'multiply-linked';
    else if (!modeSafe) unsafeType = 'unsafe-mode';
    if (unsafeType) {
      fs.closeSync(descriptor);
      descriptor = null;
      return unlinkCleanupName(file, options, unsafeType);
    }
    rotatedInode = !expectedInode;

    const zeros = Buffer.alloc(Math.min(Math.max(opened.size, 1), 64 * 1024));
    let offset = 0;
    while (offset < opened.size) {
      const length = Math.min(zeros.length, opened.size - offset);
      fs.writeSync(descriptor, zeros, 0, length, offset);
      offset += length;
    }
    fs.ftruncateSync(descriptor, 0);
    fs.fsyncSync(descriptor);
  } finally {
    if (descriptor !== null && descriptor !== undefined) fs.closeSync(descriptor);
  }

  cleanupPathParent(file, options);
  const current = lstatIfPresent(file);
  if (!current || current.dev !== opened.dev || current.ino !== opened.ino) {
    return current
      ? unlinkCleanupName(file, options, 'substituted-after-wipe')
      : { removed: true, existed: true, overwritten_bytes: opened.size, unsafe_type: 'missing-after-wipe' };
  }
  fs.unlinkSync(file);
  return {
    removed: lstatIfPresent(file) === null,
    existed: true,
    overwritten_bytes: opened.size,
    inode_disposition: rotatedInode ? 'rotated-inode' : 'owned-inode'
  };
}

function reconstructCaseLayout(item, client, clioSource) {
  const evidence = path.join(item.case_root, 'evidence');
  const project = path.join(item.case_root, 'project');
  return {
    root: item.case_root,
    project,
    evidence,
    input_file: path.join(evidence, 'native-input.txt'),
    native_input_file: path.join(evidence, 'native-input.txt'),
    semantic_input_file: path.join(evidence, 'semantic-input.txt'),
    input_sha256: item.native_input_sha256,
    input_bytes: item.native_input_bytes,
    native_input_sha256: item.native_input_sha256,
    native_input_bytes: item.native_input_bytes,
    semantic_input_sha256: item.semantic_input_sha256,
    semantic_input_bytes: item.semantic_input_bytes,
    paths: isolatedPaths(item.case_root, client, clioSource)
  };
}

function commandManifestMatches(invocation, commandManifest) {
  return invocation.executable === commandManifest.command.executable &&
    invocation.executable_sha256 === commandManifest.command.executable_sha256 &&
    invocation.argv_sha256 === commandManifest.command.argv_sha256 &&
    invocation.stdin_sha256 === commandManifest.command.stdin_sha256;
}

function receiptForbiddenTools(receipt) {
  if (!receipt) return [];
  return [...new Set((receipt.tool_stats || []).map(item => String(item.tool || ''))
    .filter(name => /(?:bash|shell|terminal|web|fetch|network|write|edit|patch|delete|move)/iu.test(name)))].sort();
}

function evidenceClaim(root, file, summary) {
  const absoluteRoot = path.resolve(root);
  const absoluteFile = path.resolve(file);
  if (!isContained(absoluteRoot, absoluteFile)) throw new Error('evidence claim escapes its row root');
  const stat = fs.lstatSync(absoluteFile);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('evidence claim is not a regular file');
  return {
    locator: path.relative(absoluteRoot, absoluteFile).split(path.sep).join('/'),
    sha256: sha256(fs.readFileSync(absoluteFile)),
    assessor: { kind: 'independent-tool', name: 'wtfp-routing-runner', version: '1' },
    summary
  };
}

function schemaObservation(raw, definition, item, projectAfter, evidence) {
  return {
    case_id: definition.id,
    session_id: raw.session_id,
    input_sha256: item.native_input_sha256,
    project_snapshot_sha256: projectAfter,
    selector: { status: raw.selector.status, evidence },
    route: {
      signal: raw.route.signal,
      granularity: raw.route.granularity,
      value: raw.route.value,
      evidence
    },
    activation: { status: raw.activation.status, skill: raw.activation.skill, evidence },
    disclosure: {
      status: raw.disclosure.status,
      resources: raw.disclosure.resources.map(resource => ({ ...resource, evidence })),
      capabilities: raw.disclosure.capabilities.map(capability => ({ ...capability, evidence })),
      evidence
    },
    arguments: { status: raw.arguments.status, value: raw.arguments.value, evidence },
    cost: { ...raw.cost, evidence },
    latency_ms: raw.latency_ms,
    evidence
  };
}

function costAggregate(observations) {
  const pricedCases = observations.filter(observation => observation.cost.status !== 'unavailable');
  const unpricedCases = observations.filter(observation => observation.cost.status === 'unavailable');
  if (observations.length === 0 || unpricedCases.length > 0) {
    return {
      status: 'unavailable', amount: null, currency: null,
      source: 'At least one native case lacks independently priced USD provenance',
      priced_cases: pricedCases.length,
      unpriced_cases: unpricedCases.length
    };
  }
  const status = observations.some(observation => observation.cost.status === 'estimated') ? 'estimated' : 'metered';
  return {
    status,
    amount: observations.reduce((sum, observation) => sum + observation.cost.amount, 0),
    currency: 'USD',
    source: status === 'metered' ? 'sum of native metered case receipts' : 'sum including estimated native case receipts',
    priced_cases: pricedCases.length,
    unpriced_cases: 0
  };
}

function actualIdentityErrors(client, raw, row, receiptAudit) {
  const errors = [];
  if (client === 'clio') {
    const receipt = receiptAudit?.receipt;
    if (receipt?.client_version !== row.client.version) errors.push(`Clio version ${receipt?.client_version} != ${row.client.version}`);
    if (receipt?.model !== row.model.id) errors.push(`Clio model ${receipt?.model} != ${row.model.id}`);
    if (receipt?.target !== 'openai-codex') errors.push(`Clio target ${receipt?.target} != openai-codex`);
    if (!raw.session_id || receipt?.session_id !== raw.session_id) {
      errors.push(`Clio event/receipt session mismatch ${raw.session_id}/${receipt?.session_id}`);
    }
    const requested = receipt?.runtime?.requestedThinkingLevel;
    const effective = receipt?.runtime?.effectiveThinkingLevel;
    if (requested !== row.effort || effective !== row.effort) {
      errors.push(`Clio requested/effective effort ${requested}/${effective} != ${row.effort}`);
    }
  } else if (client === 'claude' && raw.actual.model_id &&
      !String(raw.actual.model_id).startsWith(row.model.id)) {
    errors.push(`Claude model ${raw.actual.model_id} does not match ${row.model.id}`);
  } else if (client === 'codex' && raw.actual.model_id && raw.actual.model_id !== row.model.id) {
    errors.push(`Codex model ${raw.actual.model_id} != ${row.model.id}`);
  }
  return errors;
}

function assertExecutionConfirmation(environment = process.env) {
  if (environment[EXECUTION_CONFIRMATION_ENV] !== EXECUTION_CONFIRMATION) {
    throw new Error(
      `paid execution requires exact operator acknowledgement ${EXECUTION_CONFIRMATION_ENV}=${EXECUTION_CONFIRMATION}`
    );
  }
}

function cleanupActiveCredentials() {
  const bindings = [...new Set(activeCredentialHandles.values())];
  if (bindings.length === 0) return [];
  return cleanupCredentialBindings(bindings).results;
}

function runMetadata({
  suite, clients, row, profilePairs, isolationEvidence, startedAt, items, sessionIdsUnique, actualIdentity = null
}) {
  const binary = clients.binaries[row.adapter_target];
  const commandSha = sha256(canonicalBytes(items.map(item => ({
    case_id: item.case_id,
    command_sha256: item.command_sha256,
    native_input_sha256: item.native_input_sha256
  }))));
  return {
    id: `routing-${row.id}-${crypto.randomUUID()}`,
    started_at: startedAt,
    evidence_level: 'paid-model',
    client: {
      name: row.client.name,
      requested_version: row.client.version,
      actual_version: actualIdentity?.client_version || row.client.version,
      binary: { path: binary.path, sha256: binary.sha256 }
    },
    model: {
      provider: row.adapter_target === 'claude' ? 'anthropic' : 'openai',
      requested_id: row.model.id,
      actual_id: actualIdentity?.model_id || 'unavailable',
      requested_version: row.model.version,
      actual_version: actualIdentity?.model_version || 'unavailable'
    },
    effort: row.effort,
    permission_policy: row.permission_policy,
    protocol: {
      project_protocol_version: suite.manifest.project_protocol_version,
      adapter_compiler_version: suite.manifest.adapter_compiler_version,
      wtfp_commit: suite.manifest.wtfp_commit,
      client_commit: row.client.commit,
      source_sha256: suite.envelopes[row.id].source_sha256
    },
    fixture: {
      id: suite.manifest.fixture.id,
      version: suite.manifest.fixture.version,
      model_inputs_sha256: suite.manifest.fixture.model_inputs_sha256,
      evaluator_oracles_sha256: suite.manifest.fixture.evaluator_oracles_sha256,
      aggregate_sha256: suite.manifest.fixture.aggregate_sha256
    },
    execution: {
      target: row.adapter_target,
      command_sha256: commandSha,
      environment_policy: row.environment_policy
    },
    profile_hashes: profilePairs,
    case_isolation: {
      strategy: 'fresh-process-per-case',
      session_ids_unique: sessionIdsUnique,
      conversational_memory_shared: false,
      evidence: isolationEvidence
    },
    matrix_binding: {
      matrix_id: suite.matrix.id,
      matrix_version: suite.matrix.version,
      row_id: row.id,
      sha256: suite.matrix_sha256
    }
  };
}

function observationDocument({ suite, row, run, observations, costEvidence }) {
  return {
    schema: 'wtfp.evaluation.routing-observations/v1',
    suite: {
      id: suite.manifest.id,
      version: suite.manifest.version,
      manifest_sha256: suite.manifest_sha256,
      target: row.adapter_target,
      selector_profile: row.selector_profile
    },
    run,
    observations,
    cost: { ...costAggregate(observations), evidence: costEvidence },
    latency_ms: observations.reduce((sum, observation) => sum + observation.latency_ms, 0)
  };
}

function resolveActualIdentity(row, caseResults) {
  const clientVersion = row.client.version;
  if (row.adapter_target === 'clio') {
    const exact = caseResults.length > 0 && caseResults.every(result =>
      result.record.receipt?.model === row.model.id &&
      result.record.receipt?.client_version === row.client.version &&
      result.record.receipt?.runtime?.effectiveThinkingLevel === row.effort);
    return {
      client_version: clientVersion,
      model_id: exact ? row.model.id : 'unavailable',
      model_version: 'unavailable',
      basis: exact
        ? 'sealed Clio receipts expose the exact wire model id and effective effort, but no independent model-version field'
        : 'Clio identity receipt unavailable'
    };
  }
  if (row.adapter_target === 'claude') {
    const modelIds = caseResults.map(result => result.record.observation.actual.model_id);
    const exact = modelIds.length > 0 && modelIds.every(id => id === row.model.id);
    return {
      client_version: clientVersion,
      model_id: exact ? row.model.id : 'unavailable',
      model_version: 'unavailable',
      basis: exact
        ? 'typed Claude native events expose the exact requested model id, but no independent model-version field'
        : 'Claude native events do not expose the matrix model id at the same identity granularity'
    };
  }
  return {
    client_version: clientVersion,
    model_id: 'unavailable',
    model_version: 'unavailable',
    basis: 'Codex JSONL does not expose independently typed backend model identity'
  };
}

async function executeCase({ options, suite, clients, environment, row, item, profileList, onClientSpawn = null }) {
  const client = row.adapter_target;
  const definition = suite.target_catalogs[client].get(item.case_id);
  const layout = reconstructCaseLayout(item, client, clients.clioSource?.package_root || null);
  assertIsolatedLayout(layout);
  const childEnv = {
    ...sanitizedEnvironment(layout.paths, environment),
    CI: '1',
    NO_COLOR: '1'
  };
  if (client === 'claude') {
    childEnv.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';
    childEnv.CLAUDE_CODE_SKIP_UPDATE_CHECK = '1';
  }
  const invocation = clientInvocation(client, clients.binaries[client], row, layout, definition);
  const commandManifest = readJson(path.join(layout.evidence, 'command.json'));
  if (!commandManifestMatches(invocation, commandManifest)) {
    throw new Error(`${row.id}/${definition.id} runtime command differs from sealed preparation`);
  }
  const bindings = credentialBindings(client, layout.paths, environment, layout.root);
  const profilesBefore = snapshotProfiles(profileList);
  const projectBefore = hashTree(layout.project);
  const installed = installCredentialBindings(bindings);
  const attemptFile = path.join(layout.evidence, 'model-attempt.json');
  let candidates = [...installed.candidates];
  let processResult = null;
  let events = [];
  let parseError = null;
  let receiptAudit = null;
  let stdout = Buffer.alloc(0);
  let stderr = Buffer.alloc(0);
  let cleanup = { valid: false, results: [] };
  let artifactLeaks = [];
  try {
    writeJsonPrivate(attemptFile, {
      schema: 'wtfp.evaluation.routing-model-attempt/v1',
      row_id: row.id,
      case_id: definition.id,
      armed_at: new Date().toISOString(),
      executable_sha256: invocation.executable_sha256,
      argv_sha256: invocation.argv_sha256,
      stdin_sha256: invocation.stdin_sha256
    }, true);
    processResult = await spawnCaptured({
      executable: invocation.executable,
      argv: invocation.argv,
      cwd: invocation.cwd,
      env: childEnv,
      stdin: invocation.stdin,
      timeoutMs: options.timeoutMs,
      onSpawn: pid => { if (onClientSpawn) onClientSpawn({ pid, attemptFile }); }
    });
    const postRunReadGuard = establishPostRunReadBoundary(processResult);
    for (const binding of bindings.filter(itemBinding => itemBinding.sensitive)) {
      const refreshed = readCredentialBindingForRedaction(binding, postRunReadGuard);
      candidates.push(...collectCredentialCandidates(refreshed));
    }
    candidates = [...new Set(candidates)].sort((left, right) => right.length - left.length);
    const redactedStdout = redactCredentialValues(processResult.stdout, candidates);
    const redactedStderr = redactCredentialValues(processResult.stderr, candidates);
    stdout = redactedStdout.buffer;
    stderr = redactedStderr.buffer;
    processResult.credential_output_replacements = {
      stdout: redactedStdout.replacements,
      stderr: redactedStderr.replacements
    };
    writePrivate(path.join(layout.evidence, 'model.stdout.jsonl'), stdout, true);
    writePrivate(path.join(layout.evidence, 'model.stderr'), stderr, true);
    try { events = parseJsonLines(stdout); }
    catch (error) { parseError = error.message; }
    if (client === 'clio') {
      try {
        receiptAudit = await verifyClioReceipt(
          layout.paths,
          clients.clioSource.package_root,
          postRunReadGuard,
          bindings[0]?.runtime_root
        );
      }
      catch (error) {
        receiptAudit = {
          valid: false,
          receipt: null,
          errors: [`Clio receipt verification threw: ${error.message}`]
        };
      }
    }
  } finally {
    cleanup = cleanupCredentialBindings(bindings);
    try { artifactLeaks = scanAndRedactCredentialValues(layout.root, [], candidates); }
    catch (error) { artifactLeaks = [{ path: null, replacements: null, error: error.message }]; }
  }

  const projectAfter = hashTree(layout.project);
  const profilesAfter = snapshotProfiles(profileList);
  const profilePairs = compareProfiles(profilesBefore, profilesAfter);
  const receipt = receiptAudit?.receipt || null;
  // Only Clio exposes a stable native expansion event; its parser upgrades
  // selector and action routing from unobservable after an exact envelope
  // match. Process success is not selector-resolution evidence.
  const raw = observeNativeTrace(client, events, receipt, definition);
  raw.latency_ms = processResult?.latency_ms || 0;
  const forbiddenReceiptTools = receiptForbiddenTools(receipt);
  if (forbiddenReceiptTools.some(name => /bash|shell|terminal/u.test(name))) raw.shell_used = true;
  if (forbiddenReceiptTools.some(name => /web|fetch|network/u.test(name))) raw.network_used = true;
  if (forbiddenReceiptTools.some(name => /write|edit|patch|delete|move/u.test(name))) raw.mutation_used = true;
  const errors = [];
  if (!processResult || processResult.exit_code !== 0) errors.push(`client exited ${processResult?.exit_code}`);
  if (processResult?.timed_out) errors.push('client timed out');
  if (processResult?.capture_overflow) errors.push('client output exceeded capture ceiling');
  if (processResult?.process_group?.quiesced !== true) errors.push('client process group did not quiesce');
  if (parseError) errors.push(parseError);
  if (client === 'clio' && receiptAudit?.valid !== true) errors.push(...(receiptAudit?.errors || ['Clio receipt invalid']));
  if (client === 'clio' && receipt && receipt.exit_code !== processResult?.exit_code) {
    errors.push(`Clio receipt/process exit mismatch ${receipt.exit_code}/${processResult?.exit_code}`);
  }
  errors.push(...actualIdentityErrors(client, raw, row, receiptAudit));
  if (!cleanup.valid) errors.push('credential/config cleanup failed');
  if ((processResult?.credential_output_replacements?.stdout || 0) > 0 ||
      (processResult?.credential_output_replacements?.stderr || 0) > 0 || artifactLeaks.length > 0) {
    errors.push('credential value appeared in disposable output/state and was redacted');
  }
  try { assertScorableObservation(raw, definition, profilePairs, projectBefore, projectAfter, row); }
  catch (error) { errors.push(error.message); }

  const record = {
    schema: 'wtfp.evaluation.routing-case-execution/v1',
    row_id: row.id,
    case_id: definition.id,
    started_from_session_nonce: item.session_nonce,
    semantic_input_sha256: item.semantic_input_sha256,
    native_input_sha256: item.native_input_sha256,
    runtime_command: {
      executable_sha256: invocation.executable_sha256,
      argv_sha256: invocation.argv_sha256,
      stdin_sha256: invocation.stdin_sha256,
      control_instructions_sha256: invocation.routing_control_instructions_sha256
    },
    attempt: { file: 'model-attempt.json', sha256: sha256(fs.readFileSync(attemptFile)) },
    process: processResult ? {
      pid: processResult.pid,
      exit_code: processResult.exit_code,
      signal: processResult.signal,
      error: processResult.error,
      timed_out: processResult.timed_out,
      capture_overflow: processResult.capture_overflow,
      latency_ms: processResult.latency_ms,
      process_group: processResult.process_group,
      stdout: { file: 'model.stdout.jsonl', sha256: sha256(stdout), bytes: stdout.length },
      stderr: { file: 'model.stderr', sha256: sha256(stderr), bytes: stderr.length },
      credential_output_replacements: processResult.credential_output_replacements
    } : null,
    credential_transport: installed.records,
    credential_cleanup: cleanup,
    credential_artifact_findings: artifactLeaks,
    event_count: events.length,
    parse_error: parseError,
    receipt: receipt ? {
      id: receipt.id,
      sha256: receipt.sha256,
      session_id: receipt.session_id,
      target: receipt.target,
      model: receipt.model,
      client_version: receipt.client_version,
      cost_usd: receipt.cost_usd,
      cost_provenance: receipt.cost_provenance,
      outcome: receipt.outcome,
      exit_code: receipt.exit_code,
      skill_activations: receipt.skill_activations,
      tool_stats: receipt.tool_stats,
      runtime: receipt.runtime,
      integrity: receipt.integrity,
      verification: receiptAudit ? { valid: receiptAudit.valid, errors: receiptAudit.errors, verifier: receiptAudit.verifier,
        ledger: receiptAudit.ledger } : null
    } : null,
    observation: raw,
    project_before_sha256: projectBefore,
    project_after_sha256: projectAfter,
    normal_profile_hashes: profilePairs,
    forbidden_receipt_tools: forbiddenReceiptTools,
    valid: errors.length === 0,
    errors
  };
  const recordFile = path.join(layout.evidence, 'case-execution.json');
  writeJsonPrivate(recordFile, record, true);
  const rowRoot = path.join(options.root, 'rows', row.id);
  const claim = evidenceClaim(rowRoot, recordFile,
    `Independent native event, receipt, isolation, and safety audit for ${definition.id}`);
  return {
    record,
    observation: raw.session_id ? schemaObservation(raw, definition, item, projectAfter, claim) : null,
    record_file: recordFile,
    profile_pairs: profilePairs
  };
}

async function execute(options, suite, clients, environment = process.env) {
  const prepared = verifyPrepared(options, suite, clients, environment);
  assertPaidExecutionSupported(prepared);
  assertExecutionConfirmation(environment);

  const executionMarker = path.join(options.root, 'evidence', 'execution-started.json');
  const startedAt = new Date().toISOString();
  writeJsonPrivate(executionMarker, {
    schema: 'wtfp.evaluation.routing-execution-marker/v1',
    started_at: startedAt,
    pid: process.pid,
    prepared_sha256: sha256(fs.readFileSync(path.join(options.root, 'evidence', PREPARED_FILE))),
    acknowledgement: EXECUTION_CONFIRMATION
  }, true);

  // Credential-source paths and contents are deliberately touched only after
  // the sealed preparation, capability gate, acknowledgement, and one-shot
  // marker have all succeeded.
  const profileList = profileSpecs(environment, os.homedir(), true);
  const profilesBefore = snapshotProfiles(profileList);
  const campaign = {
    schema: 'wtfp.evaluation.routing-execution/v1',
    started_at: startedAt,
    completed_at: null,
    root: options.root,
    paid_model_calls: 0,
    client_spawn_attempts: 0,
    rows: [],
    normal_profile_hashes: [],
    credential_cleanup_complete: false,
    valid: false,
    errors: []
  };
  const scorer = require('./score-routing');
  const signalGuard = installExecutionSignalHandlers(cleanupActiveCredentials);

  try {
    for (const row of suite.rows) {
      if (signalGuard.state.signal) throw new Error(`execution interrupted by ${signalGuard.state.signal}`);
      const rowRoot = path.join(options.root, 'rows', row.id);
      const rowStartedAt = new Date().toISOString();
      const rowItems = row.case_ids.map(caseId => {
        const item = prepared.cases.find(candidate => candidate.row_id === row.id && candidate.case_id === caseId);
        if (!item) throw new Error(`${row.id}/${caseId} is missing from sealed preparation`);
        return item;
      });
      if (rowItems.length > row.maximum_paid_cases) {
        throw new Error(`${row.id} exceeds paid case ceiling before execution`);
      }
      const rowProfilesBefore = snapshotProfiles(profileList);
      const caseResults = [];
      const rowErrors = [];
      let knownCost = 0;
      let rowSpawnAttempts = 0;
      for (const item of rowItems) {
        if (signalGuard.state.signal) {
          rowErrors.push(`execution interrupted by ${signalGuard.state.signal}`);
          break;
        }
        if (caseResults.length >= row.maximum_paid_cases) {
          rowErrors.push(`paid case ceiling reached before ${item.case_id}`);
          break;
        }
        if (Number.isFinite(row.cost_policy.maximum_usd) && knownCost >= row.cost_policy.maximum_usd) {
          rowErrors.push(`USD cost ceiling reached before ${item.case_id}`);
          break;
        }
        let result;
        try {
          result = await executeCase({
            options,
            suite,
            clients,
            environment,
            row,
            item,
            profileList,
            onClientSpawn: () => {
              campaign.paid_model_calls += 1;
              campaign.client_spawn_attempts += 1;
              rowSpawnAttempts += 1;
            }
          });
        } catch (error) {
          rowErrors.push(`${item.case_id}: ${error.message}`);
          break;
        }
        caseResults.push(result);
        if (result.observation?.cost.status !== 'unavailable') knownCost += result.observation.cost.amount;
        if (Number.isFinite(row.cost_policy.maximum_usd) && knownCost > row.cost_policy.maximum_usd + 1e-9) {
          rowErrors.push(`USD cost ceiling exceeded: ${knownCost} > ${row.cost_policy.maximum_usd}`);
        }
        if (!result.record.valid) rowErrors.push(`${item.case_id}: ${result.record.errors.join('; ')}`);
        if (rowErrors.length > 0) break;
      }
      const rowProfilesAfter = snapshotProfiles(profileList);
      const profilePairs = compareProfiles(rowProfilesBefore, rowProfilesAfter);
      if (!profilePairs.every(pair => pair.unchanged)) rowErrors.push('normal profile changed during row');
      const observations = caseResults.map(result => result.observation).filter(Boolean);
      if (observations.length !== rowItems.length) {
        rowErrors.push(`row incomplete: ${observations.length}/${rowItems.length} scorable observations`);
      }
      const sessions = observations.map(observation => observation.session_id);
      const sessionIdsUnique = sessions.every(Boolean) && new Set(sessions).size === sessions.length;
      if (!sessionIdsUnique) rowErrors.push('native session ids are missing or reused');
      const actualIdentity = resolveActualIdentity(row, caseResults);
      const rowAudit = {
        schema: 'wtfp.evaluation.routing-row-audit/v1',
        row_id: row.id,
        started_at: rowStartedAt,
        completed_at: new Date().toISOString(),
        expected_cases: rowItems.length,
        executed_cases: caseResults.length,
        client_spawn_attempts: rowSpawnAttempts,
        maximum_paid_cases: row.maximum_paid_cases,
        known_cost_usd: knownCost,
        cost_ceiling_usd: row.cost_policy.maximum_usd,
        actual_identity: actualIdentity,
        session_ids_unique: sessionIdsUnique,
        normal_profile_hashes: profilePairs,
        cases: caseResults.map(result => ({
          case_id: result.record.case_id,
          valid: result.record.valid,
          session_id: result.record.observation.session_id,
          record: path.relative(rowRoot, result.record_file).split(path.sep).join('/'),
          record_sha256: sha256(fs.readFileSync(result.record_file))
        })),
        pre_score_valid: rowErrors.length === 0,
        errors: rowErrors
      };
      const auditFile = path.join(rowRoot, 'execution-audit.json');
      writeJsonPrivate(auditFile, rowAudit, true);
      const auditEvidence = evidenceClaim(rowRoot, auditFile,
        `Independent row-level case isolation, profile, budget, and cleanup audit for ${row.id}`);
      let observationsFile = null;
      let scoreFile = null;
      let score = null;
      if (rowErrors.length === 0) {
        const run = runMetadata({
          suite,
          clients,
          row,
          profilePairs,
          isolationEvidence: auditEvidence,
          startedAt: rowStartedAt,
          items: rowItems,
          sessionIdsUnique,
          actualIdentity
        });
        const document = observationDocument({
          suite,
          row,
          run,
          observations,
          costEvidence: auditEvidence
        });
        observationsFile = path.join(rowRoot, 'routing-observations.json');
        writeJsonPrivate(observationsFile, document, true);
        try {
          score = scorer.scoreObservations(document, { matrixRow: row.id, evidenceRoot: rowRoot });
          scoreFile = path.join(rowRoot, 'routing-score.json');
          writeJsonPrivate(scoreFile, score, true);
          if (score.disposition === 'fail') rowErrors.push('routing score disposition is fail');
        } catch (error) {
          rowErrors.push(`routing score failed: ${error.message}`);
        }
      }
      campaign.rows.push({
        id: row.id,
        executed_cases: caseResults.length,
        client_spawn_attempts: rowSpawnAttempts,
        expected_cases: rowItems.length,
        known_cost_usd: knownCost,
        audit: { file: path.relative(options.root, auditFile), sha256: sha256(fs.readFileSync(auditFile)) },
        observations: observationsFile ? {
          file: path.relative(options.root, observationsFile), sha256: sha256(fs.readFileSync(observationsFile))
        } : null,
        score: scoreFile ? {
          file: path.relative(options.root, scoreFile), sha256: sha256(fs.readFileSync(scoreFile)),
          disposition: score.disposition
        } : null,
        valid: rowErrors.length === 0,
        errors: rowErrors
      });
      if (rowErrors.length > 0) {
        campaign.errors.push(`${row.id}: ${rowErrors.join('; ')}`);
        break;
      }
    }
  } catch (error) {
    campaign.errors.push(error.message);
  } finally {
    if (signalGuard.cleanupTask) await signalGuard.cleanupTask;
    const emergencyCleanup = cleanupActiveCredentials();
    if (emergencyCleanup.some(result => result.removed !== true || result.unsafe_type)) {
      campaign.errors.push('emergency credential cleanup was incomplete or anomalous');
    }
    signalGuard.remove();
    const profilesAfter = snapshotProfiles(profileList);
    campaign.normal_profile_hashes = compareProfiles(profilesBefore, profilesAfter);
    if (!campaign.normal_profile_hashes.every(pair => pair.unchanged)) {
      campaign.errors.push('normal profile changed during campaign');
    }
    campaign.credential_cleanup_complete = activeCredentialDestinations.size === 0;
    if (!campaign.credential_cleanup_complete) campaign.errors.push('credential destination remains active');
    campaign.completed_at = new Date().toISOString();
    campaign.valid = campaign.errors.length === 0 && campaign.rows.length === suite.rows.length &&
      campaign.rows.every(row => row.valid);
    const summaryFile = path.join(options.root, 'evidence', 'execution-summary.json');
    writeJsonPrivate(summaryFile, campaign, true);
    writePrivate(`${summaryFile}.sha256`, `${sha256(fs.readFileSync(summaryFile))}\n`, true);
  }
  if (!campaign.valid) {
    throw new Error(`paid routing execution failed closed; retained evidence at ${options.root}: ${campaign.errors.join('; ')}`);
  }
  return campaign;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const suite = loadSuite(options.rows);
  const clients = inspectClients(options, suite);
  if (options.mode === 'dry-run') {
    process.stdout.write(`${JSON.stringify(buildDryPlan(options, suite, clients), null, 2)}\n`);
    return;
  }
  if (options.mode === 'prepare') {
    const result = prepare(options, suite, clients);
    process.stdout.write(`${JSON.stringify({
      mode: 'prepare',
      root: result.root,
      paid_model_calls: 0,
      credentials_read: false,
      native_preflight_valid: result.prepared.native_preflight_valid,
      paid_execution_ready: result.prepared.paid_execution_ready,
      blockers: result.prepared.rows.map(row => ({ row_id: row.id, blockers: row.surface.blockers }))
    }, null, 2)}\n`);
    return;
  }
  const result = await execute(options, suite, clients);
  process.stdout.write(`${JSON.stringify({
    mode: 'execute',
    root: options.root,
    paid_model_calls: result.paid_model_calls,
    rows: result.rows.map(row => ({ id: row.id, disposition: row.score?.disposition || null, valid: row.valid })),
    normal_profiles_unchanged: result.normal_profile_hashes.every(pair => pair.unchanged),
    credential_cleanup_complete: result.credential_cleanup_complete,
    valid: result.valid
  }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`routing-matrix: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  CAPABILITY_SURFACES,
  CLIENT_SURFACES,
  EXECUTION_CONFIRMATION,
  EXECUTION_CONFIRMATION_ENV,
  EXPECTED_SKILLS,
  KNOWN_DEFAULTS,
  PRIMARY_ROWS,
  assertExecutionContract,
  assertCanonicalCommitAncestor,
  assertRepositoryIdentity,
  assertPaidExecutionSupported,
  assertExecutionConfirmation,
  assertIsolatedLayout,
  assertScorableObservation,
  buildDryPlan,
  canonical,
  clientInvocation,
  compareProfiles,
  costAggregate,
  credentialBindings,
  cleanupCredentialBindings,
  clioReceiptSemanticErrors,
  collectCredentialCandidates,
  createCaseLayout,
  createRoot,
  definitionCatalog,
  execute,
  executeCase,
  executionContractDigests,
  establishPostRunReadBoundary,
  hashTree,
  gitMetadata,
  isolatedPaths,
  installCredentialBindings,
  loadSuite,
  observeNativeTrace,
  observationDocument,
  parseArgs,
  parseJsonLines,
  prepare,
  profileDigest,
  profileSpecs,
  readCredentialBindingForRedaction,
  redactCredentialValues,
  resolveActualIdentity,
  repositoryIdentity,
  scanAndRedactCredentialValues,
  inspectClients,
  runNativePreflight,
  sanitizedEnvironment,
  secureRemove,
  sha256,
  snapshotProfiles,
  surfaceAssessment,
  materializeNativeInput,
  activeProcessGroupCount,
  finalizeOwnedProcessGroup,
  noteOwnedProcessGroup,
  runMetadata,
  schemaObservation,
  spawnCaptured,
  verifyPrepared,
  verifyGeneratedEnvelope,
  verifyCanonicalSourceProjection,
  verifyClioReceipt,
  verifySealedJson
};
