<purpose>
Execute all sections via wave-based parallel execution. Sections grouped by wave number.
Each wave runs parallel; waves run sequentially. After final wave, spawn coherence-checker.
</purpose>

<process>

[step:load_state p=1]
RUN: cat .planning/STATE.md 2>/dev/null
RUN: cat .planning/config.json 2>/dev/null
RESOLVE: MODEL_PROFILE from config (default: balanced)
[/step]

[step:validate_environment]
REQUIRE: .planning/ROADMAP.md (else: /wtfp:create-outline)
REQUIRE: .planning/sections/*/*-PLAN.md (else: /wtfp:plan-section)
CHECK: existing SUMMARY.md count (warn if all complete)
[/step]

[step:build_wave_plan]
PARSE: all PLAN.md frontmatter for wave numbers
GROUP: sections by wave (wave 1 = independent, wave N = depends on N-1)
PRESENT: execution plan (waves, sections per wave, total words)
[/step]

[step:resolve_models]
MODEL_TABLE{agent,quality,balanced,budget}:
  section-writer | opus | sonnet | sonnet
  coherence-checker | sonnet | sonnet | haiku
STORE: writer_model, checker_model
[/step]

[step:execute_waves]
FOR wave = 1 to max_wave:
  1. EMIT: wave banner with section list
  2. FOR each section in wave:
     - LOAD: CONTEXT.md, RESEARCH.md, prior SUMMARYs
     - SPAWN: Task(section-writer, model=writer_model) per PLAN.md
     - Parallel within wave
  3. COLLECT: all returns
  4. ROUTE:
     - WRITING COMPLETE → update STATE.md, ROADMAP.md
     - CHECKPOINT REACHED → present to user, get response
     - WRITING BLOCKED → present options: retry | skip | abort
  5. VERIFY: all wave sections resolved before next wave
  6. UPDATE: progress in STATE.md
[/step]

[step:spawn_coherence_checker]
AFTER final wave:
READ_INLINE: paper/*.md, argument-map.md, narrative-arc.md, outline.md
SPAWN: Task(coherence-checker, model=checker_model)
  CONTEXT: <paper_content>, <argument_map>, <narrative_arc>, <outline> (all inline)
NOTE: inline context avoids redundant file reads in checker agent
[/step]

[step:handle_coherence_result]
ROUTE:
  COHERENT → update STATE.md, proceed to completion
  GAPS FOUND → present gaps, OPTIONS: fix now | accept | plan revision
[/step]

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
