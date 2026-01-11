# PROJECT.md Template

Template for `.planning/PROJECT.md` — the living writing project context document.

<template>

```markdown
# [Paper/Grant Title]

## What This Is

[Current accurate description — 2-3 sentences. What type of document is this (journal paper, conference paper, grant proposal)?
What is the target venue? What is the core contribution? Update whenever scope drifts from this description.]

## Core Argument

[The ONE thesis statement that matters most. If everything else is forgotten, this claim must come through.
One sentence that drives all writing decisions when tradeoffs arise.]

## Requirements

### Must Have

<!-- Required elements that cannot be omitted. -->

- [ ] [Required section or element]
- [ ] [Page/word limit compliance]
- [ ] [Specific formatting requirements]
- [ ] [Required figures, tables, or data]

### Should Have

<!-- Desired elements that strengthen the paper but aren't strictly required. -->

- [ ] [Desired element 1]
- [ ] [Desired element 2]

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent scope creep. -->

- [Not covering X] — [why]
- [Excluding Y approach] — [why]

## Target Audience

[Who reads this? What do they already know? What do they care about?
Consider primary reviewers, secondary readers, and citation audience.]

## Constraints

- **Deadline**: [Submission date]
- **Length**: [Word/page limit]
- **Format**: [LaTeX template, journal style, etc.]
- **Data**: [Available data, missing data, IRB constraints]
- **Prior work**: [Related papers, prior drafts, dependencies]

## Key Decisions

<!-- Decisions that constrain future writing. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| [Choice] | [Why] | [✓ Good / ⚠️ Revisit / — Pending] |

---
*Last updated: [date] after [trigger]*
```

</template>

<guidelines>

**What This Is:**
- Current accurate description of the paper or grant
- 2-3 sentences capturing document type, venue, and contribution
- Use the writer's framing and language
- Update when scope evolves beyond this description

**Core Argument:**
- The single thesis statement
- Everything else can be cut; this cannot
- Drives prioritization when word count is tight
- Rarely changes; if it does, it's a significant reframing

**Requirements — Must Have:**
- Non-negotiable elements
- Journal/conference requirements
- Figures or data that are essential
- Format: `- [ ] [Requirement]`

**Requirements — Should Have:**
- Elements that strengthen but aren't required
- Move to Must Have if they become essential
- Move to Out of Scope if they're cut

**Requirements — Out of Scope:**
- Explicit boundaries on what the paper is NOT about
- Always include reasoning (prevents scope creep)
- Includes: considered and rejected, deferred to future work, explicitly excluded

**Target Audience:**
- Who will review this? What's their expertise level?
- Who will cite this? What problem are they solving?
- What background can you assume vs. must explain?

**Constraints:**
- Hard limits on the writing
- Deadline, page limit, format requirements
- Data availability, IRB constraints, prior commitments
- Include the "why" — constraints without rationale get questioned

**Key Decisions:**
- Significant choices that affect future writing
- Add decisions as they're made throughout the project
- Track outcome when known:
  - ✓ Good — decision proved correct
  - ⚠️ Revisit — decision may need reconsideration
  - — Pending — too early to evaluate

**Last Updated:**
- Always note when and why the document was updated
- Format: `after Section 2 draft` or `after reviewer feedback`
- Triggers review of whether content is still accurate

</guidelines>

<evolution>

PROJECT.md evolves throughout the writing lifecycle.

**After each section completion:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Must Have with section reference
3. New requirements emerged? → Add to appropriate category
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each revision cycle:**
1. Full review of all sections
2. Core Argument check — still the right thesis?
3. Audit Out of Scope — reasons still valid?
4. Update constraints (new deadline, changed limits)

</evolution>

<brownfield>

For papers with existing drafts:

1. **Map sources first** via `/wtfp:map-project`

2. **Infer Must Have requirements** from existing writing:
   - What sections already exist?
   - What figures/data are available?
   - What arguments are already made?

3. **Gather additional requirements** from user:
   - Present inferred current state
   - Ask what they want to accomplish

4. **Initialize:**
   - Must Have = elements from existing drafts
   - Should Have = user's goals for this revision
   - Out of Scope = boundaries user specifies
   - Constraints = includes prior draft state

</brownfield>

<state_reference>

STATE.md references PROJECT.md:

```markdown
## Project Reference

See: .planning/PROJECT.md (updated [date])

**Core argument:** [One-liner from Core Argument section]
**Current focus:** [Current section name]
```

This ensures Claude reads current PROJECT.md context.

</state_reference>
