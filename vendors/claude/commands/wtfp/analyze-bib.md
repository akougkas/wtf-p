---
name: wtfp:analyze-bib
description: Analyze bibliography and map citations to sections
argument-hint: "[bib-file]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - Task
  - AskUserQuestion
  - WebFetch
---

<execution_context>
@~/.claude/write-the-f-paper/templates/project-context/bibliography.md
</execution_context>

<objective>
Deep analysis of BibTeX bibliography to inform writing strategy.

**Orchestrator role:** Locate bib file, run deterministic indexing/impact tools, resolve model profile, spawn citation-expert agent for analysis, present results.

Output: REFS.md with citation strategy mapped to paper sections.
</objective>

<context>
BibTeX file: $ARGUMENTS (optional — auto-detects .bib files if not provided)

**Load project context:**
@.planning/PROJECT.md
@.planning/config.json
@.planning/structure/outline.md
</context>

<process>

## 1. Validate Environment and Resolve Model Profile

```bash
find . -name "*.bib" -type f 2>/dev/null | grep -v node_modules | grep -v .git | head -10
```

If multiple found, ask via AskUserQuestion. If none found, exit with error.

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| citation-expert | opus | sonnet | haiku |

## 2. Run Deterministic Tools

```bash
node ~/.claude/bin/bib-index.js index "$BIB_FILE"
node ~/.claude/bin/analyze-impact.js "$BIB_FILE"
```

Capture JSON output from indexer and impact analysis results.

## 3. Read Context Files

```bash
PROJECT_CONTENT=$(cat .planning/PROJECT.md)
OUTLINE_CONTENT=$(cat .planning/structure/outline.md 2>/dev/null)
```

## 4. Spawn citation-expert Agent

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► ANALYZING BIBLIOGRAPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
Task(
  prompt="First, read ~/.claude/agents/wtfp/citation-expert.md for your role.\n\n" + analysis_prompt,
  subagent_type="general-purpose",
  model="{expert_model}",
  description="Analyze bibliography"
)
```

Analysis prompt includes: `<bib_index>` with parsed entries, `<impact_analysis>` with metrics, `<project_context>` with PROJECT + outline, `<output>` targeting `.planning/sources/REFS.md`.

Agent performs: temporal analysis, topic clustering, seminal work identification, section mapping, gap identification.

## 5. Handle Expert Return

**`## ANALYSIS COMPLETE`:** Present summary, ask user to confirm seminal works via AskUserQuestion.

**`## ANALYSIS BLOCKED`:** Present blocker (missing .bib, empty file, etc.), ask user how to proceed.

## 6. Commit

```bash
git add .planning/sources/REFS.md
git commit -m "refs: analyze bibliography for citation strategy"
```

</process>

<offer_next>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► BIBLIOGRAPHY ANALYZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Entries: [N]
- Topic clusters: [N]
- Seminal works: [N]
- Citation map: .planning/sources/REFS.md

───────────────────────────────────────────

## ▶ Next Up

`/wtfp:create-outline` — use citation map to inform section planning

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────

</offer_next>

<success_criteria>
- [ ] BibTeX file parsed completely
- [ ] Impact analysis run
- [ ] Citation-expert spawned with full context
- [ ] REFS.md created with citation strategy
- [ ] Seminal works confirmed with user
- [ ] Committed to git
</success_criteria>
