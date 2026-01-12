# Section Context Template

Template for `.planning/sections/XX-name/{section}-CONTEXT.md` - captures the user's vision for a section.

**Purpose:** Document how the user imagines the section working. This is vision context, not technical analysis. Research details come from the research workflow.

---

## File Template

```markdown
# Section [X]: [Name] - Context

**Gathered:** [date]
**Status:** [Ready for research / Ready for planning]

<vision>
## How This Section Should Work

[User's description of how they imagine this section functioning for the reader. What should the reader understand after reading it? What's the "story" of this section? This is the "pitch" version, not the detailed outline.]

</vision>

<essential>
## What Must Be Nailed

[The core of this section. If we only get one thing right, what is it? What's the non-negotiable that makes this section successful?]

- [Essential thing 1]
- [Essential thing 2]
- [Essential thing 3 if applicable]

</essential>

<boundaries>
## What's Out of Scope

[Explicit exclusions for this section. What are we NOT covering? Where does this section end and the next begin?]

- [Not covering X - that's Section Y]
- [Not including Z - deferred to future work]
- [Explicitly excluding W]

</boundaries>

<specifics>
## Specific Ideas

[Any particular things the user has in mind. References to papers they like. Specific arguments or evidence to include. "I want it to flow like X paper" or "The key evidence is Y."]

[If none: "No specific requirements - open to standard approaches"]

</specifics>

<sources>
## Available Sources

[What material the user has available for this section]

- Literature: [Key papers to cite]
- Data: [Figures, tables, statistics available]
- Prior drafts: [Existing text to incorporate]

</sources>

<notes>
## Additional Context

[Anything else captured during the discussion that doesn't fit above. User's priorities, concerns mentioned, relevant background.]

[If none: "No additional notes"]

</notes>

---

*Section: XX-name*
*Context gathered: [date]*
```

<good_examples>
```markdown
# Section 3: Methods - Context

**Gathered:** 2025-01-20
**Status:** Ready for research

<vision>
## How This Section Should Work

When reviewers read this methods section, they should feel confident they could replicate the study. I want it to feel rigorous but not tedious - every detail should earn its place. The flow should be: who participated, what they did, and how we analyzed it.

The section should anticipate reviewer questions about validity and address them preemptively.

</vision>

<essential>
## What Must Be Nailed

- **Reproducibility** - Someone could replicate this study from the methods alone
- **Validity** - Address potential confounds and how we controlled for them
- **Ethical compliance** - IRB approval and participant consent clear

</essential>

<boundaries>
## What's Out of Scope

- Detailed results (just analysis approach here)
- Extended rationale for method choices (brief is fine)
- Preliminary/pilot study details (not relevant)

</boundaries>

<specifics>
## Specific Ideas

- I like how Smith (2023) structured their participant section - demographics first, then inclusion criteria
- We should include the exact prompt text used (reviewer always asks)
- The analysis follows Cohen's framework - cite appropriately

</specifics>

<sources>
## Available Sources

- Literature: Cohen (2020) for analysis framework, Smith (2023) for structure example
- Data: Participant demographics table ready, Figure 2 (study flow) ready
- Prior drafts: Had a rough methods draft in proposal - reusable but needs expansion

</sources>

<notes>
## Additional Context

User is worried reviewers will question the sample size (N=45). Need to address power analysis or limitation. Also mentioned that the IRB number is #2024-0123 (needs to appear in text).

</notes>

---

*Section: 03-methods*
*Context gathered: 2025-01-20*
```
</good_examples>

<guidelines>
**This template captures VISION, not detailed outlines.**

The user is the visionary. They know:
- How they imagine the section working for readers
- What it should accomplish
- What's essential vs nice-to-have
- References to papers they like
- Sources they have available

The user does NOT know (and shouldn't be asked):
- Exact paragraph structure (Claude figures out during planning)
- Citation formatting (Claude handles)
- Transitions between paragraphs (Claude writes)
- Word allocation within section (Claude calculates)

**Content should read like:**
- A researcher describing what they want the section to do
- "When readers finish this section, they should understand..."
- "The most important thing to convey is..."
- "I want this to feel like Smith's methods, not Jones's"

**Content should NOT read like:**
- A paragraph-by-paragraph outline
- A list of citations to include
- Word count targets
- Detailed structure

**After creation:**
- File lives in section directory: `.planning/sections/XX-name/{section}-CONTEXT.md`
- Research phase adds investigation results if needed
- Planning phase creates executable tasks informed by both vision AND research
</guidelines>
