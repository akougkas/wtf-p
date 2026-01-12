<purpose>
Analyze existing source materials and prior work to produce structured documents
in .planning/sources/

For brownfield writing projects where materials already exist: prior drafts, notes,
data files, literature PDFs, etc.
</purpose>

<philosophy>
**Why map existing materials:**
- Avoid duplicating work already done
- Find usable prose from prior drafts
- Understand what sources are already available
- Identify gaps in existing materials
- Create actionable index for planning

**Document quality over brevity:**
Include enough detail to be useful during writing. A thorough literature.md
with organized sources is more valuable than a sparse list.

**Always include file paths:**
Documents are reference material for Claude when planning/writing. Vague descriptions
are not actionable. Always include actual file paths to source materials.
</philosophy>

<process>

<step name="check_existing" priority="first">
Check if .planning/sources/ already exists:

```bash
ls -la .planning/sources/ 2>/dev/null
```

**If exists:**

```
.planning/sources/ already exists with these documents:
[List files found]

What's next?
1. Refresh - Delete existing and remap sources
2. Update - Keep existing, only update specific documents
3. Skip - Use existing source map as-is
```

Wait for user response.

If "Refresh": Delete .planning/sources/, continue to create_structure
If "Update": Ask which documents to update, continue to analyze_sources (filtered)
If "Skip": Exit workflow

**If doesn't exist:**
Continue to create_structure.
</step>

<step name="create_structure">
Create .planning/sources/ directory:

```bash
mkdir -p .planning/sources
```

**Expected output files:**
- literature.md (bibliography and source index)
- data.md (figures, tables, statistics inventory)
- prior-drafts.md (existing written material)

Continue to scan_materials.
</step>

<step name="scan_materials">
Scan the project for existing materials.

**Look for these types of files:**

**1. Prior written content:**
```bash
# Look for draft documents
find . -name "*.md" -o -name "*.tex" -o -name "*.docx" -o -name "*.txt" 2>/dev/null | head -20
```

**2. Data and figures:**
```bash
# Look for data files
find . -name "*.csv" -o -name "*.xlsx" -o -name "*.json" -o -name "*.png" -o -name "*.pdf" 2>/dev/null | head -20
```

**3. Literature and references:**
```bash
# Look for bibliography and reference files
find . -name "*.bib" -o -name "*references*" -o -name "*bibliography*" 2>/dev/null
```

**4. Notes and planning:**
```bash
# Look for notes
find . -name "*notes*" -o -name "*outline*" -o -name "*plan*" 2>/dev/null | head -10
```

Present findings:
```
Source materials found:

Prior drafts: [N] files
- [file1.md]
- [file2.tex]

Data/Figures: [N] files
- [data.csv]
- [figure1.png]

Bibliography: [N] files
- [references.bib]

Notes: [N] files
- [notes.md]

Proceeding to analyze each category...
```
</step>

<step name="analyze_literature">
**Analyze bibliography and literature sources:**

If .bib file exists:
```bash
cat references.bib 2>/dev/null | head -100
```

Parse and organize:
- Extract all citations
- Group by theme/topic if possible
- Identify which are core vs background
- Note any gaps

**Create literature.md:**

```markdown
# Literature Index

## Source Files
- `references.bib` - [N] entries
- [Other bibliography files]

## Core References (cite in paper)

| Key | Citation | Relevance | Cite In |
|-----|----------|-----------|---------|
| smith2023 | Smith et al. (2023) Title... | foundational method | Methods |
| jones2022 | Jones (2022) Title... | contrasting view | Discussion |

## Background Reading (inform writing)

| Key | Citation | Notes |
|-----|----------|-------|
| [key] | [citation] | [how it informs] |

## By Theme

### [Theme 1]
- [source1]
- [source2]

### [Theme 2]
- [source3]

## To Find
- [ ] [Missing citation needed for claim X]
- [ ] [Gap in coverage of topic Y]

## Notes
[Any observations about the literature base]
```
</step>

<step name="analyze_data">
**Analyze data files and figures:**

For each data/figure file found:
- What does it contain?
- Is it ready to use?
- Where would it go in the document?

**Create data.md:**

```markdown
# Data & Evidence Inventory

## Source Files
[List all data files found]

## Figures

| ID | File | Description | Status | Placement |
|----|------|-------------|--------|-----------|
| fig1 | `figures/main_result.png` | Main result visualization | ready | Results |
| fig2 | `figures/method.png` | Method diagram | needs work | Methods |

## Tables

| ID | Source | Description | Status | Placement |
|----|--------|-------------|--------|-----------|
| tab1 | `data/results.csv` | Summary statistics | needs formatting | Results |

## Statistics

| Finding | Test | Result | Source File |
|---------|------|--------|-------------|
| [Main effect] | [ANOVA] | [F(2,45)=3.2, p<.05] | `analysis.R` |

## Raw Data
| File | Description | Status |
|------|-------------|--------|
| `data/raw.csv` | Participant responses | cleaned |

## Gaps
- [ ] [Missing figure for X]
- [ ] [Need to run analysis for Y]
```
</step>

<step name="analyze_drafts">
**Analyze prior written content:**

For each draft file found:
- Read first ~50 lines to understand content
- Assess quality and usability
- Identify which sections it maps to

**Create prior-drafts.md:**

```markdown
# Prior Drafts & Notes

## Source Files
[List all draft files found]

## Usable Material

| Source | Description | Quality | Target Section |
|--------|-------------|---------|----------------|
| `drafts/proposal.md` | Original proposal | Good intro | Introduction |
| `notes/methods.txt` | Method notes | Rough | Methods |
| `drafts/lit_review.md` | Literature review | Partial | Related Work |

## Key Passages to Incorporate

### From `drafts/proposal.md`
> "[Key passage that captures thesis well]"
Target: Introduction thesis statement

### From `notes/methods.txt`
> "[Description of procedure]"
Target: Methods - Procedure section

## Quality Assessment

| File | Prose Quality | Accuracy | Completeness |
|------|--------------|----------|--------------|
| `proposal.md` | Good | Current | Partial |
| `methods.txt` | Rough notes | Current | Complete |

## Gaps in Prior Work
- [ ] No prior draft of Discussion
- [ ] Results section needs writing from scratch
- [ ] Abstract not yet attempted

## Notes
[Observations about what can be reused vs needs rewriting]
```
</step>

<step name="verify_output">
Verify all documents created successfully:

```bash
ls -la .planning/sources/
wc -l .planning/sources/*.md
```

**Verification checklist:**
- All 3 documents exist
- No empty documents
- Materials properly indexed

Continue to commit_source_map.
</step>

<step name="commit_source_map">
Commit the source map:

```bash
git add .planning/sources/*.md
git commit -m "$(cat <<'EOF'
docs: map existing source materials

- literature.md - Bibliography and sources index
- data.md - Figures, tables, statistics inventory
- prior-drafts.md - Existing written content
EOF
)"
```

Continue to offer_next.
</step>

<step name="offer_next">
Present completion summary and next steps.

```
Source mapping complete.

Created .planning/sources/:
- literature.md ([N] sources indexed)
- data.md ([N] figures/tables inventoried)
- prior-drafts.md ([N] prior drafts analyzed)

**Reusable content found:**
- [Summary of what can be reused]

**Gaps identified:**
- [Summary of what's missing]

---

## Next Up

**Initialize project** — use source context for planning

`/wtfp:new-paper`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- Re-run mapping: `/wtfp:map-project`
- Review specific file: `cat .planning/sources/literature.md`
- Edit any document before proceeding

---
```

End workflow.
</step>

</process>

<success_criteria>
- .planning/sources/ directory created
- All source material types scanned
- literature.md created with bibliography index
- data.md created with figures/tables inventory
- prior-drafts.md created with usable content identified
- Gaps in materials identified
- Documents committed to git
- User offered clear next steps
</success_criteria>
