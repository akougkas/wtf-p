# WTF-P Agent Platform Modernization

Status: architecture implemented; final behavioral evaluation in progress; publication pending

Target release: `0.6.0-rc`

Last updated: 2026-08-29

Implementation branch: `feat/agent-platform-modernization`

## Why this document exists

WTF-P's academic-writing system is still valuable, but its delivery layer reflects an older agent ecosystem. The repository currently treats copied Claude, Gemini, and OpenCode command trees as separate products. That makes semantic drift likely, makes installation difficult to reason about, and prevents newer clients from receiving native behavior.

This record is the durable contract for the modernization. It deliberately separates the stable academic domain model from fast-moving client packaging. It also records the safety constraints and release gates that must survive long-running agent work, context compaction, and parallel implementation.

## Product decision

Preserve and strengthen the academic domain kernel. Replace the installation, adapter, and distribution layer.

The future system has four conceptual layers:

1. A portable project protocol under `.planning/` for research state, evidence, decisions, outlines, sections, checkpoints, and validation results.
2. Focused Agent Skills containing reusable academic methods, instructions, scripts, references, and templates.
3. Semantic contracts for explicit workflows, specialist agents, lifecycle effects, and optional tools. These contracts use capabilities such as `filesystem.read` and `research.search`, never a vendor's tool or model names.
4. Generated, validated native envelopes for Clio Coder, Claude Code, Codex, GitHub Copilot, OpenCode, Antigravity CLI, and Gemini CLI.

Portable standards are the floor, not an excuse to erase native ergonomics. Agent Skills, `AGENTS.md`, and MCP are useful common components. Commands, agent profiles, hooks, installation scopes, marketplaces, model names, and permissions remain adapter concerns.

## Canonical versus generated content

The following content is authoritative and edited by humans:

- Academic workflow bodies and supporting references
- Agent Skill instructions and assets
- Workflow invocation, argument, checkpoint, and effect declarations
- Semantic specialist-agent capabilities
- Portable project-state schemas and templates
- Target capability mappings and adapter policies

The following content is generated and must pass a reproducibility check:

- Claude command aliases and native agent frontmatter
- Codex plugin metadata and target-specific UI metadata
- Copilot agents, plugin metadata, and cloud-safe repository projections
- OpenCode commands and agents
- Antigravity plugin, command/skill, agent, rule, and hook projections
- Gemini TOML commands and extension resources
- Flat Clio prompt aliases required by current Clio releases
- Package inventories and installation receipts

Generated artifacts must carry a source identifier and generator version. CI must fail when regeneration changes tracked output.

## Target vocabulary and priority

Targets are explicit. The installer must never silently treat two clients as aliases.

| Target ID | Product role | Native package strategy | Priority |
| --- | --- | --- | --- |
| `clio` | Reference implementation and primary orchestration target | Clio extension, skills, prompts, strict agents, fleets | First |
| `claude` | First-class terminal agent | Claude plugin, skills, agents, hooks, compatibility commands | First |
| `codex` | First-class OpenAI terminal/app agent | Codex plugin and standard skills, native agents/hooks where supported | First |
| `copilot` | Local CLI and cloud coding agent | Native/Open Plugin envelope plus committed cloud projection | First |
| `opencode` | First-class open terminal agent | Skills, commands, agents, optional minimal JS plugin | First |
| `antigravity` | Primary Google consumer terminal target | Native `agy` plugin with version capability probes | First |
| `gemini` | Continuing enterprise/API-key and migration target | Gemini extension and TOML compatibility commands | Compatibility |

Google's consumer terminal transition completed on 2026-06-18. Antigravity and Gemini therefore remain distinct targets: `wtfp install antigravity` and `wtfp install gemini` have separate manifests, discovery probes, and support statements.

## Clio Coder as the reference adapter

Clio already has the strongest primitives for WTF-P's orchestration model: recursive Agent Skills, strict custom agent recipes, native dispatch/monitor/steer/task-ledger tools, extension hooks, isolated state directories, and fleet execution.

The initial WTF-P adapter must work with the current Clio release without modifying a user's normal home:

- Ship a self-contained extension.
- Expose flat compatibility prompts such as `prompts/wtfp-new-paper.md` (`/wtfp-new-paper`) for older shallow discovery. Do not use colon characters in filenames because they are invalid on Windows.
- Ship the native nested form beside each alias, such as `prompts/wtfp/new-paper.md`; Clio Coder 0.3.8 derives `/wtfp:new-paper` from it.
- Ship standard skills and extension-owned workflow resources.
- Install only explicitly owned agent and fleet recipe files.
- Resolve every resource from the extension root or a declared project root.
- Test with `HOME`, `CLIO_CODER_HOME`, `CLIO_CODER_{CONFIG,DATA,STATE,CACHE,BIN}_DIR`, and `TMPDIR` all pointed into the same disposable root. Per-role directories can override `CLIO_CODER_HOME`, so every value is set explicitly.
- Set `CLIO_CODER_REQUIRE_HOME_PREFIX=1` in isolation tests.

The coordinated changes merged into Clio Coder `v0.3.8` at `9b7b80cc`
provide the intended native UX:

1. Recursive namespaced prompt discovery, for example `prompts/wtfp/new-paper.md` becoming `/wtfp:new-paper`.
2. Extension manifest resource kinds for agents and fleets with exact ownership and lifecycle handling.
3. Prompt-relative or `${extensionRoot}` references with lexical and realpath containment checks.
4. Byte-faithful raw `$ARGUMENTS` after tokenized positional/slice expansion.
5. One extension-aware agent catalog for execution and fleet preflight.

`compatibility.clio` is currently parsed but not enforced, so compatibility must be capability-probed. The clean probe is whether `clio-coder extensions discover <bundle> --json` preserves `resources.agents` and `resources.fleets` in its normalized manifest. Extension agent recipes must resolve bound skills from their own extension skill root before global collision handling; a same-named untrusted project compatibility skill must never become an explicit worker path.

ADR 0001 selects packaged local transforms and no MCP server for the release
candidate. A network-only MCP service remains conditional on executable
security/lifecycle gates and a supported host gateway; no adapter may pretend
that a reserved manifest field activates a server.

## Skills and explicit workflows

Agent Skills provide reusable domain methods and progressive disclosure. Explicit workflows retain deterministic `/wtfp:*` entry points, arguments, state transitions, specialist dispatch, and human approval boundaries. A skill is not treated as a complete workflow schema.

The initial skill decomposition is intentionally small and intent-oriented:

| Skill | Stable actions it owns |
| --- | --- |
| `wtfp-start-project` | `new-paper`, `map-project`, `create-outline` |
| `wtfp-research-literature` | `research-gap`, `analyze-bib`, `check-refs` |
| `wtfp-plan-section` | `discuss-section`, `list-assumptions`, `plan-section`, `plan-revision`, `insert-section`, `remove-section` |
| `wtfp-write-section` | `write-section`, `execute-outline`, `quick` |
| `wtfp-review-manuscript` | `review-section`, `verify-work`, `polish-prose`, `audit-milestone`, `plan-milestone-gaps` |
| `wtfp-manage-project` | `progress`, `pause-writing`, `resume-writing`, `checkpoint`, `settings`, `add-todo`, `check-todos` |
| `wtfp-deliver-research` | `export-latex`, `submit-milestone`, `create-slides`, `create-poster` |

The remaining product operations—`help`, `update`, `report-bug`, `request-feature`, and `contribute`—remain compatibility actions but do not consume default academic skill trigger space. Help is generated from the action catalog; update delegates to the package/plugin lifecycle; maintainer actions may later become an optional skill.

The existing 36 `/wtfp:*` commands remain compatibility aliases during the release-candidate cycle. They must be generated from workflow records rather than maintained as copied bodies.

The 14 WCN files are not canonical: recompiling their Markdown counterparts currently produces zero byte-for-byte matches, and several WCN files contain hand-refined orchestration. Host-neutral Markdown becomes the sole workflow prose. WCN is retired for the initial migration and may return only as a deterministic, semantically evaluated compiler target.

## Semantic workflow and effect contract

Every workflow must declare enough information for adapters and safety checks to fail closed. The eventual schema will include at least:

```yaml
id: review-section
description: Review a drafted section against its plan and evidence.
skill: wtfp-review
invocation:
  explicit: true
  automatic: false
arguments:
  - name: section
    required: true
execution:
  isolation: project
  specialist: section-reviewer
capabilities:
  required:
    - filesystem.read
  optional:
    - research.search
effects:
  - kind: filesystem.write
    scope: .planning/reviews/**
    approval: implicit
  - kind: git.commit
    approval: explicit
```

Adapters must reject an unmapped required capability or effect. They must not broaden permissions, substitute an arbitrary model, silently commit, silently initialize Git, or drop an approval boundary.

## Installation ownership and safety invariants

Safety work precedes new targets. These invariants are release blockers:

1. Importing any CLI module has no side effects.
2. A noninteractive invocation without an explicit target (or a deprecated explicit Claude scope alias) does not install anything.
3. Each modern target maps to one documented native client root. `--config-dir` selects an explicit custom root; project-local installation is offered only where the client has a real project-scoped package model, including the deprecated Claude `--local` compatibility path.
4. Custom destinations reject filesystem roots, the user's home itself, the repository root, unsafe traversal, and paths that escape through symlinks.
5. The installer writes atomically where practical and records only files it actually created or replaced.
6. Receipts use repository-relative normalized paths and SHA-256 content hashes. They record target, scope, package version, adapter version, generator version, ownership action, and backup information.
7. Update does not advance the installed version when every candidate file was skipped or the transaction failed.
8. Uninstall consults the receipt and removes exact owned files only. It preserves files whose current hash differs unless the user explicitly forces removal.
9. Uninstall never recursively removes generic directories such as `bin/` or `mcp/`. It removes only empty ancestor directories inside the validated target.
10. Legacy installs are migrated conservatively. When ownership cannot be proven, report the files and leave them in place.
11. Repeating install, update, and uninstall is idempotent.
12. Failures leave a usable prior installation and report any recovery action.

No test may depend on a developer's real Claude, Codex, Copilot, OpenCode, Gemini, Antigravity, or Clio configuration.

## Distribution envelopes

The planned release artifacts are:

- A portable Agent Plugins 1.0 envelope containing standard skills and optional MCP descriptors.
- A Claude plugin/marketplace envelope, also validated through Copilot's Claude-compatibility ingestion path.
- A Codex `.codex-plugin` envelope with repository-local marketplace metadata.
- A native Copilot/Open Plugin envelope and committed project projection for cloud agents.
- A native Antigravity plugin.
- A Gemini extension for enterprise and migration users.
- An OpenCode filesystem bundle plus executable plugin only for behavior requiring hooks or custom tools.
- A Clio extension and resource library.
- The `wtfp` installer as a deterministic transaction engine over those manifests.

Repository-local marketplace metadata is allowed. Development must never register a marketplace or install a plugin in the operator's personal agent home.

## Test isolation contract

All tests run from a disposable project copy or package archive. Each client receives a disposable home and every supported client-specific directory variable. A sentinel outside the target verifies containment.

The matrix includes:

- Static schema and native plugin validators
- Reproducible-generation and clean-tree checks
- Import-safety and non-TTY no-op checks
- Root/home/traversal/symlink target rejection
- Fresh install, conflict, backup, skipped update, rollback, receipt migration, modified-file preservation, and idempotent uninstall
- Skill activation and non-activation evaluations
- Command/agent discovery in each installed client version
- One harmless end-to-end academic workflow in a fixture project
- Real Claude Code evaluation with the requested Sonnet high-effort configuration in an isolated pane
- Real Codex evaluation with an isolated `CODEX_HOME`
- Real Clio/herdr evaluation with isolated Clio state roots
- Copilot and OpenCode discovery/evaluation with isolated homes
- Antigravity and Gemini validation when their CLIs are available; otherwise schema fixtures plus an explicit unverified release note

Credentials may be forwarded only through the client's supported environment or an isolated copied credential store. Tests must not write session, cache, plugin, marketplace, or state data into the operator's normal profile.

## Execution phases and gates

### Phase 0 — safety and characterization

- Make CLI modules import-safe.
- Require explicit non-TTY installation intent.
- Add validated path containment.
- Introduce cryptographic exact-file receipts.
- Replace recursive uninstall behavior.
- Add isolated adversarial installer tests.
- Capture current compatibility behavior before changing formats.

Gate: the test suite cannot alter a real home, sentinels survive all paths, and exact ownership is demonstrated.

### Phase 1 — canonical kernel

- Version the `.planning` project protocol.
- Remove host-specific absolute paths and client syntax from canonical bodies.
- Author the focused standard skills.
- Define semantic workflow, agent, effect, hook, and optional MCP records.
- Generate the 36 legacy aliases and current vendor projections.
- Add skill activation and non-activation evaluation fixtures.

Gate: one canonical change regenerates every adapter deterministically, and existing workflows remain discoverable.

### Phase 2 — Clio reference adapter

- Ship and validate the self-contained Clio extension.
- Add agents and fleets with strict capability recipes.
- Implement the three coordinated Clio features on a separate Clio branch.
- Exercise prompt discovery, dispatch, steering, resumption, and receipts under disposable state roots.

Release-candidate gate: the complete extension is discovered, nested prompts expand with exact arguments and contained resources, agents/skills/fleets resolve from the owning extension, and no normal Clio state is touched. The paid full-lifecycle chain remains a `1.0.0` evidence gate rather than an unqualified `0.6.0-rc.1` claim.

### Phase 3 — native envelopes

- Add Claude, Codex, Copilot, OpenCode, Antigravity, and Gemini adapters.
- Probe target versions where documentation and behavior can diverge.
- Validate manifests, paths, frontmatter, tool mappings, and cloud-safe behavior.

Gate: every advertised target passes native discovery or is explicitly marked unavailable/unverified.

### Phase 4 — deterministic CLI and optional MCP

- Replace target flags with explicit target commands and deterministic native destinations while preserving deprecated target/scope aliases.
- Implement install plans, dry runs, atomic application, receipts, migrations, status, doctor, update, and uninstall for every target.
- Modernize or remove the research MCP server based on whether it adds value beyond deterministic local scripts.

Gate: every state-changing command is inspectable, contained, reversible, and covered by migration fixtures.

### Phase 5 — release candidate evaluation

- Run the full isolated client matrix.
- Score a harmless real-model entry workflow against an explicit judge rubric.
- Publish an honest capability matrix and migration guide.
- Release `0.6.0-rc`; reserve `1.0.0` for a fully validated matrix.

Gate: no known high-severity ownership or data-loss defect, no false first-class claim, and a clean package preflight.

The compiler-v4 Clio `new-paper` rerun is now observed at 8/8 with independent
validation of all five previewed records. Stable cross-version academic-output
baselines, the paid activation/non-activation matrix, corrected fleet execution,
and the paid Clio map/plan/draft/review/pause/resume chain remain distinct until
their retained evidence is complete. `COMPATIBILITY.md` reports that boundary
instead of converting planned coverage into observed evidence.

## Current execution ledger

- [x] Repository archaeology and baseline tests completed in a disposable home.
- [x] Current ecosystem, standards, packages, and client paths researched against 2026 documentation.
- [x] Clio extension, skill, agent, fleet, path, and isolation primitives inspected.
- [x] Modernization architecture approved by the repository owner.
- [x] Dedicated implementation branch created without altering the pre-existing `.gitignore` change.
- [x] Phase 0 installer hardening implemented with exact-file receipts, rollback, containment, and adversarial isolation tests.
- [x] Canonical source model accepted through executable catalog, workflow, skill, role, and project-schema fixtures.
- [x] Clio reference adapter implemented, including coordinated recursive prompts, extension agents/fleets, contained resources, and same-extension skill binding.
- [x] Native target envelopes implemented and reproducibly generated for all seven clients.
- [x] Copilot native marketplace/plugin envelope and committed `.github` repository projection generated from the same protocol.
- [x] Clio installation capability-probes agents, fleets, skills, and namespaced prompts inside a credential-free disposable probe home.
- [x] Isolated native discovery matrix completed for Claude, Codex, Copilot, Clio, OpenCode, Antigravity, and Gemini.
- [x] Real Claude Sonnet 5/xhigh, Codex xhigh, and Clio GPT-5.6 Terra/xhigh evaluations completed with normal-profile hash verification and credential cleanup.
- [x] Paid compiler-v4 Clio `new-paper` rerun completed at 8/8 with five-of-five independent schema validation.
- [x] MCP-versus-local decision recorded as local-first hybrid in ADR 0001; no server is shipped.
- [x] Versioned routing corpus, semantic rubric, fixtures, comparison tooling, and lifecycle/routing harnesses implemented.
- [x] Both Clio fleet contracts moved to canonical `protocol/fleets/*.md` sources and passed native Clio 0.3.8 validation with directory write boundaries.
- [x] First local `dynamo/qwen3.8-27b` lifecycle reading retained as a typed block at `new-paper`; no later action, process-boundary resume, or fleet execution was inferred.
- [ ] Complete and retain the paid routing matrix, corrected Clio fleet runs, full process-boundary lifecycle chain, and independent semantic assessment.
- [ ] Accumulate a cross-version observed academic-output baseline; unsupported historical targets remain unavailable rather than substituted.
- [x] Conservative v0.5-to-v0.6 client and project migration guide authored with rollback instructions.
- [ ] Publish `0.6.0-rc.1` after final human review; publishing remains deliberately outside the implementation run.

## Decisions intentionally deferred

- Whether a future network-only MCP service clears ADR 0001's activation gates after a supported Clio gateway exists. The release candidate decision itself is complete: local-first, no server shipped.
- Full lifecycle execution, paid skill activation/non-activation measurement, corrected fleet execution, and an observed cross-version academic-output baseline remain evidence gates until their exact retained results exist.
- A `1.0.0` date. First-class support is an observed compatibility claim, not a roadmap label.

Seven intent-oriented skills are now fixed for the release-candidate cycle. Generated target artifacts are committed with authenticated inventories so reviewers and CI can inspect reproducibility directly.
