---
schema: wtfp.workflow/v1
action: create-poster
source: wtfp.protocol
---

# Create a research poster

@protocol://project/README.md
@protocol://skills/wtfp-deliver-research/SKILL.md
@protocol://skills/wtfp-deliver-research/references/actions.md

## Record contract

Read: `project://manifest`, `project://structure/outline`, `project://paper/{artifact}`.
Produce: `project://deliverables/poster/{artifact}` (create).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Confirm audience, dimensions, format, and emphasis, following the confirmation list in `protocol://templates/poster.md`.
1a. Start from the panel structure and word budgets in `protocol://templates/poster.md`. Delete any panel the manuscript does not support rather than filling it.
2. Select only claims supported by manuscript and evidence, then design a legible poster with source attribution.
3. Write the poster source and its assets under the declared deliverable URI without changing project records except through a separately declared action. This action produces poster source, not a rendered image or PDF: WTF-P declares no rendering effect and runs no renderer. If the author asks for a rendered artifact, return a labeled handoff naming the exact command they can run in their own toolchain.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
