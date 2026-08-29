#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..');
const fixtureRoot = path.join(
  repositoryRoot,
  'evaluation',
  'v1',
  'fixtures',
  'nsf25-531-proposal-uat'
);

const SOLICITATION_URL = 'https://www.nsf.gov/funding/opportunities/cici-cybersecurity-innovation-cyberinfrastructure/nsf25-531/solicitation';
const PROGRAM_URL = 'https://www.nsf.gov/funding/opportunities/cici-cybersecurity-innovation-cyberinfrastructure';
const PAPPG_URL = 'https://www.nsf.gov/policies/pappg';
const ACTIONS = [
  'new-paper',
  'map-project',
  'create-outline',
  'plan-section',
  'write-section',
  'review-section',
  'pause-writing',
  'resume-writing',
  'progress'
];

function read(name) {
  return fs.readFileSync(path.join(fixtureRoot, name), 'utf8');
}

function json(name) {
  return JSON.parse(read(name));
}

test('NSF fixture is a separate grant-proposal UAT with complete file inventory', () => {
  const fixture = json('fixture.json');
  assert.strictEqual(fixture.schema, 'wtfp.evaluation.user-acceptance-fixture/v1');
  assert.strictEqual(fixture.id, 'nsf25-531-proposal-uat');
  assert.strictEqual(fixture.version, 2);
  assert.strictEqual(fixture.document_type, 'grant-proposal');
  assert.strictEqual(fixture.suite_class, 'hands-on-user-acceptance');
  assert.strictEqual(fixture.academic_baseline, false);
  assert.strictEqual(fixture.submission_readiness, false);
  assert.strictEqual(fixture.separate_from_fixture, 'hpc-checkpointing-paper');
  assert.strictEqual(fixture.permissions.model_run_network, false);
  assert.strictEqual(fixture.permissions.vcs, false);
  assert.strictEqual(fixture.permissions.publish, false);

  const declaredFiles = [
    ...fixture.model_visible_templates.map(item => item.path),
    ...fixture.operator_resources,
    ...fixture.evaluator_only_oracles
  ];
  assert.deepStrictEqual(new Set(declaredFiles).size, declaredFiles.length);
  for (const relative of declaredFiles) {
    const resolved = path.resolve(fixtureRoot, relative);
    assert(resolved.startsWith(`${fixtureRoot}${path.sep}`));
    assert(fs.statSync(resolved).isFile(), `missing declared fixture file: ${relative}`);
  }
  assert.deepStrictEqual(
    fixture.required_user_downloads.map(item => item.url),
    [SOLICITATION_URL, PROGRAM_URL, PAPPG_URL]
  );
});

test('authoritative facts preserve official identity, deadline, tracks, and authority classes', () => {
  const facts = json('authoritative-facts.json');
  assert.strictEqual(facts.document_type, 'grant-proposal');
  assert.strictEqual(facts.accessed_on, '2026-08-29');
  assert.strictEqual(facts.identity.solicitation_number, 'NSF 25-531');
  assert.strictEqual(facts.identity.program_acronym, 'CICI');
  assert.deepStrictEqual(facts.official_urls, {
    solicitation: SOLICITATION_URL,
    program_page: PROGRAM_URL,
    pappg_landing: PAPPG_URL
  });
  assert.strictEqual(facts.status_evidence.next_deadline.date, '2027-01-20');
  assert.strictEqual(facts.status_evidence.next_deadline.time, '17:00');
  assert.strictEqual(facts.status_evidence.next_deadline.timezone_rule, 'submitting-organization-local-time');
  assert.strictEqual(facts.status_evidence.not_a_submission_guarantee, true);
  assert.strictEqual(facts.source_anchors.program_description, `${SOLICITATION_URL}#pgm_desc_txt`);

  assert.deepStrictEqual(
    facts.tracks.map(track => [track.id, track.maximum_total_award_usd, track.maximum_duration_years]),
    [
      ['UCSS', 600000, 3],
      ['RSSD', 600000, 3],
      ['TCR', 1200000, 3],
      ['IPAAI', 900000, 3]
    ]
  );
  assert.strictEqual(facts.review_dimensions.length, 7);
  assert.deepStrictEqual(
    Object.keys(facts.information_classes).sort(),
    ['author_decisions', 'author_evidence', 'call_evidence']
  );
  assert(facts.proposal_constraints.some(item => item.id === 'effective-pappg'));
  assert(facts.proposal_constraints.some(item => item.id === 'single-lead-proposal'));
  assert(facts.proposal_constraints.some(item => item.id === 'curated-data-sharing'));
  assert.deepStrictEqual(facts.track_specific_requirements.UCSS, [
    'Address security and usability for scientific collaboration and workflows'
  ]);
  assert.deepStrictEqual(facts.track_specific_encouraged_elements.UCSS, [
    'Identify collaborations, existing cyberinfrastructure linkages, and newly enabled functionality where applicable'
  ]);
});

test('machine-readable invariants bind the exact lifecycle and fresh-process boundary', () => {
  const expected = json('expected-invariants.json');
  assert.strictEqual(expected.document_type, 'grant-proposal');
  assert.deepStrictEqual(expected.action_sequence, ACTIONS);
  assert.deepStrictEqual(expected.required_process_boundaries, [{
    after_action: 'pause-writing',
    fresh_process: true
  }]);
  assert.deepStrictEqual(
    expected.new_paper_records,
    ['manifest', 'config', 'state', 'decisions', 'outline']
  );
  const ids = expected.invariants.map(invariant => invariant.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const required of [
    'fixture-separation',
    'document-type',
    'source-provenance',
    'evidence-class-fidelity',
    'requirements-coverage',
    'plan-checker-boundary',
    'reviewer-boundary',
    'resumption-fidelity',
    'no-incidental-vcs',
    'truthful-completion'
  ]) assert(ids.includes(required), `missing invariant ${required}`);
});

test('source receipt demands real user hashes and contains no fabricated digest', () => {
  const receipt = read('source-receipt.md');
  for (const url of [SOLICITATION_URL, PROGRAM_URL, PAPPG_URL]) assert(receipt.includes(url));
  assert(receipt.includes('REQUIRED: user-computed 64-character lowercase hex'));
  assert(receipt.includes('sha256sum materials/nsf25-531-solicitation.html'));
  assert(!/[a-f0-9]{64}/.test(receipt), 'receipt template must not contain a digest that could be mistaken for observed evidence');
});

test('author brief makes project facts and choices explicitly unknown', () => {
  const brief = read('author-brief.md');
  assert(brief.includes('document_type: grant-proposal'));
  assert(brief.includes('UNKNOWN — author must choose UCSS, RSSD, TCR, or IPAAI'));
  assert(brief.includes('do not infer commitments'));
  assert(brief.includes('All unresolved fields above remain deferred by default'));
  assert((brief.match(/UNKNOWN/g) || []).length >= 25);
});

test('operator guide contains the exact ordered namespaced invocation sequence', () => {
  const invocations = read('invocations.md');
  const observed = [...invocations.matchAll(/^\/wtfp:([a-z][a-z-]*)/gm)].map(match => match[1]);
  assert.deepStrictEqual(observed, ACTIONS);
  assert(invocations.includes('Canonical document_type: grant-proposal.'));
  assert(invocations.includes('Working title: "CICI:<AUTHOR-SELECTED-TRACK>:<AUTHOR-WORKING-TITLE>".'));
  assert(invocations.includes('Quit Clio completely and start a fresh Clio process'));
  assert(invocations.includes('Do not browse, use network tools'));
  assert(invocations.includes('do not claim submission readiness'));
});

test('user test documents isolated discovery, gates, and canonical initial artifacts', () => {
  const guide = read('USER-TEST.md');
  for (const variable of [
    'HOME',
    'XDG_CONFIG_HOME',
    'XDG_DATA_HOME',
    'XDG_STATE_HOME',
    'XDG_CACHE_HOME',
    'TMPDIR',
    'CLIO_CODER_HOME',
    'CLIO_CODER_CONFIG_DIR',
    'CLIO_CODER_DATA_DIR',
    'CLIO_CODER_STATE_DIR',
    'CLIO_CODER_CACHE_DIR',
    'CLIO_CODER_BIN_DIR',
    'CLIO_CODER_REQUIRE_HOME_PREFIX',
    'CLIO_CODER_NO_NETWORK_TOOLS'
  ]) assert(guide.includes(variable), `isolated guide omits ${variable}`);
  for (const artifact of [
    '.planning/project.json',
    '.planning/config.json',
    '.planning/state.json',
    '.planning/decisions.json',
    '.planning/structure/outline.json'
  ]) assert(guide.includes(artifact), `guide omits initial artifact ${artifact}`);
  assert(guide.includes('/wtfp:new-paper'));
  assert(guide.includes('/thinking off'));
  assert(guide.includes('autonomy to `suggest`'));
  assert(guide.includes('Deny and stop the turn if the model requests `bash`'));
  assert(guide.includes('`clio-coder fleet run <name> --var section=<id>`'));
  assert(guide.includes('validate-planning.js'));
  assert(guide.includes('Approval responses are'));
  assert(guide.includes('confirm_outline'));
  assert(guide.includes('confirm_plan'));
  assert(guide.includes('fresh process'));
  assert(guide.includes('does not certify eligibility'));
});
