# CiteNexus companion (unreleased)

CiteNexus supplies source-backed scholarly discovery to WTF-P. WTF-P owns the writing
workflow, approval gates and durable project state; CiteNexus owns provider queries,
metadata normalization, provenance and deterministic citation export. The integration
is prepared in this checkout and is not part of the published `wtf-p@0.6.0` package.

## Try the prepared checkouts

Install Python 3.11+, uv and the CiteNexus checkout alongside this repository:

```bash
cd ../cite-nexus-mcp
uv sync --locked
uv run cite-nexus-wtfp --check
```

The check launches a real MCP stdio server and lists provider configuration without
querying an API. Configure the absolute companion executable path in the environment
that launches WTF-P; for example, after substituting your checkout location:

```bash
export WTFP_CITE_NEXUS_COMMAND=/absolute/path/to/cite-nexus-mcp/.venv/bin/cite-nexus-wtfp
```

An operator can exercise the generated Clio package directly from this repository:

```bash
node vendors/plugin/tools/wtfp-tool.js citation-search \
  --backend=cite-nexus --query="reproducible research" --limit=5 --timeout=30
```

For host-driven execution, use a disposable profile with the newly generated WTF-P
package. The existing `tool.execute` binding is certified on Clio and Claude Code.
The five other host projections still report the relevant actions unavailable;
this backend does not certify their shell execution or native MCP lifecycle.
An operator's manual CLI check does not change that compatibility matrix.

## Provider choice and costs

The backend defaults to `crossref,datacite,europe_pmc`, with no mandatory keys.
Use `--providers=crossref,arxiv` for a focused preprint search, or explicitly select
`semantic_scholar`, `openalex`, `serpapi`, `scopus` or `wos`. Optional or required
credentials use the names documented in the
[CiteNexus provider guide](https://github.com/akougkas/cite-nexus-mcp/blob/main/docs/providers.md).
Declare the chosen providers and query scope in the workflow's network approval.
Commercial/institutional APIs may incur cost or require an entitlement.

Only runtime essentials and credentials for selected providers reach the companion.
It ignores `.env` files, unrelated tokens and `CITE_NEXUS_DEFAULT_PROVIDERS`.
Set optional credentials in the launching process environment. Supplying a key
never selects a paid provider. No automatic install, vendor fallback, bibliography
write or client configuration change occurs. Remove the flag to use the existing
legacy backend; `--offline` refuses both network backends.

## Result contract

The companion uses `cite-nexus.wtfp/v1` over one JSON stdin/stdout exchange, then calls
the official MCP `search-papers` tool through stdio. The seven canonical logical
tools and declared `network.search` effect stay intact. Other CiteNexus tools can be
configured separately in a host's MCP client; this search backend does not call
identifier-resolution tools under a search-only permission.

- `results[].verification` is always `candidate`. A DOI and formatted BibTeX are not
  proof of identity, claim support, author completeness or absence of retraction.
- `results[].citeNexus` retains source URLs, retrieval times, field attribution,
  identifiers, per-provider metrics, author completeness and retraction evidence.
- `results[].bibtex` is a candidate export from those observed fields. It contains
  no inferred `wtfp_status=official`. Preserve the adjoining source record in the
  research evidence table and independently verify a match before adopting it.
- `metadata.errors` retains partial provider failures. Empty results with errors
  indicate unavailable enrichment, not proof that the literature does not exist.
- `--limit=1..25` caps the displayed total. `metadata.total` counts the fetched,
  deduplicated page, not the corpus. Provider page size is recorded separately;
  upstream `next_offsets` / `next_cursors` belong to those provider pages. A truncated
  display can omit fetched candidates; use native CiteNexus search for full paging.
- Provider ranks are interleaved. Use `--intent=balanced` (the default); seminal and
  recency ranking are explicitly rejected for this backend. `--year` filters the
  fetched page to a supplied year. Citation counts are never combined or ranked here.

Queries are capped at 512 characters, responses at 2 MiB and JSON nesting at 32.
Malformed, incompatible, hanging and oversized companions fail explicitly. Stderr
is drained without forwarding its contents. Deadlines and cancellation stop the
companion; its SDK closes the server process group. A fresh server starts per call,
so its metadata cache is not shared across WTF-P searches.

## Verification and removal

```bash
npm run test:tools
npm run check:adapters
cd ../cite-nexus-mcp
uv run python scripts/check_wtfp.py --wtfp-root ../wtf-p
```

The cross-repository check uses generated Clio and Claude dispatchers, the real
MCP stdio transport and fixture provider responses. It does not contact vendors
or modify a client profile. Companion process tests currently exercise Linux;
native Windows/macOS installation needs separate release qualification.

To stop using the integration, omit `--backend=cite-nexus` and remove
`WTFP_CITE_NEXUS_COMMAND` from the launching environment. There is no background
service or MCP registration to remove. The independently installed companion may
be removed with its Python environment. Do not publish either package until the
release checklist and companion-version checks are complete.
