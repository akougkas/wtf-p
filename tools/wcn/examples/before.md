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
ls .planning/sections/XX-name/*-PLAN.md 2>/dev/null | sort
ls .planning/sections/XX-name/*-SUMMARY.md 2>/dev/null | sort
```

**If mode="yolo":**
- Auto-approved execution
- Proceed directly to load_prompt step

**If mode="interactive":**
- Present plan for confirmation
- Wait for user approval
- Best for: careful review

**If mode="scaffold":**
- Claude outlines, user fills
- Best for: results, arguments
</step>

<writing_modes>
## Writing Mode Execution

**If mode="co-author":**
- Claude drafts, user refines
- Write complete prose following outline
- Best for: Methods, background, boilerplate

**If mode="scaffold":**
- Claude outlines, user fills
- Create detailed paragraph-level outline
- Best for: Results interpretation, discussion

**If mode="reviewer":**
- User writes, Claude critiques
- Read existing text carefully
- Best for: Abstract, discussion, conclusions
</writing_modes>

<deviation_rules>

**RULE 1: Auto-fix factual errors**

**Trigger:** Incorrect fact, wrong citation, logical contradiction

**Action:** Fix immediately, track for Summary

**Examples:**
- Wrong year on a citation
- Contradicting a claim from earlier section
- Misrepresenting a source's findings

**Process:**
1. Fix the error inline
2. Note the correction
3. Continue writing
4. Track in adjustments list

**No user permission needed.** Errors must be fixed for accuracy.

---

**RULE 2: Auto-add missing critical elements**

**Trigger:** Required element missing for section completeness

**Action:** Add immediately, track for Summary

**Examples:**
- Missing thesis statement in introduction
- No citation for a key claim
- Missing transition between paragraphs

**No user permission needed.** Critical elements must be present.

</deviation_rules>

<verification>
## Three-Layer Verification

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
</verification>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/structure/argument-map.md
@.planning/sources/literature.md
</context>

<routing>
**Route A: More plans remain in this section**

Present completion and offer next plan. Show progress indicator.

```
Plan {section}-{plan} complete.
{Y} of {X} plans complete for Section {Z}.
```

Offer `/wtfp:write-section` for next plan.

**Route B: Section complete, more sections remain**

Present section completion. Show overall progress.

```
Section {Z}: {Section Name} Complete
All {Y} plans finished. {word-count} words written.
```

Offer `/wtfp:plan-section {next}` for next section.

**Route C: Document complete (all sections done)**

Present document completion celebration.

```
DOCUMENT COMPLETE!
All {N} sections complete!
Total words: {word-count}
```

Offer `/wtfp:submit-draft` for final submission.
</routing>

</process>
