---
name: wtfp:plan-section
description: Create detailed writing plan for a section
argument-hint: "[section]"
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
@~/.claude/write-the-f-paper/references/plan-format.md
@~/.claude/write-the-f-paper/references/length-estimation.md
</execution_context>

<objective>
Create executable writing plan with context injection and task breakdown.

**Orchestrator role:** Parse arguments, validate section, load context, resolve model profile, spawn section-planner agent, optionally verify plans with plan-checker, iterate until plans pass, present results.

**Why subagents:** Planning and verification burn context fast. Fresh agents get peak quality. User sees flow between agents in main context.
</objective>

<context>
Section number: $ARGUMENTS (optional - auto-detects next unplanned section if not provided)
</context>

<process>

## 1. Validate Environment and Resolve Model Profile

```bash
ls .planning/ 2>/dev/null
```

**If not found:** Error - user should run `/wtfp:new-paper` first.

**Resolve model profile:**

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| section-planner | opus | opus | sonnet |
| plan-checker | sonnet | sonnet | haiku |

**Resolve gate flag:**
```bash
# Gate: confirm_plan — skip confirmation if false
GATE_CONFIRM_PLAN=$(cat .planning/config.json 2>/dev/null | grep -o '"confirm_plan"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
```

## 1b. Git Branch Setup

```bash
BRANCH_STRATEGY=$(cat .planning/config.json 2>/dev/null | grep -o '"branching_strategy"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "none")
```

**If branching_strategy = "section":**

1. Read section_branch_template from config (default: `wtfp/section-{section}-{slug}`)
2. Replace `{section}` with zero-padded section number (e.g., `01`, `02`)
3. Replace `{slug}` with slugified section name (lowercase, hyphens)
4. Store current branch as base branch for later merge:
   ```bash
   BASE_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
   echo "$BASE_BRANCH" > .planning/.section_base_branch
   ```
5. Create and checkout section branch:
   ```bash
   SECTION_BRANCH_TEMPLATE=$(cat .planning/config.json 2>/dev/null | grep -o '"section_branch_template"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "wtfp/section-{section}-{slug}")
   BRANCH_NAME=$(echo "$SECTION_BRANCH_TEMPLATE" | sed "s/{section}/${SECTION_NUM}/" | sed "s/{slug}/${SECTION_SLUG}/")
   git checkout -b "$BRANCH_NAME"
   ```
6. Log: "Created section branch: $BRANCH_NAME"

**If branching_strategy = "none" or "submission":** No branch action in plan-section.

## 2. Parse and Normalize Arguments

Extract section number from $ARGUMENTS. If no section number, detect next unplanned section from roadmap.

```bash
ls .planning/sections/*/ 2>/dev/null | head -10
```

## 3. Validate Section

```bash
grep -A5 "Section" .planning/ROADMAP.md 2>/dev/null
```

Extract section number, name, description.

## 4. Ensure Section Directory and Load CONTEXT.md

```bash
SECTION_DIR=$(ls -d .planning/sections/${SECTION}-* 2>/dev/null | head -1)
CONTEXT_CONTENT=$(cat "${SECTION_DIR}"/*-CONTEXT.md 2>/dev/null)
```

**CRITICAL:** Store CONTEXT_CONTENT now. Pass to ALL downstream agents.

## 5. Read Context Files

```bash
STATE_CONTENT=$(cat .planning/STATE.md)
ROADMAP_CONTENT=$(cat .planning/ROADMAP.md)
PROJECT_CONTENT=$(cat .planning/PROJECT.md)
ARGMAP_CONTENT=$(cat .planning/structure/argument-map.md 2>/dev/null)
OUTLINE_CONTENT=$(cat .planning/structure/outline.md 2>/dev/null)
RESEARCH_CONTENT=$(cat "${SECTION_DIR}"/*-RESEARCH.md 2>/dev/null)
PRIOR_SUMMARIES=$(cat .planning/sections/*/SUMMARY.md 2>/dev/null | head -200)
```

If RESEARCH.md missing for a literature-heavy section, suggest `/wtfp:research-gap` first.

## 6. Gate Check: Confirm Before Planning

**If GATE_CONFIRM_PLAN is "true" (default):**
Present section context summary to user via AskUserQuestion and wait for confirmation before proceeding.

**If GATE_CONFIRM_PLAN is "false":**
Skip confirmation and proceed directly to planning.

## 7. Spawn wtfp-section-planner Agent

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► PLANNING SECTION {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Fill prompt with inlined content and spawn:

```
Task(
  prompt="First, read ~/.claude/agents/wtfp/section-planner.md for your role and instructions.\n\n" + filled_planning_prompt,
  subagent_type="general-purpose",
  model="{planner_model}",
  description="Plan Section {X}"
)
```

Planning prompt includes: `<planning_context>` with STATE, ROADMAP, PROJECT, argument-map, outline, RESEARCH, prior summaries. `<user_decisions>` with CONTEXT_CONTENT. `<output>` with target directory path.

## 8. Handle Planner Return

**`## PLANNING COMPLETE`:** Display plan count, proceed to verification check.

**`## CHECKPOINT REACHED`:** Present to user, get response.

**`## PLANNING INCONCLUSIVE`:** Show what was attempted, offer options.

## 8. Plan-Check-Revise Loop (if enabled)

```bash
WORKFLOW_PLAN_CHECK=$(cat .planning/config.json 2>/dev/null | grep -o '"plan_check"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
```

**If plan_check is true:**

Read plans for checker:
```bash
PLANS_CONTENT=$(cat "${SECTION_DIR}"/*-PLAN.md 2>/dev/null)
```

Spawn `wtfp-plan-checker` with plans + ROADMAP + argument-map + CONTEXT.

**If VERIFICATION PASSED:** Proceed to done.

**If ISSUES FOUND and iteration < 3:** Spawn planner in revision mode with issues. Re-check. Increment iteration.

**If iteration >= 3:** Present remaining issues to user with options: force proceed, provide guidance, abandon.

## 9. Present Final Status

</process>

<offer_next>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► SECTION {X} PLANNED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Section {X}: {Name}** — {N} plan(s), {W} words target

Verification: {Passed | Passed with override | Skipped}

───────────────────────────────────────────

## ▶ Next Up

**Execute writing** — run the plan

`/wtfp:write-section .planning/sections/XX-name/XX-YY-PLAN.md`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────

</offer_next>

<success_criteria>
- [ ] .planning/ directory validated
- [ ] Section validated against roadmap
- [ ] CONTEXT.md loaded early and passed to ALL agents
- [ ] RESEARCH.md auto-loaded if exists
- [ ] Section-planner spawned with full context
- [ ] Plans created (PLANNING COMPLETE or CHECKPOINT handled)
- [ ] Plan-checker spawned (if workflow.plan_check enabled)
- [ ] Verification passed OR user override OR max iterations
- [ ] User knows next steps
</success_criteria>
