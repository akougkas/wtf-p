---
name: wtfp:insert-section
description: Insert urgent section between existing sections
argument-hint: "<after> <description>"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<objective>
Insert a new section between existing sections as a decimal phase.

Creates intermediate section (e.g., 3.1 between sections 3 and 4).

Useful for discovered gaps that must be addressed mid-draft.

Maintains section ordering without renumbering.
</objective>

<process>

<step name="parse">
**Parse arguments:**

Expect: `<after> <description>`
- after: Section number to insert after (e.g., 3)
- description: Brief description of new section

Example: `/wtfp:insert-section 3 "Add methodology validation subsection"`
</step>

<step name="verify">
**Verify project exists:**

```bash
[ ! -f .planning/ROADMAP.md ] && echo "ERROR: No roadmap found. Run /wtfp:create-outline first" && exit 1
```

Check that "after" section exists in ROADMAP.md.
</step>

<step name="determine_number">
**Determine new section number:**

Check for existing decimal sections after the target:
- If 3.1 doesn't exist → new section is 3.1
- If 3.1 exists but 3.2 doesn't → new section is 3.2
- Continue until finding available slot
</step>

<step name="confirm">
**Confirm with user:**

Use AskUserQuestion:
- header: "Insert Section"
- question: "Insert Section [X.Y]: [description] after Section [X]?"
- options:
  - "Yes, create it" — Insert the section
  - "Different position" — Let me specify another location
  - "Cancel" — Don't insert

</step>

<step name="create">
**Create section:**

1. Create directory:
```bash
mkdir -p ".planning/sections/[XX.Y]-[section-name-slug]"
```

2. Update ROADMAP.md:
- Insert new section entry after section [X]
- Include goal, word target, status

3. Update STATE.md if needed.

</step>

<step name="commit">
```bash
git add .planning/ROADMAP.md .planning/sections/
git commit -m "$(cat <<'EOF'
docs: insert Section [X.Y] - [name]

[Description]

Inserted between Section [X] and Section [X+1]
EOF
)"
```

</step>

<step name="done">
**Present completion:**

```
Section inserted:

- Section [X.Y]: [Name]
- Directory: .planning/sections/[XX.Y]-[name]/
- ROADMAP.md updated

---

## ▶ Next Up

**Plan new section** — create writing plan

`/wtfp:plan-section [X.Y]`

<sub>`/clear` first → fresh context window</sub>

---
```

</step>

</process>

<success_criteria>
- [ ] New section number determined (no conflicts)
- [ ] Directory created
- [ ] ROADMAP.md updated with new section
- [ ] Ordering preserved
- [ ] Committed to git
</success_criteria>
