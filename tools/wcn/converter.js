/**
 * WCN Converter Wrapper
 *
 * Uses the robust WCNCompiler library to convert Markdown to WCN.
 */

const fs = require('fs');
const { compile } = require('../../bin/lib/wcn-compiler');

function processFile(inputPath, outputPath) {
  const markdown = fs.readFileSync(inputPath, 'utf-8');
  
  const result = compile(markdown);
  const stats = {
    originalLength: markdown.length,
    compressedLength: result.length,
    reduction: ((1 - result.length / markdown.length) * 100).toFixed(1)
  };

  if (outputPath) {
    fs.writeFileSync(outputPath, result);
  }

  return { result, stats };
}

module.exports = { processFile };

// CLI usage if run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node converter.js input.md [output.wcn.md]');
    process.exit(1);
  }
  
  const { result, stats } = processFile(args[0], args[1]);
  console.log(`Original: ${stats.originalLength}, Compressed: ${stats.compressedLength} (${stats.reduction}%)`);
}