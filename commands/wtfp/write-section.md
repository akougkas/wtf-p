---
name: wtfp:write-section
description: Execute a PLAN.md to write section content
argument-hint: "[path-to-PLAN.md]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Task
---

<objective>
Execute a PLAN.md file to write section content.

Takes the path to a PLAN.md file and executes its tasks sequentially, writing the actual paper content.

Creates SUMMARY.md documenting what was written and updates STATE.md with progress.
</objective>

<execution_context>
@~/.claude/write-the-f-paper/workflows/execute-section.md
@~/.claude/write-the-f-paper/templates/summary.md
@~/.claude/write-the-f-paper/references/git-integration.md
</execution_context>

<process>

<step name="verify">
**Verify plan exists:**

```bash
[ ! -f "$ARGUMENTS" ] && echo "ERROR: Plan not found at $ARGUMENTS" && exit 1
```

Check plan hasn't already been executed (SUMMARY.md exists):
```bash
SUMMARY_PATH="${ARGUMENTS/PLAN.md/SUMMARY.md}"
[ -f "$SUMMARY_PATH" ] && echo "WARNING: This plan already has a SUMMARY.md. Re-executing will overwrite."
```

</step>

<step name="load">
**Load plan and all context:**

1. Read the PLAN.md file specified in $ARGUMENTS
2. Parse the frontmatter (section, plan, mode, word_target)
3. Load all @context files referenced in the plan
4. Read PROJECT.md for core argument
5. Read argument-map.md for relevant claims
6. Read any prior section content for continuity
</step>

<step name="mode_setup">
**Configure for writing mode:**

Based on `mode` from plan frontmatter:

**Co-Author Mode:**
- Claude writes draft prose
- User refines afterward
- Output: Full draft text

**Scaffold Mode:**
- Claude creates detailed outline with key points
- User fills in actual prose
- Output: Structured outline for each paragraph

**Reviewer Mode:**
- Prompt user to write section
- Claude provides feedback after each chunk
- Output: User's text + Claude's comments

</step>

<step name="execute_tasks">
**Execute each task in the plan:**

For each `<task>` in `<tasks>`:

1. Read the task requirements (action, target, verify)
2. Based on mode:
   - **Co-Author:** Write the draft content
   - **Scaffold:** Create detailed outline
   - **Reviewer:** Prompt user to write, then critique
3. Verify the output meets task criteria
4. Track word count
5. Commit after each task (if substantive)

**Per-task commit:**
```bash
git add paper/[section].md  # or wherever content lives
git commit -m "$(cat <<'EOF'
write(XX-YY): [task description]

[Word count] words for [section]
EOF
)"
```

</step>

<step name="deviation_rules">
**Handle deviations during writing:**

| Type | Action |
|------|--------|
| Citation needed but not in sources | Flag, continue, note in SUMMARY |
| Argument weak | Note in SUMMARY for revision |
| Word count significantly off | Note in SUMMARY, suggest adjustment |
| Logical gap discovered | Note in SUMMARY, may need ISSUES.md |
| Better structure found | Implement if minor, note if major |

**Auto-fix:**
- Minor prose improvements
- Citation format fixes
- Paragraph flow improvements

**Log for later:**
- Missing citations (add to sources/literature.md gap list)
- Argument weaknesses (ISSUES.md)
- Structure suggestions beyond plan scope
</step>

<step name="output_content">
**Write output content:**

Content goes to `paper/` directory:
- `paper/[section-name].md` - Markdown section content
- Or appended to `paper/paper.md` if single-file format

Include proper markdown structure:
```markdown
## [Section Title]

[Content from tasks...]

### [Subsection if applicable]

[More content...]
```

Track all files created/modified for SUMMARY.
</step>

<step name="summary">
**Create SUMMARY.md:**

```markdown
---
section: XX-name
plan: YY
mode: [co-author/scaffold/reviewer]
word_count: [actual]
word_target: [target]
---

# Section [XX]-[YY] Summary

## What Was Written
- [Task 1]: [what was accomplished]
- [Task 2]: [what was accomplished]
- [...]

## Word Count
- Target: [X] words
- Actual: [Y] words
- Variance: [+/- Z]%

## Files Created/Modified
- paper/[section].md: [description]

## Key Points Made
- [Argument 1]
- [Argument 2]
- [...]

## Citations Used
- [citation-key]: [where used]
- [...]

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| [choice] | [why] |

## Issues Noted
- [Any problems discovered during writing]
- [Gaps that need addressing]

## Next Steps
- [What should happen next]

---
*Written: [timestamp]*
```

</step>

<step name="update_state">
**Update STATE.md:**

- Update current position
- Add word count to progress
- Note any decisions made
- Log any issues discovered
- Update argument strength assessment
</step>

<step name="final_commit">
**Final commit:**

```bash
git add .planning/sections/XX-name/XX-YY-SUMMARY.md .planning/STATE.md paper/
git commit -m "$(cat <<'EOF'
docs(XX-YY): complete [section name] writing

[Word count] words written
Mode: [mode]
EOF
)"
```

</step>

<step name="done">
**Present completion:**

```
Section written:

- Content: paper/[section].md ([Y] words)
- Summary: .planning/sections/XX-name/XX-YY-SUMMARY.md
- Progress: [current]/[total] words ([%]%)

## Written

[Brief summary of what was written]

## Issues Noted

[Any issues discovered, or "None"]

---

## ▶ Next Up

[Based on STATE.md - next plan, next section, or review]

`/wtfp:[appropriate-command]`

<sub>`/clear` first → fresh context window</sub>

---
```

</step>

</process>

<success_criteria>
- [ ] All tasks in PLAN.md executed
- [ ] Content written to paper/ directory
- [ ] Word count tracked and within tolerance
- [ ] SUMMARY.md created with full documentation
- [ ] STATE.md updated with progress
- [ ] All changes committed to git
- [ ] Next action clearly identified
</success_criteria>
