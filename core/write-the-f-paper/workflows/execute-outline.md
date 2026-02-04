<purpose>
Execute all document sections via wave-based parallel execution. Sections are grouped
by wave number (from PLAN.md frontmatter). Each wave runs in parallel; waves execute
sequentially. After the final wave, spawn coherence-checker for cross-section verification.
</purpose>

<process>

<step name="load_state" priority="first">
Before any operation, read project state:

```bash
cat .planning/STATE.md 2>/dev/null
cat .planning/config.json 2>/dev/null
```

Parse current position, accumulated decisions. Load planning config.

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```
</step>

<step name="validate_environment">
Verify outline exists and plans are ready:

```bash
[ ! -f .planning/ROADMAP.md ] && echo "ERROR: No outline. Run /wtfp:create-outline" && exit 1
```

Check that PLAN.md files exist for sections:
```bash
PLAN_COUNT=$(ls .planning/sections/*/*-PLAN.md 2>/dev/null | wc -l)
[ "$PLAN_COUNT" -eq 0 ] && echo "ERROR: No plans found. Run /wtfp:plan-section for each section" && exit 1
```

Check for already-completed sections (SUMMARY.md exists):
```bash
SUMMARY_COUNT=$(ls .planning/sections/*/*-SUMMARY.md 2>/dev/null | wc -l)
```

If all sections already have SUMMARYs, warn: "All sections already written. Re-execute?"
</step>

<step name="build_wave_plan">
Parse ROADMAP.md and all PLAN.md files to group by wave:

```bash
for plan in .planning/sections/*/*-PLAN.md; do
  section_dir=$(dirname "$plan")
  section_name=$(basename "$section_dir")
  wave=$(grep -m1 'wave:' "$plan" | grep -o '[0-9]*')
  echo "wave=$wave section=$section_name plan=$plan"
done | sort -t= -k2 -n
```

Build execution plan:
- Group sections by wave number
- Within each wave: list all plans per section
- Identify max_wave for termination

Present plan before execution.
</step>

<step name="resolve_models">
Resolve models from profile for writer and coherence-checker:

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| section-writer | opus | sonnet | sonnet |
| coherence-checker | sonnet | sonnet | haiku |

Store writer_model and checker_model for spawn calls.
</step>

<step name="execute_waves">
For wave = 1 to max_wave:

**1. Display wave banner** with section list.

**2. For each section in wave:**
   - Find all PLAN.md files for the section
   - Load section-specific context (CONTEXT.md, RESEARCH.md, prior SUMMARYs)
   - Spawn Task() for each plan with section-writer agent

   ```
   Task(
     prompt="First, read ~/.claude/agents/wtfp/section-writer.md...\n\n" + context,
     subagent_type="general-purpose",
     model="{writer_model}",
     description="Write {section-name}"
   )
   ```

   Sections within the same wave spawn in parallel.

**3. Collect returns** from all writers in this wave.

**4. Handle results:**
   - WRITING COMPLETE: Update STATE.md, mark section in ROADMAP.md
   - CHECKPOINT REACHED: Present to user, get response
   - WRITING BLOCKED: Present to user with options (retry, skip, abort)

**5. Verify all wave sections resolved** before proceeding to next wave.

**6. Update progress** in STATE.md and ROADMAP.md.
</step>

<step name="spawn_coherence_checker">
After the final wave completes:

Read all written content inline:
```bash
ALL_PAPER_CONTENT=$(cat paper/*.md 2>/dev/null)
ARGMAP=$(cat .planning/structure/argument-map.md 2>/dev/null)
NARRATIVE=$(cat .planning/structure/narrative-arc.md 2>/dev/null)
OUTLINE=$(cat .planning/structure/outline.md 2>/dev/null)
```

Spawn coherence-checker with explicit inline context (not file references):

```
Task(
  prompt="First, read ~/.claude/agents/wtfp/coherence-checker.md...\n\n" +
    "<paper_content>" + ALL_PAPER_CONTENT + "</paper_content>" +
    "<argument_map>" + ARGMAP + "</argument_map>" +
    "<narrative_arc>" + NARRATIVE + "</narrative_arc>" +
    "<outline>" + OUTLINE + "</outline>",
  subagent_type="general-purpose",
  model="{checker_model}",
  description="Verify Cross-Section Coherence"
)
```

**Why inline:** Coherence-checker is read-only and needs all content in context. File references would require the agent to re-read everything, wasting context budget.
</step>

<step name="handle_coherence_result">
Route based on coherence-checker return:

**COHERENT:** All sections pass cross-verification.
- Update STATE.md with coherence status
- Proceed to completion

**GAPS FOUND:** Issues detected across sections.
- Present gap list to user
- Options:
  - Fix now: Re-spawn writers for affected sections
  - Accept: Proceed with known gaps
  - Plan revision: Create revision plans for affected sections
</step>

</process>

<success_criteria>
- [ ] Wave execution plan built from ROADMAP.md and PLAN.md frontmatter
- [ ] All waves executed in dependency order
- [ ] Parallel Task() spawns within each wave
- [ ] Checkpoints handled between waves
- [ ] Coherence-checker spawned after final wave with inline paper content
- [ ] Coherence result routed (COHERENT or GAPS FOUND)
- [ ] STATE.md and ROADMAP.md updated throughout
</success_criteria>
