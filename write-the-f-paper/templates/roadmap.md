# Roadmap Template

Template for `.planning/ROADMAP.md`.

## Initial Roadmap (Paper/Grant)

```markdown
# Roadmap: [Paper/Grant Title]

## Overview

[One paragraph describing the writing journey from outline to submission]

## Document Structure

**Type:** [IMRaD / Grant-NSF / Grant-NIH / Thesis Chapter / Custom]

**Target Length:** [Total word count or page limit]

## Domain Expertise

[Paths to domain knowledge that inform writing. These documents serve as indexes — during section planning, read them to find relevant context.]

- .planning/structure/argument-map.md
- .planning/structure/outline.md
- .planning/sources/literature.md

Or: None — new project

## Sections

**Section Numbering:**
- Integer sections (1, 2, 3): Planned document structure
- Decimal sections (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal sections appear between their surrounding integers in numeric order.

- [ ] **Section 1: [Name]** - [One-line description]
- [ ] **Section 2: [Name]** - [One-line description]
- [ ] **Section 3: [Name]** - [One-line description]
- [ ] **Section 4: [Name]** - [One-line description]

## Section Details

### Section 1: [Name]
**Goal**: [What this section accomplishes for the reader]
**Depends on**: Nothing (first section) or Argument map
**Research**: Unlikely (writing from notes) / Likely (need to read more literature)
**Plans**: [Number of writing plans, e.g., "2 plans" or "TBD"]
**Word budget**: [Target word count]

Plans:
- [ ] 01-01: [Brief description of first writing plan]
- [ ] 01-02: [Brief description of second writing plan]

### Section 2: [Name]
**Goal**: [What this section accomplishes]
**Depends on**: Section 1 (builds on introduction)
**Research**: Likely (methods need detail)
**Research topics**: [What needs investigating]
**Plans**: [Number of plans]
**Word budget**: [Target word count]

Plans:
- [ ] 02-01: [Brief description]
- [ ] 02-02: [Brief description]

### Section 2.1: Critical Addition (INSERTED)
**Goal**: [Urgent writing inserted between sections]
**Depends on**: Section 2
**Plans**: 1 plan

Plans:
- [ ] 2.1-01: [Description]

### Section 3: [Name]
**Goal**: [What this section accomplishes]
**Depends on**: Section 2
**Research**: Unlikely (reporting results)
**Plans**: [Number of plans]
**Word budget**: [Target word count]

Plans:
- [ ] 03-01: [Brief description]
- [ ] 03-02: [Brief description]

### Section 4: [Name]
**Goal**: [What this section accomplishes]
**Depends on**: Sections 1-3 (synthesis)
**Research**: Unlikely (interpretation)
**Plans**: [Number of plans]
**Word budget**: [Target word count]

Plans:
- [ ] 04-01: [Brief description]

## Word Budget

| Section | Target | Current | Status |
|---------|--------|---------|--------|
| Abstract | 250 | 0 | Not started |
| Introduction | 800 | 0 | Not started |
| Methods | 1200 | 0 | Not started |
| Results | 1500 | 0 | Not started |
| Discussion | 1200 | 0 | Not started |
| **Total** | **5000** | **0** | **0%** |

## Progress

**Execution Order:**
Sections execute in numeric order: 2 → 2.1 → 2.2 → 3 → 3.1 → 4

| Section | Plans Complete | Status | Completed |
|---------|----------------|--------|-----------|
| 1. [Name] | 0/2 | Not started | - |
| 2. [Name] | 0/2 | Not started | - |
| 3. [Name] | 0/2 | Not started | - |
| 4. [Name] | 0/1 | Not started | - |
```

<guidelines>
**Initial planning:**
- Section count depends on document structure (IMRaD: 5-6, Grant: varies by funder)
- Each section delivers a coherent argument
- Sections can have 1+ plans (split if complex or long)
- Plans use naming: {section}-{plan}-PLAN.md (e.g., 01-02-PLAN.md)
- Word budgets help pace writing
- Progress table updated by write workflow

**Research flags:**
- `Research: Likely` - Need to read more literature, verify facts, find citations
- `Research: Unlikely` - Writing from notes, existing data, established knowledge
- Include `Research topics:` when Likely
- Flags are hints, not mandates - validate at planning time

**After milestones (submissions) complete:**
- Collapse completed revision rounds in `<details>` tags
- Add new revision sections for upcoming work
- Keep continuous section numbering across revisions
</guidelines>

<status_values>
- `Not started` - Haven't begun
- `In progress` - Currently writing
- `Draft` - First pass complete, needs revision
- `Complete` - Done (add completion date)
- `Deferred` - Pushed to later (with reason)
</status_values>

## Grant-Specific Roadmap

For grant proposals, adapt the structure:

```markdown
# Roadmap: [Grant Title]

## Overview

[One paragraph describing the proposal journey from aims to submission]

## Document Structure

**Type:** Grant-NSF / Grant-NIH / [Other]
**Deadline:** [Submission date]
**Target Length:** [Page limit per section]

## Sections

- [ ] **Section 1: Specific Aims** - One-page summary of goals
- [ ] **Section 2: Significance** - Why this matters
- [ ] **Section 3: Innovation** - What's new
- [ ] **Section 4: Approach** - How we'll do it
- [ ] **Section 5: Timeline & Budget** - When and what resources

## Section Details

### Section 1: Specific Aims
**Goal**: Capture reviewer attention, state hypothesis and aims
**Depends on**: Approach must be planned first
**Word budget**: 1 page (350-400 words)
**Plans**: 1 plan

Plans:
- [ ] 01-01: Draft specific aims page

[...]
```
