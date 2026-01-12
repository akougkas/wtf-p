<purpose>
Execute literature discovery at the appropriate depth level.
Produces DISCOVERY.md (for Level 2-3) that informs section planning.

Called from plan-section.md's mandatory_literature_check step with a depth parameter.

NOTE: For comprehensive literature research ("how do I position my work"), use
/wtfp:research-gap instead, which produces RESEARCH.md.
</purpose>

<depth_levels>
**This workflow supports three depth levels:**

| Level | Name | Time | Output | When |
| ----- | ---- | ---- | ------ | ---- |
| 1 | Quick Verify | 2-5 min | No file, proceed with verified source | Confirming a specific citation |
| 2 | Standard | 15-30 min | DISCOVERY.md | Need multiple sources, typical lit review |
| 3 | Deep Dive | 1+ hour | Detailed DISCOVERY.md | Comprehensive background, theoretical framework |

**Depth is determined by plan-section.md before routing here.**
</depth_levels>

<source_hierarchy>
**MANDATORY: User's sources BEFORE external search**

1. **User's existing materials** - literature.md, prior-drafts.md, PDFs they have
2. **Database search** - Google Scholar, field-specific databases
3. **WebSearch LAST** - For recent/emerging work only

Prefer sources the user already has access to and has likely read.
</source_hierarchy>

<process>

[step:determine_depth]
[/step]

[step:level_1_quick_verify]
RUN: cat .planning/sources/literature.md 2>/dev/null | grep -i "[search term]"
IF verified → Return to plan-section.md with confirmation. No...
IF concerns_found → Escalate to Level 2.
[/step]

[step:level_2_standard]
RUN: cat .planning/sources/literature.md 2>/dev/null
[/step]

[step:level_3_deep_dive]
[/step]

[step:identify_gaps]
[/step]

[step:create_discovery_scope]
[/step]

[step:execute_discovery]
[/step]

[step:create_discovery_output]
[/step]

[step:confidence_gate]
[/step]

[step:offer_next]
[/step]

</process>

<success_criteria>
**Level 1 (Quick Verify):**
- Existing sources checked
- Citation verified or concerns escalated
- Verbal confirmation to proceed (no files)

**Level 2 (Standard):**
- Existing sources checked first
- Additional sources found if needed
- DISCOVERY.md created with sources
- Confidence level MEDIUM or higher
- Ready to inform PLAN.md creation

**Level 3 (Deep Dive):**
- Discovery scope defined
- Exhaustive source search completed
- DISCOVERY.md created with comprehensive analysis
- Thematic organization provided
- Gap analysis included
- Confidence gate passed
- Ready to inform PLAN.md creation
</success_criteria>