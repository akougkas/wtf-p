# WTF-P Visual Identity Reference

Visual formatting conventions for all orchestrators and agents. Claude Code output is plain text — these symbols and patterns provide visual hierarchy without ANSI colors.

## Stage Banners

The `WTF-P ►` banner marks stage transitions in orchestrator output. Format:

```
WTF-P ► {STAGE_NAME} {optional_detail}
```

Rendered inside a box:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► {STAGE_NAME} {optional_detail}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Stage Names

| Stage | Usage | Example |
|-------|-------|---------|
| INITIALIZING | Project setup, config load | `WTF-P ► INITIALIZING new-paper` |
| PLANNING | Section plan creation | `WTF-P ► PLANNING SECTION 2` |
| RESEARCHING | Literature search, gap analysis | `WTF-P ► RESEARCHING literature gaps` |
| WRITING | Section draft execution | `WTF-P ► WRITING SECTION 1 PLAN 1` |
| REVIEWING | Section review, quality checks | `WTF-P ► REVIEWING SECTION 3` |
| POLISHING | Prose refinement, voice adjustment | `WTF-P ► POLISHING SECTION 1` |
| VERIFYING | Argument verification, citation check | `WTF-P ► VERIFYING SECTION 2` |
| CHECKING | Pre-flight checks, plan validation | `WTF-P ► CHECKING plan quality` |
| COMPLETE | Stage finished successfully | `WTF-P ► COMPLETE ✓` |

### Completion Banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Summary of what was done]

───────────────────────────────────────────

## ▶ Next Up

**[Next action]** — [description]

`/wtfp:[next-command] [args]`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────
```

## Checkpoint Boxes

How checkpoints render to the user. Three types, same box format:

```
════════════════════════════════════════
CHECKPOINT: {type}
════════════════════════════════════════
Task {X} of {Y}: {Name}

{content — varies by checkpoint type}

{resume signal}
════════════════════════════════════════
```

### human-verify Box

```
════════════════════════════════════════
CHECKPOINT: human-verify
════════════════════════════════════════
Task 3 of 5: Review introduction draft

What was written:
  Introduction opening paragraph (~200 words)

How to verify:
  1. Captures the problem accurately
  2. Tone matches your voice
  3. Hook is compelling

Type "approved" or describe what to change.
════════════════════════════════════════
```

### decision Box

```
════════════════════════════════════════
CHECKPOINT: decision
════════════════════════════════════════
Task 2 of 4: Methodology framing

Decision needed:
  How to frame the methodology section

Options:
  [a] Emphasize novelty — highlights contribution, may invite scrutiny
  [b] Frame as extension — builds on prior work, may seem incremental

Select: a or b
════════════════════════════════════════
```

### human-action Box

```
════════════════════════════════════════
CHECKPOINT: human-action
════════════════════════════════════════
Task 4 of 6: Insert experimental results

What is needed:
  Exact p-value and effect size from your analysis

Provide: p-value and effect size
════════════════════════════════════════
```

## Status Symbols

| Symbol | Meaning | Usage |
|--------|---------|-------|
| ✓ | Complete | Task finished, verification passed |
| ► | In progress | Currently executing |
| ✗ | Failed | Task or verification failed |
| — | Skipped | Task skipped (gate disabled, not applicable) |
| ⊘ | Blocked | Cannot proceed (missing dependency, auth) |

### In Task Lists

```
  ✓ Task 1: Draft opening hook
  ✓ Task 2: Establish research gap
  ► Task 3: Present thesis statement
  — Task 4: (skipped — gate disabled)
  ⊘ Task 5: (blocked — needs Task 3)
```

## Progress Bars

Format: `[{filled}{empty}] {current}/{total} {unit}`

```
[########............] 4/10 sections
[####################] 10/10 sections
[....................] 0/10 sections
```

Fill character: `#`
Empty character: `.`
Bar width: 20 characters (fixed)

### In Section Tracking

```
Section progress:
  [####................ ] 2/8 sections planned
  [##.................. ] 1/8 sections written
  [.................... ] 0/8 sections reviewed
```

### In Task Tracking

```
Plan 01-02 progress:
  [############........] 3/5 tasks complete
```

## Color Note

Claude Code renders plain text. All visual hierarchy comes from:

- Unicode box-drawing characters (`━`, `═`, `─`) for borders
- Unicode symbols (`✓`, `✗`, `►`, `⊘`, `—`) for status
- Indentation and whitespace for structure
- `#` and `.` for progress bars

No ANSI color codes, no terminal escape sequences. These patterns work in any text rendering context.
