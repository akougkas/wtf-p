<purpose>
Conversational section acceptance testing. Present tests one at a time derived from
PLAN.md success criteria and argument-map.md claims. Persist state in UAT.md that
survives /clear. Route to plan-revision when issues are found.
</purpose>

<process>

[step:load_state]
RUN: cat .planning/STATE.md 2>/dev/null
RUN: cat .planning/config.json 2>/dev/null
PARSE: position, decisions, commit_docs flag
[/step]

[step:find_section]
RESOLVE: $ARGUMENTS → section number or name
RUN: SECTION_DIR=$(ls -d .planning/sections/${SECTION}-* 2>/dev/null | head -1)
VALIDATE: SUMMARY.md exists in section dir (cannot verify unwritten section)
IF no_summary → ERROR "Section not written yet. Use /wtfp:write-section first."
[/step]

[step:load_or_create_uat]
RUN: UAT_PATH="$SECTION_DIR/UAT.md"
IF exists → read, count completed/pending, find next pending test, report "Resuming (N/M complete)"
IF not_exists → derive tests from TWO sources:
  1. PLAN.md <success_criteria> items → each `- [ ]` becomes a test [plan]
  2. argument-map.md claims for this section → each claim becomes a test [argument-map]
  WRITE UAT.md with status:testing, all tests pending
  REPORT "Starting verification (M tests)"
[/step]

[step:present_test]
FIND: next test with result: pending
EMIT checkpoint box:
  ════════════════════════════════════════
  VERIFICATION: Test {N} of {total}
  ════════════════════════════════════════
  Source: {[plan] or [argument-map]}
  {criterion or claim text}
  ════════════════════════════════════════
ASK: "Pass - meets criteria" | "Skip - not applicable" | "Issue - describe the problem"
[/step]

[step:record_result]
UPDATE UAT.md: set result + reason on current test, increment last_test
IF issue → ASK severity: "Major" | "Minor" | "Cosmetic"
  ADD to ## Gaps section with claim, reason, severity
WRITE UAT.md to disk (persistence across /clear)
[/step]

[step:check_completion]
COUNT: tests with result: pending
IF pending > 0 → loop to present_test
IF pending == 0 → set status: complete, calculate summary counts, update UAT.md
[/step]

[step:route_on_completion]
IF no_issues → EMIT "WTF-P ► VERIFICATION PASSED" banner, offer /wtfp:progress
IF issues → EMIT "WTF-P ► VERIFICATION: ISSUES FOUND" banner + gap summary table, offer /wtfp:plan-revision
[/step]

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
