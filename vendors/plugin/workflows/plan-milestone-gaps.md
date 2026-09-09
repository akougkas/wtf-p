---
schema: wtfp.workflow/v1
action: plan-milestone-gaps
source: wtfp.protocol
---

# Plan milestone gap fixes

@protocol://project/README.md
@protocol://skills/wtfp-review-manuscript/SKILL.md
@protocol://skills/wtfp-review-manuscript/references/actions.md

## Record contract

Read: `project://validations/{validation}`, `project://structure/outline`, `project://sections/{section}`.
Produce: `project://sections/{section}/plans/{plan}` (create), `project://checkpoints/{checkpoint}` (create).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Read the selected milestone validation and group unresolved issues by section, dependency, and evidence need.
2. Draft bounded fix plans with acceptance checks and preserve explicitly deferred gaps.
3. Preview priorities at a gate, then create approved plan artifacts and checkpoints for author-owned blockers.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
