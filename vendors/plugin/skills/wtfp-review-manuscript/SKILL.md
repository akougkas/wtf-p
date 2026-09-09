---
name: wtfp-review-manuscript
description: This skill reviews, verifies, audits, and polishes academic manuscripts. It activates when an agent needs to review a section, test work against a plan, refine academic voice, audit submission readiness, create milestone gap plans, or perform the WTF-P review-section, verify-work, polish-prose, audit-milestone, or plan-milestone-gaps actions.
---

# Review a WTF-P Manuscript

Turn critique into traceable evidence, decisions, and executable revisions.

## Select the action

- Use `review-section` for citation, logic, and requirements review under a chosen reviewer stance.
- Use `verify-work` for resumable, one-criterion-at-a-time author acceptance.
- Use `polish-prose` for meaning-preserving voice and clarity edits.
- Use `audit-milestone` for whole-manuscript readiness checks.
- Use `plan-milestone-gaps` to convert audit findings into section-scoped fix plans.

Read [references/actions.md](references/actions.md) for the selected action before reviewing or editing.

## Apply the review contract

1. Resolve the exact `project://paper/{artifact}`, section record, and authored planning artifacts in scope.
2. Read requirements from `project://manifest`, claim structure from `project://structure/outline`, the relevant plan, `project://decisions`, source/evidence records, and manuscript text.
3. Distinguish mechanical checks, logical judgment, rubric compliance, and author preference. Do not collapse them into one score.
4. Cite file locations or passages for every actionable finding. State the failed criterion, evidence, severity, and a bounded recommendation.
5. Never treat a stylistic preference as a factual error or silently change meaning while polishing.
6. Preserve acceptance-test progress in a `project://validations/{validation}` record after each response so verification can resume without replay.
7. Re-run the check affected by a fix and screen for regressions elsewhere.
8. Report passes, gaps, skipped checks, limitations, created artifacts, and the next remediation or delivery action.

## Preserve review integrity

- Do not invent citation validation, evidence coverage, review completion, or compilation success.
- Use the validation schema's `passed`, `warning`, `failed`, and `not-applicable` check statuses distinctly; every non-applicable check needs a reason.
- Keep reviewer findings separate from author acceptance results.
- Require approval before applying prose edits or changing the issue scope.
- Group milestone gaps by section and compatible output path; route review-only gaps to review instead of generating fake writing tasks.
- A milestone is `passed` only when every required check passes; optional `not-applicable` checks remain visible.

If source evidence or evaluation criteria are unavailable, record the check as blocked or skipped rather than guessing.
