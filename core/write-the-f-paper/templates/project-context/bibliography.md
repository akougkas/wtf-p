# Bibliography Template

Template for `.planning/sources/literature.md` — the literature index for your paper.

**Purpose:** Track all sources: what you must cite, what informed your thinking, and what you still need to find.

---

## File Template

```markdown
# Literature Index

**Created:** [date]
**Last updated:** [date]
**Total citations:** [N] core + [M] supporting

## Core References (Must Cite)

These are foundational works that must appear in the paper.

| Key | Citation | Relevance | Section | Status |
|-----|----------|-----------|---------|--------|
| smith2023 | Smith, J., et al. (2023). Title. *Journal*, Vol(Issue), pp. DOI | [Why foundational] | Intro | ✓ cited |
| jones2024 | Jones, A. (2024). Title. *Journal*, Vol(Issue), pp. DOI | [Why foundational] | Methods | ✓ cited |
| author2022 | Author, B. (2022). Title. *Journal*, Vol(Issue), pp. DOI | [Why foundational] | Lit Review | pending |

## Supporting References

These provide additional support or context.

| Key | Citation | Relevance | Section | Status |
|-----|----------|-----------|---------|--------|
| davis2023 | Davis, C., et al. (2023). Title. *Conference Proceedings*. | [What it contributes] | Discussion | optional |
| miller2024 | Miller, D. (2024). Title. *Journal*. | [What it contributes] | Background | pending |

## Background Reading

Informed your thinking but may not be directly cited.

| Key | Citation | Notes |
|-----|----------|-------|
| textbook2020 | Author (2020). *Textbook Title*. Publisher. | Foundational concepts |
| review2023 | Author (2023). Review article title. | Field overview |

## To Find

Citations you need but haven't located yet.

- [ ] [Description of needed citation] — for [which claim/section]
- [ ] [Description of needed citation] — for [which claim/section]
- [ ] [Description of needed citation] — for [which claim/section]

## By Section

Quick reference for which citations go where.

### Introduction
- smith2023: Context on AI tool proliferation
- jones2024: Current usage patterns

### Literature Review
- author2022: Academic writing constraints
- [...]

### Methods
- framework2021: Methodological foundation
- [...]

### Discussion
- critic2023: Contrasting view we address
- [...]

## Citation Notes

Key quotes or specific points to reference:

### smith2023
- p. 12: "[Exact quote that's useful]"
- p. 45: Data on adoption rates (Table 3)

### jones2024
- p. 7: "[Exact quote]"
- Key finding: 78% of researchers report ad hoc usage

---

*Literature index for: [Paper title]*
*Update as citations are added*
```

<guidelines>

**Status values:**
- `✓ cited` — Already in paper
- `pending` — Need to add
- `optional` — Use if space/relevance

**Core vs Supporting:**
- Core: Paper would be incomplete without these
- Supporting: Strengthen but not essential
- Background: Informed thinking, may not cite

**To Find section:**
- Captures citation gaps
- Be specific about what you need
- Link to the claim/section requiring it

**By Section view:**
- Quick reference during writing
- Shows citation distribution
- Helps avoid over/under-citing sections

**Citation Notes:**
- Capture key quotes with page numbers
- Note specific data or tables to reference
- Saves time during writing

**When to update:**
- After literature search
- When adding citations during writing
- After identifying gaps in argument
</guidelines>

<example>
```markdown
# Literature Index

**Created:** 2025-01-10
**Last updated:** 2025-01-20
**Total citations:** 8 core + 12 supporting

## Core References (Must Cite)

| Key | Citation | Relevance | Section | Status |
|-----|----------|-----------|---------|--------|
| smith2023 | Smith, J., Chen, L., & Davis, M. (2023). The proliferation of AI writing assistants: A systematic review. *Computers & Education*, 195, 104723. | Foundational survey | Intro | ✓ cited |
| jones2024 | Jones, A. (2024). How researchers use AI: A mixed-methods study. *Research Policy*, 53(2), 104891. | Usage patterns data | Intro, Results | ✓ cited |
| author2022 | Author, B. (2022). Academic writing in the digital age. *Written Communication*, 39(4), 567-592. | Academic constraints | Lit Review | pending |
| ethics2024 | Jones, A., & Chen, L. (2024). Ethics of AI co-authorship. *Science and Engineering Ethics*, 30(1), 1-18. | Ethics framework | Discussion | pending |

[...]

## To Find

- [ ] Power analysis citation for N=45 — for Methods sample size justification
- [ ] Comparable study with similar N — for Methods precedent
- [ ] Recent CHI paper on AI writing tools — for Lit Review currency

[...]
```
</example>
