/**
 * Checkpoint - Save and restore paper state bundles
 *
 * Captures complete .planning/ state as a git-tagged checkpoint
 * that can be restored in a new session for full context recovery.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Create a checkpoint of current paper state
 * @param {Object} options
 * @param {string} options.planningDir - Path to .planning/
 * @param {string} options.label - Checkpoint label (e.g., "pre-discussion", "draft-1")
 * @param {string} [options.note] - Optional note about checkpoint context
 * @returns {Object} - { tag, files, timestamp }
 */
function createCheckpoint({ planningDir, label, note }) {
  if (!fs.existsSync(planningDir)) {
    throw new Error('.planning/ directory not found');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const tag = `wtfp-checkpoint/${label}-${timestamp}`;

  // Collect all state files
  const files = collectFiles(planningDir);

  // Stage all planning files
  try {
    execSync(`git add ${planningDir}`, { stdio: 'pipe' });
  } catch (e) {
    // May fail if no changes — that's OK
  }

  // Check if there are staged changes
  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  const hasChanges = status.trim().length > 0;

  if (hasChanges) {
    const commitMsg = `checkpoint: ${label}${note ? `\n\n${note}` : ''}`;
    execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
  }

  // Create annotated tag
  const tagMsg = [
    `WTF-P Checkpoint: ${label}`,
    `Timestamp: ${timestamp}`,
    `Files: ${files.length}`,
    note ? `Note: ${note}` : '',
  ].filter(Boolean).join('\n');

  execSync(`git tag -a "${tag}" -m "${tagMsg.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });

  return { tag, files: files.length, timestamp };
}

/**
 * Restore a checkpoint by tag name
 * @param {string} tag - Git tag to restore from
 * @returns {Object} - { restored, files }
 */
function restoreCheckpoint(tag) {
  // Verify tag exists
  try {
    execSync(`git tag -l "${tag}"`, { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    throw new Error(`Checkpoint tag not found: ${tag}`);
  }

  // Restore .planning/ from the tagged commit
  try {
    execSync(`git checkout "${tag}" -- .planning/`, { stdio: 'pipe' });
    return { restored: true, tag };
  } catch (e) {
    throw new Error(`Failed to restore checkpoint: ${e.message}`);
  }
}

/**
 * List available checkpoints
 * @returns {Array} - List of { tag, date, label, message }
 */
function listCheckpoints() {
  try {
    const tags = execSync('git tag -l "wtfp-checkpoint/*" --sort=-creatordate', {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();

    if (!tags) return [];

    return tags.split('\n').map(tag => {
      let message = '';
      try {
        message = execSync(`git tag -l "${tag}" -n1`, {
          encoding: 'utf8',
          stdio: 'pipe',
        }).trim();
      } catch (e) { /* ignore */ }

      const parts = tag.replace('wtfp-checkpoint/', '').split('-');
      const label = parts.slice(0, -6).join('-'); // Remove timestamp portion

      return { tag, label, message };
    });
  } catch (e) {
    return [];
  }
}

/**
 * Generate a handoff document for session continuity
 * @param {string} planningDir - Path to .planning/
 * @returns {string} - Markdown content for HANDOFF.md
 */
function generateHandoff(planningDir) {
  const statePath = path.join(planningDir, 'STATE.md');
  const configPath = path.join(planningDir, 'config.json');

  const state = fs.existsSync(statePath) ? fs.readFileSync(statePath, 'utf8') : '';
  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) { /* ignore */ }

  // Extract position from STATE.md
  const positionMatch = state.match(/Section:\s*(\d+)\s*of\s*(\d+)/i);
  const wordsMatch = state.match(/Words?:\s*(\d+)\s*\/\s*(\d+)/i);

  const sections = [];
  sections.push('# Session Handoff');
  sections.push(`\nGenerated: ${new Date().toISOString()}`);
  sections.push(`\n## Position`);

  if (positionMatch) {
    sections.push(`- Section: ${positionMatch[1]} of ${positionMatch[2]}`);
  }
  if (wordsMatch) {
    sections.push(`- Words: ${wordsMatch[1]} / ${wordsMatch[2]}`);
  }
  if (config.model_profile) {
    sections.push(`- Profile: ${config.model_profile}`);
  }

  sections.push(`\n## Resume With`);
  sections.push('```');
  sections.push('/wtfp:resume-writing');
  sections.push('```');

  return sections.join('\n');
}

// --- Helpers ---

function collectFiles(dir) {
  const files = [];

  function walk(d) {
    if (!fs.existsSync(d)) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        files.push(full);
      }
    }
  }

  walk(dir);
  return files;
}

module.exports = {
  createCheckpoint,
  restoreCheckpoint,
  listCheckpoints,
  generateHandoff,
};
