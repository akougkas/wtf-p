---
name: wtfp:write-section
description: Write a section by executing its plan
argument-hint: "[path-to-PLAN.md]"
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

<execution_context>
@~/.claude/write-the-f-paper/workflows/execute-section.md
@~/.claude/write-the-f-paper/references/git-integration.md
</execution_context>

<objective>
Execute a PLAN.md file to write section content.

**Orchestrator role:** Validate plan, resolve model profile, read context files, spawn section-writer agent, optionally run argument-verifier post-write, route based on verification, present results.

**Why subagents:** Writing burns context fast. Fresh agent gets peak prose quality. Verification in fresh context catches what writer missed.
</objective>

<context>
Plan path: $ARGUMENTS (path to a PLAN.md file)
</context>

<process>

## 1. Validate Environment and Resolve Model Profile

```bash
[ ! -f "$ARGUMENTS" ] && echo "ERROR: Plan not found at $ARGUMENTS" && exit 1
ls .planning/ 2>/dev/null
```

**Resolve model profile:**
```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| section-writer | opus | sonnet | sonnet |
| argument-verifier | sonnet | sonnet | haiku |

**Resolve gate and safety flags:**
```bash
# Gate: confirm_write — skip confirmation if false
GATE_CONFIRM_WRITE=$(cat .planning/config.json 2>/dev/null | grep -o '"confirm_write"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")

# Safety: always_confirm_destructive — force confirmation for destructive ops
SAFETY_DESTRUCTIVE=$(cat .planning/config.json 2>/dev/null | grep -o '"always_confirm_destructive"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
```

Check for existing SUMMARY.md:
```bash
SUMMARY_PATH="${ARGUMENTS/PLAN.md/SUMMARY.md}"
[ -f "$SUMMARY_PATH" ] && echo "WARNING: SUMMARY.md exists. Re-executing will overwrite."
```

## 2. Read Context Files

```bash
PLAN_CONTENT=$(cat "$ARGUMENTS")
STATE_CONTENT=$(cat .planning/STATE.md)
PROJECT_CONTENT=$(cat .planning/PROJECT.md)
ARGMAP_CONTENT=$(cat .planning/structure/argument-map.md 2>/dev/null)

# Derive section dir from plan path
SECTION_DIR=$(dirname "$ARGUMENTS")
CONTEXT_CONTENT=$(cat "${SECTION_DIR}"/*-CONTEXT.md 2>/dev/null)
PRIOR_CONTENT=$(cat paper/*.md 2>/dev/null | head -500)
```

## 3. Gate Check: Confirm Before Writing

**If GATE_CONFIRM_WRITE is "true" (default) OR SAFETY_DESTRUCTIVE is "true" and SUMMARY.md exists (re-execution is destructive):**
Present plan summary to user via AskUserQuestion and wait for confirmation before proceeding.

**If GATE_CONFIRM_WRITE is "false" AND (SAFETY_DESTRUCTIVE is "false" OR no existing SUMMARY.md):**
Skip confirmation and proceed directly to writing.

## 4. Spawn wtfp-section-writer Agent

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► WRITING SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Fill prompt with inlined content and spawn:

```
Task(
  prompt="First, read ~/.claude/agents/wtfp/section-writer.md for your role and instructions.\n\n" + filled_writing_prompt,
  subagent_type="general-purpose",
  model="{writer_model}",
  description="Write Section {X}"
)
```

Writing prompt includes: `<plan>` with full PLAN.md content, `<project_context>` with PROJECT + STATE + argument-map, `<user_decisions>` with CONTEXT_CONTENT, `<prior_content>` with existing paper content for continuity.

## 5. Handle Writer Return

**`## WRITING COMPLETE`:** Proceed to verification check.

**`## CHECKPOINT REACHED`:** Present to user, get response.

**`## WRITING BLOCKED`:** Show blocker, offer options.

## 6. Goal-Backward Verification (if enabled)

```bash
WORKFLOW_VERIFIER=$(cat .planning/config.json 2>/dev/null | grep -o '"verifier"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
```

**If verifier is true:**

```bash
WRITTEN_CONTENT=$(cat paper/*.md 2>/dev/null)
```

Spawn `wtfp-argument-verifier` with written content + PLAN goals + argument-map.

**If VERIFIED:** Proceed to done.

**If GAPS_FOUND:** Present gaps to user. Options: fix now, accept, plan revision.

**If HUMAN_NEEDED:** Present what needs human review.

## 6b. Commit with commit_docs Guard

Before any git commit, check commit_docs setting:

```bash
COMMIT_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
```

**If commit_docs = "false":**
- Skip `git add` for any `.planning/` paths
- Only commit paper content files (e.g., `paper/*.md`)
- Log: "Skipping planning docs commit (commit_docs: false)"

**If commit_docs = "true" (default):**
- Include `.planning/` files in commits as normal

## 7. Git Branch Merge (if section branch strategy)

```bash
BRANCH_STRATEGY=$(cat .planning/config.json 2>/dev/null | grep -o '"branching_strategy"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "none")
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)
```

**If branching_strategy = "section" AND current branch matches `wtfp/section-*`:**

1. Read squash_on_merge setting:
   ```bash
   SQUASH=$(cat .planning/config.json 2>/dev/null | grep -o '"squash_on_merge"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "false")
   ```

2. Read base branch stored during plan-section:
   ```bash
   BASE_BRANCH=$(cat .planning/.section_base_branch 2>/dev/null || echo "main")
   ```

3. Perform merge based on squash setting:

   **If squash=true:**
   ```bash
   git checkout "$BASE_BRANCH"
   git merge --squash "$CURRENT_BRANCH"
   git commit -m "write(${SECTION}): complete ${SECTION_NAME}"
   ```

   **If squash=false:**
   ```bash
   git checkout "$BASE_BRANCH"
   git merge "$CURRENT_BRANCH" --no-ff -m "merge: section ${SECTION} complete"
   ```

4. Delete section branch:
   ```bash
   git branch -d "$CURRENT_BRANCH"
   rm -f .planning/.section_base_branch
   ```

5. Log: "Merged section branch: $CURRENT_BRANCH -> $BASE_BRANCH"

**If branching_strategy = "none" or "submission":** No merge action.

## 8. Present Final Status

</process>

<offer_next>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► SECTION WRITTEN ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**{Section Name}** — {W} words, mode: {mode}

Verification: {Verified | Gaps found | Skipped}

───────────────────────────────────────────

## ▶ Next Up

**Review section** — run verification

`/wtfp:review-section {section}`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────

</offer_next>

<success_criteria>
- [ ] Plan validated and loaded
- [ ] Section-writer spawned with full context
- [ ] Content written to paper/ directory
- [ ] SUMMARY.md created
- [ ] STATE.md updated
- [ ] Argument-verifier spawned (if workflow.verifier enabled)
- [ ] Verification result handled
- [ ] User knows next steps
</success_criteria>
