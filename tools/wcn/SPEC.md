# WCN: Workflow Compression Notation

**Version**: 1.0.0
**Status**: Draft
**Inspired by**: TOON (Token-Oriented Object Notation), POML

## Overview

WCN (Workflow Compression Notation) is a compact, LLM-optimized notation for encoding workflow instructions. It achieves 40-60% token reduction while improving comprehension for smaller models (Haiku-class).

WCN is **not** a data serialization format like TOON. It's a **prose compression notation** designed specifically for AI agent instructions, workflows, and prompts.

## Design Principles

1. **Token Efficiency** - Minimize tokens without losing semantics
2. **LLM Readability** - Structure that models parse reliably
3. **Human Editable** - No build step required, plain text
4. **Lossless** - All information preserved, just compressed
5. **Incremental** - Can be applied partially to existing files

## Core Syntax

### 1. Step Blocks

Verbose markdown steps become compact step blocks.

**Before (Verbose Markdown):**
```markdown
<step name="load_project_state" priority="first">
Before any operation, read project state:

```bash
cat .planning/STATE.md 2>/dev/null
```

**If file exists:** Parse and internalize:

- Current position (section, plan, status)
- Word count progress (current vs target)
- Argument strength (what's been established)
- Open questions (things to watch for)

**If file missing but .planning/ exists:**

```
STATE.md missing but planning artifacts exist.
Options:
1. Reconstruct from existing artifacts
2. Continue without project state
```

**If .planning/ doesn't exist:** Error - project not initialized.

This ensures every writing session has full project context.
</step>
```

**After (WCN):**
```wcn
[step:load_state p=1]
RUN: cat .planning/STATE.md
PARSE: position, word_count, argument_strength, open_questions
IF exists → parse fields above
IF missing+.planning → OFFER reconstruct|continue
IF no.planning → ERROR "not initialized"
[/step]
```

**Syntax Rules:**
- `[step:name]` opens, `[/step]` closes
- Attributes: `p=N` (priority), `gate=blocking|optional`
- Commands: `RUN:`, `PARSE:`, `READ:`, `WRITE:`, `ASK:`
- Conditions: `IF condition → action`
- Alternatives: `|` separates options

### 2. Conditional Blocks

Replace verbose if/else prose with inline conditionals.

**Before:**
```markdown
**If mode="co-author":**
- Claude drafts, user refines
- Best for: Methods, background, boilerplate

**If mode="scaffold":**
- Claude outlines, user fills
- Best for: Results, arguments requiring judgment

**If mode="reviewer":**
- User writes, Claude critiques
- Best for: Abstract, discussion, conclusions
```

**After:**
```wcn
MODE{name,action,best_for}:
  co-author | Claude drafts, user refines | methods/background
  scaffold | Claude outlines, user fills | results/arguments
  reviewer | User writes, Claude critiques | abstract/discussion
```

**Syntax Rules:**
- `NAME{field1,field2,...}:` declares table header
- Rows use `|` as field delimiter
- One row per line, indented

### 3. Route Tables

Replace multi-paragraph routing logic with decision tables.

**Before:**
```markdown
**Route A: More plans remain in this section**

Present completion and offer next plan...

**Route B: Section complete, more sections remain**

Present section completion and offer next section...

**Route C: Document complete (all sections done)**

Present document completion...
```

**After:**
```wcn
ROUTE{condition → output → next}:
  plans_remain → "Plan {done}/{total} complete" → /wtfp:write-section {next_plan}
  section_done → "Section {N} complete" → /wtfp:plan-section {next_section}
  doc_complete → "DOCUMENT COMPLETE" → /wtfp:submit-draft
```

### 4. Inline Commands

Common operations become single-line commands.

| Command | Meaning | Example |
|---------|---------|---------|
| `RUN:` | Execute bash | `RUN: cat .planning/STATE.md` |
| `READ:` | Load file context | `READ: @.planning/PROJECT.md` |
| `WRITE:` | Create/update file | `WRITE: .planning/sections/{N}/PLAN.md` |
| `PARSE:` | Extract fields | `PARSE: position, word_count, status` |
| `ASK:` | User question | `ASK: "Continue?" [yes|no|skip]` |
| `COMMIT:` | Git commit | `COMMIT: "docs: {message}"` |
| `IF:` | Conditional | `IF missing → ERROR "not found"` |
| `EMIT:` | Output to user | `EMIT: "Plan complete: {path}"` |

### 5. Reference Blocks

External file references use compact notation.

**Before:**
```markdown
<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/structure/argument-map.md
@.planning/sources/literature.md
</context>
```

**After:**
```wcn
@context{PROJECT.md,ROADMAP.md,structure/argument-map.md,sources/literature.md}
```

### 6. Schema Definitions

Define expected structures compactly.

**Before:**
```markdown
Every writing task has required fields:

**target**: Word count goal for this task.
- Good: `~200 words`, `150-200 words`
- Bad: "a paragraph", "some text"

**action**: Specific writing instructions, including key points and tone.
- Good: "Write opening paragraph establishing..."
- Bad: "Write the introduction"

**verify**: How to check the writing is complete.
- Must be checkable without subjective judgment.

**done**: Acceptance criteria - the measurable state of completion.
```

**After:**
```wcn
TASK_SCHEMA:
  target: word_count ("~200 words" | "150-200")
  action: what + key_points + tone + citations
  verify: checkable_criteria (no subjective)
  done: measurable_state
```

### 7. Rule Blocks

Deviation/error handling rules in compact form.

**Before:**
```markdown
**RULE 1: Auto-fix factual errors**

**Trigger:** Incorrect fact, wrong citation, logical contradiction

**Action:** Fix immediately, track for Summary

**Examples:**
- Wrong year on a citation
- Contradicting a claim from earlier section
- Misrepresenting a source's findings

**Process:**
1. Fix the error inline
2. Note the correction
3. Continue writing
4. Track in adjustments list

**No user permission needed.** Errors must be fixed for accuracy.
```

**After:**
```wcn
[rule:auto_fix_errors]
TRIGGER: factual_error | wrong_citation | contradiction
ACTION: fix_inline + track_adjustment
PERMISSION: none_required
[/rule]
```

### 8. Verification Checklists

**Before:**
```markdown
**1. Citation Check (Mechanical)**
- All claims have citations or are clearly original claims
- Citations formatted correctly
- No [CITE: ] placeholders remaining
- Page numbers where style requires

**2. Argument Coherence (Logical)**
- Claims follow from evidence
- No logical contradictions with prior sections
- Thesis supported by content
- Flow between paragraphs makes sense

**3. Rubric Check (Requirements)**
- Word count within target range
- Required elements present
- Formatting requirements met
- Section accomplishes its goal
```

**After:**
```wcn
VERIFY{layer,checks}:
  citation | claims_cited, format_correct, no_placeholders, page_numbers
  coherence | evidence_supports_claims, no_contradictions, thesis_supported, flow_ok
  rubric | word_count_ok, elements_present, format_ok, goal_met
```

## File Extension

WCN-compressed files use `.wcn.md` extension to indicate:
- Still valid markdown (renders reasonably)
- Contains WCN notation
- Can be converted back to verbose form

## Compression Targets

| Content Type | Verbose Lines | WCN Lines | Reduction |
|--------------|---------------|-----------|-----------|
| Step block | 25-40 | 6-10 | 70% |
| Mode table | 15-20 | 4-6 | 70% |
| Route logic | 30-50 | 5-8 | 80% |
| Rule block | 20-30 | 4-6 | 75% |
| Verify list | 15-25 | 3-5 | 80% |

**Overall target**: 40-60% token reduction per workflow file.

## Conversion Rules

### What Gets Compressed

1. **Step blocks** with `<step>` tags → `[step:]` notation
2. **Verbose conditionals** → `IF x → y` inline
3. **Mode/type tables** → `NAME{fields}:` tabular
4. **Route logic** → `ROUTE{condition → action}:`
5. **Rule explanations** → `[rule:]` blocks
6. **Checklists** → `VERIFY{layer,checks}:`
7. **Redundant prose** → Removed ("This ensures...", "This is important...")

### What Stays Unchanged

1. **Code blocks** (```bash...```) - Keep as-is
2. **XML tags** for structure (`<purpose>`, `<objective>`) - Keep
3. **Complex prose** that can't be compressed - Keep
4. **Examples** that need full context - Keep but trim
5. **User-facing output templates** - Keep formatting

## Validation Rules

WCN documents must pass:

1. **Balanced blocks** - Every `[step:]` has `[/step]`
2. **Valid commands** - Only recognized commands (RUN, READ, etc.)
3. **Table consistency** - Header fields match row field count
4. **No dangling references** - @context files exist or are variables

## Implementation Notes

### For Converters

1. Parse markdown into AST
2. Identify compressible patterns (steps, tables, routes)
3. Apply WCN transformations
4. Preserve non-compressible content
5. Output `.wcn.md` file

### For LLM Consumption

WCN is designed for direct LLM reading. No expansion needed.
The notation is self-documenting - Claude/GPT understand:
- `RUN:` means execute
- `IF x → y` means conditional
- `{field1,field2}:` means table header

### For Human Editing

WCN files remain editable:
- Plain text, no special tooling
- Patterns are learnable in 5 minutes
- Can mix WCN and verbose markdown

## Example: Full Conversion

See `examples/before.md` and `examples/after.wcn.md` for complete workflow conversion.

## Changelog

- **1.0.0** (2025-01-11): Initial specification
