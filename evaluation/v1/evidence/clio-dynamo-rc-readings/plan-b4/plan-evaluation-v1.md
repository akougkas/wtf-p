# Plan: Synthetic Evaluation (v1)

- **Section:** `project://sections/evaluation` (id: `evaluation`)
- **Plan id:** `plan-evaluation-v1`
- **Status:** immutable draft, pending independent plan-checker pass
- **Execution wave:** 4 (depends on completed section `method`)
- **Author interaction required:** none. All three claims are fully grounded in the closed-world fixture; no checkpoint is needed for this plan.

## Objective and reader-facing outcome

After reading this section, a systems researcher must be able to:

1. State the two recorded interruption means (41.2 s baseline full-checkpoint; 27.8 s coordinated incremental) and that eight trials were recorded per configuration in the supplied 128-node scenario.
2. State that every recorded trial completed its fixture recovery check, as an observation limited to those recorded trials.
3. Understand precisely what the observations do **not** establish: uncertainty, statistical significance, behavior on other workloads or node counts, production readiness, optimality, or comparative reliability.

The section's argument role is `evidence`: it reports supplied observations and draws only the two permitted inferences from them, explicitly bounding every sentence to the fixture scenario.

## Decision-fidelity ledger

| Decision / obligation | Disposition | Plan instruction |
|---|---|---|
| `bounded-central-claim` (author, **locked**) | Honor | Every performance statement in units U1–U3 must carry an explicit scope qualifier tying it to "the supplied 128-node synthetic scenario" or equivalent. No sentence may describe the technique generally. |
| `external-literature` (author, **deferred**) | Exclude | No citations, no references to external systems, papers, or prior work appear in any unit. The plan must not create a research gap for this section (research is marked complete; corpus is closed-world). |
| `background-example-order` (author, **discretion**) | Not applicable | This decision scopes the background section only; it imposes no constraint here and is recorded as out of scope for this plan. |
| Manifest must-have: bound every performance claim to the supplied synthetic scenario | Obligation | Enforced by the locked decision above; verified in final check V1. |
| Manifest must-have: report both recorded means and eight trials per configuration | Obligation | U1 task T2; verified in V2. |
| Manifest must-have: report the supplied recovery-check observation | Obligation | U2 task T4; verified in V3. |
| Manifest must-have: keep unavailable uncertainty and external literature explicit | Obligation | U3 tasks T6–T7; verified in V4. |
| Manifest should-have: separate observation from interpretation | Obligation | Each unit labels which sentences are raw observations vs. permitted interpretations; verified in V5. |
| Manifest out-of-scope: no significance, production-readiness, reliability, or universal claims; no unauthorized external citations | Obligation | Exclusion list per unit; verified in V6. |

## Budget allocation

Section word target: **700 words**. Unit budgets sum to 700 (variance 0%).

| Unit | Rhetorical function | Words |
|---|---|---|
| U1 — Recorded interruption comparison | Observation + permitted interpretation of the two means | 250 |
| U2 — Recovery-check completion | Observation, scope-limited | 180 |
| U3 — Evidence boundary and scope limits | Explicit statement of what is not established | 270 |
| **Total** | | **700** |

## Plan units

### U1 — Recorded interruption comparison (≈250 words)

- **Objective:** Report the two recorded means with their trial count and scenario, then state the single permitted inference.
- **Claim covered:** `claim-lower-interruption` (status: planned → supported by this unit).
- **Evidence inputs:**
  - `project://evidence/lower-interruption` (supports; primary-data; high confidence)
  - `project://sources/synthetic-benchmark-observations` (provenance identity)
- **Output mode:** prose drafting — material is fully grounded in the fixture record.
- **Ordered tasks:**
  1. **T1.** Open by restating the scenario boundary: 128 compute nodes, one synthetic stencil workload, eight recorded trials per configuration. (Observation; source: benchmark-observations.md scenario line.)
  2. **T2.** Report both arithmetic means exactly as recorded: baseline full-checkpoint 41.2 s; coordinated incremental 27.8 s. Include the trial count (eight per configuration) in the same sentence or immediately adjacent. (Observation; source: evidence/lower-interruption statement.)
  3. **T3.** State the permitted interpretation: "In this supplied scenario, the coordinated incremental configuration recorded a lower mean interruption." Use "recorded" and "in this supplied scenario" as mandatory qualifiers. (Interpretation; source: evidence/lower-interruption interpretation field.)
- **Connection:** Opens the section; depends on `method` having defined the two configurations and trial protocol. Closes by handing to U2, which reports the second recorded observation.
- **Exclusions:** No difference percentage or ratio beyond what the two means imply (e.g., "13.4 s lower" is acceptable as arithmetic restatement; "33% faster" is not, because it implies a rate claim). No significance language. No comparison to any external system. No raw-trial enumeration (none supplied).
- **Local verification:** V2 (means and trial count present), V1 (scope qualifier present), V6 (no forbidden claims).

### U2 — Recovery-check completion (≈180 words)

- **Objective:** Report that every recorded trial completed its fixture recovery check, explicitly framed as an observation about the recorded trials only.
- **Claim covered:** `claim-recovery-coverage`.
- **Evidence inputs:**
  - `project://evidence/recovery-coverage` (supports; primary-data; high confidence)
  - `project://sources/synthetic-benchmark-observations`
- **Output mode:** prose drafting.
- **Ordered tasks:**
  1. **T4.** State the observation: "Every recorded trial completed its fixture recovery check." Attribute to the supplied fixture record. (Observation.)
  2. **T5.** Immediately bound it: this is an observation about the recorded fixture trials in this scenario; it does not establish comparative reliability, robustness under other failure modes, or production-grade recovery guarantees. (Scope boundary; source: evidence/recovery-coverage limitations.)
- **Connection:** Follows U1's interruption report; both are the two positive observations the section carries. Hands to U3, which enumerates what remains unestablished.
- **Exclusions:** No claim that the incremental configuration is "more reliable" or "safer." No failure-injection narrative (none supplied). No extrapolation to other workloads or node counts.
- **Local verification:** V3 (recovery observation present and correctly scoped), V6 (no reliability claim).

### U3 — Evidence boundary and scope limits (≈270 words)

- **Objective:** Make the absence of uncertainty, significance, and external-validity evidence explicit so that no reader infers generalization from U1–U2.
- **Claim covered:** `claim-scope-limits`.
- **Evidence inputs:**
  - `project://evidence/scope-limits` (contextualizes; primary-data; high confidence)
  - `project://sources/synthetic-benchmark-observations` (provenance: fixture, not published source)
- **Output mode:** prose drafting — the boundary is fully specified by the evidence record.
- **Ordered tasks:**
  1. **T6.** Enumerate what the fixture does not provide: raw trial values, variance, confidence intervals, energy measurements, scaling results, independent replication. State plainly that no uncertainty estimate or significance test accompanies the recorded means. (Observation of absence; source: evidence/scope-limits statement.)
  2. **T7.** Enumerate what the fixture says nothing about: other workloads, other node counts, other storage systems, failure modes beyond the fixture's recovery check, production deployments. State that the observations cannot support claims of universality, optimality, or comparative reliability. (Boundary; source: evidence/scope-limits + research.md forbidden-interpretation line.)
  3. **T8.** Close the section by restating the two permitted findings in one sentence and noting that interpretation beyond them is deferred to the Discussion section. (Transition; no new claim.)
- **Connection:** Depends on U1 and U2 being present so the reader knows which observations are being bounded. Transitions forward to `discussion` (wave 5), whose goal is to separate observation from inference at the paper level.
- **Exclusions:** Do not frame the absences as negative empirical results (the evidence record's own limitation). Do not introduce any external citation or system name. Do not restate the means here beyond the one-sentence recap in T8.
- **Local verification:** V4 (uncertainty and external-validity gaps explicit), V1 (scope qualifiers), V6 (no forbidden claims), V5 (observation vs. interpretation labeling).

## Dependencies and waves

| Unit | Depends on | Wave |
|---|---|---|
| U1 | Section `method` complete (configuration names, trial protocol) | 4 |
| U2 | U1 (same section; sequential reading) | 4 |
| U3 | U1, U2 (bounds their observations) | 4 |

All three units execute in wave 4, sequentially within the section. No cross-section dependency beyond `method`.

## Resources

- **Read:** `project://manifest`, `project://decisions`, `project://structure/outline`, `project://sections/evaluation/section.json`, `project://sections/evaluation/context`, `project://sections/evaluation/research`, `project://evidence/lower-interruption`, `project://evidence/recovery-coverage`, `project://evidence/scope-limits`, `project://sources/synthetic-benchmark-observations`.
- **Created:** this plan artifact; on execution, `project://paper/evaluation.md` (manuscript) and `project://sections/evaluation/summary`.
- **Modified (by executor, not planner):** section record `plans` array and status → `planned`; state progress word_count.

## Checkpoints

None. All claims are supported by high-confidence primary-data evidence records; no author-owned unpublished data or consequential judgment call is required during execution.

## Verification (final, goal-backward)

| Check | Criterion | Pass condition |
|---|---|---|
| V1 — Scope fidelity | Every performance statement carries a scenario qualifier | No sentence describes the technique without "this supplied scenario" / "in this fixture" or equivalent; locked decision `bounded-central-claim` honored. |
| V2 — Means and trials reported | Both means and trial count present | 41.2 s, 27.8 s, and "eight recorded trials per configuration" all appear in U1. |
| V3 — Recovery observation reported | Completion stated and scoped | "Every recorded trial completed its fixture recovery check" appears in U2 with the scope boundary from T5. |
| V4 — Gaps explicit | Uncertainty and external-validity absences named | U3 names: no variance/CIs/significance; no other-workload/node/storage/failure/production evidence. |
| V5 — Observation vs. interpretation separated | Each unit's sentences are labelable | A reader can distinguish raw observations (T1, T2, T4, T6) from permitted interpretations (T3, T5, T7) without ambiguity. |
| V6 — No out-of-scope claims | Forbidden language absent | No: "significant", "universally", "production-proven", "optimal", "more reliable than", or any external citation/system name anywhere in the section. |
| V7 — Budget | Word count within 15% of 700 | Final draft is 595–805 words. |
| V8 — Traceability | Every claim ID maps to a unit and evidence record | claim-lower-interruption → U1, claim-recovery-coverage → U2, claim-scope-limits → U3; each with its `evidence_uris` satisfied. |

## Success criteria

The section is complete when:
1. All three assigned claims are stated and supported as specified above.
2. V1–V8 all pass on the final manuscript text at `project://paper/evaluation.md`.
3. The word count is within budget (V7).
4. No deferred idea (`external-literature`) has been reintroduced.
5. The section transitions cleanly from `method` (configuration definitions) and into `discussion` (interpretation boundary at paper level).

## Expected outputs on execution

- `project://paper/evaluation.md` — the drafted section (~700 words).
- `project://sections/evaluation/summary` — one-paragraph summary for downstream sections.
- Section record updated: `status → planned`, `plans` array includes this plan URI, `word_count` set after drafting.
