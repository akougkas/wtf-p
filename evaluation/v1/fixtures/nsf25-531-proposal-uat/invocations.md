# Exact Clio invocation sequence

This is a hands-on user acceptance sequence, not an academic-paper baseline or a submission workflow. Complete `author-brief.md` and `source-receipt.md` first. Paste each fenced block as one Clio input so the newlines and literal title quotes are part of the command payload. Replace only angle-bracket placeholders; use the stable section ID returned by `create-outline`.

## 1. Initialize

```text
/wtfp:new-paper Initialize an NSF 25-531 CICI proposal project.
Canonical document_type: grant-proposal.
Selected track: <AUTHOR-SELECTED-TRACK>.
Working title: "CICI:<AUTHOR-SELECTED-TRACK>:<AUTHOR-WORKING-TITLE>".
Treat materials/nsf25-531-solicitation.html as authoritative solicitation evidence, materials/nsf-cici-program-page.html as current program-status evidence, and materials/nsf-pappg-landing.html only as the policy landing page to recheck at submission time.
Treat source-receipt.md as provenance and author-brief.md as author-controlled project evidence and decisions, never as independent proof.
Do not browse, use network tools, invent team or institutional facts, choose unresolved author decisions, create citations, infer partner commitments, or claim submission readiness.
Keep every UNKNOWN as an explicit deferred decision or checkpoint.
Preview and independently schema-validate the five initial .planning v1 records, then wait at the initialization approval gate before writing.
Do not initialize, stage, commit, branch, merge, push, tag, publish, or otherwise operate Git.
```

## 2. Map official and author evidence

```text
/wtfp:map-project Map only this authorized project root without following escaping symlinks.
Record the three captured official pages with exact URLs, actual retrieval times, local paths, and SHA-256 values from source-receipt.md.
Keep call evidence, author-supplied project evidence, and author-only decisions as three distinct authority classes.
Treat every unsupported proposal statement as provisional and do not use the network.
Schema-validate every source, evidence, and state record before writing and report exact mutations.
```

## 3. Create the proposal outline

```text
/wtfp:create-outline Create a Project Description outline for <AUTHOR-SELECTED-TRACK> under NSF 25-531.
Map every program-wide requirement, applicable track-specific requirement, Intellectual Merit, Broader Impacts, and all seven solicitation-specific review dimensions to a section or explicit compliance checkpoint.
Represent separate-document dependencies such as the data-management plan, budget, personnel list, and collaboration letters without fabricating their contents.
Do not resolve UNKNOWN author facts or choices.
Show the complete outline diff and validation findings, then wait at confirm_outline.
```

## 4. Plan one bounded section

```text
/wtfp:plan-section <RETURNED-STABLE-SECTION-ID> Plan only this section.
Trace every proposed claim to captured call evidence or verified author-supplied project evidence.
Mark missing technical support, personnel facts, commitments, citations, and author choices as blockers.
Require a distinct plan-checker pass over claim coverage, dependencies, citations, file scope, call requirements, and decision fidelity.
Preview the plan and validation, then wait at confirm_plan.
```

## 5. Draft from the approved plan

```text
/wtfp:write-section <RETURNED-STABLE-SECTION-ID> Draft only from the approved plan and verified evidence.
Do not invent preliminary results, partners, institutional capabilities, metrics, citations, eligibility, or compliance claims.
Preserve locked, deferred, and discretionary author decisions exactly and stop at any blocking judgment.
Write only the declared proposal artifact and report exact mutations and validation results.
```

## 6. Review without editing

```text
/wtfp:review-section <RETURNED-STABLE-SECTION-ID> Review this section without editing it.
Check evidence fidelity, unsupported claims, selected-track fit, program-wide and track-specific requirement coverage, Intellectual Merit, Broader Impacts, all seven CICI review dimensions, citation integrity, and author-decision fidelity.
Write review findings and read-only validation only; route disputed or blocking findings to a checkpoint.
```

## 7. Pause durably

```text
/wtfp:pause-writing Pause after the reviewed section.
Create and schema-validate a durable Markdown handoff and machine-readable checkpoint naming completed work, blockers, current revisions, pending author decisions, and the exact next safe action.
Set portable state to paused without operating Git.
```

Quit Clio completely and start a fresh Clio process in the same project before continuing.

## 8. Resume from durable state

```text
/wtfp:resume-writing Resume only from portable .planning records, the active checkpoint, and the linked handoff.
Do not rely on previous conversational memory.
Report completed work, blockers, stale assumptions, unresolved decisions, current revisions, and the exact resume action before making any mutation.
```

## 9. Verify progress

```text
/wtfp:progress Report current proposal progress, requirement coverage, validation state, and unresolved checkpoints without editing proposal prose.
Distinguish completed, blocked, deferred, and merely suggested work, and do not claim submission readiness.
```
