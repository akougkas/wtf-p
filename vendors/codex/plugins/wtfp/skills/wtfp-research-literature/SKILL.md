---
name: wtfp-research-literature
description: This skill researches, organizes, and audits scholarly literature for an academic manuscript. It activates when an agent needs to investigate a research gap, analyze a bibliography, map references to sections, validate citation coverage, repair reference metadata, or perform the WTF-P research-gap, analyze-bib, or check-refs actions.
---

# Research Literature for WTF-P

Create an auditable bridge from external scholarship to manuscript claims.

## Select the action

- Use `research-gap` to investigate the literature or domain knowledge needed by a section.
- Use `analyze-bib` to characterize a bibliography and map references to the manuscript.
- Use `check-refs` to reconcile in-text citations and bibliography records.

Read [references/actions.md](references/actions.md) for the selected action before searching or writing.

## Apply the evidence contract

1. Resolve the project root and the exact section or bibliography in scope.
2. Read `project://manifest`, `project://decisions`, `project://structure/outline`, existing source/evidence records, the section record, and its linked context before researching.
3. Separate records found in project files from records obtained externally. Record provenance for every external source.
4. Prefer primary publications and authoritative scholarly indexes. Use secondary summaries only for discovery or context.
5. Verify title, authors, year, venue, persistent identifier, and claim relevance before recommending a citation.
6. Never invent a reference, metadata field, quotation, finding, page number, or citation key. Label unverified candidates explicitly.
7. Require approval before using a paid or external service when project safety settings demand it, and before editing or removing bibliography entries.
8. Report search scope, evidence limits, conflicting findings, unresolved metadata, and the next writing action.

## Preserve research artifacts

- Store persistent section synthesis at `project://sections/{section}/research` and link it from the section record.
- Store bibliographic identity and provenance in `project://sources/{source}` and claim-level interpretation in `project://evidence/{evidence}`.
- Keep bibliography keys stable unless the author approves a migration and all references are updated together.
- Back up a bibliography before applying approved repairs.
- Do not claim a literature search is exhaustive unless the method, databases, dates, and stopping rule support that claim.

If scholarly search is unavailable, synthesize only the provided corpus and state that limitation plainly.
