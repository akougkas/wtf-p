---
schema: wtfp.workflow/v1
action: create-outline
source: wtfp.protocol
---

# Create the paper outline

@protocol://project/README.md
@protocol://skills/wtfp-start-project/SKILL.md
@protocol://skills/wtfp-start-project/references/actions.md

## Record contract

Read: `project://manifest`, `project://config`, `project://state`, `project://decisions`, `project://structure/outline`, `project://sources/{source}`, `project://evidence/{evidence}`.
Produce: `project://structure/outline` (update), `project://sections/{section}` (create), `project://state` (update), `project://validations/{validation}` (create).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Read existing outline and state revisions before deriving the thesis, requirements, locked/deferred decisions, source coverage, section goals, dependencies, word budgets, and execution waves.
2. Present the complete outline diff at the confirm_outline gate.
3. After approval, write outline and one section record per entry, preserve stable section IDs, update state, and record plan validation findings.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
