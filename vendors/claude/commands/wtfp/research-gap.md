---
name: wtfp:research-gap
description: Comprehensive literature/domain research for a section
argument-hint: "[section]"
allowed-tools:
  - Read
  - Bash
  - Write
  - WebFetch
  - WebSearch
  - mcp__context7__*
  - AskUserQuestion
---

<objective>
Perform comprehensive literature/domain research for a specific section.

Discovers:
- Key citations needed
- Standard approaches in the literature
- Gaps in current research
- How experts write about this topic

Creates RESEARCH.md with "how experts write this" knowledge.

Use for literature reviews, methodology justification, positioning your contribution.
</objective>

<execution_context>
@~/.claude/write-the-f-paper/workflows/research-gap.md
@~/.claude/write-the-f-paper/references/research-pitfalls.md
</execution_context>

<process>

<step name="verify">
**Verify project exists:**

```bash
[ ! -f .planning/PROJECT.md ] && echo "ERROR: No project found. Run /wtfp:new-paper first" && exit 1
[ ! -f .planning/ROADMAP.md ] && echo "ERROR: No outline found. Run /wtfp:create-outline first" && exit 1
```

</step>

<step name="load">
**Load context:**

- Read PROJECT.md for core argument and field
- Read ROADMAP.md for section goal
- Read argument-map.md for claims to support
- Read sources/literature.md for existing citations
</step>

<step name="scope">
**Define research scope:**

Use AskUserQuestion:
- header: "Research Focus"
- question: "What specifically do you need to understand for [section]?"
- options:
  - "Key citations" — Who are the must-cite authors/papers?
  - "Methodology" — How do others approach this method?
  - "State of field" — What's the current consensus/debate?
  - "Positioning" — How to differentiate from existing work?
  - "All of the above" — Comprehensive research

</step>

<step name="research">
**Conduct research:**

Based on scope, investigate:

**Key Citations:**
- **Foundational:** Use `node ~/.claude/bin/citation-fetcher.js "[topic]" --intent=seminal` to find high-impact papers.
- **Recent:** Use `node ~/.claude/bin/citation-fetcher.js "[topic]" --intent=recent --year=2023-2026` to find state-of-the-art.
- **Validation:** Use `node ~/.claude/bin/citation-fetcher.js "query"` to verify specific papers.

**Standard Approaches:**
- How do others structure similar sections?
- What's the typical argument flow?
- What evidence is typically presented?

**Gaps:**
- What's missing in current literature?
- Where does your work fit?
- What questions remain unanswered?

**Expert Writing Patterns:**
- How do top papers in this area write about this?
- What terminology is standard?
- What level of detail is expected?

</step>

<step name="create_research">
**Create RESEARCH.md:**

```markdown
---
section: XX-name
scope: [research scope]
confidence: [high/medium/low]
---

# Research: [Section Name]

## Summary
[2-3 sentence overview of findings]

## Key Citations

### Foundational
| Citation | Contribution | Relevance |
|----------|--------------|-----------|
| [Author (Year)] | [What they established] | [Why cite] |

### Recent/High-Impact
| Citation | Contribution | Relevance |
|----------|--------------|-----------|

### Methodology
| Citation | Approach | Relevance |
|----------|----------|-----------|

## Standard Approaches
[How others write about this topic]

- Typical structure: [...]
- Common arguments: [...]
- Expected evidence: [...]

## Field Consensus
[What's generally agreed upon]

## Active Debates
[Where experts disagree]

## Gaps in Literature
- [Gap 1]: [your opportunity]
- [Gap 2]: [your opportunity]

## Your Positioning
[How your work relates to existing literature]

## Writing Recommendations
- Terminology to use: [...]
- Level of detail expected: [...]
- Citations to definitely include: [...]
- Arguments to make: [...]

## Sources Consulted
- [Source 1]
- [Source 2]

## Confidence Assessment
- Key citations: [high/medium/low]
- Field understanding: [high/medium/low]
- Gap identification: [high/medium/low]

## Open Questions
- [Questions that need user input]

---
*Researched: [date]*
```

</step>

<step name="update_literature">
**Update literature index:**

Add any new citations discovered to `.planning/sources/literature.md`.

</step>

<step name="commit">
```bash
git add .planning/sections/XX-name/XX-RESEARCH.md .planning/sources/literature.md
git commit -m "$(cat <<'EOF'
research(XX): [section name] literature review

Scope: [scope]
Citations found: [N]
Confidence: [level]
EOF
)"
```

</step>

<step name="done">
**Present completion:**

```
Research complete:

- Research: .planning/sections/XX-name/XX-RESEARCH.md
- Citations added: [N] new references
- Confidence: [level]

## Key Findings
[2-3 bullet summary]

## Recommended Next Steps
[Based on research]

---

## ▶ Next Up

**Plan section** — create writing plan with research context

`/wtfp:plan-section [section]`

<sub>`/clear` first → fresh context window</sub>

---
```

</step>

</process>

<success_criteria>
- [ ] Research scope defined with user
- [ ] Key citations identified
- [ ] Standard approaches documented
- [ ] Gaps identified
- [ ] Writing recommendations provided
- [ ] literature.md updated
- [ ] All committed to git
</success_criteria>
