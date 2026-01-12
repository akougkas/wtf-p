# Discovery Template

Template for `.planning/sections/XX-name/DISCOVERY.md` - shallow research for writing decisions.

**Purpose:** Answer "which approach should we use" questions during mandatory discovery in plan-section.

For deep literature research ("what does the field say about this"), use `/wtfp:research-section` which produces RESEARCH.md.

---

## File Template

```markdown
---
section: XX-name
type: discovery
topic: [discovery-topic]
---

<session_initialization>
Before beginning discovery, verify today's date:
!`date +%Y-%m-%d`

Use this date when searching for "current" or "latest" information.
Example: If today is 2025-11-22, search for "2025" not "2024".
</session_initialization>

<discovery_objective>
Discover [topic] to inform [section name] writing.

Purpose: [What decision/approach this enables]
Scope: [Boundaries]
Output: DISCOVERY.md with recommendation
</discovery_objective>

<discovery_scope>
<include>
- [Question to answer]
- [Approach to investigate]
- [Specific comparison if needed]
</include>

<exclude>
- [Out of scope for this discovery]
- [Defer to writing phase]
</exclude>
</discovery_scope>

<discovery_protocol>

**Source Priority:**
1. **Domain literature** - Peer-reviewed papers in the field
2. **Authoritative sources** - Foundational texts, handbooks
3. **WebSearch** - For recent developments, trends (verify all findings)

**Quality Checklist:**
Before completing discovery, verify:
- [ ] All claims have authoritative sources (peer-reviewed or established)
- [ ] Negative claims ("X is not possible") verified with citations
- [ ] Methodological claims from primary sources (not secondary summaries)
- [ ] WebSearch findings cross-checked with academic sources
- [ ] Recent publications checked for field developments
- [ ] Alternative approaches considered (not just first solution found)

**Confidence Levels:**
- HIGH: Peer-reviewed sources confirm
- MEDIUM: Authoritative secondary sources confirm
- LOW: WebSearch only or training knowledge only (mark for validation)

</discovery_protocol>


<output_structure>
Create `.planning/sections/XX-name/DISCOVERY.md`:

```markdown
# [Topic] Discovery

## Summary
[2-3 paragraph executive summary - what was researched, what was found, what's recommended]

## Primary Recommendation
[What approach to take and why - be specific and actionable]

## Alternatives Considered
[What else was evaluated and why not chosen]

## Key Findings

### [Category 1]
- [Finding with citation and relevance to our case]

### [Category 2]
- [Finding with citation and relevance]

## Relevant Citations
[Citations to add to literature.md]

## Metadata

<metadata>
<confidence level="high|medium|low">
[Why this confidence level - based on source quality and verification]
</confidence>

<sources>
- [Primary authoritative sources used]
</sources>

<open_questions>
[What couldn't be determined or needs validation during writing]
</open_questions>

<validation_checkpoints>
[If confidence is LOW or MEDIUM, list specific things to verify during writing]
</validation_checkpoints>
</metadata>
```
</output_structure>

<success_criteria>
- All scope questions answered with authoritative sources
- Quality checklist items completed
- Clear primary recommendation
- Low-confidence findings marked with validation checkpoints
- Ready to inform PLAN.md creation
</success_criteria>

<guidelines>
**When to use discovery:**
- Methodological choice unclear (approach A vs B)
- Need to understand field conventions
- Framing decision required
- Single question pending

**When NOT to use:**
- Established methods (standard statistical approaches)
- Writing details (defer to execution)
- Questions answerable from existing sources

**When to use RESEARCH.md instead:**
- Need comprehensive literature review
- Complex theoretical background
- "What does the field say about X" questions
- Use `/wtfp:research-section` for these
</guidelines>
