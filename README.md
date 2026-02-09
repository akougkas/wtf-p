<div align="center">

# WTF-P

**Write The Freaking...**
- **P**aper
- **P**roposal
- **P**resentation
- **P**oster

**Stop staring at the cursor. Start shipping papers.**

*Academic writing commands for Claude Code, Gemini CLI, and OpenCode.*

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
/wtfp:write-section    # Write the section
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
/wtfp:new-paper         # Guided interview about your research
/wtfp:create-outline    # Build section structure + word budgets
```

Creates `.planning/` with your paper's specification:
- `PROJECT.md` — Vision, requirements, constraints
- `ROADMAP.md` — Section breakdown with status
- `STATE.md` — Writing progress and context

### Writing Sections

```bash
/wtfp:plan-section 1    # Create detailed plan for section 1
/wtfp:write-section     # Write the section
/wtfp:progress          # Check status, get next action
```

Each section gets its own planning documents. Plans are explicit — you see exactly what Claude intends before it writes.

### Review and Polish

```bash
/wtfp:review-section 1  # Review for citations, coherence, requirements
/wtfp:polish-prose      # Improve clarity and academic voice
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

## Multi-Runtime Support (v0.5.0)

WTF-P supports multiple AI coding assistants:

| Runtime | Config Directory | Status |
|---------|-----------------|--------|
| Claude Code | `~/.claude/` | Full support |
| Gemini CLI | `~/.config/gemini/` | Full support |
| OpenCode | `~/.opencode/` | Full support |

Install to your preferred runtime:
```bash
npx wtf-p --global              # Claude (default)
npx wtf-p --global --gemini     # Gemini CLI
npx wtf-p --global --opencode   # OpenCode
```

## Citation Expert (v0.4.0)

WTF-P includes a specialized tiered pipeline for bibliography management.

```bash
/wtfp:analyze-bib      # Map citations to sections
/wtfp:research-gap     # Research literature for a section
/wtfp:check-refs       # Audit BibTeX for issues
```

Capabilities:
- **Tiered Search:** Integrated Semantic Scholar, SerpAPI (Google Scholar), and CrossRef.
- **Impact Ranking:** Automatically scores papers by citations, velocity, and venue prestige.
- **Deduplication:** universal anchoring via DOI and Scholar Cluster IDs.
- **Provenance:** Entries track their metadata source and verification status.

---

## Command Reference

### Setup
| Command | Purpose |
|---------|---------|
| `/wtfp:new-paper` | Start a new paper with guided interview and setup |
| `/wtfp:create-outline` | Build section outline, argument map, and word budgets |
| `/wtfp:map-project` | Index existing drafts, data, and references for a project |
| `/wtfp:analyze-bib` | Analyze bibliography and map citations to sections |

### Planning
| Command | Purpose |
|---------|---------|
| `/wtfp:discuss-section [N]` | Discuss your vision for a section before planning it |
| `/wtfp:plan-section [N]` | Create detailed writing plan for a section |
| `/wtfp:list-assumptions [N]` | Preview intended approach for a section before writing |
| `/wtfp:research-gap [N]` | Research literature and domain knowledge for a section |

### Writing
| Command | Purpose |
|---------|---------|
| `/wtfp:write-section` | Write a section by executing its plan |
| `/wtfp:execute-outline` | Write all sections in parallel, then check coherence |
| `/wtfp:progress` | Show writing progress and suggest next step |
| `/wtfp:pause-writing` | Save current progress so you can resume later |
| `/wtfp:resume-writing` | Resume writing from a previous session |

### Review
| Command | Purpose |
|---------|---------|
| `/wtfp:review-section [N]` | Review section for citations, coherence, and requirements |
| `/wtfp:verify-work [N]` | Test a written section against its plan, one check at a time |
| `/wtfp:plan-revision [N]` | Create revision plan from review issues |
| `/wtfp:polish-prose` | Improve clarity, flow, and academic voice in written prose |
| `/wtfp:check-refs` | Audit BibTeX for missing, duplicate, or broken references |

### Export
| Command | Purpose |
|---------|---------|
| `/wtfp:export-latex` | Export paper to LaTeX with bibliography and formatting |
| `/wtfp:audit-milestone` | Run pre-submission checks on sections, citations, and word counts |
| `/wtfp:plan-milestone-gaps` | Create fix plans for gaps found by audit-milestone |
| `/wtfp:submit-milestone` | Archive a completed draft or submission version |

### Settings & Todos
| Command | Purpose |
|---------|---------|
| `/wtfp:settings` | View and edit project settings interactively |
| `/wtfp:add-todo` | Capture a quick note or task without breaking your flow |
| `/wtfp:check-todos` | Review pending todos and act on, defer, or dismiss each |
| `/wtfp:update` | Check for updates and install newer version |

### Contributing
| Command | Purpose |
|---------|---------|
| `/wtfp:report-bug` | Report a bug via GitHub issue |
| `/wtfp:request-feature` | Request a new feature via GitHub issue |
| `/wtfp:contribute` | Walk through contributing code to WTF-P via pull request |

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
<strong>No more excuses. Ship the paper.</strong>
</div>
