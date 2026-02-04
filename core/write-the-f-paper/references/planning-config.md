# Planning Configuration Reference

Complete documentation of every key in `.planning/config.json`. This is the v0.5.0 schema — the single source of truth for all orchestrator and agent configuration.

Template location: `core/write-the-f-paper/templates/config.json`

## Top-Level Settings

| Key | Type | Default | Description | Read By |
|-----|------|---------|-------------|---------|
| `mode` | string | `"interactive"` | Execution mode. `"interactive"`: confirmations at gates. `"yolo"`: skip all non-safety gates. | All orchestrators |
| `depth` | string | `"standard"` | Planning depth. `"quick"`: fewer plans, faster. `"standard"`: balanced. `"thorough"`: max detail. | section-planner, plan-checker |
| `document_type` | string | `"paper"` | Document type. `"paper"`, `"thesis"`, `"proposal"`, `"report"`. Affects templates and defaults. | new-paper, plan-section |
| `output_format` | string | `"markdown"` | Output file format. `"markdown"` or `"latex"`. Determines how content files are written. | section-writer, prose-polisher |
| `model_profile` | string | `"balanced"` | Model selection profile. `"quality"`, `"balanced"`, `"budget"`. See agent-model-matrix.md. | All orchestrators (model resolution) |
| `venue_template` | string\|null | `null` | Venue-specific template name. `null` for generic. When set, loads venue constraints (word limits, formatting). | plan-section, write-section |

## Gates

Controls which confirmation prompts appear. When `true`, orchestrator pauses for user confirmation. When `false`, orchestrator proceeds automatically. Mode `"yolo"` overrides all non-safety gates to `false`.

| Key | Type | Default | Description | Read By |
|-----|------|---------|-------------|---------|
| `gates.confirm_outline` | bool | `true` | Confirm before finalizing outline structure. | create-outline, execute-outline |
| `gates.confirm_plan` | bool | `true` | Confirm before finalizing section plan. | plan-section |
| `gates.confirm_write` | bool | `true` | Confirm before executing writing plan. | write-section |
| `gates.confirm_review` | bool | `true` | Confirm before applying review suggestions. | review-section |
| `gates.execute_next_section` | bool | `true` | Confirm before auto-advancing to next section. | write-section (section chaining) |
| `gates.issues_review` | bool | `true` | Confirm before presenting issues for review. | review-section, check-refs |
| `gates.confirm_transition` | bool | `true` | Confirm before transitioning between writing phases. | write-section (phase transitions) |
| `gates.confirm_submission` | bool | `true` | Confirm before marking paper as submission-ready. | submit-milestone |

### When to Change

- **Solo iterating rapidly**: Set `mode: "yolo"` to skip all gates.
- **Specific gate annoying**: Set that one gate to `false`, keep others.
- **Submission safety**: Never set `confirm_submission` to `false` — it is the final human check.

## Writing

Controls how Claude assists with writing. Preserved from v0.4.0.

| Key | Type | Default | Description | Read By |
|-----|------|---------|-------------|---------|
| `writing.claude_mode` | string | `"co-author"` | Claude's writing role. `"co-author"`: Claude drafts prose. `"scaffold"`: Claude outlines, user writes. `"reviewer"`: User writes, Claude reviews. | section-writer, write-section |
| `writing.citation_style` | string | `"apa"` | Citation format. `"apa"`, `"ieee"`, `"chicago"`, `"mla"`, `"vancouver"`. | citation-formatter, section-writer |
| `writing.verify_on_complete` | bool | `true` | Run argument-verifier after each writing task completes. When `false`, skips verification. | write-section |

## Workflow

Controls which optional workflow steps run. Preserved from v0.4.0.

| Key | Type | Default | Description | Read By |
|-----|------|---------|-------------|---------|
| `workflow.research` | bool | `true` | Run research-synthesizer before planning. When `false`, skip literature search. | plan-section |
| `workflow.plan_check` | bool | `true` | Run plan-checker after plan creation. When `false`, skip quality validation. | plan-section |
| `workflow.verifier` | bool | `true` | Run argument-verifier after writing. When `false`, skip goal-backward verification. | write-section |

## Verification

Controls which verification checks run during review. Preserved from v0.4.0.

| Key | Type | Default | Description | Read By |
|-----|------|---------|-------------|---------|
| `verification.citation_check` | bool | `true` | Verify citations exist, are formatted correctly, and are cited in text. | check-refs, section-reviewer |
| `verification.coherence_check` | bool | `true` | Check cross-section coherence, argument flow, terminology consistency. | section-reviewer, coherence-checker |
| `verification.rubric_check` | bool | `true` | Evaluate against venue rubric (if venue_template set) or general quality rubric. | section-reviewer |

## Planning

Controls planning document behavior. New in v0.5.0.

| Key | Type | Default | Description | Read By |
|-----|------|---------|-------------|---------|
| `planning.commit_docs` | bool | `true` | Include planning docs (SUMMARY.md, STATE.md) in git commits. When `false`, planning docs are gitignored. | All orchestrators (commit step) |
| `planning.search_gitignored` | bool | `false` | Allow searching gitignored files for context. When `true`, agents can read files in .gitignore paths. | research-synthesizer, section-writer |

## Parallelization

Controls concurrent execution. Expanded in v0.5.0.

| Key | Type | Default | Description | Read By |
|-----|------|---------|-------------|---------|
| `parallelization.enabled` | bool | `false` | Master switch for parallel execution. When `false`, all work is sequential. | All orchestrators |
| `parallelization.plan_level` | bool | `true` | Allow parallel plan execution within a section (when `enabled` is `true`). | write-section |
| `parallelization.task_level` | bool | `false` | Allow parallel task execution within a plan (when `enabled` is `true`). Experimental. | section-writer |
| `parallelization.skip_checkpoints` | bool | `true` | Auto-approve checkpoints during parallel execution to avoid blocking. | section-writer |
| `parallelization.max_concurrent_agents` | int | `3` | Maximum number of concurrent subagents. | All orchestrators (parallel mode) |
| `parallelization.min_plans_for_parallel` | int | `2` | Minimum number of ready plans before parallel execution activates. | write-section |

## Safety

Controls safety confirmations that are never skipped by mode or gate overrides. Expanded in v0.5.0.

| Key | Type | Default | Description | Read By |
|-----|------|---------|-------------|---------|
| `safety.always_confirm_destructive` | bool | `true` | Always confirm before destructive operations (deleting sections, resetting progress). Never skipped by `mode: "yolo"`. | All orchestrators |
| `safety.always_confirm_external_services` | bool | `true` | Always confirm before calling external services (API calls, web searches). Never skipped by `mode: "yolo"`. | research-synthesizer, citation-retriever |
| `safety.backup_before_major_edits` | bool | `true` | Create backup commit before major edits (full section rewrites, structural changes). | write-section, review-section |

### Safety vs Gates

Gates are convenience confirmations — skip them to go faster. Safety flags protect against data loss and unintended side effects. `mode: "yolo"` overrides gates but never overrides safety flags.

## Git

Controls git integration behavior. New in v0.5.0. See git-integration.md for full branching strategy documentation.

| Key | Type | Default | Description | Read By |
|-----|------|---------|-------------|---------|
| `git.branching_strategy` | string | `"none"` | Branch strategy. `"none"`: current branch. `"section"`: branch per section. `"submission"`: branch per milestone. | All orchestrators (commit step) |
| `git.section_branch_template` | string | `"wtfp/section-{section}-{slug}"` | Branch name template for `"section"` strategy. `{section}` = section number, `{slug}` = slugified section name. | plan-section, write-section |
| `git.submission_branch_template` | string | `"wtfp/{milestone}-{slug}"` | Branch name template for `"submission"` strategy. `{milestone}` = milestone name, `{slug}` = slugified paper title. | submit-milestone |
| `git.squash_on_merge` | bool | `false` | Squash commits when merging section/submission branches back. When `true`, per-task history is lost on merge. | write-section, submit-milestone |

## Backward Compatibility

The following keys are preserved unchanged from v0.4.0:

- **`writing`** section: `claude_mode`, `citation_style`, `verify_on_complete` -- same keys, same defaults, same behavior.
- **`verification`** section: `citation_check`, `coherence_check`, `rubric_check` -- same keys, same defaults, same behavior.
- **`output_format`**: Same key, same default (`"markdown"`), same behavior.

The following keys were renamed or replaced in v0.5.0:

| v0.4.0 Key | v0.5.0 Key | Reason |
|------------|------------|--------|
| `gates.confirm_project` | Removed | Replaced by `gates.confirm_outline` |
| `gates.confirm_sections` | Removed | Replaced by `gates.confirm_plan` |
| `gates.confirm_roadmap` | Removed | No equivalent (roadmap is auto-generated) |
| `gates.write_next_plan` | `gates.execute_next_section` | Renamed for clarity |
| `parallelization.min_sections_for_parallel` | `parallelization.min_plans_for_parallel` | Renamed: plans not sections |
| `safety.backup_before_major_edits` | Kept (+ `always_confirm_external_services` added) | Backward compat |

Projects using v0.4.0 config files will work -- orchestrators default missing keys safely. The `new-paper` command generates the full v0.5.0 schema.
