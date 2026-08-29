# Manuscript-review actions

Use exactly one action procedure per invocation. Keep evaluation evidence separate from proposed edits and from the author's acceptance decisions.

## Target compatibility blockers

This generated `copilot-cloud` projection is authoritative for the actions below. Do not follow their canonical procedure on this target.

### `audit-milestone`

WTFP_ACTION_UNAVAILABLE

Action: `audit-milestone`
Target: `copilot-cloud`
Unavailable capabilities: `tool.execute`
Unavailable effects: `tool.execute`, `user.gate`

No workflow, tool, network request, package operation, external issue, VCS operation, or other effect ran.
Safe alternative: preserve project state and return a manual, non-executed handoff for the requested operation.

### `plan-milestone-gaps`

WTFP_ACTION_UNAVAILABLE

Action: `plan-milestone-gaps`
Target: `copilot-cloud`
Unavailable capabilities: (none)
Unavailable effects: `user.gate`

No workflow, tool, network request, package operation, external issue, VCS operation, or other effect ran.
Safe alternative: preserve project state and return a manual, non-executed handoff for the requested operation.

### `polish-prose`

WTFP_ACTION_UNAVAILABLE

Action: `polish-prose`
Target: `copilot-cloud`
Unavailable capabilities: (none)
Unavailable effects: `user.gate`

No workflow, tool, network request, package operation, external issue, VCS operation, or other effect ran.
Safe alternative: preserve project state and return a manual, non-executed handoff for the requested operation.

### `review-section`

WTFP_ACTION_UNAVAILABLE

Action: `review-section`
Target: `copilot-cloud`
Unavailable capabilities: (none)
Unavailable effects: `user.gate`

No workflow, tool, network request, package operation, external issue, VCS operation, or other effect ran.
Safe alternative: preserve project state and return a manual, non-executed handoff for the requested operation.

### `verify-work`

WTFP_ACTION_UNAVAILABLE

Action: `verify-work`
Target: `copilot-cloud`
Unavailable capabilities: (none)
Unavailable effects: `user.gate`

No workflow, tool, network request, package operation, external issue, VCS operation, or other effect ran.
Safe alternative: preserve project state and return a manual, non-executed handoff for the requested operation.

## `review-section`

Contract: [protocol/actions/review-section.json](../../../actions/review-section.json)

1. Resolve one `project://paper/{artifact}`, its section record, approved plan, summary, context, research, manifest requirements, decisions, outline claims, evidence records, and neighboring prose.
2. Ask for or infer from the explicit request a reviewer stance: constructive mentor, adversarial reviewer, strategic chair, or publication editor. State the stance; do not let it alter factual standards.
3. Run three distinct layers:
   - mechanical: citation keys, figure and table references, formatting, terminology, and obvious requirement checks;
   - logical: claim support, coherence, assumptions, counterarguments, limitations, and relation to the thesis;
   - rubric: section goal, plan success criteria, venue constraints, author decisions, and word budget.
4. For every gap, record a stable identifier, layer, severity, confidence, failed criterion, quoted or located evidence, impact, and bounded recommendation.
5. Distinguish blockers, major issues, minor issues, and optional suggestions. Include passes so the review is not only a fault list.
6. Write detailed findings to a new Markdown `project://sections/{section}/reviews/{review}` artifact and the machine-readable result to `project://validations/{validation}`. Link both without erasing resolved history. Never edit the manuscript as an implicit part of review.
7. Report overall disposition, strongest elements, prioritized findings, review limitations, and route issues to `plan-revision`.

Completion requires all three layers, traceable findings, and a clear separation between critique and mutation.

## `verify-work`

Contract: [protocol/actions/verify-work.json](../../../actions/verify-work.json)

1. Resolve `project://state` and a written section; require its section record, summary, manuscript artifact, and approved plan before any status reconciliation.
2. Use the plan's success criteria and assigned outline claim IDs as acceptance-test sources. Preserve their original wording and provenance.
3. Create or resume a `project://validations/{validation}` record with section URI, plan URI, input revisions, ordered checks, issues, timestamps, and next actions.
4. On resume, reconcile the saved checks with current plan, outline, evidence, and manuscript revisions. Do not silently discard prior responses when inputs change; write a new validation or mark stale evidence explicitly.
5. Present exactly one pending criterion at a time with its source and the relevant manuscript evidence.
6. Record the author's response immediately using the validation schema: `passed`, `warning`, `failed`, or `not-applicable`. Require evidence for a pass, a reason for not-applicable, and severity plus summary for an issue.
7. Persist after every response so the loop survives interruption. Never infer the author's acceptance from silence.
8. When complete, calculate counts and set the overall result:
   - `passed` when no issues remain and every required criterion passed;
   - `issues-found` when one or more issue records remain;
   - `needs-input` when author judgment is pending;
   - `failed` when required evidence or execution cannot satisfy the contract.
9. Reconcile section and state status only from the completed validation, then route gaps to `plan-revision` or a pass to project progress.

Completion requires a resumable author-owned acceptance record, not an automated self-approval.

## `polish-prose`

Contract: [protocol/actions/polish-prose.json](../../../actions/polish-prose.json)

1. Resolve one section, one `project://paper/{artifact}`, or the explicitly approved full manuscript. Require manuscript content.
2. Load manifest requirements, decisions, section context, style guidance from an authorized material, venue constraints, terminology, and neighboring prose. Ask which voice should dominate: authoritative, measured, accessible, technical, or a supplied style.
3. Establish non-negotiables: claims, quantitative values, citations, quotations, equations, labels, terminology, and author-specific phrasing.
4. Diagnose rather than homogenize. Target ambiguity, needless abstraction, repetitive cadence, weak transitions, nominalization, empty intensifiers, inconsistent tense or voice, and unsupported confidence.
5. Propose or apply meaning-preserving edits only within the approved scope. Never add evidence, strengthen certainty, or remove a limitation merely for fluency.
6. Compare before and after for semantic equivalence, citation placement, technical notation, word-count effect, and neighboring coherence. Record the result at `project://validations/{validation}`.
7. Require approval before applying a whole-manuscript rewrite or a material voice shift. Preserve recoverability for major edits.
8. Report modified passages, recurring style patterns, semantic safeguards, and any sentences that need author judgment.

Completion requires clearer prose with unchanged scholarly meaning and visible author choice.

## `audit-milestone`

Contract: [protocol/actions/audit-milestone.json](../../../actions/audit-milestone.json)

1. Require manifest, config, state, decisions, outline, section records, validations, source/evidence records, and manuscript artifacts. Define the milestone and required checks from verified project or venue policy.
2. Run at least these independent checks:
   - section completion: section status corroborated by manuscript, summary, and current validation records;
   - argument coverage: each required outline claim located in manuscript text and linked to evidence where required;
   - word targets: section and total counts compared with configured tolerances;
   - citation completeness: in-text keys reconciled with verified source records and claim evidence;
   - review status: required validations exist, refer to current inputs, and pass.
3. Add venue-specific checks when verified requirements exist, such as anonymity, required statements, page limits, artifact availability, or accessibility.
4. Use `passed`, `warning`, `failed`, or `not-applicable` per check and a schema-valid overall status. Include method, observed evidence, expected criterion, affected logical URIs, and recommendation.
5. Do not accept a section status alone as proof of completion, term search as proof of argument coverage, or source-record existence as proof citations resolve.
6. Write a read-only `project://validations/{validation}` with input record revisions or artifact hashes, overall disposition, checks, issues, limitations, and next actions.
7. Overall `passed` requires every required check to pass. Keep optional not-applicable checks and all needs-input conditions visible.
8. Report readiness honestly and route gaps to `plan-milestone-gaps`.

Completion requires a reproducible readiness record tied to the manuscript version actually audited.

## `plan-milestone-gaps`

Contract: [protocol/actions/plan-milestone-gaps.json](../../../actions/plan-milestone-gaps.json)

1. Require a current milestone `project://validations/{validation}` with one or more issues. If it passed, stop and route to delivery.
2. Parse every gap's identifier, check type, evidence, affected files or sections, severity, and recommendation.
3. Classify remediation:
   - incomplete section → normal section planning or writing;
   - unsupported argument → research or targeted revision;
   - word variance → trim or expand revision;
   - unresolved citation → reference repair;
   - missing review → review routing, not a writing plan;
   - venue or packaging defect → delivery repair.
4. Group compatible gaps by owning section and output URI. Keep conflicting or differently approved effects in separate plans.
5. For each writing or revision group, create a `project://sections/{section}/plans/{plan}` artifact containing audit issue identifiers, precise target URIs and locations, tasks, evidence, word delta when relevant, issue-specific checks, and regression checks.
6. Create `project://checkpoints/{checkpoint}` handoffs instead of prose tasks when evidence or author input is missing. Return routing recommendations, not empty plans, for review-only and delivery-only gaps.
7. Verify that every audit gap is covered exactly once by a plan or route and no plan claims to solve an unrelated gap.
8. Report created plans, non-plan routes, dependency order, and the instruction to re-run the audit after remediation.

Completion requires total traceability from each audit gap to one appropriate remediation path.
