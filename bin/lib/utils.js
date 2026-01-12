/**
 * Shared utilities for WTF-P CLI
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Version tracking file name
const VERSION_FILE = '.wtfp-version';

// ============ Path Utilities ============

/**
 * Expand ~ to home directory
 */
function expandTilde(filePath) {
  if (filePath && filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Normalize path: expand tilde, resolve to absolute, resolve symlinks
 */
function normalizePath(inputPath) {
  if (!inputPath) return inputPath;

  // Expand tilde
  let normalized = expandTilde(inputPath);

  // Resolve to absolute path
  normalized = path.resolve(normalized);

  // Resolve symlinks if path exists
  if (fs.existsSync(normalized)) {
    try {
      normalized = fs.realpathSync(normalized);
    } catch {
      // Keep as-is if realpath fails (permissions, etc.)
    }
  }

  return normalized;
}

/**
 * Validate path for safety
 */
function isValidPath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') return false;

  // Check for null bytes (security issue)
  if (inputPath.includes('\0')) return false;

  // Check path length (Windows ~260, but we use 1024 for safety)
  if (inputPath.length > 1024) return false;

  return true;
}

/**
 * Get the configuration directory for a specific vendor
 */
function getVendorDir(vendor, explicitConfigDir, isGlobal = true) {
  if (!isGlobal) {
    return path.join(process.cwd(), `.${vendor}`);
  }

  const envVar = `${vendor.toUpperCase()}_CONFIG_DIR`;
  const configDir = normalizePath(explicitConfigDir) ||
                   normalizePath(process.env[envVar]);

  return configDir || path.join(os.homedir(), `.${vendor}`);
}

/**
 * Get the Claude config directory (respects CLAUDE_CONFIG_DIR env var)
 */
function getClaudeDir(explicitConfigDir, isGlobal = true) {
  return getVendorDir('claude', explicitConfigDir, isGlobal);
}

/**
 * Get human-readable label for a path (with ~ for homedir)
 */
function getPathLabel(fullPath, isGlobal = true) {
  if (isGlobal) {
    return fullPath.replace(os.homedir(), '~');
  }
  return fullPath.replace(process.cwd(), '.');
}

// ============ Version Tracking ============

/**
 * Read installed WTF-P version from .wtfp-version file
 */
function readInstalledVersion(claudeDir) {
  const versionFile = path.join(claudeDir, VERSION_FILE);
  if (!fs.existsSync(versionFile)) {
    return null;
  }
  try {
    const content = fs.readFileSync(versionFile, 'utf8').trim();
    const data = JSON.parse(content);
    return data;
  } catch {
    // Corrupt file or old format
    return { version: 'unknown', corrupt: true };
  }
}

/**
 * Write version tracking file
 */
function writeVersionFile(claudeDir, version, installedFiles) {
  const versionFile = path.join(claudeDir, VERSION_FILE);
  const data = {
    version,
    installedAt: new Date().toISOString(),
    files: installedFiles.length,
    manifest: installedFiles.map(f => ({
      path: f.dest.replace(claudeDir, '.'),
      checksum: simpleChecksum(f.dest)
    }))
  };
  fs.writeFileSync(versionFile, JSON.stringify(data, null, 2));
}

/**
 * Simple checksum for file integrity (not cryptographic)
 */
function simpleChecksum(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  } catch {
    return null;
  }
}

/**
 * Detect installation state
 */
function detectInstallation(vendorDir) {
  const result = {
    hasCommands: false,
    hasWorkflows: false,
    hasSkills: false,
    version: null,
    partial: false,
    corrupt: false,
    commandFiles: [],
    workflowFiles: [],
    skillFiles: []
  };

  const commandsDir = path.join(vendorDir, 'commands', 'wtfp');
  const workflowsDir = path.join(vendorDir, 'write-the-f-paper');
  const skillsDir = path.join(vendorDir, 'skills', 'wtfp');

  result.hasCommands = fs.existsSync(commandsDir);
  result.hasWorkflows = fs.existsSync(workflowsDir);
  result.hasSkills = fs.existsSync(skillsDir);

  if (result.hasCommands) {
    result.commandFiles = collectFiles(commandsDir);
  }
  if (result.hasWorkflows) {
    result.workflowFiles = collectFiles(workflowsDir);
  }
  if (result.hasSkills) {
    result.skillFiles = collectFiles(skillsDir);
  }

  // Read version info
  const versionData = readInstalledVersion(vendorDir);
  if (versionData) {
    result.version = versionData.version;
    result.corrupt = versionData.corrupt || false;

    // Check for partial install
    if (!versionData.corrupt) {
      const expectedHasCommands = versionData.manifest?.some(f => f.path.includes('commands/wtfp'));
      const expectedHasWorkflows = versionData.manifest?.some(f => f.path.includes('write-the-f-paper'));
      const expectedHasSkills = versionData.manifest?.some(f => f.path.includes('skills/wtfp'));

      if ((expectedHasCommands && !result.hasCommands) ||
          (expectedHasWorkflows && !result.hasWorkflows) ||
          (expectedHasSkills && !result.hasSkills)) {
        result.partial = true;
      }
    }
  } else if (result.hasCommands || result.hasWorkflows || result.hasSkills) {
    // Files exist but no version file - legacy install
    result.version = 'legacy';
  }

  return result;
}

/**
 * Collect all files recursively in a directory
 */
function collectFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

// ============ Output Utilities ============

/**
 * Create color functions (respects --no-color)
 */
function createColors(useColors = true) {
  if (!useColors) {
    return {
      cyan: s => s,
      green: s => s,
      yellow: s => s,
      red: s => s,
      magenta: s => s,
      dim: s => s,
      reset: ''
    };
  }

  return {
    cyan: s => `\x1b[36m${s}\x1b[0m`,
    green: s => `\x1b[32m${s}\x1b[0m`,
    yellow: s => `\x1b[33m${s}\x1b[0m`,
    red: s => `\x1b[31m${s}\x1b[0m`,
    magenta: s => `\x1b[35m${s}\x1b[0m`,
    dim: s => `\x1b[2m${s}\x1b[0m`,
    reset: '\x1b[0m'
  };
}

/**
 * Create output helpers (respects --quiet/--verbose)
 */
function createOutput(options = {}) {
  const { quiet = false, verbose = false, useColors = true } = options;
  const c = createColors(useColors);

  return {
    colors: c,
    log: (...args) => !quiet && console.log(...args),
    verbose: (...args) => verbose && !quiet && console.log(c.dim(...args)),
    error: (...args) => console.error(c.red('Error:'), ...args),
    warn: (...args) => !quiet && console.log(c.yellow('Warning:'), ...args),
    success: (...args) => !quiet && console.log(c.green('✓'), ...args),
    info: (...args) => !quiet && console.log(c.cyan('ℹ'), ...args)
  };
}

// ============ Prompt Utilities ============

/**
 * Create readline interface
 */
function createRL() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompt user with a question
 */
function prompt(rl, question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim().toLowerCase()));
  });
}

/**
 * Generate backup path with timestamp
 */
function getBackupPath(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return path.join(dir, `${base}.backup-${timestamp}${ext}`);
}

// ============ Exports ============

module.exports = {
  // Path utilities
  expandTilde,
  normalizePath,
  isValidPath,
  getClaudeDir,
  getPathLabel,

  // Version tracking
  VERSION_FILE,
  readInstalledVersion,
  writeVersionFile,
  simpleChecksum,
  detectInstallation,
  collectFiles,

  // Output utilities
  createColors,
  createOutput,

  // Prompt utilities
  createRL,
  prompt,
  getBackupPath
};
