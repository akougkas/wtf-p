---
name: wtfp:progress
description: Check writing progress, show context, and route to next action
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - SlashCommand
---

<objective>
Check writing progress, summarize recent work and what's ahead, then intelligently route to the next action - either executing an existing plan or creating the next one.

Provides situational awareness before continuing writing.
</objective>


<process>

<step name="verify">
**Verify planning structure exists:**

If no `.planning/` directory:

```
No planning structure found.

Run /wtfp:new-paper to start a new paper.
```

Exit.

If missing STATE.md or ROADMAP.md: inform what's missing, suggest running `/wtfp:new-paper`.
</step>

<step name="load">
**Load full project context:**

- Read `.planning/STATE.md` for living memory (position, word counts, decisions)
- Read `.planning/ROADMAP.md` for section structure and objectives
- Read `.planning/PROJECT.md` for paper vision (Core Argument, Requirements)
</step>

<step name="recent">
**Gather recent work context:**

- Find the 2-3 most recent SUMMARY.md files
- Extract from each: what was written, key decisions, any issues logged
- This shows "what we've been working on"
</step>

<step name="position">
**Parse current position:**

- From STATE.md: current section, plan number, status, word count
- Calculate: total plans, completed plans, remaining plans
- Calculate: total words written vs target word count
- Note any gaps, concerns, or deferred issues
- Check for CONTEXT.md: For sections without PLAN.md files, check if `{section}-CONTEXT.md` exists
</step>

<step name="report">
**Present rich status report:**

```
# [Paper Title]

**Progress:** [████████░░] 8/10 sections drafted
**Words:** [current] / [target] ([percentage]%)

## Recent Work
- [Section X, Plan Y]: [what was written - 1 line]
- [Section X, Plan Z]: [what was written - 1 line]

## Current Position
Section [N] of [total]: [section-name]
Plan [M] of [section-total]: [status]
CONTEXT: [✓ if CONTEXT.md exists | - if not]

## Argument Strength
- Core claim: [from STATE.md]
- Evidence gaps: [list]

## Key Decisions Made
- [decision 1 from STATE.md]
- [decision 2]

## Open Issues
- [any deferred issues or gaps]

## What's Next
[Next section/plan objective from ROADMAP]
```

</step>

<step name="route">
**Determine next action based on verified counts.**

**Step 1: Count plans, summaries, and issues in current section**

List files in the current section directory:

```bash
ls -1 .planning/sections/[current-section-dir]/*-PLAN.md 2>/dev/null | wc -l
ls -1 .planning/sections/[current-section-dir]/*-SUMMARY.md 2>/dev/null | wc -l
ls -1 .planning/sections/[current-section-dir]/*-ISSUES.md 2>/dev/null | wc -l
ls -1 .planning/sections/[current-section-dir]/*-REVISION.md 2>/dev/null | wc -l
```

State: "This section has {X} plans, {Y} summaries, {Z} issues files."

**Step 1.5: Check for unaddressed review issues**

For each *-ISSUES.md file, check if matching *-REVISION.md exists.
For each *-REVISION.md file, check if matching *-REVISION-SUMMARY.md exists.

Track:
- `issues_without_revision`: ISSUES.md files without REVISION.md
- `revisions_without_summary`: REVISION.md files without REVISION-SUMMARY.md

**Step 2: Route based on counts**

| Condition | Meaning | Action |
|-----------|---------|--------|
| revisions_without_summary > 0 | Unexecuted revision plans exist | Go to **Route A** (with REVISION.md) |
| issues_without_revision > 0 | Review issues need revision plans | Go to **Route E** |
| summaries < plans | Unexecuted plans exist | Go to **Route A** |
| summaries = plans AND plans > 0 | Section complete | Go to Step 3 |
| plans = 0 | Section not yet planned | Go to **Route B** |

---

**Route A: Unexecuted plan exists**

Find the first PLAN.md without matching SUMMARY.md.
Read its `<objective>` section.

```
---

## ▶ Next Up

**{section}-{plan}: [Plan Name]** — [objective summary from PLAN.md]

`/wtfp:write-section [full-path-to-PLAN.md]`

<sub>`/clear` first → fresh context window</sub>

---
```

---

**Route B: Section needs planning**

Check if `{section}-CONTEXT.md` exists in section directory.

**If CONTEXT.md exists:**

```
---

## ▶ Next Up

**Section {N}: {Name}** — {Goal from ROADMAP.md}
<sub>✓ Context gathered, ready to plan</sub>

`/wtfp:plan-section {section-number}`

<sub>`/clear` first → fresh context window</sub>

---
```

**If CONTEXT.md does NOT exist:**

```
---

## ▶ Next Up

**Section {N}: {Name}** — {Goal from ROADMAP.md}

`/wtfp:plan-section {section}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/wtfp:discuss-section {section}` — gather context first
- `/wtfp:research-gap {section}` — investigate literature
- `/wtfp:list-assumptions {section}` — see Claude's assumptions

---
```

---

**Route E: Review issues need revision plans**

ISSUES.md exists without matching REVISION.md. User needs to plan revisions.

```
---

## ⚠ Review Issues Found

**{plan}-ISSUES.md** has {N} issues without a revision plan.

`/wtfp:plan-revision {plan}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/wtfp:write-section [path]` — continue with other work first
- `/wtfp:review-section {section}` — run more verification

---
```

---

**Step 3: Check paper status (only when section complete)**

Read ROADMAP.md and identify:
1. Current section number
2. All section numbers in the document structure

Count total sections and identify the highest section number.

State: "Current section is {X}. Paper has {N} sections (highest: {Y})."

**Route based on paper status:**

| Condition | Meaning | Action |
|-----------|---------|--------|
| current section < highest section | More sections remain | Go to **Route C** |
| current section = highest section | Paper draft complete | Go to **Route D** |

---

**Route C: Section complete, more sections remain**

Read ROADMAP.md to get the next section's name and goal.

```
---

## ✓ Section {Z} Complete

## ▶ Next Up

**Section {Z+1}: {Name}** — {Goal from ROADMAP.md}

`/wtfp:plan-section {Z+1}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/wtfp:review-section {Z}` — verify before continuing
- `/wtfp:discuss-section {Z+1}` — gather context first
- `/wtfp:research-gap {Z+1}` — investigate literature

---
```

---

**Route D: Paper draft complete**

```
---

## 🎉 Draft Complete

All {N} sections written!

**Words:** [current] / [target]

## ▶ Next Up

**Review & Polish** — verify and prepare for submission

`/wtfp:review-section` — run full verification
`/wtfp:export-latex` — generate LaTeX output

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/wtfp:submit-milestone "draft-1"` — archive this draft

---
```

</step>

<step name="edge_cases">
**Handle edge cases:**

- Section complete but next section not planned → offer `/wtfp:plan-section [next]`
- All work complete → offer review and export
- Gaps present → highlight before offering to continue
- Handoff file exists → mention it, offer `/wtfp:resume-writing`
</step>

</process>

<success_criteria>

- [ ] Rich context provided (recent work, word counts, decisions)
- [ ] Current position clear with visual progress
- [ ] What's next clearly explained
- [ ] Smart routing: /wtfp:write-section if plan exists, /wtfp:plan-section if not
- [ ] User confirms before any action
- [ ] Seamless handoff to appropriate wtfp command
</success_criteria>
