---
schema: wtfp.workflow/v1
action: review-section
source: wtfp.protocol
---

# Review a section

@protocol://project/README.md
@protocol://skills/wtfp-review-manuscript/SKILL.md
@protocol://skills/wtfp-review-manuscript/references/actions.md

## Record contract

Read: `project://manifest`, `project://decisions`, `project://structure/outline`, `project://sections/{section}`, `project://sections/{section}/context`, `project://sections/{section}/plans/{plan}`, `project://sections/{section}/research`, `project://sections/{section}/summary`, `project://evidence/{evidence}`, `project://paper/{artifact}`.
Produce: `project://sections/{section}/reviews/{review}` (create), `project://validations/{validation}` (create), `project://sections/{section}` (update).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Resolve one manuscript section, its outline claims, context, plan, research, summary, decisions, evidence, neighboring prose, and review rubric.
2. Review claim coverage, reasoning, evidence, citations, coherence, prose, and requirements without editing the manuscript.
3. Write detailed Markdown review notes and a read-only validation; disputed findings go through a checkpoint or user gate.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
