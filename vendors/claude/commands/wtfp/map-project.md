---
name: wtfp:map-project
description: Index existing drafts, data, and references for a project
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<execution_context>
@~/.claude/write-the-f-paper/workflows/map-project.md
</execution_context>

<objective>
Index existing source materials (literature, data, prior drafts) for a writing project.

**Orchestrator role:** Detect existing materials, resolve model profile, create `.planning/sources/` with organized references, commit.

Use before `/wtfp:new-paper` on existing writing projects.
</objective>

<context>
No arguments. Scans current directory for existing materials.
</context>

<process>

## 1. Validate Environment and Resolve Model Profile

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

## 2. Detect Existing Materials

```bash
find . -name "*.bib" -o -name "references.md" -o -name "bibliography.md" 2>/dev/null | head -20
find . -name "*.tex" -o -name "*.md" -o -name "*.docx" 2>/dev/null | grep -v node_modules | grep -v .planning | head -20
find . -name "*.csv" -o -name "*.json" -o -name "*.xlsx" 2>/dev/null | head -20
find . -name "*.png" -o -name "*.pdf" -o -name "*.svg" -o -name "*.jpg" 2>/dev/null | head -20
```

## 3. Create Sources Directory

```bash
mkdir -p .planning/sources
```

## 4. Index Literature

If .bib files found, parse via `node ~/.claude/bin/bib-index.js index [file]`.

Write `.planning/sources/literature.md`: Core References table (key, citation, relevance, status), Background Reading, To Find list, source paths.

## 5. Index Data and Evidence

Scan for figures, tables, data files.

Write `.planning/sources/data.md`: Figures table (ID, file, description, status, target section), Tables, Data Files, Statistics.

## 6. Index Prior Drafts

Scan for existing writing.

Write `.planning/sources/prior-drafts.md`: Existing Documents table (file, type, description, usable, target section), Key Passages, Material to Avoid.

## 7. Commit

```bash
git add .planning/sources/
git commit -m "docs: index source materials"
```

</process>

<offer_next>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► SOURCES INDEXED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Literature: .planning/sources/literature.md ([N] references)
- Data: .planning/sources/data.md ([N] figures, [N] tables)
- Prior Drafts: .planning/sources/prior-drafts.md ([N] documents)

───────────────────────────────────────────

## ▶ Next Up

**Initialize paper** — capture vision and structure

`/wtfp:new-paper`

───────────────────────────────────────────

</offer_next>

<success_criteria>
- [ ] All existing materials discovered
- [ ] literature.md indexes all citations
- [ ] data.md inventories figures and evidence
- [ ] prior-drafts.md catalogs existing writing
- [ ] All committed to git
</success_criteria>
