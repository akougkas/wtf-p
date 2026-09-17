# CiteNexus companion

CiteNexus supplies source-backed scholarly discovery to WTF-P. WTF-P owns the writing
workflow, approval gates and durable project state; CiteNexus owns provider queries,
metadata normalization, provenance and deterministic citation export. The integration
ships in `wtf-p@0.7.0` as an optional backend. CiteNexus itself is a separate Python
package that WTF-P never installs, registers or updates.

## Install the companion

Install Python 3.11+ and CiteNexus 0.2.0 into an environment you control:

```bash
python3 -m venv ~/.local/share/cite-nexus
~/.local/share/cite-nexus/bin/pip install cite-nexus-mcp==0.2.0
~/.local/share/cite-nexus/bin/cite-nexus-wtfp --check
```

`uv tool install cite-nexus-mcp==0.2.0` is an equivalent route. The check launches a
real MCP stdio server and lists provider configuration without querying an API.
WTF-P runs `cite-nexus-wtfp` from `PATH`, or the absolute executable named in the
environment that launches the host:

```bash
export WTFP_CITE_NEXUS_COMMAND="$HOME/.local/share/cite-nexus/bin/cite-nexus-wtfp"
```

An operator can exercise an installed or checked-out WTF-P package directly; the
dispatcher lives at `tools/wtfp-tool.js` in every generated envelope:

```bash
node vendors/plugin/tools/wtfp-tool.js citation-search \
  --backend=cite-nexus --query="reproducible research" --limit=5 --timeout=30
```

The existing `tool.execute` binding is certified on Clio and Claude Code, so their
research actions can reach this backend. The five other host projections still report
the relevant actions unavailable; this backend does not certify their shell execution
or native MCP lifecycle. The helper is packaged in all nine envelopes, but packaging
is not a host binding, and an operator's manual CLI check does not change that
compatibility matrix.

## Provider choice and costs

The backend defaults to `crossref,datacite,europe_pmc`, with no mandatory keys.
Use `--providers=crossref,arxiv` for a focused preprint search, or explicitly select
`semantic_scholar`, `openalex`, `serpapi`, `scopus` or `wos`. Optional or required
credentials use the names documented in the
[CiteNexus 0.2.0 provider guide](https://github.com/akougkas/cite-nexus-mcp/blob/v0.2.0/docs/providers.md).
Declare the chosen providers and query scope in the workflow's network approval.
Commercial/institutional APIs may incur cost or require an entitlement.

Only runtime essentials (`PATH`, locale and temporary-directory variables) and
credentials for selected providers reach the companion. Proxy and CA-bundle variables
such as `HTTPS_PROXY` and `SSL_CERT_FILE` are not forwarded, so a network that
requires them is unsupported by this backend.
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

From a WTF-P checkout, with the CiteNexus 0.2.0 source checkout or source
distribution alongside it:

```bash
npm run test:tools
npm run check:adapters
cd ../cite-nexus-mcp
uv run python scripts/check_wtfp.py --wtfp-root /absolute/path/to/wtf-p
```

The cross-repository check uses generated Clio and Claude dispatchers, the real
MCP stdio transport and fixture provider responses. It does not contact vendors
or modify a client profile. Companion process tests exercise Linux only; Windows
and macOS are not qualified.

To stop using the integration, omit `--backend=cite-nexus` and remove
`WTFP_CITE_NEXUS_COMMAND` from the launching environment. There is no background
service or MCP registration to remove. The independently installed companion may
be removed with its Python environment.
