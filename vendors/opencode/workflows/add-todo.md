---
schema: wtfp.workflow/v1
action: add-todo
source: wtfp.protocol
---

# Add a todo

@protocol://project/README.md
@protocol://skills/wtfp-manage-project/SKILL.md
@protocol://skills/wtfp-manage-project/references/actions.md

## Record contract

Read: `project://manifest`, `project://state`, `project://checkpoints/{checkpoint}`.
Produce: `project://checkpoints/{checkpoint}` (create), `project://state` (update).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Capture the requested work, urgency, and scope without starting it.
2. Create a human-action checkpoint with a stable identifier and link it from state.active_checkpoint_uris.
3. Recompute state from records; do not store a Markdown todo counter.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
