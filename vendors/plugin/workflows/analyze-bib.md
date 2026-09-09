---
schema: wtfp.workflow/v1
action: analyze-bib
source: wtfp.protocol
---

# Analyze the bibliography

@protocol://project/README.md
@protocol://skills/wtfp-research-literature/SKILL.md
@protocol://skills/wtfp-research-literature/references/actions.md

## Record contract

Read: `project://manifest`, `project://structure/outline`, `project://sections/{section}`, `project://sources/{source}`, `project://evidence/{evidence}`, `project://materials/{artifact}`, `project://paper/{artifact}`.
Produce: `project://sources/{source}` (create), `project://sources/{source}` (update), `project://evidence/{evidence}` (create), `project://evidence/{evidence}` (update), `project://validations/{validation}` (create).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Index source records and cited manuscript locations locally; distinguish verified, provisional, unavailable, and retracted sources.
2. Before external citation-metric enrichment, disclose the provider and bounded query set and obtain explicit approval. If network use is unavailable or not approved, continue with the local corpus and label external metrics unavailable.
3. Identify clusters, foundational works, gaps, duplicate identities, and claim coverage. Treat external metrics as time-varying observations, not deterministic facts or a substitute for source inspection.
4. Write source/evidence changes separately and record the analysis as a read-only validation.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. Do not invoke a network-capable bibliography tool through a filesystem-only permission path. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
