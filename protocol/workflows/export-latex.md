---
schema: wtfp.workflow/v1
action: export-latex
source: wtfp.protocol
---

# Export LaTeX

@protocol://project/README.md
@protocol://skills/wtfp-deliver-research/SKILL.md
@protocol://skills/wtfp-deliver-research/references/actions.md

## Record contract

Read: `project://manifest`, `project://config`, `project://structure/outline`, `project://sources/{source}`, `project://evidence/{evidence}`, `project://paper/{artifact}`.
Produce: `project://deliverables/latex/{artifact}` (create).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Confirm venue template and whether an existing deliverable may be replaced.
2. Convert manuscript structure, citations, figures, tables, and bibliography without inventing content or metadata.
3. Write a self-contained LaTeX deliverable and run the declared bibliography tools. If compilation is requested, invoke only the configured host-provided LaTeX checker or compiler under the declared `tool.execute` effect; report compile or portability limitations.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
