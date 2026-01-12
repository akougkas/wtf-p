# WTF-P Roadmap

This document outlines the development direction for WTF-P. Community input is welcome via [GitHub Discussions](https://github.com/akougkas/wtf-p/discussions).

---

## Current Release: v1.0.0

**Focus:** Stable foundation for academic writing workflows

### Core Features
- 21 slash commands for paper lifecycle
- Hierarchical planning (PROJECT → ROADMAP → sections)
- Git-based state tracking
- LaTeX/BibTeX integration
- Venue-specific templates (CHI, NeurIPS, etc.)
- WCN compression for smaller models

---

## Near-term: v1.x

### Performance Optimization
- [ ] Batch interview questions to reduce round-trips
- [ ] Parallel section planning for independent sections
- [ ] Smarter context loading (load only relevant references)

### Enhanced Citation Support
- [ ] Semantic Scholar API integration for citation lookup
- [ ] Auto-fetch missing BibTeX entries
- [ ] Citation network visualization
- [ ] "Related work" gap analysis

### Template Expansion
- [ ] More venue templates (ICML, ACL, CVPR, etc.)
- [ ] Grant proposal templates (NSF, NIH)
- [ ] Thesis/dissertation structure
- [ ] Technical report format

---

## Mid-term: v2.x

### Visual Analysis (Multimodal)
- [ ] Figure critique with vision models
- [ ] Chart/graph accessibility analysis
- [ ] Diagram-to-description generation
- [ ] Screenshot-based UI description for HCI papers

### Expert Agents
- [ ] Reviewer persona simulation
- [ ] Domain expert consultations
- [ ] Statistical methods advisor
- [ ] Writing style analyzer

### Collaboration Features
- [ ] Multi-author coordination
- [ ] Comment/suggestion tracking
- [ ] Conflict resolution for concurrent edits
- [ ] Progress dashboards

---

## Long-term: v3.x

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
- [ ] Supplementary material organization

---

## Community Wishlist

Ideas from users that we'd love help implementing:

| Feature | Complexity | Status |
|---------|------------|--------|
| Overleaf sync | Medium | Open |
| Zotero integration | Medium | Open |
| Grammarly-style suggestions | High | Open |
| Meeting notes → paper sections | Medium | Open |
| Code → methods section | Medium | Open |

**Want to contribute?** Check [CONTRIBUTING.md](CONTRIBUTING.md) and pick an item!

---

## Design Principles

These guide all development decisions:

1. **Substance over ceremony** - No unnecessary files or process
2. **Speed through automation** - Minimize user round-trips
3. **Git as source of truth** - All state is version-controlled
4. **Graceful degradation** - Works with any model size (WCN mode)
5. **User control** - Always ask before destructive operations

---

## Version History

| Version | Focus |
|---------|-------|
| v1.0.0 | Stable release, installer robustness |
| v0.1.0 | Initial public release |

---

## How to Influence the Roadmap

1. **Vote on issues** - Add 👍 to issues you want prioritized
2. **Open discussions** - Propose new ideas in Discussions
3. **Submit PRs** - Implement features from the wishlist
4. **Share use cases** - Tell us how you use WTF-P

The roadmap is a living document updated based on community feedback and contribution patterns.
