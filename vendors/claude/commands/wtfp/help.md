---
name: wtfp:help
description: Show all WTF-P commands and how to use them
allowed-tools: []
---

<objective>
Display the complete WTF-P command reference.

Output ONLY the reference content below. Do NOT add:

- Project-specific analysis
- Git status or file context
- Next-step suggestions
- Any commentary beyond the reference
</objective>

<process>
<reference>
# WTF-P Command Reference

**WTF-P** (Write The F***ing Paper) gives you 36 commands for writing academic papers, proposals, presentations, and posters. You describe your research. WTF-P breaks it into sections you can plan, write, and review one at a time — tracking everything across sessions so you never lose context.

## Happy Path

New here? These five commands are the core loop. Run them in order:

| Step | Command | What it does |
|------|---------|-------------|
| 1 | `/wtfp:new-paper` | Start a new paper with guided interview and setup |
| 2 | `/wtfp:create-outline` | Build section outline, argument map, and word budgets |
| 3 | `/wtfp:plan-section 1` | Create detailed writing plan for a section |
| 4 | `/wtfp:write-section` | Write a section by executing its plan |
| 5 | `/wtfp:review-section 1` | Review section for citations, coherence, and requirements |

Repeat steps 3-5 for each section. Run `/wtfp:progress` anytime to see where you are and what to do next.

## All Commands

### Setup

| Command | Description |
|---------|-------------|
| `/wtfp:new-paper` | Start a new paper with guided interview and setup |
| `/wtfp:create-outline` | Build section outline, argument map, and word budgets |
| `/wtfp:map-project` | Index existing drafts, data, and references for a project |

```
/wtfp:new-paper                  # Answer questions about your research, get PROJECT.md
/wtfp:create-outline             # Produces ROADMAP.md, argument-map, narrative-arc
/wtfp:map-project                # Got existing files? Index them first, then new-paper
```

### Planning

| Command | Description |
|---------|-------------|
| `/wtfp:discuss-section [N]` | Discuss your vision for a section before planning it |
| `/wtfp:research-gap [N]` | Research literature and domain knowledge for a section |
| `/wtfp:list-assumptions [N]` | Preview intended approach for a section before writing |
| `/wtfp:plan-section [N]` | Create detailed writing plan for a section |

```
/wtfp:discuss-section 2          # Talk through your vision before committing to a plan
/wtfp:research-gap 3             # Find key citations and standard approaches
/wtfp:list-assumptions 3         # See what Claude intends — course-correct early
/wtfp:plan-section 1             # Creates .planning/sections/01-intro/01-01-PLAN.md
```

### Writing

| Command | Description |
|---------|-------------|
| `/wtfp:write-section <path>` | Write a section by executing its plan |
| `/wtfp:execute-outline` | Write all sections in parallel, then check coherence |
| `/wtfp:quick <task>` | Run a small writing fix without full planning overhead |

```
/wtfp:write-section .planning/sections/01-introduction/01-01-PLAN.md
/wtfp:execute-outline            # Writes all sections by wave, checks coherence after
/wtfp:quick "add citation for Smith2023 in methods"
```

### Review and Revision

| Command | Description |
|---------|-------------|
| `/wtfp:review-section [N]` | Review section for citations, coherence, and requirements |
| `/wtfp:verify-work [N]` | Test a written section against its plan, one check at a time |
| `/wtfp:plan-revision [N]` | Create revision plan from review issues |
| `/wtfp:polish-prose [N]` | Improve clarity, flow, and academic voice in written prose |

```
/wtfp:review-section 2           # Runs citation, coherence, and rubric checks
/wtfp:verify-work 2              # Walk through acceptance tests one at a time
/wtfp:plan-revision 02-01        # Turn ISSUES.md into a fix plan
/wtfp:polish-prose 2             # Kill AI-speak, tighten prose, adjust voice
```

### Citations

| Command | Description |
|---------|-------------|
| `/wtfp:analyze-bib` | Analyze bibliography and map citations to sections |
| `/wtfp:check-refs` | Audit BibTeX for missing, duplicate, or broken references |

```
/wtfp:analyze-bib                # Deep analysis — maps each reference to sections
/wtfp:check-refs                 # Finds missing keys, duplicates, broken entries
```

### Progress and Sessions

| Command | Description |
|---------|-------------|
| `/wtfp:progress` | Show writing progress and suggest next step |
| `/wtfp:pause-writing` | Save current progress so you can resume later |
| `/wtfp:resume-writing` | Resume writing from a previous session |
| `/wtfp:checkpoint <save/restore/list>` | Save, restore, or list paper state snapshots |

```
/wtfp:progress                   # Visual progress bar + intelligent next action
/wtfp:pause-writing              # Creates .continue-here with full context
/wtfp:resume-writing             # Reads STATE.md, shows where you left off
/wtfp:checkpoint save draft-1    # Git-tagged snapshot you can restore later
/wtfp:checkpoint list            # Show all checkpoints
```

### Outline Management

| Command | Description |
|---------|-------------|
| `/wtfp:insert-section <after> <desc>` | Insert a new section between existing sections |
| `/wtfp:remove-section [N]` | Remove an unwritten section and renumber the rest |

```
/wtfp:insert-section 3 "Add methodology detail"   # Creates Section 3.1
/wtfp:remove-section 7                             # Deletes and renumbers
```

### Export and Submission

| Command | Description |
|---------|-------------|
| `/wtfp:export-latex` | Export paper to LaTeX with bibliography and formatting |
| `/wtfp:audit-milestone` | Run pre-submission checks on sections, citations, and word counts |
| `/wtfp:plan-milestone-gaps` | Create fix plans for gaps found by audit-milestone |
| `/wtfp:submit-milestone <version>` | Archive a completed draft or submission version |

```
/wtfp:export-latex               # Generates .tex + references.bib in paper/
/wtfp:audit-milestone            # 5-check pre-submission audit → MILESTONE-AUDIT.md
/wtfp:plan-milestone-gaps        # Reads audit, creates fix plans for each gap
/wtfp:submit-milestone "initial-submission"   # Archives to milestones/
```

### Presentations and Posters

| Command | Description |
|---------|-------------|
| `/wtfp:create-slides` | Generate presentation slides from paper content |
| `/wtfp:create-poster` | Generate academic poster from paper content |

```
/wtfp:create-slides              # Marp-based markdown slides from your paper
/wtfp:create-poster              # Academic poster layout from key sections
```

### Todos

| Command | Description |
|---------|-------------|
| `/wtfp:add-todo <description>` | Capture a quick note or task without breaking your flow |
| `/wtfp:check-todos` | Review pending todos and act on, defer, or dismiss each |

```
/wtfp:add-todo "Check whether Smith2024 contradicts our methodology claim"
/wtfp:check-todos                # Walk through each — act, defer, dismiss, or done
```

### Settings and Utilities

| Command | Description |
|---------|-------------|
| `/wtfp:settings` | View and edit project settings interactively |
| `/wtfp:update` | Check for updates and install newer version |
| `/wtfp:help` | Show all WTF-P commands and how to use them |

### Contributing

| Command | Description |
|---------|-------------|
| `/wtfp:report-bug` | Report a bug via GitHub issue |
| `/wtfp:request-feature` | Request a new feature via GitHub issue |
| `/wtfp:contribute` | Walk through contributing code to WTF-P via pull request |

## Files and Structure

WTF-P creates a `.planning/` directory in your project:

```
.planning/
  PROJECT.md              Paper vision and requirements
  ROADMAP.md              Section breakdown with status
  STATE.md                Writing progress and session context
  config.json             Project settings
  structure/
    argument-map.md       Claims mapped to evidence and sections
    outline.md            Section structure and word budgets
    narrative-arc.md      Story flow across sections
  sources/
    literature.md         Bibliography index
    data.md               Figures, tables, evidence
    prior-drafts.md       Existing material to incorporate
  sections/
    01-introduction/
      01-01-PLAN.md       Writing plan
      01-01-SUMMARY.md    Completion record
    02-methods/
      02-01-PLAN.md
      02-01-SUMMARY.md

paper/                    Written output
  paper.md                Assembled paper
  paper.tex               LaTeX output (after export)
  references.bib          Bibliography
  figures/                Figure files
```

## Common Workflows

**Starting a new paper:**
```
/wtfp:new-paper
/wtfp:create-outline
/wtfp:plan-section 1
/wtfp:write-section .planning/sections/01-introduction/01-01-PLAN.md
```

**Resuming after a break:**
```
/wtfp:progress
```

**Reviving a stalled project with existing files:**
```
/wtfp:map-project
/wtfp:new-paper
```

**Handling reviewer comments:**
```
/wtfp:plan-revision 02-01
/wtfp:write-section .planning/sections/02-methods/02-01-PLAN.md
```

## Getting Help

- `/wtfp:progress` — See where you are and what to do next
- `/wtfp:report-bug` — Report a bug
- `/wtfp:request-feature` — Request a feature
- GitHub: https://github.com/akougkas/wtf-p
</reference>
</process>
