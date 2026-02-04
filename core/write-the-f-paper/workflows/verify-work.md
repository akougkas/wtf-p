<purpose>
Conversational section acceptance testing. Present tests one at a time derived from
PLAN.md success criteria and argument-map.md claims. Persist state in UAT.md that
survives /clear. Route to plan-revision when issues are found.

The USER evaluates each test — Claude presents, records, and routes.
</purpose>

<process>

<step name="load_state">
**Load project state and config:**

```bash
cat .planning/STATE.md 2>/dev/null
cat .planning/config.json 2>/dev/null
```

Parse current position, accumulated decisions. Load planning config for commit_docs flag.

```bash
COMMIT_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
```
</step>

<step name="find_section">
**Resolve section from arguments:**

Parse $ARGUMENTS as section number (e.g., "3") or section name (e.g., "methods").

```bash
# Find section directory
SECTION_DIR=$(ls -d .planning/sections/${SECTION}-* 2>/dev/null | head -1)
[ -z "$SECTION_DIR" ] && echo "ERROR: Section not found" && exit 1
```

**Validate section was written:**

```bash
ls "$SECTION_DIR"/*-SUMMARY.md 2>/dev/null
```

If no SUMMARY.md exists, the section has not been written yet. Cannot verify unwritten content.

Present error:
```
Section [X] has not been written yet.

Write it first: /wtfp:write-section [plan-path]
```
</step>

<step name="load_or_create_uat">
**Check for existing UAT.md:**

```bash
UAT_PATH="$SECTION_DIR/UAT.md"
[ -f "$UAT_PATH" ] && echo "EXISTING" || echo "NEW"
```

**If UAT.md exists (resuming):**
- Read UAT.md
- Count total tests, completed tests, pending tests
- Find next test with `result: pending`
- Report: "Resuming verification (N/M tests complete)"

**If UAT.md does not exist (new verification):**

Derive tests from two sources:

1. **PLAN.md success criteria:**
   ```bash
   cat "$SECTION_DIR"/*-PLAN.md
   ```
   Extract each item from `<success_criteria>` section. Each `- [ ]` item becomes a test.

2. **Argument-map claims for this section:**
   ```bash
   cat .planning/structure/argument-map.md 2>/dev/null
   ```
   Find claims mapped to this section number. Each claim becomes a test.

**Generate test list:** Combine both sources. Each test gets:
- Sequential number
- Source label: `[plan]` or `[argument-map]`
- The criterion or claim text
- `result: pending`
- `reason: ""`

**Write UAT.md** using template format:
```yaml
---
status: testing
section: XX-name
started: [ISO timestamp]
last_test: 0
---
```

Followed by `## Tests` section with all derived tests, `## Summary` with initial counts, empty `## Gaps` section.

Report: "Starting verification (M tests)"
</step>

<step name="present_test">
**Display current test:**

Find next test with `result: pending`.

Present using branded checkpoint box:

```
════════════════════════════════════════
VERIFICATION: Test {N} of {total}
════════════════════════════════════════

Source: {[plan] or [argument-map]}

  {The criterion or claim being verified}

Check: Does this section satisfy the above?
════════════════════════════════════════
```

Use AskUserQuestion:
- header: "Verification"
- question: The criterion or claim text
- options:
  - "Pass - meets criteria"
  - "Skip - not applicable"
  - "Issue - describe the problem"
</step>

<step name="record_result">
**Write result back to UAT.md:**

Update the test entry:
- Set `result:` to pass, skip, or issue
- Set `reason:` to user's explanation (if provided)
- Increment `last_test` in frontmatter

**If result is "issue":**

Ask follow-up for severity classification:

Use AskUserQuestion:
- header: "Severity"
- question: "How severe is this issue?"
- options:
  - "Major - undermines argument, must fix"
  - "Minor - weakens but doesn't invalidate"
  - "Cosmetic - polish issue, fix during final pass"

Add entry to `## Gaps` section:
```markdown
- claim: "[criterion or claim text]"
  status: issue
  reason: "[user's description]"
  severity: [major|minor|cosmetic]
```

Update UAT.md on disk after each result.
</step>

<step name="check_completion">
**Check if more tests remain:**

Count tests with `result: pending`.

**If pending > 0:** Loop back to `present_test` step.

**If pending == 0:** All tests evaluated.
- Set `status: complete` in frontmatter
- Calculate summary counts:
  - total: [count of all tests]
  - passed: [count with result: pass]
  - issues: [count with result: issue]
  - skipped: [count with result: skip]
- Update `## Summary` section in UAT.md
</step>

<step name="route_on_completion">
**Route based on results:**

**If no issues found (all pass or skip):**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► VERIFICATION PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Section [X]: [Name]
Tests: [passed] passed, [skipped] skipped, 0 issues

───────────────────────────────────────────

## ▶ Next Up

**Check progress** — see overall paper status

`/wtfp:progress`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────
```

**If issues found:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► VERIFICATION: ISSUES FOUND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Section [X]: [Name]
Tests: [passed] passed, [issues] issues, [skipped] skipped

## Gap Summary

| # | Claim/Criterion | Severity | Reason |
|---|-----------------|----------|--------|
| 1 | [text]          | major    | [reason] |
| 2 | [text]          | minor    | [reason] |

───────────────────────────────────────────

## ▶ Next Up

**Plan revision** — create fix plan for identified issues

`/wtfp:plan-revision [section]`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────
```
</step>

</process>

<success_criteria>
- [ ] Section resolved from arguments
- [ ] SUMMARY.md existence validated (section was written)
- [ ] Tests derived from BOTH PLAN.md success_criteria AND argument-map.md claims
- [ ] UAT.md created or resumed with correct state
- [ ] Each test presented one at a time with branded checkpoint box
- [ ] User response recorded (pass/skip/issue) with persistence
- [ ] Issues get severity classification and are added to Gaps
- [ ] UAT.md updated on disk after each result (survives /clear)
- [ ] Completion routes to progress (clean) or plan-revision (issues found)
</success_criteria>
