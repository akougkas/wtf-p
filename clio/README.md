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
| `protocol/project/schemas/`, `protocol/actions/` | `project/schemas/`, `actions/` |
| generated Clio action availability | `compatibility/action-availability.json` |

Install the content plugin from `vendors/plugin/` and the extension separately.
The extension's `plugin: wtfp` link allows its declared commands to take over
the plugin's matching prompts while that plugin is installed and enabled.
The plugin alone runs no Clio extension code and retains prompt fallbacks.

The desk reads `.planning` and `paper/`, draws the workspace, gates manuscript
writes, and writes validated records, measured word counts and author gate
answers under `.planning/`. `clio-coder extensions test vendors/clio-extension`
runs its package tests: one per runtime tool, the write guard, and entering
and leaving the desk. All package resources come from its own install
root. The manifest names emitted paths, so it does not load from this source
directory. The other six host projections remain unchanged.

The plugin's Clio namespace carries the two playbooks under the `playbooks`
resource key in `ai.iowarp.clio/playbooks/`. The Claude envelope keeps its
older Clio copy under `fleets`; Clio no longer adopts it and points to
`vendors/plugin` instead.
