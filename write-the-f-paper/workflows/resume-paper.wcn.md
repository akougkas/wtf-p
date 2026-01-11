<trigger>
Use this workflow when:
- Starting a new session on an existing paper
- User says "continue", "what's next", "where were we", "resume"
- Any writing operation when .planning/ already exists
- User returns after time away from writing
</trigger>

<purpose>
Instantly restore full project context and present clear status.
Enables seamless session continuity for writing workflows.

"Where were we?" should have an immediate, complete answer.
</purpose>

<process>

[step:detect_existing_project]
RUN: ls .planning/STATE.md 2>/dev/null && echo "Project exists"
IF STATE.md_exists → Proceed to load_state
IF only_ROADMAP.md/PROJECT.md_exist → Offer to reconstruct STATE.md
IF .planning/_doesnt_exist → This is a new project - route to /wtfp:new-paper
[/step]

[step:load_state]
RUN: cat .planning/STATE.md
[/step]

[step:check_incomplete_work]
IF .continue-here_file_exists → - This is a mid-plan resumption point
IF PLAN_without_SUMMARY_exists → - Writing was started but not completed
[/step]

[step:present_status]
[/step]

[step:determine_next_action]
IF .continue-here_file_exists → → Primary: Resume from checkpoint
IF incomplete_plan_(PLAN_without_SUMMARY) → → Primary: Complete the incomplete plan
IF section_in_progress,_all_plans_complete → → Primary: Transition to next section
IF section_ready_to_plan → Check if CONTEXT.md exists for this section:
IF section_ready_to_write → → Primary: Execute next plan
[/step]

[step:offer_options]
[/step]

[step:route_to_workflow]
[/step]

[step:update_session]
[/step]

</process>

<reconstruction>
If STATE.md is missing but other artifacts exist:

"STATE.md missing. Reconstructing from artifacts..."

1. Read PROJECT.md → Extract thesis and document info
2. Read ROADMAP.md → Determine sections, find current position
3. Scan *-SUMMARY.md files → Extract decisions, word counts
4. Check paper/ directory → Count actual words written
5. Check for .continue-here files → Session continuity

Reconstruct and write STATE.md, then proceed normally.
</reconstruction>

<quick_resume>
For users who want minimal friction:

If user says just "continue" or "go":

- Load state silently
- Determine primary action
- Execute immediately without presenting options

"Continuing from [state]... [action]"

This enables "just keep writing" workflow.
</quick_resume>

<success_criteria>
Resume is complete when:

- [ ] STATE.md loaded (or reconstructed)
- [ ] Incomplete work detected and flagged
- [ ] Clear status presented to user
- [ ] Contextual next actions offered
- [ ] User knows exactly where project stands
- [ ] Session continuity updated
</success_criteria>