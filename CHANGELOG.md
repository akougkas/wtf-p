# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.5.0]: https://github.com/akougkas/wtf-p/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/akougkas/wtf-p/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/akougkas/wtf-p/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/akougkas/wtf-p/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/akougkas/wtf-p/releases/tag/v0.1.0
