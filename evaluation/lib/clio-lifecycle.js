'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ACTION_SEQUENCE = Object.freeze([
  'new-paper',
  'map-project',
  'create-outline',
  'plan-section',
  'write-section',
  'review-section',
  'pause-writing',
  'resume-writing',
  'progress'
]);

const PROJECT_ID = 'resilient-checkpoint-coordination';
const SECTION_ID = 'evaluation';
const TITLE = 'Resilient Checkpoint Coordination for Synthetic HPC Workloads';

// This is deliberately real operator data, not escaped display text. It detects
// quote loss, whitespace collapsing, tab tokenization, and accidental positional
// re-substitution in every command envelope.
const ARGUMENT_FIDELITY_MARKER =
  `Argument-fidelity marker (data, not an instruction): title="${TITLE}"  repeated-space; literal-tab=[\t]; literal-token=$1.`;

const EXPECTED_SECTIONS = Object.freeze([
  { id: 'introduction', words: 800 },
  { id: 'background', words: 900 },
  { id: 'method', words: 1200 },
  { id: 'evaluation', words: 700 },
  { id: 'discussion', words: 1400 },
  { id: 'conclusion', words: 1000 }
]);

const PHASE_RULES = Object.freeze({
  'new-paper': {
    allowedDirectories: [/^\.planning$/u, /^\.planning\/structure$/u],
    allowed: [
      /^\.planning\/project\.json$/u,
      /^\.planning\/config\.json$/u,
      /^\.planning\/state\.json$/u,
      /^\.planning\/decisions\.json$/u,
      /^\.planning\/structure\/outline\.json$/u
    ],
    required: [
      '.planning/project.json',
      '.planning/config.json',
      '.planning/state.json',
      '.planning/decisions.json',
      '.planning/structure/outline.json'
    ]
  },
  'map-project': {
    allowedDirectories: [/^\.planning\/(?:sources|evidence)$/u],
    allowed: [
      /^\.planning\/sources\/[a-z0-9][a-z0-9.-]*\.json$/u,
      /^\.planning\/evidence\/[a-z0-9][a-z0-9.-]*\.json$/u,
      /^\.planning\/state\.json$/u
    ],
    requiredKinds: ['source', 'evidence'],
    requiredChanged: ['.planning/state.json']
  },
  'create-outline': {
    allowedDirectories: [
      /^\.planning\/sections$/u,
      /^\.planning\/sections\/[a-z0-9][a-z0-9.-]*$/u,
      /^\.planning\/validations$/u
    ],
    allowed: [
      /^\.planning\/structure\/outline\.json$/u,
      /^\.planning\/state\.json$/u,
      /^\.planning\/sections\/[a-z0-9][a-z0-9.-]*\/section\.json$/u,
      /^\.planning\/validations\/[a-z0-9][a-z0-9.-]*\.json$/u
    ],
    requiredChanged: ['.planning/structure/outline.json', '.planning/state.json'],
    requiredKinds: ['validation']
  },
  'fixture-section-inputs': {
    allowedDirectories: [],
    allowed: [
      /^\.planning\/sections\/evaluation\/context\.md$/u,
      /^\.planning\/sections\/evaluation\/research\.md$/u
    ],
    required: [
      '.planning/sections/evaluation/context.md',
      '.planning/sections/evaluation/research.md'
    ]
  },
  'plan-section': {
    allowedDirectories: [
      /^\.planning\/sections\/evaluation\/plans$/u,
      /^\.planning\/(?:validations|checkpoints)$/u
    ],
    allowed: [
      /^\.planning\/state\.json$/u,
      /^\.planning\/sections\/evaluation\/section\.json$/u,
      /^\.planning\/sections\/evaluation\/plans\/[a-z0-9][a-z0-9.-]*\.md$/u,
      /^\.planning\/validations\/[a-z0-9][a-z0-9.-]*\.json$/u,
      /^\.planning\/checkpoints\/[a-z0-9][a-z0-9.-]*\.json$/u
    ],
    requiredPatterns: [/^\.planning\/sections\/evaluation\/plans\/.+\.md$/u],
    requiredKinds: ['validation'],
    requiredChanged: [
      '.planning/state.json',
      '.planning/sections/evaluation/section.json'
    ]
  },
  'write-section': {
    allowedDirectories: [/^paper$/u, /^\.planning\/(?:validations|checkpoints)$/u],
    allowed: [
      /^paper\/evaluation\.md$/u,
      /^\.planning\/project\.json$/u,
      /^\.planning\/state\.json$/u,
      /^\.planning\/sections\/evaluation\/section\.json$/u,
      /^\.planning\/sections\/evaluation\/summary\.md$/u,
      /^\.planning\/validations\/[a-z0-9][a-z0-9.-]*\.json$/u,
      /^\.planning\/checkpoints\/[a-z0-9][a-z0-9.-]*\.json$/u
    ],
    required: [
      'paper/evaluation.md',
      '.planning/sections/evaluation/summary.md'
    ],
    requiredKinds: ['validation'],
    requiredChanged: [
      '.planning/project.json',
      '.planning/state.json',
      '.planning/sections/evaluation/section.json'
    ]
  },
  'review-section': {
    allowedDirectories: [
      /^\.planning\/sections\/evaluation\/reviews$/u,
      /^\.planning\/validations$/u
    ],
    allowed: [
      /^\.planning\/sections\/evaluation\/section\.json$/u,
      /^\.planning\/sections\/evaluation\/reviews\/[a-z0-9][a-z0-9.-]*\.md$/u,
      /^\.planning\/validations\/[a-z0-9][a-z0-9.-]*\.json$/u
    ],
    requiredPatterns: [/^\.planning\/sections\/evaluation\/reviews\/.+\.md$/u],
    requiredKinds: ['validation'],
    requiredChanged: ['.planning/sections/evaluation/section.json']
  },
  'pause-writing': {
    allowedDirectories: [/^\.planning\/checkpoints$/u],
    allowed: [
      /^\.planning\/state\.json$/u,
      /^\.planning\/sections\/evaluation\/section\.json$/u,
      /^\.planning\/sections\/evaluation\/handoff\.md$/u,
      /^\.planning\/checkpoints\/[a-z0-9][a-z0-9.-]*\.json$/u
    ],
    required: ['.planning/sections/evaluation/handoff.md'],
    requiredKinds: ['checkpoint'],
    requiredChanged: [
      '.planning/state.json',
      '.planning/sections/evaluation/section.json'
    ]
  },
  'resume-writing': {
    allowedDirectories: [],
    allowed: [
      /^\.planning\/state\.json$/u,
      /^\.planning\/checkpoints\/[a-z0-9][a-z0-9.-]*\.json$/u
    ],
    requiredChanged: ['.planning/state.json'],
    requireChangedKind: ['checkpoint']
  },
  progress: {
    allowedDirectories: [],
    allowed: [],
    requireNoChanges: true
  }
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
}

function normalizedRelative(value) {
  return value.split(path.sep).join('/');
}

function isContained(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function walkFiles(root, options = {}, relative = '') {
  const { exclude = () => false, rejectSymlinks = true } = options;
  const output = [];
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const childRelative = path.join(relative, entry.name);
    const normalized = normalizedRelative(childRelative);
    if (exclude(normalized, entry)) continue;
    const absolute = path.join(root, childRelative);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      if (rejectSymlinks) throw new Error(`refusing symbolic link in lifecycle input: ${absolute}`);
      output.push({ path: normalized, absolute, stat, kind: 'symlink' });
    } else if (entry.isDirectory()) {
      output.push(...walkFiles(root, options, childRelative));
    } else if (entry.isFile()) {
      output.push({ path: normalized, absolute, stat, kind: 'file' });
    } else {
      throw new Error(`refusing non-file lifecycle input: ${absolute}`);
    }
  }
  return output;
}

function hashTree(root, options = {}) {
  const inventory = walkFiles(root, options).map(entry => ({
    path: entry.path,
    bytes: entry.stat.size,
    mode: entry.stat.mode & 0o777,
    sha256: entry.kind === 'file' ? sha256(fs.readFileSync(entry.absolute)) : null,
    kind: entry.kind
  }));
  return {
    sha256: sha256(Buffer.from(JSON.stringify(inventory), 'utf8')),
    files: inventory
  };
}

function projectEntries(root, relative = '') {
  const output = [];
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const childRelative = path.join(relative, entry.name);
    const normalized = normalizedRelative(childRelative);
    if (normalized === '.git' || normalized.startsWith('.git/')) continue;
    const absolute = path.join(root, childRelative);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`refusing symbolic link in lifecycle project: ${absolute}`);
    if (entry.isDirectory()) {
      output.push({ path: normalized, bytes: 0, mode: stat.mode & 0o777, sha256: null, kind: 'directory' });
      output.push(...projectEntries(root, childRelative));
    } else if (entry.isFile()) {
      output.push({
        path: normalized,
        bytes: stat.size,
        mode: stat.mode & 0o777,
        sha256: sha256(fs.readFileSync(absolute)),
        kind: 'file'
      });
    } else {
      throw new Error(`refusing non-file lifecycle project entry: ${absolute}`);
    }
  }
  return output;
}

function snapshotProject(root) {
  const entries = projectEntries(root);
  return Object.fromEntries(entries.map(entry => [entry.path, entry]));
}

function diffSnapshots(before, after) {
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return paths.flatMap(file => {
    if (!before[file]) return [{ path: file, change: 'created', before: null, after: after[file] }];
    if (!after[file]) return [{ path: file, change: 'deleted', before: before[file], after: null }];
    if (before[file].sha256 !== after[file].sha256 || before[file].kind !== after[file].kind ||
      before[file].mode !== after[file].mode || before[file].bytes !== after[file].bytes) {
      return [{ path: file, change: 'modified', before: before[file], after: after[file] }];
    }
    return [];
  });
}

function readPlanningRecords(projectRoot) {
  const planningRoot = path.join(projectRoot, '.planning');
  if (!fs.existsSync(planningRoot)) return [];
  return walkFiles(planningRoot)
    .filter(entry => entry.path.endsWith('.json'))
    .map(entry => {
      let value;
      try {
        value = JSON.parse(fs.readFileSync(entry.absolute, 'utf8'));
      } catch (error) {
        value = { __parse_error: error.message };
      }
      return {
        path: `.planning/${entry.path}`,
        sha256: sha256(fs.readFileSync(entry.absolute)),
        value,
        type: typeof value.schema === 'string'
          ? value.schema.match(/^wtfp\.project\.([a-z][a-z0-9-]*)\/v1$/u)?.[1] || null
          : null
      };
    });
}

function recordUri(type, id) {
  const roots = {
    manifest: 'project://manifest',
    config: 'project://config',
    state: 'project://state',
    decisions: 'project://decisions',
    outline: 'project://structure/outline',
    section: `project://sections/${id}`,
    source: `project://sources/${id}`,
    evidence: `project://evidence/${id}`,
    checkpoint: `project://checkpoints/${id}`,
    validation: `project://validations/${id}`
  };
  return roots[type] || null;
}

function duplicateValues(values) {
  const observed = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (observed.has(value)) duplicates.add(value);
    observed.add(value);
  }
  return [...duplicates].sort();
}

function checkMutationBoundary(action, before, after, recordsBefore, recordsAfter) {
  const rule = PHASE_RULES[action];
  if (!rule) throw new Error(`no lifecycle mutation rule for ${action}`);
  const changes = diffSnapshots(before, after);
  const errors = [];

  for (const change of changes) {
    const directoryChange = change.before?.kind === 'directory' || change.after?.kind === 'directory';
    const allowedDirectoryCreation = directoryChange && change.change === 'created' &&
      (rule.allowedDirectories || []).some(pattern => pattern.test(change.path));
    if (directoryChange && !allowedDirectoryCreation) {
      errors.push(`${action}: undeclared ${change.change} directory ${change.path}`);
    } else if (!directoryChange && !rule.allowed.some(pattern => pattern.test(change.path))) {
      errors.push(`${action}: undeclared ${change.change} path ${change.path}`);
    }
    if (change.change === 'deleted') errors.push(`${action}: deleted project path ${change.path}`);
    if (change.after?.kind === 'symlink') errors.push(`${action}: created symbolic link ${change.path}`);
  }

  for (const required of rule.required || []) {
    const match = changes.find(change => change.path === required && change.change === 'created');
    if (!match) errors.push(`${action}: required created path missing: ${required}`);
  }
  for (const required of rule.requiredChanged || []) {
    if (!changes.some(change => change.path === required)) {
      errors.push(`${action}: required state transition did not change ${required}`);
    }
  }
  for (const pattern of rule.requiredPatterns || []) {
    if (!changes.some(change => change.change === 'created' && pattern.test(change.path))) {
      errors.push(`${action}: required created path pattern missing: ${pattern}`);
    }
  }
  if (rule.requireNoChanges && changes.length > 0) {
    errors.push(`${action}: read-only action changed ${changes.map(change => change.path).join(', ')}`);
  }

  const beforePathsByType = new Map();
  for (const record of recordsBefore) {
    if (!beforePathsByType.has(record.type)) beforePathsByType.set(record.type, new Set());
    beforePathsByType.get(record.type).add(record.path);
  }
  for (const kind of rule.requiredKinds || []) {
    const beforePaths = beforePathsByType.get(kind) || new Set();
    if (!recordsAfter.some(record => record.type === kind && !beforePaths.has(record.path))) {
      errors.push(`${action}: did not create a new ${kind} record`);
    }
  }
  for (const kind of rule.requireChangedKind || []) {
    const beforeByPath = new Map(recordsBefore.filter(record => record.type === kind)
      .map(record => [record.path, record.sha256]));
    if (!recordsAfter.some(record => record.type === kind && beforeByPath.has(record.path) &&
      beforeByPath.get(record.path) !== record.sha256)) {
      errors.push(`${action}: did not update an existing ${kind} record`);
    }
  }

  return { valid: errors.length === 0, action, changes, errors };
}

function checkRevisionContinuity(previousRecords, currentRecords) {
  const errors = [];
  const prior = new Map(previousRecords.map(record => [record.path, record]));
  for (const record of currentRecords) {
    const before = prior.get(record.path);
    if (!before || before.sha256 === record.sha256) continue;
    const oldRevision = before.value?.revision;
    const newRevision = record.value?.revision;
    if (Number.isInteger(oldRevision) && Number.isInteger(newRevision) && newRevision <= oldRevision) {
      errors.push(`${record.path}: revision ${newRevision} did not advance beyond ${oldRevision}`);
    }
    const oldUpdated = before.value?.updated_at;
    const newUpdated = record.value?.updated_at;
    if (typeof oldUpdated === 'string' && typeof newUpdated === 'string') {
      const oldTime = Date.parse(oldUpdated);
      const newTime = Date.parse(newUpdated);
      if (!Number.isFinite(oldTime) || !Number.isFinite(newTime)) {
        errors.push(`${record.path}: updated_at is not a parseable chronology timestamp`);
      } else if (newTime <= oldTime) {
        errors.push(`${record.path}: updated_at did not advance after content changed`);
      }
    }
    if (before.value?.id && record.value?.id && before.value.id !== record.value.id) {
      errors.push(`${record.path}: stable id changed from ${before.value.id} to ${record.value.id}`);
    }
    if (before.value?.project_id && record.value?.project_id &&
      before.value.project_id !== record.value.project_id) {
      errors.push(`${record.path}: project_id changed`);
    }
    if (before.value?.created_at && record.value?.created_at &&
      before.value.created_at !== record.value.created_at) {
      errors.push(`${record.path}: created_at changed`);
    }
  }
  return errors;
}

function logicalUriPath(projectRoot, uri) {
  if (uri === 'project://manifest') return path.join(projectRoot, '.planning', 'project.json');
  if (uri === 'project://config') return path.join(projectRoot, '.planning', 'config.json');
  if (uri === 'project://state') return path.join(projectRoot, '.planning', 'state.json');
  if (uri === 'project://decisions') return path.join(projectRoot, '.planning', 'decisions.json');
  if (uri === 'project://structure/outline') return path.join(projectRoot, '.planning', 'structure', 'outline.json');
  const patterns = [
    [/^project:\/\/materials\/(.+)$/u, match => match[1]],
    [/^project:\/\/paper\/(.+)$/u, match => path.join('paper', match[1])],
    [/^project:\/\/deliverables\/(.+)$/u, match => path.join('deliverables', match[1])],
    [/^project:\/\/archives\/(.+)$/u, match => path.join('.planning', 'archives', match[1])],
    [/^project:\/\/sections\/([^/]+)$/u, match => path.join('.planning', 'sections', match[1], 'section.json')],
    [/^project:\/\/sections\/([^/]+)\/context$/u, match => path.join('.planning', 'sections', match[1], 'context.md')],
    [/^project:\/\/sections\/([^/]+)\/research$/u, match => path.join('.planning', 'sections', match[1], 'research.md')],
    [/^project:\/\/sections\/([^/]+)\/summary$/u, match => path.join('.planning', 'sections', match[1], 'summary.md')],
    [/^project:\/\/sections\/([^/]+)\/handoff$/u, match => path.join('.planning', 'sections', match[1], 'handoff.md')],
    [/^project:\/\/sections\/([^/]+)\/plans\/([^/]+)$/u,
      match => path.join('.planning', 'sections', match[1], 'plans', `${match[2]}.md`)],
    [/^project:\/\/sections\/([^/]+)\/reviews\/([^/]+)$/u,
      match => path.join('.planning', 'sections', match[1], 'reviews', `${match[2]}.md`)],
    [/^project:\/\/sources\/([^/]+)$/u, match => path.join('.planning', 'sources', `${match[1]}.json`)],
    [/^project:\/\/evidence\/([^/]+)$/u, match => path.join('.planning', 'evidence', `${match[1]}.json`)],
    [/^project:\/\/checkpoints\/([^/]+)$/u, match => path.join('.planning', 'checkpoints', `${match[1]}.json`)],
    [/^project:\/\/validations\/([^/]+)$/u, match => path.join('.planning', 'validations', `${match[1]}.json`)]
  ];
  for (const [pattern, relative] of patterns) {
    const match = uri.match(pattern);
    if (match) return path.join(projectRoot, relative(match));
  }
  return null;
}

function checkResolvedResource(projectRoot, uri, label, errors, optional = false) {
  const resolved = logicalUriPath(projectRoot, uri);
  if (!resolved) {
    errors.push(`${label}: unsupported logical resource ${uri}`);
    return;
  }
  if (!isContained(projectRoot, resolved)) {
    errors.push(`${label}: logical resource escaped project root ${uri}`);
    return;
  }
  if (!fs.existsSync(resolved)) {
    if (!optional) errors.push(`${label}: logical resource does not exist ${uri}`);
    return;
  }
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isFile()) errors.push(`${label}: logical resource is not a regular file ${uri}`);
}

function checkLifecycleRecords(projectRoot, expectedDecisions, phase, previousRecords = []) {
  const records = readPlanningRecords(projectRoot);
  const errors = [];
  const byType = new Map();
  const byUri = new Map();
  for (const record of records) {
    if (record.value.__parse_error) errors.push(`${record.path}: ${record.value.__parse_error}`);
    if (!record.type) errors.push(`${record.path}: unsupported or missing planning schema discriminator`);
    if (!byType.has(record.type)) byType.set(record.type, []);
    byType.get(record.type).push(record);
    const uri = recordUri(record.type, record.value.id);
    if (uri) {
      if (byUri.has(uri)) errors.push(`${record.path}: duplicate logical resource ${uri}`);
      byUri.set(uri, record);
      const canonicalPath = logicalUriPath(projectRoot, uri);
      const canonicalRelative = canonicalPath
        ? normalizedRelative(path.relative(projectRoot, canonicalPath))
        : null;
      if (canonicalRelative !== record.path) {
        errors.push(`${record.path}: record id resolves canonically to ${canonicalRelative || 'no supported path'}`);
      }
    }
  }

  for (const singleton of ['manifest', 'config', 'state', 'decisions', 'outline']) {
    if ((byType.get(singleton) || []).length !== 1) {
      errors.push(`expected exactly one ${singleton} record`);
    }
  }
  const manifest = byType.get('manifest')?.[0]?.value;
  const projectIds = records.flatMap(record => {
    if (record.type === 'manifest') return record.value.id ? [record.value.id] : [];
    return record.value.project_id ? [record.value.project_id] : [];
  });
  if (new Set(projectIds).size > 1) errors.push(`cross-record project IDs differ: ${[...new Set(projectIds)].join(', ')}`);
  if (manifest?.id !== PROJECT_ID) errors.push(`manifest id must remain ${PROJECT_ID}`);
  if (manifest) {
    const coreArtifacts = {
      manifest: 'project://manifest',
      config: 'project://config',
      state: 'project://state',
      decisions: 'project://decisions',
      outline: 'project://structure/outline'
    };
    for (const [key, expected] of Object.entries(coreArtifacts)) {
      if (manifest.artifacts?.[key] !== expected) errors.push(`manifest artifacts.${key} must remain ${expected}`);
    }
    for (const collection of ['materials', 'manuscripts', 'deliverables', 'archives']) {
      for (const uri of manifest.artifacts?.[collection] || []) {
        checkResolvedResource(projectRoot, uri, `manifest artifacts.${collection}`, errors);
      }
    }
    const expectedMaterials = [
      'project://materials/project-brief.md',
      'project://materials/benchmark-observations.md',
      'project://materials/author-decisions.json'
    ].sort();
    const observedMaterials = [...(manifest.artifacts?.materials || [])].sort();
    if (JSON.stringify(observedMaterials) !== JSON.stringify(expectedMaterials)) {
      errors.push('manifest materials must be exactly the three model-visible fixture inputs');
    }
  }

  const decisions = byType.get('decisions')?.[0]?.value;
  if (decisions) {
    const expectedIds = expectedDecisions.map(item => item.id).sort();
    const actualIds = (decisions.items || []).map(item => item.id).sort();
    if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
      errors.push(`author decisions must be exactly: ${expectedIds.join(', ')}`);
    }
    for (const expected of expectedDecisions) {
      const actual = decisions.items?.find(item => item.id === expected.id);
      if (!actual) errors.push(`missing author decision ${expected.id}`);
      else {
        if (actual.authority !== 'author') errors.push(`${expected.id}: authority is not author`);
        if (actual.disposition !== expected.disposition) {
          errors.push(`${expected.id}: disposition ${actual.disposition} != ${expected.disposition}`);
        }
        if (actual.statement !== expected.statement) errors.push(`${expected.id}: statement changed`);
      }
    }
    const duplicateDecisions = duplicateValues((decisions.items || []).map(item => item.id));
    if (duplicateDecisions.length) errors.push(`duplicate decision IDs: ${duplicateDecisions.join(', ')}`);
  }

  const outline = byType.get('outline')?.[0]?.value;
  const sections = byType.get('section') || [];
  if (outline) {
    const ids = (outline.sections || []).map(section => section.id);
    const duplicates = duplicateValues(ids);
    if (duplicates.length) errors.push(`duplicate outline section IDs: ${duplicates.join(', ')}`);
    const sum = (outline.sections || []).reduce((total, section) => total + (section.word_target || 0), 0);
    if (sum !== outline.target_words) errors.push(`outline word targets total ${sum}, expected ${outline.target_words}`);
    for (const section of outline.sections || []) {
      for (const dependency of section.depends_on || []) {
        if (!ids.includes(dependency)) errors.push(`outline section ${section.id} has unknown dependency ${dependency}`);
        const prerequisite = outline.sections.find(candidate => candidate.id === dependency);
        if (prerequisite && prerequisite.wave >= section.wave) {
          errors.push(`outline dependency ${dependency} must precede ${section.id} in an earlier wave`);
        }
      }
    }
    if (ACTION_SEQUENCE.indexOf(phase) >= ACTION_SEQUENCE.indexOf('create-outline')) {
      const expectedIds = EXPECTED_SECTIONS.map(section => section.id);
      if (JSON.stringify([...ids].sort()) !== JSON.stringify([...expectedIds].sort())) {
        errors.push(`outline sections must be the six stable lifecycle IDs: ${expectedIds.join(', ')}`);
      }
      if (outline.target_words !== 6000) errors.push('outline target_words must remain 6000');
      for (const expected of EXPECTED_SECTIONS) {
        const actual = outline.sections.find(section => section.id === expected.id);
        if (actual?.word_target !== expected.words) {
          errors.push(`outline section ${expected.id} word_target must be ${expected.words}`);
        }
      }
    }
  }

  const outlineSections = new Map((outline?.sections || []).map(section => [section.id, section]));
  for (const record of sections) {
    const section = record.value;
    const source = outlineSections.get(section.id);
    if (!source) errors.push(`${record.path}: section is absent from outline`);
    else {
      for (const field of ['title', 'goal', 'word_target', 'wave']) {
        if (section[field] !== source[field]) errors.push(`${record.path}: ${field} differs from outline`);
      }
      if (JSON.stringify(section.depends_on) !== JSON.stringify(source.depends_on)) {
        errors.push(`${record.path}: dependencies differ from outline`);
      }
      const sectionClaimIds = (section.claims || []).map(claim => claim.id).sort();
      const outlineClaimIds = (source.claim_ids || []).slice().sort();
      if (JSON.stringify(sectionClaimIds) !== JSON.stringify(outlineClaimIds)) {
        errors.push(`${record.path}: claim IDs differ from outline`);
      }
    }
    for (const claim of section.claims || []) {
      for (const uri of claim.evidence_uris || []) {
        if (!byUri.has(uri)) errors.push(`${record.path}: claim ${claim.id} references missing ${uri}`);
      }
    }
    for (const uri of section.checkpoint_uris || []) {
      if (!byUri.has(uri)) errors.push(`${record.path}: references missing checkpoint ${uri}`);
    }
    for (const uri of section.validation_uris || []) {
      if (!byUri.has(uri)) errors.push(`${record.path}: references missing validation ${uri}`);
    }
    for (const [kind, value] of Object.entries(section.artifacts || {})) {
      const uris = Array.isArray(value) ? value : [value];
      for (const uri of uris) {
        const preMaterializationInput = phase === 'create-outline' && ['context', 'research'].includes(kind);
        checkResolvedResource(projectRoot, uri, `${record.path} artifacts.${kind}`, errors, preMaterializationInput);
      }
    }
  }

  const state = byType.get('state')?.[0]?.value;
  if (state && outline) {
    if (state.progress.sections_total !== outline.sections.length) {
      errors.push(`state sections_total ${state.progress.sections_total} != outline count ${outline.sections.length}`);
    }
    if (state.progress.word_target !== outline.target_words) {
      errors.push(`state word_target ${state.progress.word_target} != outline target ${outline.target_words}`);
    }
    if (state.progress.sections_complete > state.progress.sections_total) {
      errors.push('state sections_complete exceeds sections_total');
    }
    const sectionWordCount = sections.reduce((total, record) => total + (record.value.word_count || 0), 0);
    if (state.progress.word_count !== sectionWordCount) {
      errors.push(`state word_count ${state.progress.word_count} != section total ${sectionWordCount}`);
    }
    if (state.current_section_uri && !byUri.has(state.current_section_uri) &&
      ACTION_SEQUENCE.indexOf(phase) >= ACTION_SEQUENCE.indexOf('create-outline')) {
      errors.push(`state current section is missing: ${state.current_section_uri}`);
    }
    for (const uri of state.active_checkpoint_uris || []) {
      if (!byUri.has(uri)) errors.push(`state references missing active checkpoint ${uri}`);
    }
  }

  for (const record of byType.get('evidence') || []) {
    if (!byUri.has(record.value.source_uri)) {
      errors.push(`${record.path}: references missing source ${record.value.source_uri}`);
    }
  }
  for (const record of byType.get('validation') || []) {
    if (!Array.isArray(record.value.effects_applied) || record.value.effects_applied.length !== 0) {
      errors.push(`${record.path}: verifier/reviewer validation must not claim effects were applied`);
    }
    checkResolvedResource(projectRoot, record.value.subject_uri, `${record.path} subject_uri`, errors);
  }
  for (const record of byType.get('checkpoint') || []) {
    checkResolvedResource(projectRoot, record.value.scope_uri, `${record.path} scope_uri`, errors);
  }

  const evaluation = sections.find(record => record.value.id === SECTION_ID)?.value;
  const validationRecords = byType.get('validation') || [];
  const previousPaths = new Set(previousRecords.map(record => record.path));
  const newValidations = validationRecords.filter(record => !previousPaths.has(record.path));
  const requireOrderedValidation = ({ action, role, subjects, requirePassed }) => {
    const matches = validationRecords.filter(record =>
      record.value.action_id === action && record.value.validator_role === role);
    if (matches.length !== 1) {
      errors.push(`${action} requires exactly one ${role} validation; observed ${matches.length}`);
    }
    if (matches.length === 0) {
      return;
    }
    for (const record of matches) {
      if (!subjects.includes(record.value.subject_uri)) {
        errors.push(`${record.path}: subject_uri is not the validated ${action} artifact`);
      }
      const uri = recordUri('validation', record.value.id);
      if (!(evaluation?.validation_uris || []).includes(uri)) {
        errors.push(`${record.path}: validation is not linked from the evaluation section`);
      }
      if (requirePassed && record.value.status !== 'passed') {
        errors.push(`${record.path}: ${role} validation did not pass`);
      }
    }
    if (phase === action && !newValidations.some(record => matches.includes(record))) {
      errors.push(`${action} did not create a new ${role} validation in this transition`);
    }
    const currentTimes = matches.map(record => Date.parse(record.value.executed_at));
    if (currentTimes.some(time => !Number.isFinite(time))) {
      errors.push(`${action} validation has an unparsable executed_at timestamp`);
    }
    const actionIndex = ACTION_SEQUENCE.indexOf(action);
    const previousTimes = validationRecords.filter(record => {
      const recordIndex = ACTION_SEQUENCE.indexOf(record.value.action_id);
      return recordIndex >= 0 && recordIndex < actionIndex;
    }).map(record => Date.parse(record.value.executed_at));
    if (previousTimes.some(time => !Number.isFinite(time))) {
      errors.push(`${action} has an earlier validation with an unparsable executed_at timestamp`);
    }
    if (previousTimes.every(Number.isFinite) && currentTimes.every(Number.isFinite) && previousTimes.length &&
      currentTimes.some(time => time <= Math.max(...previousTimes))) {
      errors.push(`${action} validation executed_at does not strictly follow earlier lifecycle validation`);
    }
  };
  if (ACTION_SEQUENCE.indexOf(phase) >= ACTION_SEQUENCE.indexOf('create-outline')) {
    const sectionIds = sections.map(record => record.value.id).sort();
    const expectedIds = EXPECTED_SECTIONS.map(section => section.id).sort();
    if (JSON.stringify(sectionIds) !== JSON.stringify(expectedIds)) {
      errors.push(`section records must cover the six stable lifecycle IDs: ${expectedIds.join(', ')}`);
    }
    const outlineValidations = validationRecords.filter(record => record.value.action_id === 'create-outline');
    if (outlineValidations.length !== 1) {
      errors.push(`create-outline requires exactly one validation; observed ${outlineValidations.length}`);
    }
    for (const record of outlineValidations) {
      if (record.value.subject_uri !== 'project://structure/outline') {
        errors.push(`${record.path}: create-outline validation must target project://structure/outline`);
      }
      if (record.value.validator_role !== 'outliner') {
        errors.push(`${record.path}: create-outline validation must use semantic validator_role outliner`);
      }
      if (record.value.status !== 'passed') errors.push(`${record.path}: create-outline validation did not pass`);
    }
    if (phase === 'create-outline' && !newValidations.some(record => outlineValidations.includes(record))) {
      errors.push('create-outline did not create its validation in this transition');
    }
  }
  if (ACTION_SEQUENCE.indexOf(phase) >= ACTION_SEQUENCE.indexOf('plan-section')) {
    if (evaluation?.artifacts?.context !== 'project://sections/evaluation/context') {
      errors.push('evaluation section does not link its exact context resource');
    }
    if (evaluation?.artifacts?.research !== 'project://sections/evaluation/research') {
      errors.push('evaluation section does not link its exact research resource');
    }
    if ((evaluation?.artifacts?.plans || []).length === 0) errors.push('evaluation section has no approved plan link');
    requireOrderedValidation({
      action: 'plan-section',
      role: 'plan-checker',
      subjects: evaluation?.artifacts?.plans || [],
      requirePassed: true
    });
  }
  if (ACTION_SEQUENCE.indexOf(phase) >= ACTION_SEQUENCE.indexOf('write-section')) {
    const manuscriptUri = 'project://paper/evaluation.md';
    if (evaluation?.artifacts?.manuscript !== manuscriptUri) {
      errors.push(`evaluation section does not link ${manuscriptUri}`);
    }
    if (evaluation?.artifacts?.summary !== 'project://sections/evaluation/summary') {
      errors.push('evaluation section does not link its exact summary resource');
    }
    if (!(manifest?.artifacts?.manuscripts || []).includes(manuscriptUri)) {
      errors.push(`manifest does not index ${manuscriptUri}`);
    }
    if (!Number.isInteger(evaluation?.word_count) || evaluation.word_count <= 0) {
      errors.push('evaluation section word_count was not reconciled from the draft');
    }
    requireOrderedValidation({
      action: 'write-section',
      role: 'argument-verifier',
      subjects: [manuscriptUri],
      requirePassed: true
    });
  }
  if (ACTION_SEQUENCE.indexOf(phase) >= ACTION_SEQUENCE.indexOf('review-section')) {
    if ((evaluation?.artifacts?.reviews || []).length === 0) errors.push('evaluation section has no review link');
    requireOrderedValidation({
      action: 'review-section',
      role: 'section-reviewer',
      subjects: ['project://paper/evaluation.md'],
      requirePassed: false
    });
  }
  if (phase === 'pause-writing') {
    if (state?.status !== 'paused') errors.push('pause-writing must leave state.status paused');
    if (!evaluation?.artifacts?.handoff) errors.push('pause-writing must link the evaluation handoff');
    if ((evaluation?.checkpoint_uris || []).length === 0) {
      errors.push('pause-writing must link at least one durable checkpoint');
    }
    for (const uri of evaluation?.checkpoint_uris || []) {
      const checkpoint = byUri.get(uri)?.value;
      if (checkpoint?.kind !== 'human-action' || checkpoint.status !== 'pending' || checkpoint.blocking !== true) {
        errors.push(`pause-writing checkpoint must be a pending blocking human-action: ${uri}`);
      }
      if (checkpoint?.resume_action !== 'resume-writing') {
        errors.push(`pause-writing checkpoint must resume through resume-writing: ${uri}`);
      }
      if (!(state?.active_checkpoint_uris || []).includes(uri)) {
        errors.push(`pause-writing checkpoint is not active in state: ${uri}`);
      }
    }
  }
  if (['resume-writing', 'progress'].includes(phase)) {
    if (state?.status !== 'active') errors.push(`${phase} must observe active resumed state`);
    if (!evaluation?.artifacts?.handoff) errors.push(`${phase} lost the durable evaluation handoff`);
    if ((evaluation?.checkpoint_uris || []).length === 0) errors.push(`${phase} lost checkpoint linkage`);
    for (const uri of evaluation?.checkpoint_uris || []) {
      const checkpoint = byUri.get(uri)?.value;
      if (checkpoint?.kind === 'human-action' && checkpoint.resume_action === 'resume-writing') {
        if (checkpoint.status !== 'resolved' || !checkpoint.resolution) {
          errors.push(`${phase} did not durably resolve the pause checkpoint ${uri}`);
        }
        if ((state?.active_checkpoint_uris || []).includes(uri)) {
          errors.push(`${phase} left the resolved pause checkpoint active: ${uri}`);
        }
      }
    }
  }

  errors.push(...checkRevisionContinuity(previousRecords, records));
  return {
    schema: 'wtfp.evaluation.lifecycle-invariants/v1',
    phase,
    valid: errors.length === 0,
    record_count: records.length,
    record_counts: Object.fromEntries([...byType.entries()].sort().map(([type, values]) => [type, values.length])),
    errors,
    records: records.map(record => ({ path: record.path, type: record.type, sha256: record.sha256 }))
  };
}

function extractInvocationArguments(events) {
  const open = '<invocation_arguments>\n';
  const close = '\n</invocation_arguments>';
  for (const event of events) {
    if (!['message_start', 'message_end'].includes(event.type) || event.message?.role !== 'user') continue;
    for (const content of event.message.content || []) {
      if (content.type !== 'text' || typeof content.text !== 'string') continue;
      const start = content.text.lastIndexOf(open);
      if (start === -1) continue;
      const end = content.text.indexOf(close, start + open.length);
      if (end !== -1) return content.text.slice(start + open.length, end);
    }
  }
  return null;
}

function parseJsonLines(text) {
  const events = [];
  const errors = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch (error) {
      errors.push(`line ${index + 1}: ${error.message}`);
    }
  }
  return { events, errors };
}

function actionPayloads({ target = 'openai-codex', model = 'gpt-5.6-terra', effort = 'xhigh' } = {}) {
  const common = [
    'The selected root is disposable. Read and write only declared project or extension resources.',
    'Do not use network, shell, or version-control tools. Do not initialize, stage, commit, branch, merge, push, tag, or publish.',
    'Schema-validate every JSON record, preserve stable IDs and author authority, replace updates atomically, and report actual mutations and non-mutations truthfully.',
    ARGUMENT_FIDELITY_MARKER
  ].join('\n');
  const workerRoute = [
    `For every required dispatch, explicitly set target=${JSON.stringify(target)}, model=${JSON.stringify(model)}, thinking_level=${JSON.stringify(effort)}, and node="local".`,
    'Dispatch each named specialist exactly once and do not dispatch any other agent.',
    'A mutation specialist must report at least one project-relative path it actually changed and only validations it actually performed.',
    'For a verifier specialist, copy every returned check into the canonical validation in the same order: preserve its name exactly as summary, map passed to passed or failed exactly, and preserve its evidence as the sole evidence item. Never turn a failing specialist verdict into a pass.'
  ].join(' ');

  return {
    'new-paper': [
      'durable workflows',
      `Initialize project ${PROJECT_ID} from project-brief.md, benchmark-observations.md, and author-decisions.json.`,
      'Index those three existing files in manifest.artifacts.materials without rewriting them.',
      `Use document type research-article and working title "${TITLE}". The target is 6,000 words for systems researchers.`,
      'All model-visible facts are synthetic and closed-world; citations, venue rules, and external generalization remain unavailable.',
      'Preserve the three author decisions verbatim with author authority and their locked, deferred, and discretion dispositions.',
      'Use standard interaction and depth, Markdown, en-US, all safety and workflow checks enabled, and at most two workers.',
      'The project-initialization gate is explicitly granted for exactly the five canonical v1 records. No other mutation is authorized.',
      common
    ].join('\n'),
    'map-project': [
      'Map the initialized project using only project-brief.md, benchmark-observations.md, and author-decisions.json.',
      'Create contained source/evidence records for the supplied synthetic observations: 128 nodes, eight trials per configuration, means 41.2 s and 27.8 s, completed fixture recovery checks, and the stated limitations.',
      'Do not invent a bibliography, citation, raw trials, uncertainty, identity, venue, or external evidence. Transition portable state to mapped.',
      'Local project mapping and the exact declared source/evidence/state writes are authorized. No external lookup is authorized.',
      common
    ].join('\n'),
    'create-outline': [
      `Create the approved six-section outline for project ${PROJECT_ID}.`,
      'Use stable section IDs and word targets exactly: introduction 800, background 900, method 1200, evaluation 700, discussion 1400, conclusion 1000.',
      'Keep the bounded synthetic central claim, supplied evidence, limitations, and exact author decisions visible in section obligations and dependencies.',
      'The outline-approval gate is granted for this exact structure and the declared outline, section, state, and validation writes only.',
      'Use wtfp-outliner as an independent specialist and reconcile its structured result before applying any mutation.',
      workerRoute,
      'Record exactly one create-outline validation for the approved structure with semantic validator_role outliner.',
      common
    ].join('\n'),
    'plan-section': [
      `Plan only section ${SECTION_ID}. Its approved target is 700 words.`,
      'Read .planning/sections/evaluation/context.md and research.md plus the portable records. Create one immutable executable plan, link it from the section, and update state.',
      'The plan must cover the two recorded means, trial counts, recovery-check observation, synthetic scope, missing uncertainty, forbidden generalizations, and all author decisions.',
      'Use wtfp-section-planner, then independently use wtfp-plan-checker. Do not skip or merge the checker boundary.',
      workerRoute,
      'Persist the independent result as a passed plan-section validation with semantic validator_role plan-checker.',
      'The plan-approval gate is granted only if the checker passes with no exception. No verifier exception is authorized.',
      common
    ].join('\n'),
    'write-section': [
      `Draft only section ${SECTION_ID} from its approved current plan into paper/evaluation.md, about 700 words.`,
      'Use wtfp-section-writer, then independently use wtfp-argument-verifier. Reconcile both structured results before updating project state.',
      workerRoute,
      'Persist the independent result as a passed write-section validation with semantic validator_role argument-verifier.',
      'Every quantitative statement must remain traceable to supplied evidence; distinguish observation from inference; use no citations; make no statistical, production, universal, or reliability claim.',
      'The declared manuscript, manifest, summary, validation, checkpoint-if-needed, section, and state writes are authorized only after the approved plan and verifier pass. No verifier exception is authorized.',
      common
    ].join('\n'),
    'review-section': [
      `Review only the drafted ${SECTION_ID} section against its plan, evidence, decisions, outline obligations, and 700-word target.`,
      'Use wtfp-section-reviewer as an independent read-only verifier. Create a detailed review and validation record and link them from the section; do not revise the manuscript.',
      workerRoute,
      'Use semantic validator_role section-reviewer and action_id review-section in the validation record.',
      'Use the standard evidence/argument persona. Record every unsupported or over-broad claim rather than silently fixing it.',
      'The review-persona gate is granted for that standard persona. No disputed finding is waived or authorized for mutation.',
      common
    ].join('\n'),
    'pause-writing': [
      `Pause after review of section ${SECTION_ID}.`,
      'Create a durable handoff and a pending, blocking human-action checkpoint linked from the section and state. Set its resume_action to resume-writing and include progress as the exact operator-selectable continuation.',
      'Capture exact current position, plan/review/validation/manuscript URIs, unresolved blockers, author decisions, and the next safe action.',
      'Leave state explicitly paused. Do not rely on conversational memory or version-control state.',
      common
    ].join('\n'),
    'resume-writing': [
      `Resume project ${PROJECT_ID} from durable project records only. This is a fresh session with no prior conversation available.`,
      'Read and validate manifest, config, state, decisions, outline, current section, plan, review, handoff, checkpoint, validations, summary, and manuscript before selecting work.',
      'Resolve the pause checkpoint and return state to active only when durable records are coherent. The resume-action gate is granted for progress as the exact next action; do not draft or revise prose.',
      'Report the reconstructed position and any blocker without assuming hidden memory.',
      common
    ].join('\n'),
    progress: [
      `Report progress for project ${PROJECT_ID} after resume, using portable records and verified artifacts only.`,
      'This action is read-only. Reconcile section totals, completed work, current section, decisions, checkpoints, validations, draft/review state, and the next safe canonical action.',
      'The recommendation-selection gate permits naming one next action but does not authorize that action or any mutation.',
      common
    ].join('\n')
  };
}

function buildActionPlan({ binary, target, model, effort, timeoutMinutes }) {
  const payloads = actionPayloads({ target, model, effort });
  return ACTION_SEQUENCE.map((action, index) => {
    const invocation = `/wtfp:${action}\n${payloads[action]}`;
    const session = index <= 6 ? (index === 0 ? 'new:S1' : 'resume:S1')
      : (index === 7 ? 'new:S2' : 'resume:S2');
    const args = [
      binary,
      'run',
      '--target', target,
      '--model', model,
      '--thinking', effort,
      '--autonomy', action === 'progress' ? 'read-only' : 'auto-edit',
      '--json-events', 'full',
      ...(session.startsWith('resume:') ? ['--session', `{{${session.slice(7)}}}`] : []),
      invocation
    ];
    return {
      index: index + 1,
      action,
      session,
      process_boundary: true,
      fresh_conversation: session.startsWith('new:'),
      invocation,
      invocation_arguments: payloads[action],
      invocation_sha256: sha256(Buffer.from(invocation, 'utf8')),
      arguments_sha256: sha256(Buffer.from(payloads[action], 'utf8')),
      arguments_bytes: Buffer.byteLength(payloads[action], 'utf8'),
      fidelity: {
        quotes: [...payloads[action]].filter(character => character === '"').length,
        contains_repeated_space: payloads[action].includes('  '),
        contains_literal_tab: payloads[action].includes('\t'),
        contains_literal_dollar_one: payloads[action].includes('$1')
      },
      cli: {
        executable: process.execPath,
        argv: args,
        argv_sha256: sha256(Buffer.from(JSON.stringify(args), 'utf8')),
        timeout_ms: timeoutMinutes * 60 * 1000
      }
    };
  });
}

module.exports = {
  ACTION_SEQUENCE,
  ARGUMENT_FIDELITY_MARKER,
  EXPECTED_SECTIONS,
  PHASE_RULES,
  PROJECT_ID,
  SECTION_ID,
  TITLE,
  actionPayloads,
  buildActionPlan,
  canonicalJson,
  checkLifecycleRecords,
  checkMutationBoundary,
  diffSnapshots,
  extractInvocationArguments,
  hashTree,
  isContained,
  logicalUriPath,
  normalizedRelative,
  parseJsonLines,
  readPlanningRecords,
  sha256,
  snapshotProject,
  walkFiles
};
