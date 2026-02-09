---
name: wtfp:submit-milestone
description: Archive a completed draft or submission version
argument-hint: "[version]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
  - Glob
  - Grep
---

<objective>
Archive a completed draft or submission round.

Archives full state to `.planning/milestones/{version}/`.
Creates MILESTONES.md entry with stats.
Evolves PROJECT.md (shipped claims to Validated).
Creates annotated git tag.
Resets ROADMAP.md for revision round.
</objective>

<process>

<step name="validate_environment">
**Step 1: Validate Environment and Gather Stats**

```bash
[ ! -f .planning/STATE.md ] && echo "ERROR: No project state found" && exit 1
[ ! -f .planning/ROADMAP.md ] && echo "ERROR: No ROADMAP.md found" && exit 1
[ ! -f .planning/PROJECT.md ] && echo "ERROR: No PROJECT.md found" && exit 1
```

Read version from argument:
```bash
VERSION=$ARGUMENTS  # e.g., "draft-1", "camera-ready", "revision-2"
[ -z "$VERSION" ] && echo "ERROR: Version required. Usage: /wtfp:submit-milestone draft-1" && exit 1
```

**Gather statistics from ROADMAP.md and section summaries:**
- Total sections (count section entries in ROADMAP)
- Sections complete (count checked `[x]` entries)
- Read all SUMMARY.md files in `.planning/sections/*/`:
  - Total words (sum from each summary)
  - Citations used
  - Figures
  - Tables

If incomplete sections exist:
```
WARNING: Not all sections are complete.

Sections remaining:
- [Section N]: [status]

Continue anyway?
```

Use AskUserQuestion:
- header: "Proceed?"
- question: "Archive milestone with incomplete sections?"
- options:
  - "Yes, archive anyway" -- Create milestone as-is
  - "No, finish first" -- Return to writing

</step>

<step name="read_git_config">
**Step 2: Read Git Config**

```bash
BRANCH_STRATEGY=$(cat .planning/config.json 2>/dev/null | grep -o '"branching_strategy"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "none")
SQUASH=$(cat .planning/config.json 2>/dev/null | grep -o '"squash_on_merge"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "false")
COMMIT_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
SUBMISSION_TEMPLATE=$(cat .planning/config.json 2>/dev/null | grep -o '"submission_branch_template"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "wtfp/{milestone}-{slug}")
```

Store these for use in subsequent steps.

</step>

<step name="archive">
**Step 3: Archive to .planning/milestones/ (MLN-01)**

```bash
ARCHIVE_DIR=".planning/milestones/${VERSION}"
mkdir -p "$ARCHIVE_DIR"
```

Archive these files:
```bash
# Core planning files
cp .planning/ROADMAP.md "$ARCHIVE_DIR/${VERSION}-ROADMAP.md"
cp .planning/STATE.md "$ARCHIVE_DIR/${VERSION}-STATE.md"

# Argument map if exists
cp .planning/structure/argument-map.md "$ARCHIVE_DIR/${VERSION}-argument-map.md" 2>/dev/null || true

# All section summaries
for summary in .planning/sections/*/*-SUMMARY.md; do
  [ -f "$summary" ] && cp "$summary" "$ARCHIVE_DIR/"
done
```

Verify archive created:
```bash
ls -la "$ARCHIVE_DIR/"
```

</step>

<step name="milestones_entry">
**Step 4: Create/Update MILESTONES.md (MLN-02)**

Read existing MILESTONES.md if present, otherwise create header.

Prepend new entry to `.planning/MILESTONES.md`:

```markdown
# Milestones

## {version} - {description}

**Date:** {YYYY-MM-DD}
**Status:** {Submitted / Draft / Ready for Review}

### Stats
- Sections: {M}/{N} complete
- Words: {X} / {Y} target ({variance}%)
- Citations: {N}
- Figures: {N}
- Tables: {N}

### Sections Included
| Section | Words | Status |
|---------|-------|--------|
| {name} | {X} | {status} |
| ... | | |

### Key Decisions
{Extract from section SUMMARY.md files - concatenate "Decisions Made" sections}

### Known Issues
{Any deferred issues from section reviews - extract from SUMMARY.md "Next Steps" sections}

### Git Reference
- Tag: `{version}`
- Commit: {hash}
- Archive: `.planning/milestones/{version}/`

---

{Previous milestones below...}
```

</step>

<step name="project_evolution">
**Step 5: Update PROJECT.md (MLN-03)**

Read PROJECT.md. Make these updates:

**Requirements section:**
- Identify items marked as complete/shipped in the "Active" or "In Progress" column
- Move those items to "Validated" status

**What This Is section:**
- Append: "v{version}: {brief milestone description}"

**Key Decisions section:**
- Add entry: "{date} | Milestone {version} archived | {N} sections, {X} words"

Write updated PROJECT.md.

</step>

<step name="git_tag">
**Step 6: Git Operations (MLN-04)**

**If BRANCH_STRATEGY = "submission":**

1. Create submission branch:
```bash
# Resolve template variables
PAPER_SLUG=$(cat .planning/PROJECT.md | grep -m1 "^#" | sed 's/^# //' | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')
BRANCH_NAME=$(echo "$SUBMISSION_TEMPLATE" | sed "s/{milestone}/${VERSION}/g" | sed "s/{slug}/${PAPER_SLUG}/g")

git checkout -b "$BRANCH_NAME"
```

2. Commit archive and MILESTONES.md:
```bash
git add .planning/milestones/
git add .planning/MILESTONES.md
git add .planning/PROJECT.md

# Respect commit_docs for planning files
if [ "$COMMIT_DOCS" = "true" ]; then
  git add .planning/STATE.md .planning/ROADMAP.md
fi

git commit -m "$(cat <<'EOF'
milestone({version}): archive submission

Sections: {M}/{N}
Words: {X}
Date: {date}

Archive: .planning/milestones/{version}/
EOF
)"
```

3. Create annotated tag:
```bash
git tag -a "${VERSION}" -m "$(cat <<EOF
Milestone: ${VERSION}

Sections completed:
$(list sections from stats)

Words: ${WORD_COUNT}
Date: ${DATE}
Archive: .planning/milestones/${VERSION}/
EOF
)"
```

4. Merge back to base branch:
```bash
BASE_BRANCH=$(git rev-parse --abbrev-ref HEAD@{1} 2>/dev/null || echo "main")
git checkout "$BASE_BRANCH"

if [ "$SQUASH" = "true" ]; then
  git merge --squash "$BRANCH_NAME"
  git commit -m "milestone(${VERSION}): squash merge submission branch"
else
  git merge --no-ff "$BRANCH_NAME" -m "milestone(${VERSION}): merge submission branch"
fi

git branch -d "$BRANCH_NAME"
```

**If BRANCH_STRATEGY != "submission":**

1. Commit archive and MILESTONES.md (respect commit_docs):
```bash
git add .planning/milestones/
git add .planning/MILESTONES.md
git add .planning/PROJECT.md

if [ "$COMMIT_DOCS" = "true" ]; then
  git add .planning/STATE.md .planning/ROADMAP.md
fi

git commit -m "$(cat <<'EOF'
milestone({version}): archive submission

Sections: {M}/{N}
Words: {X}
Date: {date}

Archive: .planning/milestones/{version}/
EOF
)"
```

2. Create annotated tag:
```bash
git tag -a "${VERSION}" -m "$(cat <<EOF
Milestone: ${VERSION}

Sections completed:
$(list sections from stats)

Words: ${WORD_COUNT}
Date: ${DATE}
Archive: .planning/milestones/${VERSION}/
EOF
)"
```

</step>

<step name="reset_roadmap">
**Step 7: Reset ROADMAP.md (MLN-05)**

After archival, prepare for revision round:

1. Add "Previous Milestone" note at top of ROADMAP.md:
```markdown
> **Previous:** {version} archived on {date}
```

2. Reset all section checkboxes (change `[x]` to `[ ]`):
```bash
sed -i 's/\[x\]/[ ]/g' .planning/ROADMAP.md
```

3. Keep section structure intact for revision round.

4. Update STATE.md:
- Reset position to "Revision round after {version}"
- Note milestone archived
- Clear any in-progress tracking

</step>

<step name="completion_banner">
**Step 8: Completion Banner**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WTF-P ► MILESTONE ARCHIVED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Version: {version}
Archive: .planning/milestones/{version}/
Tag: {version}

Stats:
  Sections: {M}/{N}
  Words: {X}
  Citations: {N}

Git:
  Commit: {hash}
  Tag: {version}

───────────────────────────────────────────

## Next Up

**Wait for reviews:**
  Run `/wtfp:progress` when feedback arrives

**Start revisions:**
  Run `/wtfp:progress` to see what needs revision

**Audit before next submission:**
  Run `/wtfp:audit-milestone` to check readiness

───────────────────────────────────────────
```

</step>

</process>

<success_criteria>
- [ ] Archive directory created at `.planning/milestones/{version}/`
- [ ] Archive contains: ROADMAP, argument-map, STATE, section summaries
- [ ] MILESTONES.md entry created with version, date, stats table
- [ ] PROJECT.md updated (shipped items to Validated, What This Is appended)
- [ ] Git tag created with annotated message listing sections completed
- [ ] ROADMAP.md reset for revision round (checkboxes unchecked)
- [ ] Branching strategy respected (submission branch if configured)
- [ ] commit_docs guard respected for planning file commits
</success_criteria>
