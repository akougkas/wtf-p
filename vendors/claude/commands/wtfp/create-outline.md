---
name: wtfp:create-outline
description: Create document outline, section roadmap, and state tracking
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<execution_context>
@~/.claude/write-the-f-paper/workflows/create-outline.md
@~/.claude/write-the-f-paper/templates/roadmap.md
@~/.claude/write-the-f-paper/templates/state.md
@~/.claude/write-the-f-paper/references/imrad-structure.md
</execution_context>

<objective>
Create the document outline and section roadmap for an initialized paper.

**Orchestrator role:** Load project context, determine document structure from venue template, create ROADMAP.md + STATE.md + section directories, commit.

Creates ROADMAP.md (section breakdown), STATE.md (writing memory), and section directories.
</objective>

<context>
No arguments. Requires `.planning/PROJECT.md` to exist.
</context>

<process>

## 1. Validate Environment

```bash
[ ! -f .planning/PROJECT.md ] && echo "ERROR: No project. Run /wtfp:new-paper" && exit 1
[ -f .planning/ROADMAP.md ] && echo "ERROR: Outline exists. Use /wtfp:progress" && exit 1
```

## 2. Load Project Context

Read: PROJECT.md, config.json, structure/outline.md, structure/argument-map.md.

Extract: document_type, venue_template, core_argument, word budget from outline.md.

## 3. Determine Document Structure

Based on document_type from config.json, apply standard structure:
- **Research Paper (IMRaD):** Abstract → Introduction → Methods → Results → Discussion → Conclusion
- **Grant (NSF):** Specific Aims → Background → Preliminary Data → Research Design → Timeline
- **Thesis:** Introduction → Literature Review → Methodology → Results → Discussion → Conclusion

If customization needed, ask via AskUserQuestion:
- header: "Structure"
- options: "Use standard structure" | "Customize sections" | "Show me options"

## 4. Create ROADMAP.md

Write `.planning/ROADMAP.md` using template from `~/.claude/write-the-f-paper/templates/roadmap.md`.

Populate: Document title, type, target venue. For each section: goal, word target, status, dependencies. Progress table and word budget table.

## 5. Create STATE.md

Write `.planning/STATE.md` using template from `~/.claude/write-the-f-paper/templates/state.md`.

Initialize: position (section 1 of N), word count (0), argument strength from argument-map, open questions from PROJECT.md.

## 6. Create Section Directories

```bash
mkdir -p .planning/sections
mkdir -p .planning/sections/01-[section-slug]
mkdir -p .planning/sections/02-[section-slug]
# ... for all sections
```

## 7. Commit

```bash
git add .planning/ROADMAP.md .planning/STATE.md .planning/sections/
git commit -m "docs: create document outline — [N] sections, [X] words target"
```

</process>

<offer_next>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► OUTLINE CREATED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Roadmap: .planning/ROADMAP.md ([N] sections, [X] words)
- State: .planning/STATE.md
- Sections: .planning/sections/ ([N] directories)

| # | Section | Words |
|---|---------|-------|
[table from ROADMAP.md]

───────────────────────────────────────────

## ▶ Next Up

**Section 1: [Name]** — [goal]

`/wtfp:plan-section 1`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────

**Also available:**
- `/wtfp:discuss-section 1` — gather context first
- `/wtfp:research-gap 1` — investigate literature needs

</offer_next>

<success_criteria>
- [ ] ROADMAP.md has all sections with goals and word targets
- [ ] STATE.md initialized with correct position
- [ ] Section directories created
- [ ] Word budget totals match target
- [ ] All committed to git
</success_criteria>
