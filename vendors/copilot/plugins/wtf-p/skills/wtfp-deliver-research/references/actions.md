# Research-delivery actions

Use exactly one action procedure per invocation. Treat generated formats and archived milestones as derived artifacts with explicit provenance.

## Target compatibility blockers

This generated `copilot` projection is authoritative for the actions below. Do not follow their canonical procedure on this target.

### `create-poster`

WTFP_ACTION_UNAVAILABLE

Action: `create-poster`
Target: `copilot`
Unavailable capabilities: `tool.execute`
Unavailable effects: `tool.execute`

No workflow, tool, network request, package operation, external issue, VCS operation, or other effect ran.
Safe alternative: preserve project state and return a manual, non-executed handoff for the requested operation.

### `create-slides`

WTFP_ACTION_UNAVAILABLE

Action: `create-slides`
Target: `copilot`
Unavailable capabilities: `tool.execute`
Unavailable effects: `tool.execute`

No workflow, tool, network request, package operation, external issue, VCS operation, or other effect ran.
Safe alternative: preserve project state and return a manual, non-executed handoff for the requested operation.

### `export-latex`

WTFP_ACTION_UNAVAILABLE

Action: `export-latex`
Target: `copilot`
Unavailable capabilities: `tool.execute`
Unavailable effects: `tool.execute`

No workflow, tool, network request, package operation, external issue, VCS operation, or other effect ran.
Safe alternative: preserve project state and return a manual, non-executed handoff for the requested operation.

## `export-latex`

Contract: [protocol/actions/export-latex.json](../../../actions/export-latex.json)

1. Require manuscript content and resolve section order from `project://structure/outline` or a confirmed explicit order.
2. Resolve identity and requirements from `project://manifest`, policy from `project://config`, verified source records, manuscript citations, figures, tables, equations, appendices, and acknowledgements. Ask rather than infer missing authorship or venue data.
3. Ask the author to choose a generic, verified venue, custom, or plain template. Record the template identity and version or hash when available.
4. Create output under `project://deliverables/latex/{artifact}`. Never replace a source `project://paper/{artifact}`.
5. Convert structure deliberately:
   - map headings according to document hierarchy, not by a blind level substitution;
   - escape reserved characters outside raw math and typesetting blocks;
   - preserve inline and display mathematics;
   - convert citation keys without changing them;
   - create figure and table environments with stable labels, captions, paths, and accessibility text;
   - preserve cross-references, footnotes, lists, code, quotations, and appendices.
6. Copy or reference only project-contained assets. Refuse paths that escape the project and report missing assets.
7. Build the bibliography from a verified bibliography database. Do not synthesize records from prose notes; emit an unresolved-record report instead.
8. Write an export manifest with logical input URIs and revisions or hashes, generated files, template identity, conversion warnings, and validation status.
9. Run a syntax check and, when compilation is requested and a configured host-provided compiler is locally available, invoke it in the contained export directory under the action's declared `tool.execute` effect. Capture diagnostics and distinguish warnings from fatal errors; the compiler is a host capability, not an undeclared portable bibliography tool.
10. Verify output existence, citation and reference resolution, asset paths, page or word constraints, and that source files are unchanged.
11. Report generated paths, compilation status, warnings, unresolved manual steps, and reproducible build instructions.

Completion requires valid source output and a manifest; a final rendered document is required only when compilation was available and requested.

## `submit-milestone`

Contract: [protocol/actions/submit-milestone.json](../../../actions/submit-milestone.json)

1. Require the five core v1 records, section/source/evidence records, manuscript artifacts, and a non-empty path-safe milestone label. Reject separators, traversal, control characters, collisions, and ambiguous normalized labels.
2. Gather reproducible statistics from records and verified artifacts: completed sections, actual and target words, verified citations, figures, tables, validations, and open issues.
3. Read the current milestone `project://validations/{validation}` and compare its recorded input revisions or hashes with current resources. Warn if missing, failed, or stale.
4. If work is incomplete, present the exact omissions and require explicit approval to archive an incomplete milestone. Never label it submission-ready implicitly.
5. Present a complete effect preview: final `project://archives/{archive}/{artifact}` resources, exact record/artifact revisions copied, manifest/state transitions, and any completion-status reset. VCS and remote effects are outside this action.
6. Build the archive in an adapter-provided temporary sibling location. Copy exact manifest, config, state, decisions, outline, section records and authored artifacts, sources, evidence, validations, manuscript, and delivery manifest according to policy.
7. Write archive metadata with label, date, status, source record revisions and artifact hashes, statistics, known issues, and included-resource hashes.
8. Verify every archived hash and required resource before atomically publishing the final archive URI. On failure, leave active records untouched and report recovery material.
9. Add the archive URI and delivery metadata to the manifest's author-approved artifact inventory only where the schema permits; otherwise keep history in the archive manifest rather than a Markdown index.
10. Change a requirement, claim, or section status only when a current validation and evidence support the transition.
11. Only after archive verification, preview any state transition for a revision round. Preserve stable section IDs, keep the archive immutable, and require approval before resetting completion statuses.
12. Re-read archive, manifest, outline, section records, and state; verify they agree. Report archive URI, hashes/revisions, readiness caveats, and next action. Return any desired VCS operation as a non-executed handoff.

Completion requires an independently verified immutable archive before any active-state reset.

## `create-slides`

Contract: [protocol/actions/create-slides.json](../../../actions/create-slides.json)

1. Require project identity and enough manuscript or verified results to support a presentation.
2. Ask for duration, expected slide count, audience, occasion, delivery format, visual style, and desired emphasis.
3. Derive a timed narrative: audience problem, thesis, minimum background, method, strongest evidence, limitations, implications, and closing takeaway. Allocate time and slides before writing.
4. Use verified project claims and cite source or manuscript locations in speaker notes or a references slide. Do not introduce novel results to make the story cleaner.
5. Prefer one communicative purpose per slide. Use concise text, readable type, high contrast, descriptive titles, accessible color, and alt text or equivalent descriptions for meaningful visuals.
6. Use existing figures only when provenance and interpretation are known. Mark placeholders and data needs explicitly; never fabricate a chart.
7. Generate editable slide source and a delivery manifest under `project://deliverables/slides/{artifact}`.
8. Validate slide count, timing, missing assets, citations, visual overflow, contrast where testable, and narrative continuity. Render only when requested and a configured host-provided local renderer exists; invoke it under the action's declared `tool.execute` effect rather than treating it as a bundled portable tool.
9. Report source and rendered paths separately, validation limits, rehearsal notes, and manual fixes.

Completion requires an audience-appropriate editable deck with an honest render status.

## `create-poster`

Contract: [protocol/actions/create-poster.json](../../../actions/create-poster.json)

1. Require project identity and verified manuscript findings. Ask for dimensions, orientation, venue rules, audience viewing distance, title, authors, affiliations, contact details, output format, and available visuals.
2. Define a non-linear reading hierarchy: one-sentence takeaway, motivation, minimal method, principal evidence, limitations, conclusion, and contact or artifact link.
3. Budget physical space before writing. Prioritize the title, takeaway, and strongest figure; avoid shrinking prose to preserve excess content.
4. Use verified claims, values, citations, and figures. Record provenance and include accessible descriptions. Mark missing visuals as placeholders rather than generating false evidence.
5. Generate editable poster source and a delivery manifest under `project://deliverables/poster/{artifact}`.
6. Check dimensions, orientation, margins, font sizes at final scale, column flow, contrast, image resolution, citation legibility, link or code targets, and overflow.
7. Render only when requested and a configured host-provided local renderer exists; invoke it under the action's declared `tool.execute` effect and verify the actual artifact dimensions. Distinguish source validity from render success.
8. Report source and rendered paths, validation results, print-service considerations, and unresolved manual steps.

Completion requires a legible, evidence-faithful poster source with verified dimensions or a precise render handoff.
