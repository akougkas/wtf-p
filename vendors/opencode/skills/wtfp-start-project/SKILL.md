---
name: wtfp-start-project
description: This skill initializes and structures academic writing projects. It activates when an agent needs to start a paper, map existing drafts, data, or references, create an outline, build an argument map, allocate word budgets, or perform the WTF-P new-paper, map-project, or create-outline actions.
---

# Start a WTF-P Project

Build a durable research-writing workspace before drafting prose.

## Select the action

- Use `new-paper` to interview the author and initialize a new project.
- Use `map-project` to inventory an existing or brownfield project.
- Use `create-outline` to turn the project thesis into an executable document structure.

Read [references/actions.md](references/actions.md) for the selected action before changing files.

## Apply the project contract

1. Locate the project root selected by the host. Treat that contained root as the write boundary and resolve portable resources only through the adapter.
2. Inspect existing material before proposing creation or replacement. Never overwrite a project protocol file silently.
3. Read and schema-validate `project://config` when present. Honor its approval gates, workflow checks, safety settings, parallelism, and output format.
4. Preserve the distinction between evidence, author decisions, and agent inference. Mark unknowns instead of inventing project facts.
5. Ask for approval before replacing established structure or performing another declared consequential effect. Project initialization never initializes or mutates version control.
6. Write planning artifacts atomically when possible, then read them back and cross-check their internal references.
7. Finish with created or changed paths, unresolved questions, and the next recommended academic action.

## Maintain structural invariants

- Keep the core argument in `project://manifest` consistent with the thesis, section roles, and claim assignments in `project://structure/outline`.
- Give every outline and section-record entry a unique stable identifier, goal, word budget, status, and dependency wave.
- Make section word budgets add up to the manuscript target or disclose the variance.
- Use relative project paths only. Do not embed host installation paths, client commands, model names, or tool-specific syntax.
- Never treat a generated citation, claim, venue rule, or project statistic as verified without a source.

If a requested action requires a capability the host does not provide, stop at the safe boundary and return an actionable handoff rather than weakening the procedure.
