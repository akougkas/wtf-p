---
schema: wtfp.workflow/v1
action: audit-milestone
source: wtfp.protocol
---

# Audit a milestone

@protocol://project/README.md
@protocol://skills/wtfp-review-manuscript/SKILL.md
@protocol://skills/wtfp-review-manuscript/references/actions.md

## Record contract

Read: `project://manifest`, `project://config`, `project://state`, `project://decisions`, `project://structure/outline`, `project://sections/{section}`, `project://sources/{source}`, `project://evidence/{evidence}`, `project://validations/{validation}`, `project://paper/{artifact}`.
Produce: `project://validations/{validation}` (create).

Resolve every logical URI through the host adapter. Portable v1 JSON records are the source of truth: schema-validate before a write, preserve stable IDs, update revision and timestamps where required, and replace records atomically. Never pass a literal logical URI to a shell command or infer record state from a legacy Markdown control file.

Manuscript prose and supporting context, research, plan, review, summary, handoff, and deliverable artifacts retain their authored format (normally Markdown). Link them from the relevant v1 record; do not convert manuscript prose into project-state JSON.

## Procedure

1. Snapshot the record revisions and manuscript artifacts being audited.
2. Check requirements, outline coverage, section status, validations, claim evidence, citation integrity, and manuscript completeness.
3. Emit one validation whose checks, limitations, issues, and next actions are evidence-backed; do not repair during the audit.

## Bundled tool execution

The declared `tool.execute` effect authorises exactly one command, run from the package root the host resolves for this bundle:

```bash
node protocol://tools/wtfp-tool.js [--offline] <command> [arguments]
```

Run it with `list` first to read the declared commands, their arguments, their bounds, and the effects each one applies; `protocol://tools/README.md` carries the same table. A command whose effects include `network.*` performs outbound requests. Until network use has been approved for this run, pass `--offline` (or set `WTFP_TOOL_OFFLINE=1`), which makes the dispatcher refuse those commands instead of relying on prose restraint. Never execute another module in this package, never pass a logical `project://` or `wtfp://` URI as a shell argument, and treat every returned record as candidate evidence until it is verified and written to a source or evidence record.

## Safety and completion

Do not initialize a repository or run branch, stage, commit, merge, push, or publish operations. If requested, return a clearly labeled optional handoff for a separately authorized action.

Report the logical resources read, created, updated, archived, or deleted; the gates crossed; validation results; unresolved checkpoints; and the safest next action. Never claim a mutation that was not verified.
