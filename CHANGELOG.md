# Changelog

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
