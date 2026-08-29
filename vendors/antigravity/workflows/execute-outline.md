---
schema: wtfp.workflow/v1
action: execute-outline
source: wtfp.protocol
---

# Execute the outline

@protocol://project/README.md
@protocol://skills/wtfp-write-section/SKILL.md
@protocol://skills/wtfp-write-section/references/actions.md

## Record contract

Read: `project://manifest`, `project://config`, `project://state`, `project://decisions`, `project://structure/outline`, `project://sections/{section}`, `project://sections/{section}/plans/{plan}`, `project://sections/{section}/summary`, `project://sources/{source}`, `project://evidence/{evidence}`, `project://checkpoints/{checkpoint}`, `project://paper/{artifact}`.
Produce: `project://paper/{artifact}` (update), `project://sections/{section}/summary` (create), `project://sections/{section}/summary` (update), `project://checkpoints/{checkpoint}` (create), `project://checkpoints/{checkpoint}` (update), `project://sections/{section}` (update), `project://state` (update), `project://validations/{validation}` (create).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Build waves from outline dependencies and select only sections with approved plans.
2. Within configured parallelism, delegate bounded section work grounded in source/evidence records; create or update summaries, serialize overlapping outputs, and create or reconcile blocking checkpoints before dependent work proceeds.
3. After each wave, validate outputs and reconcile section/state records from actual artifacts. Do not create branches or commits.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
