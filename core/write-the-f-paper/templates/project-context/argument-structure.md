# Argument Structure Template

Template for `.planning/structure/argument-map.md` — the logical structure of your paper.

**Purpose:** Map the logical flow from claims to evidence to conclusions. This is the "skeleton" of your argument that all writing builds upon.

---

## File Template

```markdown
# Argument Map

**Created:** [date]
**Last updated:** [date]

## Central Thesis

[The main claim of the paper in one sentence. This is what the entire paper argues for.]

## Supporting Claims

### Claim 1: [Statement]

**What we assert:** [Clear statement of the claim]
**Evidence:**
- [Evidence type: empirical/theoretical/logical]
- [Specific evidence: data, citation, reasoning]
**Source:** [Citation or "our data/analysis"]
**Strength:** [Strong / Moderate / Weak]
**Location:** [Which section presents this]

### Claim 2: [Statement]

**What we assert:** [Clear statement of the claim]
**Evidence:**
- [Evidence type]
- [Specific evidence]
**Source:** [Citation or source]
**Strength:** [Strong / Moderate / Weak]
**Location:** [Which section presents this]

### Claim 3: [Statement]

**What we assert:** [Clear statement of the claim]
**Evidence:**
- [Evidence type]
- [Specific evidence]
**Source:** [Citation or source]
**Strength:** [Strong / Moderate / Weak]
**Location:** [Which section presents this]

[Continue for all major claims...]

## Logical Flow

```
Claim 1 + Claim 2
       ↓
[Intermediate Conclusion 1]
       +
    Claim 3
       ↓
[Intermediate Conclusion 2]
       +
    Claim 4
       ↓
[Central Thesis]
```

## Counterarguments

### Objection 1: [Statement]

**What critics might say:** [The objection]
**Why it matters:** [Why we need to address it]
**Our response:** [How we address it]
**Placement:** [Where in paper we handle this]

### Objection 2: [Statement]

**What critics might say:** [The objection]
**Why it matters:** [Why we need to address it]
**Our response:** [How we address it]
**Placement:** [Where in paper we handle this]

## Gaps and Weaknesses

### Identified Gaps

[Claims that need stronger evidence or acknowledgment as limitations]

- **Gap 1:** [Claim X lacks sufficient evidence]
  - Current state: [What we have]
  - Needed: [What would strengthen it]
  - Plan: [How to address or acknowledge]

- **Gap 2:** [Logical leap between X and Y]
  - Current state: [The jump we're making]
  - Needed: [Bridging argument or evidence]
  - Plan: [How to address]

### Acknowledged Limitations

[Things we're explicitly acknowledging as limitations rather than fixing]

- [Limitation 1]: Acknowledged in [section]
- [Limitation 2]: Acknowledged in [section]

## Claim-Section Mapping

| Claim | Primary Section | Supporting Sections |
|-------|-----------------|---------------------|
| Claim 1 | Introduction | Methods |
| Claim 2 | Results | Discussion |
| Claim 3 | Discussion | Conclusion |
| Thesis | Abstract, Conclusion | Throughout |

---

*Argument map for: [Paper title]*
*Update when argument structure changes*
```

<guidelines>

**What belongs in argument-map.md:**
- The central thesis statement
- All major claims that support the thesis
- Evidence for each claim (type and specifics)
- Logical flow connecting claims to thesis
- Counterarguments and how you address them
- Gaps that need attention

**What does NOT belong here:**
- Full prose (that's the paper itself)
- Detailed citations (just key references)
- Section outlines (that's outline.md)
- Narrative structure (that's narrative-arc.md)

**When to create:**
- During project initialization
- After initial literature review
- Before detailed section planning

**When to update:**
- When claims change during writing
- When new evidence is added
- When counterarguments are identified
- After major revision

**Claim strength assessment:**
- Strong: Multiple independent sources, robust evidence
- Moderate: Good evidence but could be challenged
- Weak: Needs more support, acknowledged as limitation

**Usage in workflows:**
- plan-section loads this for context
- write-section checks claims against this
- review-section verifies coherence with this
</guidelines>

<example>
```markdown
# Argument Map

**Created:** 2025-01-15
**Last updated:** 2025-01-20

## Central Thesis

AI-assisted writing tools require discipline-specific frameworks to be effectively adopted in academic research contexts.

## Supporting Claims

### Claim 1: AI writing tools are proliferating rapidly

**What we assert:** The number and sophistication of AI writing tools has grown exponentially since 2022
**Evidence:**
- Empirical: Survey data showing 300% increase in tool availability (Smith, 2023)
- Empirical: Usage statistics from major platforms (Jones, 2024)
**Source:** Smith (2023), Jones (2024)
**Strength:** Strong
**Location:** Introduction (context)

### Claim 2: Current adoption in academia is ad hoc

**What we assert:** Researchers use AI tools inconsistently and without systematic guidance
**Evidence:**
- Empirical: Interview data with 45 researchers
- Empirical: Survey showing 78% report "trial and error" approach
**Source:** Our study
**Strength:** Moderate (single study)
**Location:** Results

### Claim 3: Academic writing has unique constraints not addressed by general tools

**What we assert:** Academic writing requires citation integration, argument rigor, and disciplinary conventions that general AI tools don't support
**Evidence:**
- Theoretical: Analysis of academic writing requirements (Author, 2022)
- Logical: Comparison of tool features vs. academic needs
**Source:** Author (2022), our analysis
**Strength:** Strong
**Location:** Literature Review, Discussion

### Claim 4: A framework improves adoption and outcomes

**What we assert:** Structured guidance leads to more effective and ethical AI tool use
**Evidence:**
- Empirical: Pilot study with framework (N=20) vs. control
- Theoretical: Draws on pedagogical framework literature
**Source:** Our pilot data
**Strength:** Moderate (small pilot)
**Location:** Results, Discussion

## Logical Flow

```
Claim 1 (tools proliferating) + Claim 2 (adoption is ad hoc)
       ↓
[Current state is suboptimal]
       +
Claim 3 (academic writing has unique needs)
       ↓
[General tools don't meet academic needs]
       +
Claim 4 (framework improves outcomes)
       ↓
[THESIS: Discipline-specific frameworks needed]
```

## Counterarguments

### Objection 1: AI writing is cheating

**What critics might say:** Using AI tools in academic writing constitutes plagiarism or academic dishonesty
**Why it matters:** Common concern that blocks adoption
**Our response:** Distinguish co-authorship from replacement; framework emphasizes transparency
**Placement:** Discussion (Ethics subsection)

### Objection 2: One framework can't fit all disciplines

**What critics might say:** Different fields have such different norms that a single framework is too general
**Why it matters:** Threatens generalizability of contribution
**Our response:** Framework is adaptable; we demonstrate with two disciplines
**Placement:** Discussion (Limitations)

## Gaps and Weaknesses

### Identified Gaps

- **Gap 1:** Claim 4 rests on small pilot (N=20)
  - Current state: Promising but preliminary results
  - Needed: Larger validation study
  - Plan: Acknowledge as limitation, note as future work

### Acknowledged Limitations

- Sample size for pilot: Acknowledged in Discussion
- Two disciplines only: Acknowledged in Limitations

---

*Argument map for: AI-Assisted Writing Framework*
*Update when argument structure changes*
```
</example>
