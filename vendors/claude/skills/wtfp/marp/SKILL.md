---
name: wtfp-marp
description: Compile Markdown+CSS to HTML posters or PDF slides using Marp CLI
allowed-tools:
  - Bash
  - Read
  - Write
---

# Marp Compiler Skill

Use this skill to compile Markdown presentations or posters to HTML or PDF.

## Commands

### Compile to HTML (recommended for posters)
```bash
npx @marp-team/marp-cli input.md -o output.html
```

### Compile to PDF (recommended for slides)
```bash
npx @marp-team/marp-cli input.md -o output.pdf
```

### With custom theme
```bash
npx @marp-team/marp-cli input.md --theme theme.css -o output.pdf
```

## Marp Markdown Format

Marp uses extended Markdown. Slides are separated by `---`.

Example:
```markdown
---
marp: true
theme: default
---

# Slide 1
Content

---

# Slide 2
More content
```
