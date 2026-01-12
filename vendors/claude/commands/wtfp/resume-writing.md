---
name: wtfp:resume-writing
description: Resume work from previous session with full context restoration
allowed-tools:
  - Read
  - Bash
  - Glob
  - SlashCommand
---

<objective>
Resume work from a previous session with full context restoration.

Reads STATE.md and any .continue-here.md files to restore context.

Shows current position, recent progress, and offers appropriate next actions.
</objective>

<process>

<step name="verify">
**Verify project exists:**

```bash
[ ! -f .planning/STATE.md ] && echo "ERROR: No project state found. Run /wtfp:new-paper first" && exit 1
```

</step>

<step name="load">
**Load project context:**

- Read STATE.md for current position and session info
- Read PROJECT.md for paper vision
- Read ROADMAP.md for section structure
- Check for .continue-here.md files in section directories
</step>

<step name="check_handoff">
**Check for handoff file:**

```bash
find .planning/sections -name ".continue-here.md" 2>/dev/null | head -1
```

If handoff file exists:
- Read it for detailed resumption context
- Extract: current task, remaining work, next action, blockers
</step>

<step name="present">
**Present resumption context:**

**If handoff file exists:**

```
# Resuming: [Paper Title]

## Where You Left Off
Section [N]: [Name]
Task [X] of [Y]: [task description]
Status: [in_progress/blocked]

## Completed in Last Session
- [Task 1]: [done]
- [Task 2]: [done]

## Remaining Work
- [Current task]: [in progress]
- [Next tasks]: [pending]

## Context Notes
[Notes from .continue-here.md]

## Blockers (if any)
[Any blockers noted]

---

## ▶ Next Action

[From .continue-here.md next_action]

`/wtfp:[appropriate-command]`

<sub>`/clear` first if context window is full</sub>

---
```

**If no handoff file:**

```
# Resuming: [Paper Title]

## Current Position
Section [N] of [total]: [Name]
Plan [X] of [section-total]: [status]
Words: [current] / [target]

## Recent Progress
[From STATE.md or recent SUMMARY files]

---

## ▶ Next Up

[Based on STATE.md current position]

`/wtfp:[appropriate-command]`

---

For full status: `/wtfp:progress`

---
```

</step>

<step name="cleanup">
**Clean up handoff file after resume:**

If user proceeds with next action, the handoff file should be removed:

```bash
rm .planning/sections/XX-name/.continue-here.md
git add .planning/sections/XX-name/
git commit -m "docs: resume [section name] from handoff"
```

</step>

</process>

<success_criteria>
- [ ] STATE.md read for current position
- [ ] Handoff file detected if exists
- [ ] Full context presented
- [ ] Clear next action provided
- [ ] Routes to appropriate command
</success_criteria>
