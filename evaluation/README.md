# WTF-P behavioral evaluation

This directory is the versioned, executable evidence layer for WTF-P behavior. It evaluates routing and academic invariants without treating prose bytes as a quality oracle. Canonical behavior remains under `protocol/`; evaluation data does not change an action contract or generated adapter.

The suite is repository/CI evidence, not runtime payload. It is deliberately
excluded from the npm archive; release users receive the authenticated protocol,
adapters, installer, and tools, while evaluators use a source checkout whose
commit and fixture hashes can be verified.

The current suite is `v1`. A change that alters a fixture's meaning, expected route, semantic floor, or required invariant must create a new fixture or suite version. Editorial corrections still require refreshed SHA-256 metadata so every run identifies its exact inputs.

The checked-in HPC baseline is intentionally `definition-only`. It contains no observed run and makes no live-model claim. Change it to `observed` only when every referenced, non-secret `wtfp.evaluation.result/v1` file is checked in and passes the linter.

The first Clio 0.3.8 `dynamo/qwen3.8-27b` lifecycle attempt is retained as a
[typed blocked result](v1/evidence/clio-dynamo-lifecycle-blocked/README.md).
It is valuable observed failure evidence, but it cannot enter `observed_runs`:
the first transition failed the safety and cross-record floor, later lifecycle
phases were not exercised, and the comparator correctly classifies it as a
regression rather than weakening the baseline.

That blocked reading predates the current canonical remediation: it binds
WTF-P `6b58b298` and generated source `4db9d040…`, while later source adds the
exact outline-total and direct-tool constraints prompted by those failures.

The separate
[`clio-dynamo-rc-readings`](v1/evidence/clio-dynamo-rc-readings/README.md)
pack retains post-remediation slash and fleet observations with their distinct
`0245818`, `b4f0543`, and `cbba38c` identities. The slash action produced no
records, the plan fleet was semantic-quality unmeasured, and the final draft
fleet fixed physical path projection but failed lifecycle and word-budget
invariants. They are executable failure/structural evidence, not entries in
the observed semantic baseline.

This suite has no no-WTF-P control arm. It cannot establish that WTF-P produces
better prose than the same model and task without WTF-P, and no result should be
read as that claim. It measures observable process discipline instead: evidence
and decision fidelity, schema validity, approval and effect boundaries, durable
fresh-process resumption, useful recovery actions, and absence of incidental
version-control behavior. Comparative writing-quality efficacy requires a
separately designed and versioned controlled study.

The earlier paid compiler-v4 Clio `new-paper` result is retained separately in
[`v1/evidence/clio-new-paper-compiler-v4`](v1/evidence/clio-new-paper-compiler-v4/README.md).
Its authenticated pack and dedicated verifier support exactly that four-part,
8/8 entry-workflow claim; they are not an observed full-lifecycle baseline or a
routing-matrix row.

The reported Claude and Codex entry-workflow results are historical
operator-observed evidence. Their temporary raw evidence is no longer present
and no checked-in replay pack exists, so they are not independently replayable
from this repository. The retained Clio compiler-v4 pack is the independently
verifiable paid entry-workflow evidence.

## Evidence levels and run identity

Every routing observation and semantic result embeds the shared `wtfp.evaluation.run-metadata/v1` record. It distinguishes:

1. `static-lint`: catalog ownership, trigger-corpus coverage, explicit mappings, fixture integrity, and statically derived resource closure.
2. `native-discovery`: what one exact client build discovers or exposes without claiming model behavior.
3. `local-model`: an observed model run on a local or operator-owned endpoint,
   with latency, usage, and independently assessed artifacts but no paid-cost
   claim.
4. `paid-model`: an observed billed model run with cost provenance, latency, and
   independently assessed artifacts.

Run metadata records the exact requested and actual client/model identities, requested and effective effort, permission policy, client binary path and SHA-256, source SHA-256, source commits, protocol/compiler versions, separate model-input and evaluator-oracle fixture hashes, command hash, disposable-environment policy, normal-profile pre/post hash pairs, and case-session isolation. Requested and actual identities are never silently collapsed into one field. A local or paid model result must also bind these values to a contained, SHA-256-exact `wtfp.evaluation.identity-receipt/v1` produced from native client events or a sealed client receipt; metadata alone is not identity evidence.

Static or local-model success is not a paid-model result. An unavailable historical target stays `unavailable`; a different model is not a substitute.

## Stable routing corpus

[`v1/routing/cases.json`](v1/routing/cases.json) contains 40 implicit-routing cases:

- one clear positive, paraphrased positive, boundary/near-miss, explicit negative, and expected-neighbor case for each of seven academic skills;
- one case for each of five product operations that must not consume academic trigger space.

The case's `selection_binding` identifies the intended skill and action contract. It is not a claim that those are the only bytes loaded. In particular, every academic skill has one real, monolithic `references/actions.md`; the evaluator never invents a per-action reference file.

[`v1/routing/explicit-actions.json`](v1/routing/explicit-actions.json) maps all 36 `/wtfp:*` actions and exact argument bytes. Explicit routing is scored separately from implicit activation.

[`v1/routing/manifest.json`](v1/routing/manifest.json) authenticates both routing corpora, the budget matrix, the prompt-only project context, the empty-project snapshot, the protocol/compiler/WTF-P identity, and all nine generated envelope inventories and source hashes. Every observation binds that manifest, its exact model input bytes, the initial project snapshot, and a real client executable by path and SHA-256. Stale corpora, regenerated adapters, fixture drift, and silent client binary replacement therefore fail before scoring.

Each observation records a unique case session, the actual route, exact argument observability, and an evidence-backed disclosure closure. The closure records these real resource kinds:

- the academic `SKILL.md`, when applicable;
- the owning skill's monolithic `references/actions.md`, when applicable;
- the selected action JSON contract;
- the selected workflow Markdown;
- `common.schema.json` plus only the project schemas and templates derived from that action's declared reads and outputs.

Every resource is `loaded`, `not-loaded`, or `unobservable`; every required capability is `available`, `unavailable`, or `unobservable`. A client that does not expose resource-load traces is reported as capability-inconclusive. Routing success never fabricates a load observation.

Score a full observation file with:

```bash
node evaluation/tools/score-routing.js path/to/observations.json
```

Budgeted partial scoring is allowed only through an exact row in [`v1/matrix/budget.json`](v1/matrix/budget.json):

```bash
node evaluation/tools/score-routing.js --matrix-row clio-terra-primary path/to/observations.json
```

The run must bind the matrix ID, version, row, and file SHA-256. Its observation IDs must equal the row's intended subset, and requested/actual client, model, effort, client-source commit, adapter target, permission policy, and environment policy must satisfy the row's no-substitution policy. Per-case costs and latencies must sum to the campaign totals, cost must remain in the matrix currency and below the row ceiling, every case must use a fresh unique session without shared conversational memory, and every normal-profile pre/post pair must be hashable and unchanged. The former unconstrained `--allow-partial` form is rejected.

Native and paid routing evidence is file-backed: every claim locator must be relative, lexically and physically contained under the observation file's directory, a regular non-symlink file, SHA-256 exact, and independently assessed. A partially observable client may report only facts it actually saw; an unrelated loaded resource is a disclosure failure, while a genuinely unavailable trace is capability-inconclusive rather than silently passed.

The `wtfp.evaluation.routing-score/v1` report separates:

- implicit and explicit counts and rates;
- per-target-skill, per-expected-skill, and per-category counts;
- micro and macro correct-activation rates;
- false positives, all false negatives, non-skill false negatives, and wrong-neighbor activations;
- a full expected-route/actual-route confusion breakdown;
- product operations, for which `none` or the matching product operation is allowed while any academic skill or wrong operation fails;
- explicit route, argument, and ambiguity-bypass accuracy;
- observable, partially observable, and unobservable progressive-disclosure closure.

A full-corpus score covers 76 definitions: 40 implicit cases and 36 explicit actions. A matrix score reports both matrix coverage and missing full-corpus cases. Exit status is `0` for pass, `1` for fail, `2` for malformed input or unsafe invocation, and `3` for capability-inconclusive evidence.

## Budget matrix

[`v1/matrix/budget.json`](v1/matrix/budget.json) versions the paid routing budget. It contains planned primary rows for Claude Code, Codex CLI, and coordinated Clio Coder with exact client/model/effort identities and selected case IDs. It also records the unavailable Codex GPT-5.6 ChatGPT-auth target and a deliberately skipped secondary paid surface. `planned`, `completed`, `unavailable`, and `skipped` are explicit states; completed rows must point to a result, and unavailable/skipped rows must state why.

## Semantic baseline and evidence integrity

[`v1/rubrics/semantic-rubric.json`](v1/rubrics/semantic-rubric.json) defines ten invariant dimensions:

- evidence fidelity;
- citation integrity;
- decision fidelity;
- outline and plan coverage;
- literal schema correctness;
- approval boundaries;
- unsupported-claim rate;
- useful next action;
- resumption fidelity;
- no incidental VCS behavior.

The v1 HPC-checkpointing fixture deliberately contains no verified external bibliography. Its citation dimension is a closed-world non-fabrication check: it can establish that the model invented no citation, but it cannot establish positive citation-identity, quotation, page, or bibliography fidelity. A broad citation-quality claim requires a separately versioned fixture with verified positive citations.

[`v1/baselines/hpc-checkpointing.json`](v1/baselines/hpc-checkpointing.json) defines the semantic floor and binds it to the exact scenario phases and hidden oracle digest. It is not a reference answer. Organization, wording, and style may vary while semantic units and safety invariants remain stable.

A `wtfp.evaluation.result/v1` records:

- a completed, blocked, or capability-unavailable outcome;
- an exact scenario ID, phases, action sequence, and real process boundaries;
- evidence-backed capabilities and per-invariant phase bindings;
- the exact versioned weighted rubric anchors, per-anchor verdicts and points, and, for rates, literal numerator/denominator counts;
- independently hash-addressed evidence locators, evidence method, and assessor identity for every invariant;
- schema-validation counts and evidence;
- planning-artifact counts;
- VCS and normal-profile pre/post evidence;
- temporary-credential forwarding and cleanup status;
- metered, estimated, or unavailable cost provenance with independent evidence;
- output bytes and semantic units only when an outcome completed.

Each anchor is a machine-readable criterion in the versioned rubric. A result must reproduce the exact anchor IDs and weights, derive points from the closed `pass`/`warning`/`fail`/`capability-unavailable` verdict scale, and bind each anchor to typed independently assessed evidence. A `deterministic-check` accepts only independent-tool or static-analysis evidence; an `independent-semantic-review` accepts a human reviewer or a model explicitly identified as an independent evaluator; a `hybrid` anchor requires both kinds in distinct retained files. Candidate-model self-report cannot satisfy any anchor. The comparator recomputes anchor totals and scores; free-form prose cannot award points.

Completed results require artifacts and output. Blocked or capability-unavailable results cannot masquerade as completed output. For native, local-model, and paid results, the comparator also requires every relative evidence locator and the model-output locator to resolve as a regular non-symlink file inside the candidate result directory, remain inside it after realpath resolution, and match its declared SHA-256. Local and paid results additionally require the typed identity receipt to agree with the recorded client name/version/binary digest, model provider/ID/version, and requested/effective effort. It rejects missing, traversing, symlinked, digest-mismatched, method-mismatched, single-sided hybrid, candidate-model-only, or identity-mismatched evidence; unpriced cost remains literally `unavailable` rather than being synthesized as zero. A receipt marked `source_retention: digest-only` authenticates the retained summary file but does not make deleted native events independently replayable.

Compare a candidate to the floor, or two results from the same scenario:

```bash
node evaluation/tools/compare-results.js --json \
  evaluation/v1/baselines/hpc-checkpointing.json \
  path/to/candidate-result.json
```

`wtfp.evaluation.comparison/v1` uses a closed classification set:

- `structural-regression`;
- `safety-regression`;
- `semantic-quality-regression`;
- `benign-prose-variation`;
- `client-model-capability-difference`;
- `no-regression`.

Its disposition is exactly one of `meets-baseline`, `regression`, or `inconclusive-capability`. Exit status is respectively `0`, `1`, or `3`; malformed or incomparable evidence exits `2`. Capability absence is never rounded up to a pass. A classification organizes evidence; it does not replace the underlying rubric.

## Versioned fixture and hidden oracle

`v1/fixtures/hpc-checkpointing/` is a harmless closed-world research fixture. `fixture.json` separates `model_visible_inputs` from `evaluator_only_oracles`. The model sees the author brief, synthetic observations, and author decisions. It does not see `expected-invariants.json`, which is evaluator-only.

`manifest.json` labels every file `model`, `evaluator`, or `harness` and binds three SHA-256 values: the model-input inventory, evaluator-oracle inventory, and complete fixture inventory. Verify immutable bytes with:

```bash
node evaluation/tools/hash-fixtures.js --check
```

Without `--check`, the command prints expected manifests and never rewrites a fixture. When deliberately versioning fixture bytes, inspect that output and update a new fixture version, manifest, scenario binding, and baseline together.

## Independent planning validation

Validate produced or previewed `.planning` records directly against canonical v1 schemas:

```bash
node evaluation/tools/validate-planning.js /path/to/disposable-project
node evaluation/tools/validate-planning.js --json /path/to/record.json
```

For a project directory, the validator resolves `.planning`, recursively reads JSON records, selects a canonical schema from each `wtfp.project.<record>/v1` discriminator, and rejects unknown record types and symbolic links. It performs no writes. Hash or snapshot the project and Git state independently before and after a live run; schema validity alone does not establish effect safety or cross-record coherence.

## Development gate

Run the focused gate with:

```bash
npm run test:evaluation
node evaluation/tools/hash-fixtures.js --check
```

The gate validates every evaluation schema and data file, canonical action/skill ownership, routing categories, operation coverage, budget states, exact fixture audiences and hashes, the read-only planning validator, complete and matrix-constrained routing scores, session isolation, every comparator disposition/classification, weighted-anchor derivation, contained evidence files, evidence-forgery rejection, and both definition-only and observed baseline rules.
