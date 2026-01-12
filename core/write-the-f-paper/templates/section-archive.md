# Section Archive Template

Template for `.planning/archive/round-[N]/` - preserves state after completing a submission round.

**Purpose:** Snapshot the project state before major transitions (submission, revision, resubmission) for context preservation and rollback capability.

---

## Directory Structure

```
.planning/
├── archive/
│   ├── round-1/                    # Initial submission
│   │   ├── PROJECT.md             # Copy of project state
│   │   ├── STATE.md               # Copy of state at submission
│   │   ├── ROADMAP.md             # Copy of roadmap
│   │   ├── sections/              # Copy of all section plans/summaries
│   │   └── ARCHIVE-NOTES.md       # What was submitted, outcome
│   │
│   ├── round-2/                    # After R1 revision
│   │   └── ...
│   │
│   └── round-3/                    # After R2 revision (if needed)
│       └── ...
```

## Archive Notes Template

```markdown
# Archive: Round [N]

**Archived:** [date]
**Event:** [Initial submission / R1 revision / R2 revision / Accepted]
**Venue:** [Journal/Conference name]

## Submission Details

**Submitted:** [date]
**Manuscript ID:** [if assigned]
**Word count:** [total words at submission]
**Files submitted:**
- manuscript.pdf
- supplementary.pdf (if applicable)
- cover_letter.pdf

## State at Submission

**Sections complete:**
- [x] Abstract
- [x] Introduction
- [x] Methods
- [x] Results
- [x] Discussion
- [x] References

**Verification status:**
- Citation check: Pass
- Coherence check: Pass
- Rubric check: Pass

**Known limitations:**
- [Issues we're aware of but submitted anyway]

## Outcome

**Decision:** [Pending / Accept / Minor revision / Major revision / Reject]
**Decision date:** [date]
**Reviews received:** [N] reviewers

## Summary of Changes (from previous round)

[If Round 2+:]
- [Major change 1]
- [Major change 2]
- [Major change 3]

## Next Steps

[What happens after this round]

---

*Archived by /wtfp:submit-milestone*
*Round: [N]*
```

<guidelines>
**When to archive:**
- Before submitting manuscript
- Before starting major revision
- After acceptance (final archive)

**What to archive:**
- PROJECT.md - Project vision at that point
- STATE.md - Position and progress
- ROADMAP.md - Section structure
- All section PLAN.md and SUMMARY.md files
- ARCHIVE-NOTES.md - Meta information

**What NOT to archive:**
- The actual manuscript files (those are in paper/)
- Working files that will be recreated
- Temporary analysis files

**Archive naming:**
- round-1: Initial submission
- round-2: After first revision
- round-3+: Subsequent revisions
- Use descriptive names if needed: round-2-major-revision

**Workflow:**
1. /wtfp:submit-milestone creates archive
2. Archive preserves state for reference
3. New revision work starts fresh in .planning/
4. Can reference archive for context during revision
</guidelines>

<example>
```markdown
# Archive: Round 1

**Archived:** 2025-02-15
**Event:** Initial submission
**Venue:** CHI 2025

## Submission Details

**Submitted:** 2025-02-15
**Manuscript ID:** chi25-papers-1234
**Word count:** 9,847
**Files submitted:**
- manuscript.pdf (main paper)
- supplementary.pdf (appendix with framework details)
- cover_letter.pdf

## State at Submission

**Sections complete:**
- [x] Abstract (247 words)
- [x] Introduction (892 words)
- [x] Literature Review (1,523 words)
- [x] Methods (1,245 words)
- [x] Results (2,156 words)
- [x] Discussion (1,834 words)
- [x] Conclusion (412 words)
- [x] References (65 citations)

**Verification status:**
- Citation check: Pass (all 65 citations verified)
- Coherence check: Pass (argument flows confirmed)
- Rubric check: Pass (CHI format, word limit, sections)

**Known limitations:**
- Sample size (N=45) may draw questions - addressed in limitations
- Framework not yet validated with large-scale study - noted as future work

## Outcome

**Decision:** Pending
**Decision date:** Expected 2025-04-01
**Reviews received:** -

## Summary of Changes (from previous round)

N/A - Initial submission

## Next Steps

- Wait for reviews (expected April)
- If revision requested, use /wtfp:import-reviews to begin

---

*Archived by /wtfp:submit-milestone*
*Round: 1*
```
</example>
