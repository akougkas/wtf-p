# UAT Template

Template for `.planning/sections/XX-name/UAT.md` - section acceptance testing state file.

---

## File Template

```markdown
---
status: testing
section: XX-name
started: YYYY-MM-DDTHH:MM:SSZ
last_test: 0
---

## Current Test

[Active test content will be displayed here during verification]

## Tests

### 1. [Criterion or claim text]
result: pending
reason: ""

### 2. [Criterion or claim text]
result: pending
reason: ""

[... one entry per test ...]

## Summary

total: N | passed: 0 | issues: 0 | skipped: 0

## Gaps

[Populated when tests result in "issue"]

- claim: "Expected behavior or argument"
  status: issue
  reason: "User reported: ..."
  severity: major
```

<guidelines>
**Test sources:**

Tests are derived from TWO sources:
1. **PLAN.md `<success_criteria>` items** - Each checklist item becomes a test. These verify that the plan's deliverables were achieved.
2. **argument-map.md claims mapped to this section** - Each claim assigned to this section becomes a test. These verify that the section fulfills its role in the paper's argument.

**Each test is a single verifiable statement.** Do not combine multiple criteria into one test.

**Status transitions:**
- `pending` - Not yet evaluated
- `pass` - User confirmed criterion is met
- `skip` - User determined criterion is not applicable
- `issue` - User identified a problem

Transitions are one-way: `pending -> pass | skip | issue`. A test cannot return to pending.

**Severity classification for gaps:**
- `major` - Undermines the section's argument or misses a key claim. Must fix before submission.
- `minor` - Weakens but does not invalidate. Should fix if time allows.
- `cosmetic` - Polish issue (word choice, formatting, flow). Fix during final pass.

**File location:** UAT.md lives in the section directory alongside PLAN.md and SUMMARY.md:
```
.planning/sections/XX-name/
  XX-YY-PLAN.md
  XX-YY-SUMMARY.md
  UAT.md           <-- this file
```

**Persistence:** UAT.md survives `/clear`. On each invocation, verify-work reads UAT.md, finds the next `pending` test, presents it, records the result, and writes back. This enables verification to span multiple sessions.

**Resumption:** The `last_test` field tracks the most recently evaluated test number. On resume, find the first test with `result: pending` (which may differ from last_test + 1 if tests were skipped non-sequentially).
</guidelines>
