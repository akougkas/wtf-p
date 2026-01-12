# Writing Tools Configuration

Template for `.planning/sources/tools.md` — configuration for writing tools and environments.

**Purpose:** Document the tools, formats, and technical setup for this writing project.

---

## File Template

```markdown
# Writing Tools

**Project:** [Paper/Grant title]
**Created:** [date]

## Output Format

**Primary format:** [LaTeX / Markdown / Word]
**Template:** [Venue template name/link]
**Citation manager:** [Zotero / Mendeley / BibTeX / None]

## File Locations

**Manuscript:**
- Main document: `paper/[filename].md` or `paper/[filename].tex`
- Sections (if split): `paper/sections/`
- References: `paper/references.bib`

**Figures:**
- Location: `paper/figures/`
- Format: [PNG / PDF / SVG]
- Naming: `fig-[N]-[description].[ext]`

**Tables:**
- Location: [Inline / `paper/tables/`]
- Format: [LaTeX / Markdown]

**Supplementary:**
- Location: `paper/supplementary/`

## Build/Compile

**For LaTeX:**
```bash
# Compile command
pdflatex paper.tex
bibtex paper
pdflatex paper.tex
pdflatex paper.tex

# Or with latexmk
latexmk -pdf paper.tex
```

**For Markdown:**
```bash
# Convert to PDF (via Pandoc)
pandoc paper.md -o paper.pdf --citeproc --bibliography=references.bib

# Convert to Word
pandoc paper.md -o paper.docx --citeproc --bibliography=references.bib
```

## Citation Format

**Style:** [APA 7 / Chicago / IEEE / ACM]
**CSL file:** [path to .csl if using Pandoc]

**In-text format:**
- Markdown: `[@smith2023]` or `@smith2023`
- LaTeX: `\cite{smith2023}` or `\citep{smith2023}`

**Reference format:**
```bibtex
@article{smith2023,
  author = {Smith, John and Jones, Jane},
  title = {Title of the Paper},
  journal = {Journal Name},
  year = {2023},
  volume = {10},
  number = {2},
  pages = {100-120},
  doi = {10.1234/example}
}
```

## Word Count

**Command for Markdown:**
```bash
# Excluding code blocks and front matter
pandoc paper.md -t plain | wc -w
```

**Command for LaTeX:**
```bash
# Using texcount
texcount paper.tex

# Or detex + wc
detex paper.tex | wc -w
```

## Verification Commands

**Check citations:**
```bash
# Find uncited references
grep -h "^@" references.bib | sed 's/@.*{//' | sed 's/,//' | while read key; do
  grep -q "$key" paper.tex || echo "Uncited: $key"
done

# Find missing references
grep -oh '\\cite{[^}]*}' paper.tex | sed 's/\\cite{//; s/}//' | tr ',' '\n' | while read key; do
  grep -q "^@.*{$key," references.bib || echo "Missing: $key"
done
```

**Grammar/style check:**
- [Tool: Grammarly / LanguageTool / Vale]
- [Configuration if applicable]

## Collaboration

**Version control:** [Git / None]
**Sharing:** [Overleaf / Google Docs / Email]
**Backup:** [Location/method]

## Special Requirements

[Any venue-specific technical requirements]

---

*Tools configuration for: [Paper title]*
*Update when tools change*
```

<guidelines>

**When to create:**
- At project initialization
- After selecting venue and format

**Key sections:**
- Output format and template
- File organization
- Build commands
- Citation format
- Word count methods
- Verification commands

**Format-specific notes:**

**LaTeX projects:**
- Include full compile sequence
- Note any required packages
- Document custom commands/macros

**Markdown projects:**
- Include Pandoc command with all options
- Note CSL file for citation style
- Document any extensions used

**Collaboration:**
- Note version control setup
- Document sharing method
- Include backup strategy
</guidelines>
