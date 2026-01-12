# WTF-P GitHub Contribution Reference

This document teaches Claude how to help users contribute to the WTF-P project via GitHub.

## Repository Information

- **Owner**: akougkas
- **Repo**: wtf-p
- **URL**: https://github.com/akougkas/wtf-p
- **Issues**: https://github.com/akougkas/wtf-p/issues
- **PRs**: https://github.com/akougkas/wtf-p/pulls

## Prerequisites Check

Before any GitHub operation, verify `gh` CLI is authenticated:

```bash
gh auth status
```

If not authenticated, instruct user to run:
```bash
gh auth login
```

## Issue Templates

### Bug Report Format

```markdown
## Bug Description
[Clear description of what's wrong]

## Steps to Reproduce
1. [First step]
2. [Second step]
3. [Expected vs actual behavior]

## Environment
- WTF-P version: [run `npx wtf-p --version`]
- Node.js version: [run `node --version`]
- OS: [macOS/Linux/Windows]
- Claude Code version: [if relevant]

## Additional Context
[Screenshots, logs, related issues]
```

### Feature Request Format

```markdown
## Feature Description
[What feature do you want?]

## Use Case
[Why do you need this? What problem does it solve?]

## Proposed Solution
[How should it work? Include examples if possible]

## Alternatives Considered
[Other approaches you've thought about]

## Additional Context
[Mockups, related features, prior art]
```

## Creating Issues via `gh`

### Bug Report
```bash
gh issue create \
  --repo akougkas/wtf-p \
  --title "bug: [SHORT_DESCRIPTION]" \
  --body "$(cat <<'EOF'
## Bug Description
...

## Steps to Reproduce
...

## Environment
...
EOF
)" \
  --label "bug"
```

### Feature Request
```bash
gh issue create \
  --repo akougkas/wtf-p \
  --title "feat: [SHORT_DESCRIPTION]" \
  --body "$(cat <<'EOF'
## Feature Description
...

## Use Case
...
EOF
)" \
  --label "enhancement"
```

## Pull Request Workflow

### 1. Fork (if external contributor)
```bash
gh repo fork akougkas/wtf-p --clone
cd wtf-p
```

### 2. Create Branch
```bash
git checkout -b feat/short-description
# or
git checkout -b fix/short-description
```

### 3. Make Changes
Follow patterns in CONTRIBUTING.md:
- Commands go in `commands/wtfp/`
- Workflows go in `write-the-f-paper/workflows/`
- Use conventional commit messages

### 4. Test
```bash
npm test
node bin/install.js --local
# Test manually in Claude Code
```

### 5. Commit
```bash
git add .
git commit -m "feat(commands): add new-feature command

- Added X functionality
- Updated Y for Z reason"
```

### 6. Push and Create PR
```bash
git push -u origin feat/short-description

gh pr create \
  --repo akougkas/wtf-p \
  --title "feat(scope): description" \
  --body "$(cat <<'EOF'
## Summary
Brief description of changes

## Changes Made
- [ ] Item 1
- [ ] Item 2

## Testing
How to test these changes

## Related Issues
Closes #XX (if applicable)
EOF
)"
```

## Commit Message Convention

Format: `<type>(<scope>): <description>`

### Types
| Type | Use For |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `refactor` | Code restructuring |
| `test` | Adding tests |
| `chore` | Maintenance |

### Scopes
| Scope | Use For |
|-------|---------|
| `commands` | Slash commands |
| `workflows` | Writing workflows |
| `cli` | Installer scripts |
| `templates` | LaTeX/venue templates |

## Labels Reference

| Label | Description |
|-------|-------------|
| `bug` | Something isn't working |
| `enhancement` | New feature request |
| `documentation` | Documentation improvements |
| `good first issue` | Good for newcomers |
| `help wanted` | Extra attention needed |

## Common Scenarios

### User found a bug while writing
1. Gather: What command? What happened? What was expected?
2. Check: Can we reproduce? What's the environment?
3. Create: Issue with reproduction steps
4. Link: Reference any error messages or logs

### User wants a new command
1. Clarify: What should it do? What's the use case?
2. Check: Does something similar exist?
3. Propose: Draft the command structure
4. Create: Feature request issue or implement directly

### User wants to fix something themselves
1. Guide: Fork and clone workflow
2. Help: Implement the fix
3. Test: Verify it works
4. Submit: Create PR with proper format
