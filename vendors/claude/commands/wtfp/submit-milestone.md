---
name: wtfp:submit-milestone
description: Archive completed submission round
argument-hint: "[version]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<objective>
Archive a completed draft or submission round.

Creates MILESTONES.md entry with stats.
Archives full details to milestones/ directory.
Creates git tag for the version.
Prepares workspace for revision round.
</objective>

<process>

<step name="verify">
**Verify paper is ready:**

```bash
[ ! -f .planning/STATE.md ] && echo "ERROR: No project state found" && exit 1
```

Check completion status:
- Are all planned sections written?
- Any unresolved blockers?

If incomplete:
```
WARNING: Not all sections are complete.

Sections remaining:
- [Section N]: [status]
- [Section M]: [status]

Continue anyway?
```

Use AskUserQuestion:
- header: "Proceed?"
- question: "Archive milestone with incomplete sections?"
- options:
  - "Yes, archive anyway" — Create milestone as-is
  - "No, finish first" — Return to writing

</step>

<step name="gather_stats">
**Gather statistics:**

- Total sections: [N]
- Sections complete: [M]
- Total words: [X]
- Target words: [Y]
- Word variance: [+/- Z%]
- Citations used: [N]
- Figures: [N]
- Tables: [N]
- Issues resolved: [N]
- Issues deferred: [N]

</step>

<step name="milestone_entry">
**Create/update MILESTONES.md:**

```markdown
# Milestones

## [version] - [Name/Description]

**Date:** [date]
**Status:** [Submitted / Draft / Ready for Review]

### Summary
[Brief description of what this version represents]

### Stats
- Sections: [M]/[N] complete
- Words: [X] / [Y] target
- Citations: [N]
- Figures: [N]

### Sections Included
| Section | Words | Status |
|---------|-------|--------|
| Introduction | [X] | Complete |
| Methods | [X] | Complete |
| ... | | |

### Key Decisions
[Major decisions made in this version]

### Known Issues
[Issues deferred to next version]

### Git Reference
- Tag: `[version]`
- Commit: [hash]

---

[Previous milestones below...]
```

</step>

<step name="archive">
**Create milestone archive:**

```bash
mkdir -p .planning/milestones
```

Copy current state to archive:
- `.planning/milestones/[version]-ROADMAP.md`
- `.planning/milestones/[version]-STATE.md`
- Snapshot of all SUMMARY.md files

</step>

<step name="tag">
**Create git tag:**

```bash
git add .planning/MILESTONES.md .planning/milestones/
git commit -m "$(cat <<'EOF'
milestone: [version] - [name]

Words: [X]
Sections: [M]/[N]
Status: [status]
EOF
)"

git tag -a "[version]" -m "[Milestone description]"
```

</step>

<step name="prepare_next">
**Prepare for next round:**

Use AskUserQuestion:
- header: "Next Steps"
- question: "What's next after this milestone?"
- options:
  - "Wait for reviews" — Pause until feedback
  - "Start revisions" — Begin revision round
  - "Done for now" — Just archive

If "Start revisions":
- Reset STATE.md position to first section
- Note that this is revision round
- Suggest `/wtfp:progress` to start

</step>

<step name="done">
**Present completion:**

```
Milestone archived:

- Version: [version]
- Entry: .planning/MILESTONES.md
- Archive: .planning/milestones/[version]-*
- Git tag: [version]

## Summary
- Sections: [M]/[N] complete
- Words: [X] / [Y]
- Status: [status]

---

## ▶ Next Up

[Based on user's choice:]

**Wait for reviews:**
When you receive reviewer feedback:
`/wtfp:import-reviews` (coming soon)

**Start revisions:**
`/wtfp:progress` — check what needs revision

**Done for now:**
Your work is archived. Run `/wtfp:progress` when ready to continue.

---
```

</step>

</process>

<success_criteria>
- [ ] Completion status verified
- [ ] Statistics gathered
- [ ] MILESTONES.md updated
- [ ] Archive created
- [ ] Git tag created
- [ ] Next steps clear
</success_criteria>
