---
name: wtfp-plan-section
description: This skill plans and safely reshapes manuscript sections. It activates when an agent needs to discuss a section, expose assumptions, make a writing or revision plan, insert a newly discovered section, remove an unstarted section, or perform the WTF-P discuss-section, list-assumptions, plan-section, plan-revision, insert-section, or remove-section actions.
---

# Plan a WTF-P Section

Translate the manuscript argument and the author's intent into an executable, verifiable section plan.

## Select the action

- Use `discuss-section` to capture the author's intended reader experience and boundaries.
- Use `list-assumptions` to preview the current interpretation without writing files.
- Use `plan-section` to create an evidence-backed writing plan.
- Use `plan-revision` to convert review findings into targeted fixes.
- Use `insert-section` or `remove-section` to change outline structure deliberately.

Read [references/actions.md](references/actions.md) for the selected action before changing project state.

## Apply the planning contract

1. Resolve the section against `project://structure/outline` and `project://sections/{section}`; reject ambiguity instead of guessing.
2. Load `project://manifest`, `project://state`, `project://decisions`, the outline, prior section summaries, `project://sections/{section}/context`, and `project://sections/{section}/research` when they exist.
3. Treat context as author guidance, research as synthesis, source records as identity/provenance, evidence records as claim support, and outline claim IDs as obligations. Preserve those distinctions through planning and checking.
4. Honor `project://config` gates and its destructive-change safety policy.
5. Give every plan a concrete objective, declared dependencies, target files, ordered tasks, checkpoints, verification steps, success criteria, and expected outputs.
6. Check the plan goal-backward: completing its tasks must be sufficient to satisfy the section goal and assigned claims.
7. Iterate on checkable defects; escalate unresolved judgment calls to the author.
8. Report the plan path, verification state, open decisions, and next executable action.

## Preserve outline integrity

- Keep stable section IDs, outline order, state references, dependencies, artifact links, and word totals synchronized.
- Preview every structural edit before applying it.
- Remove only a section proven to be unstarted and empty of authored plans, summaries, reviews, and manuscript content.
- Back up affected planning files before a multi-file rename or removal.
- Never initialize, commit, branch, merge, delete, or renumber implicitly. Structural deletion requires the action's explicit user gate; VCS work belongs to a separate declared action.

If the evidence needed for a plan is missing, create a precise research handoff instead of filling the plan with unsupported claims.
