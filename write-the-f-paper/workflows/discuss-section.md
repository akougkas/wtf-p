<purpose>
Gather section context through collaborative thinking before planning. Help the user articulate their vision for how this section should read, what it needs to accomplish, and what makes it effective.

You are a thinking partner, not an interviewer. The user is the expert on their research — you are the writing advisor. Your job is to understand their vision, not interrogate them about technical details they know and you don't.
</purpose>

<philosophy>
**User = researcher/expert. Claude = writing advisor.**

The user doesn't know (and shouldn't need to know):
- Academic writing conventions for their venue (you research)
- Optimal section structure (you figure out during planning)
- How to balance technical depth (you help calibrate)
- Citation density norms (you research)

The user DOES know:
- What their research actually found
- What story they want to tell
- What's the key insight readers should take away
- What they're most proud of and most worried about

Ask about their vision and findings. Figure out structure yourself.
</philosophy>

<process>

<step name="validate_section" priority="first">
Section number: $ARGUMENTS (required)

Validate section exists in roadmap:

```bash
if [ -f .planning/ROADMAP.md ]; then
  cat .planning/ROADMAP.md | grep "Section ${SECTION}:"
else
  echo "No roadmap found"
fi
```

**If section not found:**

```
Error: Section ${SECTION} not found in roadmap.

Use /wtfp:progress to see available sections.
```

Exit workflow.

**If section found:**
Parse section details from roadmap:

- Section number
- Section name
- Section description/goal
- Word budget
- Status (should be "Not started" or "In progress")

Continue to check_existing.
</step>

<step name="check_existing">
Check if CONTEXT.md already exists for this section:

```bash
ls .planning/sections/${SECTION}-*/CONTEXT.md 2>/dev/null
ls .planning/sections/${SECTION}-*/${SECTION}-CONTEXT.md 2>/dev/null
```

**If exists:**

```
Section ${SECTION} already has context: [path to CONTEXT.md]

What's next?
1. Update context - Review and revise existing context
2. View existing - Show me the current context
3. Skip - Use existing context as-is
```

Wait for user response.

If "Update context": Load existing CONTEXT.md, continue to questioning
If "View existing": Read and display CONTEXT.md, then offer update/skip
If "Skip": Exit workflow

**If doesn't exist:**
Continue to questioning.
</step>

<step name="questioning">
**CRITICAL: ALL questions use AskUserQuestion. Never ask inline text questions.**

Present initial context from roadmap, then immediately use AskUserQuestion:

```
Section ${SECTION}: ${SECTION_NAME}

From the roadmap: ${SECTION_DESCRIPTION}
Word budget: ${WORD_BUDGET} words
```

**1. Open:**

Use AskUserQuestion:
- header: "Vision"
- question: "What's the main thing you want readers to take away from this section?"
- options: 2-3 interpretations based on the section type + "Let me explain it"

**2. Follow the thread:**

Based on their response, use AskUserQuestion:
- header: "[Topic they mentioned]"
- question: "You mentioned [X] — what makes that the key insight?"
- options: 2-3 interpretations + "Something else"

**3. Find the core:**

Use AskUserQuestion:
- header: "Essential"
- question: "If you could only keep one paragraph, what would it absolutely have to say?"
- options: Key aspects they've mentioned + "Let me think about this"

**4. Find boundaries:**

Use AskUserQuestion:
- header: "Scope"
- question: "What should this section explicitly NOT cover (even if readers might expect it)?"
- options: Things that might be tempting to include + "Nothing specific" + "Let me list them"

**5. Capture concerns (optional):**

If they seem worried about something, use AskUserQuestion:
- header: "Concerns"
- question: "What are you most worried about with this section?"
- options: Contextual options based on conversation + "No major concerns" + "Let me describe"

CRITICAL — What NOT to ask:
- Citation formatting (you look that up)
- Section structure conventions (you figure out)
- Word count strategies (you plan)
- How to start the section (you propose)

**6. Decision gate:**

Use AskUserQuestion:
- header: "Ready?"
- question: "Ready to capture this context, or explore more?"
- options (ALL THREE REQUIRED):
  - "Create CONTEXT.md" - I've shared my vision
  - "Ask more questions" - Help me think through this more
  - "Let me add context" - I have more to share

If "Ask more questions" → return to step 2 with new probes.
If "Let me add context" → receive input → return to step 2.
Loop until "Create CONTEXT.md" selected.
</step>

<step name="write_context">
Create CONTEXT.md capturing the user's vision.

Use template from ~/.claude/write-the-f-paper/templates/context.md

**File location:** `.planning/sections/${SECTION}-${SLUG}/${SECTION}-CONTEXT.md`

**If section directory doesn't exist yet:**
Create it: `.planning/sections/${SECTION}-${SLUG}/`

Use roadmap section name for slug (lowercase, hyphens).

Populate template sections with VISION context (not technical planning):

- `<vision>`: What the user wants readers to take away
- `<essential>`: The core content that must be present
- `<boundaries>`: What's explicitly out of scope
- `<concerns>`: What they're worried about
- `<notes>`: Any other context gathered

Do NOT populate with your own structural analysis. That comes during planning.

Write file.
</step>

<step name="confirm_creation">
Present CONTEXT.md summary:

```
Created: .planning/sections/${SECTION}-${SLUG}/${SECTION}-CONTEXT.md

## Vision
[What they want readers to take away]

## Essential
[Core content that must be present]

## Boundaries
[What's out of scope]

---

## Next Up

**Section ${SECTION}: [Name]** — [Goal from ROADMAP.md]

`/wtfp:plan-section ${SECTION}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/wtfp:research-gap [topic]` — investigate literature first
- Review/edit CONTEXT.md before continuing

---
```

</step>

<step name="git_commit">
Commit section context:

```bash
git add .planning/sections/${SECTION}-${SLUG}/${SECTION}-CONTEXT.md
git commit -m "$(cat <<'EOF'
docs(${SECTION}): capture section context

Section ${SECTION}: ${SECTION_NAME}
- Vision and goals documented
- Essential content identified
- Scope boundaries defined
EOF
)"
```

Confirm: "Committed: docs(${SECTION}): capture section context"
</step>

</process>

<success_criteria>

- Section validated against roadmap
- Vision gathered through collaborative thinking (not interrogation)
- User's imagination captured: takeaway, essential content, boundaries
- CONTEXT.md created in section directory
- CONTEXT.md committed to git
- User knows next steps (typically: research or plan the section)
</success_criteria>
