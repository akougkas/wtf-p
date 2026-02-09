---
name: wtfp:audit-milestone
description: Run pre-submission checks on sections, citations, and word counts
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Check paper readiness before submission.

Runs 5 audit checks:
1. Section completion status
2. Argument coverage (all claims addressed)
3. Word targets (within tolerance)
4. Citation completeness (all resolved)
5. Review status (all sections reviewed)

Produces MILESTONE-AUDIT.md with pass/gap for each criterion.
</objective>

<process>

<step name="validate">
**Step 1: Validate Environment**

```bash
[ ! -f .planning/PROJECT.md ] && echo "ERROR: No PROJECT.md found" && exit 1
[ ! -f .planning/ROADMAP.md ] && echo "ERROR: No ROADMAP.md found" && exit 1
[ ! -f .planning/STATE.md ] && echo "ERROR: No STATE.md found" && exit 1
```

</step>

<step name="banner">
**Step 2: Display Banner**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► AUDITING MILESTONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Running 5 pre-submission checks...
```

</step>

<step name="check_sections">
**Check 1: Section Completion**

Read ROADMAP.md. For each section entry:
- Is it marked `[x]` complete?
- Extract section name and completion status

Count:
- `TOTAL_SECTIONS`: Number of section entries
- `COMPLETE_SECTIONS`: Number with `[x]`
- `INCOMPLETE_SECTIONS`: Number with `[ ]`

**Result:**
- PASS if `COMPLETE_SECTIONS == TOTAL_SECTIONS`
- GAP if any sections incomplete

Store result:
```
CHECK_1_STATUS="{PASS|GAP}"
CHECK_1_DETAIL="{M}/{N} complete"
CHECK_1_GAPS="{list of incomplete section names, if any}"
```

</step>

<step name="check_arguments">
**Check 2: Argument Coverage**

Read `.planning/structure/argument-map.md` if it exists.

Extract all claims (lines starting with `- **Claim**:` or numbered claims).

For each claim:
- Search paper content files (`paper/` directory or equivalent)
- Check if evidence of the claim being addressed exists

**Result:**
- PASS if all claims addressed
- GAP listing unaddressed claims

Store result:
```
CHECK_2_STATUS="{PASS|GAP}"
CHECK_2_DETAIL="{M}/{N} claims addressed"
CHECK_2_GAPS="{list of unaddressed claims, if any}"
```

If argument-map.md doesn't exist:
```
CHECK_2_STATUS="SKIP"
CHECK_2_DETAIL="No argument-map.md found"
```

</step>

<step name="check_words">
**Check 3: Word Targets**

Read `.planning/structure/outline.md` for word budget per section.

For each section:
- Count actual words in the paper content file
- Compare to target from outline

**Tolerance:** +/- 15% of target per section

**Result:**
- PASS if all sections within range
- GAP listing sections outside range (with actual vs target)

Store result:
```
CHECK_3_STATUS="{PASS|GAP}"
CHECK_3_DETAIL="{N}/{M} sections within range"
CHECK_3_GAPS="{list of sections outside range: 'Section X: Y words (target: Z, variance: +/-W%)'}"
```

If outline.md doesn't exist or has no word targets:
```
CHECK_3_STATUS="SKIP"
CHECK_3_DETAIL="No word targets defined in outline.md"
```

</step>

<step name="check_citations">
**Check 4: Citation Completeness**

Scan all paper content files for citation patterns:
- `(Author, Year)` - APA style
- `\cite{key}` - LaTeX style
- `[@key]` - Pandoc/markdown style
- `[N]` - IEEE style

Cross-reference with bibliography file:
- `references.bib` (BibTeX)
- `.planning/sources/bibliography.md`
- Any `.bib` files in project

Check for:
1. **Uncited references**: Entries in bibliography not cited in text
2. **Undefined citations**: Citations in text not in bibliography

**Result:**
- PASS if all citations resolved
- GAP listing issues

Store result:
```
CHECK_4_STATUS="{PASS|GAP}"
CHECK_4_DETAIL="{N} issues found"
CHECK_4_GAPS="{list: 'Uncited: [keys]', 'Undefined: [keys]'}"
```

If no bibliography file found:
```
CHECK_4_STATUS="SKIP"
CHECK_4_DETAIL="No bibliography file found"
```

</step>

<step name="check_reviews">
**Check 5: Review Status**

For each section:
- Check if review SUMMARY.md exists in `.planning/sections/{section}/`
- Or check if "review: pass" noted in section summary

**Result:**
- PASS if all sections reviewed
- GAP listing unreviewed sections

Store result:
```
CHECK_5_STATUS="{PASS|GAP}"
CHECK_5_DETAIL="{M}/{N} sections reviewed"
CHECK_5_GAPS="{list of unreviewed sections}"
```

</step>

<step name="write_audit">
**Step 3: Write MILESTONE-AUDIT.md**

Determine overall status:
- `OVERALL="PASS"` if all checks pass or skip
- `OVERALL="GAPS FOUND"` if any check has GAP status

Write `.planning/MILESTONE-AUDIT.md`:

```markdown
# Milestone Audit

**Date:** {YYYY-MM-DD}
**Overall:** {PASS | GAPS FOUND}

## Results

| Check | Status | Details |
|-------|--------|---------|
| Section Completion | {PASS/GAP/SKIP} | {CHECK_1_DETAIL} |
| Argument Coverage | {PASS/GAP/SKIP} | {CHECK_2_DETAIL} |
| Word Targets | {PASS/GAP/SKIP} | {CHECK_3_DETAIL} |
| Citation Completeness | {PASS/GAP/SKIP} | {CHECK_4_DETAIL} |
| Review Status | {PASS/GAP/SKIP} | {CHECK_5_DETAIL} |

## Gaps

{For each GAP status, create a subsection:}

### {Check Name}
- **Status:** gap
- **Finding:** {what's missing}
- **Affected:** {sections/claims/files}
- **Recommendation:** {what to do}

{If no gaps:}
No gaps found. Paper is ready for submission.

## Summary

{If PASS: "Paper is ready for submission. Run `/wtfp:submit-milestone {version}` to archive."}
{If GAPS: "Found {N} gaps requiring attention. Run `/wtfp:plan-milestone-gaps` to create fix plans."}
```

</step>

<step name="present_results">
**Step 4: Present Results**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► AUDIT COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall: {PASS | GAPS FOUND}

Results:
  ✓ Section Completion: {details}
  ✓ Argument Coverage: {details}
  ✓ Word Targets: {details}
  ✓ Citation Completeness: {details}
  ✓ Review Status: {details}

{Use ✓ for PASS, ✗ for GAP, — for SKIP}

Audit saved to: .planning/MILESTONE-AUDIT.md

───────────────────────────────────────────

## Next Up

{If PASS:}
**Ready to submit:**
  `/wtfp:submit-milestone {version}`

{If GAPS:}
**Fix gaps first:**
  `/wtfp:plan-milestone-gaps` - Create fix plans from audit

───────────────────────────────────────────
```

</step>

</process>

<success_criteria>
- [ ] Environment validated
- [ ] 5 audit checks run (section, argument, word, citation, review)
- [ ] MILESTONE-AUDIT.md created with pass/gap per check
- [ ] Gaps include actionable recommendations
- [ ] Next steps offered based on result
</success_criteria>
