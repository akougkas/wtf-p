<div align="center">

# WRITE THE F***ING PAPER 🚀

**The G.O.A.T. meta-prompting system for 10x researchers who need to ship papers YESTERDAY.**

```bash
npx wtfp
```

**Runs on everything. Mac, Windows, Linux. No excuses.**
*(You need LaTeX and BibTeX or you're NGMI)*

> "Bro, if you have the data, this ships the manuscript. Zero writer's block."

> "I tried Overleaf and Notion — weak sauce. This tool actually ships words."

> "Literally the most based addition to my stack. It just writes the f*ing paper."

**Used by absolute legends at Gnosis Research Center at Illinois Tech.**

[The Alpha](#the-alpha-why-i-built-this) · [The Stack](#the-stack) · [The Commands](#the-toolkit) · [The Logic](#the-logic)

</div>

---

## The Alpha (Why I Built This)

Yo, I'm leading the Gnosis Research Center at Illinois Tech. I got grants to win, labs to run, and exactly zero time to stare at a blinking cursor like an NPC. My PhD students? Same story.

Other tools? Garbage. **Jasper?** Hallucinates. **ChatGPT?** Sounds like a robot trying to pass a Turing test. They don't get structure. They don't respect the citations.

So I cooked up **WTF-P**. We're talking high-leverage context maxxing here. Under the hood? It's parsing BibTeX, mapping arguments, and enforcing that IMRaD structure so hard. You feed it data, it spits out submission-ready drafts.

I trust the system. It builds the frame so I can just come in and drop the knowledge.

**No more "writer's block" excuses. We are shipping papers before the deadline. Period.**

— *GLITTERCOWBOY (Tenured & Based)*

> Academic writing is usually chaotic evil. You ask AI for a lit review, it invents papers. Total beta move.
> **WTF-P fixes that.** It's the grounding layer that makes Claude Code academic weapon grade. Describe the hypothesis, drop the .bib, and watch it cook.

### Who This Is For
PhDs, Postdocs, and PIs who are done playing games and need to submit the damn proposal/paper/report **right now**.

---

## Let's Go

```bash
npx wtfp
```

Boom. Done. Check `/wtfp:help` if you're lost.

<details>
<summary><strong>Headless / CI / HPC (For the devops wizards)</strong></summary>

```bash
npx wtfp --global   # Install to ~/.claude/
npx wtfp --local    # Install to ./.claude/
```
</details>

<details>
<summary><strong>Dev Mode (For the builders)</strong></summary>

Clone it, build it, break it:

```bash
git clone https://github.com/akougkas/wtfp.git
cd wtfp
node bin/install.js --local
```
</details>

### Pro Move: God Mode
WTF-P is designed for flow state. Don't let permissions slow you down.

```bash
claude --dangerously-skip-permissions
```

> [!TIP]
> This is the way. Stopping to approve `cat research_notes.txt` 50 times is strictly for amateurs.

---

## The Workflow

### 1. The Setup
```bash
/wtfp:new-paper
```
It grills you until it gets the alpha—your research questions, methods, findings. Creates `MANUSCRIPT.md`.

### 2. The Skeleton
```bash
/wtfp:create-outline
```
Generates:
- `OUTLINE.md` — The IMRaD backbone.
- `ARGUMENT.md` — The logic flow.
- `REFS.md` — Citations mapped to sections. **No hallucinations allowed.**

### 3. The Grind
```bash
/wtfp:plan-section 1      # Atomic planning
/wtfp:write-section       # Agent swarm execution
```
Each section runs in a fresh subagent context. 200k tokens of pure synthesis. No degradation. It reads only what it needs. Surgical precision.

### 4. The Finish
```bash
/wtfp:polish-prose        # De-robotize the text
/wtfp:check-refs          # BibTeX audit
/wtfp:export-latex        # LaTeX injection
```
Ship the draft to your advisor. Get roasted. Iterate. The system is modular—you never get stuck in a monolithic doc.

---

## Resurrecting Dead Papers

Got a paper rotting in a drawer? We're bringing it back to life.

### 1. Context Maxxing
```bash
/wtfp:map-project
```
Spawns agents to raid your directory. Creates `.planning/context/`:

| Document | The Vibe |
| :--- | :--- |
| `LIT_REVIEW.md` | Your .bib analysis. |
| `CURRENT_DRAFT.md` | The half-baked stuff you wrote 6 months ago. |
| `DATA_SUMMARY.md` | Your results/figures decoded. |
| `STYLE_GUIDE.md` | Nature/IEEE specs. |
| `GAPS.md` | Where you messed up. |

### 2. Re-Init
```bash
/wtfp:new-paper
```
Same as fresh, but now it knows your history.

### 3. Grind
`/wtfp:create-outline` → `/wtfp:plan-section` → `/wtfp:write-section`

---

## Why It Crushes

### Context Maxxing
Claude Code is cracked if you give it the right juice. Most profs just dump a PDF and pray.
WTF-P handles the prompt engineering:

| File | Function |
| :--- | :--- |
| `MANUSCRIPT.md` | The Vision. Always active. |
| `OUTLINE.md` | The Backbone. |
| `FLOW.md` | The Rhetoric. |
| `DRAFT_PLAN.md` | The Battle Plan. |
| `CRITIQUE.md` | Reviewer #2 Simulator. |

### XML Prompts (The Secret Sauce)
We use structured XML so Claude doesn't go off the rails:

```xml
<section type="synthesis">
  <title>3.2 Neural Architecture Search</title>
  <inputs>
    <file>data/results_table_3.csv</file>
  </inputs>
  <citations>
    <cite>vaswani2017attention</cite>
  </citations>
  <instruction>
    Describe the modified ResNet block.
    Tone: Objective, technical, gigabrain.
  </instruction>
</section>
```
Precise. No hallucinations. Pure signal.

### Subagent Swarm
Writing 10k words? Context windows get full. The AI gets dumb.
WTF-P prevents this. Every section = Fresh Agent.

| Section | Context | Quality |
| :--- | :--- | :--- |
| Intro | Fresh | 🔥 |
| Methods | Fresh | 🔥 |
| Discussion | Fresh | 🔥 |

No degradation. Walk away, come back to a finished Methods section.

### Atomic Commits
Every draft gets a git commit instantly:
```text
abc123f text(intro): complete problem statement
def456g text(methods): draft experimental setup
```

> [!NOTE]
> **Benefits:** Version control for your thesis. If a draft is mid, `git revert`.

### WCN Mode (Lite Context)
Running on smaller models? Limited context window? Free-tier Claude?

WCN (Workflow Compression Notation) cuts workflow tokens by **35-50%** with zero quality loss. Verified on Haiku and Sonnet.

```bash
# Switch to compressed workflows
./tools/wcn/swap-workflows.sh wcn

# Switch back to verbose
./tools/wcn/swap-workflows.sh verbose
```

| Mode | create-outline | plan-section | Best For |
| :--- | :--- | :--- | :--- |
| Verbose | 13,029 chars | 13,655 chars | Opus, unlimited plans |
| WCN | 6,676 chars | 8,863 chars | Haiku, Sonnet, free tiers |

> [!TIP]
> WCN uses structured notation (`[step:]`, `IF→`, `RUN:`) that smaller models parse just as well. You lose nothing but tokens.

---

## The Toolkit

### Setup & Planning
| Command | Payload |
| :--- | :--- |
| `/wtfp:new-paper` | Start the grind. Picks venue template (ACM/IEEE/ML/Nature). |
| `/wtfp:create-outline` | Build the skeleton from venue structure. |
| `/wtfp:map-project` | Analyze the ruins of old drafts. |
| `/wtfp:analyze-bib` | BibTeX intelligence. Cluster topics, find seminal works, map citations to sections. |
| `/wtfp:discuss-section [N]` | Gather section context before planning. |

### Writing & Execution
| Command | Payload |
| :--- | :--- |
| `/wtfp:plan-section [N]` | Tactical planning. |
| `/wtfp:write-section` | Execute the draft. |
| `/wtfp:progress` | Stats check. |
| `/wtfp:insert-section [N]` | Add missing sauce. |
| `/wtfp:remove-section [N]` | Kill your darlings. |
| `/wtfp:research-gap` | Find the holes in literature. |
| `/wtfp:list-assumptions` | Logic check. |

### Review & Polish
| Command | Payload |
| :--- | :--- |
| `/wtfp:review-section [N]` | Reviewer personas: Hostile, Area Chair, Editor, Mentor. |
| `/wtfp:plan-revision [N]` | Fix the damage. |
| `/wtfp:polish-prose` | De-robotize the text. Kill AI-speak. |
| `/wtfp:check-refs` | BibTeX audit. Find missing/unused citations. |

### Export & State
| Command | Payload |
| :--- | :--- |
| `/wtfp:export-latex` | Generate .tex (The final boss). |
| `/wtfp:submit-milestone` | Version lock. |
| `/wtfp:pause-writing` | Save state. |
| `/wtfp:resume-writing` | Load state. |
| `/wtfp:help` | RTFM. |

### Venue Templates
| Template | Structure |
| :--- | :--- |
| `acm-cs` | Intro → Background → Approach → Eval → Related → Conclusion |
| `ieee-cs` | Intro → Background/Related → Design → Impl → Eval → Conclusion |
| `arxiv-ml` | Intro → Related → Prelim → Method → Experiments → Conclusion |
| `nature` | Intro → Methods → Results → Discussion (classic IMRaD) |
| `thesis` | Flexible chapter structure for dissertations |

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=akougkas/wtfp&type=Date)](https://star-history.com/#akougkas/wtfp&Date)

## License
MIT License. Open source, open science.

<div align="center">
  <br>
  <strong>Claude Code is powerful. WTF-P makes it tenured.</strong>
</div>
