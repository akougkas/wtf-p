# Routing matrix execution

`evaluation/tools/run-routing-matrix.js` prepares and, with an explicit paid-run
acknowledgement, executes the three primary rows in
`evaluation/v1/matrix/budget.json`. The runner is capability-aware: every row
uses its real native selector and only makes claims the checked-in client
surface says can be observed. It never upgrades an unavailable signal, a model
self-report, or ordinary prose into native activation evidence.

The runner has three deliberately separate modes:

- `--dry-run` verifies identities and prints a plan. It creates no client state,
  reads no credentials, and makes no model call.
- `--prepare` creates sealed disposable state and runs credential-free native
  discovery and validation. It makes no model call.
- `--execute` revalidates an exact sealed preparation, requires a separate
  operator acknowledgement, forwards credentials into isolated client homes,
  executes paid cases sequentially, independently scores retained evidence,
  and removes the forwarded copies.

No mode means `--dry-run`.

```bash
node evaluation/tools/run-routing-matrix.js
node evaluation/tools/run-routing-matrix.js --dry-run
node evaluation/tools/run-routing-matrix.js --prepare --root /new/private/path
```

An existing preparation root is always refused. Omitting `--root` in prepare
mode creates a new mode-0700 directory below `TMPDIR`. Each selected primary
row has an immutable 18-case set; there is no subset option that could be
mistaken for matrix evidence.

## Capability contract

The normative surface is
`evaluation/v1/routing/client-surfaces.json`, validated by
`evaluation/v1/schemas/client-routing-surfaces.schema.json`. Shared semantic
prompts and target-native inputs are separate cryptographic inputs.

| Surface | Implicit routing | Explicit academic selector | Observable route | Arguments/resources | Cost |
|---|---|---|---|---|---|
| Claude Code 2.1.251 | native selection and typed `Skill` load | `/wtfp:<action>` | typed skill activation only; action resolution unobservable | arguments unobservable; resources partial | native metered USD result |
| Codex CLI 0.144.1 | unobservable in stable JSONL | `$wtf-p:<skill> <action> …` | route/activation unobservable | arguments are ordinary prose; resources unobservable | unavailable through ChatGPT auth |
| Clio Coder 0.3.8 | operator-gated `Suggested skill: /skill …`, not loaded | `/wtfp:<action>` | suggested skill implicitly; action explicitly | explicit expansion exposes exact arguments and bound resources | sealed receipt provenance, possibly unavailable |

Codex product operations have no native action-command surface and are marked
unsupported. The budgeted Codex explicit cases are the seven academic actions,
which do have native skill-mention projections. An unsupported projection is
refused during suite loading; it is never sent as ordinary prose and relabeled
as an explicit selector.

Capability limits remain visible in the score. A claim that the host cannot
expose is `inconclusive-capability`, not a pass and not a behavioral failure.
An incorrect observable selector, route, activation, argument expansion,
resource set, or cost receipt is a failure. Model prose such as “I selected
skill X” is ignored as routing evidence.

The Codex primary row is explicitly a `capability-and-behavior` study. Its paid
value is observing bounded requested-surface completion behavior, safety-policy
conformance, fresh-session isolation, and the presence or absence of stable
typed routing signals across the same prompt categories as the other clients.
Codex prose may be retained for descriptive analysis, but it is not native
route or activation evidence and is not reported as an activation rate.

## Certified identities

Dry-run, preparation, and execution verification recompute these bindings:

| Input | Required identity |
|---|---|
| Routing manifest | SHA-256 `ab6ec763b5001109dfdd82928b2e0b26d4bae88b5f19d3e384f49ef586c41d0b` |
| Client-surface contract | SHA-256 `cb622928b946a0a90ba2a91605c047501e08ce71a928c856cc7fbadc38844594` |
| Budget matrix | SHA-256 `69e22a7362ddffb0b08ccc62493b079c45ef945d3518af00b0ab612ee38cf039` |
| WTF-P canonical source | commit `93617d24a1fe4438239534a2d4fab067530dc026`, projection SHA-256 `f7bcf1a0e150b4859a86b3edebda77c818a8e0ddf8b0539133202f6d9f558fd2`, protocol v1, compiler v4 |
| Claude Code | `2.1.251`, binary SHA-256 `fd5f10ff0eb58daec04900466b143ea98aab50abf208a422bc008eaec13f61f7` |
| Codex CLI | `0.144.1`, binary SHA-256 `a96f944d1a596dbfb7fdd84f482be5c50e34b04bb371126840d873e4ebf26902` |
| Clio Coder | `0.3.8`, source commit `9b7b80ccbd3d2211d4079bc76558bb06d66a8583`, binary SHA-256 `f02f31c7480ac4f9532980f8df93e07816111626bdce9879e1ee9e98fd3ec162` |
| Clio distribution tree | SHA-256 `27472f9b7253dc6608d70fbe623e4953896a9f0899ead00aa5faad1c783acae7` (213 files) |
| Clio generated inventory | SHA-256 `1e143685a035f3e507cb2ab816484211774009dd3f4ddd25fdc03a76b2f14956` |
| Clio generated source | SHA-256 `6065657e80692f300bcc5ba97c09624eb1eac4a963fc16ab0b0dc7e034e31f15` |

The WTF-P commit in the routing manifest is the immutable canonical-source
commit, not a requirement that the repository remain checked out at that exact
HEAD. The runner requires that commit to exist and be an ancestor of the actual
HEAD. It then proves that the working projection still matches the canonical
commit byte-for-byte and mode-for-mode across all 138 `protocol/**` files, all
1,582 tracked `vendors/**` runtime files, the compiler, generator metadata and
entry script, `CONTRIBUTING.md`, all seven registry-selected tool sources, the
package version input, all nine generated inventories, and their 1,573
authenticated entries. A Git-visible untracked file under `protocol/` or
`vendors/` also fails the projection. The sole local-state exclusion is
`vendors/opencode/.gitignore`; it is untracked, is not inventory-authenticated,
and is not loaded as extension content.

This avoids a cryptographic self-reference: later evaluation and documentation
commits may descend from the canonical commit without changing it. The actual
HEAD, HEAD tree, branch, Git object format, status digest, and a content-bearing
digest of all Git-visible staged, unstaged, and untracked state are still
recorded in the dry plan and sealed preparation. Preparation checks that exact
repository identity before and after native validation; execution recomputes it
before credentials are considered. Any protocol, compiler, tool, generated,
ancestry, or sealed dirty-state drift fails closed.

The certified Clio entry is the regular file at:

```text
/tmp/clio-v038-fixed-source.Xbdr8a/dist/cli/index.js
```

Its coordinated source and runtime package root are the same clean detached
clone, `/tmp/clio-v038-fixed-source.Xbdr8a`. The runner rejects a Clio entry
whose real package root differs from that source.

The runner resolves and hashes executable files rather than trusting a mutable
global symlink. Relocated copies can be selected only through these identity
options or their matching environment variables:

```text
--claude-binary / WTFP_ROUTING_CLAUDE_BINARY
--codex-binary   / WTFP_ROUTING_CODEX_BINARY
--clio-binary    / WTFP_ROUTING_CLIO_BINARY
--clio-source    / WTFP_ROUTING_CLIO_SOURCE
```

A matching marketing version does not excuse a different commit, binary,
corpus, surface contract, generated inventory, source hash, model, effort,
case order, or input digest.

## Preparation and native validation

Preparation runs only local/native commands in isolated profiles. Claude strict
plugin validation and discovery, Codex marketplace/plugin discovery and prompt
input inspection, and Clio extension discovery/install/list plus real skill,
agent, and fleet validation all have to pass. The generated Clio extension is
tested with its two real fleets, `wtfp-plan-section` and
`wtfp-draft-review`; the preparation does not use an invented extension.

Every row/case pair receives a distinct private root:

```text
rows/<row>/cases/<ordinal>-<case-id>/
  project/                    empty prompt-only project
  home/                       isolated HOME
  xdg/{config,data,state,cache}/
  tmp/
  client/                     isolated client state
  evidence/
    semantic-input.txt        shared semantic case bytes
    native-input.txt          exact target-native selector bytes
    command.json              sealed runtime command and policy
    native-preflight.json     native discovery/validation receipt
    native/*.stdout
    native/*.stderr
    case-prepared.json
```

Directories are mode 0700 and evidence files are mode 0600. Claude and Clio
receive their native input as one spawn argument. Codex receives exact stdin.
There is no shell reconstruction or tokenizer in this path.

The explicit `new-paper` payload preserves quotes, repeated spaces, newline,
tab, literal `$1`, literal `$@`, and trailing spaces. Its Claude/Clio native
form is 152 bytes with SHA-256
`a2b4a25d42cfb8752e10007adc8da26e4d2eeeedade246f2f0192b279fe2cb01`.
Its Codex skill-mention form is 172 bytes with SHA-256
`1ab063ce39749f1b07ef1a4bb507c33f9294cda86a4566743b40fab866055599`.

The top-level `prepared.json` is sealed with a SHA-256 sidecar. Execution
rechecks the runner, matrix, routing manifest, surface contract, corpora,
generated envelopes and every inventoried adapter file, client binaries, the
complete Clio `dist/` tree and tracked source tree, both input files, command
manifests, native receipts, project trees, and normal-profile hashes. The
execution contract separately binds the scorer, JSON Schema validator, schema
tree, and canonical protocol tree. The per-case `case-prepared.json` receipt is
also digest-bound. The sealed repository receipt distinguishes the canonical
source commit from the actual descendant HEAD and its dirty-state digest. A
preparation with any failed ancestry, source-projection, native, project,
profile, or capability gate—or any subsequent drift—is not executable.

## Paid execution ceremony

Paid execution is intentionally a separate, one-shot action. Credential paths
are never accepted in argv. Set only the source files needed by selected rows:

```text
WTFP_ROUTING_CLAUDE_CREDENTIALS_SOURCE
WTFP_ROUTING_CODEX_CREDENTIALS_SOURCE
WTFP_ROUTING_CLIO_SETTINGS_SOURCE
WTFP_ROUTING_CLIO_CREDENTIALS_SOURCE
```

Every source must be a regular non-symlink file outside the disposable root.
Then provide the exact acknowledgement and execute the already prepared root:

```bash
export WTFP_ROUTING_CONFIRM_PAID=I_ACKNOWLEDGE_PAID_ROUTING_MATRIX_V1
node evaluation/tools/run-routing-matrix.js --execute --root /prepared/path
```

The acknowledgement is not an override. The runner first verifies the sealed
preparation and capability contract, then verifies the acknowledgement, then
creates an exclusive `execution-started.json` marker. Only after all three
steps does it inspect a credential-source path or read its contents. A root
with an existing marker cannot be replayed.

Cases run sequentially in fresh processes. A `model-attempt.json` marker is
written before each spawn, and paid-call counters increment at successful
process creation, before event parsing or receipt verification. A post-spawn
exception therefore cannot hide an attempted paid call. The matrix ceiling is 18 paid cases
per row. Claude also receives a per-case native budget derived from its $3 row
ceiling, and the campaign stops if independently metered cumulative cost would
exceed that ceiling. `--timeout-minutes` sets the per-case timeout and is bounded
to 60 minutes. Timeout, signal, output overflow, a non-quiescent process group,
unsafe tool use, project mutation, profile mutation, receipt failure, cleanup
failure, or an observable scoring failure stops the campaign closed.

## Credential and process boundary

Child processes inherit only a small locale/terminal allowlist plus their
explicit isolated roots. Ambient API keys, cloud credentials, normal client
homes, `NODE_OPTIONS`, and normal Git configuration are not inherited.

Forwarded credential/config files are copied exclusively at mode 0600 into the
case-specific client home immediately before that one process. At installation,
the runner binds the prepared case root's realpath and device/inode identity.
No updated-credential or Clio-receipt pathname is read until the complete owned
process group is quiescent. Every such read then revalidates the bound root and
walks each lexical ancestor, rejecting symlinks and escaped or replaced roots.
Candidate secret values are held in memory. Stdout and stderr are scanned and
redacted before being written. Updated credentials, receipts, and receipt
envelopes are read only through `O_NOFOLLOW` descriptors after
descriptor-to-path inode agreement, single-link checks, and the 128 MiB
ceiling; credentials additionally require mode 0600. Any failed check stops the
case before bytes are read. The retained case tree is scanned again after
cleanup. A detected value is redacted and makes the case fail; it is never
treated as acceptable evidence.

Cleanup runs in `finally`. Each installed credential remains open through a
private descriptor; cleanup overwrites, truncates, and fsyncs that original
inode before it considers path removal. A legitimate atomic mode-0600,
single-link replacement at the exact owned destination is independently opened,
wiped, fsynced, removed, and recorded as `rotated-inode`. Cleanup revalidates the
bound case root and every destination ancestor before each path operation. Thus
a substituted ancestor cannot redirect the wipe or unlink outside the root. A
client-substituted leaf symlink is unlinked without following it and is reported
as a cleanup anomaly. Signal handlers first quiesce the owned process group and
only then wipe the held descriptors.
Retained regular files larger than the 128 MiB scan ceiling fail the case rather
than being skipped. Source files and normal profiles are hashed before and
after under opaque labels; their paths and contents are not written into the
public score.

Claude monitoring includes normal `.claude/.credentials.json`,
`.claude/settings.json`, the home-root `.claude.json`, and one prefix inventory
covering `.claude.json.backup` plus rotating `.claude.json.backup.*` files. The
isolated `HOME` and `CLAUDE_CONFIG_DIR` should prevent all of them from being
touched; monitoring the root-state files closes the path that
`CLAUDE_CONFIG_DIR` alone does not relocate. Codex auth/config and Clio
settings/credentials receive equivalent opaque pre/post hashes.

Userspace overwrite is not a guarantee of physical erasure on copy-on-write or
flash storage. Removing the entire disposable encrypted or tmpfs root remains
the stronger operational cleanup after evidence has been retained elsewhere.

## Native evidence interpretation

Claude runs restricted with an empty strict MCP configuration, no Chrome, no
session persistence, `dontAsk`, and the bounded tool list
`Skill,Read,Glob,Grep`. A typed `Skill` tool event proves a loaded skill. The
exact `/wtfp:<action>` input and native discovery prove that the command is
available, but process success alone does not prove command resolution. Because
the stable stream exposes neither an expansion event nor the selected action,
selector/action and expanded-argument claims remain capability-inconclusive.
The result event provides native metered USD cost.

Codex runs with `-a never`, read-only sandboxing, an ephemeral session, disabled
web search, memories, analytics, and multi-agent behavior, and exact stdin. Its
native academic selector `$wtf-p:<skill>` is materialized exactly, but current
JSONL has no stable selector-resolution,
route, activation, or priced USD receipt. Those claims stay
unobservable/unavailable instead of being inferred from process exit, prose, or
token counts. Any shell event is a hard safety failure.

Clio sets isolated HOME/XDG/TMPDIR plus all `CLIO_CODER_*_DIR` roots,
`CLIO_CODER_REQUIRE_HOME_PREFIX=1`, network-tool removal, and a one-tool-call
turn budget. It uses the exact coordinated source, `openai-codex` target,
GPT-5.6 Terra, xhigh effort, read-only autonomy, and full JSON events. Implicit
`Suggested skill` routing is scored as a suggestion with `not-loaded`
activation when the sealed receipt has no activation. Explicit expanded user
events provide literal `<invocation_arguments>` and contained `<file>`
resources. The receipt must report `succeeded` with exit code zero, agree with
the native process and session, and pair with its run-ledger envelope. The
matching verifier module is located in the sealed Clio `dist/` tree and executed
in a separate sanitized Node process; it is never imported into the runner's
ambient process. Known, known-free, estimated, and unknown cost provenance
remain distinct.

Native model identity is not reconstructed from a requested selector. Clio's
sealed receipt can prove the exact wire model id, but it does not expose a
separate independently typed model-version field. Claude's model-family event
and Codex's stable JSONL likewise do not establish the matrix's separate model
version. Those fields are recorded as `unavailable`, making the affected
identity-constrained score capability-inconclusive instead of synthesizing a
pass.

When some Clio cases have priced receipts and others are unknown, each priced
case keeps its earned provenance while the aggregate remains unavailable. The
aggregate records exact priced/unpriced case counts. If every case is priced,
the aggregate status and exact sum are verified.

## Retained execution evidence

Each executed case adds redacted native JSONL/stderr and a
`case-execution.json` audit. Every completed row adds:

```text
rows/<row>/
  execution-audit.json
  routing-observations.json
  routing-score.json
```

The scorer accepts only contained, regular, non-symlink evidence files with
matching digests and a non-model assessor. It also verifies exact matrix/client/
model/effort identities, fixture and generated-envelope bindings, unique
sessions, unchanged normal profiles, per-case and aggregate cost provenance,
latency sums, and the paid-case ceiling. A top-level sealed
`evidence/execution-summary.json` records campaign disposition and cleanup.

Rates use observable denominators. An unobservable route is not counted as a
false negative and does not create a synthetic zero-percent action or argument
score. Route and suggestion accuracy are reported separately from activation-
state conformance (`loaded` versus `not-loaded`). A row may move from `planned`
to `completed` only with a result binding containing a relative path, SHA-256,
routing-score schema id, row id, and run id. Linting requires that file to be
contained, regular, non-symlink, schema-valid, matrix/row/run-consistent, and
complete for the exact row; `result` is forbidden on every other status.

An `inconclusive-capability` score is an honest completed measurement, not a
passing claim. The runner succeeds only when every case executes safely and the
scorer finds no behavioral or structural failure; capability-inconclusive
claims remain visible in the score.

## Credential-free verification

The focused runner contract makes no paid calls:

```bash
node test/evaluation-routing-runner.test.js
node test/evaluation.test.js
node evaluation/tools/lint.js
```

It covers native selector materialization, exact byte preservation, capability
limits, environment isolation, acknowledgement ordering, exclusive credential
transport, bound-root/config-ancestor/leaf substitution, quiescence-gated and
bounded descriptor reads for credential refresh and receipts, safe atomic
rotation, redaction, oversized retained state, cleanup anomalies, process-group
quiescence, nested typed native event parsing,
Clio explicit resource-binding injection, isolated receipt semantics,
observable-only routing denominators, completed-row evidence bindings, and
mixed cost provenance. It also creates disposable Git histories proving that
evaluation/docs-only descendants are accepted while protocol, compiler, tool,
generated inventory/entry, untracked source, and non-ancestor substitutions are
rejected. A
real paid result must still cite the retained execution artifacts; a green
credential-free contract test is not a substitute for a paid behavioral run.

The checked-in suite currently has no historical cross-version behavioral run.
It can compare future results whose exact client/model identities are available,
but it must not be cited as evidence that routing is stable across versions.
Each case is one independent process observation (`n=1` for that exact
client/model/fixture cell). Reported rates are point estimates only; the suite
does not support confidence intervals, variance, or repeatability claims until
replicated runs exist.
