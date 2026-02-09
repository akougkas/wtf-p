<div align="center">

<img src="https://raw.githubusercontent.com/akougkas/wtf-p/main/assets/wtfp-banner.jpg" alt="WTF-P Banner" width="600">

# WTF-P

**Write The F\*\*\*ing Paper.**

Also: Proposal. Presentation. Poster.

```bash
npx wtf-p
```

*Academic writing commands for [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Gemini CLI](https://github.com/google-gemini/gemini-cli), and [OpenCode](https://github.com/opencode-ai/opencode).*

</div>

---

## What This Does

WTF-P installs structured commands into your AI coding assistant that turn it into an academic writing system. You get spec-driven workflows, citation grounding, section isolation, and quality verification — not just "write me a paper." Every section is planned before it's written, verified after, and grounded in your actual BibTeX sources.

---

## Quick Start

```bash
npx wtf-p                  # Install commands (Claude Code by default)
```

Then in your AI assistant:

```bash
/wtfp:new-paper            # Guided interview about your research
/wtfp:create-outline       # Build section structure + word budgets
/wtfp:plan-section 1       # Plan first section
/wtfp:write-section        # Write the section
```

Run `/wtfp:help` for the full command list.

---

## Runtime Support

| Runtime | Commands | Agents | Extras |
|---------|----------|--------|--------|
| **Claude Code** | 36 | 11 | Skills, MCP server, plugin manifest |
| **Gemini CLI** | 36 | 11 | — |
| **OpenCode** | 36 | 11 | — |

```bash
npx wtf-p --global              # Claude Code (default)
npx wtf-p --global --gemini     # Gemini CLI
npx wtf-p --global --opencode   # OpenCode
```

---

## Installation

```bash
# Default: install to Claude Code
npx wtf-p

# Global install (recommended — persists across projects)
npx wtf-p --global

# Local to current project only
npx wtf-p --local

# Specify a custom config directory
npx wtf-p --global --config-dir ~/research/.claude

# Check what's installed
npx wtf-p status

# Diagnose issues
npx wtf-p doctor
```

### Upgrading

```bash
npx wtf-p update                    # Check for newer version
npx wtf-p --global                  # Reinstall (prompts on conflicts)
npx wtf-p --global --force          # Overwrite everything
npx wtf-p --global --backup-all    # Backup before overwriting
```

### Uninstalling

```bash
npx wtf-p-uninstall --global
npx wtf-p-uninstall --global --dry-run   # Preview what would be removed
```

Only WTF-P files are removed. Your config files and other tools stay intact.

---

## Command Reference

### Setup

| Command | Purpose |
|---------|---------|
| `/wtfp:new-paper` | Guided interview to define your paper's vision and requirements |
| `/wtfp:create-outline` | Build section structure, argument map, and word budgets |
| `/wtfp:map-project` | Index existing drafts, data, and references |
| `/wtfp:analyze-bib` | Analyze bibliography and map citations to sections |

### Planning

| Command | Purpose |
|---------|---------|
| `/wtfp:discuss-section [N]` | Discuss your vision for a section before planning |
| `/wtfp:plan-section [N]` | Create detailed writing plan with quality validation |
| `/wtfp:list-assumptions [N]` | Preview intended approach before writing |
| `/wtfp:research-gap [N]` | Research literature for a section (tiered: Semantic Scholar, Google Scholar, CrossRef) |

### Writing

| Command | Purpose |
|---------|---------|
| `/wtfp:write-section` | Execute a section plan with agent-based writing |
| `/wtfp:execute-outline` | Write all sections in parallel, then check coherence |
| `/wtfp:quick` | Minimal-ceremony writing for quick tasks |
| `/wtfp:progress` | Show writing progress and suggest next step |
| `/wtfp:pause-writing` | Save current progress for later |
| `/wtfp:resume-writing` | Resume from a previous session |

### Review

| Command | Purpose |
|---------|---------|
| `/wtfp:review-section [N]` | Review for citations, coherence, and venue requirements |
| `/wtfp:verify-work [N]` | Acceptance-test a section against its plan |
| `/wtfp:plan-revision [N]` | Create revision plan from review issues |
| `/wtfp:polish-prose` | Improve clarity, flow, and academic voice |
| `/wtfp:check-refs` | Audit BibTeX for missing, duplicate, or broken references |

### Structure

| Command | Purpose |
|---------|---------|
| `/wtfp:create-poster` | Full poster creation workflow |
| `/wtfp:create-slides` | Presentation deck workflow |
| `/wtfp:insert-section` | Add a new section to the outline |
| `/wtfp:remove-section` | Remove a section from the outline |

### Export & Submission

| Command | Purpose |
|---------|---------|
| `/wtfp:export-latex` | Export to LaTeX with bibliography and formatting |
| `/wtfp:audit-milestone` | Pre-submission checks on sections, citations, and word counts |
| `/wtfp:plan-milestone-gaps` | Create fix plans for gaps found by audit |
| `/wtfp:submit-milestone` | Archive a completed draft or submission version |

### Settings & Productivity

| Command | Purpose |
|---------|---------|
| `/wtfp:settings` | View and edit project settings interactively |
| `/wtfp:checkpoint` | Save, restore, and list paper state checkpoints |
| `/wtfp:add-todo` | Capture a quick note or task without breaking flow |
| `/wtfp:check-todos` | Review pending todos (act, defer, dismiss) |
| `/wtfp:update` | Check for updates and install newer version |

### Help & Contributing

| Command | Purpose |
|---------|---------|
| `/wtfp:help` | Full command reference |
| `/wtfp:report-bug` | Report a bug via GitHub issue |
| `/wtfp:request-feature` | Request a new feature via GitHub issue |
| `/wtfp:contribute` | Walk through contributing code via pull request |

---

## Configuration

WTF-P uses a `config.json` in your `.planning/` directory. Key settings:

```jsonc
{
  "model_profile": "balanced",        // "quality" | "balanced" | "budget"
  "workflow": {
    "research": true,                  // Enable research phase
    "plan_check": true,                // Pre-write plan validation
    "verifier": true                   // Post-write verification
  },
  "parallelization": {
    "enabled": false,                  // Parallel section writing
    "max_concurrent_agents": 3
  }
}
```

**Model profiles** route 11 specialized agents to appropriate models:
- **quality** — best models for all agents (slower, higher cost)
- **balanced** — strong models for writing, lighter for validation (default)
- **budget** — fastest models everywhere (good for iteration)

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

## How It Works

WTF-P follows a **thin orchestrator → specialized agent → quality loop** architecture:

1. **Specification first** — `/wtfp:new-paper` interviews you to extract research questions, argument structure, evidence inventory, and venue requirements into a `PROJECT.md`.
2. **Hierarchical planning** — Papers break down: Paper Vision → Section Outline → Section Plan → Paragraph Execution. Each level has its own document.
3. **Isolated execution** — Each section is written in a fresh context containing only the paper vision, that section's plan, relevant citations, and prior sections. No context pollution.
4. **Quality loops** — Pre-write plan validation (7 dimensions, up to 3 revisions) and post-write goal-backward verification ensure claims match plans and evidence.

### WCN Mode (Reduced Tokens)

For smaller models or limited context windows, WTF-P includes compressed workflows with 35-50% token reduction:

```bash
./tools/wcn/swap-workflows.sh wcn      # Switch to compressed
./tools/wcn/swap-workflows.sh verbose   # Switch back
```

---

## Origin

Built at the [Gnosis Research Center](https://grc.iit.edu/) at Illinois Tech. The problem: research teams with grants to win, papers to publish, and no time for writer's block. The solution: treat your AI coding assistant as a structured writing system — proper context, explicit specs, verification layers.

---

## Links

- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Roadmap](ROADMAP.md)
- [License](LICENSE) (MIT)
- [GitHub](https://github.com/akougkas/wtf-p)

---

<div align="center">
<br>
<strong>No more excuses. Ship the paper.</strong>
</div>
