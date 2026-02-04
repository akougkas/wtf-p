---
name: wtfp:write-section
description: Execute a PLAN.md to write section content
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

## 3. Spawn wtfp-section-writer Agent

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

## 4. Handle Writer Return

**`## WRITING COMPLETE`:** Proceed to verification check.

**`## CHECKPOINT REACHED`:** Present to user, get response.

**`## WRITING BLOCKED`:** Show blocker, offer options.

## 5. Goal-Backward Verification (if enabled)

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

## 6. Present Final Status

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
