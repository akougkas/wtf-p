# Peer Review Reference

Reference document for understanding and responding to peer review.

**Purpose:** Guide for interpreting reviewer comments and planning revisions.

---

## Understanding Reviewer Comments

### Comment Types

| Type | Definition | Response Strategy |
|------|------------|-------------------|
| **Required changes** | "Must revise X" | Fix exactly as requested |
| **Suggestions** | "Consider adding Y" | Address or explain why not |
| **Questions** | "Why did you choose Z?" | Answer clearly in revision |
| **Concerns** | "I worry about the validity of..." | Address substantively |
| **Minor notes** | "Typo on p. 5" | Fix immediately |

### Reading Between the Lines

**What they say → What they often mean:**

- "This is unclear" → Rewrite this section
- "More detail needed" → I couldn't follow your reasoning
- "Citation needed" → This claim seems unsupported
- "Consider X approach" → Why didn't you use X?
- "The contribution is incremental" → I don't see the significance
- "The sample size is small" → Acknowledge this limitation

### Severity Assessment

| Signal | Likely Meaning | Response Effort |
|--------|----------------|-----------------|
| "Minor revision" | Mostly good, small fixes | Days to a week |
| "Major revision" | Solid core, significant work needed | Weeks to months |
| "Reject with option to resubmit" | Fundamental issues, consider rethinking | Major rewrite |
| "Reject" | Wrong venue or fundamental flaws | New submission elsewhere |

## Response Letter Structure

```markdown
# Response to Reviewers

Dear Editor and Reviewers,

Thank you for the constructive feedback. We have carefully addressed all comments. Changes are highlighted in [blue/yellow] in the revised manuscript.

Below we respond to each comment in detail.

---

## Response to Reviewer 1

### Comment R1.1
> [Exact quote of reviewer comment]

**Response:** [How you addressed it]

**Changes made:** [Page X, paragraph Y: specific changes]

### Comment R1.2
> [Exact quote]

**Response:** [Your response]

**Changes made:** [Specific locations]

[Continue for all comments...]

---

## Response to Reviewer 2

[Same structure...]

---

## Summary of Major Changes

1. [Major change 1]
2. [Major change 2]
3. [Major change 3]

Thank you again for the opportunity to improve our work.

Sincerely,
[Authors]
```

## Common Issues and Solutions

### "The contribution is not clear"
- Rewrite Introduction gap and contribution sections
- Add explicit contribution statement
- Strengthen the "so what" in Discussion

### "Methods lack detail"
- Add procedural specifics
- Include participant demographics
- Specify statistical tests with justification

### "Sample size concerns"
- Add power analysis (if available)
- Cite precedent studies with similar N
- Acknowledge as limitation with effect size discussion

### "Missing related work"
- Add suggested citations
- Explain how your work relates
- Position contribution more clearly

### "Claims unsupported"
- Add citations for each claim
- Qualify overly strong claims
- Add "future work" for unverified claims

### "Statistical issues"
- Consult statistician if needed
- Justify test choices
- Report effect sizes, not just p-values

## Revision Workflow

1. **Import comments** → `/wtfp:import-reviews`
2. **Categorize by severity** → Critical / Major / Minor
3. **Create revision plan** → `/wtfp:plan-revision`
4. **Execute revisions** → `/wtfp:write-section`
5. **Write response letter** → `/wtfp:respond-reviews`
6. **Verify changes** → `/wtfp:review-section`

## Response Tone Guide

**Do:**
- Thank reviewers for helpful comments
- Be specific about changes made
- Explain reasoning when not making a change
- Quote the exact comment before responding
- Point to specific page/line numbers

**Don't:**
- Be defensive or dismissive
- Make excuses
- Ignore any comment
- Over-promise or under-deliver
- Argue with reviewer opinions

---

*Peer review reference document*
*Consult for revision planning*
