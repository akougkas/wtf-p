<div align="center">

<img src="https://raw.githubusercontent.com/akougkas/wtf-p/main/assets/wtfp-banner.jpg" alt="WTF-P Banner" width="600">

# WTF-P

**Write The F\*\*\*ing Paper.**

Also: Proposal. Presentation. Poster.

Human-guided research and writing workflows for AI coding agents.

</div>

WTF-P helps a scientist turn a research idea into a defensible paper or
proposal without handing scientific judgment to the model. It gives your
coding agent a shared method for interviewing you, mapping evidence, recording
decisions, building an outline, planning and reviewing sections, and resuming
work from durable state.

The human stays in the loop. You decide the question, evidence, claims, scope,
and tradeoffs. You approve the outline, section plans, drafts, reviews, and
delivery checkpoints. WTF-P organizes the work and gives specialist agents
bounded jobs; it does not become the author, principal investigator, or final
authority.

`0.6.0-rc.2` is available on npm under `next` for Clio Coder, Claude Code,
Codex, GitHub Copilot CLI, OpenCode, Antigravity CLI, and Gemini CLI.

## Start a project

You need Node.js 20 or newer and one supported coding-agent client. This
example uses Clio Coder 0.3.8:

```bash
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install clio
cd /path/to/your-paper-or-proposal
clio-coder --autonomy suggest
```

Then ask WTF-P to start the project:

```text
/wtfp:new-paper I am preparing a research proposal on reproducible scientific workflows. Interview me before deciding the scope, claims, evaluation, team, budget, or timeline. Use only the evidence I provide and mark unknowns instead of inventing citations.
```

Clio will interview you and show the proposed project records before writing
them. Answer the questions, correct its assumptions, and approve only what you
actually want. That conversation is the beginning of the workflow—not an
obstacle to it.

Use `--package=wtf-p@next` instead of the exact version when you intentionally
want the newest release candidate.

## Work with WTF-P

A normal project moves through deliberate stages:

```text
/wtfp:new-paper <project brief>
/wtfp:map-project <what to inventory>
/wtfp:create-outline <venue and structure constraints>

/wtfp:discuss-section <section-id>
/wtfp:plan-section <section-id>
/wtfp:write-section <section-id>
/wtfp:review-section <section-id>

/wtfp:progress
/wtfp:pause-writing <reason>
# Quit the client and start a new process later.
/wtfp:resume-writing
```

Run one action at a time. Each action reads the current project, performs one
bounded job, asks the questions or approvals that job requires, validates what
it changed, and recommends the next safe action.

The section ID comes from the approved outline—for example,
`project-significance`—and remains stable as the document evolves. It is not a
section number guessed from the current order.

For an existing manuscript with no WTF-P project state, start with
`new-paper`, tell the agent to preserve and initialize around the existing
material, approve the proposed control records, and then run `map-project`.

## What the human and agents each do

```text
Scientist
  → invokes one action and answers the interview
    → main agent reads durable state and applies the workflow
      → specialist agents plan, draft, check, or review bounded artifacts
    → main agent validates the result and reports exactly what changed
  → scientist approves, revises, defers, or stops
```

The main agent is the orchestrator. It must preserve your locked and deferred
decisions, call the client's real interaction tool at approval gates, and read
back every mutation before claiming success. Specialists do not interview you
or take over project-wide state; they return a plan, draft, review, or verifier
result to the orchestrator.

If a required interview disappears, the agent resolves a deferred choice on
its own, or it claims a write that is not on disk, stop. That is a failed
workflow, not useful autonomy.

## A proposal example

For a funding proposal, first place the authoritative solicitation and your
trusted material inside the project directory:

```text
my-proposal/
├── materials/
│   ├── solicitation.pdf
│   ├── author-brief.md
│   └── prior-work/
└── …
```

Then start with a concrete brief. For the NSF 25-531 CICI solicitation, for
example:

```text
/wtfp:new-paper NSF 25-531 CICI proposal, TCR track. Working concept: ClioTrust, a reproducibility and provenance layer for agentic scientific workflows built around Clio Coder. Core themes: science workflows, reproducibility, provenance, and agentic reasoning. Interview me before locking scope, team, evaluation, budget, timeline, or claims. Use only evidence under materials/; mark unknowns and do not fabricate citations.
```

Follow with:

```text
/wtfp:map-project Inventory materials/ and existing notes. Treat the supplied solicitation as authoritative for program requirements.
/wtfp:create-outline Derive requirements only from the supplied solicitation. Preserve unresolved author choices as deferred and show the complete section and word budget for approval.
```

WTF-P does not fetch or certify the solicitation merely because you give it a
URL. It works from the material the client can actually read inside the project
boundary. See the full [proposal workflow](docs/PROPOSAL_WORKFLOW.md) for the
section loop, decision gates, review criteria, and pause/resume checklist.

## Use your client

The same workflow is projected into each client's native interface:

| Client | Start an explicit action |
| --- | --- |
| Clio Coder 0.3.8+ | `/wtfp:new-paper …` |
| Claude Code | `/wtfp:new-paper …` |
| GitHub Copilot CLI | `/wtfp:new-paper …` |
| OpenCode | `/wtfp:new-paper …` |
| Antigravity CLI | `/wtfp:new-paper …` |
| Gemini CLI | `/wtfp:new-paper …` |
| Codex | Select `$wtf-p:wtfp-start-project`, then request `new-paper` with the exact brief |

Install a different client by replacing `clio` in the first command with
`claude`, `codex`, `copilot`, `opencode`, `antigravity`, or `gemini`. Codex uses
native Agent Skills rather than the `/wtfp:*` namespace. Clio also provides
flat `/wtfp-new-paper` compatibility aliases, but the namespaced form is
preferred.

See [Getting started](docs/GETTING_STARTED.md) for client launch commands,
Codex skill selectors, Clio prompt discovery, safe test isolation, and
troubleshooting.

## Project memory

WTF-P keeps control state in `.planning/` and manuscript artifacts in
`paper/`:

```text
.planning/
├── project.json
├── config.json
├── state.json
├── decisions.json
├── structure/outline.json
├── sources/
├── evidence/
├── sections/
├── checkpoints/
└── validations/
paper/
└── … manuscript artifacts …
```

Sources record provenance. Evidence records what a source supports. Decisions
record what you locked, deferred, delegated within limits, or superseded.
Checkpoints let another process—or another supported client—resume without
guessing from chat history.

WTF-P itself does not initialize, stage, commit, branch, merge, push, publish,
or submit your work. Those remain separate human-controlled operations.

## RC2 boundaries

RC2 exposes 36 stable action names. Twenty-four are currently executable on
the full local adapters; 12 fail closed rather than pretending an unsupported
tool or approval mechanism exists. Automated literature search, bibliography
analysis, reference checking, LaTeX export, posters, and slides are among the
deferred routes. Supply vetted sources inside the project and use
`map-project` in this release candidate.

`submit-milestone` creates a local archive. It does not submit to NSF, a
journal, a conference, or any external service.

RC2 has deterministic protocol tests and real-model evidence for project
initialization and corrected fresh-process resumption. It does not yet claim a
completed full proposal, a cross-model writing-quality baseline, or that WTF-P
produces better prose than an unstructured control. Exact results and limits
are in [Compatibility](docs/COMPATIBILITY.md).

## Learn more

- [Getting started for scientists, operators, and agents](docs/GETTING_STARTED.md)
- [Human-guided proposal workflow](docs/PROPOSAL_WORKFLOW.md)
- [v0.5 → v0.6 migration](docs/MIGRATION_V05_TO_V06.md)
- [Compatibility and behavioral evidence](docs/COMPATIBILITY.md)
- [Agent-platform architecture](docs/agent-platform-modernization.md)
- [Evaluation methodology](evaluation/README.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Roadmap](ROADMAP.md)

WTF-P was built at the [Gnosis Research Center](https://grc.iit.edu/) at
Illinois Tech for research teams with papers to publish, grants to win, and no
time for writer's block.

<div align="center">

**No more excuses. Ship the paper.**

</div>
