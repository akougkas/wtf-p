<overview>
Git integration for WTF-P framework.
</overview>

<core_principle>

**Commit outcomes, not process.**

The git log should read like a changelog of what was written, not a diary of planning activity.
</core_principle>

<commit_points>

| Event                   | Commit? | Why                                              |
| ----------------------- | ------- | ------------------------------------------------ |
| PROJECT + OUTLINE created | YES   | Paper initialization                             |
| PLAN.md created         | NO      | Intermediate - commit with plan completion       |
| RESEARCH.md created     | NO      | Intermediate                                     |
| CONTEXT.md created      | NO      | Intermediate                                     |
| **Writing task completed** | YES  | Atomic unit of work (1 commit per task)         |
| **Plan completed**      | YES     | Metadata commit (SUMMARY + STATE + ROADMAP)     |
| Handoff created         | YES     | WIP state preserved                              |

</commit_points>

<git_check>

```bash
[ -d .git ] && echo "GIT_EXISTS" || echo "NO_GIT"
```

If NO_GIT: Run `git init` silently. WTF-P projects always get their own repo.
</git_check>

<commit_formats>

<format name="initialization">
## Paper Initialization (project + outline together)

```
docs: initialize [paper-title] ([N] sections)

[One-liner thesis from PROJECT.md]

Sections:
1. [section-name]: [goal]
2. [section-name]: [goal]
3. [section-name]: [goal]
```

What to commit:

```bash
git add .planning/
git commit
```

</format>

<format name="task-completion">
## Task Completion (During Plan Execution)

Each writing task gets its own commit immediately after completion.

```
{type}({section}-{plan}): {task-name}

- [Key content 1]
- [Key content 2]
- [Key content 3]
```

**Commit types:**
- `write` - New content written
- `revise` - Content revised/improved
- `cite` - Citations added
- `polish` - Prose refined
- `docs` - Metadata updates

**Examples:**

```bash
# Standard writing task
git add paper/introduction.md
git commit -m "write(01-01): draft introduction opening

- Establishes research gap (~200 words)
- Cites Smith2023 and Jones2022
- Transitions to thesis statement
"

# Revision task
git add paper/methods.md
git commit -m "revise(02-01): strengthen methods clarity

- Added participant demographics
- Clarified procedure timeline
- Added missing protocol details
"

# Citation task
git add paper/discussion.md .planning/sources/literature.md
git commit -m "cite(04-01): add supporting citations

- Added Chen2024 for alternative interpretation
- Updated literature index
"
```

</format>

<format name="plan-completion">
## Plan Completion (After All Tasks Done)

After all tasks committed, one final metadata commit captures plan completion.

```
docs({section}-{plan}): complete [section-name] plan

Tasks completed: [N]/[N]
Words written: [X]
- [Task 1 name]
- [Task 2 name]
- [Task 3 name]

SUMMARY: .planning/sections/XX-name/{section}-{plan}-SUMMARY.md
```

What to commit:

```bash
git add .planning/sections/XX-name/{section}-{plan}-PLAN.md
git add .planning/sections/XX-name/{section}-{plan}-SUMMARY.md
git add .planning/STATE.md
git add .planning/ROADMAP.md
git commit
```

**Note:** Paper content NOT included - already committed per-task.

</format>

<format name="handoff">
## Handoff (WIP)

```
wip: [section-name] paused at task [X]/[Y]

Current: [task name]
[If blocked:] Blocked: [reason]
```

What to commit:

```bash
git add .planning/
git commit
```

</format>
</commit_formats>

<example_log>

**Per-task commits for academic writing:**
```
# Section 04 - Discussion
1a2b3c docs(04-01): complete discussion plan
4d5e6f write(04-01): draft implications and future work
7g8h9i write(04-01): draft interpretation of findings
0j1k2l write(04-01): draft summary of results

# Section 03 - Results
3m4n5o docs(03-01): complete results plan
6p7q8r write(03-01): draft supporting analyses
9s0t1u write(03-01): draft main findings

# Section 02 - Methods
5y6z7a docs(02-01): complete methods plan
8b9c0d write(02-01): draft analysis approach
1e2f3g write(02-01): draft procedures
4h5i6j write(02-01): draft participants

# Section 01 - Introduction
7k8l9m docs(01-01): complete introduction plan
0n1o2p write(01-01): draft thesis and roadmap
3q4r5s write(01-01): draft research gap
6t7u8v write(01-01): draft opening hook

# Initialization
9w0x1y docs: initialize research-paper (6 sections)
```

Each plan produces 3-5 commits (tasks + metadata). Clear, granular, recoverable.

</example_log>

<anti_patterns>

**Still don't commit (intermediate artifacts):**
- PLAN.md creation (commit with plan completion)
- RESEARCH.md (intermediate)
- CONTEXT.md (intermediate)
- Minor planning tweaks
- "Fixed typo in outline"

**Do commit (outcomes):**
- Each writing task completion (write/revise/cite/polish)
- Plan completion metadata (docs)
- Paper initialization (docs)

**Key principle:** Commit written content and shipped outcomes, not planning process.

</anti_patterns>

<commit_strategy_rationale>

## Why Per-Task Commits?

**Context engineering for AI:**
- Git history becomes primary context source for future Claude sessions
- `git log --grep="{section}-{plan}"` shows all work for a plan
- `git diff <hash>^..<hash>` shows exact changes per task
- Less reliance on parsing SUMMARY.md = more context for actual writing

**Failure recovery:**
- Task 1 committed ✅, Task 2 failed ❌
- Claude in next session: sees task 1 complete, can retry task 2
- Can `git reset --hard` to last successful task

**Revision tracking:**
- Clear record of when each part was written
- Easy to see evolution of arguments
- Each commit is independently revertable

**Observability:**
- Solo writer + Claude workflow benefits from granular attribution
- Atomic commits are git best practice
- Writing evolution is clear

</commit_strategy_rationale>

<branching_strategies>

## Branching Strategies

Controlled by `git.branching_strategy` in `.planning/config.json`. Three strategies available.

### Strategy: "none" (default)

**When to use:** Solo writing, simple papers, no parallel section work.

**Behavior:** All commits go to the current branch. No branch creation, no merging.

**Branch lifecycle:** None. Work happens wherever `git branch` points.

**Merge behavior:** N/A.

This is the simplest option. Good for most academic writing workflows where one person writes sequentially.

### Strategy: "section"

**When to use:** Papers with independent sections that benefit from parallel work, or when you want clean per-section history.

**Behavior:** Each section gets its own branch created from the current branch when `plan-section` starts.

**Branch name:** From `git.section_branch_template` (default: `wtfp/section-{section}-{slug}`).
- `{section}` = section number (e.g., `01`, `02`)
- `{slug}` = slugified section name (e.g., `introduction`, `related-work`)
- Example: `wtfp/section-02-related-work`

**Branch lifecycle:**
1. `plan-section` creates branch: `git checkout -b wtfp/section-{section}-{slug}`
2. All writing tasks for that section commit to the section branch
3. `review-section` runs on the section branch
4. After review passes, branch is merged back to the base branch
5. Branch is deleted after successful merge

**Merge behavior:**
- If `git.squash_on_merge` is `false`: merge commit preserves per-task history
- If `git.squash_on_merge` is `true`: squash merge collapses all section commits into one

**Parallel work:** Multiple section branches can exist simultaneously. Different sections can be planned and written in parallel (when `parallelization.enabled` is `true`).

### Strategy: "submission"

**When to use:** Papers with clear submission deadlines (conference deadlines, journal revisions), or when you want milestone-based history.

**Behavior:** Milestone branches created by `submit-milestone` for each submission target.

**Branch name:** From `git.submission_branch_template` (default: `wtfp/{milestone}-{slug}`).
- `{milestone}` = milestone name (e.g., `draft-1`, `camera-ready`, `revision-2`)
- `{slug}` = slugified paper title (e.g., `distributed-consensus`)
- Example: `wtfp/camera-ready-distributed-consensus`

**Branch lifecycle:**
1. `submit-milestone` creates branch from current state
2. Final polishing and formatting commits go to the milestone branch
3. Submission checklist verification runs on the branch
4. Branch is tagged on completion: `wtfp/submitted/{milestone}-{date}`
5. Branch is merged back to the base branch

**Merge behavior:**
- If `git.squash_on_merge` is `false`: merge commit preserves milestone history
- If `git.squash_on_merge` is `true`: squash merge collapses milestone into one commit

**Tags:** Each completed milestone is tagged for easy reference:
```
wtfp/submitted/draft-1-2024-03-15
wtfp/submitted/camera-ready-2024-06-01
```

### Squash on Merge

Controlled by `git.squash_on_merge` (default: `false`).

**When `false` (default):** Per-task commit history is preserved on merge. The full writing evolution is visible in `git log`. Recommended for most workflows — granular history aids future Claude sessions and revision tracking.

**When `true`:** All commits from a section/milestone branch are squashed into a single commit on merge. Produces a cleaner `git log` but loses per-task granularity. Use when the final state matters more than the writing process.

</branching_strategies>
