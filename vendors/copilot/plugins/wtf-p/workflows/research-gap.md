---
schema: wtfp.workflow/v1
action: research-gap
source: wtfp.protocol
---

# Research a section gap

@protocol://project/README.md
@protocol://skills/wtfp-research-literature/SKILL.md
@protocol://skills/wtfp-research-literature/references/actions.md

## Record contract

Read: `project://manifest`, `project://config`, `project://decisions`, `project://structure/outline`, `project://sections/{section}`, `project://sections/{section}/context`, `project://sources/{source}`, `project://evidence/{evidence}`.
Produce: `project://sources/{source}` (create), `project://evidence/{evidence}` (create), `project://sections/{section}/research` (create), `project://sections/{section}` (update).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Resolve the research question and section scope against locked/deferred decisions; agree on depth and source constraints.
2. Search declared scholarly services, verify source identity and inspection depth, and separate source records from claim-level evidence.
3. Synthesize supported, conflicting, and missing evidence into a Markdown research artifact; link new records and disclose limitations.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
