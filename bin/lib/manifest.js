const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

// Mirror of Clio's own resolution (clio-coder src/core/xdg.ts): the explicit
// CLIO_CODER_CONFIG_DIR wins, then CLIO_CODER_HOME/config, then the platform
// default. On Linux that default is ${XDG_CONFIG_HOME:-~/.config}/clio-coder.
// Publishing anywhere else registers the plugin in a profile the operator's
// normal Clio never reads.
function clioConfigRoot(env = process.env, platform = process.platform, home = os.homedir()) {
  const value = (key) => {
    const raw = env[key];
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  };
  const explicit = value('CLIO_CODER_CONFIG_DIR');
  if (explicit) return explicit;
  const clioHome = value('CLIO_CODER_HOME');
  if (clioHome) return path.join(clioHome, 'config');
  if (platform === 'win32') {
    const appData = value('APPDATA') || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'clio-coder', 'config');
  }
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'clio-coder', 'config');
  }
  const xdgConfig = value('XDG_CONFIG_HOME') || path.join(home, '.config');
  return path.join(xdgConfig, 'clio-coder');
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
    }, 'marketplaces/wtfp'),
    native: {
      kind: 'claude-marketplace',
      marketplace: 'wtfp',
      plugin: 'wtfp',
      selector: 'wtfp@wtfp',
      source: 'marketplaces/wtfp'
    }
  },
  // Clio consumes the canonical Agent Plugins bundle through its own plugin
  // lifecycle. There is no second WTF-P packaging for this host.
  clio: {
    name: 'Clio Coder',
    configDirEnv: 'CLIO_CODER_CONFIG_DIR',
    defaultDir: '.config/clio-coder',
    resolveConfigRoot: clioConfigRoot,
    components: [
      {
        id: 'plugin',
        src: path.join(ROOT, 'vendors', 'plugin'),
        dest: 'plugins/wtfp',
        type: 'dir'
      }
    ],
    discovery: {
      kind: 'directory',
      path: 'plugins/wtfp'
    },
    native: {
      kind: 'clio-plugin',
      id: 'wtfp',
      source: 'plugins/wtfp'
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
      }, 'marketplaces/wtfp'),
      // Codex discovers custom agents only from $CODEX_HOME/agents/, never from
      // a plugin, so the generated TOML roles are published there as well.
      {
        id: 'agents',
        src: path.join(ROOT, 'vendors', 'codex', 'plugins', 'wtf-p', 'agents'),
        dest: 'agents',
        type: 'dir'
      }
    ],
    native: {
      kind: 'codex-marketplace',
      marketplace: 'wtfp',
      plugin: 'wtf-p',
      selector: 'wtf-p@wtfp',
      source: 'marketplaces/wtfp'
    }
  },
  copilot: {
    name: 'GitHub Copilot CLI',
    configDirEnv: 'COPILOT_HOME',
    defaultDir: '.copilot',
    components: generatedBundle('copilot', {}, {
      'marketplace.json': 'marketplace',
      plugins: 'plugin'
    }, 'marketplaces/wtfp'),
    native: {
      kind: 'copilot-marketplace',
      marketplace: 'wtfp',
      plugin: 'wtf-p',
      selector: 'wtf-p@wtfp',
      source: 'marketplaces/wtfp'
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
    }, 'extensions/wtf-p'),
    discovery: {
      kind: 'directory',
      path: 'extensions/wtf-p'
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
    }, 'sources/wtf-p'),
    native: {
      kind: 'antigravity-plugin',
      plugin: 'wtf-p',
      source: 'sources/wtf-p'
    }
  }
};

module.exports = MANIFEST;
