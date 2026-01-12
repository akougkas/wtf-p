<decimal_section_numbering>
Decimal sections enable urgent content insertion without renumbering:

- Integer sections (1, 2, 3) = planned document structure
- Decimal sections (2.1, 2.2) = urgent insertions between integers

**Rules:**
- Decimals between consecutive integers (2.1 between 2 and 3)
- Filesystem sorting works automatically (2 < 2.1 < 2.2 < 3)
- Directory format: `02.1-description/`, Plan format: `02.1-01-PLAN.md`

**Validation:** Integer X must exist and be complete, X+1 must exist, decimal X.Y must not exist, Y >= 1
</decimal_section_numbering>

<required_reading>
**Read these files NOW:**

1. ~/.claude/write-the-f-paper/templates/section-prompt.md
2. ~/.claude/write-the-f-paper/references/plan-format.md
3. ~/.claude/write-the-f-paper/references/verification-layers.md
4. .planning/ROADMAP.md
5. .planning/PROJECT.md

**Load structure files:**
- .planning/structure/argument-map.md
- .planning/structure/outline.md
- .planning/structure/narrative-arc.md
</required_reading>

<purpose>
Create an executable section prompt (PLAN.md). PLAN.md IS the prompt that Claude executes - not a document that gets transformed.
</purpose>

<planning_principles>
**Argument-first:** Every paragraph must serve the core argument. Plan prose that advances the thesis, not filler.

**Evidence-grounded:** Plan where citations go before writing. Claims need sources identified.

**Reader-aware:** Plan for the target audience. Technical depth, assumed knowledge, explanation level.
</planning_principles>

<process>

<step name="load_project_state" priority="first">
Read `.planning/STATE.md` and parse:
- Current position (which section we're planning)
- Accumulated decisions (constraints on this section)
- Open questions (things this section may need to address)
- Argument strength (how solid is the overall thesis)

If STATE.md missing but .planning/ exists, offer to reconstruct or continue without.
</step>

<step name="load_structure_context">
Check for structure documents:

```bash
ls .planning/structure/*.md 2>/dev/null
```

**If .planning/structure/ exists:** Load relevant documents:

| Section Type | Load These |
|--------------|------------|
| Introduction | argument-map.md, narrative-arc.md |
| Methods | argument-map.md (what claims need methodological support) |
| Results | argument-map.md (which claims get supported here) |
| Discussion | argument-map.md, narrative-arc.md |
| Related Work | argument-map.md (positioning), literature.md |
| Abstract | All (summary of everything) |

Track extracted context for PLAN.md context section.
</step>

<step name="identify_section">
Check roadmap and existing sections:

```bash
cat .planning/ROADMAP.md
ls .planning/sections/
```

If multiple sections available, ask which one to plan. If obvious (first incomplete section), proceed.

**Section number parsing:** Regex `^(\d+)(?:\.(\d+))?$` - Group 1: integer, Group 2: decimal (optional)

**If decimal section:** Validate integer X exists and is complete, X+1 exists in roadmap, decimal X.Y doesn't exist, Y >= 1.

Read any existing PLAN.md or RESEARCH.md in the section directory.
</step>

<step name="mandatory_literature_check">
**Literature check is MANDATORY for sections flagged with Research: Likely.**

<literature_decision>
**Level 0 - Skip** (internal content only)
- Section is about own methods/results
- No claims requiring external evidence
- Examples: Describing own data collection, presenting own findings

**Level 1 - Quick Verification** (2-5 min)
- Single source to verify
- Confirming a specific citation
- Action: Quick check, no RESEARCH.md needed

**Level 2 - Standard Research** (15-30 min)
- Need to cite multiple sources
- Positioning against prior work
- Action: Route to workflows/research-gap.md, produces RESEARCH.md

**Level 3 - Deep Literature Review** (1+ hour)
- Core literature review section
- Establishing theoretical framework
- Comprehensive gap analysis
- Action: Route to workflows/research-gap.md depth=deep, full RESEARCH.md
</literature_decision>

If roadmap flagged `Research: Likely`, Level 0 (skip) is not available.
</step>

<step name="read_prior_sections">
**Intelligent context assembly from completed sections:**

**1. Scan all summary frontmatter:**

```bash
for f in .planning/sections/*/*-SUMMARY.md; do
  sed -n '1,/^---$/p; /^---$/q' "$f" | head -30
done
```

Parse to extract: section, subsection, key-claims, evidence-used, decisions

**2. Build dependency context for current section:**

- **Check logical flow:** What claims from prior sections does this section build on?
- **Check evidence used:** What sources were already cited?
- **Check decisions:** What stylistic or structural decisions constrain this section?

**3. Select relevant summaries:**

Auto-select sections that match ANY of:
- Current section directly follows (immediate prior)
- Shares argumentative thread (part of same logical chain)
- Explicitly mentioned in STATE.md as affecting current section

**4. Extract context from summaries:**

From selected sections, extract:
- **Claims established:** What's been argued so far
- **Evidence cited:** Sources already used (avoid over-citation)
- **Patterns established:** Writing style, terminology decisions
- **Decisions:** Key choices from prior sections

**Answer before proceeding:**
- Q1: What claims from previous sections does this section build on?
- Q2: What sources have already been cited that might be relevant?
- Q3: What writing patterns should be maintained?
- Q4: Given all context, does the roadmap's section goal still make sense?
</step>

<step name="gather_section_context">
Understand:
- Section goal (from roadmap)
- Word budget (from roadmap)
- What exists already (prior drafts in sources/prior-drafts.md?)
- Dependencies met (previous sections complete?)
- Any {section}-RESEARCH.md (from /wtfp:research-gap)
- Any {section}-CONTEXT.md (from /wtfp:discuss-section)

```bash
# Check for literature research (from /wtfp:research-gap)
cat .planning/sections/XX-name/${SECTION}-RESEARCH.md 2>/dev/null

# Check for section context (from /wtfp:discuss-section)
cat .planning/sections/XX-name/${SECTION}-CONTEXT.md 2>/dev/null

# Check for prior drafts
cat .planning/sources/prior-drafts.md 2>/dev/null
```

**If RESEARCH.md exists:** Use sources (cite these), key_findings (incorporate), gaps (address or note), positioning (how we differ from prior work).

**If CONTEXT.md exists:** Honor vision, prioritize essential content, respect boundaries, incorporate user specifics.

**If neither exist:** Suggest /wtfp:research-gap for literature-heavy sections, /wtfp:discuss-section for simpler sections.
</step>

<step name="break_into_tasks">
Decompose section into writing tasks.

**Writing tasks need:**
- **Type**: auto, checkpoint:human-verify, checkpoint:decision
- **Task name**: Clear, action-oriented
- **Paragraphs/Subsections**: Which part of section
- **Action**: Specific writing action (draft, revise, cite, strengthen)
- **Mode**: co-author (Claude drafts), scaffold (Claude outlines), reviewer (Claude critiques)
- **Verify**: How to prove it's done well
- **Done**: Acceptance criteria

**Task types by section:**

| Section | Typical Tasks |
|---------|--------------|
| Abstract | Draft complete abstract, verify all elements present |
| Introduction | Hook paragraph, context paragraphs, gap statement, thesis, roadmap |
| Methods | Protocol description, measures, analysis approach |
| Results | Finding 1 narrative, Finding 2 narrative, supporting analyses |
| Discussion | Summary, interpretation, limitations, future work, conclusion |
| Related Work | Theme 1 synthesis, Theme 2 synthesis, positioning statement |

**Mode selection per task:**
- Procedural content (methods, data description) → co-author
- Argument-heavy content (discussion, intro) → scaffold or reviewer
- Personal voice required (abstract conclusion, thesis) → scaffold with user writing

**Checkpoints:** Visual/prose verification → checkpoint:human-verify. Voice/framing choices → checkpoint:decision.
</step>

<step name="estimate_scope">
After tasks, assess against quality needs.

**Check depth setting:**
```bash
cat .planning/config.json 2>/dev/null | grep depth
```

<depth_aware_splitting>
**Depth controls thoroughness, not artificial padding.**

| Depth | Typical Plans/Section | Tasks/Plan |
|-------|----------------------|------------|
| Quick | 1-2 | 2-3 |
| Standard | 2-4 | 2-3 |
| Comprehensive | 3-6 | 2-3 |

**Key principle:** Derive plans from actual writing needs. Depth determines how carefully you break down complex sections.

- Comprehensive Discussion = 4 plans (interpretation, limitations, future work, conclusion)
- Comprehensive Abstract = 1 plan (it's just one paragraph)

For comprehensive depth:
- Create MORE plans for complex sections, not longer ones
- Each plan stays focused: 2-3 tasks, single concern

For quick depth:
- Combine aggressively into fewer plans
- Focus on critical argument path
</depth_aware_splitting>

**ALWAYS split if:** >3 tasks, multiple argumentative threads, complex literature integration.

**Each plan must be:** 2-3 tasks max, focused on one aspect, independently verifiable.
</step>

<step name="confirm_breakdown">
<if mode="yolo">
Auto-approve and proceed to write_section_prompt.
</if>

<if mode="interactive">
Present breakdown inline:

```
Section [X] breakdown:

### Tasks ({section}-01-PLAN.md)
1. [Task] - [brief] [type] [mode]
2. [Task] - [brief] [type] [mode]

Does this look right? (yes / adjust / start over)
```

For multiple plans, show each plan with its tasks.

Wait for confirmation. If "adjust": revise. If "start over": return to gather_section_context.
</if>
</step>

<step name="write_section_prompt">
Use template from `~/.claude/write-the-f-paper/templates/section-prompt.md`.

**Single plan:** Write to `.planning/sections/XX-name/{section}-01-PLAN.md`

**Multiple plans:** Write separate files ({section}-01-PLAN.md, {section}-02-PLAN.md, etc.)

Each plan follows template structure with:
- Frontmatter (section, plan, type, mode)
- Objective (plan-specific goal, word target, output)
- Execution context (write-section.md, summary template, verification-layers.md)
- Context (@references to PROJECT, ROADMAP, STATE, structure docs, RESEARCH/CONTEXT if exist, prior summaries, sources)
- Tasks (XML format with types and modes)
- Verification (citation check, coherence check, rubric check)
- Success criteria, Output specification

**Context section population:**

```markdown
<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Structure documents:
@.planning/structure/argument-map.md
@.planning/structure/narrative-arc.md

# Auto-selected based on logical flow:
@.planning/sections/XX-name/YY-ZZ-SUMMARY.md

# Key sources (relevant to this section):
@.planning/sources/literature.md
@.planning/sources/data.md

**Argument thread:** [what this section must establish]
**Prior claims to build on:** [from frontmatter analysis]
**Sources to cite:** [identified from RESEARCH.md or literature.md]

**Decisions constraining this section:** [If any from STATE.md]
</context>
```
</step>

<step name="git_commit">
Commit section plan(s):

```bash
# Stage all PLAN.md files for this section
git add .planning/sections/${SECTION}-*/${SECTION}-*-PLAN.md

# Also stage RESEARCH.md if it was created during mandatory_literature_check
git add .planning/sections/${SECTION}-*/RESEARCH.md 2>/dev/null

git commit -m "$(cat <<'EOF'
docs(${SECTION}): create section plan

Section ${SECTION}: ${SECTION_NAME}
- [N] plan(s) created
- [X] total tasks defined
- Ready for writing
EOF
)"
```

Confirm: "Committed: docs(${SECTION}): create section plan"
</step>

<step name="offer_next">
```
Section plan created: .planning/sections/XX-name/{section}-01-PLAN.md
[X] tasks defined.

---

## Next Up

**{section}-01: [Plan Name]** - [objective summary]

`/wtfp:write-section .planning/sections/XX-name/{section}-01-PLAN.md`

<sub>`/clear` first - fresh context window</sub>

---

**Also available:**
- Review/adjust tasks before writing
[If multiple plans: - View all plans: `ls .planning/sections/XX-name/*-PLAN.md`]

---
```
</step>

</process>

<task_quality>
**Good tasks:** Specific paragraphs, clear actions, verifiable output
- "Draft hook paragraph establishing the research gap in autonomous systems"
- "Write methods subsection on data collection protocol, ~150 words"
- "Synthesize Smith2023 and Jones2024 findings on intervention efficacy"

**Bad tasks:** Vague, not actionable
- "Write introduction" / "Add citations" / "Make it better"

If you can't specify Paragraphs + Action + Mode + Verify + Done, the task is too vague.
</task_quality>

<anti_patterns>
- No hour estimates
- No "perfect prose" expectations (first drafts are drafts)
- No style committee approvals
- No sub-sub-sub tasks
Tasks are instructions for Claude writing, not editorial board requirements.
</anti_patterns>

<success_criteria>
Section planning complete when:
- [ ] STATE.md read, project context absorbed
- [ ] Mandatory literature check completed (Level 0-3)
- [ ] Prior sections, sources, structure synthesized
- [ ] PLAN file(s) exist with XML structure
- [ ] Each plan: Objective, context, tasks, verification, success criteria, output
- [ ] @context references included (STATE, RESEARCH if exist, relevant summaries)
- [ ] Each plan: 2-3 tasks (~focused scope)
- [ ] Each task: Type, Mode, Paragraphs (if applicable), Action, Verify, Done
- [ ] Checkpoints properly structured
- [ ] If RESEARCH.md exists: sources cited in plan, positioning clear
- [ ] PLAN file(s) committed to git
- [ ] User knows next steps
</success_criteria>
