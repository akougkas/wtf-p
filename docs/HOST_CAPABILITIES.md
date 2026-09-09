# Host capability matrix

What each supported host can load from a plugin, how it installs and discovers it, and how the WTF-P adapter compiler projects the canonical `vendors/plugin` bundle into a package that uses those capabilities. Every row names the evidence it rests on. A host that was not installed on the machine that produced this document is marked unverified: its projection follows the vendor's published loader source or documentation, not an observed run.

Evidence was gathered on 2026-09-09 on Linux against the `0.6.0-rc.4` envelope. CLIs on PATH: `claude` 2.1.267, `codex` 0.153.3, `clio-coder` 0.4.7 (a local build; 0.4.7 is not yet a published Clio release), `agy` (Antigravity CLI) 1.1.28. Installed into temporary npm prefixes for this run: `gemini` 0.59.0 and `opencode` 1.18.30 (`npm install -g --prefix <tmp>/npm @google/gemini-cli opencode-ai`) and `copilot` 1.0.83 (`npm install -g --prefix <tmp>/npm @github/copilot`). Every command below ran against a disposable profile (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `CLIO_CODER_CONFIG_DIR`, `COPILOT_HOME`, `OPENCODE_CONFIG_DIR`, `GEMINI_CLI_HOME`, `ANTIGRAVITY_HOME` plus `HOME`/`XDG_*` under a temporary root); no operator profile was read for discovery or written. The two model-backed headless runs recorded under Claude Code and Codex were made earlier the same day on the factory-round envelope, before the version bump and the Claude root manifest; they are labelled as such.

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
| Marketplace | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json` | none | none | gallery only | `marketplace.json` | `plugins/registry.yaml` |
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
node -e 'for (const [t,f] of Object.entries({clio:"vendors/plugin",claude:"vendors/claude",codex:"vendors/codex/plugins/wtf-p",copilot:"vendors/copilot/plugins/wtf-p","copilot-cloud":"vendors/copilot/project/.github/wtfp",opencode:"vendors/opencode",antigravity:"vendors/antigravity",gemini:"vendors/gemini"})){const j=require("./"+f+"/compatibility/action-availability.json");console.log(t,j.actions.filter(a=>a.status==="available").length+"/"+j.actions.length,j.actions.filter(a=>a.status!=="available").map(a=>a.id+"("+a.unavailableCapabilities.join(",")+")").join(" "))}'
```

## Claude Code 2.1.267 (verified)

Evidence:

```bash
claude plugin --help
claude plugin validate --help
claude plugin install --help
claude plugin validate --strict vendors/claude                       # marketplace manifest: passed
claude plugin validate --strict --json <install>/.claude-plugin/plugin.json   # success: true, strict: true
node bin/install.js install claude --config-dir <tmp>/config --force --advanced --no-color
claude plugin list --json          # wtfp@wtfp 0.6.0-rc.4, scope user, enabled
claude plugin marketplace list     # wtfp -> Directory (<tmp>/config/marketplaces/wtfp)
claude plugin details wtfp@wtfp    # Skills (43) = 36 commands + 7 skills; Agents (11); Hooks (3): UserPromptExpansion, PreToolUse, Stop
claude plugin uninstall wtfp@wtfp --scope user -y && claude plugin marketplace remove wtfp --scope user   # disposable-profile cleanup
cp -r vendors/claude <tmp>/staged/wtfp && clio-coder plugins inspect <tmp>/staged/wtfp --json   # valid: true, diagnostics: [] (Clio reads the root plugin.json)
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
codex plugin list --json                  # wtf-p@wtfp 0.6.0-rc.4 installed, enabled, source local; $CODEX_HOME/agents holds the 11 wtfp-*.toml roles
```

Format facts, from developers.openai.com/codex/plugins/build.md and developers.openai.com/codex/subagents.md:

- A portable plugin is root `plugin.json` (Agent Plugins 1.0.0), `skills/`, optional `mcp.json`, and OpenAI-specific `extensions["com.openai"]` carrying `interface`, `apps`, and `hooks`. `.codex-plugin/plugin.json` is the compatibility fallback and is used only when the inline object is absent; the two are never merged.
- `skills`/`mcpServers` keys inside the overlay do not add or remove components of a portable package; `skills/` is discovered by position.
- Codex plugins carry no agents and no slash prompts. Custom agents are TOML files under `~/.codex/agents/` or `.codex/agents/` with required `name`, `description`, `developer_instructions`, plus optional config keys such as `sandbox_mode`. The installer therefore publishes `vendors/codex/plugins/wtf-p/agents/*.toml` to `$CODEX_HOME/agents/` as a second manifest component.
- The disposable profile needed `[features] plugins = true`; the operator's own config has it off.

Headless runs (factory-round envelope; `gpt-5.6-luna`, `model_reasoning_effort="xhigh"`, `--skip-git-repo-check`, 10-minute cap):

```bash
codex exec -s read-only -m gpt-5.6-luna -c 'model_reasoning_effort="xhigh"' --json -o help-last.md "<help route prompt>"
# exit 0, 90 s; read skills/wtfp-manage-project/SKILL.md, catalog.json, and action-availability.json; listed 36 actions, 26 available, 10 unavailable
codex exec -s workspace-write -m gpt-5.6-luna -c 'model_reasoning_effort="xhigh"' --json -o newpaper-last.md "Use the \$wtf-p:wtfp-start-project skill and run the new-paper action with this brief: ..."
# exit 0, 94 s; read skills/wtfp-start-project/SKILL.md; stopped at the interview gate with 20 questions; no project file written
```

Whether Codex loads the TOML agents at runtime was not observed: there is no CLI listing for custom agents, and neither headless run needed a subagent.

## Clio Coder 0.4.7 (verified)

Evidence:

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

The `--autonomy read-only|suggest|auto-edit|full-auto` flag is parsed for both the interactive launcher and `clio-coder run` (confirmed in `clio-coder run --help` and `src/cli/args.ts`).

Format facts, from `docs/guide/authoring-plugins.md` and `src/domains/resources/prompts/loader.ts` in the 0.4.7 source: prompts are discovered recursively beneath the declared prompts root and named by path (`/wtfp:<action>`); the prompt loader reads `description`, `argument-hint`, and `display-only`; a display-only template is answered by `clio-coder run` and the TUI with its first fenced block and no provider, session, or model. The help prompt is that card. Component kinds are `skill`, `prompt`, `agent`, `fleet`, `script`, `resource`, `tool`; MCP files are preserved but not executed; hooks are a harness-extension concern, not a plugin one.

## OpenCode 1.18.30 (verified)

Evidence (temporary npm prefix, `OPENCODE_CONFIG_DIR=<tmp>/config`, `HOME` and `XDG_*` under `<tmp>/home`):

```bash
node bin/install.js install opencode --config-dir <tmp>/config --force --advanced --no-color   # 203 files (re-run on 0.6.0-rc.4)
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

## Antigravity CLI 1.1.28 (verified)

Evidence (`ANTIGRAVITY_HOME=<tmp>/home/.gemini/config`, `HOME=<tmp>/home`):

```bash
agy --version                                   # 1.1.28 (commands below re-run on 0.6.0-rc.4)
agy plugin validate vendors/antigravity         # [ok] skills: 7 processed, agents: 11 processed, commands: 36 processed (converted to skills), mcpServers/hooks skipped (not found)
node bin/install.js install antigravity --config-dir <tmp>/home/.gemini/config --force --advanced --no-color   # 204 files, agy plugin install
agy plugin list                                 # {"imports":[{"name":"wtf-p","source":"antigravity","components":["skills","agents","commands"]}]}
agy agents                                      # the 11 wtfp-* agents
```

The schema-conformant manifest (`$schema`, `name`, `description`) validates, and the `commands/` directory is accepted: 1.1.28 converts each command into a skill, which is how it becomes a slash command. Documentation at antigravity.google/docs/cli/plugins/ and /docs/cli/subagents/: a plugin is `plugin.json` plus optional `mcp_config.json`, `hooks.json`, `skills/`, `agents/`, `rules/`. The published manifest schema (`https://antigravity.google/schemas/v1/plugin.json`) permits exactly `name` and `description` with `additionalProperties: false`. Skills become slash commands. Custom agents are Markdown with YAML frontmatter under `.agents/agents/` or `~/.gemini/config/agents/`, and `subagent: true` makes an agent callable through `invoke_subagent`. Install: `agy plugin install <path>`, `agy plugin list`, `enable`/`disable`/`uninstall`.

Projection: the manifest carries only `$schema`, `name`, `description` (the previous `version`, `author`, `commands`, `agents`, `skills` keys violate the schema); `commands/` is kept because `agy plugin validate` converts it to skills; agents carry `subagent: true`; `rules/wtfp-project-state.md` projects the project protocol as an always-on rule. `agy plugin validate` reports `hooks: skipped` and `mcpServers: skipped`, confirming those are the only other component kinds it looks for.

## Gemini CLI 0.59.0 (verified)

Evidence (temporary npm prefix, `GEMINI_CLI_HOME=<tmp>/home`, `HOME=<tmp>/home`):

```bash
node bin/install.js install gemini --config-dir <tmp>/home/.gemini --force --advanced --no-color   # 204 files into extensions/wtf-p
gemini extensions validate <tmp>/home/.gemini/extensions/wtf-p   # "has been successfully validated"
gemini extensions list                                           # wtf-p enabled user+workspace, context file GEMINI.md, 7 agent skills (re-run on 0.6.0-rc.4)
gemini skills list --all                                         # "Loading extension: wtf-p"; 7 wtfp-* skills [Enabled] at the extension path
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
copilot plugin list                         # Live Plugins: wtf-p@wtfp (v0.6.0-rc.4) (enabled), loaded from the local marketplace directory, never copied
```

`copilot plugin list` has no verbose or component listing, and a session needs GitHub credentials, so in-session command, agent, and skill discovery was not observed. The projection is the Claude-compatible plugin (`.claude-plugin/plugin.json`, `commands/wtfp-<action>.md`, flat `agents/wtfp-<role>.md`, `skills/`) inside a local marketplace, plus the copyable `.github` repository projection for the cloud coding agent.

## Spec compliance

`vendors/plugin/plugin.json` and the Codex root `plugin.json` validate against `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`. The schema was fetched on 2026-09-09 and is byte-identical (sha256 `0a4aad95…`) to the vendored copy at `test/fixtures/agent-plugin-1.0.0.schema.json`, which `test/adapter-compiler.test.js` uses. The root schema allows `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`; host-specific data lives under reverse-domain keys in `extensions` (`ai.iowarp.clio`, `com.openai`).

Provenance: every generated file carries a `Generated by WTF-P adapter compiler v5 from protocol/<source>` banner naming its canonical source, and every envelope's `.wtfp-generated.json` records the SHA-256 of each generated path and a `sourceHash` over the whole envelope. The canonical bundle is `vendors/plugin`; each host envelope is a projection of the same `protocol/` sources by `bin/lib/adapter-compiler.js`.
