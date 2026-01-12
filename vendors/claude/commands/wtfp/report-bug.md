---
name: wtfp:report-bug
description: Report a bug in WTF-P via GitHub issue
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

<objective>
Help the user report a bug in WTF-P by creating a well-formatted GitHub issue.
</objective>

<context>
@~/.claude/write-the-f-paper/references/github-contrib.md
</context>

<process>

## Step 1: Verify GitHub CLI

Check if `gh` is authenticated:

```bash
gh auth status 2>&1
```

If not authenticated, inform the user:
> To create GitHub issues, you need to authenticate the GitHub CLI.
> Run: `gh auth login`
> Then try this command again.

## Step 2: Gather Bug Information

Use AskUserQuestion to collect bug details:

**Question 1: Bug Category**
- Header: "Bug Type"
- Options:
  - "Command fails" - A /wtfp:* command doesn't work as expected
  - "Installation issue" - Problems with npx wtf-p install/uninstall
  - "Workflow error" - Writing workflow produces wrong output
  - "Documentation gap" - Docs are missing or incorrect

**Question 2: Bug Description**
- Header: "Description"
- Options:
  - "Let me describe it" - User provides description
  - "Help me articulate" - Claude helps user describe the bug

If user needs help articulating, ask follow-up questions:
- What were you trying to do?
- What happened instead?
- What did you expect to happen?

## Step 3: Gather Environment Info

Automatically collect:
```bash
npx wtf-p --version 2>/dev/null || echo "Not installed via npx"
node --version
uname -s 2>/dev/null || echo "Unknown OS"
```

## Step 4: Collect Reproduction Steps

Ask user:
- What command or action triggered the bug?
- Can you reproduce it consistently?
- Any error messages? (ask to paste them)

## Step 5: Draft the Issue

Create a draft and show it to the user:

```markdown
## Bug Description
[From user input]

## Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [What happened vs expected]

## Environment
- WTF-P version: [collected]
- Node.js version: [collected]
- OS: [collected]

## Additional Context
[Error messages, logs, screenshots mentioned]
```

## Step 6: Confirm and Create

Ask user to confirm:
- "Create this issue?" with options: Yes / Edit first / Cancel

If confirmed, create the issue:

```bash
gh issue create \
  --repo akougkas/wtf-p \
  --title "bug: [SHORT_TITLE]" \
  --body "$(cat <<'EOF'
[FULL_BODY_HERE]
EOF
)" \
  --label "bug"
```

## Step 7: Report Success

Show the user:
- Issue URL (from gh output)
- Issue number
- What happens next (maintainer will review)

</process>

<error-handling>

**gh not installed**: Direct user to https://cli.github.com/

**gh not authenticated**: Guide through `gh auth login`

**Network error**: Save draft locally, retry later

**Permission denied**: User may need to fork first for external contributors

</error-handling>
