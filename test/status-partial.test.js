#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const { RECEIPT_FILE } = require('../bin/lib/ownership');
const { detectInstallation } = require('../bin/lib/utils');

const originalCwd = process.cwd();
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-status-partial-'));
const workspace = path.join(testRoot, 'workspace');
let passed = 0;

function createOutput() {
  const lines = [];
  const identity = value => String(value);
  return {
    lines,
    out: {
      colors: {
        cyan: identity,
        green: identity,
        yellow: identity,
        red: identity,
        magenta: identity,
        dim: identity
      },
      log: (...values) => lines.push(values.join(' '))
    }
  };
}

function record(name, test) {
  return Promise.resolve()
    .then(test)
    .then(() => {
      passed++;
      console.log(`✓ ${name}`);
    });
}

function makeDir(relative) {
  const directory = path.join(testRoot, relative);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function writeReceipt(targetDir, overrides = {}) {
  const receipt = {
    schemaVersion: 2,
    product: 'wtf-p',
    version: '1.0.0',
    target: { canonicalPath: fs.realpathSync(targetDir) },
    runtime: 'claude',
    scope: 'global',
    partial: false,
    files: [],
    backups: [],
    ...overrides
  };
  fs.writeFileSync(path.join(targetDir, RECEIPT_FILE), JSON.stringify(receipt));
  return receipt;
}

async function main() {
  fs.mkdirSync(workspace, { recursive: true });
  process.chdir(workspace);

  // Prevent the status command's optional registry check from using the
  // network. It captures this stub when required below.
  const originalExecFileSync = childProcess.execFileSync;
  childProcess.execFileSync = () => {
    throw new Error('registry lookup disabled in focused test');
  };
  const showStatus = require('../bin/commands/status');
  childProcess.execFileSync = originalExecFileSync;

  const runUpdate = require('../bin/commands/update');
  const runDoctor = require('../bin/commands/doctor');

  const partialTarget = makeDir('partial-config');
  writeReceipt(partialTarget, {
    partial: true,
    files: [{
      path: 'write-the-f-paper/workflows/missing.md',
      sha256: 'a'.repeat(64),
      component: 'workflows'
    }]
  });

  await record('detectInstallation propagates receipt partial state', () => {
    const detection = detectInstallation(partialTarget);
    assert.strictEqual(detection.hasReceipt, true);
    assert.strictEqual(detection.hasAny, true);
    assert.strictEqual(detection.partial, true);
    assert.strictEqual(detection.version, '1.0.0');
  });

  const workflowTarget = makeDir('workflow-config/write-the-f-paper/workflows');
  fs.writeFileSync(path.join(workflowTarget, 'draft.md'), '# workflow\n');
  const workflowConfig = path.dirname(path.dirname(workflowTarget));

  await record('workflow-only legacy installs set hasAny', () => {
    const detection = detectInstallation(workflowConfig);
    assert.strictEqual(detection.hasCommands, false);
    assert.strictEqual(detection.hasWorkflows, true);
    assert.strictEqual(detection.hasAny, true);
    assert.strictEqual(detection.version, 'legacy');
  });

  const localConfig = path.join(workspace, '.claude');
  fs.mkdirSync(path.join(localConfig, 'skills', 'wtfp'), { recursive: true });
  fs.writeFileSync(path.join(localConfig, 'skills', 'wtfp', 'SKILL.md'), '# skill\n');

  await record('skill-only legacy installs set hasAny', () => {
    const detection = detectInstallation(localConfig);
    assert.strictEqual(detection.hasCommands, false);
    assert.strictEqual(detection.hasSkills, true);
    assert.strictEqual(detection.hasAny, true);
    assert.strictEqual(detection.version, 'legacy');
  });

  await record('status reports a partial receipt-only installation', async () => {
    const output = createOutput();
    await showStatus({
      out: output.out,
      explicitConfigDir: partialTarget,
      hasQuiet: false
    }, { version: '1.0.0' });
    const rendered = output.lines.join('\n');
    assert.match(rendered, /Installed: receipt only/);
    assert.match(rendered, /Partial installation detected/);
  });

  await record('update selects a partial receipt-only global installation', async () => {
    const output = createOutput();
    const calls = [];
    await runUpdate({
      out: output.out,
      explicitConfigDir: partialTarget,
      hasGlobal: false,
      hasLocal: false
    }, { version: '2.0.0' }, async (...args) => calls.push(args));
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0][0], 'claude');
  });

  await record('update selects a skill-only local installation', async () => {
    const output = createOutput();
    const emptyGlobal = makeDir('empty-global');
    const calls = [];
    await runUpdate({
      out: output.out,
      explicitConfigDir: emptyGlobal,
      hasGlobal: false,
      hasLocal: false
    }, { version: '2.0.0' }, async (...args) => calls.push(args));
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0][0], 'claude-local');
  });

  await record('doctor reports partial and duplicate non-command installs', async () => {
    const output = createOutput();
    await runDoctor({ out: output.out, explicitConfigDir: partialTarget });
    const rendered = output.lines.join('\n');
    assert.match(rendered, /Installation integrity: Partial install/);
    assert.match(rendered, /Dual installation: Found in both/);
  });

  await record('status, update, and doctor reject an unsafe explicit target', async () => {
    const output = createOutput();
    const unsafeOptions = {
      out: output.out,
      explicitConfigDir: path.parse(testRoot).root,
      hasQuiet: false,
      hasGlobal: false,
      hasLocal: false
    };
    await assert.rejects(showStatus(unsafeOptions, { version: '1.0.0' }), /filesystem root/);
    await assert.rejects(runUpdate(unsafeOptions, { version: '1.0.0' }, async () => {}), /filesystem root/);
    await assert.rejects(runDoctor(unsafeOptions), /filesystem root/);
  });
}

main()
  .then(() => {
    console.log(`\n${passed} focused status/partial tests passed.`);
  })
  .catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    process.chdir(originalCwd);
    fs.rmSync(testRoot, { recursive: true, force: true });
  });
