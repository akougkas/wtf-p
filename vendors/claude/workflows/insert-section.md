---
schema: wtfp.workflow/v1
action: insert-section
source: wtfp.protocol
---

# Insert a section

@protocol://project/README.md
@protocol://skills/wtfp-plan-section/SKILL.md
@protocol://skills/wtfp-plan-section/references/actions.md

## Record contract

Read: `project://structure/outline`, `project://state`, `project://sections/{section}`.
Produce: `project://structure/outline` (update), `project://sections/{section}` (create), `project://state` (update).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Resolve the insertion point and propose a stable new section ID, goal, dependencies, wave, claims, and word budget.
2. Preview impacts on outline ordering, dependencies, section totals, and current position; require approval.
3. Create the section record and atomically update outline and state. Do not renumber stable IDs or move manuscript files implicitly.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
