---
name: wtfp:map-project
description: Map existing source materials for brownfield writing projects
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - Task
---

<objective>
Index existing source materials (literature, data, prior drafts) for a writing project.

Creates `.planning/sources/` with organized references covering:
- literature.md (bibliography index)
- data.md (figures, tables, evidence inventory)
- prior-drafts.md (existing material to incorporate)

Use before `/wtfp:new-paper` on existing writing projects.
</objective>

<execution_context>
@~/.claude/write-the-f-paper/workflows/map-project.md
</execution_context>

<process>

<step name="detect">
**Detect existing materials:**

```bash
# Find bibliography files
find . -name "*.bib" -o -name "references.md" -o -name "bibliography.md" 2>/dev/null | head -20

# Find existing drafts
find . -name "*.tex" -o -name "*.md" -o -name "*.docx" 2>/dev/null | grep -v node_modules | grep -v .planning | head -20

# Find data files
find . -name "*.csv" -o -name "*.json" -o -name "*.xlsx" 2>/dev/null | head -20

# Find figures
find . -name "*.png" -o -name "*.pdf" -o -name "*.svg" -o -name "*.jpg" 2>/dev/null | head -20
```

</step>

<step name="create_structure">
**Create sources directory:**

```bash
mkdir -p .planning/sources
```

</step>

<step name="literature">
**Index literature sources:**

If .bib files found:
- Parse BibTeX entries
- Extract: key, title, authors, year, relevance

Create `.planning/sources/literature.md`:

```markdown
# Literature Index

## Core References (cite in paper)
| Key | Citation | Relevance | Status |
|-----|----------|-----------|--------|
| [key] | [Author (Year)] | [why relevant] | Available |

## Background Reading
| Key | Citation | Notes |
|-----|----------|-------|

## To Find
- [ ] [Missing citations needed]

## Sources
- [path to .bib file]
- [other source files]

---
*Indexed: [date]*
```

</step>

<step name="data">
**Index data and evidence:**

Scan for figures, tables, data files.

Create `.planning/sources/data.md`:

```markdown
# Data & Evidence Inventory

## Figures
| ID | File | Description | Status | Target Section |
|----|------|-------------|--------|----------------|
| fig1 | [path] | [description] | Ready/Needs work | [section] |

## Tables
| ID | File/Location | Description | Status |
|----|---------------|-------------|--------|

## Data Files
| File | Format | Description | Use |
|------|--------|-------------|-----|

## Statistics
[Any statistical results to report]

---
*Indexed: [date]*
```

</step>

<step name="drafts">
**Index prior drafts:**

Scan for existing writing.

Create `.planning/sources/prior-drafts.md`:

```markdown
# Prior Drafts & Notes

## Existing Documents
| File | Type | Description | Usable? | Target Section |
|------|------|-------------|---------|----------------|
| [path] | [draft/notes/outline] | [description] | [yes/partial/no] | [section] |

## Key Passages to Incorporate
[Notable excerpts worth keeping]

## Material to Avoid
[Content that shouldn't be reused]

---
*Indexed: [date]*
```

</step>

<step name="commit">
```bash
git add .planning/sources/
git commit -m "$(cat <<'EOF'
docs: index source materials

Literature: [N] references
Data: [N] figures, [N] tables
Prior drafts: [N] documents
EOF
)"
```

</step>

<step name="done">
**Present completion:**

```
Sources indexed:

- Literature: .planning/sources/literature.md ([N] references)
- Data: .planning/sources/data.md ([N] figures, [N] tables)
- Prior Drafts: .planning/sources/prior-drafts.md ([N] documents)

---

## ▶ Next Up

**Initialize paper** — capture vision and structure

`/wtfp:new-paper`

---
```

</step>

</process>

<success_criteria>
- [ ] All existing materials discovered
- [ ] literature.md indexes all citations
- [ ] data.md inventories figures and evidence
- [ ] prior-drafts.md catalogs existing writing
- [ ] All committed to git
</success_criteria>
