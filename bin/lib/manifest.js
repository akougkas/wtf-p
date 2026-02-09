const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

const MANIFEST = {
  claude: {
    name: 'Claude Code',
    configDirEnv: 'CLAUDE_CONFIG_DIR',
    defaultDir: '.claude',
    components: [
      {
        id: 'workflows',
        src: path.join(ROOT, 'core', 'write-the-f-paper'),
        dest: 'write-the-f-paper',
        type: 'dir'
      },
      {
        id: 'commands',
        src: path.join(ROOT, 'vendors', 'claude', 'commands', 'wtfp'),
        dest: 'commands/wtfp',
        type: 'dir'
      },
      {
        id: 'skills',
        src: path.join(ROOT, 'vendors', 'claude', 'skills', 'wtfp'),
        dest: 'skills/wtfp',
        type: 'dir'
      },
      {
        id: 'agents',
        src: path.join(ROOT, 'vendors', 'claude', 'agents', 'wtfp'),
        dest: 'agents/wtfp',
        type: 'dir'
      },
      {
        id: 'mcp',
        src: path.join(ROOT, 'vendors', 'claude', 'mcp'),
        dest: 'mcp',
        type: 'dir'
      },
      {
        id: 'scripts',
        src: path.join(ROOT, 'bin', 'lib'),
        dest: 'bin',
        type: 'dir'
      },
      {
        id: 'plugin',
        src: path.join(ROOT, 'vendors', 'claude', '.claude-plugin'),
        dest: '.claude-plugin',
        type: 'dir'
      }
    ]
  },
  gemini: {
    name: 'Gemini CLI',
    configDirEnv: 'GEMINI_CONFIG_DIR',
    defaultDir: '.config/gemini',
    components: [
      {
        id: 'workflows',
        src: path.join(ROOT, 'core', 'write-the-f-paper'),
        dest: 'write-the-f-paper',
        type: 'dir'
      },
      {
        id: 'commands',
        src: path.join(ROOT, 'vendors', 'gemini', 'commands', 'wtfp'),
        dest: 'commands/wtfp',
        type: 'dir'
      },
      {
        id: 'agents',
        src: path.join(ROOT, 'vendors', 'gemini', 'agents', 'wtfp'),
        dest: 'agents/wtfp',
        type: 'dir'
      },
      {
        id: 'scripts',
        src: path.join(ROOT, 'bin', 'lib'),
        dest: 'bin',
        type: 'dir'
      }
    ]
  },
  opencode: {
    name: 'OpenCode',
    configDirEnv: 'OPENCODE_CONFIG_DIR',
    defaultDir: '.opencode',
    components: [
      {
        id: 'workflows',
        src: path.join(ROOT, 'core', 'write-the-f-paper'),
        dest: 'write-the-f-paper',
        type: 'dir'
      },
      {
        id: 'commands',
        src: path.join(ROOT, 'vendors', 'opencode', 'commands', 'wtfp'),
        dest: 'commands/wtfp',
        type: 'dir'
      },
      {
        id: 'agents',
        src: path.join(ROOT, 'vendors', 'opencode', 'agents', 'wtfp'),
        dest: 'agents/wtfp',
        type: 'dir'
      },
      {
        id: 'scripts',
        src: path.join(ROOT, 'bin', 'lib'),
        dest: 'bin',
        type: 'dir'
      }
    ]
  }
};

module.exports = MANIFEST;
