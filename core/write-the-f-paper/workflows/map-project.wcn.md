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

[step:check_existing p=1]
RUN: ls -la .planning/sources/ 2>/dev/null
IF exists → ```
IF doesnt_exist → Continue to create_structure.
[/step]

[step:create_structure]
RUN: mkdir -p .planning/sources
[/step]

[step:scan_materials]
[/step]

[step:analyze_literature]
RUN: cat references.bib 2>/dev/null | head -100
[/step]

[step:analyze_data]
[/step]

[step:analyze_drafts]
[/step]

[step:verify_output]
RUN: ls -la .planning/sources/
[/step]

[step:commit_source_map]
RUN: git add .planning/sources/*.md
[/step]

[step:offer_next]
[/step]

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