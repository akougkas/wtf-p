const fs = require('fs');
const path = require('path');
const MANIFEST = require('../lib/manifest');
const { collectComponentFiles } = require('./install-logic'); // Need to export this or copy logic

// Re-implementing logic here to avoid circular dep if install-logic is messy
// But better to export valid logic.

/**
 * Collect files from a manifest component
 */
function collectComponentFilesLocal(component, files = []) {
  if (!fs.existsSync(component.src)) return files;

  function recurse(currentSrc, currentRel) {
    const entries = fs.readdirSync(currentSrc, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(currentSrc, entry.name);
      const relPath = path.join(currentRel, entry.name);
      // For listing, we just want the relative destination path
      const destPath = path.join(component.dest, relPath);

      if (entry.isDirectory()) {
        recurse(srcPath, relPath);
      } else {
        files.push({ 
          src: srcPath, 
          path: destPath, // display path
          type: component.id
        });
      }
    }
  }

  recurse(component.src, '.');
  return files;
}

function showList(options) {
  const { out, hasQuiet, onlyInstall } = options;
  const c = out.colors;
  
  // Use Claude by default
  const vendorConfig = MANIFEST.claude;

  const files = [];

  vendorConfig.components.forEach(component => {
    if (onlyInstall !== 'all') {
      if (onlyInstall !== component.id) {
         if (onlyInstall === 'commands' && component.id === 'skills') {
           // Allow
         } else {
           return;
         }
      }
    }
    collectComponentFilesLocal(component, files);
  });

  if (!hasQuiet) {
    out.log(`  ${c.yellow('Files to install:')}\n`);
  }

  // Group by component
  const groups = {};
  files.forEach(f => {
    if (!groups[f.type]) groups[f.type] = [];
    groups[f.type].push(f);
  });

  Object.keys(groups).forEach(type => {
    const groupFiles = groups[type];
    out.log(`  ${c.cyan(type.charAt(0).toUpperCase() + type.slice(1))} (${groupFiles.length} files):`);
    for (const f of groupFiles.slice(0, 10)) {
      out.log(`    ${c.dim(f.path)}`);
    }
    if (groupFiles.length > 10) {
      out.log(`    ${c.dim(`... and ${groupFiles.length - 10} more`)}`);
    }
    out.log('');
  });

  out.log(`  Total: ${files.length} files\n`);
}

module.exports = showList;
