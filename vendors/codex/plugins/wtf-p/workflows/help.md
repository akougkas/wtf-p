---
schema: wtfp.workflow/v1
action: help
source: wtfp.protocol
---

# Show WTF-P help

@protocol://project/README.md

## Record contract

Read: `protocol://catalog.json`, `protocol://actions/{action}.json`.
Produce: none.

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Resolve the requested topic against the catalog and stable aliases.
2. Explain prerequisites, reads, outputs, gates, tools, and semantic effects from the action contract.
3. Do not imply capabilities that the selected adapter does not expose.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
