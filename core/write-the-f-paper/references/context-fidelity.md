# Context Fidelity

CONTEXT.md is the user decision authority. It captures the user's vision for a section from `/wtfp:discuss-section` and flows through the entire pipeline — planning, writing, and verification.

## CONTEXT.md Structure

Created by `/wtfp:discuss-section`, stored at `.planning/sections/XX-name/XX-CONTEXT.md`:

```markdown
## Vision
[What the user wants readers to take away]

## Essential
[Core content that must be present]

## Boundaries
[What's explicitly out of scope]

## Concerns
[What they're worried about]

## Decisions
[Explicit choices the user made during discussion]

## Deferred Ideas
[Good ideas the user chose to defer]

## Claude's Discretion
[Areas where Claude can use judgment]
```

## Three Decision Categories

### Locked Decisions (from `## Decisions`)

User made an explicit choice. MUST be implemented exactly.

Examples:
- "Use chronological structure, not thematic"
- "Lead with the quantitative results, qualitative second"
- "Frame as contribution to X, not Y"

**Rule**: Every locked decision must map to a task in PLAN.md and appear in written prose.

### Deferred Ideas (from `## Deferred Ideas`)

User acknowledged the idea but chose not to include it now. MUST NOT appear.

Examples:
- "Extended comparison with method Z — save for revision"
- "Additional case study — if reviewers ask"

**Rule**: No task, paragraph, or sentence should implement a deferred idea. If a deferred idea is relevant, note it in SUMMARY.md for future consideration.

### Discretion Areas (from `## Claude's Discretion`)

User gave Claude freedom to decide. Use judgment.

Examples:
- "Order of subsections within methods"
- "How much background to provide on technique X"
- "Citation density in the introduction"

**Rule**: Make reasonable choices. Document the choice in SUMMARY.md.

## Loading Pattern

All orchestrators load CONTEXT.md early and pass it to every agent:

```bash
SECTION_DIR=$(ls -d .planning/sections/${SECTION}-* 2>/dev/null | head -1)
CONTEXT_CONTENT=$(cat "${SECTION_DIR}"/*-CONTEXT.md 2>/dev/null)
```

Injected into agent prompts as `<user_decisions>` tags:

```
<user_decisions>
[CONTEXT_CONTENT inlined here]
</user_decisions>
```

**Critical timing**: Store CONTEXT_CONTENT before spawning any agent. Pass to ALL downstream agents in the pipeline.

## Agent Responsibilities

### section-planner

Before creating any task:
1. Parse locked decisions → create tasks implementing each one
2. Parse deferred ideas → verify no task touches them
3. Parse discretion areas → handle reasonably

Self-check before returning:
- [ ] Every locked decision has a task implementing it
- [ ] No task implements a deferred idea
- [ ] Discretion areas handled reasonably

### plan-checker (Dimension 5: CONTEXT.md Fidelity)

Verification:
- Parse CONTEXT.md decisions
- For each locked decision, verify a task implements it
- Scan all tasks for deferred idea references
- Check discretion areas are handled

### section-writer

During execution:
- Implement locked decisions in actual prose
- Skip deferred content even if it would improve the section
- Exercise judgment on discretion areas
- Track which decisions were implemented for SUMMARY.md

### argument-verifier

Post-write check:
- Were locked decisions implemented in actual prose?
- Did deferred content accidentally creep in?
- Were discretion choices reasonable?

## When CONTEXT.md is Missing

Not all sections have CONTEXT.md. If missing:

- `/wtfp:discuss-section` was skipped (user chose to plan directly)
- Agents operate without user decision constraints
- Orchestrator may suggest running discuss-section first but does not require it

## Propagation Map

```
/wtfp:discuss-section
  → Creates CONTEXT.md

/wtfp:plan-section (orchestrator)
  → Loads CONTEXT.md as CONTEXT_CONTENT
  → Passes to section-planner as <user_decisions>
  → Passes to plan-checker for fidelity check (Dimension 5)

/wtfp:write-section (orchestrator)
  → Loads CONTEXT.md as CONTEXT_CONTENT
  → Passes to section-writer as <user_decisions>
  → Passes to argument-verifier for fidelity check

/wtfp:review-section (orchestrator)
  → Loads CONTEXT.md as CONTEXT_CONTENT
  → Passes to section-reviewer for review against user intent

/wtfp:polish-prose (orchestrator)
  → Loads CONTEXT.md as CONTEXT_CONTENT
  → Passes to prose-polisher to preserve user decisions during polish
```
