# Host capability matrix

What each supported host can load from a plugin, how it installs and discovers it, and how the WTF-P adapter compiler projects the canonical `vendors/plugin` bundle into a package that uses those capabilities. Every row names the evidence it rests on. A host that was not installed on the machine that produced this document is marked unverified: its projection follows the vendor's published loader source or documentation, not an observed run.

Evidence was gathered on 2026-09-09 on Linux. Installed CLIs: `claude` 2.1.267, `codex` 0.153.3, `clio-coder` 0.4.7. Not installed: `opencode`, `gemini`, `agy` (Antigravity CLI), `copilot`. Every command below ran against a disposable profile (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `CLIO_CODER_CONFIG_DIR` plus `HOME`/`XDG_CONFIG_HOME` under a temporary root); no operator profile was read for discovery or written.

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
| Verified here | yes | yes | no | no | no | no | yes |

## What WTF-P projects per host

| Host | Projection (`vendors/...`) | What is native there |
| --- | --- | --- |
| Claude Code | `vendors/claude` | 36 commands, 11 agents each preloading its bound plugin skill, 7 skills, `output-styles/wtfp-academic-writing.md`, `hooks/hooks.json` write guard, bounded tool dispatcher via `Bash` |
| Codex | `vendors/codex` | root `plugin.json` with `extensions["com.openai"]`, `.codex-plugin/plugin.json` fallback, 7 skills, 11 TOML custom agents (installed to `$CODEX_HOME/agents/`), local marketplace |
| OpenCode | `vendors/opencode` | 36 commands (`name: wtfp:<action>`), 11 subagents (`mode: subagent`, verifier roles deny edit/bash), 7 skills |
| Antigravity CLI | `vendors/antigravity` | schema-conformant `plugin.json`, 36 commands, 11 agents (`subagent: true`), 7 skills, `rules/wtfp-project-state.md` |
| Gemini CLI | `vendors/gemini` | `gemini-extension.json`, `GEMINI.md`, 36 TOML commands under `commands/wtfp/`, 11 flat agents (`kind: local`), 7 skills |
| Copilot CLI | `vendors/copilot` | Claude-compatible plugin plus the `.github` repository projection; unchanged in this round |
| Clio Coder | `vendors/plugin` | the canonical bundle itself: 36 prompts (help is `display-only`), 11 recipes, 7 skills, 2 fleets |

No projection declares an MCP server: the repository contains no MCP server implementation (the untracked `vendors/claude/mcp/research-server/` directory holds empty directories and is excluded from the package).

## Claude Code 2.1.267 (verified)

Evidence:

```bash
claude plugin --help
claude plugin validate --help
claude plugin install --help
claude plugin validate --strict vendors/claude                       # marketplace manifest: passed
claude plugin validate --strict --json <install>/.claude-plugin/plugin.json   # success: true, strict: true
node bin/install.js install claude --config-dir <tmp>/config --force --advanced --no-color
claude plugin list --json          # wtfp@wtfp 0.6.0-rc.3, scope user, enabled
claude plugin marketplace list     # wtfp -> Directory (<tmp>/config/marketplaces/wtfp)
claude plugin details wtfp@wtfp    # Skills (43) = 36 commands + 7 skills; Agents (11); Hooks (3): UserPromptExpansion, PreToolUse, Stop
```

Format facts, from the plugin reference at code.claude.com/docs/en/plugins-reference and confirmed by `plugin details`:

- Agents load only from the top level of `agents/`; the name comes from the file name, so a nested `agents/wtfp/<role>.md` loads nothing. Plugin agents accept `name`, `description`, `model`, `effort`, `maxTurns`, `tools`, `disallowedTools`, `skills`, `memory`, `background`, `isolation`; `hooks`, `mcpServers`, and `permissionMode` are rejected for plugin agents. A missing listed skill is skipped with a debug warning, so `skills: [wtfp:<skill>]` is safe.
- `commands/*.md` load as `/<plugin>:<file>`; a `name` in frontmatter would double the prefix.
- `output-styles/<name>.md` is a plugin component. `force-for-plugin: true` would override the user's `outputStyle` whenever the plugin is enabled; WTF-P leaves it selectable.
- `hooks/hooks.json` supports `UserPromptExpansion` (matches the command name, `wtfp:<action>` for a plugin command), `PreToolUse` (deny through `hookSpecificOutput.permissionDecision`), and `Stop`. Hook commands receive the event JSON on stdin including `session_id`, `prompt_id`, `cwd`, and `scratchpad_dir`.
- `.mcp.json` is supported but WTF-P ships no server.

Write guard behaviour: `UserPromptExpansion` on `/wtfp:(execute-outline|polish-prose|quick|write-section)` records the allowed roots (`.planning/`, `paper/`, derived from each action's `produces`) for the current `prompt_id`; `PreToolUse` on `Write|Edit|MultiEdit|NotebookEdit` denies a path outside those roots and clears the marker when the prompt changes; `Stop` clears it. Every failure to read input or the marker fails open. Exercised with synthetic hook input in the report log.

Headless runs (Sonnet 5, disposable profile, `ANTHROPIC_API_KEY` unset, OAuth copied from the operator profile and refreshed in place):

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
codex plugin list --json                  # wtf-p@wtfp 0.6.0-rc.3 installed, enabled, source local
```

Format facts, from developers.openai.com/codex/plugins/build.md and developers.openai.com/codex/subagents.md:

- A portable plugin is root `plugin.json` (Agent Plugins 1.0.0), `skills/`, optional `mcp.json`, and OpenAI-specific `extensions["com.openai"]` carrying `interface`, `apps`, and `hooks`. `.codex-plugin/plugin.json` is the compatibility fallback and is used only when the inline object is absent; the two are never merged.
- `skills`/`mcpServers` keys inside the overlay do not add or remove components of a portable package; `skills/` is discovered by position.
- Codex plugins carry no agents and no slash prompts. Custom agents are TOML files under `~/.codex/agents/` or `.codex/agents/` with required `name`, `description`, `developer_instructions`, plus optional config keys such as `sandbox_mode`. The installer therefore publishes `vendors/codex/plugins/wtf-p/agents/*.toml` to `$CODEX_HOME/agents/` as a second manifest component.
- The disposable profile needed `[features] plugins = true`; the operator's own config has it off.

Headless runs (`gpt-5.6-luna`, `model_reasoning_effort="xhigh"`, `--skip-git-repo-check`, 10-minute cap):

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
clio-coder plugins inspect wtfp --json             # valid: true, diagnostics: []
clio-coder agents                                  # 11 wtfp-* recipes, each with its bound skill
```

Format facts, from `docs/guide/authoring-plugins.md` and `src/domains/resources/prompts/loader.ts` in the 0.4.7 source: prompts are discovered recursively beneath the declared prompts root and named by path (`/wtfp:<action>`); the prompt loader reads `description` and `argument-hint` and ignores other frontmatter keys, so the new `display-only: true` on the help prompt is inert until Clio adds the key. Component kinds are `skill`, `prompt`, `agent`, `fleet`, `script`, `resource`, `tool`; MCP files are preserved but not executed; hooks are a harness-extension concern, not a plugin one.

## OpenCode (unverified: CLI not installed)

Source read at `anomalyco/opencode@dev`: `packages/opencode/src/config/agent.ts` scans `{agent,agents}/**/*.md` and builds `{ name: <path-derived>, ...frontmatter }`, so a frontmatter `name` wins; `config/command.ts` does the same for `{command,commands}/**/*.md`; `config/entry-name.ts` derives the fallback name from the path relative to `agents/` or `commands/` (a nested file would be `wtfp/<role>`). Documentation (`docs/agents.mdx`, `docs/commands.mdx`, `docs/skills.mdx`, `docs/plugins.mdx`): agents and commands are Markdown under `~/.config/opencode/{agents,commands}/`, skills under `~/.config/opencode/skills/<name>/SKILL.md`, `mode: subagent` and a `permission` block are agent frontmatter, and "plugins" are JavaScript modules.

Projection: unchanged layout (`commands/wtfp/<action>.md`, `agents/wtfp/<role>.md`, both with explicit `name`), plus `mode: subagent` on every role and `permission: {edit: deny, bash: deny}` on verifier roles. The last observed run was OpenCode 1.18.16 on the earlier layout (`docs/COMPATIBILITY.md`).

## Antigravity CLI (unverified: `agy` not installed)

Documentation at antigravity.google/docs/cli/plugins/ and /docs/cli/subagents/: a plugin is `plugin.json` plus optional `mcp_config.json`, `hooks.json`, `skills/`, `agents/`, `rules/`. The published manifest schema (`https://antigravity.google/schemas/v1/plugin.json`) permits exactly `name` and `description` with `additionalProperties: false`. Skills become slash commands. Custom agents are Markdown with YAML frontmatter under `.agents/agents/` or `~/.gemini/config/agents/`, and `subagent: true` makes an agent callable through `invoke_subagent`. Install: `agy plugin install <path>`, `agy plugin list`, `enable`/`disable`/`uninstall`.

Projection: the manifest now carries only `$schema`, `name`, `description` (the previous `version`, `author`, `commands`, `agents`, `skills` keys violate the schema); `commands/` is kept because Antigravity CLI 1.1.22 loaded it in the last observed run; agents gain `subagent: true`; `rules/wtfp-project-state.md` projects the project protocol as an always-on rule. Re-validate with `agy plugin install` before claiming support for 1.1.25.

## Gemini CLI (unverified: `gemini` not installed)

Source read at `google-gemini/gemini-cli@main`: `packages/cli/src/config/extension-manager.ts` calls `loadAgentsFromDirectory(path.join(extensionPath, 'agents'))`, and `packages/core/src/agents/agentLoader.ts` lists only regular `.md` files in that one directory. The local agent frontmatter schema is strict: `name`, `description`, optional `kind: local`, `display_name`, `tools`, `mcp_servers`, `model`, `temperature`, `max_turns`, `timeout_mins`; unknown keys fail validation. Documentation (`docs/extensions/reference.md`, `docs/cli/custom-commands.md`): `gemini-extension.json` carries `name`, `version`, `description`, `mcpServers`, `contextFileName`, `excludeTools`, `settings`; commands are TOML under `commands/`, with a subdirectory becoming the `/<dir>:<name>` namespace; `gemini extensions install <path>` / `link` / `list`.

Projection: agents moved from `agents/wtfp/<role>.md` (zero loaded) to `agents/wtfp-<role>.md` with `kind: local` and no other keys. The last observed run was Gemini CLI 0.57.0 (`docs/COMPATIBILITY.md`), which reported skills and context but not agents; that is consistent with the nested layout having loaded nothing.

## GitHub Copilot CLI (unverified: `copilot` not installed)

The projection is the Claude-compatible plugin plus the repository `.github` projection and is unchanged in this round. The documentation fetch for the Copilot plugin format failed on this machine, so no new capability claim is made.

## Spec compliance

`vendors/plugin/plugin.json` and the Codex root `plugin.json` validate against `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`. The schema was fetched on 2026-09-09 and is byte-identical (sha256 `0a4aad95…`) to the vendored copy at `test/fixtures/agent-plugin-1.0.0.schema.json`, which `test/adapter-compiler.test.js` uses. The root schema allows `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`; host-specific data lives under reverse-domain keys in `extensions` (`ai.iowarp.clio`, `com.openai`).

Provenance: every generated file carries a `Generated by WTF-P adapter compiler v5 from protocol/<source>` banner naming its canonical source, and every envelope's `.wtfp-generated.json` records the SHA-256 of each generated path and a `sourceHash` over the whole envelope. The canonical bundle is `vendors/plugin`; each host envelope is a projection of the same `protocol/` sources by `bin/lib/adapter-compiler.js`.
