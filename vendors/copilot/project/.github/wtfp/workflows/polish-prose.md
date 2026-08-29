---
schema: wtfp.workflow/v1
action: polish-prose
source: wtfp.protocol
---

# Polish prose

@protocol://project/README.md
@protocol://skills/wtfp-review-manuscript/SKILL.md
@protocol://skills/wtfp-review-manuscript/references/actions.md

## Record contract

Read: `project://manifest`, `project://config`, `project://decisions`, `project://paper/{artifact}`.
Produce: `project://paper/{artifact}` (update), `project://validations/{validation}` (create).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Require an explicit manuscript selection and preserve claims, evidence meaning, citations, author voice, and protected text.
2. Propose substantive changes separately from mechanical edits and gate the substantive diff.
3. Apply only approved edits and emit a validation describing preserved meaning and any unresolved defects.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
