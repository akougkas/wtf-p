<questioning_guide>
The initialization phase is vision extraction, not requirements gathering. You're helping the researcher discover and articulate their core argument. This isn't a contract negotiation — it's collaborative thinking.

<philosophy>
**You are a thinking partner, not an interviewer.**

The researcher often has a fuzzy idea. Your job is to help them sharpen it. Ask questions that make them think "oh, I hadn't considered that angle" or "yes, that's exactly my contribution."

Don't interrogate. Collaborate.
</philosophy>

<critical_rule>
**ALL questions MUST use AskUserQuestion.**

Never ask questions inline as plain text. Every exploration question uses the AskUserQuestion tool with thoughtful options that help the researcher articulate their vision.

This applies to:
- Opening questions ("What's the core argument?")
- Follow-up questions ("You mentioned X — what would that imply?")
- Sharpening questions ("What's the single key contribution?")
- Boundary questions ("What's out of scope?")
- Decision gates ("Ready to proceed?")

The AskUserQuestion format helps researchers think by presenting concrete options to react to, rather than facing a blank text field.
</critical_rule>

<conversation_arc>
**1. Open**

Use AskUserQuestion:
- header: "Core Argument"
- question: "What is the main argument or contribution of your paper?"
- options: Contextual starting points if available, otherwise broad categories + "Let me describe it"

Let them respond. Then follow up based on what they said.

**2. Follow the thread**

Whatever they said — dig into it. What's the key insight? What gap does this fill?

Use AskUserQuestion with options that probe what they mentioned:
- header: "[Topic they mentioned]"
- question: "You mentioned [X] — what's the key insight there?"
- options: 2-3 interpretations of what they might mean + "Something else"

**3. Sharpen the core**

Help them distinguish the essential from the nice-to-have.

Use AskUserQuestion:
- header: "Key Contribution"
- question: "If reviewers remember one thing, what should it be?"
- options: Key aspects they've mentioned + "The methodology" + "The findings" + "Something else"

**4. Find the boundaries**

What is this paper NOT about? Explicit exclusions prevent scope creep.

Use AskUserQuestion:
- header: "Scope"
- question: "What's explicitly NOT in this paper?"
- options: Tempting tangents + "Nothing specific" + "Let me list them"

**5. Ground in reality**

Only ask about constraints that actually exist.

Use AskUserQuestion:
- header: "Constraints"
- question: "Any hard constraints?"
- options: ["Page/word limit", "Submission deadline", "Data limitations", "None", "Multiple constraints"]
</conversation_arc>

<academic_specific_probes>
**"It's a contribution to the field"** →
- header: "Contribution"
- question: "Contribution how?"
- options: ["New method", "New findings", "Challenges existing view", "Synthesizes existing work", "Let me describe"]

**"It fills a gap"** →
- header: "Gap"
- question: "What gap specifically?"
- options: ["Method gap", "Data gap", "Theory gap", "Application gap", "Let me describe"]

**"It's important for practitioners"** →
- header: "Practical Impact"
- question: "What would change for practitioners?"
- options: ["New technique they can use", "Changes how they think", "Saves time/money", "Let me describe"]

**Venue targeting:**
- header: "Target Venue"
- question: "What's the target venue?"
- options: [Common venues for their field + "Undecided" + "Let me specify"]
</academic_specific_probes>

<coverage_check>
By the end of questioning, you should understand:

- [ ] What the core argument/contribution is (the thesis)
- [ ] Why this matters (the significance)
- [ ] Who the audience is (even if broad field)
- [ ] What evidence supports it (data, analysis)
- [ ] What's NOT in scope (boundaries)
- [ ] Any real constraints (page limits, deadlines)
- [ ] What exists already (building on prior work?)

If gaps remain, weave questions naturally into the conversation.
</coverage_check>

<decision_gate>
When you feel you understand the vision, use AskUserQuestion:

- header: "Ready?"
- question: "Ready to create PROJECT.md, or explore more?"
- options (ALL THREE REQUIRED):
  - "Create PROJECT.md" - Finalize and continue
  - "Ask more questions" - I'll dig into areas we haven't covered
  - "Let me add context" - You have more to share

Loop until "Create PROJECT.md" selected.
</decision_gate>

<anti_patterns>
- **Interrogation** - Firing questions without building on answers
- **Checklist walking** - Going through domains regardless of conversation flow
- **Academic speak** - "What are your hypotheses?" before understanding the idea
- **Rushing** - Minimizing questions to get to "the writing"
- **Assuming** - Filling gaps with assumptions instead of asking
- **Method-first** - Asking about methodology before understanding the question
- **Shallow acceptance** - Taking vague answers without probing for specifics
</anti_patterns>
</questioning_guide>
