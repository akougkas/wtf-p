---
name: wtfp:check-refs
description: Audit BibTeX for missing, duplicate, or broken references
argument-hint: "[bib-file]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<objective>
Audit citations for completeness and consistency.

**Orchestrator role:** Locate bib and draft files, run deterministic indexer, resolve model profile, spawn citation-formatter agent for cross-referencing, present results, apply fixes.

Ensures all in-text citations have BibTeX entries, all entries are cited, and references are properly formatted.
</objective>

<context>
BibTeX file: $ARGUMENTS (optional — auto-detects .bib files)

**Load project state:**
@.planning/STATE.md
</context>

<process>

## 1. Validate Environment and Resolve Model Profile

```bash
find . -name "*.bib" -type f 2>/dev/null | head -20
grep -rl "\\\\cite\|\\[@\|\\[.*\\]" --include="*.tex" --include="*.md" . 2>/dev/null
```

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| citation-formatter | sonnet | sonnet | haiku |

## 2. Run Deterministic Indexer

```bash
node ~/.claude/bin/bib-index.js index "$BIB_FILE"
```

## 3. Spawn citation-formatter Agent

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► AUDITING CITATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
Task(
  prompt="First, read ~/.claude/agents/wtfp/citation-formatter.md for your role.\n\n" + audit_prompt,
  subagent_type="general-purpose",
  model="{formatter_model}",
  description="Audit citations"
)
```

Audit prompt includes: `<bib_index>` with parsed entries, `<draft_files>` with paths to files containing citations, `<state>` with STATE.md.

Agent performs: extract in-text citations, cross-reference vs BibTeX keys, check required fields by entry type, identify duplicates, flag suspicious years.

## 4. Handle Formatter Return

Present findings:
- Missing BibTeX entries (cited but not in .bib)
- Unused references (in .bib but never cited)
- Incomplete entries (missing required fields)
- Valid citation count

**`## AUDIT BLOCKED`:** Present blocker (no .bib found, no .tex/.md to scan), ask user to provide file paths.

## 5. Offer Fixes

Ask via AskUserQuestion:
- header: "Fixes"
- question: "How should I handle unused references?"
- options: "Remove unused" | "Keep all" | "Comment out"

For missing entries, search using `node ~/.claude/bin/citation-fetcher.js "title"`.

## 6. Apply Fixes and Commit

```bash
cp references.bib references.bib.backup
# Apply approved edits
git add *.bib
git commit -m "refs: audit and clean bibliography"
```

</process>

<offer_next>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► CITATION AUDIT COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Citations in text: [N]
- BibTeX entries: [N]
- Issues fixed: [N]
- Issues flagged: [N]

───────────────────────────────────────────

## Next Up

- `/wtfp:polish-prose` — Refine writing
- `/wtfp:export-latex` — Generate LaTeX
- `/wtfp:review-section` — Get reviewer feedback

───────────────────────────────────────────

</offer_next>

<success_criteria>
- [ ] All in-text citations cross-referenced
- [ ] Missing entries identified and searched
- [ ] Incomplete entries flagged
- [ ] Unused references handled per user choice
- [ ] Changes committed to git
</success_criteria>
