---
name: wtfp:contribute
description: Guide through contributing code to WTF-P via Pull Request
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Guide the user through the complete process of contributing code to WTF-P, from fork to Pull Request.
</objective>

<context>
@~/.claude/write-the-f-paper/references/github-contrib.md
@~/.claude/CONTRIBUTING.md
</context>

<process>

## Step 1: Verify Prerequisites

Check tools are available:
```bash
gh auth status 2>&1
git --version
node --version
```

If `gh` not authenticated:
> Run `gh auth login` to authenticate with GitHub.

## Step 2: Understand Contribution Type

Use AskUserQuestion:

**Question 1: What are you contributing?**
- Header: "Type"
- Options:
  - "New command" - Add a /wtfp:* slash command
  - "Bug fix" - Fix an existing issue
  - "Workflow improvement" - Enhance a writing workflow
  - "Documentation" - Improve docs or add examples
  - "Other" - Something else

**Question 2: Do you have an existing issue?**
- Header: "Issue"
- Options:
  - "Yes, issue #___" - Link to existing issue
  - "No, creating fresh" - New contribution without issue
  - "I'll create one first" - Redirect to /wtfp:request-feature

## Step 3: Setup Repository

Check current state:
```bash
git remote -v
```

**If in wtf-p repo (maintainer):**
```bash
git checkout main
git pull origin main
git checkout -b [BRANCH_TYPE]/[SHORT_NAME]
```

**If not in wtf-p repo (external contributor):**
```bash
# Fork and clone
gh repo fork akougkas/wtf-p --clone
cd wtf-p

# Create branch
git checkout -b [BRANCH_TYPE]/[SHORT_NAME]
```

Branch naming:
- `feat/add-citation-check` for features
- `fix/install-path-spaces` for bugs
- `docs/improve-readme` for documentation

## Step 4: Guide Implementation

Based on contribution type:

### For New Command

1. Show command template:
```markdown
---
name: wtfp:command-name
description: Brief description
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
---

<objective>
What this command accomplishes.
</objective>

<context>
@~/.claude/write-the-f-paper/references/[relevant].md
</context>

<process>
## Step 1: ...
## Step 2: ...
</process>
```

2. Create file in `commands/wtfp/[name].md`

3. Follow naming conventions:
   - `new-*` for creation
   - `create-*` for generation
   - `plan-*` for planning
   - `write-*` for execution
   - `review-*` for review
   - `check-*` for validation
   - `export-*` for output

### For Bug Fix

1. Identify the file(s) to modify
2. Make minimal, focused changes
3. Add test coverage if applicable

### For Workflow Improvement

1. Edit file in `write-the-f-paper/workflows/`
2. If WCN version exists, update both `.md` and `.wcn.md`

## Step 5: Test Changes

```bash
# Run existing tests
npm test

# Install locally for manual testing
node bin/install.js --local --force

# Test in Claude Code
# /wtfp:your-new-command
```

Ask user to verify:
- Does the feature work as expected?
- Any edge cases to handle?
- Error messages clear?

## Step 6: Commit Changes

Stage files:
```bash
git add [FILES]
git status
```

Commit with conventional message:
```bash
git commit -m "[TYPE]([SCOPE]): [DESCRIPTION]

[Optional body explaining why]

[Closes #XX if applicable]"
```

Examples:
- `feat(commands): add citation-check command`
- `fix(cli): handle paths with spaces`
- `docs(readme): clarify installation steps`

## Step 7: Push and Create PR

Push branch:
```bash
git push -u origin [BRANCH_NAME]
```

Create PR:
```bash
gh pr create \
  --repo akougkas/wtf-p \
  --title "[TYPE]([SCOPE]): [DESCRIPTION]" \
  --body "$(cat <<'EOF'
## Summary
[What this PR does]

## Changes
- [Change 1]
- [Change 2]

## Testing
- [ ] `npm test` passes
- [ ] Manually tested in Claude Code
- [ ] [Specific test scenario]

## Related Issues
[Closes #XX or References #XX]
EOF
)"
```

## Step 8: Post-PR Guidance

After PR is created:

1. **Show PR URL** to user
2. **Explain review process:**
   - Maintainer will review within a few days
   - May request changes or ask questions
   - Once approved, will be merged to main

3. **Next steps:**
   - Watch for review comments
   - Respond to feedback
   - Update PR if changes requested

</process>

<templates>

## PR Title Format
```
<type>(<scope>): <description>
```

Types: feat, fix, docs, refactor, test, chore
Scopes: commands, workflows, cli, templates

## PR Body Template
```markdown
## Summary
Brief description of what this PR accomplishes.

## Changes
- Added/Modified/Removed X
- Updated Y to do Z

## Testing
How to verify this works:
1. Install locally: `node bin/install.js --local`
2. Run: `/wtfp:command`
3. Expected: [outcome]

## Screenshots (if UI changes)
[Paste screenshots here]

## Related Issues
Closes #XX
```

</templates>

<error-handling>

**Fork already exists:** Use existing fork
```bash
gh repo sync [USERNAME]/wtf-p
```

**Branch already exists:**
```bash
git checkout [BRANCH]
git pull origin main
```

**Push rejected:** Need to pull first or force push (with caution)

**PR creation fails:** Check if branch was pushed, verify gh auth

</error-handling>
