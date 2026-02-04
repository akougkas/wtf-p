---
name: wtfp:research-gap
description: Comprehensive literature/domain research for a section
argument-hint: "[section]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---

<execution_context>
@~/.claude/write-the-f-paper/references/research-pitfalls.md
</execution_context>

<objective>
Perform comprehensive literature/domain research for a specific section.

**Orchestrator role:** Validate project, scope research with user, resolve model profile, spawn research-synthesizer agent, present results.

Creates RESEARCH.md with "how experts write this" knowledge, key citations, gaps, and positioning.
</objective>

<context>
Section: $ARGUMENTS (section number or name)
</context>

<process>

## 1. Validate Environment and Resolve Model Profile

```bash
[ ! -f .planning/PROJECT.md ] && echo "ERROR: No project. Run /wtfp:new-paper" && exit 1
[ ! -f .planning/ROADMAP.md ] && echo "ERROR: No roadmap. Run /wtfp:create-outline" && exit 1
```

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| research-synthesizer | opus | sonnet | haiku |

## 2. Define Research Scope

Use AskUserQuestion:
- header: "Research Focus"
- question: "What specifically do you need to understand for this section?"
- options:
  - "Key citations" — Who are the must-cite authors/papers?
  - "Methodology" — How do others approach this method?
  - "State of field" — What's the current consensus/debate?
  - "Positioning" — How to differentiate from existing work?

## 3. Read Context Files

```bash
PROJECT_CONTENT=$(cat .planning/PROJECT.md)
ROADMAP_CONTENT=$(cat .planning/ROADMAP.md)
ARGMAP_CONTENT=$(cat .planning/structure/argument-map.md 2>/dev/null)
LITERATURE_CONTENT=$(cat .planning/sources/literature.md 2>/dev/null)
BIB_INDEX=$(node ~/.claude/bin/bib-index.js index references.bib 2>/dev/null || echo "No references.bib")

SECTION_DIR=$(ls -d .planning/sections/${SECTION}-* 2>/dev/null | head -1)
CONTEXT_CONTENT=$(cat "${SECTION_DIR}"/*-CONTEXT.md 2>/dev/null)
```

## 4. Spawn wtfp-research-synthesizer Agent

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► RESEARCHING SECTION {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
Task(
  prompt="First, read ~/.claude/agents/wtfp/research-synthesizer.md for your role and instructions.\n\n" + filled_research_prompt,
  subagent_type="general-purpose",
  model="{researcher_model}",
  description="Research Section {X}"
)
```

Research prompt includes: `<research_scope>` with user-selected scope, `<project_context>` with PROJECT + ROADMAP + argument-map, `<existing_literature>` with bib index and literature.md, `<user_decisions>` with CONTEXT_CONTENT, `<output>` with target RESEARCH.md path.

## 5. Handle Researcher Return

**`## RESEARCH COMPLETE`:** Present findings summary.

**`## RESEARCH BLOCKED`:** Show blocker, offer alternatives.

## 6. Present Results

</process>

<offer_next>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Citations found: {N}
Confidence: {level}

───────────────────────────────────────────

## ▶ Next Up

**Plan section** — create writing plan with research context

`/wtfp:plan-section {section}`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────

</offer_next>

<success_criteria>
- [ ] Research scope defined with user
- [ ] Research-synthesizer spawned with full context
- [ ] RESEARCH.md created with key citations and gaps
- [ ] User knows next steps
</success_criteria>
