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
        id: 'plugin',
        src: path.join(ROOT, 'vendors', 'claude', '.claude-plugin'),
        dest: '.claude-plugin',
        type: 'dir'
      }
    ]
  },
  // Future:
  // gemini: { ... }
};

module.exports = MANIFEST;
