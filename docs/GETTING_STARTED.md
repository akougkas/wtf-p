# Getting started with WTF-P 0.6.0-rc.2

WTF-P installs a portable academic workflow into an agent client you already use. It does not install that client, submit a paper, or run an entire research project in the background. You invoke one bounded action at a time; the agent interviews you where author judgment is required, previews consequential changes, and records approved state under the project root.

> **The scientist stays in the loop.** WTF-P does not autonomously run a proposal from idea to submission. You invoke each bounded action. The agent interviews you, previews consequential changes, and waits at the gates recorded in `.planning/config.json` (outline, plan, write, review, and delivery are enabled by default). Author decisions are stored separately from model inference. `--advanced` skips WTF-P installer confirmations; it does not disable project interviews or approval gates.

For a worked grant-writing example, continue with the [proposal workflow](PROPOSAL_WORKFLOW.md).

## Requirements

- Node.js 20 or newer, including `npx`.
- One supported client installed and working: Clio Coder, Claude Code, Codex, GitHub Copilot CLI, OpenCode, Antigravity CLI, or Gemini CLI.
- Clio Coder 0.3.8 or newer for namespaced prompts, extension agents, and extension fleets. Clio 0.3.8 records but does not enforce the manifest's `compatibility.clio` value, so the WTF-P installer also runs a credential-free capability probe.
- A real paper or proposal directory. Start the client from that directory so the project root and allowed resources are unambiguous.
- Source material you are authorized to use. Put solicitations, papers, notes, data descriptions, and existing drafts inside the project before asking WTF-P to map them.

## Install exactly one client adapter

Pin the release candidate when reproducibility matters:

```bash
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install clio
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install claude
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install codex
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install copilot
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install opencode
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install antigravity
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install gemini
```

Run only the line for the client you intend to use. For example, if Clio Coder 0.3.8 is already installed globally, `npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install clio` installs the WTF-P extension into the selected Clio profile. It neither replaces nor launches Clio.

The explicit `--package=wtf-p@0.6.0-rc.2 -- wtf-p` split is intentional. It makes npm select the requested package before resolving its executable. On a workstation with WTF-P 0.5 installed globally, the shorter `npx wtf-p@0.6.0-rc.2 ...` form can dispatch the old global executable instead. The leading `npx --yes` permits npm to acquire that exact package without a separate download prompt; because it appears before `--`, it is not a WTF-P workflow approval. Confirm that the installer's first line reports `WTF-P v0.6.0-rc.2`; stop if it reports another version or target.

`npx --yes --package=wtf-p@next -- wtf-p install clio` is a convenient moving prerelease form. It may resolve to a later candidate, so do not use it for a run that must reproduce RC2 exactly. An unqualified `npx wtf-p` follows npm's stable `latest` tag and must not be assumed to mean RC2.

The installer asks before consequential installation choices. Add `--advanced` only for reviewed automation or a disposable profile:

```bash
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install clio --advanced
```

That flag changes installer interaction only. It does not enable client Full Auto, answer scientist interviews, or waive a workflow approval.

## Launch and invoke WTF-P

Start the client from the project directory after installation:

| Client | Launch | Explicit first action |
| --- | --- | --- |
| Clio Coder | `clio-coder --autonomy suggest` | `/wtfp:new-paper <exact brief>` |
| Claude Code | `claude` | `/wtfp:new-paper <exact brief>` |
| Codex | `codex` | `$wtf-p:wtfp-start-project Run the new-paper action. <exact brief>` |
| GitHub Copilot CLI | `copilot` | `/wtfp:new-paper <exact brief>` |
| OpenCode | `opencode` | `/wtfp:new-paper <exact brief>` |
| Antigravity CLI | `agy` | `/wtfp:new-paper <exact brief>` |
| Gemini CLI | `gemini` | `/wtfp:new-paper <exact brief>` |

Clio, Claude, Copilot CLI, OpenCode, Antigravity, and Gemini expose the preferred `/wtfp:<action>` namespace. Clio also provides flat aliases such as `/wtfp-new-paper` for compatibility. Codex exposes the same action contracts through seven native Agent Skills rather than slash commands. When Codex routing must be unambiguous, name the owning skill and the action as shown in the table; do not ask Codex to run `/wtfp:help`.

GitHub Copilot cloud is a separate, deliberately narrower surface. A CLI installation does not alter a repository. To use the cloud projection, review `vendors/copilot/project/.github/` from the release source, copy the desired files into the target repository, and commit them through that repository's normal review process.

## Initialize before mapping

WTF-P uses `.planning/project.json` to distinguish an initialized v1 project.

- If `.planning/project.json` does **not** exist, invoke `new-paper` first—even when the directory already contains a manuscript. The action inspects existing materials, interviews you, and previews five initial records: `project.json`, `config.json`, `state.json`, `decisions.json`, and `structure/outline.json`.
- If valid v1 state already exists, use `progress` to inspect it and `map-project` to inventory newly supplied materials.

`map-project` reads an existing manifest and state record; it is not a replacement initializer. Do not rename legacy `.planning/*.md` control files to JSON. The v1 records have different schemas and meanings.

A typical supervised start is:

```text
/wtfp:new-paper <venue, purpose, constraints, and exact source boundaries>
/wtfp:map-project Inventory the supplied materials and existing draft.
/wtfp:create-outline Build the argument, dependencies, and exact word budget for my approval.
/wtfp:progress
```

Enter those actions one at a time. Complete the current interview, inspect its preview and persisted result, and cross any applicable author gate before invoking the next action. Do not paste the whole lifecycle as one autonomous request.

Use stable, descriptive section identifiers returned by the approved outline, such as `tcr-fit-significance`, in later commands. Do not assume that a displayed list position such as `1` is the persistent section ID.

## What happens during one action

The main WTF-P orchestrator is responsible for the complete action contract. It should:

1. Preserve the exact invocation arguments and identify the project root.
2. Resolve and validate every required `.planning` record and authored artifact.
3. Load only the owning skill, action, schemas, templates, and role references needed for that action.
4. Preserve locked, deferred, and discretionary author decisions exactly as recorded.
5. Use the client's native interaction mechanism for a declared author gate. Prompt text, silence, a model's own recommendation, or a client autonomy setting is not approval.
6. Delegate only to roles declared by the action, verify each specialist's structured result, and keep the specialist inside its mutation or read-only boundary.
7. Preview the declared mutation, apply it only after the applicable gate, validate the result, and read the persisted records back.
8. Report what actually changed, what did not change, unresolved blockers, and the next safe action.

Specialist agents do narrower work. They do not interview the scientist, reinterpret an unresolved decision, mutate shared state outside their declared artifact, or run Git, a shell, or network tools merely because the host makes those tools available. The slash-command orchestrator owns author interaction and portable-state reconciliation around specialist work.

WTF-P actions must not initialize Git, stage, commit, branch, merge, push, tag, publish, or externally submit as an incidental effect. A client set to Full Auto still has to obey that contract; Full Auto is never evidence that the author approved a WTF-P gate.

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
- `discretionary`: the agent may choose only within the recorded boundary; and
- `superseded`: retain the historical choice and its provenance while linking the authorized replacement.

Validation records report findings; they do not imply that a change was applied. Handoffs and checkpoints let a new client process resume without hidden conversational memory.

The default config enables confirmation gates for outline, plan, write, review, and delivery. Review `.planning/config.json` as project policy, not as generated boilerplate to ignore.

## Clio Coder 0.3.8 notes

After installing, start Clio in the project and inspect native discovery:

```bash
clio-coder --version
clio-coder agents
clio-coder fleet list
```

In the TUI, run `/prompts`. Confirm that `/wtfp:new-paper` reports the WTF-P extension as its source. A pre-existing user-level prompt can take precedence over an extension prompt; Clio reports that source so the shadowing is visible. Back up and remove a stale prompt deliberately if you want the extension copy to win. WTF-P will not overwrite it silently.

Use supervised `suggest` autonomy for ordinary proposal work:

```bash
cd /path/to/proposal
clio-coder --autonomy suggest
```

Clio 0.3.8 slash prompts inherit the session's host tool surface; their tool policy is not narrowed per action by the host. Deny and stop any shell, network, filesystem, or delegation call outside the displayed WTF-P action contract. Read-only mode is appropriate for previews. A Full Auto run can be useful for exploratory model testing, but it is non-certifying and does not remove the action's interviews or author gates.

### Optional Clio fleets

The two generated fleets are advanced, operator-invoked Clio primitives. Ordinary `/wtfp:*` actions do not invoke them implicitly:

```bash
clio-coder fleet validate wtfp-plan-section
clio-coder fleet validate wtfp-draft-review
clio-coder fleet run wtfp-plan-section --var section=<section-id>
clio-coder fleet run wtfp-draft-review --var section=<section-id>
```

Use a fleet only after the slash orchestrator has established the required approved outline or section plan. The plan fleet runs `wtfp-section-planner` and then the read-only `wtfp-plan-checker`; the draft fleet runs `wtfp-section-writer` and then the read-only `wtfp-section-reviewer`. The workers create bounded artifacts, while the slash orchestrator remains responsible for approval, schemas, checkpoints, and state reconciliation.

Clio's fleet write-boundary enforcement requires a Git worktree in which `.planning/` and `paper/` are observable and not ignored. The fleets declare those directories with trailing slashes. If preflight cannot observe the boundaries, it should fail rather than broaden access or initialize a repository for you.

### Truly isolated Clio evaluation

Setting only `CLIO_CODER_CONFIG_DIR` changes one destination; it does not isolate Clio's home, XDG, state, cache, data, binary, and temporary roots. For a disposable evaluation, put all of them beneath one mode-0700 root and run both the installer and Clio through the same environment. The config, data, state, cache, and binary directories below are descendants of `CLIO_CODER_HOME`, as the prefix guard requires:

```bash
WTFP_CLIO_SANDBOX="$(mktemp -d /tmp/wtfp-clio-rc2.XXXXXX)"
chmod 700 "$WTFP_CLIO_SANDBOX"
mkdir -p \
  "$WTFP_CLIO_SANDBOX/home/tmp" \
  "$WTFP_CLIO_SANDBOX/home/xdg/config" \
  "$WTFP_CLIO_SANDBOX/home/xdg/data" \
  "$WTFP_CLIO_SANDBOX/home/xdg/state" \
  "$WTFP_CLIO_SANDBOX/home/xdg/cache" \
  "$WTFP_CLIO_SANDBOX/home/clio/config" \
  "$WTFP_CLIO_SANDBOX/home/clio/data" \
  "$WTFP_CLIO_SANDBOX/home/clio/state" \
  "$WTFP_CLIO_SANDBOX/home/clio/cache" \
  "$WTFP_CLIO_SANDBOX/home/clio/bin"

run_isolated_clio() {
  env \
    HOME="$WTFP_CLIO_SANDBOX/home" \
    XDG_CONFIG_HOME="$WTFP_CLIO_SANDBOX/home/xdg/config" \
    XDG_DATA_HOME="$WTFP_CLIO_SANDBOX/home/xdg/data" \
    XDG_STATE_HOME="$WTFP_CLIO_SANDBOX/home/xdg/state" \
    XDG_CACHE_HOME="$WTFP_CLIO_SANDBOX/home/xdg/cache" \
    TMPDIR="$WTFP_CLIO_SANDBOX/home/tmp" \
    CLIO_CODER_HOME="$WTFP_CLIO_SANDBOX/home/clio" \
    CLIO_CODER_CONFIG_DIR="$WTFP_CLIO_SANDBOX/home/clio/config" \
    CLIO_CODER_DATA_DIR="$WTFP_CLIO_SANDBOX/home/clio/data" \
    CLIO_CODER_STATE_DIR="$WTFP_CLIO_SANDBOX/home/clio/state" \
    CLIO_CODER_CACHE_DIR="$WTFP_CLIO_SANDBOX/home/clio/cache" \
    CLIO_CODER_BIN_DIR="$WTFP_CLIO_SANDBOX/home/clio/bin" \
    CLIO_CODER_REQUIRE_HOME_PREFIX=1 \
    CLIO_CODER_NO_NETWORK_TOOLS=1 \
    "$@"
}

run_isolated_clio npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install clio --advanced
cd /path/to/disposable-proposal
run_isolated_clio clio-coder --autonomy suggest
```

The empty profile does not automatically have model credentials. Use only a Clio-supported isolated credential mechanism; never copy, print, or embed credentials in a fixture or evidence trace. Remove the disposable root after preserving any non-secret evidence you need.

## Verify or remove an installation

RC2's `status` and `doctor` commands remain legacy Claude-oriented. Passing a modern target selector to them does not establish that a Clio, Codex, or other modern adapter was discovered. Use the client's native discovery surface instead: `/prompts`, `clio-coder agents`, and `clio-coder fleet list` for Clio; command discovery or autocomplete for other slash clients; and skill discovery for Codex.

Preview removal before deleting exact receipt-owned files:

```bash
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p uninstall --clio --dry-run
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p uninstall --clio --yes
```

Replace `--clio` with the intended target selector. Uninstall preserves modified files and unrelated siblings by default. It removes client resources, not the academic project's `.planning/` or `paper/` data.

## Current RC2 boundaries

The seven full adapters discover 36 stable action routes and execute 24. The following 12 routes return deterministic `WTFP_ACTION_UNAVAILABLE` results because RC2 lacks an exact target binding for at least one required capability or effect: `analyze-bib`, `audit-milestone`, `check-refs`, `contribute`, `create-poster`, `create-slides`, `export-latex`, `remove-section`, `report-bug`, `request-feature`, `research-gap`, and `update`.

That means RC2 can organize and reason over sources you supply, but it must not pretend that unavailable literature-search or citation routes performed research. The available `submit-milestone` action creates a reproducible local archive; despite its historical command name, it does not submit to a journal, funder, or external service.

If an action returns `WTFP_ACTION_UNAVAILABLE`, do not ask the model to improvise around the refusal. If a project has materials but no portable manifest, initialize it with `new-paper` before `map-project`. If records disagree, stop, preserve them, and use `progress` or `verify-work` to inspect the mismatch before approving a repair. Deny and stop an unexpected shell, network, Git, broad-filesystem, or external-service request.

See [compatibility evidence](COMPATIBILITY.md) for exact client/model observations and limitations, and the [portable project protocol](../protocol/project/README.md) for record-level invariants.
