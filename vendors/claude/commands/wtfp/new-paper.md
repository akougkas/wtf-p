---
name: wtfp:new-paper
description: Start a new paper with guided interview and setup
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
@~/.claude/write-the-f-paper/references/principles.md
@~/.claude/write-the-f-paper/references/questioning.md
@~/.claude/write-the-f-paper/templates/project.md
@~/.claude/write-the-f-paper/templates/config.json
@~/.claude/write-the-f-paper/venues/
</execution_context>

<objective>
Initialize a new academic paper through comprehensive context gathering.

**Orchestrator role:** Check preconditions, detect brownfield projects, gather paper vision through batched questioning, synthesize PROJECT.md + config.json + structure documents, commit.

Creates `.planning/` with PROJECT.md, config.json, and structure documents.
</objective>

<context>
No arguments. Runs in current directory.
</context>

<process>

## 1. Validate Environment

```bash
[ -f .planning/PROJECT.md ] && echo "ERROR: Paper already initialized. Use /wtfp:progress" && exit 1
```

Initialize git if needed:
```bash
[ -d .git ] || [ -f .git ] || git init
```

## 2. Brownfield Detection

```bash
WRITING_FILES=$(find . -name "*.tex" -o -name "*.md" -o -name "*.bib" -o -name "*.docx" 2>/dev/null | grep -v node_modules | grep -v .git | grep -v .planning | head -20)
HAS_SOURCES=$([ -d sources ] || [ -d references ] || [ -d literature ] && echo "yes")
HAS_SOURCE_MAP=$([ -d .planning/sources ] && echo "yes")
```

**If materials detected and no source map:** Offer `/wtfp:map-project` first via AskUserQuestion.

## 3. Gather Core Context (Batched)

Use AskUserQuestion — collect foundations in one turn:
- header: "Paper Foundations"
- question: "1. **Type** (Research paper, Grant, Thesis)\n2. **Venue** (NeurIPS, CHI, Nature, etc.)\n3. **Core Argument** (one thing you're proving)\n4. **Audience** (who is this for?)"
- options: "I provided the details" | "Guide me step-by-step"

If step-by-step selected, ask Type → Venue → Argument sequentially.

## 4. Venue Template Selection

If ambiguous, ask via AskUserQuestion:
- header: "Venue Structure"
- options: "ACM CS" | "IEEE CS" | "ML/AI" | "Nature/Science" | "Thesis"

Load corresponding YAML from `~/.claude/write-the-f-paper/venues/`.

## 5. Sharpen Core Argument

If core_argument was weak, drill down:
- header: "Refine Core"
- question: "If reviewers remember ONE thing, what is it?"
- options: "The Method" | "The Findings" | "The Theory" | "The System"

## 6. Gather Constraints

- header: "Scope & Limits"
- question: "1. **Out of Scope?** 2. **Hard Constraints?** (page limits, deadlines)"
- options: "Provided details" | "No constraints"

## 7. Synthesize PROJECT.md

Write `.planning/PROJECT.md` using template from `~/.claude/write-the-f-paper/templates/project.md`.

Populate: What This Is, Core Argument, Requirements (Must/Should/Out of Scope), Target Audience, Constraints, Key Decisions.

## 8. Create Structure Documents

Create `.planning/structure/` with:
- **argument-map.md** — Central thesis, supporting claims, logical flow, gaps
- **outline.md** — Venue template sections, word budget table
- **narrative-arc.md** — Problem/Journey/Resolution, reader experience

## 9. Workflow Mode & Config

Ask mode (Interactive / Flow) and depth (Quick / Standard / Comprehensive) via AskUserQuestion.

## 9b. Git & Planning Settings

Ask about git tracking via AskUserQuestion:
- header: "Git & Planning"
- question: "Track planning documents in git?"
- options:
  - "Yes (default)" -- commit_docs: true, planning artifacts are version-controlled
  - "No" -- commit_docs: false, only paper content is committed

Use the answer to set `planning.commit_docs` in config.json.

Ask about branching strategy via AskUserQuestion:
- header: "Git Branching"
- question: "Branch strategy for git history?"
- options:
  - "None (default)" -- all commits on current branch, git.branching_strategy: "none"
  - "Section branches" -- one branch per section, merged on review pass, git.branching_strategy: "section"
  - "Submission branches" -- branch per milestone/submission target, git.branching_strategy: "submission"

Use the answer to set `git.branching_strategy` in config.json.

## 9c. Write Config

Write `.planning/config.json` with the full v0.5.0 schema: mode, depth, document_type, output_format, model_profile ("balanced"), venue_template, gates (8 gate types: confirm_outline, confirm_plan, confirm_write, confirm_review, execute_next_section, issues_review, confirm_transition, confirm_submission), writing, workflow, verification, planning (commit_docs, search_gitignored), parallelization, safety (always_confirm_destructive, always_confirm_external_services, backup_before_major_edits), git (branching_strategy, section_branch_template, submission_branch_template, squash_on_merge).

## 10. Commit

```bash
git add .planning/PROJECT.md .planning/config.json .planning/structure/
git commit -m "docs: initialize [paper-title]"
```

</process>

<offer_next>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► PAPER INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Project: .planning/PROJECT.md
- Config: .planning/config.json (mode: [chosen])
- Structure: .planning/structure/

───────────────────────────────────────────

## ▶ Next Up

**Create section outline**

`/wtfp:create-outline`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────

</offer_next>

<success_criteria>
- [ ] Deep questioning completed (not rushed)
- [ ] PROJECT.md captures paper vision with core argument
- [ ] Structure documents created (argument-map, outline, narrative-arc)
- [ ] config.json has gates, safety, planning, and git sections
- [ ] config.json has workflow mode and model_profile
- [ ] All committed to git
</success_criteria>
