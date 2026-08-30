# ADR 0001: Keep transforms local and defer network MCP exposure

- Status: Accepted for the `0.6` release-candidate series; optional MCP implementation deferred
- Date: 2026-08-29
- Decision owners: WTF-P protocol and adapter maintainers
- Scope: the seven logical tools in `protocol/tools.json`

## Decision

WTF-P will ship no MCP server in `0.6.0-rc.2`.

Bibliography transforms remain local Node.js modules. Network research remains behind the canonical action capability, effect, and approval contracts and uses the existing local implementations for now. A future, optional MCP process boundary is permitted only for the network-dependent portion of the canonical tools, after every activation gate in this ADR passes. The local index, format, and rank transforms—and workflow-level degraded paths that explicitly report unavailable enrichment—remain the offline fallback; the network-tool implementations themselves are not claimed to work offline.

The release candidate deliberately does **not** translate logical
`tool.execute` into an unrestricted Claude `Bash` or Copilot `execute` grant.
The seven modules are packaged and inventory-authenticated, but WTF-P does not
yet ship a closed logical-tool launcher or native Clio binding. A host must bind
the exact logical tool itself, or report the capability unavailable; an operator
may also invoke a module manually under the host's own containment policy. The
current local modules are therefore not claimed to be an autonomously contained
tool surface. Closed schemas, project-path containment, environment filtering,
deadlines, and byte limits remain gates for any future autonomous binding.

The obsolete Claude-only research-server prototype is removed. It was not a viable fallback: it was outside compiler-v4 ownership, had no Claude `.mcp.json` registration, declared two ad hoc tool names instead of the seven canonical logical tools, depended on packages that were not installed with the extension, and targeted `@modelcontextprotocol/sdk` `^0.6.0`. The current official TypeScript SDK is v2 and implements the 2026-07-28 specification.

This is a hybrid architectural decision, not a claim that a server exists. “Hybrid” means local transforms now plus a deliberately gated option to isolate network operations later.

## Canonical tool inventory and placement

The registry remains the only allowed tool surface. Its current implementations have these observable properties:

| Logical tool | Current behavior | Deterministic with its current public defaults | Declared effects | Placement |
| --- | --- | ---: | --- | --- |
| `bibliography.analyze-impact` | Reads a bibliography, performs a Semantic Scholar title search for every entry, and uses clock-dependent citation velocity | No | `filesystem.read`, `network.search` | Local orchestration now; its external-enrichment phase is an MCP candidate |
| `bibliography.format` | Parses and formats BibTeX; inserts the current date when `wtfp_fetched` is omitted | No | `filesystem.read` | Local; callers that need reproducibility must supply the date |
| `bibliography.index` | Parses and indexes supplied BibTeX | Yes | `filesystem.read` | Local |
| `citation.fetch` | Orchestrates Semantic Scholar and optional SerpAPI searches, CrossRef fallback searches, then ranks and formats candidate results | No | `network.search` | Local now; MCP candidate |
| `citation.rank` | Applies pure in-memory citation, velocity, recency, and venue heuristics; recency depends on the clock by default | No | None | Local; an explicit reference date is supported for repeatable tests |
| `citation.scholar-lookup` | Searches SerpAPI Google Scholar using a separately supplied key and a process-local budget | No | `network.search` | Local now; MCP candidate |
| `citation.semantic-scholar` | Searches and fetches Semantic Scholar records with retries and timeouts | No | `network.fetch`, `network.search` | Local now; MCP candidate |

The corrected registry deliberately marks clock dependence as nondeterminism even when no network is used. A process boundary cannot make time-varying inputs or remote scholarly metadata deterministic.

## Evidence

### Existing server audit

At WTF-P commit `ae3b674629e5b0a13da2ed855d267474351417ee`, `vendors/claude/mcp/research-server` contained a hand-maintained prototype with these defects:

1. `vendors/claude/.wtfp-generated.json` did not own either prototype file, but the package allowlist included all of `vendors/` and a complete Claude install recursively copied the entire bundle.
2. The Claude manifest offered `mcp` as a selectable root even though the plugin had no `.mcp.json` or inline `mcpServers` declaration.
3. The prototype exposed only `search_papers` and `get_bibtex`, not the logical IDs or implementations in `protocol/tools.json`.
4. Its two runtime dependencies were declared only in the nested package and were absent from the shipped dependency-free installation. Direct startup therefore failed at module loading.
5. It offered unbounded external identifiers and queries, returned provider errors as free-form text, had no output-size limit, did not contain project paths, and did not implement the canonical action approval boundary.

Removing the directory and its Claude installer selection is safer than preserving an unregistered, unowned artifact that cannot start.
The npm file allowlist also excludes `vendors/claude/mcp/**`; a minimal packlist fixture verified that the negated pattern preserves sibling Claude files while omitting an MCP sentinel.

### Local latency benchmark

The following indicative microbenchmark was run on 2026-08-29 with Node.js `v24.9.0`, Linux x64, and an AMD Ryzen AI MAX+ PRO 395. Warm measurements used 20 warm-up calls followed by the stated iterations, consumed each output through a checksum, and measured each call with the monotonic performance clock; the cold measurement used 40 fresh `node` processes. Inputs were synthetic and fixed. These numbers are diagnostic evidence, not release performance guarantees. Reproduce the method with `node scripts/benchmark-tools.js`; timing values will vary by machine and load.

| Operation | Iterations | Median | p95 |
| --- | ---: | ---: | ---: |
| `bibliography.index`, 1,000 entries | 200 | 0.4640 ms | 1.1021 ms |
| `citation.rank`, 1,000 papers and an explicit clock | 200 | 0.7682 ms | 1.1719 ms |
| `bibliography.format`, one entry and an explicit date | 10,000 | 0.0002 ms | 0.0013 ms |
| Fresh Node process plus indexing 1,000 entries | 40 | 39.6142 ms | 42.9494 ms |

For the in-process transforms, a server adds startup, framing, schema validation, serialization, lifecycle, and observability work to sub-millisecond warm operations. Error isolation does not justify that overhead by itself; a future host binding can choose a bounded child process once the launcher gates below are implemented.

### Protocol and SDK state

The current MCP specification is 2026-07-28. It defines JSON-RPC requests, capability negotiation, tool input and optional output schemas, progress, cancellation, and structured error reporting. These are useful properties for network calls, but they provide value only when the implementation actually supplies closed schemas, honors cancellation, enforces timeouts, and maps provider failures truthfully.

The official SDK catalog currently classifies TypeScript, Python, C#, Go, and Rust as Tier 1. The TypeScript SDK v2 is the stable line for the 2026-07-28 specification; v1 receives only a limited compatibility period. Reintroducing the removed `^0.6.0` prototype would therefore create migration and security work before it delivered any user-visible capability.

### Host support matrix

“Native MCP” and “WTF-P can own an MCP server's lifecycle” are different claims.

| WTF-P host | Current native evidence | Extension-owned lifecycle usable by the current WTF-P envelope | Consequence |
| --- | --- | ---: | --- |
| Clio Coder 0.3.8 | No gateway. At merged branch `v0.3.8` commit `9b7b80cc`, `gateway` is design-reserved and ACP rejects non-empty `mcpServers`. | No | Blocks a Clio-targeted implementation |
| Claude Code | Supports stdio/HTTP MCP; plugins can bundle `.mcp.json` servers that start and stop with the plugin. | Technically yes, but WTF-P declares none | Do not revive the broken prototype |
| Codex CLI/IDE/desktop | Supports stdio and Streamable HTTP; current plugin configuration can bundle MCP servers and tool approval policy. | Technically yes, but WTF-P declares none | Keep the generated profile unchanged until the canonical server exists |
| GitHub Copilot CLI 1.0.81 research probe | `copilot mcp --help` reports local stdio, remote HTTP/SSE, workspace, user, and installed-plugin sources. Compatibility certification separately used 1.0.80. | Technically yes, but WTF-P declares none | Native support alone is not a reason to add a server |
| GitHub Copilot cloud/code review | Repository administrators can configure MCP, but tools run autonomously without a per-call approval prompt; resources/prompts and remote OAuth are not supported. | No portable extension-owned lifecycle in the WTF-P envelope | Approval semantics differ materially; static support only |
| Gemini CLI | Supports stdio, SSE, and Streamable HTTP; Gemini extensions may declare `mcpServers`. | Technically yes, but WTF-P declares none | Candidate only after the shared gates pass |
| OpenCode | Supports local and remote servers in OpenCode configuration. | Not established for the generated filesystem bundle | Treat as host-configured, not WTF-P-owned |
| Antigravity CLI | No certified MCP lifecycle is present in the generated plugin or its validator evidence. | No certified path | Report unsupported rather than infer compatibility |

This asymmetry would make MCP behavior less portable than the current packaged
module allowlist. That allowlist controls package provenance, not arbitrary host
execution. In particular, GitHub Copilot cloud's autonomous calls do not satisfy
the same interactive approval model as Claude or Codex.

## Options considered

### Ship an MCP server for all seven tools

Rejected. Five operations are either fully local or contain a local phase for which MCP adds no semantic value. The removed server did not match the registry, could not start, and lacked executable contracts. Shipping it would turn an optional research feature into an install and lifecycle liability.

### Remove MCP permanently

Rejected. A process boundary could materially improve credential isolation, provider-specific network policy, cancellation, crash containment, provenance, and per-call telemetry for remote scholarly services. Those benefits are strongest for the four network-dependent tools and are worth preserving as an option.

### Local transforms plus an optional network MCP server

Accepted conditionally. It preserves fast offline behavior and the same seven logical IDs while leaving room for a contained network service when the primary host and contracts are ready.

## Evaluation against the requested criteria

| Criterion | Local implementation now | Optional network MCP after gates |
| --- | --- | --- |
| Portability | All seven generated clients receive the same authenticated modules, but not an autonomous shell grant | Native transport and lifecycle differ by host |
| Determinism | Strong for `bibliography.index`; explicit clock/date makes local tests repeatable | Does not make remote data deterministic |
| Startup/per-call latency | Sub-millisecond warm transforms; about 40 ms measured cold process baseline | Adds protocol and server lifecycle overhead |
| Schema fidelity | Registry identifies tools but does not yet define closed executable input/output schemas; autonomous host binding is withheld | Can enforce JSON Schema once those canonical schemas exist |
| Cancellation/timeouts | Provider modules have partial timeouts/retries and no common cancellation contract; this blocks autonomous binding | MCP provides protocol hooks, but the server must honor them |
| Error isolation | Host may use a bounded child process | Stronger crash boundary and structured transport errors |
| Credential/environment isolation | Manual invocation or an external host binding supplies provider environment; WTF-P does not claim isolation | Server launcher can forward only allowlisted variables |
| Network permission boundary | Declared by action/tool metadata; generated adapters do not widen it to a general shell | Can be separately enabled and approved per server/tool |
| Lifecycle/ownership | Exact generated-file receipts already exist | Incomplete across Clio, OpenCode, Antigravity, and Copilot cloud |
| Provenance/observability | Must be recorded by each workflow | Natural place for request IDs, provider, latency, and status telemetry |
| Offline fallback | Available for manual or exact host binding of index/format/rank; network workflows must degrade explicitly when enrichment is unavailable | Must delegate back to local transforms and the same honest degraded workflow path |
| Packaging/cross-platform | Dependency-free CommonJS on Node.js 20+ | Adds SDK/version/dependency and subprocess packaging risk |

## Activation gates for a future MCP server

No generated client manifest may declare the server until all of these are executable tests, not documentation promises:

1. Clio exposes a supported gateway or extension-owned MCP lifecycle, including deterministic shutdown on disable/remove. If another host is used for an earlier experiment, it must remain explicitly experimental and cannot support a cross-client compatibility claim.
2. The canonical registry defines closed Draft 2020-12 input and output schemas, maximum sizes, timeout policy, and error codes for each exposed logical tool. Only registry tools may be exposed; there is no arbitrary shell or generic filesystem tool.
3. Every project path is lexical- and realpath-contained under an explicit root, rejects symlinks and traversal, and is checked again at use time.
4. Network tools and local tools are separately enabled. Provider hosts, query limits, result limits, retry ceilings, and paid-service use are explicit. Credentials are forwarded by name through an allowlist and are never accepted as tool arguments or logged.
5. Calls support cancellation and hard deadlines. Responses enforce byte, record-count, and nesting limits before entering model context.
6. Unavailable, crashed, malformed, hanging, oversized, path-traversing, prompt-injecting, and protocol-incompatible servers all fail closed with structured recovery actions.
7. Tool results record provider, request/correlation ID, query scope, observation time, latency, cache status, and verification status without logging secrets or full private bibliography content.
8. Disable, uninstall, upgrade, failed activation, and client exit leave no server process, credential copy, registration, or user-profile residue.
9. A benchmark demonstrates a concrete isolation or reliability benefit for network operations. The local implementations remain available for offline work, and cross-version behavioral evaluation shows no evidence- or approval-regression.
10. Adapter generation, native validators, full tests, malicious-server tests, archive inspection, and normal-profile pre/post hashes pass on every host for which support is claimed.

## Consequences and deliberate deferrals

- `bibliography.analyze-impact` now honestly declares `network.search`, and `analyze-bib` declares the corresponding capability, effect, and explicit provider/query approval gate. `citation.fetch` declares only the provider searches it performs, while `citation.semantic-scholar` separately declares both search and selected-record fetch behavior. `check-refs` treats search results as candidate audit evidence until independently verified and carries its search permission behind a bounded provider/query gate. Local-only analysis remains useful when network access is denied.
- Clock-dependent format and ranking tools are no longer labeled deterministic. Ranking accepts an explicit reference date so required tests and baselines can be repeatable.
- Legacy tool tests are part of the required npm graph, and the citation-fetcher test uses an offline provider fixture.
- No MCP SDK is added to the package, no server is registered, and no compatibility claim is upgraded.
- Closed executable schemas, a contained logical-tool launcher, generic abort
  propagation, response limits, stronger path handling in the legacy
  command-line tools, and a network-server implementation are deliberately
  deferred to the activation gates. Until those exist, generated adapters do
  not grant a general shell merely because an action declares `tool.execute`.

## Sources

All web sources were accessed 2026-08-29.

- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
- [Official MCP SDK catalog and maintenance tiers](https://modelcontextprotocol.io/docs/sdk)
- [Official MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude Code MCP reference](https://code.claude.com/docs/en/mcp)
- [Claude Code plugin reference: bundled MCP servers](https://code.claude.com/docs/en/plugins-reference#mcp-servers)
- [Codex Model Context Protocol documentation](https://learn.chatgpt.com/docs/extend/mcp)
- [GitHub Copilot repository MCP configuration](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/configure-mcp-servers)
- [Gemini CLI MCP servers](https://geminicli.com/docs/tools/mcp-server)
- [Gemini CLI extension authoring](https://geminicli.com/docs/extensions/writing-extensions)
- [OpenCode MCP servers](https://opencode.ai/docs/mcp-servers)
- Clio Coder source evidence: `docs/prompt-envelope-and-tools.md`, `docs/acp.md`, and branch `v0.3.8` at `9b7b80cc`
