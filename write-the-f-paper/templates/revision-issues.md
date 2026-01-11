# Revision Issues Template

Template for `.planning/sections/XX-name/{section}-{plan}-ISSUES.md` - section-scoped issues discovered during verification.

**Purpose:** Capture issues found during `/wtfp:review-section`. Unlike global ISSUES.md (for deferred enhancements), this file tracks problems in specific written sections.

**Location:** Same directory as the SUMMARY.md being reviewed.

---

## File Template

```markdown
# Revision Issues: Section [X] Plan [Y]

**Reviewed:** [date]
**Source:** [path to SUMMARY.md that was reviewed]
**Reviewer:** User via /wtfp:review-section

## Open Issues

### REV-001: [Brief description]

**Discovered:** [date]
**Section/Plan:** [XX]-[YY]
**Severity:** [Critical/Major/Minor/Polish]
**Verification Layer:** [Citation/Coherence/Rubric]
**Description:** [Detailed description of the problem]
**Location:** [Paragraph/sentence where issue appears]
**Expected:** [What should be there]
**Actual:** [What is currently there]
**Suggested Fix:** [How to address this]

### REV-002: [Brief description]

...

## Resolved Issues

[Moved here after /wtfp:plan-revision executes and fixes are verified]

### REV-001: [Brief description]
**Resolved:** [date] - Fixed in [section]-[plan]-FIX.md
**Commit:** [hash]

---

*Section: XX-name*
*Plan: YY*
*Reviewed: [date]*
```

---

## Severity Guide

| Severity | Definition | Example |
|----------|------------|---------|
| **Critical** | Factual error or logical contradiction | Claim contradicts data, wrong citation |
| **Major** | Significant argument weakness | Missing evidence, unclear logic |
| **Minor** | Issue affects clarity or flow | Awkward transition, unclear sentence |
| **Polish** | Style or preference issue | Could be tighter, alternative wording |

## Verification Layer

| Layer | What It Checks | Example Issues |
|-------|----------------|----------------|
| **Citation** | All claims supported, citations correct | Unsupported claim, wrong page number |
| **Coherence** | Argument flows logically | Claim doesn't follow from evidence |
| **Rubric** | Meets requirements | Over word limit, missing required section |

---

## REV Numbering

- **Prefix:** `REV-` (distinguishes from ISS- enhancement issues)
- **Scope:** Per-file numbering (REV-001, REV-002, etc. within each file)
- **No global numbering:** Each {section}-{plan}-ISSUES.md has its own sequence

---

<good_examples>
```markdown
# Revision Issues: Section 3 Plan 1

**Reviewed:** 2025-01-15
**Source:** .planning/sections/03-methods/03-01-SUMMARY.md
**Reviewer:** User via /wtfp:review-section

## Open Issues

### REV-001: Sample size justification missing

**Discovered:** 2025-01-15
**Section/Plan:** 03-01
**Severity:** Major
**Verification Layer:** Coherence
**Description:** The methods section states N=45 but provides no justification for this sample size. Reviewers typically expect power analysis or precedent citation.
**Location:** Participants subsection, paragraph 2
**Expected:** Justification for sample size (power analysis, precedent, or acknowledged limitation)
**Actual:** Just states "Forty-five participants were recruited" with no justification
**Suggested Fix:** Add either (a) power analysis showing N=45 sufficient for expected effect size, (b) citation to similar studies with comparable N, or (c) acknowledge as limitation

### REV-002: Missing IRB number

**Discovered:** 2025-01-15
**Section/Plan:** 03-01
**Severity:** Critical
**Verification Layer:** Rubric
**Description:** Journal requirements specify IRB approval number must appear in methods. Currently absent.
**Location:** Ethical considerations paragraph
**Expected:** "This study was approved by [Institution] IRB (#XXXX-XXXX)"
**Actual:** States "This study was approved by the institutional review board" without number
**Suggested Fix:** Add IRB number from user's records: #2024-0123

### REV-003: Passive voice in procedure description

**Discovered:** 2025-01-15
**Section/Plan:** 03-01
**Severity:** Polish
**Verification Layer:** Rubric
**Description:** Journal style guide prefers active voice. Several sentences use passive construction.
**Location:** Procedure subsection, sentences 2-4
**Expected:** Active voice: "Participants completed..."
**Actual:** Passive voice: "The survey was completed by participants..."
**Suggested Fix:** Convert to active voice throughout procedure

## Resolved Issues

[None yet]

---

*Section: 03-methods*
*Plan: 01*
*Reviewed: 2025-01-15*
```
</good_examples>

<guidelines>
**When to create:**
- First time /wtfp:review-section finds an issue for a plan
- One file per plan reviewed

**Location:**
- `.planning/sections/XX-name/{section}-{plan}-ISSUES.md`
- Lives alongside SUMMARY.md being reviewed

**Difference from global ISSUES.md:**
- Global ISSUES.md: Deferred enhancements (nice-to-haves)
- Revision ISSUES.md: Actual problems found during review

**Workflow:**
1. /wtfp:review-section creates this file with issues
2. /wtfp:plan-revision reads this file and creates FIX.md plan
3. After FIX.md executes, issues move to "Resolved" section
4. File becomes historical record of what was found and fixed

**Resolution:**
- Don't delete resolved issues - move to "Resolved Issues" section
- Include fix reference (commit hash, plan that fixed it)
- File serves as audit trail

**Severity assignment:**
- Critical: Would cause rejection - must fix before submission
- Major: Significant weakness - should fix before submission
- Minor: Noticeable issue - fix if time permits
- Polish: Optional improvement - defer to final pass
</guidelines>
