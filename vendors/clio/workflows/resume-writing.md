---
schema: wtfp.workflow/v1
action: resume-writing
source: wtfp.protocol
---

# Resume writing

@protocol://project/README.md
@protocol://skills/wtfp-manage-project/SKILL.md
@protocol://skills/wtfp-manage-project/references/actions.md

## Record contract

Read: `project://state`, `project://checkpoints/{checkpoint}`, `project://sections/{section}`, `project://sections/{section}/handoff`, `project://sections/{section}/summary`.
Produce: `project://checkpoints/{checkpoint}` (update), `project://state` (update).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Reconcile state and inspect the active checkpoint plus linked Markdown handoff.
2. Report completed work, pending work, blockers, stale assumptions, and the exact resume action.
3. After user selection, resolve the checkpoint and set state active; preserve the handoff until successful continuation is confirmed.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
