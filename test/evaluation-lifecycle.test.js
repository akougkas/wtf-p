#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const { validatePlanningPaths } = require('../evaluation/tools/validate-planning');
const { SchemaRegistry, validateInstance } = require('../evaluation/lib/json-schema');
const {
  ACTION_SEQUENCE,
  ARGUMENT_FIDELITY_MARKER,
  EXPECTED_SECTIONS,
  PROJECT_ID,
  actionPayloads,
  buildActionPlan,
  canonicalJson,
  checkLifecycleRecords,
  checkMutationBoundary,
  diffSnapshots,
  extractInvocationArguments,
  hashTree,
  logicalUriPath,
  parseJsonLines,
  readPlanningRecords,
  sha256,
  snapshotProject
} = require('../evaluation/lib/clio-lifecycle');
const {
  auditStructuredWorkerResult,
  auditLogSummary,
  bindContainedPrivateDirectory,
  buildPlan,
  checkToolMutationBoundary,
  cleanupCredentialArtifacts,
  cleanupCredentialArtifactsSafe,
  containedPrivateFileSha256,
  collectCredentialCandidates,
  collectReceipts,
  createRoot,
  eventToolAudit,
  fleetBoundaryProbe,
  gitControlEqual,
  gitControlSnapshot,
  initializeFixture,
  installExecutionSignalHandlers,
  isolatedPaths,
  isForbiddenToolName,
  minimalEvaluationSettings,
  openPrivateCredential,
  parseArgs,
  profilesEqual,
  readContainedPrivateFile,
  readContainedPrivateFileEvidence,
  requiredDispatchAudit,
  runAction,
  sanitizedChildEnv,
  sessionPrivateState,
  scanAndRedactCredentialValues,
  secureRemove,
  spawnCaptured,
  snapshotProfiles,
  verifyPrepared
} = require('../evaluation/tools/run-clio-lifecycle');

const repositoryRoot = path.resolve(__dirname, '..');
const fixtureRoot = path.join(repositoryRoot, 'evaluation', 'v1', 'fixtures', 'hpc-checkpointing');
const templateRoot = path.join(repositoryRoot, 'protocol', 'project', 'templates');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function fixtureBinding() {
  const manifest = readJson(path.join(fixtureRoot, 'manifest.json'));
  return {
    id: manifest.fixture_id,
    version: manifest.fixture_version,
    model_inputs_sha256: manifest.model_inputs_sha256,
    evaluator_oracles_sha256: manifest.evaluator_oracles_sha256,
    aggregate_sha256: manifest.aggregate_sha256,
    files: manifest.files
  };
}

function sourceBinding() {
  return {
    wtfp: {
      commit: 'a'.repeat(40),
      branch: 'test',
      dirty: false,
      status_entry_count: 0,
      status_sha256: sha256(''),
      protocol_sha256: 'b'.repeat(64),
      extension_sha256: 'c'.repeat(64),
      extension_inventory_entries: 231,
      generator_version: 4,
      generator_source_sha256: '7'.repeat(64),
      generated_manifest_sha256: '8'.repeat(64),
      routing_manifest_sha256: '6'.repeat(64),
      evaluation_runtime: { sha256: '9'.repeat(64), files: [] }
    },
    clio: {
      commit: 'd'.repeat(40),
      branch: 'test',
      dirty: false,
      status_entry_count: 0,
      status_sha256: sha256(''),
      source_sha256: 'e'.repeat(64),
      dist: { sha256: '1'.repeat(64), entries: 12 },
      runtime_modules: { sha256: '2'.repeat(64), entries: 34, excluded: ['.bin/'] },
      node: {
        path: process.execPath,
        sha256: '3'.repeat(64),
        bytes: 1,
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      binary: {
        path: '/opt/clio/index.js',
        dist_relative_path: 'cli/index.js',
        sha256: 'f'.repeat(64),
        bytes: 1
      }
    },
    fixture: fixtureBinding()
  };
}

function planOptions() {
  return {
    binary: '/opt/clio/index.js',
    clioSource: '/opt/clio-source',
    extension: '/opt/wtfp/vendors/clio',
    target: 'openai-codex',
    model: 'gpt-5.6-terra',
    effort: 'xhigh',
    timeoutMinutes: 20,
    budgetUsd: 20
  };
}

function createNewPaperRecords(root) {
  const planning = path.join(root, '.planning');
  const manifest = readJson(path.join(templateRoot, 'manifest.json'));
  manifest.id = PROJECT_ID;
  manifest.title = 'Resilient Checkpoint Coordination for Synthetic HPC Workloads';
  manifest.artifacts.materials = [
    'project://materials/project-brief.md',
    'project://materials/benchmark-observations.md',
    'project://materials/author-decisions.json'
  ];
  const config = readJson(path.join(templateRoot, 'config.json'));
  config.project_id = PROJECT_ID;
  const state = readJson(path.join(templateRoot, 'state.json'));
  state.project_id = PROJECT_ID;
  const outline = readJson(path.join(templateRoot, 'outline.json'));
  outline.project_id = PROJECT_ID;
  const fixtureDecisions = readJson(path.join(fixtureRoot, 'author-decisions.json')).items;
  const decisions = readJson(path.join(templateRoot, 'decisions.json'));
  decisions.project_id = PROJECT_ID;
  decisions.items = fixtureDecisions.map((item, index) => ({
    ...item,
    authority: 'author',
    rationale: 'Exact author decision supplied by the versioned lifecycle fixture.',
    scope_uri: index === 0 ? 'project://manifest' : 'project://structure/outline',
    recorded_at: `2026-08-29T12:0${index}:00Z`
  }));
  writeJson(path.join(planning, 'project.json'), manifest);
  writeJson(path.join(planning, 'config.json'), config);
  writeJson(path.join(planning, 'state.json'), state);
  writeJson(path.join(planning, 'decisions.json'), decisions);
  writeJson(path.join(planning, 'structure', 'outline.json'), outline);
  return fixtureDecisions;
}

function createOutlineRecords(root) {
  const planning = path.join(root, '.planning');
  const outline = readJson(path.join(planning, 'structure', 'outline.json'));
  const roles = ['setup', 'background', 'method', 'evidence', 'synthesis', 'conclusion'];
  const dependencies = [[], [], ['background'], ['method'], ['evaluation'], ['discussion']];
  outline.revision = 2;
  outline.thesis = 'Bounded claims about synthetic checkpoint coordination remain traceable to supplied evidence.';
  outline.target_words = 6000;
  outline.updated_at = '2026-08-29T13:00:00Z';
  outline.sections = EXPECTED_SECTIONS.map((expected, index) => ({
    id: expected.id,
    title: expected.id[0].toUpperCase() + expected.id.slice(1),
    goal: `Establish the bounded ${expected.id} contribution without outrunning supplied evidence.`,
    argument_role: roles[index],
    word_target: expected.words,
    wave: index < 2 ? 1 : index,
    depends_on: dependencies[index],
    claim_ids: [],
    research: { required: false, topics: [] }
  }));
  writeJson(path.join(planning, 'structure', 'outline.json'), outline);

  for (const source of outline.sections) {
    const section = readJson(path.join(templateRoot, 'section.json'));
    Object.assign(section, {
      id: source.id,
      project_id: PROJECT_ID,
      title: source.title,
      goal: source.goal,
      status: 'not-started',
      word_target: source.word_target,
      word_count: 0,
      wave: source.wave,
      depends_on: source.depends_on,
      claims: [],
      artifacts: {
        ...(source.id === 'evaluation' ? {
          context: 'project://sections/evaluation/context',
          research: 'project://sections/evaluation/research'
        } : {}),
        plans: [],
        reviews: []
      },
      checkpoint_uris: [],
      validation_uris: [],
      updated_at: '2026-08-29T13:00:00Z'
    });
    writeJson(path.join(planning, 'sections', source.id, 'section.json'), section);
  }

  const state = readJson(path.join(planning, 'state.json'));
  state.revision = 1;
  state.phase = 'outlining';
  state.current_section_uri = 'project://sections/evaluation';
  state.progress = { sections_total: 6, sections_complete: 0, word_target: 6000, word_count: 0 };
  state.updated_at = '2026-08-29T13:00:00Z';
  writeJson(path.join(planning, 'state.json'), state);

  const validation = readJson(path.join(templateRoot, 'validation.json'));
  Object.assign(validation, {
    id: 'validation-outline-approved',
    project_id: PROJECT_ID,
    subject_uri: 'project://structure/outline',
    validator_role: 'outliner',
    action_id: 'create-outline',
    status: 'passed',
    effects_applied: [],
    executed_at: '2026-08-29T13:01:00Z'
  });
  writeJson(path.join(planning, 'validations', `${validation.id}.json`), validation);
}

function createPlanRecords(root) {
  const planning = path.join(root, '.planning');
  const sectionPath = path.join(planning, 'sections', 'evaluation', 'section.json');
  fs.copyFileSync(path.join(root, 'project-brief.md'), path.join(path.dirname(sectionPath), 'context.md'));
  fs.copyFileSync(path.join(root, 'benchmark-observations.md'), path.join(path.dirname(sectionPath), 'research.md'));
  const planUri = 'project://sections/evaluation/plans/initial';
  const planPath = path.join(path.dirname(sectionPath), 'plans', 'initial.md');
  fs.mkdirSync(path.dirname(planPath), { recursive: true });
  fs.writeFileSync(planPath, '# Evaluation plan\n\nUse only the supplied synthetic observations.\n', { mode: 0o600 });

  const validation = readJson(path.join(templateRoot, 'validation.json'));
  Object.assign(validation, {
    id: 'validation-evaluation-plan',
    project_id: PROJECT_ID,
    subject_uri: planUri,
    validator_role: 'plan-checker',
    action_id: 'plan-section',
    status: 'passed',
    effects_applied: [],
    executed_at: '2026-08-29T13:05:00Z'
  });
  writeJson(path.join(planning, 'validations', `${validation.id}.json`), validation);

  const section = readJson(sectionPath);
  section.status = 'planned';
  section.artifacts.plans = [planUri];
  section.validation_uris = [`project://validations/${validation.id}`];
  section.updated_at = '2026-08-29T13:05:00Z';
  writeJson(sectionPath, section);
  return { planUri, validationPath: path.join(planning, 'validations', `${validation.id}.json`), sectionPath };
}

function testPlan() {
  const options = planOptions();
  assert.deepStrictEqual(minimalEvaluationSettings(options).delegation, {
    agents: [],
    defaults: {
      connectTimeoutMs: 30000,
      turnTimeoutMs: 300000,
      permissionTimeoutMs: 120000,
      toolGovernance: 'clio-policy'
    }
  });
  const actionPlan = buildActionPlan(options);
  assert.deepStrictEqual(actionPlan.map(item => item.action), ACTION_SEQUENCE);
  assert.deepStrictEqual(actionPlan.map(item => item.session), [
    'new:S1', 'resume:S1', 'resume:S1', 'resume:S1', 'resume:S1', 'resume:S1', 'resume:S1',
    'new:S2', 'resume:S2'
  ]);
  for (const action of actionPlan) {
    assert(action.invocation.startsWith(`/wtfp:${action.action}\n`));
    assert(action.invocation_arguments.includes(ARGUMENT_FIDELITY_MARKER));
    assert(action.fidelity.contains_repeated_space);
    assert(action.fidelity.contains_literal_tab);
    assert(action.fidelity.contains_literal_dollar_one);
    assert(action.fidelity.quotes >= 2);
    assert.strictEqual(Buffer.byteLength(action.invocation_arguments, 'utf8'), action.arguments_bytes);
    assert.strictEqual(sha256(action.invocation_arguments), action.arguments_sha256);
  }
  assert(actionPlan[0].invocation_arguments.startsWith('durable workflows\n'));
  assert(actionPlan[7].invocation_arguments.includes('fresh session with no prior conversation'));
  assert(actionPlan[8].cli.argv.includes('read-only'));
  assert(actionPlan.slice(0, 8).every(item => item.cli.argv.includes('auto-edit')));

  const plan = buildPlan(options, sourceBinding(), '/tmp/lifecycle-test-root');
  assert.strictEqual(plan.actions.length, 9);
  assert.deepStrictEqual(plan.sessions.S1.actions, ACTION_SEQUENCE.slice(0, 7));
  assert.deepStrictEqual(plan.sessions.S2.actions, ACTION_SEQUENCE.slice(7));
  assert.strictEqual(plan.sessions.process_boundary.hidden_memory, false);
  assert.strictEqual(plan.requested.network_tools, false);
  assert.strictEqual(plan.requested.vcs_tools, false);
  assert.strictEqual(plan.semantic_assessment.startsWith('independent review'), true);
}

function testArgumentExtraction() {
  const payload = actionPayloads()['new-paper'];
  const envelope = `prefix\n<invocation_arguments>\n${payload}\n</invocation_arguments>\nsuffix`;
  const jsonl = [
    JSON.stringify({ type: 'session', id: 's1' }),
    JSON.stringify({
      type: 'message_end',
      message: { role: 'user', content: [{ type: 'text', text: envelope }] }
    })
  ].join('\n');
  const parsed = parseJsonLines(jsonl);
  assert.deepStrictEqual(parsed.errors, []);
  assert.strictEqual(extractInvocationArguments(parsed.events), payload);
  assert.strictEqual(sha256(extractInvocationArguments(parsed.events)), sha256(payload));
  assert.strictEqual(extractInvocationArguments([{ type: 'message_end', message: { role: 'assistant' } }]), null);
}

function testIsolation(root) {
  const paths = isolatedPaths(root, '/opt/clio-source', 'S1');
  const resumePaths = isolatedPaths(root, '/opt/clio-source', 'S2');
  for (const [key, value] of Object.entries(paths)) {
    if (['CLIO_CODER_REQUIRE_HOME_PREFIX', 'CLIO_CODER_NO_NETWORK_TOOLS', 'CLIO_CODER_PACKAGE_ROOT'].includes(key)) continue;
    assert(value.startsWith(`${root}${path.sep}`), `${key} escaped root`);
  }
  assert.strictEqual(paths.CLIO_CODER_REQUIRE_HOME_PREFIX, '1');
  assert.strictEqual(paths.CLIO_CODER_NO_NETWORK_TOOLS, '1');
  assert.strictEqual(resumePaths.CLIO_CODER_NO_NETWORK_TOOLS, '1');
  assert.notStrictEqual(paths.HOME, resumePaths.HOME);
  assert.notStrictEqual(paths.XDG_STATE_HOME, resumePaths.XDG_STATE_HOME);
  assert.notStrictEqual(paths.CLIO_CODER_DATA_DIR, resumePaths.CLIO_CODER_DATA_DIR);
  assert.notStrictEqual(paths.CLIO_CODER_STATE_DIR, resumePaths.CLIO_CODER_STATE_DIR);
  assert.notStrictEqual(paths.CLIO_CODER_CACHE_DIR, resumePaths.CLIO_CODER_CACHE_DIR);
  assert.strictEqual(paths.CLIO_CODER_CONFIG_DIR, resumePaths.CLIO_CODER_CONFIG_DIR);

  const hostile = {
    WTFP_TEST_SECRET_TOKEN: 'must-not-propagate',
    GIT_DIR: '/outside/git',
    GIT_WORK_TREE: '/outside/tree',
    CODEX_HOME: '/outside/codex',
    NODE_OPTIONS: '--require=/outside/inject.js',
    CLIO_CODER_STATE_DIR: '/outside/clio-state',
    PATH: '/outside/operator-bin'
  };
  const original = Object.fromEntries(Object.keys(hostile).map(key => [key, process.env[key]]));
  Object.assign(process.env, hostile);
  const child = sanitizedChildEnv(paths);
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  assert.strictEqual(child.WTFP_TEST_SECRET_TOKEN, undefined);
  assert.strictEqual(child.GIT_DIR, undefined);
  assert.strictEqual(child.GIT_WORK_TREE, undefined);
  assert.strictEqual(child.CODEX_HOME, undefined);
  assert.strictEqual(child.NODE_OPTIONS, undefined);
  assert.strictEqual(child.PATH, [path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter));
  assert.strictEqual(child.HOME, paths.HOME);
  assert.strictEqual(child.CLIO_CODER_CONFIG_DIR, paths.CLIO_CODER_CONFIG_DIR);
  assert.strictEqual(child.CLIO_CODER_STATE_DIR, paths.CLIO_CODER_STATE_DIR);
  assert.strictEqual(child.CLIO_CODER_NO_NETWORK_TOOLS, '1');

  for (const [key, directory] of Object.entries(resumePaths)) {
    if (key === 'HOME' || key === 'TMPDIR' || key.startsWith('XDG_') ||
      (key.startsWith('CLIO_CODER_') && key.endsWith('_DIR'))) {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    }
  }
  const pristine = sessionPrivateState(resumePaths, root);
  assert.strictEqual(pristine.pristine, true);
  const contamination = path.join(resumePaths.CLIO_CODER_STATE_DIR, 'hidden-session.json');
  fs.writeFileSync(contamination, '{}\n', { mode: 0o600 });
  assert.strictEqual(sessionPrivateState(resumePaths, root).pristine, false);
  fs.unlinkSync(contamination);
  assert.strictEqual(sessionPrivateState(resumePaths, root).sha256, pristine.sha256);
}

function testFixtureAndGit(root) {
  const project = path.join(root, 'project');
  const initialized = initializeFixture(project, fixtureBinding());
  assert.match(initialized.commit, /^[a-f0-9]{40}$/u);
  assert(fs.existsSync(path.join(project, 'project-brief.md')));
  assert(fs.existsSync(path.join(project, 'benchmark-observations.md')));
  assert(fs.existsSync(path.join(project, 'author-decisions.json')));
  assert(!fs.existsSync(path.join(project, 'expected-invariants.json')));
  const gitBefore = gitControlSnapshot(project);
  const gitAfter = gitControlSnapshot(project);
  assert(gitControlEqual(gitBefore, gitAfter));
  return project;
}

function testPlanningAndMutation(project) {
  const before = snapshotProject(project);
  const recordsBefore = readPlanningRecords(project);
  const expectedDecisions = createNewPaperRecords(project);
  const after = snapshotProject(project);
  const recordsAfter = readPlanningRecords(project);
  const mutation = checkMutationBoundary('new-paper', before, after, recordsBefore, recordsAfter);
  assert.deepStrictEqual(mutation.errors, []);
  assert.strictEqual(mutation.valid, true);
  const literal = validatePlanningPaths([project]);
  assert.strictEqual(literal.valid, true, JSON.stringify(literal, null, 2));
  const cross = checkLifecycleRecords(project, expectedDecisions, 'new-paper');
  assert.strictEqual(cross.valid, true, cross.errors.join('\n'));

  const decisionsPath = path.join(project, '.planning', 'decisions.json');
  const decisions = readJson(decisionsPath);
  decisions.items[0].disposition = 'deferred';
  writeJson(decisionsPath, decisions);
  const invalid = checkLifecycleRecords(project, expectedDecisions, 'new-paper');
  assert.strictEqual(invalid.valid, false);
  assert(invalid.errors.some(error => error.includes('bounded-central-claim: disposition')));
  decisions.items[0].disposition = 'locked';
  writeJson(decisionsPath, decisions);
  decisions.items.push({
    ...decisions.items[0],
    id: 'invented-extra-author-decision',
    statement: 'This decision was not supplied by the author.'
  });
  writeJson(decisionsPath, decisions);
  const extraDecision = checkLifecycleRecords(project, expectedDecisions, 'new-paper');
  assert.strictEqual(extraDecision.valid, false);
  assert(extraDecision.errors.some(error => error.includes('author decisions must be exactly')));
  decisions.items.pop();
  writeJson(decisionsPath, decisions);

  const source = readJson(path.join(templateRoot, 'source.json'));
  source.id = 'canonical-source-id';
  source.project_id = PROJECT_ID;
  writeJson(path.join(project, '.planning', 'sources', 'wrong-file-id.json'), source);
  const misplaced = checkLifecycleRecords(project, expectedDecisions, 'new-paper');
  assert.strictEqual(misplaced.valid, false);
  assert(misplaced.errors.some(error => error.includes('resolves canonically')));
  fs.rmSync(path.join(project, '.planning', 'sources'), { recursive: true });

  assert.strictEqual(
    logicalUriPath(project, 'project://sections/evaluation/plans/initial'),
    path.join(project, '.planning', 'sections', 'evaluation', 'plans', 'initial.md')
  );
  assert.strictEqual(logicalUriPath(project, 'project://paper/evaluation.md'), path.join(project, 'paper', 'evaluation.md'));

  const beforeOutlineRecords = readPlanningRecords(project);
  createOutlineRecords(project);
  const outlineSchema = validatePlanningPaths([project]);
  assert.strictEqual(outlineSchema.valid, true, JSON.stringify(outlineSchema, null, 2));
  const outlineRecords = readPlanningRecords(project);
  const outlineCross = checkLifecycleRecords(project, expectedDecisions, 'create-outline', beforeOutlineRecords);
  assert.strictEqual(outlineCross.valid, true, outlineCross.errors.join('\n'));

  const planFiles = createPlanRecords(project);
  const planSchema = validatePlanningPaths([project]);
  assert.strictEqual(planSchema.valid, true, JSON.stringify(planSchema, null, 2));
  const planCross = checkLifecycleRecords(project, expectedDecisions, 'plan-section', outlineRecords);
  assert.strictEqual(planCross.valid, true, planCross.errors.join('\n'));

  const planValidation = readJson(planFiles.validationPath);
  planValidation.subject_uri = 'project://structure/outline';
  writeJson(planFiles.validationPath, planValidation);
  const wrongSubject = checkLifecycleRecords(project, expectedDecisions, 'plan-section', outlineRecords);
  assert.strictEqual(wrongSubject.valid, false);
  assert(wrongSubject.errors.some(error => error.includes('subject_uri is not the validated plan-section artifact')));
  planValidation.subject_uri = planFiles.planUri;
  writeJson(planFiles.validationPath, planValidation);

  const evaluationSection = readJson(planFiles.sectionPath);
  evaluationSection.validation_uris = [];
  writeJson(planFiles.sectionPath, evaluationSection);
  const unlinked = checkLifecycleRecords(project, expectedDecisions, 'plan-section', outlineRecords);
  assert.strictEqual(unlinked.valid, false);
  assert(unlinked.errors.some(error => error.includes('validation is not linked')));
  evaluationSection.validation_uris = ['project://validations/validation-evaluation-plan'];
  writeJson(planFiles.sectionPath, evaluationSection);

  planValidation.executed_at = '2026-08-29T13:00:00Z';
  writeJson(planFiles.validationPath, planValidation);
  const unordered = checkLifecycleRecords(project, expectedDecisions, 'plan-section', outlineRecords);
  assert.strictEqual(unordered.valid, false);
  assert(unordered.errors.some(error => error.includes('does not strictly follow earlier lifecycle validation')));
  planValidation.executed_at = '2026-08-29T13:05:00Z';
  writeJson(planFiles.validationPath, planValidation);

  const duplicatePlanValidation = { ...planValidation, id: 'validation-evaluation-plan-duplicate' };
  writeJson(path.join(project, '.planning', 'validations', `${duplicatePlanValidation.id}.json`), duplicatePlanValidation);
  const duplicated = checkLifecycleRecords(project, expectedDecisions, 'plan-section', outlineRecords);
  assert.strictEqual(duplicated.valid, false);
  assert(duplicated.errors.some(error => error.includes('requires exactly one plan-checker validation')));
  fs.unlinkSync(path.join(project, '.planning', 'validations', `${duplicatePlanValidation.id}.json`));

  const progressBefore = snapshotProject(project);
  fs.writeFileSync(path.join(project, 'unexpected.txt'), 'unexpected\n');
  const progress = checkMutationBoundary('progress', progressBefore, snapshotProject(project), recordsAfter, recordsAfter);
  assert.strictEqual(progress.valid, false);
  assert(progress.errors.some(error => error.includes('read-only action changed')));
  fs.unlinkSync(path.join(project, 'unexpected.txt'));

  const permissionBefore = snapshotProject(project);
  const brief = path.join(project, 'project-brief.md');
  fs.chmodSync(brief, 0o644);
  const permissionChanges = diffSnapshots(permissionBefore, snapshotProject(project));
  assert(permissionChanges.some(change => change.path === 'project-brief.md' && change.change === 'modified'));
  assert.strictEqual(checkMutationBoundary('progress', permissionBefore, snapshotProject(project), recordsAfter, recordsAfter).valid, false);
  fs.chmodSync(brief, 0o600);

  const directoryBefore = snapshotProject(project);
  fs.mkdirSync(path.join(project, 'empty-unexpected-directory'));
  const directoryChanges = diffSnapshots(directoryBefore, snapshotProject(project));
  assert(directoryChanges.some(change => change.path === 'empty-unexpected-directory' && change.change === 'created'));
  assert.strictEqual(checkMutationBoundary('progress', directoryBefore, snapshotProject(project), recordsAfter, recordsAfter).valid, false);
  fs.rmdirSync(path.join(project, 'empty-unexpected-directory'));
}

function testToolAudit(root, project) {
  const extension = path.join(root, 'extension');
  fs.mkdirSync(extension);
  const dispatchArgs = agent => ({
    agent,
    task: `Run exact ${agent} contract`,
    target: 'openai-codex',
    model: 'gpt-5.6-terra',
    thinking_level: 'xhigh',
    node: 'local'
  });
  const dispatchEnd = (toolCallId, agent) => ({
    type: 'tool_execution_end',
    toolCallId,
    toolName: 'dispatch',
    result: {
      details: {
        assignmentIds: [`assignment-${agent}`],
        terminalRunIds: [`run-${agent}`],
        runs: [{
          runId: `run-${agent}`,
          agentId: agent,
          exitCode: 0,
          receiptIntegrity: { ok: true }
        }]
      }
    },
    isError: false,
    outcome: 'ok'
  });
  const safe = eventToolAudit([
    { type: 'tool_execution_start', toolName: 'read', args: { path: 'project-brief.md' } },
    { type: 'tool_execution_start', toolCallId: 'planner', toolName: 'dispatch', args: dispatchArgs('wtfp-section-planner') },
    dispatchEnd('planner', 'wtfp-section-planner'),
    { type: 'tool_execution_start', toolCallId: 'checker', toolName: 'dispatch', args: dispatchArgs('wtfp-plan-checker') },
    dispatchEnd('checker', 'wtfp-plan-checker')
  ], { project, isolated: root, extension });
  assert.strictEqual(safe.valid, true);
  assert.strictEqual(safe.dispatch.length, 2);
  const sealedReceipt = agent => {
    const sequence = agent === 'wtfp-section-planner' ? 1 : 3;
    const mutation = agent === 'wtfp-section-planner';
    const result = mutation ? {
      mutatedPaths: ['.planning/sections/evaluation/plans/initial.md'],
      validations: [{ name: 'Plan schema', passed: true, evidence: 'plan schema passed' }]
    } : {
      verdict: 'pass',
      checks: [{ name: 'Plan coverage', passed: true, evidence: 'all obligations are covered' }]
    };
    const text = JSON.stringify(result);
    const contractKind = mutation ? 'mutation-report' : 'verifier-report';
    const receipt = {
      run_id: `run-${agent}`,
      agent_id: agent,
      target: 'openai-codex',
      model: 'gpt-5.6-terra',
      runtime_id: 'openai-codex',
      runtime_kind: 'http',
      node: { id: 'local', kind: 'local' },
      task_bytes: Buffer.byteLength(dispatchArgs(agent).task, 'utf8'),
      task_sha256: sha256(Buffer.from(dispatchArgs(agent).task, 'utf8')),
      outcome: 'succeeded',
      exit_code: 0,
      started_at: `2026-08-29T12:00:0${sequence}Z`,
      ended_at: `2026-08-29T12:00:0${sequence + 1}Z`,
      lineage: { rootRunId: `assignment-${agent}`, parentRunId: `assignment-${agent}`, attempt: 0, depth: 1 },
      runtime: {
        target: 'openai-codex',
        model: 'gpt-5.6-terra',
        runtime_id: 'openai-codex',
        runtime_kind: 'http',
        requested_effort: 'xhigh',
        effective_effort: 'xhigh',
        auth: 'oauth',
        auth_required: true,
        api_family: 'openai-codex-responses',
        runtime_tier: 'cloud',
        diagnostics: []
      },
      integrity_verification: { valid: true },
      result_contract: {
        sourceId: `agent-result-contract:${contractKind}:${'a'.repeat(64)}`,
        validatorDigest: 'b'.repeat(64),
        conformance: 'pass',
        quality: 'pass'
      },
      output: {
        state: 'final',
        bytes: Buffer.byteLength(text, 'utf8'),
        captured_bytes: Buffer.byteLength(text, 'utf8'),
        truncated: false,
        sha256: sha256(Buffer.from(text, 'utf8'))
      }
    };
    Object.defineProperty(receipt, 'output_text', { value: text, enumerable: false, writable: false });
    return receipt;
  };
  const structuredEvidence = {
    projectRoot: project,
    mutation: {
      valid: true,
      changes: [{
        path: '.planning/sections/evaluation/plans/initial.md',
        change: 'created',
        before: null,
        after: { kind: 'file' }
      }]
    },
    schemaValidation: { valid: true },
    records: [{
      type: 'validation',
      path: '.planning/validations/plan-check.json',
      value: {
        action_id: 'plan-section',
        validator_role: 'plan-checker',
        status: 'passed',
        checks: [{
          id: 'plan-coverage',
          status: 'passed',
          summary: 'Plan coverage',
          evidence: ['all obligations are covered']
        }]
      }
    }]
  };
  assert.strictEqual(requiredDispatchAudit('plan-section', safe, [
    sealedReceipt('wtfp-section-planner'), sealedReceipt('wtfp-plan-checker')
  ], undefined, structuredEvidence).valid, true);
  assert.strictEqual(requiredDispatchAudit('write-section', safe).valid, false);
  const failedDispatch = eventToolAudit([
    { type: 'tool_execution_start', toolCallId: 'outliner', toolName: 'dispatch', args: { agent: 'wtfp-outliner' } },
    { type: 'tool_execution_end', toolCallId: 'outliner', toolName: 'dispatch', result: { status: 'failed' }, isError: false, outcome: 'failed' }
  ], { project, isolated: root, extension });
  assert.strictEqual(failedDispatch.dispatch[0].terminal_success, false);
  assert.strictEqual(requiredDispatchAudit('create-outline', failedDispatch, [sealedReceipt('wtfp-outliner')]).valid, false);
  for (const outcome of ['succeeded', 'blocked', undefined]) {
    const event = {
      type: 'tool_execution_end',
      toolCallId: `outliner-${outcome || 'missing'}`,
      toolName: 'dispatch',
      result: {},
      isError: false
    };
    if (outcome !== undefined) event.outcome = outcome;
    const audit = eventToolAudit([
      {
        type: 'tool_execution_start',
        toolCallId: event.toolCallId,
        toolName: 'dispatch',
        args: { agent: 'wtfp-outliner' }
      },
      event
    ], { project, isolated: root, extension });
    assert.strictEqual(audit.dispatch[0].terminal_success, false,
      `tool outcome ${String(outcome)} must not be treated as terminal success`);
  }
  const safeWrite = eventToolAudit([
    { type: 'tool_execution_start', toolName: 'write', args: { path: '.planning/sections/evaluation/plans/initial.md' } }
  ], { project, isolated: root, extension });
  assert.strictEqual(checkToolMutationBoundary('plan-section', [safeWrite], project).valid, true);
  const unsafeWrite = eventToolAudit([
    { type: 'tool_execution_start', toolName: 'edit', args: { path: 'project-brief.md' } }
  ], { project, isolated: root, extension });
  assert.strictEqual(checkToolMutationBoundary('plan-section', [unsafeWrite], project).valid, false);
  const unsafe = eventToolAudit([
    { type: 'tool_execution_start', toolName: 'bash', args: { command: 'git status' } },
    { type: 'tool_execution_start', toolName: 'read', args: { path: '/etc/passwd' } }
  ], { project, isolated: root, extension });
  assert.strictEqual(unsafe.valid, false);
  assert(unsafe.errors.some(error => error.includes('forbidden tool')));
  assert(unsafe.errors.some(error => error.includes('escaped authorized roots')));
  assert(isForbiddenToolName('web_fetch'));
  assert(isForbiddenToolName('citation-fetch'));
  assert(!isForbiddenToolName('find'));

  const auditRoot = path.join(root, 'clio', 'state', 'audit');
  fs.mkdirSync(auditRoot, { recursive: true });
  fs.writeFileSync(path.join(auditRoot, 'test.jsonl'), [
    JSON.stringify({ kind: 'tool_call', correlationId: 'one', tool: 'read', args: { path: 'project-brief.md' } }),
    JSON.stringify({ kind: 'tool_call', correlationId: 'two', tool: 'web_fetch', args: { url: 'https://example.invalid' } })
  ].join('\n'));
  const aggregate = auditLogSummary(root, { project, isolated: root, extension });
  assert.strictEqual(aggregate.valid, false);
  assert(aggregate.tool_audit.errors.some(error => error.includes('web_fetch')));
}

function testFleetBoundaryProbe(root) {
  const clioSource = path.join(root, 'fleet-probe-clio');
  const dist = path.join(clioSource, 'dist');
  const installed = path.join(root, 'fleet-probe-extension');
  fs.mkdirSync(dist, { recursive: true });
  fs.mkdirSync(path.join(installed, 'fleets'), { recursive: true });
  fs.writeFileSync(path.join(clioSource, 'package.json'), '{"type":"module"}\n');
  const moduleFile = path.join(dist, 'chunk-TEST.js');
  const boundaryModule = [
    'function parseFleetContract(raw) {',
    '  const name = raw.match(/^name:\\s*(.+)$/m)?.[1];',
    '  const id = name === "wtfp-plan-section" ? "plan" : "draft";',
    '  const match = raw.match(/writes:\\s*\\[([^\\]]+)\\]/);',
    '  const writes = match ? match[1].split(",").map(value => value.trim()) : [];',
    '  return { name, steps: [{ id, writes }] };',
    '}',
    'function fleetStepBoundaries(contract) {',
    '  return contract.steps.map(step => ({ id: step.id, scope: "workspace", writes: [...step.writes].sort() }));',
    '}',
    'function writeBoundaryCovers(boundary, candidate) {',
    '  return boundary.some(entry => entry.endsWith("/") ? candidate.startsWith(entry) : candidate === entry);',
    '}',
    'export { parseFleetContract, fleetStepBoundaries, writeBoundaryCovers, };'
  ].join('\n');
  fs.writeFileSync(moduleFile, boundaryModule);
  for (const fleet of ['wtfp-plan-section.md', 'wtfp-draft-review.md']) {
    fs.copyFileSync(path.join(repositoryRoot, 'vendors', 'clio', 'fleets', fleet), path.join(installed, 'fleets', fleet));
  }
  const valid = fleetBoundaryProbe(clioSource, installed);
  assert.strictEqual(valid.valid, true, JSON.stringify(valid, null, 2));
  assert.strictEqual(valid.checks.plan_covers_nested_plan, true);
  assert.strictEqual(valid.checks.draft_covers_manuscript, true);

  const planFile = path.join(installed, 'fleets', 'wtfp-plan-section.md');
  fs.writeFileSync(planFile, fs.readFileSync(planFile, 'utf8').replace('writes: [.planning/]', 'writes: [.planning]'));
  const unsafe = fleetBoundaryProbe(clioSource, installed);
  assert.strictEqual(unsafe.valid, false);
  assert.strictEqual(unsafe.checks.plan_exact_boundary, false);
  assert.strictEqual(unsafe.checks.plan_covers_nested_plan, false);

  fs.writeFileSync(moduleFile, boundaryModule.replace(
    'export { parseFleetContract, fleetStepBoundaries, writeBoundaryCovers, };',
    'export { parseFleetContract, writeBoundaryCovers, };'
  ));
  assert.throws(() => fleetBoundaryProbe(clioSource, installed), /canonical fleet-boundary probe returned malformed JSON/);
}

function testCredentialHandling(root) {
  const credential = path.join(root, 'credential-test.yaml');
  const candidate = 'test-secret-value-1234567890';
  fs.writeFileSync(credential, `openai:\n  token: ${candidate}\n`, { mode: 0o600 });
  const candidates = collectCredentialCandidates(fs.readFileSync(credential, 'utf8'));
  assert(candidates.includes(candidate));
  const evidence = path.join(root, 'credential-evidence.txt');
  fs.writeFileSync(evidence, `accidental ${candidate}\n`, { mode: 0o600 });
  const scan = scanAndRedactCredentialValues(root, credential, candidates);
  assert.strictEqual(scan.valid, true);
  assert(scan.findings.some(finding => finding.path === 'credential-evidence.txt'));
  assert(!fs.readFileSync(evidence, 'utf8').includes(candidate));
  assert(fs.readFileSync(evidence, 'utf8').includes('[REDACTED-CREDENTIAL]'));
  const cleanup = secureRemove(credential);
  assert.strictEqual(cleanup.status, 'securely-removed');
  assert.strictEqual(cleanup.absent, true);
  assert(!fs.existsSync(credential));

  const unsafeScanRoot = path.join(root, 'unsafe-credential-scan');
  fs.mkdirSync(unsafeScanRoot);
  const oversized = path.join(unsafeScanRoot, 'oversized.bin');
  const descriptor = fs.openSync(oversized, 'w');
  fs.ftruncateSync(descriptor, 128 * 1024 * 1024 + 1);
  fs.closeSync(descriptor);
  fs.symlinkSync('/nonexistent/scan-target', path.join(unsafeScanRoot, 'dangling-link'));
  const unreadable = path.join(unsafeScanRoot, 'unreadable.txt');
  fs.writeFileSync(unreadable, candidate);
  fs.chmodSync(unreadable, 0o000);
  const unsafeScan = scanAndRedactCredentialValues(unsafeScanRoot, path.join(unsafeScanRoot, 'credentials.yaml'), [candidate]);
  assert.strictEqual(unsafeScan.valid, false);
  assert(unsafeScan.anomalies.some(anomaly => anomaly.reason.includes('128 MiB')));
  assert(unsafeScan.anomalies.some(anomaly => anomaly.reason.includes('symlink')));
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
    assert(unsafeScan.anomalies.some(anomaly => anomaly.reason.includes('read failed')));
  }
  fs.chmodSync(unreadable, 0o600);

  const scanHardLinkSentinel = path.join(root, 'credential-scan-external-sentinel.txt');
  const scanHardLink = path.join(unsafeScanRoot, 'multiply-linked-sentinel.txt');
  fs.writeFileSync(scanHardLinkSentinel, `external ${candidate} must not be redacted\n`, { mode: 0o600 });
  const scanHardLinkSentinelBytes = fs.readFileSync(scanHardLinkSentinel);
  fs.linkSync(scanHardLinkSentinel, scanHardLink);
  const hardLinkScan = scanAndRedactCredentialValues(
    unsafeScanRoot,
    path.join(unsafeScanRoot, 'credentials.yaml'),
    [candidate]
  );
  assert.strictEqual(hardLinkScan.valid, false);
  assert(hardLinkScan.anomalies.some(anomaly =>
    anomaly.path === 'multiply-linked-sentinel.txt' && anomaly.reason.includes('multiply linked')));
  assert.deepStrictEqual(fs.readFileSync(scanHardLinkSentinel), scanHardLinkSentinelBytes,
    'credential scanning must never redact through a hard link to an external sentinel');
  fs.unlinkSync(scanHardLink);

  const config = path.join(root, 'credential-config');
  fs.mkdirSync(config);
  const primary = path.join(config, 'credentials.yaml');
  fs.writeFileSync(primary, `token: ${candidate}\n`, { mode: 0o600 });
  fs.writeFileSync(path.join(config, 'credentials.yaml.tmp'), `token: ${candidate}\n`, { mode: 0o600 });
  fs.writeFileSync(path.join(config, '.credentials.yaml.tmp-123'), `token: ${candidate}\n`, { mode: 0o600 });
  fs.symlinkSync('/nonexistent/credential-target', path.join(config, 'credentials.yaml.lock'));
  const allCleanup = cleanupCredentialArtifacts(config, primary);
  assert.strictEqual(allCleanup.status, 'securely-removed');
  assert.strictEqual(allCleanup.absent, true);
  assert.strictEqual(fs.readdirSync(config).length, 0);

  const nativeConfig = path.join(root, 'native-placeholder-config');
  const nativePlaceholder = path.join(nativeConfig, 'credentials.yaml');
  fs.mkdirSync(nativeConfig, { mode: 0o700 });
  fs.writeFileSync(nativePlaceholder, Buffer.alloc(93, 0x78), { mode: 0o600 });
  assert.strictEqual(fs.statSync(nativePlaceholder).size, 93);
  const nativeCleanup = cleanupCredentialArtifactsSafe(nativeConfig, nativePlaceholder, root);
  assert.strictEqual(nativeCleanup.status, 'securely-removed');
  assert.strictEqual(nativeCleanup.absent, true);
  assert.strictEqual(fs.existsSync(nativePlaceholder), false);

  const changedConfig = path.join(root, 'changed-credential-config');
  fs.symlinkSync('/nonexistent/outside-config', changedConfig);
  const safeFailure = cleanupCredentialArtifactsSafe(changedConfig, path.join(changedConfig, 'credentials.yaml'));
  assert.strictEqual(safeFailure.status, 'cleanup-failed');
  fs.unlinkSync(changedConfig);

  const substitutionRoot = path.join(root, 'credential-ancestor-substitution');
  const clioDirectory = path.join(substitutionRoot, 'clio');
  const substitutedConfig = path.join(clioDirectory, 'config');
  const substitutedCredential = path.join(substitutedConfig, 'credentials.yaml');
  fs.mkdirSync(substitutionRoot, { mode: 0o700 });
  const syntheticBytes = Buffer.from('token: synthetic-retained-descriptor-secret\n', 'utf8');
  const retained = openPrivateCredential(substitutedCredential, syntheticBytes);
  retained.directory_binding = bindContainedPrivateDirectory(
    substitutionRoot,
    substitutedConfig,
    'synthetic isolated Clio config root'
  );
  assert.strictEqual(retained.links, 1);
  const originalClioDirectory = path.join(substitutionRoot, 'clio-original');
  fs.renameSync(clioDirectory, originalClioDirectory);
  const externalRoot = path.join(root, 'external-credential-sentinel');
  const externalConfig = path.join(externalRoot, 'config');
  const externalSentinel = path.join(externalConfig, 'credentials.yaml');
  const externalSettings = path.join(externalConfig, 'settings.yaml');
  fs.mkdirSync(externalConfig, { recursive: true, mode: 0o700 });
  fs.writeFileSync(externalSentinel, 'external sentinel must survive\n', { mode: 0o600 });
  fs.writeFileSync(externalSettings, 'external settings must never be read\n', { mode: 0o600 });
  const sentinelBefore = sha256(fs.readFileSync(externalSentinel));
  const externalSettingsBefore = sha256(fs.readFileSync(externalSettings));
  fs.symlinkSync(externalRoot, clioDirectory);
  assert.throws(() => containedPrivateFileSha256(
    substitutionRoot,
    substitutedConfig,
    path.join(substitutedConfig, 'settings.yaml'),
    'synthetic isolated settings'
  ), /symbolic, non-directory, or non-private ancestor/u);
  assert.strictEqual(sha256(fs.readFileSync(externalSettings)), externalSettingsBefore,
    'settings hashing must fail before following a substituted config ancestor');
  const substitutedCleanup = cleanupCredentialArtifactsSafe(
    substitutedConfig,
    substitutedCredential,
    substitutionRoot,
    retained
  );
  assert.strictEqual(substitutedCleanup.status, 'cleanup-failed');
  assert.strictEqual(substitutedCleanup.absent, false);
  assert.strictEqual(substitutedCleanup.descriptor_identity_verified, true);
  assert.strictEqual(substitutedCleanup.descriptor_wiped, true);
  assert.strictEqual(substitutedCleanup.descriptor_closed, true);
  assert.strictEqual(substitutedCleanup.links_before_overwrite, 1);
  assert.strictEqual(retained.wiped, true);
  assert.strictEqual(retained.closed, true);
  assert.strictEqual(fs.statSync(path.join(originalClioDirectory, 'config', 'credentials.yaml')).size, 0,
    'the retained descriptor must wipe the original inode after ancestor substitution');
  assert.strictEqual(sha256(fs.readFileSync(externalSentinel)), sentinelBefore,
    'cleanup must never follow a substituted ancestor into an external credentials.yaml');
  assert.strictEqual(cleanupCredentialArtifactsSafe(
    substitutedConfig, substitutedCredential, substitutionRoot, retained).status, 'cleanup-failed');
  assert.strictEqual(sha256(fs.readFileSync(externalSentinel)), sentinelBefore,
    'repeat cleanup must remain idempotent and fail closed without touching the sentinel');

  const reboundRoot = path.join(root, 'credential-directory-identity-substitution');
  const reboundConfig = path.join(reboundRoot, 'config');
  const reboundCredential = path.join(reboundConfig, 'credentials.yaml');
  const reboundOriginalConfig = path.join(reboundRoot, 'config-original');
  fs.mkdirSync(reboundConfig, { recursive: true, mode: 0o700 });
  const reboundBinding = bindContainedPrivateDirectory(
    reboundRoot,
    reboundConfig,
    'synthetic rebound credential config root'
  );
  const reboundHandle = openPrivateCredential(
    reboundCredential,
    Buffer.from('token: synthetic-rebound-original-secret\n', 'utf8')
  );
  reboundHandle.directory_binding = reboundBinding;
  fs.renameSync(reboundConfig, reboundOriginalConfig);
  fs.mkdirSync(reboundConfig, { mode: 0o700 });
  const reboundSentinel = Buffer.from('replacement-directory sentinel must survive\n', 'utf8');
  fs.writeFileSync(reboundCredential, reboundSentinel, { mode: 0o600 });
  assert.throws(() => readContainedPrivateFileEvidence(
    reboundRoot,
    reboundConfig,
    reboundCredential,
    'synthetic rebound credentials',
    { maxBytes: 1024, directoryBinding: reboundBinding, approveCredentialRotation: true }
  ), /directory binding changed/u);
  const reboundCleanup = cleanupCredentialArtifactsSafe(
    reboundConfig,
    reboundCredential,
    reboundRoot,
    reboundHandle
  );
  assert.strictEqual(reboundCleanup.status, 'cleanup-failed');
  assert.strictEqual(reboundCleanup.directory_binding_verified, false);
  assert.deepStrictEqual(fs.readFileSync(reboundCredential), reboundSentinel,
    'a same-path replacement directory must not redirect credential cleanup');
  assert.strictEqual(fs.statSync(path.join(reboundOriginalConfig, 'credentials.yaml')).size, 0,
    'the retained original inode must still be wiped after directory identity substitution');

  const rotationRoot = path.join(root, 'credential-atomic-rotation');
  const rotationConfig = path.join(rotationRoot, 'config');
  const rotationCredential = path.join(rotationConfig, 'credentials.yaml');
  const rotationTemporary = path.join(rotationConfig, '.credentials.yaml.rotation');
  fs.mkdirSync(rotationConfig, { recursive: true, mode: 0o700 });
  const rotationBinding = bindContainedPrivateDirectory(
    rotationRoot,
    rotationConfig,
    'synthetic rotated credential config root'
  );
  const rotationHandle = openPrivateCredential(
    rotationCredential,
    Buffer.from('token: synthetic-original-rotation-secret\n', 'utf8')
  );
  rotationHandle.directory_binding = rotationBinding;
  const rotatedBytes = Buffer.from('token: synthetic-approved-rotated-secret\n', 'utf8');
  fs.writeFileSync(rotationTemporary, rotatedBytes, { mode: 0o600 });
  fs.renameSync(rotationTemporary, rotationCredential);
  const rotationEvidence = readContainedPrivateFileEvidence(
    rotationRoot,
    rotationConfig,
    rotationCredential,
    'synthetic rotated credentials',
    { maxBytes: 1024, directoryBinding: rotationBinding, approveCredentialRotation: true }
  );
  assert.deepStrictEqual(rotationEvidence.bytes, rotatedBytes);
  const rotationCleanup = cleanupCredentialArtifactsSafe(
    rotationConfig,
    rotationCredential,
    rotationRoot,
    rotationHandle,
    rotationEvidence
  );
  assert.strictEqual(rotationCleanup.status, 'securely-removed');
  assert.strictEqual(rotationCleanup.absent, true);
  assert.strictEqual(rotationCleanup.directory_binding_verified, true);
  const rotatedResult = rotationCleanup.files.find(file => file.path === 'credentials.yaml');
  assert.strictEqual(rotatedResult.method, 'rotated-inode');
  assert.strictEqual(rotatedResult.inode_disposition, 'rotated-inode');
  assert.strictEqual(fs.existsSync(rotationCredential), false);
  assert.strictEqual(rotationCleanup.links_before_overwrite, 0,
    'atomic replacement must leave only the retained descriptor referencing the original inode');

  const unapprovedRoot = path.join(root, 'credential-unapproved-singleton');
  const unapprovedConfig = path.join(unapprovedRoot, 'config');
  const unapprovedCredential = path.join(unapprovedConfig, 'credentials.yaml');
  const unapprovedTemporary = path.join(unapprovedConfig, '.credentials.yaml.rotation');
  fs.mkdirSync(unapprovedConfig, { recursive: true, mode: 0o700 });
  const unapprovedBinding = bindContainedPrivateDirectory(
    unapprovedRoot,
    unapprovedConfig,
    'synthetic unapproved credential config root'
  );
  const unapprovedHandle = openPrivateCredential(
    unapprovedCredential,
    Buffer.from('token: synthetic-unapproved-original-secret\n', 'utf8')
  );
  unapprovedHandle.directory_binding = unapprovedBinding;
  const unapprovedBytes = Buffer.from('unapproved singleton sentinel must survive\n', 'utf8');
  fs.writeFileSync(unapprovedTemporary, unapprovedBytes, { mode: 0o600 });
  fs.renameSync(unapprovedTemporary, unapprovedCredential);
  const genericReadEvidence = readContainedPrivateFileEvidence(
    unapprovedRoot,
    unapprovedConfig,
    unapprovedCredential,
    'synthetic unapproved singleton',
    { maxBytes: 1024, directoryBinding: unapprovedBinding }
  );
  const unapprovedCleanup = cleanupCredentialArtifactsSafe(
    unapprovedConfig,
    unapprovedCredential,
    unapprovedRoot,
    unapprovedHandle,
    genericReadEvidence
  );
  assert.strictEqual(unapprovedCleanup.status, 'cleanup-failed');
  assert.strictEqual(unapprovedCleanup.absent, false);
  assert(unapprovedCleanup.files.some(file =>
    file.path === 'credentials.yaml' && file.method === 'refused-substituted-singleton'));
  assert.deepStrictEqual(fs.readFileSync(unapprovedCredential), unapprovedBytes,
    'a singleton replacement without a quiescence-gated rotation approval must remain untouched');
  assert.strictEqual(secureRemove(unapprovedCredential, {
    configRoot: unapprovedConfig,
    disposableRoot: unapprovedRoot,
    directoryBinding: unapprovedBinding
  }).status, 'securely-removed');

  const hardLinkConfig = path.join(root, 'hard-link-credential-config');
  const hardLinkCredential = path.join(hardLinkConfig, 'credentials.yaml');
  const hardLinkSentinel = path.join(root, 'hard-link-external-sentinel.txt');
  fs.mkdirSync(hardLinkConfig, { mode: 0o700 });
  fs.writeFileSync(hardLinkSentinel, 'multiply linked external sentinel must survive\n', { mode: 0o600 });
  const hardLinkSentinelBytes = fs.readFileSync(hardLinkSentinel);
  const hardLinkSentinelBefore = sha256(hardLinkSentinelBytes);
  fs.linkSync(hardLinkSentinel, hardLinkCredential);
  assert.throws(() => readContainedPrivateFile(
    root,
    hardLinkConfig,
    hardLinkCredential,
    'synthetic isolated credentials'
  ), /singly linked private regular file/u);
  const hardLinkCleanup = cleanupCredentialArtifactsSafe(
    hardLinkConfig, hardLinkCredential, root);
  assert.strictEqual(hardLinkCleanup.status, 'cleanup-failed');
  assert.strictEqual(hardLinkCleanup.absent, true);
  assert(hardLinkCleanup.files.some(file => file.method === 'unlink-multiply-linked-without-overwrite'));
  assert.strictEqual(fs.existsSync(hardLinkCredential), false);
  assert.strictEqual(sha256(fs.readFileSync(hardLinkSentinel)), hardLinkSentinelBefore,
    'cleanup must unlink only the contained hard link without overwriting its external inode');
  assert.deepStrictEqual(fs.readFileSync(hardLinkSentinel), hardLinkSentinelBytes);

  const raceRoot = path.join(root, 'credential-path-swap-race');
  const raceConfig = path.join(raceRoot, 'config');
  const raceCredential = path.join(raceConfig, 'credentials.yaml');
  const raceOriginal = path.join(raceConfig, 'credentials-original.yaml');
  const raceSentinel = path.join(root, 'credential-path-swap-external-sentinel.txt');
  fs.mkdirSync(raceConfig, { recursive: true, mode: 0o700 });
  fs.writeFileSync(raceCredential, 'synthetic contained credential\n', { mode: 0o600 });
  fs.writeFileSync(raceSentinel, 'singleton external sentinel must survive path swap\n', { mode: 0o600 });
  const raceSentinelBytes = fs.readFileSync(raceSentinel);
  const raceCleanup = secureRemove(raceCredential, {
    configRoot: raceConfig,
    disposableRoot: raceRoot,
    hooks: {
      beforeOpen() {
        fs.renameSync(raceCredential, raceOriginal);
        fs.symlinkSync(raceSentinel, raceCredential);
      }
    }
  });
  assert.strictEqual(raceCleanup.status, 'cleanup-failed');
  assert.strictEqual(raceCleanup.method, 'unlink-substituted-symlink-without-following');
  assert.strictEqual(raceCleanup.absent, true);
  assert.deepStrictEqual(fs.readFileSync(raceSentinel), raceSentinelBytes,
    'descriptor cleanup must not open, overwrite, or unlink a singleton external sentinel after path swap');
  assert.strictEqual(secureRemove(raceOriginal, {
    configRoot: raceConfig,
    disposableRoot: raceRoot
  }).status, 'securely-removed');

  const hardLinkRaceRoot = path.join(root, 'credential-hard-link-swap-race');
  const hardLinkRaceConfig = path.join(hardLinkRaceRoot, 'config');
  const hardLinkRaceCredential = path.join(hardLinkRaceConfig, 'credentials.yaml');
  const hardLinkRaceOriginal = path.join(hardLinkRaceConfig, 'credentials-original.yaml');
  const hardLinkRaceSentinel = path.join(root, 'credential-hard-link-swap-external-sentinel.txt');
  fs.mkdirSync(hardLinkRaceConfig, { recursive: true, mode: 0o700 });
  fs.writeFileSync(hardLinkRaceCredential, 'synthetic contained credential before hard-link swap\n', { mode: 0o600 });
  fs.writeFileSync(hardLinkRaceSentinel, 'singleton hard-link sentinel must survive path swap\n', { mode: 0o600 });
  const hardLinkRaceSentinelBytes = fs.readFileSync(hardLinkRaceSentinel);
  assert.strictEqual(fs.statSync(hardLinkRaceSentinel).nlink, 1);
  const hardLinkRaceCleanup = secureRemove(hardLinkRaceCredential, {
    configRoot: hardLinkRaceConfig,
    disposableRoot: hardLinkRaceRoot,
    hooks: {
      beforeOpen() {
        fs.renameSync(hardLinkRaceCredential, hardLinkRaceOriginal);
        fs.linkSync(hardLinkRaceSentinel, hardLinkRaceCredential);
      }
    }
  });
  assert.strictEqual(hardLinkRaceCleanup.status, 'cleanup-failed');
  assert.strictEqual(hardLinkRaceCleanup.method, 'unlink-multiply-linked-without-overwrite');
  assert.strictEqual(hardLinkRaceCleanup.absent, true);
  assert.strictEqual(fs.statSync(hardLinkRaceSentinel).nlink, 1);
  assert.deepStrictEqual(fs.readFileSync(hardLinkRaceSentinel), hardLinkRaceSentinelBytes,
    'an externally sourced hard-link replacement must be identity-rejected before descriptor overwrite');
  assert.strictEqual(secureRemove(hardLinkRaceOriginal, {
    configRoot: hardLinkRaceConfig,
    disposableRoot: hardLinkRaceRoot
  }).status, 'securely-removed');

  const unlinkRaceRoot = path.join(root, 'credential-unlink-swap-race');
  const unlinkRaceConfig = path.join(unlinkRaceRoot, 'config');
  const unlinkRaceCredential = path.join(unlinkRaceConfig, 'credentials.yaml');
  const unlinkRaceOriginal = path.join(unlinkRaceConfig, 'credentials-original.yaml');
  const unlinkRaceSentinel = path.join(root, 'credential-unlink-swap-external-sentinel.txt');
  fs.mkdirSync(unlinkRaceConfig, { recursive: true, mode: 0o700 });
  fs.writeFileSync(unlinkRaceCredential, 'synthetic contained credential before unlink\n', { mode: 0o600 });
  fs.writeFileSync(unlinkRaceSentinel, 'singleton unlink sentinel must survive path swap\n', { mode: 0o600 });
  const unlinkRaceSentinelBytes = fs.readFileSync(unlinkRaceSentinel);
  const unlinkRaceCleanup = secureRemove(unlinkRaceCredential, {
    configRoot: unlinkRaceConfig,
    disposableRoot: unlinkRaceRoot,
    hooks: {
      beforeUnlink() {
        fs.renameSync(unlinkRaceCredential, unlinkRaceOriginal);
        fs.symlinkSync(unlinkRaceSentinel, unlinkRaceCredential);
      }
    }
  });
  assert.strictEqual(unlinkRaceCleanup.status, 'cleanup-failed');
  assert.strictEqual(unlinkRaceCleanup.method, 'unlink-substituted-symlink-without-following');
  assert.strictEqual(unlinkRaceCleanup.absent, true);
  assert.strictEqual(fs.statSync(unlinkRaceOriginal).size, 0,
    'the opened original inode must be wiped before a final pathname substitution');
  assert.deepStrictEqual(fs.readFileSync(unlinkRaceSentinel), unlinkRaceSentinelBytes,
    'final unlink must remove only the substituted symlink and preserve its external target');
  fs.unlinkSync(unlinkRaceOriginal);

  const retainedLinkRoot = path.join(root, 'retained-descriptor-link-count');
  const retainedLinkConfig = path.join(retainedLinkRoot, 'config');
  const retainedLinkCredential = path.join(retainedLinkConfig, 'credentials.yaml');
  const retainedExternalLink = path.join(root, 'retained-credential-external-link.yaml');
  fs.mkdirSync(retainedLinkConfig, { recursive: true, mode: 0o700 });
  const retainedLinkBytes = Buffer.from('token: synthetic-multiply-linked-retained-secret\n', 'utf8');
  const multiplyLinkedHandle = openPrivateCredential(retainedLinkCredential, retainedLinkBytes);
  assert.strictEqual(multiplyLinkedHandle.links, 1);
  fs.linkSync(retainedLinkCredential, retainedExternalLink);
  const multiplyLinkedCleanup = cleanupCredentialArtifactsSafe(
    retainedLinkConfig, retainedLinkCredential, retainedLinkRoot, multiplyLinkedHandle);
  assert.strictEqual(multiplyLinkedCleanup.status, 'cleanup-failed');
  assert(multiplyLinkedCleanup.files.some(file => file.method === 'unlink-multiply-linked-without-overwrite'));
  assert.strictEqual(multiplyLinkedCleanup.descriptor_identity_verified, true);
  assert.strictEqual(multiplyLinkedCleanup.descriptor_wiped, true);
  assert.strictEqual(multiplyLinkedCleanup.descriptor_closed, true);
  assert.strictEqual(multiplyLinkedCleanup.links_before_overwrite, 2);
  assert.strictEqual(multiplyLinkedCleanup.link_count_anomaly, true);
  assert(multiplyLinkedCleanup.method.includes('retained-descriptor-link-count-anomaly'));
  assert.strictEqual(multiplyLinkedHandle.wiped, true);
  assert.strictEqual(multiplyLinkedHandle.closed, true);
  assert.strictEqual(fs.existsSync(retainedLinkCredential), false,
    'pathname cleanup must unlink the contained name after descriptor wiping');
  assert.strictEqual(fs.statSync(retainedExternalLink).size, 0,
    'descriptor cleanup must clear the secret through every link to the created credential inode');
  fs.unlinkSync(retainedExternalLink);

  const detachedLinkRoot = path.join(root, 'retained-descriptor-detached-links');
  const detachedLinkConfig = path.join(detachedLinkRoot, 'config');
  const detachedLinkCredential = path.join(detachedLinkConfig, 'credentials.yaml');
  const detachedExternalOne = path.join(root, 'retained-detached-external-one.yaml');
  const detachedExternalTwo = path.join(root, 'retained-detached-external-two.yaml');
  fs.mkdirSync(detachedLinkConfig, { recursive: true, mode: 0o700 });
  const detachedHandle = openPrivateCredential(
    detachedLinkCredential,
    Buffer.from('token: synthetic-detached-link-secret\n', 'utf8')
  );
  fs.linkSync(detachedLinkCredential, detachedExternalOne);
  fs.linkSync(detachedLinkCredential, detachedExternalTwo);
  fs.unlinkSync(detachedLinkCredential);
  const detachedCleanup = cleanupCredentialArtifactsSafe(
    detachedLinkConfig,
    detachedLinkCredential,
    detachedLinkRoot,
    detachedHandle
  );
  assert.strictEqual(detachedCleanup.status, 'cleanup-failed',
    'a retained descriptor link-count anomaly must block even after the contained name disappeared');
  assert.strictEqual(detachedCleanup.absent, true);
  assert.strictEqual(detachedCleanup.links_before_overwrite, 2);
  assert.strictEqual(detachedCleanup.link_count_anomaly, true);
  assert.strictEqual(fs.statSync(detachedExternalOne).size, 0);
  assert.strictEqual(fs.statSync(detachedExternalTwo).size, 0);
  fs.unlinkSync(detachedExternalOne);
  fs.unlinkSync(detachedExternalTwo);

  const profile = path.join(root, 'profile.txt');
  fs.writeFileSync(profile, 'profile\n');
  const before = snapshotProfiles([profile]);
  const after = snapshotProfiles([profile]);
  assert(profilesEqual(before, after));
  fs.appendFileSync(profile, 'changed\n');
  assert(!profilesEqual(before, snapshotProfiles([profile])));
}

function testCalendarAwareSchemaFormats(root) {
  const registry = new SchemaRegistry();
  const schemaFile = path.join(root, 'calendar-format.schema.json');
  const dateTime = { type: 'string', format: 'date-time' };
  const date = { type: 'string', format: 'date' };
  for (const value of ['2026-02-28T23:59:59Z', '2024-02-29T12:30:15.125-05:00']) {
    assert.deepStrictEqual(validateInstance(value, dateTime, schemaFile, registry), [], value);
  }
  for (const value of [
    '2026-99-99T12:00:00Z',
    '2026-02-30T12:00:00Z',
    '2026-01-01T25:00:00Z',
    '2026-01-01T12:00:00+99:99',
    '2026-01-01T12:00:60Z'
  ]) {
    assert(validateInstance(value, dateTime, schemaFile, registry).some(error => error.includes('RFC 3339')), value);
  }
  assert.deepStrictEqual(validateInstance('2024-02-29', date, schemaFile, registry), []);
  for (const value of ['2026-99-99', '2026-02-30']) {
    assert(validateInstance(value, date, schemaFile, registry).some(error => error.includes('ISO 8601')), value);
  }
}

function testFailClosed(root) {
  const blocked = path.join(root, 'blocked');
  fs.mkdirSync(path.join(blocked, 'evidence'), { recursive: true, mode: 0o700 });
  fs.chmodSync(blocked, 0o700);
  const plan = { isolation: { root: blocked } };
  const prepared = {
    root: blocked,
    plan_sha256: sha256(Buffer.from(JSON.stringify(canonicalJson(plan)), 'utf8')),
    native_preflight_valid: false,
    paid_execution_ready: false
  };
  writeJson(path.join(blocked, 'evidence', 'run-plan.json'), plan);
  writeJson(path.join(blocked, 'evidence', 'prepared.json'), prepared);
  assert.throws(() => verifyPrepared({ root: blocked }, sourceBinding()), /paid execution is refused/);
  assert(!fs.existsSync(path.join(blocked, 'evidence', 'execution-started.json')));
}

function testPreparedIntegrity(root) {
  const preparedRoot = path.join(root, 'prepared-integrity');
  const project = path.join(preparedRoot, 'project');
  fs.mkdirSync(path.join(preparedRoot, 'evidence'), { recursive: true, mode: 0o700 });
  fs.chmodSync(preparedRoot, 0o700);
  const resumePaths = isolatedPaths(preparedRoot, planOptions().clioSource, 'S2');
  for (const [key, directory] of Object.entries(resumePaths)) {
    if (key === 'HOME' || key === 'TMPDIR' || key.startsWith('XDG_') ||
      (key.startsWith('CLIO_CODER_') && key.endsWith('_DIR'))) {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    }
  }
  const fixture = initializeFixture(project, fixtureBinding());
  const installed = path.join(preparedRoot, 'clio', 'config', 'extensions', 'wtfp');
  fs.mkdirSync(installed, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(installed, 'extension.json'), '{"id":"wtfp"}\n', { mode: 0o600 });
  const sources = sourceBinding();
  sources.wtfp.extension_sha256 = hashTree(installed).sha256;
  const options = { ...planOptions(), root: preparedRoot };
  const plan = buildPlan(options, sources, preparedRoot);
  const effectiveSettings = minimalEvaluationSettings(options);
  const effectiveSettingsFile = path.join(preparedRoot, 'clio', 'config', 'settings.yaml');
  writeJson(effectiveSettingsFile, effectiveSettings);
  const nativeFile = path.join(preparedRoot, 'evidence', 'native-preflight.json');
  writeJson(nativeFile, { schema: 'wtfp.evaluation.clio-native-preflight/v1', valid: true, errors: [] });
  const prepared = {
    schema: 'wtfp.evaluation.clio-lifecycle-prepared/v1',
    root: preparedRoot,
    source: sources,
    plan_sha256: sha256(Buffer.from(JSON.stringify(canonicalJson(plan)), 'utf8')),
    native_preflight_sha256: sha256(fs.readFileSync(nativeFile)),
    native_preflight_valid: true,
    paid_execution_ready: true,
    installed_extension_sha256: sources.wtfp.extension_sha256,
    effective_settings_sha256: sha256(fs.readFileSync(effectiveSettingsFile)),
    effective_settings_policy_sha256: sha256(Buffer.from(JSON.stringify(canonicalJson(effectiveSettings)), 'utf8')),
    fresh_session_initial_sha256: sessionPrivateState(resumePaths, preparedRoot).sha256,
    fixture_initial_snapshot_sha256: sha256(Buffer.from(JSON.stringify(canonicalJson(fixture.content)), 'utf8')),
    git_control: gitControlSnapshot(project)
  };
  writeJson(path.join(preparedRoot, 'evidence', 'run-plan.json'), plan);
  writeJson(path.join(preparedRoot, 'evidence', 'prepared.json'), prepared);
  assert.doesNotThrow(() => verifyPrepared(options, sources));

  const autoCredential = path.join(preparedRoot, 'clio', 'config', 'credentials.yaml');
  fs.writeFileSync(autoCredential, Buffer.alloc(93, 0x78), { mode: 0o600 });
  assert.throws(() => verifyPrepared(options, sources), /isolated credentials existed before authorized forwarding/);
  assert.strictEqual(cleanupCredentialArtifactsSafe(path.dirname(autoCredential), autoCredential).status, 'securely-removed');

  fs.writeFileSync(path.join(project, 'tampered-input.md'), 'tampered\n');
  assert.throws(() => verifyPrepared(options, sources), /fixture project changed before execution/);
  fs.unlinkSync(path.join(project, 'tampered-input.md'));

  const gitConfig = path.join(project, '.git', 'config');
  const gitConfigBytes = fs.readFileSync(gitConfig);
  fs.appendFileSync(gitConfig, '\n# tampered\n');
  assert.throws(() => verifyPrepared(options, sources), /Git control plane changed before execution/);
  fs.writeFileSync(gitConfig, gitConfigBytes);

  const nativeBytes = fs.readFileSync(nativeFile);
  fs.appendFileSync(nativeFile, ' ');
  assert.throws(() => verifyPrepared(options, sources), /native preflight evidence changed/);
  fs.writeFileSync(nativeFile, nativeBytes);
  const changedDist = JSON.parse(JSON.stringify(sources));
  changedDist.clio.dist.sha256 = '4'.repeat(64);
  assert.throws(() => verifyPrepared(options, changedDist), /Clio executable dist tree changed/);
  const changedModules = JSON.parse(JSON.stringify(sources));
  changedModules.clio.runtime_modules.sha256 = '5'.repeat(64);
  assert.throws(() => verifyPrepared(options, changedModules), /Clio installed runtime modules changed/);
  const changedNode = JSON.parse(JSON.stringify(sources));
  changedNode.clio.node.sha256 = '6'.repeat(64);
  assert.throws(() => verifyPrepared(options, changedNode), /Node.js executable changed/);
  assert(!fs.existsSync(path.join(preparedRoot, 'evidence', 'execution-started.json')));
}

function testArgumentParsing() {
  const parsed = parseArgs([
    '--dry-run', '--binary', '/tmp/binary', '--clio-source', '/tmp/source',
    '--target', 'target', '--model', 'model', '--effort', 'high', '--budget-usd', '3.5'
  ]);
  assert.strictEqual(parsed.mode, 'dry-run');
  assert.strictEqual(parsed.budgetUsd, 3.5);
  assert.throws(() => parseArgs(['--dry-run', '--prepare']), /exactly one/);
  assert.throws(() => parseArgs(['--execute', '--binary', '/tmp/b', '--clio-source', '/tmp/s']), /requires --root/);
  assert.throws(() => parseArgs([
    '--dry-run', '--binary', '/tmp/b', '--clio-source', '/tmp/s', '--credentials', 'secret'
  ]), /unknown option --credentials/);
}

function testStructuredWorkerResultAudit(root) {
  const receiptRoot = path.join(root, 'structured-receipt');
  const receiptDirectory = path.join(receiptRoot, 'clio', 'state', 'receipts');
  fs.mkdirSync(receiptDirectory, { recursive: true });
  const sealedText = JSON.stringify({
    verdict: 'pass',
    checks: [{ name: 'Sealed check', passed: true, evidence: 'sealed evidence' }]
  });
  writeJson(path.join(receiptDirectory, 'sealed-run.json'), {
    runId: 'sealed-run',
    costUsd: 0,
    costProvenance: 'unknown',
    output: {
      state: 'final', text: sealedText, bytes: Buffer.byteLength(sealedText, 'utf8'), truncated: false
    }
  });
  const collected = collectReceipts(receiptRoot).receipts[0];
  assert.strictEqual(collected.output_text, sealedText);
  assert.strictEqual(collected.output.sha256, sha256(Buffer.from(sealedText, 'utf8')));
  assert.strictEqual(collected.output.captured_bytes, Buffer.byteLength(sealedText, 'utf8'));
  assert(!Object.keys(collected).includes('output_text'));
  assert(!JSON.stringify(collected).includes('sealed evidence'),
    'raw integrity-covered worker text must not be duplicated into summary evidence');

  const outputReceipt = (agent, kind, result, quality = 'pass') => {
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    const receipt = {
      agent_id: agent,
      result_contract: {
        sourceId: `agent-result-contract:${kind}:${'a'.repeat(64)}`,
        validatorDigest: 'b'.repeat(64),
        conformance: 'pass',
        quality
      },
      output: {
        state: 'final',
        bytes: Buffer.byteLength(text, 'utf8'),
        captured_bytes: Buffer.byteLength(text, 'utf8'),
        truncated: false,
        sha256: sha256(Buffer.from(text, 'utf8'))
      }
    };
    Object.defineProperty(receipt, 'output_text', {
      value: text, enumerable: false, writable: false, configurable: true
    });
    return receipt;
  };
  const changedPath = '.planning/sections/evaluation/plans/initial.json';
  const evidence = {
    projectRoot: root,
    mutation: {
      valid: true,
      changes: [{ path: changedPath, change: 'created', before: null, after: { kind: 'file' } }]
    },
    schemaValidation: { valid: true },
    records: []
  };
  const mutationResult = {
    mutatedPaths: [changedPath],
    validations: [{ name: 'schema check', passed: true, evidence: 'independent schema validation passed' }]
  };
  const unmeasuredMutation = outputReceipt(
    'wtfp-section-planner', 'mutation-report', mutationResult, 'unmeasured');
  const mutationAudit = auditStructuredWorkerResult('plan-section', unmeasuredMutation, evidence);
  assert.strictEqual(mutationAudit.valid, true);
  assert.strictEqual(mutationAudit.quality_interpretation, 'unmeasured-not-promoted');
  assert.strictEqual(mutationAudit.reconciliation.grounding, 'aggregate-diff-only-clio-unmeasured');
  assert(!JSON.stringify(unmeasuredMutation).includes('independent schema validation passed'),
    'raw receipt output must remain non-enumerable');
  const containedAbsolute = outputReceipt('wtfp-section-planner', 'mutation-report', {
    ...mutationResult,
    mutatedPaths: [path.join(root, changedPath)]
  }, 'unmeasured');
  const absoluteAudit = auditStructuredWorkerResult('plan-section', containedAbsolute, evidence);
  assert.strictEqual(absoluteAudit.valid, true,
    'a lexically and physically contained absolute path emitted by Clio must be accepted');
  assert.deepStrictEqual(absoluteAudit.reconciliation.paths, [changedPath]);
  const outsideAbsolute = outputReceipt('wtfp-section-planner', 'mutation-report', {
    ...mutationResult,
    mutatedPaths: [path.join(path.dirname(root), 'outside-project', 'initial.json')]
  }, 'unmeasured');
  assert.strictEqual(auditStructuredWorkerResult('plan-section', outsideAbsolute, evidence).valid, false,
    'an absolute path outside the project must fail containment');

  const qualityFailed = outputReceipt('wtfp-section-planner', 'mutation-report', mutationResult, 'fail');
  assert.strictEqual(auditStructuredWorkerResult('plan-section', qualityFailed, evidence).valid, false,
    'shape-conformant quality failure must never pass');
  const fabricated = outputReceipt('wtfp-section-planner', 'mutation-report', {
    ...mutationResult,
    mutatedPaths: ['.planning/sections/evaluation/plans/fabricated.json']
  });
  assert.strictEqual(auditStructuredWorkerResult('plan-section', fabricated, evidence).valid, false,
    'worker mutation claim absent from the deterministic diff must fail');
  for (const mutate of [
    receipt => { receipt.output.state = 'partial'; },
    receipt => { receipt.output.truncated = true; },
    receipt => {
      const malformed = '{not-json';
      Object.defineProperty(receipt, 'output_text', { value: malformed });
      receipt.output.bytes = Buffer.byteLength(malformed, 'utf8');
      receipt.output.captured_bytes = receipt.output.bytes;
      receipt.output.sha256 = sha256(Buffer.from(malformed, 'utf8'));
    }
  ]) {
    const receipt = outputReceipt('wtfp-section-planner', 'mutation-report', mutationResult);
    mutate(receipt);
    assert.strictEqual(auditStructuredWorkerResult('plan-section', receipt, evidence).valid, false,
      'partial, truncated, and malformed outputs must fail closed');
  }

  const verifierResult = {
    verdict: 'pass',
    checks: [{ name: 'Decision fidelity', passed: true, evidence: 'locked decision remained locked' }]
  };
  const validation = {
    type: 'validation',
    path: '.planning/validations/plan-check.json',
    value: {
      action_id: 'plan-section',
      validator_role: 'plan-checker',
      status: 'passed',
      checks: [{
        id: 'decision-fidelity',
        status: 'passed',
        summary: 'Decision fidelity',
        evidence: ['locked decision remained locked']
      }]
    }
  };
  const verifier = outputReceipt('wtfp-plan-checker', 'verifier-report', verifierResult);
  const verifierEvidence = { ...evidence, records: [validation] };
  assert.strictEqual(auditStructuredWorkerResult('plan-section', verifier, verifierEvidence).valid, true);
  const statusMismatch = JSON.parse(JSON.stringify(validation));
  statusMismatch.value.status = 'failed';
  statusMismatch.value.checks[0].status = 'failed';
  assert.strictEqual(auditStructuredWorkerResult(
    'plan-section', verifier, { ...evidence, records: [statusMismatch] }).valid, false,
  'main-agent validation may not contradict a passing checker result');
  const evidenceMismatch = JSON.parse(JSON.stringify(validation));
  evidenceMismatch.value.checks[0].evidence = ['different evidence'];
  assert.strictEqual(auditStructuredWorkerResult(
    'plan-section', verifier, { ...evidence, records: [evidenceMismatch] }).valid, false,
  'main-agent validation may not replace checker evidence');
  const failedVerifier = outputReceipt('wtfp-plan-checker', 'verifier-report', {
    verdict: 'fail',
    checks: [{ name: 'Decision fidelity', passed: false, evidence: 'locked decision was changed' }]
  }, 'fail');
  assert.strictEqual(auditStructuredWorkerResult(
    'plan-section', failedVerifier, { ...evidence, records: [statusMismatch] }).valid, false,
  'a conformant checker failure must stop a required pass gate');
}

async function testActionProcessAndIncrementalAudit(root, project) {
  const fakeClient = path.join(root, 'fake-clio-client.js');
  const auditFile = path.join(root, 'clio', 'state', 'audit', 'test.jsonl');
  const fakeSource = [
    "'use strict';",
    "const fs = require('fs');",
    'const [target, model, payload, audit] = process.argv.slice(2);',
    "fs.appendFileSync(audit, `${JSON.stringify({ kind: 'tool_call', correlationId: 'incremental', tool: 'read', args: { path: 'project-brief.md' } })}\\n`);",
    "process.stdout.write(`${JSON.stringify({ type: 'session', id: 'synthetic-session', target, model })}\\n`);",
    "process.stdout.write(`${JSON.stringify({ type: 'message_end', message: { role: 'user', content: [{ type: 'text', text: `<invocation_arguments>\\n${payload}\\n</invocation_arguments>` }] } })}\\n`);"
  ].join('\n');
  fs.writeFileSync(fakeClient, `${fakeSource}\n`, { mode: 0o700 });

  const options = planOptions();
  const actionPlan = buildActionPlan(options)[0];
  actionPlan.cli = {
    ...actionPlan.cli,
    executable: process.execPath,
    argv: [fakeClient, options.target, options.model, actionPlan.invocation_arguments, auditFile]
  };
  const executionPlan = buildPlan(options, sourceBinding(), root);
  executionPlan.actions = [actionPlan];
  const result = await runAction({
    actionPlan,
    options,
    root,
    plan: executionPlan,
    env: sanitizedChildEnv(isolatedPaths(root, '/opt/clio-source')),
    sessions: { S1: null, S2: null },
    oracle: readJson(path.join(fixtureRoot, 'expected-invariants.json')),
    previousRecords: [],
    initialGit: gitControlSnapshot(project),
    locks: {},
    clientVersion: 'Clio Coder 0.3.8'
  });
  assert.strictEqual(result.report.process.exitCode, 0);
  assert.strictEqual(result.report.argument_evidence.exact, true);
  assert.strictEqual(result.report.worker_tool_audit.call_count, 1);
  assert.strictEqual(result.report.worker_tool_audit.valid, true);
  assert.strictEqual(result.report.receipt_audit.valid, false);
  assert(result.report.receipt_audit.errors.some(error => error.includes('no new receipt')));
  assert(result.report.cross_record_invariants.valid);
  assert.strictEqual(result.report.valid, false, 'no-op new-paper must still fail its mutation boundary');
}

async function testProcessAndSignalCleanup(root, project) {
  const parent = path.join(root, 'process-group-parent.js');
  fs.writeFileSync(parent, [
    "'use strict';",
    "const { spawn } = require('child_process');",
    "spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }).unref();",
    "process.stdout.write('leader-exiting\\n');"
  ].join('\n'), { mode: 0o700 });
  const stdout = path.join(root, 'process-group.stdout');
  const stderr = path.join(root, 'process-group.stderr');
  const supervised = await spawnCaptured({
    executable: process.execPath,
    argv: [parent],
    cwd: project,
    env: sanitizedChildEnv(isolatedPaths(root, '/opt/clio-source')),
    stdoutFile: stdout,
    stderrFile: stderr,
    timeoutMs: 5000
  });
  assert.strictEqual(supervised.exitCode, 0);
  assert.strictEqual(supervised.processGroup.owned, process.platform !== 'win32');
  assert.strictEqual(supervised.processGroup.quiesced, true);
  if (process.platform !== 'win32') assert.strictEqual(supervised.processGroup.term_sent, true);

  if (process.platform !== 'win32') {
    const activeRoot = path.join(root, 'active-group-cleanup');
    const activeConfig = path.join(activeRoot, 'config');
    const activeCredential = path.join(activeConfig, 'credentials.yaml');
    fs.mkdirSync(activeConfig, { recursive: true, mode: 0o700 });
    const activeHandle = openPrivateCredential(
      activeCredential,
      Buffer.from('token: synthetic-active-group-secret\n', 'utf8')
    );
    const activeRun = spawnCaptured({
      executable: process.execPath,
      argv: ['-e', 'setInterval(() => {}, 1000)'],
      cwd: project,
      env: sanitizedChildEnv(isolatedPaths(root, '/opt/clio-source')),
      stdoutFile: path.join(root, 'active-group.stdout'),
      stderrFile: path.join(root, 'active-group.stderr'),
      timeoutMs: 100
    });
    assert.throws(() => readContainedPrivateFileEvidence(
      activeRoot,
      activeConfig,
      activeCredential,
      'active-process rotated credentials',
      { maxBytes: 1024, approveCredentialRotation: true }
    ), /requires every owned process group to be quiescent/u);
    const activeCleanup = cleanupCredentialArtifactsSafe(
      activeConfig, activeCredential, activeRoot, activeHandle);
    assert.strictEqual(activeCleanup.status, 'cleanup-failed');
    assert.strictEqual(activeCleanup.method, 'refused-active-process-groups');
    assert.strictEqual(activeCleanup.descriptor_identity_verified, true);
    assert.strictEqual(activeCleanup.descriptor_wiped, true);
    assert.strictEqual(activeCleanup.descriptor_closed, true);
    assert.strictEqual(activeHandle.closed, true);
    assert.strictEqual(fs.statSync(activeCredential).size, 0);
    const activeResult = await activeRun;
    assert.strictEqual(activeResult.processGroup.quiesced, true);
    const afterQuiescence = cleanupCredentialArtifactsSafe(
      activeConfig, activeCredential, activeRoot, activeHandle);
    assert.strictEqual(afterQuiescence.status, 'securely-removed');
    assert.strictEqual(afterQuiescence.absent, true);
  }

  const signalConfig = path.join(root, 'signal-config');
  const signalCredential = path.join(signalConfig, 'credentials.yaml');
  fs.mkdirSync(signalConfig, { mode: 0o700 });
  fs.writeFileSync(signalCredential, 'token: synthetic-signal-secret\n', { mode: 0o600 });
  const signalChild = path.join(root, 'signal-cleanup-child.js');
  const runner = path.join(repositoryRoot, 'evaluation', 'tools', 'run-clio-lifecycle.js');
  fs.writeFileSync(signalChild, [
    "'use strict';",
    `const { installExecutionSignalHandlers, cleanupCredentialArtifactsSafe } = require(${JSON.stringify(runner)});`,
    `const config = ${JSON.stringify(signalConfig)};`,
    `const credential = ${JSON.stringify(signalCredential)};`,
    'installExecutionSignalHandlers(() => cleanupCredentialArtifactsSafe(config, credential));',
    "process.stdout.write('ready\\n');",
    'setInterval(() => {}, 1000);'
  ].join('\n'), { mode: 0o700 });
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [signalChild], { stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    child.stdout.on('data', bytes => {
      if (ready || !bytes.toString('utf8').includes('ready')) return;
      ready = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGTERM'), 50);
    });
    child.on('error', reject);
    child.on('close', () => resolve());
    setTimeout(() => {
      if (!ready) reject(new Error('signal cleanup child did not become ready'));
    }, 3000).unref();
  });
  assert(!fs.existsSync(signalCredential), 'signal handler must remove the isolated credential');

  if (process.platform !== 'win32') {
    const adversaryRoot = path.join(root, 'signal-ancestor-substitution');
    fs.mkdirSync(adversaryRoot, { mode: 0o700 });
    const adversaryClio = path.join(adversaryRoot, 'clio');
    const adversaryConfig = path.join(adversaryClio, 'config');
    const adversaryCredential = path.join(adversaryConfig, 'credentials.yaml');
    const adversaryOriginal = path.join(adversaryRoot, 'clio-original');
    const adversaryExternal = path.join(root, 'signal-external-sentinel');
    const adversaryExternalConfig = path.join(adversaryExternal, 'config');
    const adversarySentinel = path.join(adversaryExternalConfig, 'credentials.yaml');
    const adversaryMarkers = path.join(root, 'signal-adversary-markers.txt');
    fs.mkdirSync(adversaryExternalConfig, { recursive: true, mode: 0o700 });
    fs.writeFileSync(adversarySentinel, 'signal external sentinel must survive\n', { mode: 0o600 });
    const adversarySentinelBefore = sha256(fs.readFileSync(adversarySentinel));

    const adversaryWorker = path.join(root, 'signal-adversary-worker.js');
    fs.writeFileSync(adversaryWorker, [
      "'use strict';",
      "const fs = require('fs');",
      `const marker = ${JSON.stringify(adversaryMarkers)};`,
      `const clio = ${JSON.stringify(adversaryClio)};`,
      `const original = ${JSON.stringify(adversaryOriginal)};`,
      `const external = ${JSON.stringify(adversaryExternal)};`,
      'let handled = false;',
      "process.on('SIGTERM', () => {",
      '  if (handled) return;',
      '  handled = true;',
      "  fs.appendFileSync(marker, 'worker-term\\n');",
      '  fs.renameSync(clio, original);',
      '  fs.symlinkSync(external, clio);',
      "  fs.appendFileSync(marker, 'worker-substituted\\n');",
      "  setTimeout(() => { fs.appendFileSync(marker, 'worker-exit\\n'); process.exit(0); }, 200);",
      '});',
      "fs.appendFileSync(marker, 'worker-ready\\n');",
      'setInterval(() => {}, 1000);'
    ].join('\n'), { mode: 0o700 });

    const adversaryHarness = path.join(root, 'signal-adversary-harness.js');
    fs.writeFileSync(adversaryHarness, [
      "'use strict';",
      "const fs = require('fs');",
      `const { openPrivateCredential, installExecutionSignalHandlers, cleanupCredentialArtifactsSafe, spawnCaptured } = require(${JSON.stringify(runner)});`,
      `const root = ${JSON.stringify(adversaryRoot)};`,
      `const config = ${JSON.stringify(adversaryConfig)};`,
      `const credential = ${JSON.stringify(adversaryCredential)};`,
      `const marker = ${JSON.stringify(adversaryMarkers)};`,
      `const worker = ${JSON.stringify(adversaryWorker)};`,
      `const stdout = ${JSON.stringify(path.join(adversaryRoot, 'worker.stdout'))};`,
      `const stderr = ${JSON.stringify(path.join(adversaryRoot, 'worker.stderr'))};`,
      "const handle = openPrivateCredential(credential, Buffer.from('token: synthetic-signal-retained-secret\\n'));",
      'installExecutionSignalHandlers(() => {',
      '  const result = cleanupCredentialArtifactsSafe(config, credential, root, handle);',
      '  fs.appendFileSync(marker, `cleanup:${result.status}:${result.descriptor_wiped}:${handle.wiped}:${handle.closed}\\n`);',
      '});',
      'const run = spawnCaptured({',
      '  executable: process.execPath, argv: [worker], cwd: root, env: process.env,',
      '  stdoutFile: stdout, stderrFile: stderr, timeoutMs: 10000',
      '});',
      'const ready = setInterval(() => {',
      "  if (!fs.existsSync(marker) || !fs.readFileSync(marker, 'utf8').includes('worker-ready')) return;",
      '  clearInterval(ready);',
      "  process.stdout.write('ready\\n');",
      '}, 20);',
      "run.then(result => fs.appendFileSync(marker, `quiesced:${result.processGroup.quiesced}\\n`));",
      'setInterval(() => {}, 1000);'
    ].join('\n'), { mode: 0o700 });

    const adversaryEnv = sanitizedChildEnv(isolatedPaths(root, '/opt/clio-source'));
    const adversaryChild = spawn(process.execPath, [adversaryHarness], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: adversaryEnv
    });
    let adversaryStderr = '';
    adversaryChild.stderr.on('data', bytes => { adversaryStderr += bytes.toString('utf8'); });
    const adversaryClosed = new Promise((resolve, reject) => {
      adversaryChild.on('error', reject);
      adversaryChild.on('close', (code, signal) => resolve({ code, signal }));
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(
        `signal adversary did not become ready: ${adversaryStderr}`)), 5000);
      adversaryChild.stdout.on('data', bytes => {
        if (!bytes.toString('utf8').includes('ready')) return;
        clearTimeout(timeout);
        resolve();
      });
    });
    adversaryChild.kill('SIGTERM');
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const poll = setInterval(() => {
        const contents = fs.existsSync(adversaryMarkers) ? fs.readFileSync(adversaryMarkers, 'utf8') : '';
        if (contents.includes('cleanup:')) {
          clearInterval(poll);
          resolve();
        } else if (Date.now() - started > 5000) {
          clearInterval(poll);
          reject(new Error(`signal cleanup did not run after quiescence: ${contents}\n${adversaryStderr}`));
        }
      }, 20);
    });
    adversaryChild.kill('SIGTERM');
    await adversaryClosed;
    const markers = fs.readFileSync(adversaryMarkers, 'utf8').trim().split('\n');
    const substitutionIndex = markers.indexOf('worker-substituted');
    const exitIndex = markers.indexOf('worker-exit');
    const cleanupIndex = markers.findIndex(marker => marker.startsWith('cleanup:'));
    assert(substitutionIndex >= 0 && exitIndex > substitutionIndex && cleanupIndex > exitIndex,
      `cleanup ran before the owned process was quiescent: ${markers.join(', ')}`);
    assert(markers.some(marker => marker === 'quiesced:true'));
    assert(markers.some(marker => marker === 'cleanup:cleanup-failed:true:true:true'));
    assert.strictEqual(fs.statSync(path.join(adversaryOriginal, 'config', 'credentials.yaml')).size, 0,
      'signal cleanup must wipe the retained original inode after ancestor substitution');
    assert.strictEqual(sha256(fs.readFileSync(adversarySentinel)), adversarySentinelBefore,
      'signal cleanup must not follow the substituted ancestor into the external sentinel');
  }
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-evaluation-lifecycle-test.'));
  fs.chmodSync(root, 0o700);
  try {
    testPlan();
    testArgumentExtraction();
    testIsolation(root);
    const project = testFixtureAndGit(root);
    testPlanningAndMutation(project);
    testToolAudit(root, project);
    testFleetBoundaryProbe(root);
    testCredentialHandling(root);
    testCalendarAwareSchemaFormats(root);
    testFailClosed(root);
    testPreparedIntegrity(root);
    testArgumentParsing();
    testStructuredWorkerResultAudit(root);
    await testActionProcessAndIncrementalAudit(root, project);
    await testProcessAndSignalCleanup(root, project);
    const explicitlyCreated = path.join(root, 'new-private-root');
    assert.strictEqual(createRoot(explicitlyCreated), explicitlyCreated);
    assert.strictEqual(fs.statSync(explicitlyCreated).mode & 0o777, 0o700);
    assert.throws(() => createRoot(explicitlyCreated), /refusing existing/);
    console.log('✓ Clio lifecycle plan preserves exact argument bytes across nine process turns');
    console.log('✓ lifecycle fixture, schema, cross-record, mutation, VCS, and session invariants are executable');
    console.log('✓ isolated environment, profile hashing, credential redaction/cleanup, and paid fail-closed gates hold');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
