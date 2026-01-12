---
name: wtfp:create-slides
description: Full workflow for creating presentation slides from project content
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Generate presentation slides based on the current project's PROJECT.md and findings.
Uses the wtfp-marp skill to compile to PDF.
</objective>

<context>
@~/.claude/write-the-f-paper/references/principles.md
@~/.claude/write-the-f-paper/templates/slides/
</context>

<process>
## Step 1: Content Synthesis
- Read `.planning/PROJECT.md` and any drafted sections.
- Identify the core narrative and supporting claims.

## Step 2: User Interview
AskUserQuestion to determine:
- Presentation duration/target number of slides
- Specific focus areas
- Audience background

## Step 3: Markdown Generation
- Create `slides.md` using Marp format.
- Separate slides with `---`.

## Step 4: Compilation
- Use `wtfp-marp` skill: `npx @marp-team/marp-cli slides.md -o slides.pdf`

## Step 5: Review
- Present the generated slides.pdf path to the user.
</process>
