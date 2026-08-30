# WTF-P 0.6 release-candidate compatibility evidence

Last exercised: 2026-08-29

Upgrading an existing client or paper? Follow the [v0.5 to v0.6 migration guide](MIGRATION_V05_TO_V06.md) before replacing legacy files.

First-class support in WTF-P means more than accepting a manifest. The generated envelope must pass the host's native discovery path in a disposable profile, preserve the canonical action/skill surface that host supports, and avoid writing to the operator's normal client state. The primary runtimes also receive a harmless real-model workflow evaluation.

## Native discovery

| Host | Exercised version | Observed result |
| --- | ---: | --- |
| Claude Code | 2.1.251 | Strict marketplace validation; native marketplace add/install/list; 36 commands and 11 agents loaded with zero plugin errors; `/wtfp:new-paper` confirmed through TUI autocomplete |
| Codex CLI | 0.144.1 | Native local marketplace and `wtf-p@wtfp` plugin install/list; seven Agent Skills discovered |
| GitHub Copilot CLI and cloud projection | 1.0.80 (CLI) | Native marketplace install/list and Claude-compatible plugin discovery. CLI: 36 routes discovered, 24 adapter-available. Cloud: 36 prompts projected, five adapter-available. The committed `.github` projection also contains 11 agents, seven skills, instructions, and portable resources. |
| Clio Coder | 0.3.8, merged source `9b7b80cc` | Effective package discovery: 72 prompts (36 nested + 36 flat), 11 same-extension-bound agents, seven skills, two fleets, and zero diagnostics. The release gate passed 5,030/5,030 Clio tests. |
| OpenCode | 1.18.16 | Custom config root discovered seven skills and generated agents; commands use embedded portable resources |
| Antigravity CLI | 1.1.22 | Plugin validate/install/list; exactly 36 commands, 11 agents, and seven skills |
| Gemini CLI | 0.57.0 | Extension validate/install/list; seven skills and extension context discovered |

Native discovery counts routes that the client can locate, including
fail-closed compatibility stubs; it is not an executable-support count. Claude,
Clio, Codex, Copilot CLI, OpenCode, Antigravity, and Gemini currently project
24/36 canonical actions as adapter-available. The Copilot cloud projection
marks 5/36 as adapter-available.
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

All discovery ran with disposable `HOME`, XDG, temp, and client configuration roots. Native registrations and caches were not written to the operator's normal profiles.

Clio installation now runs its compatibility discovery in a fresh, credential-free profile. A legacy or unavailable client does not receive an unsupported full-capability claim: installation preserves the flat prompt/skill surface and reports the compatibility limitation. Native marketplace/plugin mutations are compensating operations, so a later activation or verification failure removes registrations created by that transaction. A bundle with preserved file conflicts is recorded as partial and is not newly registered. Installer v2 receipts record adapter contract v1 and generator v4.

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
thinking off. Clio ran interactively in an isolated full-auto profile with its
hard safety rails, worker permission fallback set to deny, network tools
disabled, and every client root under one disposable directory.

The run continued an already mapped NSF 25-531 fixture through
`create-outline`, `discuss-section`, `plan-section`, `write-section`,
`review-section`, and `pause-writing` for `problem-landscape`. It produced a
1,019-word provisional section, linked summary, `issues-found` write and review
validations, four author-accepted warning-class review debts, and a durable
handoff plus pending checkpoint. Independent validation passed all 25 portable
JSON records.

The first fresh-process `resume-writing` attempt failed before RC2 hardening.
It did not read the required durable records or cross the interactive author
gate, wrote an undeclared report, and described checkpoint/state changes that
never occurred. The real state correctly remained paused and schema-valid.

The post-hardening retry used WTF-P commit
`bfe8956a8fc3a0c5edbd8ce4a74f041b7d2f0374` and installed Clio inventory
SHA-256 `1e143685a035f3e507cb2ab816484211774009dd3f4ddd25fdc03a76b2f14956`.
A genuinely new Clio process read state, checkpoint, handoff, section, plan,
outline, decisions, config, manifest, validation, and manuscript resources;
called native `ask_user`; waited for the author to choose
`resume-plan-wave-2`; updated and read back checkpoint plus state; preserved
phase `reviewing`; and left state revision 7/active with no active checkpoint.
Independent canonical validation passed 25/25. A following `progress` action
made no project mutation and selected `plan-section` for
`tcr-fit-significance` as the next safe action.

This was an exploratory full-auto reading, not a safety certification. Clio
used contained read-only shell helpers; the pause record's pre-existing future
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

The sanitized compiler-v4 rubric, five records, validation report, trace
summary, exact argument receipt, and authenticated inventory are retained in
[`evaluation/v1/evidence/clio-new-paper-compiler-v4`](../evaluation/v1/evidence/clio-new-paper-compiler-v4/README.md),
with an executable 11-check verifier. Where still present, the fuller private
traces are under `/tmp/wtfp-live-eval.FEmB4M` and
`/tmp/wtfp-clio-v4-rerun.gydonK`; those temporary paths are optional local
evidence, not release dependencies. Copied credential files were securely
removed after the completed runs. Preflight and postflight SHA-256 inventories
for monitored normal client configuration and credential files were
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

This document records release-candidate evidence only. WTF-P `0.6.0-rc.1` was published to npm under `next` on 2026-08-29. RC2 publication and any coordinated client publication remain separate operator actions.
