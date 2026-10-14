'use strict';

// Loads a pre-registered comparative study and enforces what its schema
// cannot: a study freezes only with every owner decision made, each hypothesis
// names a primary outcome, ablations vary the treatment, and every condition
// runs on a campaign that exists. A frozen study changes only by a new version.

const fs = require('fs');
const path = require('path');

const { SchemaRegistry, validateInstance } = require('./json-schema');

const ROOT = path.resolve(__dirname, '../..');
const STUDY_SCHEMA = path.join(ROOT, 'evaluation/v2/schemas/study.schema.json');
const CAMPAIGNS = path.join(ROOT, 'evaluation/v2/campaigns');
const OWNER_FIELDS = [
  ['tasks.count', study => study.tasks.count],
  ['execution.models', study => study.execution.models],
  ['execution.repetitions', study => study.execution.repetitions],
  ['execution.budget_per_run_usd', study => study.execution.budget_per_run_usd],
  ['assessment.assessors', study => study.assessment.assessors],
  ['analysis.thresholds', study => study.analysis.thresholds]
];

function loadStudy(file) {
  const study = JSON.parse(fs.readFileSync(file, 'utf8'));
  const registry = new SchemaRegistry([STUDY_SCHEMA]);
  const errors = validateInstance(study, registry.get(STUDY_SCHEMA), STUDY_SCHEMA, registry);
  if (errors.length > 0) throw new Error(`${path.relative(ROOT, file)} is not a valid study: ${errors[0]}`);
  const outcomes = new Map(study.outcomes.map(outcome => [outcome.id, outcome]));
  for (const hypothesis of study.hypotheses) {
    const outcome = outcomes.get(hypothesis.primary_outcome);
    if (!outcome || outcome.tier !== 'primary') throw new Error(`${hypothesis.id} must test a declared primary outcome`);
  }
  const conditions = new Map(study.conditions.map(condition => [condition.id, condition]));
  if (!study.conditions.some(condition => condition.role === 'treatment')) throw new Error('a study needs a treatment condition');
  if (!study.conditions.some(condition => condition.role === 'baseline' && condition.wtfp === 'none')) {
    throw new Error('a study needs a baseline without WTF-P on the same host');
  }
  for (const ablation of study.ablations) {
    if (conditions.get(ablation.of)?.role !== 'treatment') throw new Error(`ablation ${ablation.id} must vary a treatment condition`);
  }
  const campaigns = new Set(fs.readdirSync(CAMPAIGNS).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5)));
  for (const condition of study.conditions) {
    if (!campaigns.has(condition.host)) throw new Error(`condition ${condition.id} runs on unknown campaign ${condition.host}`);
  }
  const pending = [
    ...study.decisions.filter(decision => decision.status === 'pending').map(decision => decision.field),
    ...OWNER_FIELDS.filter(([, value]) => value(study) === 'pending').map(([field]) => field)
  ];
  if (study.status !== 'draft' && pending.length > 0) {
    throw new Error(`${study.id} cannot be ${study.status} while decisions are pending: ${[...new Set(pending)].join(', ')}`);
  }
  const undeclared = OWNER_FIELDS.filter(([field, value]) => value(study) === 'pending' && !study.decisions.some(decision => decision.field === field));
  if (undeclared.length > 0) throw new Error(`${study.id} leaves ${undeclared.map(([field]) => field).join(', ')} pending without naming its owner`);
  return { study, pending: [...new Set(pending)] };
}

module.exports = { loadStudy };
