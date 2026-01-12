---
name: wtfp:polish-prose
description: De-robotize and refine prose for clarity, flow, and academic voice
argument-hint: "[section-number or file]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Polish prose to eliminate robotic AI-sounding text and improve academic voice.

Purpose: Transform draft prose into publication-ready writing that sounds human, flows naturally, and maintains academic rigor.
Output: Refined section text with improved clarity, varied sentence structure, and natural transitions.
</objective>

<execution_context>
@~/.claude/write-the-f-paper/references/prose-quality.md
@~/.claude/write-the-f-paper/references/academic-voice.md
</execution_context>

<context>
Target: $ARGUMENTS (section number, file path, or "all" for full manuscript)

**Load project state:**
@.planning/STATE.md

**Load style context if exists:**
@.planning/sources/style-guide.md
</context>

<process>

<step name="identify_target">
1. Parse $ARGUMENTS to determine scope:
   - Section number → find section draft in .planning/sections/XX-name/
   - File path → use directly
   - "all" or empty → process all draft sections
2. Read target content
3. Identify prose issues
</step>

<step name="analyze_prose">
**Identify common AI-writing patterns to fix:**

| Pattern | Fix |
|---------|-----|
| "It is important to note that..." | Delete or integrate naturally |
| "This study aims to..." | Active voice: "We investigate..." |
| "In conclusion, it can be said..." | Direct statement |
| Excessive hedging | Confident assertions where warranted |
| Repetitive sentence starts | Vary structure |
| Overuse of "Furthermore", "Moreover" | Natural transitions |
| Passive voice overload | Active where appropriate |
| Nominalization | Verbs over noun forms |
| Word padding | Tighten |

**Check for:**
- Sentence length variety (mix short punchy with longer complex)
- Paragraph flow and transitions
- Topic sentences that preview content
- Concluding sentences that land
- Jargon density appropriate for venue
</step>

<step name="gather_preferences">
Use AskUserQuestion:
- header: "Voice"
- question: "What tone should dominate this section?"
- options:
  - "Authoritative" — Confident, direct claims
  - "Measured" — Careful hedging, academic caution
  - "Accessible" — Clear to non-specialists
  - "Technical" — Dense, specialist terminology OK
</step>

<step name="polish">
**Apply transformations:**

1. **Sentence-level:**
   - Eliminate filler phrases
   - Convert passive to active where natural
   - Vary sentence openings
   - Tighten word count (cut 10-15%)

2. **Paragraph-level:**
   - Ensure clear topic sentences
   - Check logical flow between sentences
   - Verify transitions connect ideas

3. **Section-level:**
   - Opening hook engages
   - Closing paragraph lands the point
   - Section advances the argument

**Preserve:**
- Technical accuracy
- Citation placement
- Author's core arguments
- Discipline-specific terminology
</step>

<step name="present_changes">
Show before/after for significant changes:

```
Before: "It is important to note that the results demonstrate..."
After:  "The results demonstrate..."

Before: "This methodology was utilized in order to..."
After:  "We used this methodology to..."
```

Use AskUserQuestion:
- header: "Review"
- question: "Apply these prose refinements?"
- options:
  - "Apply all" — Looks good, update the file
  - "Show more" — I want to see more examples
  - "Selective" — Let me choose which changes
</step>

<step name="apply">
Apply approved changes to the target file(s).
</step>

<step name="commit">
```bash
git add [modified files]
git commit -m "$(cat <<'EOF'
style(XX): polish prose for clarity and flow

- Eliminated AI-sounding phrases
- Varied sentence structure
- Tightened word count
- Improved transitions
EOF
)"
```
</step>

<step name="done">
```
Prose polished:

- File(s): [list]
- Word count: [before] → [after] ([X]% reduction)
- Patterns fixed: [count]

---

## Next Up

Review the changes, then continue:
- `/wtfp:review-section [N]` — Get reviewer feedback
- `/wtfp:check-refs` — Verify citations
- `/wtfp:export-latex` — Generate LaTeX

---
```
</step>

</process>

<success_criteria>
- AI-sounding patterns eliminated
- Sentence variety improved
- Transitions flow naturally
- Word count tightened without losing meaning
- Academic voice maintained
- Changes committed to git
</success_criteria>
