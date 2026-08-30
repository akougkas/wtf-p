# Scientist-led proposal workflow

This guide uses NSF 25-531, *Cybersecurity Innovation for Cyberinfrastructure (CICI)*, as a realistic WTF-P 0.6.0-rc.2 example. The workflow keeps the principal investigator in control of program fit, scientific claims, team commitments, budget, and final submission while the agent maintains traceable plans, evidence, reviews, and resumption state.

The walkthrough is a process-discipline test, not a claim that WTF-P produces better prose than an unassisted model. RC2 has no matched no-WTF-P control arm. It can establish properties such as decision fidelity, evidence provenance, schema-valid state, approval boundaries, reviewer separation, and durable resume; it cannot by design establish comparative writing quality from this run alone.

## 1. Supply the authoritative materials

Capture the official NSF 25-531 solicitation from the [NSF funding opportunity](https://www.nsf.gov/funding/opportunities/cici-cybersecurity-innovation-cyberinfrastructure/nsf25-531/solicitation) and save the actual page inside the proposal directory. Also record its retrieval time, original URL, and SHA-256 digest in a source receipt. A URL in a prompt is not evidence that the model fetched or read the solicitation.

Prepare a contained project such as:

```text
nsf25-531-clio-trust/
├── materials/
│   ├── nsf25-531-solicitation.html
│   ├── nsf-cici-program-page.html
│   ├── nsf-pappg-landing.html
│   ├── author-brief.md
│   ├── bios-and-facilities/
│   └── prior-work/
├── notes/
├── paper/
├── references/
└── source-receipt.md
```

Use the captured solicitation for call requirements, the captured CICI program page for current program-status evidence, and the PAPPG landing page only to identify policy that the institution must recheck for the actual submission date. A PDF or accessible text capture is also acceptable when its provenance is recorded; the important point is that the model reads a contained, inspectable artifact rather than assuming it visited the live URL. Keep network tools disabled during a bounded offline run.

In `materials/author-brief.md`, distinguish known facts from choices that still belong to the team. For this example:

- Preferred track: TCR (*Transition to Cyberinfrastructure Resilience*); consider IPAAI (*Integrity, Provenance, and Authenticity for Artificial Intelligence Ready Data*) only as an explicit fallback after checking the supplied solicitation.
- Working concept: **ClioTrust**, a reproducibility and provenance layer for agentic scientific workflows built around Clio Coder intellectual property.
- Scientific emphasis: science workflows, reproducibility, provenance, and inspectable agentic reasoning.
- Candidate contribution: capture the relationship among operator intent, model reasoning, delegated work, evidence, tool effects, and reproducible artifacts without claiming results that have not been measured.
- Author-reserved choices: any switch to the fallback track, project scope, partner roles, personnel effort, budget, milestones, deployment sites, and quantitative claims.
- Evidence boundary: only the saved solicitation and material under the project root. Missing support must remain an unknown or a placeholder, never a fabricated citation.

Add only real prior work, measurements, citations, collaborator statements, and institutional facts. Do not put secrets or export-controlled material into a model-accessible project unless the selected client and model are authorized for it.

## 2. Install RC2 and start the client

For Clio Coder 0.3.8:

```bash
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install clio
cd /path/to/nsf25-531-clio-trust
clio-coder --autonomy suggest
```

Run `/prompts` and verify that `/wtfp:new-paper` reports the WTF-P extension as its source. If a user-level prompt shadows it, stop and resolve that copy deliberately before treating the run as RC2 evidence.

The slash commands below also apply to Claude, Copilot CLI, OpenCode, Antigravity, and Gemini. In Codex, select the owning `$wtf-p:<skill>` and request the named action with the same exact argument payload. See [Getting started](GETTING_STARTED.md) for the client table and an isolated Clio profile recipe.

## 3. Initialize through an interview

Paste a concrete brief rather than asking the model to invent the project. Clio 0.3.8 preserves quotes, tabs, repeated spaces, and multiline `$ARGUMENTS`; the following is one invocation payload:

```text
/wtfp:new-paper NSF 25-531 CICI proposal.
Working title: "ClioTrust: Reproducible Provenance for Agentic Scientific Workflows."
Primary track: TCR. Treat IPAAI only as a fallback that I must approve after checking the supplied solicitation.
Core idea: build on Clio Coder intellectual property to make scientific agent workflows inspectable and reproducible, preserving operator intent, delegated reasoning, evidence provenance, tool effects, and artifact lineage.
Interview me before locking scope, team, evaluation, budget, timeline, deployment commitments, or claims.
Use only evidence under materials/, notes/, references/, and source-receipt.md. Treat materials/nsf25-531-solicitation.html as authoritative for program requirements, materials/nsf-cici-program-page.html as current program-status evidence, and materials/nsf-pappg-landing.html only as a policy landing page to recheck at submission time. Mark unknowns and never fabricate citations.
Treat source-receipt.md as provenance and materials/author-brief.md as author-controlled evidence and decisions, never as independent proof.
Do not browse, use network tools, scan outside the project root, invent team or institutional facts, infer partner commitments, claim submission readiness, or operate Git.
```

The agent should interview you with the client's native user-interaction tool. Answer what you know. Say “defer” where the team has not decided. Do not accept a model suggestion merely to advance the workflow.

Before approving initialization, inspect the complete preview of:

```text
.planning/project.json
.planning/config.json
.planning/state.json
.planning/decisions.json
.planning/structure/outline.json
```

Check that the working title is exact, TCR is recorded as the author-selected primary track rather than model inference, IPAAI remains a conditional fallback requiring new author approval, and every author-reserved choice is recorded as `locked`, `deferred`, or bounded `discretion`. The five records must validate before they are written.

If this directory already contains a draft but has no valid `.planning/project.json`, still start with `new-paper`. `map-project` requires initialized v1 state and cannot create the five-record foundation.

## 4. Map what actually exists

After initialization, inventory the supplied project:

```text
/wtfp:map-project Inventory materials/, notes/, references/, source-receipt.md, and any existing paper/ artifacts. Record the captured official pages with their exact URLs, retrieval times, paths, and SHA-256 digests. Treat the supplied NSF 25-531 solicitation as authoritative for program requirements. Keep solicitation evidence, author-supplied project evidence, and author decisions as distinct authority classes; preserve unresolved choices and do not scan outside the project root.
```

Review the resulting state rather than counting files as progress:

- A source record identifies the solicitation, paper, data set, prior system, or other supplied artifact.
- An evidence record says exactly what that source supports, contradicts, or contextualizes.
- An unsupported aspiration is a decision or planned claim, not evidence.
- A missing citation remains missing. RC2's `research-gap`, `analyze-bib`, and `check-refs` routes are deliberately unavailable until they have exact local-tool bindings.

Use `progress` for a read-oriented reconciliation before outlining:

```text
/wtfp:progress Summarize mapped materials, unresolved author decisions, blockers, and the next safe action.
```

## 5. Build and approve the whole argument

Ask for solicitation-grounded structure and an exact word budget:

```text
/wtfp:create-outline Derive requirements only from the supplied NSF 25-531 solicitation. Build the complete proposal argument, section dependencies, and an exact section-by-section word budget. Preserve unresolved team, scope, evaluation, budget, and timeline choices as deferred. Do not switch from TCR to IPAAI. Show the full outline and validation result for my approval before writing it.
```

The action must use the outliner specialist and independently validate the result. Before approval, check:

- every solicitation-derived requirement points to supplied evidence;
- the section word budgets sum exactly to the declared outline target;
- each stable section ID describes its purpose, for example `tcr-fit-significance` rather than `1`;
- dependencies occur in an earlier wave, not in the same wave as their dependents;
- no deferred author decision has been converted into a fact;
- the proposed evaluation measures the actual contribution without inventing preliminary results.

If validation fails, revise and revalidate; do not approve an exception simply because the outline sounds fluent.

## 6. Discuss, plan, write, and review one section

Reconcile state, then select a stable section ID from the approved outline:

```text
/wtfp:progress
/wtfp:discuss-section tcr-fit-significance Interview me about this section's purpose, must-cover requirements, evidence, voice, exclusions, and unresolved choices before planning.
```

The discussion records the scientist's intent and boundaries. It is not a writing plan. Once its checkpoint and context are correct:

```text
/wtfp:plan-section tcr-fit-significance Create one executable plan from the approved outline, section context, supplied evidence, and recorded decisions. Require the independent plan checker. Preview the plan, validation, checkpoint, section update, and state update for my approval.
```

`plan-section` is not complete merely because a planner returned prose. The plan checker must report traceability, support, decision fidelity, and feasibility, and a current passed outline validation must exist. Resolve a failed or disputed check with the scientist.

After approving the plan:

```text
/wtfp:write-section tcr-fit-significance Draft only from the current approved plan and supplied evidence. Mark unsupported or author-reserved claims explicitly. Do not invent citations, preliminary results, partner commitments, or solicitation requirements. Show the declared mutation and respect the write gate.
```

The manuscript artifact belongs under `paper/`; its plan, summary, checkpoint, validation, and section state stay linked under `.planning/`. A draft must not skip the approved plan or outrun its evidence.

Run the independent review as a separate action:

```text
/wtfp:review-section tcr-fit-significance Review the draft against its approved plan, source evidence, author decisions, NSF requirements, argument coverage, and reader expectations. Record findings without silently applying revisions; ask me about any disputed finding.
/wtfp:verify-work tcr-fit-significance Check each approved plan requirement against the persisted draft and evidence, recording failed or disputed checks honestly.
```

A review finding is not an author decision. Accept, reject, or defer each consequential recommendation explicitly, then use the appropriate revision action rather than allowing the reviewer to rewrite shared state on its own.

## 7. Prove pause and resume across a process boundary

Create durable resumption state:

```text
/wtfp:pause-writing tcr-fit-significance Record the exact current section, approved plan, manuscript artifact, review findings, unresolved decisions, validation status, and next safe options in a durable handoff and checkpoint.
```

Confirm that the handoff, checkpoint, section record, and project state were actually written and validate. Then exit the client completely. Do not preserve the old conversation as the mechanism of continuity.

Start a fresh process in the same project directory:

```bash
cd /path/to/nsf25-531-clio-trust
clio-coder --autonomy suggest
```

Resume from disk:

```text
/wtfp:resume-writing Read and validate the current portable records and persisted artifacts before presenting the exact checkpoint choices. Use the native interview and wait for my selection before updating the checkpoint or state.
/wtfp:progress
```

The fresh process must not rely on hidden conversational memory. Verify that it preserved the same project and section IDs, record revisions, author decisions, plan and review links, phase, blocked conditions, and manuscript artifact. The agent should report the selected next action and the mutations it really performed, including a truthful “no mutation” result when appropriate.

## 8. Repeat deliberately and archive a milestone

Repeat `discuss-section` → `plan-section` → `write-section` → `review-section` for each dependency-ready section. Use `progress` between stages to surface blockers and reconcile cross-record status. Do not let parallel specialist work bypass the author gates or the plan/reviewer boundaries.

The native Clio fleets can run a bounded plan/check or draft/review worker pair, but they are optional advanced primitives—not the implementation behind the slash commands. If used, the slash orchestrator still owns prior approval and subsequent schema, checkpoint, section, and project-state reconciliation. Do not run the draft fleet without an approved plan. See [Optional Clio fleets](GETTING_STARTED.md#optional-clio-fleets).

When a local milestone is internally ready:

```text
/wtfp:submit-milestone nsf25-531-internal-review-1 Preview and archive the selected proposal artifacts, portable project state, validations, and statistics for my confirmation.
```

`submit-milestone` creates a reproducible local archive. It does **not** upload to Research.gov, submit to NSF, contact collaborators, publish a repository, or make an institutional commitment. Final compliance review and external submission remain human and institutional actions.

## Scientist's finish checklist

Before treating the proposal as ready for an institutional or funder workflow, verify all of the following:

- The saved NSF solicitation is the authoritative program source, and every recorded program requirement traces to it.
- The PI explicitly selected TCR or IPAAI; the fallback was not activated by model inference.
- Scope, team, roles, facilities, budget, schedule, evaluation design, and deployment commitments are author-approved.
- Every quantitative, technical, prior-work, and impact claim is supported by supplied evidence or visibly marked unresolved.
- Citations identify real supplied sources; placeholders are not represented as completed literature research.
- The outline target equals the sum of section budgets and its dependency ordering remains valid.
- Every drafted section has an approved plan, an independent plan check, a review, and understandable validation status.
- Locked decisions remain locked, deferred decisions remain visibly deferred, and choices under `discretion` stay within their recorded bounds.
- Stable IDs, revisions, timestamps, and cross-record references remain coherent after each state transition.
- Pause/resume succeeds from a new client process using only persisted project state.
- No WTF-P action initialized or mutated Git, pushed, published, contacted an external service, or submitted the proposal incidentally.
- The final local archive contains the intended artifacts and validates, while actual external submission remains under human control.

If any item is false, record the blocker and route to the next bounded corrective action. Do not convert an incomplete process into a passing claim by softening the rubric.
