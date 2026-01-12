# WTF-P Roadmap

Development direction for WTF-P. Community input welcome via [GitHub Discussions](https://github.com/akougkas/wtf-p/discussions).

---

## Current: v0.2.0

**Focus:** CLI robustness and contribution system

### Completed
- [x] Subcommands: `status`, `doctor`, `update`
- [x] CLI flags: `--beginner`, `--advanced`, `--no-color`, `--quiet`, `--verbose`
- [x] Selective install: `--only=commands|workflows`
- [x] Version tracking (`.wtfp-version`)
- [x] Contribution commands: `/wtfp:report-bug`, `/wtfp:request-feature`, `/wtfp:contribute`
- [x] Shared utilities module
- [x] Comprehensive test suite (91 tests)

---

## Next: v0.3.0

**Focus:** The 4 P's + Multi-Vendor Architecture + Skills System

### The 4 P's
WTF-P expands to cover the full academic output spectrum:
- **P**aper — manuscripts, journal articles
- **P**roposal — grants, funding applications
- **P**resentation — conference talks, defense slides
- **P**oster — conference posters, visual summaries

### Multi-Vendor Architecture
Restructure repository for future support of multiple AI coding tools:
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
- [ ] `wtfp-marp` skill — Markdown+CSS → HTML/PDF via Marp CLI
- [ ] `wtfp-echarts` skill — Data → publication-quality charts
- [ ] Claude Code plugin manifest for marketplace

### New Commands
- [ ] `/wtfp:create-poster` — Full poster creation workflow
- [ ] `/wtfp:create-slides` — Presentation deck workflow

### Templates
- [ ] Academic poster template (HTML/CSS)
- [ ] Presentation slide template (Marp)
- [ ] Chart examples for common academic visualizations

---

## Planned: v0.4.0

**Focus:** Performance and research tools

### Question Batching
- [ ] Batch interview questions to reduce round-trips
- [ ] Smarter context loading (load only relevant references)
- [ ] Parallel section planning for independent sections

### Citation Enhancement
- [ ] Semantic Scholar API integration
- [ ] Auto-fetch missing BibTeX entries
- [ ] Citation network visualization
- [ ] "Related work" gap analysis

---

## Planned: v0.5.0+

**Focus:** Multi-vendor and collaboration

### Gemini Support
- [ ] `vendors/gemini/` adapter
- [ ] Gemini-specific command translations

### Visual Analysis (Multimodal)
- [ ] Figure critique with vision models
- [ ] Chart accessibility analysis
- [ ] Diagram-to-description generation

### Collaboration
- [ ] Multi-author coordination
- [ ] Comment/suggestion tracking
- [ ] Progress dashboards

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

---

## Version History

| Version | Release | Focus |
|---------|---------|-------|
| v0.3.0 | Planned | 4 P's, skills, multi-vendor restructure |
| v0.2.0 | Jan 2025 | CLI improvements, contribution system |
| v0.1.0 | Jan 2025 | Initial public release |

---

## How to Influence the Roadmap

1. **Vote on issues** — Add 👍 to issues you want prioritized
2. **Open discussions** — Propose new ideas
3. **Submit PRs** — Implement features from the wishlist
4. **Share use cases** — Tell us how you use WTF-P

The roadmap is updated based on community feedback and contribution patterns.
