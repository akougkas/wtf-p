# Thin Orchestrator Pattern

All refactored WTF-P commands follow this pattern. Orchestrators are lightweight routers — they validate, load context, resolve models, spawn agents, and handle returns. Heavy work lives in agents.

## Why Thin Orchestrators

- **Fresh context**: Agents start with clean context windows, no orchestrator overhead
- **Peak quality**: Full context budget goes to the actual task, not workflow machinery
- **Independent verification**: Quality agents (plan-checker, argument-verifier) validate without seeing the generation process
- **Composability**: Same agent can serve multiple orchestrators

## Command Frontmatter

```yaml
---
name: wtfp:[command-name]
description: [Brief description]
argument-hint: "[what user provides]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---
```

## execution_context

References to workflow/reference/template files the orchestrator needs:

```markdown
<execution_context>
@~/.claude/write-the-f-paper/workflows/[workflow].md
@~/.claude/write-the-f-paper/references/[reference].md
@~/.claude/write-the-f-paper/templates/[template].md
</execution_context>
```

## Objective Section

```markdown
<objective>
[Clear statement of what this command does]

**Orchestrator role:** Validate → Load context → Resolve model profile → Spawn agent → Handle returns → Present results

**Why subagents:** [Rationale — typically context preservation and independent quality checks]
</objective>
```

## Process Structure

Every orchestrator follows these phases:

### 1. Validate Environment and Resolve Model Profile

```bash
ls .planning/ 2>/dev/null
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | \
  grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | \
  grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

Include per-command model lookup table (see agent-model-matrix.md).

### 2. Load Context Files

```bash
STATE_CONTENT=$(cat .planning/STATE.md)
PROJECT_CONTENT=$(cat .planning/PROJECT.md)
CONTEXT_CONTENT=$(cat "${SECTION_DIR}"/*-CONTEXT.md 2>/dev/null)
```

CRITICAL: Store CONTEXT_CONTENT now. Pass to ALL downstream agents.

### 3. Parse Arguments / Validate Section

Command-specific validation (section exists, plan exists, dependencies met).

### 4. Spawn Primary Agent

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► [ACTION] SECTION {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Build prompt with inlined content, then spawn:

```
Task(
  prompt="First, read ~/.claude/agents/wtfp/[agent].md for your role and instructions.\n\n" + filled_prompt,
  subagent_type="general-purpose",
  model="{resolved_model}",
  description="[Action] Section {X}"
)
```

The filled prompt includes:
- `<[context_type]>` with STATE, PROJECT, ROADMAP, structure docs, prior summaries
- `<user_decisions>` with CONTEXT_CONTENT from CONTEXT.md
- `<output>` with target file paths

### 5. Handle Agent Return

Agents return structured headers that orchestrators parse:

| Return Header | Meaning | Orchestrator Action |
|--------------|---------|-------------------|
| `## [ACTION] COMPLETE` | Success | Proceed to quality agent or next step |
| `## CHECKPOINT REACHED` | Needs user input | Present to user, wait, resume |
| `## [ACTION] BLOCKED` | Cannot proceed | Present blocker, ask user |

### 6. Spawn Quality Agent (if applicable)

Commands with quality loops spawn a second agent to verify:

| Command | Quality Agent | Checks |
|---------|--------------|--------|
| plan-section | plan-checker | 7 dimensions: argument, citation, word budget, outline, CONTEXT.md fidelity, style, task completeness |
| write-section | argument-verifier | Goal-backward: does output achieve section purpose? |

### 7. Present Final Status

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► [STATUS] ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Summary]

───────────────────────────────────────────

## ▶ Next Up

**[Next action]** — [description]

`/wtfp:[next-command] [args]`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────
```

## Agent Prompt Construction

Orchestrators build agent prompts by inlining content, not referencing files:

```
prompt = "First, read ~/.claude/agents/wtfp/{agent}.md for your role.\n\n"
       + "<planning_context>\n" + STATE + PROJECT + ROADMAP + structure_docs + "\n</planning_context>\n"
       + "<user_decisions>\n" + CONTEXT_CONTENT + "\n</user_decisions>\n"
       + "<output>\n" + target_path + "\n</output>"
```

The agent file reference (`read ~/.claude/agents/...`) provides role instructions. The inlined content provides runtime context.

## Anti-Patterns

- **Fat orchestrator**: Orchestrator doing the actual work (writing, planning) instead of spawning agents
- **Missing context injection**: Forgetting to pass CONTEXT.md to agents
- **File references instead of inlining**: Agents can't read files the orchestrator could — inline the content
- **Ignoring structured returns**: Not parsing the agent's return header for status routing
- **Skipping quality loop**: Not spawning plan-checker or argument-verifier when config enables them
