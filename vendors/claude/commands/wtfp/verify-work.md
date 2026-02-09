---
name: wtfp:verify-work
description: Test a written section against its plan, one check at a time
argument-hint: "[section-number]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - AskUserQuestion
---

<execution_context>
@~/.claude/write-the-f-paper/workflows/verify-work.md
@~/.claude/write-the-f-paper/references/ui-brand.md
</execution_context>

<objective>
Conversational verification of a written section. Presents one test at a time.
Persists state in UAT.md that survives /clear.

**Orchestrator role:** Load UAT.md (or create from PLAN.md + argument-map),
present next pending test, record result, update UAT.md, route on completion.

**Why no subagent:** Verification is a conversation loop, not a creative task.
The orchestrator reads artifacts, extracts tests, and guides the user through
each one. State persists via UAT.md file reads/writes.
</objective>

<context>
Section: $ARGUMENTS (section number or name)
</context>

<process>

## 1. Validate Environment

```bash
[ ! -f ".planning/PROJECT.md" ] && echo "ERROR: No project initialized. Run /wtfp:new-paper first." && exit 1
```

Resolve section from $ARGUMENTS:
- If numeric (e.g., "3"): find `.planning/sections/03-*`
- If name (e.g., "methods"): find `.planning/sections/*-methods*`

```bash
SECTION_DIR=$(ls -d .planning/sections/${SECTION}-* 2>/dev/null | head -1)
[ -z "$SECTION_DIR" ] && echo "ERROR: Section '$ARGUMENTS' not found in .planning/sections/" && exit 1
```

Verify section was written (SUMMARY.md exists):

```bash
ls "$SECTION_DIR"/*-SUMMARY.md 2>/dev/null
```

If no SUMMARY.md:
```
Section has not been written yet. Cannot verify unwritten content.

Write it first: /wtfp:write-section [plan-path]
```

## 2. Load or Resume UAT

```bash
UAT_PATH="$SECTION_DIR/UAT.md"
```

**If UAT.md exists (resuming):**

Read UAT.md. Count tests by status:
- Total tests
- Passed (result: pass)
- Skipped (result: skip)
- Issues (result: issue)
- Pending (result: pending)

Report:
```
Resuming verification for Section [X]: [Name]
[completed]/[total] tests evaluated ([pending] remaining)
```

Find the first test with `result: pending` and proceed to step 3.

**If UAT.md does not exist (starting fresh):**

Derive tests from two sources:

**Source 1: PLAN.md success criteria**
```bash
cat "$SECTION_DIR"/*-PLAN.md
```
Extract each `- [ ]` item from `<success_criteria>`. Each becomes a test tagged `[plan]`.

**Source 2: Argument-map claims**
```bash
cat .planning/structure/argument-map.md 2>/dev/null
```
Find claims assigned to this section. Each becomes a test tagged `[argument-map]`.

Write UAT.md:

```yaml
---
status: testing
section: [section-dir-name]
started: [ISO timestamp]
last_test: 0
---
```

Followed by `## Tests` with all derived tests (numbered, pending), `## Summary` with initial counts, empty `## Gaps`.

Report:
```
Starting verification for Section [X]: [Name]
[total] tests derived ([plan-count] from plan, [map-count] from argument-map)
```

## 3. Present Next Test

Find the next test with `result: pending`.

Display using branded checkpoint box:

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
- question: "[The criterion or claim text]"
- options:
  - "Pass - meets criteria"
  - "Skip - not applicable"
  - "Issue - describe the problem"

## 4. Record and Continue

Update UAT.md with the result:
- Set `result:` to pass, skip, or issue
- Set `reason:` to user explanation (empty for pass/skip unless user elaborated)
- Update `last_test` in frontmatter

**If "Issue" selected:**

Ask for the problem description (user already selected "Issue" so get details):

Then ask for severity:

Use AskUserQuestion:
- header: "Severity"
- question: "How severe is this issue?"
- options:
  - "Major - undermines argument, must fix"
  - "Minor - weakens but doesn't invalidate"
  - "Cosmetic - polish issue, fix during final pass"

Add to `## Gaps` section:
```markdown
- claim: "[criterion or claim text]"
  status: issue
  reason: "[user's description]"
  severity: [major|minor|cosmetic]
```

**Write UAT.md to disk** after each result (persistence).

**If more pending tests:** Return to step 3.

**If all tests evaluated:** Proceed to step 5.

## 5. Route on Completion

Set `status: complete` in UAT.md frontmatter. Calculate final counts.

**If no issues (all pass/skip):**

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

</process>

<success_criteria>
- [ ] Section resolved from arguments
- [ ] SUMMARY.md validated (section was written)
- [ ] Tests derived from PLAN.md success_criteria AND argument-map.md claims
- [ ] UAT.md created or resumed
- [ ] Each test presented one at a time
- [ ] Results recorded with persistence (survives /clear)
- [ ] Issues classified by severity
- [ ] Routes to plan-revision when issues found
- [ ] Routes to progress when verification passes
</success_criteria>
