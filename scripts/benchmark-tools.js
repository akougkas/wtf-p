#!/usr/bin/env node

'use strict';

const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { performance } = require('perf_hooks');

const bibFormat = require('../bin/lib/bib-format');
const bibIndex = require('../bin/lib/bib-index');
const ranker = require('../bin/lib/citation-ranker');

const referenceDate = new Date('2026-01-15T12:00:00Z');
const bibliography = Array.from(
  { length: 1000 },
  (_, index) => `@article{k${index}, title={Paper ${index}}, year={${2000 + (index % 26)}}}`,
).join('\n');
const papers = Array.from({ length: 1000 }, (_, index) => ({
  id: index,
  citationCount: index * 3,
  year: 2000 + (index % 26),
  venue: index % 5 === 0 ? 'NeurIPS' : 'Unknown',
}));
const paper = {
  key: 'k',
  entryType: 'article',
  author: 'A. Author',
  title: 'T',
  booktitle: 'V',
  year: '2026',
  doi: '10.1/x',
  abstract: 'A',
};

let observedChecksum = 0;

function observe(value) {
  observedChecksum = (observedChecksum + Number(value)) % 2147483647;
}

function percentile(sorted, quantile) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))];
}

function measure(name, iterations, operation) {
  for (let iteration = 0; iteration < 20; iteration += 1) observe(operation());

  const samples = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const startedAt = performance.now();
    const value = operation();
    samples.push(performance.now() - startedAt);
    observe(value);
  }
  samples.sort((left, right) => left - right);

  return {
    name,
    unit: 'ms/call',
    iterations,
    median: Number(percentile(samples, 0.5).toFixed(4)),
    p95: Number(percentile(samples, 0.95).toFixed(4)),
  };
}

const results = [
  measure('bibliography.index (1000 entries)', 200, () => bibIndex.index(bibliography).length),
  measure('citation.rank (1000 papers, fixed clock)', 200, () => (
    ranker.rank(papers, 'balanced', referenceDate)[0].id
  )),
  measure('bibliography.format (one entry, explicit date)', 10000, () => (
    bibFormat.format(paper, { wtfp_fetched: '2026-01-15' }).length
  )),
];

const modulePath = path.resolve(__dirname, '..', 'bin', 'lib', 'bib-index.js');
const childSource = [
  "const fs = require('fs');",
  `const bibIndex = require(${JSON.stringify(modulePath)});`,
  "process.stdout.write(String(bibIndex.index(fs.readFileSync(0, 'utf8')).length));",
].join('');
const coldSamples = [];
for (let iteration = 0; iteration < 40; iteration += 1) {
  const startedAt = performance.now();
  const child = spawnSync(process.execPath, ['-e', childSource], {
    input: bibliography,
    encoding: 'utf8',
  });
  if (child.status !== 0) {
    throw new Error(`cold-process benchmark failed: ${child.stderr || `exit ${child.status}`}`);
  }
  coldSamples.push(performance.now() - startedAt);
  observe(child.stdout);
}
coldSamples.sort((left, right) => left - right);
results.push({
  name: 'fresh Node process + bibliography.index (1000 entries)',
  unit: 'ms/call',
  iterations: coldSamples.length,
  median: Number(percentile(coldSamples, 0.5).toFixed(4)),
  p95: Number(percentile(coldSamples, 0.95).toFixed(4)),
});

process.stdout.write(`${JSON.stringify({
  measuredAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  cpu: os.cpus()[0]?.model || 'unknown',
  method: 'warm 20 then per-call monotonic wall clock with observed-output checksum; cold process uses 40 spawnSync trials; synthetic fixed inputs',
  observedChecksum,
  results,
}, null, 2)}\n`);
