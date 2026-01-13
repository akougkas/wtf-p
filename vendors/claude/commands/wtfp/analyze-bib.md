---
name: wtfp:analyze-bib
description: Analyze BibTeX file and suggest citation placement by section
argument-hint: "[bib-file]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - AskUserQuestion
  - WebFetch
---

<objective>
Deep analysis of BibTeX bibliography to inform writing strategy.

Purpose: Understand your literature landscape before writing. Cluster papers by topic, identify seminal vs recent work, and pre-populate citation suggestions per section.
Output: REFS.md with citation strategy mapped to your paper's sections.
</objective>

<execution_context>
@~/.claude/write-the-f-paper/references/citation-formats.md
@~/.claude/write-the-f-paper/templates/project-context/bibliography.md
</execution_context>

<context>
BibTeX file: $ARGUMENTS (optional - auto-detects .bib files if not provided)

**Load project context:**
@.planning/PROJECT.md
@.planning/config.json
@.planning/structure/outline.md
</context>

<process>

<step name="locate_bib">
**Find BibTeX file:**

```bash
# Find .bib files
find . -name "*.bib" -type f 2>/dev/null | grep -v node_modules | grep -v .git | head -10
```

If multiple found, use AskUserQuestion.
If none found, exit with error.
</step>

<step name="parse_entries">
**Parse BibTeX Index:**

Use the specialized indexer tool to get a structured JSON summary of the bibliography. This handles large files efficiently.

```bash
# Index the bibliography (returns JSON)
node ~/.claude/bin/bib-index.js index "$ARGUMENTS"
```
*(If $ARGUMENTS is empty, use the file found in previous step)*

</step>

<step name="temporal_analysis">
**Temporal Analysis:**

Analyze the JSON output from the previous step.

Categorize entries by the `year` field in the JSON:
- **Foundational** (10+ years old)
- **Established** (5-10 years)
- **Recent** (2-5 years)
- **Cutting edge** (<2 years)

Produce the "Temporal Distribution" table based on these counts.
</step>

<step name="cluster_topics">
**Topic Clustering:**

Analyze titles, abstracts, and keywords to cluster papers by theme:

1. Extract key terms from titles/abstracts
2. Group papers with overlapping terminology
3. Label clusters with descriptive names

```markdown
## Topic Clusters

### Cluster 1: [Theme Name]
**Papers:** [key1], [key2], [key3]
**Common themes:** [extracted keywords]
**Use for:** [which section this supports]

### Cluster 2: [Theme Name]
**Papers:** [key4], [key5]
**Common themes:** [extracted keywords]
**Use for:** [which section this supports]
```

</step>

<step name="identify_seminal">
**Identify Seminal Works:**

Flag likely seminal papers based on:
- High citation count (if DOI available, could fetch)
- Foundational publication year
- Appears in prestigious venue
- Authors are field leaders
- Title suggests foundational contribution

```markdown
## Seminal Works (Must Cite)

| Key | Title | Why Seminal |
|-----|-------|-------------|
| [key] | [title] | [reason: foundational method, influential framework, etc.] |
```

Use AskUserQuestion:
- header: "Seminal"
- question: "Which of these are definitely seminal works in your field?"
- multiSelect: true
- options: [top candidates] + "None of these" + "Let me add others"

</step>

<step name="map_to_sections">
**Map Citations to Sections:**

Based on venue template and topic clusters, suggest where each citation belongs:

Read outline.md to get section structure.

For each section, identify relevant citations:

```markdown
## Citation Map

### Section 1: Introduction
**Purpose:** Establish problem importance, cite motivation
**Suggested citations:**
- [key1] — establishes the problem exists
- [key2] — shows prior failed attempts
- [key3] — motivates urgency

### Section 2: Background
**Purpose:** Technical foundations
**Suggested citations:**
- [key4] — defines key concept X
- [key5] — introduces method Y

### Section 3: Approach
**Purpose:** Your contribution (cite sparingly)
**Suggested citations:**
- [key6] — technique you build on

### Section 4: Evaluation
**Purpose:** Comparison baselines
**Suggested citations:**
- [key7] — baseline method 1
- [key8] — baseline method 2

### Section 5: Related Work
**Purpose:** Position in literature (cite heavily)
**Suggested citations:**
- [key9], [key10] — similar approaches
- [key11], [key12] — alternative methods
- [key13] — concurrent work
```

</step>

<step name="identify_gaps">
**Identify Citation Gaps:**

Based on topic clusters and section needs, flag potential missing references:

```markdown
## Potential Gaps

| Section | Gap | Suggestion |
|---------|-----|------------|
| Background | No citation for [concept] | Search for foundational paper on X |
| Related Work | Missing [approach type] | Add recent work on Y |
| Evaluation | Only [N] baselines | Consider adding [method] |
```

Use AskUserQuestion:
- header: "Gaps"
- question: "Any topics you know you need to cite but don't have in your .bib yet?"
- options:
  - "No gaps" — Coverage looks good
  - "Missing some" — I'll list what I need
  - "Not sure" — Help me identify gaps

</step>

<step name="write_refs">
**Create REFS.md:**

Write to `.planning/sources/REFS.md`:

```markdown
# Citation Strategy

## Bibliography: [filename.bib]
**Total entries:** [N]
**Analysis date:** [date]

## Temporal Distribution
[From temporal_analysis step]

## Topic Clusters
[From cluster_topics step]

## Seminal Works
[From identify_seminal step]

## Citation Map by Section
[From map_to_sections step]

## Potential Gaps
[From identify_gaps step]

## Quick Reference

### High-Priority Citations (use frequently)
- [key1] — [one-liner why]
- [key2] — [one-liner why]

### Context Citations (use once for background)
- [key3] — [one-liner why]

### Comparison Citations (evaluation section)
- [key4] — [one-liner why]

---
*Generated by /wtfp:analyze-bib*
*Review and adjust as you write*
```

</step>

<step name="commit">
```bash
git add .planning/sources/REFS.md
git commit -m "$(cat <<'EOF'
refs: analyze bibliography for citation strategy

- Entries: [N] total
- Clusters: [N] topic groups
- Seminal works: [N] identified
- Citation map: all sections covered
EOF
)"
```

</step>

<step name="done">
```
Bibliography analyzed:

- Source: [filename.bib]
- Entries: [N]
- Topic clusters: [N]
- Seminal works: [N]
- Citation map: .planning/sources/REFS.md

## Key Insights

[2-3 bullet observations about the bibliography]

---

## Next Up

**Create outline** — use citation map to inform section planning

`/wtfp:create-outline`

Or review REFS.md and adjust before proceeding.

---
```

</step>

</process>

<success_criteria>
- [ ] BibTeX file parsed completely
- [ ] Temporal distribution analyzed
- [ ] Topic clusters identified
- [ ] Seminal works flagged (with user confirmation)
- [ ] Citations mapped to paper sections
- [ ] Gaps identified
- [ ] REFS.md created in .planning/sources/
- [ ] Committed to git
</success_criteria>
