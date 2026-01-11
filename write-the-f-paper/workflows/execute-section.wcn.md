<purpose>
Execute a section prompt (PLAN.md) and create the outcome summary (SUMMARY.md).
</purpose>

<required_reading>
Read STATE.md before any operation to load project context.
</required_reading>

<process>

[step:load_project_state p=1]
RUN: cat .planning/STATE.md 2>/dev/null
PARSE: current, word, argument, open
IF file_exists → parse_fields
IF file_missing_but_.planning/_exists → ```
IF .planning/_doesnt_exist → ERROR ""
[/step]

[step:identify_plan]
RUN: cat .planning/ROADMAP.md
RUN: cat .planning/config.json 2>/dev/null
[/step]

[step:record_start_time]
RUN: PLAN_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
[/step]

[step:load_prompt]
RUN: cat .planning/sections/XX-name/{section}-{plan}-PLAN.md
IF plan_references_CONTEXT.md → The CONTEXT.md file provides the user's vision ...
[/step]

[step:previous_section_check]
[/step]

[step:execute]
IF `type=auto` → - Determine writing mode from task (co-author, ...
IF mode=co-author → Write the prose directly
IF mode=scaffold → Create detailed outline for user to fill
IF mode=reviewer → Analyze existing text, provide feedback
[/step]

<writing_modes>
## Writing Mode Execution

**Co-Author Mode (Claude drafts):**
- Write complete prose following outline/structure
- Match user's voice from prior sections
- Flag claims needing citations with [CITE: topic]
- Flag uncertain statements with [VERIFY: claim]
- Aim for word target specified in task

**Scaffold Mode (Claude outlines):**
- Create detailed paragraph-level outline
- Specify what each paragraph should accomplish
- Identify where citations should go
- Note transition needs between paragraphs
- Leave actual prose writing to user

**Reviewer Mode (Claude critiques):**
- Read existing text carefully
- Identify strengths first
- Note logical gaps or weak arguments
- Suggest specific improvements
- Ask clarifying questions before major changes
</writing_modes>

<deviation_rules>

## Automatic Adjustment Handling

**While writing, you WILL discover issues.** This is normal.

Apply these rules automatically. Track all adjustments for Summary documentation.

---

[rule:autofix_factual_errors]
TRIGGER: incorrect_fact | wrong_citation | logical_contradiction
ACTION: fix immediately + track for summary
PERMISSION: none_required
[/rule]---

[rule:autoadd_missing_critical_elements]
TRIGGER: required_element_missing_for_section_completeness
ACTION: add immediately + track for summary
[/rule]---

[rule:autofix_blocking_issues]
TRIGGER: something_prevents_completing_the_writing_task
ACTION: fix immediately to unblock + track for summary
[/rule]---

[rule:ask_about_structural_changes]
TRIGGER: writing_requires_significant_restructuring
ACTION: stop + present to user + wait for decision
[/rule]---

[rule:log_enhancement_ideas]
TRIGGER: improvement_that_would_enhance_writing_but_isn't_essential_now
ACTION: add to notes automatically + continue writing
[/rule]---

**RULE PRIORITY (when multiple could apply):**

1. **If Rule 4 applies** → STOP and ask (structural decision)
2. **If Rules 1-3 apply** → Fix automatically, track for Summary
3. **If Rule 5 applies** → Log for later, continue

</deviation_rules>

<three_layer_verification>
## Verification During Execution

After each task, run verification checks:

**1. Citation Check (Mechanical)**
- All claims have citations or are clearly original claims
- Citations formatted correctly
- No [CITE: ] placeholders remaining
- Page numbers where style requires

**2. Argument Coherence (Logical)**
- Claims follow from evidence
- No logical contradictions with prior sections
- Thesis supported by content
- Flow between paragraphs makes sense

**3. Rubric Check (Requirements)**
- Word count within target range
- Required elements present
- Formatting requirements met
- Section accomplishes its goal
</three_layer_verification>

<task_commit>
## Task Commit Protocol

After each task completes (verification passed, done criteria met), commit immediately:

**1. Identify modified files:**

Track files changed during this specific task:

```bash
git status --short
```

**2. Stage only task-related files:**

```bash
# Example - adjust to actual files modified
git add paper/sections/introduction.md
git add paper/references.bib
```

**3. Determine commit type:**

| Type | When to Use | Example |
|------|-------------|---------|
| `content` | New prose, new paragraphs | content(02-01): draft introduction hook |
| `cite` | Adding/fixing citations | cite(02-01): add Smith2023 to literature review |
| `revise` | Revising existing text | revise(02-01): strengthen thesis statement |
| `fix` | Fixing errors | fix(02-01): correct misattributed quote |
| `structure` | Reorganizing | structure(02-01): reorder methods subsections |

**4. Craft commit message:**

```bash
git commit -m "{type}({section}-{plan}): {task description}

- {key change 1}
- {key change 2}
"
```

**5. Record commit hash for SUMMARY.md**
</task_commit>

[step:checkpoint_protocol]
[/step]

[step:verification_failure_gate]
[/step]

[step:record_completion_time]
RUN: PLAN_END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
[/step]

[step:create_summary]
[/step]

[step:update_state]
[/step]

[step:update_roadmap]
IF more_plans_remain_in_this_section → - Update plan count: "2/3 plans complete"
IF this_was_the_last_plan_in_the_section → - Mark section complete: status → "Complete"
[/step]

[step:git_commit_metadata]
RUN: git add .planning/sections/XX-name/{section}-{plan}-SUMMARY.md
[/step]

[step:offer_next]
RUN: ls -1 .planning/sections/[current-section-dir]/*-PLAN.md 2>/dev/null | wc -l
[/step]

</process>

<success_criteria>

- All tasks from PLAN.md completed
- All verifications pass (citation, coherence, rubric)
- SUMMARY.md created with substantive content
- STATE.md updated (position, word count, argument strength)
- ROADMAP.md updated
- Paper content committed with meaningful messages
</success_criteria>