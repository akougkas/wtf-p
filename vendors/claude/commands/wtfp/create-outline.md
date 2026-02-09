---
name: wtfp:create-outline
description: Build section outline, argument map, and word budgets
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<execution_context>
@~/.claude/write-the-f-paper/workflows/create-outline.md
@~/.claude/write-the-f-paper/templates/roadmap.md
@~/.claude/write-the-f-paper/templates/state.md
@~/.claude/write-the-f-paper/references/imrad-structure.md
</execution_context>

<objective>
Create the document outline and section roadmap for an initialized paper.

**Orchestrator role:** Validate environment, load project context, resolve model profile, spawn outliner agent to produce structure artifacts, create STATE.md, create section directories, commit, present results.

**Why subagent:** Outlining requires significant reasoning about document structure, argument decomposition, and wave assignment. A fresh outliner agent gets peak quality for these creative decisions.
</objective>

<context>
No arguments. Requires `.planning/PROJECT.md` to exist.
</context>

<process>

## 1. Validate Environment and Resolve Model Profile

```bash
[ ! -f .planning/PROJECT.md ] && echo "ERROR: No project. Run /wtfp:new-paper" && exit 1
[ -f .planning/ROADMAP.md ] && echo "ERROR: Outline exists. Use /wtfp:progress" && exit 1
ls .planning/ 2>/dev/null
```

**Resolve model profile:**

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| outliner | opus | sonnet | sonnet |

**Resolve gate flag:**
```bash
GATE_CONFIRM_OUTLINE=$(cat .planning/config.json 2>/dev/null | grep -o '"confirm_outline"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
```

## 2. Read Context Files

```bash
PROJECT_CONTENT=$(cat .planning/PROJECT.md)
CONFIG_CONTENT=$(cat .planning/config.json 2>/dev/null)
EXISTING_STRUCTURE=$(cat .planning/structure/*.md 2>/dev/null)
```

## 3. Ensure Structure Directory

```bash
mkdir -p .planning/structure
mkdir -p .planning/sections
```

## 4. Gate Check: Confirm Before Outlining

**If GATE_CONFIRM_OUTLINE is "true" (default):**
Present project summary to user via AskUserQuestion and wait for confirmation before proceeding.

**If GATE_CONFIRM_OUTLINE is "false":**
Skip confirmation and proceed directly to outlining.

## 5. Spawn wtfp-outliner Agent

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► OUTLINING DOCUMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Fill prompt with inlined content and spawn:

```
Task(
  prompt="First, read ~/.claude/agents/wtfp/outliner.md for your role and instructions.\n\n" + filled_outlining_prompt,
  subagent_type="general-purpose",
  model="{outliner_model}",
  description="Create Document Outline"
)
```

Outlining prompt includes: `<project_context>` with PROJECT.md content, config.json settings, any existing structure files.

## 6. Handle Outliner Return

**`## OUTLINING COMPLETE`:** Proceed to STATE.md creation and directory setup.

**`## CHECKPOINT REACHED`:** Present to user, get response, re-spawn outliner with decision.

**`## OUTLINING BLOCKED`:** Show blocker, offer options.

## 7. Post-Outliner Setup

After successful outlining, the orchestrator handles:

**Create STATE.md** using template from `~/.claude/write-the-f-paper/templates/state.md`:
- Initialize position (section 1 of N), word count (0)
- Set argument strength from outliner's argument-map
- Set open questions from PROJECT.md

**Create section directories** from ROADMAP.md sections:
```bash
mkdir -p .planning/sections/01-[section-slug]
mkdir -p .planning/sections/02-[section-slug]
# ... for all sections listed in ROADMAP.md
```

## 8. Commit (with commit_docs Guard)

```bash
COMMIT_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
```

**If commit_docs = "true" (default):**
```bash
git add .planning/ROADMAP.md .planning/STATE.md .planning/sections/ .planning/structure/
git commit -m "docs: create document outline -- [N] sections, [X] words target"
```

**If commit_docs = "false":**
Skip git add and commit for planning docs. Log: "Skipping planning docs commit (commit_docs: false)"

## 9. Present Final Status

</process>

<offer_next>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► OUTLINE CREATED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Roadmap: .planning/ROADMAP.md ([N] sections, [X] words)
- State: .planning/STATE.md
- Structure: .planning/structure/ (outline, argument-map, narrative-arc)
- Sections: .planning/sections/ ([N] directories)

| # | Section | Words | Wave |
|---|---------|-------|------|
[table from ROADMAP.md]

───────────────────────────────────────────

## ▶ Next Up

**Section 1: [Name]** — [goal]

`/wtfp:plan-section 1`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────

**Also available:**
- `/wtfp:discuss-section 1` — gather context first
- `/wtfp:research-gap 1` — investigate literature needs
- `/wtfp:execute-outline` — write all sections in wave-based parallel execution

</offer_next>

<success_criteria>
- [ ] Outliner agent spawned with full project context
- [ ] 4 artifacts created (outline.md, argument-map.md, narrative-arc.md, ROADMAP.md)
- [ ] STATE.md initialized with correct position
- [ ] Section directories created
- [ ] Word budget totals match target
- [ ] All committed to git
- [ ] User knows next steps
</success_criteria>
