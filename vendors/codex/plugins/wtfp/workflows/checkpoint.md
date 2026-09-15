---
schema: wtfp.workflow/v1
action: checkpoint
source: wtfp.protocol
---

# Manage checkpoints

@protocol://project/README.md
@protocol://skills/wtfp-manage-project/SKILL.md
@protocol://skills/wtfp-manage-project/references/actions.md

## Record contract

Read: the declared portable records and authored artifacts selected for the snapshot.
Produce: `project://checkpoints/{checkpoint}` (create), `project://archives/checkpoints/{checkpoint}` (create), `project://archives/recovery/{artifact}` (create on restore), `project://manifest` (update), `project://state` (update).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. For save, select concrete contained resources, copy their exact bytes into an immutable checkpoint archive, hash every entry, then create a non-blocking `state-snapshot` checkpoint that records the archive URI, logical resource URIs, record revisions, and SHA-256 values. Link the archive from the manifest and read everything back before success.
2. For list or inspect, report snapshot scope and verify that the archive, resources, revisions, and hashes still resolve without mutation.
3. For restore, compare the selected snapshot with current resources, create and verify a pre-restore recovery archive, preview the exact replacements, and require a separate authorization immediately before applying them. Restore only snapshot-declared resources atomically, schema-validate records, verify hashes, and mark the checkpoint restored. Never use a commit, tag, checkout, reset, or branch movement as checkpoint storage.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
