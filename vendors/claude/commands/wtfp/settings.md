---
name: wtfp:settings
description: View and edit project settings interactively
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<objective>
Interactive config editor for .planning/config.json.

Reads current config, presents categories, allows edits, shows diff of changes before applying.

No subagents needed - orchestrator handles all interaction directly.
</objective>

<context>
No arguments. Requires .planning/config.json to exist.
</context>

<process>

## 1. Validate Environment

```bash
[ ! -f .planning/config.json ] && echo "ERROR: No config. Run /wtfp:new-paper" && exit 1
```

Read current config:
```bash
CONFIG_CONTENT=$(cat .planning/config.json)
```

Store original for diff comparison later.

## 2. Display Current Settings

Present settings organized by category (matching planning-config.md structure):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► SETTINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## General
  mode: interactive
  depth: standard
  document_type: paper
  output_format: markdown
  model_profile: balanced
  venue_template: (none)

## Gates
  confirm_outline: true
  confirm_plan: true
  confirm_write: true
  confirm_review: true
  execute_next_section: true
  issues_review: true
  confirm_transition: true
  confirm_submission: true

## Writing
  claude_mode: co-author
  citation_style: apa
  verify_on_complete: true

## Workflow
  research: true
  plan_check: true
  verifier: true

## Verification
  citation_check: true
  coherence_check: true
  rubric_check: true

## Planning
  commit_docs: true
  search_gitignored: false

## Parallelization
  enabled: false
  plan_level: true
  task_level: false
  skip_checkpoints: true
  max_concurrent_agents: 3
  min_plans_for_parallel: 2

## Safety
  always_confirm_destructive: true
  always_confirm_external_services: true
  backup_before_major_edits: true

## Git
  branching_strategy: none
  section_branch_template: wtfp/section-{section}-{slug}
  submission_branch_template: wtfp/{milestone}-{slug}
  squash_on_merge: false

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 3. Category Selection

Use AskUserQuestion:
- header: "Edit Settings"
- question: "Which category to modify?"
- options: "General" | "Gates" | "Writing" | "Workflow" | "Verification" | "Planning" | "Parallelization" | "Safety" | "Git" | "Done"

**If "Done":** Skip to Step 6.

## 4. Edit Keys in Category

For chosen category, present each key with current value and ask for new value.

**For boolean keys:** Use AskUserQuestion:
- options: "true" | "false" | "Keep current"

**For string keys with known options:**
- `mode`: "interactive" | "yolo" | "Keep current"
- `depth`: "quick" | "standard" | "thorough" | "Keep current"
- `document_type`: "paper" | "thesis" | "proposal" | "report" | "Keep current"
- `output_format`: "markdown" | "latex" | "Keep current"
- `model_profile`: "quality" | "balanced" | "budget" | "Keep current"
- `claude_mode`: "co-author" | "scaffold" | "reviewer" | "Keep current"
- `citation_style`: "apa" | "ieee" | "chicago" | "mla" | "vancouver" | "Keep current"
- `branching_strategy`: "none" | "section" | "submission" | "Keep current"

**For numeric keys:** Use AskUserQuestion with text input.
- `max_concurrent_agents`: Accept integer value
- `min_plans_for_parallel`: Accept integer value

**For string template keys:** Use AskUserQuestion with text input.
- `section_branch_template`: Accept string value
- `submission_branch_template`: Accept string value
- `venue_template`: Accept string value or "none"

Track all changes made.

## 5. Compute and Show Diff

If any changes were made, show diff before applying:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► SETTINGS CHANGED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Changes:
  mode: interactive -> yolo
  gates.confirm_plan: true -> false

Apply changes?
```

Use AskUserQuestion:
- header: "Confirm Changes"
- question: "Apply these changes?"
- options: "Yes, apply" | "No, discard" | "Edit more"

**If "Yes, apply":** Write updated config.json.

**If "No, discard":** Discard changes, return to category selection.

**If "Edit more":** Return to Step 3.

## 6. Exit

If no changes or after applying changes, show final banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► SETTINGS SAVED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Or if no changes:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► SETTINGS UNCHANGED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

No git commit for settings changes (config.json is a working file).

</process>

<success_criteria>
- [ ] Current config displayed by category
- [ ] User can select category and edit keys
- [ ] Diff shown before applying
- [ ] config.json updated if changes confirmed
</success_criteria>
