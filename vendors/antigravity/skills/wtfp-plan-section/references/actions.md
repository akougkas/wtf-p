# Section-planning actions

Use exactly one action procedure per invocation. Resolve sections by stable outline identity and keep all structural record changes transactional.

## Target compatibility blockers

This generated `antigravity` projection is authoritative for the actions below. Do not follow their canonical procedure on this target.

### `remove-section`

WTFP_ACTION_UNAVAILABLE

Action: `remove-section`
Target: `antigravity`
Unavailable capabilities: `filesystem.delete`
Unavailable effects: `filesystem.delete`

No workflow, tool, network request, package operation, external issue, VCS operation, or other effect ran.
Safe alternative: preserve project state and return a manual, non-executed handoff for the requested operation.

## `discuss-section`

Contract: [protocol/actions/discuss-section.json](../../../actions/discuss-section.json)

1. Require `project://manifest`, `project://structure/outline`, and the matching `project://sections/{section}` record. Resolve the requested stable section ID unambiguously.
2. Read the core argument, section goal and argument role, assigned claim IDs, dependencies, decisions, and prior `project://sections/{section}/summary` artifacts.
3. If section context already exists, summarize it and ask whether to extend, revise, or leave it unchanged.
4. Hold a collaborative interview, not a checklist interrogation. Establish:
   - the job the section must do for the reader;
   - essential claims, evidence, examples, figures, and citations;
   - desired opening, progression, and ending;
   - emphasis, tone, terminology, and material to avoid;
   - dependencies, controversial choices, and unresolved questions.
5. Challenge contradictions with the manifest or outline. Let the author decide; record locked, deferred, or discretionary choices and rationale in `project://decisions`.
6. Write or merge `project://sections/{section}/context` in Markdown with guidance, boundaries, open questions, and provenance. Represent unresolved blocking choices as `project://checkpoints/{checkpoint}` records.
7. Read the result back, confirm it distinguishes decisions from suggestions, and link it from the section record.
8. Report whether research is needed before planning.

Completion requires a concise author-decision record that a future planner can use without replaying the conversation.

## `list-assumptions`

Contract: [protocol/actions/list-assumptions.json](../../../actions/list-assumptions.json)

1. Resolve the section and load `project://manifest`, `project://decisions`, `project://structure/outline`, the section record, prior summary, context, research, source, and evidence resources.
2. Present, without writing files:
   - intended content and assigned claims;
   - proposed order and approximate word allocation;
   - recommended collaboration mode and why;
   - prior-section, evidence, citation, figure, and data dependencies;
   - likely challenges, risks, and open decisions.
3. Label each item as explicit author decision, project-derived obligation, evidence-derived conclusion, or agent assumption.
4. Ask whether the interpretation matches the author's intent and direct disagreements to `discuss-section` or the eventual planning prompt.

Completion requires all five assumption areas and no project mutation.

## `plan-section`

Contract: [protocol/actions/plan-section.json](../../../actions/plan-section.json)

1. Require an initialized `project://structure/outline`. Resolve the requested section or select the earliest unplanned `project://sections/{section}` whose dependencies are complete.
2. Read the complete planning context before decomposing work: manifest, config, state, decisions, outline, section record, context, research, source/evidence records, and relevant prior summaries.
3. If the section is literature-heavy and research obligations remain empty, offer `research-gap`; do not manufacture citations to keep planning moving.
4. Summarize the section goal, claims, evidence, manuscript artifact, dependencies, and open decisions at `config.gates.confirm_plan`.
5. Create one or more immutable Markdown `project://sections/{section}/plans/{plan}` artifacts. Each plan must declare:
   - stable section and plan identifiers;
   - objective and reader-facing outcome;
   - prerequisite plans or sections and execution wave;
   - exact logical resources read, created, and modified;
   - whether author interaction is required;
   - ordered tasks with purpose, action, evidence inputs, and local verification;
   - checkpoints for irreversible judgment calls;
   - overall verification, success criteria, and outputs.
6. Keep task boundaries independently verifiable. Split plans when context, output ownership, or approval boundaries differ; do not split merely to create more work units.
7. Estimate words by rhetorical function and reconcile the total with the section budget.
8. Require `plan-checker` in a fresh delegated pass against the outline goal and claim IDs, decisions, context, research, evidence, dependencies, output URIs, and verification criteria. Persist that read-only result at `project://validations/{validation}`; configuration may tighten its rubric but must not skip the independent pass.
9. Revise concrete defects and re-check. After a bounded number of failed passes, create a checkpoint for remaining author judgment rather than self-approving.
10. Link the approved plan from the section record and set section/state status to planned only after the plan and validation are readable. Do not execute VCS effects.

Completion requires an executable plan whose tasks are sufficient for its success criteria and whose evidence obligations are explicit.

## `plan-revision`

Contract: [protocol/actions/plan-revision.json](../../../actions/plan-revision.json)

1. Resolve the `project://validations/{validation}` or linked Markdown review, original plan, section summary, manuscript output, manifest requirements, and decisions.
2. Normalize findings into stable issue records with severity, evidence, affected location, failed criterion, and status.
3. Ask the author to choose the revision scope: blockers, blockers plus major issues, all issues, or an explicit set.
4. Identify interactions among selected issues. Merge compatible fixes; sequence fixes that affect the same passage or claim.
5. Write a new immutable `project://sections/{section}/plans/{plan}` revision artifact with:
   - selected issue identifiers and exclusions;
   - exact target locations and intended semantic change;
   - evidence or author decision needed;
   - one task per coherent fix group;
   - issue-specific checks and a final regression pass;
   - expected revised manuscript and revision summary.
6. Never prescribe a cosmetic rewrite for an evidence or argument defect. Route missing evidence to research and structural defects to explicit author approval.
7. Validate that every selected issue is addressed once and every excluded issue remains visible.

Completion requires a targeted, traceable path from finding to fix to re-verification.

## `insert-section`

Contract: [protocol/actions/insert-section.json](../../../actions/insert-section.json)

1. Require an existing outline and a precise stable insertion anchor, description, and rationale.
2. Inspect existing identifiers and choose the next collision-free subordinate identifier after the anchor. Preserve stable identifiers; do not renumber established sections merely for visual neatness.
3. Determine the new section goal, owning claims, evidence needs, word target, dependencies, wave, output path, and downstream transition impact.
4. Present an impact preview covering outline order, word-budget variance, dependencies, state, claim ownership, and the section record and artifact links to create.
5. Obtain explicit approval.
6. With backup policy honored, atomically create `project://sections/{section}` and update `project://structure/outline` plus `project://state`. Keep the core argument and reader progression in those records; do not create parallel roadmap or argument-map control files.
7. Validate schemas, project IDs, identifier uniqueness, dependency acyclicity, URI containment, total words, and all cross-references. Roll back all changes if validation fails.

Completion requires a synchronized new section with no silent renumbering or broken dependency.

## `remove-section`

Contract: [protocol/actions/remove-section.json](../../../actions/remove-section.json)

1. Require `project://structure/outline` and resolve the exact `project://sections/{section}`.
2. Prove the section is unstarted: no manuscript, plan, summary, review, validation, research, checkpoint, or non-placeholder author content. If any exists, refuse this action and propose an explicit archival migration.
3. Trace inbound and outbound dependencies, assigned claims, word budget, transitions, state pointers, and artifact links.
4. Present the exact section record and artifacts to remove plus every record update. Keep subsequent stable IDs unchanged; a renumbering request requires a separate complete migration plan.
5. Obtain explicit destructive approval and create a recoverable project-local backup when configured.
6. Apply the removal and synchronized outline/state updates as one transaction. Remove only the validated section record and declared artifacts, never a wildcard or shared ancestor.
7. Revalidate outline and state, verify every surviving URI and dependency, and confirm the manuscript target variance.
8. Restore the snapshot on any failure and report recovery.

Completion requires preservation of all authored work and consistent outline/state records after the approved removal.
