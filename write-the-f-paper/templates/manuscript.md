# Manuscript Template

Template for `paper/[title].md` or `paper/[title].tex` — the actual paper output.

**Purpose:** Structure for the manuscript file where writing lives.

---

## Markdown Template

```markdown
---
title: "[Paper Title]"
author:
  - name: "[Author 1]"
    affiliation: "[Institution]"
    email: "[email]"
  - name: "[Author 2]"
    affiliation: "[Institution]"
date: "[YYYY-MM-DD]"
abstract: |
  [Abstract text - 150-300 words]
keywords:
  - keyword1
  - keyword2
  - keyword3
bibliography: references.bib
csl: [path-to-csl-file.csl]
---

# Introduction

[Introduction text...]

# Related Work

[Literature review text...]

# Methods

## Participants

[Participants text...]

## Procedure

[Procedure text...]

## Analysis

[Analysis text...]

# Results

## Finding 1

[Finding 1 text...]

## Finding 2

[Finding 2 text...]

# Discussion

## Summary of Findings

[Summary text...]

## Implications

[Implications text...]

## Limitations

[Limitations text...]

## Future Work

[Future work text...]

# Conclusion

[Conclusion text...]

# References

<!-- References will be generated automatically from citations -->
```

## LaTeX Template

```latex
\documentclass[sigchi]{acmart}

\usepackage{booktabs}

\title{[Paper Title]}

\author{[Author 1]}
\affiliation{
  \institution{[Institution]}
  \city{[City]}
  \country{[Country]}
}
\email{[email]}

\author{[Author 2]}
\affiliation{
  \institution{[Institution]}
}
\email{[email]}

\begin{abstract}
[Abstract text - 150-300 words]
\end{abstract}

\keywords{keyword1, keyword2, keyword3}

\begin{document}

\maketitle

\section{Introduction}

[Introduction text...]

\section{Related Work}

[Literature review text...]

\section{Methods}

\subsection{Participants}

[Participants text...]

\subsection{Procedure}

[Procedure text...]

\subsection{Analysis}

[Analysis text...]

\section{Results}

\subsection{Finding 1}

[Finding 1 text...]

\subsection{Finding 2}

[Finding 2 text...]

\section{Discussion}

\subsection{Summary of Findings}

[Summary text...]

\subsection{Implications}

[Implications text...]

\subsection{Limitations}

[Limitations text...]

\subsection{Future Work}

[Future work text...]

\section{Conclusion}

[Conclusion text...]

\bibliographystyle{ACM-Reference-Format}
\bibliography{references}

\end{document}
```

<guidelines>

**File organization:**

```
paper/
├── manuscript.md          # Main document (Markdown)
│   OR
├── paper.tex             # Main document (LaTeX)
├── references.bib        # Bibliography
├── figures/              # Figure files
│   ├── fig-1-*.png
│   └── fig-2-*.png
└── supplementary/        # Supplementary materials
    └── appendix.md
```

**Section markers:**
- Use clear headers for navigation
- Keep heading levels consistent
- Follow venue structure requirements

**Citation integration:**
- Markdown: Use `[@key]` or `@key`
- LaTeX: Use `\cite{key}`
- Keep bibliography updated

**Figure/table placement:**
- Reference in text before appearance
- Use descriptive captions
- Include alt text for accessibility

**Writing workflow:**
1. Write in sections (not all at once)
2. Use PLAN.md for each section
3. Commit after each section complete
4. Update word count in STATE.md

**Quality markers:**
- [ ] All sections present
- [ ] Word count within limits
- [ ] All figures/tables referenced
- [ ] All citations resolved
- [ ] Formatting matches template
</guidelines>

<split_manuscript>
For longer documents, split by section:

```
paper/
├── manuscript.md          # Includes all sections
│   OR
├── sections/
│   ├── 00-frontmatter.md  # Title, abstract, keywords
│   ├── 01-introduction.md
│   ├── 02-literature.md
│   ├── 03-methods.md
│   ├── 04-results.md
│   ├── 05-discussion.md
│   ├── 06-conclusion.md
│   └── 99-references.md
└── build.sh              # Combines into single file
```

Combine script:
```bash
#!/bin/bash
cat sections/*.md > manuscript.md
```
</split_manuscript>
