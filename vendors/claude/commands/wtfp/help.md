---
name: wtfp:help
description: Show available WTF-P commands and usage guide
---

<objective>
Display the complete WTF-P command reference.

Output ONLY the reference content below. Do NOT add:

- Project-specific analysis
- Git status or file context
- Next-step suggestions
- Any commentary beyond the reference
</objective>

<reference>
# WTF-P Command Reference

**WTF-P** (Write The F***ing Paper) creates hierarchical writing plans optimized for solo academic writing with Claude Code.

## Quick Start

1. `/wtfp:new-paper` - Initialize a new paper with vision
2. `/wtfp:create-outline` - Create document outline and sections
3. `/wtfp:plan-section <number>` - Create detailed plan for a section
4. `/wtfp:write-section <path>` - Execute the writing plan

## Core Workflow

```
Initialization -> Outlining -> Planning -> Writing -> Review
```

### Paper Initialization

**`/wtfp:new-paper`**
Initialize new paper project with deep context gathering.

- Creates `.planning/PROJECT.md` (paper vision and requirements)
- Creates `.planning/config.json` (workflow mode)
- Creates structure docs (argument-map, outline, narrative-arc)
- Asks about paper type, target venue, core argument
- Commits initialization files to git

Usage: `/wtfp:new-paper`

**`/wtfp:create-outline`**
Create section roadmap and state tracking for initialized paper.

- Creates `.planning/ROADMAP.md` (section breakdown)
- Creates `.planning/STATE.md` (writing memory)
- Creates `.planning/sections/` directories
- Establishes word budget per section

Usage: `/wtfp:create-outline`

**`/wtfp:map-project`**
Map existing source materials for brownfield writing projects.

- Indexes existing literature, data, and prior drafts
- Creates `.planning/sources/` with organized references
- Covers: literature.md, data.md, prior-drafts.md
- Use before `/wtfp:new-paper` on existing writing projects

Usage: `/wtfp:map-project`

### Section Planning

**`/wtfp:discuss-section <number>`**
Help articulate your vision for a section before planning.

- Captures how you imagine this section working
- Creates CONTEXT.md with your vision, essentials, and boundaries
- Use when you have ideas about how something should read/feel

Usage: `/wtfp:discuss-section 2`

**`/wtfp:research-gap <number>`**
Comprehensive literature/domain research for a section.

- Discovers standard approaches, key citations, gaps
- Creates RESEARCH.md with "how experts write this" knowledge
- Use for literature reviews, methodology justification, etc.

Usage: `/wtfp:research-gap 3`

**`/wtfp:list-assumptions <number>`**
See what Claude is planning to write before it starts.

- Shows Claude's intended approach for a section
- Lets you course-correct if Claude misunderstood your vision
- No files created - conversational output only

Usage: `/wtfp:list-assumptions 3`

**`/wtfp:plan-section <number>`**
Create detailed writing plan for a specific section.

- Generates `.planning/sections/XX-section-name/XX-YY-PLAN.md`
- Breaks section into concrete writing tasks
- Includes verification criteria and word targets
- Multiple plans per section supported (XX-01, XX-02, etc.)

Usage: `/wtfp:plan-section 1`
Result: Creates `.planning/sections/01-introduction/01-01-PLAN.md`

### Writing Execution

**`/wtfp:write-section <path>`**
Execute a PLAN.md file directly.

- Writes section content following the plan
- Creates SUMMARY.md after completion
- Updates STATE.md with word counts and progress
- Supports three modes: Co-Author, Scaffold, Reviewer

Usage: `/wtfp:write-section .planning/sections/01-introduction/01-01-PLAN.md`

### Outline Management

**`/wtfp:add-section <description>`**
Add new section to end of current structure.

- Appends to ROADMAP.md
- Uses next sequential number
- Updates section directory structure

Usage: `/wtfp:add-section "Add limitations subsection"`

**`/wtfp:insert-section <after> <description>`**
Insert urgent section between existing sections.

- Creates intermediate section (e.g., 3.1 between 3 and 4)
- Useful for discovered gaps that must be addressed
- Maintains section ordering

Usage: `/wtfp:insert-section 3 "Add methodology detail"`
Result: Creates Section 3.1

**`/wtfp:remove-section <number>`**
Remove a future section and renumber subsequent sections.

- Deletes section directory and all references
- Renumbers all subsequent sections to close the gap
- Only works on future (unwritten) sections
- Git commit preserves historical record

Usage: `/wtfp:remove-section 7`

### Review & Revision

**`/wtfp:review-section [number]`**
User acceptance testing of written sections.

- Runs 3-layer verification (Citation, Coherence, Rubric)
- Identifies issues needing revision
- Creates ISSUES.md if problems found

Usage: `/wtfp:review-section 2`

**`/wtfp:plan-revision <plan>`**
Create fix plan from review issues.

- Reads ISSUES.md for the section
- Creates targeted revision plan
- Addresses specific reviewer/verification comments

Usage: `/wtfp:plan-revision 02-01`

### Progress Tracking

**`/wtfp:progress`**
Check writing status and intelligently route to next action.

- Shows visual progress bar and word count
- Summarizes recent work from SUMMARY files
- Displays current position and what's next
- Offers to execute next plan or create it if missing

Usage: `/wtfp:progress`

### Session Management

**`/wtfp:resume-writing`**
Resume work from previous session with full context restoration.

- Reads STATE.md for writing context
- Shows current position and recent progress
- Offers next actions based on project state

Usage: `/wtfp:resume-writing`

**`/wtfp:pause-writing`**
Create context handoff when pausing work mid-section.

- Creates .continue-here file with current state
- Updates STATE.md session continuity section
- Captures in-progress work context

Usage: `/wtfp:pause-writing`

### Export & Submission

**`/wtfp:export-latex`**
Export paper to LaTeX format.

- Generates .tex file from markdown sections
- Creates references.bib from literature index
- Applies journal/conference template
- Outputs to paper/ directory

Usage: `/wtfp:export-latex`

**`/wtfp:submit-milestone <version>`**
Archive completed submission round.

- Creates MILESTONES.md entry with stats
- Archives full details to milestones/ directory
- Prepares workspace for revision round

Usage: `/wtfp:submit-milestone "initial-submission"`

### Issue Management

**`/wtfp:consider-gaps`**
Review deferred issues and gaps.

- Analyzes all open issues against current draft
- Identifies resolved issues (can close)
- Identifies urgent gaps (should address now)
- Identifies natural fits for upcoming sections

Usage: `/wtfp:consider-gaps`

### Utility Commands

**`/wtfp:help`**
Show this command reference.

## Files & Structure

```
.planning/
├── PROJECT.md            # Paper vision
├── ROADMAP.md            # Section breakdown
├── STATE.md              # Writing memory & progress
├── ISSUES.md             # Deferred enhancements
├── config.json           # Workflow mode & settings
├── structure/            # Document structure
│   ├── argument-map.md   # Claim → Evidence → Conclusion
│   ├── outline.md        # Section skeleton
│   └── narrative-arc.md  # Story structure
├── sources/              # Source materials
│   ├── literature.md     # Bibliography index
│   ├── data.md           # Figures, tables, evidence
│   └── prior-drafts.md   # Existing material to incorporate
├── grant/                # Grant-specific (if applicable)
│   ├── specific-aims.md  # Goal hierarchy
│   ├── budget.md         # Budget structure
│   └── reviewer-framing.md  # Why fund this
└── sections/
    ├── 01-introduction/
    │   ├── 01-01-PLAN.md
    │   └── 01-01-SUMMARY.md
    └── 02-methods/
        ├── 02-01-PLAN.md
        └── 02-01-SUMMARY.md

paper/                    # Output files
├── paper.tex             # LaTeX output
├── paper.md              # Markdown output
├── references.bib        # Bibliography
└── figures/              # Figure files
```

## Writing Modes

Claude adapts its role per section:

**Co-Author Mode**
- Claude drafts, you refine
- Best for: Initial drafts, methods, boilerplate

**Scaffold Mode**
- Claude outlines, you write
- Best for: Arguments, results interpretation

**Reviewer Mode**
- You write, Claude critiques
- Best for: Abstract, discussion, conclusions

## Verification Layers

**1. Citation Check (Mechanical)**
- All claims have citations
- Citations formatted correctly
- No broken references

**2. Argument Coherence (Logical)**
- Claims follow from evidence
- No logical contradictions
- Flow between paragraphs

**3. Rubric Check (Requirements)**
- All required sections present
- Word/page limits met
- Formatting requirements met

## Common Workflows

**Starting a new paper:**

```
/wtfp:new-paper
/wtfp:create-outline
/wtfp:plan-section 1
/wtfp:write-section .planning/sections/01-introduction/01-01-PLAN.md
```

**Resuming work after a break:**

```
/wtfp:progress  # See where you left off and continue
```

**Handling reviewer comments:**

```
/wtfp:import-reviews   # Import reviewer comments
/wtfp:plan-revision    # Plan fixes
/wtfp:write-section    # Execute revisions
/wtfp:respond-reviews  # Generate response doc
```

## Contributing to WTF-P

Found a bug or want a new feature? Use these commands:

**`/wtfp:report-bug`**
Report a bug via GitHub issue.
- Guides you through describing the problem
- Collects environment info automatically
- Creates well-formatted issue with `gh` CLI

**`/wtfp:request-feature`**
Request a new feature via GitHub issue.
- Helps articulate what you need and why
- Checks for duplicate requests
- Can lead into implementation if desired

**`/wtfp:contribute`**
Guide through contributing code via Pull Request.
- Fork → Branch → Implement → Test → PR workflow
- Works for new commands, bug fixes, docs
- Follows project conventions automatically

## Getting Help

- Read `.planning/PROJECT.md` for paper vision
- Read `.planning/STATE.md` for current context
- Check `.planning/ROADMAP.md` for section status
- Run `/wtfp:progress` to check where you're at
- Report bugs: `/wtfp:report-bug`
- Request features: `/wtfp:request-feature`
- GitHub: https://github.com/akougkas/wtf-p
</reference>
