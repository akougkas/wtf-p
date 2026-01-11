# Data Inventory Template

Template for `.planning/sources/data.md` — evidence inventory for your paper.

**Purpose:** Track all figures, tables, statistics, and data that will appear in the paper.

---

## File Template

```markdown
# Data & Evidence Inventory

**Created:** [date]
**Last updated:** [date]

## Figures

| ID | Description | Status | Section | File |
|----|-------------|--------|---------|------|
| Fig 1 | [Main result visualization] | [ready/draft/needed] | Results | `figures/fig-1-*.png` |
| Fig 2 | [Method diagram] | [ready/draft/needed] | Methods | `figures/fig-2-*.png` |
| Fig 3 | [Comparison chart] | [ready/draft/needed] | Results | `figures/fig-3-*.png` |

### Figure Details

**Figure 1: [Title]**
- Purpose: [What this figure shows]
- Data source: [Where the data comes from]
- Status: [Ready / Needs polish / Not started]
- Caption draft: "[Draft caption text]"
- Alt text: "[Accessibility description]"

**Figure 2: [Title]**
- Purpose: [What this figure shows]
- Data source: [Where the data comes from]
- Status: [Ready / Needs polish / Not started]
- Caption draft: "[Draft caption text]"
- Alt text: "[Accessibility description]"

## Tables

| ID | Description | Status | Section | Format |
|----|-------------|--------|---------|--------|
| Table 1 | [Participant demographics] | [ready/draft/needed] | Methods | Inline |
| Table 2 | [Main results] | [ready/draft/needed] | Results | Inline |
| Table 3 | [Comparison with prior work] | [ready/draft/needed] | Discussion | Inline |

### Table Details

**Table 1: [Title]**
- Purpose: [What this table shows]
- Columns: [Column 1 | Column 2 | Column 3]
- Data source: [Where the data comes from]
- Status: [Ready / Needs polish / Not started]
- Notes: [Any special formatting or notes]

**Table 2: [Title]**
- Purpose: [What this table shows]
- Columns: [Column headers]
- Data source: [Where the data comes from]
- Status: [Ready / Needs polish / Not started]

## Statistics

| Finding | Test | Result | Section | Status |
|---------|------|--------|---------|--------|
| Group difference in X | t-test | t(43) = 2.34, p = .024, d = 0.45 | Results | ✓ verified |
| Relationship between Y and Z | Pearson r | r = .67, p < .001 | Results | ✓ verified |
| Model prediction | Regression | R² = .42, F(3, 41) = 9.87, p < .001 | Results | pending |

### Statistical Notes
- [Notes on statistical approach]
- [Software used: R / SPSS / Python]
- [Any assumptions checked]

## Quotes & Excerpts

| Source | Quote | Where to Use |
|--------|-------|--------------|
| Smith (2023), p. 12 | "[Exact quote]" | Introduction, gap statement |
| Participant P7 | "[Quote from data]" | Results, qualitative section |
| Jones (2024), p. 45 | "[Exact quote]" | Discussion, comparison |

## Data Availability

**Raw data:**
- Location: [Path or repository]
- Access: [Public / Upon request / Restricted]
- Format: [CSV / Excel / etc.]

**Processed data:**
- Location: [Path]
- Scripts: [Path to analysis scripts]

**Supplementary materials:**
- [What will be included in supplementary]

## Missing Data

Items we need but don't have yet:

- [ ] [Missing item 1] - needed for [section]
- [ ] [Missing item 2] - needed for [section]
- [ ] [Missing item 3] - needed for [section]

---

*Data inventory for: [Paper title]*
*Update as data is collected/processed*
```

<guidelines>

**What to track:**
- All figures with status and placement
- All tables with structure and status
- Key statistics with exact values
- Important quotes from sources or data
- Missing data items

**Status values:**
- Ready: Can be used as-is
- Draft: Needs polish but content is there
- Needed: Must be created
- Pending: Waiting on something

**Figure/Table naming:**
- Use descriptive IDs (Fig 1, Table A1)
- Include file paths for figures
- Note format requirements

**Statistics tracking:**
- Include exact values for paper
- Note verification status
- Track software/methods used

**Integration:**
- Reference from section plans
- Check during verification
- Update as data is finalized
</guidelines>
