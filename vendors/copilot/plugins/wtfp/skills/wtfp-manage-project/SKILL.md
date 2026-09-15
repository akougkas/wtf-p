---
name: wtfp-manage-project
description: This skill coordinates the durable state of a research-writing project. It activates when an agent needs to report progress, pause or resume work, save or restore a checkpoint, edit project settings, capture or review todos, choose the next workflow, or perform the WTF-P progress, pause-writing, resume-writing, checkpoint, settings, add-todo, or check-todos actions.
---

# Manage a WTF-P Project

Keep project state honest, resumable, and useful for routing the next academic action.

## Select the action

- Use `progress` to reconcile artifacts and recommend the next step.
- Use `pause-writing` or `resume-writing` to create and consume a session handoff.
- Use `checkpoint` to save, list, or restore named snapshots.
- Use `settings` to inspect and edit project policy.
- Use `add-todo` or `check-todos` to capture and triage non-blocking work.

Read [references/actions.md](references/actions.md) for the selected action before mutating project state.

## Apply the state contract

1. Treat schema-valid v1 records and verified authored artifacts as the source of truth. Reconcile `project://state` with `project://structure/outline`, section records, linked plans, summaries, reviews, handoffs, manuscript artifacts, source/evidence records, validations, and checkpoints before reporting progress.
2. Keep durable state factual and concise: position, completed work, decisions, blockers, pending work, word counts, and exact next action.
3. Preserve Markdown handoffs, validation records, and human-action checkpoints after every decision that must survive a new session.
4. Show a proposed settings diff and validate its schema before writing it.
5. Require explicit confirmation before restoring a snapshot or taking any destructive or version-control action.
6. Do not contact a package registry, external service, or version-control remote merely to display local progress.
7. Update multiple state artifacts only after their primary operation succeeds; avoid advertising work as complete prematurely.
8. Report what changed, what remains pending, and the safest next action.

## Keep operations reversible

- Save snapshot metadata and verify it can be read before declaring a checkpoint successful.
- Never discard an active handoff until the author has actually resumed or explicitly closed it.
- Resolve, waive, or expire completed checkpoints without deleting their audit history.
- Reject unknown configuration keys under the closed v1 schema; do not silently carry legacy settings into the portable record.
- Keep all paths relative to the project. Never embed client home directories or machine-specific state.
- Treat VCS operations as separate actions, never implicit project bookkeeping. A checkpoint restore remains an explicit gated state effect.

If project state is inconsistent, present the discrepancy and a repair proposal before routing onward.
