---
name: wtfp-deliver-research
description: This skill packages completed research for publication and presentation. It activates when an agent needs to export a manuscript to LaTeX, archive a draft or submission milestone, create research slides, design an academic poster, or perform the WTF-P export-latex, submit-milestone, create-slides, or create-poster actions.
---

# Deliver WTF-P Research

Create reviewable delivery artifacts without overstating manuscript readiness.

## Select the action

- Use `export-latex` to convert ordered manuscript sections and bibliography data into a typesetting project.
- Use `submit-milestone` to archive an immutable named research snapshot.
- Use `create-slides` to turn the argument into a timed presentation.
- Use `create-poster` to turn the argument into a visual, non-linear research summary.

Read [references/actions.md](references/actions.md) for the selected action before generating or archiving output.

## Apply the delivery contract

1. Resolve `project://manifest`, `project://structure/outline`, section records, manuscript artifacts, verified source/evidence records, validations, figures, tables, and known gaps.
2. Ask for missing delivery constraints such as template, format, duration, dimensions, audience, authorship, and milestone label.
3. Preserve claims, citations, equations, labels, captions, accessibility text, and asset provenance during transformation.
4. Generate into explicit project-owned output paths. Never overwrite source manuscript files as part of a format conversion.
5. Validate every generated artifact with the strongest available local checker and distinguish generation success from compilation or rendering success.
6. Preview incomplete-section warnings, archive contents, record transitions, and every externally visible effect before applying them. Delivery actions do not execute version-control operations.
7. Keep a manifest of outputs and unresolved manual steps.
8. Report exact artifact paths, validation results, known limitations, and the next review or submission step.

## Preserve delivery integrity

- Do not derive complete bibliography records from prose summaries; use verified bibliography data or flag missing records.
- Do not claim a PDF, slide deck, poster, tag, or archive exists until its output is verified.
- Make milestone labels path-safe and unique. Refuse traversal and accidental overwrite.
- Archive before resetting active planning state, then verify the archive independently.
- Keep delivery generation deterministic where inputs and template versions are fixed.
- Treat publishing, uploading, remote pushes, commits, and tags as separate explicit effects requiring their own declared action and approval.

If a required renderer or template is unavailable, leave valid source output plus a precise local compilation handoff.
