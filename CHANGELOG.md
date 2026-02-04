# Changelog

## [0.5.0] - 2026-02-04

**Theme:** GSD-Inspired Architectural Upgrade — Thin Orchestrators, Specialized Agents, Quality Loops

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

### Testing
- Agent file linting: validates frontmatter (name, description, allowed-tools), `<role>` tags, and structure for all 10 agents.

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
