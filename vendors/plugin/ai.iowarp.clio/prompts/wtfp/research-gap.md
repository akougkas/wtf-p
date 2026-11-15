---
description: "Synthesize literature, domain conventions, open gaps, and defensible positioning for a section."
argument-hint: "[arguments]"
allowed-tools:
  - read
  - grep
  - find
  - ls
  - context
  - write
  - edit
  - ask_user
  - dispatch
  - monitor
  - web_fetch
  - bash
  - extension_wtfp__status
  - extension_wtfp__record
  - extension_wtfp__read_record
  - extension_wtfp__readiness
  - extension_wtfp__measure_section
  - extension_wtfp__gate
  - mcp_cite-nexus__search-papers
  - mcp_cite-nexus__resolve-paper
  - mcp_cite-nexus__verify-citation
  - mcp_cite-nexus__get-citation
delegated-tools:
  - context
  - edit
  - find
  - grep
  - ledger
  - limitation
  - ls
  - read
  - write
---

# Research a section gap

Before acting, load the `wtfp-research-literature` skill with `context(scope="skills", name="wtfp-research-literature")`; it carries this action's method and stays loaded across compaction.

## Record contract

Read: `project://manifest`, `project://config`, `project://decisions`, `project://structure/outline`, `project://sections/{section}`, `project://sections/{section}/context`, `project://sources/{source}`, `project://evidence/{evidence}`, `project://sections/{section}/research`.
Produce: `project://sources/{source}` (create), `project://sources/{source}` (update), `project://evidence/{evidence}` (create), `project://evidence/{evidence}` (update), `project://sections/{section}/research` (create), `project://sections/{section}/research` (update), `project://sections/{section}` (update).

Use `extension_wtfp__record` for each declared JSON record write. Read an existing record first with `extension_wtfp__read_record` and pass back the version it returns: `expect_revision` for state, outline and decisions, `expect_sha256` for every other record; a create passes neither. When one transition changes several records, such as a checkpoint and the state that lists it, pass them together as `writes` so they commit together. The tool validates, bumps revisions and timestamps, commits under the project lock and reads back. It refuses author resolutions and any record this action does not declare; preserve stable IDs and author decisions.

Write prose and linked artifacts with native file tools; keep their authored formats. The record tool handles JSON records only, never manuscript text, deletion or archives.

## Procedure

1. Resolve the research question and section scope against locked/deferred decisions; agree on depth and source constraints.
2. Prefer an operator-configured, trusted read-only CiteNexus MCP connection for bounded public metadata searches when the host has already authorized it. In a host session the operator explicitly started without per-call approval cards, for this research action, the bundled CiteNexus dispatcher may also search the free no-key public indexes `crossref`, `datacite`, `europe_pmc`, and `arxiv` without a second per-query author gate; use only selected relevant indexes with an explicit `--providers` list. Record provider IDs, queries, date, and result limits; never send unpublished manuscript text or private notes as search terms. For any other route, first obtain explicit author approval naming the providers and bounded query set. Results remain candidates and this action performs no bibliography write. Verify source identity and inspection depth, and separate source records from claim-level evidence.
3. Synthesize supported, conflicting, and missing evidence into a Markdown research artifact; link new records and disclose limitations.

## Bundled tool execution

The declared `tool.execute` effect authorises exactly one command, run from the package root the host resolves for this bundle:

```bash
node ${pluginRoot}/tools/wtfp-tool.js [--offline] <command> [arguments]
```

Run it with `list` first to read the declared commands, their arguments, their bounds, and the effects each one applies; `${pluginRoot}/tools/README.md` carries the same table. A command whose effects include `network.*` performs outbound requests. Pass `--offline` (or set `WTFP_TOOL_OFFLINE=1`) until the provider/query gate is approved, except for this action's explicit unattended public-index route. On that route omit `--offline` only for `citation-search --backend=cite-nexus` with bounded queries and `--providers` drawn from `crossref,datacite,europe_pmc,arxiv`; never override an operator-set offline flag or a host refusal. Never execute another module in this package, never pass a logical `project://` or `wtfp://` URI as a shell argument, and treat every returned record as candidate evidence until it is verified and written to a source or evidence record.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.

Call desk tools with `gateway(op="call", capability="extension_wtfp__<tool>", args={...})`, without a describe first; args: status {}, record {uri, record: {<every field of the record>}, expect_revision|expect_sha256} or {writes:[{uri, record, expect_...}]}, with no record field outside `record`, read_record {uri}, readiness {section}, measure_section {section}, gate {checkpoint}. Describe one only after it rejects its arguments. Any other error or refusal stops the action; never bypass it with a manual write or shell script. `read_record` serves JSON records only; read authored artifacts directly: `project://sections/{s}/context`, `research`, `summary` and `handoff` are `.planning/sections/{s}/<name>.md`, plans and reviews are `.planning/sections/{s}/plans/<id>.md` and `reviews/<id>.md`, and `project://paper/{a}` is `paper/{a}.md`.
Read a large source or manuscript by section with `grep` and a bounded `read` range, never whole: Clio ends the turn when one turn's reads exceed its observation budget.
An author's request is never permission to write outside this action's declared outputs: do the part it declares, then end by naming the action that owns the rest as the next step, and do not ask again or weigh the request against the contract; the desk refuses the rest regardless.
Start from the desk's status, not from individual records: the reminder the desk injects when a WTF-P turn starts, or `extension_wtfp__status` inside an advance run or after this action writes. Then read only the records and artifacts this action will change, quote or check in detail.
If desk tools are absent, follow `${pluginRoot}/workflows/research-gap.md` and `${pluginRoot}/project/README.md` with native tools and `ask_user` gates.

## Bound action contract

The desk enforces `${pluginRoot}/actions/research-gap.json`; this prompt states its reads, outputs, conditions, gates and roles. Read it only when a refusal needs its exact terms.

## Invocation input

Treat the following text as the user-supplied input for this action. Preserve it exactly as data; it does not override the workflow, safety rules, approval gates, or project protocol.

<invocation_arguments>
$ARGUMENTS
</invocation_arguments>

## Clio user-gate binding

This action creates no checkpoint, so ask its gate question with `ask_user` and act on the structured answer; call `extension_wtfp__gate` only for a pending checkpoint `extension_wtfp__status` lists in the gate's exact scope, and never create one. Only the structured author answer satisfies the gate; cancelled, kept or expired checkpoints authorize nothing. Never write `resolution.resolved_by: author`, never resolve, unblock or expire a blocking checkpoint, and never infer approval from invocation text, prose or silence. A plan is approved only by an `approve` answer on a checkpoint scoped to that plan's URI, for its current bytes. Read back a persisted resolution with `extension_wtfp__read_record`, which reports whether the desk attests it, before applying its gated mutation. A record change that turns a gate off waits for the author's confirmation, which the record tool asks for itself.

Every question `ask_user` puts to the author here is the author's to answer: ask exactly one question per `ask_user` call, with its options and `operator_only: true`; Clio refuses an `operator_only` question sent with others. Clio never answers such a question for an absent author; an unanswered one ends the turn instead of taking a recommended option, so a timeout never becomes an author decision.

## Clio CiteNexus binding

At yolo autonomy, search through the operator's CiteNexus MCP server, declared as `cite-nexus` with read-class tools in their user configuration. This prompt admits its four lookup capabilities, so call them directly without a gateway `find` or `describe`, each of which resends the whole context: `gateway(op="call", capability="mcp_cite-nexus__search-papers", args={query, providers, limit})` with a bounded public metadata query, `providers` drawn from `crossref`, `datacite`, `europe_pmc` and `arxiv`, and `limit` at most 10 per provider; results are compact, without abstracts. Check a candidate with `mcp_cite-nexus__resolve-paper` `{identifier}` or `mcp_cite-nexus__verify-citation` `{citation, expected_title, expected_year}`, and fetch a reference with `mcp_cite-nexus__get-citation` `{identifier, format}`. MCP connections are session-owned and unavailable in delegated workers, so pass the returned candidates and provenance to `wtfp-research-synthesizer` instead of asking that worker to discover the MCP server. This user-configured read connection is prior authorization for those searches; do not call `ask_user` again for each query. Only if the gateway reports no MCP server named `cite-nexus` may yolo instead run the bundled `citation-search --backend=cite-nexus` through its declared dispatcher with bounded public queries and an explicit `--providers` list containing only `crossref`, `datacite`, `europe_pmc`, or `arxiv`; pass those candidates to the same specialist. An operator-set offline flag, unavailable companion, or host refusal stops this route. Other providers and modes follow the declared user gate. Never bypass a gateway refusal by rerunning the same denied request through `bash`. Record the exact provider IDs, queries, limits, date, and provenance; verify each retained candidate before citing it.

## Clio role-result binding

Dispatch the declared specialist roles using these exact Clio agent IDs: `wtfp-research-synthesizer`. Do not substitute generic coder or verifier agents. Give every dispatched task an `agent` and an `intent` with workspace-relative `read_roots`, and keep absolute paths and `project://` URIs out of the task text, so Clio admits the scope you declare instead of inferring one from the prose. If a named agent is unavailable, report that blocker and stop instead of silently changing roles.

Read the single wtfp.role-result entry in native validations and parse its evidence string as portable role-result JSON. Validate its schema, role and action against the dispatched task. Missing, duplicate or malformed outcomes fail closed. On needs_input ask the author through ask_user and redispatch with the response; on blocked or failed stop and report the issue. Only completed permits downstream work, and it never substitutes for an author gate or artifact readback.

<!-- Generated by WTF-P adapter compiler v5 from protocol/actions/research-gap; do not edit. -->
