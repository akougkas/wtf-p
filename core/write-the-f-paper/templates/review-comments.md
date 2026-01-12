# Review Comments Template

Template for `.planning/revisions/round-[N]/reviewer-comments.md` — importing reviewer feedback.

**Purpose:** Capture and organize reviewer comments for systematic response.

---

## File Template

```markdown
# Reviewer Comments: Round [N]

**Received:** [date]
**Decision:** [Accept / Minor Revision / Major Revision / Reject with Resubmit / Reject]
**Response deadline:** [date]

## Editor Summary

> [Editor's summary or cover letter text, if provided]

**Editor's key points:**
- [Point 1]
- [Point 2]

---

## Reviewer 1

**Expertise:** [If stated: "Expert in X" / "Familiar with Y"]
**Recommendation:** [If stated: Accept / Minor / Major / Reject]
**Overall tone:** [Positive / Mixed / Critical / Constructive]

### Summary Comments

> [Reviewer's overall assessment, quoted verbatim]

### Detailed Comments

#### R1.1: [Brief summary]

**Type:** [Required / Suggested / Question / Minor]
**Section:** [Which section this concerns]

> "[Exact quote from reviewer]"

**Our understanding:** [What they're asking for]
**Severity:** [Critical / Major / Minor]

---

#### R1.2: [Brief summary]

**Type:** [Required / Suggested / Question / Minor]
**Section:** [Which section]

> "[Exact quote from reviewer]"

**Our understanding:** [What they're asking for]
**Severity:** [Critical / Major / Minor]

---

[Continue for all comments...]

---

## Reviewer 2

**Expertise:** [If stated]
**Recommendation:** [If stated]
**Overall tone:** [Assessment]

### Summary Comments

> [Reviewer's overall assessment]

### Detailed Comments

#### R2.1: [Brief summary]

**Type:** [Required / Suggested / Question / Minor]
**Section:** [Which section]

> "[Exact quote]"

**Our understanding:** [What they're asking for]
**Severity:** [Critical / Major / Minor]

---

[Continue for all comments...]

---

## Reviewer 3 (if applicable)

[Same structure...]

---

## Comment Summary

### By Priority

**Critical (must address):**
- R1.2: [Summary]
- R2.1: [Summary]

**Major (should address):**
- R1.1: [Summary]
- R2.3: [Summary]

**Minor (nice to address):**
- R1.4: [Summary]
- R2.5: [Summary]

### By Section

| Section | Comments | Critical | Major | Minor |
|---------|----------|----------|-------|-------|
| Introduction | R1.1, R2.2 | 0 | 1 | 1 |
| Methods | R1.2, R2.1, R3.1 | 1 | 1 | 1 |
| Results | R2.3 | 0 | 1 | 0 |
| Discussion | R1.3, R2.4 | 0 | 1 | 1 |

### Cross-Reviewer Themes

**Multiple reviewers mentioned:**
- [Theme 1]: R1.1, R2.2 — [Common concern]
- [Theme 2]: R1.3, R2.4, R3.2 — [Common concern]

---

*Reviews imported: [date]*
*Ready for: /wtfp:plan-revision*
```

<guidelines>

**Importing reviews:**
1. Copy exact text from review system
2. Quote verbatim (don't paraphrase)
3. Add your understanding beneath
4. Classify by type and severity

**Comment types:**
- Required: Must change or address
- Suggested: Recommended but optional
- Question: Clarification needed
- Minor: Typos, small fixes

**Severity levels:**
- Critical: Would cause rejection if unaddressed
- Major: Significant weakness
- Minor: Would improve but not required

**Comment numbering:**
- R1.1, R1.2: Reviewer 1, comments 1, 2
- R2.1, R2.2: Reviewer 2, comments 1, 2
- Enables precise reference in response

**Cross-reviewer analysis:**
- Identify common themes
- Multiple mentions = higher priority
- Consensus issues need strongest response

**After import:**
1. Run /wtfp:plan-revision to create fix plan
2. Execute fixes
3. Create response letter
4. Verify all comments addressed
</guidelines>

<example>
```markdown
# Reviewer Comments: Round 1

**Received:** 2025-04-15
**Decision:** Major Revision
**Response deadline:** 2025-05-15

## Editor Summary

> The reviewers appreciate the novel contribution but have concerns about methodology and generalizability. Please address all comments thoroughly.

**Editor's key points:**
- Strengthen methods section
- Address generalizability concerns
- Add statistical detail

---

## Reviewer 1

**Expertise:** Expert in HCI research methods
**Recommendation:** Major Revision
**Overall tone:** Constructive

### Summary Comments

> "This paper addresses an important and timely topic. The framework is novel and potentially useful. However, I have concerns about the methodology and sample size that need to be addressed."

### Detailed Comments

#### R1.1: Sample size justification

**Type:** Required
**Section:** Methods

> "The sample size of N=45 is not justified. Please provide a power analysis or cite precedent studies that support this sample size for the type of analysis conducted."

**Our understanding:** Need to justify N=45 with power analysis or precedent
**Severity:** Critical

---

#### R1.2: Participant demographics

**Type:** Suggested
**Section:** Methods

> "Table 1 would benefit from additional demographic information including years of experience and prior AI tool usage."

**Our understanding:** Expand demographics table
**Severity:** Major

---

## Comment Summary

### By Priority

**Critical (must address):**
- R1.1: Sample size justification
- R2.1: Statistical test details

**Major (should address):**
- R1.2: Expand demographics
- R2.3: Clarify framework validation

### Cross-Reviewer Themes

**Multiple reviewers mentioned:**
- Methods detail: R1.1, R1.2, R2.1 — Need more methodological rigor
- Generalizability: R1.3, R2.4 — Concern about two-discipline limitation

---

*Reviews imported: 2025-04-15*
*Ready for: /wtfp:plan-revision*
```
</example>
