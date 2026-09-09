#!/usr/bin/env node

'use strict';

// Recompute the routing-matrix seals against a given envelope commit.
// Usage: node scripts/reseal-evaluation.js [<commit>]   (default HEAD)
// Rewrites evaluation/v1/routing/manifest.json, the baseline canonical source
// pair, and the runner test pins, then loads the suite once so a bad seal fails
// here instead of in the test run. See docs/BUILD_AND_RELEASE.md.
const fs = require('fs'), cp = require('child_process'), crypto = require('crypto'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const commit = cp.execFileSync('git', ['-C', ROOT, 'rev-parse', process.argv[2] || 'HEAD']).toString().trim();
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const manifestPath = path.join(ROOT, 'evaluation/v1/routing/manifest.json');
let text = fs.readFileSync(manifestPath, 'utf8');
const m = JSON.parse(text);
text = text.replace(`"wtfp_commit": "${m.wtfp_commit}"`, `"wtfp_commit": "${commit}"`);
let clioSource = null;
for (const e of m.generated_envelopes) {
  const bytes = cp.execFileSync('git', ['-C', ROOT, 'show', `${commit}:${e.path}`], { maxBuffer: 64 * 1024 * 1024 });
  const inv = JSON.parse(bytes.toString('utf8'));
  const block = new RegExp(`("target": "${e.target}",\\n\\s+"path": "${e.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}",\\n\\s+"manifest_sha256": ")[a-f0-9]{64}(",\\n\\s+"source_sha256": ")[a-f0-9]{64}(")`);
  if (!block.test(text)) throw new Error(`manifest block not found for ${e.target}`);
  text = text.replace(block, `$1${sha256(bytes)}$2${inv.sourceHash}$3`);
  if (e.target === 'clio') clioSource = inv.sourceHash;
}
fs.writeFileSync(manifestPath, text);
const baselinePath = path.join(ROOT, 'evaluation/v1/baselines/hpc-checkpointing.json');
let b = fs.readFileSync(baselinePath, 'utf8');
b = b.replace(/("canonical_source_commit": ")[a-f0-9]{40}(")/, `$1${commit}$2`).replace(/("canonical_source_sha256": ")[a-f0-9]{64}(")/, `$1${clioSource}$2`);
fs.writeFileSync(baselinePath, b);
const runner = require(path.join(ROOT, 'evaluation/tools/run-routing-matrix.js'));
const suite = runner.loadSuite();
const identity = suite.repository;
const out = {
  commit,
  suite_manifest_sha256: suite.manifest_sha256,
  clio_manifest_sha256: suite.envelopes['clio-terra-primary'].manifest_sha256,
  clio_source_sha256: suite.envelopes['clio-terra-primary'].source_sha256,
  canonical_commit: identity.canonical_source.canonical_commit,
  canonical_source_sha256: identity.canonical_source.sha256,
  generated_inventories: identity.canonical_source.generated_inventories,
  authenticated_generated_entries: identity.canonical_source.authenticated_generated_entries
};
console.log(JSON.stringify(out, null, 2));
// Patch the runner test pins.
const testPath = path.join(ROOT, 'test/evaluation-routing-runner.test.js');
let t = fs.readFileSync(testPath, 'utf8');
const rep = (re, val) => { if (!re.test(t)) throw new Error(`pin not found: ${re}`); t = t.replace(re, val); };
rep(/(assert\.strictEqual\(suite\.manifest_sha256, ')[a-f0-9]{64}(')/, `$1${out.suite_manifest_sha256}$2`);
rep(/(suite\.envelopes\['clio-terra-primary'\]\.manifest_sha256,\n\s+')[a-f0-9]{64}(')/, `$1${out.clio_manifest_sha256}$2`);
rep(/(suite\.envelopes\['clio-terra-primary'\]\.source_sha256,\n\s+')[a-f0-9]{64}(')/, `$1${out.clio_source_sha256}$2`);
rep(/(canonical_source\.canonical_commit,\n\s+')[a-f0-9]{40}(')/, `$1${out.canonical_commit}$2`);
rep(/(canonical_source\.sha256,\n\s+')[a-f0-9]{64}(')/, `$1${out.canonical_source_sha256}$2`);
rep(/(canonical_source\.authenticated_generated_entries, )\d+(\))/, `$1${out.authenticated_generated_entries}$2`);
fs.writeFileSync(testPath, t);
console.log('pins patched');
