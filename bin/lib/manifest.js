const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

// Mirror of PanCode's own resolution (pancode src/core/xdg.ts): the explicit
// PANCODE_CONFIG_DIR wins, then PANCODE_HOME/config, then the platform
// default. On Linux that default is ${XDG_CONFIG_HOME:-~/.config}/pancode.
// Publishing anywhere else registers the plugin in a profile the operator's
// normal PanCode never reads.
function pancodeConfigRoot(env = process.env, platform = process.platform, home = os.homedir()) {
  const value = (key) => {
    const raw = env[key];
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  };
  const explicit = value('PANCODE_CONFIG_DIR');
  if (explicit) return explicit;
  const pancodeHome = value('PANCODE_HOME');
  if (pancodeHome) return path.join(pancodeHome, 'config');
  if (platform === 'win32') {
    const appData = value('APPDATA') || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'pancode', 'config');
  }
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'pancode', 'config');
  }
  const xdgConfig = value('XDG_CONFIG_HOME') || path.join(home, '.config');
  return path.join(xdgConfig, 'pancode');
}

function generatedBundle(target, selectionRoots = {}, componentIds = {}, dest = '.') {
  return [{
    id: 'bundle',
    src: path.join(ROOT, 'vendors', target),
    dest,
    type: 'dir',
    selectionRoots,
    componentIds
  }];
}

const MANIFEST = {
  claude: {
    name: 'Claude Code',
    configDirEnv: 'CLAUDE_CONFIG_DIR',
    defaultDir: '.claude',
    components: generatedBundle('claude', {
      commands: ['commands', 'skills'],
      workflows: ['workflows'],
      skills: ['skills'],
      agents: ['agents'],
      scripts: ['tools'],
      plugin: ['.claude-plugin']
    }, {
      commands: 'commands',
      skills: 'skills',
      agents: 'agents',
      workflows: 'workflows',
      tools: 'scripts',
      '.claude-plugin': 'plugin'
    }, 'marketplaces/panwrite'),
    native: {
      kind: 'claude-marketplace',
      marketplace: 'panwrite',
      plugin: 'panwrite',
      selector: 'panwrite@panwrite',
      source: 'marketplaces/panwrite'
    }
  },
  // PanCode consumes the canonical Agent Plugins bundle through its hub
  // lifecycle and the desk through its extension lifecycle: two packages, two
  // PanCode installs, one PanWrite receipt.
  pancode: {
    name: 'PanCode',
    configDirEnv: 'PANCODE_CONFIG_DIR',
    defaultDir: '.config/pancode',
    resolveConfigRoot: pancodeConfigRoot,
    components: [
      {
        id: 'plugin',
        src: path.join(ROOT, 'pancode', 'plugin'),
        dest: 'plugins/panwrite',
        type: 'dir'
      },
      {
        id: 'extension',
        src: path.join(ROOT, 'pancode', 'extension'),
        dest: 'extensions/panwrite',
        type: 'dir'
      }
    ],
    discovery: {
      kind: 'directory',
      path: 'plugins/panwrite'
    },
    native: {
      kind: 'pancode-plugin',
      id: 'panwrite',
      source: 'plugins/panwrite',
      extension: { id: 'panwrite', source: 'extensions/panwrite' }
    }
  },
  codex: {
    name: 'Codex',
    configDirEnv: 'CODEX_HOME',
    defaultDir: '.codex',
    components: [
      ...generatedBundle('codex', {}, {
        '.agents': 'marketplace',
        plugins: 'plugin'
      }, 'marketplaces/panwrite'),
      // Codex discovers custom agents only from $CODEX_HOME/agents/, never from
      // a plugin, so the generated TOML roles are published there as well.
      {
        id: 'agents',
        src: path.join(ROOT, 'vendors', 'codex', 'plugins', 'panwrite', 'agents'),
        dest: 'agents',
        type: 'dir'
      }
    ],
    native: {
      kind: 'codex-marketplace',
      marketplace: 'panwrite',
      plugin: 'panwrite',
      selector: 'panwrite@panwrite',
      source: 'marketplaces/panwrite'
    }
  },
  copilot: {
    name: 'GitHub Copilot CLI',
    configDirEnv: 'COPILOT_HOME',
    defaultDir: '.copilot',
    components: generatedBundle('copilot', {}, {
      'marketplace.json': 'marketplace',
      plugins: 'plugin'
    }, 'marketplaces/panwrite'),
    native: {
      kind: 'copilot-marketplace',
      marketplace: 'panwrite',
      plugin: 'panwrite',
      selector: 'panwrite@panwrite',
      source: 'marketplaces/panwrite'
    }
  },
  gemini: {
    name: 'Gemini CLI',
    configDirEnv: 'GEMINI_CLI_HOME',
    envSubdir: '.gemini',
    defaultDir: '.gemini',
    components: generatedBundle('gemini', {
      commands: ['commands', 'skills'],
      workflows: ['workflows'],
      skills: ['skills'],
      agents: ['agents'],
      scripts: ['tools']
    }, {
      commands: 'commands',
      skills: 'skills',
      agents: 'agents',
      workflows: 'workflows',
      tools: 'scripts'
    }, 'extensions/panwrite'),
    discovery: {
      kind: 'directory',
      path: 'extensions/panwrite'
    }
  },
  opencode: {
    name: 'OpenCode',
    configDirEnv: 'OPENCODE_CONFIG_DIR',
    defaultDir: '.config/opencode',
    components: generatedBundle('opencode', {
      commands: ['commands', 'skills'],
      workflows: ['workflows'],
      skills: ['skills'],
      agents: ['agents'],
      scripts: ['tools']
    }, {
      commands: 'commands',
      skills: 'skills',
      agents: 'agents',
      workflows: 'workflows',
      tools: 'scripts'
    })
  },
  antigravity: {
    name: 'Antigravity CLI',
    configDirEnv: 'ANTIGRAVITY_HOME',
    defaultDir: '.gemini/config',
    components: generatedBundle('antigravity', {
      commands: ['commands', 'skills'],
      skills: ['skills'],
      agents: ['agents']
    }, {
      commands: 'commands',
      skills: 'skills',
      agents: 'agents'
    }, 'sources/panwrite'),
    native: {
      kind: 'antigravity-plugin',
      plugin: 'panwrite',
      source: 'sources/panwrite'
    }
  }
};

module.exports = MANIFEST;
