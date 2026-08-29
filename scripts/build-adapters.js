#!/usr/bin/env node

'use strict';

const { compileAdapters } = require('../bin/lib/adapter-compiler');

function main() {
  const known = new Set(['--check']);
  const unknown = process.argv.slice(2).filter((argument) => !known.has(argument));
  if (unknown.length > 0) throw new Error(`unknown adapter compiler argument: ${unknown.join(', ')}`);
  const check = process.argv.includes('--check');
  const result = compileAdapters({ check });
  if (check) {
    process.stdout.write(`Generated adapters are current (${result.targets.length} envelopes).\n`);
    return;
  }
  const changedFiles = result.changed.reduce((total, entry) => total + entry.files.length, 0);
  process.stdout.write(`Generated ${result.targets.length} adapter envelopes; updated ${changedFiles} files.\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { main };
