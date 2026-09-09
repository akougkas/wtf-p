# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0-rc.3] - 2026-09-09

Local release candidate. Not published to a registry and not tagged.

### Changed

- **Breaking for Clio.** WTF-P ships to Clio Coder only as an Agent Plugins 1.0.0
  package. The `vendors/clio` extension envelope, its `clio-coder-extension.yaml`
  manifest, the extension route in the installer, and the capability probe that
  chose between the two routes are removed. `vendors/plugin/` is the one canonical
  bundle for both Clio and the Claude marketplace projection, and its
  `compatibility.clio` floor is now `>=0.4.7`
- Clio installation delegates to the native plugin lifecycle: stage the canonical
  bundle, `clio-coder plugins install <staged-dir>`, verify with
  `clio-coder plugins inspect wtfp --json`, then publish the ownership receipt.
  Integrity, provenance, drift, and enable/disable are Clio's; WTF-P keeps only its
  exact-file receipt and safe replacement and removal
- Clio prompt bodies resolve packaged resources through `${pluginRoot}` instead of
  `${extensionRoot}`, and the flat `wtfp-<action>` prompt aliases are gone. Every
  action is invoked as `/wtfp:<action>` and nothing else
- `tool.execute` now means one thing: run a WTF-P-bundled tool through the single
  `tools/wtfp-tool.js` dispatcher. It is bound for Clio (`bash`) and Claude
  (`Bash`) and remains fail-closed elsewhere
- Adapter inventories are derived from canonical content instead of literal
  action, role, and skill counts

### Added

- The adapter compiler is a per-host factory. Claude Code gets an academic
  output style (`output-styles/wtfp-academic-writing.md`, selectable), a
  write-guard hook set (`hooks/hooks.json` plus `scripts/wtfp-write-guard.js`)
  that confines `Write`/`Edit` during `write-section`, `execute-outline`,
  `quick`, and `polish-prose` to `.planning/` and `paper/`, and agents that
  preload their bound plugin skill. Codex gets a portable root manifest with the
  `com.openai` overlay and eleven TOML custom agents that the installer publishes
  to `$CODEX_HOME/agents/`. OpenCode roles declare `mode: subagent` with verifier
  permissions. Antigravity gets a schema-conformant manifest, `subagent: true`
  agents, and a project-state rule. Gemini agents move to the flat `agents/`
  layout its loader reads, with the strict `kind: local` frontmatter. The Clio
  help prompt carries `display-only: true`
- `docs/HOST_CAPABILITIES.md`, the per-host capability matrix with the exact
  commands used as evidence and an explicit unverified mark for hosts whose CLI
  was not available
- `tools/wtfp-tool.js`, a bounded JSON dispatcher for the seven declared
  bibliography and citation tools, generated into every envelope and documented in
  `tools/README.md`. `list` prints each command's declared effects, and
  `--offline` or `WTFP_TOOL_OFFLINE=1` refuses any command whose effects include
  `network.*`. Symlinked bibliography files are read through their resolved
  target; file paths and queries carry separate caps; search queries are accepted
  only through `--query`
- The Clio installer resolves the configuration profile the way Clio does:
  `CLIO_CODER_CONFIG_DIR`, then `CLIO_CODER_HOME/config`, then the platform
  default (`${XDG_CONFIG_HOME:-~/.config}/clio-coder` on Linux)

### Fixed

- The Antigravity manifest carried `version`, `author`, `commands`, `agents`,
  and `skills` keys that the published v1 plugin schema rejects
  (`additionalProperties: false`), and the Gemini extension shipped agents under
  `agents/wtfp/`, a directory its loader never reads
- The installer's post-install hint told Codex users to run `/wtfp:help`, a
  command Codex does not have; it now names the skill selector
- Without `clio-coder` on PATH the installer told the operator to run
  `clio-coder plugins install` against the managed `plugins/wtfp` root, which Clio
  rejects as a source overlapping its destination. It now says to re-run the
  install once the binary is available
- Generated `.js` files carry a `//` banner instead of an HTML comment, so they
  also parse as ES modules
- `npx wtf-p uninstall --help` prints the uninstaller's help, `uninstall <target>`
  maps to the uninstaller's `--<target>` selector, and the installer help lists
  the uninstall flags
- `bib-format` emits standard BibTeX entry types by default (`@article`,
  `@inproceedings`, ...); the al-folio Jekyll projection is behind
  `--style=al-folio`. `wtfp_missing` now also reports a missing title or year
- `bib-index` flags repeated citation keys and refuses an ambiguous `--key`
- Network dispatcher commands enforce `--timeout=<seconds>` (default 20) with exit
  124, `bib-impact` reports progress on stderr, and `<command> --help` exits 0
- Executable bindings for `research-gap`, `analyze-bib`, and `check-refs` through
  that dispatcher; Clio's `network.search` resolves to the bundled scholarly-index
  clients, which are the only search these actions ever declared
- `protocol/templates/` authored-artifact scaffolds for manuscript outlines, grant
  proposal outlines, conference posters, and conference talks, bound from
  `new-paper`, `create-outline`, `create-poster`, and `create-slides`
- Generated Agent Plugins 1.0.0 packaging with conventional skills, a namespaced
  Clio component graph, and a standard Codex manifest alongside its fallback
- Native Clio plugin installation with exact receipts and compensating rollback
- A three-action research handoff guide and opt-in native user/project lifecycle test

### Fixed

- `create-outline`, `insert-section`, and `remove-section` now carry the exact
  outline-budget invariant that only `new-paper` stated, so no outline write can
  leave `word_target` out of balance with `target_words`
- `create-poster`, `create-slides`, and `export-latex` no longer claim a rendering
  or compilation effect they never had. They produce source and hand back an
  explicit author command, and are consequently available rather than fail-closed
- `help` names actions in the host's real `/wtfp:<action>` syntax and reports the
  actions the running adapter cannot execute
- Incremental mapping now declares existing source/evidence reads, updates,
  and manifest material/manuscript indexing while preserving curated records
- Outliner word budgets now match the exact total required by outline approval
- Claude agent definitions use native tools metadata; Clio role reports retain
  portable needs_input/blocked outcomes and main-agent decoding instructions
- Native receipts expose installed commands, skills, and agents in status
- Compiler v5 evaluation definitions bind current source while retained compiler-v4
  observations keep their original evidence and comparison baseline

### Documentation

- Reworked the public entry point around the human-guided scientist workflow,
  exact client invocation, durable pause/resume, and RC2's observed limits
- Added practical getting-started and proposal guides for operators and agents,
  including a supplied-material NSF 25-531 walkthrough
- Made prerelease management commands select the package explicitly so an
  installed v0.5 executable cannot shadow RC2, and corrected migration,
  native-discovery, existing-project, and release-status guidance

## [0.6.0-rc.2] - 2026-08-29

Corrective release candidate for decision fidelity and durable lifecycle handling. This release does not claim a completed proposal lifecycle or improved writing quality.

### Fixed

- `create-outline` may supersede a deferred choice only from an explicit author answer; it preserves locked and unrelated decisions and appends a fresh locked replacement with provenance
- `plan-section` requires exactly one current passing `create-outline` validation and independently checks locked and deferred decision consistency before specialist dispatch
- `write-section` now reconciles project records only from a measured persisted manuscript, a present non-empty summary, and a persisted validation rather than worker self-report
- `review-section` bounds malformed-result retries, preserves accepted warning debt, uses only the closed validation schema, and cannot mutate project state or invent a paused phase
- `pause-writing` preserves the valid lifecycle phase while setting only `state.status` to `paused`
- `resume-writing` requires direct current-invocation reads, a host-native author gate, fail-closed no-mutation behavior before selection, and schema-valid checkpoint/state readback before reporting success
- Clio verifier recipes now require compact JSON-only results with bounded, non-duplicate checks

### Validated

- A monitored disposable mixed-autonomy Clio Coder 0.3.8 / Dynamo `qwen3.8-27b-dynamo` / thinking-off defect-finding UAT used supervised `suggest` through outline/plan, then `full-auto` for write/review/pause and the later resume/progress; it continued one section before the final RC2 write/review/pause hardening
- The provisional section's persisted writer/state count was 1,019 whitespace-delimited words; the independent reviewer used a different tokenizer and reported 1,026. Write and review validations retained explicit warning debt; the durable handoff/checkpoint remained coherent; and all 25 portable JSON records passed independent schema validation
- A genuinely fresh-process pre-hardening resume attempt failed by narrating tools it never called. Against the regenerated RC2 bundle, a new process read the durable records, invoked Clio's real `ask_user` interview, waited for the author selection, resolved the checkpoint, advanced state to revision 7/active while preserving phase `reviewing`, and read both records back. Independent schema validation passed 25/25; a following `progress` action was read-only and identified wave-2 planning as the next action.

### Known limitations

- `research-gap` remains adapter-unavailable because current adapters lack an exact `tool.execute` binding. No external literature was supplied or mapped in this toy UAT; the draft has zero citations, and authorized placeholders are not research evidence.
- This is one-section process-discipline evidence, not a completed seven-section proposal, paid lifecycle, observed semantic baseline, submission-ready artifact, or controlled writing-quality result.
- The final RC2 write/review/pause corrections have deterministic regression coverage but were not followed by a second end-to-end model rerun; only corrected resume/progress was rerun against the regenerated bundle.
- The exploratory mixed-autonomy run is not a safety certification: its `full-auto` phases used read-only shell helpers, inherited Clio's session tool surface, retained a pre-existing future pause timestamp that makes resume-time ordering imperfect, and its final progress prose misstated two passed plus two `issues-found` validation files as “4 of 6 passed.” The portable records themselves remained schema-valid.

## [0.6.0-rc.1] - 2026-08-29

Agent-platform modernization release candidate. WTF-P now has one portable academic protocol and deterministic native envelopes for seven coding-agent clients.

This entry describes the locally validated repository state; it does not assert npm or marketplace publication.

### Added

- **Clio Coder reference adapter** — self-contained extension with 36 namespaced prompts, 36 flat compatibility aliases, 11 strict agents, seven extension-bound skills, and two dependency-aware fleets; 24 semantic actions are adapter-available and the other 12 have nested and flat fail-closed aliases
- **Codex, GitHub Copilot CLI, and Antigravity CLI support** alongside modernized Claude Code, OpenCode, and Gemini adapters
- **GitHub Copilot cloud projection** — generated, committed `.github` prompts, agents, skills, instructions, and portable protocol resources in addition to the native CLI plugin; five actions are adapter-available and 31 fail closed until exact capability and approval bindings exist
- **Canonical protocol catalog** — 36 versioned action contracts describing reads, outputs, delegation, tools, effects, and approval boundaries
- **Seven standard Agent Skills** — focused packages for project setup, literature research, section planning, section writing, manuscript review, project management, and delivery
- **Portable specialist contracts** — 11 host-neutral roles with strict mutation or verifier result shapes
- **Portable `.planning` v1 protocol** — 11 JSON schemas, ten templates, and cross-record fixtures for project state, sources, evidence, decisions, outlines, sections, checkpoints, and validation results
- **Deterministic adapter compiler** — generates nine target/marketplace envelopes with provenance banners, cryptographic inventories, stale-output detection, and owned stale-file cleanup
- **Action-bound runtime context** — every generated command carries its exact action contract, relevant project schemas/templates, and a guarded native invocation-argument block
- **Explicit target grammar** — `wtfp install <clio|claude|codex|copilot|opencode|antigravity|gemini>` with compatibility flags retained
- **Seven-target isolated installer matrix** covering exact install, receipt, uninstall, sentinel preservation, environment-root resolution, and all-target overlap rejection
- **Versioned behavioral-evaluation layer** — 40 implicit routing cases, all 36 explicit actions, three primary-client routing surface contracts, authenticated identities for all nine generated envelopes, budgeted paid-matrix definitions, a ten-dimension semantic rubric, stable fixture/oracle hashes, independent planning validation, and fail-closed routing and lifecycle runners
- **Tool-execution ADR** — keeps transforms local, removes the unusable Claude-only MCP prototype, withholds unrestricted shell grants for logical tools, and defines executable gates for any future autonomous binding or optional network MCP server

### Changed

- Host-neutral Markdown is now the sole workflow-prose source; all 36 client command projections are generated from it
- The adapter compiler now fails closed when a canonical capability, semantic effect, or approval gate lacks an exact target binding. Every target receives a machine-readable `wtfp.action-availability/v1` manifest; unavailable routes emit deterministic `WTFP_ACTION_UNAVAILABLE` stubs without the normal workflow, arguments, or tools. Seven local/plugin projections mark 24/36 actions adapter-available; the GitHub Copilot cloud projection marks 5/36 because it has no exact explicit-approval binding.
- Clio action availability now records that 0.3.8 slash prompts inherit the host session tool surface rather than enforcing a per-prompt allowlist. Read-only previews or supervised `suggest` autonomy are required for behavioral certification, and any undeclared tool call fails the gate. The two native fleets are documented as explicit `fleet run` primitives, not implicit `/wtfp:*` routing.
- Concrete vendor model names and host-specific delegation syntax were removed from canonical workflows
- Each generated adapter is self-contained and carries the canonical protocol, skills, roles, project schemas, tools, and source inventory
- Claude commands now use a dual plugin/marketplace envelope and expose exact `/wtfp:<action>` names without redundant namespace segments
- OpenCode and Gemini commands embed static protocol resources when the host has no reliable prompt-time plugin-root variable
- Clio installation performs an isolated, credential-free extension capability probe and retains flat-prompt/skill compatibility with a warning when a legacy client lacks the full resource surface
- Host tool bundles contain only seven declared bibliography/citation implementations at URI-derived paths; installer internals and legacy Git-backed checkpoint code are excluded
- Tool metadata now reports network and clock effects truthfully; repeatable local ranking and formatting tests receive an explicit reference date
- The package now targets Node.js 20 or newer
- Noninteractive installation requires an explicit target or scope
- WCN remains as a legacy compatibility artifact but is no longer a canonical workflow source or selectable runtime mode

### Security

- Added import-safe CLIs, dangerous-root and symlink containment checks, source/destination race detection, and atomic file publication
- Added v2 exact-file ownership receipts with SHA-256 hashes; skipped files can no longer become owned implicitly
- Ownership receipts now identify adapter contract v1 and generator v4 instead of reporting stale generator metadata
- Added transactional rollback, receipt-race detection, modified-file preservation, and non-recursive uninstall cleanup
- Native marketplace/plugin activation now uses compensating rollback, including cleanup when registration succeeds but a later install or verification step fails
- A bundle with preserved conflict files remains receipted as partial and is never newly registered with a native client
- Added adversarial fault-injection coverage for symlink swaps, concurrent edits, malformed receipts, traversal, and overlapping target roots
- Clio fleet write boundaries now name `.planning/` and `paper/` as directories; the previous bare names authorized literal files and caused real nested worker output to be rolled back
- Canonical Clio fleet steps now declare only their bound roles' semantic write scopes: plan artifacts for `section-planner`, and manuscript plus execution-summary artifacts for `section-writer`; generated instructions reserve action-level approval and project-state reconciliation to the orchestrator, while Clio's native enforcement remains directory-granular
- `map-project` no longer misdeclares optional bibliography parsing as a required `tool.execute` effect; it remains available through contained project reads and records unsupported structured formats rather than substituting a shell command
- The obsolete, unregistered Claude research MCP prototype and its undeclared package contents are no longer shipped
- Removed the obsolete, unowned Claude `wtfp-marp` and `wtfp-echarts` skills and the stale Marp peer dependency; the archive now excludes their legacy namespace so it cannot bypass the authenticated seven-skill inventory

### Validated

- Native Claude plugin, Codex plugin, Copilot external plugin, and Antigravity plugin validators
- Native install/list discovery for Claude 2.1.251, Codex 0.144.1, Copilot 1.0.80, Clio, OpenCode 1.18.16, Antigravity 1.1.22, and Gemini 0.57.0 under disposable profiles
- Real isolated Claude Sonnet 5/xhigh (8/8 rubric), Codex GPT-5.4/xhigh (8/8), and Clio GPT-5.6 Terra/xhigh evaluations: the historical compiler-v3 Clio run scored 7/8; the paid compiler-v4 rerun scored 8/8 and independently validated all five previewed records. Claude/Codex raw packs are no longer retained and those two historical observations are not independently replayable from this tree; the Clio v4 pack is checked in and executable.
- Clio Coder `v0.3.8` at merged commit `9b7b80cc`: effective package discovery reports 72 prompts (36 nested and 36 flat), 11 agents, seven skills, two fleets, and zero diagnostics; exact raw `$ARGUMENTS`, nested `state.json`, same-extension skill resolution, and reserved-builtin refusal were exercised
- Both generated Clio fleet contracts pass native `fleet validate` with the corrected `.planning/` and `paper/` directory boundaries and canonical `protocol/fleets/*.json` sources
- The first retained Clio 0.3.8 `dynamo/qwen3.8-27b` lifecycle reading is deliberately reported as blocked at `new-paper`: high effort timed out safely; effort-off produced five schema-valid records but attempted one denied shell call and created a 5,600/6,000 word-budget mismatch. It binds earlier WTF-P source `6b58b298`, predates the current remediation, and is not a current-RC behavioral reading. No later lifecycle action or end-to-end fleet pass is claimed.
- Post-remediation local readings remain non-passing: exact `new-paper` arguments at `0245818` led to an agent-discovery loop and zero records; the `b4f0543` plan fleet completed only structurally; and the `cbba38c` draft fleet verified the corrected `paper/` projection but failed the approved-plan, state-reconciliation, and word-budget invariants. Raw traces and ledgers are retained without promoting them to a baseline.
- A final current-source `bf50e23` Dynamo reading created five literal schema-valid initialization records, but failed a cross-record dependency-wave invariant and the explicit no-shell boundary: three shell calls succeeded and ten retries were denied. The campaign stopped before `map-project`, has no terminal receipt, and is retained as blocked evidence rather than a lifecycle result.
- Exact catalog and discovery parity: all applicable adapters project 36 stable action IDs, seven skills, and 11 specialist roles. Adapter availability is target-specific: 24/36 on Clio, Claude, Codex, Copilot CLI, OpenCode, Antigravity, and Gemini; 5/36 on the Copilot cloud projection. These counts do not replace host enforcement or model-behavior evidence.
- Canonical workflow portability, standard-skill validation, project-schema conformance, reproducible generation, and legacy regression suites

## [0.5.0] - 2026-02-09

Multi-runtime parity release. 36 commands and 11 specialized agents now run on Claude Code, Gemini CLI, and OpenCode. Architecture overhauled with GSD-inspired thin orchestrators, quality loops, and model profiles.

### Added

- **Gemini CLI support** — 36 TOML-format commands + 11 agents, installable via `npx wtf-p --global --gemini`
- **OpenCode support** — 36 Markdown commands + 11 agents, installable via `npx wtf-p --global --opencode`
- **MANIFEST-based installer** — Tracks installed files per runtime for clean uninstall/upgrade
- **7 specialized agents** — section-planner, section-writer, section-reviewer, plan-checker, research-synthesizer, prose-polisher, argument-verifier
- **Plan-Check-Revise loop** — Pre-write validation across 7 dimensions (argument coverage, citation coverage, word budget, outline compliance, context fidelity, style consistency, task completeness) with up to 3 revision iterations
- **Goal-backward verification** — Post-write argument-verifier checks claims vs. plan, evidence presented, and word count targets
- **Model profiles** — `quality` / `balanced` / `budget` profiles route 11 agents to appropriate models (opus/sonnet/haiku) via `config.json`
- **Wave-based parallel writing** — `wave` and `depends_on` in section plans enable parallel execution of independent sections
- **8 new commands** — `verify-work`, `execute-outline`, `settings`, `add-todo`, `check-todos`, `update`, `audit-milestone`, `plan-milestone-gaps`
- **Context primer** (`bin/lib/context-primer.js`) — Section-specific context extraction for journal-scale papers
- **Preference inheritance** (`base-prefs.yaml`) — Global style/citation defaults with per-project overrides
- **Checkpoint system** (`bin/lib/checkpoint.js`) — Git-tagged checkpoint save/restore/list
- **`/wtfp:quick` command** — Minimal-ceremony writing for quick tasks
- **`/wtfp:checkpoint` command** — Save, restore, and list paper state checkpoints
- **Config extensions** — `model_profile`, `workflow.research`, `workflow.plan_check`, `workflow.verifier`, `parallelization.enabled`, `parallelization.max_concurrent_agents`
- **Reference docs** — `agent-model-matrix.md`, `orchestrator-pattern.md`, `context-fidelity.md`

### Changed

- **Thin orchestrator architecture** — Refactored 11 commands from monolithic implementations to thin orchestrators that spawn specialized agents via `Task()`. Total: 2,480 → 1,141 lines (54% reduction)
- **help.md** updated with all 36 commands
- **Installer** rewritten around `MANIFEST` object with per-runtime component definitions
- **Uninstaller** now uses MANIFEST for per-runtime file tracking

### Fixed

- `preflight.js` template path resolution
- `create-outline.wcn.md` step name (`git_commit` → `git_commit_initialization`)
- Dual installation (global + local) conflict detection and warning
- 5 install/uninstall edge cases found via E2E testing

## [0.4.0] - 2026-01-13

Citation Expert v2 — deterministic, plug-and-play citation pipeline with tiered API search and impact scoring.

### Added

- **Tiered search pipeline** — Semantic Scholar (primary), SerpAPI/Google Scholar (seminal), CrossRef (fallback)
- **Impact scoring engine** — Automated ranking by citation count, velocity, recency, and venue prestige
- **Provenance tracking** — BibTeX entries include `wtfp_*` fields for source, impact metrics, and verification status
- **Intent-aware search** — `/wtfp:research-gap` supports `--intent=seminal|recent|specific`
- **Auto-suggest** — `/wtfp:check-refs` suggests tiered API replacements for missing citations

### Changed

- `/wtfp:analyze-bib` — Added automated impact analysis and seminal work identification
- `bib-index` and `bib-format` — Refactored for large-scale bibliography management

## [0.3.0] - 2026-01-12

The 4 P's — expanded from papers to proposals, presentations, and posters. Multi-vendor repo structure and skills system.

### Added

- **Poster workflow** — `/wtfp:create-poster` with HTML/CSS academic poster template
- **Slides workflow** — `/wtfp:create-slides` with Marp presentation template
- **Skills system** (Claude Code) — `wtfp-marp` (Markdown → HTML/PDF) and `wtfp-echarts` (data → charts)
- **Plugin manifest** for Claude Code marketplace
- **Multi-vendor repo structure** — `vendors/claude/`, `vendors/gemini/`, `vendors/opencode/` with shared `core/`

## [0.2.0] - 2026-01-11

CLI improvements and contribution system.

### Added

- `/wtfp:report-bug`, `/wtfp:request-feature`, `/wtfp:contribute` commands
- Improved installer with conflict resolution and backup support

## [0.1.0] - 2026-01-11

Initial public release.

### Added

- 21 slash commands for paper lifecycle management
- 5 venue templates (ACM-CS, IEEE-CS, arXiv-ML, Nature, Thesis)
- WCN compressed workflows (35–50% token savings)
- Subagent architecture for section isolation
- BibTeX integration and citation management
- Git-based version control for drafts
- `npx wtf-p` interactive installer with `--global`, `--local`, `--config-dir` options

[Unreleased]: https://github.com/akougkas/wtf-p/compare/v0.6.0-rc.3...HEAD
[0.6.0-rc.3]: https://github.com/akougkas/wtf-p/compare/v0.6.0-rc.2...v0.6.0-rc.3
[0.6.0-rc.2]: https://github.com/akougkas/wtf-p/compare/v0.6.0-rc.1...v0.6.0-rc.2
[0.6.0-rc.1]: https://github.com/akougkas/wtf-p/compare/v0.5.0...v0.6.0-rc.1
[0.5.0]: https://github.com/akougkas/wtf-p/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/akougkas/wtf-p/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/akougkas/wtf-p/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/akougkas/wtf-p/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/akougkas/wtf-p/releases/tag/v0.1.0
