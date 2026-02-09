---
name: wtfp:plan-milestone-gaps
description: Create fix plans for gaps found by audit-milestone
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<objective>
Read MILESTONE-AUDIT.md and create targeted fix plans for each gap.

Each gap becomes a fix plan in the appropriate section directory.
Plans follow the standard plan-format.md structure.
User can execute fix plans with existing writing commands.
</objective>

<process>

<step name="validate">
**Step 1: Validate Audit Exists**

```bash
[ ! -f .planning/MILESTONE-AUDIT.md ] && echo "ERROR: No MILESTONE-AUDIT.md found. Run /wtfp:audit-milestone first." && exit 1
```

</step>

<step name="banner">
**Step 2: Display Banner**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► PLANNING GAP FIXES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reading MILESTONE-AUDIT.md...
```

</step>

<step name="parse_audit">
**Step 3: Parse MILESTONE-AUDIT.md**

Read `.planning/MILESTONE-AUDIT.md`.

Extract all gaps (sections under "## Gaps" with "Status: gap"):
- Gap name (check name)
- Finding (what's missing)
- Affected (sections/claims/files)
- Recommendation (what to do)

If no gaps found (Overall: PASS):
```
No gaps found in audit. Paper is ready for submission.
Run /wtfp:submit-milestone {version} to archive.
```
Exit early.

</step>

<step name="classify_gaps">
**Step 4: Classify Gaps by Fix Type**

For each gap, determine fix type:

| Gap Type | Fix Type | Action |
|----------|----------|--------|
| Section incomplete | section-write | Generate writing plan for incomplete section |
| Argument not covered | targeted-write | Generate task to address specific claim in relevant section |
| Word count over | revision-trim | Generate revision task to reduce word count |
| Word count under | revision-expand | Generate revision task to expand content |
| Citation undefined | citation-fix | Generate task to add missing citation |
| Citation uncited | citation-fix | Generate task to cite or remove reference |
| Section unreviewed | review-route | Route to /wtfp:review-section |

</step>

<step name="group_gaps">
**Step 5: Group Related Gaps**

Group gaps that affect the same section:
- Multiple issues in Section 2 -> one fix plan for Section 2
- Word count + argument issues in same section -> combined plan

Create plan groupings:
```
PLAN_1: Section 02 - {word count issue, argument issue}
PLAN_2: Section 04 - {incomplete}
PLAN_3: Citations - {undefined citations across multiple sections}
```

</step>

<step name="generate_plans">
**Step 6: Generate Fix Plans**

For each grouped plan, create a fix plan file.

**Location:** `.planning/sections/XX-name/{section}-fix-{N}-PLAN.md`

**Plan structure (following plan-format.md):**

```markdown
---
section: {section-number}
plan: fix-{N}
type: revision
depends_on: []
files_modified:
  - {paper content file}
autonomous: true
---

<objective>
Fix {N} gap(s) identified in milestone audit:
- {gap 1 summary}
- {gap 2 summary}

Purpose: Address audit findings before submission.
</objective>

<context>
@.planning/MILESTONE-AUDIT.md
@.planning/sections/XX-name/{relevant summaries}
@{paper content file}
</context>

<tasks>

<task type="auto">
  <name>{fix task name}</name>
  <files>
    {file to modify}
  </files>
  <action>
{Specific fix instructions based on gap type:}

**For section incomplete:**
Complete the section draft following the outline.
- Address all planned subsections
- Meet word target: {X} words
- Include required citations

**For argument not covered:**
Add content to address claim: "{claim}"
- Insert in section: {section}
- Location: {suggested location}
- Approximate addition: {X} words

**For word count over:**
Reduce word count in {section} by {N} words.
- Current: {X} words
- Target: {Y} words
- Suggested cuts: {areas}

**For word count under:**
Expand content in {section} by {N} words.
- Current: {X} words
- Target: {Y} words
- Suggested expansions: {areas}

**For citation undefined:**
Add citation for: {key}
- Add to bibliography file
- Verify citation format matches style guide

**For citation uncited:**
Either cite or remove: {key}
- If relevant: add citation in appropriate section
- If not relevant: remove from bibliography
  </action>
  <verify>
{Verification for fix type:}

For section: Word count meets target, all subsections complete.
For argument: Claim is now addressed in text.
For word count: Section is within +/- 15% of target.
For citation: Citation resolves correctly.
  </verify>
  <done>
{Done criteria: Gap resolved per audit check}
  </done>
</task>

</tasks>

<verification>
- Gap addressed per MILESTONE-AUDIT.md finding
- No new issues introduced
</verification>

<success_criteria>
- [ ] {Gap 1} resolved
- [ ] {Gap 2} resolved
</success_criteria>
```

**For unreviewed sections (review-route):**

Don't generate a fix plan. Instead, note:
```
Section {X} needs review. Run: /wtfp:review-section {section}
```

</step>

<step name="summary">
**Step 7: Present Summary**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► GAP PLANS CREATED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plans created: {N}

| Plan | Section | Gaps Addressed |
|------|---------|----------------|
| {path} | {section} | {gap list} |
| {path} | {section} | {gap list} |

{If any review-route gaps:}
Sections needing review (no plan created):
- Section {X}: Run `/wtfp:review-section {section}`

───────────────────────────────────────────

## Next Up

Execute fix plans:
  `/wtfp:write-section {path-to-fix-plan}`

Or fix one at a time:
  Read the plan, then execute tasks manually

After all fixes:
  `/wtfp:audit-milestone` - Re-run audit to verify

───────────────────────────────────────────
```

</step>

</process>

<success_criteria>
- [ ] MILESTONE-AUDIT.md parsed successfully
- [ ] Gaps classified by fix type
- [ ] Related gaps grouped by section
- [ ] Fix plans created for each gap group
- [ ] Plans follow plan-format.md structure
- [ ] User knows which plans to execute next
</success_criteria>
