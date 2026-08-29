#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  CAPABILITY_SURFACES,
  EXECUTION_CONFIRMATION,
  EXECUTION_CONFIRMATION_ENV,
  PRIMARY_ROWS,
  activeProcessGroupCount,
  assertExecutionContract,
  assertExecutionConfirmation,
  assertPaidExecutionSupported,
  assertRepositoryIdentity,
  assertScorableObservation,
  buildDryPlan,
  cleanupCredentialBindings,
  clioReceiptSemanticErrors,
  clientInvocation,
  collectCredentialCandidates,
  compareProfiles,
  costAggregate,
  createCaseLayout,
  createRoot,
  definitionCatalog,
  establishPostRunReadBoundary,
  executionContractDigests,
  finalizeOwnedProcessGroup,
  gitMetadata,
  hashTree,
  installCredentialBindings,
  isolatedPaths,
  loadSuite,
  noteOwnedProcessGroup,
  observeNativeTrace,
  observationDocument,
  parseArgs,
  parseJsonLines,
  profileDigest,
  profileSpecs,
  readCredentialBindingForRedaction,
  redactCredentialValues,
  resolveActualIdentity,
  repositoryIdentity,
  runMetadata,
  sanitizedEnvironment,
  scanAndRedactCredentialValues,
  secureRemove,
  sha256,
  snapshotProfiles,
  spawnCaptured,
  surfaceAssessment,
  verifyClioReceipt,
  verifyCanonicalSourceProjection,
  verifySealedJson
} = require('../evaluation/tools/run-routing-matrix');

const repositoryRoot = path.resolve(__dirname, '..');
let passed = 0;

async function test(name, callback) {
  try {
    await callback();
    passed += 1;
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n${error.stack}\n`);
    process.exitCode = 1;
  }
}

function temporaryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-routing-test.'));
  fs.chmodSync(root, 0o700);
  return root;
}

function quiescedReadGuard() {
  return establishPostRunReadBoundary({ process_group: { quiesced: true } });
}

function fakeBinary(root, name = 'client') {
  const file = path.join(root, name);
  fs.writeFileSync(file, '#!/bin/sh\nexit 91\n', { mode: 0o700 });
  return { path: file, requested_path: file, bytes: fs.statSync(file).size, sha256: sha256(fs.readFileSync(file)) };
}

function rowByClient(suite, client) {
  return suite.rows.find(row => row.adapter_target === client);
}

const fixtureInventoryBindings = [
  ['antigravity', 'vendors/antigravity/.wtfp-generated.json'],
  ['claude', 'vendors/claude/.wtfp-generated.json'],
  ['clio', 'vendors/clio/.wtfp-generated.json'],
  ['codex-marketplace', 'vendors/codex/.wtfp-generated.json'],
  ['codex', 'vendors/codex/plugins/wtf-p/.wtfp-generated.json'],
  ['copilot-marketplace', 'vendors/copilot/.wtfp-generated.json'],
  ['copilot', 'vendors/copilot/plugins/wtf-p/.wtfp-generated.json'],
  ['gemini', 'vendors/gemini/.wtfp-generated.json'],
  ['opencode', 'vendors/opencode/.wtfp-generated.json']
];

function fixtureGit(root, argv) {
  const result = spawnSync('git', ['-C', root, ...argv], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr || `git ${argv.join(' ')} failed`);
  return result.stdout.trim();
}

function writeFixtureFile(root, relative, content, mode = 0o644) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { mode });
  fs.chmodSync(file, mode);
}

function canonicalProjectionFixture() {
  const root = temporaryRoot();
  fixtureGit(root, ['init', '--quiet', '--initial-branch=main']);
  fixtureGit(root, ['config', 'user.name', 'Routing Test']);
  fixtureGit(root, ['config', 'user.email', 'routing-test@example.invalid']);
  writeFixtureFile(root, 'CONTRIBUTING.md', 'canonical contribution rules\n');
  writeFixtureFile(root, 'package.json', '{"version":"0.6.0-rc.1","scripts":{"test":"base"}}\n');
  writeFixtureFile(root, 'scripts/build-adapters.js', 'require("../bin/lib/adapter-compiler");\n', 0o755);
  writeFixtureFile(root, 'bin/lib/adapter-compiler.js', 'module.exports = { compiler: 4 };\n');
  writeFixtureFile(root, 'bin/lib/adapter-metadata.js', 'module.exports = { GENERATOR_VERSION: 4 };\n');
  writeFixtureFile(root, 'bin/lib/fixture-tool.js', 'module.exports = { tool: true };\n');
  writeFixtureFile(root, 'protocol/tools.json', JSON.stringify({
    schema: 'wtfp.tools/v1',
    tools: [{ id: 'fixture.tool', legacyName: 'fixture-tool', implementation: 'wtfp://tools/fixture/tool' }]
  }, null, 2) + '\n');
  writeFixtureFile(root, 'protocol/catalog.json', '{"actions":[]}\n');
  const generatedEnvelopes = [];
  for (const [target, inventoryPath] of fixtureInventoryBindings) {
    const entryPath = 'payload.txt';
    const payload = Buffer.from(`${target} payload\n`, 'utf8');
    const sourceHash = sha256(Buffer.from(`source:${target}`, 'utf8'));
    writeFixtureFile(root, path.posix.join(path.posix.dirname(inventoryPath), entryPath), payload);
    const inventoryBytes = Buffer.from(JSON.stringify({
      generatorVersion: 4,
      sourceHash,
      files: [{ path: entryPath, sha256: sha256(payload) }]
    }, null, 2) + '\n', 'utf8');
    writeFixtureFile(root, inventoryPath, inventoryBytes);
    generatedEnvelopes.push({
      target,
      path: inventoryPath,
      manifest_sha256: sha256(inventoryBytes),
      source_sha256: sourceHash
    });
  }
  fixtureGit(root, ['add', '--', 'CONTRIBUTING.md', 'package.json', 'scripts', 'bin', 'protocol', 'vendors']);
  fixtureGit(root, ['commit', '--quiet', '-m', 'canonical source']);
  const canonical = fixtureGit(root, ['rev-parse', 'HEAD']);
  const manifest = {
    wtfp_commit: canonical,
    adapter_compiler_version: 4,
    generated_envelopes: generatedEnvelopes
  };
  return { root, canonical, manifest };
}

function commitFixture(root, message, paths = ['.']) {
  fixtureGit(root, ['add', '--', ...paths]);
  fixtureGit(root, ['commit', '--quiet', '-m', message]);
  return fixtureGit(root, ['rev-parse', 'HEAD']);
}

async function main() {
  const suite = loadSuite();

  await test('default mode is credential-free dry-run with exact primary rows and a bounded timeout', () => {
    const options = parseArgs([], {});
    assert.strictEqual(options.mode, 'dry-run');
    assert.deepStrictEqual(options.rows, PRIMARY_ROWS);
    assert.strictEqual(options.timeoutMs, 10 * 60 * 1000);
    assert.strictEqual(parseArgs(['--timeout-minutes', '0.5'], {}).timeoutMs, 30000);
    assert.throws(() => parseArgs(['--timeout-minutes', '0'], {}), /greater than zero/u);
    assert.throws(() => parseArgs(['--dry-run', '--prepare']), /choose at most one/u);
    assert.throws(() => parseArgs(['--execute']), /requires --root/u);
  });

  await test('credential paths and secret material cannot enter argv', () => {
    for (const option of ['--credentials', '--api-key', '--token-file', '--secret']) {
      assert.throws(() => parseArgs([option, '/tmp/value']), /forbidden as CLI options/u);
    }
  });

  await test('routing suite binds capability surfaces, compiler-v4 envelopes, rows, and immutable case order', () => {
    assert.strictEqual(suite.manifest_sha256, 'a87c82be91fca2b5240f59574412b4df22fdf3327d32a92f4fcd0fc159f94460');
    assert.strictEqual(suite.client_surfaces_sha256,
      'cb622928b946a0a90ba2a91605c047501e08ce71a928c856cc7fbadc38844594');
    assert.strictEqual(suite.rows.length, 3);
    assert.strictEqual(suite.rows.reduce((sum, row) => sum + row.case_ids.length, 0), 54);
    assert.ok(suite.rows.every(row => row.case_ids.length === 18 && row.maximum_paid_cases === 18));
    assert.deepStrictEqual(suite.rows.map(row => row.id), PRIMARY_ROWS);
    assert.strictEqual(suite.envelopes['clio-terra-primary'].manifest_sha256,
      'a41aedaa6eb01d5caaddf11bc95e93a80ee9e8a49ab667dd813484eeec3e9fa0');
    assert.strictEqual(suite.envelopes['clio-terra-primary'].source_sha256,
      'e41e8e80979de205176a1afa8db78a391f984b4e9e454b9664acef6e18640578');
  });

  await test('target-native explicit selectors preserve the semantic payload byte-for-byte', () => {
    const semantic = suite.catalog.get('explicit-new-paper');
    const claude = suite.target_catalogs.claude.get('explicit-new-paper');
    const codex = suite.target_catalogs.codex.get('explicit-new-paper');
    const clio = suite.target_catalogs.clio.get('explicit-new-paper');
    assert.strictEqual(claude.input, clio.input);
    assert.strictEqual(claude.input, semantic.input);
    assert.strictEqual(Buffer.byteLength(claude.input, 'utf8'), 152);
    assert.strictEqual(sha256(Buffer.from(claude.input)),
      'a2b4a25d42cfb8752e10007adc8da26e4d2eeeedade246f2f0192b279fe2cb01');
    assert.strictEqual(Buffer.byteLength(codex.input, 'utf8'), 172);
    assert.strictEqual(sha256(Buffer.from(codex.input)),
      '1ab063ce39749f1b07ef1a4bb507c33f9294cda86a4566743b40fab866055599');
    assert.ok(codex.input.startsWith('$wtf-p:wtfp-start-project new-paper  '));
    for (const projected of [claude, codex, clio]) {
      assert.ok(projected.input.endsWith(semantic.arguments));
      assert.strictEqual((projected.input.match(/"/gu) || []).length, 2);
      assert.ok(projected.input.includes('  preserve  repeated spacing\nsecond line\tliteral-tab'));
      assert.ok(projected.input.endsWith('literal-token=$1 literal-all=$@  '));
    }
  });

  await test('Codex academic selectors are skill mentions and product-operation selectors are explicitly unsupported', () => {
    const catalog = definitionCatalog(null, null, 'codex');
    assert.strictEqual(catalog.get('explicit-help').input, null);
    assert.strictEqual(catalog.get('explicit-help').input_supported, false);
    assert.match(catalog.get('explicit-plan-section').input, /^\$wtf-p:wtfp-plan-section plan-section /u);
    assert.strictEqual(CAPABILITY_SURFACES.codex.explicit.operations.selector_kind, 'unsupported');
  });

  await test('capability-aware surfaces make all three exact rows executable without inventing unobservable claims', () => {
    for (const row of suite.rows) {
      const assessment = surfaceAssessment(row);
      assert.strictEqual(assessment.paid_execution_ready, true);
      assert.deepStrictEqual(assessment.blockers, []);
      assert.deepStrictEqual(assessment.required_claims, row.required_claims);
    }
    assert.strictEqual(CAPABILITY_SURFACES.claude.observability.action, 'unobservable');
    assert.strictEqual(CAPABILITY_SURFACES.codex.observability.route, 'unobservable');
    assert.strictEqual(CAPABILITY_SURFACES.clio.implicit.expected_signal, 'suggested');
    assert.strictEqual(CAPABILITY_SURFACES.clio.implicit.expected_activation, 'not-loaded');
  });

  await test('every case receives fresh mode-0700 roots and separate semantic/native mode-0600 inputs', () => {
    const root = temporaryRoot();
    const layouts = [];
    for (const client of ['claude', 'codex', 'clio']) {
      const row = rowByClient(suite, client);
      const definition = suite.target_catalogs[client].get(row.case_ids[0]);
      const layout = createCaseLayout(root, row.id, 0, definition, client, '/opt/clio-source');
      layouts.push(layout);
      for (const directory of [layout.root, layout.project, layout.paths.HOME, layout.paths.XDG_CONFIG_HOME,
        layout.paths.XDG_DATA_HOME, layout.paths.XDG_STATE_HOME, layout.paths.XDG_CACHE_HOME, layout.paths.TMPDIR]) {
        assert.strictEqual(fs.statSync(directory).mode & 0o777, 0o700, directory);
      }
      assert.strictEqual(hashTree(layout.project), suite.manifest.fixture.project_snapshot_sha256);
      assert.strictEqual(fs.statSync(layout.native_input_file).mode & 0o777, 0o600);
      assert.strictEqual(fs.statSync(layout.semantic_input_file).mode & 0o777, 0o600);
    }
    assert.strictEqual(new Set(layouts.map(layout => layout.root)).size, layouts.length);
    assert.strictEqual(new Set(layouts.map(layout => layout.paths.HOME)).size, layouts.length);
  });

  await test('existing roots, symlinks, and special project entries fail closed', () => {
    const root = temporaryRoot();
    assert.throws(() => createRoot(root), /refusing existing prepare root/u);
    const project = path.join(root, 'project');
    fs.mkdirSync(project, { mode: 0o700 });
    fs.symlinkSync('/etc/hosts', path.join(project, 'escape'));
    assert.throws(() => hashTree(project), /refusing symlink/u);
  });

  await test('sanitized environments drop ambient secrets and confine all client roots', () => {
    const root = temporaryRoot();
    const paths = isolatedPaths(root, 'clio', '/opt/clio-source');
    const environment = sanitizedEnvironment(paths, {
      PATH: '/usr/bin', LANG: 'C', ANTHROPIC_API_KEY: 'never-copy', OPENAI_API_KEY: 'never-copy',
      NODE_OPTIONS: '--require hostile', CLAUDE_CONFIG_DIR: '/normal/claude', CODEX_HOME: '/normal/codex'
    });
    assert.strictEqual(environment.PATH, '/usr/bin');
    assert.strictEqual(environment.CLIO_CODER_REQUIRE_HOME_PREFIX, '1');
    assert.strictEqual(environment.CLIO_CODER_NO_NETWORK_TOOLS, '1');
    assert.strictEqual(environment.CLIO_CODER_TURN_TOOL_CALL_BUDGET, '1');
    assert.strictEqual(environment.CLIO_CODER_PACKAGE_ROOT, '/opt/clio-source');
    for (const forbidden of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'NODE_OPTIONS', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME']) {
      assert.ok(!(forbidden in environment), forbidden);
    }
  });

  await test('runtime commands preserve exact native bytes and apply the target-specific safety policy', () => {
    const root = temporaryRoot();
    const binary = fakeBinary(root);
    const commands = {};
    for (const client of ['claude', 'codex', 'clio']) {
      const row = rowByClient(suite, client);
      const definition = suite.target_catalogs[client].get('explicit-new-paper');
      const layout = createCaseLayout(root, `${row.id}-command`, 0, definition, client, '/opt/clio-source');
      commands[client] = clientInvocation(client, binary, row, layout, definition);
    }
    assert.strictEqual(commands.claude.argv.at(-1), suite.target_catalogs.claude.get('explicit-new-paper').input);
    assert.ok(commands.claude.argv.includes('--restricted'));
    assert.ok(commands.claude.argv.includes('Skill,Read,Glob,Grep'));
    assert.ok(!commands.claude.argv.join('\0').includes('Bash'));
    assert.ok(commands.claude.argv.includes('--max-budget-usd'));
    assert.strictEqual(commands.codex.stdin.toString('utf8'), suite.target_catalogs.codex.get('explicit-new-paper').input);
    assert.deepStrictEqual(commands.codex.argv.slice(0, 3), ['-a', 'never', 'exec']);
    assert.ok(commands.codex.argv.includes('web_search="disabled"'));
    assert.ok(commands.codex.argv.includes('read-only'));
    assert.strictEqual(commands.clio.argv.at(-1), suite.target_catalogs.clio.get('explicit-new-paper').input);
    assert.ok(commands.clio.argv.includes('--no-context-files'));
    assert.ok(commands.clio.argv.includes('gpt-5.6-terra'));
    assert.ok(commands.clio.argv.includes('xhigh'));
  });

  await test('paid execution requires a ready capability contract and the exact independent acknowledgement', () => {
    let touched = false;
    const ready = {
      native_preflight_valid: true,
      paid_execution_ready: true,
      normal_profile_hashes: [{ label: 'normal', unchanged: true }],
      rows: suite.rows.map(row => ({ id: row.id, surface: surfaceAssessment(row) })),
      cases: [{
        case_id: 'credential-free-gate',
        native_preflight_valid: true,
        project_unchanged: true,
        paid_execution_ready: true,
        blockers: [],
        normal_profile_hashes: [{ label: 'normal', unchanged: true }]
      }]
    };
    assert.doesNotThrow(() => assertPaidExecutionSupported(ready, () => { touched = true; }));
    assert.strictEqual(touched, true);
    const blocked = structuredClone(ready);
    blocked.paid_execution_ready = false;
    blocked.rows[0].surface.blockers.push('test blocker');
    touched = false;
    assert.throws(() => assertPaidExecutionSupported(blocked, () => { touched = true; }), /before credential access/u);
    assert.strictEqual(touched, false);
    for (const mutate of [
      value => { value.native_preflight_valid = false; },
      value => { value.normal_profile_hashes[0].unchanged = false; },
      value => { value.cases[0].project_unchanged = false; },
      value => { value.cases[0].native_preflight_valid = false; }
    ]) {
      const invalid = structuredClone(ready);
      mutate(invalid);
      touched = false;
      assert.throws(() => assertPaidExecutionSupported(invalid, () => { touched = true; }),
        /before credential access/u);
      assert.strictEqual(touched, false);
    }
    assert.throws(() => assertExecutionConfirmation({}), /requires exact operator acknowledgement/u);
    assert.doesNotThrow(() => assertExecutionConfirmation({ [EXECUTION_CONFIRMATION_ENV]: EXECUTION_CONFIRMATION }));
  });

  await test('credential source paths are excluded before acknowledgement and opaque hashes detect later changes', () => {
    const root = temporaryRoot();
    const credential = path.join(root, 'credentials.json');
    fs.writeFileSync(credential, '{"token":"alpha-secret-value"}\n', { mode: 0o600 });
    const environment = { WTFP_ROUTING_CLAUDE_CREDENTIALS_SOURCE: credential };
    assert.ok(!profileSpecs(environment, root).some(([label]) => label === 'claude-forward-source'));
    const included = profileSpecs(environment, root, true);
    assert.ok(included.some(([label]) => label === 'claude-forward-source'));
    const before = snapshotProfiles(included);
    fs.writeFileSync(credential, '{"token":"beta-secret-value"}\n', { mode: 0o600 });
    const pairs = compareProfiles(before, snapshotProfiles(included));
    assert.strictEqual(pairs.find(pair => pair.label === 'claude-forward-source').unchanged, false);
    assert.ok(!JSON.stringify(pairs).includes('alpha-secret-value'));
    assert.ok(!JSON.stringify(pairs).includes(credential));
    assert.notStrictEqual(profileDigest(credential), before.find(item => item.label === 'claude-forward-source').sha256);
  });

  await test('normal Claude root state and its rotating backup prefix are both monitored opaquely', () => {
    const normalHome = temporaryRoot();
    const specs = profileSpecs({}, normalHome);
    assert.ok(specs.some(([label, file]) =>
      label === 'claude-root-state' && file === path.join(normalHome, '.claude.json')));
    assert.ok(specs.some(([label, file, options]) =>
      label === 'claude-root-state-backups' && file === normalHome && options.prefix === '.claude.json.backup'));
    const before = snapshotProfiles(specs);
    fs.writeFileSync(path.join(normalHome, '.claude.json'), '{"state":1}\n', { mode: 0o600 });
    fs.writeFileSync(path.join(normalHome, '.claude.json.backup.1'), '{"state":0}\n', { mode: 0o600 });
    const pairs = compareProfiles(before, snapshotProfiles(specs));
    assert.strictEqual(pairs.find(pair => pair.label === 'claude-root-state').unchanged, false);
    assert.strictEqual(pairs.find(pair => pair.label === 'claude-root-state-backups').unchanged, false);
    assert.ok(!JSON.stringify(pairs).includes('"state"'));
    assert.ok(!JSON.stringify(pairs).includes(normalHome));
  });

  await test('credential copies are exclusive, private, redacted, and securely removed while sources remain unchanged', () => {
    const root = temporaryRoot();
    const source = path.join(root, 'source.json');
    const destination = path.join(root, 'isolated', 'auth.json');
    const secret = 'consumer-secret-123456789';
    fs.mkdirSync(path.dirname(destination), { mode: 0o700 });
    fs.writeFileSync(source, JSON.stringify({ token: secret }), { mode: 0o600 });
    const sourceBefore = sha256(fs.readFileSync(source));
    const bindings = [{
      source, destination, destination_root: root, label: 'test credentials', sensitive: true
    }];
    const installed = installCredentialBindings(bindings);
    assert.strictEqual(fs.statSync(destination).mode & 0o777, 0o600);
    assert.ok(installed.candidates.includes(secret));
    assert.deepStrictEqual(collectCredentialCandidates(fs.readFileSync(source)), [secret]);
    const redacted = redactCredentialValues(Buffer.from(`before ${secret} after`), installed.candidates);
    assert.strictEqual(redacted.replacements, 1);
    assert.strictEqual(redacted.buffer.toString(), 'before [REDACTED-CREDENTIAL] after');
    assert.throws(() => installCredentialBindings(bindings), /destination already exists/u);
    const cleanup = cleanupCredentialBindings(bindings);
    assert.strictEqual(cleanup.valid, true);
    assert.strictEqual(fs.existsSync(destination), false);
    assert.strictEqual(sha256(fs.readFileSync(source)), sourceBefore);
    fs.writeFileSync(destination, 'prepared-state', { mode: 0o600 });
    assert.throws(() => installCredentialBindings(bindings), /destination already exists/u);
    assert.strictEqual(fs.readFileSync(destination, 'utf8'), 'prepared-state');
  });

  await test('post-run credential refresh reads only a private contained single-link descriptor', () => {
    const root = temporaryRoot();
    const parent = path.join(root, 'isolated');
    const source = path.join(root, 'source.json');
    const destination = path.join(parent, 'auth.json');
    fs.mkdirSync(parent, { mode: 0o700 });
    fs.writeFileSync(source, '{"token":"initial-refresh-token"}\n', { mode: 0o600 });
    const bindings = [{
      source, destination, destination_root: root, label: 'refresh credentials', sensitive: true
    }];
    installCredentialBindings(bindings);
    fs.writeFileSync(destination, '{"token":"rotated-refresh-token"}\n', { mode: 0o600 });
    assert.deepStrictEqual(
      collectCredentialCandidates(readCredentialBindingForRedaction(bindings[0], quiescedReadGuard())),
      ['rotated-refresh-token']
    );
    assert.strictEqual(cleanupCredentialBindings(bindings).valid, true);
  });

  await test('post-run credential refresh validates a contained atomic replacement before reading it', () => {
    const root = temporaryRoot();
    const parent = path.join(root, 'isolated');
    const source = path.join(root, 'source.json');
    const destination = path.join(parent, 'auth.json');
    const displaced = path.join(parent, 'auth.json.original');
    fs.mkdirSync(parent, { mode: 0o700 });
    fs.writeFileSync(source, '{"token":"initial-atomic-token"}\n', { mode: 0o600 });
    const bindings = [{
      source, destination, destination_root: root, label: 'atomic refresh credentials', sensitive: true
    }];
    installCredentialBindings(bindings);
    fs.renameSync(destination, displaced);
    fs.writeFileSync(destination, '{"token":"atomic-replacement-token"}\n', { mode: 0o600 });
    assert.deepStrictEqual(
      collectCredentialCandidates(readCredentialBindingForRedaction(bindings[0], quiescedReadGuard())),
      ['atomic-replacement-token']
    );
    const cleanup = cleanupCredentialBindings(bindings);
    assert.strictEqual(cleanup.valid, true);
    const rotated = cleanup.results.find(result => result.file === 'auth.json');
    assert.strictEqual(rotated.inode_disposition, 'rotated-inode');
    assert.ok(rotated.overwritten_bytes > 0);
    assert.strictEqual(fs.existsSync(destination), false);
    assert.strictEqual(fs.existsSync(displaced), false);
  });

  await test('post-run credential refresh refuses an external hard-link before reading its bytes', () => {
    const root = temporaryRoot();
    const parent = path.join(root, 'isolated');
    const source = path.join(root, 'source.json');
    const destination = path.join(parent, 'auth.json');
    const displaced = path.join(parent, 'auth.json.original');
    const outside = temporaryRoot();
    const sentinel = path.join(outside, 'sentinel.txt');
    fs.mkdirSync(parent, { mode: 0o700 });
    fs.writeFileSync(source, '{"token":"initial-hard-link-token"}\n', { mode: 0o600 });
    fs.writeFileSync(sentinel, 'outside-hard-link-sentinel-must-survive', { mode: 0o600 });
    const bindings = [{
      source, destination, destination_root: root, label: 'hard-link refresh credentials', sensitive: true
    }];
    installCredentialBindings(bindings);
    fs.renameSync(destination, displaced);
    fs.linkSync(sentinel, destination);
    assert.throws(() => readCredentialBindingForRedaction(bindings[0], quiescedReadGuard()), /multiply linked/u);
    assert.strictEqual(fs.readFileSync(sentinel, 'utf8'), 'outside-hard-link-sentinel-must-survive');
    assert.strictEqual(cleanupCredentialBindings(bindings).valid, false);
    assert.strictEqual(fs.readFileSync(sentinel, 'utf8'), 'outside-hard-link-sentinel-must-survive');
  });

  await test('post-run credential refresh refuses substituted ancestors and oversized files', () => {
    const root = temporaryRoot();
    const parent = path.join(root, 'isolated');
    const displacedParent = path.join(root, 'isolated-original');
    const source = path.join(root, 'source.json');
    const destination = path.join(parent, 'auth.json');
    const outside = temporaryRoot();
    fs.mkdirSync(parent, { mode: 0o700 });
    fs.writeFileSync(source, '{"token":"initial-ancestor-token"}\n', { mode: 0o600 });
    fs.writeFileSync(path.join(outside, 'auth.json'), 'outside-ancestor-sentinel', { mode: 0o600 });
    const bindings = [{
      source, destination, destination_root: root, label: 'ancestor refresh credentials', sensitive: true
    }];
    installCredentialBindings(bindings);
    fs.renameSync(parent, displacedParent);
    fs.symlinkSync(outside, parent);
    assert.throws(() => readCredentialBindingForRedaction(bindings[0], quiescedReadGuard()), /credentials parent/u);
    assert.strictEqual(fs.readFileSync(path.join(outside, 'auth.json'), 'utf8'), 'outside-ancestor-sentinel');
    fs.unlinkSync(parent);
    fs.renameSync(displacedParent, parent);
    fs.truncateSync(destination, (128 * 1024 * 1024) + 1);
    assert.throws(() => readCredentialBindingForRedaction(bindings[0], quiescedReadGuard()), /exceeds scan ceiling/u);
    fs.truncateSync(destination, 0);
    assert.strictEqual(cleanupCredentialBindings(bindings).valid, true);
  });

  await test('bound case-root identity rejects a root-level ancestor substitution before reading', () => {
    const container = temporaryRoot();
    const caseRoot = path.join(container, 'case-root');
    const displacedRoot = path.join(container, 'case-root-original');
    const parent = path.join(caseRoot, 'isolated');
    const source = path.join(container, 'source.json');
    const destination = path.join(parent, 'auth.json');
    const outside = temporaryRoot();
    const outsideParent = path.join(outside, 'isolated');
    fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
    fs.chmodSync(caseRoot, 0o700);
    fs.chmodSync(parent, 0o700);
    fs.mkdirSync(outsideParent, { mode: 0o700 });
    fs.writeFileSync(source, '{"token":"bound-root-token"}\n', { mode: 0o600 });
    fs.writeFileSync(path.join(outsideParent, 'auth.json'), 'outside-root-sentinel', { mode: 0o600 });
    const bindings = [{
      source, destination, destination_root: caseRoot, label: 'bound-root credentials', sensitive: true
    }];
    installCredentialBindings(bindings);
    fs.renameSync(caseRoot, displacedRoot);
    fs.symlinkSync(outside, caseRoot);
    assert.throws(
      () => readCredentialBindingForRedaction(bindings[0], quiescedReadGuard()),
      /case-root identity changed/u
    );
    assert.strictEqual(fs.readFileSync(path.join(outsideParent, 'auth.json'), 'utf8'), 'outside-root-sentinel');
    const blockedCleanup = cleanupCredentialBindings(bindings);
    assert.strictEqual(blockedCleanup.valid, false);
    assert.strictEqual(fs.readFileSync(path.join(displacedRoot, 'isolated', 'auth.json')).length, 0);
    assert.strictEqual(fs.readFileSync(path.join(outsideParent, 'auth.json'), 'utf8'), 'outside-root-sentinel');
    fs.unlinkSync(caseRoot);
    fs.renameSync(displacedRoot, caseRoot);
    assert.strictEqual(cleanupCredentialBindings(bindings).valid, true);
  });

  await test('credential transport refuses a symlinked parent before copying any source bytes', () => {
    const root = temporaryRoot();
    const source = path.join(root, 'source.json');
    const outside = temporaryRoot();
    const parent = path.join(root, 'linked-parent');
    fs.writeFileSync(source, '{"token":"never-forward-through-link"}', { mode: 0o600 });
    fs.symlinkSync(outside, parent);
    assert.throws(() => installCredentialBindings([{
      source,
      destination: path.join(parent, 'auth.json'),
      destination_root: root,
      label: 'linked credentials',
      sensitive: true
    }]), /credential parent/u);
    assert.strictEqual(fs.existsSync(path.join(outside, 'auth.json')), false);
  });

  await test('descriptor cleanup wipes the installed credential without following a substituted ancestor', () => {
    const root = temporaryRoot();
    const source = path.join(root, 'source.json');
    const parent = path.join(root, 'isolated');
    const displacedParent = path.join(root, 'isolated-original');
    const destination = path.join(parent, 'auth.json');
    const outside = temporaryRoot();
    fs.mkdirSync(parent, { mode: 0o700 });
    fs.writeFileSync(source, '{"token":"descriptor-cleanup-secret"}\n', { mode: 0o600 });
    const bindings = [{
      source, destination, destination_root: root, label: 'descriptor credentials', sensitive: true
    }];
    installCredentialBindings(bindings);
    fs.renameSync(parent, displacedParent);
    fs.symlinkSync(outside, parent);
    const firstCleanup = cleanupCredentialBindings(bindings);
    assert.strictEqual(firstCleanup.valid, false);
    assert.strictEqual(fs.existsSync(path.join(outside, 'auth.json')), false);
    assert.strictEqual(fs.statSync(path.join(displacedParent, 'auth.json')).size, 0);
    fs.unlinkSync(parent);
    fs.renameSync(displacedParent, parent);
    const finalCleanup = cleanupCredentialBindings(bindings);
    assert.strictEqual(finalCleanup.valid, true);
    assert.strictEqual(fs.existsSync(destination), false);
  });

  await test('a substituted external hard-link sentinel is unlinked without overwriting its outside inode', () => {
    const root = temporaryRoot();
    const parent = path.join(root, 'isolated');
    const source = path.join(root, 'source.json');
    const destination = path.join(parent, 'auth.json');
    const displaced = path.join(parent, 'auth.json.original');
    const outside = temporaryRoot();
    const sentinel = path.join(outside, 'sentinel.txt');
    fs.mkdirSync(parent, { mode: 0o700 });
    fs.writeFileSync(source, '{"token":"external-sentinel-secret"}\n', { mode: 0o600 });
    fs.writeFileSync(sentinel, 'outside-sentinel-must-survive', { mode: 0o600 });
    const bindings = [{
      source, destination, destination_root: root, label: 'sentinel credentials', sensitive: true
    }];
    installCredentialBindings(bindings);
    fs.renameSync(destination, displaced);
    fs.linkSync(sentinel, destination);
    const cleanup = cleanupCredentialBindings(bindings);
    assert.strictEqual(cleanup.valid, false);
    assert(cleanup.results.some(result => result.unsafe_type === 'multiply-linked'));
    assert.strictEqual(fs.readFileSync(sentinel, 'utf8'), 'outside-sentinel-must-survive');
    assert.strictEqual(fs.existsSync(destination), false);
    assert.strictEqual(fs.existsSync(displaced), false);
  });

  await test('a hard link to the original installed inode is wiped through the retained descriptor', () => {
    const root = temporaryRoot();
    const parent = path.join(root, 'isolated');
    const source = path.join(root, 'source.json');
    const destination = path.join(parent, 'auth.json');
    const outside = temporaryRoot();
    const ownedLink = path.join(outside, 'owned-credential-link');
    fs.mkdirSync(parent, { mode: 0o700 });
    fs.writeFileSync(source, '{"token":"owned-inode-secret"}\n', { mode: 0o600 });
    const bindings = [{
      source, destination, destination_root: root, label: 'hard-linked credentials', sensitive: true
    }];
    installCredentialBindings(bindings);
    fs.linkSync(destination, ownedLink);
    const cleanup = cleanupCredentialBindings(bindings);
    assert.strictEqual(cleanup.valid, false);
    assert(cleanup.results.some(result => result.unsafe_type === 'multiply-linked'));
    assert.strictEqual(fs.statSync(ownedLink).size, 0);
    assert.strictEqual(fs.existsSync(destination), false);
    fs.unlinkSync(ownedLink);
  });

  await test('credential cleanup remains blocked while an owned process group is non-quiescent', () => {
    const root = temporaryRoot();
    const parent = path.join(root, 'isolated');
    const source = path.join(root, 'source.json');
    const destination = path.join(parent, 'auth.json');
    fs.mkdirSync(parent, { mode: 0o700 });
    fs.writeFileSync(source, '{"token":"live-process-secret"}\n', { mode: 0o600 });
    const bindings = [{
      source, destination, destination_root: root, label: 'live credentials', sensitive: true
    }];
    installCredentialBindings(bindings);
    const fakePid = 987654321;
    noteOwnedProcessGroup(fakePid);
    finalizeOwnedProcessGroup(fakePid, { quiesced: false });
    assert.strictEqual(activeProcessGroupCount(), 1);
    const blocked = cleanupCredentialBindings(bindings);
    assert.strictEqual(blocked.valid, false);
    assert.strictEqual(blocked.results[0].blocked, true);
    assert.match(fs.readFileSync(destination, 'utf8'), /live-process-secret/u);
    finalizeOwnedProcessGroup(fakePid, { quiesced: true });
    assert.strictEqual(activeProcessGroupCount(), 0);
    assert.strictEqual(cleanupCredentialBindings(bindings).valid, true);
    assert.strictEqual(fs.existsSync(destination), false);
  });

  await test('non-quiescent process groups block credential-refresh and receipt path reads', async () => {
    const fakePid = 987654322;
    let credentialPathRead = false;
    let receiptPathRead = false;
    const binding = {};
    Object.defineProperty(binding, 'destination', {
      get() { credentialPathRead = true; return '/must-not-be-read'; }
    });
    const paths = new Proxy({}, {
      get() { receiptPathRead = true; return '/must-not-be-read'; }
    });
    noteOwnedProcessGroup(fakePid);
    try {
      assert.throws(
        () => establishPostRunReadBoundary({ process_group: { quiesced: false } }),
        /require a quiescent owned process group/u
      );
      assert.throws(
        () => readCredentialBindingForRedaction(binding, null),
        /without a quiescence guard/u
      );
      await assert.rejects(
        () => verifyClioReceipt(paths, '/must-not-be-read', null, null),
        /without a quiescence guard/u
      );
      assert.strictEqual(credentialPathRead, false);
      assert.strictEqual(receiptPathRead, false);
    } finally {
      finalizeOwnedProcessGroup(fakePid, { quiesced: true });
    }
    assert.strictEqual(activeProcessGroupCount(), 0);
  });

  await test('oversized retained files fail the credential scan instead of being silently skipped', () => {
    const root = temporaryRoot();
    const oversized = path.join(root, 'oversized.bin');
    fs.writeFileSync(oversized, '', { mode: 0o600 });
    fs.truncateSync(oversized, (128 * 1024 * 1024) + 1);
    const findings = scanAndRedactCredentialValues(root, [], ['credential-free-test-value']);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].path, 'oversized.bin');
    assert.match(findings[0].error, /exceeds credential scan ceiling/u);
  });

  await test('credential cleanup unlinks a substituted symlink without following it and reports the anomaly', () => {
    const root = temporaryRoot();
    const target = path.join(root, 'target');
    const link = path.join(root, 'link');
    fs.writeFileSync(target, 'do-not-touch', { mode: 0o600 });
    fs.symlinkSync(target, link);
    const result = secureRemove(link);
    assert.strictEqual(result.removed, true);
    assert.strictEqual(result.unsafe_type, 'symlink');
    assert.strictEqual(fs.readFileSync(target, 'utf8'), 'do-not-touch');
  });

  await test('detached capture retains JSONL and quiesces a credential-free fake process group', async () => {
    const result = await spawnCaptured({
      executable: process.execPath,
      argv: ['-e', 'process.stdout.write(JSON.stringify({type:"thread.started",thread_id:"fake"})+"\\n")'],
      cwd: repositoryRoot,
      env: { PATH: process.env.PATH || '' },
      timeoutMs: 5000
    });
    assert.strictEqual(result.exit_code, 0);
    assert.strictEqual(result.timed_out, false);
    assert.strictEqual(result.capture_overflow, false);
    assert.strictEqual(result.process_group.quiesced, true);
    assert.deepStrictEqual(parseJsonLines(result.stdout), [{ type: 'thread.started', thread_id: 'fake' }]);
  });

  await test('a client spawn is counted before any post-spawn parsing failure', async () => {
    let spawnAttempts = 0;
    const result = await spawnCaptured({
      executable: process.execPath,
      argv: ['-e', 'process.stdout.write("malformed-json\\n")'],
      cwd: repositoryRoot,
      env: { PATH: process.env.PATH || '' },
      timeoutMs: 5000,
      onSpawn: () => { spawnAttempts += 1; }
    });
    assert.strictEqual(spawnAttempts, 1);
    assert.strictEqual(result.exit_code, 0);
    assert.throws(() => parseJsonLines(result.stdout), /invalid JSON event/u);
    assert.strictEqual(spawnAttempts, 1);
  });

  await test('nested Claude and Codex event envelopes expose forbidden shell, network, and mutation activity', () => {
    const claude = observeNativeTrace('claude', [
      { type: 'system', session_id: 'nested-claude' },
      { type: 'assistant', message: { role: 'assistant', content: [
        { type: 'tool_use', name: 'Bash', input: { command: 'true' } },
        { type: 'tool_use', name: 'WebFetch', input: { url: 'https://example.invalid' } },
        { type: 'tool_use', name: 'Write', input: { file_path: 'paper.md' } }
      ] } }
    ], null, suite.target_catalogs.claude.get('start-clear-new-paper'));
    assert.strictEqual(claude.shell_used, true);
    assert.strictEqual(claude.network_used, true);
    assert.strictEqual(claude.mutation_used, true);

    const codex = observeNativeTrace('codex', [
      { type: 'thread.started', thread_id: 'nested-codex' },
      { type: 'item.completed', item: { type: 'command_execution', command: 'true' } },
      { type: 'item.completed', item: { type: 'web_search', query: 'unsafe' } },
      { type: 'item.completed', item: { type: 'file_change', changes: [] } }
    ], null, suite.target_catalogs.codex.get('start-clear-new-paper'));
    assert.strictEqual(codex.shell_used, true);
    assert.strictEqual(codex.network_used, true);
    assert.strictEqual(codex.mutation_used, true);
  });

  await test('Claude typed Skill use proves implicit activation while explicit action remains unobservable', () => {
    const implicit = suite.target_catalogs.claude.get('start-clear-new-paper');
    const observation = observeNativeTrace('claude', [
      { type: 'system', session_id: 'claude-session', model: 'claude-sonnet-5-20260801' },
      { type: 'assistant', message: { role: 'assistant', content: [
        { type: 'tool_use', name: 'Skill', input: { skill: 'wtfp-start-project' } }
      ] } },
      { type: 'result', session_id: 'claude-session', total_cost_usd: 0.04 }
    ], null, implicit);
    assert.deepStrictEqual(observation.route.value,
      { kind: 'skill', skill: 'wtfp-start-project', action: null });
    assert.strictEqual(observation.route.signal, 'selected');
    assert.strictEqual(observation.activation.status, 'loaded');
    assert.strictEqual(observation.cost.status, 'metered');
    assert.doesNotThrow(() => assertScorableObservation(observation, implicit,
      [{ label: 'normal', unchanged: true }], 'empty', 'empty', rowByClient(suite, 'claude')));

    const explicit = suite.target_catalogs.claude.get('explicit-new-paper');
    const explicitObservation = observeNativeTrace('claude', [
      { type: 'system', session_id: 'claude-explicit', model: 'claude-sonnet-5-20260801' },
      { type: 'result', session_id: 'claude-explicit', total_cost_usd: 0.03 }
    ], null, explicit, { selector_accepted: true });
    assert.strictEqual(explicitObservation.selector.status, 'unobservable');
    assert.strictEqual(explicitObservation.route.value, null);
    assert.strictEqual(explicitObservation.route.granularity, 'unobservable');
    assert.strictEqual(explicitObservation.arguments.status, 'unobservable');
  });

  await test('Codex records implicit and explicit routing as unobservable without typed resolution evidence', () => {
    const implicit = observeNativeTrace('codex', [
      { type: 'thread.started', thread_id: 'codex-implicit' }
    ], null, suite.target_catalogs.codex.get('plan-clear-section'));
    assert.strictEqual(implicit.route.signal, 'unobservable');
    assert.strictEqual(implicit.activation.status, 'unobservable');
    assert.strictEqual(implicit.cost.status, 'unavailable');
    assert.doesNotThrow(() => assertScorableObservation(implicit,
      suite.target_catalogs.codex.get('plan-clear-section'), [{ label: 'normal', unchanged: true }],
      'empty', 'empty', rowByClient(suite, 'codex')));

    const explicit = suite.target_catalogs.codex.get('explicit-plan-section');
    const selected = observeNativeTrace('codex', [
      { type: 'thread.started', thread_id: 'codex-explicit' }
    ], null, explicit, { selector_accepted: true });
    assert.strictEqual(selected.selector.status, 'unobservable');
    assert.strictEqual(selected.route.value, null);
    assert.strictEqual(selected.route.granularity, 'unobservable');
    assert.strictEqual(selected.arguments.status, 'unobservable');
    assert.strictEqual(selected.arguments.value, null);
  });

  await test('Clio implicit suggestion stays non-activation and model self-report is ignored', () => {
    const definition = suite.target_catalogs.clio.get('start-clear-new-paper');
    const receipt = {
      raw: {
        sessionId: 'clio-implicit', clioVersion: '0.3.8', wireModelId: 'gpt-5.6-terra',
        runtimeResolution: { effectiveThinkingLevel: 'xhigh' }, skillActivations: []
      },
      session_id: 'clio-implicit', client_version: '0.3.8', model: 'gpt-5.6-terra',
      runtime: { effectiveThinkingLevel: 'xhigh' }, cost_provenance: 'unknown'
    };
    const observation = observeNativeTrace('clio', [{
      type: 'message_end', message: { role: 'assistant', content: [
        { type: 'text', text: 'Suggested skill: /skill wtfp-start-project\nI activated a skill.' }
      ] }
    }], receipt, definition);
    assert.strictEqual(observation.route.signal, 'suggested');
    assert.strictEqual(observation.route.value.skill, 'wtfp-start-project');
    assert.strictEqual(observation.activation.status, 'not-loaded');
    assert.strictEqual(observation.model_self_reports_ignored, 1);
  });

  await test('Clio explicit expansion proves exact arguments, relevant resources, capabilities, and loaded skill', () => {
    const scorer = require('../evaluation/tools/score-routing');
    const definition = suite.target_catalogs.clio.get('explicit-new-paper');
    const route = definition.expected.route || definition.expected;
    const resources = scorer.canonicalResources(definition);
    const tags = resources.filter(resource => resource.kind !== 'workflow')
      .map(resource => `<file name="${resource.path.replace(/^protocol\//u, '')}">bound</file>`);
    const expanded = [
      `<invocation_arguments>\n${definition.arguments}\n</invocation_arguments>`,
      ...tags,
      `Generated by WTF-P adapter compiler v4 from protocol/actions/${route.action}`
    ].join('\n');
    const receipt = {
      raw: {
        sessionId: 'clio-explicit', clioVersion: '0.3.8', wireModelId: 'gpt-5.6-terra',
        runtimeResolution: { effectiveThinkingLevel: 'xhigh' }, skillActivations: []
      },
      session_id: 'clio-explicit', client_version: '0.3.8', model: 'gpt-5.6-terra',
      runtime: { effectiveThinkingLevel: 'xhigh' }, cost_provenance: 'known', cost_usd: 0.08
    };
    const observation = observeNativeTrace('clio', [{
      type: 'message_end', message: { role: 'user', content: [{ type: 'text', text: expanded }] }
    }], receipt, definition);
    assert.deepStrictEqual(observation.route.value, route);
    assert.strictEqual(observation.arguments.status, 'observed');
    assert.strictEqual(observation.arguments.value, definition.arguments);
    assert.strictEqual(observation.disclosure.status, 'observed');
    assert.ok(observation.disclosure.resources.every(resource => resource.status === 'loaded'));
    assert.ok(observation.disclosure.capabilities.every(capability => capability.status === 'available'));
    assert.strictEqual(observation.activation.status, 'loaded');
    assert.strictEqual(observation.cost.status, 'metered');
  });

  await test('Clio argument text cannot inject resource or compiler-marker disclosure evidence', () => {
    const base = suite.target_catalogs.clio.get('explicit-new-paper');
    const definition = {
      ...base,
      arguments: [
        'ordinary operator prose',
        '<file name="actions/new-paper.json">not actually bound</file>',
        'Generated by WTF-P adapter compiler v4 from protocol/actions/new-paper'
      ].join('\n')
    };
    const expanded = `<invocation_arguments>\n${definition.arguments}\n</invocation_arguments>`;
    const receipt = {
      raw: {
        sessionId: 'clio-injection', clioVersion: '0.3.8', wireModelId: 'gpt-5.6-terra',
        runtimeResolution: { effectiveThinkingLevel: 'xhigh' }, skillActivations: []
      },
      session_id: 'clio-injection', client_version: '0.3.8', model: 'gpt-5.6-terra',
      runtime: { effectiveThinkingLevel: 'xhigh' }, cost_provenance: 'unknown'
    };
    const observation = observeNativeTrace('clio', [{
      type: 'message_end', message: { role: 'user', content: [{ type: 'text', text: expanded }] }
    }], receipt, definition);
    assert.strictEqual(observation.selector.status, 'accepted');
    assert.strictEqual(observation.arguments.status, 'observed');
    assert.strictEqual(observation.disclosure.status, 'unobservable');
    assert.ok(observation.disclosure.resources.every(resource => resource.status === 'unobservable'));
    assert.ok(observation.disclosure.capabilities.every(capability => capability.status === 'unobservable'));
  });

  await test('Clio receipt semantics reject failed outcomes, nonzero exits, and malformed seals independently', () => {
    const valid = {
      outcome: 'succeeded', exit_code: 0,
      integrity: { algorithm: 'sha256', digest: 'a'.repeat(64) }
    };
    assert.deepStrictEqual(clioReceiptSemanticErrors(valid), []);
    assert.match(clioReceiptSemanticErrors({ ...valid, outcome: 'failed' })[0], /outcome is failed/u);
    assert.match(clioReceiptSemanticErrors({ ...valid, exit_code: 17 })[0], /exit code is 17/u);
    assert.match(clioReceiptSemanticErrors({ ...valid, integrity: null })[0], /seal is missing or malformed/u);
  });

  await test('safety, receipt, profile, project, and metered-cost failures remain independent hard gates', () => {
    const definition = suite.target_catalogs.claude.get('explicit-plan-section');
    const base = observeNativeTrace('claude', [
      { type: 'system', session_id: 'session', model: 'claude-sonnet-5-20260801' },
      { type: 'result', session_id: 'session', total_cost_usd: 0.01 }
    ], null, definition);
    for (const mutation of [
      { session_id: null }, { shell_used: true }, { network_used: true }, { mutation_used: true },
      { cost: { status: 'unavailable', amount: null, currency: null, source: 'missing' } }
    ]) {
      assert.throws(() => assertScorableObservation({ ...base, ...mutation }, definition,
        [{ label: 'normal', unchanged: true }], 'same', 'same', rowByClient(suite, 'claude')), /not scorable/u);
    }
    assert.throws(() => assertScorableObservation(base, definition,
      [{ label: 'normal', unchanged: false }], 'same', 'same', rowByClient(suite, 'claude')), /normal profile changed/u);
    assert.throws(() => assertScorableObservation(base, definition,
      [{ label: 'normal', unchanged: true }], 'before', 'after', rowByClient(suite, 'claude')), /project changed/u);
  });

  await test('mixed per-case cost provenance preserves priced evidence while aggregate cost stays unavailable', () => {
    const aggregate = costAggregate([
      { cost: { status: 'metered', amount: 0.1 } },
      { cost: { status: 'estimated', amount: 0.2 } },
      { cost: { status: 'unavailable', amount: null } }
    ]);
    assert.deepStrictEqual(aggregate, {
      status: 'unavailable', amount: null, currency: null,
      source: 'At least one native case lacks independently priced USD provenance',
      priced_cases: 2, unpriced_cases: 1
    });
    const fullyPriced = costAggregate([
      { cost: { status: 'metered', amount: 0.1 } },
      { cost: { status: 'estimated', amount: 0.2 } }
    ]);
    assert.strictEqual(fullyPriced.status, 'estimated');
    assert.strictEqual(fullyPriced.amount, 0.30000000000000004);
    assert.strictEqual(fullyPriced.priced_cases, 2);
    assert.strictEqual(fullyPriced.unpriced_cases, 0);
  });

  await test('Codex skill-only routes score against expected action resources without a null action lookup', () => {
    const scorer = require('../evaluation/tools/score-routing');
    const row = rowByClient(suite, 'codex');
    const root = temporaryRoot();
    const rowRoot = path.join(root, 'row');
    fs.mkdirSync(rowRoot, { mode: 0o700 });
    const auditFile = path.join(rowRoot, 'audit.json');
    fs.writeFileSync(auditFile, '{}\n', { mode: 0o600 });
    const evidence = {
      locator: 'audit.json',
      sha256: sha256(fs.readFileSync(auditFile)),
      assessor: { kind: 'independent-tool', name: 'routing-runner-test', version: '1' },
      summary: 'credential-free synthetic Codex capability contract'
    };
    const stable = sha256(Buffer.from('unchanged-normal-profile'));
    const profilePairs = [{
      label: 'normal-profile', before_sha256: stable, after_sha256: stable, unchanged: true
    }];
    const items = [];
    const observations = row.case_ids.map((caseId, index) => {
      const definition = suite.target_catalogs.codex.get(caseId);
      const expected = definition.expected.route || definition.expected;
      const resources = expected.kind === 'none' ? [] : scorer.canonicalResources(definition);
      const capabilities = expected.kind === 'none' ? [] : scorer.canonicalCapabilities(definition);
      items.push({
        case_id: caseId,
        command_sha256: sha256(Buffer.from(`command:${caseId}`)),
        native_input_sha256: sha256(Buffer.from(definition.input))
      });
      return {
        case_id: caseId,
        session_id: `codex-session-${index}`,
        input_sha256: sha256(Buffer.from(definition.input)),
        project_snapshot_sha256: suite.manifest.fixture.project_snapshot_sha256,
        selector: { status: definition.explicit ? 'unobservable' : 'not-applicable', evidence },
        route: {
          signal: 'unobservable',
          granularity: 'unobservable',
          value: null,
          evidence
        },
        activation: {
          status: expected.kind === 'skill' ? 'unobservable' : 'not-applicable', skill: null, evidence
        },
        disclosure: {
          status: 'unobservable',
          resources: resources.map(resource => ({ ...resource, status: 'unobservable', evidence })),
          capabilities: capabilities.map(id => ({ id, status: 'unobservable', evidence })),
          evidence
        },
        arguments: {
          status: definition.explicit ? 'unobservable' : 'not-applicable',
          value: null,
          evidence
        },
        cost: {
          status: 'unavailable', amount: null, currency: null,
          source: 'Codex ChatGPT-auth test has no priced USD receipt', evidence
        },
        latency_ms: 1,
        evidence
      };
    });
    const clients = {
      binaries: { codex: { path: process.execPath, sha256: sha256(fs.readFileSync(process.execPath)) } }
    };
    const run = runMetadata({
      suite,
      clients,
      row,
      profilePairs,
      isolationEvidence: evidence,
      startedAt: '2026-08-29T12:00:00Z',
      items,
      sessionIdsUnique: true
    });
    const document = observationDocument({ suite, row, run, observations, costEvidence: evidence });
    assert.deepStrictEqual(scorer.validateObservationDocument(document), []);
    const score = scorer.scoreObservations(document, { matrixRow: row.id, evidenceRoot: rowRoot });
    assert.strictEqual(score.disposition, 'inconclusive-capability');
    assert.strictEqual(score.implicit.counts.route_observable, 0);
    assert.strictEqual(score.implicit.counts.false_negative, 0);
    assert.strictEqual(score.implicit.metrics.observable_route_accuracy, null);
    assert.strictEqual(score.implicit.metrics.micro_skill_route_accuracy, null);
    assert.strictEqual(score.explicit.counts.route_observable, 0);
    assert.strictEqual(score.explicit.counts.arguments_observed, 0);
    assert.strictEqual(score.explicit.metrics.observable_action_accuracy, null);
    assert.strictEqual(score.explicit.metrics.observable_argument_accuracy, null);
    assert.strictEqual(score.required_claims.find(claim => claim.id === 'selector-accepted').disposition,
      'inconclusive-capability');
    assert.strictEqual(score.required_claims.find(claim => claim.id === 'route-skill').failed, 0);
  });

  await test('sealed preparation JSON rejects any post-prepare edit', () => {
    const root = temporaryRoot();
    const file = path.join(root, 'prepared.json');
    fs.writeFileSync(file, '{"ready":true}\n', { mode: 0o600 });
    fs.writeFileSync(`${file}.sha256`, `${sha256(fs.readFileSync(file))}\n`, { mode: 0o600 });
    assert.deepStrictEqual(verifySealedJson(file), { ready: true });
    fs.appendFileSync(file, ' ');
    assert.throws(() => verifySealedJson(file), /digest mismatch/u);
  });

  await test('canonical source projection allows evaluation/docs descendants and seals actual dirty identity', () => {
    const fixture = canonicalProjectionFixture();
    const canonical = verifyCanonicalSourceProjection(fixture.root, fixture.manifest);
    writeFixtureFile(fixture.root, 'docs/evaluation-notes.md', 'descendant documentation\n');
    writeFixtureFile(fixture.root, 'evaluation/new-method.json', '{"version":1}\n');
    const packageDocument = JSON.parse(fs.readFileSync(path.join(fixture.root, 'package.json'), 'utf8'));
    packageDocument.scripts.test = 'node evaluation/new-method.json';
    writeFixtureFile(fixture.root, 'package.json', `${JSON.stringify(packageDocument, null, 2)}\n`);
    const descendant = commitFixture(fixture.root, 'docs: add evaluation methodology');
    const projected = verifyCanonicalSourceProjection(fixture.root, fixture.manifest);
    assert.strictEqual(projected.canonical_commit, fixture.canonical);
    assert.strictEqual(projected.actual_head, descendant);
    assert.strictEqual(projected.ancestor_verified, true);
    assert.strictEqual(projected.sha256, canonical.sha256);
    const cleanIdentity = gitMetadata(fixture.root);
    assert.strictEqual(cleanIdentity.commit, descendant);
    assert.strictEqual(cleanIdentity.dirty, false);
    writeFixtureFile(fixture.root, 'evaluation/uncommitted-note.md', 'allowed but sealed dirty state\n');
    const dirtyIdentity = gitMetadata(fixture.root);
    assert.strictEqual(dirtyIdentity.dirty, true);
    assert.notStrictEqual(dirtyIdentity.worktree_state_sha256, cleanIdentity.worktree_state_sha256);
    assert.strictEqual(verifyCanonicalSourceProjection(fixture.root, fixture.manifest).sha256, canonical.sha256);
    const sealedIdentity = repositoryIdentity(fixture.root, fixture.manifest);
    writeFixtureFile(fixture.root, 'evaluation/uncommitted-note.md', 'changed dirty content, same path\n');
    assert.throws(
      () => assertRepositoryIdentity(sealedIdentity, fixture.root, fixture.manifest),
      /dirty state/u
    );
  });

  await test('canonical source projection rejects protocol, compiler, tool, inventory, and generated-entry drift', () => {
    const mutations = [
      ['protocol', 'protocol/catalog.json'],
      ['compiler', 'bin/lib/adapter-compiler.js'],
      ['tool', 'bin/lib/fixture-tool.js'],
      ['generated inventory', 'vendors/claude/.wtfp-generated.json'],
      ['generated entry', 'vendors/clio/payload.txt']
    ];
    for (const [label, relative] of mutations) {
      const fixture = canonicalProjectionFixture();
      fs.appendFileSync(path.join(fixture.root, relative), `\n${label} drift\n`);
      commitFixture(fixture.root, `${label}: drift`, [relative]);
      assert.throws(
        () => verifyCanonicalSourceProjection(fixture.root, fixture.manifest),
        new RegExp(`canonical source projection drift: ${relative.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}`, 'u'),
        label
      );
    }
  });

  await test('canonical source projection rejects untracked files under generated or protocol roots', () => {
    for (const relative of ['vendors/claude/untracked-injection.md', 'protocol/untracked-injection.json']) {
      const fixture = canonicalProjectionFixture();
      writeFixtureFile(fixture.root, relative, 'untracked source injection\n');
      assert.throws(
        () => verifyCanonicalSourceProjection(fixture.root, fixture.manifest),
        /file set drifted/u,
        relative
      );
    }
  });

  await test('canonical source projection binds package version and all nine manifest inventory identities', () => {
    const versionFixture = canonicalProjectionFixture();
    const packageDocument = JSON.parse(fs.readFileSync(path.join(versionFixture.root, 'package.json'), 'utf8'));
    packageDocument.version = '0.6.0-rc.2';
    writeFixtureFile(versionFixture.root, 'package.json', `${JSON.stringify(packageDocument, null, 2)}\n`);
    commitFixture(versionFixture.root, 'chore: drift generator version input', ['package.json']);
    assert.throws(
      () => verifyCanonicalSourceProjection(versionFixture.root, versionFixture.manifest),
      /package version generator input drift/u
    );

    const bindingFixture = canonicalProjectionFixture();
    bindingFixture.manifest.generated_envelopes[8].source_sha256 = 'f'.repeat(64);
    assert.throws(
      () => verifyCanonicalSourceProjection(bindingFixture.root, bindingFixture.manifest),
      /routing manifest binding differs/u
    );
  });

  await test('canonical source projection rejects a non-ancestor manifest commit', () => {
    const fixture = canonicalProjectionFixture();
    const tree = fixtureGit(fixture.root, ['rev-parse', 'HEAD^{tree}']);
    const unrelated = fixtureGit(fixture.root, ['commit-tree', tree, '-m', 'unrelated root']);
    fixtureGit(fixture.root, ['switch', '--quiet', '--detach', unrelated]);
    assert.throws(
      () => verifyCanonicalSourceProjection(fixture.root, fixture.manifest),
      /is not an ancestor/u
    );
  });

  await test('prepared execution seals scorer, schema-validator, schema tree, and canonical protocol digests', () => {
    const contract = executionContractDigests();
    assert.deepStrictEqual(Object.keys(contract).sort(), [
      'protocol_tree_sha256', 'schema_validator_sha256', 'schemas_tree_sha256', 'scorer_sha256'
    ]);
    assert.ok(Object.values(contract).every(value => /^[a-f0-9]{64}$/u.test(value)));
    assert.doesNotThrow(() => assertExecutionContract(contract, structuredClone(contract)));
    const drifted = structuredClone(contract);
    drifted.scorer_sha256 = '0'.repeat(64);
    assert.throws(() => assertExecutionContract(contract, drifted), /contract changed after preparation/u);
  });

  await test('run identity never synthesizes a model version from a requested id or family match', () => {
    const clioRow = rowByClient(suite, 'clio');
    const clioIdentity = resolveActualIdentity(clioRow, [{ record: { receipt: {
      model: clioRow.model.id,
      client_version: clioRow.client.version,
      runtime: { effectiveThinkingLevel: clioRow.effort }
    } } }]);
    assert.strictEqual(clioIdentity.model_id, clioRow.model.id);
    assert.strictEqual(clioIdentity.model_version, 'unavailable');

    const claudeRow = rowByClient(suite, 'claude');
    const familyOnly = resolveActualIdentity(claudeRow, [{ record: { observation: { actual: {
      model_id: `${claudeRow.model.id}-20260801`
    } } } }]);
    assert.strictEqual(familyOnly.model_id, 'unavailable');
    assert.strictEqual(familyOnly.model_version, 'unavailable');

    const codexIdentity = resolveActualIdentity(rowByClient(suite, 'codex'), []);
    assert.strictEqual(codexIdentity.model_id, 'unavailable');
    assert.strictEqual(codexIdentity.model_version, 'unavailable');
  });

  await test('native JSONL parsing rejects malformed evidence instead of skipping it', () => {
    assert.deepStrictEqual(parseJsonLines('{"type":"session"}\n\n'), [{ type: 'session' }]);
    assert.throws(() => parseJsonLines('{"type":"session"}\nnot-json\n'), /line 2/u);
  });

  await test('default CLI help is credential-free and independent of local client installations', () => {
    const result = spawnSync(process.execPath, ['evaluation/tools/run-routing-matrix.js', '--help'], {
      cwd: repositoryRoot,
      env: { PATH: process.env.PATH, LANG: process.env.LANG || 'C' },
      encoding: 'utf8',
      timeout: 30000
    });
    assert.strictEqual(result.status, 0, result.stderr);
    assert.match(result.stdout, /No mode means --dry-run/u);
    assert.match(result.stdout, /Credential paths are never accepted in argv/u);
  });

  await test('deterministic dry-run plan reports three executable capability rows', () => {
    const root = temporaryRoot();
    const binaries = Object.fromEntries(['claude', 'codex', 'clio'].map(client => [
      client,
      { ...fakeBinary(root, client), version: `synthetic-${client}` }
    ]));
    const plan = buildDryPlan(parseArgs([], {}), suite, {
      binaries,
      clioSource: {
        root: path.join(root, 'clio-source'),
        commit: '9b7b80ccbd3d2211d4079bc76558bb06d66a8583',
        test_fixture: true
      }
    });
    assert.strictEqual(plan.paid_model_calls, false);
    assert.strictEqual(plan.aggregate.cases, 54);
    assert.strictEqual(plan.aggregate.executable_rows, 3);
    assert.strictEqual(plan.aggregate.paid_execution_ready, true);
    assert.match(plan.repository.commit, /^[a-f0-9]{40}$/u);
    assert.match(plan.repository.tree, /^[a-f0-9]{40}$/u);
    assert.match(plan.repository.worktree_state_sha256, /^[a-f0-9]{64}$/u);
    assert.strictEqual(plan.repository.canonical_source.canonical_commit,
      'cbba38cb0036bc42de6d0ace3e5ebe1d46b3c0e5');
    assert.strictEqual(plan.repository.canonical_source.ancestor_verified, true);
    assert.strictEqual(plan.repository.canonical_source.sha256,
      'f2bf6de3ce6d1c4b0323fc611912179c4b6923c941073caa75b4488e0e6feb47');
    assert.strictEqual(plan.repository.canonical_source.generated_inventories, 9);
    assert.strictEqual(plan.repository.canonical_source.authenticated_generated_entries, 1565);
  });

  if (!process.exitCode) process.stdout.write(`1..${passed}\n`);
}

main().catch(error => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
