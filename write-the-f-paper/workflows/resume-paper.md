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

<step name="detect_existing_project">
Check if this is an existing writing project:

```bash
ls .planning/STATE.md 2>/dev/null && echo "Project exists"
ls .planning/ROADMAP.md 2>/dev/null && echo "Roadmap exists"
ls .planning/PROJECT.md 2>/dev/null && echo "Project file exists"
```

**If STATE.md exists:** Proceed to load_state
**If only ROADMAP.md/PROJECT.md exist:** Offer to reconstruct STATE.md
**If .planning/ doesn't exist:** This is a new project - route to /wtfp:new-paper
</step>

<step name="load_state">

Read and parse STATE.md, then PROJECT.md:

```bash
cat .planning/STATE.md
cat .planning/PROJECT.md
```

**From STATE.md extract:**

- **Project Reference**: Core argument and current focus
- **Current Position**: Section X of Y, Plan A of B, Status
- **Word Count**: Current vs target
- **Section Progress**: Which sections are done
- **Argument Strength**: How solid is the thesis
- **Open Questions**: Unresolved items
- **Deferred**: Nice-to-haves logged for later
- **Session Continuity**: Where we left off, any resume files

**From PROJECT.md extract:**

- **What This Is**: Document type, venue, deadline
- **Core Argument**: The thesis
- **Requirements**: What must be in the document
- **Key Decisions**: Choices made about framing, scope

</step>

<step name="check_incomplete_work">
Look for incomplete work that needs attention:

```bash
# Check for continue-here files (mid-plan resumption)
ls .planning/sections/*/.continue-here*.md 2>/dev/null

# Check for plans without summaries (incomplete writing)
for plan in .planning/sections/*/*-PLAN.md; do
  summary="${plan/PLAN/SUMMARY}"
  [ ! -f "$summary" ] && echo "Incomplete: $plan"
done 2>/dev/null
```

**If .continue-here file exists:**

- This is a mid-plan resumption point
- Read the file for specific resumption context
- Flag: "Found mid-section checkpoint"

**If PLAN without SUMMARY exists:**

- Writing was started but not completed
- Flag: "Found incomplete writing plan"
</step>

<step name="present_status">
Present complete project status to user:

```
╔══════════════════════════════════════════════════════════════╗
║  WRITING PROJECT STATUS                                       ║
╠══════════════════════════════════════════════════════════════╣
║  Document: [title from PROJECT.md]                            ║
║  Venue: [target venue]                                        ║
║                                                               ║
║  Section: [X] of [Y] - [Section name]                        ║
║  Plan:    [A] of [B] - [Status]                              ║
║  Progress: [██████░░░░] XX%                                  ║
║                                                               ║
║  Words: [current] / [target]                                 ║
║  Last activity: [date] - [what happened]                     ║
╚══════════════════════════════════════════════════════════════╝

[If incomplete work found:]
⚠️  Incomplete work detected:
    - [.continue-here file or incomplete plan]

[If open questions exist:]
❓ Open questions:
    - [Question 1]
    - [Question 2]

[If argument strength is concerning:]
📊 Argument status: [developing/weak]
    - [Concern about thesis support]
```

</step>

<step name="determine_next_action">
Based on project state, determine the most logical next action:

**If .continue-here file exists:**
→ Primary: Resume from checkpoint
→ Option: Start fresh on current plan

**If incomplete plan (PLAN without SUMMARY):**
→ Primary: Complete the incomplete plan
→ Option: Abandon and move on

**If section in progress, all plans complete:**
→ Primary: Transition to next section
→ Option: Review completed work

**If section ready to plan:**
Check if CONTEXT.md exists for this section:

- If CONTEXT.md missing:
  → Primary: Discuss section vision
  → Secondary: Plan directly (skip context gathering)
- If CONTEXT.md exists:
  → Primary: Plan the section
  → Option: Review roadmap

**If section ready to write:**
→ Primary: Execute next plan
→ Option: Review the plan first
</step>

<step name="offer_options">
Present contextual options based on project state:

```
What would you like to do?

[Primary action based on state - e.g.:]
1. Resume from checkpoint
   OR
1. Write next plan (/wtfp:write-section .planning/sections/XX-name/02-02-PLAN.md)
   OR
1. Discuss Section 3 context (/wtfp:discuss-section 3)
   OR
1. Plan Section 3 (/wtfp:plan-section 3)

[Secondary options:]
2. Review current section status
3. Check word count progress
4. Review argument strength
5. Something else
```

Wait for user selection.
</step>

<step name="route_to_workflow">
Based on user selection, route to appropriate workflow:

- **Write plan** → Show command for user to run after clearing:
  ```
  ---

  ## Next Up

  **{section}-{plan}: [Plan Name]** — [objective from PLAN.md]

  `/wtfp:write-section [path]`

  <sub>`/clear` first → fresh context window</sub>

  ---
  ```
- **Plan section** → Show command for user to run after clearing:
  ```
  ---

  ## Next Up

  **Section [N]: [Name]** — [Goal from ROADMAP.md]

  `/wtfp:plan-section [section-number]`

  <sub>`/clear` first → fresh context window</sub>

  ---

  **Also available:**
  - `/wtfp:discuss-section [N]` — gather context first
  - `/wtfp:research-gap [topic]` — investigate literature

  ---
  ```
- **Review section** → Read section content, present summary
- **Check word count** → Calculate and display progress
- **Review argument** → Read argument-map.md, assess thesis support
- **Something else** → Ask what they need
</step>

<step name="update_session">
Before proceeding to routed workflow, update session continuity:

Update STATE.md:

```markdown
## Session Continuity

Last session: [now]
Stopped at: Session resumed, proceeding to [action]
Resume file: [updated if applicable]
```

This ensures if session ends unexpectedly, next resume knows the state.
</step>

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
