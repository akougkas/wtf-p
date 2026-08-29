---
schema: wtfp.workflow/v1
action: new-paper
source: wtfp.protocol
---

# Start a new paper

@protocol://project/README.md
@protocol://skills/wtfp-start-project/SKILL.md
@protocol://skills/wtfp-start-project/references/actions.md

## Record contract

Read: `project://manifest`, `project://materials/{artifact}`, `project://paper/{artifact}`.
Produce: `project://manifest` (create), `project://config` (create), `project://state` (create), `project://decisions` (create), `project://structure/outline` (create).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Detect existing project://manifest first; stop and offer inspection or repair rather than reinitializing it.
2. Interview for identity, argument, document type, audience, requirements, exclusions, format, gates, safety, and author decisions.
3. Preview the five v1 JSON records, validate every record, then create them atomically. Do not run git init, stage, commit, branch, or merge.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
