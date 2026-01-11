<purpose>
Run three-layer verification on written sections. Extract deliverables from SUMMARY.md,
generate verification checklist, guide user through each check, log issues.

The USER performs judgment-based verification — Claude runs mechanical checks,
identifies potential issues, and guides the verification process.
</purpose>

<three_layers>
Academic writing verification has three distinct layers:

**1. Citation Check (Mechanical)** - Claude can run this
- All claims have citations where needed
- Citations formatted correctly for style
- All cited works appear in bibliography
- No broken references or [CITE:] placeholders
- Page numbers where required by style

**2. Argument Coherence (Logical)** - Claude identifies, user verifies
- Claims follow from evidence
- No logical contradictions
- Thesis supported throughout
- Counterarguments addressed
- Flow between paragraphs

**3. Rubric Check (Requirements)** - Both verify
- Required sections present
- Word/page limits met
- Formatting requirements met
- All required elements included
- Submission checklist complete
</three_layers>

<process>

<step name="identify">
**Determine what to verify:**

If $ARGUMENTS provided:
- Parse as section number (e.g., "4") or plan number (e.g., "04-02")
- Find corresponding SUMMARY.md file(s)

If no arguments:
- Find most recently modified SUMMARY.md

```bash
find .planning/sections -name "*SUMMARY.md" -type f -exec ls -lt {} + | head -5
```

Read the SUMMARY.md to understand what was written.
</step>

<step name="extract">
**Extract verifiable elements from SUMMARY.md:**

Parse for:
1. **Claims made** - Statements that need citations
2. **Citations used** - References added
3. **Word count** - Against target
4. **Section goal** - Was it accomplished?

Focus on VERIFIABLE outcomes:

Examples:
- "Introduction establishes research gap" → Check: gap clearly stated
- "Three prior approaches cited" → Check: verify three relevant citations
- "Methods section ~500 words" → Check: actual word count
</step>

<step name="layer_1_citation_check">
**Run Citation Check (Mechanical):**

Claude performs these checks directly:

```
## Layer 1: Citation Check

Scanning [section/file] for citation issues...

### All Claims Have Citations
- [ ] [Claim 1] - citation: [present/missing]
- [ ] [Claim 2] - citation: [present/missing]
[List all factual claims and their citation status]

### Citation Format
Style: [detected/specified style - APA, IEEE, etc.]
- [ ] Author-year format consistent
- [ ] Et al. used correctly
- [ ] Punctuation correct

### Bibliography Match
- [ ] All in-text citations appear in references
- [ ] No orphan references (in bibliography but not cited)
- [ ] All [CITE:] placeholders resolved

### Issues Found
[List any mechanical citation issues]
```

**If issues found:**
Present for resolution before continuing.
</step>

<step name="layer_2_coherence_check">
**Prepare Argument Coherence Check (Logical):**

Claude identifies potential issues, user verifies:

```
## Layer 2: Argument Coherence

### Thesis Support
Central claim: [from argument-map.md]

This section should support it by: [expected contribution]

**Check:** Does the section actually advance the thesis?

### Logical Flow
Reading the section for argument structure...

Paragraph flow:
1. [Para 1 purpose] → [Para 2 purpose] → [Para 3 purpose]

**Potential gaps identified:**
- [Gap 1]: Between [X] and [Y], transition unclear
- [Gap 2]: Claim [Z] not fully supported

### Contradiction Check
Cross-referencing with prior sections...

**Potential contradictions:**
- [None found / List any inconsistencies]

### Counterargument Coverage
For claims that might face objection:
- [Claim]: [Counterargument addressed? Y/N]
```

Use AskUserQuestion for each potential issue:
- header: "[Issue type]"
- question: "[Describe the potential issue] - Is this actually a problem?"
- options:
  - "Not an issue" — The logic is sound
  - "Minor issue" — Note but don't block
  - "Major issue" — Needs fixing
  - "Let me look" — I need to review the text
</step>

<step name="layer_3_rubric_check">
**Run Rubric Check (Requirements):**

```
## Layer 3: Rubric Check

### Required Elements
[Based on document type and venue requirements]

- [ ] [Required element 1]: [present/missing]
- [ ] [Required element 2]: [present/missing]
[Check all required elements for this section type]

### Word Count
Target: [from ROADMAP.md]
Actual: [count from written content]
Status: [within range / over / under by X%]

### Formatting
- [ ] Heading levels correct
- [ ] Figure/table formatting (if applicable)
- [ ] Reference style consistent

### Section-Specific Requirements
[Based on section type - e.g., for Methods:]
- [ ] Participants/setting described
- [ ] Procedure clear
- [ ] Measures defined
- [ ] Analysis approach stated
```
</step>

<step name="collect_issues">
**Collect and categorize all issues:**

For each issue identified across three layers:

```
### Issue Summary

**Layer 1 (Citation) Issues:**
- [Issue]: [Severity] - [Brief description]

**Layer 2 (Coherence) Issues:**
- [Issue]: [Severity] - [Brief description]

**Layer 3 (Rubric) Issues:**
- [Issue]: [Severity] - [Brief description]
```

Severity levels:
- **Critical** — Must fix before submission (factual error, missing required element)
- **Major** — Should fix (logical gap, weak support)
- **Minor** — Consider fixing (polish, enhancement)
- **Note** — Awareness item (not blocking)
</step>

<step name="log_issues">
**Log issues to section file if found:**

If any Critical or Major issues:

Create `.planning/sections/XX-name/{section}-ISSUES.md`:

```markdown
# Section [X] Verification Issues

## Summary
- Critical: [N]
- Major: [N]
- Minor: [N]

## Critical Issues

### CRIT-001: [Brief description]
**Layer:** [Citation/Coherence/Rubric]
**Location:** [paragraph/claim/element]
**Issue:** [Full description]
**Fix needed:** [What needs to change]

## Major Issues

### MAJ-001: [Brief description]
[Same format]

## Minor Issues
[List briefly]

## Verification Date
[Date of this review]
```
</step>

<step name="summarize">
**Present verification summary:**

```
# Verification Results: [Section Name]

## Layer Scores
- Citation Check: [PASS/ISSUES - N issues]
- Coherence Check: [PASS/ISSUES - N issues]
- Rubric Check: [PASS/ISSUES - N issues]

## Overall Status

[Based on issues found:]
- ALL PASS: "Section verified. Ready to proceed."
- MINOR ONLY: "Section solid with minor polish opportunities."
- MAJOR ISSUES: "Section needs revisions before proceeding."
- CRITICAL: "Critical issues found - must address before continuing."

## Issues by Priority

[If issues exist:]
**Must Fix:**
- [Critical issue 1]
- [Major issue 1]

**Should Fix:**
- [Major issue 2]
- [Minor issue 1]

**Consider:**
- [Minor issues]

## Next Steps
[Based on verdict:]
- If clean: Proceed to next section
- If issues: /wtfp:plan-revision to address
```
</step>

<step name="offer_next">
**Offer next actions based on results:**

Use AskUserQuestion:
- header: "Next"
- question: "What would you like to do?"
- options (based on results):

If all passed:
- "Continue to next section" — Proceed with confidence
- "Verify more" — Run additional checks
- "Done" — Finish verification session

If issues found:
- "Plan revision" — Create plan to fix issues (/wtfp:plan-revision)
- "Fix now" — Address issues immediately
- "Log and continue" — Issues logged, proceed anyway
- "Done" — Finish verification session
</step>

</process>

<verification_by_section_type>
**Different sections emphasize different checks:**

| Section | Citation Heavy | Coherence Heavy | Rubric Heavy |
|---------|---------------|-----------------|--------------|
| Abstract | Low | Medium | High (word limit) |
| Introduction | High (gap) | High (argument) | Medium |
| Related Work | Very High | High (synthesis) | Medium |
| Methods | Low | Medium | High (completeness) |
| Results | Low (own data) | Medium | High (all findings) |
| Discussion | High (context) | Very High | Medium |

Adjust verification emphasis accordingly.
</verification_by_section_type>

<success_criteria>
- [ ] Section/plan identified from SUMMARY.md
- [ ] Layer 1 (Citation) check completed
- [ ] Layer 2 (Coherence) issues identified for user verification
- [ ] Layer 3 (Rubric) check completed
- [ ] All issues categorized by severity
- [ ] Issues logged to section ISSUES.md if Critical/Major
- [ ] Summary presented with clear verdict
- [ ] User knows next steps based on results
</success_criteria>
