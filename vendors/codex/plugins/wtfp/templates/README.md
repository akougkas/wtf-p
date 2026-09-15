# WTF-P authored-artifact templates

These are scaffolds for artifacts the author owns, not project control state. Portable v1 JSON records under `protocol/project/` remain the only source of truth for project state; nothing in this directory is schema-validated or written back as a record.

| Template | Used by | Produces |
| --- | --- | --- |
| `paper-outline.md` | `create-outline`, `new-paper` | Section roles, argument roles, and word-budget shares for a manuscript |
| `grant-proposal-outline.md` | `create-outline`, `new-paper` | Solicitation-driven section set and limit accounting for `grant-proposal` |
| `poster.md` | `create-poster` | Conference poster source with panel layout and word budgets |
| `slides.md` | `create-slides` | Conference talk source with per-slide time budget |

A template is a starting structure, never a content claim. Replace every bracketed placeholder from the project's own records and evidence. Delete a section rather than leaving an invented one. Where a template proposes a budget share, the author's approved `target_words` and the venue's stated limits win.
