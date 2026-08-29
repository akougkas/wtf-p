const { execFileSync } = require('child_process');
const { getClaudeDir, detectInstallation, getPathLabel } = require('../lib/utils');
const { assertSafeTarget } = require('../lib/ownership');

async function showStatus(options, pkg) {
  const { out, explicitConfigDir, hasQuiet } = options;
  const c = out.colors;

  if (!hasQuiet) {
    // Note: banner should be handled by the main entry point or passed in
  }

  const locations = [];

  // Check global
  const globalDir = assertSafeTarget(getClaudeDir(explicitConfigDir, true)).path;
  const globalDetection = detectInstallation(globalDir);
  locations.push({
    label: 'Global',
    path: globalDir,
    pathLabel: getPathLabel(globalDir, true),
    ...globalDetection
  });

  // Check local if different
  const localDir = assertSafeTarget(getClaudeDir(null, false)).path;
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
    out.log(`  ${c.cyan(loc.label)} ${c.dim(`(${loc.pathLabel})`)}`);

    if (!loc.hasAny) {
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
    if (loc.hasAgents) components.push(`agents (${loc.agentFiles.length} files)`);
    if (loc.hasMcp) components.push(`MCP (${loc.mcpFiles.length} files)`);
    if (loc.hasBin) components.push(`bin (${loc.binFiles.length} files)`);
    if (components.length === 0 && loc.hasReceipt) components.push('receipt only');
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

  // Check for dual-install conflict (global + local both present)
  const bothInstalled = locations.filter(location => location.hasAny);
  if (bothInstalled.length > 1) {
    out.log(`  ${c.red('⚠ Duplicate installation detected!')}`);
    out.log(`    WTF-P is installed in both locations. Resources may appear more than once.`);
    out.log(`    Remove one to fix:`);
    out.log(`      ${c.cyan('npx wtf-p uninstall --local')}   Remove local copy`);
    out.log(`      ${c.cyan('npx wtf-p uninstall --global')}  Remove global copy\n`);
  }

  // Check for updates (only suggest if registry version is actually newer)
  try {
    const latest = execFileSync('npm', ['view', 'wtf-p', 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000
    }).trim();
    const isNewer = (a, b) => {
      const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
      return false;
    };
    if (latest && isNewer(latest, pkg.version)) {
      out.log(`  ${c.yellow('Update available:')} ${pkg.version} -> ${c.green(latest)}`);
      out.log(`  Run: ${c.cyan('npx wtf-p update')}\n`);
    }
  } catch {
    // Ignore
  }
}

module.exports = showStatus;
