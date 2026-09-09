# WTF-P 0.6 release-candidate compatibility evidence

Last exercised: 2026-09-09 (host factory round: Claude 2.1.267, Codex 0.153.3, and Clio 0.4.7 in disposable profiles; see `HOST_CAPABILITIES.md` for the commands)

Upgrading an existing client or paper? Follow the [v0.5 to v0.6 migration guide](MIGRATION_V05_TO_V06.md) before replacing legacy files.

First-class support in WTF-P means more than accepting a manifest. The generated envelope must pass the host's native discovery path in a disposable profile, preserve the canonical action/skill surface that host supports, and avoid writing to the operator's normal client state. The primary runtimes also receive a harmless real-model workflow evaluation.

## Native discovery

| Host | Exercised version | Observed result |
| --- | ---: | --- |
| Claude Code | 2.1.267 | Disposable `CLAUDE_CONFIG_DIR`: strict plugin/marketplace validation passed; `plugin details` reports 43 skills (36 commands + 7 skills), 11 agents, 3 hooks; headless Sonnet 5 `/wtfp:help` (6 turns) and `/wtfp:new-paper` reached the interview gate with no file written |
| Codex CLI | 0.153.3 | Disposable `CODEX_HOME` with `features.plugins = true`: marketplace add and `wtf-p@wtfp` install/list; `codex exec` with `gpt-5.6-luna` at `xhigh` loaded the manage-project skill for help (26/36 available reported) and the start-project skill for new-paper, stopping at the interview gate |
| Clio Coder | 0.4.7 | Disposable `XDG_CONFIG_HOME`: `plugins inspect` valid with zero diagnostics on the bundle carrying `display-only: true`; user-scope install, list, and `agents` discovery of all 11 recipes |
| Claude Code | 2.1.251 | Strict marketplace validation; native marketplace add/install/list; 36 commands and 11 agents loaded with zero plugin errors; `/wtfp:new-paper` confirmed through TUI autocomplete |
| Codex CLI | 0.144.1 | Native local marketplace and `wtf-p@wtfp` plugin install/list; seven Agent Skills discovered |
| GitHub Copilot CLI and cloud projection | 1.0.80 (CLI) | Native marketplace install/list and Claude-compatible plugin discovery. CLI: 36 routes discovered; 26 adapter-available in the current generated data (24 at the time of this observation). Cloud: 36 prompts projected, five adapter-available. The committed `.github` projection also contains 11 agents, seven skills, instructions, and portable resources. |
| Clio Coder | 0.3.8, merged source `9b7b80cc` | Prior extension route, retained as history. Effective package discovery: 72 prompts (36 nested + 36 flat), 11 same-extension-bound agents, seven skills, two fleets, and zero diagnostics. The release gate passed 5,030/5,030 Clio tests. |
| Clio Coder | 0.4.6 | Prior extension route, retained as history. Native discover: valid, zero diagnostics. Native user install/list: enabled `wtfp@0.6.0-rc.2`, zero diagnostics; 36 nested + 36 flat prompts on disk; all 11 `wtfp-*` agent recipes list their bound skills. Headless `/wtfp:help` completed on `dynamo/qwen3.8-27b`. |
| Clio Coder | 0.4.7 (dist) | Plugin route. Isolated user and project `plugins install`/`inspect`/`remove` lifecycle with exact receipts; see `docs/AGENT_PLUGIN.md` for the command and its scope. |
| OpenCode | 1.18.30 | Disposable config root: `agent list` shows the 11 `wtfp-*` subagents, `debug skill` the 7 skills, and the server API 36 `wtfp:<action>` commands; verifier agents report edit and bash denied. A dispatcher import side effect that exited the host at tool-registry start was found and fixed in this run |
| Antigravity CLI | 1.1.28 | `agy plugin validate`: 7 skills, 11 agents, 36 commands (converted to skills); install/list in a disposable home; `agy agents` lists all 11 with the schema-conformant manifest |
| Gemini CLI | 0.59.0 | Extension validate/install/list in a disposable home: enabled, context file and 7 skills listed, no diagnostics; agents have no listing surface and a headless run needs credentials this machine lacks |

Native discovery counts routes that the client can locate, including
fail-closed compatibility stubs; it is not an executable-support count. Per the
generated `compatibility/action-availability.json` files, Clio and Claude Code
project 31/36 canonical actions as adapter-available (`contribute`,
`report-bug`, `request-feature`, `remove-section`, and `update` fail closed).
Codex, Copilot CLI, OpenCode, Antigravity, and Gemini project 26/36: the same
five plus `analyze-bib`, `audit-milestone`, `check-refs`, `export-latex`, and
`research-gap`, whose `tool.execute` effect is bound only on Clio and Claude.
The Copilot cloud projection marks 5/36 as adapter-available.
Unsupported routes return `WTFP_ACTION_UNAVAILABLE` without receiving the
normal workflow, invocation arguments, or tool policy. Exact action-level
reasons are recorded in each generated
`compatibility/action-availability.json`.

Here, `available` means the adapter has a complete mapping for the action's
semantic capabilities, effects, and approval class. It does not claim that the
host enforces an action-scoped tool allowlist. In particular, Clio 0.3.8 prompt
templates become ordinary main-agent turns and inherit the session tool
surface. Its generated availability file therefore records
`hostToolEnforcement.actionScoped: false`, `surface: clio:session-tools`, and
an undeclared-tool disposition of `fail`. Preview certification uses
`read-only`; a mutating lifecycle must use supervised `suggest` autonomy and
the operator must deny and stop on undeclared tool requests. Strict dispatched
agents and fleets retain their separate recipe/tool-profile enforcement.

The earlier release-gate discovery ran with disposable `HOME`, XDG, temp, and client configuration roots. The separately reported 2026-09-09 Clio 0.4.6 observation used the operator's user installation; it is not an isolated lifecycle certification.

Clio installation delegates to the client's plugin lifecycle. The installer publishes the canonical bundle under its ownership receipt, stages it aside, runs `clio-coder plugins install <staged-dir> --user|--project`, and verifies the result with `clio-coder plugins inspect wtfp --json`. The entry must report `valid`, `enabled`, and `loadable` with zero diagnostics at the expected root path. Clio installs under `<config>/plugins/wtfp/` and owns the content digest, provenance, drift, and enable/disable state in `plugins/state.json`; WTF-P keeps only its separate v2 exact-file receipt. Without the binary, the bundle is staged at the same path and activation is explicitly pending until the operator runs native installation in that profile. An extra or modified file in the staged bundle defers native activation. Native registration and file publication are compensated if activation, verification, or receipt publication fails. Native removal runs only when the receipt proves every file below the installed root is unchanged and WTF-P-owned.

The following paragraph records the removed extension route and is retained as history. On 2026-09-09, Clio Coder 0.4.6 accepted `extensions discover vendors/clio --json` with zero diagnostics, installed the package with `extensions install vendors/clio --user`, and listed `wtfp` version `0.6.0-rc.2` enabled at user scope with zero diagnostics. `clio-coder agents` listed all 11 recipes with their bound skills. The retained JSON events for `clio-coder --no-context-files run --target dynamo --json "/wtfp:help"` identify model `dynamo/qwen3.8-27b` and a completed help response with stop reason `stop`. The final `agent_end` reports 1 measured API call, 14,360 input tokens, 2,729 output tokens, 17,089 total tokens (351 reasoning). The retained event stream and its one stderr line are checked in under [`evaluation/v1/evidence/clio-0.4.6-help-smoke`](../evaluation/v1/evidence/clio-0.4.6-help-smoke/README.md). No `new-paper`, gate behavior, fleet execution or project lifecycle result on 0.4.6 is claimed by this smoke run.


## Real workflow evaluation

The fixture is a harmless synthetic HPC-checkpointing research project with an explicit 3,500-word target, internal notes, no external citations, and author decisions. The rubric assigns two points each for evidence safety, portable-v1 correctness, approval boundaries, and a useful next action.

| Runtime | Exact model and policy | Outcome |
| --- | --- | --- |
| Claude Code | `claude-sonnet-5`, xhigh, restricted, isolated plugin/profile | 8/8. Created exactly the five requested `.planning` records. Independent Draft 2020-12 validation passed 5/5. No network or VCS effect. |
| Codex CLI | `gpt-5.4`, xhigh, read-only, approval `never`, `$wtfp-start-project` | 8/8. Returned a complete five-record preview; independent schema validation passed 5/5; worktree and HEAD unchanged. |
| Clio Coder | `gpt-5.6-terra`, xhigh, read-only, isolated compiler-v3 extension/profile | Historical 7/8. Invocation arguments and the evidence/safety gates passed. It truthfully declined literal schema validation because the schemas were outside project-scoped read tools. |
| Clio Coder | `gpt-5.6-terra`, xhigh, read-only, isolated compiler-v4 extension/profile | 8/8. The complete five-record preview independently passed 5/5 canonical schemas; exact raw invocation arguments, evidence safety, approval/effect boundaries, and a contract-compatible next action all passed. No project, network, or VCS mutation occurred. |

Codex was first asked for GPT-5.6, but the installed CLI rejected that model through its ChatGPT-auth route. The supported GPT-5.4/xhigh result is reported rather than relabeling the model.

The v4 run used Clio Coder 0.3.8, GPT-5.6 Terra, xhigh effort, and the
`openai-codex` target in a mode-0700 disposable root with every HOME, XDG,
temporary, and Clio-specific directory contained there. The exact 1,908-byte
raw payload retained both literal quotes and matched SHA-256
`88cb937f67e740270b63d65c21c011d1e523e7d0aef66177bd4380d271b91326`.
It took approximately 453.4 seconds. Clio reported an estimated USD
`1.5429764`; that value is preserved as client-estimated with unknown provider
metering provenance, not rounded or presented as a provider invoice. The v4
change binds the selected action plus only its relevant schemas/templates and
does not change the model or permission policy.

### Local Dynamo lifecycle reading

The first retained process-lifecycle reading used the same Clio 0.3.8 binary
digest with the local `dynamo` LM Studio target and `qwen3.8-27b`. Both
generated fleets first passed native validation. A high-effort `new-paper`
attempt was stopped after 1,133,725 ms with no writes or prohibited effects. A
fresh effort-off retry completed the Clio turn in 171,852 ms and produced the
five expected records; literal canonical schema validation passed 5/5.

The campaign stopped before `map-project`. The independent cross-record check
found section targets totaling 5,600 against an outline target of 6,000, and
native events recorded one explicitly forbidden `bash` attempt. Clio denied
that call in 17 ms and no shell effect occurred, which validates the host
safety boundary but does not make the model behavior compliant. The typed
[blocked result](../evaluation/v1/evidence/clio-dynamo-lifecycle-blocked/README.md)
therefore remains a regression reading; it is not an observed lifecycle
baseline. The local runtime reported zero cost counters, but no provider-priced
billing provenance exists, so cost is recorded as unavailable rather than as a
metered USD 0 claim.

This reading binds WTF-P `6b58b298` and generated source `4db9d040…`. It
predates later canonical remediation for exact outline totals and direct
tool use and is therefore evidence about that earlier source.

Three later local observations are retained separately under
[`clio-dynamo-rc-readings`](../evaluation/v1/evidence/clio-dynamo-rc-readings/README.md).
The `0245818` slash reading preserved exact arguments but produced zero records
after an agent-discovery loop. It also successfully listed contract-excluded
`.git` metadata and read an absolute host Clio documentation path outside the
authorized roots; both accesses were read-only, with zero mutating and network
effects applied. The `b4f0543` plan fleet completed both native steps with
semantic quality unmeasured. The `cbba38c` manuscript-path projection
observation proved the physical `paper/` projection and both write-boundary
windows, but it wrote without an approved plan, left JSON state unreconciled,
and failed the 595–805-word range with 304 words. These are commit-specific
remediation observations, not a passing lifecycle or fleet certification.

The subsequent current-source run under
[`clio-dynamo-current-source-blocked`](../evaluation/v1/evidence/clio-dynamo-current-source-blocked/README.md)
binds WTF-P `bf50e23`. It produced exactly five records and passed literal
schema validation 5/5, but failed both the cross-record dependency-wave check
and the no-shell boundary: three `bash` calls succeeded and ten retries were
denied. The operator stopped before `map-project`. Because the turn was
terminated at that failed gate, there is no terminal receipt and cost remains
unavailable.

### Corrected NSF 25-531 one-section UAT

A later operator-observed run used Clio source
`1eefee9494abc9bd174c8d0d6231729741ed75dc`, binary SHA-256
`f02f31c7480ac4f9532980f8df93e07816111626bdce9879e1ee9e98fd3ec162`,
and WTF-P corrections `c500b4a21c6befdd6bfcc7971eeef27201aff79c`
and `8707b3bf397b7c9b895e8f9a745e6a039c5b84fb`. The requested local model
was `qwen3.8-27b`; the observed wire model was `qwen3.8-27b-dynamo`, with
thinking off. Clio ran interactively in one isolated profile, using supervised
`suggest` through outline/plan before the operator switched it to `full-auto`
for write/review/pause and the later resume/progress. Hard safety rails remained
enabled, worker permission fallback was deny, network tools were disabled, and
every client root was under one disposable directory.

The defect-finding run continued an already mapped NSF 25-531 fixture through
`create-outline`, `discuss-section`, `plan-section`, `write-section`,
`review-section`, and `pause-writing` for `problem-landscape` before the final
RC2 write/review/pause hardening. It produced a provisional section whose
persisted writer/state whitespace count was 1,019; the independent review's
different tokenizer counted 1,026. It also produced a linked summary,
`issues-found` write and review validations, four author-accepted warning-class
review debts, and a durable handoff plus pending checkpoint. Independent
validation passed all 25 portable JSON records.

The first fresh-process `resume-writing` attempt failed before RC2 hardening.
It did not read the required durable records or cross the interactive author
gate, wrote an undeclared report, and described checkpoint/state changes that
never occurred. The real state correctly remained paused and schema-valid.

The post-hardening retry used canonical-input HEAD
`bfe8956a8fc3a0c5edbd8ce4a74f041b7d2f0374` with generated working-tree Clio
inventory SHA-256
`1e143685a035f3e507cb2ab816484211774009dd3f4ddd25fdc03a76b2f14956`;
that exact generated bundle was first committed in
`93617d24a1fe4438239534a2d4fab067530dc026`.
A genuinely new Clio process read state, checkpoint, handoff, section, plan,
outline, decisions, config, manifest, validation, and manuscript resources;
called native `ask_user`; waited for the author to choose
`resume-plan-wave-2`; updated and read back checkpoint plus state; preserved
phase `reviewing`; and left state revision 7/active with no active checkpoint.
Independent canonical validation passed 25/25. A following `progress` action
made no project mutation and selected `plan-section` for
`tcr-fit-significance` as the next safe action.

The final RC2 write/review/pause corrections have deterministic regression
coverage but were not followed by a second end-to-end model rerun. The
post-hardening model reading covers resume/progress only.

This was an exploratory mixed-autonomy reading, not a safety certification.
During its `full-auto` phases Clio used contained read-only shell helpers; the pause record's pre-existing future
timestamp makes strict event ordering imperfect; and progress prose described
the four validation files inaccurately as “4 of 6 passed” rather than two
`passed` and two `issues-found`. `research-gap` remained adapter-unavailable,
no external literature was supplied or mapped, and the provisional section
contains zero citations. Runtime cost is unavailable rather than reported as
metered USD 0. The normal credentials and GitHub-host hashes were unchanged;
the normal Clio settings hash changed concurrently, while the running UAT
process independently showed every HOME, XDG, temporary, and Clio-specific
root inside the disposable tree. This temporary observation is not a retained,
replayable baseline.

## Isolation evidence

For the earlier compiler-v4 `new-paper` run, the sanitized rubric, five records, validation report, trace
summary, exact argument receipt, and authenticated inventory are retained in
[`evaluation/v1/evidence/clio-new-paper-compiler-v4`](../evaluation/v1/evidence/clio-new-paper-compiler-v4/README.md),
with an executable 11-check verifier. Where still present, the fuller private
traces are under `/tmp/wtfp-live-eval.FEmB4M` and
`/tmp/wtfp-clio-v4-rerun.gydonK`; those temporary paths are optional local
evidence, not release dependencies. Copied credential files were securely
removed after the completed runs. Preflight and postflight SHA-256 inventories
for that run's monitored normal client configuration and credential files were
byte-for-byte identical. Separate evaluation processes and stale isolated
process groups were terminated.

The Claude and Codex 8/8 results above are historical operator-observed
evidence. Their temporary raw packs are no longer present, so they are not
independently replayable from this repository. The checked-in Clio compiler-v4
pack is the retained executable evidence for the paid entry workflow.

## Clio release boundary

The WTF-P extension consumes the resource surface merged into Clio Coder
`v0.3.8`: recursive namespaced prompt discovery, `${extensionRoot}`
containment, extension-owned agents/fleets, same-extension skill binding, and
preservation of nested resources named `state.json`. Package-level exercise
loaded all 11 agents from source `extension`, both two-step fleets, all nested
and flat prompts, and the seven skills. The nested
`project/templates/state.json` survived installation byte-exact while the
extension-manager's package-root `state.json` was correctly excluded. A
reserved built-in agent still cannot be shadowed and `coder` continues to
resolve to source `builtin`.

Two coordinated patch-release fixes matter to WTF-P behavior. Clio issue #240
preserves byte-exact raw `$ARGUMENTS` while retaining tokenized `$1`, `$@`, and
slice semantics. Clio issue #241 makes `fleet validate` and `fleet graph` use
the same extension-aware agent catalog as fleet execution. WTF-P also corrected
its own fleet contracts from the literal-file boundaries `.planning` and
`paper` to the directory boundaries `.planning/` and `paper/`; the former shape
was observed to roll back a real nested planner output at the write-boundary
gate.

Neither fleet is hidden behind an ordinary `/wtfp:*` command. They are explicit
expert entry points invoked with
`clio-coder fleet run wtfp-plan-section --var section=<id>` and
`clio-coder fleet run wtfp-draft-review --var section=<id>`; the action
orchestrator must still perform approval, plan linkage, and portable-state
reconciliation around the native worker steps.

Clio 0.3.8 parses and stores `compatibility.clio` but does not enforce it
(tracked as Clio issue #242). WTF-P therefore uses its credential-free
capability probe as the authoritative compatibility gate. Flat
`/wtfp-<action>` prompts remain for older shallow discovery, but those older
clients do not receive an agents/fleets claim. A pre-existing user-level prompt
can legitimately take precedence over the extension's namespaced prompt; the
client discovery listing reports the selected source, and WTF-P does not delete
the user's copy.

## Evidence not yet claimed

The compiler-v4 `new-paper` result does not stand in for the broader studies.
Model-backed execution now exists for both corrected fleets, but neither the
separate structural plan observation nor the failed draft observation is an
accepted end-to-end fleet result. No completed claim is made here yet for a
full seven-section proposal, the paid nine-action Clio lifecycle chain, the paid Claude/Codex/Clio activation matrix,
or an observed cross-version academic-output baseline. The versioned
fixtures, rubrics, and fail-closed runners exist under `evaluation/`; their
static contract tests remain a different evidence level from model execution.

This document records release-candidate evidence only. WTF-P `0.6.0-rc.1`
was published to npm under `next` on 2026-08-29. WTF-P `0.6.0-rc.2` was
published under the same tag at `2026-08-30T03:18:49.692Z` (2026-08-29 in
the operator's CDT timezone), and `next` now resolves to RC2. The immutable
registry artifact has SHA-1
`f47a280a83b808f7a130607bf1042323eff6cb82`, SHA-512 integrity
`sha512-XPirVlq5SPgZGGYMFw9Sf2zAHot6++rUxlalndD0qzCgWHcdQQHAWk4pZ1qluJICYXqNgSiBEBYCuGfn/UHD0Q==`,
1,828 files, a 1,160,693-byte packed size, and a 7,797,078-byte unpacked
size. A local archive reproduction matched those registry facts.

A fresh registry installation then selected the artifact explicitly with
`npx --yes --package=wtf-p@0.6.0-rc.3 -- wtf-p install clio` inside a
mode-0700 disposable HOME/XDG/Clio/npm environment. It reported RC2, installed
233 files, preserved the nested project `state.json`, and exposed 72 prompts,
11 extension agents, seven skills, and two valid fleets to Clio Coder 0.3.8.
The same host demonstrated why the explicit package selector matters: the
shorter `npx wtf-p@0.6.0-rc.3 ...` form was shadowed by an already installed
global v0.5 executable under npm 11.6.0. Documentation therefore uses the
unambiguous `--package … -- wtf-p` form.

Migration feedback and any coordinated client publication remain separate
gates; neither installation nor publication upgrades the partial lifecycle
evidence above into a completed behavioral claim.

## Standard plugin development integration (2026-09-09)

Compiler v5 added the standard Agent Plugins bundle at `vendors/plugin/`; at the time of this observation the Clio extension projection still existed alongside it, and it has since been removed so that the plugin is the only Clio route. Against the coordinator-supplied development build at `dist/cli/index.js` (reported version 0.4.7; entry-file SHA-256 `ea51cba8d661d6573ecf4ad1ace281f19cf5ca0bbb00034676188203cc451848`), isolated user and project native plugin lifecycles passed: standard manifest inspection, exact-file receipt verification, enabled/valid/compatible/effective/loadable discovery, discovery of all eleven agents, both fleet validations, idempotent reinstall, disabled-plugin reactivation, and symmetric removal.

This identifies the entry file, not a full distributed-build digest. The reproducible test is `test/clio-native-integration.test.js`, invoked with an explicit `WTFP_CLIO_ENTRY`. It forwards no credentials and makes no model call. Fleet validation uses an existing disposable Git fixture because native write-boundary enforcement requires a checkout; research actions never initialize one. These observations establish native packaging/lifecycle behavior and do not claim a new model-backed research workflow result. See [AGENT_PLUGIN.md](AGENT_PLUGIN.md) for the plugin lifecycle the installer follows, and [RESEARCH_HANDOFF.md](RESEARCH_HANDOFF.md) for import constraints.

## Known limitations (2026-09-09 writing exercise)

Recorded from a headless writing exercise against Clio 0.4.7 and `dynamo/qwen3.8-27b`. None of
these is a WTF-P packaging defect, and none is changed by the fix rounds that followed.

- Headless `clio-coder run` cannot satisfy a WTF-P `user.gate`. The gate binding accepts only the
  structured value returned by `ask_user`, which is registered in the TUI and not in headless
  runs, so the first gated step of every writing workflow ends as a blocked task. That is the
  intended safety outcome; there is no documented headless path to pre-answer a gate, and the
  prompt explicitly rejects invocation arguments as a substitute.
- Local-model latency. One `new-paper` turn on `dynamo/qwen3.8-27b` needed six model calls of
  roughly 90 s each, driven by a prompt of about 50 KB of inlined schemas, and did not finish in a
  10-minute budget. The writing workflows are not practical on that target without reducing the
  inlined schema set.
- Clio reads `~/.claude/skills` regardless of `CLIO_CODER_*`. That is Clio interop behaviour and out
  of WTF-P's scope. Isolation claims that rely only on `CLIO_CODER_*` are incomplete; the
  reproducible WTF-P tests also redirect `HOME`, so their evidence stands.

## Final portability check (2026-09-09)

Claude Code 2.1.266 accepted the generated marketplace and the explicitly selected `.claude-plugin/plugin.json` in disposable, credential-free staging. An invalid manifest-name control failed as expected. A deliberately invalid agent `tools` value still passed both manifest validation routes: `claude plugin validate` validates manifests and does not establish native agent metadata or tool-enforcement correctness. The directory form selected the marketplace manifest, so the plugin manifest was also validated explicitly. No plugin was installed into the operator profile, no agent was dispatched, and no model call was made.

The compiler contracts separately check Claude's `tools` field and all eleven generated role definitions. An independent comparison confirmed canonical handoff actions, mapping workflow, and outliner content across all seven local host bundles plus the standard bundle. All 312 relative skill links in those bundles resolved inside their package. All three handoff actions remain adapter-available. At the time of this check `research-gap`, `analyze-bib`, and `check-refs` were unavailable because exact tool execution was unbound; they are now bound on Clio and Claude through the bundled dispatcher and remain unavailable on the other five hosts (see the availability paragraph above). These static checks do not replace host execution evidence. Exact Clio, Claude, Codex, and Gemini entry-point spelling is documented in [RESEARCH_HANDOFF.md](RESEARCH_HANDOFF.md).
