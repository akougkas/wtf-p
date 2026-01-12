---
name: wtfp:pause-writing
description: Create context handoff when pausing work mid-section
allowed-tools:
  - Read
  - Bash
  - Write
---

<objective>
Create context handoff file when pausing work mid-section.

Captures current state so next session can resume seamlessly.

Creates .continue-here.md with current state and updates STATE.md.
</objective>

<process>

<step name="verify">
**Verify project exists:**

```bash
[ ! -f .planning/STATE.md ] && echo "ERROR: No project state found" && exit 1
```

</step>

<step name="gather">
**Gather current state:**

- Read STATE.md for current position
- Find any in-progress PLAN.md files
- Check for uncommitted changes
- Identify what was being worked on
</step>

<step name="handoff">
**Create .continue-here.md:**

In the current section directory:

```markdown
---
section: XX-name
task: [current task number]
total_tasks: [total]
status: [in_progress/blocked/almost_done]
last_updated: [ISO timestamp]
---

# Continue Here: [Section Name]

## Current State
[What's currently happening - in progress, waiting for input, etc.]

## Completed Work
- [Task 1]: [done]
- [Task 2]: [done]
- [Task 3]: [in progress - description of where stopped]

## Remaining Work
- [Task 4]: [not started]
- [Task 5]: [not started]

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| [choice] | [why] |

## Blockers (if any)
- [What's blocking progress]

## Context Notes
[Any important context for resuming:
- Why work was paused
- What was being figured out
- Any insights not yet captured elsewhere]

## Next Action
[Exactly what to do when resuming]

---
*Paused: [timestamp]*
```

</step>

<step name="update_state">
**Update STATE.md:**

Add to Session Continuity section:
```markdown
## Session Continuity
- Last session: [timestamp]
- Handoff: .planning/sections/XX-name/.continue-here.md
- Status: [in_progress/blocked]
```

</step>

<step name="commit">
```bash
git add .planning/sections/XX-name/.continue-here.md .planning/STATE.md
git commit -m "$(cat <<'EOF'
wip: pause [section name]

Task [X] of [Y] in progress
EOF
)"
```

</step>

<step name="done">
**Present completion:**

```
Work paused:

- Handoff: .planning/sections/XX-name/.continue-here.md
- State: .planning/STATE.md updated
- Position: Task [X] of [Y]

## To Resume

`/wtfp:resume-writing`

This will restore full context and continue from task [X].

---
```

</step>

</process>

<success_criteria>
- [ ] .continue-here.md captures current state
- [ ] Completed work documented
- [ ] Remaining work listed
- [ ] Next action is clear and actionable
- [ ] STATE.md updated with handoff reference
- [ ] All committed to git
</success_criteria>
