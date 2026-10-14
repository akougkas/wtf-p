# Clio extension

Human-edited source of the WTF-P desk for Clio Coder. `npm run build:adapters`
emits a standalone extension into `vendors/clio-extension/`:

| Source | Emitted path |
| --- | --- |
| `clio-coder-extension.yaml` | `clio-coder-extension.yaml`, with the protocol version stamped in |
| `runtime/extension.ts`, `runtime/extension.test.ts`, `runtime/package.json` | `runtime/` |
| `skins/wtfp.json` | `skins/wtfp.json` |
| generated from the action contracts | `runtime/write-guard.json` |
| `evaluation/lib/json-schema.js` | `runtime/json-schema.cjs` |
| `evaluation/lib/claim-coverage.js` | `runtime/claim-coverage.cjs` |
| `protocol/project/schemas/`, `protocol/actions/` | `project/schemas/`, `actions/` |
| generated Clio action availability | `compatibility/action-availability.json` |

Install the content plugin from `vendors/plugin/` and the extension separately.
The extension's `plugin: wtfp` link allows its declared commands to take over
the plugin's matching prompts while that plugin is installed and enabled.
The plugin alone runs no Clio extension code and retains prompt fallbacks.
Without the plugin, the desk names only its own `/ext:wtfp:*` commands and
says which steps need the plugin; it never offers a `/wtfp:*` prompt.

The desk reads `.planning` and `paper/` and draws the workspace. It is the
project's one JSON record writer on Clio. Its `record` tool validates each
record, compares it with the revision or SHA-256 its writer read, commits under
`.planning/.wtfp-lock`, and journals paired records so an interrupted write is
completed by the next one. It records an author's answer only from its own
interview, as a sealed `project://interactions/` record bound to the checkpoint
and artifact the author saw; the seal key lives in Clio's extension store under
Clio's state directory, never in the project. A resolution without a matching
seal is unattested and keeps its gate closed until the author confirms it. The
trust rule is `evaluation/lib/desk-trust.js`, which the campaign collector
shares. A seal proves the desk observed an answer; it cannot stop a process
that the operator lets read Clio's state directory from minting one.

The write guard covers `write`, `edit`, `artifact`, `dispatch`, `bash`,
`run_script` and `job` calls, and judges a path where Clio's tools land it:
after `@` and `~`, and with a `..` after a link stepping up from the link's
target. A running action may write only what its contract declares, for the
section it names, until its turn ends. A section's manuscript, including any
file nested under its stem, waits for its blocking gates, an author `approve`
answer given for the current plan bytes, and verified, uncontested evidence for
required claims in literature-heavy sections. Dispatch is parsed as Clio parses
it. Workers are confined through `intent.write_roots` to manuscripts that are
ready and never get an empty, whole-workspace or record-covering root; outside
an action a worker must name roots that leave out `.planning` and the gated
manuscripts. Changes that loosen what the desk holds, such as a re-pointed
manuscript or rewritten plan history, wait for the author at the desk.
Interpreter commands run through `bash`, `run_script` or `job` are refused only
when they name the desk's own records; Clio's default autonomy asks the
operator before running an unrecognized command.

`clio-coder extensions test vendors/clio-extension` runs the package tests: the
record contract, symbolic-link containment, each gate scenario, plan approval,
evidence coverage, control weakening, arming, dispatch confinement, journal
recovery, fresh-process trust, and the desk with and without its plugin. All
package resources come from its own install root. The manifest names emitted
paths, so it does not load from this source directory. The other six host
projections remain unchanged.

The plugin's Clio namespace carries the two playbooks under the `playbooks`
resource key in `ai.iowarp.clio/playbooks/`. Their write boundaries are literal
paths, so section artifacts project to `.planning/sections/`. An explicit
`fleet run` is a worker pipeline: it runs no desk hook and asks no author, so
the desk reports any manuscript text it finds without an approved plan. The
Claude envelope keeps its older Clio copy under `fleets`; Clio no longer adopts
it and points to `vendors/plugin` instead.
