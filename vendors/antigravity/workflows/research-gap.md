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
2. Prefer an operator-configured, trusted read-only CiteNexus MCP connection for bounded public metadata searches when the host has already authorized it. In an explicitly selected full-auto host session for this research action, the bundled CiteNexus dispatcher may also search the free no-key public indexes `crossref`, `datacite`, `europe_pmc`, and `arxiv` without a second per-query author gate; use only selected relevant indexes with an explicit `--providers` list. Record provider IDs, queries, date, and result limits; never send unpublished manuscript text or private notes as search terms. For any other route, first obtain explicit author approval naming the providers and bounded query set. Results remain candidates and this action performs no bibliography write. Verify source identity and inspection depth, and separate source records from claim-level evidence.
3. Synthesize supported, conflicting, and missing evidence into a Markdown research artifact; link new records and disclose limitations.

## Bundled tool execution

The declared `tool.execute` effect authorises exactly one command, run from the package root the host resolves for this bundle:

```bash
node protocol://tools/wtfp-tool.js [--offline] <command> [arguments]
```

Run it with `list` first to read the declared commands, their arguments, their bounds, and the effects each one applies; `protocol://tools/README.md` carries the same table. A command whose effects include `network.*` performs outbound requests. Pass `--offline` (or set `WTFP_TOOL_OFFLINE=1`) until the provider/query gate is approved, except for this action's explicit full-auto public-index route. On that route omit `--offline` only for `citation-search --backend=cite-nexus` with bounded queries and `--providers` drawn from `crossref,datacite,europe_pmc,arxiv`; never override an operator-set offline flag or a host refusal. Never execute another module in this package, never pass a logical `project://` or `wtfp://` URI as a shell argument, and treat every returned record as candidate evidence until it is verified and written to a source or evidence record.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
