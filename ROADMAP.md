# WTF-P Roadmap

Development direction for WTF-P. Community input welcome via [GitHub Discussions](https://github.com/akougkas/wtf-p/discussions).

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

## Current: v0.4.0

**Focus:** Citation Expert v2 — Deterministic, Plug-and-Play Citation Pipeline

> Full spec: [`planning/CITATION-EXPERT-V2-SPEC.md`](planning/CITATION-EXPERT-V2-SPEC.md)

### Design Decisions (Jan 2026 Session)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Personality | Invisible assistant | Do exactly what asked, no unsolicited suggestions |
| Risk tolerance | Zero | All outputs to suggested.bib, never touch user's .bib |
| API strategy | Tiered (free + paid) | Semantic Scholar free, SerpAPI for seminal queries |
| Integration | Enhanced commands | Modify existing /wtfp:* commands |
| Autonomy | Confidence-gated (80%) | Proceed if confident, ask otherwise |

### Citation Expert v2 Architecture

```
User Query → Query Understanding → Tiered Search Pipeline
                                        ├── Semantic Scholar (free, always)
                                        ├── SerpAPI/Scholar (paid, if seminal)
                                        └── CrossRef (fallback)
                                              ↓
                                        Deduplication (DOI/ScholarID key)
                                              ↓
                                        Ranking (impact, velocity, recency)
                                              ↓
                                        suggested.bib (NEVER user's .bib)
```

### New Libraries
- [ ] `bin/lib/semantic-scholar.js` — Free API wrapper, exponential backoff
- [ ] `bin/lib/scholar-lookup.js` — SerpAPI wrapper (optional, paid)
- [ ] `bin/lib/citation-ranker.js` — Impact-based ranking algorithm
- [ ] Enhanced `bin/lib/citation-fetcher.js` — Tiered orchestration
- [ ] Enhanced `bin/lib/bib-format.js` — Provenance fields (wtfp_*)

### Enhanced Commands
- [ ] `/wtfp:analyze-bib` — Add impact analysis (seminal, rising, outdated)
- [ ] `/wtfp:check-refs` — Auto-suggest missing citations from tiered API
- [ ] `/wtfp:research-gap` — Intent-aware search (seminal/recent/specific)

### Provenance Tracking
New BibTeX fields for machine-readable metadata:
```bibtex
wtfp_status = {official|verified|partial}
wtfp_source = {semantic_scholar+crossref|serpapi|...}
wtfp_citations = {85000}
wtfp_velocity = {1200}
wtfp_scholar_id = {TQgYirikUcIC}
wtfp_fetched = {2026-01-13}
```

### Success Metrics
| Metric | Target |
|--------|--------|
| API response time | < 2s per lookup |
| Deduplication accuracy | 95% |
| False positive rate | < 5% |
| suggested.bib validity | 100% (compiles) |

---

## Planned: v0.5.0

**Focus:** Agentic Context & Memory (Deferred from v0.4.0 Session)

> These features were identified during the Jan 2026 analysis of Helios-MCP,
> cite-paper-mcp, and AWOC projects. Deferred to focus v0.4.0 on citations only.

### Context Priming Engine (from AWOC)
- [ ] `bin/lib/context-primer.js` — Section-specific context extraction
- [ ] Load only relevant PROJECT.md sections for each task
- [ ] Enable journal-scale papers (20-40 pages) without context overflow
- [ ] `--full-context` flag for user-triggered complete load
- [ ] Target: 500 tokens per section vs 5000 tokens full dump

### Preference Inheritance (from Helios-MCP)
- [ ] `~/.wtfp/base.yaml` — Global user preferences (style, citation habits)
- [ ] `.planning/prefs.yaml` — Per-project overrides
- [ ] Helios-style weighted merge (base + project)
- [ ] Track: citation density, voice preference, formatting conventions
- [ ] Git-versioned preference evolution

### Checkpoint Bundles (from AWOC)
- [ ] `/wtfp:checkpoint` — Save full paper state mid-session
- [ ] `.planning/checkpoints/YYYY-MM-DD-HH-MM.json` format
- [ ] Capture: section progress, citations added, key decisions, git status
- [ ] Resume in new session with full context restoration
- [ ] Enable multi-week paper writing without state loss

### Domain Citation Memory
- [ ] `.planning/sources/domain-memory.yaml` — Learned citation clusters
- [ ] Cross-session: remember key papers for familiar domains
- [ ] Auto-populate from citation patterns
- [ ] Suggest known citations before searching APIs

### Semantic Git Commits
- [ ] Enhanced commit messages: `refs: [action] [target]`
- [ ] Enable `git log --grep="refs:"` for citation archaeology
- [ ] Track: analyzed, learned, fixed, audited actions

---

## Planned: v0.6.0+

**Focus:** Multi-vendor and Visualization

### Gemini Support
- [ ] `vendors/gemini/` adapter
- [ ] Gemini-specific command translations

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
| v0.6.0 | Planned | Multi-vendor, visualization |
| v0.5.0 | Planned | Context priming, preference inheritance, checkpoints |
| v0.4.0 | In Progress | Citation Expert v2, tiered API, provenance tracking |
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