---
name: wtfp:create-poster
description: Full workflow for creating an academic poster from project content
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Generate an academic poster based on the current project's PROJECT.md and findings.
Uses the wtfp-marp skill to compile to HTML.
</objective>

<context>
@~/.claude/write-the-f-paper/references/principles.md
@~/.claude/write-the-f-paper/templates/posters/basic.md
</context>

<process>
## Step 1: Content Synthesis
- Read `.planning/PROJECT.md` and any drafted sections.
- Identify key findings, methodology, and conclusion.

## Step 2: User Interview
AskUserQuestion to determine:
- Poster title (default to project title)
- Authors
- Key visuals/charts needed
- Target audience

## Step 3: Markdown Generation
- Create `poster.md` using Marp format.
- Integrate synthesized content.

## Step 4: Compilation
- Use `wtfp-marp` skill: `npx @marp-team/marp-cli poster.md -o poster.html`

## Step 5: Review
- Present the generated poster.html path to the user.
</process>
