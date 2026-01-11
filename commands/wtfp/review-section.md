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
User acceptance testing of written sections with configurable reviewer personas.

Runs 3-layer verification:
1. Citation Check (Mechanical)
2. Argument Coherence (Logical)
3. Rubric Check (Requirements)

**Reviewer Personas** adjust critique intensity and focus:
- Reviewer #2 (Hostile): Nitpicky, finds every flaw, assumes bad faith
- Area Chair (Big Picture): Strategic, focuses on contribution significance
- Camera-Ready Editor (Nitpicky): Formatting, style, polish details
- Friendly Mentor (Constructive): Balanced, actionable suggestions

Creates ISSUES.md if problems found.

User performs verification; Claude guides and documents.
</objective>

<execution_context>
@~/.claude/write-the-f-paper/workflows/review-section.md
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

<step name="select_persona">
**Select reviewer persona:**

Use AskUserQuestion:
- header: "Reviewer"
- question: "What type of review do you want?"
- options:
  - "Reviewer #2 (Hostile)" — Nitpicky, assumes worst, finds every flaw
  - "Area Chair (Big Picture)" — Strategic focus on contribution and impact
  - "Camera-Ready Editor" — Formatting, style, polish, consistency
  - "Friendly Mentor" — Balanced, constructive, actionable (Recommended)

**Persona behaviors:**

### Reviewer #2 (Hostile)
- Questions every claim without citation
- Assumes methodology is flawed until proven
- Finds ambiguity in clear statements
- Demands more experiments/evidence
- Tone: "The authors fail to..." / "It is unclear why..."
- Severity bias: Escalates minor issues to major

### Area Chair (Big Picture)
- Focuses on: Is the contribution significant?
- Asks: Would this paper advance the field?
- Checks: Is the evaluation convincing for the claims made?
- Less concerned with minor formatting
- Tone: "The main contribution..." / "The significance..."
- Severity bias: Ignores minor, focuses on blockers

### Camera-Ready Editor
- Formatting consistency (headings, spacing, fonts)
- Figure/table placement and references
- Citation style compliance
- Grammar, typos, awkward phrasing
- LaTeX/formatting warnings
- Tone: "Line X has..." / "Figure Y should..."
- Severity bias: Many minor issues

### Friendly Mentor
- Balanced critique with encouragement
- Every criticism paired with suggestion
- Prioritizes actionable feedback
- Acknowledges what works well
- Tone: "Consider..." / "This works well, but could be stronger if..."
- Severity bias: Realistic assessment

Store selected persona for use in all verification steps.

</step>

<step name="citation_check">
**Layer 1: Citation Check (Mechanical)**

Adjust intensity based on persona:

**If Reviewer #2 (Hostile):**
```
## Citation Check (Hostile Mode)

I'm looking for EVERY missing citation:

- [ ] ALL factual claims have citations (even "obvious" ones)
- [ ] Claims of novelty properly qualified
- [ ] No weasel words hiding missing citations ("studies show...", "it is known...")
- [ ] Self-citation ratio appropriate (not self-promotional)
- [ ] Recent work cited (nothing newer doing this?)
- [ ] Foundational work cited (did you read the classics?)

**Potential issues I see:**
[Claude actively identifies potential issues in hostile mode]
```

**If Area Chair:**
```
## Citation Check (Strategic)

Focus on citation credibility:

- [ ] Key claims backed by strong citations
- [ ] Methodology citations are appropriate
- [ ] Comparison baselines properly cited
- [ ] Not over-citing tangential work

**Big picture:**
```

**If Camera-Ready Editor:**
```
## Citation Check (Formatting)

- [ ] Citation format consistent throughout ([N] vs (Author, Year))
- [ ] All citations resolve in bibliography
- [ ] No duplicate entries
- [ ] Citation style matches venue requirements
- [ ] Page numbers where required
```

**If Friendly Mentor:**
```
## Citation Check

Let's make sure your citations are solid:

- [ ] Factual claims have citations
- [ ] Format is consistent
- [ ] Bibliography is complete

**What's working well:** [note positives]
**Suggestions:**
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

Adjust intensity based on persona:

**If Reviewer #2 (Hostile):**
```
## Argument Coherence (Hostile Mode)

I'm stress-testing your logic:

- [ ] Every claim PROVEN, not just stated
- [ ] Assumptions explicitly stated and justified
- [ ] Alternative explanations addressed
- [ ] Limitations acknowledged (or I'll find them)
- [ ] No logical leaps ("clearly" / "obviously" hiding weak reasoning)
- [ ] Statistics interpreted correctly
- [ ] Causation vs correlation distinguished

**Logical weaknesses I see:**
[Claude actively identifies logical gaps in hostile mode]

**Questions a hostile reviewer would ask:**
- "How do you know X causes Y?"
- "What about alternative explanation Z?"
- "Your sample size is only N..."
```

**If Area Chair:**
```
## Argument Coherence (Strategic)

Does the argument support a strong contribution?

- [ ] Core thesis is clear and significant
- [ ] Evidence supports the main claims
- [ ] Contribution is differentiated from prior work
- [ ] Limitations don't undermine the contribution

**Strategic assessment:**
```

**If Camera-Ready Editor:**
```
## Argument Coherence (Light Touch)

Basic logical flow:

- [ ] Paragraphs in logical order
- [ ] Transitions present
- [ ] No obvious contradictions
```

**If Friendly Mentor:**
```
## Argument Coherence

Let's strengthen your argument:

- [ ] Claims follow from evidence
- [ ] Logic flows naturally
- [ ] Counter-arguments addressed

**Strengths:** [what's working]
**Opportunities:** [where to strengthen]
```

**Cross-reference with argument-map.md:**
- [ ] Claim 1 addressed: [yes/no/partial]
- [ ] Claim 2 addressed: [yes/no/partial]
- [ ] ...

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

## Reviewer Persona: [Selected Persona]

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
- [ ] Reviewer persona selected
- [ ] All 3 verification layers executed (intensity adjusted to persona)
- [ ] User guided through each check
- [ ] Issues documented in ISSUES.md with persona noted
- [ ] Severity levels assigned (persona-appropriate)
- [ ] Clear next steps provided
</success_criteria>
