# Continue-Here Template

Copy and fill this structure for `.planning/sections/XX-name/.continue-here.md`:

```yaml
---
section: XX-name
task: 3
total_tasks: 7
status: in_progress
last_updated: 2025-01-15T14:30:00Z
---
```

```markdown
<current_state>
[Where exactly are we in the writing? What's the immediate context?]
</current_state>

<completed_work>
[What got written this session - be specific]

- Task 1: [name] - Done
- Task 2: [name] - Done
- Task 3: [name] - In progress, [what's done on it]
</completed_work>

<remaining_work>
[What's left in this section]

- Task 3: [name] - [what's left to write]
- Task 4: [name] - Not started
- Task 5: [name] - Not started
</remaining_work>

<decisions_made>
[Key decisions and why - so next session doesn't re-debate]

- Decided to use [X] framing because [reason]
- Chose [approach] over [alternative] because [reason]
</decisions_made>

<word_count>
Current: [X] words written
Target: [Y] words for section
Remaining budget: [Z] words
</word_count>

<blockers>
[Anything stuck or waiting on external factors]

- [Blocker 1]: [status/workaround]
</blockers>

<context>
[Mental state, "vibe", anything that helps resume smoothly]

[What were you thinking about? What was the plan?
This is the "pick up exactly where you left off" context.]
</context>

<next_action>
[The very first thing to do when resuming]

Start with: [specific action]
</next_action>
```

<yaml_fields>
Required YAML frontmatter:

- `section`: Directory name (e.g., `02-methods`)
- `task`: Current task number
- `total_tasks`: How many tasks in section
- `status`: `in_progress`, `blocked`, `almost_done`
- `last_updated`: ISO timestamp
</yaml_fields>

<guidelines>
- Be specific enough that a fresh Claude instance understands immediately
- Include WHY decisions were made, not just what
- Include word count progress so next session knows budget
- The `<next_action>` should be actionable without reading anything else
- This file gets DELETED after resume - it's not permanent storage
</guidelines>

<example>
```yaml
---
section: 03-methods
task: 4
total_tasks: 6
status: in_progress
last_updated: 2025-01-20T16:45:00Z
---
```

```markdown
<current_state>
Writing the Analysis subsection of Methods. Just finished the Measures subsection. Have participant demographics and procedures done.
</current_state>

<completed_work>
- Task 1: Participants subsection - Done (demographics, N=45, inclusion criteria)
- Task 2: Procedures subsection - Done (study flow, timing, conditions)
- Task 3: Measures subsection - Done (all instruments described with citations)
- Task 4: Analysis subsection - In progress, wrote intro paragraph about approach
</completed_work>

<remaining_work>
- Task 4: Analysis - Need to describe specific statistical tests and software
- Task 5: Ethical considerations - IRB statement, consent process
- Task 6: Final polish - Transitions, word count trimming
</remaining_work>

<decisions_made>
- Used Cohen (2020) framework for analysis - matches prior literature
- Decided NOT to include power analysis in main text (will add to supplementary if reviewers ask)
- Put measures before analysis (reviewer suggested this order)
</decisions_made>

<word_count>
Current: 892 words written
Target: 1200 words for section
Remaining budget: 308 words
</word_count>

<blockers>
None currently
</blockers>

<context>
The analysis section needs to justify N=45 indirectly through effect size discussion. Main worry is reviewer pushback on sample size. Tone should be confident but not dismissive of limitation.

Planning to use "Following Cohen (2020), we employed..." structure for consistency.
</context>

<next_action>
Start with: Continue Task 4 - write the specific statistical tests paragraph (t-tests for group comparisons, regression for predictors)
</next_action>
```
</example>
