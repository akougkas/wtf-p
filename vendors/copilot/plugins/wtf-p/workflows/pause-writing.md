---
schema: wtfp.workflow/v1
action: pause-writing
source: wtfp.protocol
---

# Pause writing

@protocol://project/README.md
@protocol://skills/wtfp-manage-project/SKILL.md
@protocol://skills/wtfp-manage-project/references/actions.md

## Record contract

Read: `project://state`, `project://sections/{section}`, `project://sections/{section}/plans/{plan}`, `project://validations/{validation}`, `project://paper/{artifact}`.
Produce: `project://sections/{section}/handoff` (create), `project://checkpoints/{checkpoint}` (create), `project://state` (update).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Reconcile current state and identify the exact section, completed work, pending work, blockers, and next action.
2. Write a Markdown handoff artifact for narrative continuity plus a human-action checkpoint for machine-readable resumption.
3. Set state.status to paused and link the checkpoint; do not commit automatically.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
