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
2. Search declared scholarly services only after the gate names the providers and bounded query set. When using the bundled dispatcher, `citation-search` may run with `--backend=cite-nexus` and an explicit `--providers` list after this gate. Returned results stay candidates, and this action performs no bibliography write. Verify source identity and inspection depth, and separate source records from claim-level evidence.
3. Synthesize supported, conflicting, and missing evidence into a Markdown research artifact; link new records and disclose limitations.

## Bundled tool execution

The declared `tool.execute` effect authorises exactly one command, run from the package root the host resolves for this bundle:

```bash
node protocol://tools/wtfp-tool.js [--offline] <command> [arguments]
```

Run it with `list` first to read the declared commands, their arguments, their bounds, and the effects each one applies; `protocol://tools/README.md` carries the same table. A command whose effects include `network.*` performs outbound requests. Until network use has been approved for this run, pass `--offline` (or set `WTFP_TOOL_OFFLINE=1`), which makes the dispatcher refuse those commands instead of relying on prose restraint. Never execute another module in this package, never pass a logical `project://` or `wtfp://` URI as a shell argument, and treat every returned record as candidate evidence until it is verified and written to a source or evidence record.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
