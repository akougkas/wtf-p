# WTF-P 0.6 release-candidate compatibility evidence

Last exercised: 2026-08-28

First-class support in WTF-P means more than accepting a manifest. The generated envelope must pass the host's native discovery path in a disposable profile, preserve the canonical action/skill surface that host supports, and avoid writing to the operator's normal client state. The primary runtimes also receive a harmless real-model workflow evaluation.

## Native discovery

| Host | Exercised version | Observed result |
| --- | ---: | --- |
| Claude Code | 2.1.251 | Strict marketplace validation; native marketplace add/install/list; 36 commands and 11 agents loaded with zero plugin errors; `/wtfp:new-paper` confirmed through TUI autocomplete |
| Codex CLI | 0.144.1 | Native local marketplace and `wtf-p@wtfp` plugin install/list; seven Agent Skills discovered |
| GitHub Copilot CLI | 1.0.80 | Native marketplace install/list and Claude-compatible plugin discovery |
| Clio Coder | coordinated `feat/wtfp-extension-resources` branch | Extension discovery/install; 36 nested and 36 flat prompts; seven skills; 11 same-extension-bound agents; two fleets |
| OpenCode | 1.18.16 | Custom config root discovered seven skills and generated agents; commands use embedded portable resources |
| Antigravity CLI | 1.1.22 | Plugin validate/install/list; exactly 36 commands, 11 agents, and seven skills |
| Gemini CLI | 0.57.0 | Extension validate/install/list; seven skills and extension context discovered |

All discovery ran with disposable `HOME`, XDG, temp, and client configuration roots. Native registrations and caches were not written to the operator's normal profiles.

## Real workflow evaluation

The fixture is a harmless synthetic HPC-checkpointing research project with an explicit 3,500-word target, internal notes, no external citations, and author decisions. The rubric assigns two points each for evidence safety, portable-v1 correctness, approval boundaries, and a useful next action.

| Runtime | Exact model and policy | Outcome |
| --- | --- | --- |
| Claude Code | `claude-sonnet-5`, xhigh, restricted, isolated plugin/profile | 8/8. Created exactly the five requested `.planning` records. Independent Draft 2020-12 validation passed 5/5. No network or VCS effect. |
| Codex CLI | `gpt-5.4`, xhigh, read-only, approval `never`, `$wtfp-start-project` | 8/8. Returned a complete five-record preview; independent schema validation passed 5/5; worktree and HEAD unchanged. |
| Clio Coder | `gpt-5.6-terra`, xhigh, read-only, isolated extension/profile | 7/8 on compiler v3. Invocation arguments propagated correctly and all evidence/safety gates passed. It truthfully declined literal schema validation because extension schemas were outside project-scoped read tools. Compiler v4 addresses that exact cause by binding each action contract plus only its relevant schemas and templates into the expanded prompt. |

Codex was first asked for GPT-5.6, but the installed CLI rejected that model through its ChatGPT-auth route. The supported GPT-5.4/xhigh result is reported rather than relabeling the model.

The v4 compiler change is a context-delivery fix over the evaluated v3 workflow: it adds exact action/schema/template includes, prunes undeclared host tools, and changes no model identity or permission policy. Native validators and static self-containment tests cover the v4 projection; the 7/8 Clio score remains the conservative live claim until a later paid rerun.

## Isolation evidence

Live traces and non-secret fixture artifacts remain under `/tmp/wtfp-live-eval.FEmB4M` with mode `0700` for local inspection. Copied credential files were securely deleted after the runs. Preflight and postflight SHA-256 values for normal Claude, Codex, Clio, Copilot, and Antigravity credential/config files were byte-for-byte identical. Separate tmux processes and stale isolated Gemini process groups were terminated.

## Clio release boundary

The WTF-P extension declares the capability level expected from the coordinated Clio work: recursive namespaced prompt discovery, `${extensionRoot}` containment, extension-owned agents/fleets, and same-extension skill binding. Flat `/wtfp-<action>` prompts remain in the bundle for older shallow prompt discovery. Until the coordinated Clio change is released, the full agents/fleets/nested-prompt claim applies to the named branch rather than an older registry package.
