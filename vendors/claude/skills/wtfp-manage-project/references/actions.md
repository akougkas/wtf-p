# Project-management actions

Use exactly one action procedure per invocation. Resolve logical resources through the adapter and reconcile durable v1 records before trusting reported state.

## `progress`

Contract: [protocol/actions/progress.json](../../../actions/progress.json)

1. Require and schema-validate `project://manifest`, `project://config`, `project://state`, `project://decisions`, and `project://structure/outline`; report the exact initialization or repair action for a missing record.
2. Reconcile outline entries with `project://sections/{section}`, linked plans, summaries, reviews, validations, manuscript outputs, evidence, handoffs, and active checkpoints.
3. Calculate actual and target sections and words, section statuses, unresolved validation issues, and active checkpoints from records and verified artifacts. State the counting method and every discrepancy.
4. Summarize recent factual transitions, author decisions, completed work, and blockers.
5. Route by evidence: active checkpoint to resumption; validation issue to revision planning; approved plan to writing; ready unplanned section to discussion/research/planning; written unreviewed section to review; complete outline to milestone audit.
6. Offer one primary next action plus bounded alternatives. Do not execute it without author confirmation.

Completion requires evidence-backed status, surfaced inconsistencies, and a reasoned next action without state mutation.

## `pause-writing`

Contract: [protocol/actions/pause-writing.json](../../../actions/pause-writing.json)

1. Resolve `project://state` and the exact active section, plan, task, and manuscript artifact.
2. Gather completed and partial work, remaining tasks, decisions, blockers, current validation, and safest next operation.
3. Write `project://sections/{section}/handoff` in Markdown with section/plan/task IDs, timestamp, completed and remaining work, decisions, blockers, exact resume action, and required verification.
4. Merge with an existing handoff deliberately; never erase newer or unresolved context.
5. Create a blocking human-action `project://checkpoints/{checkpoint}` linked to the section and resume action. Link it from `state.active_checkpoint_uris`, set status `paused`, and record the transition.
6. Read handoff, checkpoint, and state back and verify all logical references. Do not stage or commit them.

Completion requires both human-readable continuity and a schema-valid machine-readable resume gate.

## `resume-writing`

Contract: [protocol/actions/resume-writing.json](../../../actions/resume-writing.json)

1. Require `project://state` and enumerate pending active checkpoints. If more than one resume checkpoint exists, require a choice.
2. Read the chosen checkpoint, linked handoff, section record, plan, partial manuscript, relevant summary, outline, and decisions.
3. Verify the handoff is current: referenced artifacts resolve, dependencies and input revisions have not changed, completed work remains present, and no conflicting work supersedes it.
4. Present where work stopped, completed and remaining tasks, decisions, blockers, stale context, and proposed resume action.
5. Ask whether to resume, repair context, choose another action, waive, or expire the checkpoint.
6. Preserve the handoff while work is proposed. After confirmed continuation or closure, update checkpoint status and atomically reconcile state to active; retain checkpoint history.

Completion requires restored context and an author-approved next action, not merely displaying a handoff.

## `checkpoint`

Contract: [protocol/actions/checkpoint.json](../../../actions/checkpoint.json)

1. Select `save`, `list`, or `restore`; default to save only when no conflicting intent exists.
2. For save, select concrete contained record and artifact URIs, copy exact bytes to `project://archives/checkpoints/{checkpoint}`, and record each URI, record revision when present, and SHA-256 digest in a non-blocking `state-snapshot` checkpoint. Link the archive from the manifest and verify the archive plus checkpoint before success.
3. For list, display ID, status, scope, creation time, archive URI, captured resource count, and whether every archive entry and digest resolves.
4. For restore, resolve one available snapshot, compare its declared resources with current bytes, create and verify `project://archives/recovery/{artifact}`, show the exact replacement diff, and require explicit authorization immediately before replacement.
5. Restore only resources enumerated in the snapshot, replace records atomically, schema-validate every restored record, verify hashes, mark the checkpoint restored, and recover from the pre-restore archive on failure. Never use a tag, branch movement, worktree reset, or commit as checkpoint storage.

Completion requires a verified checkpoint operation and a recovery path for restore.

## `settings`

Contract: [protocol/actions/settings.json](../../../actions/settings.json)

1. Require and strictly validate `project://config`; retain its original structured value for recovery.
2. Display only v1 domains: interaction mode, depth, output format, language, citation style, five gates, four workflow checks, safety, and parallelism.
3. Ask which values to change and validate against the closed schema. Reject unknown, legacy, VCS, host, model, and client-specific keys instead of preserving them.
4. Show the exact structured diff and safety implications before writing.
5. Apply confirmed changes atomically, revalidate and read back the record, and restore the original on failure. Never commit configuration.

Completion requires a schema-valid confirmed config and a visible diff.

## `add-todo`

Contract: [protocol/actions/add-todo.json](../../../actions/add-todo.json)

1. Require an initialized project and a non-empty concrete task description.
2. Resolve scope from explicit input or `project://state`; use `project://manifest` when section scope is uncertain.
3. Create a collision-resistant `project://checkpoints/{checkpoint}` with kind `human-action`, status `pending`, the task as request, factual context, scope URI, resume action, and timestamp.
4. Do not reinterpret or start the task. Link blocking checkpoints from state; leave non-blocking work out of the active list unless it affects routing.
5. Validate and return one concise confirmation with pending checkpoint counts.

Completion requires a durable typed checkpoint, not a Markdown todo counter.

## `check-todos`

Contract: [protocol/actions/check-todos.json](../../../actions/check-todos.json)

1. Enumerate pending human-action checkpoints in deterministic creation order; report cleanly when none exist.
2. For each selected checkpoint, show request, creation time, scope, blocking state, and resume action, then ask the author to act now, defer, resolve, waive, expire, or stop.
3. Keep act-now and defer items pending until the underlying work is complete. Never infer completion from intent.
4. Apply only schema-valid status transitions, preserve every checkpoint record as audit history, and never delete or move records to simulate disposition.
5. Stop immediately when requested; leave unreviewed checkpoints unchanged. Reconcile `state.active_checkpoint_uris` and report action counts.

Completion requires checkpoint history to remain recoverable and state to match active blocking records.
