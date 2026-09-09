# Agent plugin packaging

The generated `vendors/plugin/` directory is WTF-P's Agent Plugins 1.0.0 bundle. Its root `plugin.json` uses the official schema at https://agent-plugins.org/schemas/1.0.0/plugin.schema.json, standard metadata, the stable package name `wtfp`, and conventional `skills/`. The npm distribution remains `wtf-p`.

Clio resource roots and the component graph live under `extensions["ai.iowarp.clio"]`, with `compatibility.clio` set to `>=0.4.7`. Native prompts, agents, and fleets are under `ai.iowarp.clio/`; shared protocol records, schemas, templates, tools, and skills keep their contained paths. Prompts live at `ai.iowarp.clio/prompts/wtfp/<action>.md`, so every action is invoked as `/wtfp:<action>` and nothing else, and prompt and agent bodies resolve packaged files through `${pluginRoot}`. The bundle registers no harness tools and declares no MCP server.

## One bundle, seven projections

The compiler is a factory. It projects this one bundle into a native package per host, using what each host's plugin format supports rather than a lowest common denominator. [HOST_CAPABILITIES.md](HOST_CAPABILITIES.md) records the loader facts, the verification commands, and the per-host action availability table. In summary:

- Claude Code: `commands/`, flat `agents/` each preloading its bound plugin skill through `skills:`, `skills/`, `output-styles/wtfp-academic-writing.md` (selectable, never forced), and `hooks/hooks.json` with a write guard that confines `Write`/`Edit` during the manuscript-writing actions to `.planning/` and `paper/`. The envelope also carries the root `plugin.json` byte-identical to `vendors/plugin` and the `ai.iowarp.clio/` prompts, agents, and fleets that graph names. Claude Code reads neither; they exist so Clio can adopt an installed Claude plugin as `wtfp`, and Clio validates every component path on disk.
- Codex: a portable root `plugin.json` whose `extensions["com.openai"]` carries the install-surface interface, the `.codex-plugin/plugin.json` fallback with the same interface, `skills/`, and `agents/*.toml` custom agents that the installer also publishes to `$CODEX_HOME/agents/`, because Codex plugins do not carry agents.
- OpenCode: nested `commands/wtfp/` and `agents/wtfp/` with explicit frontmatter names (its loader is recursive and honours `name`), `mode: subagent` on every role, and edit and bash denial on verifier roles.
- Antigravity CLI: a manifest limited to the published schema (`$schema`, `name`, `description`), `commands/`, `agents/` with `subagent: true`, `skills/`, and `rules/wtfp-project-state.md`.
- Gemini CLI: `gemini-extension.json`, `GEMINI.md`, TOML commands under `commands/wtfp/`, and flat `agents/wtfp-<role>.md` with the strict local-agent frontmatter.
- Copilot CLI: the Claude-compatible plugin in a local marketplace plus the copyable `.github` repository projection.

On Clio, `/wtfp:help` is a display-only prompt. Its first fenced block is a static operator reference (start-here sequence, every action with its argument hint and description in workflow order, unavailable actions marked with the blocking capability, and the fleets), and Clio prints it without a model call.

Every generated file carries a banner naming its canonical source, and each envelope's `.wtfp-generated.json` authenticates every path with a SHA-256 digest. Never hand-edit these bundles; fix the source or the compiler and regenerate.

## Clio installation and compatibility

WTF-P ships to Clio only as this plugin and requires Clio Coder `>=0.4.7`. There is no extension envelope, no capability probe that chooses between two routes, and no fallback. The installer:

1. Publishes the canonical bundle to `<config>/plugins/wtfp/` under the WTF-P v2 ownership receipt, with the installer's usual conflict, backup, and rollback handling. The config root is resolved the way Clio resolves it: `CLIO_CODER_CONFIG_DIR`, then `CLIO_CODER_HOME/config`, then the platform default (`${XDG_CONFIG_HOME:-~/.config}/clio-coder` on Linux). A target at `<working directory>/.clio-coder` uses project scope.
2. Verifies that the published tree matches `.wtfp-generated.json` exactly. An extra or modified file defers activation rather than handing unaudited content to Clio under WTF-P's name.
3. Stages that tree aside so Clio has a source distinct from the destination it owns.
4. Runs `clio-coder library install <staged-dir> --user|--project` (previews can use `--dry-run`; no `--yes` is accepted or required).
5. Runs `clio-coder library inspect wtfp --user|--project --json` and requires `valid` with zero diagnostics at the expected `rootPath` and scope (inspect returns the InstalledPlugin record shape when selecting an installed copy with explicit `--user` or `--project`). A disabled package is reported with the `clio-coder library enable wtfp --user|--project` command and left disabled; the installer never changes `enabled`.
6. Publishes the receipt, then discards the staged copy.

An unchanged active installation is idempotent: a prior `clio-coder library list --kind plugin --json` that reports an entry containing an installed array with a valid, diagnostic-free copy at the expected root returns without reinstalling (runtime skills can be listed with `clio-coder library skills --all --json`). Without the binary, the bundle is staged in place and activation is pending; the installer tells the operator to re-run the same install once `clio-coder` is on PATH, because Clio rejects a `library install` whose source is its own managed destination.

Clio owns integrity, provenance, drift, and enable/disable for the installed package (managed natively via `clio-coder library drift [wtfp] --user|--project --json` and `clio-coder library enable|disable wtfp --user|--project`). WTF-P does not re-implement any of them and does not read or write native library state (such as `library.yaml` or `plugins/state.json`). The WTF-P receipt owns exactly one thing: the bytes it published. Uninstall follows that receipt and runs `clio-coder library remove wtfp --<scope>` only when every file below the installed root is unchanged and receipt-owned; modified or unowned files defer native removal and preserve the registration. Registration and file publication are compensated if installation, verification, or receipt publication fails, and a concurrent edit preserves a recovery tree with an explicit diagnostic.

The temporary staging directory is not a durable update origin. Update through WTF-P with the selected distribution or source rather than reusing a removed staging path.

An earlier candidate could leave a WTF-P extension at `<config>/extensions/wtfp`. Remove it with that candidate's WTF-P uninstaller before installing the plugin, since both register the same prompt names. WTF-P no longer reads, migrates, or retires that location.

Clio Coder 0.4.7 is not yet a published Clio release. The installer and the opt-in native test were exercised against a local 0.4.7 build; see [COMPATIBILITY.md](COMPATIBILITY.md).

## Research execution boundaries

A discovered route is not necessarily executable. Availability per host is in the [action availability table](HOST_CAPABILITIES.md#action-availability-per-host); an unavailable action returns `WTFP_ACTION_UNAVAILABLE`.

The research routes that are available are bound, not merely advertised. `tool.execute` means exactly one command, the generated `tools/wtfp-tool.js` dispatcher, which resolves a logical tool id from `protocol/tools.json`, bounds every argument, and prints JSON. It is bound to `bash` on Clio and `Bash` on Claude Code and stays fail-closed on every other host, whose shell tool names are not verified. `list` prints each command's declared effects, and `--offline` (or `WTFP_TOOL_OFFLINE=1`) makes the dispatcher refuse any command whose effects include `network.*`. Clio has no native web-search tool, so its `network.search` binding is that same dispatcher running the bundled Semantic Scholar and Google Scholar clients. `create-poster`, `create-slides`, and `export-latex` declare no rendering or compilation effect: they emit source and hand back an author command. The decision record is [ADR 0001](adr/0001-hybrid-tool-execution.md) and its amendment.

Clio main-agent prompts inherit session tools, so semantic availability does not claim action-scoped enforcement. Clio recipes retain the supported mutation-report and verifier-report envelopes: a single `wtfp.role-result` validation or check carries serialized portable result JSON in `evidence`, preserving `needs_input`, `blocked`, and failure states. The orchestrator validates that result, handles author input, and redispatches; completion never replaces author approval or artifact readback.

## Repeating the native Clio test

Native fleet write-boundary validation requires an existing Git checkout in the current Clio build. WTF-P never initializes that checkout as a workflow side effect; the opt-in integration test creates its own disposable Git fixture solely to exercise the host's boundary validator.

```bash
TMPDIR=<disposable-tmp> WTFP_CLIO_ENTRY=/absolute/path/to/clio-coder/dist/cli/index.js node test/clio-native-integration.test.js
```

The test runs against an explicit built CLI (current native verification exercised an interim frozen Clio 0.4.7 built snapshot with entry SHA-256 `97c11656520161dcec48600786ecc128f1ae2cde660e7fb99a6d9f347e3a9f39`, dist digest `13b913e506a34e0532119c2cb27b8d7d38dd52431ca8d3e2ba0805f7313003dc`, source HEAD `b7d9e591eb259553660889046e55393143692b79` plus uncommitted changes; not a final clean release SHA). It creates credential-free user and project profiles, verifies 203 exact receipt-owned files and native active flags, verifies first-party trusted status, discovers all 7 runtime skills and 11 recipes, validates and graphs both fleets, checks 508 contained references per scope, exercises library install dry-run preview, scope coexistence, idempotence, preserved disabled preference across reinstall and stale-digest repair, and compensating rollback via real `library remove` on injected verification failure. It deletes its temporary roots in `finally` cleanup and makes no model call. See [RESEARCH_HANDOFF.md](RESEARCH_HANDOFF.md) for the three-action research bridge.
