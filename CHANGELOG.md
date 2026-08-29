# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0-rc.1] - 2026-08-29

Agent-platform modernization release candidate. WTF-P now has one portable academic protocol and deterministic native envelopes for seven coding-agent clients.

This entry describes the locally validated repository state; it does not assert npm or marketplace publication.

### Added

- **Clio Coder reference adapter** — self-contained extension with 36 namespaced prompts, 36 flat compatibility aliases, 11 strict agents, seven extension-bound skills, and two dependency-aware fleets
- **Codex, GitHub Copilot CLI, and Antigravity CLI support** alongside modernized Claude Code, OpenCode, and Gemini adapters
- **GitHub Copilot cloud projection** — generated, committed `.github` prompts, agents, skills, instructions, and portable protocol resources in addition to the native CLI plugin
- **Canonical protocol catalog** — 36 versioned action contracts describing reads, outputs, delegation, tools, effects, and approval boundaries
- **Seven standard Agent Skills** — focused packages for project setup, literature research, section planning, section writing, manuscript review, project management, and delivery
- **Portable specialist contracts** — 11 host-neutral roles with strict mutation or verifier result shapes
- **Portable `.planning` v1 protocol** — 11 JSON schemas, ten templates, and cross-record fixtures for project state, sources, evidence, decisions, outlines, sections, checkpoints, and validation results
- **Deterministic adapter compiler** — generates nine target/marketplace envelopes with provenance banners, cryptographic inventories, stale-output detection, and owned stale-file cleanup
- **Action-bound runtime context** — every generated command carries its exact action contract, relevant project schemas/templates, and a guarded native invocation-argument block
- **Explicit target grammar** — `wtfp install <clio|claude|codex|copilot|opencode|antigravity|gemini>` with compatibility flags retained
- **Seven-target isolated installer matrix** covering exact install, receipt, uninstall, sentinel preservation, environment-root resolution, and all-target overlap rejection
- **Versioned behavioral-evaluation layer** — 40 implicit routing cases, all 36 explicit actions, seven-client surface contracts, budgeted paid-matrix definitions, a ten-dimension semantic rubric, stable fixture/oracle hashes, independent planning validation, and fail-closed routing and lifecycle runners
- **Tool-execution ADR** — keeps contained transforms local, removes the unusable Claude-only MCP prototype, and defines executable gates for any future optional network MCP server

### Changed

- Host-neutral Markdown is now the sole workflow-prose source; all 36 client command projections are generated from it
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
- The obsolete, unregistered Claude research MCP prototype and its undeclared package contents are no longer shipped

### Validated

- Native Claude plugin, Codex plugin, Copilot external plugin, and Antigravity plugin validators
- Native install/list discovery for Claude 2.1.251, Codex 0.144.1, Copilot 1.0.80, Clio, OpenCode 1.18.16, Antigravity 1.1.22, and Gemini 0.57.0 under disposable profiles
- Real isolated Claude Sonnet 5/xhigh (8/8 rubric), Codex GPT-5.4/xhigh (8/8), and Clio GPT-5.6 Terra/xhigh evaluations: the historical compiler-v3 Clio run scored 7/8; the paid compiler-v4 rerun scored 8/8 and independently validated all five previewed records
- Clio Coder `v0.3.8` at merged commit `9b7b80cc`: effective package discovery reports 72 prompts (36 nested and 36 flat), 11 agents, seven skills, two fleets, and zero diagnostics; exact raw `$ARGUMENTS`, nested `state.json`, same-extension skill resolution, and reserved-builtin refusal were exercised
- Both generated Clio fleet contracts pass native `fleet validate` with the corrected `.planning/` and `paper/` directory boundaries and canonical `protocol/fleets/*.md` sources
- The first retained Clio 0.3.8 `dynamo/qwen3.8-27b` lifecycle reading is deliberately reported as blocked at `new-paper`: high effort timed out safely; effort-off produced five schema-valid records but attempted one denied shell call and created a 5,600/6,000 word-budget mismatch. No later lifecycle action or end-to-end fleet pass is claimed.
- Exact adapter parity: 36 actions, seven skills, and 11 specialist roles wherever the host exposes those resource types
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

[0.6.0-rc.1]: https://github.com/akougkas/wtf-p/compare/v0.5.0...v0.6.0-rc.1
[0.5.0]: https://github.com/akougkas/wtf-p/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/akougkas/wtf-p/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/akougkas/wtf-p/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/akougkas/wtf-p/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/akougkas/wtf-p/releases/tag/v0.1.0
