<decimal_section_numbering>
integers (1,2,3) = planned structure
decimals (2.1,2.2) = urgent insertions between integers
Dir format: 02.1-description/, Plan format: 02.1-01-PLAN.md
Validation: X exists+complete, X+1 exists, X.Y doesn't exist, Y >= 1
</decimal_section_numbering>

<required_reading>
READ: ~/.claude/write-the-f-paper/templates/section-prompt.md
READ: ~/.claude/write-the-f-paper/references/plan-format.md
READ: ~/.claude/write-the-f-paper/references/verification-layers.md
READ: .planning/ROADMAP.md
READ: .planning/PROJECT.md
LOAD: .planning/structure/argument-map.md, outline.md, narrative-arc.md
</required_reading>

<purpose>
Create executable section prompt (PLAN.md). PLAN.md IS the prompt Claude executes - not a doc that gets transformed.
</purpose>

<planning_principles>
Argument-first: Every paragraph serves core argument. Plan prose that advances thesis, not filler.
Evidence-grounded: Plan where citations go before writing. Claims need sources identified.
Reader-aware: Plan for target audience. Technical depth, assumed knowledge, explanation level.
</planning_principles>

<process>

[step:load_project_state p=1]
READ: .planning/STATE.md
PARSE: current_position, accumulated_decisions, open_questions, argument_strength
IF missing+.planning_exists → OFFER reconstruct|continue
[/step]

[step:load_structure_context]
RUN: ls .planning/structure/*.md 2>/dev/null

STRUCTURE_LOAD{section_type → files}:
  introduction → argument-map.md, narrative-arc.md
  methods → argument-map.md (claims needing methodological support)
  results → argument-map.md (claims supported here)
  discussion → argument-map.md, narrative-arc.md
  related_work → argument-map.md (positioning), literature.md
  abstract → all (summary of everything)

TRACK: extracted context for PLAN.md
[/step]

[step:identify_section]
RUN: cat .planning/ROADMAP.md
RUN: ls .planning/sections/
IF multiple_available → ASK which to plan
IF obvious → proceed with first incomplete
REGEX: ^(\d+)(?:\.(\d+))?$ → Group1: integer, Group2: decimal
IF decimal → validate: X complete, X+1 exists, X.Y doesn't exist, Y >= 1
READ: existing PLAN.md or RESEARCH.md in section dir
[/step]

[step:mandatory_literature_check]
MANDATORY for sections flagged Research: Likely

LIT_LEVEL{level,desc,action}:
  0-skip | internal content only, no external evidence | skip
  1-quick | single source verify, 2-5 min | quick check, no RESEARCH.md
  2-standard | multiple sources, positioning, 15-30 min | /wtfp:research-gap → RESEARCH.md
  3-deep | core lit review, theoretical framework, 1+ hr | /wtfp:research-gap depth=deep → full RESEARCH.md

IF roadmap=Research:Likely → Level 0 not available
[/step]

[step:read_prior_sections]
RUN: for f in .planning/sections/*/*-SUMMARY.md; do sed -n '1,/^---$/p' "$f" | head -30; done
PARSE: section, subsection, key-claims, evidence-used, decisions

BUILD context:
- Check logical flow (what claims does this section build on?)
- Check evidence used (what sources already cited?)
- Check decisions (stylistic/structural constraints?)

AUTO-SELECT sections matching:
- Immediate prior section
- Same argumentative thread
- Mentioned in STATE.md as affecting current

EXTRACT from selected:
- Claims established
- Evidence cited (avoid over-citation)
- Patterns established (style, terminology)
- Decisions

ANSWER before proceeding:
Q1: What claims from previous sections does this build on?
Q2: What sources already cited might be relevant?
Q3: What writing patterns to maintain?
Q4: Does roadmap goal still make sense given context?
[/step]

[step:gather_section_context]
UNDERSTAND: section_goal, word_budget, existing_drafts, dependencies_met

RUN: cat .planning/sections/XX-name/${SECTION}-RESEARCH.md 2>/dev/null
RUN: cat .planning/sections/XX-name/${SECTION}-CONTEXT.md 2>/dev/null
RUN: cat .planning/sources/prior-drafts.md 2>/dev/null

IF RESEARCH.md → USE: sources (cite), key_findings (incorporate), gaps (address), positioning
IF CONTEXT.md → HONOR: vision, essential content, boundaries, user specifics
IF neither → SUGGEST: /wtfp:research-gap (lit-heavy) or /wtfp:discuss-section (simpler)
[/step]

[step:break_into_tasks]
Decompose section into writing tasks.

TASK_FIELDS:
- Type: auto | checkpoint:human-verify | checkpoint:decision
- Name: clear, action-oriented
- Paragraphs/Subsections: which part
- Action: draft | revise | cite | strengthen
- Mode: co-author (Claude drafts) | scaffold (Claude outlines) | reviewer (Claude critiques)
- Verify: how to prove done well
- Done: acceptance criteria

TASKS_BY_SECTION{section → typical_tasks}:
  abstract | draft complete, verify elements
  intro | hook, context, gap, thesis, roadmap
  methods | protocol, measures, analysis approach
  results | finding narratives, supporting analyses
  discussion | summary, interpretation, limitations, future work, conclusion
  related_work | theme syntheses, positioning statement

MODE_SELECT:
- Procedural content (methods, data) → co-author
- Argument-heavy (discussion, intro) → scaffold | reviewer
- Personal voice (abstract conclusion, thesis) → scaffold + user writing

CHECKPOINTS: visual/prose verify → human-verify. Voice/framing choices → decision.
[/step]

[step:estimate_scope]
RUN: cat .planning/config.json 2>/dev/null | grep depth

DEPTH{level,plans_per,tasks_per}:
  quick | 1-2 | 2-3
  standard | 2-4 | 2-3
  comprehensive | 3-6 | 2-3

PRINCIPLE: Derive plans from actual writing needs. Depth = how carefully to break down complex sections.
- Comprehensive Discussion = 4 plans (interpretation, limitations, future work, conclusion)
- Comprehensive Abstract = 1 plan (one paragraph)

ALWAYS_SPLIT if: >3 tasks, multiple threads, complex lit integration
EACH_PLAN must be: 2-3 tasks max, focused on one aspect, independently verifiable
[/step]

[step:confirm_breakdown]
IF mode=yolo → auto-approve, proceed
IF mode=interactive → present breakdown:
  "Section [X] breakdown:
   ### Tasks ({section}-01-PLAN.md)
   1. [Task] - [brief] [type] [mode]
   2. [Task] - [brief] [type] [mode]
   Does this look right? (yes/adjust/start over)"

IF adjust → revise
IF start_over → return to gather_section_context
[/step]

[step:write_section_prompt]
READ: ~/.claude/write-the-f-paper/templates/section-prompt.md

SINGLE_PLAN → .planning/sections/XX-name/{section}-01-PLAN.md
MULTI_PLAN → {section}-01-PLAN.md, {section}-02-PLAN.md, etc.

EACH_PLAN includes:
- Frontmatter (section, plan, type, mode)
- Objective (goal, word target, output)
- Execution context (write-section.md, summary template, verification-layers.md)
- Context (@refs: PROJECT, ROADMAP, STATE, structure docs, RESEARCH/CONTEXT, prior summaries, sources)
- Tasks (XML format with types/modes)
- Verification (citation, coherence, rubric checks)
- Success criteria, Output specification
[/step]

[step:git_commit]
RUN: git add .planning/sections/${SECTION}-*/${SECTION}-*-PLAN.md
RUN: git add .planning/sections/${SECTION}-*/RESEARCH.md 2>/dev/null
COMMIT: "docs(${SECTION}): create section plan - [N] plans, [X] tasks"
EMIT: "Committed: docs(${SECTION}): create section plan"
[/step]

[step:offer_next]
EMIT:
  Section plan created: .planning/sections/XX-name/{section}-01-PLAN.md
  [X] tasks defined.

  Next: {section}-01: [Plan Name] - [objective]
  → /wtfp:write-section .planning/sections/XX-name/{section}-01-PLAN.md

  Also: Review/adjust tasks, View all plans
[/step]

</process>

<task_quality>
GOOD: Specific paragraphs, clear actions, verifiable output
- "Draft hook paragraph establishing research gap in autonomous systems"
- "Write methods subsection on data collection protocol, ~150 words"
- "Synthesize Smith2023 and Jones2024 findings on intervention efficacy"

BAD: Vague, not actionable
- "Write introduction" / "Add citations" / "Make it better"

TEST: If you can't specify Paragraphs + Action + Mode + Verify + Done → too vague
</task_quality>

<anti_patterns>
- No hour estimates
- No "perfect prose" expectations (first drafts are drafts)
- No style committee approvals
- No sub-sub-sub tasks
Tasks = instructions for Claude writing, not editorial board requirements.
</anti_patterns>

<success_criteria>
- [ ] STATE.md read, project context absorbed
- [ ] Mandatory literature check completed (Level 0-3)
- [ ] Prior sections, sources, structure synthesized
- [ ] PLAN file(s) exist with XML structure
- [ ] Each plan: Objective, context, tasks, verification, success criteria, output
- [ ] @context references included (STATE, RESEARCH if exist, relevant summaries)
- [ ] Each plan: 2-3 tasks (~focused scope)
- [ ] Each task: Type, Mode, Paragraphs (if applicable), Action, Verify, Done
- [ ] Checkpoints properly structured
- [ ] If RESEARCH.md exists: sources cited in plan, positioning clear
- [ ] PLAN file(s) committed to git
- [ ] User knows next steps
</success_criteria>
