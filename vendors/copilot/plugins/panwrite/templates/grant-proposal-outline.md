# Grant proposal outline scaffold

Structural starting point for `outline.sections[*]` when `manifest.document_type` is `grant-proposal`. A proposal outline is not derived from IMRaD convention: it is derived from the solicitation the author supplied. Read that document first and let it override every default here.

## Before proposing any section

1. Locate the captured solicitation under `project://materials/{artifact}`. If no solicitation artifact exists, stop and ask for it. Do not outline a proposal from the funder's name, a program acronym, or memory of a past call.
2. Extract, quoting the solicitation, the required components, the page or word limit for each, the formatting constraints, the review criteria, and the deadline. Record each extraction as a `project://sources/{source}` record with the artifact and location it came from.
3. Record any component you cannot find in the supplied material as an open item in `project://decisions` with disposition `deferred`. An unfound requirement is unknown, never absent.

## Common component set

Most agency solicitations ask for some subset of these. Keep only the ones the supplied solicitation names, using the solicitation's own component names as `title`.

| Component | `argument_role` | Wave | What it must establish |
| --- | --- | --- | --- |
| Overview / summary | `setup` | 3 | The one-paragraph case, written last from the approved narrative |
| Motivation and significance | `setup` | 2 | Why the problem matters to the program's stated mission |
| Background and prior work | `background` | 1 | The state of the art and the team's own results that license the plan |
| Research plan / objectives | `method` | 1 | Concrete aims, each with an approach and a decision point |
| Preliminary results | `evidence` | 1 | Only measurements that exist; never a projected result stated as data |
| Evaluation and success criteria | `evidence` | 2 | How the funder will know the aims were met |
| Broader impacts | `implications` | 2 | Program-specific impact criteria, answered in the program's own terms |
| Management and timeline | `implications` | 2 | Milestones, responsibilities, and risk mitigation |
| Results from prior support | `background` | 1 | Only awards and outcomes the author supplied |

Budget, budget justification, biosketches, current and pending support, facilities, and data-management plans are author-owned institutional artifacts. Track them as required components in `manifest.requirements.must_have`, and do not draft personnel effort, cost, or institutional commitments.

## Budget accounting

Proposals are limited by pages, not words. Convert once, record the conversion, and keep using it:

- Set `outline.target_words` to the total word equivalent of the solicitation's page limit for the narrative components only. A common single-spaced 11pt page with one figure runs about 500 to 600 words; state which figure you assumed in the outline `thesis` or a decision record.
- Give each component a `word_target` derived from its own stated page limit where the solicitation sets one. Components without an individual limit share the remainder in proportion to the review criteria weights.
- `sections[*].word_target` must sum to `target_words` exactly. Excluded institutional artifacts are not outline sections and carry no share.
- Where the solicitation's own limits already sum to less than the total, allocate the slack explicitly rather than silently inflating one component.

## Author-reserved decisions

Never resolve these on the author's behalf; record them as `deferred` in `project://decisions` until the author locks them: track or program selection, scope and aims, partner and subaward roles, personnel and effort, budget figures, deployment sites, milestone dates, and any quantitative performance claim. An outline may name the section that will carry such a choice; it may not make the choice.
