---
name: wtfp:help
description: Show available WTF-P commands and usage guide
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

**`/wtfp:execute-outline`**
Execute all sections via wave-based parallel execution.

- Groups sections by wave (respecting dependencies)
- Spawns parallel writers per wave
- Runs coherence-checker after all waves complete
- Handles checkpoints between waves

Usage: `/wtfp:execute-outline`

**`/wtfp:verify-work <number>`**
Walk through section verification one test at a time.

- Derives tests from PLAN.md success criteria and argument-map claims
- Persists state in UAT.md (survives /clear)
- Classifies issues by severity (major/minor/cosmetic)
- Routes to plan-revision when issues found

Usage: `/wtfp:verify-work 2`

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

### Quick Tasks

**`/wtfp:quick <task>`**
Execute a quick writing task with minimal ceremony.

- Skips plan-checker and argument-verifier agents
- Classifies task intent (fix/add/revise/cite)
- Loads minimal context, executes directly
- Best for: fix a paragraph, add a citation, tweak wording

Usage: `/wtfp:quick "add citation for Smith2023 in methods section"`

### Review & Revision

**`/wtfp:review-section [number]`**
Run 3-layer verification on written sections.

- Runs Citation, Coherence, and Rubric checks
- Configurable reviewer persona (Hostile Reviewer, Area Chair, etc.)
- Creates ISSUES.md if problems found

Usage: `/wtfp:review-section 2`

**`/wtfp:polish-prose [number]`**
De-robotize and refine prose for clarity and academic voice.

- Eliminates AI-sounding patterns
- Adjusts voice (Authoritative/Measured/Accessible/Technical)
- Varies sentence structure, tightens word count
- Preserves technical accuracy and citations

Usage: `/wtfp:polish-prose 2`

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

### Citation Management

**`/wtfp:analyze-bib`**
Analyze BibTeX file and suggest citation placement by section.

- Spawns citation-expert agent for deep analysis
- Maps references to relevant sections
- Identifies citation gaps and coverage
- Supports tiered search pipeline

Usage: `/wtfp:analyze-bib`

**`/wtfp:check-refs`**
Audit BibTeX file for consistency and completeness.

- Spawns citation-formatter agent
- Validates formatting, checks for duplicates
- Verifies all cited works appear in bibliography
- Reports broken or missing references

Usage: `/wtfp:check-refs`

### Session Management

**`/wtfp:checkpoint <save|restore|list> [label]`**
Save or restore paper state as a git-tagged checkpoint.

- `save [label]` — Tag current state (e.g., "pre-discussion", "draft-1")
- `restore [tag]` — Restore from a checkpoint tag
- `list` — Show available checkpoints
- Enables session continuity across `/clear` boundaries

Usage: `/wtfp:checkpoint save draft-1`
Usage: `/wtfp:checkpoint list`

**`/wtfp:settings`**
View and edit project configuration interactively.

- Displays settings organized by category
- Interactive editing with type-appropriate options
- Shows diff of changes before applying
- Covers: General, Gates, Writing, Workflow, Verification, Parallelization, Safety, Git

Usage: `/wtfp:settings`

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

**`/wtfp:audit-milestone`**
Pre-submission audit checking sections, arguments, words, and citations.

- Runs 5 audit checks (section completion, argument coverage, word targets, citations, review status)
- Produces MILESTONE-AUDIT.md with pass/gap per criterion
- Gaps include actionable recommendations

Usage: `/wtfp:audit-milestone`

**`/wtfp:plan-milestone-gaps`**
Create targeted fix plans from audit findings.

- Reads MILESTONE-AUDIT.md and creates fix plans for each gap
- Groups related gaps affecting the same section
- Plans follow standard plan-format.md structure

Usage: `/wtfp:plan-milestone-gaps`

### Presentations & Posters

**`/wtfp:create-slides`**
Create presentation slides from paper content.

- Generates Marp-based markdown slides
- Extracts key findings, figures, and arguments
- Customizable themes and layouts

Usage: `/wtfp:create-slides`

**`/wtfp:create-poster`**
Create academic poster from paper content.

- Generates poster layout from paper sections
- Includes figures, key results, and conclusions
- Formatted for standard poster dimensions

Usage: `/wtfp:create-poster`

### Issue Management

**`/wtfp:consider-gaps`**
Review deferred issues and gaps.

- Analyzes all open issues against current draft
- Identifies resolved issues (can close)
- Identifies urgent gaps (should address now)
- Identifies natural fits for upcoming sections

Usage: `/wtfp:consider-gaps`

### Todo Management

**`/wtfp:add-todo <description>`**
Capture an idea or task for later without breaking flow.

- Quick-capture with minimal disruption
- Creates file in .planning/todos/pending/
- Auto-detects current section context from STATE.md
- Updates STATE.md pending count

Usage: `/wtfp:add-todo "Check whether Smith2024 contradicts our methodology claim"`

**`/wtfp:check-todos`**
Review pending todos — act on or dismiss.

- Presents each todo with act/defer/dismiss/done/skip options
- Moves files to dismissed/ or done/ subdirectories
- Updates STATE.md pending count after review

Usage: `/wtfp:check-todos`

### Utility Commands

**`/wtfp:help`**
Show this command reference.

**`/wtfp:update`**
Check for newer WTF-P version and install update.

- Compares installed version against npm registry
- Shows changelog diff when update available
- User can update or skip

Usage: `/wtfp:update`

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
</process>
