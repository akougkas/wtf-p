# Clio runtime facet

Human-edited source of the WTF-P desk for Clio Coder. `npm run build:adapters`
emits it into the canonical plugin bundle and nowhere else:

| Source | Emitted at `vendors/plugin/` |
| --- | --- |
| `clio-coder-extension.yaml` | `clio-coder-extension.yaml`, with the protocol version stamped in |
| `runtime/extension.ts`, `runtime/package.json` | `ai.iowarp.clio/runtime/` |
| `skins/wtfp.json` | `ai.iowarp.clio/skins/wtfp.json` |
| generated from the action contracts | `ai.iowarp.clio/runtime/write-guard.json` |
| `evaluation/lib/json-schema.js` | `ai.iowarp.clio/runtime/json-schema.cjs` |

The manifest names the emitted paths, so it does not load from this directory.
The runtime reads `.planning` and `paper/`, draws the desk, gates manuscript
writes, and writes only an author's answer to a gate. Other hosts never see
this facet; their projections do not change when it does.
