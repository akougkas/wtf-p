const { getClaudeDir, detectInstallation, getPathLabel } = require('../lib/utils');

async function runUpdate(options, pkg, installFunc) {
  const { out, explicitConfigDir, hasGlobal, hasLocal } = options;
  const c = out.colors;

  out.log(`  ${c.yellow('Checking for updates...')}\n`);

  // Find installed location
  const globalDir = getClaudeDir(explicitConfigDir, true);
  const localDir = getClaudeDir(null, false);

  let targetDir = null;
  let isGlobal = true;

  const globalDetection = detectInstallation(globalDir);
  const localDetection = detectInstallation(localDir);

  if (hasGlobal || (!hasLocal && (globalDetection.hasCommands || globalDetection.hasWorkflows || globalDetection.hasSkills))) {
    targetDir = globalDir;
    isGlobal = true;
  } else if (hasLocal || (localDetection.hasCommands || localDetection.hasWorkflows || localDetection.hasSkills)) {
    targetDir = localDir;
    isGlobal = false;
  }

  if (!targetDir) {
    out.log(`  ${c.yellow('No existing installation found.')}`);
    out.log(`  Run ${c.cyan('npx wtf-p --global')} to install.\n`);
    return;
  }

  const detection = isGlobal ? globalDetection : localDetection;
  const currentVersion = detection.version === 'legacy' ? '0.0.0' : detection.version;

  out.log(`  Current: ${c.dim(`v${currentVersion}`)} in ${c.dim(getPathLabel(targetDir, isGlobal))}`);
  out.log(`  Package: ${c.dim(`v${pkg.version}`)}`);

  if (pkg.version === currentVersion) {
    out.log(`\n  ${c.green('Already up to date!')}\n`);
    return;
  }

  out.log(`\n  ${c.cyan('Updating...')}\n`);

  // Run install with backup
  await installFunc(isGlobal, true);
}

module.exports = runUpdate;
