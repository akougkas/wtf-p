---
name: wtfp:check-todos
description: Review pending todos and act on, defer, or dismiss each
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - AskUserQuestion
---

<objective>
Review pending todos. For each, user decides: act on it, defer it, dismiss it, or mark done.
</objective>

<context>
No arguments. Reads from .planning/todos/pending/.
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

## 2. List Pending Todos

```bash
ls -1 .planning/todos/pending/*.md 2>/dev/null
```

If no files found:
```
No pending todos.
```
Exit.

## 3. Display Banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► PENDING TODOS ({N})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 4. Process Each Todo

Initialize counters:
- acted = 0
- deferred = 0
- dismissed = 0
- done = 0

For each file in `.planning/todos/pending/`:

1. Read the file. Parse frontmatter (created, context) and body (description).

2. Present via AskUserQuestion:
   - header: "Todo #{N}"
   - question: "{todo description}\n\nCreated: {date} | Context: {context}"
   - options:
     - "Act on it now"
     - "Defer"
     - "Dismiss"
     - "Done"
     - "Skip rest"

3. Handle response:

   **"Act on it now":**
   - Display the full todo content
   - Output: "What would you like to do with this? (describe action or command)"
   - Let user take action manually
   - Increment acted counter
   - Keep file in pending (user will mark done when complete)

   **"Defer":**
   - Keep file in pending
   - Increment deferred counter
   - Continue to next

   **"Dismiss":**
   ```bash
   mkdir -p .planning/todos/dismissed
   mv {file} .planning/todos/dismissed/
   ```
   - Increment dismissed counter
   - Continue to next

   **"Done":**
   ```bash
   mkdir -p .planning/todos/done
   mv {file} .planning/todos/done/
   ```
   - Increment done counter
   - Continue to next

   **"Skip rest":**
   - Break out of loop
   - All remaining todos stay deferred

## 5. Update STATE.md

Count remaining pending todos:
```bash
ls -1 .planning/todos/pending/*.md 2>/dev/null | wc -l
```

Read STATE.md. Update "### Pending Todos" section with new count:
```
### Pending Todos

{N} pending todo(s).
```

Or if N = 0:
```
### Pending Todos

None.
```

## 6. Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► TODOS REVIEWED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Acted on: {N}
Deferred: {N}
Dismissed: {N}
Done: {N}
Still pending: {N}
```

</process>

<success_criteria>
- [ ] Pending todos listed with count
- [ ] Each todo presented with act/defer/dismiss/done/skip options
- [ ] Files moved to dismissed/ or done/ subdirectories as appropriate
- [ ] STATE.md pending count updated after review
- [ ] Summary shows actions taken
</success_criteria>
