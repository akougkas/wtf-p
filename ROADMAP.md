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

## Current: v0.6.0 release candidate

**Focus:** Portable Agent Protocol + Native Client Adapters

### Canonical kernel

- [x] Define 36 versioned semantic action contracts and stable aliases
- [x] Move workflow prose into one host-neutral canonical source
- [x] Package seven standard, progressively disclosed Agent Skills
- [x] Define 11 portable specialist roles and strict result contracts
- [x] Version the `.planning` project protocol with JSON schemas and fixtures
- [x] Declare capabilities, effects, approval boundaries, and optional deterministic tools

### Native clients

- [x] Build Clio Coder extension with namespaced prompts, agents, skills, and fleets
- [x] Build Claude Code plugin with generated commands, agents, and skills
- [x] Build Codex plugin and repo marketplace
- [x] Build GitHub Copilot CLI plugin and committed `.github` cloud projection
- [x] Build OpenCode command/agent/skill bundle
- [x] Build Antigravity CLI plugin
- [x] Preserve Gemini CLI as a separate compatibility extension
- [x] Validate generated resources with installed native CLIs where available

### Deterministic delivery

- [x] Generate every adapter from the canonical protocol
- [x] Authenticate generated files with per-envelope SHA-256 inventories
- [x] Detect drift and remove only stale compiler-owned outputs
- [x] Add explicit `wtfp install <target>` grammar for all seven clients
- [x] Add exact-file v2 receipts, rollback, containment, and safe uninstall
- [x] Complete isolated native discovery and the primary Claude, Codex, and Clio `new-paper` evaluations
- [x] Define versioned routing corpora, semantic invariants, budget metadata, and fail-closed comparison tooling
- [x] Canonicalize both Clio fleets and validate their corrected directory boundaries with Clio 0.3.8
- [x] Retain the first `dynamo/qwen3.8-27b` lifecycle reading as an honest action-1 block, without promoting it to a baseline
- [ ] Complete the paid skill-routing matrix and full Clio lifecycle/fleet runs
- [ ] Establish observed cross-version academic-output baselines
- [ ] Publish `0.6.0-rc.1` and gather migration feedback before stable `0.6.0`

### Deferred beyond the release candidate

- [x] Evaluate MCP versus deterministic local tools and accept the local-first hybrid ADR
- [ ] Reconsider an optional network-only MCP server when the ADR activation gates and a Clio gateway exist
- [ ] Add visual figure and chart review workflows
- [ ] Add citation-network visualization and graph export
- [ ] Accumulate comparable observed behavioral baselines across client/model releases

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

1. **Evidence before eloquence** — Never trade citation integrity for fluent prose
2. **Portable state** — Versioned `.planning` records, not one client's session, carry the project forward
3. **Portable semantics, native ergonomics** — One academic method, adapted to each host's real capabilities
4. **Progressive disclosure** — Keep entry points concise while preserving deep action procedures in skills and references
5. **Human gates at consequential boundaries** — Preview deletion, VCS, publication, package, and external effects separately
6. **No incidental VCS** — Research and writing actions do not initialize, stage, commit, merge, or push
7. **Exact ownership** — Generated and installed files are authenticated, contained, reversible, and never broaden ownership silently
8. **Durable author intent** — Locked, deferred, and discretionary decisions remain explicit project data
9. **Bounded delegation** — Specialists receive only the context and authority needed for one verifiable task
10. **Observed compatibility** — A first-class claim requires native discovery and isolated behavioral evidence

---

## Anti-Features (Explicitly Excluded)

These will NOT be built, even if they seem useful:

| Feature | Rationale |
|---------|-----------|
| Real-time collaboration | Outside the focused research-workflow and agent-adapter scope. |
| Local ML/NLP models | Offload intelligence to LLM, keep tools dumb and fast. |
| GUI/Web interface | CLI-only. Stay in the terminal. |
| Autonomous publishing | Human always in loop for external actions. |
| Hidden Git automation | Checkpoints and workflow state must not move branches or create commits incidentally. |
| Vendor model policy in the canonical kernel | Model selection belongs to the active host and operator. |
| Implicit targetless installation | Every noninteractive installation names a target or uses an explicit deprecated scope alias. |
| Unverified first-class labels | Schema validity alone is not runtime compatibility. |

---

## Version History

| Version | Release | Focus |
|---------|---------|-------|
| v0.6.0-rc.1 | Aug 2026 | Portable protocol, seven native adapters, Clio reference integration, safe transactional installer |
| v0.6.0 | Planned | Stable release after isolated client/model evaluation and migration feedback |
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
