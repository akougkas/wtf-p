---
name: wtfp-write-section
description: This skill drafts and revises manuscript sections from approved plans and evidence. It activates when an agent needs to write one section, execute an outline in dependency waves, make a small targeted prose or citation change, or perform the WTF-P write-section, execute-outline, or quick actions.
---

# Write a WTF-P Section

Produce traceable academic prose without losing the plan, evidence, or author voice.

## Select the action

- Use `write-section` to execute one writing or revision plan.
- Use `execute-outline` to execute independent plans in dependency-ordered waves.
- Use `quick` for a narrow, low-risk change that does not justify a full plan.

Read [references/actions.md](references/actions.md) for the selected action before editing manuscript content.

## Apply the writing contract

1. Resolve exact input and output paths inside the project root. Reject a missing, ambiguous, or already completed plan unless re-execution is explicitly approved.
2. Read the full plan plus `project://manifest`, `project://state`, `project://decisions`, `project://structure/outline`, the section record, linked context and research, source/evidence records, and only the prior prose needed for continuity.
3. Honor the author's decisions and the plan's scope. Record deviations and pause for any deviation that changes the thesis, evidence, structure, or promised result.
4. Support claims only with verified project evidence. Never fabricate citations, quotations, results, measurements, methods, or limitations.
5. Preserve citation keys, technical notation, figure and table references, and declared terminology.
6. Verify the result backward against the plan and assigned claims. Classify remaining gaps as fix now, accepted debt, revision work, or human review.
7. Update the Markdown section summary, synchronize the manuscript URI in `project://manifest`, and update the section record and `project://state` only after the manuscript write succeeds and validation is recorded.
8. Report changed files, word-count delta, evidence gaps, verification state, and the next review action.

## Bound execution

- Obtain approval at configured writing gates and before replacing existing output.
- Parallelize only plans that declare no dependency or overlapping output. Finish and validate each wave before starting the next.
- Keep one writer responsible for each output file within a wave; serialize shared-file updates.
- Return version-control work only as a non-executed handoff for a separate action that declares and gates the effect.
- Keep `quick` changes atomic, narrowly scoped, and independently checked. Escalate to a formal plan when the task changes structure, multiple claims, or multiple sections.

If a plan is not executable, return the exact defect and route it back to section planning rather than improvising around it.
