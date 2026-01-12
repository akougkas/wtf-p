# Section Prompt Template

Template for `.planning/sections/XX-name/{section}-{plan}-PLAN.md` - executable section plans.

**Naming:** Use `{section}-{plan}-PLAN.md` format (e.g., `01-02-PLAN.md` for Section 1, Plan 2)

---

## File Template

```markdown
---
section: XX-name
type: write
writing-mode: [co-author | scaffold | reviewer]
---

<objective>
[What this section accomplishes for the reader - from roadmap section goal]

Purpose: [Why this section matters for the overall argument]
Output: [What artifacts will be created - draft text, citations, figures]
Word target: [Target word count for this plan]
</objective>

<execution_context>
~/.claude/write-the-f-paper/workflows/write-section.md
./summary.md
[If plan contains checkpoint tasks (type="checkpoint:*"), add:]
~/.claude/write-the-f-paper/references/checkpoints.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/structure/argument-map.md
[If section context exists:]
@.planning/sections/XX-name/CONTEXT.md
[If prior sections relevant:]
@.planning/sections/YY-name/{section}-SUMMARY.md
[Relevant source files:]
@.planning/sources/literature.md
@paper/prior-section.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: [Action-oriented name]</name>
  <output>paper/section-name.md (paragraphs X-Y)</output>
  <action>[Specific writing action - what to write, what argument to make, what to avoid and WHY]</action>
  <sources>[Citations to use, data to reference]</sources>
  <verify>[How to verify quality - read aloud, check argument flow]</verify>
  <done>[Measurable acceptance criteria - word count, claims made, citations included]</done>
</task>

<task type="auto">
  <name>Task 2: [Action-oriented name]</name>
  <output>paper/section-name.md (paragraphs X-Y)</output>
  <action>[Specific writing action]</action>
  <sources>[Citations to use]</sources>
  <verify>[Quality check]</verify>
  <done>[Acceptance criteria]</done>
</task>

<task type="checkpoint:decision" gate="blocking">
  <decision>[What needs deciding - framing, emphasis, structure]</decision>
  <context>[Why this decision matters for the argument]</context>
  <options>
    <option id="option-a">
      <name>[Option name]</name>
      <pros>[Benefits for the argument]</pros>
      <cons>[Tradeoffs and limitations]</cons>
    </option>
    <option id="option-b">
      <name>[Option name]</name>
      <pros>[Benefits for the argument]</pros>
      <cons>[Tradeoffs and limitations]</cons>
    </option>
  </options>
  <resume-signal>[How to indicate choice - "Select: option-a or option-b"]</resume-signal>
</task>

<task type="auto">
  <name>Task 3: [Action-oriented name]</name>
  <output>paper/section-name.md, references.bib</output>
  <action>[Specific writing action]</action>
  <sources>[Citations to use]</sources>
  <verify>[Quality check]</verify>
  <done>[Acceptance criteria]</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-written>[What Claude just wrote that needs verification]</what-written>
  <how-to-verify>
    1. Read: [Section to review]
    2. Check: [Specific elements to verify]
    3. Verify: [Accuracy of claims, citations]
    4. Confirm: [Argument flows logically]
  </how-to-verify>
  <resume-signal>Type "approved" to continue, or describe issues to fix</resume-signal>
</task>

[Continue for all tasks - mix of auto and checkpoints as needed...]

</tasks>

<verification>
Before declaring section complete:
- [ ] Word count within target (+/- 10%)
- [ ] All claims have supporting evidence/citations
- [ ] Argument flows logically paragraph to paragraph
- [ ] No unsupported assertions
- [ ] [Section-specific criteria]
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- Word count: [X-Y] words
- Citations: All claims supported
- [Section-specific criteria]
</success_criteria>

<output>
After completion, create `.planning/sections/XX-name/{section}-{plan}-SUMMARY.md`:

# Section [X] Plan [Y]: [Name] Summary

**[Substantive one-liner - what argument was made, not "section complete"]**

## Accomplishments

- [Key argument established]
- [Key argument established]

## Word Count

Target: [X] | Actual: [Y] | Delta: [+/-Z]

## Key Claims Made

- [Claim 1] - supported by [evidence]
- [Claim 2] - supported by [evidence]

## Citations Added

- Author (Year): [context]
- Author (Year): [context]

## Decisions Made

[Key decisions and rationale, or "None"]

## Issues Encountered

[Problems and resolutions, or "None"]

## Next Step

[If more plans in this section: "Ready for {section}-{next-plan}-PLAN.md"]
[If section complete: "Section complete, ready for next section"]
</output>
```

<key_elements>
From create-meta-prompts patterns:

- XML structure for Claude parsing
- @context references for file loading
- Task types: auto, checkpoint:human-action, checkpoint:human-verify, checkpoint:decision
- Action includes "what to avoid and WHY" (from intelligence-rules)
- Verification is specific to writing quality
- Success criteria includes word count and argument quality
- Output specification includes SUMMARY.md structure
</key_elements>

<scope_guidance>
**Plan sizing:**

- Aim for 2-3 tasks per plan
- If planning >3 tasks, split into multiple plans (01-01, 01-02, etc.)
- Target ~50% context usage maximum
- Complex sections: Create 01-01, 01-02, 01-03 plans instead of one large plan

**When to split:**

- Different argument threads (background vs contribution)
- Clear dependency boundaries (draft → revise → polish)
- Risk of context overflow (>50% estimated usage)
- Long sections that exceed word budget in single session
</scope_guidance>

<writing_modes>
**Writing mode affects task structure:**

**Co-author mode** (Claude drafts):
- Tasks produce full prose
- User reviews and refines
- Best for: Methods, background, boilerplate

**Scaffold mode** (Claude outlines):
- Tasks produce detailed outlines
- User writes prose from outline
- Best for: Results interpretation, discussion

**Reviewer mode** (Claude critiques):
- Tasks analyze existing draft
- Produces suggestions, not prose
- Best for: Polish, revision, argument strengthening
</writing_modes>

<good_examples>

```markdown
---
section: 01-introduction
type: write
writing-mode: co-author
---

<objective>
Write the introduction section establishing the research gap and our contribution.

Purpose: Hook readers, establish context, identify gap, state contribution, preview structure.
Output: paper/01-introduction.md, citations in references.bib
Word target: 800 words
</objective>

<execution_context>
~/.claude/write-the-f-paper/workflows/write-section.md
./summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/structure/argument-map.md
@.planning/sections/01-introduction/CONTEXT.md
@.planning/sources/literature.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write opening hook and context</name>
  <output>paper/01-introduction.md (paragraphs 1-2)</output>
  <action>Open with a compelling hook that illustrates the problem we're solving. Follow with 1-2 paragraphs establishing the context: what exists in the field, what people have been doing, why it matters. Use narrative style, not list of citations. Avoid jargon-heavy opening - make it accessible.</action>
  <sources>Smith (2023) for proliferation stats, Jones (2024) for usage patterns</sources>
  <verify>Read aloud - does it hook attention? Does context flow naturally?</verify>
  <done>~200 words, 2 paragraphs, 2-3 citations integrated naturally</done>
</task>

<task type="auto">
  <name>Task 2: Identify the gap and state contribution</name>
  <output>paper/01-introduction.md (paragraphs 3-4)</output>
  <action>Transition from "what exists" to "what's missing." Clearly articulate the gap in current understanding/practice. Then state our contribution - what this paper provides. Use "However..." or "Yet..." for transition. Be specific about contribution - not "we explore X" but "we provide the first framework for Y."</action>
  <sources>Brown (2023) for gap support, our prior work if applicable</sources>
  <verify>Gap clearly stated? Contribution specific and falsifiable?</verify>
  <done>~300 words, gap + contribution clear, positioned against literature</done>
</task>

<task type="auto">
  <name>Task 3: Preview paper structure</name>
  <output>paper/01-introduction.md (paragraph 5)</output>
  <action>Brief roadmap of paper structure. "This paper proceeds as follows..." or similar. Keep concise - one sentence per section maximum. End on forward momentum.</action>
  <sources>None needed</sources>
  <verify>All major sections mentioned? Concise?</verify>
  <done>~100 words, all sections previewed, reads smoothly</done>
</task>

</tasks>

<verification>
Before declaring section complete:
- [ ] Word count: 750-850 words
- [ ] Hook engages reader in first paragraph
- [ ] Gap clearly articulated
- [ ] Contribution is specific and testable
- [ ] All claims have citations
- [ ] Paper structure previewed
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- Word count: 750-850 words
- Citations: 4-6 integrated naturally
- Introduction sets up rest of paper clearly
</success_criteria>

<output>
After completion, create `.planning/sections/01-introduction/01-01-SUMMARY.md`
</output>
```

</good_examples>

<bad_examples>

```markdown
# Section 1: Introduction

## Tasks

### Task 1: Write introduction

**Action**: Write the introduction
**Done when**: Introduction is written
```

This is useless. No XML structure, no @context, no verification, no specificity.
</bad_examples>

<guidelines>
**When to use:**
- Creating writing plans for each section
- One plan per 2-3 tasks, multiple plans per section if needed
- Always use XML structure for Claude parsing

**Task types:**

- `type="auto"`: Write without stopping
- `type="checkpoint:human-action"`: User must do something (gather data, check source)
- `type="checkpoint:human-verify"`: User must verify output (accuracy, argument quality)
- `type="checkpoint:decision"`: User must choose between approaches

**Gate values:**

- `gate="blocking"`: Must resolve before continuing
- `gate="optional"`: Can skip or defer

**Context references:**

- Use @path/to/file.md to load files
- Always include @.planning/PROJECT.md and @.planning/ROADMAP.md
- Include argument-map.md for coherence
- Include relevant source files (literature, prior sections)
- Include workflow/template references

**After completion:**

- Create SUMMARY.md in same directory
- Follow summary.md template structure
- Document word count, citations, decisions, issues
</guidelines>
