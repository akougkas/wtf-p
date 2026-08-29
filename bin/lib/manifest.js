const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

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
      mcp: ['mcp'],
      scripts: ['tools'],
      plugin: ['.claude-plugin']
    }, {
      commands: 'commands',
      skills: 'skills',
      agents: 'agents',
      workflows: 'workflows',
      mcp: 'mcp',
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
  clio: {
    name: 'Clio Coder',
    configDirEnv: 'CLIO_CODER_CONFIG_DIR',
    defaultDir: '.config/clio-coder',
    components: [
      {
        id: 'extension',
        src: path.join(ROOT, 'vendors', 'clio'),
        dest: 'extensions/wtf-p',
        type: 'dir'
      }
    ],
    discovery: {
      kind: 'directory',
      path: 'extensions/wtf-p'
    }
  },
  codex: {
    name: 'Codex',
    configDirEnv: 'CODEX_HOME',
    defaultDir: '.codex',
    components: generatedBundle('codex', {}, {
      '.agents': 'marketplace',
      plugins: 'plugin'
    }, 'marketplaces/wtfp'),
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
