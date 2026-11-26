# Agent plugin packaging

The generated `pancode/plugin/` directory is PanWrite's Agent Plugins 1.0.0 bundle. Its root `plugin.json` uses the official schema at https://agent-plugins.org/schemas/1.0.0/plugin.schema.json, standard metadata, the stable package name `panwrite`, and conventional `skills/`. The npm distribution remains `panwrite`.

PanCode resource roots and the component graph live under `extensions["dev.pancode"]`, with `compatibility.pancode` set to `>=0.9.0`. Native prompts, agents, and playbooks are under `dev.pancode/`, with the playbooks in `dev.pancode/playbooks/` under the `playbooks` resource key; shared protocol records, schemas, templates, tools, and skills keep their contained paths. Prompts live at `dev.pancode/prompts/panwrite/<action>.md`, so every action is invoked as `/panwrite:<action>` and nothing else, and prompt and agent bodies resolve packaged files through `${pluginRoot}`. The bundle registers no harness tools and declares no MCP server.

## One bundle, seven projections

The compiler is a factory. It projects this one bundle into a native package per host, using what each host's plugin format supports rather than a lowest common denominator. [HOST_CAPABILITIES.md](HOST_CAPABILITIES.md) records the loader facts, the verification commands, and the per-host action availability table. In summary:

- Claude Code: `commands/`, flat `agents/` each preloading its bound plugin skill through `skills:`, `skills/`, `output-styles/panwrite-academic-writing.md` (selectable, never forced), and `hooks/hooks.json` with a write guard that confines `Write`/`Edit` during the manuscript-writing actions to `.planning/` and `paper/`. The envelope also carries a root `plugin.json` declaring the `dev.pancode` namespace and the `dev.pancode/` prompts, agents, and fleets it names, with fleet contracts still under their pre-playbook `fleets` names for older PanCode builds. Claude Code reads neither. PanCode no longer adopts this copy; it labels it as built for an older PanCode and points to `panwrite install pancode`.
- Codex: a portable root `plugin.json` whose `extensions["com.openai"]` carries the install-surface interface, the `.codex-plugin/plugin.json` fallback with the same interface, `skills/`, and `agents/*.toml` custom agents that the installer also publishes to `$CODEX_HOME/agents/`, because Codex plugins do not carry agents.
- OpenCode: nested `commands/panwrite/` and `agents/panwrite/` with explicit frontmatter names (its loader is recursive and honours `name`), `mode: subagent` on every role, and edit and bash denial on verifier roles.
- Antigravity CLI: a manifest limited to the published schema (`$schema`, `name`, `version`, `description`), `agents/` with `subagent: true`, `skills/` holding the seven router skills plus every action as an explicitly invoked skill (`disable-model-invocation: true`), and `rules/panwrite-project-state.md` with `trigger: always_on`. Antigravity 1.5 plugins load no `commands/` directory, so there is none.
- Gemini CLI: `gemini-extension.json`, `GEMINI.md`, TOML commands under `commands/panwrite/`, and flat `agents/panwrite-<role>.md` with the strict local-agent frontmatter.
- Copilot CLI: the Claude-compatible plugin in a local marketplace plus the copyable `.github` repository projection.

On PanCode, `/panwrite:help` is a display-only prompt. Its first fenced block is a static operator reference (start-here sequence, every action with its argument hint and description in workflow order, unavailable actions marked with the blocking capability, and the playbooks), and PanCode prints it without a model call.

Every generated file carries a banner naming its canonical source, and each envelope's `.panwrite-generated.json` authenticates every path with a SHA-256 digest. Never hand-edit these bundles; fix the source or the compiler and regenerate.

## PanCode installation and compatibility

PanWrite ships to PanCode as two packages, this plugin and the writing desk extension in `pancode/extension/`, and both require PanCode `>=0.9.0`. There is no capability probe that chooses between routes and no fallback. `npx @panstudio/panwrite install pancode` makes two separate PanCode installs, plugin first:

1. Publishes the canonical bundle to `<config>/plugins/panwrite/` and the extension to `<config>/extensions/panwrite/` under one PanWrite v2 ownership receipt, with the installer's usual conflict, backup, and rollback handling. The config root is resolved the way PanCode resolves it: `PANCODE_CONFIG_DIR`, then `$PANCODE_HOME/config`, then the platform default (`${XDG_CONFIG_HOME:-~/.config}/pancode` on Linux). `--config-dir` overrides it, and a target at `<working directory>/.pancode` uses project scope.
2. Verifies that each published tree matches its own `.panwrite-generated.json` exactly. An extra or modified file defers activation rather than handing unaudited content to PanCode under PanWrite's name.
3. Stages each tree aside so PanCode has a source distinct from the destination it owns.
4. Runs `pancode hub install <staged-dir> --user|--project --json` for the plugin (previews can use `--dry-run`), then `pancode extensions install <staged-dir> --user|--project --json` for the extension.
5. Runs `pancode hub inspect plugin:panwrite --user|--project --json` for the plugin and `pancode extensions list --user|--project --json` for the extension, and requires `valid` at the expected `rootPath` and scope with no diagnostics beyond PanCode's project trust warning. Both packages carry the id `panwrite`, so `hub` commands name the plugin `plugin:panwrite`. A disabled package is reported with its `pancode hub enable` or `pancode extensions enable` command and left disabled; the installer never changes `enabled`. A failed extension install compensates the extension and then the plugin.
6. Publishes the receipt, then discards the staged copies.

An unchanged active installation is idempotent: when a prior `pancode hub list --kind plugin --json` (or `pancode extensions list --user|--project --json` for the desk) already reports a valid copy at the expected root, the installer returns without reinstalling. Runtime skills can be listed with `pancode hub skills --all --json`. Without the binary, both packages are published in place and activation is pending; the installer tells the operator to re-run `npx @panstudio/panwrite install pancode` once `pancode` is on PATH, because PanCode rejects an install whose source overlaps its own managed destination.

PanCode holds a project's plugins and extensions until the operator trusts that project's package state. The installer reports that hold and does not grant trust; run `pancode config trust plugins` and then `/reload hub` in a running session, and `pancode config trust extensions` for the desk.

PanCode owns integrity, provenance, drift, and enable/disable for the installed packages (managed natively via `pancode hub drift plugin:panwrite --user|--project --json`, `pancode hub enable|disable plugin:panwrite --user|--project`, and `pancode extensions enable|disable panwrite --user|--project`). PanWrite does not re-implement any of them and does not write native hub state (such as `plugins/state.json`). The PanWrite receipt owns exactly one thing: the bytes it published. Uninstall follows that receipt and runs `pancode extensions remove panwrite --<scope>` and `pancode hub remove plugin:panwrite --<scope>`, each only when every file below that package's installed root is unchanged and receipt-owned; modified or unowned files defer that package's native removal and preserve its registration. Registration and file publication are compensated if installation, verification, or receipt publication fails, and a concurrent edit preserves a recovery tree with an explicit diagnostic.

The temporary staging directory is not a durable update origin. Update through PanWrite with the selected distribution or source rather than reusing a removed staging path.

Install PanWrite with its installer from npm or a local checkout rather than `pancode hub import`. Import brings in the plugin alone, without the desk extension, and an imported pack keeps foreign trust.

## Research execution boundaries

A discovered route is not necessarily executable. Availability per host is in the [action availability table](HOST_CAPABILITIES.md#action-availability-per-host); an unavailable action returns `PANWRITE_ACTION_UNAVAILABLE`.

The research routes that are available are bound, not merely advertised. `tool.execute` means exactly one command, the generated `tools/panwrite-tool.js` dispatcher, which resolves a logical tool id from `protocol/tools.json`, bounds every argument, and prints JSON. It is bound to `bash` on PanCode and `Bash` on Claude Code and stays fail-closed on every other host, whose shell tool names are not verified. `list` prints each command's declared effects, and `--offline` (or `PANWRITE_TOOL_OFFLINE=1`) makes the dispatcher refuse any command whose effects include `network.*`. PanCode's `network.search` binding is that same dispatcher running the bundled Semantic Scholar and Google Scholar clients. `create-poster`, `create-slides`, and `export-latex` declare no rendering or compilation effect: they emit source and hand back an author command. The decision record is [ADR 0001](adr/0001-hybrid-tool-execution.md) and its amendment.

PanCode narrows each prompt's turn to the tools its `allowed-tools` names. PanCode recipes retain the supported mutation-report and verifier-report envelopes: a single `panwrite.role-result` validation or check carries serialized portable result JSON in `evidence`, preserving `needs_input`, `blocked`, and failure states. The orchestrator validates that result, handles author input, and redispatches; completion never replaces author approval or artifact readback.

## Repeating the native PanCode test

Native fleet write-boundary validation requires an existing Git checkout. PanWrite never initializes that checkout as a workflow side effect; the opt-in integration test creates its own disposable Git fixture solely to exercise the host's boundary validator.

```bash
TMPDIR=<disposable-tmp> PANWRITE_PANCODE_ENTRY=/absolute/path/to/pancode/bin/pancode.cjs node test/pancode-native-integration.test.js
```

The test runs against the explicit built CLI it is given and never resolves an ambient `pancode`. It creates credential-free user and project profiles, previews the plugin with `hub install --dry-run`, installs through the PanWrite installer, and checks the receipt-owned files, the plugin's native registration and `trusted` status, and the desk extension registered beside it. It lists the agents and runtime skills, validates and graphs both playbooks, runs the installed desk's package tests with `pancode extensions test`, prints `/panwrite:help`, and resolves every packaged reference in the installed prompts and agents. It also exercises idempotence, a preserved disabled preference across reinstall and stale-digest repair, scope coexistence, compensating rollback through real `hub remove` and `extensions remove` on injected failures, uninstall that keeps a package holding an unowned file, and an upgrade over an unchanged installation. It deletes its temporary roots in `finally` cleanup and makes no model call. See [RESEARCH_HANDOFF.md](RESEARCH_HANDOFF.md) for the three-action research bridge.
