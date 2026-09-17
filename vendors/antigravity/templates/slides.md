# Conference talk scaffold

Source structure for `project://deliverables/slides/{artifact}`. A talk is a narrative with one claim and a defensible path to it, not the paper's section list rendered as bullets.

Copy the body below, replace every bracketed placeholder from the manuscript and its evidence records, and cut slides until the budget below holds. WTF-P writes slide source only; it declares no rendering effect and runs no renderer. If the author wants a rendered deck, hand back the exact command for their own toolchain.

## Confirm before writing

Talk length, audience, venue format, whether questions are inside or outside the slot, the single thing the audience should remember, and the exact speaker name, affiliation, and venue line. Ask for any of these the manifest does not record.

## Evidence gate

Before writing, build a claim ledger with one row per claim, number, comparison, or figure, each naming its support as a manuscript passage, a `project://sources/{source}` record, a `project://evidence/{evidence}` record, or a named project file path. Cut any row without support; statements about other systems or prior work need a cited source record, never general knowledge. Never invent speaker names, affiliations, emails, funding, venue, or dates; leave a visible placeholder such as `[AFFILIATION NEEDED]` and report it as unresolved. When the subject is software, derive every diagram from named source files or documentation, state those paths on the slide, and leave a labeled placeholder rather than an invented architecture.

## Budgets

Budget roughly one slide per minute of speaking time, minus the question period, and never more than about 40 spoken words per slide. Derive the slide count from the confirmed duration rather than from the number of paper sections.

| Talk length | Content slides | Result slides | Backup slides |
| --- | --- | --- | --- |
| 10 minutes | 8 | 2 to 3 | 3 to 5 |
| 15 minutes | 12 | 3 to 4 | 5 to 8 |
| 20 minutes | 16 | 4 to 6 | 8 to 12 |
| 45 minutes | 32 | 8 to 12 | 10 or more |

Backup slides sit after the closing slide and answer the questions the work invites: the ablation, the failure case, the cost, the comparison the audience will name.

---

## [Title slide]

[Title] · [Speaker or SPEAKER NEEDED] · [Affiliation or AFFILIATION NEEDED] · [Venue and date or VENUE NEEDED]

## [The problem, in one image or one sentence]

[Speaker note: the concrete situation the audience recognises. Thirty seconds.]

## [Why it is still open]

- [What the current best answer does]
- [Where it fails, with the number]

## [The claim]

[One sentence. This is the slide the audience should be able to repeat afterwards.]

## [Approach]

[One diagram derived from named source files or documents. Source: [paths]. Speaker note: walk it left to right; do not read the labels aloud.]

## [Key design decision]

- [The choice a reviewer would question, and the reason]

## [Result: the primary figure]

[Figure reference. Speaker note: state the axes, then the reading, then the value.]

## [Result: the condition that matters]

[Figure or table reference, with its measured condition.]

## [What this does not show]

- [Stated limitation, before a questioner states it]

## [Closing]

[The claim restated, plus artifact, code, or data links.]

---

## Backup

## [Anticipated question 1]

[Evidence-backed answer, with its source record.]

## [Anticipated question 2]

[Evidence-backed answer, with its source record.]

---

## Attribution rules

Every number, figure, and claim must trace to a row in the claim ledger. Reused figures carry their original attribution on the slide. Speaker notes are part of the deliverable and follow the same evidence rule as the slides: do not put a claim in a note that the records do not support.
