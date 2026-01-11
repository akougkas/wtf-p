<purpose>
Comprehensive literature research for a section or topic before planning/writing.

Triggered by /wtfp:research-gap command when the section requires external sources,
literature positioning, or understanding of prior work.

Produces RESEARCH.md with sources, findings, and positioning that informs quality writing.
</purpose>

<when_to_use>
**This workflow is for sections/topics requiring literature grounding:**
- Related Work / Background sections
- Introduction (establishing gap, positioning)
- Discussion (interpreting findings in context)
- Any claim requiring external evidence
- Theoretical framework development
- Methodological justification

**Skip this for:**
- Describing your own methods
- Presenting your own results
- Abstract (synthesize from other sections)
- Procedural descriptions
</when_to_use>

<key_insight>
The question isn't "which papers should I cite?"

The question is: "What does the reader need to know about prior work to understand why my research matters?"

For academic writing, research answers:
- What's the current state of knowledge?
- Where are the gaps my work addresses?
- How do I position my contribution?
- What competing views exist?
- What methodology precedents support my approach?
</key_insight>

<process>

<step name="validate_topic" priority="first">
Topic: $ARGUMENTS (required)

**If argument is a section number:**
Validate section exists in roadmap and extract its focus.

```bash
if [ -f .planning/ROADMAP.md ]; then
  grep -A5 "Section ${SECTION}:" .planning/ROADMAP.md
fi
```

**If argument is a topic string:**
Accept directly and proceed to check_existing.

**If no argument:**
```
Error: Topic or section number required.

Usage: /wtfp:research-gap [section-number or topic]
Examples:
  /wtfp:research-gap 3
  /wtfp:research-gap "autonomous vehicle ethics"
```

Exit workflow.
</step>

<step name="check_existing">
Check if RESEARCH.md already exists:

```bash
ls .planning/sections/${SECTION}-*/RESEARCH.md 2>/dev/null
ls .planning/sections/${SECTION}-*/${SECTION}-RESEARCH.md 2>/dev/null
```

**If exists:**
```
Research already exists: [path to RESEARCH.md]

What's next?
1. Update research - Refresh with new findings
2. View existing - Show me the current research
3. Skip - Use existing research as-is
```

Wait for user response.

**If doesn't exist:**
Continue to load_context.
</step>

<step name="load_context">
Load available context to inform research direction:

**1. Project context:**
```bash
cat .planning/PROJECT.md 2>/dev/null | head -50
```

**2. Argument map (what claims need support):**
```bash
cat .planning/structure/argument-map.md 2>/dev/null
```

**3. Existing literature index:**
```bash
cat .planning/sources/literature.md 2>/dev/null
```

**4. Section context (if exists from /wtfp:discuss-section):**
```bash
cat .planning/sections/${SECTION}-*/${SECTION}-CONTEXT.md 2>/dev/null
```

If CONTEXT.md exists, use it to understand:
- User's specific goals for this section
- What claims need supporting
- Any specific sources they want included

Present what was found:
```
Research context for: ${TOPIC}

Project thesis: ${THESIS}

[If argument-map exists:]
Claims needing support: [list relevant claims]

[If existing literature:]
Already indexed: [N] sources

[If CONTEXT.md exists:]
Section context available - will incorporate user direction.

Proceeding with literature research...
```
</step>

<step name="identify_research_needs">
Analyze what needs researching for this topic/section.

**Ask: "What knowledge does the reader need from prior work?"**

Categories to consider:

**1. Foundational Work:**
- Seminal papers establishing the field
- Key theoretical frameworks
- Widely-cited methodology papers

**2. Recent Advances:**
- Work from last 3-5 years
- Current state of the art
- Emerging trends

**3. Competing Approaches:**
- Alternative methods to yours
- Contrasting theoretical positions
- Why your approach differs

**4. Gap Evidence:**
- What hasn't been studied
- Limitations of existing work
- Your unique contribution positioning

**5. Methodological Precedent:**
- Similar methods in your field
- Validation of your approach
- Statistical/analytical justification

Present research scope:
```
Research scope identified:

1. Foundational: [e.g., "Core AI safety papers, alignment frameworks"]
2. Recent: [e.g., "2022-2024 work on RLHF and constitutional AI"]
3. Competing: [e.g., "Capability-focused vs safety-focused approaches"]
4. Gap: [e.g., "Limited work on long-term value alignment"]
5. Methods: [e.g., "Interpretability evaluation frameworks"]

Proceeding with systematic research...
```
</step>

<step name="execute_research">
Execute research systematically.

**CRITICAL: Source hierarchy**

1. **User's own sources first:**
   - Check .planning/sources/literature.md
   - Check .planning/sources/prior-drafts.md for cited works
   - User may have PDFs or notes to reference

2. **Database search (conceptual):**
   - Google Scholar for academic sources
   - Field-specific databases (PubMed, IEEE, ACL, etc.)
   - Preprint servers (arXiv, SSRN, bioRxiv)

3. **WebSearch for recent/emerging work:**
   ```
   "[topic] research [current_year]"
   "[topic] systematic review"
   "[topic] meta-analysis"
   "[author name] [topic]" for known experts
   ```

<research_protocol>

**For each research category:**

**1. Identify key sources:**
- 3-5 foundational/seminal works
- 5-10 recent works (last 5 years prioritized)
- 2-3 competing perspectives
- As many as needed for gap documentation

**2. Extract for each source:**
- Full citation (authors, year, title, venue)
- Key findings/claims relevant to your work
- How it relates to your research
- Where it might be cited in your document

**3. Synthesize themes:**
- Group sources by argument they support
- Identify consensus vs controversy
- Note methodological trends
- Document the gap your work addresses

**4. Cross-verification:**
- Confirm sources are legitimate academic work
- Check citation counts for influence
- Verify recency and relevance
- Mark confidence level

</research_protocol>

Track findings as you go:

**Foundational Sources:**
- [Citation 1]: [key claim, relevance, where to cite]
- [Citation 2]: [key claim, relevance, where to cite]

**Recent Advances:**
- [Citation 3]: [key claim, relevance, where to cite]

**Competing Views:**
- [Citation 4]: [their position, how we differ]

**Gap Evidence:**
- [What hasn't been done, citing sources that show the gap]

**Methodological Support:**
- [Citation 5]: [precedent for our method]
</step>

<step name="quality_check">
Before creating RESEARCH.md, verify research quality:

**Coverage checklist:**
- [ ] Foundational work represented (seminal papers)
- [ ] Recent work included (last 3-5 years)
- [ ] Competing perspectives acknowledged
- [ ] Gap clearly documented
- [ ] Methodological precedent if needed
- [ ] Sources properly attributed

**Balance checklist:**
- [ ] Not over-relying on single authors/groups
- [ ] Multiple perspectives represented fairly
- [ ] Both supporting and challenging views included
- [ ] Self-citation kept proportional

**Quality checklist:**
- [ ] Sources are peer-reviewed or reputable
- [ ] Citations are complete and accurate
- [ ] Recent sources are actually recent
- [ ] Claims attributed correctly
</step>

<step name="write_research">
Create RESEARCH.md using accumulated findings.

**File location:** `.planning/sections/${SECTION}-${SLUG}/${SECTION}-RESEARCH.md`

**If section directory doesn't exist:**
Create it: `.planning/sections/${SECTION}-${SLUG}/`

**Structure:**

```markdown
# Literature Research: [Topic/Section]

## Research Summary

**Focus:** [What was researched]
**Scope:** [Foundational, recent, competing, gap, methods]
**Sources identified:** [N] relevant sources

## Key Findings

### Foundational Work

[Author (Year)] - [Title]
- **Key claim:** [What they established]
- **Relevance:** [How it relates to our work]
- **Cite in:** [Which section(s)]

[Continue for each foundational source]

### Recent Advances (2020-present)

[Continue same format]

### Competing Perspectives

[Author (Year)] argues [position]
- **How we differ:** [Our contrasting position]
- **Acknowledgment:** [How to fairly represent their view]

### The Gap

Based on literature review:
- [Gap 1]: [What hasn't been addressed]
- [Gap 2]: [Limitation in current approaches]
- [Gap 3]: [Our unique contribution]

Supporting evidence for gap:
- [Author (Year)] notes "[quote about limitation]"
- [Author (Year)] calls for "[quote about future work]"

### Methodological Precedent

[If applicable - sources supporting your methods]

## Synthesis for Writing

### For Introduction
Use these sources to establish:
- Context: [sources]
- Gap: [sources]
- Significance: [sources]

### For Related Work
Organize by theme:
- Theme 1: [sources]
- Theme 2: [sources]
- Positioning: [sources]

### For Discussion
Compare findings to:
- [sources for interpretation]
- [sources for implications]

## Full Bibliography

[Complete citations in target format]

## Confidence Assessment

**Overall confidence:** [HIGH/MEDIUM/LOW]
**Coverage:** [Comprehensive/Adequate/Partial]
**Recency:** [Current/Mostly current/Dated areas]
**Gaps in research:** [Any areas needing more sources]
```

Write file.
</step>

<step name="update_literature_index">
If .planning/sources/literature.md exists, update it with new sources:

```bash
cat .planning/sources/literature.md 2>/dev/null
```

Add new sources to the index:
- Core References (cite in paper)
- Background Reading (inform writing)
- To Find (if any gaps identified)
</step>

<step name="confirm_creation">
Present RESEARCH.md summary to user:

```
Created: .planning/sections/${SECTION}-${SLUG}/${SECTION}-RESEARCH.md

## Research Summary

**Topic:** [what was researched]

**Key Sources:**
- Foundational: [N] sources
- Recent: [N] sources
- Competing: [N] perspectives
- Gap documented with [N] supporting citations

**Synthesis ready for:**
- Introduction (gap establishment)
- Related Work (thematic organization)
- Discussion (interpretation context)

**Confidence:** [HIGH/MEDIUM/LOW]

What's next?
1. Plan this section (/wtfp:plan-section ${SECTION}) - RESEARCH.md will be loaded automatically
2. Dig deeper - Research specific areas more thoroughly
3. Review full RESEARCH.md
4. Done for now
```
</step>

<step name="git_commit">
Commit section research:

```bash
git add .planning/sections/${SECTION}-${SLUG}/${SECTION}-RESEARCH.md
git add .planning/sources/literature.md 2>/dev/null
git commit -m "$(cat <<'EOF'
docs(${SECTION}): complete literature research

Section ${SECTION}: ${SECTION_NAME}
- [N] key sources identified
- Gap documented
- Synthesis prepared for writing
EOF
)"
```

Confirm: "Committed: docs(${SECTION}): complete literature research"
</step>

</process>

<success_criteria>
- [ ] Topic/section validated
- [ ] Research scope identified (foundational, recent, competing, gap, methods)
- [ ] Sources systematically gathered
- [ ] User's existing sources checked first
- [ ] Quality checklist completed
- [ ] RESEARCH.md created with:
  - [ ] Key sources with relevance noted
  - [ ] Gap clearly documented
  - [ ] Synthesis organized by section need
  - [ ] Full bibliography
  - [ ] Confidence assessment
- [ ] Literature index updated if exists
- [ ] RESEARCH.md committed to git
- [ ] User knows next steps (plan section)
</success_criteria>

<integration_with_planning>
When /wtfp:plan-section runs after research:

1. plan-section detects RESEARCH.md exists in section directory
2. RESEARCH.md loaded as @context reference
3. "Key sources" inform citation placement in tasks
4. "Gap" informs introduction framing
5. "Synthesis" informs section structure
6. "Competing perspectives" ensure fair representation

This produces higher quality plans because Claude knows:
- What sources to cite where
- How to position the argument
- What prior work to acknowledge
- How to frame the contribution
</integration_with_planning>
