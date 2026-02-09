---
name: wtfp:quick
description: Run a small writing fix without full planning overhead
argument-hint: "[task description]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<objective>
Execute a quick writing task with atomic commits and state tracking but skip optional agents (plan-checker, argument-verifier).

**Orchestrator role:** Parse task, load minimal context, execute directly or spawn writer agent, commit result.

Use for small targeted tasks: fix a paragraph, add a citation, tweak wording, expand a point.
</objective>

<context>
Task: $ARGUMENTS (natural language description of what to do)

**Load project state:**
@.planning/STATE.md
@.planning/config.json
</context>

<process>

## 1. Validate Environment

```bash
ls .planning/ 2>/dev/null || echo "No project — will work on files directly"
ls paper/*.md 2>/dev/null
```

## 2. Parse Task Intent

Classify $ARGUMENTS into task type:
- **fix** — Correct an error, fix citation, resolve contradiction
- **add** — Add a paragraph, citation, transition, figure reference
- **revise** — Rewrite a paragraph, strengthen argument, tighten prose
- **cite** — Add or fix specific citations

## 3. Load Minimal Context

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
STATE_CONTENT=$(cat .planning/STATE.md 2>/dev/null)
```

Only load files directly relevant to the task. No full context dump.

## 4. Execute Task

**For simple tasks (fix, cite):** Execute directly in orchestrator — read target file, make edit, verify.

**For complex tasks (add, revise):** Spawn section-writer agent with focused prompt.

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| section-writer | opus | sonnet | sonnet |

```
Task(
  prompt="First, read ~/.claude/agents/wtfp/section-writer.md for your role.\n\n" + focused_prompt,
  subagent_type="general-purpose",
  model="{writer_model}",
  description="Quick: [task summary]"
)
```

**Skip:** plan-checker, argument-verifier (quick mode = no verification loop).

## 5. Commit and Update State

```bash
git add paper/
git commit -m "[type](quick): [task description]"
```

Update STATE.md word count if changed.

</process>

<offer_next>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► QUICK TASK DONE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[task summary] — [words changed]

───────────────────────────────────────────

</offer_next>

<success_criteria>
- [ ] Task executed with minimal context loading
- [ ] Changes committed atomically
- [ ] STATE.md word count updated
- [ ] No unnecessary agent spawning
</success_criteria>
