---
name: wtfp:add-todo
description: Capture a quick note or task without breaking your flow
argument-hint: "[description]"
allowed-tools:
  - Read
  - Bash
  - Write
---

<objective>
Quick-capture todo during a work session. Minimal disruption -- capture and return.
</objective>

<context>
$ARGUMENTS: The todo description to capture.
</context>

<process>

## 1. Validate Environment

```bash
ls .planning/ 2>/dev/null
```

If `.planning/` does not exist, output error and exit:
```
Error: No project found. Run /wtfp:new-paper first.
```

## 2. Parse Arguments

If $ARGUMENTS is empty, output error with usage:
```
Usage: /wtfp:add-todo "description"

Example: /wtfp:add-todo "Check whether Smith2024 contradicts our methodology claim"
```

## 3. Create Todo File

```bash
mkdir -p .planning/todos/pending
```

Generate filename: `{YYYYMMDD-HHMMSS}-{slug}.md`
- Timestamp: current date/time
- Slug: first 4 words of description, lowercase, hyphenated, alphanumeric only

Example: `20260204-143052-check-whether-smith2024-contradicts.md`

## 4. Detect Context

Try to determine current section from STATE.md:
```bash
grep -o "Section [0-9]* of [0-9]*:" .planning/STATE.md 2>/dev/null | head -1
```

If found, extract section number as context. Otherwise, use "general".

## 5. Write Todo File

Write to `.planning/todos/pending/{filename}`:

```markdown
---
created: {YYYY-MM-DD HH:MM}
status: pending
context: {section number or "general"}
---

{description from $ARGUMENTS}
```

## 6. Update STATE.md

Read STATE.md. Find or create "### Pending Todos" section under "## Accumulated Context".

Count pending todos:
```bash
ls -1 .planning/todos/pending/*.md 2>/dev/null | wc -l
```

Update STATE.md with the count. Format:
```
### Pending Todos

{N} pending todo(s).
```

## 7. Confirm

Output single line:
```
► Todo captured ({N} pending)
```

No banner, no offer_next. Minimal interruption.

</process>

<success_criteria>
- [ ] Todo file created in .planning/todos/pending/
- [ ] File has proper frontmatter (created, status, context)
- [ ] STATE.md updated with pending count
- [ ] Output is single confirmation line
</success_criteria>
