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

<step name="load_project_state" priority="first">

Before transition, read project state:

```bash
cat .planning/STATE.md 2>/dev/null
cat .planning/PROJECT.md 2>/dev/null
```

Parse current position to verify we're transitioning the right section.
Note accumulated context that may need updating after transition.

</step>

<step name="verify_completion">

Check current section has all plan summaries:

```bash
ls .planning/sections/XX-current/*-PLAN.md 2>/dev/null | sort
ls .planning/sections/XX-current/*-SUMMARY.md 2>/dev/null | sort
```

**Verification logic:**

- Count PLAN files
- Count SUMMARY files
- If counts match: all plans complete
- If counts don't match: incomplete

<config-check>

```bash
cat .planning/config.json 2>/dev/null
```

</config-check>

**If all plans complete:**

<if mode="yolo">

```
Auto-approved: Transition Section [X] → Section [X+1]
Section [X] complete — all [Y] plans finished.

Proceeding to mark done and advance...
```

Proceed directly to update_word_count step.

</if>

<if mode="interactive" OR="custom with gates.confirm_transition true">

Ask: "Section [X] complete — all [Y] plans finished. Ready to mark done and move to Section [X+1]?"

Wait for confirmation before proceeding.

</if>

**If plans incomplete:**

Present:

```
Section [X] has incomplete plans:
- {section}-01-SUMMARY.md ✓ Complete
- {section}-02-SUMMARY.md ✗ Missing
- {section}-03-SUMMARY.md ✗ Missing

Options:
1. Continue current section (complete remaining plans)
2. Mark complete anyway (skip remaining plans)
3. Review what's left
```

Wait for user decision.

</step>

<step name="update_word_count">

Calculate word count for completed section:

```bash
# Count words in section output files
wc -w paper/sections/*.md 2>/dev/null
```

Update STATE.md word count tracking:
- Add section's words to current total
- Update remaining words calculation
- Update section progress table

</step>

<step name="cleanup_handoff">

Check for lingering handoffs:

```bash
ls .planning/sections/XX-current/.continue-here*.md 2>/dev/null
```

If found, delete them — section is complete, handoffs are stale.

</step>

<step name="update_roadmap">

Update the roadmap file:

```bash
ROADMAP_FILE=".planning/ROADMAP.md"
```

Update the file:

- Mark current section: `[x] Complete`
- Add completion date
- Update plan count to final (e.g., "3/3 plans complete")
- Update word count
- Keep next section as `[ ] Not started`

**Example:**

```markdown
## Sections

- [x] Section 1: Introduction (completed 2025-01-15, 850 words)
- [ ] Section 2: Methods ← Next
- [ ] Section 3: Results

## Progress

| Section | Plans Complete | Words | Status | Completed |
| ------- | -------------- | ----- | ------ | --------- |
| 1. Introduction | 3/3 | 850 | Complete | 2025-01-15 |
| 2. Methods | 0/2 | 0 | Not started | - |
```

</step>

<step name="assess_argument_strength">

After completing section, assess how it affects argument strength:

Read the section's contribution to the thesis:
- Did it establish what it needed to?
- Are there gaps in the argument?
- Does it connect properly to prior sections?

Update STATE.md Argument Strength section:

```markdown
## Argument Strength

Core claim: [developing → solid / still weak / strengthened]
Evidence gaps: [updated list]
Logic flow: [coherent / has jumps / improved]
```

</step>

<step name="evolve_project">

Evolve PROJECT.md to reflect learnings from completed section.

**Read section summaries:**

```bash
cat .planning/sections/XX-current/*-SUMMARY.md
```

**Assess changes needed:**

1. **Requirements validated?**
   - Any requirements addressed in this section?
   - Move to Validated: `- ✓ [Requirement] — Section X`

2. **Requirements changed?**
   - Any requirements discovered to be different than expected?
   - Update in Active section

3. **Decisions to log?**
   - Extract decisions from SUMMARY.md files
   - Add to Key Decisions table

4. **Core argument still accurate?**
   - If the thesis has evolved, update the description

**Update PROJECT.md:**

Update "Last updated" footer:

```markdown
---
*Last updated: [date] after Section [X]*
```

</step>

<step name="update_current_position">

Update Current Position section in STATE.md to reflect section completion and transition.

**Format:**

```markdown
Section: [next] of [total] ([Next section name])
Plan: Not started
Status: Ready to plan
Last activity: [today] — Section [X] complete, transitioned to Section [X+1]

Progress: [updated progress bar]
```

</step>

<step name="update_session_continuity">

Update Session Continuity section in STATE.md.

```markdown
Last session: [today]
Stopped at: Section [X] complete, ready to plan Section [X+1]
Resume file: None
```

</step>

<step name="offer_next_section">

**Check if more sections remain in document:**

Read ROADMAP.md to identify remaining sections.

**Route A: More sections remain**

```
## Section {X}: {Section Name} Complete

All {Y} plans finished. {word-count} words written.

---

## Next Up

**Section {X+1}: {Next Section Name}** — {Goal from ROADMAP.md}

`/wtfp:plan-section {X+1}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/wtfp:review-section {X}` — verify section before continuing
- `/wtfp:discuss-section {X+1}` — gather context first
- `/wtfp:research-gap [topic]` — investigate literature
- Review section before continuing

---
```

**Route B: Document complete (all sections done)**

```
## Section {X}: {Section Name} Complete

DOCUMENT COMPLETE!

════════════════════════════════════════
All {N} sections complete!
Total words: {word-count}
Document is ready for full review.
════════════════════════════════════════

---

## Next Up

**Submit Draft** — prepare for submission

`/wtfp:submit-draft`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/wtfp:review-section` — full document verification
- Review accomplishments before submitting

---
```

</step>

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
