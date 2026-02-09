---
name: wtfp:polish-prose
description: Improve clarity, flow, and academic voice in written prose
argument-hint: "[section-number or file]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<execution_context>
@~/.claude/write-the-f-paper/references/principles.md
</execution_context>

<objective>
Polish prose to eliminate robotic AI-sounding text and improve academic voice.

**Orchestrator role:** Identify target files, gather voice preference, resolve model profile, spawn prose-polisher agent, present results.
</objective>

<context>
Target: $ARGUMENTS (section number, file path, or "all" for full manuscript)

**Load project state:**
@.planning/STATE.md
</context>

<process>

## 1. Validate Environment and Resolve Model Profile

```bash
ls paper/*.md 2>/dev/null || echo "No content in paper/ directory"
```

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| prose-polisher | opus | sonnet | haiku |

## 2. Identify Target and Gather Preferences

Parse $ARGUMENTS to find target file(s).

Use AskUserQuestion:
- header: "Voice"
- question: "What tone should dominate this section?"
- options:
  - "Authoritative" — Confident, direct claims
  - "Measured" — Careful hedging, academic caution
  - "Accessible" — Clear to non-specialists
  - "Technical" — Dense, specialist terminology OK

## 3. Read Context Files

```bash
TARGET_CONTENT=$(cat paper/[target].md 2>/dev/null)
STYLE_CONTENT=$(cat .planning/sources/style-guide.md 2>/dev/null)

SECTION_DIR=$(ls -d .planning/sections/${SECTION}-* 2>/dev/null | head -1)
CONTEXT_CONTENT=$(cat "${SECTION_DIR}"/*-CONTEXT.md 2>/dev/null)
```

## 4. Spawn wtfp-prose-polisher Agent

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► POLISHING PROSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
Task(
  prompt="First, read ~/.claude/agents/wtfp/prose-polisher.md for your role and instructions.\n\n" + filled_polish_prompt,
  subagent_type="general-purpose",
  model="{polisher_model}",
  description="Polish prose"
)
```

Polish prompt includes: `<target_content>` with section text, `<voice_preference>` with user selection, `<style_guide>` with style context, `<user_decisions>` with CONTEXT_CONTENT.

## 5. Handle Polisher Return

**`## POLISH COMPLETE`:** Present before/after summary.

**`## POLISH BLOCKED`:** Present blocker, ask user how to proceed.

## 6. Present Results

</process>

<offer_next>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► PROSE POLISHED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

───────────────────────────────────────────

## Next Up

- `/wtfp:review-section {N}` — Get reviewer feedback
- `/wtfp:check-refs` — Verify citations
- `/wtfp:export-latex` — Generate LaTeX

───────────────────────────────────────────

</offer_next>

<success_criteria>
- [ ] Target file(s) identified
- [ ] Voice preference gathered
- [ ] Prose-polisher spawned with full context
- [ ] Changes applied to paper/ files
- [ ] User knows next steps
</success_criteria>
