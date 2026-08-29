# Literature-research actions

Use exactly one action procedure per invocation. Keep a machine-readable or clearly structured provenance trail whenever external research occurs.

## Target compatibility blockers

This generated `opencode` projection is authoritative for the actions below. Do not follow their canonical procedure on this target.

### `analyze-bib`

WTFP_ACTION_UNAVAILABLE

Action: `analyze-bib`
Target: `opencode`
Unavailable capabilities: `tool.execute`
Unavailable effects: `tool.execute`

No workflow, tool, network request, package operation, external issue, VCS operation, or other effect ran.
Safe alternative: preserve project state and return a manual, non-executed handoff for the requested operation.

### `check-refs`

WTFP_ACTION_UNAVAILABLE

Action: `check-refs`
Target: `opencode`
Unavailable capabilities: `tool.execute`
Unavailable effects: `tool.execute`

No workflow, tool, network request, package operation, external issue, VCS operation, or other effect ran.
Safe alternative: preserve project state and return a manual, non-executed handoff for the requested operation.

### `research-gap`

WTFP_ACTION_UNAVAILABLE

Action: `research-gap`
Target: `opencode`
Unavailable capabilities: `tool.execute`
Unavailable effects: `tool.execute`

No workflow, tool, network request, package operation, external issue, VCS operation, or other effect ran.
Safe alternative: preserve project state and return a manual, non-executed handoff for the requested operation.

## `research-gap`

Contract: [protocol/actions/research-gap.json](../../../actions/research-gap.json)

1. Require `project://manifest` and resolve one `project://sections/{section}` from `project://structure/outline` by stable identifier or unambiguous name.
2. Read the section goal and claim IDs, `project://decisions`, section context, existing source/evidence records, manuscript citations, and any prior research artifact.
3. Ask what decision the research must support: key citations, methods, state of the field, competing explanations, positioning, or another explicit question.
4. Choose depth from the request or `project://config`:
   - `quick`: synthesize only the available corpus by default; do not create a persistent research artifact unless requested;
   - `standard`: run a focused, reproducible search across the most relevant categories;
   - `deep`: map foundational, recent, competing, gap-defining, and methodological work, including important disagreements and intellectual lineage.
5. Form search questions and inclusion criteria before searching. Record databases or corpora, query strings, date, filters, and stopping rule.
6. Search authoritative scholarly sources when external research is approved and available. Deduplicate candidates by persistent identifier, then normalized title.
7. Verify each retained source from its primary record or publication. Create a `project://sources/{source}` record with title, creators, year, source kind, identifiers, citation key, status, provenance, inspection depth, and verification time.
8. Read enough of each source to distinguish its actual claim, method, population, result, and limitation. Do not cite an abstract-only impression as full-paper evidence.
9. Create `project://evidence/{evidence}` separately for each retained claim-level interpretation, with relation, locator, limitations, confidence, and inspection depth. Synthesize by question rather than listing papers; identify consensus, disagreement, methodological differences, missing evidence, and defensible positioning.
10. For persistent research, write the Markdown artifact `project://sections/{section}/research` containing:
    - scope and method;
    - verified source table;
    - thematic synthesis;
    - claim-to-source map;
    - competing explanations and limitations;
    - unresolved searches and confidence;
    - concrete implications for the section plan.
11. Preserve an existing research artifact by merging on stable source/evidence URI and retaining author annotations. Link the artifact from the section record only after it validates.
12. Report source counts by verification status, search limitations, disputed points, and the next planning action.

Completion requires traceable evidence tied to section decisions. A long source list alone is not completion.

## `analyze-bib`

Contract: [protocol/actions/analyze-bib.json](../../../actions/analyze-bib.json)

1. Resolve the requested bibliography as a contained `project://materials/{artifact}` or `project://paper/{artifact}`. If none is supplied, enumerate candidates and require a choice when more than one is plausible.
2. Read the artifact and matching `project://sources/{source}` records without editing them. Parse entries deterministically and report syntax errors with locations.
3. Normalize metadata in memory for analysis while preserving original keys and text on disk.
4. Calculate transparent descriptive signals such as publication years, entry types, venues, authors, topic terms, identifier coverage, and duplicate candidates. Do not present a heuristic score as scholarly impact.
5. Load `project://manifest`, `project://structure/outline`, section records, existing source/evidence records, and relevant manuscript citations.
6. Group works by research question, method, evidence type, historical role, and competing position. Mark classifications as interpretations.
7. Identify likely foundational and central works using evidence available in the records or verified external metadata. Before external citation-metric enrichment, disclose the provider and bounded query set and obtain explicit approval. If the network is unavailable or approval is withheld, remain local-only and label external metrics unavailable. Explain the basis; do not infer importance solely from age, title, or a time-varying heuristic score.
8. Map each useful source to one or more section claims, with intended citation purpose: background, method, support, contrast, limitation, or future work.
9. Identify bibliography-level gaps: missing periods, missing competing approaches, unsupported claims, overreliance on one group or venue, and records needing verification.
10. Create or reconcile source identity/provenance in `project://sources/{source}`, claim mappings in `project://evidence/{evidence}`, and a read-only `project://validations/{validation}` with corpus summary, clusters, key-work rationale, coverage, gaps, and unverified items. Do not create a Markdown source-of-truth index.
11. Ask the author to confirm interpretive judgments such as seminal works or intentional exclusions.
12. Leave the bibliography unchanged; route metadata changes to `check-refs`.

Completion requires a section-aware citation strategy whose conclusions are distinguishable from deterministic metadata facts.

## `check-refs`

Contract: [protocol/actions/check-refs.json](../../../actions/check-refs.json)

1. Resolve `project://config`, verified and provisional source/evidence records, the author-selected `project://materials/{artifact}` bibliography, and `project://paper/{artifact}` resources in scope. Treat generated deliverables as outputs unless the author explicitly chooses them as sources.
2. Parse the bibliography and extract in-text citation keys with format-aware parsers when available. Do not rely on one universal regular expression across formats.
3. Build sets for:
   - cited keys with bibliography entries;
   - cited keys missing entries;
   - bibliography entries not cited in scope;
   - malformed or incomplete entries;
   - exact and probable duplicates;
   - inconsistent keys, names, dates, identifiers, and venue fields.
4. Distinguish errors from policy choices. An unused reference is not automatically an error; a preprint and published version are not automatically duplicates.
5. Search for suspicious metadata only after disclosing and receiving approval for the external providers and bounded query set. Treat provider results as candidate audit evidence until they are independently verified; do not create or update source records in this action.
6. Present an audit with logical URIs, affected keys, severity, confidence, and a proposed repair. Persist findings at `project://validations/{validation}` with the exact input record revisions or artifact hashes.
7. Ask the author how to handle unused, duplicate, missing, and conflicting records. Never remove, rename, merge, or rewrite an input in this action.
8. When a corrected bibliography is requested, preview the complete candidate and write it separately to `project://deliverables/bibliography/{artifact}`. Never overwrite the selected bibliography or manuscript, so this action requires no destructive backup or recovery mutation.
9. Parse the candidate independently, rescan the unchanged manuscript citations against it, and compare key and entry counts with the input bibliography.
10. Reject an invalid candidate, a silent metadata conflict, an unexplained entry loss, or a key migration that would leave an in-scope citation unresolved.
11. Write the final validation result and report candidate URI, fixed candidate issues, unresolved input issues, retained intentional exceptions, and exact record/artifact revisions. Route adoption of the candidate and any coordinated manuscript or source-record migration to a separately declared, explicitly approved action.

Completion requires a reproducible integrity audit and, when requested, a parseable non-destructive candidate; it does not claim the unchanged input bibliography has been repaired.
