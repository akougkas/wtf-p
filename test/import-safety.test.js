#!/usr/bin/env node
/**
 * Entrypoint import-safety regression tests.
 *
 * This file deliberately imports only Node core modules. It must run before
 * any test that imports the installer or uninstaller, so a lost
 * `require.main === module` guard cannot touch a developer's real profile.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const entrypoints = [
  path.join(root, 'bin', 'install.js'),
  path.join(root, 'bin', 'uninstall.js')
];

let failed = false;
let passed = 0;

function check(condition, message, detail = '') {
  if (condition) {
    console.log(`\x1b[32m✓\x1b[0m ${message}`);
    passed++;
    return;
  }

  console.log(`\x1b[31m✗\x1b[0m ${message}`);
  if (detail) console.log(detail);
  failed = true;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function snapshotTree(directory) {
  const entries = [];

  function visit(current, relative) {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      entries.push(`link\t${relative}\t${fs.readlinkSync(current)}`);
      return;
    }
    if (stat.isDirectory()) {
      entries.push(`dir\t${relative}`);
      for (const name of fs.readdirSync(current).sort()) {
        visit(path.join(current, name), path.join(relative, name));
      }
      return;
    }
    if (stat.isFile()) {
      entries.push(`file\t${relative}\t${stat.mode}\t${stat.size}\t${sha256(current)}`);
      return;
    }
    entries.push(`other\t${relative}\t${stat.mode}\t${stat.size}`);
  }

  visit(directory, '.');
  return entries.join('\n');
}

function makeIsolatedEnv(fixture) {
  const isolatedHome = path.join(fixture, 'home');
  return {
    ...process.env,
    HOME: isolatedHome,
    USERPROFILE: isolatedHome,
    XDG_CONFIG_HOME: path.join(fixture, 'xdg', 'config'),
    XDG_DATA_HOME: path.join(fixture, 'xdg', 'data'),
    XDG_STATE_HOME: path.join(fixture, 'xdg', 'state'),
    XDG_CACHE_HOME: path.join(fixture, 'xdg', 'cache'),
    CLAUDE_CONFIG_DIR: path.join(fixture, 'clients', 'claude'),
    GEMINI_CONFIG_DIR: path.join(fixture, 'clients', 'gemini'),
    OPENCODE_CONFIG_DIR: path.join(fixture, 'clients', 'opencode'),
    CODEX_HOME: path.join(fixture, 'clients', 'codex'),
    CLIO_CODER_HOME: path.join(fixture, 'clients', 'clio'),
    CLIO_CONFIG_DIR: path.join(fixture, 'clients', 'clio', 'config'),
    CLIO_DATA_DIR: path.join(fixture, 'clients', 'clio', 'data'),
    CLIO_STATE_DIR: path.join(fixture, 'clients', 'clio', 'state'),
    CLIO_CACHE_DIR: path.join(fixture, 'clients', 'clio', 'cache'),
    CLIO_BIN_DIR: path.join(fixture, 'clients', 'clio', 'bin'),
    TMPDIR: path.join(fixture, 'tmp'),
    TEMP: path.join(fixture, 'tmp'),
    TMP: path.join(fixture, 'tmp'),
    FORCE_COLOR: '',
    NO_COLOR: '1'
  };
}

// The child installs this guard before loading an entrypoint. Any attempted
// filesystem mutation whose destination is outside the disposable fixture is
// rejected, even if a future regression ignores the isolated environment.
const guardedImport = String.raw`
  const fs = require('fs');
  const path = require('path');
  const { fileURLToPath } = require('url');

  const entrypoint = path.resolve(process.argv[1]);
  const fixture = fs.realpathSync(process.argv[2]);
  const fixturePrefix = fixture.endsWith(path.sep) ? fixture : fixture + path.sep;

  function display(value) {
    if (Buffer.isBuffer(value)) return value.toString();
    if (value && typeof value === 'object' && value.protocol === 'file:') return fileURLToPath(value);
    return value;
  }

  function assertInside(value, operation) {
    if (typeof value === 'number' || value === undefined || value === null) return;
    const candidate = path.resolve(String(display(value)));
    if (candidate !== fixture && !candidate.startsWith(fixturePrefix)) {
      throw new Error(operation + ' attempted a filesystem mutation outside the test fixture: ' + candidate);
    }
  }

  function rejectMutation(value, operation) {
    assertInside(value, operation);
    throw new Error(operation + ' attempted a filesystem mutation while importing an entrypoint');
  }

  function wrapPath(name, indexes) {
    if (typeof fs[name] !== 'function') return;
    const original = fs[name];
    fs[name] = function guardedMutation(...args) {
      for (const index of indexes) rejectMutation(args[index], 'fs.' + name);
      return original.apply(this, args);
    };
  }

  for (const name of [
    'appendFile', 'appendFileSync', 'chmod', 'chmodSync', 'chown', 'chownSync',
    'createWriteStream', 'lchmod', 'lchmodSync', 'lchown', 'lchownSync',
    'lutimes', 'lutimesSync', 'mkdir', 'mkdirSync', 'mkdtemp', 'mkdtempSync',
    'rm', 'rmSync', 'rmdir', 'rmdirSync', 'truncate', 'truncateSync', 'unlink',
    'unlinkSync', 'utimes', 'utimesSync', 'writeFile', 'writeFileSync'
  ]) wrapPath(name, [0]);

  for (const name of ['copyFile', 'copyFileSync', 'cp', 'cpSync', 'link', 'linkSync', 'symlink', 'symlinkSync']) {
    wrapPath(name, [1]);
  }
  for (const name of ['rename', 'renameSync']) wrapPath(name, [0, 1]);

  function writes(flags) {
    if (typeof flags === 'number') {
      const c = fs.constants;
      return Boolean(flags & (c.O_WRONLY | c.O_RDWR | c.O_CREAT | c.O_TRUNC | c.O_APPEND));
    }
    return typeof flags === 'string' && /[wax+]/.test(flags);
  }

  for (const name of ['open', 'openSync']) {
    const original = fs[name];
    fs[name] = function guardedOpen(...args) {
      if (writes(args[1])) rejectMutation(args[0], 'fs.' + name);
      return original.apply(this, args);
    };
  }

  const promises = fs.promises;
  function wrapPromisePath(name, indexes) {
    if (typeof promises[name] !== 'function') return;
    const original = promises[name];
    promises[name] = async function guardedMutation(...args) {
      for (const index of indexes) rejectMutation(args[index], 'fs.promises.' + name);
      return original.apply(this, args);
    };
  }

  for (const name of [
    'appendFile', 'chmod', 'chown', 'lchmod', 'lchown', 'lutimes', 'mkdir',
    'mkdtemp', 'rm', 'rmdir', 'truncate', 'unlink', 'utimes', 'writeFile'
  ]) wrapPromisePath(name, [0]);
  for (const name of ['copyFile', 'cp', 'link', 'symlink']) wrapPromisePath(name, [1]);
  wrapPromisePath('rename', [0, 1]);

  if (typeof promises.open === 'function') {
    const originalOpen = promises.open;
    promises.open = async function guardedOpen(...args) {
      if (writes(args[1])) rejectMutation(args[0], 'fs.promises.open');
      return originalOpen.apply(this, args);
    };
  }

  require(entrypoint);
`;

function probeEntrypoint(entrypoint) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-import-safety-'));
  const cwd = path.join(fixture, 'cwd');
  const temp = path.join(fixture, 'tmp');
  fs.mkdirSync(cwd, { recursive: true });
  fs.mkdirSync(temp, { recursive: true });

  try {
    const before = snapshotTree(fixture);
    const result = spawnSync(process.execPath, ['-e', guardedImport, entrypoint, fixture], {
      cwd,
      encoding: 'utf8',
      env: makeIsolatedEnv(fixture),
      input: '',
      timeout: 10000
    });
    const after = snapshotTree(fixture);
    const diagnostic = [result.error && result.error.stack, result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n');
    const label = path.relative(root, entrypoint);

    const silent = result.stdout === '' && result.stderr === '';
    check(result.status === 0 && !result.error && silent, `${label} can be imported without executing`, diagnostic);
    check(before === after, `${label} import performs no filesystem mutations`, before === after ? '' : diagnostic);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

console.log('=== Entrypoint Import Safety Tests ===\n');
for (const entrypoint of entrypoints) probeEntrypoint(entrypoint);
console.log(`\n=== Import Safety Results: ${passed} passed${failed ? ', failures detected' : ''} ===\n`);

process.exit(failed ? 1 : 0);
