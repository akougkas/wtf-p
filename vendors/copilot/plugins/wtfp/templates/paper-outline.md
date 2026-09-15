# Manuscript outline scaffold

Structural starting point for `outline.sections[*]` when `manifest.document_type` is `research-article`, `conference-paper`, `review`, `thesis`, `dissertation`, `book-chapter`, or `other`. Every share below is a default to be argued with, not a rule. The author's approved `target_words` and the venue's stated limit always win, and `sections[*].word_target` must sum to `target_words` exactly.

## Section roles

Each row maps to one outline entry. `argument_role` is the enum value the outline schema requires; `wave` is the earliest wave in which the section can be drafted without depending on unwritten text.

| Section | `argument_role` | Wave | Depends on | What it must establish |
| --- | --- | --- | --- | --- |
| Introduction | `setup` | 2 | Results, Discussion | The problem, why it is open, the contribution claimed, and the reader's payoff |
| Background / Related work | `background` | 1 | — | The prior positions this work answers, and the exact gap it occupies |
| Method / Approach | `method` | 1 | Background | What was built or done, in enough detail to be reproduced |
| Results / Evaluation | `evidence` | 1 | Method | What was measured, under which conditions, with what uncertainty |
| Discussion | `synthesis` | 2 | Results | What the evidence supports, what it does not, and the threats to validity |
| Limitations and future work | `implications` | 2 | Discussion | The boundary of the claim, stated by the authors before a reviewer states it |
| Conclusion | `conclusion` | 3 | Introduction, Discussion | The contribution restated against the evidence actually produced |

Write Background, Method, and Results first. Introduction and Conclusion are wave-2 and wave-3 because they make claims that only the evidence sections can license.

## Default budget shares

Shares of `target_words`, before the author adjusts them.

| Section | Research article / conference paper | Review | Thesis or dissertation chapter | Book chapter |
| --- | --- | --- | --- | --- |
| Introduction | 12% | 10% | 12% | 15% |
| Background | 15% | 45% | 25% | 25% |
| Method | 22% | 5% | 20% | 15% |
| Results | 25% | 15% | 22% | 20% |
| Discussion | 15% | 15% | 13% | 15% |
| Limitations | 6% | 5% | 5% | 5% |
| Conclusion | 5% | 5% | 3% | 5% |

Rounding will not land on `target_words`. Absorb the remainder in the largest evidence section and show the final allocation in the approval preview.

## Adaptations

- A review has no original evidence. Replace Method and Results with a stated selection procedure and a synthesis of the corpus, and keep the `evidence` argument role on the synthesis so claim coverage still has somewhere to attach.
- A theory or position paper replaces Results with an `evidence` section built from worked examples or formal argument, and says so in the section `goal`.
- A short paper or extended abstract usually drops Limitations as a separate section and folds it into Discussion. Do not silently drop the content.
- A thesis chapter inherits the front matter of the thesis. Do not restate the full literature in every chapter; declare the dependency in `depends_on` instead.

## Research flags

Set `research.required` to `true` for any section whose claims are not already covered by an existing `project://sources/{source}` record, and list the open topics in `research.topics`. Background is the usual case; Results should almost never need it.
