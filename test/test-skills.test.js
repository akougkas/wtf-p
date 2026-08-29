#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const skillsRoot = path.join(repositoryRoot, 'protocol', 'skills');
const actionsRoot = path.join(repositoryRoot, 'protocol', 'actions');

const expected = {
  'wtfp-start-project': ['new-paper', 'map-project', 'create-outline'],
  'wtfp-research-literature': ['research-gap', 'analyze-bib', 'check-refs'],
  'wtfp-plan-section': [
    'discuss-section',
    'list-assumptions',
    'plan-section',
    'plan-revision',
    'insert-section',
    'remove-section'
  ],
  'wtfp-write-section': ['write-section', 'execute-outline', 'quick'],
  'wtfp-review-manuscript': [
    'review-section',
    'verify-work',
    'polish-prose',
    'audit-milestone',
    'plan-milestone-gaps'
  ],
  'wtfp-manage-project': [
    'progress',
    'pause-writing',
    'resume-writing',
    'checkpoint',
    'settings',
    'add-todo',
    'check-todos'
  ],
  'wtfp-deliver-research': [
    'export-latex',
    'submit-milestone',
    'create-slides',
    'create-poster'
  ]
};

function parseFrontmatter(markdown, file) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  assert(match, `${file} must begin with YAML frontmatter`);

  const entries = match[1].split('\n').map(line => {
    const separator = line.indexOf(':');
    assert(separator > 0, `${file} has malformed frontmatter: ${line}`);
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  });

  return Object.fromEntries(entries);
}

function assertPortable(content, file) {
  const forbidden = [
    /\bClaude(?: Code)?\b/i,
    /\bCodex\b/i,
    /\bGemini\b/i,
    /\bOpenCode\b/i,
    /\bAntigravity\b/i,
    /\bClio(?: Coder)?\b/i,
    /AskUserQuestion/,
    /Task\s*\(/,
    /~\//,
    /\$HOME/,
    /\/home\//,
    /vendors\//,
    /\.claude\//
  ];

  for (const pattern of forbidden) {
    assert(!pattern.test(content), `${file} contains runtime-specific content matching ${pattern}`);
  }
}

const actualSkillDirectories = fs.readdirSync(skillsRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();

assert.deepStrictEqual(actualSkillDirectories, Object.keys(expected).sort(), 'canonical skill set changed');

const actionOwners = new Map();

for (const [skill, actions] of Object.entries(expected)) {
  const skillDirectory = path.join(skillsRoot, skill);
  const skillFile = path.join(skillDirectory, 'SKILL.md');
  const referenceFile = path.join(skillDirectory, 'references', 'actions.md');
  const interfaceFile = path.join(skillDirectory, 'agents', 'openai.yaml');

  assert(fs.existsSync(skillFile), `${skill} is missing SKILL.md`);
  assert(fs.existsSync(referenceFile), `${skill} is missing its action reference`);
  assert(fs.existsSync(interfaceFile), `${skill} is missing agents/openai.yaml`);

  const skillMarkdown = fs.readFileSync(skillFile, 'utf8');
  const actionReference = fs.readFileSync(referenceFile, 'utf8');
  const interfaceYaml = fs.readFileSync(interfaceFile, 'utf8');
  const frontmatter = parseFrontmatter(skillMarkdown, skillFile);

  assert.deepStrictEqual(Object.keys(frontmatter).sort(), ['description', 'name']);
  assert.strictEqual(frontmatter.name, skill, `${skill} frontmatter name must match its directory`);
  assert.match(frontmatter.description, /^This skill\b/, `${skill} description must use third-person trigger language`);
  assert.match(frontmatter.description, /activates when\b/i, `${skill} description must state activation contexts`);
  assert(skillMarkdown.split('\n').length < 500, `${skill}/SKILL.md exceeds 500 lines`);
  assert.match(skillMarkdown, /\[references\/actions\.md\]\(references\/actions\.md\)/);
  assert(!/\bTODO\b/.test(skillMarkdown + actionReference), `${skill} contains unfinished TODO text`);
  assert.match(interfaceYaml, new RegExp(`\\$${skill}\\b`), `${skill} default prompt must name the skill`);

  assertPortable(skillMarkdown, skillFile);
  assertPortable(actionReference, referenceFile);

  for (const action of actions) {
    assert(!actionOwners.has(action), `${action} is owned by more than one skill`);
    actionOwners.set(action, skill);

    const heading = new RegExp('^## `' + action + '`$', 'm');
    const contractLink = `../../../actions/${action}.json`;
    assert(heading.test(actionReference), `${skill} does not document ${action}`);
    assert(actionReference.includes(`](${contractLink})`), `${skill} does not link ${action}'s contract`);

    const contractFile = path.join(actionsRoot, `${action}.json`);
    assert(fs.existsSync(contractFile), `canonical action contract is missing: ${action}`);
    const contract = JSON.parse(fs.readFileSync(contractFile, 'utf8'));
    assert.strictEqual(contract.id, action, `${action} contract has the wrong id`);
    assert.strictEqual(contract.surface && contract.surface.kind, 'skill');
    assert.strictEqual(
      contract.surface && contract.surface.skill,
      skill,
      `${action} contract does not route to ${skill}`
    );
    assert.strictEqual(contract.workflow, `wtfp://workflows/${action}`);
  }
}

const expectedActions = Object.values(expected).flat().sort();
assert.deepStrictEqual([...actionOwners.keys()].sort(), expectedActions);
assert.strictEqual(expectedActions.length, 31, 'the seven skills must own all 31 academic actions');

console.log(`✓ validated ${Object.keys(expected).length} canonical skills`);
console.log(`✓ validated ${expectedActions.length} uniquely owned academic actions`);
console.log('✓ validated portable content, progressive disclosure, metadata, and canonical contract links');
