---
name: wtfp:progress
description: Show writing progress and suggest next step
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<objective>
Check writing progress, summarize recent work, and intelligently route to the next action.

**Orchestrator role:** Load state files, calculate progress metrics, present rich status report, determine and offer the next logical command.
</objective>

<context>
No arguments. Reads project state from .planning/.
</context>

<process>

## 1. Validate Environment

```bash
ls .planning/STATE.md .planning/ROADMAP.md .planning/PROJECT.md 2>/dev/null
```

If missing `.planning/` → suggest `/wtfp:new-paper`.
If missing STATE.md or ROADMAP.md → suggest what's needed.

## 2. Load Project Context

Read: STATE.md, ROADMAP.md, PROJECT.md, config.json (for model_profile).

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

## 3. Gather Recent Work

Find 2-3 most recent SUMMARY.md files. Extract: what was written, key decisions, issues.

## 4. Parse Current Position

From STATE.md: current section, plan number, status, word count.
Calculate: total plans, completed, remaining. Total words vs target.
Check for CONTEXT.md in current section directory.

## 4b. Build Statusline

Build the statusline string:
```
WTF-P ► {section progress} ◆ {word count} ► {model_profile}
```

**Section progress:** `{completed}/{total} sections` (count SUMMARY.md files vs total sections)

**Word count:** `{current_words}/{target_words}w` (from STATE.md and PROJECT.md)

**Model profile:** from config.json (quality/balanced/budget)

**Update indicator:** Check for newer version quietly:
```bash
CURRENT=$(node -e "console.log(require('$(npm root -g)/wtf-p/package.json').version)" 2>/dev/null || echo "")
LATEST=$(npm view wtf-p version 2>/dev/null || echo "")
```

If LATEST exists and CURRENT < LATEST, append ` ▲ update` to statusline.

**Pending todos:** Count files:
```bash
PENDING_TODOS=$(ls -1 .planning/todos/pending/*.md 2>/dev/null | wc -l | tr -d ' ')
```

## 5. Present Status Report

**Display statusline FIRST** (before all other output):
```
WTF-P ► 3/6 sections ◆ 4200/8000w ► balanced ▲ update
```

Then the detailed status report:

```
# [Paper Title]

**Progress:** [████████░░] 8/10 sections drafted
**Words:** [current] / [target] ([percentage]%)
**Profile:** [quality/balanced/budget]

## Recent Work
- [Section X]: [1-line summary]

## Current Position
Section [N] of [total]: [name] — [status]
CONTEXT: [✓ | -]

## Key Decisions
- [from STATE.md]

## Open Issues
- [deferred items]

## Pending Todos
{PENDING_TODOS} pending (run /wtfp:check-todos to review)
```

## 6. Route to Next Action

**Count files in current section:**
```bash
ls -1 .planning/sections/[dir]/*-PLAN.md 2>/dev/null | wc -l
ls -1 .planning/sections/[dir]/*-SUMMARY.md 2>/dev/null | wc -l
ls -1 .planning/sections/[dir]/*-ISSUES.md 2>/dev/null | wc -l
```

**Route A — Unexecuted plan exists** (summaries < plans):
Find first PLAN.md without SUMMARY.md. Offer `/wtfp:write-section [path]`.

**Route B — Section needs planning** (plans = 0):
If CONTEXT.md exists → offer `/wtfp:plan-section {N}`.
If not → offer `/wtfp:discuss-section {N}` or `/wtfp:plan-section {N}`.

**Route C — Section complete, more remain** (summaries = plans, not last section):
Offer `/wtfp:plan-section {N+1}`. Also: `/wtfp:review-section {N}`.

**Route D — Draft complete** (all sections done):
Offer `/wtfp:review-section` and `/wtfp:export-latex`.

**Route E — Review issues need revision** (ISSUES.md without REVISION.md):
Offer `/wtfp:plan-revision {plan}`.

</process>

<offer_next>

Show the routed next action with clear command and `/clear` suggestion.

</offer_next>

<success_criteria>
- [ ] Statusline displayed first: WTF-P ► {sections} ◆ {words} ► {profile} [▲ update]
- [ ] Update indicator shown when newer version available
- [ ] Pending todo count shown
- [ ] Rich context provided (recent work, word counts, decisions)
- [ ] Current position clear with visual progress
- [ ] Model profile shown
- [ ] Smart routing to next command
- [ ] User confirms before any action
</success_criteria>
