---
schema: wtfp.workflow/v1
action: quick
source: wtfp.protocol
---

# Make a quick writing change

@protocol://project/README.md
@protocol://skills/wtfp-write-section/SKILL.md
@protocol://skills/wtfp-write-section/references/actions.md

## Record contract

Read: `project://manifest`, `project://state`, `project://decisions`, `project://sections/{section}`, `project://paper/{artifact}`.
Produce: `project://paper/{artifact}` (update), `project://sections/{section}` (update), `project://state` (update).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Resolve one small user-approved manuscript target and reject ambiguous or broad scope.
2. Read the minimum manifest, decision, state, section, and neighboring prose context needed.
3. Apply the bounded edit, preserve citations and locked decisions, then reconcile affected section/state records; do not commit automatically.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
