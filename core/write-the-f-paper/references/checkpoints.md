<overview>
Writing plans execute with Claude as partner. Checkpoints formalize interaction points where human verification or decisions are needed.

**Core principle:** Claude assists with writing. Checkpoints are for verification and decisions about content direction.
</overview>

<checkpoint_types>

## checkpoint:human-verify (90% of checkpoints)

**When:** Claude completed a writing task, human confirms it captures their intent.

**Use for:** Argument accuracy, voice consistency, factual correctness, citation appropriateness, logical flow.

**Structure:**
```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-written>[What Claude drafted]</what-written>
  <how-to-verify>[What to check - argument, tone, accuracy]</how-to-verify>
  <resume-signal>[How to continue - "approved" or describe issues]</resume-signal>
</task>
```

**Example:**
```xml
<task type="auto" mode="co-author">
  <name>Draft introduction hook</name>
  <action>Write opening paragraph establishing the problem</action>
  <verify>~150 words, establishes tension</verify>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-written>Introduction opening paragraph (~150 words)</what-written>
  <how-to-verify>
    Review and confirm:
    1. Captures the problem accurately
    2. Tone matches your voice
    3. Hook is compelling
  </how-to-verify>
  <resume-signal>Type "approved" or describe what to change</resume-signal>
</task>
```

## checkpoint:decision (9% of checkpoints)

**When:** Human must make choice that affects content direction.

**Use for:** Argument framing, evidence selection, structure choices, emphasis decisions.

**Structure:**
```xml
<task type="checkpoint:decision" gate="blocking">
  <decision>[What's being decided]</decision>
  <context>[Why this matters for the paper]</context>
  <options>
    <option id="option-a"><name>[Name]</name><pros>[Benefits]</pros><cons>[Tradeoffs]</cons></option>
    <option id="option-b"><name>[Name]</name><pros>[Benefits]</pros><cons>[Tradeoffs]</cons></option>
  </options>
  <resume-signal>[How to indicate choice]</resume-signal>
</task>
```

**Example:**
```xml
<task type="checkpoint:decision" gate="blocking">
  <decision>Framing of methodology section</decision>
  <context>Two valid ways to present your method. Choice affects reader perception.</context>
  <options>
    <option id="novel"><name>Emphasize novelty</name><pros>Highlights contribution</pros><cons>May invite more scrutiny</cons></option>
    <option id="extension"><name>Frame as extension</name><pros>Builds on established work</pros><cons>Contribution may seem incremental</cons></option>
  </options>
  <resume-signal>Select: novel or extension</resume-signal>
</task>
```

## checkpoint:human-action (1% - rare)

**When:** Action requires human input that Claude cannot provide.

**Use ONLY for:** Providing specific data points, recalling personal observations, supplying unpublished results, clarifying domain-specific terminology.

**Do NOT use for:** Writing tasks Claude can draft, formatting, citation formatting.

**Example:**
```xml
<task type="checkpoint:human-action" gate="blocking">
  <action>Provide specific experimental result</action>
  <instructions>
    I need the exact p-value and effect size from your analysis
    to complete this sentence accurately.
  </instructions>
  <resume-signal>Provide: p-value and effect size</resume-signal>
</task>
```

</checkpoint_types>

<execution_protocol>

When Claude encounters `type="checkpoint:*"`:

1. **Stop immediately** - do not proceed to next task
2. **Display checkpoint clearly:**

```
════════════════════════════════════════
CHECKPOINT: [Type]
════════════════════════════════════════

Task [X] of [Y]: [Name]

[Checkpoint-specific content]

[Resume signal instruction]
════════════════════════════════════════
```

3. **Wait for user response** - do not hallucinate completion
4. **Incorporate feedback** - adjust content as directed
5. **Resume execution** - continue only after confirmation

</execution_protocol>

<writing_mode_checkpoints>

Different writing modes have different checkpoint patterns:

**Co-Author Mode:**
- Checkpoint after significant drafts
- Verify voice, accuracy, intent
- Fewer checkpoints (Claude has more latitude)

**Scaffold Mode:**
- Checkpoint after outline creation
- User fills in prose between checkpoints
- Checkpoint to review user's additions

**Reviewer Mode:**
- User writes first
- Claude's critique IS the checkpoint content
- User decides what feedback to incorporate

</writing_mode_checkpoints>

<guidelines>

**DO:**
- Use checkpoints after substantive content (not after every paragraph)
- Be specific about what to verify
- Give clear options for decisions
- Make feedback incorporation easy

**DON'T:**
- Checkpoint every task (checkpoint fatigue)
- Make vague verification requests
- Force binary yes/no when nuance exists
- Checkpoint mechanical tasks (formatting, citations)

**Placement:**
- After completing a logical unit (subsection, argument)
- Before dependent content (need decision to continue)
- At voice-critical moments (abstract, intro hook)
- After significant revisions

</guidelines>

<anti_patterns>

**BAD: Too many checkpoints**
```xml
<task type="auto">Write sentence 1</task>
<task type="checkpoint:human-verify">Check sentence 1</task>
<task type="auto">Write sentence 2</task>
<task type="checkpoint:human-verify">Check sentence 2</task>
```
Why bad: Disrupts flow. Combine into one checkpoint after a paragraph/section.

**BAD: Vague verification**
```xml
<task type="checkpoint:human-verify">
  <what-written>Methods section</what-written>
  <how-to-verify>Check if it's good</how-to-verify>
</task>
```
Why bad: "Good" is meaningless. Specify: accuracy, completeness, tone.

**GOOD: Substantive checkpoint**
```xml
<task type="checkpoint:human-verify">
  <what-written>Methods section draft (800 words)</what-written>
  <how-to-verify>
    1. Procedure accurately described?
    2. Enough detail to replicate?
    3. Analysis approach clear?
  </how-to-verify>
</task>
```

</anti_patterns>

<summary>

**Checkpoint priority:**
1. **checkpoint:human-verify** (90%) - Claude wrote, human confirms intent captured
2. **checkpoint:decision** (9%) - Human chooses content direction
3. **checkpoint:human-action** (1%) - Human provides information Claude can't know

**When NOT to use checkpoints:**
- Mechanical tasks (formatting, citations)
- Every paragraph (consolidate)
- When Claude can verify programmatically (word count, structure)

</summary>
