# Getting started with WTF-P 0.7.3

WTF-P installs a portable academic workflow into an agent client you already use. It does not install that client, submit a paper, or run an entire research project in the background. You invoke one bounded action at a time; the agent interviews you where author judgment is required, previews consequential changes, and records approved state under the project root.

> **The scientist stays in the loop.** WTF-P does not autonomously run a paper or proposal from idea to submission. You invoke each bounded action. The agent interviews you, previews consequential changes, and waits at the gates recorded in `.planning/config.json` (outline, plan, write, review, and delivery are enabled by default). Author decisions are stored separately from model inference. `--advanced` skips WTF-P installer confirmations; it does not disable project interviews or approval gates.

The same action set covers the four document types WTF-P scaffolds from `protocol/templates/`: a paper, a grant proposal, a conference poster, and a talk. For a worked grant-writing example, continue with the [proposal workflow](PROPOSAL_WORKFLOW.md). The full documentation set is indexed in [docs/README.md](README.md).

## Requirements

- Node.js 20 or newer, including `npx`.
- One supported client installed and working: Clio Coder, Claude Code, Codex, GitHub Copilot CLI, OpenCode, Antigravity CLI, or Gemini CLI. [HOST_CAPABILITIES.md](HOST_CAPABILITIES.md) records the exact client versions exercised for this candidate.
- For Clio Coder, version 0.4.7 or newer (`npm install -g @iowarp/clio-coder`), which itself requires Node.js 22.19 or newer. WTF-P installs into Clio as a plugin package through `clio-coder library install`.
- A real paper or proposal directory. Start the client from that directory so the project root and allowed resources are unambiguous.
- Source material you are authorized to use. Put solicitations, papers, notes, data descriptions, and existing drafts inside the project before asking WTF-P to map them.

## Install exactly one client adapter

Claude Code, Codex, and GitHub Copilot CLI can install WTF-P straight from the Git repository with their own plugin managers; the repository root carries a marketplace for each:

```bash
claude plugin marketplace add akougkas/wtf-p && claude plugin install wtfp@wtf-p
codex plugin marketplace add akougkas/wtf-p && codex plugin add wtfp@wtf-p
copilot plugin marketplace add akougkas/wtf-p && copilot plugin install wtfp@wtf-p
```

That route loads the committed envelope and runs no WTF-P code. It does not copy the eleven Codex role agents into `$CODEX_HOME/agents/`; use the npm installer below for Codex when you want subagents. Do not combine both routes on one profile: they register the same `wtfp` plugin and the host keeps only one.

The npm installer covers every host. Pin the version when reproducibility matters:

```bash
npx --yes --package=wtf-p@0.7.3 -- wtf-p install clio
npx --yes --package=wtf-p@0.7.3 -- wtf-p install claude
npx --yes --package=wtf-p@0.7.3 -- wtf-p install codex
npx --yes --package=wtf-p@0.7.3 -- wtf-p install copilot
npx --yes --package=wtf-p@0.7.3 -- wtf-p install opencode
npx --yes --package=wtf-p@0.7.3 -- wtf-p install antigravity
npx --yes --package=wtf-p@0.7.3 -- wtf-p install gemini
```

Run only the line for the client you intend to use. Each line installs the generated adapter for that client into the client's documented user configuration root and, where the client has a plugin lifecycle, registers it natively (Clio `library install`, Claude and Copilot marketplace plus plugin install, Codex marketplace plus plugin add, Antigravity `plugin install`). It does not replace the client or launch an interactive session. For Clio, the installer registers the plugin when `clio-coder` is on PATH; without the binary the bundle is staged and the installer tells you to re-run the same command once the binary is available.

The explicit `--package=wtf-p@0.7.3 -- wtf-p` split is intentional. It makes npm select the requested package before resolving its executable. On a workstation with WTF-P 0.5 installed globally, the shorter `npx wtf-p@0.7.3 ...` form can dispatch the old global executable instead. The leading `npx --yes` permits npm to acquire that exact package without a separate download prompt; because it appears before `--`, it is not a WTF-P workflow approval. Confirm that the installer banner reports `Write The F***ing Paper v0.7.3`; stop if it reports another version or target.

An unqualified `npx wtf-p` follows npm's stable `latest` tag, which is the 0.7 line from this release on. Earlier installations are reached only by naming that version explicitly.

The installer asks before consequential installation choices. Add `--advanced` only for reviewed automation or a disposable profile:

```bash
npx --yes --package=wtf-p@0.7.3 -- wtf-p install clio --advanced
```

That flag changes installer interaction only. It does not enable client Full Auto, answer scientist interviews, or waive a workflow approval.

## Launch and invoke WTF-P

Start the client from the project directory after installation:

| Client | Launch | Explicit first action |
| --- | --- | --- |
| Clio Coder | `clio-coder --autonomy suggest` | `/wtfp:new-paper <exact brief>` |
| Claude Code | `claude` | `/wtfp:new-paper <exact brief>` |
| Codex | `codex` | `$wtfp-start-project Run the new-paper action. <exact brief>` |
| GitHub Copilot CLI | `copilot` | `/wtfp:new-paper <exact brief>` |
| OpenCode | `opencode` | `/wtfp:new-paper <exact brief>` |
| Antigravity CLI | `agy` | `/wtfp:new-paper <exact brief>` |
| Gemini CLI | `gemini` | `/wtfp:new-paper <exact brief>` |

Clio, Claude, Copilot CLI, OpenCode, Antigravity, and Gemini expose the `/wtfp:<action>` namespace and nothing else. Codex exposes the same action contracts through seven native Agent Skills rather than slash commands. When Codex routing must be unambiguous, name the owning skill and the action as shown in the table; do not ask Codex to run `/wtfp:help`.

GitHub Copilot cloud is a separate, deliberately narrower surface. A CLI installation does not alter a repository. To use the cloud projection, review `vendors/copilot/project/.github/` from the release source, copy the desired files into the target repository, and commit them through that repository's normal review process.

## Initialize before mapping

WTF-P uses `.planning/project.json` to distinguish an initialized v1 project.

- If `.planning/project.json` does **not** exist, invoke `new-paper` first, even when the directory already contains a manuscript. The action inspects existing materials, interviews you, and previews five initial records: `project.json`, `config.json`, `state.json`, `decisions.json`, and `structure/outline.json`.
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
4. Preserve locked, deferred, and bounded-discretion author decisions exactly as recorded.
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
- `discretion`: the agent may choose only within the recorded boundary; and
- `superseded`: retain the historical choice and its provenance while linking the authorized replacement.

Validation records report findings; they do not imply that a change was applied. Handoffs and checkpoints let a new client process resume without hidden conversational memory.

The default config enables confirmation gates for outline, plan, write, review, and delivery. Review `.planning/config.json` as project policy, not as generated boilerplate to ignore.

## Clio Coder compatibility notes

WTF-P installs into Clio as a plugin at `<config>/plugins/wtfp/`. The installer resolves the Clio profile the way Clio does: `CLIO_CODER_CONFIG_DIR`, then `CLIO_CODER_HOME/config`, then `${XDG_CONFIG_HOME:-~/.config}/clio-coder` on Linux; pass `--config-dir` to override. A target at `<working directory>/.clio-coder` uses project scope. The lifecycle the installer follows, and what Clio owns afterwards, is described in [AGENT_PLUGIN.md](AGENT_PLUGIN.md).

Three behaviors are worth knowing before the first install:

- Registration is verified with `clio-coder library inspect wtfp --user --json` (or `--project` for project scope); the installer requires `valid` with zero diagnostics at the expected `rootPath` and scope (returning the InstalledPlugin record shape). It never changes `enabled`: a package you disabled stays disabled and the installer names `clio-coder library enable wtfp --user` (or `--project`) as the command to run.
- Do not point `clio-coder library install` at `<config>/plugins/wtfp` itself. Clio rejects a source that overlaps its managed destination; re-run the WTF-P installer instead. Previews can be inspected with `clio-coder library install --dry-run` (no `--yes` flag is accepted or used).
- If a 0.6 release candidate left a WTF-P extension at `<config>/extensions/wtfp`, remove it with that candidate's WTF-P uninstaller before installing the plugin. Both register the same prompt names, and the release neither reads nor retires the extension location.

After installing, confirm native discovery:

```bash
clio-coder --version
clio-coder library inspect wtfp --user --json
clio-coder library list --kind plugin --json
clio-coder library skills --all --json
clio-coder agents
clio-coder fleet list
clio-coder run '/wtfp:help'
```

`clio-coder run '/wtfp:help'` prints a static operator card without a model call: the start-here sequence, every action in workflow order with its argument hint, the actions this adapter cannot execute, and the two fleets. In the TUI, `/prompts` reports each prompt's source. A pre-existing user-level prompt can take precedence over a plugin prompt; Clio reports that source so the shadowing is visible. Back up and remove a stale prompt deliberately if you want the plugin copy to win. WTF-P will not overwrite it silently.

Use supervised `suggest` autonomy for ordinary work:

```bash
cd /path/to/proposal
clio-coder --autonomy suggest
```

Clio slash prompts inherit the session's tool surface; the host does not narrow tools per action. Deny and stop any shell, network, filesystem, or delegation call outside the displayed WTF-P action contract. Read-only mode is appropriate for previews. A Full Auto run can be useful for exploratory model testing, but it is non-certifying and does not remove the action's interviews or author gates.

### Optional Clio fleets

The two generated fleets are advanced, operator-invoked Clio primitives. Ordinary `/wtfp:*` actions do not invoke them implicitly:

```bash
clio-coder fleet validate wtfp-plan-section
clio-coder fleet validate wtfp-draft-review
```

Run a fleet with `clio-coder fleet run <fleet> --var section=<section-id>` (a model-backed run; this candidate's evidence covers `fleet validate` and `fleet list` only), and only after the slash orchestrator has established the required approved outline or section plan. The plan fleet runs `wtfp-section-planner` and then the read-only `wtfp-plan-checker`; the draft fleet runs `wtfp-section-writer` and then the read-only `wtfp-section-reviewer`. The workers create bounded artifacts, while the slash orchestrator remains responsible for approval, schemas, checkpoints, and state reconciliation.

Clio's fleet write-boundary enforcement requires a Git worktree in which `.planning/` and `paper/` are observable and not ignored. The fleets declare those directories with trailing slashes. If preflight cannot observe the boundaries, it should fail rather than broaden access or initialize a repository for you.

On Clio 0.4.9, a project whose `.gitignore` excludes either directory fails `fleet validate` with `write boundary: '.planning/' is ignored by .gitignore`. Run `git check-ignore -v .planning paper` to find the rule, and remove it if you use the fleets. The ordinary `/wtfp:*` actions do not need these directories tracked.

### Isolated Clio evaluation

Setting only `CLIO_CODER_CONFIG_DIR` changes one destination; it does not isolate Clio's home, XDG, state, cache, data, binary, and temporary roots. For a disposable evaluation, put all of them beneath one mode-0700 root and run both the installer and Clio through the same environment. The config, data, state, cache, and binary directories below are descendants of `CLIO_CODER_HOME`, as the prefix guard requires:

```bash
WTFP_CLIO_SANDBOX="$(mktemp -d /tmp/wtfp-clio.XXXXXX)"
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
  "$WTFP_CLIO_SANDBOX/home/clio/bin" \
  "$WTFP_CLIO_SANDBOX/home/npm-cache"

run_isolated_clio() {
  env -i \
    PATH="$PATH" \
    TERM="${TERM:-dumb}" \
    LANG="${LANG:-C.UTF-8}" \
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
    NPM_CONFIG_CACHE="$WTFP_CLIO_SANDBOX/home/npm-cache" \
    "$@"
}

run_isolated_clio npx --yes --package=wtf-p@0.7.3 -- wtf-p install clio --advanced
cd /path/to/disposable-proposal
run_isolated_clio clio-coder --autonomy suggest
```

`env -i` prevents ambient provider keys, npm credentials, and unrelated client variables from leaking into the run. The empty profile therefore has no model credentials unless you deliberately configure a Clio-supported isolated credential mechanism. Never copy, print, or embed credentials in a fixture or evidence trace. Remove the disposable root after preserving any non-secret evidence you need.

## Verify or remove an installation

The `status` and `doctor` commands remain legacy Claude-oriented. Passing a modern target selector to them does not establish that a Clio, Codex, or other modern adapter was discovered. Use the client's native discovery surface instead: `clio-coder library inspect wtfp --user --json` (with `clio-coder library skills --all --json`), `clio-coder agents`, and `clio-coder fleet list` for Clio; `claude plugin list --json` and `claude plugin details wtfp@wtfp` for Claude Code; `codex plugin list --json` for Codex; `copilot plugin list` for Copilot CLI; `opencode agent list` and `opencode debug skill` for OpenCode; `agy plugin list` and `agy agents` for Antigravity; `gemini extensions list` and `gemini skills list --all` for Gemini. [HOST_CAPABILITIES.md](HOST_CAPABILITIES.md) shows what each of those reported for this candidate.

Preview removal before deleting exact receipt-owned files:

```bash
npx --yes --package=wtf-p@0.7.3 -- wtf-p uninstall clio --dry-run
npx --yes --package=wtf-p@0.7.3 -- wtf-p uninstall clio --yes
```

Replace `clio` with the intended target. Uninstall preserves modified files and unrelated siblings by default. It removes client resources, not the academic project's `.planning/` or `paper/` data. For Clio, native `library remove` runs only when every file below the installed root is unchanged and receipt-owned.

Remove WTF-P from Clio with the WTF-P uninstaller rather than `clio-coder library remove wtfp` alone. The native command deletes the plugin files and registration but leaves WTF-P's `.wtfp-version` receipt in the Clio config directory. If that has already happened, `wtf-p uninstall clio --yes` reports the 204 files as already missing and removes the leftover receipt.

## Boundaries of this candidate

All seven host adapters discover the same 36 stable action routes. Availability is a complete adapter mapping, not a successful model run, and is recorded per host in each generated `compatibility/action-availability.json`. Clio Coder and Claude Code project 31 of 36 actions as available; Codex, Copilot CLI, OpenCode, Antigravity, and Gemini project 26 of 36. [HOST_CAPABILITIES.md](HOST_CAPABILITIES.md) lists which actions fail closed on which host and why.

Where a research route is available, `tool.execute` authorises exactly one command, the bundled `tools/wtfp-tool.js` dispatcher; run it with `--offline` until network use has been approved for the session. To reach the CiteNexus research backend, invoke `research-gap` for literature discovery or `check-refs` for citation audit (for example, `/wtfp:research-gap related-work Find related work with --backend=cite-nexus --providers=crossref,datacite,europe_pmc` or `/wtfp:check-refs Audit references with --backend=cite-nexus --providers=crossref,datacite,europe_pmc`), placing the explicit provider list in the author network approval; see [CITE_NEXUS.md](CITE_NEXUS.md) for candidate result boundaries and provider requirements. `create-poster`, `create-slides`, and `export-latex` emit source and return the render or compile step as an author handoff; none of them runs a renderer or LaTeX. `submit-milestone` creates a reproducible local archive; despite its historical command name, it does not submit to a journal, funder, or external service.

If an action returns `WTFP_ACTION_UNAVAILABLE`, do not ask the model to improvise around the refusal. If a project has materials but no portable manifest, initialize it with `new-paper` before `map-project`. If records disagree, stop, preserve them, and use `progress` or `verify-work` to inspect the mismatch before approving a repair. Deny and stop an unexpected shell, network, Git, broad-filesystem, or external-service request.

See [COMPATIBILITY.md](COMPATIBILITY.md) for exact client and model observations and their limits, and the [portable project protocol](../protocol/project/README.md) for record-level invariants.
