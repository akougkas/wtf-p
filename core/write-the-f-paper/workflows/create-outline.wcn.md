<purpose>
Define document sections. Each section = coherent chunk delivering part of argument.
Outline provides structure, not detailed prose.
</purpose>

<required_reading>
READ: ~/.claude/write-the-f-paper/templates/roadmap.md
READ: ~/.claude/write-the-f-paper/templates/state.md
READ: .planning/PROJECT.md (if exists)
</required_reading>

<process>

[step:check_brief p=1]
RUN: cat .planning/PROJECT.md 2>/dev/null || echo "No brief found"
IF no_brief → ASK: "No project brief found. Create one first, or proceed?"
IF proceed_without → gather: doc_type, core_argument, target_venue, constraints
[/step]

[step:detect_document_type]
Infer from brief/user request:

DOCTYPE{keywords → type → sections}:
  journal/paper/article → IMRaD | intro, methods, results, discussion
  conference/short/workshop → Conference | intro, background, approach, eval, conclusion
  grant/proposal/NSF/NIH → Grant | aims, significance, innovation, approach, timeline
  thesis/dissertation → Thesis | varies by field
  review/survey/lit → Review | intro, methodology, findings, synthesis

EMIT: "Detected: [type] → [sections]. Use this? (Y/customize/show options)"
IF multiple_types → present options, ask user to select
STORE: selected_template
[/step]

[step:identify_sections]
RUN: cat .planning/config.json 2>/dev/null | grep depth

DEPTH{level,sections,plans_per,tasks_per}:
  quick | 4-6 | 1-2 | 2-3
  standard | 6-10 | 2-4 | 2-3
  comprehensive | 8-15 | 3-6 | 2-3

PRINCIPLE: Derive sections from doc requirements. Depth = how to break down complex sections, NOT a target.
- Comprehensive Methods = 4 plans (methods has 4 subsections)
- Comprehensive Abstract = 1 plan (that's all it is)
- Let small sections stay small—don't pad

SECTION_NUMBERING:
  integers (1,2,3) = planned structure
  decimals (2.1,2.2) = urgent insertions between integers

SECTION_RULES:
  1. List all required sections for doc type
  2. Group related arguments into coherent sections
  3. Each section delivers ONE complete argument part
  4. If covers unrelated points → split
  5. If can't stand alone → merge
  6. Order: setup → method → findings → meaning

GOOD_SECTIONS: coherent (one unit), sequential (builds), self-contained (verifiable alone)
[/step]

[step:detect_research_needs]
For each section, assess if literature research needed:

RESEARCH_LIKELY{trigger → reason}:
  lit_review/related_work/background → core purpose is citing
  compare_to/differs_from/unlike → need to represent prior work
  builds_on/extends/improves → need to understand what's extended
  controversial/debated/contested → need multiple perspectives
  recent_advances/state_of_art → need up-to-date literature
  methodology_borrowed_from → need to cite and describe

RESEARCH_UNLIKELY{pattern → reason}:
  describe_our_method/our_approach → reporting own work
  results_show/we_found → presenting own findings
  data_collected/analysis_performed → describing own process
  limitations_of_our_study → self-reflection

ASSIGN: per section "Research: Likely ([reason]) + Topics: [what]" OR "Research: Unlikely ([reason])"
EMIT: research assessment table, ASK: "Does this look right? (yes/adjust)"
[/step]

[step:confirm_sections]
RUN: cat .planning/config.json 2>/dev/null
IF mode=yolo → EMIT "Auto-approved: [N] sections" → proceed
IF mode=interactive|missing → present breakdown, ASK: "Does this feel right? (yes/adjust)"
IF adjust → revise, present again
[/step]

[step:decision_gate]
IF mode=yolo → EMIT "Auto-approved: Create outline" → proceed
IF mode=interactive|missing → ASK: "Ready to create outline, or ask more questions?"
  OPTIONS: Create outline | Ask more questions | Let me add context
LOOP until "Create outline" selected
[/step]

[step:create_structure]
RUN: mkdir -p .planning/sections
[/step]

[step:write_roadmap]
READ: ~/.claude/write-the-f-paper/templates/roadmap.md
WRITE: .planning/ROADMAP.md

INCLUDE:
- Document Type section
- Section list with names + one-line goals
- Word budget per section
- Dependencies (what before what)
- Research flags from detect_research_needs
- Status tracking (all "not started")

RUN: mkdir -p .planning/sections/01-{section-name}
RUN: mkdir -p .planning/sections/02-{section-name}
[/step]

[step:initialize_project_state]
READ: ~/.claude/write-the-f-paper/templates/state.md
WRITE: .planning/STATE.md

STATE_FIELDS:
- Project Reference → points to PROJECT.md
- Core argument → copy thesis from PROJECT.md
- Current Position → Section 1, Plan not started
- Word Count → target vs current (0)
- Section Progress → table with status/words/target/strength
- Argument Strength → "developing"
- Open Questions → (none yet)
- Deferred → (none yet)
- Session Continuity → timestamp + resume info
[/step]

[step:create_structure_files]
RUN: mkdir -p .planning/structure

WRITE: .planning/structure/argument-map.md
  USE: ~/.claude/write-the-f-paper/templates/project-context/argument-structure.md
  FILL: skeleton based on thesis + sections

WRITE: .planning/structure/narrative-arc.md
  USE: ~/.claude/write-the-f-paper/templates/project-context/narrative-arc.md
[/step]

[step:git_commit]
RUN: git add .planning/PROJECT.md .planning/ROADMAP.md .planning/STATE.md .planning/sections/ .planning/structure/
RUN: git add .planning/config.json 2>/dev/null
COMMIT: "docs: initialize [title] ([N] sections)"
EMIT: "Committed: docs: initialize [document] ([N] sections)"
[/step]

[step:offer_next]
EMIT:
  Document initialized:
  - Brief: .planning/PROJECT.md
  - Outline: .planning/ROADMAP.md
  - State: .planning/STATE.md
  - Structure: .planning/structure/

  Next: Section 1: [Name] — [Goal]
  → /wtfp:plan-section 1

  Also: /wtfp:discuss-section 1, /wtfp:research-gap [topic]
[/step]

</process>

<section_naming>
Format: XX-kebab-case-name
Examples: 01-abstract, 02-introduction, 03-methods
Numbers ensure ordering. Names describe content.
</section_naming>

<anti_patterns>
- No time estimates
- No Gantt charts
- No word count goals per day
- No revision matrices upfront
- No arbitrary section counts (let doc type determine)
Sections = structural units of argument, not project management artifacts.
</anti_patterns>

<success_criteria>
- [ ] .planning/ROADMAP.md exists
- [ ] .planning/STATE.md exists
- [ ] .planning/structure/ with argument-map.md, narrative-arc.md
- [ ] Sections defined with clear goals (count from doc type)
- [ ] Research flags assigned (Likely/Unlikely per section)
- [ ] Research topics listed for Likely sections
- [ ] Word budgets assigned
- [ ] Section directories created
- [ ] Dependencies noted
- [ ] Status tracking in place
</success_criteria>
