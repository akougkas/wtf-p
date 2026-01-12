# Contributing to WTF-P

WTF-P is an open-source context engineering toolkit for academic writing with Claude Code. We welcome contributions from the community!

## Ways to Contribute

### 1. Report Issues (Non-technical)
Open a [GitHub Issue](https://github.com/akougkas/wtf-p/issues) for:
- Bug reports
- Feature requests
- Workflow improvements
- Documentation gaps

Use the issue templates when available.

### 2. Submit Code (Developers)
Fork, branch, and submit a Pull Request for:
- New commands or workflows
- Bug fixes
- Performance improvements
- Documentation updates

---

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/wtf-p.git
cd wtf-p

# Test the installation locally
node bin/install.js --local

# Run tests
npm test
```

### Testing Your Changes

```bash
# Sanity tests (structure, package.json)
npm test

# Manual testing in Claude Code
# 1. Install locally: node bin/install.js --local
# 2. Open Claude Code in this directory
# 3. Run your command: /wtfp:your-command
```

---

## Project Structure

```
wtf-p/
├── bin/
│   ├── install.js      # npx wtf-p installer
│   └── uninstall.js    # npx wtf-p-uninstall
├── commands/wtfp/      # Slash commands (/wtfp:*)
│   ├── help.md
│   ├── new-paper.md
│   └── ...
├── write-the-f-paper/
│   ├── workflows/      # Writing workflow files
│   ├── templates/      # LaTeX and venue templates
│   └── references/     # Principles and guidelines
├── test/
│   └── sanity.js       # Basic structure tests
└── tests/e2e/          # End-to-end verification
```

---

## Adding a New Command

Commands are markdown files in `commands/wtfp/` with YAML frontmatter.

### Command Template

```markdown
---
name: wtfp:your-command
description: Brief description of what it does
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Clear statement of what this command accomplishes.
</objective>

<context>
@~/.claude/write-the-f-paper/references/principles.md
</context>

<process>
## Step 1: Validate Prerequisites
...

## Step 2: Execute Main Logic
...

## Step 3: Output Results
...
</process>
```

### Naming Conventions

| Prefix | Purpose | Example |
|--------|---------|---------|
| `new-*` | Create something new | `new-paper` |
| `create-*` | Generate structure | `create-outline` |
| `plan-*` | Planning phase | `plan-section` |
| `write-*` | Writing execution | `write-section` |
| `review-*` | Review and polish | `review-section` |
| `check-*` | Validation | `check-refs` |
| `export-*` | Output generation | `export-latex` |

### Best Practices

1. **Use AskUserQuestion for ALL user interaction** - Never ask inline text questions
2. **Batch related questions** - Use multi-select when questions are independent
3. **Validate inputs early** - Check prerequisites before doing work
4. **Provide clear error messages** - Tell users how to fix problems
5. **Commit results** - Use git to checkpoint progress

---

## Adding a New Workflow

Workflows live in `write-the-f-paper/workflows/` and handle specific writing tasks.

### Workflow vs Command

| Type | Location | Invoked By |
|------|----------|------------|
| Command | `commands/wtfp/*.md` | User via `/wtfp:*` |
| Workflow | `write-the-f-paper/workflows/*.md` | Commands via `@` reference |

### WCN (Workflow Compression Notation)

For token efficiency, workflows have two versions:
- `workflow.md` - Verbose, human-readable
- `workflow.wcn.md` - Compressed, fewer tokens

See `write-the-f-paper/workflows/WCN-SPEC.md` for compression syntax.

---

## Pull Request Process

1. **Fork and branch**
   ```bash
   git checkout -b feat/your-feature
   ```

2. **Make changes** following the patterns above

3. **Test locally**
   ```bash
   npm test
   node bin/install.js --local
   # Test in Claude Code
   ```

4. **Commit with conventional commits**
   ```bash
   git commit -m "feat(commands): add citation-check command"
   ```

5. **Push and create PR**
   ```bash
   git push origin feat/your-feature
   ```

6. **PR Description** should include:
   - What the change does
   - How to test it
   - Any breaking changes

---

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

### Types
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

### Scopes
- `commands` - Slash commands
- `workflows` - Writing workflows
- `cli` - Installer/uninstaller
- `templates` - LaTeX templates

---

## Code Style

### JavaScript (bin/)
- Use `const`/`let`, never `var`
- Async/await for promises
- Descriptive variable names
- Error messages should be helpful

### Markdown Commands
- YAML frontmatter is required
- Use `<objective>`, `<context>`, `<process>` blocks
- Keep instructions clear and unambiguous
- Reference shared files with `@~/.claude/...`

---

## Questions?

- Open a [Discussion](https://github.com/akougkas/wtf-p/discussions) for questions
- Check existing [Issues](https://github.com/akougkas/wtf-p/issues) before reporting
- Tag issues with appropriate labels

Thank you for contributing to WTF-P!
