<purpose>
Surface Claude's assumptions about a section before planning, enabling users to
correct misconceptions early.

Key difference from discuss-section: This is ANALYSIS of what Claude thinks,
not INTAKE of what user knows. No file output - purely conversational to prompt discussion.
</purpose>

<process>

[step:validate_section p=1]
RUN: cat .planning/ROADMAP.md | grep -i "Section ${SECTION}"
IF argument_missing → ```
IF argument_provided → Validate section exists in roadmap:
IF section_not_found → ```
IF section_found → parse_fields
[/step]

[step:analyze_section]
[/step]

[step:present_assumptions]
[/step]

[step:gather_feedback]
IF user_provides_corrections → Acknowledge the corrections:
IF user_confirms_assumptions → ```
[/step]

[step:offer_next]
[/step]

</process>

<success_criteria>
- Section number validated against roadmap
- Assumptions surfaced across five areas: content approach, writing order, scope, challenges, dependencies
- Confidence levels marked where appropriate
- "What do you think?" prompt presented
- User feedback acknowledged
- Clear next steps offered
</success_criteria>