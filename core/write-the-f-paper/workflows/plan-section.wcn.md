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
READ: ~/.claude/write-the-f-paper/references/orchestrator-pattern.md
READ: ~/.claude/write-the-f-paper/references/context-fidelity.md
READ: ~/.claude/write-the-f-paper/references/agent-model-matrix.md
READ: .planning/ROADMAP.md
READ: .planning/PROJECT.md
LOAD: .planning/structure/argument-map.md, outline.md, narrative-arc.md
</required_reading>

<purpose>
Create executable section prompt (PLAN.md) via thin orchestrator pattern. Orchestrator validates, loads context, resolves model profile, spawns section-planner agent, then runs plan-checker for quality verification. PLAN.md IS the prompt Claude executes - not a doc that gets transformed.
</purpose>

<architecture>
ORCHESTRATOR: /wtfp:plan-section (this command)
AGENTS: section-planner (creates PLAN.md), plan-checker (validates PLAN.md)
PATTERN: Orchestrator loads context → spawns planner → spawns checker → revise loop if needed
WHY_SUBAGENTS: Fresh context windows for peak quality. Planner gets full project context without orchestrator overhead. Checker validates independently.
</architecture>

<planning_principles>
Argument-first: Every paragraph serves core argument. Plan prose that advances thesis, not filler.
Evidence-grounded: Plan where citations go before writing. Claims need sources identified.
Reader-aware: Plan for target audience. Technical depth, assumed knowledge, explanation level.
</planning_principles>

<process>

[step:validate_and_resolve_model p=1]
RUN: ls .planning/ 2>/dev/null
RUN: MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")

MODEL_LOOKUP{agent,quality,balanced,budget}:
  section-planner | opus | opus | sonnet
  plan-checker | sonnet | sonnet | haiku

RESOLVE: planner_model, checker_model from MODEL_PROFILE
[/step]

[step:load_project_state]
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

[step:load_context_md]
CRITICAL: Load CONTEXT.md early, pass to ALL agents.

RUN: SECTION_DIR=$(ls -d .planning/sections/${SECTION}-* 2>/dev/null | head -1)
RUN: CONTEXT_CONTENT=$(cat "${SECTION_DIR}"/*-CONTEXT.md 2>/dev/null)

IF CONTEXT.md exists → store for injection into planner prompt as <user_decisions>
  HONOR: locked decisions, boundaries, vision
  EXCLUDE: deferred ideas
  ALLOW: discretion areas
IF missing → SUGGEST: /wtfp:discuss-section (simpler) or proceed without
[/step]

[step:mandatory_literature_check]
MANDATORY for sections flagged Research: Likely

LIT_LEVEL{level,desc,action}:
  0-skip | internal content only, no external evidence | skip
  1-quick | single source verify | quick check, no RESEARCH.md
  2-standard | multiple sources, positioning | /wtfp:research-gap → RESEARCH.md
  3-deep | core lit review, theoretical framework | /wtfp:research-gap depth=deep → full RESEARCH.md

IF roadmap=Research:Likely → Level 0 not available
[/step]

[step:read_prior_sections]
RUN: for f in .planning/sections/*/*-SUMMARY.md; do sed -n '1,/^---$/p' "$f" | head -30; done
PARSE: section, subsection, key-claims, evidence-used, decisions

AUTO-SELECT sections matching:
- Immediate prior section
- Same argumentative thread
- Mentioned in STATE.md as affecting current

EXTRACT: claims established, evidence cited, patterns, decisions
[/step]

[step:spawn_section_planner]
EMIT:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   WTF-P ► PLANNING SECTION {X}
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BUILD planner_prompt with inlined content:
- <planning_context> STATE, ROADMAP, PROJECT, argument-map, outline, RESEARCH, prior summaries
- <user_decisions> CONTEXT_CONTENT (from CONTEXT.md)
- <output> target directory path

SPAWN:
  Task(
    prompt="First, read ~/.claude/agents/wtfp/section-planner.md for your role and instructions.\n\n" + planner_prompt,
    subagent_type="general-purpose",
    model="{planner_model}",
    description="Plan Section {X}"
  )

HANDLE returns:
  "## PLANNING COMPLETE" → proceed to plan-checker
  "## CHECKPOINT REACHED" → present to user, wait
  "## PLANNING BLOCKED" → present blocker, ask user
[/step]

[step:spawn_plan_checker]
IF config.workflow.plan_check=false → SKIP to git_commit

SPAWN:
  Task(
    prompt="First, read ~/.claude/agents/wtfp/plan-checker.md for your role and instructions.\n\n" + checker_prompt_with_PLAN_content,
    subagent_type="general-purpose",
    model="{checker_model}",
    description="Check Plan {section}-01"
  )

HANDLE returns:
  "## CHECK PASSED" → proceed to git_commit
  "## ISSUES FOUND" → enter revise loop
[/step]

[step:plan_check_revise_loop]
IF checker returns ISSUES:
  MAX_REVISIONS: 2

  LOOP:
    1. Present issues to user (or auto-fix if minor)
    2. Re-spawn section-planner with issues as feedback
    3. Re-spawn plan-checker on revised plan
    4. IF passed → proceed
    5. IF max_revisions reached → present remaining issues, ask user

ISSUE_CATEGORIES:
  auto-fix | missing citation placeholder, word budget off | planner revises
  user-decision | structural concern, scope question | present to user
  acceptable | style preference, minor suggestion | log and proceed
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
  [X] tasks defined. Plan check: [PASSED/SKIPPED]

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
- [ ] Model profile resolved, agent models determined
- [ ] STATE.md read, project context absorbed
- [ ] CONTEXT.md loaded early and passed to ALL agents
- [ ] Mandatory literature check completed (Level 0-3)
- [ ] Prior sections, sources, structure synthesized
- [ ] Section-planner agent spawned with full context
- [ ] PLAN file(s) exist with XML structure
- [ ] Plan-checker agent validated plan (or skipped per config)
- [ ] Plan-check-revise loop completed if issues found
- [ ] Each plan: 2-3 tasks (~focused scope)
- [ ] Each task: Type, Mode, Paragraphs (if applicable), Action, Verify, Done
- [ ] PLAN file(s) committed to git
- [ ] User knows next steps
</success_criteria>
