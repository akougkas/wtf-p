<length_estimation>
Writing plans must maintain consistent quality from first task to last. This requires understanding quality degradation and splitting aggressively.

<quality_insight>
Claude degrades when it *perceives* context pressure and enters "completion mode."

| Context Usage | Quality | Claude's State |
|---------------|---------|----------------|
| 0-30% | PEAK | Thorough, nuanced writing |
| 30-50% | GOOD | Confident, solid prose |
| 50-70% | DEGRADING | Efficiency mode begins |
| 70%+ | POOR | Rushed, generic text |

**The 40-50% inflection point:** Claude sees context mounting and thinks "I'd better conserve now." Result: "I'll finish the remaining paragraphs more concisely" = quality crash.

**The rule:** Stop BEFORE quality degrades, not at context limit.
</quality_insight>

<context_target>
**Plans should complete within ~50% of context usage.**

Why 50% not 80%?
- No context anxiety possible
- Quality maintained start to finish
- Room for unexpected complexity
- If you target 80%, you've already spent 40% in degradation mode
</context_target>

<task_rule>
**Each plan: 2-3 tasks maximum. Stay under 50% context.**

| Section Complexity | Tasks/Plan | Context/Task | Total |
|-------------------|------------|--------------|-------|
| Simple (abstract, short sections) | 3 | ~10-15% | ~30-45% |
| Medium (methods, results) | 2-3 | ~15-20% | ~40-50% |
| Complex (intro, discussion) | 2 | ~20-25% | ~40-50% |

**When in doubt: Default to 2 tasks.** Better to have an extra plan than degraded quality.
</task_rule>

<word_count_context_mapping>
| Words Written | Context Impact |
|---------------|----------------|
| 100-300 words | ~10-15% (small) |
| 300-600 words | ~20-30% (medium) |
| 600+ words | ~40%+ (large - split) |

| Section Type | Context/Task |
|--------------|--------------|
| Abstract (150-250 words) | ~15% |
| Introduction (~1000 words) | ~40% (split into 2-3 plans) |
| Methods (~1500 words) | ~50% (split into 2-3 plans) |
| Results (~1000 words) | ~40% (split into 2 plans) |
| Discussion (~1500 words) | ~50% (split into 2-3 plans) |
</word_count_context_mapping>

<split_signals>

<always_split>
- **More than 3 paragraph clusters** - Even if word count seems manageable
- **Multiple distinct arguments** - Each argument = separate plan
- **Section >800 words** - Split by paragraph groups
- **Multiple citation clusters** - One plan per evidence group
- **Introduction + Methods** - Never combine different section types
</always_split>

<consider_splitting>
- Estimated >600 words total
- Complex arguments requiring evidence
- Sections requiring different writing modes
- Natural semantic boundaries (opening → body → close)
</consider_splitting>
</split_signals>

<splitting_strategies>
**By paragraph:** Introduction → 01: Hook + gap, 02: Thesis + roadmap

**By argument:** Discussion → 01: Interpretation, 02: Implications, 03: Limitations + future

**By complexity:** Methods → 01: Design + participants, 02: Procedures, 03: Analysis

**By mode:** Results → 01: Scaffold main findings (user fills), 02: Co-author supporting analyses
</splitting_strategies>

<anti_patterns>
**Bad - Comprehensive plan:**
```
Plan: "Complete Introduction"
Tasks: 6 (hook, context, gap, thesis, contributions, roadmap)
Result: Task 1-3 good, Task 4-6 rushed
```

**Good - Atomic plans:**
```
Plan 1: "Introduction Opening" (2 tasks: hook, context)
Plan 2: "Introduction Core" (2 tasks: gap, thesis)
Plan 3: "Introduction Close" (2 tasks: contributions, roadmap)
Each: 30-40% context, peak quality, atomic commits
```
</anti_patterns>

<section_recommendations>

| Section | Recommended Plans | Tasks Each |
|---------|-------------------|------------|
| Abstract | 1 (reviewer mode) | 1-2 |
| Introduction | 2-3 | 2 each |
| Methods | 2-3 | 2-3 each |
| Results | 2 | 2 each |
| Discussion | 2-3 | 2 each |
| Conclusion | 1 | 2 |

**Total for typical paper:** 10-15 plans, not 6 (one per section)

</section_recommendations>

<depth_calibration>
**Depth controls plan COUNT, not plan SIZE.**

| Depth | Typical Sections | Typical Plans/Section | Tasks/Plan |
|-------|------------------|----------------------|------------|
| Quick | 4-5 | 1-2 | 2-3 |
| Standard | 5-6 | 2-3 | 2-3 |
| Comprehensive | 6-8 | 3-4 | 2-3 |

Tasks/plan is CONSTANT at 2-3. The 50% context rule applies universally.

**Key principle:** Derive from actual content. Depth determines how aggressively you combine things, not a target to hit.

- Comprehensive introduction = 4 plans (because intro genuinely has 4 components)
- Comprehensive abstract = 1 plan (because that's all it is)

Don't pad simple sections to hit a number. Don't compress complex sections to look efficient.
</depth_calibration>

<summary>
**2-3 tasks, 50% context target:**
- All writing: Peak quality
- Git: Atomic per-task commits
- Subagent plans: Fresh context

**The principle:** Aggressive atomicity. More plans, smaller scope, consistent quality.

**The rule:** If in doubt, split. Quality over consolidation. Always.

**Depth rule:** Depth increases plan COUNT, never plan SIZE.
</summary>
</length_estimation>
