---
name: wtfp:review-section
description: Run 3-layer verification on written sections
argument-hint: "[section]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
User acceptance testing of written sections.

Runs 3-layer verification:
1. Citation Check (Mechanical)
2. Argument Coherence (Logical)
3. Rubric Check (Requirements)

Creates ISSUES.md if problems found.

User performs verification; Claude guides and documents.
</objective>

<execution_context>
@./.claude/write-the-f-paper/workflows/review-section.md
</execution_context>

<process>

<step name="verify">
**Verify section exists:**

```bash
# Check for written content
ls paper/*.md 2>/dev/null || echo "No content in paper/ directory"

# Check for SUMMARY indicating writing complete
ls .planning/sections/*/SUMMARY.md 2>/dev/null | head -5
```

</step>

<step name="load">
**Load context for review:**

- Read the written section content (paper/[section].md)
- Read PROJECT.md for requirements
- Read argument-map.md for expected claims
- Read outline.md for structure expectations
- Read sources/literature.md for citation expectations
- Read SUMMARY.md for what was intended
</step>

<step name="citation_check">
**Layer 1: Citation Check (Mechanical)**

Present checklist to user:

```
## Citation Check

Review the section for citation issues:

- [ ] All factual claims have citations
- [ ] Citations formatted correctly ([Author, Year] or footnote)
- [ ] All cited works appear in bibliography/references
- [ ] No [?] or placeholder citations
- [ ] Page numbers included where required
- [ ] Self-citations appropriate (not excessive)

**Issues found:**
```

Use AskUserQuestion:
- header: "Citations"
- question: "Any citation issues found?"
- options:
  - "All clear" — Citations look good
  - "Issues found" — I'll list them
  - "Skip this check" — Move to next layer

If issues found, prompt for details.

</step>

<step name="coherence_check">
**Layer 2: Argument Coherence (Logical)**

Present checklist:

```
## Argument Coherence

Review the section's logical flow:

- [ ] Claims follow logically from evidence
- [ ] No logical contradictions
- [ ] Counterarguments addressed (if relevant)
- [ ] Thesis/core argument supported
- [ ] Paragraphs flow naturally
- [ ] Transitions connect ideas
- [ ] No unsupported claims

**Cross-reference with argument-map.md:**
- [ ] Claim 1 addressed: [yes/no/partial]
- [ ] Claim 2 addressed: [yes/no/partial]
- [ ] ...

**Issues found:**
```

Use AskUserQuestion:
- header: "Coherence"
- question: "Any logical/flow issues found?"
- options:
  - "All clear" — Logic flows well
  - "Issues found" — I'll list them
  - "Skip this check" — Move to next layer

</step>

<step name="rubric_check">
**Layer 3: Rubric Check (Requirements)**

Present checklist based on PROJECT.md requirements:

```
## Rubric Check

Review against requirements:

**Structure:**
- [ ] All required elements present
- [ ] Follows expected structure (IMRaD, etc.)
- [ ] Appropriate for target venue

**Length:**
- [ ] Word count: [current] / [target] ([variance]%)
- [ ] Within acceptable range

**Formatting:**
- [ ] Heading levels correct
- [ ] Figure/table references correct
- [ ] Consistent style throughout

**Content Requirements:**
- [ ] [Requirement 1 from PROJECT.md]: [met/not met]
- [ ] [Requirement 2 from PROJECT.md]: [met/not met]

**Issues found:**
```

Use AskUserQuestion:
- header: "Requirements"
- question: "Any requirement issues found?"
- options:
  - "All clear" — Requirements met
  - "Issues found" — I'll list them

</step>

<step name="issues">
**Create ISSUES.md if problems found:**

```markdown
---
section: XX-name
plan: YY
review_date: [date]
---

# Review Issues: [Section Name]

## Citation Issues
| ID | Issue | Severity | Location |
|----|-------|----------|----------|
| CIT-1 | [description] | [Major/Minor] | [line/para] |

## Coherence Issues
| ID | Issue | Severity | Location |
|----|-------|----------|----------|
| COH-1 | [description] | [Major/Minor] | [line/para] |

## Requirement Issues
| ID | Issue | Severity | Requirement |
|----|-------|----------|-------------|
| REQ-1 | [description] | [Major/Minor] | [which req] |

## Summary
- Total issues: [N]
- Blockers (must fix): [N]
- Major (should fix): [N]
- Minor (nice to fix): [N]

---
*Reviewed: [date]*
```

</step>

<step name="commit">
```bash
git add .planning/sections/XX-name/XX-YY-ISSUES.md
git commit -m "$(cat <<'EOF'
review(XX-YY): [section name] verification

Issues found: [N] ([blockers] blockers)
EOF
)"
```

</step>

<step name="done">
**Present results:**

```
Review complete:

- Section: [name]
- Issues: .planning/sections/XX-name/XX-YY-ISSUES.md

## Summary
- Citation check: [pass/issues]
- Coherence check: [pass/issues]
- Rubric check: [pass/issues]

Total: [N] issues ([blockers] blockers, [major] major, [minor] minor)

---

## ▶ Next Up

[If issues found:]
**Plan revisions** — address identified issues

`/wtfp:plan-revision XX-YY`

[If no issues:]
**Continue** — move to next section

`/wtfp:plan-section [next]`

<sub>`/clear` first → fresh context window</sub>

---
```

</step>

</process>

<success_criteria>
- [ ] All 3 verification layers executed
- [ ] User guided through each check
- [ ] Issues documented in ISSUES.md
- [ ] Severity levels assigned
- [ ] Clear next steps provided
</success_criteria>
