# Standard Agent Plugin packaging

The generated `vendors/plugin/` directory is WTF-P's Agent Plugins 1.0.0 bundle. Its root `plugin.json` uses the official schema at https://agent-plugins.org/schemas/1.0.0/plugin.schema.json, standard metadata, the stable package name `wtfp`, and conventional `skills/`. The npm distribution remains `wtf-p`.

Clio resource roots and the component graph live under `extensions["ai.iowarp.clio"]`, with `compatibility.clio` set to `>=0.4.7`. Native prompts, agents, and fleets are under `ai.iowarp.clio/`; shared protocol records, schemas, templates, tools, and skills retain their contained paths. Prompts live at `ai.iowarp.clio/prompts/wtfp/<action>.md`, so every action is invoked as `/wtfp:<action>` and nothing else. Prompt and agent bodies resolve packaged files through `${pluginRoot}`. This domain bundle does not register new harness tools or enable MCP execution.

The Codex projection also includes a standard root manifest, with its existing `wtf-p` package identity and `.codex-plugin/plugin.json` compatibility fallback. Claude, Copilot, OpenCode, Antigravity, and Gemini retain their native projections. The compiler remains the source of every generated adapter; never hand-edit these bundles.

## Clio installation and compatibility

WTF-P ships to Clio only as this plugin, and requires Clio Coder `>=0.4.7`. There is no extension envelope, no capability probe that chooses between two routes, and no fallback. Installation is:

1. Publish the canonical bundle to `<config>/plugins/wtfp/` under the WTF-P v2 ownership receipt, with the installer's usual conflict, backup, and rollback handling.
2. Stage that tree aside so the client has a source distinct from its own destination.
3. `clio-coder plugins install <staged-dir> --user|--project`.
4. `clio-coder plugins inspect wtfp --json`, requiring `valid` with zero diagnostics at the expected `rootPath` and scope. A disabled plugin is reported with the `clio-coder plugins enable wtfp` command and left disabled; the installer never changes `enabled`.
5. Publish the receipt, then discard the staged copy.

An unchanged active installation is idempotent: the prior `plugins list --all --json` reports the active entry and nothing is reinstalled. Without the binary, the bundle is staged in place and activation is explicitly pending; the installer tells the operator to re-run the same install once `clio-coder` is on PATH, because Clio rejects a `plugins install` whose source is its own managed destination. An extra or modified file in the staged bundle defers activation rather than handing unaudited content to the client under WTF-P's name.

Clio owns integrity, provenance, drift, and enable/disable for the installed package. WTF-P does not re-implement any of them and does not read or write `plugins/state.json`. The WTF-P receipt owns exactly one thing: the bytes it published. Uninstall follows that receipt, not current CLI capability, and runs `clio-coder plugins remove wtfp` only when every file below the installed root is unchanged and receipt-owned; modified or unowned files defer native removal and preserve the registration. Registration and file publication are compensated if installation, verification, or receipt publication fails, and a concurrent edit preserves a recovery tree with an explicit diagnostic.

The temporary staging directory is not a durable update origin: update through WTF-P with the selected distribution or source rather than trying to reuse a removed staging path.

An earlier candidate could leave a WTF-P extension at `<config>/extensions/wtfp`. Remove it with the WTF-P uninstaller from that candidate before installing the plugin, since both register the same prompt names. WTF-P no longer reads, migrates, or retires that location.

## Research execution boundaries

A discovered route is not necessarily executable. The catalog holds 36 actions; 31 are available on Clio and Claude and the remaining five fail closed with a declared unavailable capability: `contribute`, `report-bug`, and `request-feature` (`external.issue`), `remove-section` (`filesystem.delete`), and `update` (`package.update`). Codex, Copilot, OpenCode, Antigravity, and Gemini project 26 of 36: the same five plus `analyze-bib`, `audit-milestone`, `check-refs`, `export-latex`, and `research-gap`, whose `tool.execute` effect is unbound there.

The three research routes are bound, not merely advertised. `tool.execute` means exactly one command, the generated `tools/wtfp-tool.js` dispatcher, which resolves a logical tool id from `protocol/tools.json`, bounds every argument, and prints JSON. It is bound to `bash` on Clio and `Bash` on Claude and stays fail-closed on every other host, whose shell tool names are not verified here. `list` prints each command's declared effects, and `--offline` (or `WTFP_TOOL_OFFLINE=1`) makes the dispatcher refuse any command whose effects include `network.*`. Clio has no native web-search tool, so its `network.search` binding is that same dispatcher running the bundled Semantic Scholar and Google Scholar clients, which are the only scholarly search these actions ever declared. `create-poster`, `create-slides`, and `export-latex` declare no rendering or compilation effect at all: they emit source and hand back an author command.

Clio main-agent prompts inherit session tools, so semantic availability does not claim action-scoped enforcement.

Clio recipes retain supported mutation-report/verifier-report envelopes. A single `wtfp.role-result` validation/check carries serialized portable result JSON in `evidence`, preserving `needs_input`, `blocked`, and failure states. The orchestrator validates that result, handles author input, and redispatches; completion never replaces author approval or artifact readback.

See [RESEARCH_HANDOFF.md](RESEARCH_HANDOFF.md) for the three-action research bridge and [COMPATIBILITY.md](COMPATIBILITY.md) for historical native/model evidence. Standard packaging and deterministic tests do not establish a new model-backed lifecycle claim.

Native fleet write-boundary validation requires an existing Git checkout in the current Clio build. WTF-P never initializes that checkout as a workflow side effect. The opt-in integration test creates its own disposable Git fixture solely to exercise the host's boundary validator.

To repeat the isolated native test against an explicitly selected build:

```bash
WTFP_CLIO_ENTRY=/absolute/path/to/clio-coder/dist/cli/index.js node test/clio-native-integration.test.js
```

The test creates credential-free user and project profiles, verifies exact receipt hashes and native active flags, discovers all eleven recipes, validates both fleets, exercises idempotence, removes both installations, and deletes its temporary roots. It makes no model call.
