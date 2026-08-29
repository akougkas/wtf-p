# Contributing to WTF-P

WTF-P is an open-source context engineering toolkit for academic writing with AI coding assistants. We welcome contributions from the community!

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
# Full test suite (sanity + paths + linter + wcn-integrity + dry-run + features + installer)
npm test

# Manual testing — install to your AI assistant and try the commands:
node bin/install.js --local            # Claude Code
node bin/install.js --local --gemini   # Gemini CLI
node bin/install.js --local --opencode # OpenCode
```

---

## Project Structure

```
wtf-p/
├── bin/
│   ├── install.js                     # npx wtf-p entry point
│   ├── uninstall.js                   # npx wtf-p-uninstall entry point
│   ├── commands/                      # CLI subcommands (doctor, install-logic, list, status, update)
│   └── lib/                           # Shared libraries (manifest, checkpoint, citation, context-primer)
├── core/write-the-f-paper/            # Vendor-agnostic content
│   ├── references/                    # 16 reference docs (principles, formats, patterns)
│   ├── templates/                     # 20+ templates (config, context, manuscript, venues, posters, slides)
│   ├── venues/                        # 5 venue configs (acm-cs, ieee-cs, arxiv-ml, nature, thesis)
│   └── workflows/                     # 14 workflows × 2 (verbose + WCN compressed)
├── vendors/
│   ├── claude/                        # Claude Code: 36 commands (.md), 11 agents (.md), MCP, skills, plugin
│   │   ├── commands/wtfp/             # Slash commands
│   │   └── agents/wtfp/              # Specialized agents
│   ├── gemini/                        # Gemini CLI: 36 commands (.toml), 11 agents (.md)
│   │   ├── commands/wtfp/
│   │   └── agents/wtfp/
│   └── opencode/                      # OpenCode: 36 commands (.md), 11 agents (.md)
│       ├── commands/wtfp/
│       └── agents/wtfp/
├── test/                              # 7 test suites
├── tests/e2e/                         # E2E test framework
├── tools/wcn/                         # WCN compression tool
├── scripts/                           # release.js, preflight.js
└── docs/                              # Developer docs
```

---

## Adding a New Command

Commands live in `vendors/<runtime>/commands/wtfp/`. Each runtime has its own format.

### Claude Code (Markdown)

File: `vendors/claude/commands/wtfp/your-command.md`

```markdown
---
name: wtfp:your-command
description: Brief description of what it does
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
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

### Gemini CLI (TOML)

File: `vendors/gemini/commands/wtfp/your-command.toml`

Gemini uses TOML frontmatter. No `allowed-tools` field — tools are available by default in Gemini.

```toml
[command]
name = "wtfp:your-command"
description = "Brief description of what it does"

[command.content]
text = """
<objective>
Clear statement of what this command accomplishes.
</objective>

<context>
@~/.config/gemini/write-the-f-paper/references/principles.md
</context>

<process>
## Step 1: ...
</process>
"""
```

### OpenCode (Markdown)

File: `vendors/opencode/commands/wtfp/your-command.md`

Same Markdown format as Claude, but **no `allowed-tools` frontmatter** (tools are available by default) and paths use `~/.opencode/` instead of `~/.claude/`.

### Multi-Vendor Checklist

When adding a new command, you must create it for **all three runtimes**:
- [ ] `vendors/claude/commands/wtfp/your-command.md`
- [ ] `vendors/gemini/commands/wtfp/your-command.toml`
- [ ] `vendors/opencode/commands/wtfp/your-command.md`
- [ ] Update `vendors/claude/commands/wtfp/help.md` with the new command
- [ ] Add the command to `bin/lib/manifest.js` if it needs installer awareness
- [ ] Run `npm test` to validate linting and structure

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

1. **Use structured interaction** — Never ask inline text questions; use the assistant's structured prompting
2. **Batch related questions** — Group independent questions together
3. **Validate inputs early** — Check prerequisites before doing work
4. **Provide clear error messages** — Tell users how to fix problems
5. **Commit results** — Use git to checkpoint progress

---

## Adding a New Workflow

Workflows live in `core/write-the-f-paper/workflows/` and are vendor-agnostic.

### Workflow vs Command

| Type | Location | Invoked By |
|------|----------|------------|
| Command | `vendors/<runtime>/commands/wtfp/*.md` | User via `/wtfp:*` |
| Workflow | `core/write-the-f-paper/workflows/*.md` | Commands via `@` reference |

### WCN (Workflow Compression Notation)

For token efficiency, workflows have two versions:
- `workflow.md` — Verbose, human-readable
- `workflow.wcn.md` — Compressed, fewer tokens (35–50% savings)

See `core/write-the-f-paper/workflows/WCN-SPEC.md` for compression syntax.

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
   # Test in your AI assistant
   ```

4. **Commit with conventional commits**
   ```bash
   git commit -m "feat(commands): add your-command across all runtimes"
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
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation only
- `refactor` — Code change that neither fixes a bug nor adds a feature
- `test` — Adding or updating tests
- `chore` — Maintenance tasks
- `copy` — UX copy / public-facing strings

### Scopes
- `commands` — Slash commands
- `workflows` — Writing workflows
- `cli` — Installer/uninstaller
- `templates` — LaTeX templates
- `parity` — Multi-runtime parity
- `safety` — Install/uninstall safety

---

## Code Style

### JavaScript (bin/)
- Use `const`/`let`, never `var`
- Async/await for promises
- Descriptive variable names
- Error messages should be helpful

### Markdown Commands
- YAML frontmatter required (Claude, OpenCode)
- TOML frontmatter required (Gemini)
- Use `<objective>`, `<context>`, `<process>` blocks
- Keep instructions clear and unambiguous
- Reference shared files with runtime-appropriate paths

---

## Questions?

- Open a [Discussion](https://github.com/akougkas/wtf-p/discussions) for questions
- Check existing [Issues](https://github.com/akougkas/wtf-p/issues) before reporting
- Tag issues with appropriate labels

Thank you for contributing to WTF-P!
