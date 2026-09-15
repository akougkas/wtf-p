---
schema: wtfp.workflow/v1
action: discuss-section
source: wtfp.protocol
---

# Discuss a section

@protocol://project/README.md
@protocol://skills/wtfp-plan-section/SKILL.md
@protocol://skills/wtfp-plan-section/references/actions.md

## Record contract

Read: `project://manifest`, `project://decisions`, `project://structure/outline`, `project://sections/{section}`, `project://sections/{section}/context`, `project://sections/{section}/summary`.
Produce: `project://sections/{section}/context` (create), `project://sections/{section}/context` (update), `project://checkpoints/{checkpoint}` (create), `project://sections/{section}` (update), `project://decisions` (update).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Resolve one section ID from the outline and read its prior context, summary, and decisions before proposing updates; reject ambiguity.
2. Elicit the section purpose, boundaries, claims, examples, evidence needs, exclusions, and discretionary choices.
3. Store prose guidance as the section context artifact, decisions as decision records, and unresolved blocking choices as checkpoints; link artifacts from the section record.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
