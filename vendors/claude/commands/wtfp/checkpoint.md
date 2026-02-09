---
name: wtfp:checkpoint
description: Save, restore, or list paper state snapshots
argument-hint: "[save|restore|list] [label]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Save full paper state as a git-tagged checkpoint or restore from a previous one.

**Orchestrator role:** Parse subcommand, execute checkpoint operation via bin/lib/checkpoint.js, report result.

Enables session continuity — save state before `/clear`, restore in next session.
</objective>

<context>
Subcommand: $ARGUMENTS
- `save [label]` — Create checkpoint with label (e.g., "pre-discussion", "draft-1")
- `restore [tag]` — Restore from a checkpoint tag
- `list` — Show available checkpoints

**Load project state:**
@.planning/STATE.md
</context>

<process>

## 1. Parse Subcommand

Extract subcommand and arguments from $ARGUMENTS.

Default: `save` if no subcommand provided, with auto-generated label from STATE.md position.

## 2. Execute Operation

### Save

```bash
node -e "
const cp = require('$HOME/.claude/bin/lib/checkpoint.js');
const result = cp.createCheckpoint({
  planningDir: '.planning',
  label: '[label]',
  note: '[current position from STATE.md]'
});
console.log(JSON.stringify(result));
"
```

### Restore

If no tag provided, list checkpoints and ask via AskUserQuestion:
- header: "Checkpoint"
- question: "Which checkpoint to restore?"
- options: [list of available checkpoints]

```bash
node -e "
const cp = require('$HOME/.claude/bin/lib/checkpoint.js');
cp.restoreCheckpoint('[tag]');
"
```

### List

```bash
node -e "
const cp = require('$HOME/.claude/bin/lib/checkpoint.js');
const list = cp.listCheckpoints();
list.forEach(c => console.log(c.tag + ' — ' + c.message));
"
```

## 3. Present Result

</process>

<offer_next>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► CHECKPOINT [SAVED|RESTORED] ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tag: [tag]
Files: [N]

───────────────────────────────────────────

Resume with `/wtfp:progress` after restoring.

───────────────────────────────────────────

</offer_next>

<success_criteria>
- [ ] Checkpoint created/restored/listed successfully
- [ ] Git tag created (for save)
- [ ] State verified after restore
</success_criteria>
