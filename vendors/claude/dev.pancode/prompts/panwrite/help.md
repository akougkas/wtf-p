---
description: "Render the stable PanWrite action reference from the canonical catalog."
display-only: true
---

```text
PanWrite 1.0.0 on PanCode: evidence-grounded academic writing

Start here
  /panwrite:new-paper [input]
  /panwrite:map-project [input]
  /panwrite:create-outline [input]
  /panwrite:advance [input]   or let the desk run the steps below until a decision is yours
  /panwrite:discuss-section <section>
  /panwrite:plan-section <section>
  /panwrite:write-section <section>
  /panwrite:review-section <section>
  /panwrite:progress [input]
  /panwrite:pause-writing [input]
  /panwrite:resume-writing [input]

Start a project (skill panwrite-start-project)
  /panwrite:create-outline [input]
      Build the section structure, argument map, dependencies, and word budgets.
  /panwrite:map-project [input]
      Index existing drafts, data, figures, and references into portable project state.
  /panwrite:new-paper [input]
      Interview the researcher and initialize a portable PanWrite project.

Research the literature (skill panwrite-research-literature)
  /panwrite:analyze-bib [input]
      Analyze a bibliography and map its evidence to the paper's sections and claims.
  /panwrite:check-refs [input]
      Audit citation integrity and emit a validated corrected-bibliography candidate without mutating source records or manuscript inputs.
  /panwrite:research-gap <section>
      Synthesize literature, domain conventions, open gaps, and defensible positioning for a section.

Plan a section (skill panwrite-plan-section)
  /panwrite:discuss-section <section>
      Capture the researcher's intended purpose, essential content, voice, and boundaries before planning.
  /panwrite:insert-section [input]
      Insert a newly discovered section while preserving established numbering and dependencies.
  /panwrite:list-assumptions <section>
      Preview the intended approach and assumptions for a section without changing project files.
  /panwrite:plan-revision <section>
      Turn prioritized review findings into a bounded, testable revision plan.
  /panwrite:plan-section <section>
      Create and independently check a detailed writing plan for one section.
  /panwrite:remove-section <section>
      Remove an unwritten future section and repair numbering and dependencies.  [unavailable on pancode: filesystem.delete]

Write a section (skill panwrite-write-section)
  /panwrite:execute-outline [input]
      Draft independent section waves in parallel and verify cross-section coherence.
  /panwrite:quick [input]
      Apply a small, bounded writing fix with minimal planning overhead and state tracking.
  /panwrite:write-section <section>
      Execute an approved section plan, update state, and optionally verify argument coverage.

Review the manuscript (skill panwrite-review-manuscript)
  /panwrite:audit-milestone [input]
      Run readiness checks across section completion, arguments, length, citations, and reviews.
  /panwrite:plan-milestone-gaps [input]
      Convert milestone audit failures into targeted, verifiable fix plans.
  /panwrite:polish-prose <target>
      Improve clarity, flow, precision, and academic voice without changing supported claims.
  /panwrite:review-section <section>
      Review a drafted section for evidence, citations, coherence, requirements, and reader expectations.
  /panwrite:verify-work <section>
      Test a drafted section against each plan requirement and record evidence one check at a time.

Manage the project (skill panwrite-manage-project)
  /panwrite:add-todo [input]
      Capture a bounded note or task without disrupting the active research flow.
  /panwrite:advance [input]
      Run the next writing actions automatically and stop when only the author can decide.
  /panwrite:check-todos [input]
      Review pending tasks and explicitly act on, defer, complete, or dismiss each one.
  /panwrite:checkpoint [input]
      Save, list, or restore an exact portable paper-state checkpoint.
  /panwrite:pause-writing [input]
      Record an exact context handoff so another session can resume without reconstructing intent.
  /panwrite:progress [input]
      Summarize writing progress, surface blockers, and recommend the next compatible action.
  /panwrite:resume-writing [input]
      Restore the latest portable handoff and route the researcher to the next safe action.
  /panwrite:settings [input]
      View and update portable project settings after presenting the exact proposed diff.

Deliver the research (skill panwrite-deliver-research)
  /panwrite:create-poster [input]
      Transform the paper's argument, methods, and findings into a concise academic poster.
  /panwrite:create-slides [input]
      Transform the paper's argument, evidence, and findings into an audience-appropriate presentation.
  /panwrite:export-latex [input]
      Export the manuscript and bibliography to portable LaTeX source with declared formatting.
  /panwrite:submit-milestone <milestone>
      Archive a completed draft or submission round with its reproducible project state and statistics.

Product operations
  /panwrite:contribute [input]
      Guide a bounded PanWrite contribution from branch creation through a reviewable change request.  [unavailable on pancode: external.issue, vcs.branch, vcs.commit]
  /panwrite:help [input]
      Render the stable PanWrite action reference from the canonical catalog.
  /panwrite:report-bug [input]
      Collect a reproducible bug report and publish it only after explicit user approval.  [unavailable on pancode: external.issue]
  /panwrite:request-feature [input]
      Shape a concrete feature request and publish it only after explicit user approval.  [unavailable on pancode: external.issue]
  /panwrite:update [input]
      Check for a newer compatible package or plugin release and install it only after approval.  [unavailable on pancode: package.update]

Fleets (pancode fleet run <fleet> --var section=<section>; explicit fleet primitives, not auto-routed)
  panwrite-draft-review
      Draft one approved section and independently review its argument and evidence.
  panwrite-plan-section
      Create and independently check one evidence-grounded section plan.

Each action reads .planning/ records and paper/ artifacts, asks before any gated write, and never runs Git or publishes.
An unavailable action fails closed with PANWRITE_ACTION_UNAVAILABLE and returns a manual handoff instead.
```

<!-- Generated by PanWrite adapter compiler v5 from protocol/actions/help; do not edit. -->
