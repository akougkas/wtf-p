---
name: wtfp:remove-section
description: Remove a future section and renumber subsequent sections
argument-hint: "[section]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<objective>
Remove a future (unwritten) section and renumber subsequent sections.

Only works on sections that haven't been started yet.

Git commit preserves historical record of what was removed.
</objective>

<process>

<step name="verify">
**Verify project and section:**

```bash
[ ! -f .planning/ROADMAP.md ] && echo "ERROR: No roadmap found" && exit 1
```

Check section exists and hasn't been started:
- No PLAN.md files in section directory
- No SUMMARY.md files in section directory
- Status is "Not started" in ROADMAP.md

If section has work:
```
ERROR: Section [N] has already been started.

To remove a section with existing work:
1. Manually delete the content
2. Update ROADMAP.md
3. Commit the changes

This command only removes future/unstarted sections.
```
</step>

<step name="confirm">
**Confirm removal:**

Show what will be removed:

```
## Section to Remove

Section [N]: [Name]
- Goal: [goal]
- Word target: [X]
- Status: Not started

## Impact

Sections to renumber:
- Section [N+1] → Section [N]
- Section [N+2] → Section [N+1]
- ...

Files to delete:
- .planning/sections/[NN]-[name]/
```

Use AskUserQuestion:
- header: "Remove Section"
- question: "Remove Section [N]: [name] and renumber subsequent sections?"
- options:
  - "Yes, remove it" — Delete and renumber
  - "Cancel" — Keep the section

</step>

<step name="remove">
**Remove section:**

1. Delete section directory:
```bash
rm -rf ".planning/sections/[NN]-[name]/"
```

2. Update ROADMAP.md:
- Remove section entry
- Renumber all subsequent sections

3. Rename subsequent section directories:
```bash
mv ".planning/sections/[N+1]-[name]/" ".planning/sections/[N]-[name]/"
# ... for all subsequent sections
```

4. Update any references in STATE.md

</step>

<step name="commit">
```bash
git add .planning/
git commit -m "$(cat <<'EOF'
docs: remove Section [N] - [name]

Removed unstarted section.
Renumbered sections [N+1]-[total] to [N]-[total-1].
EOF
)"
```

</step>

<step name="done">
**Present completion:**

```
Section removed:

- Removed: Section [N] - [Name]
- Renumbered: Sections [N+1]-[total] → [N]-[total-1]
- Total sections: [new total]

---

## ▶ Next Up

`/wtfp:progress` — check updated status

---
```

</step>

</process>

<success_criteria>
- [ ] Section verified as unstarted
- [ ] User confirmed removal
- [ ] Section directory deleted
- [ ] ROADMAP.md updated
- [ ] Subsequent sections renumbered
- [ ] All references updated
- [ ] Committed to git with clear history
</success_criteria>
