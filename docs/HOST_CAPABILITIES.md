# Host capability matrix

What each supported host can load from a plugin, how it installs and discovers it, and how the WTF-P adapter compiler projects the canonical `vendors/plugin` bundle into a package that uses those capabilities. Every row names the evidence it rests on. A host that was not installed on the machine that produced this document is marked unverified: its projection follows the vendor's published loader source or documentation, not an observed run.

Evidence was gathered in two rounds on Linux. The full round ran on 2026-09-09 against the `0.6.0-rc.4` envelope with `claude` 2.1.267, `codex` 0.153.3, a local `clio-coder` 0.4.7 build, `agy` 1.1.28, and temporary-prefix installs of `gemini` 0.59.0, `opencode` 1.18.30, and `copilot` 1.0.83. The release round ran on 2026-09-14 against the `0.6.0` envelope, which differs from rc.4 only by the plugin name `wtfp` on every host, the removed v0.5 tree, and the repository-root marketplaces: `claude` 2.1.271, `codex` 0.153.3, the published `@iowarp/clio-coder` 0.4.8, `agy` 1.2.2, and temporary-prefix `gemini` 0.59.0, `opencode` 1.18.31, and `copilot` 1.0.83 each re-ran the installer route in a disposable profile (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `CLIO_CODER_CONFIG_DIR`, `COPILOT_HOME`, `OPENCODE_CONFIG_DIR`, `GEMINI_CLI_HOME`, `ANTIGRAVITY_HOME` plus `HOME`/`XDG_*` under a temporary root) and reproduced the file counts and the listings noted per host below with the new name. Claude Code, Codex, and Copilot CLI additionally installed `wtfp@wtf-p` straight from the repository checkout through their own `plugin marketplace add` commands. The two model-backed headless runs recorded under Claude Code and Codex were made on 2026-09-09 on the factory-round envelope, before the version bump and the Claude root manifest; they are labelled as such.

## Summary

| Capability | Claude Code | Codex | OpenCode | Antigravity CLI | Gemini CLI | Copilot CLI | Clio Coder |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Skills (`skills/<id>/SKILL.md`) | native | native | native | native | native | native | native |
| Agents / subagents | `agents/*.md`, flat | `$CODEX_HOME/agents/*.toml`, outside the plugin | `agents/**/*.md` | `agents/*.md`, `subagent: true` | `agents/*.md`, flat, strict schema | `agents/*.md` (Claude-compatible) | `ai.iowarp.clio/agents/*.md` recipes |
| Commands / prompts | `commands/*.md` as `/<plugin>:<name>` | none (skills only) | `commands/**/*.md`, name from frontmatter | none in the plugin format; skills become slash commands | `commands/<ns>/<name>.toml` as `/<ns>:<name>` | `commands/*.md` | `ai.iowarp.clio/prompts/<ns>/<name>.md` as `/<ns>:<name>` |
| Output styles | `output-styles/*.md` | no | no | no | no | no | no |
| Hooks | `hooks/hooks.json` | `hooks/hooks.json` via `extensions.com.openai.hooks` | JS plugins, not markdown | `hooks.json` | `hooks/hooks.json` | unverified | no (harness extensions only) |
| MCP servers | `.mcp.json` | `mcp.json` | config file | `mcp_config.json` | `gemini-extension.json` `mcpServers` | unverified | preserved, not executed |
| Rules / always-on context | via skills only | `AGENTS.md` | `AGENTS.md`/instructions | `rules/*.md` | `GEMINI.md` via `contextFileName` | `copilot-instructions.md` | `CLIO-CODER.md` |
| Marketplace | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json` | none | none | gallery only | `marketplace.json` | `library.yaml` (scoped package index; formerly `plugins/registry.yaml`) |
| Verified here | yes | yes | yes | yes | yes (agents load without diagnostics; no listing surface) | yes (marketplace add and plugin list; no in-session listing) | yes |

## What WTF-P projects per host

| Host | Projection (`vendors/...`) | What is native there |
| --- | --- | --- |
| Claude Code | `vendors/claude` | 36 commands, 11 agents each preloading its bound plugin skill, 7 skills, `output-styles/wtfp-academic-writing.md`, `hooks/hooks.json` write guard, bounded tool dispatcher via `Bash`; plus the Agent Plugins 1.0.0 root `plugin.json` byte-identical to `vendors/plugin` and the `ai.iowarp.clio/` prompts, agents, and fleets it names, so Clio can adopt an installed Claude plugin as `wtfp` |
| Codex | `vendors/codex` | root `plugin.json` with `extensions["com.openai"]`, `.codex-plugin/plugin.json` fallback, 7 skills, 11 TOML custom agents (installed to `$CODEX_HOME/agents/`), local marketplace |
| OpenCode | `vendors/opencode` | 36 commands (`name: wtfp:<action>`), 11 subagents (`mode: subagent`, verifier roles deny edit/bash), 7 skills |
| Antigravity CLI | `vendors/antigravity` | schema-conformant `plugin.json`, 36 commands, 11 agents (`subagent: true`), 7 skills, `rules/wtfp-project-state.md` |
| Gemini CLI | `vendors/gemini` | `gemini-extension.json`, `GEMINI.md`, 36 TOML commands under `commands/wtfp/`, 11 flat agents (`kind: local`), 7 skills |
| Copilot CLI | `vendors/copilot` | Claude-compatible plugin (`.claude-plugin/plugin.json`, 36 commands, 11 agents, 7 skills) in a local marketplace, plus the copyable `.github` repository projection |
| Clio Coder | `vendors/plugin` | the canonical bundle itself: 36 prompts (help is a `display-only` operator card), 11 recipes, 7 skills, 2 fleets |

No projection declares an MCP server: the repository contains no MCP server implementation (the untracked `vendors/claude/mcp/research-server/` directory holds empty directories and is excluded from the package).

## Action availability per host

Derived from each envelope's generated `compatibility/action-availability.json` (36 catalog actions). An unavailable action is compiled to a `WTFP_ACTION_UNAVAILABLE` stub without its workflow, arguments, or tools.

| Target | Available | Unavailable (blocking capability) |
| --- | ---: | --- |
| `clio` (`vendors/plugin`) | 31 / 36 | `contribute` (`external.issue`, `vcs.branch`, `vcs.commit`), `remove-section` (`filesystem.delete`), `report-bug` (`external.issue`), `request-feature` (`external.issue`), `update` (`package.update`) |
| `claude` | 31 / 36 | the same five |
| `codex`, `copilot`, `opencode`, `antigravity`, `gemini` | 26 / 36 | the five above plus `analyze-bib`, `audit-milestone`, `check-refs`, `export-latex`, `research-gap` (`tool.execute` unbound) |
| `copilot-cloud` (`vendors/copilot/project/.github`) | 5 / 36 | every action that needs an explicit approval gate, plus the ten above |

`tool.execute` is bound to `clio:bash` and `claude:Bash`, in both cases authorizing only the generated `tools/wtfp-tool.js` dispatcher. `network.search` is `clio:bash-bundled-citation-tools` on Clio (the same dispatcher running the bundled scholarly clients) and the host's own web search elsewhere. To regenerate this table:

```bash
node -e 'for (const [t,f] of Object.entries({clio:"vendors/plugin",claude:"vendors/claude",codex:"vendors/codex/plugins/wtfp",copilot:"vendors/copilot/plugins/wtfp","copilot-cloud":"vendors/copilot/project/.github/wtfp",opencode:"vendors/opencode",antigravity:"vendors/antigravity",gemini:"vendors/gemini"})){const j=require("./"+f+"/compatibility/action-availability.json");console.log(t,j.actions.filter(a=>a.status==="available").length+"/"+j.actions.length,j.actions.filter(a=>a.status!=="available").map(a=>a.id+"("+a.unavailableCapabilities.join(",")+")").join(" "))}'
```

## Claude Code 2.1.267 and 2.1.271 (verified)

Evidence:

```bash
claude plugin --help
claude plugin validate --help
claude plugin install --help
claude plugin validate --strict vendors/claude                       # marketplace manifest: passed
claude plugin validate --strict --json <install>/.claude-plugin/plugin.json   # success: true, strict: true
node bin/install.js install claude --config-dir <tmp>/config --force --advanced --no-color
claude plugin list --json          # wtfp@wtfp, scope user, enabled (0.6.0-rc.4 on 2.1.267; 0.6.0 on 2.1.271)
claude plugin marketplace add <repo-root> && claude plugin install wtfp@wtf-p --scope user -y   # 2.1.271: repository-root marketplace, same 43 skills, 11 agents, 3 hooks
claude plugin marketplace list     # wtfp -> Directory (<tmp>/config/marketplaces/wtfp)
claude plugin details wtfp@wtfp    # Skills (43) = 36 commands + 7 skills; Agents (11); Hooks (3): UserPromptExpansion, PreToolUse, Stop
claude plugin uninstall wtfp@wtfp --scope user -y && claude plugin marketplace remove wtfp --scope user   # disposable-profile cleanup
cp -r vendors/claude <tmp>/staged/wtfp && clio-coder library inspect <tmp>/staged/wtfp --json   # valid: true, diagnostics: [] (Clio reads root plugin.json; historical run used plugins inspect)
```

The installer writes 258 files for this envelope. Root manifest: `vendors/claude/plugin.json` is byte-identical to `vendors/plugin/plugin.json`, and the `ai.iowarp.clio/{prompts,agents,fleets}` files its component graph names are carried beside Claude's own `commands/`, `agents/`, `skills/`, `hooks/`, and `output-styles/`. Claude Code reads neither the root manifest nor `ai.iowarp.clio/`; the `plugin details` counts above are unchanged from the envelope without them. The compiler contract `the Claude envelope carries the portable root manifest and component graph Clio adopts` in `test/adapter-compiler.test.js` pins the identity.

Format facts, from the plugin reference at code.claude.com/docs/en/plugins-reference and confirmed by `plugin details`:

- Agents load only from the top level of `agents/`; the name comes from the file name, so a nested `agents/wtfp/<role>.md` loads nothing. Plugin agents accept `name`, `description`, `model`, `effort`, `maxTurns`, `tools`, `disallowedTools`, `skills`, `memory`, `background`, `isolation`; `hooks`, `mcpServers`, and `permissionMode` are rejected for plugin agents. A missing listed skill is skipped with a debug warning, so `skills: [wtfp:<skill>]` is safe.
- `commands/*.md` load as `/<plugin>:<file>`; a `name` in frontmatter would double the prefix.
- `output-styles/<name>.md` is a plugin component. `force-for-plugin: true` would override the user's `outputStyle` whenever the plugin is enabled; WTF-P leaves it selectable.
- `hooks/hooks.json` supports `UserPromptExpansion` (matches the command name, `wtfp:<action>` for a plugin command), `PreToolUse` (deny through `hookSpecificOutput.permissionDecision`), and `Stop`. Hook commands receive the event JSON on stdin including `session_id`, `prompt_id`, `cwd`, and `scratchpad_dir`.
- `.mcp.json` is supported but WTF-P ships no server.

Write guard behaviour: `UserPromptExpansion` on `/wtfp:(execute-outline|polish-prose|quick|write-section)` records the allowed roots (`.planning/`, `paper/`, derived from each action's `produces`) for the current `prompt_id`; `PreToolUse` on `Write|Edit|MultiEdit|NotebookEdit` denies a path outside those roots and clears the marker when the prompt changes; `Stop` clears it. Every failure to read input or the marker fails open. Exercised with synthetic hook input in the report log.

Headless runs (factory-round envelope, before the version bump and root manifest; Sonnet 5, disposable profile, `ANTHROPIC_API_KEY` unset, OAuth copied from the operator profile and refreshed in place):

```bash
claude -p --model sonnet --output-format json "/wtfp:help"                      # exit 0, 6 turns, 190 s, $0.53
claude -p --model sonnet --output-format json "/wtfp:new-paper <short brief>"  # exit 0, 1 turn, 10 s, $0.12
```

The help run rendered every action as `/wtfp:<action>` and marked the five unavailable ones. The new-paper run stopped at the author interview (the first declared gate) and wrote no file under the project directory.

## Codex CLI 0.153.3 (verified)

Evidence:

```bash
codex --help
codex plugin --help
codex plugin add --help
codex plugin marketplace --help
codex plugin list --help
codex exec --help
codex features list                       # plugins: stable, default false; multi_agent: stable, default true; hooks: stable
node bin/install.js install codex --config-dir <tmp>/home --force --advanced --no-color
codex plugin marketplace list             # wtfp -> <tmp>/home/marketplaces/wtfp
codex plugin list --json                  # wtfp@wtfp installed, enabled, source local (named wtf-p@wtfp on the rc.4 envelope); $CODEX_HOME/agents holds the 11 wtfp-*.toml roles
codex plugin marketplace add <repo-root> && codex plugin add wtfp@wtf-p   # repository-root .agents/plugins/marketplace.json; plugin root cached under plugins/cache/wtf-p/wtfp/<version>
```

Format facts, from developers.openai.com/codex/plugins/build.md and developers.openai.com/codex/subagents.md:

- A portable plugin is root `plugin.json` (Agent Plugins 1.0.0), `skills/`, optional `mcp.json`, and OpenAI-specific `extensions["com.openai"]` carrying `interface`, `apps`, and `hooks`. `.codex-plugin/plugin.json` is the compatibility fallback and is used only when the inline object is absent; the two are never merged.
- `skills`/`mcpServers` keys inside the overlay do not add or remove components of a portable package; `skills/` is discovered by position.
- Codex plugins carry no agents and no slash prompts. Custom agents are TOML files under `~/.codex/agents/` or `.codex/agents/` with required `name`, `description`, `developer_instructions`, plus optional config keys such as `sandbox_mode`. The installer therefore publishes `vendors/codex/plugins/wtfp/agents/*.toml` to `$CODEX_HOME/agents/` as a second manifest component.
- The disposable profile needed `[features] plugins = true`; the operator's own config has it off.

Headless runs (factory-round envelope; `gpt-5.6-luna`, `model_reasoning_effort="xhigh"`, `--skip-git-repo-check`, 10-minute cap):

```bash
codex exec -s read-only -m gpt-5.6-luna -c 'model_reasoning_effort="xhigh"' --json -o help-last.md "<help route prompt>"
# exit 0, 90 s; read skills/wtfp-manage-project/SKILL.md, catalog.json, and action-availability.json; listed 36 actions, 26 available, 10 unavailable
codex exec -s workspace-write -m gpt-5.6-luna -c 'model_reasoning_effort="xhigh"' --json -o newpaper-last.md "Use the \$wtf-p:wtfp-start-project skill and run the new-paper action with this brief: ..."
# exit 0, 94 s; read skills/wtfp-start-project/SKILL.md; stopped at the interview gate with 20 questions; no project file written
```

Whether Codex loads the TOML agents at runtime was not observed: there is no CLI listing for custom agents, and neither headless run needed a subagent.

## Clio Coder 0.4.7 and 0.4.8 (verified)

On 2026-09-14 the published `@iowarp/clio-coder` 0.4.8 (`npm install -g @iowarp/clio-coder`) validated `vendors/plugin` and `vendors/claude` with `library validate --json` (`valid: true`, zero diagnostics, seven skill resources), and the installer route in a disposable `CLIO_CODER_CONFIG_DIR` wrote 203 files, after which `library inspect wtfp --user --json` returned `valid: true`, `enabled: true`, `trust: "trusted"`, zero diagnostics at the expected root, and `library skills --all --json` listed the seven `wtfp-*` skills. Everything below was observed on 0.4.7.

### Current command reference (Clio 0.4.7 unified library CLI)

In Clio 0.4.7, top-level `plugins` and `skills` commands are replaced by `clio-coder library`. The canonical CLI contract for package lifecycle, inspection, listing, and discovery is:

```bash
clio-coder --help
clio-coder library --help
clio-coder library inspect ./staged --json         # manifest candidate: valid: true, diagnostics: []
clio-coder library install ./staged --user --json  # exit 0; use --dry-run for previews (no --yes flag)
clio-coder library list --kind plugin --json       # entries containing installed arrays; scope flags filter copies
clio-coder library inspect wtfp --user --json      # InstalledPlugin shape: valid: true, enabled: true, diagnostics: [] (explicit --user|--project)
clio-coder library skills --all --json             # runtime skill listing
clio-coder agents                                  # 11 wtfp-* recipes, each with its bound skill
clio-coder fleet list                              # wtfp-plan-section and wtfp-draft-review, both valid
clio-coder run '/wtfp:help'                        # prints the static operator card only, exit 0, no model call
node bin/install.js install clio --advanced --no-color        # 203 files; staged install
node bin/install.js uninstall clio --dry-run --no-color       # Dry run: would remove 203 exact file(s)
node bin/install.js uninstall clio --yes --no-color           # removed; registration dropped through library remove
```

Lifecycle inspection, drift, and state toggles run through:
```bash
clio-coder library drift wtfp --user --json       # check package drift against installed manifest
clio-coder library enable wtfp --user --json       # enable package copy
clio-coder library disable wtfp --user --json      # disable package copy
clio-coder library update wtfp --user --json       # update package copy
```

*(Note on CLI contract scope: while `clio-coder library inventory --json` and `clio-coder library drift wtfp --user --json` are documented CLI contract commands, runtime observation is claimed only for the lifecycle, discovery, inspection, dry-run, coexistence, and rollback commands exercised in the native test suite below; no runtime observation is claimed for library inventory or drift.)*

### Observed native verification (Clio 0.4.7 frozen interim snapshot)

Native verification was executed by Astra (wR:p3) via `test/clio-native-integration.test.js` (native test commit `6f95279de1737ce162a71d06da48f44d3851eb56`, with production installer commit `3d9387f`), completing with exit code 0.

#### Provenance and evidence boundaries

- **Runtime version**: Clio Coder 0.4.7 built CLI.
- **Interim snapshot provenance**:
  - Entry point SHA-256: `97c11656520161dcec48600786ecc128f1ae2cde660e7fb99a6d9f347e3a9f39`
  - Built `dist/` tree digest: `13b913e506a34e0532119c2cb27b8d7d38dd52431ca8d3e2ba0805f7313003dc`
  - Archive SHA-256: `fa068fdcd7091b2357293b8f8509c5c6550baaf6d0c1e98daee2c24c8755ca9e`
  - Source HEAD: `b7d9e591eb259553660889046e55393143692b79` (with uncommitted working-tree changes recorded in snapshot metadata). Entry digest matched before and after the test run.
- **Accurate evidence labeling**: This is a **frozen interim built Clio snapshot**, NOT a final clean release SHA or final packed-consumer proof from an npm release. Final WTF-P release gates do not pass yet; Clio 0.4.7 remains an unpublished external dependency blocking promotion to stable `0.6.0`, and WTF-P remains on npm `next` as `0.6.0-rc.4`.
- **Test execution recipe**:
  ```bash
  TMPDIR=<disposable-tmp> WTFP_CLIO_ENTRY=/path/to/clio-coder/dist/cli/index.js node test/clio-native-integration.test.js
  ```
  The test requires an explicit `WTFP_CLIO_ENTRY` naming an absolute built CLI file. All configuration, data, state, cache, temporary files, and workspaces were isolated under disposable directories (`HOME`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_STATE_HOME`, `XDG_CACHE_HOME`, `CLIO_CODER_*`, `TMPDIR`, mode 0700) and removed in `finally` cleanup. A temporary Git checkout was created solely for native fleet write-boundary validation (WTF-P never creates a Git checkout as a side effect). No ambient operator profiles were read or modified; no Claude sessions, model calls, or fleet executions (`fleet run`) occurred.

#### Observed results in both user and project scopes

The native suite exercised and verified the following behaviors across **both** disposable user (`--user`) and project (`--project`) scopes:

1. **CLI contract precheck**: `clio-coder library --help` exposes the final commands (`install`, `inspect`, `list`, `remove`, `enable`, `disable`) and `--dry-run`.
2. **Claude envelope adoption**: `clio-coder library inspect <vendors/claude> --user --json` returns `valid: true` with zero diagnostics, confirming Clio adopts the portable manifest candidate without running Claude.
3. **Candidate inspection & install preview**: `clio-coder library inspect <vendors/plugin> --<scope> --json` validates the candidate manifest (`valid: true`). `clio-coder library install <vendors/plugin> --<scope> --dry-run --json` returns `confirmed: false` and creates no files or directories under the target root.
4. **Installer delegation & exact receipt**: `node bin/install.js install clio --config-dir <target> --advanced --force --no-color` delegates to `clio-coder library install <staged-dir> --<scope> --json` (passing no `--yes` or `--force` to Clio). The WTF-P `.wtfp-version` receipt records exactly 203 SHA-256-authenticated files, all under `plugins/wtfp/`, and excludes native state.
5. **Native package listing**: `clio-coder library list --kind plugin --json` returns `{ entries: [{ kind: "plugin", name: "wtfp", installed: [...] }], diagnostics: [] }`. The target copy is verified as `valid: true`, `enabled: true`, `compatible: true`, `effective: true`, and `loadable: true` with zero diagnostics.
6. **Installed package inspection**: `clio-coder library inspect wtfp --<scope> --json` returns the exact `id: "wtfp"`, scope, expected `rootPath`, `valid: true`, `enabled: true`, and `trust: "trusted"` (confirming first-party CLI installation does not inherit foreign trust), with zero diagnostics.
7. **Runtime skills discovery**: `clio-coder library skills --all --json` discovers all 7 `wtfp-*` runtime catalog skills.
8. **Agent recipes discovery**: `clio-coder agents` lists all 11 `wtfp-*` role recipes.
9. **Fleet contract validation & graph**: `clio-coder fleet validate` and `clio-coder fleet graph` succeed for both `wtfp-plan-section` and `wtfp-draft-review`. (Validation and dependency graphing only; not `fleet run` execution evidence).
10. **Display-only help prompt**: `clio-coder run '/wtfp:help'` outputs the static operator card containing `wtfp:new-paper` with exit code 0 and no model call.
11. **Packaged reference containment**: All 508 packaged `${pluginRoot}` references across installed prompt, agent, and fleet bodies resolve strictly within the installed root with zero escaping or missing paths. The four advertised document routes (`new-paper`, `create-outline`, `create-poster`, `create-slides`) bind existing packaged templates (`templates/paper-outline.md`, `templates/grant-proposal-outline.md`, `templates/poster.md`, `templates/slides.md`).
12. **Idempotence**: Re-running the installer preserves exact native state bytes (`plugins/state.json`).
13. **Preserved disable preference & state repair**: Disabling the plugin via `clio-coder library disable wtfp --<scope> --json` followed by re-installation preserves `enabled: false` and emits a scope-correct `clio-coder library enable` hint. An intentionally corrupted/stale content digest in `plugins/state.json` forces re-registration and continues to preserve `enabled: false`. Explicit `clio-coder library enable wtfp --<scope> --json` restores `enabled: true`.
14. **Clean removal**: `node bin/uninstall.js --clio --config-dir <target> --yes --no-color` invokes scoped `clio-coder library remove`; the package root, receipt, and installed-list entry are cleanly removed.
15. **Scope coexistence**: A project installation in `<workspace>/.clio-coder` followed by a user installation in `CLIO_CODER_CONFIG_DIR` from the same workspace cleanly coexist. Unscoped `library list` lists both installed copies; scoped `inspect` and `list` select the exact requested root. Removing the user copy preserves project `plugins/state.json` byte-for-byte and leaves the project copy valid; subsequent project removal succeeds cleanly.
16. **Injected verification-failure compensating rollback**: For each scope, the test wrapper injected a verification-command failure (`WTFP_TEST_INSPECT_FAILURE=1` on `library inspect`) *after real native installation*. Actual Clio `library remove` compensates the failed installation. No package files, receipt, or native registration remain in `plugins/state.json` or `library list`, and no incomplete rollback diagnostic occurs. (This is native installer rollback compensation evidence, not a model or fleet rollback test).

### Observed historical invocations (Fable verification at SHA 31a0600)

The verification evidence below was gathered by Fable on 2026-09-09 on Linux against the pre-unification Clio CLI surface (which exposed top-level `plugins`):

```bash
clio-coder --help
clio-coder plugins --help
clio-coder plugins inspect ./staged --json         # valid: true, diagnostics: []
clio-coder plugins install ./staged --user --json  # exit 0
clio-coder plugins list --all --json               # wtfp, scope user, valid, enabled
clio-coder plugins inspect wtfp --json             # valid: true, enabled: true, diagnostics: [] (version 0.6.0-rc.4, scope user)
clio-coder agents                                  # 11 wtfp-* recipes, each with its bound skill
clio-coder fleet list                              # wtfp-plan-section and wtfp-draft-review, both valid
clio-coder run '/wtfp:help'                        # prints the static operator card only, exit 0, no model call
node bin/install.js install clio --advanced --no-color        # 203 files; the installer ran the staged plugins install itself
node bin/install.js uninstall clio --dry-run --no-color       # Dry run: would remove 203 exact file(s)
node bin/install.js uninstall clio --yes --no-color           # removed; registration dropped through plugins remove
```

*Note: The recorded invocations above reflect historical execution under Fable at SHA `31a0600`. The 203-file uninstall dry-run count belongs to this inherited Fable run (the modern native suite validates library-install dry-run, not WTF-P uninstall dry-run).*

The `--autonomy read-only|suggest|auto-edit|full-auto` flag is parsed for both the interactive launcher and `clio-coder run` (confirmed in `clio-coder run --help` and `src/cli/args.ts`).

Format facts, from `docs/guide/authoring-plugins.md` and `src/domains/resources/prompts/loader.ts` in the 0.4.7 source: prompts are discovered recursively beneath the declared prompts root and named by path (`/wtfp:<action>`); the prompt loader reads `description`, `argument-hint`, and `display-only`; a display-only template is answered by `clio-coder run` and the TUI with its first fenced block and no provider, session, or model. The help prompt is that card. Component kinds are `skill`, `prompt`, `agent`, `fleet`, `script`, `resource`, `tool`; MCP files are preserved but not executed; hooks are a harness-extension concern, not a plugin one.

## OpenCode 1.18.30 and 1.18.31 (verified)

Evidence (temporary npm prefix, `OPENCODE_CONFIG_DIR=<tmp>/config`, `HOME` and `XDG_*` under `<tmp>/home`):

```bash
node bin/install.js install opencode --config-dir <tmp>/config --force --advanced --no-color   # 203 files (re-run on 0.6.0-rc.4 and, with 1.18.31, on 0.6.0: debug skill lists the 7 wtfp-* skills)
opencode debug paths                       # data/config/cache/state roots all under the disposable home
opencode agent list                        # 11 wtfp-* (subagent) beside the built-ins
opencode debug agent wtfp-argument-verifier   # mode: subagent; permission entries edit: deny, bash: deny (below OpenCode's own allow-all default)
opencode debug skill                       # 7 wtfp-* skills beside the built-in customize-opencode
opencode serve --port 47312; curl http://127.0.0.1:47312/command   # 46 commands, 36 named wtfp:<action>
curl http://127.0.0.1:47312/agent          # 18 agents, 11 wtfp-*, wtfp-argument-verifier mode subagent
```

Defect found and fixed during this run: OpenCode's tool registry imports every `{tool,tools}/*.{js,ts}` below the config root as a custom-tool module (`packages/opencode/src/tool/registry.ts`). The generated `tools/wtfp-tool.js` ran `main(process.argv)` on import, so `opencode debug agent` (and any session that initialised tools) printed `{"error":"unknown command: debug; ..."}` and exited 1. The dispatcher now runs `main` only under `require.main === module`; after regenerating, the commands above pass.

Source read at `anomalyco/opencode@dev`: `packages/opencode/src/config/agent.ts` scans `{agent,agents}/**/*.md` and builds `{ name: <path-derived>, ...frontmatter }`, so a frontmatter `name` wins; `config/command.ts` does the same for `{command,commands}/**/*.md`; `config/entry-name.ts` derives the fallback name from the path relative to `agents/` or `commands/` (a nested file would be `wtfp/<role>`). Documentation (`docs/agents.mdx`, `docs/commands.mdx`, `docs/skills.mdx`, `docs/plugins.mdx`): agents and commands are Markdown under `~/.config/opencode/{agents,commands}/`, skills under `~/.config/opencode/skills/<name>/SKILL.md`, `mode: subagent` and a `permission` block are agent frontmatter, and "plugins" are JavaScript modules.

Projection: unchanged layout (`commands/wtfp/<action>.md`, `agents/wtfp/<role>.md`, both with explicit `name`), plus `mode: subagent` on every role and `permission: {edit: deny, bash: deny}` on verifier roles. The server API confirms the frontmatter `name` is what registers: every command is `wtfp:<action>` and every agent `wtfp-<role>`.

## Antigravity CLI 1.1.28 and 1.2.2 (verified)

Evidence (`ANTIGRAVITY_HOME=<tmp>/home/.gemini/config`, `HOME=<tmp>/home`):

```bash
agy --version                                   # 1.1.28 (commands below re-run on 0.6.0-rc.4); 1.2.2 re-ran validate, install, list, and agents on 0.6.0 with the plugin named wtfp
agy plugin validate vendors/antigravity         # [ok] skills: 7 processed, agents: 11 processed, commands: 36 processed (converted to skills), mcpServers/hooks skipped (not found)
node bin/install.js install antigravity --config-dir <tmp>/home/.gemini/config --force --advanced --no-color   # 204 files, agy plugin install
agy plugin list                                 # {"imports":[{"name":"wtfp","source":"antigravity","components":["skills","agents","commands"]}]} (named wtf-p on rc.4)
agy agents                                      # the 11 wtfp-* agents
```

The schema-conformant manifest (`$schema`, `name`, `description`) validates, and the `commands/` directory is accepted: 1.1.28 converts each command into a skill, which is how it becomes a slash command. Documentation at antigravity.google/docs/cli/plugins/ and /docs/cli/subagents/: a plugin is `plugin.json` plus optional `mcp_config.json`, `hooks.json`, `skills/`, `agents/`, `rules/`. The published manifest schema (`https://antigravity.google/schemas/v1/plugin.json`) permits exactly `name` and `description` with `additionalProperties: false`. Skills become slash commands. Custom agents are Markdown with YAML frontmatter under `.agents/agents/` or `~/.gemini/config/agents/`, and `subagent: true` makes an agent callable through `invoke_subagent`. Install: `agy plugin install <path>`, `agy plugin list`, `enable`/`disable`/`uninstall`.

Projection: the manifest carries only `$schema`, `name`, `description` (the previous `version`, `author`, `commands`, `agents`, `skills` keys violate the schema); `commands/` is kept because `agy plugin validate` converts it to skills; agents carry `subagent: true`; `rules/wtfp-project-state.md` projects the project protocol as an always-on rule. `agy plugin validate` reports `hooks: skipped` and `mcpServers: skipped`, confirming those are the only other component kinds it looks for.

## Gemini CLI 0.59.0 (verified)

Evidence (temporary npm prefix, `GEMINI_CLI_HOME=<tmp>/home`, `HOME=<tmp>/home`):

```bash
node bin/install.js install gemini --config-dir <tmp>/home/.gemini --force --advanced --no-color   # 204 files into extensions/wtfp (extensions/wtf-p on rc.4)
gemini extensions validate <tmp>/home/.gemini/extensions/wtfp   # "has been successfully validated"
gemini extensions list                                           # wtfp enabled user+workspace, context file GEMINI.md, 7 agent skills (re-run on 0.6.0-rc.4 and 0.6.0)
gemini skills list --all                                         # "Loading extension: wtfp"; 7 wtfp-* skills [Enabled] at the extension path
gemini --list-extensions                                         # exit 41: requires an auth method (no Gemini credential in the disposable profile)
```

Gemini has no CLI listing for agents or commands. The extension loaded with no diagnostics, and its 36 TOML commands and 11 flat agents are on disk at the paths the loader reads; a headless prompt would need `GEMINI_API_KEY` or OAuth, which this machine does not hold. Source read at `google-gemini/gemini-cli@main`: `packages/cli/src/config/extension-manager.ts` calls `loadAgentsFromDirectory(path.join(extensionPath, 'agents'))`, and `packages/core/src/agents/agentLoader.ts` lists only regular `.md` files in that one directory. The local agent frontmatter schema is strict: `name`, `description`, optional `kind: local`, `display_name`, `tools`, `mcp_servers`, `model`, `temperature`, `max_turns`, `timeout_mins`; unknown keys fail validation. Documentation (`docs/extensions/reference.md`, `docs/cli/custom-commands.md`): `gemini-extension.json` carries `name`, `version`, `description`, `mcpServers`, `contextFileName`, `excludeTools`, `settings`; commands are TOML under `commands/`, with a subdirectory becoming the `/<dir>:<name>` namespace; `gemini extensions install <path>` / `link` / `list`.

Projection: agents moved from `agents/wtfp/<role>.md` (zero loaded) to `agents/wtfp-<role>.md` with `kind: local` and no other keys.

## GitHub Copilot CLI 1.0.83 (verified: marketplace and plugin list)

Evidence (temporary npm prefix, `COPILOT_HOME=<tmp>/home/.copilot`, `HOME` and `XDG_CONFIG_HOME` under `<tmp>/home`, no credentials):

```bash
npm install -g --prefix <tmp>/npm @github/copilot && copilot --version   # GitHub Copilot CLI 1.0.83
copilot plugin --help                       # install <source>, list, marketplace; plugins carry skills, agents, hooks, MCP and LSP servers
node bin/install.js install copilot --config-dir <tmp>/home/.copilot --force --advanced --no-color   # 419 files; marketplace add + plugin install
copilot plugin marketplace list             # Registered marketplaces: wtfp (Local: <tmp>/home/.copilot/marketplaces/wtfp)
copilot plugin list                         # Live Plugins: wtfp@wtfp (enabled), loaded from the local marketplace directory, never copied (wtf-p@wtfp on rc.4)
copilot plugin marketplace add <repo-root> && copilot plugin install wtfp@wtf-p   # repository-root .github/plugin/marketplace.json: "installed 7 skills", live from vendors/copilot/plugins/wtfp
```

`copilot plugin list` has no verbose or component listing, and a session needs GitHub credentials, so in-session command, agent, and skill discovery was not observed. Adding both the repository marketplace and the installer's local marketplace to one profile leaves Copilot with a single `wtfp` entry; use one route per profile. The projection is the Claude-compatible plugin (`.claude-plugin/plugin.json`, `commands/wtfp-<action>.md`, flat `agents/wtfp-<role>.md`, `skills/`) inside a local marketplace, plus the copyable `.github` repository projection for the cloud coding agent.

## Spec compliance

`vendors/plugin/plugin.json` and the Codex root `plugin.json` validate against `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`. The schema was fetched on 2026-09-09 and is byte-identical (sha256 `0a4aad95…`) to the vendored copy at `test/fixtures/agent-plugin-1.0.0.schema.json`, which `test/adapter-compiler.test.js` uses. The root schema allows `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`; host-specific data lives under reverse-domain keys in `extensions` (`ai.iowarp.clio`, `com.openai`).

Provenance: every generated file carries a `Generated by WTF-P adapter compiler v5 from protocol/<source>` banner naming its canonical source, and every envelope's `.wtfp-generated.json` records the SHA-256 of each generated path and a `sourceHash` over the whole envelope. The canonical bundle is `vendors/plugin`; each host envelope is a projection of the same `protocol/` sources by `bin/lib/adapter-compiler.js`.
