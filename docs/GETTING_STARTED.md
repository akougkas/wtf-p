# Getting started with PanWrite 1.0.0

PanWrite installs a portable academic workflow into an agent client you already use. It does not install that client, submit a paper, or run an entire research project in the background. You invoke one bounded action at a time; the agent interviews you where author judgment is required, previews consequential changes, and records approved state under the project root.

> **The scientist stays in the loop.** PanWrite does not autonomously run a paper or proposal from idea to submission. You invoke each bounded action. The agent interviews you, previews consequential changes, and waits at the gates recorded in `.planning/config.json` (outline, plan, write, review, and delivery are enabled by default). Author decisions are stored separately from model inference. `--advanced` skips PanWrite installer confirmations; it does not disable project interviews or approval gates.

The same action set covers the four document types PanWrite scaffolds from `protocol/templates/`: a paper, a grant proposal, a conference poster, and a talk. For a worked grant-writing example, continue with the [proposal workflow](PROPOSAL_WORKFLOW.md). The full documentation set is indexed in [docs/README.md](README.md).

## Requirements

- Node.js 20 or newer, including `npx`.
- One supported client installed and working: PanCode, Claude Code, Codex, GitHub Copilot CLI, OpenCode, Antigravity CLI, or Gemini CLI. [HOST_CAPABILITIES.md](HOST_CAPABILITIES.md) records the exact client versions exercised for this candidate.
- For PanCode, version 0.9.0 or newer, which itself requires Node.js 22.19 or newer. PanWrite installs into PanCode as a plugin package through `pancode hub install`, then installs its writing desk as a separate extension through `pancode extensions install`.
- A real paper or proposal directory. Start the client from that directory so the project root and allowed resources are unambiguous.
- Source material you are authorized to use. Put solicitations, papers, notes, data descriptions, and existing drafts inside the project before asking PanWrite to map them.

## Install exactly one client adapter

Claude Code, Codex, and GitHub Copilot CLI can install PanWrite straight from the Git repository with their own plugin managers; the repository root carries a marketplace for each:

```bash
claude plugin marketplace add PanStudio/panwrite && claude plugin install panwrite@panwrite
codex plugin marketplace add PanStudio/panwrite && codex plugin add panwrite@panwrite
copilot plugin marketplace add PanStudio/panwrite && copilot plugin install panwrite@panwrite
```

That route loads the committed envelope and runs no PanWrite code. It does not copy the eleven Codex role agents into `$CODEX_HOME/agents/`; use the npm installer below for Codex when you want subagents. Do not combine both routes on one profile: they register the same `panwrite` plugin and the host keeps only one.

The npm installer covers every host. Pin the version when reproducibility matters:

```bash
npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install pancode
npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install claude
npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install codex
npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install copilot
npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install opencode
npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install antigravity
npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install gemini
```

Run only the line for the client you intend to use. Each line installs the generated adapter for that client into the client's documented user configuration root and, where the client has a plugin lifecycle, registers it natively (PanCode `hub install` and `extensions install`, Claude and Copilot marketplace plus plugin install, Codex marketplace plus plugin add, Antigravity `plugin install`). It does not replace the client or launch an interactive session. For PanCode, the installer registers the plugin and the desk extension when `pancode` is on PATH; without the binary both packages are staged and the installer tells you to re-run the same command once `pancode` is on PATH.

The explicit `--package=@panstudio/panwrite@1.0.0 -- panwrite` split is intentional. It makes npm select the requested package before resolving its executable. On a workstation with another `panwrite` executable on PATH, the shorter `npx @panstudio/panwrite@1.0.0 ...` form can dispatch that executable instead. The leading `npx --yes` permits npm to acquire that exact package without a separate download prompt; because it appears before `--`, it is not a PanWrite workflow approval. Confirm that the installer banner reports `Write the paper v1.0.0`; stop if it reports another version or target.

An unqualified `npx @panstudio/panwrite` follows npm's stable `latest` tag, which is 1.0.0 from this release on. WTF-P releases up to 0.9.1 stay on npm under the old `wtf-p` package name.

The installer asks before consequential installation choices. Add `--advanced` only for reviewed automation or a disposable profile:

```bash
npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install pancode --advanced
```

That flag changes installer interaction only. It does not enable client Full Auto, answer scientist interviews, or waive a workflow approval.

## Launch and invoke PanWrite

Start the client from the project directory after installation:

| Client | Launch | Explicit first action |
| --- | --- | --- |
| PanCode | `pancode --autonomy yolo` | `/panwrite:new-paper <exact brief>`, then `/panwrite:advance` |
| Claude Code | `claude` | `/panwrite:new-paper <exact brief>` |
| Codex | `codex` | `$panwrite-start-project Run the new-paper action. <exact brief>` |
| GitHub Copilot CLI | `copilot` | `/panwrite:new-paper <exact brief>` |
| OpenCode | `opencode` | `/panwrite:new-paper <exact brief>` |
| Antigravity CLI | `agy` | `/panwrite-new-paper <exact brief>` |
| Gemini CLI | `gemini` | `/panwrite:new-paper <exact brief>` |

PanCode, Claude, Copilot CLI, OpenCode, and Gemini expose the `/panwrite:<action>` namespace and nothing else. Antigravity 1.5 loads plugin actions only as skills, so there each action is `/panwrite-<action>`; `/panwrite-write-section` and `/panwrite-plan-section` open the router skill of that name, which runs the action of the same name. Codex exposes the same action contracts through seven native Agent Skills rather than slash commands. When Codex routing must be unambiguous, name the owning skill and the action as shown in the table; do not ask Codex to run `/panwrite:help`.

GitHub Copilot cloud is a separate, deliberately narrower surface. A CLI installation does not alter a repository. To use the cloud projection, review `vendors/copilot/project/.github/` from the release source, copy the desired files into the target repository, and commit them through that repository's normal review process.

## Initialize before mapping

PanWrite uses `.planning/project.json` to distinguish an initialized v1 project.

- If `.planning/project.json` does **not** exist, invoke `new-paper` first, even when the directory already contains a manuscript. The action inspects existing materials, interviews you, and previews five initial records: `project.json`, `config.json`, `state.json`, `decisions.json`, and `structure/outline.json`.
- If valid v1 state already exists, use `progress` to inspect it and `map-project` to inventory newly supplied materials.

`map-project` reads an existing manifest and state record; it is not a replacement initializer. Do not rename legacy `.planning/*.md` control files to JSON. The v1 records have different schemas and meanings.

A typical supervised start is:

```text
/panwrite:new-paper <venue, purpose, constraints, and exact source boundaries>
/panwrite:map-project Inventory the supplied materials and existing draft.
/panwrite:create-outline Build the argument, dependencies, and exact word budget for my approval.
/panwrite:progress
```

Enter those actions one at a time. Complete the current interview, inspect its preview and persisted result, and cross any applicable author gate before invoking the next action. Do not paste the whole lifecycle as one autonomous request.

Use stable, descriptive section identifiers returned by the approved outline, such as `tcr-fit-significance`, in later commands. Do not assume that a displayed list position such as `1` is the persistent section ID.

## What happens during one action

The main PanWrite orchestrator is responsible for the complete action contract. It should:

1. Preserve the exact invocation arguments and identify the project root.
2. Resolve and validate every required `.planning` record and authored artifact.
3. Load only the owning skill, action, schemas, templates, and role references needed for that action.
4. Preserve locked, deferred, and bounded-discretion author decisions exactly as recorded.
5. Use the client's native interaction mechanism for a declared author gate. Prompt text, silence, a model's own recommendation, or a client autonomy setting is not approval.
6. Delegate only to roles declared by the action, verify each specialist's structured result, and keep the specialist inside its mutation or read-only boundary.
7. Preview the declared mutation, apply it only after the applicable gate, validate the result, and read the persisted records back.
8. Report what actually changed, what did not change, unresolved blockers, and the next safe action.

Specialist agents do narrower work. They do not interview the scientist, reinterpret an unresolved decision, mutate shared state outside their declared artifact, or run Git, a shell, or network tools merely because the host makes those tools available. The slash-command orchestrator owns author interaction and portable-state reconciliation around specialist work.

PanWrite actions must not initialize Git, stage, commit, branch, merge, push, tag, publish, or externally submit as an incidental effect. A client set to Full Auto still has to obey that contract; Full Auto is never evidence that the author approved a PanWrite gate.

## Portable project state

The interoperable source of truth lives in `.planning/`; manuscript prose normally lives in `paper/`:

```text
.planning/
├── project.json
├── config.json
├── state.json
├── decisions.json
├── structure/outline.json
├── sources/*.json
├── evidence/*.json
├── sections/<section-id>/section.json
├── sections/<section-id>/plans/*.md
├── sections/<section-id>/reviews/*.md
├── sections/<section-id>/handoff.md
├── checkpoints/*.json
└── validations/*.json
paper/
└── <authored manuscript artifacts>
```

Source records establish provenance. Evidence records state what a source supports, contradicts, or contextualizes. Decision dispositions have operational meaning:

- `locked`: preserve the author or venue choice until a genuinely authorized replacement is recorded;
- `deferred`: do not resolve the choice or draft through it as though it were settled;
- `discretion`: the agent may choose only within the recorded boundary; and
- `superseded`: retain the historical choice and its provenance while linking the authorized replacement.

Validation records report findings; they do not imply that a change was applied. Handoffs and checkpoints let a new client process resume without hidden conversational memory.

The default config enables confirmation gates for outline, plan, write, review, and delivery. Review `.planning/config.json` as project policy, not as generated boilerplate to ignore.

## PanCode compatibility notes

PanWrite installs into PanCode as a plugin at `<config>/plugins/panwrite/` and a desk extension at `<config>/extensions/panwrite/`. The installer resolves the PanCode configuration root the way PanCode does: `PANCODE_CONFIG_DIR`, then `$PANCODE_HOME/config`, then `${XDG_CONFIG_HOME:-~/.config}/pancode` on Linux (`~/Library/Application Support/pancode/config` on macOS, `%APPDATA%/pancode/config` on Windows); pass `--config-dir` to override. A target at `<working directory>/.pancode` uses project scope, so run `npx @panstudio/panwrite install pancode --config-dir .pancode` from the project directory for a project install. The lifecycle the installer follows, and what PanCode owns afterwards, is described in [AGENT_PLUGIN.md](AGENT_PLUGIN.md).

Three behaviors are worth knowing before the first install:

- Registration is verified with `pancode hub inspect plugin:panwrite --user --json` and `pancode extensions list --user --json` (or `--project` for project scope); the installer requires each package to be `valid` at the expected `rootPath` and scope, with no diagnostics beyond PanCode's project trust warning. It never changes `enabled`: a package you disabled stays disabled and the installer names `pancode hub enable plugin:panwrite --user` or `pancode extensions enable panwrite --user` (or `--project`) as the command to run.
- PanCode holds a project's plugins and extensions until you trust that project's package state, and PanWrite does not grant that trust. After a project install, run `pancode config trust plugins` and then `/reload hub` in a running session, and `pancode config trust extensions` for the desk.
- Do not point `pancode hub install` at `<config>/plugins/panwrite` itself. PanCode rejects a source that overlaps its managed destination; re-run the PanWrite installer instead. Previews can be inspected with `pancode hub install --dry-run`.

After installing, confirm native discovery:

```bash
pancode --version
pancode hub inspect plugin:panwrite --user --json
pancode hub list --kind plugin --json
pancode extensions list --user --json
pancode hub skills --all --json
pancode agents
pancode playbook list
pancode run '/panwrite:help'
```

`pancode run '/panwrite:help'` prints a static operator card without a model call: the start-here sequence, every action in workflow order with its argument hint, the actions this adapter cannot execute, and the two playbooks. A pre-existing user-level prompt can take precedence over a plugin prompt; `pancode hub components --kind prompt` reports each prompt's source, so the shadowing is visible. Back up and remove a stale prompt deliberately if you want the plugin copy to win. PanWrite will not overwrite it silently.

PanCode has two autonomy levels. `yolo` runs without PanCode's approval cards; `default` asks before calls PanCode cannot classify as routine. PanWrite's author gates are the same at both, so `yolo` is the usual launch:

```bash
cd /path/to/proposal
pancode --autonomy yolo
```

PanCode narrows each PanWrite prompt's turn to the tools its action declares (`allowed-tools`) and caps its workers (`delegated-tools`). Every question PanWrite puts to you is sent as one only you may answer, so PanCode never takes a recommended option for you when a question waits past `safety.unattendedAfterSeconds`; an unanswered one ends the turn instead. The desk's gate interviews never time out. A prompt that starts a PanWrite action in a project begins from the desk's project status, so the action does not reread every record to find its place. Use `default` when you also want PanCode's own approval card before unrecognized commands. The desk's tools reach the model as `extension_panwrite__<tool>`.

`/panwrite:advance` runs the next actions in one turn. The desk, not the model, picks each step from the project records and arms its write guard for that action alone; it stops at the first gate only you can answer, asks it, and continues after your answer. A gate you keep pending, a step that changes nothing, an action this host cannot run, or 24 steps end the run. It never starts a project: run `/panwrite:new-paper` or `/panwrite:map-project` first.

### Optional PanCode playbooks

The two generated playbooks are advanced, operator-invoked PanCode primitives that the fleet runs. Ordinary `/panwrite:*` actions do not invoke them implicitly:

```bash
pancode playbook validate panwrite-plan-section
pancode playbook validate panwrite-draft-review
```

Run a playbook with `pancode fleet run <playbook> --var section=<section-id>` (a model-backed run), and only after the slash orchestrator has established the required approved outline or section plan. The plan playbook runs `panwrite-section-planner` and then the read-only `panwrite-plan-checker`; the draft playbook runs `panwrite-section-writer` and then the read-only `panwrite-section-reviewer`. The workers create bounded artifacts, while the slash orchestrator remains responsible for approval, schemas, checkpoints, and state reconciliation.

PanCode's fleet write-boundary enforcement requires a Git repository in which `.planning/` and `paper/` are observable and not ignored. The playbooks declare those directories with trailing slashes. If preflight cannot observe the boundaries, it fails rather than broaden access or initialize a repository for you.

A project whose `.gitignore` excludes either directory is refused with a `write boundary: '.planning/' is ignored by ...` error. Run `git check-ignore -v .planning paper` to find the rule, and remove it if you use the playbooks. The ordinary `/panwrite:*` actions do not need these directories tracked.

### Isolated PanCode evaluation

Setting only `PANCODE_CONFIG_DIR` changes one destination; it does not isolate PanCode's home, XDG, state, cache, data, and temporary roots, or the sibling-agent roots PanCode reads from your home directory. For a disposable evaluation, put all of them beneath one mode-0700 root and run both the installer and PanCode through the same environment. The config, data, state, and cache directories below are descendants of `PANCODE_HOME`, as the prefix guard requires, and `PANCODE_INTEROP_HOME=none` stops PanCode from reading foreign user roots such as `~/.claude/skills`:

```bash
PANWRITE_PANCODE_SANDBOX="$(mktemp -d /tmp/panwrite-pancode.XXXXXX)"
chmod 700 "$PANWRITE_PANCODE_SANDBOX"
mkdir -p \
  "$PANWRITE_PANCODE_SANDBOX/home/tmp" \
  "$PANWRITE_PANCODE_SANDBOX/home/xdg/config" \
  "$PANWRITE_PANCODE_SANDBOX/home/xdg/data" \
  "$PANWRITE_PANCODE_SANDBOX/home/xdg/state" \
  "$PANWRITE_PANCODE_SANDBOX/home/xdg/cache" \
  "$PANWRITE_PANCODE_SANDBOX/home/pancode/config" \
  "$PANWRITE_PANCODE_SANDBOX/home/pancode/data" \
  "$PANWRITE_PANCODE_SANDBOX/home/pancode/state" \
  "$PANWRITE_PANCODE_SANDBOX/home/pancode/cache" \
  "$PANWRITE_PANCODE_SANDBOX/home/npm-cache"

run_isolated_pancode() {
  env -i \
    PATH="$PATH" \
    TERM="${TERM:-dumb}" \
    LANG="${LANG:-C.UTF-8}" \
    HOME="$PANWRITE_PANCODE_SANDBOX/home" \
    XDG_CONFIG_HOME="$PANWRITE_PANCODE_SANDBOX/home/xdg/config" \
    XDG_DATA_HOME="$PANWRITE_PANCODE_SANDBOX/home/xdg/data" \
    XDG_STATE_HOME="$PANWRITE_PANCODE_SANDBOX/home/xdg/state" \
    XDG_CACHE_HOME="$PANWRITE_PANCODE_SANDBOX/home/xdg/cache" \
    TMPDIR="$PANWRITE_PANCODE_SANDBOX/home/tmp" \
    PANCODE_HOME="$PANWRITE_PANCODE_SANDBOX/home/pancode" \
    PANCODE_CONFIG_DIR="$PANWRITE_PANCODE_SANDBOX/home/pancode/config" \
    PANCODE_DATA_DIR="$PANWRITE_PANCODE_SANDBOX/home/pancode/data" \
    PANCODE_STATE_DIR="$PANWRITE_PANCODE_SANDBOX/home/pancode/state" \
    PANCODE_CACHE_DIR="$PANWRITE_PANCODE_SANDBOX/home/pancode/cache" \
    PANCODE_INTEROP_HOME=none \
    PANCODE_REQUIRE_HOME_PREFIX=1 \
    PANCODE_DISABLE_RETRIEVE_TOOLS=1 \
    NPM_CONFIG_CACHE="$PANWRITE_PANCODE_SANDBOX/home/npm-cache" \
    "$@"
}

run_isolated_pancode npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite install pancode --advanced
cd /path/to/disposable-proposal
run_isolated_pancode pancode --autonomy default
```

`env -i` prevents ambient provider keys, npm credentials, and unrelated client variables from leaking into the run. The empty profile therefore has no model credentials unless you deliberately configure a PanCode-supported isolated credential mechanism. Never copy, print, or embed credentials in a fixture or evidence trace. Remove the disposable root after preserving any non-secret evidence you need.

## Verify or remove an installation

The `status` and `doctor` commands remain legacy Claude-oriented. Passing a modern target selector to them does not establish that a PanCode, Codex, or other modern adapter was discovered. Use the client's native discovery surface instead: `pancode hub inspect plugin:panwrite --user --json` and `pancode extensions list --user --json` (with `pancode hub skills --all --json`), `pancode agents`, and `pancode playbook list` for PanCode; `claude plugin list --json` and `claude plugin details panwrite@panwrite` for Claude Code; `codex plugin list --json` for Codex; `copilot plugin list` for Copilot CLI; `opencode agent list` and `opencode debug skill` for OpenCode; `agy plugin list` and `agy agents` for Antigravity; `gemini extensions list` and `gemini skills list --all` for Gemini. [HOST_CAPABILITIES.md](HOST_CAPABILITIES.md) shows what each of those reported for this candidate.

Preview removal before deleting exact receipt-owned files:

```bash
npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite uninstall pancode --dry-run
npx --yes --package=@panstudio/panwrite@1.0.0 -- panwrite uninstall pancode --yes
```

Replace `pancode` with the intended target. Uninstall preserves modified files and unrelated siblings by default. It removes client resources, not the academic project's `.planning/` or `paper/` data. For PanCode, native `hub remove` and `extensions remove` run only when every file below the installed root is unchanged and receipt-owned.

Remove PanWrite from PanCode with the PanWrite uninstaller rather than `pancode hub remove plugin:panwrite` and `pancode extensions remove panwrite` alone. The native commands delete the package files and registrations but leave PanWrite's `.panwrite-version` receipt in the PanCode config directory. If that has already happened, `panwrite uninstall pancode --yes` reports the removed files as already missing and removes the leftover receipt.

## Boundaries of this candidate

All seven host adapters discover the same 37 stable action routes. Availability is a complete adapter mapping, not a successful model run, and is recorded per host in each generated `compatibility/action-availability.json`. PanCode projects 32 of 37 actions as available and Claude Code 31 of 37, since only the PanCode desk drives `advance`; Codex, Copilot CLI, OpenCode, Antigravity, and Gemini project 26 of 37. [HOST_CAPABILITIES.md](HOST_CAPABILITIES.md) lists which actions fail closed on which host and why.

Where a research route is available, `tool.execute` authorises exactly one command, the bundled `tools/panwrite-tool.js` dispatcher. To reach its PanCite backend, invoke `research-gap` for literature discovery or `check-refs` for citation audit (for example, `/panwrite:research-gap related-work Find related work with --backend=pancite --providers=crossref,datacite,europe_pmc` or `/panwrite:check-refs Audit references with --backend=pancite --providers=crossref,datacite,europe_pmc`). `research-gap` on PanCode at `yolo` autonomy may search bounded public metadata through that dispatcher using only free no-key indexes without per-query approval; it still honors offline mode. On a PanCode build with user MCP `actionClass: read` support, it prefers an operator-configured PanCite connection through `gateway`. Other provider choices and `check-refs` still require the declared author network gate; see [PANCITE.md](PANCITE.md). `create-poster`, `create-slides`, and `export-latex` emit source and return the render or compile step as an author handoff; none of them runs a renderer or LaTeX. `submit-milestone` creates a reproducible local archive; despite its historical command name, it does not submit to a journal, funder, or external service.

If an action returns `PANWRITE_ACTION_UNAVAILABLE`, do not ask the model to improvise around the refusal. If a project has materials but no portable manifest, initialize it with `new-paper` before `map-project`. If records disagree, stop, preserve them, and use `progress` or `verify-work` to inspect the mismatch before approving a repair. Deny and stop an unexpected shell, network, Git, broad-filesystem, or external-service request.

See [COMPATIBILITY.md](COMPATIBILITY.md) for exact client and model observations and their limits, and the [portable project protocol](../protocol/project/README.md) for record-level invariants.
