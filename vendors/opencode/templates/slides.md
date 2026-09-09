# Conference talk scaffold

Source structure for `project://deliverables/slides/{artifact}`. A talk is a narrative with one claim and a defensible path to it, not the paper's section list rendered as bullets.

Copy the body below, replace every bracketed placeholder from the manuscript and its evidence records, and cut slides until the budget below holds. WTF-P writes slide source only; it declares no rendering effect and runs no renderer. If the author wants a rendered deck, hand back the exact command for their own toolchain.

## Confirm before writing

Talk length, audience, venue format, whether questions are inside or outside the slot, and the single thing the audience should remember.

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

[Title] · [Speaker] · [Affiliation] · [Venue and date]

## [The problem, in one image or one sentence]

[Speaker note: the concrete situation the audience recognises. Thirty seconds.]

## [Why it is still open]

- [What the current best answer does]
- [Where it fails, with the number]

## [The claim]

[One sentence. This is the slide the audience should be able to repeat afterwards.]

## [Approach]

[One diagram. Speaker note: walk it left to right; do not read the labels aloud.]

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

Every number and figure must trace to a manuscript passage or an evidence record. Reused figures carry their original attribution on the slide. Speaker notes are part of the deliverable and follow the same evidence rule as the slides: do not put a claim in a note that the records do not support.
