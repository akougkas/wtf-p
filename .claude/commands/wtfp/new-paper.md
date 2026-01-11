---
name: wtfp:new-paper
description: Initialize a new paper with deep context gathering and PROJECT.md
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<objective>

Initialize a new academic paper through comprehensive context gathering.

This is the most leveraged moment in any writing project. Deep questioning here means better structure, better arguments, better outcomes.

Creates `.planning/` with PROJECT.md, config.json, and structure documents.

</objective>

<execution_context>

@./.claude/write-the-f-paper/references/principles.md
@./.claude/write-the-f-paper/references/questioning.md
@./.claude/write-the-f-paper/templates/project.md
@./.claude/write-the-f-paper/templates/config.json

</execution_context>

<process>

<step name="setup">

**MANDATORY FIRST STEP — Execute these checks before ANY user interaction:**

1. **Abort if project exists:**
   ```bash
   [ -f .planning/PROJECT.md ] && echo "ERROR: Paper already initialized. Use /wtfp:progress" && exit 1
   ```

2. **Initialize git repo in THIS directory** (required for version tracking):
   ```bash
   if [ -d .git ] || [ -f .git ]; then
       echo "Git repo exists in current directory"
   else
       git init
       echo "Initialized new git repo"
   fi
   ```

3. **Detect existing writing materials (brownfield detection):**
   ```bash
   # Check for existing writing files
   WRITING_FILES=$(find . -name "*.tex" -o -name "*.md" -o -name "*.bib" -o -name "*.docx" 2>/dev/null | grep -v node_modules | grep -v .git | grep -v .planning | head -20)
   HAS_SOURCES=$([ -d sources ] || [ -d references ] || [ -d literature ] && echo "yes")
   HAS_SOURCE_MAP=$([ -d .planning/sources ] && echo "yes")
   ```

   **You MUST run all bash commands above using the Bash tool before proceeding.**

</step>

<step name="brownfield_offer">

**If existing writing detected and .planning/sources/ doesn't exist:**

Check the results from setup step:
- If `WRITING_FILES` is non-empty OR `HAS_SOURCES` is "yes"
- AND `HAS_SOURCE_MAP` is NOT "yes"

Use AskUserQuestion:
- header: "Existing Material"
- question: "I detected existing writing materials. Would you like to map them first?"
- options:
  - "Map sources first" — Run /wtfp:map-project to index existing literature/drafts (Recommended)
  - "Skip mapping" — Proceed with paper initialization

**If "Map sources first":**
```
Run `/wtfp:map-project` first, then return to `/wtfp:new-paper`
```
Exit command.

**If "Skip mapping":** Continue to type step.

**If no existing materials detected OR sources already mapped:** Continue to type step.

</step>

<step name="type">

**Ask paper type:**

Use AskUserQuestion:
- header: "Paper Type"
- question: "What type of document are you writing?"
- options:
  - "Research paper" — Journal article or conference paper
  - "Grant proposal" — Funding application (NSF, NIH, etc.)
  - "Thesis chapter" — Dissertation or thesis section
  - "Other" — Essay, report, or something else

Store the document type for later structure decisions.

</step>

<step name="question">

**1. Open (FREEFORM — do NOT use AskUserQuestion):**

Ask inline: "What is the core argument or contribution of your paper?"

Wait for their freeform response. This gives you the context needed to ask intelligent follow-up questions.

**2. Follow the thread (NOW use AskUserQuestion):**

Based on their response, use AskUserQuestion with options that probe what they mentioned:
- header: "[Topic they mentioned]"
- question: "You mentioned [X] — how would you describe the key insight?"
- options: 2-3 interpretations + "Something else"

**3. Target venue:**

Use AskUserQuestion:
- header: "Venue"
- question: "What's the target venue or format?"
- options: Common venues for their field + "Undecided" + "Let me specify"

**4. Sharpen the core:**

Use AskUserQuestion:
- header: "Core"
- question: "If reviewers remember one thing, what should it be?"
- options: Key aspects they've mentioned + "The methodology" + "The findings" + "Something else"

**5. Find boundaries:**

Use AskUserQuestion:
- header: "Scope"
- question: "What's explicitly NOT in this paper?"
- options: Tempting tangents + "Nothing specific" + "Let me list them"

**6. Constraints:**

Use AskUserQuestion:
- header: "Constraints"
- question: "Any hard constraints?"
- options:
  - "Page/word limit" — Strict length requirements
  - "Deadline" — Submission deadline pressure
  - "Data limitations" — Working with specific dataset
  - "None" — Flexible constraints
  - "Multiple constraints" — Let me explain

**7. Decision gate:**

Use AskUserQuestion:
- header: "Ready?"
- question: "Ready to create PROJECT.md, or explore more?"
- options (ALL THREE REQUIRED):
  - "Create PROJECT.md" — Finalize and continue
  - "Ask more questions" — I'll dig deeper
  - "Let me add context" — You have more to share

If "Ask more questions" → return to step 2.
If "Let me add context" → receive input via their response → return to step 2.
Loop until "Create PROJECT.md" selected.

</step>

<step name="project">

Synthesize all context into `.planning/PROJECT.md`:

```markdown
# [Paper Title]

## What This Is
[Paper type, target venue, approximate length]

## Core Argument
[The thesis in 1-2 sentences — the one thing reviewers should remember]

## Requirements

### Must Have
- [ ] [Required element 1]
- [ ] [Required element 2]
- [ ] [Required element 3]

### Should Have
- [ ] [Desired element 1]
- [ ] [Desired element 2]

### Out of Scope
- [Exclusion 1] — [why]
- [Exclusion 2] — [why]

## Target Audience
[Who reads this, what they care about, what they already know]

## Constraints
- [Constraint 1]: [detail]
- [Constraint 2]: [detail]

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| [Choice from questioning] | [Why] | — Pending |

---
*Last updated: [date] after initialization*
```

Do not compress. Capture everything gathered.

</step>

<step name="structure">

**Create structure documents:**

Create `.planning/structure/` directory.

**argument-map.md:**
```markdown
# Argument Map

## Central Thesis
[From core argument above]

## Supporting Claims
### Claim 1: [Statement]
- Evidence: [What will support this]
- Strength: [to be determined]

### Claim 2: [Statement]
- Evidence: [What will support this]
- Strength: [to be determined]

## Logical Flow
[How claims build to thesis]

## Gaps
- [Claims needing evidence]
- [Logical leaps to address]
```

**outline.md:**
```markdown
# Document Outline

## Template: [IMRaD / Grant-NSF / Custom]

## Sections
[Based on paper type, create appropriate section skeleton]

## Word Budget
| Section | Target | Current |
|---------|--------|---------|
| Abstract | [X] | 0 |
| Introduction | [X] | 0 |
| [...] | | |
| Total | [X] | 0 |
```

**narrative-arc.md:**
```markdown
# Narrative Arc

## Act 1: The Problem
- World state: [Current understanding]
- Tension: [What's missing]
- Stakes: [Why it matters]

## Act 2: The Journey
- Approach: [How you tackled it]
- Discovery: [What you found]

## Act 3: The Resolution
- Insight: [What it means]
- Transformation: [How understanding changes]

## Reader Experience
- Hook: [Why they keep reading]
- Payoff: [The "aha" moment]
```

</step>

<step name="mode">

Ask workflow mode preference:

Use AskUserQuestion:

- header: "Mode"
- question: "How do you want to work?"
- options:
  - "Interactive" — Confirm at each step
  - "Flow" — Auto-approve, minimize interruptions

</step>

<step name="depth">

Ask planning depth preference:

Use AskUserQuestion:

- header: "Depth"
- question: "How thorough should section planning be?"
- options:
  - "Quick" — Draft fast, iterate later (minimal planning)
  - "Standard" — Balanced planning and writing
  - "Comprehensive" — Thorough outlines before writing

Create `.planning/config.json`:
```json
{
  "mode": "[chosen mode]",
  "depth": "[chosen depth]",
  "document_type": "[paper/grant/thesis/other]",
  "gates": {
    "confirm_project": true,
    "confirm_sections": true,
    "confirm_outline": true,
    "confirm_plan": true,
    "review_before_submit": true
  }
}
```

</step>

<step name="commit">

```bash
git add .planning/PROJECT.md .planning/config.json .planning/structure/
git commit -m "$(cat <<'EOF'
docs: initialize [paper-title]

[One-liner core argument]

Creates PROJECT.md with paper vision and structure documents.
EOF
)"
```

</step>

<step name="done">

Present completion with next steps:

```
Paper initialized:

- Project: .planning/PROJECT.md
- Config: .planning/config.json (mode: [chosen mode])
- Structure: .planning/structure/ (argument-map, outline, narrative-arc)
[If .planning/sources/ exists:] - Sources: .planning/sources/ (literature, data, prior-drafts)

---

## ▶ Next Up

**[Paper Title]** — create section outline

`/wtfp:create-outline`

<sub>`/clear` first → fresh context window</sub>

---
```

</step>

</process>

<output>

- `.planning/PROJECT.md`
- `.planning/config.json`
- `.planning/structure/argument-map.md`
- `.planning/structure/outline.md`
- `.planning/structure/narrative-arc.md`

</output>

<success_criteria>

- [ ] Deep questioning completed (not rushed)
- [ ] PROJECT.md captures paper vision with core argument
- [ ] Structure documents created (argument-map, outline, narrative-arc)
- [ ] config.json has workflow mode
- [ ] All committed to git

</success_criteria>
