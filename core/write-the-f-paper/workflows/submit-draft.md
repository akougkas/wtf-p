<purpose>
Prepare a completed draft for submission. Run final verification, compile output,
generate submission checklist, and archive the submission round.

This workflow marks the end of a writing milestone and prepares for either
submission or revision cycle.
</purpose>

<when_to_use>
- All sections are complete
- Document is ready for submission or review
- User wants to compile final output
- Preparing for peer review
- Creating submission package
</when_to_use>

<process>

<step name="verify_document_complete" priority="first">
Check that all sections are complete:

```bash
# Check roadmap for incomplete sections
cat .planning/ROADMAP.md | grep -E "^\s*-\s*\[.\]" | grep -v "\[x\]"
```

**If incomplete sections found:**

```
Document has incomplete sections:
[List incomplete sections]

Options:
1. Complete remaining sections first
2. Submit partial draft (mark incomplete sections)
3. Review what's left
```

Wait for user decision.

**If all sections complete:**
Continue to full_verification.
</step>

<step name="full_verification">
Run comprehensive verification across all sections.

**Layer 1: Citation Check (Mechanical)**

```
Scanning all sections for citation issues...

## Citation Inventory

Total citations: [N]
Unique sources: [N]
Bibliography entries: [N]

### Citation Issues
- [ ] [Any uncited claims]
- [ ] [Any broken references]
- [ ] [Any format inconsistencies]

### Bibliography Check
- [ ] All in-text citations have bibliography entries
- [ ] No orphan bibliography entries
- [ ] Format consistent throughout
```

**Layer 2: Argument Coherence (Logical)**

```
Checking argument flow across sections...

## Argument Assessment

### Thesis Support
Central claim: [from PROJECT.md]

Support chain:
- Introduction establishes: [check]
- Methods supports: [check]
- Results demonstrate: [check]
- Discussion interprets: [check]

### Cross-Section Consistency
- [ ] No contradictions between sections
- [ ] Terminology consistent
- [ ] Claims match evidence

### Flow
- [ ] Transitions between sections smooth
- [ ] Narrative arc complete
- [ ] Reader journey makes sense
```

**Layer 3: Rubric Check (Requirements)**

```
Checking submission requirements...

## Requirements Check

### Document Structure
- [ ] All required sections present
- [ ] Section order correct
- [ ] Abstract present and complete

### Length
Target: [from PROJECT.md]
Actual: [calculated]
Status: [within limits / over / under]

### Formatting
- [ ] Title page (if required)
- [ ] Author information (if required)
- [ ] Page numbers
- [ ] Margins and spacing
- [ ] Font requirements

### Required Elements
[Based on venue/type:]
- [ ] [Required element 1]
- [ ] [Required element 2]
- [ ] [Required element 3]
```

**Present verification summary:**

```
## Full Document Verification

### Results
- Citation Check: [PASS/ISSUES - N issues]
- Coherence Check: [PASS/ISSUES - N issues]
- Rubric Check: [PASS/ISSUES - N issues]

### Issues Found
[List any issues by severity: Critical, Major, Minor]

### Verdict
[READY FOR SUBMISSION / NEEDS WORK / CRITICAL ISSUES]
```

If issues found, ask if user wants to address them or proceed anyway.
</step>

<step name="compile_output">
Compile the final document output.

**Determine output format:**
```bash
cat .planning/PROJECT.md | grep -i "format\|output"
```

**For LaTeX output:**
```bash
# Compile LaTeX
cd paper/
pdflatex paper.tex
bibtex paper
pdflatex paper.tex
pdflatex paper.tex
```

**For Markdown output:**
```bash
# Concatenate sections
cat paper/sections/*.md > paper/paper-full.md
```

**Verify output:**
```bash
ls -la paper/paper.pdf 2>/dev/null || ls -la paper/paper-full.md
```

**Report:**
```
## Compiled Output

Output file: [path]
Format: [LaTeX PDF / Markdown / Other]
Word count: [final count]
Pages: [if applicable]
```
</step>

<step name="generate_submission_checklist">
Generate submission-specific checklist based on venue.

```
## Submission Checklist

### Document
- [ ] Title page complete and accurate
- [ ] Abstract within word limit
- [ ] All sections present and complete
- [ ] References formatted per venue style
- [ ] Figures/tables numbered and captioned

### Files
- [ ] Main document file ([format])
- [ ] Separate figures (if required)
- [ ] Supplementary materials (if applicable)
- [ ] Cover letter (if required)

### Venue Requirements
[Parse from PROJECT.md constraints]
- [ ] [Venue-specific requirement 1]
- [ ] [Venue-specific requirement 2]
- [ ] [Venue-specific requirement 3]

### Final Checks
- [ ] Author names spelled correctly
- [ ] Affiliations accurate
- [ ] Corresponding author designated
- [ ] Keywords provided (if required)
- [ ] Funding acknowledgments (if applicable)
- [ ] Conflict of interest statement (if required)

### Before Clicking Submit
- [ ] Co-authors have approved final version
- [ ] Read through one more time
- [ ] Checked submission portal requirements
```
</step>

<step name="create_submission_archive">
Archive this submission round for future reference.

```bash
mkdir -p .planning/submissions/round-1
```

**Copy key files to archive:**

```bash
# Copy final output
cp paper/paper.pdf .planning/submissions/round-1/ 2>/dev/null
cp paper/paper-full.md .planning/submissions/round-1/ 2>/dev/null

# Create submission record
cat > .planning/submissions/round-1/SUBMISSION.md << 'EOF'
# Submission Round 1

## Submission Details
- **Date:** [today]
- **Venue:** [from PROJECT.md]
- **Title:** [from PROJECT.md]
- **Word count:** [final count]

## Document State
- All sections: Complete
- Verification: [PASS/status]
- Output: [file name]

## Files Submitted
- [List files]

## Notes
[Any submission notes]

## For Revision
If revisions requested, see:
- /wtfp:plan-revision - Create revision plan
- .planning/submissions/round-1/reviewer-comments.md - Import comments here
EOF
```

Commit the archive:
```bash
git add .planning/submissions/round-1/
git commit -m "docs: archive submission round 1

- Document complete and verified
- [N] sections, [word count] words
- Ready for submission to [venue]
"
```
</step>

<step name="update_state">
Update STATE.md to reflect submission:

```markdown
## Current Position

Section: [N] of [N] (Complete)
Plan: All complete
Status: Submitted (Round 1)
Last activity: [today] — Prepared submission

## Word Count

Target: [target] words
Final: [actual] words

## Submission History

| Round | Date | Venue | Status |
|-------|------|-------|--------|
| 1 | [today] | [venue] | Submitted |
```
</step>

<step name="offer_next">
Present completion summary and next steps:

```
## Submission Prepared

**Document:** [title]
**Venue:** [venue]
**Word count:** [final]
**Output:** [file path]

**Archive created:** .planning/submissions/round-1/

---

## Submission Checklist

[Present the generated checklist]

---

## After Submission

When you receive reviewer feedback:

`/wtfp:plan-revision` — Import comments and create revision plan

---

## Also Available

- Review compiled output
- Re-run verification
- Edit before final submission

---
```
</step>

</process>

<revision_cycle>
**After receiving reviewer feedback:**

1. Import comments: Create `.planning/submissions/round-1/reviewer-comments.md`
2. Run `/wtfp:plan-revision` to create revision plan
3. Execute revisions as new writing plans
4. Run `/wtfp:submit-draft` again for Round 2

This creates a clear record of each submission round and its revisions.
</revision_cycle>

<success_criteria>
Submit draft is complete when:
- [ ] All sections verified as complete
- [ ] Full verification run (citation, coherence, rubric)
- [ ] Critical issues addressed (or explicitly deferred)
- [ ] Output compiled (PDF or final document)
- [ ] Submission checklist generated
- [ ] Archive created for this round
- [ ] STATE.md updated
- [ ] User knows next steps (submit, then await feedback)
</success_criteria>
