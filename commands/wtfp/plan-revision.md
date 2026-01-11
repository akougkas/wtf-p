---
name: wtfp:plan-revision
description: Create fix plan from review issues
argument-hint: "[plan]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<objective>
Create targeted revision plan from review issues.

Reads ISSUES.md and creates a REVISION.md plan to address identified problems.

Prioritizes blockers, then major issues, then minor issues.
</objective>

<execution_context>
@~/.claude/write-the-f-paper/workflows/plan-section.md
@~/.claude/write-the-f-paper/references/plan-format.md
</execution_context>

<process>

<step name="verify">
**Verify issues exist:**

```bash
ISSUES_FILE=".planning/sections/[section-dir]/$ARGUMENTS-ISSUES.md"
[ ! -f "$ISSUES_FILE" ] && echo "ERROR: No issues file found at $ISSUES_FILE" && exit 1
```

</step>

<step name="load">
**Load context:**

- Read the ISSUES.md file
- Read original PLAN.md for context
- Read SUMMARY.md for what was written
- Read the actual section content (paper/[section].md)
- Read PROJECT.md for requirements reference
</step>

<step name="triage">
**Triage issues:**

Group by severity:
- **Blockers:** Must fix before submission
- **Major:** Should fix, impacts quality
- **Minor:** Nice to fix if time allows

Use AskUserQuestion:
- header: "Revision Scope"
- question: "Which issues should we address?"
- options:
  - "Blockers only" — Fix critical issues
  - "Blockers + Major" — Fix important issues
  - "All issues" — Comprehensive revision
  - "Let me select" — I'll specify which

</step>

<step name="create_revision">
**Create REVISION.md:**

```markdown
---
section: XX-name
plan: YY-REVISION
issues_addressed: [list of issue IDs]
---

<objective>
Address review issues from [section] verification.

Fixes: [N] issues ([blockers] blockers, [major] major, [minor] minor)
</objective>

<execution_context>
@~/.claude/write-the-f-paper/workflows/execute-section.md
</execution_context>

<context>
@.planning/sections/XX-name/XX-YY-ISSUES.md
@.planning/sections/XX-name/XX-YY-SUMMARY.md
@paper/[section].md
</context>

<tasks>

<task type="auto">
  <name>Fix [ISSUE-ID]: [description]</name>
  <issue>[Full issue description]</issue>
  <location>[Where in document]</location>
  <action>
    [Specific fix instructions]
  </action>
  <verify>
    - [ ] Issue resolved
    - [ ] No new issues introduced
  </verify>
</task>

[... task per issue ...]

</tasks>

<verification>
- [ ] All addressed issues resolved
- [ ] No regression in other checks
- [ ] Word count still within target
</verification>

<success_criteria>
- [ ] [N] issues fixed
- [ ] Section passes re-verification
</success_criteria>

<output>
- Updated paper/[section].md
- REVISION-SUMMARY.md
</output>
```

</step>

<step name="commit">
```bash
git add .planning/sections/XX-name/XX-YY-REVISION.md
git commit -m "$(cat <<'EOF'
plan(XX-YY): revision plan

Addresses: [N] issues
Scope: [blockers/major/all]
EOF
)"
```

</step>

<step name="done">
**Present completion:**

```
Revision plan created:

- Plan: .planning/sections/XX-name/XX-YY-REVISION.md
- Issues addressed: [N]
- Scope: [blockers/major/all]

## Issues to Fix
[List of issues]

---

## ▶ Next Up

**Execute revision** — apply fixes

`/wtfp:write-section .planning/sections/XX-name/XX-YY-REVISION.md`

<sub>`/clear` first → fresh context window</sub>

---
```

</step>

</process>

<success_criteria>
- [ ] Issues triaged by severity
- [ ] User selected scope
- [ ] REVISION.md created with specific fixes
- [ ] Each issue has a targeted task
- [ ] Clear verification criteria
</success_criteria>
