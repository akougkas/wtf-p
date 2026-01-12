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

<step name="determine_depth">
Check the depth parameter passed from plan-section.md:
- `depth=verify` → Level 1 (Quick Verification)
- `depth=standard` → Level 2 (Standard Discovery)
- `depth=deep` → Level 3 (Deep Dive)

Route to appropriate level workflow below.
</step>

<step name="level_1_quick_verify">
**Level 1: Quick Verification (2-5 minutes)**

For: Confirming a specific source, verifying a citation is correct.

**Process:**

1. Check user's existing sources:
   ```bash
   cat .planning/sources/literature.md 2>/dev/null | grep -i "[search term]"
   ```

2. If found, verify:
   - Citation is complete and correct
   - Source is relevant to the claim
   - No conflicting information

3. **If verified:** Return to plan-section.md with confirmation. No DISCOVERY.md needed.

4. **If concerns found:** Escalate to Level 2.

**Output:** Verbal confirmation to proceed, or escalation to Level 2.
</step>

<step name="level_2_standard">
**Level 2: Standard Discovery (15-30 minutes)**

For: Finding sources for a claim, standard literature grounding.

**Process:**

1. **Identify what to find:**
   - What claim needs support?
   - What type of source is appropriate?
   - How many sources are needed?

2. **Check existing sources first:**
   ```bash
   cat .planning/sources/literature.md 2>/dev/null
   cat .planning/sources/prior-drafts.md 2>/dev/null
   ```

3. **Search for additional sources:**
   - Academic databases for the topic
   - Recent work (last 3-5 years preferred)
   - Seminal papers if establishing foundation

4. **For each source found:**
   - Full citation
   - Key finding relevant to your claim
   - Where it should be cited

5. **Create DISCOVERY.md:**
   - Summary with sources identified
   - Key findings per source
   - Citation placement recommendations
   - Confidence level (should be MEDIUM-HIGH for Level 2)

6. Return to plan-section.md.

**Output:** `.planning/sections/XX-name/DISCOVERY.md`
</step>

<step name="level_3_deep_dive">
**Level 3: Deep Dive (1+ hour)**

For: Comprehensive literature review, theoretical framework, establishing field context.

**Process:**

1. **Scope the discovery:**
   - Define what the section needs to establish
   - List specific questions to answer
   - Identify key themes to cover

2. **Exhaustive source search:**
   - All relevant foundational work
   - Comprehensive recent coverage
   - Multiple perspectives/schools of thought
   - Methodological precedents

3. **For each source:**
   - Full citation
   - Key contributions
   - Relationship to your work
   - Where it fits in your argument

4. **Synthesize themes:**
   - Group sources by argument they support
   - Identify consensus and controversy
   - Document the gap your work addresses

5. **Create comprehensive DISCOVERY.md:**
   - Full structure with all sources
   - Thematic organization
   - Gap analysis
   - Citation placement map
   - Confidence by finding

6. **Confidence gate:** If LOW confidence on any critical finding, present options.

7. Return to plan-section.md.

**Output:** `.planning/sections/XX-name/DISCOVERY.md` (comprehensive)
</step>

<step name="identify_gaps">
**For Level 2-3:** Define what literature is needed.

Ask: What does the reader need to know from prior work?

- What foundational concepts need establishing?
- What prior approaches exist?
- What's the current state of knowledge?
- Where are the gaps?
</step>

<step name="create_discovery_scope">
Define discovery scope:

- Clear objective (what claims need support)
- Include/exclude boundaries (what's relevant)
- Source preferences (recency, type, field)
- Output structure for DISCOVERY.md
</step>

<step name="execute_discovery">
Run the discovery:
- Check user's existing sources first
- Search academic databases
- Prefer peer-reviewed sources
- Structure findings for easy citation
</step>

<step name="create_discovery_output">
Write `.planning/sections/XX-name/DISCOVERY.md`:

```markdown
# Literature Discovery: [Topic]

## Summary
**Objective:** [What we needed to find]
**Sources found:** [N] relevant sources
**Recommendation:** [Summary of what to cite where]

## Sources by Theme

### [Theme 1]
| Source | Key Finding | Cite In |
|--------|-------------|---------|
| Smith (2023) | [finding] | Introduction |
| Jones (2022) | [finding] | Discussion |

### [Theme 2]
[Continue...]

## Gap Documentation
Based on this literature:
- [Gap 1]: [What hasn't been addressed]
- [Gap 2]: [Limitation in current approaches]

## Citation Map
| Section | Sources to Cite |
|---------|-----------------|
| Introduction | Smith 2023, Jones 2022 |
| Methods | Brown 2021 |
| Discussion | All above + Lee 2024 |

## Confidence
**Level:** [HIGH/MEDIUM/LOW]
**Reason:** [Brief explanation]

## Open Questions
- [Any remaining uncertainties]
```
</step>

<step name="confidence_gate">
After creating DISCOVERY.md, check confidence level.

If confidence is LOW:
Use AskUserQuestion:

- header: "Low Confidence"
- question: "Literature discovery confidence is LOW: [reason]. How to proceed?"
- options:
  - "Dig deeper" - Do more research
  - "Proceed anyway" - Accept uncertainty
  - "Pause" - I need to think about this

If confidence is MEDIUM:
Inline: "Discovery complete (medium confidence). [brief reason]. Proceed to planning?"

If confidence is HIGH:
Proceed directly, just note: "Discovery complete (high confidence)."
</step>

<step name="offer_next">
```
Discovery complete: .planning/sections/XX-name/DISCOVERY.md
Sources found: [N]
Confidence: [level]

What's next?

1. Discuss section context (/wtfp:discuss-section [section])
2. Create section plan (/wtfp:plan-section [section])
3. Refine discovery (dig deeper)
4. Review discovery
```

NOTE: DISCOVERY.md is NOT committed separately. It will be committed with section completion.
</step>

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
