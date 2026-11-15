---
schema: wtfp.workflow/v1
action: advance
source: wtfp.protocol
---

# Advance to the next author gate

@protocol://project/README.md
@protocol://skills/wtfp-manage-project/SKILL.md
@protocol://skills/wtfp-manage-project/references/actions.md

## Record contract

Read: `project://manifest`, `project://config`, `project://state`, `project://decisions`, `project://structure/outline`, `project://sections/{section}`, `project://sections/{section}/plans/{plan}`, `project://sections/{section}/reviews/{review}`, `project://sections/{section}/summary`, `project://sections/{section}/handoff`, `project://sources/{source}`, `project://evidence/{evidence}`, `project://checkpoints/{checkpoint}`, `project://validations/{validation}`, `project://paper/{artifact}`, `project://sections/{section}/context`, `project://sections/{section}/research`, `project://validations/*`.
Produce: `project://structure/outline` (update), `project://sections/{section}` (create), `project://decisions` (update), `project://state` (update), `project://validations/{validation}` (create), `project://sections/{section}/context` (create), `project://sections/{section}/context` (update), `project://checkpoints/{checkpoint}` (create), `project://sections/{section}` (update), `project://sources/{source}` (create), `project://sources/{source}` (update), `project://evidence/{evidence}` (create), `project://evidence/{evidence}` (update), `project://sections/{section}/research` (create), `project://sections/{section}/research` (update), `project://sections/{section}/plans/{plan}` (create), `project://paper/{artifact}` (create), `project://paper/{artifact}` (update), `project://manifest` (update), `project://sections/{section}/summary` (create), `project://sections/{section}/summary` (update), `project://sections/{section}/reviews/{review}` (create), `project://archives/{archive}/{artifact}` (archive).

This contract is the union of the actions the driver may select: `create-outline`, `discuss-section`, `research-gap`, `plan-section`, `write-section`, `review-section`, `audit-milestone`, and `submit-milestone`. Each step may write only what its own action contract declares, for the section the driver names; the union is never a grant to one step.

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Require initialized portable project state. This action continues a project; it never starts one or maps new materials. Without project state, report `new-paper` or `map-project` as the next action and stop.
2. Ask the host's driver for the next step. The driver, not the agent, selects the action and section from portable project state by the same ladder `progress` follows, and authorizes only that action's declared outputs for that step. Never choose, skip, reorder, or repeat an action yourself.
3. When the driver names a pending gate, put it to the author through the host's gate interaction and wait for the answer. Then ask the driver again. An answer that keeps the gate pending or declines it, or a gate that cannot be put to an author, ends the run with the gate still open.
4. When the driver names an action, run that action exactly as its own workflow defines, with the section the driver named as its input, including every author gate and every interview that workflow raises. Then ask the driver again.
5. Stop when the driver reports a stop: a gate still waiting on the author, a step that would repeat with no change in project state, an action this host cannot run, the step limit, or a delivered project. A step's failure or blocked result also ends the run.

Author decisions keep their meaning inside a run. Ask each author-owned question as a question only the author may answer; a timeout, a recommended option, silence, or this invocation's text is never the author's answer. The run is automatic between gates, never autonomous across them.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report each step the driver selected and its outcome, the gates the author answered, the driver's stop reason, the logical resources created or updated, unresolved checkpoints, and the next action the author faces. Never claim a mutation that was not verified.
