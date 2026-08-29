# Clio lifecycle evaluation harness

`evaluation/tools/run-clio-lifecycle.js` executes the versioned HPC-checkpointing fixture through the complete WTF-P project lifecycle:

```text
new-paper → map-project → create-outline → plan-section → write-section
→ review-section → pause-writing → new process and session → resume-writing → progress
```

The harness is fail-closed. Its default documentation path is `--dry-run`; a paid call is possible only through `--execute` against a root that an earlier `--prepare` marked `paid_execution_ready: true`.

## Inspect and prepare without a model call

Identify an exact Clio entry file and its matching coordinated source tree. Do not use a movable global symlink.

```bash
node evaluation/tools/run-clio-lifecycle.js --dry-run \
  --binary /absolute/path/to/frozen-clio/dist/cli/index.js \
  --clio-source /absolute/path/to/matching-clio-source

node evaluation/tools/run-clio-lifecycle.js --prepare \
  --root /absolute/path/to/new-disposable-root \
  --binary /absolute/path/to/frozen-clio/dist/cli/index.js \
  --clio-source /absolute/path/to/matching-clio-source
```

`--prepare` creates a mode-0700 root, copies only the three model-visible fixture files, creates one evaluator-owned control commit, and installs the generated `vendors/clio` extension under the contained Clio configuration root. It forwards no credential and makes no model request.

Preparation captures and gates on:

- the WTF-P commit, protocol tree hash, generated extension tree and inventory hashes, generator source hash, routing-manifest hash, compiler version, and dirty-state digest;
- the complete local lifecycle evaluator dependency closure, including fixture hashing and literal JSON Schema validation code;
- the Clio source commit/tree hash, complete non-symlink executable `dist/` tree,
  installed runtime-module tree, Node.js executable/version, contained entry
  path/hash, and reported client version;
- the model-input, evaluator-oracle, and aggregate fixture hashes;
- discovery of the effective diagnostic-free extension and all eleven extension agents;
- both extension fleets appearing in native discovery;
- native `validate` and `graph` success for `wtfp-plan-section` and `wtfp-draft-review`;
- canonical Clio parsing of the installed fleet contracts, exact directory-root write boundaries (`.planning/` and `paper/`), and positive/negative `writeBoundaryCovers` probes on representative nested paths;
- an unchanged fixture tree and unchanged Git HEAD, index, refs, and `.git` tree;
- unchanged SHA-256 inventories for normal Clio and Codex profiles across all native commands;
- an empty, separately rooted S2 home/XDG/data/state/cache surface and no receipts after credential-free native checks;
- secure removal and verified absence of any credential placeholder or temporary artifact that credential-free native Clio commands created inside the disposable config (metadata only; contents are not inspected or logged);
- exact invocation files and command hashes for all nine actions.

A client inconsistency is preserved in `evidence/native-preflight.json`, marks the root `prepared-blocked`, and exits nonzero. Do not delete a real blocked root merely to obtain a green preparation, and do not bypass its fleet checks. Diagnose the owning integration instead.

## Execute an inspected root

Credential source paths are accepted only through environment variables so a secret value can never become an argument. The harness copies their bytes to the isolated configuration directory with mode 0600. Source paths and SHA-256 digests appear in the normal-profile inventory for an auditable pre/post comparison; credential contents never appear in metadata or command arguments.

```bash
WTFP_CLIO_SETTINGS_SOURCE=/normal/profile/settings.yaml \
WTFP_CLIO_CREDENTIALS_SOURCE=/normal/profile/credentials.yaml \
node evaluation/tools/run-clio-lifecycle.js --execute \
  --root /absolute/path/to/prepared-root \
  --binary /absolute/path/to/frozen-clio/dist/cli/index.js \
  --clio-source /absolute/path/to/matching-clio-source
```

The prepared target, model, effort, timeout, budget, binary path, source path, extension path, commits, and hashes are immutable. Passing different execution options is rejected before credential forwarding or a paid call. The default exact target is `openai-codex` / `gpt-5.6-terra` / `xhigh`, with a USD 20 stop-before-next-action campaign ceiling and a 20-minute per-action timeout.

Every child receives contained values for `HOME`, all four XDG roots, `TMPDIR`, `CLIO_CODER_HOME`, and all five `CLIO_CODER_*_DIR` roots. `CLIO_CODER_REQUIRE_HOME_PREFIX=1` and `CLIO_CODER_NO_NETWORK_TOOLS=1` are mandatory. S1 and S2 share only the contained extension/config/bin roots; they use different homes, XDG roots, data, state, and cache. The second-session surface must still match its empty prepared digest immediately before `resume-writing`.

The child environment is constructed from a small locale/terminal allowlist plus those exact contained paths. `PATH` is replaced by the exact bound Node directory plus `/usr/bin:/bin`; operator-local shims and movable client symlinks are not inherited. The environment does not inherit `GIT_*`, `CODEX_HOME`, `NODE_OPTIONS`, credential selectors, provider tokens, or arbitrary caller variables. The isolated `credentials.yaml` is the only approved credential transport.

## What is checked after every action

Each invocation is a separate, owned OS process group with full JSONL capture. Timeouts and operator signals terminate the whole descendant group, wait for process and state-tree quiescence, and preserve cleanup evidence. If an owned group cannot be proven quiescent, the harness refuses all post-execution filesystem reads. After every proven group exit, the harness revalidates the contained private Clio config ancestry before reading state, receipts, settings, or credential artifacts; an untrusted ancestor blocks both the transition and final client-evidence collection. Actions through `pause-writing` share S1. `resume-writing` deliberately omits `--session`, must establish a different S2, and `progress` resumes S2. Thus resumption can use durable project artifacts but cannot use S1 conversational memory or S1 client-state files.

Every raw argument payload includes a quoted title, two consecutive spaces, a literal tab, and a literal `$1`. The expanded `<invocation_arguments>` bytes must have the exact expected length and SHA-256 value before the transition can pass.

The runner then independently checks:

- every `.planning/**/*.json` file against its canonical v1 schema;
- canonical URI-to-record paths, stable project/record IDs, advancing revisions/timestamps, exact author decisions with no invented extras, section dependencies and word totals, and source/evidence/checkpoint/validation references;
- exactly one correctly linked, correctly targeted, chronologically ordered outliner/plan-checker/argument-verifier/section-reviewer validation at each required boundary;
- physical existence and containment of linked context, research, plans, reviews, summary, handoff, manuscript, and manifest-index resources;
- action-specific mutation allowlists and required creations/updates, including file content, type, mode, and empty-directory changes;
- immutable decisions after initialization, sources/evidence after mapping, and outline after approval;
- pause state, handoff and checkpoint durability, and active resumed state;
- no project mutation from `progress`;
- unchanged Git HEAD, index, refs, and complete `.git` inventory;
- no shell, VCS, network, browser, or escaping-path tool call;
- exact target/model/effort in session events and receipts;
- at least one new receipt for every paid action, no mutation/removal of prior receipts, and independent SHA-256 seal verification against the matching Clio run-ledger envelope;
- sealed, successful, exit-zero worker receipts for every required specialist dispatch, including a complete untruncated final output whose hash and byte count match the integrity-covered receipt;
- exact mutation/verifier result-contract parsing, hard refusal of `quality: fail`, explicit preservation of `quality: unmeasured`, mutation-path reconciliation against the aggregate project diff, and one-for-one verifier check/verdict/evidence reconciliation into the canonical validation record.

After `create-outline`, the evaluator copies `project-brief.md` byte-for-byte to `.planning/sections/evaluation/context.md` and `benchmark-observations.md` byte-for-byte to `.planning/sections/evaluation/research.md`. That two-file evaluator mutation is recorded separately and is never attributed to the model.

The first invalid transition stops the campaign. Full event streams, transition reports, schema results, receipts, tool and dispatch summaries, fleet evidence, cost, latency, and the final project remain under the private disposable root. The runner records `steering.required: false` unless a future harness version explicitly adds and records a steering channel.

## Profiles, credentials, and interpretation

Normal Clio and Codex configuration/credential files, both forwarding sources, and any additional paths in `WTFP_LIFECYCLE_PROFILE_PATHS` are SHA-256 inventoried immediately before and after execution. A difference blocks the result.

Credential scalars are searched in contained, singly linked artifacts before cleanup; multiply linked files are not read or rewritten and instead block the run. Any credential occurrence in an eligible artifact is replaced with a redaction marker and blocks the run. Credential paths are removed through an `O_NOFOLLOW` descriptor whose device and inode must match the pre-open pathname: three overwrite/fsync passes and truncation happen through that descriptor, then the still-contained pathname identity is rechecked immediately before unlink. Absence is verified and recorded even on a failed transition.

The isolated credential is created exclusively with `O_NOFOLLOW` and a retained, initially singly linked descriptor. The disposable-root and Clio-config ancestor device/inode/realpath identities are bound before forwarding credential bytes. Cleanup rechecks the retained descriptor device and inode before it wipes, truncates, fsyncs, and closes that original inode. If a client added a hard link to the harness-created inode, the descriptor wipe clears the credential through every link and records the unexpected link count as a blocking anomaly; pathname cleanup then unlinks only the contained name.

A legitimate atomic credential rotation is handled separately. Only after every owned process group is quiescent, the replacement must pass the bounded credential read: the bound root and private config ancestors still match, the exact contained leaf opens with `O_NOFOLLOW`, its descriptor and pathname device/inode agree, it is a single-link mode-0600 regular file, and it is within the 16 MiB credential ceiling. Cleanup revalidates those bindings and that approved inode, wipes/truncates/fsyncs/unlinks it through its own descriptor, and records `rotated-inode`. A generic earlier read is not rotation approval. An unapproved singleton replacement remains untouched and blocks cleanup. Symlink, hard-link, escaped-path, changed-ancestor, unsafe-mode, oversized, and otherwise untrusted replacements are never overwritten; safely removable contained links may be unlinked while the anomaly remains blocking.

Pathname cleanup proceeds only after every owned process group is quiescent and the bound private ancestors from the disposable root to the Clio config directory still match. Settings checkpoints use the same ancestor containment gate plus an `O_NOFOLLOW`, singly linked, mode-private descriptor and never hash a substituted external path. An ancestor substitution therefore fails the campaign without following the replacement path or touching an external `credentials.yaml` or `settings.yaml`.

The runner establishes structural and safety evidence. It deliberately leaves evidence fidelity, citation integrity, unsupported-claim rate, academic quality, and useful-next-action scoring as `pending-independent-review`. A schema-valid run is not allowed to self-award a semantic pass.

Run the deterministic harness tests directly or through the normal evaluation gate:

```bash
node test/evaluation-lifecycle.test.js
npm run test:evaluation
```
