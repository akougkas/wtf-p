---
schema: wtfp.workflow/v1
action: check-refs
source: wtfp.protocol
---

# Check references

@protocol://project/README.md
@protocol://skills/wtfp-research-literature/SKILL.md
@protocol://skills/wtfp-research-literature/references/actions.md

## Record contract

Read: `project://config`, `project://sources/{source}`, `project://evidence/{evidence}`, `project://materials/{artifact}`, `project://paper/{artifact}`.
Produce: `project://deliverables/bibliography/{artifact}` (create), `project://validations/{validation}` (create).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Resolve the author-selected bibliography, every in-scope manuscript citation, and verified or provisional source/evidence records under the configured citation policy.
2. Report missing identities, metadata conflicts, uncited entries, unsupported citations, and style defects; verify external metadata only after the declared user gate.
3. Leave the bibliography, manuscript, source records, and evidence records unchanged. When requested, preview and create a separate corrected-bibliography candidate, validate it, and record unresolved issues and exact input revisions in the audit result.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
