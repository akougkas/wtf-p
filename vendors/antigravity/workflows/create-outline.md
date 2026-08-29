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
Produce: `project://structure/outline` (update), `project://sections/{section}` (create), `project://decisions` (update), `project://state` (update), `project://validations/{validation}` (create).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Read existing outline, decision, and state revisions before deriving the thesis, requirements, locked/deferred decisions, source coverage, section goals, dependencies, word budgets, and execution waves.
2. Reconcile only choices the author explicitly resolves during the outline interview. Preserve every unrelated decision unchanged. For each explicitly resolved item whose current disposition is `deferred`, preserve the prior item unchanged except for setting its disposition to `superseded`; append a new replacement whose ID is fresh and unique in the ledger, whose authority is `author`, whose disposition is `locked`, and whose `supersedes` field names the prior item. Set the replacement's `recorded_at` to the actual resolution time, increment the decision-record revision, and set the record's `updated_at` to that same actual resolution time. Never supersede a locked choice or treat an agent suggestion or approval of an unrelated outline detail as authority to resolve a decision. If the author resolves no choice, do not rewrite the decision record.
3. Present the complete outline and decision diffs at the confirm_outline gate. If the proposed outline contradicts a locked decision, preserve that decision as locked and unchanged. If it assumes a choice that was already deferred and the author did not resolve it, preserve that choice as deferred. In either case, record a non-passing validation and stop before downstream planning.
4. After approval, atomically publish the decision update when one is required together with the outline, one section record per entry, state update, and validation. Preserve stable record and section IDs and verify the complete approved set after writing.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
