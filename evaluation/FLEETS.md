# Clio native-fleet evaluation harness

`evaluation/tools/run-clio-fleets.js` is the fail-closed acceptance harness for the two native fleet contracts shipped in the generated Clio extension. It exercises Clio dispatch, durable receipts, the specialist result contracts, verifier sequencing, and Clio's write-boundary rollback gate directly.

This is deliberately narrower than the canonical lifecycle runner in [`LIFECYCLE.md`](LIFECYCLE.md). A successful fleet run does not claim that the slash-command workflow reconciled every canonical state transition, and structural checks do not self-award academic quality.

## Authenticated client and exact actions

Harness v1 accepts only this coordinated Clio build:

- source: `/tmp/clio-v038-fixed-source.Xbdr8a`;
- commit: `9b7b80ccbd3d2211d4079bc76558bb06d66a8583`;
- entry: `/tmp/clio-v038-fixed-source.Xbdr8a/dist/cli/index.js`;
- entry SHA-256: `f02f31c7480ac4f9532980f8df93e07816111626bdce9879e1ee9e98fd3ec162`;
- reported version: `Clio Coder 0.3.8`;
- target/model/effort: `openai-codex` / `gpt-5.6-terra` / `xhigh`.

A movable `clio-coder` symlink is not used. If that exact source tree is unavailable, preparation fails; silently substituting a newer binary would make the measurement incomparable.

The paid phase runs these commands, in this order, from one disposable fixture project:

```text
fleet run wtfp-plan-section --var section=evaluation --json
fleet run wtfp-draft-review --var section=evaluation --json
```

Each fleet must have exactly two waves:

| Fleet | Wave 1 | Scope and writes | Wave 2 | Scope and writes |
| --- | --- | --- | --- | --- |
| `wtfp-plan-section` | `plan` → `wtfp-section-planner` | `workspace`; `.planning/` | `check` → `wtfp-plan-checker` | `readonly`; none |
| `wtfp-draft-review` | `draft` → `wtfp-section-writer` | `workspace`; `.planning/`, `paper/` | `review` → `wtfp-section-reviewer` | `readonly`; none |

The trailing slashes are contract semantics, not presentation. Clio interprets a bare `.planning` or `paper` entry as one literal file. It does not cover nested outputs. The native topology audit and the deterministic negative regression therefore reject the old bare form that caused Clio to roll back `.planning/sections/evaluation/plans/initial.md`.

## Inspect without creating a root

`--dry-run` authenticates the WTF-P and Clio inputs and prints the exact plan. It forwards no credentials, creates no disposable project, and calls no model:

```bash
node evaluation/tools/run-clio-fleets.js --dry-run
```

Review the binary, commit, target/model/effort, invocation arrays, budget, timeout, extension inventory, fixture identity, isolation paths, and stop conditions in that output.

## Credential-free preparation

Preparation requires a new path. It creates the path with mode 0700 and refuses an existing root:

```bash
node evaluation/tools/run-clio-fleets.js --prepare \
  --root /absolute/path/to/new-disposable-root
```

Preparation performs no model call and reads no credential. It:

- materializes the versioned closed-world HPC-checkpointing seed without copying evaluator oracles into the project;
- independently validates ten canonical `.planning` records and their cross-record invariants;
- creates one evaluator-owned Git control commit so later VCS effects are measurable;
- writes sealed minimal local-only settings;
- installs the exact generated `vendors/clio` envelope into the isolated Clio home;
- runs native version, config inspection, extension discovery/install/list, agent discovery, fleet list/status, and both `fleet validate` and `fleet graph` commands;
- verifies all eleven extension agents and both two-step fleets;
- probes Clio's own `writeBoundaryCovers` implementation for positive nested paths and negative out-of-bound paths;
- verifies exact `.planning/` and `paper/` boundaries, no project or Git-control mutation, no normal-profile change, no receipt, and no retained credential placeholder;
- records the source, fixture, installed-extension, settings, directory-identity, profile, native-output, and plan digests in private evidence.

Any inconsistency produces `prepared-blocked`, leaves the evidence for diagnosis, and makes paid execution unavailable. Do not edit a preparation seal or delete a failing native check to make a root executable.

## Execute one inspected root

Execution is possible only after successful preparation and an exact paid acknowledgement. Settings and credential source paths are accepted only through environment variables, never CLI options:

```bash
WTFP_FLEETS_CONFIRM_PAID=I_ACKNOWLEDGE_PAID_CLIO_FLEETS_V1 \
WTFP_FLEETS_CLIO_SETTINGS_SOURCE=/absolute/path/to/settings.yaml \
WTFP_FLEETS_CLIO_CREDENTIALS_SOURCE=/absolute/path/to/credentials.yaml \
node evaluation/tools/run-clio-fleets.js --execute \
  --root /absolute/path/to/prepared-root
```

The settings and credential sources must be distinct, regular, non-symlink, singly linked files outside the disposable root. The credential source must grant no group or other permissions. Both reads are descriptor-bound and limited to 16 MiB. The acknowledgement, preparation seal, source hashes, root identities, exact options, fixture/Git baseline, extension install, settings, planning records, empty receipt inventory, and absence of a prior execution marker are checked before credential bytes are forwarded.

`WTFP_FLEETS_NORMAL_PROFILE_PATHS` may contain an additional platform-delimited list of normal files or directories to inventory before and after execution. It adds observations; it does not authorize writes.

Every child receives contained values for `HOME`, all XDG roots, `TMPDIR`, `CLIO_CODER_HOME`, and every `CLIO_CODER_{CONFIG,DATA,STATE,CACHE,BIN}_DIR`. `CLIO_CODER_REQUIRE_HOME_PREFIX=1` and `CLIO_CODER_NO_NETWORK_TOOLS=1` remain mandatory. The child environment does not inherit provider credentials, `CODEX_HOME`, arbitrary `GIT_*` variables, local shims, or the operator's normal Clio profile.

The default USD 20 ceiling is a stop-before-next-fleet ceiling over valid client-reported receipt costs. The default timeout is 30 minutes per fleet. Override either during preparation only when the operator has explicitly reviewed the new values:

```bash
node evaluation/tools/run-clio-fleets.js --prepare \
  --root /absolute/path/to/new-disposable-root \
  --budget-usd 10 \
  --timeout-minutes 20
```

Execution must repeat the same options. A mismatch is refused before paid work.

## Per-fleet acceptance gates

After each owned Clio process group exits and the state tree is quiescent, the runner checks:

- exactly two JSON stdout receipts plus one matching fleet summary;
- exactly one mutator and one verifier receipt, in chronological order and under the fleet root lineage;
- exact target, model, requested/effective effort, OAuth runtime family/tier, client version, node, autonomy, and rendered `section=evaluation` task identity;
- independent receipt-integrity verification against the matching Clio run-ledger envelope;
- a complete, untruncated, hash-bound `mutation-report` followed by a passing `verifier-report`;
- exact reconciliation of reported mutation paths with the aggregate project diff;
- no shell, VCS, network, browser, or other forbidden tool in receipts or audit logs;
- exactly two durable, digest-valid write-boundary verdicts: a clean mutator window with the declared directory roots and a clean read-only verifier window;
- no violation, rollback, unattributed mutation, unrecoverable path, incomplete attribution, skipped step, retry, loop, or decision request;
- one durable fleet ledger with the exact step order, variables, run IDs, successful integrity results, and clean boundaries;
- only the required plan path for the planning fleet, then only `paper/evaluation.md` and the evaluation summary for the draft fleet;
- canonical planning-schema validity, unchanged seeded records and author decisions, stable Git HEAD/index/refs/`.git` inventory, and unchanged normal-profile hashes.

The deterministic artifact checks require the plan and draft to preserve the closed-world synthetic measurements and their stated uncertainty/generalization limits. They reject invented URLs, DOIs, significance, production proof, universal superiority, and other unsupported forms. These checks are a safety floor; independent semantic review is still required for evidence fidelity, prose quality, and usefulness.

The first invalid fleet stops the campaign. A rollback is a failure even when Clio correctly restored the project. The result never promotes a failed or `unmeasured` contract fact to a pass.

## Evidence and credential cleanup

The private root retains:

- `evidence/fleet-plan.json` and the sealed preparation record;
- all native command outputs and the native-preflight audit;
- stdout/stderr hashes and per-fleet transition audits;
- receipt, boundary, ledger, schema, artifact, tool, cost, latency, Git, and profile summaries;
- `evidence/fleet-result.json` plus its SHA-256 sidecar;
- the final disposable project for independent inspection.

Raw credential contents are not written into evidence. The harness searches contained singly linked artifacts for credential scalars, redacts and blocks on any finding, and records only hashes and cleanup metadata. It retains a descriptor for the original isolated credential inode, wipes it with overwrite/fsync/truncate, and then removes its still-contained pathname. A legitimate client atomic rotation is approved only after every owned process group is quiescent and the replacement passes bound, single-link, mode-0600, bounded-read checks. Symlink, hard-link, directory-substitution, oversized, and unapproved singleton replacements are never followed or overwritten; anomalies block completion.

`outcome: completed` means both direct fleet contracts passed all deterministic structural and safety gates. It does not mean the full map → plan → draft → review → pause → new-process resume lifecycle passed, and it does not replace an independent semantic-quality assessment.

## Deterministic development gate

The focused test is credential-free and makes no native Clio or model call:

```bash
node test/evaluation-fleets.test.js
```

It covers dry-run identity and exact argv, fake native topology parsing, the bare-directory rollback regression, mutation/result/receipt/boundary/ledger auditors, source-file containment, approved atomic rotation, hard-link and symlink refusal, and rejection of rotation approval while an owned process group is active.
