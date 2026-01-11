# Summary Template

Template for `.planning/sections/XX-name/{section}-{plan}-SUMMARY.md` - section completion documentation.

---

## File Template

```markdown
---
section: XX-name
plan: YY
document-type: [paper | grant | thesis]
tags: [searchable: methods, results, discussion, claims, evidence]

# Dependency graph
requires:
  - section: [prior section this depends on]
    provides: [what that section established that this uses]
provides:
  - [bullet list of what this section contributes to the argument]
affects: [list of section names that will need this context]

# Writing tracking
word-count:
  target: [planned words]
  actual: [words written]
  delta: [+/- difference]

key-claims:
  - "Claim 1"
  - "Claim 2"

citations-added:
  - "author2023: context"
  - "author2022: context"

issues-created: [ISS-XXX, ISS-YYY] # From ISSUES.md if any

# Metrics
duration: Xmin
completed: YYYY-MM-DD
---

# Section [X]: [Name] Summary

**[Substantive one-liner describing what this section argues - NOT "section complete" or "writing finished"]**

## Performance

- **Duration:** [time] (e.g., 23 min, 1h 15m)
- **Started:** [ISO timestamp]
- **Completed:** [ISO timestamp]
- **Word count:** [actual] / [target] ([+/-] [delta])
- **Tasks:** [count completed]

## Accomplishments
- [Most important argument established]
- [Second key accomplishment]
- [Third if applicable]

## Key Claims Made

The section establishes these claims:

1. **[Claim 1]** — supported by [evidence/citation]
2. **[Claim 2]** — supported by [evidence/citation]
3. **[Claim 3]** — supported by [evidence/citation]

## Citations Added

| Citation | Where Used | Purpose |
|----------|------------|---------|
| Author (Year) | Para X | [Why cited] |
| Author (Year) | Para Y | [Why cited] |

## Task Commits

Each task was committed atomically:

1. **Task 1: [task name]** - `abc123f` (draft/revise/cite/polish)
2. **Task 2: [task name]** - `def456g` (draft/revise/cite/polish)
3. **Task 3: [task name]** - `hij789k` (draft/revise/cite/polish)

**Plan metadata:** `lmn012o` (docs: complete plan)

## Files Created/Modified
- `paper/section-name.md` - What was written
- `references.bib` - Citations added

## Decisions Made
[Key decisions with brief rationale, or "None - followed plan as specified"]

## Deviations from Plan

[If no deviations: "None - plan executed exactly as written"]

[If deviations occurred:]

### Auto-fixed Issues

**1. [Rule X - Category] Brief description**
- **Found during:** Task [N] ([task name])
- **Issue:** [What was wrong]
- **Fix:** [What was done]
- **Text modified:** [paragraph/section affected]
- **Verification:** [How it was verified]
- **Committed in:** [hash] (part of task commit)

[... repeat for each auto-fix ...]

### Deferred Enhancements

Logged to .planning/ISSUES.md for future consideration:
- ISS-XXX: [Brief description] (discovered in Task [N])
- ISS-XXX: [Brief description] (discovered in Task [N])

---

**Total deviations:** [N] auto-fixed ([breakdown by rule]), [N] deferred
**Impact on plan:** [Brief assessment - e.g., "All auto-fixes necessary for accuracy. No scope creep."]

## Issues Encountered
[Problems and how they were resolved, or "None"]

[Note: "Deviations from Plan" documents unplanned work that was handled automatically via deviation rules. "Issues Encountered" documents problems during planned work that required problem-solving.]

## Next Section Readiness
[What's ready for next section]
[Any blockers or concerns]

---
*Section: XX-name*
*Completed: [date]*
```

<frontmatter_guidance>
**Purpose:** Enable automatic context assembly via dependency graph. Frontmatter makes summary metadata machine-readable so plan-section can scan all summaries quickly and select relevant ones based on dependencies.

**Fast scanning:** Frontmatter is first ~25 lines, cheap to scan across all summaries without reading full content.

**Dependency graph:** `requires`/`provides`/`affects` create explicit links between sections, enabling transitive closure for context selection.

**Word count tracking:** Tracks progress against word budget.

**Key claims:** The arguments this section establishes (enables coherence checking).

**Citations:** What sources were added (enables citation check).

**Issues:** ISS-XXX numbers for deferred items.

**Population:** Frontmatter is populated during summary creation in write-section.md. See `<step name="create_summary">` for field-by-field guidance.
</frontmatter_guidance>

<one_liner_rules>
The one-liner MUST be substantive:

**Good:**
- "Establishes three-factor model for academic writing productivity"
- "Methods section with participant demographics, protocol, and analysis approach"
- "Discussion synthesizes findings with prior literature, addresses limitations"

**Bad:**
- "Section complete"
- "Introduction written"
- "Discussion finished"
- "All tasks done"

The one-liner should tell someone what argument the section makes.
</one_liner_rules>

<example>
```markdown
# Section 1: Introduction Summary

**Establishes research gap in AI-assisted writing tools and positions our contribution as the first systematic framework**

## Performance

- **Duration:** 45 min
- **Started:** 2025-01-15T14:22:10Z
- **Completed:** 2025-01-15T15:07:33Z
- **Word count:** 847 / 800 (+47)
- **Tasks:** 4

## Accomplishments
- Established context of AI writing tools proliferation
- Identified gap: no systematic framework for academic use
- Stated thesis: need for discipline-specific AI integration
- Previewed paper structure

## Key Claims Made

1. **AI writing tools are proliferating but usage is ad hoc** — supported by Smith (2023), Jones (2024)
2. **Academic writing has unique constraints** — supported by Author (2022) + our argument
3. **A framework would improve adoption and outcomes** — logical argument from gaps

## Citations Added

| Citation | Where Used | Purpose |
|----------|------------|---------|
| Smith (2023) | Para 1 | Context on AI tool proliferation |
| Jones (2024) | Para 2 | Survey of current usage patterns |
| Author (2022) | Para 3 | Academic writing constraints |
| Brown (2023) | Para 4 | Gap identification support |

## Files Created/Modified
- `paper/01-introduction.md` - Full introduction draft
- `references.bib` - 4 citations added

## Decisions Made
- Used narrative hook (researcher frustration story) rather than statistics opening
- Positioned paper as "framework" not "tool" to emphasize conceptual contribution

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered
- Struggled with transition between gap and contribution; resolved by adding explicit "Therefore" connector

## Next Section Readiness
- Introduction sets up methods section clearly
- Literature review context will be expanded in Related Work

---
*Section: 01-introduction*
*Completed: 2025-01-15*
```
</example>

<guidelines>
**When to create:**
- After completing each section plan
- Required output from write-section workflow
- Documents what actually happened vs what was planned

**Frontmatter completion:**
- MANDATORY: Complete all frontmatter fields during summary creation
- See <frontmatter_guidance> for field purposes
- Frontmatter enables automatic context assembly for future planning

**One-liner requirements:**
- Must be substantive (describe what argument was made, not "section complete")
- Should tell someone what was accomplished
- Examples: "Establishes three-factor model" not "Methods written"

**Performance tracking:**
- Include duration, start/end timestamps
- Include word count vs target
- Used for velocity metrics in STATE.md

**Key claims tracking:**
- List the main claims/arguments the section makes
- Include evidence/citation for each
- Enables coherence checking across sections

**Citations tracking:**
- List citations added with context
- Enables citation check verification

**Deviations section:**
- Documents unplanned work handled via deviation rules
- Separate from "Issues Encountered" (which is planned work problems)
- Auto-fixed issues: What was wrong, how fixed, verification
- Deferred enhancements: Logged to ISSUES.md with ISS-XXX numbers

**Decisions section:**
- Key decisions made during writing
- Include rationale (why this choice)
- Extracted to STATE.md accumulated context
- Use "None - followed plan as specified" if no deviations

**After creation:**
- STATE.md updated with position, word count, decisions, issues
- Next plan can reference decisions made
</guidelines>
