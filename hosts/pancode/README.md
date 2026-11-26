# PanCode extension

Human-edited source of the PanWrite desk for PanCode. `npm run build:adapters`
emits a standalone extension into `pancode/extension/`:

| Source | Emitted path |
| --- | --- |
| `pancode-extension.yaml` | `pancode-extension.yaml`, with the protocol version stamped in |
| `runtime/extension.ts`, `runtime/extension.test.ts`, `runtime/package.json` | `runtime/` |
| `skins/panwrite.json` | `skins/panwrite.json` |
| generated from the action contracts | `runtime/write-guard.json` |
| `evaluation/lib/json-schema.js` | `runtime/json-schema.cjs` |
| `evaluation/lib/claim-coverage.js` | `runtime/claim-coverage.cjs` |
| `protocol/project/schemas/`, `protocol/project/templates/`, `protocol/actions/` | `project/schemas/`, `project/templates/`, `actions/` |
| generated PanCode action availability | `compatibility/action-availability.json` |

Install the content plugin from `pancode/plugin/` and the extension separately.
The extension's `plugin: panwrite` link allows its declared commands to take over
the plugin's matching prompts while that plugin is installed and enabled.
The plugin alone runs no PanCode extension code and retains prompt fallbacks.
Without the plugin, the desk names only its own `/ext:panwrite:*` commands and
says which steps need the plugin; it never offers a `/panwrite:*` prompt.

The desk reads `.planning` and `paper/` and draws the workspace. It is the
project's one JSON record writer on PanCode. Its `record` tool validates each
record, compares it with the revision or SHA-256 its writer read, commits under
`.planning/.panwrite-lock`, and journals paired records so an interrupted write is
completed by the next one. It records an author's answer only from its own
interview, as a sealed `project://interactions/` record bound to the checkpoint
and artifact the author saw; the seal key lives in PanCode's extension store under
PanCode's state directory, never in the project. A resolution without a matching
seal is unattested and keeps its gate closed until the author confirms it. The
trust rule is `evaluation/lib/desk-trust.js`, which the campaign collector
shares. A seal is tamper evidence against workers, hand edits and other
machines, not against the main agent: its shell runs unsandboxed as the
operator's user and can read the key, as can any process the operator lets
read PanCode's state directory.

The write guard covers `write`, `edit`, `artifact`, `dispatch`, `bash`,
`run_script` and `job` calls, and `ask_user` calls inside a PanWrite action. It judges only what PanCode sends
each hook: the landing PanCode resolved for a path, which PanCode refuses to change
before the tool runs, and for `dispatch` the plan its admission parsed, with
each worker's resolved agent, `cwd`, write boundaries and worktree. The desk
never reads a call itself, so it cannot drift from PanCode's grammar. Inside a
PanWrite project or action it refuses a call whose facts are malformed or a
landing PanCode could not resolve, and a dispatch PanCode could not prepare is left
to PanCode, which refuses it with its own reason. A worker's write in a task
worktree is judged at the checkout path it merges into. On a host that sends
no facts, the desk refuses writes and dispatches inside a
PanWrite project or action. Outside both it checks only that no PanWrite recipe is
dispatched outside its action.

A running action may write only what its contract declares, for the section
it names, until its turn ends. A section's manuscript, including any file
nested under its stem, waits for its blocking gates, an author `approve`
answer given for the current plan bytes, and verified, uncontested evidence
for required claims in literature-heavy sections. Workers are confined
through `intent.write_roots` to manuscripts that are ready. A worker never
gets an empty, whole-workspace, record-covering or linked root, a `cwd` other
than the project root, or a task worktree, compete candidates included, since
the desk cannot see what a merge brings back. A single worker whose roots
need narrowing gets them by a rewrite, which PanCode judges again, so the roots
the desk hands it must land where they read too. PanCode admits a rewritten call
afresh, without the operator's approval of the original, so a call that
needs that approval (more than one worker, a review loop) is instead refused
with each worker's exact roots, and the call sent with them runs unchanged.
Outside an action a worker must name roots that leave out `.planning` and
the gated manuscripts. A worker PanCode runs read-only, as it runs every
read-only recipe including the PanWrite reviewers, needs none.
Changes that loosen what the desk holds, such as a re-pointed manuscript or
rewritten plan history, wait for the author at the desk.
`/panwrite:advance` is the driver. Its prompt arms nothing; the desk's
`next_step` tool, which answers only inside that turn, picks each step by the
same ladder `progress` follows and arms the write guard for that action and
section alone, exactly as if the author had typed the step's own command. A
gate comes back for the `gate` tool, whose interview has no unattended
fallback, so it waits for the author at either autonomy level. Between steps,
at a gate and after a stop nothing is armed. The run stops at a gate the
author keeps pending or cannot be asked, a step that changed nothing the ladder
reads, an action the plugin does not serve, a missing project, or 24 steps.
The driver never starts or reshapes a project. Its turn holds the union of the
chained actions' tools, so a step's tool scope is the driver's; its writes are
confined to the step's contract all the same. PanCode can compact a long run and
drop the advance prompt, so every `next_step` result ends with the same
one-sentence driver rule, and a step names its prompt file relative to the
plugin root, found from the `base_dir` of the loaded `panwrite-manage-project`
skill, which PanCode keeps across compaction.

An action orients from the desk rather than from record reads. The `status`
tool returns the whole project in one call. When a prompt arms a PanWrite action
or advance in a project, a `turn_start` hook injects the same status as a model
reminder, cut to PanCode's 2,000-character effect limit with a pointer to
`status`. PanCode fires `turn_start` once per operator prompt, so an advance step
calls `status` instead. An `after_tool` hook on `write` and `edit` notes a
successful write to the manuscript of a section the armed action may update
with the exact `measure_section` call, once per section until it is measured.
The note rides on the tool result and spends none of the turn's continuation
budget, which PanCode shares with its own nudges. PanCode also hooks a dispatched
worker's writes, so the note says the call belongs to the dispatching action.
The desk declares no `turn_end` hook.

Inside a PanWrite action or advance run every `ask_user` question is the
author's. The write guard also hooks `ask_user`: it marks a lone question
`operator_only`, which PanCode never answers with a recommended option after
`safety.unattendedAfterSeconds`, and refuses a round of several unmarked
questions, since an `operator_only` question is asked alone. An unanswered one
ends the turn. Outside a PanWrite action the desk leaves questions alone.

Interpreter commands run through `bash`, `run_script` or `job` are refused only
when they name the desk's own records; PanCode's default autonomy asks the
operator before running an unrecognized command, but runs recognized test
runners, which execute files the model wrote. It asks for that at most once in
an attended session, and only after the session itself has written or edited a
file or was resumed; a headless run never asks. Code run that way is beyond
the desk's hooks, which is the limit of every guarantee above.

`pancode extensions test pancode/extension` runs the package tests: the
record contract, symbolic-link containment, each gate scenario, plan approval,
evidence coverage, control weakening, arming, dispatch confinement, journal
recovery, fresh-process trust, the advance driver and its compaction-safe
results, the status tool and reminder, the manuscript write note, and the desk
with and without its plugin. All
package resources come from its own install root. The manifest names emitted
paths, so it does not load from this source directory. The other six host
projections remain unchanged.

The plugin's PanCode namespace carries the two playbooks under the `playbooks`
resource key in `dev.pancode/playbooks/`. Their write boundaries are literal
paths, so section artifacts project to `.planning/sections/`. An explicit
`fleet run` is a worker pipeline that asks no author. In PanCode the
extension host `fleet run` starts runs the desk's tool hooks for its workers,
which the desk judges as calls outside a PanWrite action, since a playbook arms
none. The desk reports any manuscript text it finds without an approved plan. The
Claude envelope keeps its older PanCode copy under `fleets`; PanCode no longer adopts
it and points to `panwrite install pancode` instead.
