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

Read: `project://manifest`, `project://config`, `project://state`, `project://decisions`, `project://structure/outline`, `project://checkpoints/{checkpoint}`, `project://sections/{section}`, `project://sections/{section}/plans/{plan}`, `project://sections/{section}/reviews/{review}`, `project://sections/{section}/handoff`, `project://sections/{section}/summary`, `project://validations/{validation}`, `project://paper/{artifact}`.
Produce: `project://checkpoints/{checkpoint}` (update), `project://state` (update).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. In the current invocation, read and schema-validate the manifest, config, state, decisions, and every pending active checkpoint. Read the chosen checkpoint plus its linked handoff, section, selected plan, reviews, validations, manuscript, summary, and outline; a prior conversation, invocation prose, or generated report is not evidence that these reads occurred.
2. Verify referenced revisions and artifacts are current, then report completed work, pending work, blockers, stale assumptions, and the exact bounded options. Do not create a report artifact: before selection the action is read-only.
3. Invoke the host's interactive user gate and wait for one exact option. Invocation arguments may request resumption but cannot answer this gate. If the gate is unavailable or no response is returned, report `needs-input` and make no mutation.
4. Only after the returned selection, resolve, waive, or expire the checkpoint as selected and set `state.status` to `active` when continuation is confirmed. Preserve the existing valid `state.phase`, increment required revisions, and clear only the resolved active checkpoint URI.
5. Schema-validate and read back checkpoint and state before claiming success. Preserve the handoff until the selected continuation itself is confirmed.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
