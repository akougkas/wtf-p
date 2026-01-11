---
name: wtfp:create-outline
description: Create document outline, section roadmap, and state tracking
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<objective>
Create the document outline and section roadmap for an initialized paper.

Creates ROADMAP.md (section breakdown), STATE.md (writing memory), and section directories.

This establishes the structure before section-by-section planning begins.
</objective>

<execution_context>
@./.claude/write-the-f-paper/workflows/create-outline.md
@./.claude/write-the-f-paper/templates/roadmap.md
@./.claude/write-the-f-paper/templates/state.md
@./.claude/write-the-f-paper/references/imrad-structure.md
</execution_context>

<process>

<step name="verify">
**Verify project exists:**

```bash
[ ! -f .planning/PROJECT.md ] && echo "ERROR: No project found. Run /wtfp:new-paper first" && exit 1
[ -f .planning/ROADMAP.md ] && echo "ERROR: Outline already exists. Use /wtfp:progress" && exit 1
```

</step>

<step name="load">
**Load project context:**

- Read `.planning/PROJECT.md` for paper vision, core argument, requirements
- Read `.planning/config.json` for document type and workflow mode
- Read `.planning/structure/outline.md` for initial structure sketch
- Read `.planning/structure/argument-map.md` for logical structure
</step>

<step name="structure">
**Determine document structure:**

Based on document type from config.json:

**Research Paper (IMRaD):**
- Abstract
- Introduction
- Methods (or Materials and Methods)
- Results
- Discussion
- Conclusion (sometimes combined with Discussion)
- References

**Grant Proposal (NSF-style):**
- Specific Aims
- Background and Significance
- Preliminary Data
- Research Design and Methods
- Timeline
- Budget Justification

**Grant Proposal (NIH-style):**
- Specific Aims
- Significance
- Innovation
- Approach
- Timeline and Milestones

**Thesis Chapter:**
- Introduction
- Literature Review
- Methodology
- Results/Findings
- Discussion
- Conclusion

Use AskUserQuestion if structure needs customization:
- header: "Structure"
- question: "The standard structure for [type] is [list]. Any modifications?"
- options:
  - "Use standard structure" — Apply typical [type] structure
  - "Customize sections" — I have specific sections in mind
  - "Show me options" — What alternatives exist?

</step>

<step name="roadmap">
**Create ROADMAP.md:**

```markdown
# Document Roadmap

## Document: [Paper Title]
## Type: [Paper Type]
## Target: [Venue if known]

## Sections

### 1. [Section Name]
- **Goal:** [What this section accomplishes]
- **Word Target:** [X words]
- **Status:** Not started
- **Dependencies:** [Any prerequisites]

### 2. [Section Name]
- **Goal:** [What this section accomplishes]
- **Word Target:** [X words]
- **Status:** Not started
- **Dependencies:** [Section 1 must establish X]

[... continue for all sections ...]

## Progress

| # | Section | Goal | Words | Status |
|---|---------|------|-------|--------|
| 1 | [Name] | [1-liner] | 0/[target] | - |
| 2 | [Name] | [1-liner] | 0/[target] | - |
| ... | | | | |

## Word Budget

| Section | Target | Current | % |
|---------|--------|---------|---|
| [Name] | [X] | 0 | 0% |
| ... | | | |
| **Total** | **[X]** | **0** | **0%** |

---
*Last updated: [date] after outline creation*
```

</step>

<step name="state">
**Create STATE.md:**

```markdown
# Writing State

## Project Reference
- Project: .planning/PROJECT.md
- Roadmap: .planning/ROADMAP.md
- Config: .planning/config.json

## Current Position
- Section: 1 of [total]
- Plan: 0 (not yet planned)
- Status: Ready to plan first section

## Progress
- Sections: 0/[total] complete
- Words: 0/[target] ([0]%)
- Plans executed: 0

## Argument Strength
- Core claim: [from PROJECT.md]
- Supporting claims: [from argument-map.md]
- Evidence status: Not yet written

## Key Decisions
| Decision | Rationale | Section |
|----------|-----------|---------|

## Open Questions
- [Questions from PROJECT.md that need resolution]

## Deferred
- [Nothing yet]

## Session Continuity
- Last session: [date]
- Handoff: None

---
*Living document — updated after each writing session*
```

</step>

<step name="directories">
**Create section directories:**

```bash
mkdir -p .planning/sections
```

For each section in ROADMAP.md, create directory:

```bash
mkdir -p .planning/sections/01-[section-name-slug]
mkdir -p .planning/sections/02-[section-name-slug]
# ... for all sections
```

Use lowercase, hyphenated names (e.g., `01-introduction`, `02-methods`, `03-results`).

</step>

<step name="commit">
**Commit outline:**

```bash
git add .planning/ROADMAP.md .planning/STATE.md .planning/sections/
git commit -m "$(cat <<'EOF'
docs: create document outline

[N] sections, [X] word target

Sections: [list section names]
EOF
)"
```

</step>

<step name="done">
**Present completion:**

```
Outline created:

- Roadmap: .planning/ROADMAP.md ([N] sections, [X] words target)
- State: .planning/STATE.md
- Sections: .planning/sections/ ([N] directories)

## Section Structure

| # | Section | Words |
|---|---------|-------|
[table from ROADMAP.md]

---

## ▶ Next Up

**Section 1: [Name]** — [goal]

`/wtfp:plan-section 1`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/wtfp:discuss-section 1` — gather context first
- `/wtfp:research-gap 1` — investigate literature needs

---
```

</step>

</process>

<output>
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/sections/XX-name/` directories
</output>

<success_criteria>
- [ ] ROADMAP.md has all sections with goals and word targets
- [ ] STATE.md initialized with correct position
- [ ] Section directories created
- [ ] Word budget totals match target
- [ ] All committed to git
</success_criteria>
