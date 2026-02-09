---
name: wtfp:help
description: Show all WTF-P commands and how to use them
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

**WTF-P** (Write The F***ing Paper) gives you structured commands for writing academic papers, proposals, and presentations. You define your research vision. WTF-P breaks it into plannable, writable, reviewable sections — then tracks everything across sessions.

## Happy Path

New here? Follow these five commands in order:

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

### Planning

| Command | Description |
|---------|-------------|
| `/wtfp:discuss-section [N]` | Discuss your vision for a section before planning it |
| `/wtfp:research-gap [N]` | Research literature and domain knowledge for a section |
| `/wtfp:list-assumptions [N]` | Preview intended approach for a section before writing |
| `/wtfp:plan-section [N]` | Create detailed writing plan for a section |

### Writing

| Command | Description |
|---------|-------------|
| `/wtfp:write-section <path>` | Write a section by executing its plan |
| `/wtfp:execute-outline` | Write all sections in parallel, then check coherence |
| `/wtfp:quick <task>` | Run a small writing fix without full planning overhead |

### Review and Revision

| Command | Description |
|---------|-------------|
| `/wtfp:review-section [N]` | Review section for citations, coherence, and requirements |
| `/wtfp:verify-work [N]` | Test a written section against its plan, one check at a time |
| `/wtfp:plan-revision [N]` | Create revision plan from review issues |
| `/wtfp:polish-prose [N]` | Improve clarity, flow, and academic voice in written prose |

### Citations

| Command | Description |
|---------|-------------|
| `/wtfp:analyze-bib` | Analyze bibliography and map citations to sections |
| `/wtfp:check-refs` | Audit BibTeX for missing, duplicate, or broken references |

### Progress and Sessions

| Command | Description |
|---------|-------------|
| `/wtfp:progress` | Show writing progress and suggest next step |
| `/wtfp:pause-writing` | Save current progress so you can resume later |
| `/wtfp:resume-writing` | Resume writing from a previous session |
| `/wtfp:checkpoint <save/restore/list>` | Save, restore, or list paper state snapshots |

### Outline Management

| Command | Description |
|---------|-------------|
| `/wtfp:insert-section <after> <desc>` | Insert a new section between existing sections |
| `/wtfp:remove-section [N]` | Remove an unwritten section and renumber the rest |

### Export and Submission

| Command | Description |
|---------|-------------|
| `/wtfp:export-latex` | Export paper to LaTeX with bibliography and formatting |
| `/wtfp:audit-milestone` | Run pre-submission checks on sections, citations, and word counts |
| `/wtfp:plan-milestone-gaps` | Create fix plans for gaps found by audit-milestone |
| `/wtfp:submit-milestone <version>` | Archive a completed draft or submission version |

### Presentations and Posters

| Command | Description |
|---------|-------------|
| `/wtfp:create-slides` | Generate presentation slides from paper content |
| `/wtfp:create-poster` | Generate academic poster from paper content |

### Todos

| Command | Description |
|---------|-------------|
| `/wtfp:add-todo <description>` | Capture a quick note or task without breaking your flow |
| `/wtfp:check-todos` | Review pending todos and act on, defer, or dismiss each |

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
  sections/
    01-introduction/
      01-01-PLAN.md       Writing plan for section 1
      01-01-SUMMARY.md    Completion record

paper/                    Written output
  paper.md                Assembled paper
  references.bib          Bibliography
```

## Common Workflows

**Resuming after a break:**
```
/wtfp:progress
```

**Reviving a stalled project:**
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
