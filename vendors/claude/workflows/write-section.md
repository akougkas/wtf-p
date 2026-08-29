---
schema: wtfp.workflow/v1
action: write-section
source: wtfp.protocol
---

# Write a section

@protocol://project/README.md
@protocol://skills/wtfp-write-section/SKILL.md
@protocol://skills/wtfp-write-section/references/actions.md

## Record contract

Read: `project://manifest`, `project://config`, `project://state`, `project://decisions`, `project://structure/outline`, `project://sections/{section}`, `project://sections/{section}/context`, `project://sections/{section}/research`, `project://sections/{section}/plans/{plan}`, `project://sections/{section}/summary`, `project://sources/{source}`, `project://evidence/{evidence}`, `project://paper/{artifact}`.
Produce: `project://paper/{artifact}` (create), `project://paper/{artifact}` (update), `project://sections/{section}/summary` (create), `project://sections/{section}/summary` (update), `project://validations/{validation}` (create), `project://checkpoints/{checkpoint}` (create), `project://sections/{section}` (update), `project://state` (update).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Require one approved plan and resolve all linked context, research, source/evidence records, decisions, prior summary, existing target, and necessary neighboring prose before choosing create or update.
2. Draft only the declared manuscript artifact; cite only resolvable sources, preserve author constraints, and stop at blocking decisions.
3. Validate the draft, create or update its Markdown summary, and reconcile section/state records from actual word count and validation status. If blocked, create the declared checkpoint and stop; do not commit or merge automatically.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
