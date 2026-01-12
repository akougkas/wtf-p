const fs = require('fs');
const { execSync } = require('child_process');
const { getClaudeDir, detectInstallation, getPathLabel } = require('../lib/utils');

async function showStatus(options, pkg) {
  const { out, explicitConfigDir, hasQuiet } = options;
  const c = out.colors;

  if (!hasQuiet) {
    // Note: banner should be handled by the main entry point or passed in
  }

  const locations = [];

  // Check global
  const globalDir = getClaudeDir(explicitConfigDir, true);
  const globalDetection = detectInstallation(globalDir);
  locations.push({
    label: 'Global',
    path: globalDir,
    pathLabel: getPathLabel(globalDir, true),
    ...globalDetection
  });

  // Check local if different
  const localDir = getClaudeDir(null, false);
  if (localDir !== globalDir) {
    const localDetection = detectInstallation(localDir);
    locations.push({
      label: 'Local',
      path: localDir,
      pathLabel: getPathLabel(localDir, false),
      ...localDetection
    });
  }

  out.log(`  ${c.yellow('WTF-P Installation Status')}\n`);

  for (const loc of locations) {
    const installed = loc.hasCommands || loc.hasWorkflows || loc.hasSkills;

    out.log(`  ${c.cyan(loc.label)} ${c.dim(`(${loc.pathLabel})`)}`);

    if (!installed) {
      out.log(`    ${c.dim('Not installed')}\n`);
      continue;
    }

    // Version
    if (loc.version) {
      const versionLabel = loc.version === 'legacy' ? 'legacy (pre-0.2.0)' : loc.version;
      out.log(`    Version: ${c.green(versionLabel)}`);
    }

    // Components
    const components = [];
    if (loc.hasCommands) components.push(`commands (${loc.commandFiles.length} files)`);
    if (loc.hasWorkflows) components.push(`workflows (${loc.workflowFiles.length} files)`);
    if (loc.hasSkills) components.push(`skills (${loc.skillFiles.length} files)`);
    out.log(`    Installed: ${components.join(', ')}`);

    // Warnings
    if (loc.partial) {
      out.log(`    ${c.yellow('⚠ Partial installation detected')}`);
    }
    if (loc.corrupt) {
      out.log(`    ${c.red('⚠ Corrupt version file')}`);
    }

    out.log('');
  }

  // Check for updates
  try {
    const latest = execSync('npm view wtf-p version 2>/dev/null', { encoding: 'utf8' }).trim();
    if (latest && latest !== pkg.version) {
      out.log(`  ${c.yellow('Update available:')} ${pkg.version} → ${c.green(latest)}`);
      out.log(`  Run: ${c.cyan('npx wtf-p update --global')}\n`);
    }
  } catch {
    // Ignore
  }
}

module.exports = showStatus;
