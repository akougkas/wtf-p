<purpose>
Execute a section prompt (PLAN.md) and create the outcome summary (SUMMARY.md).
</purpose>

<required_reading>
Read STATE.md before any operation to load project context.
</required_reading>

<process>

<step name="load_project_state" priority="first">
Before any operation, read project state:

```bash
cat .planning/STATE.md 2>/dev/null
```

**If file exists:** Parse and internalize:

- Current position (section, plan, status)
- Word count progress (current vs target)
- Argument strength (what's been established)
- Open questions (things to watch for)

**If file missing but .planning/ exists:**

```
STATE.md missing but planning artifacts exist.
Options:
1. Reconstruct from existing artifacts
2. Continue without project state (may lose accumulated context)
```

**If .planning/ doesn't exist:** Error - project not initialized.

This ensures every writing session has full project context.
</step>

<step name="identify_plan">
Find the next plan to execute:
- Check roadmap for "In progress" section
- Find plans in that section directory
- Identify first plan without corresponding SUMMARY

```bash
cat .planning/ROADMAP.md
# Look for section with "In progress" status
# Then find plans in that section
ls .planning/sections/XX-name/*-PLAN.md 2>/dev/null | sort
ls .planning/sections/XX-name/*-SUMMARY.md 2>/dev/null | sort
```

**Logic:**

- If `01-01-PLAN.md` exists but `01-01-SUMMARY.md` doesn't → execute 01-01
- If `01-01-SUMMARY.md` exists but `01-02-SUMMARY.md` doesn't → execute 01-02
- Pattern: Find first PLAN file without matching SUMMARY file

Confirm with user if ambiguous.

<config-check>
```bash
cat .planning/config.json 2>/dev/null
```
</config-check>

<if mode="yolo">
```
Auto-approved: Execute {section}-{plan}-PLAN.md
[Plan X of Y for Section Z]

Starting writing session...
```

Proceed directly to load_prompt step.
</if>

<if mode="interactive" OR="custom with gates.execute_next_plan true">
Present:

```
Found plan to execute: {section}-{plan}-PLAN.md
[Plan X of Y for Section Z]

Proceed with writing?
```

Wait for confirmation before proceeding.
</if>
</step>

<step name="record_start_time">
Record execution start time for performance tracking:

```bash
PLAN_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_START_EPOCH=$(date +%s)
```

Store in shell variables for duration calculation at completion.
</step>

<step name="load_prompt">
Read the plan prompt:
```bash
cat .planning/sections/XX-name/{section}-{plan}-PLAN.md
```

This IS the execution instructions. Follow it exactly.

**If plan references CONTEXT.md:**
The CONTEXT.md file provides the user's vision for this section — how they imagine it reading, what's essential, and what's out of scope. Honor this context throughout writing.
</step>

<step name="previous_section_check">
Before writing, check if previous section had issues:

```bash
# Find previous section summary
ls .planning/sections/*/SUMMARY.md 2>/dev/null | sort -r | head -2 | tail -1
```

If previous section SUMMARY.md has "Issues Encountered" != "None" or "Next Section Readiness" mentions blockers:

Use AskUserQuestion:

- header: "Previous Issues"
- question: "Previous section had unresolved items: [summary]. How to proceed?"
- options:
  - "Proceed anyway" - Issues won't block this section
  - "Address first" - Let's resolve before continuing
  - "Review previous" - Show me the full summary
</step>

<step name="execute">
Execute each task in the prompt. **Adjustments are normal** - handle them automatically using embedded rules below.

1. Read the @context files listed in the prompt

2. For each task:

   **If `type="auto"`:**

   - Determine writing mode from task (co-author, scaffold, reviewer)
   - Execute the writing action specified
   - **If mode="co-author":** Write the prose directly
   - **If mode="scaffold":** Create detailed outline for user to fill
   - **If mode="reviewer":** Analyze existing text, provide feedback
   - Run the verification (citation check, coherence check)
   - Confirm done criteria met
   - **Commit the task** (see `<task_commit>` below)
   - Track task completion and word count for Summary
   - Continue to next task

   **If `type="checkpoint:*"`:**

   - STOP immediately (do not continue to next task)
   - Execute checkpoint_protocol (see below)
   - Wait for user response
   - Only after user confirmation: continue to next task

3. Run overall verification checks from `<verification>` section
4. Confirm all success criteria from `<success_criteria>` section met
5. Document all adjustments in Summary
</step>

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

**RULE 1: Auto-fix factual errors**

**Trigger:** Incorrect fact, wrong citation, logical contradiction

**Action:** Fix immediately, track for Summary

**Examples:**
- Wrong year on a citation
- Contradicting a claim from earlier section
- Misrepresenting a source's findings
- Logical inconsistency in argument

**Process:**
1. Fix the error inline
2. Note the correction
3. Continue writing
4. Track in adjustments list: `[Rule 1 - Error] [description]`

**No user permission needed.** Errors must be fixed for accuracy.

---

**RULE 2: Auto-add missing critical elements**

**Trigger:** Required element missing for section completeness

**Action:** Add immediately, track for Summary

**Examples:**
- Missing thesis statement in introduction
- No citation for a key claim
- Missing transition between paragraphs
- Required section element not present (e.g., no methods overview)

**Process:**
1. Add the missing element inline
2. Note what was added
3. Continue writing
4. Track in adjustments list: `[Rule 2 - Missing] [description]`

**Critical = required for section to function in the document.**

---

**RULE 3: Auto-fix blocking issues**

**Trigger:** Something prevents completing the writing task

**Action:** Fix immediately to unblock, track for Summary

**Examples:**
- Source document can't be accessed
- Prior section missing content this builds on
- Conflicting guidance in structure docs

**Process:**
1. Fix or work around the blocker
2. Note the workaround
3. Continue writing
4. Track in adjustments list: `[Rule 3 - Blocking] [description]`

---

**RULE 4: Ask about structural changes**

**Trigger:** Writing requires significant restructuring

**Action:** STOP, present to user, wait for decision

**Examples:**
- Need to reorganize entire section
- Argument requires different approach than planned
- Word budget significantly exceeded/underrun
- Need to add/remove major subsections

**Process:**
1. STOP current task
2. Present clearly:

```
Structural Decision Needed

Current task: [task name]
Discovery: [what you found]
Proposed change: [structural modification]
Why needed: [rationale]
Impact: [what this affects - word count, flow, other sections]

Proceed with proposed change? (yes / different approach / defer)
```

3. WAIT for user response
4. If approved: implement, track as `[Rule 4 - Structural] [description]`
5. If different approach: discuss and implement
6. If deferred: log to notes, continue without change

---

**RULE 5: Log enhancement ideas**

**Trigger:** Improvement that would enhance writing but isn't essential now

**Action:** Add to notes automatically, continue writing

**Examples:**
- Could add more supporting evidence
- Prose could be more elegant
- Additional example would strengthen point
- Nice-to-have transition improvement

**Process:**
1. Note the enhancement idea
2. Brief notification: `Noted enhancement: [brief]`
3. Continue writing without implementing
4. Include in Summary under "Enhancements for Revision"

---

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

<step name="checkpoint_protocol">
When encountering `type="checkpoint:*"`:

**Display checkpoint clearly:**

```
════════════════════════════════════════
CHECKPOINT: [Type]
════════════════════════════════════════

Task [X] of [Y]: [What was written/needs review]

[Display task-specific content based on type]

[Resume signal instruction]
════════════════════════════════════════
```

**For checkpoint:human-verify (most common):**

```
I wrote: [summary of what was drafted]

Please review:
1. [Specific aspect to check]
2. [Another aspect]
3. [Expected quality]

Type 'approved' or describe issues
```

**For checkpoint:decision (voice/framing choices):**

```
Decision needed: [choice]

Context: [why this matters]

Options:
1. [option-id]: [description]
2. [option-id]: [description]

Select: option-id
```

**After displaying:** WAIT for user response. Do NOT continue to next task.

**After user responds:**
- If approved: continue to next task
- If issues: address and re-present
</step>

<step name="verification_failure_gate">
If any verification fails:

STOP. Do not continue to next task.

Present inline:
"Verification failed for Task [X]: [task name]

Expected: [verification criteria]
Actual: [what happened]

How to proceed?

1. Retry - Try the task again
2. Skip - Mark as incomplete, continue
3. Stop - Pause writing, investigate"

Wait for user decision.

If user chose "Skip", note it in SUMMARY.md under "Issues Encountered".
</step>

<step name="record_completion_time">
Record execution end time and calculate duration:

```bash
PLAN_END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_END_EPOCH=$(date +%s)

DURATION_SEC=$(( PLAN_END_EPOCH - PLAN_START_EPOCH ))
DURATION_MIN=$(( DURATION_SEC / 60 ))
```
</step>

<step name="create_summary">
Create `{section}-{plan}-SUMMARY.md` as specified in the prompt's `<output>` section.
Use ~/.claude/write-the-f-paper/templates/summary.md for structure.

**File location:** `.planning/sections/XX-name/{section}-{plan}-SUMMARY.md`

**Frontmatter population:**

1. **Basic identification:**
   - section: From PLAN.md frontmatter
   - plan: From PLAN.md frontmatter
   - subsection: Topic focus of this plan

2. **Content tracking:**
   - words-written: Count from this session
   - words-target: From PLAN.md
   - key-claims: What arguments were made
   - sources-cited: Which citations were added

3. **Quality assessment:**
   - argument-strength: How solid is this section's contribution
   - verification-status: Which checks passed

**Title format:** `# Section [X] Plan [Y]: [Name] Summary`

The one-liner must be SUBSTANTIVE:
- Good: "Introduction hook establishing AI safety gap with 3 key citations"
- Bad: "Introduction written"

**Include:**
- Duration: `$DURATION`
- Words written: (count from execution)
- Tasks completed: (count from execution)
- Sources cited: (list from execution)

**Next Step section:**
- If more plans exist in this section: "Ready for {section}-{next-plan}-PLAN.md"
- If this is the last plan: "Section complete, ready for transition"
</step>

<step name="update_state">
Update STATE.md:

**Current Position:**
```markdown
Section: [current] of [total] ([section name])
Plan: [just completed] of [total in section]
Status: [In progress / Section complete]
Last activity: [today] - Completed {section}-{plan}-PLAN.md
```

**Word Count:**
```markdown
Target: [total target] words
Current: [updated count] words
Remaining: [updated remaining] words
```

**Section Progress table:** Update words and status for current section.

**Argument Strength:** Update if this section strengthened/weakened the thesis.
</step>

<step name="update_roadmap">
Update the roadmap file:

**If more plans remain in this section:**
- Update plan count: "2/3 plans complete"
- Keep section status as "In progress"

**If this was the last plan in the section:**
- Mark section complete: status → "Complete"
- Add completion date
- Update word count
</step>

<step name="git_commit_metadata">
Commit execution metadata (SUMMARY + STATE + ROADMAP):

```bash
git add .planning/sections/XX-name/{section}-{plan}-SUMMARY.md
git add .planning/STATE.md
git add .planning/ROADMAP.md

git commit -m "$(cat <<'EOF'
docs({section}-{plan}): complete [plan-name] plan

Tasks completed: [N]/[N]
Words written: [count]
- [Task 1 name]
- [Task 2 name]

SUMMARY: .planning/sections/XX-name/{section}-{plan}-SUMMARY.md
EOF
)"
```
</step>

<step name="offer_next">
**MANDATORY: Verify remaining work before presenting next steps.**

**Step 1: Count plans and summaries in current section**

```bash
ls -1 .planning/sections/[current-section-dir]/*-PLAN.md 2>/dev/null | wc -l
ls -1 .planning/sections/[current-section-dir]/*-SUMMARY.md 2>/dev/null | wc -l
```

**Step 2: Route based on plan completion**

| Condition | Meaning | Action |
|-----------|---------|--------|
| summaries < plans | More plans remain | **Route A** |
| summaries = plans | Section complete | Go to Step 3 |

---

**Route A: More plans remain in this section**

```
Plan {section}-{plan} complete.
Summary: .planning/sections/{section-dir}/{section}-{plan}-SUMMARY.md

{Y} of {X} plans complete for Section {Z}.

---

## Next Up

**{section}-{next-plan}: [Plan Name]** — [objective from next PLAN.md]

`/wtfp:write-section .planning/sections/{section-dir}/{section}-{next-plan}-PLAN.md`

<sub>`/clear` first → fresh context window</sub>

---
```

---

**Step 3: Check document status (only when all plans in section complete)**

Read ROADMAP.md to identify next section.

**Route B: Section complete, more sections remain**

```
Plan {section}-{plan} complete.
Summary: .planning/sections/{section-dir}/{section}-{plan}-SUMMARY.md

## Section {Z}: {Section Name} Complete

All {Y} plans finished. {word-count} words written.

---

## Next Up

**Section {Z+1}: {Next Section Name}** — {Goal from ROADMAP.md}

`/wtfp:plan-section {Z+1}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/wtfp:review-section {Z}` — verify section before continuing
- `/wtfp:discuss-section {Z+1}` — gather context first
- Review section before continuing

---
```

---

**Route C: Document complete (all sections done)**

```
DOCUMENT COMPLETE!

Plan {section}-{plan} complete.

## Section {Z}: {Section Name} Complete

════════════════════════════════════════
All {N} sections complete!
Total words: {word-count}
Document is ready for review.
════════════════════════════════════════

---

## Next Up

**Submit Draft** — prepare for submission

`/wtfp:submit-draft`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/wtfp:review-section` — full document verification
- Review accomplishments before submitting

---
```

</step>

</process>

<success_criteria>

- All tasks from PLAN.md completed
- All verifications pass (citation, coherence, rubric)
- SUMMARY.md created with substantive content
- STATE.md updated (position, word count, argument strength)
- ROADMAP.md updated
- Paper content committed with meaningful messages
</success_criteria>
