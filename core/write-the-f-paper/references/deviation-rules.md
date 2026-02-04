# Deviation Rules for Writing Agents

Rules governing what writing agents can change without asking versus what requires human confirmation. These apply during plan execution when an agent encounters content that needs adjustment beyond the explicit task instructions.

Deviations are tracked in SUMMARY.md under "Deviations from Plan".

## Rule 1: Auto-fix (No Confirmation)

**Trigger:** Agent encounters a mechanical error that is objectively wrong.

**Scope:** Typos, citation formatting errors, markdown formatting issues, reference numbering, broken links, inconsistent heading levels, malformed lists.

**Action:** Fix immediately. Do not pause. Do not ask.

**Logging:** Add entry to SUMMARY.md deviations list:
```
[Rule 1 - Auto-fix] Fixed {description} in {file}
```

**Example:**
Agent is writing the methods section and notices the introduction references "[Smith et al., 2023]" but the citation list has it as "[Smith et al. 2023]" (missing comma). Agent fixes the citation format to match the configured `citation_style` and logs:
```
[Rule 1 - Auto-fix] Fixed missing comma in Smith et al. citation (introduction.md)
```

**Rationale:** These are errors, not choices. No reasonable author would want to keep them.

## Rule 2: Auto-add (No Confirmation)

**Trigger:** Agent identifies a gap in prose flow that can be bridged with a small addition.

**Scope:** Transition sentences between paragraphs, topic sentences for paragraphs that lack them, brief connecting phrases between arguments, missing paragraph breaks in wall-of-text blocks.

**Action:** Add the missing element. Continue execution.

**Logging:** Add entry to SUMMARY.md deviations list:
```
[Rule 2 - Auto-add] Added {description} in {file}
```

**Example:**
Agent is drafting the results section and the plan says "Task 3: Write secondary findings". The previous paragraph (Task 2 output) ends abruptly. Agent adds a transition sentence ("Beyond the primary effects, several secondary patterns emerged.") before writing the Task 3 content, and logs:
```
[Rule 2 - Auto-add] Added transition sentence between primary and secondary findings (results.md)
```

**Rationale:** Prose flow is expected. These additions are small (1-2 sentences), non-argumentative, and improve readability without changing meaning.

## Rule 3: Ask-first (Requires Confirmation)

**Trigger:** Agent believes content would benefit from a structural or substantive change.

**Scope:** Reordering paragraphs, splitting sections, merging sections, argument reframing, removing content (even redundant content), changing established terminology, altering emphasis or tone, adding new subsections.

**Action:** Stop execution. Present the proposed change as a checkpoint. Wait for confirmation before proceeding.

**Logging:** If approved and applied, add entry to SUMMARY.md deviations list:
```
[Rule 3 - Ask-first] {description} — approved by author
```
If rejected:
```
[Rule 3 - Ask-first] Proposed {description} — rejected, continued as planned
```

**Checkpoint format:**
```
════════════════════════════════════════
CHECKPOINT: decision
════════════════════════════════════════
Task {X} of {Y}: {Name}

Proposed deviation (Rule 3 — structural change):
  {Description of what agent wants to change}

Reason:
  {Why this would improve the paper}

Impact:
  {What changes if applied}

Options:
  [a] Apply the change
  [b] Continue as planned

Select: a or b
════════════════════════════════════════
```

**Example:**
Agent is writing the discussion section and realizes the "limitations" paragraph would read better before "implications" (plan has them in reverse order). Agent pauses:
```
Proposed deviation (Rule 3 — structural change):
  Move limitations paragraph before implications paragraph

Reason:
  Addressing limitations first makes the implications argument stronger —
  reader knows the caveats before seeing the claims.

Impact:
  Paragraphs 3 and 4 swap order. No content changes.
```

**Rationale:** Structure and argument framing are authorial choices. The agent may have good reasons, but the author decides.

## Rule 4: Never (Agent Cannot Do)

**Trigger:** Agent is tempted to strengthen the paper by adding unsupported content.

**Scope:** Adding claims not supported by cited evidence, fabricating citations (inventing author names, titles, DOIs), changing the author's stated position or thesis, inserting data or results not provided by the author, adding acknowledgments or author contributions the author did not specify.

**Action:** Do not do it. If the agent identifies a gap where such content is needed, flag it as a TODO for the author.

**Logging:** If agent identifies a gap, add a TODO:
```
[Rule 4 - Gap identified] {description} — needs author input
```

**TODO format in content:**
```markdown
<!-- TODO: [Rule 4] Citation needed for claim about X. Author to provide. -->
```

**Example:**
Agent is writing the discussion and the argument would be stronger with a citation supporting the claim "distributed systems show 40% improvement". Agent does not invent a citation. Instead:
```markdown
Distributed systems show significant improvement in throughput
<!-- TODO: [Rule 4] Citation needed for throughput improvement claim. Author to provide specific reference and percentage. -->
```
And logs:
```
[Rule 4 - Gap identified] Missing citation for throughput improvement claim (discussion.md) — needs author input
```

**Rationale:** Academic integrity is non-negotiable. Fabricated citations are research misconduct. The author's thesis is their intellectual contribution — agents assist, they do not override.

## Rule Priority

When multiple rules could apply:

1. **Rule 4 always wins.** If the fix would require fabricating evidence, it is Rule 4 regardless of how "small" it seems.
2. **Rule 3 over Rule 2.** If an addition changes argument structure (not just flow), it is Rule 3.
3. **Rule 1 over Rule 2.** If the issue is an error (not a gap), fix it as Rule 1.

**Edge cases:**
- Fixing a citation that exists but is formatted wrong: Rule 1 (formatting error)
- Adding a citation that does not exist in the bibliography: Rule 4 (fabrication)
- Adding a topic sentence: Rule 2 (prose flow)
- Rewriting a topic sentence to change its claim: Rule 3 (substantive change)
- Fixing a factual error in author-provided content: Rule 3 (the author wrote it intentionally — ask first)
