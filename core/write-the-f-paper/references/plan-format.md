<overview>
Claude-executable writing plans have a specific format that enables Claude to write without interpretation. This reference defines what makes a plan executable vs. vague.

**Key insight:** PLAN.md IS the executable prompt. It contains everything Claude needs to write the section, including objective, context references, tasks, verification, success criteria, and output specification.
</overview>

<core_principle>
A plan is Claude-executable when Claude can read the PLAN.md and immediately start writing without asking clarifying questions.

If Claude has to guess the argument, tone, or what to include - the task is too vague.
</core_principle>

<prompt_structure>
Every PLAN.md follows this XML structure:

```markdown
---
section: XX-name
plan: YY
mode: [co-author/scaffold/reviewer]
word_target: [X]
---

<objective>
[What section/content and why]
Purpose: [What reader will understand]
Output: [Word count] words covering [topics]
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/structure/argument-map.md
@.planning/sources/literature.md
</context>

<tasks>
<task type="auto" mode="co-author">
  <name>Task N: [Name]</name>
  <target>[word count]</target>
  <action>[what to write, key points, tone]</action>
  <verify>[how to check]</verify>
  <done>[criteria]</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-written>[what Claude drafted]</what-written>
  <how-to-verify>[what to check - argument, voice, accuracy]</how-to-verify>
  <resume-signal>[how to continue - "approved" or describe issues]</resume-signal>
</task>

<task type="checkpoint:decision" gate="blocking">
  <decision>[content direction choice]</decision>
  <context>[why this matters]</context>
  <options>
    <option id="option-a"><name>[Name]</name><pros>[pros]</pros><cons>[cons]</cons></option>
    <option id="option-b"><name>[Name]</name><pros>[pros]</pros><cons>[cons]</cons></option>
  </options>
  <resume-signal>[how to indicate choice]</resume-signal>
</task>
</tasks>

<verification>
[Overall section checks]
</verification>

<success_criteria>
[Measurable completion]
</success_criteria>

<output>
[SUMMARY.md specification]
</output>
```

</prompt_structure>

<task_anatomy>
Every writing task has required fields:

<field name="target">
**What it is**: Word count goal for this task.

**Good**: `~200 words`, `150-200 words`
**Bad**: "a paragraph", "some text"

Be specific about length.
</field>

<field name="action">
**What it is**: Specific writing instructions, including key points and tone.

**Good**: "Write opening paragraph establishing the research gap. Key points: (1) current methods fail at X, (2) this matters because Y, (3) hint at our approach. Tone: confident but not dismissive of prior work. Cite Smith2023 and Jones2022."

**Bad**: "Write the introduction", "Explain the problem"

Include: key arguments, evidence to use, citations to include, tone guidance.
</field>

<field name="verify">
**What it is**: How to check the writing is complete.

**Good**:
- Word count within target range
- All key points addressed
- Citations included
- Flows from previous content

**Bad**: "It's good", "Sounds academic"

Must be checkable without subjective judgment.
</field>

<field name="done">
**What it is**: Acceptance criteria - the measurable state of completion.

**Good**: "~200 words establishing research gap, cites Smith2023 and Jones2022, transitions to thesis statement"

**Bad**: "Introduction is written"

Should be verifiable.
</field>
</task_anatomy>

<task_modes>
Tasks have a `mode` attribute for writing approach:

<mode name="co-author">
**Claude drafts, user refines**

```xml
<task type="auto" mode="co-author">
  <name>Draft methods overview</name>
  <target>300 words</target>
  <action>
    Write methods section overview covering:
    - Study design (randomized controlled trial)
    - Participants (N=150, recruited from...)
    - Key procedures (3 phases over 6 weeks)
    Tone: precise, replicable detail level
  </action>
  <verify>300 ±30 words, all three areas covered</verify>
  <done>Methods overview ready for user refinement</done>
</task>
```

Use for: Methods, procedures, boilerplate, initial drafts.
</mode>

<mode name="scaffold">
**Claude outlines, user fills**

```xml
<task type="auto" mode="scaffold">
  <name>Create results section outline</name>
  <target>outline + placeholder text</target>
  <action>
    Create detailed outline for results section:
    - Main finding 1: [placeholder for specific result]
    - Main finding 2: [placeholder for specific result]
    - Supporting analyses: [placeholder]
    Include: structure, key points to make, suggested citations
    Do NOT write full prose - user will fill
  </action>
  <verify>Outline has clear structure, all findings have placeholders</verify>
  <done>Outline ready for user to fill with specific results</done>
</task>
```

Use for: Results (user knows specifics), arguments requiring judgment.
</mode>

<mode name="reviewer">
**User writes, Claude critiques**

```xml
<task type="auto" mode="reviewer">
  <name>Review user's abstract draft</name>
  <action>
    Read user's abstract and provide feedback on:
    1. Is the problem clearly stated?
    2. Is the method summarized adequately?
    3. Are findings specific (not vague)?
    4. Is the contribution clear?
    5. Word count appropriate for venue?

    Use Socratic questions, not prescriptive fixes.
  </action>
  <verify>Feedback addresses all 5 areas</verify>
  <done>User has actionable feedback to improve abstract</done>
</task>
```

Use for: Abstract, discussion, conclusions, voice-critical sections.
</mode>
</task_modes>

<checkpoint_types>

**checkpoint:human-verify** (90%)
Human confirms writing captures intent.

```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-written>Introduction opening (~200 words)</what-written>
  <how-to-verify>
    1. Does this capture the research gap accurately?
    2. Is the tone right for your target venue?
    3. Any factual errors?
  </how-to-verify>
  <resume-signal>Type "approved" or describe changes needed</resume-signal>
</task>
```

**checkpoint:decision** (9%)
Human chooses content direction.

```xml
<task type="checkpoint:decision" gate="blocking">
  <decision>Framing of contribution</decision>
  <context>Two valid ways to position your work.</context>
  <options>
    <option id="novel"><name>Emphasize novelty</name><pros>Highlights contribution</pros><cons>May invite scrutiny</cons></option>
    <option id="extend"><name>Frame as extension</name><pros>Builds on established work</pros><cons>May seem incremental</cons></option>
  </options>
  <resume-signal>Select: novel or extend</resume-signal>
</task>
```

**checkpoint:human-action** (1% - rare)
User provides information Claude can't know.

```xml
<task type="checkpoint:human-action" gate="blocking">
  <action>Provide specific experimental result</action>
  <instructions>I need the exact p-value and effect size to complete this sentence.</instructions>
  <resume-signal>Provide: p-value and effect size</resume-signal>
</task>
```

</checkpoint_types>

<context_references>
Use @file references to load context:

```markdown
<context>
@.planning/PROJECT.md           # Paper vision and thesis
@.planning/ROADMAP.md           # Section structure
@.planning/structure/argument-map.md  # Claims and evidence
@.planning/structure/outline.md       # Section skeleton
@.planning/sources/literature.md      # Citations available
@.planning/sections/01-intro/01-01-SUMMARY.md  # Prior section
</context>
```

Reference files Claude needs before writing.
</context_references>

<verification_section>
Overall section verification:

```markdown
<verification>
Before declaring section complete:
- [ ] Word count: [target] ±10%
- [ ] All key arguments from argument-map addressed
- [ ] Citations included where claims made
- [ ] Logical flow maintained
- [ ] Connects to prior/next sections
</verification>
```

</verification_section>

<specificity_levels>
<too_vague>

```xml
<task type="auto" mode="co-author">
  <name>Write introduction</name>
  <target>???</target>
  <action>Write the introduction</action>
  <verify>???</verify>
  <done>Introduction is written</done>
</task>
```

Claude: "What's the argument? What to cite? What tone?"
</too_vague>

<just_right>

```xml
<task type="auto" mode="co-author">
  <name>Draft introduction hook and problem statement</name>
  <target>200 words</target>
  <action>
    Write opening that:
    1. Opens with compelling hook about [topic]
    2. Establishes current state of field (cite Smith2023)
    3. Identifies the gap: [specific gap]
    4. Stakes: why this matters for [audience]

    Tone: Confident, not hedging. Direct statements.
    End with transition to next paragraph (thesis preview).
  </action>
  <verify>~200 words, all 4 points addressed, Smith2023 cited</verify>
  <done>Opening establishes gap, ready for thesis statement</done>
</task>
```

Claude can write this immediately.
</just_right>

<too_detailed>
Writing the actual prose in the plan. Trust Claude to write from clear instructions.
</too_detailed>
</specificity_levels>

<anti_patterns>
<vague_actions>

- "Write about the topic"
- "Explain the methodology"
- "Discuss the results"
- "Add some analysis"

These require Claude to decide WHAT to write. Specify it.
</vague_actions>

<unverifiable_completion>

- "It reads well"
- "The argument is strong"
- "Academic enough"
- "Good flow"

These require subjective judgment. Make it objective.
</unverifiable_completion>

<missing_context>

- "Use appropriate citations"
- "Follow academic conventions"
- "Match the paper's style"

Claude doesn't know your style. Be explicit.
</missing_context>
</anti_patterns>

<sizing_tasks>
Good task size: One paragraph cluster or argument unit.

**Too small**: "Write topic sentence" (combine with paragraph)
**Just right**: "Draft opening paragraph establishing research gap" (focused, specific)
**Too big**: "Write entire introduction" (split into paragraph-level tasks)

If a section is >500 words, break into multiple tasks.
If a task is one sentence, combine with related tasks.
</sizing_tasks>
