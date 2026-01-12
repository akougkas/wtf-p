<required_reading>

**Read these files NOW:**

1. `.planning/STATE.md`
2. `.planning/PROJECT.md`
3. `.planning/ROADMAP.md`
4. Current section's plan files (`*-PLAN.md`)
5. Current section's summary files (`*-SUMMARY.md`)

</required_reading>

<purpose>

Mark current section complete and advance to next. This is the natural point
where progress tracking and PROJECT.md evolution happen.

"Planning next section" = "current section is done"

</purpose>

<process>

[step:load_project_state p=1]
RUN: cat .planning/STATE.md 2>/dev/null
[/step]

[step:verify_completion]
RUN: ls .planning/sections/XX-current/*-PLAN.md 2>/dev/null | sort
RUN: cat .planning/config.json 2>/dev/null
IF all_plans_complete → <if mode="yolo">
IF plans_incomplete → Present:
[/step]

[step:update_word_count]
[/step]

[step:cleanup_handoff]
RUN: ls .planning/sections/XX-current/.continue-here*.md 2>/dev/null
[/step]

[step:update_roadmap]
RUN: ROADMAP_FILE=".planning/ROADMAP.md"
[/step]

[step:assess_argument_strength]
[/step]

[step:evolve_project]
RUN: cat .planning/sections/XX-current/*-SUMMARY.md
[/step]

[step:update_current_position]
[/step]

[step:update_session_continuity]
[/step]

[step:offer_next_section]
[/step]

</process>

<implicit_tracking>

Progress tracking is IMPLICIT:

- "Plan section 2" → Section 1 must be done (or ask)
- "Plan section 3" → Sections 1-2 must be done (or ask)
- Transition workflow makes it explicit in ROADMAP.md

No separate "update progress" step. Forward motion IS progress.

</implicit_tracking>

<partial_completion>

If user wants to move on but section isn't fully complete:

```
Section [X] has incomplete plans:
- {section}-02-PLAN.md (not executed)
- {section}-03-PLAN.md (not executed)

Options:
1. Mark complete anyway (plans weren't needed)
2. Defer work to revision phase
3. Stay and finish current section
```

Respect user judgment — they know if content matters.

**If marking complete with incomplete plans:**

- Update ROADMAP: "2/3 plans complete" (not "3/3")
- Note in transition message which plans were skipped

</partial_completion>

<success_criteria>

Transition is complete when:

- [ ] Current section plan summaries verified (all exist or user chose to skip)
- [ ] Word count calculated and updated
- [ ] Any stale handoffs deleted
- [ ] ROADMAP.md updated with completion status, plan count, word count
- [ ] Argument strength assessed and updated
- [ ] PROJECT.md evolved (requirements, decisions if needed)
- [ ] STATE.md updated (position, word count, session)
- [ ] User knows next steps

</success_criteria>