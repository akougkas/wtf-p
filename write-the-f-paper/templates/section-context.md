# Section Context Template

Template for `.planning/SECTION-CONTEXT.md` - temporary handoff file from discuss-section to plan-section.

**Purpose:** Persist section discussion context so `/clear` can be used between commands. This file is consumed by `/wtfp:plan-section` and deleted after the plan is created.

---

## File Template

```markdown
# Section Context

**Generated:** [date]
**Status:** Ready for /wtfp:plan-section

<section_goal>
## Section Goal

[What this section should accomplish for the reader - identified during discussion]

**Section:** [Section number and name]
**Purpose:** [Why this section matters for the overall argument]
**Word budget:** [Target word count]

</section_goal>

<key_arguments>
## Key Arguments to Make

[Arguments identified during discussion - the substance of this section]

1. **[Argument 1]**: [How to support it]
2. **[Argument 2]**: [How to support it]
3. **[Argument 3]**: [How to support it]

</key_arguments>

<sources_to_use>
## Sources to Use

[Material available for this section]

**Literature:**
- [Citation 1]: [How to use it]
- [Citation 2]: [How to use it]

**Data:**
- [Figure/table 1]: [Where to place]
- [Figure/table 2]: [Where to place]

**Prior drafts:**
- [Material]: [What to incorporate]

</sources_to_use>

<structure_hints>
## Structure Hints

[Rough organization discussed with user]

- Opening: [What to establish first]
- Middle: [Main content flow]
- Closing: [How to conclude/transition]

</structure_hints>

<constraints>
## Constraints

[Any constraints or boundaries mentioned during discussion]

- [Constraint 1]
- [Constraint 2]

</constraints>

<notes>
## Additional Context

[Anything else captured during discussion that informs the section]

</notes>

---

*This file is temporary. It will be deleted after /wtfp:plan-section creates the plan.*
```

<guidelines>
**This is a handoff artifact, not permanent documentation.**

The file exists only to pass context from `discuss-section` to `plan-section` across a `/clear` boundary.

**Lifecycle:**
1. `/wtfp:discuss-section` creates this file at end of discussion
2. User runs `/clear` (safe now - context is persisted)
3. `/wtfp:plan-section` reads this file
4. `/wtfp:plan-section` uses context to create detailed plan
5. `/wtfp:plan-section` deletes this file after successful creation

**Content should include:**
- Section goal and purpose
- Key arguments to make
- Sources available (literature, data, prior drafts)
- Rough structure hints
- Constraints or boundaries
- Notes from discussion

**Content should NOT include:**
- Detailed paragraph structure (that comes during planning)
- Exact citations with page numbers (defer to writing)
- Final word allocations (planning refines these)
</guidelines>
