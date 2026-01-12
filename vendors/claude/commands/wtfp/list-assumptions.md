---
name: wtfp:list-assumptions
description: See what Claude is planning to write before it starts
argument-hint: "[section]"
allowed-tools:
  - Read
  - Bash
---

<objective>
Show Claude's intended approach for a section before planning begins.

Lets you course-correct if Claude misunderstood your vision.

No files created - conversational output only.
</objective>

<process>

<step name="verify">
**Verify project exists:**

```bash
[ ! -f .planning/PROJECT.md ] && echo "ERROR: No project found. Run /wtfp:new-paper first" && exit 1
[ ! -f .planning/ROADMAP.md ] && echo "ERROR: No outline found. Run /wtfp:create-outline first" && exit 1
```

</step>

<step name="load">
**Load all relevant context:**

- Read PROJECT.md for paper vision
- Read ROADMAP.md for section goal
- Read argument-map.md for relevant claims
- Read outline.md for structure expectations
- Read narrative-arc.md for story context
- Read any prior SUMMARY.md files
- Check for CONTEXT.md or RESEARCH.md in section directory
</step>

<step name="present">
**Present assumptions in 5 areas:**

```
# Assumptions for Section [N]: [Name]

## 1. Content Approach
Based on the section goal and argument map, I plan to:
- [Main point 1]
- [Main point 2]
- [Main point 3]

Key claims I'll develop:
- [Claim from argument-map]
- [Claim from argument-map]

## 2. Structure
I'm planning to organize this section as:
1. [Opening approach]
2. [Body structure]
3. [Closing approach]

Word allocation:
- [Part 1]: ~[X] words
- [Part 2]: ~[Y] words
- [Part 3]: ~[Z] words

## 3. Writing Mode
Based on the section type, I recommend:
- Mode: [Co-Author/Scaffold/Reviewer]
- Reason: [Why this mode fits]

## 4. Dependencies
This section relies on:
- Prior sections: [What must be established first]
- Citations needed: [Key references]
- Evidence: [Data/figures to reference]

This section sets up:
- Following sections: [What this enables]

## 5. Potential Challenges
I anticipate:
- [Challenge 1]: [How I'd address it]
- [Challenge 2]: [How I'd address it]

## Questions for You
- [Any clarifications needed]
- [Decisions that need your input]

---

**Does this match your vision?**
- If yes: Run `/wtfp:plan-section [section]`
- If concerns: Tell me what to adjust
- If major changes: Run `/wtfp:discuss-section [section]`
```

</step>

</process>

<success_criteria>
- [ ] All 5 assumption areas covered
- [ ] Based on actual project context
- [ ] Clear path to course-correct
- [ ] No files created (conversational only)
</success_criteria>
