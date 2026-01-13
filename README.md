<div align="center">

# WTF-P

**Write The Freaking...**
- **P**aper
- **P**roposal
- **P**resentation
- **P**oster

**Context engineering for academic writing with Claude Code.**

```bash
npx wtf-p
```

</div>

---

## What This Does

WTF-P turns Claude Code into a structured academic writing system. Instead of chatting with AI and hoping for the best, you get:

- **Spec-driven writing** — Define your paper's vision, then execute section by section
- **Grounded output** — BibTeX integration, citation mapping, no hallucinated references
- **State management** — Pause, resume, track progress across sessions
- **Venue templates** — ACM, IEEE, Nature, arXiv-ML structures built in

The philosophy: **context engineering beats prompt engineering**. The files you prepare matter more than what you type.

---

## Quick Start

```bash
npx wtf-p
```

Then in Claude Code:

```bash
/wtfp:new-paper        # Define your paper
/wtfp:create-outline   # Build the structure
/wtfp:plan-section 1   # Plan first section
/wtfp:write-section    # Execute the plan
```

Run `/wtfp:help` for the full command reference.

<details>
<summary><strong>Installation Options</strong></summary>

```bash
# Global install (recommended)
npx wtf-p --global

# Local to current project
npx wtf-p --local

# Custom Claude config directory
npx wtf-p --global --config-dir ~/research/.claude

# Check installation status
npx wtf-p status

# Diagnose issues
npx wtf-p doctor
```
</details>

<details>
<summary><strong>Upgrading</strong></summary>

```bash
# Update existing installation
npx wtf-p update

# Or reinstall with conflict handling
npx wtf-p --global              # Interactive: prompts for conflicts
npx wtf-p --global --force      # Overwrite everything
npx wtf-p --global --backup-all # Backup before overwriting
```
</details>

<details>
<summary><strong>Uninstalling</strong></summary>

```bash
npx wtf-p-uninstall --global
npx wtf-p-uninstall --global --dry-run  # Preview first
```

Only WTF-P files are removed. Your `CLAUDE.md` and other configs stay intact.
</details>

---

## Why AI Writing Tools Fail Researchers

Most researchers using AI for writing hit the same walls:

| Problem | What Happens |
|---------|--------------|
| **Dump and pray** | Paste a PDF, ask for a lit review, get hallucinated citations |
| **No verification layer** | AI sounds confident, but claims aren't grounded in your actual sources |
| **Monolithic approach** | Try to write 10k words at once, context window fills, quality degrades |
| **No structure** | Generic AI doesn't know IMRaD from a blog post |

WTF-P solves these by treating academic writing as a **specification problem**, not a generation problem.

---

## The Approach: Context Engineering

The insight behind WTF-P: **what you prepare matters more than what you prompt**.

### 1. Specification First

Before any writing, WTF-P interviews you to extract:
- Research questions and hypotheses
- Core argument structure
- Evidence and data inventory
- Target venue requirements

This becomes your `PROJECT.md` — the grounding document that keeps every section aligned.

### 2. Hierarchical Planning

Papers aren't written in one shot. WTF-P breaks them down:

```
Paper Vision → Section Outline → Section Plan → Paragraph Execution
```

Each level has its own document. Each document is version-controlled. You always know where you are.

### 3. Isolated Execution

When writing a section, WTF-P spawns a fresh context with only what's needed:
- The paper vision
- That section's plan
- Relevant citations from your BibTeX
- Prior sections for continuity

No context pollution. No degradation over long documents.

### 4. Human Verification

AI drafts. Humans verify. Every section goes through:
- Citation audit (are these real? are they relevant?)
- Argument check (does this follow from the evidence?)
- Rubric validation (does this meet venue requirements?)

The system flags issues. You fix them. Iterate until solid.

---

## The Workflow

### Starting Fresh

```bash
/wtfp:new-paper         # Deep interview about your research
/wtfp:create-outline    # Generate section structure + word budgets
```

Creates `.planning/` with your paper's specification:
- `PROJECT.md` — Vision, requirements, constraints
- `ROADMAP.md` — Section breakdown with status
- `STATE.md` — Writing progress and context

### Writing Sections

```bash
/wtfp:plan-section 1    # Create detailed plan for section 1
/wtfp:write-section     # Execute the plan
/wtfp:progress          # Check status, get next action
```

Each section gets its own planning documents. Plans are explicit — you see exactly what Claude intends before it writes.

### Review and Polish

```bash
/wtfp:review-section 1  # Three-layer verification
/wtfp:polish-prose      # Remove AI-speak, improve flow
/wtfp:check-refs        # BibTeX audit
```

### Export

```bash
/wtfp:export-latex      # Generate .tex with proper formatting
```

---

## Reviving Stalled Projects

Got a half-finished paper? WTF-P can work with existing material.

```bash
/wtfp:map-project       # Index your existing files
/wtfp:new-paper         # Initialize with awareness of prior work
```

The mapping phase analyzes:
- Existing drafts and their state
- Your BibTeX and how citations are used
- Data files and figures
- What's missing vs. what's done

---

## Citation Expert (v0.4.0)

WTF-P now includes a specialized sub-agent for managing your bibliography.

```bash
/agent run citation-expert "Find papers about [topic]"
```

Capabilities:
- **Grounded Search:** Queries real academic databases (CrossRef/Semantic Scholar) via `citation-fetcher`.
- **BibTeX Management:** Indexes and validates your `.bib` file using `bib-index` without context limits.
- **Verification:** Automatically checks for missing or unused citations during `analyze-bib` and `check-refs`.

---

## Command Reference

### Setup
| Command | Purpose |
|---------|---------|
| `/wtfp:new-paper` | Initialize paper with deep context gathering |
| `/wtfp:create-outline` | Generate section structure |
| `/wtfp:map-project` | Index existing project materials |
| `/wtfp:analyze-bib` | Deep analysis of your bibliography |

### Planning
| Command | Purpose |
|---------|---------|
| `/wtfp:discuss-section [N]` | Articulate vision before planning |
| `/wtfp:plan-section [N]` | Create execution plan |
| `/wtfp:list-assumptions [N]` | See what Claude plans to write |
| `/wtfp:research-gap [N]` | Literature analysis for a section |

### Writing
| Command | Purpose |
|---------|---------|
| `/wtfp:write-section` | Execute a plan |
| `/wtfp:progress` | Status + intelligent next action |
| `/wtfp:pause-writing` | Save state for later |
| `/wtfp:resume-writing` | Restore context and continue |

### Review
| Command | Purpose |
|---------|---------|
| `/wtfp:review-section [N]` | Three-layer verification |
| `/wtfp:plan-revision [N]` | Create fix plan from issues |
| `/wtfp:polish-prose` | Improve readability |
| `/wtfp:check-refs` | Citation audit |

### Export
| Command | Purpose |
|---------|---------|
| `/wtfp:export-latex` | Generate .tex output |
| `/wtfp:submit-milestone` | Archive submission version |

### Contributing
| Command | Purpose |
|---------|---------|
| `/wtfp:report-bug` | File a GitHub issue |
| `/wtfp:request-feature` | Request new functionality |
| `/wtfp:contribute` | Submit a pull request |

---

## Venue Templates

| Template | Structure |
|----------|-----------|
| `acm-cs` | Intro → Background → Approach → Evaluation → Related Work → Conclusion |
| `ieee-cs` | Intro → Background → Design → Implementation → Evaluation → Conclusion |
| `arxiv-ml` | Intro → Related Work → Preliminaries → Method → Experiments → Conclusion |
| `nature` | Intro → Methods → Results → Discussion |
| `thesis` | Flexible chapter structure |

---

## WCN Mode (Reduced Tokens)

For smaller models or limited context windows, WTF-P includes compressed workflows:

```bash
./tools/wcn/swap-workflows.sh wcn      # Switch to compressed
./tools/wcn/swap-workflows.sh verbose  # Switch back
```

35-50% token reduction with equivalent output quality. Verified on Claude Haiku and Sonnet.

---

## Origin

WTF-P was built at the [Gnosis Research Center](https://www.intelli-gnosis.com/) at Illinois Tech.

The problem: research teams with grants to win, papers to publish, and no time to waste on writer's block. Existing AI tools either hallucinated citations or produced generic output that required complete rewrites.

The solution: treat Claude Code as a **structured writing system**, not a chatbot. Give it proper context, explicit specifications, and verification layers. Let humans focus on ideas while AI handles the mechanical synthesis.

The result: papers that ship.

---

## Contributing

Found a bug? Want a feature? WTF-P includes commands to help:

```bash
/wtfp:report-bug        # Creates a GitHub issue
/wtfp:request-feature   # Submits a feature request
/wtfp:contribute        # Guides you through a PR
```

Or visit [github.com/akougkas/wtf-p](https://github.com/akougkas/wtf-p).

---

## License

MIT License. Open source, open science.

<div align="center">
<br>
<strong>Stop staring at the cursor. Start shipping papers.</strong>
</div>
