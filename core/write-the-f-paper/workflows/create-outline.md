<purpose>
Define the sections of the document. Each section is a coherent chunk of writing
that delivers part of the argument. The outline provides structure, not detailed prose.
</purpose>

<required_reading>
**Read these files NOW:**

1. ~/.claude/write-the-f-paper/templates/roadmap.md
2. ~/.claude/write-the-f-paper/templates/state.md
3. Read `.planning/PROJECT.md` if it exists
</required_reading>

<process>

<step name="check_brief">
```bash
cat .planning/PROJECT.md 2>/dev/null || echo "No brief found"
```

**If no brief exists:**
Ask: "No project brief found. Want to create one first, or proceed with outline?"

If proceeding without brief, gather quick context:

- What type of document? (journal paper, conference paper, grant proposal)
- What's the core argument/thesis?
- Target venue and constraints (page limit, format)?
</step>

<step name="detect_document_type">
Infer document type from the brief/user request:

| Keywords | Document Type | Section Template |
| -------- | ------------- | ---------------- |
| "journal", "paper", "article", "manuscript" | IMRaD Paper | intro, methods, results, discussion |
| "conference", "short paper", "workshop" | Conference Paper | intro, background, approach, evaluation, conclusion |
| "grant", "proposal", "NSF", "NIH", "funding" | Grant Proposal | aims, significance, innovation, approach, timeline |
| "thesis", "dissertation", "chapter" | Thesis Chapter | varies by field |
| "review", "survey", "literature review" | Review Paper | intro, methodology, findings, synthesis |

**Present detection:**
```
Detected: [document type] → [section template]
Use this structure? (Y / customize / show options)
```

**If multiple types apply:**
```
Detected multiple possible types:
- IMRaD Paper (research focus)
- Conference Paper (shorter format)

Select type (or describe):
```

**Store selected template** for section generation.
</step>

<step name="identify_sections">
Derive sections from the document type and content needs.

**Check depth setting:**
```bash
cat .planning/config.json 2>/dev/null | grep depth
```

<depth_guidance>
**Depth controls granularity, not artificial inflation.**

| Depth | Typical Sections | Typical Plans/Section | Writing Tasks/Plan |
|-------|-----------------|----------------------|-------------------|
| Quick | 4-6 | 1-2 | 2-3 |
| Standard | 6-10 | 2-4 | 2-3 |
| Comprehensive | 8-15 | 3-6 | 2-3 |

**Key principle:** Derive sections from document requirements. Depth determines how you break down complex sections, not a target to hit.

- Comprehensive Methods section = 4 plans (because methods genuinely has 4 subsections)
- Comprehensive Abstract = 1 plan (because that's all it is)

For comprehensive depth:
- Don't compress multiple arguments into single sections
- Each major contribution gets proper space
- Let small sections stay small—don't pad to hit a number

For quick depth:
- Combine related content aggressively
- Focus on critical argument path
- Defer nice-to-haves to revision phases
</depth_guidance>

**Section Numbering System:**

Use integer sections (1, 2, 3) for planned document structure.

Use decimal sections (2.1, 2.2) for urgent insertions:
- Decimal sections inserted between integers
- Mark with "(INSERTED)" in section title
- Created when critical content discovered after planning
- Examples: addressing reviewer comments, adding missing analysis

**Deriving sections:**

1. List all required sections for document type
2. Group related arguments into coherent sections
3. Each section should deliver ONE complete part of the argument
4. If a section covers unrelated points: split it
5. If a section can't stand alone as a unit: merge it
6. Order by logical flow (setup → method → findings → meaning)

Good sections are:
- **Coherent**: Each delivers one complete argumentative unit
- **Sequential**: Later sections build on earlier
- **Self-contained**: Can be verified and understood on its own

Common section patterns by document type:

**IMRaD Paper:**
- Abstract → Introduction → Methods → Results → Discussion → Conclusion

**Conference Paper:**
- Abstract → Introduction → Background → Approach → Evaluation → Discussion → Conclusion

**Grant Proposal:**
- Specific Aims → Significance → Innovation → Approach → Timeline → Budget
</step>

<step name="detect_research_needs">
**For each section, determine if literature research is likely needed.**

Scan the brief and section descriptions for research triggers:

<research_triggers>
**Likely (flag the section):**

| Trigger Pattern | Why Research Needed |
| --------------- | ------------------- |
| "literature review", "related work", "background" | Core purpose is citing prior work |
| "compare to", "differs from", "unlike" | Need to accurately represent prior work |
| "builds on", "extends", "improves" | Need to understand what's being extended |
| "controversial", "debated", "contested" | Need to represent multiple perspectives |
| "recent advances", "state of the art", "current" | Need up-to-date literature |
| "methodology borrowed from" | Need to cite and accurately describe |
| Any claim requiring external evidence | Need sources to support |

**Unlikely (no flag needed):**

| Pattern | Why No Research |
| ------- | --------------- |
| "describe our method", "our approach" | Reporting own work |
| "results show", "we found" | Presenting own findings |
| "data collected", "analysis performed" | Describing own process |
| "limitations of our study" | Self-reflection on own work |

</research_triggers>

**For each section, assign:**
- `Research: Likely ([reason])` + `Research topics: [what to investigate]`
- `Research: Unlikely ([reason])`

Present research assessment:

```
Research needs detected:

Section 1: Introduction
  Research: Likely (establishing gap requires citing prior work)
  Topics: Prior approaches to [problem], their limitations

Section 2: Methods
  Research: Unlikely (describing own methodology)

Section 3: Related Work
  Research: Likely (core purpose)
  Topics: [theme 1], [theme 2], contrasting approaches

Section 4: Results
  Research: Unlikely (presenting own findings)

Section 5: Discussion
  Research: Likely (interpreting findings in context of literature)
  Topics: How findings relate to prior work

Does this look right? (yes / adjust)
```
</step>

<step name="confirm_sections">
<config-check>
```bash
cat .planning/config.json 2>/dev/null
```
Note: Config may not exist yet (project initialization). If missing, default to interactive mode.
</config-check>

<if mode="yolo">
```
Auto-approved: Section breakdown ([N] sections)

1. [Section name] - [goal]
2. [Section name] - [goal]
3. [Section name] - [goal]

Proceeding to research detection...
```

Proceed directly to detect_research_needs step.
</if>

<if mode="interactive" OR="missing OR custom with gates.confirm_sections true">
Present the section breakdown inline:

"Here's how I'd structure this document:

1. [Section name] - [goal]
2. [Section name] - [goal]
3. [Section name] - [goal]
   ...

Does this feel right? (yes / adjust)"

If "adjust": Ask what to change, revise, present again.
</step>

<step name="decision_gate">
<if mode="yolo">
```
Auto-approved: Create outline with [N] sections

Proceeding to create .planning/ROADMAP.md...
```

Proceed directly to create_structure step.
</if>

<if mode="interactive" OR="missing OR custom with gates.confirm_roadmap true">
Use AskUserQuestion:

- header: "Ready"
- question: "Ready to create the document outline, or would you like me to ask more questions?"
- options:
  - "Create outline" - I have enough context
  - "Ask more questions" - There are details to clarify
  - "Let me add context" - I want to provide more information

Loop until "Create outline" selected.
</step>

<step name="create_structure">
```bash
mkdir -p .planning/sections
```
</step>

<step name="write_roadmap">
Use template from `~/.claude/write-the-f-paper/templates/roadmap.md`.

Initial outlines use integer sections (1, 2, 3...).
Decimal sections added later via /wtfp:insert-section command.

Write to `.planning/ROADMAP.md` with:

- Document Type section (IMRaD, Grant, etc.)
- Section list with names and one-line goals
- Word budget per section
- Dependencies (what must complete before what)
- **Research flags** (from detect_research_needs step):
  - `Research: Likely ([reason])` with `Research topics:` for flagged sections
  - `Research: Unlikely ([reason])` for unflagged sections
- Status tracking (all start as "not started")

Create section directories:

```bash
mkdir -p .planning/sections/01-{section-name}
mkdir -p .planning/sections/02-{section-name}
# etc.
```
</step>

<step name="initialize_project_state">

Create STATE.md — the project's living memory.

Use template from `~/.claude/write-the-f-paper/templates/state.md`.

Write to `.planning/STATE.md`:

```markdown
# Project State

## Project Reference

See: .planning/PROJECT.md (updated [today's date])

**Core argument:** [Copy thesis/core claim from PROJECT.md]
**Current focus:** Section 1 — [First section name]

## Current Position

Section: 1 of [N] ([First section name])
Plan: Not started
Status: Ready to plan
Last activity: [today's date] — Document initialized

Progress: ░░░░░░░░░░ 0%

## Word Count

Target: [total target] words
Current: 0 words
Remaining: [total target] words

## Section Progress

| Section | Status | Words | Target | Strength |
|---------|--------|-------|--------|----------|
| 1. [Name] | - | 0 | [target] | - |
| 2. [Name] | - | 0 | [target] | - |

## Argument Strength

Core claim: developing
Evidence gaps: [initial assessment]
Logic flow: not yet established

## Open Questions

(None yet)

## Deferred

(None yet)

## Session Continuity

Last session: [today's date and time]
Stopped at: Document initialization complete
Resume file: None
```

**Key points:**
- Project Reference points to PROJECT.md for full context
- Claude reads PROJECT.md directly for thesis, constraints, decisions
- This file will be read first in every future operation
- This file will be updated after every writing session

</step>

<step name="create_structure_files">
Create the three structure layers for the document:

**argument-map.md** - Logical structure of the argument
```bash
mkdir -p .planning/structure
```

Use template from `~/.claude/write-the-f-paper/templates/project-context/argument-structure.md`

Write initial skeleton based on thesis and sections identified.

**outline.md** - Section skeleton with word budgets

Already created as ROADMAP.md, but create detailed outline.md if needed.

**narrative-arc.md** - Story structure

Create using narrative-arc.md template from project-context/.
</step>

<step name="git_commit_initialization">
Commit project initialization (brief + roadmap + state together):

```bash
git add .planning/PROJECT.md .planning/ROADMAP.md .planning/STATE.md
git add .planning/sections/
git add .planning/structure/
# config.json if exists
git add .planning/config.json 2>/dev/null
git commit -m "$(cat <<'EOF'
docs: initialize [document-title] ([N] sections)

[One-liner thesis/purpose from PROJECT.md]

Sections:
1. [section-name]: [goal]
2. [section-name]: [goal]
3. [section-name]: [goal]
EOF
)"
```

Confirm: "Committed: docs: initialize [document] ([N] sections)"
</step>

<step name="offer_next">
```
Document initialized:
- Brief: .planning/PROJECT.md
- Outline: .planning/ROADMAP.md
- State: .planning/STATE.md
- Structure: .planning/structure/
- Committed as: docs: initialize [document] ([N] sections)

---

## Next Up

**Section 1: [Name]** — [Goal from ROADMAP.md]

`/wtfp:plan-section 1`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/wtfp:discuss-section 1` — gather context first
- `/wtfp:research-gap [topic]` — investigate literature
- Review outline

---
```
</step>

</process>

<section_naming>
Use `XX-kebab-case-name` format:
- `01-abstract`
- `02-introduction`
- `03-methods`
- `04-results`
- `05-discussion`

Numbers ensure ordering. Names describe content.
</section_naming>

<anti_patterns>
- Don't add time estimates
- Don't create Gantt charts
- Don't add word count goals per day
- Don't include revision matrices upfront
- Don't impose arbitrary section counts (let the document type determine the count)

Sections are structural units of the argument, not project management artifacts.
</anti_patterns>

<success_criteria>
Outline is complete when:
- [ ] `.planning/ROADMAP.md` exists
- [ ] `.planning/STATE.md` exists (project memory initialized)
- [ ] `.planning/structure/` exists with argument-map.md, narrative-arc.md
- [ ] Sections defined with clear goals (count derived from document type, not imposed)
- [ ] **Research flags assigned** (Likely/Unlikely for each section)
- [ ] **Research topics listed** for Likely sections
- [ ] Word budgets assigned per section
- [ ] Section directories created
- [ ] Dependencies noted if any
- [ ] Status tracking in place
</success_criteria>
