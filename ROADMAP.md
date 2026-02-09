# WTF-P Roadmap

Development direction for WTF-P. Community input welcome via [GitHub Discussions](https://github.com/akougkas/wtf-p/discussions).

---

## Completed: v0.5.0

**Focus:** Multi-Runtime Parity + GSD-Inspired Architecture

### Multi-Runtime Support
- [x] **Gemini CLI** — 36 TOML commands + 11 agents (`npx wtf-p --global --gemini`)
- [x] **OpenCode** — 36 Markdown commands + 11 agents (`npx wtf-p --global --opencode`)
- [x] MANIFEST-based installer with per-runtime file tracking
- [x] MANIFEST-based uninstaller for clean removal
- [x] Vendor-specific linting (VENDOR_RULES)

### Agent Architecture (adapted from GSD patterns)
- [x] 7 new specialized agents: section-planner, section-writer, section-reviewer, plan-checker, research-synthesizer, prose-polisher, argument-verifier
- [x] Thin orchestrator pattern: 11 commands refactored to spawn agents via Task()
- [x] Structured returns: COMPLETE / CHECKPOINT / BLOCKED for deterministic routing
- [x] Context fidelity: All agents honor CONTEXT.md locked decisions

### Quality Backbone
- [x] Plan-Check-Revise Loop: 7-dimension pre-write validation with up to 3 iterations
- [x] Goal-Backward Verification: Post-write argument/evidence checking
- [x] RESEARCH.md auto-integration in plan-section orchestrator

### Model Profiles & Parallelism
- [x] quality/balanced/budget profiles with 11-agent model matrix
- [x] Wave-based parallel section writing (wave/depends_on in PLAN.md)
- [x] Config extensions: model_profile, workflow toggles, parallelization settings

### Context Priming & Preferences
- [x] `bin/lib/context-primer.js` — Section-specific context extraction
- [x] `base-prefs.yaml` — Preference inheritance (global defaults + per-project overrides)
- [x] `bin/lib/checkpoint.js` — Git-tagged checkpoint save/restore/list
- [x] `/wtfp:quick` command — Minimal-ceremony tasks
- [x] `/wtfp:checkpoint` command — Save/restore/list paper state

### 8 New Commands
- [x] `verify-work`, `execute-outline`, `settings`, `add-todo`, `check-todos`, `update`, `audit-milestone`, `plan-milestone-gaps`

---

## Completed: v0.4.0

**Focus:** Citation Expert v2 — Deterministic, Plug-and-Play Citation Pipeline

### Architecture
- [x] Tiered Search Pipeline (Semantic Scholar + SerpAPI + CrossRef)
- [x] Impact Scoring Engine (citations, velocity, recency, venue)
- [x] Deduplication via universal keys (DOI, ScholarID)
- [x] Provenance Tracking (`wtfp_*` BibTeX fields)

### Libraries & Commands
- [x] `bin/lib/semantic-scholar.js` — S2 API wrapper
- [x] `bin/lib/scholar-lookup.js` — SerpAPI wrapper
- [x] `bin/lib/citation-ranker.js` — Ranking algorithm
- [x] `/wtfp:analyze-bib` — Impact analysis integration
- [x] `/wtfp:check-refs` — Auto-suggest missing citations
- [x] `/wtfp:research-gap` — Intent-aware search

---

## Completed: v0.3.0

**Focus:** The 4 P's + Multi-Vendor Architecture + Skills System

### The 4 P's
- [x] **P**aper — manuscripts, journal articles
- [x] **P**roposal — grants, funding applications
- [x] **P**resentation — conference talks, defense slides
- [x] **P**oster — conference posters, visual summaries

### Multi-Vendor Architecture
- [x] Restructured repo: `vendors/claude/`, `vendors/gemini/`, `vendors/opencode/` with shared `core/`

### Skills System (Claude Code)
- [x] `wtfp-marp` skill — Markdown+CSS → HTML/PDF via Marp CLI
- [x] `wtfp-echarts` skill — Data → publication-quality charts
- [x] Claude Code plugin manifest for marketplace

---

## Next: v0.6.0

**Focus:** Advanced Context & Visual Analysis

### Context Priming v2
- [ ] Load only relevant PROJECT.md sections per task
- [ ] Enable journal-scale papers (20–40 pages) without context overflow
- [ ] Per-project preference overrides (`.planning/prefs.yaml`)

### Visual Analysis (Multimodal)
- [ ] Figure critique with vision models
- [ ] Chart accessibility analysis
- [ ] Diagram-to-description generation

### Citation Network Visualization
- [ ] Graph of citing/cited papers
- [ ] Identify citation clusters and gaps visually
- [ ] Export to common graph formats

---

## Long-term Vision

### Extensibility Platform
- [ ] Plugin system for custom workflows
- [ ] Hook points for pre/post processing
- [ ] Custom agent definitions
- [ ] Workflow marketplace

### Research Lifecycle
- [ ] Experiment tracking integration
- [ ] Data pipeline documentation
- [ ] Reproducibility checklists
- [ ] Pre-registration support

### Publishing Pipeline
- [ ] Arxiv submission automation
- [ ] Journal format conversion
- [ ] Camera-ready preparation

---

## Community Wishlist

Ideas from users — contributions welcome!

| Feature | Complexity | Status |
|---------|------------|--------|
| Overleaf sync | Medium | Open |
| Zotero integration | Medium | Open |
| Grammarly-style suggestions | High | Open |
| Meeting notes → paper sections | Medium | Open |
| Code → methods section | Medium | Open |

---

## Design Principles

1. **Substance over ceremony** — No unnecessary files or process
2. **Speed through automation** — Minimize user round-trips
3. **Git as source of truth** — All state is version-controlled
4. **Graceful degradation** — Works with any model size (WCN mode)
5. **User control** — Always ask before destructive operations
6. **Vendor-agnostic core** — Support multiple AI coding tools
7. **Invisible assistant** — Do exactly what asked, no unsolicited suggestions
8. **Zero risk to user data** — All generated content to suggested.* files only
9. **Plug-and-play** — Works alongside existing citation managers, doesn't replace
10. **Confidence-gated autonomy** — Proceed if 80%+ confident, ask otherwise

---

## Anti-Features (Explicitly Excluded)

These will NOT be built, even if they seem useful:

| Feature | Rationale |
|---------|-----------|
| Real-time collaboration | Git handles merging. Too complex for CLI scope. |
| Local ML/NLP models | Offload intelligence to LLM, keep tools dumb and fast. |
| GUI/Web interface | CLI-only. Stay in the terminal. |
| Autonomous publishing | Human always in loop for external actions. |
| Persona evolution | "Invisible assistant" — no personality development. |
| Decision logging | Git commits are the decision log. No separate files. |

---

## Version History

| Version | Release | Focus |
|---------|---------|-------|
| v0.6.0 | Planned | Context priming v2, visual analysis, citation network visualization |
| v0.5.0 | Feb 2026 | Multi-runtime parity, GSD architecture, agents, quality loops |
| v0.4.0 | Jan 2026 | Citation Expert v2, tiered API, provenance tracking |
| v0.3.0 | Jan 2026 | 4 P's, skills, multi-vendor restructure |
| v0.2.0 | Jan 2026 | CLI improvements, contribution system |
| v0.1.0 | Jan 2026 | Initial public release |

---

## Research Sources

Analysis of external projects informed the agentic architecture:

| Project | Key Learnings | Adopted |
|---------|---------------|---------|
| [Helios-MCP](https://github.com/akougkas/helios-mcp) | Git-native memory, weighted preference inheritance | Preference inheritance (v0.5.0) |
| [cite-paper-mcp](https://github.com/akougkas/cite-paper-mcp) | Scholar ID anchoring, elicitation pattern, tiered APIs | Tiered search, provenance (v0.4.0) |
| [AWOC](https://github.com/akougkas/awoc) | Context priming, checkpoint bundles, handoff protocol | Context priming, checkpoints (v0.5.0) |
