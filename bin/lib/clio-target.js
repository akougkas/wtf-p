'use strict';

const fs = require('fs');
const path = require('path');
const { supportsClioPlugins } = require('./native-registration');

function pluginTarget(legacy) {
  return {
    ...legacy,
    components: [{ id: 'plugin', src: path.resolve(__dirname, '../../vendors/plugin'), dest: 'plugins/wtfp', type: 'dir' }],
    discovery: { kind: 'directory', path: 'plugins/wtfp' },
    native: { kind: 'clio-plugin', id: 'wtfp', source: 'plugins/wtfp' }
  };
}

// Keep an existing extension on its supported lifecycle until explicitly removed.
// This avoids duplicate public aliases and never retires an unowned installation.
function selectClioTarget(legacy, targetDir, options = {}) {
  const plugin = fs.existsSync(path.join(targetDir, 'plugins/wtfp'));
  const extension = fs.existsSync(path.join(targetDir, 'extensions/wtfp'));
  if (plugin && extension) throw new Error('Both WTF-P plugin and extension exist; remove the unwanted registration before installing to avoid duplicate aliases');
  if (plugin) return pluginTarget(legacy);
  if (extension) return legacy;
  return supportsClioPlugins(options) ? pluginTarget(legacy) : legacy;
}

// Uninstall follows the authenticated receipt, not the currently installed CLI.
function clioTargetForReceipt(legacy, receipt) {
  const paths = Array.isArray(receipt?.files) ? receipt.files.map(file => file.path) : [];
  const plugin = paths.some(file => file.startsWith('plugins/wtfp/'));
  const extension = paths.some(file => file.startsWith('extensions/wtfp/'));
  if (plugin && extension) throw new Error('Mixed WTF-P plugin/extension receipt requires explicit recovery');
  return plugin ? pluginTarget(legacy) : legacy;
}

module.exports = { selectClioTarget, clioTargetForReceipt };
