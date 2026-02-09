---
name: wtfp:research-gap
description: Research literature and domain knowledge for a section
argument-hint: "[section] [--depth=quick|standard|deep]"
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

## 1b. Parse Depth Flag

Parse --depth from $ARGUMENTS:

```bash
# Extract depth from arguments (--depth=quick, --depth=standard, or --depth=deep)
DEPTH_ARG=$(echo "$ARGUMENTS" | grep -oE '\-\-depth=(quick|standard|deep)' | cut -d= -f2)

# If no --depth flag, read default from config
if [ -z "$DEPTH_ARG" ]; then
  DEPTH=$(cat .planning/config.json 2>/dev/null | grep -o '"depth"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "standard")
else
  DEPTH="$DEPTH_ARG"
fi
```

**Depth mapping:**

| Depth | Behavior |
|-------|----------|
| quick | Quick verbal summary - no RESEARCH.md created, no git commit |
| standard | Standard research (current behavior) - 10-20 sources, RESEARCH.md created |
| deep | Exhaustive literature review - 20-50 papers, all categories mandatory |

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

## 3b. Quick Depth: Verbal Summary Only

**If DEPTH is "quick":**

Skip agent spawn entirely. Orchestrator provides direct verbal synthesis.

Read available context (PROJECT.md, argument-map, existing literature, CONTEXT_CONTENT) and synthesize a verbal summary directly to user:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► QUICK RESEARCH SYNTHESIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Based on available context for Section {X}:

[Synthesize key points from PROJECT, argument-map, and any existing literature.md]

Key areas:
- [Area 1]: [Brief synthesis]
- [Area 2]: [Brief synthesis]

Suggested citations to consider:
- [If any mentioned in existing sources]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Note:** Quick research -- no RESEARCH.md written. Run with `--depth=standard` for persistent research.
```

No RESEARCH.md created. No git commit. Present summary and offer next steps, then exit workflow.

**If DEPTH is "standard" or "deep":** Continue to Step 4.

## 4. Spawn wtfp-research-synthesizer Agent (standard/deep)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► RESEARCHING SECTION {X} (depth: {DEPTH})
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

Research prompt includes: `<research_scope>` with user-selected scope, `<project_context>` with PROJECT + ROADMAP + argument-map, `<existing_literature>` with bib index and literature.md, `<user_decisions>` with CONTEXT_CONTENT, `<output>` with target RESEARCH.md path, `<depth>` with current depth setting.

**Depth-specific instructions in prompt:**

**If DEPTH is "standard":**
Add `<depth_instruction>Target 10-20 relevant sources across categories. Focus on most impactful papers for each category.</depth_instruction>`

**If DEPTH is "deep":**
Add `<depth_instruction>Perform exhaustive literature review. Target 20-50 papers across all categories. Include systematic field mapping: major research groups, funding bodies, key venues, citation networks. Map the intellectual lineage of the field. Identify ALL competing approaches, not just the main ones. Document methodology variations comprehensively. All 5 categories (foundational, recent, competing, gap, methods) are REQUIRED, not optional.</depth_instruction>`

**Source priority hierarchy (all depths):**
Add `<source_priority>Source priority: Context7 MCP first (if available), official sources/databases second (Google Scholar, PubMed, IEEE, ACL, arXiv), WebSearch last.</source_priority>`

## 5. Handle Researcher Return

**`## RESEARCH COMPLETE`:** Present findings summary.

**`## RESEARCH BLOCKED`:** Show blocker, offer alternatives.

## 6. Present Results

</process>

<offer_next>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Depth: {DEPTH}
Citations found: {N}
Confidence: {level}

───────────────────────────────────────────

## ▶ Next Up

**Plan section** — create writing plan with research context

`/wtfp:plan-section {section}`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────

</offer_next>

<offer_next_quick>

**For quick depth only (no RESEARCH.md written):**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► QUICK RESEARCH COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quick research -- no RESEARCH.md written. Run with `--depth=standard` for persistent research.

───────────────────────────────────────────

## ▶ Next Up

**Plan section** — proceed without literature doc

`/wtfp:plan-section {section}`

**Or deepen research:**

`/wtfp:research-gap {section} --depth=standard`

───────────────────────────────────────────

</offer_next_quick>

<success_criteria>
- [ ] Research scope defined with user
- [ ] Research-synthesizer spawned with full context
- [ ] RESEARCH.md created with key citations and gaps
- [ ] User knows next steps
</success_criteria>
