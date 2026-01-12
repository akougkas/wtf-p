---
name: wtfp:discuss-section
description: Gather section context through adaptive questioning before planning
argument-hint: "[section-number]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Gather section context through collaborative thinking before planning.

Purpose: Help the user articulate their vision for how a section should read, what it needs to accomplish, and what makes it effective.
Output: CONTEXT.md file in the section directory capturing vision, essential content, and boundaries.
</objective>

<execution_context>
@~/.claude/write-the-f-paper/workflows/discuss-section.md
@~/.claude/write-the-f-paper/templates/context.md
</execution_context>

<context>
Section number: $ARGUMENTS (required)

**Load project state first:**
@.planning/STATE.md

**Load roadmap:**
@.planning/ROADMAP.md

**Load structure documents:**
@.planning/structure/argument-map.md
@.planning/structure/outline.md
</context>

<process>

<step name="verify">
1. Check .planning/ directory exists (error if not - user should run /wtfp:new-paper)
2. Validate section number provided via $ARGUMENTS
3. Validate section exists in roadmap
</step>

<step name="execute_workflow">
Execute the discuss-section workflow from execution_context.

The workflow will:
- Validate section against roadmap
- Check for existing CONTEXT.md
- Gather vision through AskUserQuestion (not interrogation)
- Write CONTEXT.md capturing user's vision
- Commit to git
</step>

<step name="done">
Workflow outputs next steps to user (typically: research or plan the section).
</step>

</process>

<success_criteria>
- Section validated against roadmap
- Vision gathered through collaborative thinking
- CONTEXT.md created in section directory
- CONTEXT.md committed to git
- User knows next steps
</success_criteria>
