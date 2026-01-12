---
name: wtfp:request-feature
description: Request a new feature for WTF-P via GitHub issue
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

<objective>
Help the user request a new feature for WTF-P by creating a well-formatted GitHub issue.
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

## Step 2: Understand the Feature Request

Use AskUserQuestion to understand what the user wants:

**Question 1: Feature Category**
- Header: "Category"
- Options:
  - "New command" - A new /wtfp:* slash command
  - "Workflow enhancement" - Improve existing writing workflow
  - "Installation/CLI" - Improve npx wtf-p experience
  - "Template/Format" - New venue template or output format
  - "Integration" - Connect with other tools (Zotero, Overleaf, etc.)

**Question 2: Complexity**
- Header: "Scope"
- Options:
  - "Small tweak" - Minor change to existing behavior
  - "New capability" - Add something that doesn't exist
  - "Major feature" - Significant new functionality

## Step 3: Gather Feature Details

Based on category, ask targeted questions:

**For new command:**
- What should `/wtfp:new-command` do?
- When would you use it in your writing workflow?
- What inputs does it need? What outputs?

**For workflow enhancement:**
- Which workflow needs improvement?
- What's missing or frustrating?
- How should it work differently?

**For templates/formats:**
- Which venue or format?
- Do you have example requirements?

## Step 4: Explore Use Case

Ask user:
- What problem does this solve for you?
- How often would you use this?
- Have you tried any workarounds?

## Step 5: Check for Duplicates

Search existing issues:
```bash
gh issue list --repo akougkas/wtf-p --search "[KEYWORDS]" --limit 5
```

If similar issues exist, show them to the user and ask:
- "These similar issues exist. Should we add to one of these, or create a new issue?"

## Step 6: Draft the Feature Request

Create a draft:

```markdown
## Feature Description
[Clear description of the feature]

## Use Case
[Why this is needed, what problem it solves]

## Proposed Solution
[How it should work, with examples]

### Example Usage
```
/wtfp:new-command
> [Expected interaction]
```

## Alternatives Considered
[Other approaches, if discussed]

## Additional Context
[Related features, prior art, mockups]
```

## Step 7: Offer Implementation Path

Ask user:
- Header: "Next Step"
- Options:
  - "Create issue only" - Submit as feature request for maintainers
  - "I'll implement it" - Create issue + guide through PR process
  - "Help me implement" - Claude assists with implementation

If user wants to implement, transition to `/wtfp:contribute` workflow.

## Step 8: Create the Issue

If confirmed:

```bash
gh issue create \
  --repo akougkas/wtf-p \
  --title "feat: [SHORT_TITLE]" \
  --body "$(cat <<'EOF'
[FULL_BODY_HERE]
EOF
)" \
  --label "enhancement"
```

## Step 9: Report Success

Show the user:
- Issue URL
- Issue number
- Encourage voting/commenting to show interest
- If they want to implement: next steps

</process>

<tips>

**Good feature requests include:**
- Specific use case (not just "it would be nice")
- Example of how it would work
- Explanation of why existing features don't solve this

**Signal boost:** Encourage users to share the issue link with others who might want the feature. More reactions = higher priority.

</tips>
