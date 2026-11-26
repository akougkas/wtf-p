<div align="center">

<img src="https://raw.githubusercontent.com/PanStudio/panwrite/main/assets/panwrite-banner.jpg" alt="PanWrite Banner" width="600">

# PanWrite

**Write the paper.**

Also: Proposal. Presentation. Poster.

Human-guided research and writing workflows for AI coding agents.

</div>

PanWrite gives your coding agent one portable academic method: interview the
author, map the evidence, record decisions, build an outline, plan and draft
one section at a time, review it, and resume later from durable state. You keep
the scientific judgment. The agent keeps the bookkeeping and does bounded jobs.

It ships as one canonical [Agent Plugins 1.0.0](https://agent-plugins.org)
bundle that a deterministic compiler projects into a native package for seven
coding-agent hosts. Version `1.0.0` is the current stable release and is
what npm `latest` resolves to. WTF-P releases up to 0.9.1 stay on npm under
the old `wtf-p` package name.

**Optional PanCite research backend (since 0.7.0):** `citation-search --backend=pancite`
queries Crossref, DataCite and Europe PMC by default, plus explicitly selected academic
APIs, through the [PanCite](docs/PANCITE.md) MCP server. Results keep their source
evidence and stay candidates. PanCite is a separate Python package
(`pip install pancite==0.3.0`) that PanWrite never installs for you. Research
actions reach it on PanCode and Claude Code; the other hosts keep their existing
capability blockers.

## Install on your agent

Two routes. Pick one per host; both register the same plugin, so do not use
both on the same profile.

**From this repository, with the host's own plugin manager.** Claude Code,
Codex, and Copilot CLI read a marketplace straight from the Git repository and
load the committed envelope, so no installer runs:

```bash
claude plugin marketplace add PanStudio/panwrite && claude plugin install panwrite@panwrite
codex plugin marketplace add PanStudio/panwrite && codex plugin add panwrite@panwrite
copilot plugin marketplace add PanStudio/panwrite && copilot plugin install panwrite@panwrite
```

Codex still needs the eleven role agents copied to `$CODEX_HOME/agents/`,
because Codex plugins do not carry agents; the npm installer does that for
you, the Git route does not.

**From npm, with the PanWrite installer.** You need Node.js 20 or newer and one
supported host. Run one line. The installer publishes the generated package
into that host's own configuration root, records an exact-file receipt, and
registers it with the host's native plugin lifecycle where one exists.

| Host | Install | Native registration the installer performs | Verified with |
| --- | --- | --- | --- |
| PanCode (0.9.0 or newer) | `npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install pancode` | `pancode hub install <staged-plugin> --user` and `pancode hub inspect plugin:panwrite --user --json`, then `pancode extensions install <staged-extension> --user` and `pancode extensions list --user --json` | Pending; see [Host capabilities](docs/HOST_CAPABILITIES.md#pancode-090) |
| Claude Code | `npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install claude` | `claude plugin marketplace add <root>/marketplaces/panwrite --scope user`, then `claude plugin install panwrite@panwrite --scope user -y` | 2.1.319 |
| Codex | `npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install codex` | `codex plugin marketplace add <root>/marketplaces/panwrite`, then `codex plugin add panwrite@panwrite --json`; agents copied to `$CODEX_HOME/agents/` | 0.163.0 |
| GitHub Copilot CLI | `npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install copilot` | `copilot plugin marketplace add <root>/marketplaces/panwrite`, then `copilot plugin install panwrite@panwrite` | 1.0.107 |
| OpenCode | `npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install opencode` | Files under the OpenCode config root; OpenCode discovers them by directory | 1.19.5 |
| Antigravity CLI | `npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install antigravity` | `agy plugin install <root>/sources/panwrite` | 1.5.3 |
| Gemini CLI | `npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install gemini` | Files under `<root>/extensions/panwrite`; Gemini discovers the extension by directory | 0.67.0 |

"Verified" means native discovery in a disposable profile on this exact
envelope, with the commands recorded in
[Host capabilities](docs/HOST_CAPABILITIES.md). Both PanCode packages declare
`pancode: ">=0.9.0"`, and PanCode itself requires Node.js 22.19 or newer. When
`pancode` is not on PATH, the installer publishes the files and leaves
registration pending until you re-run `npx @panstudio/panwrite install pancode`.

Keep the explicit `--package=@panstudio/panwrite@<version> -- panwrite` form. On a workstation
with another `panwrite` executable on PATH, the shorter `npx @panstudio/panwrite@<version>` can run
that executable instead.

## Sixty-second start

```bash
npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install pancode
cd /path/to/your-paper-or-proposal
pancode --autonomy yolo
```

```text
/panwrite:help
/panwrite:new-paper I am preparing a research proposal on reproducible scientific workflows. Interview me before deciding the scope, claims, evaluation, team, budget, or timeline. Use only the evidence I provide and mark unknowns instead of inventing citations.
```

The agent interviews you, previews the five initial project records, and waits
for your approval before writing anything. PanCode has two autonomy levels,
`default` and `yolo`; `yolo` removes PanCode's approval cards, while every PanWrite
gate and interview question still waits for you, because PanWrite asks them as
questions only you may answer. Every host uses the same
`/panwrite:<action>` names except Codex, which exposes the same actions through
seven native skills: mention `$panwrite-start-project` and ask for the
`new-paper` action with the same brief.

On PanCode, one command then carries the project forward:

```text
/panwrite:advance            run the next actions until a decision is yours
```

The desk picks each step from the project records, by the same ladder
`/panwrite:progress` reports, and arms its write guard for that action alone. It
stops at the first gate only you can answer, asks it, and continues after your
answer; a gate you keep pending ends the run. In the desk, `Ctrl+G A` starts
it, `Ctrl+G C` answers the pending gate and `Ctrl+G V` validates the records.
Every other host, and any step you want to run yourself, moves one action
at a time:

```text
/panwrite:map-project        inventory the materials you supplied
/panwrite:create-outline     argument, dependencies, exact word budget, for approval
/panwrite:discuss-section    capture your intent for one section
/panwrite:plan-section       one checked, executable plan
/panwrite:write-section      draft only from the approved plan and evidence
/panwrite:review-section     independent review, findings recorded, nothing rewritten
/panwrite:pause-writing      durable handoff; quit the client
/panwrite:resume-writing     a fresh process picks up from disk
```

See [Getting started](docs/GETTING_STARTED.md) for each host's launch command,
Codex skill selectors, isolated evaluation profiles, and troubleshooting.

## What it writes

Four document types share the same action set and differ in their scaffold:

| Workflow | Scaffold | Entry actions |
| --- | --- | --- |
| Paper (article, conference, review, thesis chapter) | `protocol/templates/paper-outline.md` | `new-paper`, `create-outline` |
| Grant proposal (solicitation-driven) | `protocol/templates/grant-proposal-outline.md` | `new-paper`, `create-outline`; see the [proposal workflow](docs/PROPOSAL_WORKFLOW.md) |
| Poster | `protocol/templates/poster.md` | `create-poster` |
| Presentation | `protocol/templates/slides.md` | `create-slides` |

The catalog has 37 stable actions across seven skills: start a project,
research the literature, plan a section, write a section, review the
manuscript, manage the project, and deliver. Availability is decided per host
by the generated `compatibility/action-availability.json`, and an unavailable
action returns `PANWRITE_ACTION_UNAVAILABLE` instead of improvising:

| Host | Available | Fails closed |
| --- | ---: | --- |
| PanCode | 32 / 37 | `contribute`, `report-bug`, `request-feature` (no `external.issue` binding); `remove-section` (no `filesystem.delete`); `update` (no `package.update`) |
| Claude Code | 31 / 37 | the five above plus `advance`, whose `workflow.drive` capability only the PanCode desk binds |
| Codex, Copilot CLI, OpenCode, Antigravity, Gemini | 26 / 37 | the six above plus `research-gap`, `analyze-bib`, `check-refs`, `audit-milestone`, `export-latex`, whose `tool.execute` effect is bound only to PanCode `bash` and Claude `Bash` |
| Copilot cloud projection (`.github`) | 5 / 37 | everything that needs an explicit approval gate |

Where the research routes are available, `tool.execute` authorizes exactly one
command, the bundled `tools/panwrite-tool.js` dispatcher over seven bibliography
and citation tools. On PanCode at `yolo` autonomy, `research-gap` can search free no-key
public indexes through PanCite without another approval for each bounded
query. An operator-configured read-class PanCite MCP connection is preferred
when the PanCode build supports it. Other network routes keep their author gate;
see [PanCite setup](docs/PANCITE.md).

## What it will not do

- It does not write without you. Outline, plan, write, review, and delivery
  gates are on by default, and a gate is crossed only through the host's real
  interaction tool, never by silence or a model's own recommendation.
- It does not invent evidence. Sources and evidence are separate records with
  provenance; a missing citation stays missing.
- It does not render or compile. `create-poster`, `create-slides`, and
  `export-latex` emit source and hand you the render or compile command.
- It does not submit. `submit-milestone` writes a local archive, not a
  submission to a funder, journal, or service.
- It does not touch Git or publish. No PanWrite action initializes, commits,
  branches, pushes, tags, or publishes as a side effect.
- It does not claim more than it has observed. Native discovery is verified
  per host; model-backed lifecycle evidence is partial and listed in
  [Compatibility](docs/COMPATIBILITY.md).

## How it is built

One protocol, one compiler, seven projections. Humans edit `protocol/`; the
compiler owns every file under `pancode/` and `vendors/`, authenticates each envelope with a
SHA-256 inventory, and fails closed when a host cannot bind a capability an
action requires.

```mermaid
flowchart LR
  P["protocol/<br/>37 action contracts, 37 workflows,<br/>11 roles, 7 skills, .planning v1 schemas,<br/>templates, tools.json"] --> C["adapter compiler<br/>bin/lib/adapter-compiler.js"]
  C --> B["pancode/plugin · pancode/extension<br/>canonical Agent Plugins 1.0.0 bundle<br/>and the PanCode desk"]
  C --> H["vendors/claude · codex · copilot ·<br/>opencode · antigravity · gemini<br/>native projections"]
  B --> I["npx @panstudio/panwrite install &lt;host&gt;<br/>exact-file receipts, native registration"]
  H --> I
```

Project memory lives in the paper directory: control records under
`.planning/` (project, config, state, decisions, outline, sources, evidence,
sections, checkpoints, validations) and manuscript artifacts under `paper/`.
Another process, or another supported host, resumes from those files rather
than from chat history.

## Learn more

- [Documentation index](docs/README.md)
- [Getting started](docs/GETTING_STARTED.md)
- [Host capabilities and verification commands](docs/HOST_CAPABILITIES.md)
- [Proposal workflow](docs/PROPOSAL_WORKFLOW.md)
- [Migrating from v0.5](docs/MIGRATION_V05_TO_V06.md)
- [Compatibility and evidence](docs/COMPATIBILITY.md)
- [Packaging and the PanCode plugin lifecycle](docs/AGENT_PLUGIN.md)
- [Building and releasing](docs/BUILD_AND_RELEASE.md)
- [Changelog](CHANGELOG.md) and [Contributing](CONTRIBUTING.md)

PanWrite was built at the [Gnosis Research Center](https://grc.iit.edu/) at
Illinois Tech for research teams with papers to publish, grants to win, and no
time for writer's block.

<div align="center">

**No more excuses. Ship the paper.**

</div>

: [akougkas.io/work/agentic-engineering](https://akougkas.io/work/agentic-engineering/)
