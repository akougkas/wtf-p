# Section-writing actions

Use exactly one action procedure per invocation. Draft only from verified project evidence and preserve an explicit record of deviations.

## `write-section`

Contract: [protocol/actions/write-section.json](../../../actions/write-section.json)

1. Require an exact `project://sections/{section}/plans/{plan}` artifact linked from `project://sections/{section}` and verify its declared inputs, outputs, dependencies, validation, and approval state.
2. If a corresponding summary or manuscript output exists, show the overwrite or merge impact and require explicit re-execution approval.
3. Read the plan, `project://manifest`, `project://state`, `project://decisions`, `project://structure/outline`, section context and research, relevant source/evidence records, and enough neighboring prose to maintain continuity.
4. Present the plan objective, output path, target words, evidence obligations, and checkpoints at the configured writing gate.
5. Execute tasks in order against the exact `project://paper/{artifact}` output. For each task:
   - establish the paragraph or subsection's rhetorical job;
   - ground factual claims in verified sources or project results;
   - connect the content to assigned outline claim IDs;
   - preserve author terminology and citation keys;
   - run the task's local checks before continuing.
6. Pause when the plan requires unavailable evidence, author judgment, a changed thesis, a destructive rewrite, or another undeclared effect. Create a `project://checkpoints/{checkpoint}` record and resume only after its recorded resolution.
7. Maintain academic honesty. Use explicit placeholders for missing values or citations; never generate plausible-looking facts to smooth the draft.
8. Read the persisted manuscript and run goal-backward verification against every plan success criterion and assigned outline claim. Calculate the actual body word count from the saved artifact with one stated deterministic method rather than trusting a worker's count. Check that count against the word target plus citation resolution through source/evidence records, figures and tables, terminology, transitions, and prohibited scope. Persist the read-only result at `project://validations/{validation}`.
9. If gaps remain, offer to fix bounded defects, accept documented debt, create a revision plan, or request human review. Do not mark the plan complete merely because prose exists.
10. After successful writing, create or update `project://sections/{section}/summary` in Markdown with outputs, measured word count, claims addressed, citations and assets used, decisions, deviations, validation, and next work.
11. Read back the manuscript, summary, and validation and verify that every linked path exists and is non-empty. Reconcile `manifest.artifacts.manuscripts`, the section record, and `project://state` only after all three persist consistently; otherwise leave shared records unreconciled and return a bounded repair action. Never run a VCS operation; return it only as a handoff to a separately declared action.

Completion requires readable manuscript output, a durable summary, honest verification, and consistent project state.

## `execute-outline`

Contract: [protocol/actions/execute-outline.json](../../../actions/execute-outline.json)

1. Require a valid `project://structure/outline`, matching section records, and an approved executable plan for every in-scope section. Exclude completed sections unless the author approves re-execution.
2. Parse declared dependencies and output paths. Reject cycles, missing prerequisites, and plans that claim the same output in one wave.
3. Build waves by dependency order. Within a wave, group only work that is both logically independent and write-disjoint.
4. Present the wave plan, word target, skipped work, approval points, and `project://config` parallelism limit.
5. For each wave:
   - give each writer the full plan plus section-scoped artifacts and read-only manifest, decisions, outline, source, and evidence records;
   - assign exactly one owner to each manuscript output;
   - collect complete, checkpoint, and blocked results independently;
   - validate each output and summary before updating shared state;
   - serialize section, state, source, and other shared-record updates;
   - resolve or explicitly skip blockers before releasing dependent waves.
6. Never let one failed section erase or mislabel successful sibling work. Preserve per-plan validation records and blocking checkpoints as a resumable ledger.
7. After the last releasable wave, perform a cross-section coherence pass over the manuscript in order:
   - thesis and claim consistency;
   - terminology and notation;
   - dependency and forward-reference correctness;
   - narrative progression and transitions;
   - repetition, contradiction, and scope;
   - figure, table, and citation continuity.
8. Route coherence gaps to bounded fixes, acceptance as known debt, or revision planning. Do not rewrite multiple sections concurrently when they share a conceptual defect.
9. Reconcile final section records and `project://state` from manuscript artifacts and per-plan validations, not from worker self-report alone. Do not create branches or commits around waves.

Completion requires dependency-correct execution, an explicit ledger for skipped or blocked work, and a manuscript-level coherence result.

## `quick`

Contract: [protocol/actions/quick.json](../../../actions/quick.json)

1. Require a concrete task description and resolve the exact target file and passage.
2. Confirm the task is narrow: one localized correction, citation repair, transition, wording improvement, or bounded addition. Route structural, multi-section, evidence-heavy, or thesis-changing work to planning.
3. Read only the target, adjacent context, `project://state`, relevant decisions and section record, and the specific evidence or style guidance required.
4. Show the intended semantic change when ambiguity or replacement risk exists.
5. Apply the smallest edit that satisfies the request. Preserve meaning, citations, notation, and formatting outside the target.
6. Verify the requested result, surrounding coherence, citation resolution, and unintended diff. Skip the full planning and independent-verifier loop, but never skip direct validation.
7. Update the section word count or `project://state` only if the change materially affects tracked values. Do not create a false summary or validation pass.
8. Report the exact location, result, validation, and whether a broader follow-up is warranted.

Completion requires an atomic, independently checked change with no hidden scope expansion.
