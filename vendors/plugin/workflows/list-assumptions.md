---
schema: wtfp.workflow/v1
action: list-assumptions
source: wtfp.protocol
---

# List section assumptions

@protocol://project/README.md
@protocol://skills/wtfp-plan-section/SKILL.md
@protocol://skills/wtfp-plan-section/references/actions.md

## Record contract

Read: `project://manifest`, `project://decisions`, `project://structure/outline`, `project://sections/{section}`.
Produce: none.

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Extract explicit and implicit assumptions from manifest, decisions, outline, section claims, and evidence.
2. Classify each as locked, deferred, discretionary, supported, disputed, or unverified and cite its source URI.
3. Return findings only; recommend a separate author decision or research action for unresolved assumptions.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
