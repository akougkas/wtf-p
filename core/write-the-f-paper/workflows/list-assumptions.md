<purpose>
Surface Claude's assumptions about a section before planning, enabling users to
correct misconceptions early.

Key difference from discuss-section: This is ANALYSIS of what Claude thinks,
not INTAKE of what user knows. No file output - purely conversational to prompt discussion.
</purpose>

<process>

<step name="validate_section" priority="first">
Section number: $ARGUMENTS (required)

**If argument missing:**

```
Error: Section number required.

Usage: /wtfp:list-assumptions [section-number]
Example: /wtfp:list-assumptions 3
```

Exit workflow.

**If argument provided:**
Validate section exists in roadmap:

```bash
cat .planning/ROADMAP.md | grep -i "Section ${SECTION}"
```

**If section not found:**

```
Error: Section ${SECTION} not found in roadmap.

Available sections:
[list sections from roadmap]
```

Exit workflow.

**If section found:**
Parse section details from roadmap:

- Section number
- Section name
- Section description/goal
- Word budget
- Any scope details mentioned

Continue to analyze_section.
</step>

<step name="analyze_section">
Based on roadmap description and project context, identify assumptions across five areas:

**1. Content Approach:**
What content would Claude include in this section?
- "I'd cover X because..."
- "I'd emphasize Y because..."
- "I'd structure this as Z because..."

**2. Writing Order:**
What would Claude write first, second, third?
- "I'd start with X because it sets up the reader"
- "Then Y because it follows logically"
- "Finally Z because..."

**3. Scope Boundaries:**
What's included vs excluded in Claude's interpretation?
- "This section includes: A, B, C"
- "This section does NOT include: D, E, F"
- "Boundary ambiguities: G could go either way"

**4. Challenging Areas:**
Where does Claude expect difficulty?
- "The tricky part is X because..."
- "Potential challenges: Y, Z"
- "I'd watch out for..."

**5. Dependencies:**
What does Claude assume is in place or needed?
- "This assumes X from previous sections"
- "This needs sources on: Y, Z"
- "This will set up: [future sections]"

Be honest about uncertainty. Mark assumptions with confidence levels:
- "Fairly confident: ..." (clear from roadmap)
- "Assuming: ..." (reasonable inference)
- "Unclear: ..." (could go multiple ways)
</step>

<step name="present_assumptions">
Present assumptions in a clear, scannable format:

```
## My Assumptions for Section ${SECTION}: ${SECTION_NAME}

### Content Approach
[List assumptions about what to write]

### Writing Order
[List assumptions about sequencing paragraphs/subsections]

### Scope Boundaries
**In scope:** [what's included]
**Out of scope:** [what's excluded]
**Ambiguous:** [what could go either way]

### Challenging Areas
[List anticipated challenges]

### Dependencies
**From prior sections:** [what's needed]
**Sources needed:** [literature/data requirements]
**Sets up:** [what future sections need from this]

---

**What do you think?**

Are these assumptions accurate? Let me know:
- What I got right
- What I got wrong
- What I'm missing
```

Wait for user response.
</step>

<step name="gather_feedback">
**If user provides corrections:**

Acknowledge the corrections:

```
Got it. Key corrections:
- [correction 1]
- [correction 2]

This changes my understanding. [Summarize new understanding]
```

**If user confirms assumptions:**

```
Great, assumptions validated.
```

Continue to offer_next.
</step>

<step name="offer_next">
Present next steps:

```
What's next?
1. Discuss context (/wtfp:discuss-section ${SECTION}) - Let me ask you questions to build comprehensive context
2. Plan this section (/wtfp:plan-section ${SECTION}) - Create detailed writing plans
3. Research literature (/wtfp:research-gap [topic]) - Investigate sources needed
4. Re-examine assumptions - I'll analyze again with your corrections
5. Done for now
```

Wait for user selection.

If "Discuss context": Note that CONTEXT.md will incorporate any corrections discussed here
If "Plan this section": Proceed knowing assumptions are understood
If "Research literature": Route to research-gap workflow
If "Re-examine": Return to analyze_section with updated understanding
</step>

</process>

<success_criteria>
- Section number validated against roadmap
- Assumptions surfaced across five areas: content approach, writing order, scope, challenges, dependencies
- Confidence levels marked where appropriate
- "What do you think?" prompt presented
- User feedback acknowledged
- Clear next steps offered
</success_criteria>
