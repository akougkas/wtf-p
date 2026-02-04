<purpose>
Execute a section prompt (PLAN.md) via thin orchestrator pattern. Orchestrator validates, loads context, resolves model profile, spawns section-writer agent, then runs argument-verifier for goal-backward verification. Creates SUMMARY.md.
</purpose>

<architecture>
ORCHESTRATOR: /wtfp:write-section (this command)
AGENTS: section-writer (executes PLAN.md, writes prose), argument-verifier (goal-backward check)
PATTERN: Orchestrator loads context → spawns writer → spawns verifier → handle gaps
WHY_SUBAGENTS: Writer gets fresh context window with full PLAN.md + project context. Verifier checks independently whether section achieves its purpose, not just that tasks completed.
</architecture>

<required_reading>
READ: ~/.claude/write-the-f-paper/references/orchestrator-pattern.md
READ: ~/.claude/write-the-f-paper/references/context-fidelity.md
READ: ~/.claude/write-the-f-paper/references/agent-model-matrix.md
READ: ~/.claude/write-the-f-paper/references/git-integration.md
Read STATE.md before any operation to load project context.
</required_reading>

<process>

[step:validate_and_resolve_model p=1]
RUN: ls .planning/ 2>/dev/null
RUN: MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")

MODEL_LOOKUP{agent,quality,balanced,budget}:
  section-writer | opus | sonnet | sonnet
  argument-verifier | sonnet | sonnet | haiku

RESOLVE: writer_model, verifier_model from MODEL_PROFILE
[/step]

[step:load_project_state]
RUN: cat .planning/STATE.md 2>/dev/null
PARSE: current, word, argument, open
IF file_exists → parse_fields
IF file_missing_but_.planning/_exists → OFFER reconstruct|continue
IF .planning/_doesnt_exist → ERROR "project not initialized"
[/step]

[step:identify_plan]
RUN: cat .planning/ROADMAP.md
RUN: cat .planning/config.json 2>/dev/null
FIND: first PLAN without matching SUMMARY in section dir
IF ambiguous → ASK user which plan
[/step]

[step:load_context_md]
CRITICAL: Load CONTEXT.md early, pass to writer agent.

RUN: SECTION_DIR=$(ls -d .planning/sections/${SECTION}-* 2>/dev/null | head -1)
RUN: CONTEXT_CONTENT=$(cat "${SECTION_DIR}"/*-CONTEXT.md 2>/dev/null)
RUN: PLAN_CONTENT=$(cat "${SECTION_DIR}"/${SECTION}-${PLAN}-PLAN.md)

CONTEXT.md rules:
  Locked decisions → writer MUST implement exactly
  Deferred ideas → writer MUST NOT include
  Discretion areas → writer uses judgment
[/step]

[step:record_start_time]
RUN: PLAN_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
[/step]

[step:spawn_section_writer]
EMIT:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   WTF-P ► WRITING SECTION {X} PLAN {Y}
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BUILD writer_prompt with inlined content:
- <writing_context> STATE, PROJECT, ROADMAP, prior summaries, structure docs
- <plan> full PLAN.md content
- <user_decisions> CONTEXT_CONTENT (from CONTEXT.md)
- <output> target paper file path, SUMMARY.md path

SPAWN:
  Task(
    prompt="First, read ~/.claude/agents/wtfp/section-writer.md for your role and instructions.\n\n" + writer_prompt,
    subagent_type="general-purpose",
    model="{writer_model}",
    description="Write Section {X} Plan {Y}"
  )

HANDLE returns:
  "## WRITING COMPLETE" → proceed to argument-verifier
  "## CHECKPOINT REACHED" → present to user, wait, then resume agent
  "## WRITING BLOCKED" → present blocker, ask user
[/step]

[step:spawn_argument_verifier]
IF config.workflow.verifier=false → SKIP to record_completion

GOAL-BACKWARD VERIFICATION: Does written prose achieve section's purpose?
Not "did tasks complete" but "does the output deliver what the section promises?"

BUILD verifier_prompt:
- <plan> original PLAN.md (what was intended)
- <written_content> actual paper output (what was produced)
- <user_decisions> CONTEXT_CONTENT (what user wanted)
- <structure> argument-map.md, outline.md (what structure expects)

SPAWN:
  Task(
    prompt="First, read ~/.claude/agents/wtfp/argument-verifier.md for your role and instructions.\n\n" + verifier_prompt,
    subagent_type="general-purpose",
    model="{verifier_model}",
    description="Verify Section {X} Plan {Y}"
  )

HANDLE returns:
  "VERIFIED" → proceed to record_completion
  "GAPS_FOUND" → present gaps to user, offer: fix now | note for later | accept as-is
  "HUMAN_NEEDED" → present concern, wait for user decision
[/step]

[step:record_completion_time]
RUN: PLAN_END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
[/step]

[step:update_state]
UPDATE STATE.md: position, word count, argument strength, last activity
[/step]

[step:update_roadmap]
IF more_plans_remain_in_this_section → Update plan count: "2/3 plans complete"
IF this_was_the_last_plan_in_the_section → Mark section complete: status → "Complete"
[/step]

[step:git_commit_metadata]
RUN: git add .planning/sections/XX-name/{section}-{plan}-SUMMARY.md
RUN: git add .planning/STATE.md
RUN: git add .planning/ROADMAP.md
COMMIT: "docs({section}-{plan}): complete [plan-name] - [N] tasks, [word-count] words"
[/step]

[step:offer_next]
RUN: ls -1 .planning/sections/[current-section-dir]/*-PLAN.md 2>/dev/null | wc -l
RUN: ls -1 .planning/sections/[current-section-dir]/*-SUMMARY.md 2>/dev/null | wc -l

ROUTE_A (more plans remain):
  EMIT: "{Y} of {X} plans complete. Next: /wtfp:write-section {next-plan}"

ROUTE_B (section complete, more sections remain):
  EMIT: "Section {Z} complete. Next: /wtfp:plan-section {Z+1}"

ROUTE_C (document complete):
  EMIT: "All sections complete. Next: /wtfp:submit-draft"
[/step]

</process>

<writing_modes>
Co-Author (Claude drafts): Write prose, match voice, flag [CITE:] and [VERIFY:], hit word target.
Scaffold (Claude outlines): Paragraph-level outline, citation placement, transitions. User writes.
Reviewer (Claude critiques): Strengths first, gaps, suggestions. Ask before major changes.
</writing_modes>

<deviation_rules>
RULE_PRIORITY:
1. Rule 4 (structural changes) → STOP, ask user
2. Rules 1-3 (errors, missing elements, blockers) → auto-fix, track for SUMMARY
3. Rule 5 (enhancements) → log for later, continue

[rule:autofix_factual_errors] TRIGGER: incorrect_fact | wrong_citation | contradiction → fix + track [/rule]
[rule:autoadd_missing_critical] TRIGGER: required_element_missing → add + track [/rule]
[rule:autofix_blocking] TRIGGER: something_prevents_task_completion → fix + track [/rule]
[rule:ask_structural] TRIGGER: significant_restructuring_needed → STOP + present + wait [/rule]
[rule:log_enhancements] TRIGGER: nice_improvement_not_essential → log + continue [/rule]
</deviation_rules>

<task_commit>
After each task: git status → stage task files → commit with type prefix.
TYPES: content | cite | revise | fix | structure
FORMAT: "{type}({section}-{plan}): {description}"
Record hash for SUMMARY.md.
</task_commit>

<success_criteria>
- [ ] Model profile resolved, agent models determined
- [ ] CONTEXT.md loaded early and passed to writer agent
- [ ] Section-writer agent spawned with full context + PLAN.md
- [ ] All tasks from PLAN.md completed
- [ ] All verifications pass (citation, coherence, rubric)
- [ ] Argument-verifier confirmed section achieves purpose (or skipped per config)
- [ ] SUMMARY.md created with substantive content
- [ ] STATE.md updated (position, word count, argument strength)
- [ ] ROADMAP.md updated
- [ ] Paper content committed with meaningful messages
- [ ] User knows next steps
</success_criteria>
