---
schema: wtfp.workflow/v1
action: verify-work
source: wtfp.protocol
---

# Verify written work

@protocol://project/README.md
@protocol://skills/wtfp-review-manuscript/SKILL.md
@protocol://skills/wtfp-review-manuscript/references/actions.md

## Record contract

Read: `project://state`, `project://sections/{section}`, `project://sections/{section}/plans/{plan}`, `project://evidence/{evidence}`, `project://paper/{artifact}`.
Produce: `project://validations/{validation}` (create), `project://sections/{section}` (update), `project://state` (update).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Resolve the selected plan, section record, manuscript artifact, claims, and evidence.
2. Run acceptance, scope, citation, argument, and decision-fidelity checks without editing the subject.
3. Write a validation with passed/failed checks, issues, evidence, limitations, and next actions; reconcile status only from the result.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
