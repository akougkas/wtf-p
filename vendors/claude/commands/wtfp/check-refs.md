---
name: wtfp:check-refs
description: BibTeX audit - verify citations are complete and consistent
argument-hint: "[bib-file]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
  - Glob
  - Grep
---

<objective>
Audit citations for completeness and consistency.

Purpose: Ensure all in-text citations have BibTeX entries, all BibTeX entries are cited, and references are properly formatted.
Output: Report of citation issues with fixes applied or flagged for user action.
</objective>

<execution_context>
@~/.claude/write-the-f-paper/references/citation-formats.md
</execution_context>

<context>
BibTeX file: $ARGUMENTS (optional - auto-detects .bib files if not provided)

**Load project state:**
@.planning/STATE.md

**Scan for:**
- .bib files in project root and common locations
- Draft files with citations (\cite{}, [@...], etc.)
</context>

<process>

<step name="locate_files">
1. Find BibTeX file(s):
```bash
find . -name "*.bib" -type f 2>/dev/null | head -20
```

2. Find files with citations:
```bash
grep -rl "\\\\cite\|\\[@\|\\[.*\\]" --include="*.tex" --include="*.md" . 2>/dev/null
```

3. If no .bib found, error:
```
No .bib file found.

Create one or specify path: /wtfp:check-refs path/to/refs.bib
```
</step>

<step name="parse_bib">
**Extract BibTeX Keys:**

Use the deterministic indexer to get an accurate list of keys from the .bib file.

```bash
node ~/.claude/bin/bib-index.js index "$ARGUMENTS"
```
*(Use the file found/selected in step 1)*

Build inventory from the JSON output:
- Entry key
- Title
- Year
</step>

<step name="parse_citations">
**Extract all in-text citations:**

LaTeX style: `\cite{key}`, `\citep{key}`, `\citet{key}`, `\cite{key1,key2}`
Markdown style: `[@key]`, `[@key1; @key2]`

Build list of all citation keys used in text.
</step>

<step name="cross_reference">
**Compare citations vs BibTeX:**

| Check | Status |
|-------|--------|
| Cited but no BibTeX entry | ❌ MISSING |
| BibTeX entry but never cited | ⚠️ UNUSED |
| Entry missing required fields | ⚠️ INCOMPLETE |
| Duplicate keys | ❌ DUPLICATE |
| Year out of range (< 1900 or > current) | ⚠️ SUSPICIOUS |

**Required fields by type:**

| Type | Required |
|------|----------|
| @article | author, title, journal, year |
| @inproceedings | author, title, booktitle, year |
| @book | author/editor, title, publisher, year |
| @phdthesis | author, title, school, year |
| @misc | author, title, year, howpublished/url |
</step>

<step name="report">
**Present findings:**

```
## Citation Audit

### ❌ Missing BibTeX Entries (cited but not in .bib)
- `smith2023` — cited in intro.tex:45
- `jones2022deep` — cited in methods.md:112

### ⚠️ Unused References (in .bib but never cited)
- `oldpaper1999` — consider removing or citing
- `tangential2020` — consider removing or citing

### ⚠️ Incomplete Entries (missing required fields)
- `chen2021` — missing: journal
- `kumar2022` — missing: booktitle

### ✓ Valid Citations: [N]
### ✓ Valid BibTeX Entries: [N]
```
</step>

<step name="offer_fixes">
**For fixable issues:**

Use AskUserQuestion:
- header: "Fixes"
- question: "How should I handle unused references?"
- options:
  - "Remove unused" — Delete entries not cited in text
  - "Keep all" — Leave .bib unchanged
  - "Comment out" — Keep but mark as unused

For missing entries, offer to find them:
1. **Search:** Run `node ~/.claude/bin/citation-fetcher.js "title or author"` to find the correct BibTeX.
2. **Create:** If found, append the new entry to the .bib file.
3. **Flag:** If not found, flag for manual resolution.
</step>

<step name="apply_fixes">
Apply approved fixes to .bib file.

If removing unused:
```bash
# Backup first
cp references.bib references.bib.backup
```

Apply edits.
</step>

<step name="commit">
```bash
git add *.bib
git commit -m "$(cat <<'EOF'
refs: audit and clean bibliography

- Verified [N] citations against BibTeX
- Removed [N] unused entries (if applicable)
- Fixed [N] incomplete entries (if applicable)
- [N] issues flagged for manual review
EOF
)"
```
</step>

<step name="done">
```
Citation audit complete:

- Citations in text: [N]
- BibTeX entries: [N]
- Issues fixed: [N]
- Issues flagged: [N]

---

## Manual Action Required (if any)

[List of issues requiring user intervention]

---

## Next Up

- `/wtfp:polish-prose` — Refine writing
- `/wtfp:export-latex` — Generate LaTeX
- `/wtfp:review-section` — Get reviewer feedback

---
```
</step>

</process>

<success_criteria>
- All in-text citations have corresponding BibTeX entries
- All BibTeX entries have required fields
- Unused references identified (removed or flagged)
- No duplicate keys
- Changes committed to git
- User knows what manual fixes remain
</success_criteria>
