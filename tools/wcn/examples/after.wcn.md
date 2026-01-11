MODE{name,action,best_for}:
  co-author | Claude drafts, user refines | Write complete prose following outline
  scaffold | Claude outlines, user fills | Create detailed paragraph-level outline
  reviewer | User writes, Claude critiques | Read existing text carefully

<purpose>
Execute a section prompt (PLAN.md) and create the outcome summary (SUMMARY.md).
</purpose>

<required_reading>
Read STATE.md before any operation to load project context.
</required_reading>

<process>

[step:load_project_state p=1]
RUN: cat .planning/STATE.md 2>/dev/null
PARSE: current, word, argument, open
IF file_exists → parse_fields
IF file_missing_but_.planning/_exists → ```
IF .planning/_doesnt_exist → ERROR ""
[/step]

[step:identify_plan]
RUN: cat .planning/ROADMAP.md
IF mode=yolo → - Auto-approved execution
IF mode=interactive → - Present plan for confirmation
IF mode=scaffold → - Claude outlines, user fills
[/step]

<writing_modes>
## Writing Mode Execution

</writing_modes>

<deviation_rules>

[rule:autofix_factual_errors]
TRIGGER: incorrect_fact | wrong_citation | logical_contradiction
ACTION: fix immediately + track for summary
PERMISSION: none_required
[/rule]---

[rule:autoadd_missing_critical_elements]
TRIGGER: required_element_missing_for_section_completeness
ACTION: add immediately + track for summary
PERMISSION: none_required
[/rule]

ROUTE{condition → output → next}:
  more_plans_remain_in_this_section → "More plans remain in this section" → /wtfp:write-section
  section_complete,_more_sections_remain → "Section complete, more sections remain" → /wtfp:plan-section {next}
  document_complete_(all_sections_done) → "Document complete (all sections done)" → /wtfp:submit-draft