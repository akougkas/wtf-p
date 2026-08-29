# Start-project actions

Use exactly one action procedure per invocation. Resolve every project URI through the host adapter and apply the safety and structural invariants in the parent skill throughout.

## `new-paper`

Contract: [protocol/actions/new-paper.json](../../../actions/new-paper.json)

1. Resolve `project://manifest`. If it exists, stop and offer to inspect or repair the project; never silently reinitialize portable state.
2. Scan the authorized project root for existing `project://materials/{artifact}` and `project://paper/{artifact}` resources: manuscripts, bibliographies, figures, data, and notes. Exclude version-control metadata, adapter-owned state, dependency caches, generated output, and the conventional portable-record store. Do not follow a symlink outside the root.
3. If substantial material exists but no source records exist, offer `map-project`. Continue only when the author chooses to initialize first.
4. Gather the foundations in a compact interview:
   - document type and working title;
   - target venue or delivery context;
   - one-sentence core argument or contribution;
   - intended audience and the one thing it should remember;
   - must-have, desirable, and out-of-scope content;
   - deadlines, page or word limits, authorship, data, ethics, and confidentiality constraints;
   - known evidence, open questions, important disagreements, and choices delegated to editorial discretion.
5. Refine a weak argument by asking what is new, what evidence could support it, and what reasonable alternative it must defeat. Preserve the author's decision as a decision record rather than silently replacing it with an agent inference.
6. Verify venue constraints from a project-provided or authoritative source. Mark constraints provisional when verification is unavailable.
7. Propose the exact v1 policy: interaction mode, depth, output format, language, citation style, five approval gates, four workflow checks, mandatory safety flags, and parallelism. Do not introduce legacy model, planning-document, or VCS configuration keys.
8. Preview five schema-valid records and their stable project ID:
   - `project://manifest` for identity, core argument, target, requirements, artifact index, and timestamps;
   - `project://config` for portable workflow policy;
   - `project://state` for lifecycle, current position, progress, checkpoints, and last transition;
   - `project://decisions` for locked, deferred, and discretionary author decisions;
   - `project://structure/outline` for a clearly provisional thesis and initial section structure.
   Require the outline's `sections[*].word_target` values to sum exactly to its
   `target_words`; revise the proposed allocation before presenting the preview
   when they do not.
9. At the initialization gate, explain any existing path collision and the exact records that would be created. Do not offer repository initialization, staging, committing, branching, merging, pushing, or publishing as part of this action.
10. Write the approved records atomically through the adapter. Validate each against its v1 schema, read it back, verify URI containment and cross-record project IDs, and remove partial newly created records if the atomic set cannot be completed safely.
11. Report record URIs, author decisions, provisional constraints, unresolved questions, and whether `map-project` or `create-outline` is the next action.

Completion requires five valid and mutually consistent v1 records; no Markdown control file substitutes for them.

## `map-project`

Contract: [protocol/actions/map-project.json](../../../actions/map-project.json)

1. Establish the project boundary and whether ignored or hidden research material may be scanned. Never upload or externally inspect material as part of local mapping.
2. Inventory relevant materials by media type, size, modification time, stable relative identity, and logical artifact URI:
   - bibliography databases and reference notes;
   - manuscript drafts and reusable fragments;
   - data, analysis outputs, tables, and figures;
   - protocols, venue templates, reviews, and style guidance.
3. Avoid dependency trees, generated builds, archives, adapter state, and duplicate copies unless the author includes them. Record unreadable or unsupported files instead of silently skipping them.
4. Parse structured bibliography metadata with a deterministic parser when available. Never infer a missing identity field or scientific result as fact.
5. Create one `project://sources/{source}` record per bibliographic or data-source identity. Use stable IDs, explicit provenance, inspection depth, verification time, and `provisional` status when identity is not fully checked.
6. Create `project://evidence/{evidence}` only for an actual claim-level interpretation. Link it to a source record, state whether it supports, contradicts, or contextualizes the claim, include a locator and limitations, and never copy interpretation into source identity.
7. Preserve manuscript, dataset, figure, table, and prior-draft content as authored `project://materials/{artifact}` or `project://paper/{artifact}` resources. Mapping indexes them; it does not rewrite or move them.
8. Merge by stable source identity and contained artifact URI. Preserve curated annotations, detect duplicate identifiers and citation-key collisions, and do not replace a verified record with a weaker scan result.
9. Reconcile `project://state` to phase `mapped` only after the inventory records validate. Record the factual transition and retain active checkpoints.
10. Report counts, duplicates, missing metadata, unavailable formats, privacy-sensitive material, evidence gaps, and the exact records created or updated.

Completion requires a non-destructive, provenance-rich inventory whose source and evidence records validate independently.

## `create-outline`

Contract: [protocol/actions/create-outline.json](../../../actions/create-outline.json)

1. Require `project://manifest`, `project://decisions`, and `project://config`. If `project://structure/outline` already contains established sections, present a structural diff and obtain approval before revising it.
2. Load project requirements, verified and provisional source/evidence records, venue constraints, and current state. Identify unresolved argument or evidence questions before outlining.
3. Present the proposed thesis, major supporting claims, counterarguments, limitations, and likely document shape at `config.gates.confirm_outline`.
4. Build one `project://structure/outline` record in which every major claim has a stable ID and every section has:
   - a stable ID and title;
   - a goal and argument role;
   - an owning set of claim IDs;
   - evidence or research topics still required;
   - target words, dependencies, and execution wave.
5. Express the reader's progression through section goals and argument roles: starting belief, problem or gap, evidence progression, resolution, and implication. Do not create a parallel Markdown argument map, roadmap, or narrative-arc control file.
6. Assign the same wave only to sections that can be drafted independently and do not write the same manuscript artifact. Reject dependency cycles and references to missing section IDs.
7. Create one `project://sections/{section}` record per outline entry. Link its context, research, plans, manuscript, and summary artifact URIs without claiming those authored artifacts already exist.
8. Reconcile `project://state`: phase `outlining` or `planning`, exact totals, target words, current section URI, and a factual transition. Keep author decisions in `project://decisions`, not duplicated into state.
9. Independently validate requirement coverage, claim ownership, evidence obligations, dependency order, wave safety, artifact-link containment, exact equality between the sum of `sections[*].word_target` and `target_words`, and cross-record project IDs. Write the result to `project://validations/{validation}`.
10. If validation fails, revise checkable defects and return author-owned conflicts as checkpoints. At final approval, atomically publish the outline and section/state records. Do not perform VCS operations.
11. Report the approved outline revision, section record URIs, validation status, open evidence work, and first section eligible for discussion or planning.

Completion requires an executable, validated v1 outline and matching section/state records, not merely a table of contents.
