# Conference poster scaffold

Source structure for `project://deliverables/poster/{artifact}`. A poster is a standing argument read at two distances: the title and headline claim from three metres, the panels from one. It is not a slide deck and not a compressed paper.

Copy the body below, replace every bracketed placeholder from the manuscript and its evidence records, and delete any panel the work does not support. WTF-P writes poster source only; it declares no rendering effect and runs no renderer. If the author wants a rendered PDF, hand back the exact command for their own toolchain.

## Confirm before writing

Dimensions and orientation, the venue's template or branding requirement, the session audience, the single claim the poster must land, and which figures already exist as artifacts.

## Budgets

A readable poster carries 400 to 800 words total. Body text sits at 24pt or larger, panel headings at 36pt or larger, the title at 72pt or larger. If a panel exceeds its budget the content belongs in the paper, not the poster.

| Panel | Words | Purpose |
| --- | --- | --- |
| Title block | 25 | Title, authors, affiliations, contact or code link |
| Headline claim | 30 | The finding, stated as a sentence a reader can repeat |
| Motivation | 80 | The problem and why the audience should care |
| Approach | 120 | What was built or done, with one diagram |
| Results | 150 | Two or three figures, each with a one-line reading |
| What it means | 80 | The consequence, and the boundary of the claim |
| References and provenance | 60 | Cited sources, funding, and artifact links |

---

# [Title: the claim, not the topic]

**[Author names]** · [Affiliations] · [contact or repository link]

## [Headline claim in one sentence]

## Why this matters

- [Problem, in the audience's terms]
- [What breaks today, with the number that shows it]

## What we did

- [Approach in one sentence]
- [The one design decision a reader would ask about]

![Approach diagram]([project://paper/{artifact} figure reference])

## What we found

![Primary result]([figure reference])

- [One-line reading of the primary figure, with the measured value]
- [Second result, with its condition]
- [What the result does not show]

## What it means

- [Consequence for the audience]
- [Stated limitation]

## References

[Only sources with a `project://sources/{source}` record. Include the funding acknowledgement and artifact or data links the venue requires.]

---

## Attribution rules

Every number, figure, and claim on the poster must trace to a manuscript passage or an evidence record. Carry the source attribution onto the poster itself for any figure reused from another work. Do not introduce a claim, a number, or a citation that appears nowhere in the project's records.
