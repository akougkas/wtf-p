---
name: wtfp:review-section
description: Review section for citations, coherence, and requirements
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
@~/.claude/write-the-f-paper/workflows/review-section.md
</execution_context>

<objective>
User acceptance testing of written sections with configurable reviewer personas.

**Orchestrator role:** Validate section exists, select persona, resolve model profile, spawn section-reviewer agent, present results.

Runs 3-layer verification:
1. Citation Check (Mechanical)
2. Argument Coherence (Logical)
3. Rubric Check (Requirements)
</objective>

<context>
Section: $ARGUMENTS (section number or path)
</context>

<process>

## 1. Validate Environment and Resolve Model Profile

```bash
ls paper/*.md 2>/dev/null || echo "No content in paper/ directory"
ls .planning/ 2>/dev/null
```

**Resolve model profile:**
```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| section-reviewer | opus | sonnet | haiku |

## 2. Select Reviewer Persona

Use AskUserQuestion:
- header: "Reviewer"
- question: "What type of review do you want?"
- options:
  - "Friendly Mentor" — Balanced, constructive, actionable (Recommended)
  - "Reviewer #2 (Hostile)" — Nitpicky, assumes worst, finds every flaw
  - "Area Chair (Big Picture)" — Strategic focus on contribution and impact
  - "Camera-Ready Editor" — Formatting, style, polish, consistency

## 3. Read Context Files

```bash
SECTION_CONTENT=$(cat paper/*.md 2>/dev/null)
PROJECT_CONTENT=$(cat .planning/PROJECT.md)
ARGMAP_CONTENT=$(cat .planning/structure/argument-map.md 2>/dev/null)
OUTLINE_CONTENT=$(cat .planning/structure/outline.md 2>/dev/null)
SUMMARY_CONTENT=$(cat .planning/sections/*/SUMMARY.md 2>/dev/null | head -200)

SECTION_DIR=$(ls -d .planning/sections/${SECTION}-* 2>/dev/null | head -1)
CONTEXT_CONTENT=$(cat "${SECTION_DIR}"/*-CONTEXT.md 2>/dev/null)
```

## 4. Spawn wtfp-section-reviewer Agent

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► REVIEWING SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
Task(
  prompt="First, read ~/.claude/agents/wtfp/section-reviewer.md for your role and instructions.\n\n" + filled_review_prompt,
  subagent_type="general-purpose",
  model="{reviewer_model}",
  description="Review Section {X}"
)
```

Review prompt includes: `<section_content>` with written text, `<review_persona>` with selected persona, `<project_context>` with PROJECT + argument-map + outline, `<user_decisions>` with CONTEXT_CONTENT.

## 5. Handle Reviewer Return

**`## REVIEW COMPLETE`:** Present results, route to next action.

## 6. Present Results

</process>

<offer_next>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► REVIEW COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[If issues found:]
**Plan revisions** — address identified issues

`/wtfp:plan-revision XX-YY`

[If no issues:]
**Continue** — move to next section

`/wtfp:plan-section [next]`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────

</offer_next>

<success_criteria>
- [ ] Reviewer persona selected
- [ ] Section-reviewer spawned with full context
- [ ] All 3 verification layers executed
- [ ] Issues documented in ISSUES.md
- [ ] Clear next steps provided
</success_criteria>
