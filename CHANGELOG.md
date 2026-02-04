# Changelog

## [0.5.0] - 2026-02-04

**Theme:** GSD-Inspired Architectural Upgrade — Thin Orchestrators, Specialized Agents, Quality Loops, Multi-Runtime Support

### Multi-Runtime Support
- **Claude Code**: Full support (default) — `~/.claude/` directory.
- **Gemini CLI**: Full support — `~/.config/gemini/` directory. No `allowed-tools` frontmatter (tools available by default).
- **OpenCode**: Full support — `~/.opencode/` directory.
- **Runtime-agnostic installer**: `--gemini` and `--opencode` flags for alternate runtimes.
- **MANIFEST-based uninstaller**: Tracks installed files per runtime for clean removal.
- **VENDOR_RULES**: Vendor-specific linting (Claude requires allowed-tools; others don't).

### Architecture
- **Thin Orchestrator Pattern**: Refactored 5 core commands (plan-section, write-section, review-section, research-gap, polish-prose) from thick monoliths (200-410 lines) to thin orchestrators (120-180 lines) that spawn specialized agents via Task().
- **7 New Specialized Agents**: section-planner, section-writer, section-reviewer, plan-checker, research-synthesizer, prose-polisher, argument-verifier — each with structured returns and context fidelity.
- **Model Profiles**: quality/balanced/budget profiles route 10 agents to appropriate models (opus/sonnet/haiku) via config.json `model_profile` setting.
- **Wave-Based Parallelism**: Section plans include `wave` and `depends_on` frontmatter for parallel writing of independent sections.

### Quality Backbone
- **Plan-Check-Revise Loop**: Pre-write validation with 7 dimensions (argument coverage, citation coverage, word budget, outline compliance, CONTEXT.md fidelity, style consistency, task completeness). Up to 3 revision iterations.
- **Goal-Backward Verification**: Post-write argument-verifier checks claims made vs planned, evidence presented, anti-patterns, and word count against targets.
- **CONTEXT.md Fidelity**: All agents honor locked decisions, exclude deferred ideas, and exercise discretion areas. Orchestrators inline CONTEXT.md into every agent spawn.

### Config Extensions (backward-compatible)
- `model_profile`: "quality" | "balanced" | "budget" (default: "balanced")
- `workflow.research`: Enable/disable research phase (default: true)
- `workflow.plan_check`: Enable/disable plan verification (default: true)
- `workflow.verifier`: Enable/disable post-write verification (default: true)
- `parallelization.enabled`: Enable parallel section writing (default: false)
- `parallelization.max_concurrent_agents`: Limit concurrent spawns (default: 3)

### Secondary Command Refactors
- **6 commands refactored** to thin orchestrators: new-paper, progress, create-outline, analyze-bib, check-refs, map-project — 1719 → 761 lines (56% reduction).
- Added `BLOCKED` return handling to polish-prose, analyze-bib, check-refs.

### New Commands (8)
- **`/wtfp:verify-work`**: Acceptance testing with UAT.md persistence across /clear.
- **`/wtfp:execute-outline`**: Wave-based parallel execution of all sections with coherence-checker.
- **`/wtfp:settings`**: Interactive config editor with diff display.
- **`/wtfp:add-todo`**: Quick-capture todos without breaking flow.
- **`/wtfp:check-todos`**: Review pending todos (act/defer/dismiss/done).
- **`/wtfp:update`**: Check npm registry and update WTF-P.
- **`/wtfp:audit-milestone`**: Pre-submission audit (5 checks: sections, arguments, words, citations, reviews).
- **`/wtfp:plan-milestone-gaps`**: Create targeted fix plans from audit findings.

### New Features
- **`bin/lib/context-primer.js`**: Section-specific context extraction for journal-scale papers without context overflow.
- **`core/write-the-f-paper/templates/base-prefs.yaml`**: Preference inheritance — global style/citation defaults with per-project overrides.
- **`bin/lib/checkpoint.js`**: Git-tagged checkpoint save/restore/list for mid-session paper state.
- **`/wtfp:quick`**: Minimal-ceremony command for quick writing tasks that skip optional agents.
- **`/wtfp:checkpoint`**: Save, restore, and list paper state checkpoints.

### Workflow Documentation
- Updated `plan-section.wcn.md` — agent spawning, model_profile, plan-check-revise loop.
- Updated `execute-section.wcn.md` — agent spawning, model_profile, goal-backward verification.
- Created `references/agent-model-matrix.md` — 10 agents × 3 profiles mapping.
- Created `references/orchestrator-pattern.md` — thin orchestrator design reference.
- Created `references/context-fidelity.md` — CONTEXT.md contract for all agents.

### Fixes
- Updated `help.md` with all 38 commands.
- Fixed `preflight.js` template path bug.
- Fixed `create-outline.wcn.md` step name (`git_commit` → `git_commit_initialization`).

### Testing
- Agent file linting: validates frontmatter (name, description, allowed-tools), `<role>` tags, and structure for all 10 agents.
- **WCN integrity suite** (63 tests): validates compressed workflows preserve all steps, handles plan-section/execute-section as intentional restructures.
- **Dry-run suite** (92 tests): validates orchestrator wiring across 8 dimensions — agent resolution, command→agent refs, model profiles, config gates, CONTEXT.md loading, Task() spawning, structured returns.
- **Feature tests** (114 tests): validates installer, commands, multi-runtime support.
- **646 total tests passing** (sanity + paths + linter + wcn-integrity + dry-run + features + installer).

## [0.4.0] - 2026-01-13

**Theme:** Citation Expert v2 — Deterministic, Plug-and-Play Citation Pipeline

### Features
- **Tiered Search Pipeline**: Integrated Semantic Scholar (Primary), SerpAPI Google Scholar (Seminal), and CrossRef (Fallback).
- **Impact Scoring Engine**: Automated ranking of papers by citation count, velocity (citations/month), recency, and venue prestige.
- **Provenance Tracking**: BibTeX entries now include `wtfp_*` fields for tracking source, impact metrics, and verification status.
- **BibTeX Optimization**: `bib-index` and `bib-format` refactored for large-scale bibliography management without context limits.
- **Enhanced Commands**:
  - `/wtfp:analyze-bib`: Added automated impact analysis and seminal work identification.
  - `/wtfp:check-refs`: Added tiered API auto-suggestions for missing citations.
  - `/wtfp:research-gap`: Added intent-aware search (`--intent=seminal|recent|specific`).

### [0.1.0] - 2026-01-11

Initial public release.

### Features
- Complete meta-prompting system for academic paper writing
- 21 slash commands for paper lifecycle management
- 5 venue templates (ACM-CS, IEEE-CS, arXiv-ML, Nature, Thesis)
- WCN compressed workflows (35-50% token savings)
- Subagent architecture for section isolation
- BibTeX integration and citation management
- Git-based version control for drafts

### Install Options
- `npx wtfp` - interactive installer
- `npx wtfp --global` - install to ~/.claude/
- `npx wtfp --local` - install to ./.claude/
- `npx wtfp --config-dir <path>` - custom config directory
