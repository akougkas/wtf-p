---
name: wtfp:plan-section
description: Create detailed writing plan for a section (PLAN.md)
argument-hint: "[section]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - AskUserQuestion
  - WebFetch
  - mcp__context7__*
---

<objective>
Create executable writing plan with context injection and task breakdown.

Purpose: Break down roadmap sections into concrete, executable PLAN.md files that Claude can execute.
Output: One or more PLAN.md files in the section directory (.planning/sections/XX-name/{section}-{plan}-PLAN.md)
</objective>

<execution_context>
@./.claude/write-the-f-paper/workflows/plan-section.md
@./.claude/write-the-f-paper/templates/phase-prompt.md
@./.claude/write-the-f-paper/references/plan-format.md
@./.claude/write-the-f-paper/references/length-estimation.md
@./.claude/write-the-f-paper/references/checkpoints.md
</execution_context>

<context>
Section number: $ARGUMENTS (optional - auto-detects next unplanned section if not provided)

**Load project state first:**
@.planning/STATE.md

**Load roadmap:**
@.planning/ROADMAP.md

**Load structure documents:**
@.planning/structure/argument-map.md
@.planning/structure/outline.md
@.planning/structure/narrative-arc.md

**Load section context if exists (created by /wtfp:discuss-section):**
Check for and read `.planning/sections/XX-name/{section}-CONTEXT.md` - contains vision and decisions from section discussion.

**Load sources if exists:**
Check for `.planning/sources/` and load relevant documents based on section needs.
</context>

<process>

<step name="verify">
1. Check .planning/ directory exists (error if not - user should run /wtfp:new-paper)
2. If section number provided via $ARGUMENTS, validate it exists in roadmap
3. If no section number, detect next unplanned section from roadmap
</step>

<step name="load_context">
**Load all relevant context:**

- Read PROJECT.md for paper vision and core argument
- Read ROADMAP.md for section goal and dependencies
- Read argument-map.md for claims relevant to this section
- Read outline.md for word budget and structure
- Read any prior SUMMARY.md files for context from completed sections
- Check for CONTEXT.md in section directory
- Check for RESEARCH.md in section directory
</step>

<step name="writing_mode">
**Determine writing mode for this section:**

Based on section type and user preference, select mode:

| Section Type | Recommended Mode |
|--------------|------------------|
| Abstract | Reviewer (user writes, Claude critiques) |
| Introduction | Co-Author (Claude drafts, user refines) |
| Methods | Co-Author (often procedural) |
| Results | Scaffold (Claude outlines, user writes) |
| Discussion | Reviewer (requires judgment) |
| Conclusion | Reviewer (synthesis) |

Use AskUserQuestion:
- header: "Writing Mode"
- question: "How should Claude help with [section name]?"
- options:
  - "Co-Author" — Claude drafts, you refine
  - "Scaffold" — Claude outlines, you fill in
  - "Reviewer" — You write, Claude critiques

</step>

<step name="break_into_tasks">
**Break section into writing tasks:**

Consider:
- Word target for section
- Logical subsections or paragraphs
- Arguments that need to be made
- Evidence that needs to be presented
- Citations that need to be woven in

For a typical section (500-1000 words):
- Task 1: Opening hook + context setup
- Task 2: Main argument development
- Task 3: Evidence and support
- Task 4: Transition to next section

Keep tasks atomic (one paragraph cluster or argument each).
</step>

<step name="create_plan">
**Create PLAN.md:**

```markdown
---
section: XX-name
plan: YY
mode: [co-author/scaffold/reviewer]
word_target: [X]
---

<objective>
[What this plan accomplishes - 1-2 sentences]

Purpose: [What the reader will understand after this section]
Output: [Word count] words of [section type] covering [topics]
</objective>

<execution_context>
@./.claude/write-the-f-paper/workflows/execute-section.md
@./.claude/write-the-f-paper/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/structure/argument-map.md
@.planning/sources/literature.md (if relevant)
@.planning/sections/[prior-section]/[prior]-SUMMARY.md (if exists)
</context>

<tasks>

<task type="auto" mode="[co-author/scaffold/reviewer]">
  <name>[Task name - what's being written]</name>
  <target>[Word count for this task]</target>
  <action>
    [Specific writing instructions]
    - Key points to make: [list]
    - Tone: [academic/persuasive/explanatory]
    - Citations needed: [yes/no, which]
    - Connect to: [prior/next section]
  </action>
  <verify>
    - [ ] Advances core argument
    - [ ] Word count within range
    - [ ] Flows from previous content
  </verify>
  <done>
    [X] words written covering [topic], ready for [next task/review]
  </done>
</task>

<task type="auto" mode="[mode]">
  [... additional tasks ...]
</task>

</tasks>

<verification>
- [ ] Total word count: [target] ± 10%
- [ ] All key arguments from argument-map addressed
- [ ] Citations included where claims made
- [ ] Logical flow maintained
- [ ] Connects to prior section (if not first)
- [ ] Sets up next section (if not last)
</verification>

<success_criteria>
- [ ] Section draft complete
- [ ] Word target met
- [ ] Core argument advanced
- [ ] Ready for review or next section
</success_criteria>

<output>
- Written section content (in paper/ directory or inline)
- SUMMARY.md documenting what was written
- Updated STATE.md with progress
</output>
```

</step>

<step name="commit">
```bash
git add .planning/sections/XX-name/XX-YY-PLAN.md
git commit -m "$(cat <<'EOF'
plan(XX-YY): [section name] writing plan

[One-liner objective]

Tasks: [N], Target: [X] words, Mode: [mode]
EOF
)"
```
</step>

<step name="done">
**Present completion:**

```
Plan created:

- Plan: .planning/sections/XX-name/XX-YY-PLAN.md
- Tasks: [N]
- Word target: [X]
- Mode: [co-author/scaffold/reviewer]

---

## ▶ Next Up

**[Section Name]** — execute writing plan

`/wtfp:write-section .planning/sections/XX-name/XX-YY-PLAN.md`

<sub>`/clear` first → fresh context window</sub>

---
```

</step>

</process>

<success_criteria>
- One or more PLAN.md files created in .planning/sections/XX-name/
- Each plan has: objective, execution_context, context, tasks, verification, success_criteria, output
- Tasks are specific enough for Claude to execute
- Writing mode selected appropriately for section type
- User knows next steps (execute plan or review/adjust)
</success_criteria>
