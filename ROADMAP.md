# WTF-P Roadmap

Development direction for WTF-P. Community input welcome via [GitHub Discussions](https://github.com/akougkas/wtf-p/discussions).

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
WTF-P expanded to cover the full academic output spectrum:
- **P**aper — manuscripts, journal articles
- **P**roposal — grants, funding applications
- **P**resentation — conference talks, defense slides
- **P**oster — conference posters, visual summaries

### Multi-Vendor Architecture
Restructured repository for support of multiple AI coding tools:
```
wtf-p/
├── core/                    # Vendor-agnostic content
│   └── write-the-f-paper/
├── vendors/
│   ├── claude/              # Claude Code (current)
│   ├── gemini/              # Future
│   └── opencode/            # Future
└── bin/                     # Cross-vendor installer
```

### Skills System (Claude Code)
- [x] `wtfp-marp` skill — Markdown+CSS → HTML/PDF via Marp CLI
- [x] `wtfp-echarts` skill — Data → publication-quality charts
- [x] Claude Code plugin manifest for marketplace

### New Commands
- [x] `/wtfp:create-poster` — Full poster creation workflow
- [x] `/wtfp:create-slides` — Presentation deck workflow

### Templates
- [x] Academic poster template (HTML/CSS)
- [x] Presentation slide template (Marp)
- [x] Chart examples for common academic visualizations

---

## Completed: v0.5.0

**Focus:** GSD-Inspired Architectural Upgrade — Thin Orchestrators, Specialized Agents, Quality Loops

### Agent Architecture (adapted from GSD patterns)
- [x] 7 new specialized agents: section-planner, section-writer, section-reviewer, plan-checker, research-synthesizer, prose-polisher, argument-verifier
- [x] Thin orchestrator pattern: 5 core commands refactored to spawn agents via Task()
- [x] Structured returns: COMPLETE / CHECKPOINT / BLOCKED for deterministic routing
- [x] Context fidelity: All agents honor CONTEXT.md locked decisions

### Quality Backbone
- [x] Plan-Check-Revise Loop: 7-dimension pre-write validation with up to 3 iterations
- [x] Goal-Backward Verification: Post-write argument/evidence checking
- [x] RESEARCH.md auto-integration in plan-section orchestrator

### Model Profiles & Parallelism
- [x] quality/balanced/budget profiles with 10-agent model matrix
- [x] Wave-based parallel section writing (wave/depends_on in PLAN.md)
- [x] Config extensions: model_profile, workflow toggles, parallelization settings

### Secondary Command Refactors
- [x] 6 commands refactored to thin orchestrators: new-paper, progress, create-outline, analyze-bib, check-refs, map-project (1719 → 761 lines, 56% reduction)
- [x] `BLOCKED` return handling for polish-prose, analyze-bib, check-refs

### Context Priming & Preferences (pulled forward from v0.6.0)
- [x] `bin/lib/context-primer.js` — Section-specific context extraction
- [x] `core/write-the-f-paper/templates/base-prefs.yaml` — Preference inheritance
- [x] `bin/lib/checkpoint.js` — Git-tagged checkpoint save/restore/list
- [x] `/wtfp:quick` command — Minimal-ceremony tasks
- [x] `/wtfp:checkpoint` command — Save/restore/list paper state

### Reference Documentation
- [x] `references/agent-model-matrix.md` — 10 agents × 3 profiles
- [x] `references/orchestrator-pattern.md` — Thin orchestrator design reference
- [x] `references/context-fidelity.md` — CONTEXT.md contract for all agents
- [x] Updated `help.md` with 7 missing commands, fixed `preflight.js` template path

### Testing
- [x] WCN integrity suite (63 tests) — compressed workflow step preservation
- [x] Dry-run suite (92 tests) — orchestrator wiring across 8 dimensions
- [x] 256 total tests passing

---

## Current: v0.6.0

**Focus:** Multi-vendor Support & Visualization

### Gemini Support
- [ ] `vendors/gemini/` adapter
- [ ] Gemini-specific command translations

### Context Priming v2
- [ ] Load only relevant PROJECT.md sections per task
- [ ] Enable journal-scale papers (20-40 pages) without context overflow
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
| v0.6.0 | Planned | Multi-vendor support, visualization, context priming v2 |
| v0.5.0 | Published | GSD architecture, agents, quality loops, model profiles |
| v0.4.0 | Published | Citation Expert v2, tiered API, provenance tracking |
| v0.3.0 | Published | 4 P's, skills, multi-vendor restructure |
| v0.2.0 | Jan 2025 | CLI improvements, contribution system |
| v0.1.0 | Jan 2025 | Initial public release |

---

## Research Sources (v0.4.0+ Design)

Analysis of external projects informed the agentic architecture:

| Project | Key Learnings | Adopted |
|---------|---------------|---------|
| [Helios-MCP](https://github.com/akougkas/helios-mcp) | Git-native memory, weighted preference inheritance | Preference inheritance (v0.5.0) |
| [cite-paper-mcp](https://github.com/akougkas/cite-paper-mcp) | Scholar ID anchoring, elicitation pattern, tiered APIs | Tiered search, provenance (v0.4.0) |
| [AWOC](https://github.com/akougkas/awoc) | Context priming, checkpoint bundles, handoff protocol | Context priming, checkpoints (v0.5.0) |

See [`agentic-integration-report.md`](agentic-integration-report.md) and [`planning/CITATION-EXPERT-V2-SPEC.md`](planning/CITATION-EXPERT-V2-SPEC.md) for full analysis.