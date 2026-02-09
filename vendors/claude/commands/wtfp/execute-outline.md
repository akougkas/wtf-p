---
name: wtfp:execute-outline
description: Write all sections in parallel, then check coherence
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<execution_context>
@~/.claude/write-the-f-paper/workflows/execute-outline.md
@~/.claude/write-the-f-paper/references/checkpoints.md
@~/.claude/write-the-f-paper/references/ui-brand.md
</execution_context>

<objective>
Execute all sections of a paper in wave-based parallel execution, then verify cross-section coherence.

**Orchestrator role:** Load roadmap and all plans, group sections by wave, spawn parallel write-section Task() calls per wave, collect results, handle checkpoints between waves, spawn coherence-checker after final wave, present results.

**Why wave execution:** Sections within the same wave have no dependencies and can be written in parallel. Sections in later waves depend on earlier waves completing. This maximizes throughput while respecting logical ordering.
</objective>

<context>
No arguments. Requires `.planning/ROADMAP.md` and PLAN.md files to exist.
</context>

<process>

## 1. Validate Environment and Resolve Model Profile

```bash
[ ! -f .planning/ROADMAP.md ] && echo "ERROR: No outline. Run /wtfp:create-outline" && exit 1
ls .planning/sections/*/  2>/dev/null
ls .planning/sections/*/*-PLAN.md 2>/dev/null
```

**Resolve model profile:**

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| section-writer | opus | sonnet | sonnet |
| coherence-checker | sonnet | sonnet | haiku |

**Resolve config flags:**
```bash
WORKFLOW_VERIFIER=$(cat .planning/config.json 2>/dev/null | grep -o '"verifier"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
```

## 2. Read Context Files

```bash
ROADMAP_CONTENT=$(cat .planning/ROADMAP.md)
STATE_CONTENT=$(cat .planning/STATE.md)
PROJECT_CONTENT=$(cat .planning/PROJECT.md)
ARGMAP_CONTENT=$(cat .planning/structure/argument-map.md 2>/dev/null)
OUTLINE_CONTENT=$(cat .planning/structure/outline.md 2>/dev/null)
NARRATIVE_CONTENT=$(cat .planning/structure/narrative-arc.md 2>/dev/null)
```

## 3. Build Wave Execution Plan

Parse ROADMAP.md and all PLAN.md files to build wave groups:

```bash
# Find all plans and their wave assignments
for plan in .planning/sections/*/*-PLAN.md; do
  section=$(basename $(dirname "$plan"))
  wave=$(grep -o 'wave:.*' "$plan" | head -1)
  echo "$wave $section $plan"
done | sort
```

Group sections by wave number:
- Wave 1: [sections with wave: 1] (independent, no dependencies)
- Wave 2: [sections with wave: 2] (depend on wave 1)
- ...
- Wave N: [final sections] (depend on all previous)

Present execution plan:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► EXECUTING OUTLINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Execution plan:
  Wave 1: [sections] (parallel)
  Wave 2: [sections] (after wave 1)
  Wave 3: [sections] (after wave 2)
  ...

Total: [N] sections, [W] words target
```

## 4. Wave Execution Loop

For each wave (1 to max_wave):

**4a. Display wave banner:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► WRITING WAVE {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**4b. Spawn parallel writers:**

For each section in the current wave, for each PLAN.md in that section:

```
Task(
  prompt="First, read ~/.claude/agents/wtfp/section-writer.md for your role and instructions.\n\n" + filled_writing_prompt,
  subagent_type="general-purpose",
  model="{writer_model}",
  description="Write Section {X}: {Name}"
)
```

Sections within the same wave are spawned in parallel (multiple Task() calls).

**4c. Collect all returns:**

For each completed writer, check return:
- `## WRITING COMPLETE` -- Record success, update STATE.md
- `## CHECKPOINT REACHED` -- Queue for user presentation
- `## WRITING BLOCKED` -- Queue for user presentation

**4d. Handle checkpoints between waves:**

If any CHECKPOINT returns from this wave:
- Present each checkpoint to user sequentially
- Get user response for each
- If checkpoint was blocking and user provides direction, note for re-execution

If any BLOCKED returns:
- Present blocker to user
- Options: retry section, skip section (continue to next wave without it), abort execution

**4e. Update progress:**

```bash
# Update STATE.md with wave completion
# Update ROADMAP.md section statuses
```

**4f. Continue to next wave** (only if all sections in current wave are COMPLETE or user chose to skip blocked ones).

## 5. Post-Execution Summary

After all waves complete:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► ALL WAVES COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sections written: [N]/[total]
Words written: [W]
Skipped: [list if any]
```

## 6. Spawn wtfp-coherence-checker

After the final wave, spawn coherence-checker with explicit inline context:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► VERIFYING COHERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Read all written content:
```bash
ALL_PAPER_CONTENT=$(cat paper/*.md 2>/dev/null)
```

Spawn with inline context (NOT file references -- provide actual content):

```
Task(
  prompt="First, read ~/.claude/agents/wtfp/coherence-checker.md for your role and instructions.\n\n" +
    "<paper_content>\n" + ALL_PAPER_CONTENT + "\n</paper_content>\n" +
    "<argument_map>\n" + ARGMAP_CONTENT + "\n</argument_map>\n" +
    "<narrative_arc>\n" + NARRATIVE_CONTENT + "\n</narrative_arc>\n" +
    "<outline>\n" + OUTLINE_CONTENT + "\n</outline>\n" +
    "Run all 5 verification passes and return structured results.",
  subagent_type="general-purpose",
  model="{checker_model}",
  description="Verify Cross-Section Coherence"
)
```

## 7. Handle Coherence Check Return

**`## COHERENT`:** All sections pass. Present success summary.

**`## GAPS FOUND`:** Present gaps to user with options:
- Fix now: Re-spawn writers for affected sections with gap context
- Accept: Note gaps, proceed to review
- Plan revision: Create revision plans for affected sections

## 8. Present Final Status

</process>

<offer_next>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► OUTLINE EXECUTED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Document: {Title}** — {N} sections, {W} words

Coherence: {Verified | Gaps found | Skipped}

───────────────────────────────────────────

## ▶ Next Up

**Verify sections** — acceptance testing

`/wtfp:verify-work [section]`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────

**Also available:**
- `/wtfp:review-section [N]` — detailed section review
- `/wtfp:polish-prose [N]` — improve prose quality
- `/wtfp:submit-draft` — prepare for submission

</offer_next>

<success_criteria>
- [ ] Roadmap and plans validated
- [ ] Wave execution plan built from section dependencies
- [ ] Parallel writers spawned per wave
- [ ] All waves executed in order
- [ ] Checkpoints handled between waves
- [ ] Coherence-checker spawned after final wave with inline content
- [ ] Coherence result handled (COHERENT or GAPS FOUND)
- [ ] STATE.md and ROADMAP.md updated
- [ ] User knows next steps
</success_criteria>
