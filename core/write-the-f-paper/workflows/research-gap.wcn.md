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

[step:validate_topic p=1]
RUN: if [ -f .planning/ROADMAP.md ]; then
IF argument_is_a_section_number → Validate section exists in roadmap and extract ...
IF argument_is_a_topic_string → Accept directly and proceed to check_existing.
IF no_argument → ```
[/step]

[step:check_existing]
RUN: ls .planning/sections/${SECTION}-*/RESEARCH.md 2>/dev/null
IF exists → ```
IF doesnt_exist → Continue to load_context.
[/step]

[step:load_context]
RUN: cat .planning/PROJECT.md 2>/dev/null | head -50
RUN: cat .planning/structure/argument-map.md 2>/dev/null
RUN: cat .planning/sources/literature.md 2>/dev/null
RUN: cat .planning/sections/${SECTION}-*/${SECTION}-CONTEXT.md 2>/dev/null
[/step]

[step:identify_research_needs]
[/step]

[step:execute_research]
[/step]

[step:quality_check]
[/step]

[step:write_research]
IF section_directory_doesnt_exist → Create it: `.planning/sections/${SECTION}-${SLU...
[/step]

[step:update_literature_index]
RUN: cat .planning/sources/literature.md 2>/dev/null
[/step]

[step:confirm_creation]
[/step]

[step:git_commit]
RUN: git add .planning/sections/${SECTION}-${SLUG}/${SECTION}-RESEARCH.md
[/step]

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