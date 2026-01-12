# State Template

Template for `.planning/STATE.md` — the writing project's living memory.

---

## File Template

```markdown
# Project State

## Project Reference

See: .planning/PROJECT.md (updated [date])

**Core argument:** [One-liner from PROJECT.md Core Argument section]
**Current focus:** [Current section name]

## Current Position

Section: [X] of [Y] ([Section name])
Plan: [A] of [B] in current section
Status: [Ready to plan / Planning / Ready to write / Writing / Section complete]
Last activity: [YYYY-MM-DD] — [What happened]

Progress: [░░░░░░░░░░] 0%

## Word Count

| Section | Target | Current | % |
|---------|--------|---------|---|
| Abstract | 250 | 0 | 0% |
| Introduction | 800 | 0 | 0% |
| Methods | 1200 | 0 | 0% |
| Results | 1500 | 0 | 0% |
| Discussion | 1200 | 0 | 0% |
| **Total** | **5000** | **0** | **0%** |

## Argument Strength

**Core thesis:** [Strong / Developing / Weak]
**Evidence gaps:** [List gaps or "None identified"]
**Logic flow:** [Coherent / Has jumps / Needs restructuring]

**By Section:**

| Section | Strength | Notes |
|---------|----------|-------|
| Abstract | - | Not started |
| Introduction | - | Not started |
| Methods | - | Not started |
| Results | - | Not started |
| Discussion | - | Not started |

## Verification Status

- Citation check: [Not run / Passing / X issues]
- Coherence check: [Not run / Passing / X issues]
- Rubric check: [Not run / Passing / X issues]

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Section X]: [Decision summary]
- [Section Y]: [Decision summary]

### Deferred Issues

[From ISSUES.md — list open items with section of origin]

None yet.

### Blockers/Concerns

[Issues that affect future writing]

None yet.

## Session Continuity

Last session: [YYYY-MM-DD HH:MM]
Stopped at: [Description of last completed action]
Resume file: [Path to .continue-here*.md if exists, otherwise "None"]
```

<purpose>

STATE.md is the writing project's short-term memory spanning all sections and sessions.

**Problem it solves:** Information is captured in summaries, issues, and decisions but not systematically consumed. Sessions start without context.

**Solution:** A single, small file that's:
- Read first in every workflow
- Updated after every significant action
- Contains digest of accumulated context
- Enables instant session restoration
- Tracks word count and argument strength

</purpose>

<lifecycle>

**Creation:** After ROADMAP.md is created (during init)
- Reference PROJECT.md (read it for current context)
- Initialize word count table from roadmap word budgets
- Set position to "Section 1 ready to plan"

**Reading:** First step of every workflow
- progress: Present status to user
- plan: Inform planning decisions
- write: Know current position
- transition: Know what's complete

**Writing:** After every significant action
- write-section: After SUMMARY.md created
  - Update position (section, plan, status)
  - Update word count table
  - Note new decisions (detail in PROJECT.md)
  - Update deferred issues list
  - Add blockers/concerns
- transition: After section marked complete
  - Update progress bar
  - Clear resolved blockers
  - Refresh Project Reference date

</lifecycle>

<sections>

### Project Reference
Points to PROJECT.md for full context. Includes:
- Core argument (the ONE thesis that matters)
- Current focus (which section)
- Last update date (triggers re-read if stale)

Claude reads PROJECT.md directly for requirements, constraints, and decisions.

### Current Position
Where we are right now:
- Section X of Y — which section
- Plan A of B — which plan within section
- Status — current state
- Last activity — what happened most recently
- Progress bar — visual indicator of overall completion

Progress calculation: (completed plans) / (total plans across all sections) × 100%

### Word Count
Track progress toward length targets:
- Per-section breakdown
- Target vs current
- Percentage complete
- Helps identify sections that need trimming or expansion

### Argument Strength
Track the quality of the argument:
- Core thesis strength (is it well-supported?)
- Evidence gaps (what's missing?)
- Logic flow (does it hang together?)
- Per-section assessment

Updated after each section completion.

### Verification Status
Track the three-layer verification:
- Citation check (mechanical)
- Coherence check (logical)
- Rubric check (requirements)

Updated after running verification.

### Accumulated Context

**Decisions:** Reference to PROJECT.md Key Decisions table, plus recent decisions summary for quick access. Full decision log lives in PROJECT.md.

**Deferred Issues:** Open items from ISSUES.md
- Brief description with ISS-XXX number
- Section where discovered
- Effort estimate if known
- Helps section planning identify what to address

**Blockers/Concerns:** From "Next Section Readiness" sections
- Issues that affect future work
- Prefix with originating section
- Cleared when addressed

### Session Continuity
Enables instant resumption:
- When was last session
- What was last completed
- Is there a .continue-here file to resume from

</sections>

<size_constraint>

Keep STATE.md under 100 lines.

It's a DIGEST, not an archive. If accumulated context grows too large:
- Keep only 3-5 recent decisions in summary (full log in PROJECT.md)
- Reference ISSUES.md instead of listing all: "12 open issues — see ISSUES.md"
- Keep only active blockers, remove resolved ones

The goal is "read once, know where we are" — if it's too long, that fails.

</size_constraint>

<guidelines>

**When created:**
- During project initialization (after ROADMAP.md)
- Reference PROJECT.md (extract core argument and current focus)
- Initialize word count from roadmap word budgets
- Initialize empty sections

**When read:**
- Every workflow starts by reading STATE.md
- Then read PROJECT.md for full context
- Provides instant context restoration

**When updated:**
- After each plan execution (update position, word count, note decisions, update issues/blockers)
- After section transitions (update progress bar, clear resolved blockers, refresh project reference)

**Size management:**
- Keep under 100 lines total
- Recent decisions only in STATE.md (full log in PROJECT.md)
- Reference ISSUES.md instead of listing all issues
- Keep only active blockers

**Sections:**
- Project Reference: Pointer to PROJECT.md with core argument
- Current Position: Where we are now (section, plan, status)
- Word Count: Progress toward length targets
- Argument Strength: Quality assessment
- Verification Status: Three-layer check results
- Accumulated Context: Recent decisions, deferred issues, blockers
- Session Continuity: Resume information

</guidelines>
