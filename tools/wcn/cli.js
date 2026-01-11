#!/usr/bin/env node

/**
 * WCN CLI - Workflow Compression Notation converter
 *
 * Usage:
 *   node cli.js <input.md> [output.wcn.md]
 *   node cli.js --dir <directory>
 *   node cli.js --stats <file.md>
 */

const fs = require('fs');
const path = require('path');
const { convert, processFile } = require('./converter');

const args = process.argv.slice(2);

function printUsage() {
  console.log(`
WCN - Workflow Compression Notation
====================================

Usage:
  wcn <input.md> [output.wcn.md]    Convert single file
  wcn --dir <directory>             Convert all .md files in directory
  wcn --stats <file.md>             Show compression stats only
  wcn --compare <file.md>           Side-by-side comparison
  wcn --help                        Show this help

Examples:
  wcn workflow.md                   → workflow.wcn.md
  wcn workflow.md compressed.md     → compressed.md
  wcn --dir ./workflows             → Convert all in directory
  wcn --stats execute-section.md    → Show potential savings
`);
}

function printStats(stats, inputPath) {
  const name = path.basename(inputPath);
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  WCN Compression Report: ${name.padEnd(35)} ║
╠══════════════════════════════════════════════════════════════╣
║  Original:     ${String(stats.originalLength).padStart(8)} chars                          ║
║  Compressed:   ${String(stats.compressedLength).padStart(8)} chars                          ║
║  Reduction:    ${String(stats.reduction + '%').padStart(8)}                                ║
╠══════════════════════════════════════════════════════════════╣
║  Steps compressed:    ${String(stats.stepsCompressed).padStart(4)}                              ║
║  Mode tables:         ${String(stats.modesCompressed).padStart(4)}                              ║
║  Route blocks:        ${String(stats.routesCompressed).padStart(4)}                              ║
║  Rule blocks:         ${String(stats.rulesCompressed).padStart(4)}                              ║
║  Fluff removed:       ${String(stats.fluffRemoved).padStart(4)} chars                          ║
╚══════════════════════════════════════════════════════════════╝
`);
}

function convertFile(inputPath, outputPath) {
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  const output = outputPath || inputPath.replace(/\.md$/, '.wcn.md');
  const { result, stats } = processFile(inputPath, output);

  printStats(stats, inputPath);
  console.log(`✓ Saved to: ${output}\n`);
}

function convertDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.error(`Error: Directory not found: ${dirPath}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.md') && !f.endsWith('.wcn.md'));

  console.log(`\nConverting ${files.length} files in ${dirPath}...\n`);

  let totalOriginal = 0;
  let totalCompressed = 0;

  files.forEach(file => {
    const inputPath = path.join(dirPath, file);
    const outputPath = inputPath.replace(/\.md$/, '.wcn.md');

    try {
      const { stats } = processFile(inputPath, outputPath);
      totalOriginal += stats.originalLength;
      totalCompressed += stats.compressedLength;
      console.log(`  ✓ ${file} → ${stats.reduction}% reduction`);
    } catch (err) {
      console.log(`  ✗ ${file} → Error: ${err.message}`);
    }
  });

  const totalReduction = ((1 - totalCompressed / totalOriginal) * 100).toFixed(1);
  console.log(`\n════════════════════════════════════════`);
  console.log(`Total: ${totalOriginal} → ${totalCompressed} chars (${totalReduction}% reduction)`);
  console.log(`════════════════════════════════════════\n`);
}

function showStats(inputPath) {
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(inputPath, 'utf-8');
  const { stats } = convert(markdown);
  printStats(stats, inputPath);
}

function compareFile(inputPath) {
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(inputPath, 'utf-8');
  const { result, stats } = convert(markdown);

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`ORIGINAL (first 50 lines)`);
  console.log(`${'═'.repeat(70)}`);
  console.log(markdown.split('\n').slice(0, 50).join('\n'));

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`COMPRESSED (first 50 lines)`);
  console.log(`${'═'.repeat(70)}`);
  console.log(result.split('\n').slice(0, 50).join('\n'));

  printStats(stats, inputPath);
}

// Main execution
if (args.length === 0 || args[0] === '--help') {
  printUsage();
  process.exit(0);
}

if (args[0] === '--dir') {
  convertDirectory(args[1] || '.');
} else if (args[0] === '--stats') {
  showStats(args[1]);
} else if (args[0] === '--compare') {
  compareFile(args[1]);
} else {
  convertFile(args[0], args[1]);
}
