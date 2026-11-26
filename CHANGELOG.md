# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-26

WTF-P is now PanWrite, published by PanStudio. The package, commands,
plugins, desk extension, markers and environment variables all carry the new
name. Nothing reads the old names and no aliases are installed: remove an
existing WTF-P install with the old package's uninstaller, then install
PanWrite with `npx @panstudio/panwrite install <host>`.

### Changed

- **Breaking:** the product is renamed from WTF-P to PanWrite and the
  repository moved to https://github.com/PanStudio/panwrite
- **Breaking:** the npm package is `@panstudio/panwrite`. The `wtf-p`
  package receives no further releases
- **Breaking:** the slash commands are `/panwrite-*` (`/panwrite:*` in plugin
  namespaces), the skills are `panwrite-*`, the agents are `panwrite-*`, the
  plugin and marketplace are `panwrite@panwrite`, and the PanCode desk
  extension and skin are `panwrite`. Generated inventories are
  `.panwrite-generated.json`, receipts and locks use `.panwrite-*` names,
  environment variables use the `PANWRITE_` prefix, and schema identifiers
  live under `https://schemas.panwrite.dev/`
- **Breaking:** the PanCite companion (formerly CiteNexus) is reached as
  `citation-search --backend=pancite` through the `pancite-panwrite` command,
  which `PANWRITE_PANCITE_COMMAND` may name. The exchange schema is
  `pancite.panwrite/v1` with each result's provenance under `pancite`, and the
  MCP server id is `pancite`. The setup guide is `docs/PANCITE.md`
- The licence changes from MIT to Apache-2.0, copyright PanStudio, with a
  `NOTICE` file

### Removed

- **Breaking:** the `/wtfp-*` and `/wtfp:*` commands, the `wtfp-*` skills and
  agents, and the `wtfp`, `wtf-p` and `wtf-p-uninstall` executables. The
  executables are now `panwrite` and `panwrite-uninstall`
- The installer no longer treats a plugin manifest or receipt named
  `write-the-f-paper` as its own

## [0.9.1] - 2026-11-25

Fixes from running WTF-P 0.9.0 in PanCode 0.9.0. Both playbooks finish, a
resumed project is active again, and the actions PanCode cannot run cost no
model call.

### Fixed

- PanCode playbook workers wrote section artifacts to a top-level `sections/`
  directory, so the fleet rolled their writes back and neither playbook
  finished. Every PanCode agent recipe now maps `project://` URIs to workspace
  files, and each playbook names the file each of its declared writes goes to
- Answering `resume` on a pause checkpoint left `state.status` at `paused`.
  The desk now sets it to `active` in the same commit as the answer, and
  `expire` leaves the project paused. `pause-writing` names both options
- `contribute`, `remove-section`, `report-bug`, `request-feature` and
  `update`, which PanCode cannot run, are display-only prompts on PanCode.
  PanCode prints the refusal without calling a model
- A freshly outlined project failed validation because new section records
  linked plan and review files no action had written. `create-outline` and
  `insert-section` now start a section with empty artifact lists, and the
  desk's `record` tool refuses a section write that links a missing artifact
  file or adds a claim id another claim already holds
- The desk's help card showed 18 of 37 actions; it now lists them by group.
  Ledger labels no longer clip, validate findings are a list instead of a
  clipped table, the write-guard notice reads as a sentence, and the author's
  card for a gate answer leaves out the instructions meant for the model
- The README names the desk's `Ctrl+G` chords
- `npm run release` printed local `npm publish` steps. It now names the tag
  push and the approval in the "Publish to npm" workflow
- Preflight ran the whole suite as one 600 s step, which a busy machine
  could exceed. It now runs each suite file as its own step, several at a
  time, and stops a step only after 300 s with no output. The suites no
  longer put a 10 to 120 s limit on the processes they spawn, which killed
  correct installs on a loaded machine
- The evaluation routing matrix and the `hpc-checkpointing` baseline were
  resealed for the changed envelopes

## [0.9.0] - 2026-11-25

PanCode replaces Clio Coder as WTF-P's native host. The installer target,
the generated packages, the desk extension and the evaluation campaign all
name PanCode now. The old `clio` target is removed with no alias, and nothing
reads the old names: reinstall with `npx wtf-p install pancode`.

### Changed

- **Breaking:** the installer target is `pancode` (`--pancode`). It installs
  `plugins/wtfp` and `extensions/wtfp` under PanCode's config root, which it
  resolves as PanCode does: `PANCODE_CONFIG_DIR`, then `PANCODE_HOME/config`,
  then the platform default. Registration runs through `pancode hub` and
  `pancode extensions`, and project installs land under `.pancode/`
- The generated PanCode packages moved to `pancode/plugin/` and
  `pancode/extension/`; `vendors/plugin/` and `vendors/clio-extension/` are
  gone. Their compiler targets are `pancode-plugin` and `pancode-extension`
- The plugin and agent namespace is `dev.pancode`, in the PanCode plugin and
  in the Claude envelope that carries the fleets
- The desk extension's source moved from `clio/` to `hosts/pancode/`. Its
  manifest is `pancode-extension.yaml` with `compatibility.pancode: ">=0.9.0"`
  and an MIT licence, and its runtime imports `pancode/sdk/extension` and
  `pancode/sdk/testing`
- The evaluation campaign runner is `evaluation/tools/run-pancode-campaign.js`
  (`--pancode-entry`, `PANCODE_*` profile variables). The never-run
  `clio-0.6.2-reference` campaign is replaced by `pancode-0.9.0-reference`,
  which pins a PanCode build, under campaign schema v3. Each step runs with
  `--output-format stream-json` and the remaining budget as
  `--max-cost-usd`; cost comes from `pancode telemetry` and is reported as
  unavailable, never zero, when PanCode cannot price a call. The draft
  `clio-reliability-comparison` study becomes `pancode-reliability-comparison`
  and runs on the new campaign
- The evaluation routing matrix and the `hpc-checkpointing` baseline were
  resealed for the moved and restamped envelopes; sealed evidence ids are
  unchanged

### Removed

- The `clio` installer target and the `--clio` flag. Both are refused as
  unknown

## [0.8.5] - 2026-11-21

Generated CLIO Coder agents no longer declare `readReserve`. CLIO Coder 0.8.5
removed that recipe key with no alias, so a recipe that still named it failed
to parse. The 11 generated agents under `vendors/plugin/ai.iowarp.clio/agents/`
and `vendors/claude/ai.iowarp.clio/agents/` now declare
`budget: {toolCalls, synthesis}` only. Tool-call limits are unchanged.

### Fixed

- The adapter compiler no longer emits `readReserve` in the `budget` of Clio
  role recipes

### Changed

- The evaluation routing matrix and the `hpc-checkpointing` baseline were
  resealed for the new adapter hash

## [0.8.4] - 2026-11-16

Republishes 0.8.3 as tagged. The `wtf-p@0.8.3` package on npm was packed
from a working tree that held uncommitted desk work, so three of its 1,956
files differ from the `v0.8.3` tag: `vendors/clio-extension/runtime/extension.ts`,
its test file, and `vendors/clio-extension/.wtfp-generated.json`. 0.8.4 ships
exactly the 0.8.3 sources; no protocol, prompt or desk behavior changes.
Install 0.8.4 instead of 0.8.3.

### Fixed

- `npm publish` runs `scripts/publish-guard.js` as `prepublishOnly`, so a
  bare publish can no longer skip the release checks. It refuses a working
  tree with any change or untracked file, a `HEAD` without the exact
  `v<version>` tag, and an archive that would include a file git does not
  track. The `prepack` adapter check alone passed for 0.8.3 because the
  generated files matched their uncommitted sources

## [0.8.3] - 2026-11-16

Takes WTF-P on Clio from a fresh drive to brownfield revision: re-reviewing
delivered sections, sending one back with an author note, approving the
revision plan, rewriting, accepting, and re-delivering the milestone. Each fix
below came from a stall in that run on Clio Coder 0.8.3 (a pre-release build
of `f7c151449`, then the official release), with `gpt-6-luna` as the
orchestrator and writer and `gpt-6.1-terra` as the reviewers. The desk
extension tests pass 61/61 on the official Clio 0.8.3. The other six hosts
were not requalified; their projections change only in `review-section`'s
shared workflow text.

### Fixed

- `review-section` judges the current draft against the section's goal,
  claims, decisions and the plans that shaped its content; a revision plan's
  preservation or no-change criteria govern that revision alone. Live, a
  re-review of a delivered section failed only on an earlier title-only
  plan's "body unchanged" rule
- A reviewer's fail verdict is the review's result: `review-section` records
  the review and an `issues-found` validation. On Clio the binding says
  Clio's "validation failed" label on such a run is the finding, not a
  failed run; the action had recorded nothing
- On Clio a section writer leaves the word count to the action that
  measures with the desk, and a count it cannot take never blocks it.
  Live, the Introduction writer saved its revision and returned blocked
  because a Clio worker holds no counter
- The desk counts an approved plan as applied only when its draft is
  written and `write-section` has validated it since the approval; a saved
  but unvalidated draft goes back to `write-section`, whose step names what
  it still owes. Live, the half-finished revision went straight to review
- A step the desk arms again after progress says it continues on purpose
  instead of repeating the first arming's words, which the model took for
  a loop
- An action that creates its own checkpoint asks its gate question only
  through the desk gate, never first with `ask_user`, so the author answers
  once
- Every driven step says it is a procedure, not a capability. Live, the
  model looked for a tool named `audit-milestone`, found none, and stopped
  the drive

## [0.8.2] - 2026-11-16

Makes WTF-P on Clio automatic between author gates without making it
autonomous across them, and brings the Clio documentation and prompts in line
with Clio 0.8's two autonomy levels.

`/wtfp:advance` drove a seven-section technical report from outline to an
archived, delivered milestone on the released Clio Coder 0.8.2, with OpenAI
Codex models (`gpt-6-luna` as the orchestrator and writers, `gpt-6.1-terra`
as the plan checker, reviewers and polisher). Each fix below marked live came
from a stall in that run. The desk extension tests pass 61/61 on Clio 0.8.2.
Both Clio packages still require Clio 0.6.3; resuming a drive after a
continued turn needs the turn origin Clio 0.8.2 reports, and an older Clio
ends the drive there as before. The other six hosts were not requalified for
this release: their projections change only where shared protocol text and
action contracts changed (`research-gap`, `plan-section`, `write-section`,
`plan-revision`) and in the smaller record-schema bindings.

### Added

- `advance` (`/wtfp:advance`), action 37. It requires the new `workflow.drive`
  capability, which only the Clio desk binds; every other host and the
  desk-less Clio copy in the Claude envelope fail closed with
  `WTFP_ACTION_UNAVAILABLE`. In one turn it runs `create-outline`,
  `discuss-section`, `research-gap`, `plan-section`, `write-section`,
  `review-section`, `verify-work`, `plan-revision`, `audit-milestone` and
  `submit-milestone` as the project needs them, and stops at the first gate only the author can answer
- Desk tool `next_step`, answering only inside an advance turn: it picks each
  step by the ladder `progress` follows and arms the write guard for that
  action and section alone, puts a pending gate to the author through `gate`,
  and stops on a gate kept pending or unaskable, a step that changed nothing,
  an action the plugin does not serve, a missing project, or 24 steps. Nothing
  is armed between steps, at a gate, or after a stop
- Desk key `a` fills `/wtfp:advance`
- Desk tool `status`: the whole project in one read (phase, each section's
  status, words, plan state, unsupported claims and blockers, open gates,
  evidence counts, record issues, and the next step). Every Clio-available
  action gets the desk projection; read-only actions hold only `status`,
  `read_record`, `readiness`, and `gate` where they declare one
- Desk `turn_start` hook: when a prompt arms a WTF-P action or advance in a
  project, the desk injects its status as a model reminder within Clio's
  2,000-character effect limit
- Desk `after_tool` hook on `write` and `edit`: a successful write to the
  manuscript of a section the armed action may update is noted, once per
  section until measured, with the exact `measure_section` call. It spends none
  of the turn's shared continuation budget
- Desk tool `archive`, held only by an armed action that declares the
  archive (`submit-milestone`): it copies every `.planning` record and
  artifact and every `paper/` file into `.planning/archives/<archive>/` with a
  sha256 `manifest.json`, never follows links, and refuses an archive that
  exists. Live, the model could not copy a whole project with its record and
  file tools within a turn
- `read_record` takes a family URI such as `project://sources` and returns its
  records in one call, up to 48 KB, with `?after=<id>` for the next page
- A gate answer may carry the author's note on the chosen option; the desk
  records it in the checkpoint's resolution summary, where the next step
  reads it, and asks again with how to attach it when the author types text
  instead of choosing

### Changed

- The desk's write guard also hooks `ask_user` inside a WTF-P action or advance
  run: it marks a lone question `operator_only`, which Clio 0.8 never answers
  with a recommended option after `safety.unattendedAfterSeconds`, and refuses a
  round of several unmarked questions. Every Clio prompt now asks the same of
  the model
- Clio launch instructions use `--autonomy yolo` (README) and `default`;
  Clio rejects the retired `read-only`, `suggest`, `auto-edit` and `full-auto`
  spellings since 0.5.6. The CiteNexus public-index allowance is keyed to
  `yolo` on Clio and to a session started without per-call approvals in the
  host-neutral protocol
- Clio availability records `certificationAutonomy: ["default"]`
- Clio desk prompts load their method skill through `context(scope="skills")`,
  which Clio keeps across compaction, instead of inlining it; state each desk
  tool's argument shape, so the model calls it without a gateway `describe`
  that resends the whole context; and name the bound contract for lookup
  instead of reading it before acting. `advance` drops its union record
  contract, since each step's prompt carries its own
- Every `next_step` result restates the driver rule and where its step's
  prompt lives, so a compacted advance turn can continue from the last result
- Clio recipes carry per-role `latencyClass` and tool-call budgets, the four
  read-only checkers load no project context, and each carries the role-result
  object shape instead of the embedded schema. The 11 recipes total 67587
  bytes, down from 79061 in 0.8.1
- `clio/README.md` no longer says a `fleet run` runs no desk hook; Clio 0.6.3
  and later run the desk's tool hooks for its workers
- `/wtfp:advance` drives the author's acceptance loop: after a section is
  reviewed it runs `verify-work`, which closes on one sealed accept/revise
  checkpoint; revise routes to `plan-revision`, an approved revision plan to
  `write-section`, and accept marks the section complete. A review counts
  only for the draft it read, judged by the desk's own file times, and a
  drafted section follows this ladder whatever its status field says. On
  every host, `verify-work` declares the checkpoint and `plan-revision` sets
  the section to `planned` when it links the plan
- The ladder, portable and desk, creates the outline's section records with
  `create-outline` before any section step; `new-paper` writes none
- Clio prompts ask one question per `ask_user` call with its options, state
  only the gate branch an action can take, map authored-artifact URIs to
  their files, ask every dispatch for an agent and workspace-relative
  `intent.read_roots`, keep every record field inside `record`, and tell a
  record-only action (`create-outline`, `analyze-bib`) to do its writing
  role's work in the turn
- `research-gap` and `advance` hold the four read-only CiteNexus MCP lookups
  (`mcp_cite-nexus__search-papers`, `resolve-paper`, `verify-citation`,
  `get-citation`) and call them directly; the bundled dispatcher is the
  fallback only when no `cite-nexus` server is declared
- The four read-only reviewer recipes return only a verdict and checks, lead
  with that output form, and end on an example; action prompts read a
  reviewer's failed checks as its findings
- The protocol's workflow rules, on every host, say an author's request never
  widens an action's outputs, and to read a large source by section;
  `write-section` sets a satisfied draft to `reviewing` and
  `discuss-section` leaves the status alone
- `research-gap` records each claim its section must support with that
  claim's evidence, and the desk routes a literature-heavy section whose
  record names no live claim to `research-gap` before planning and holds its
  manuscript
- `plan-section` returns a failing plan check's findings to the planner and
  checks the revision afresh, at most twice; a finding that contradicts an
  author decision goes to the author, each check is recorded as a
  validation, and a plan still failing ends on a checkpoint naming its open
  findings. Live, a failed check ended the action with nothing recorded
- `write-section` opens a manuscript with the outline title as its only
  level-one heading; numbering stays with document assembly
- `plan-revision` reads and updates `project://state`, so its blocking plan
  checkpoint can be listed as active, as `plan-section` already did
- Every non-Clio host binds the schema and template only of the records an
  action creates or updates. Read-only `progress` drops from 25 includes to 4
  on Claude Code and Copilot CLI, and from about 73 KB to 32 KB inlined on
  OpenCode and Gemini CLI
- Clio recipes bind no action skill, and each recipe's role-result form names
  its role id. Live, a section planner preloaded the `plan-section` skill and
  tried to run the whole action, and another returned role "Clio Coder"
- The advance ladder reads the latest milestone audit: a fresh one with no
  error or blocker issue leads to `submit-milestone`, one with errors to
  `plan-milestone-gaps`, and any later write back to the audit. A passed
  submission that only audits followed ends the ladder as delivered. Live,
  the ladder waited for a phase no driven action writes
- `next_step` takes `after`, the step just finished, which the desk ignores;
  Clio 0.8.2's loop guard blocked a third identical call although each
  result differs
- On Clio 0.8.2 a continued advance turn resumes its drive: at turn end the
  desk holds the armed step and drive, a prompt whose origin is
  `continuation` restores them, and any other prompt drops them. Live, a
  yolo continuation after the per-turn tool budget ended the drive
- Inside an action, the desk refuses a writing dispatch to any agent other
  than the action's own roles and names the role to use; a dispatch without
  an agent fell to Clio's default worker

### Fixed

- The desk's status reminder could reach 2,003 characters on a long project,
  which Clio refuses as an effect; it is now cut within the limit
- Desk refusals say what to send instead: a missing `project_id`, every
  schema error at once (up to eight), an authored artifact's file, the
  kebab-case id rule, a writer's accepted roots, and, between advance steps,
  to call `next_step`. A missing record's read and a refused create return
  the record type's example
- The record tool stamps a validation's `executed_at`, a checkpoint's
  `created_at` and an evidence record's `verified_at` on create when the
  writer leaves them out, and folds a record's own fields back in when they
  arrive beside `record`
- `measure_section` gives an action that may not record a count the desk's
  count without writing, so no action counts words by hand
- A `next_step` result carries its prompt's path relative to the plugin root
- A dispatch intent that declares no `write_roots`, missing or empty, gets
  the exact roots in the desk's refusal. Clio reads such an intent as an
  empty write ceiling, so the desk's own rewrite was refused too
- The desk stamps the creation time of every record an agent creates,
  replacing the agent's value. Live, an invented `executed_at` four minutes
  ahead made a validation read as older than the review it followed
- The author's approval of a plan appends it to the section's
  `artifacts.plans`, marks a not-started section planned, and the answer says
  what the desk wrote. Live, the driver armed `plan-revision` again
- A driven step that changed nothing the ladder reads is handed back once,
  naming the records the action creates, before the desk stops, and the
  hand-back says to continue. Live, `review-section` recorded neither its
  review nor its validation
- A stale read, a missing record version, and a schema failure on a record
  write are fixed and resent after a fresh read, in both the binding and the
  desk's reply; the model had ended steps on each as if refused by policy

## [0.8.1] - 2026-11-08

Makes the Clio desk the reference implementation of WTF-P's author gates and
record contract on Clio Coder 0.6.3, which runs the desk on every host and
tells it where each call lands and what each dispatch starts. Both Clio
packages require Clio 0.6.3 and were checked on its release build; the desk
they replace was qualified on a pinned Clio 0.6.2 build, and the desk was
also checked on a Clio 0.7.0 build, which runs it under Node's permission
model. Antigravity CLI 1.5 stopped loading plugin commands, so the
Antigravity projection now ships each action as a skill. The other five host
projections change only where shared protocol text and action contracts
changed.

All seven hosts were requalified on the packed 0.8.1 candidate in disposable
profiles: Claude Code 2.1.319, Codex 0.163.0, Copilot CLI 1.0.107, OpenCode
1.19.5, Antigravity CLI 1.5.3, Gemini CLI 0.67.0, and a Clio Coder 0.7.0
pre-release build (`8cbece81e`). This release does not depend on a tagged Clio
0.7.0; on that pre-release, a headless `clio-coder run` can still report a
no-op error after a desk record write succeeded (see the known limitations in
`docs/COMPATIBILITY.md`). The integrated candidate run on a released Clio
(sprint item WFP-09) is deferred to a later release.

### Added

- `wtfp.project.interaction/v1` records an author's answer as the host
  observed it: the checkpoint digest, the options offered and the subject
  artifact's SHA-256. The Clio desk seals each answer with an HMAC whose key
  stays in Clio's extension store, and counts a resolution as the author's only
  while a matching seal stands behind it; the seal is tamper evidence against
  workers and hand edits, not against the main agent, whose shell runs as the
  operator's user
- Desk tools `read_record` (record, revision, SHA-256 and attestation) and
  `readiness` (gates, plan approval and evidence coverage for a section); the
  `record` tool takes `writes` to commit several records together
- `evaluation/lib/claim-coverage.js`, shared by the desk and
  `validate-planning.js --coverage`: claims, evidence, sources, inspection
  depth and manuscript citation keys checked structurally
- `evaluation/v2`: the `clio-0.6.2-reference` campaign and
  `run-clio-campaign.js` (`plan`, `prepare`, `execute`, `collect`)
- The desk judges only the landing and dispatch plan Clio 0.6.3 sends each
  hook, never its own reading of a call: the file the tool opens, a worktree
  write at its checkout path, and each worker's resolved agent, `cwd` and
  physical write boundaries, checked again on the call the desk confines. A
  single worker is confined by a rewrite; a call that needs the operator's
  approval is refused with each worker's exact roots, since Clio admits a
  rewritten call afresh without that approval. A worker Clio reports
  read-only, such as a WTF-P reviewer, gets no roots, and the write guard no
  longer carries its own reviewer list. It refuses worktree writers in
  a WTF-P project, leaves a dispatch Clio could not prepare to Clio's own
  refusal, and outside a WTF-P project and action checks only that no WTF-P
  recipe runs outside its action. On a Clio that sends no facts, such as
  0.6.2, it refuses writes and dispatches inside a WTF-P project or action
- On a campaign that pins Clio 0.6.3 or later, each step runs with the budget
  left as its `--max-cost-usd` ceiling, and a step Clio stops there is
  `stopped-budget`; campaigns on 0.6.2 keep enforcing the budget between steps
- Clio prompts declare `allowed-tools` for their turn, from the Clio bindings
  of the action's capabilities, and `delegated-tools` for its workers, exactly
  what the delegated recipes declare; only the five actions that run the
  bundled citation dispatcher hold a shell, and none holds `run_script`, `job`,
  `git` or `verify`. Clio 0.6.3 narrows a template turn to them, so the Clio
  availability record now says `actionScoped: true` with surface
  `clio:template-allowed-tools`; Clio 0.6.2 ignores both fields
- `evaluation/lib/desk-trust.js`, the one rule for whether a recorded answer is
  the author's, shared by the desk and the campaign collector
- `docs/PROPOSAL_WORKFLOW.md` gives a recipe for comparing section drafts
  blind with `clio-coder arena` on Clio 0.7.0, with the scientist as the only
  judge

### Changed

- **Breaking:** both Clio packages require Clio Coder 0.6.3 (`>=0.6.3`), since
  the desk judges only the landing and dispatch plan Clio 0.6.3 sends each
  hook and the prompts scope their tools only from 0.6.3; Clio 0.6.2 refuses
  them
- A plan is approved for drafting only by an author `approve` answer on a
  checkpoint scoped to that plan, given for its current bytes; linked plans are
  immutable and `plan-revision` links its plan only after approval
- Record updates name the revision or SHA-256 they read and commit under a
  project lock; paired records are journaled so an interrupted write completes
- Every Clio action arms the write guard from its declared outputs; WTF-P
  workers are dispatched only inside their action with confined write roots;
  turning a gate off waits for the author at the desk
- The Clio write guard also covers `artifact`, `run_script` and `job`, and
  judges a path where Clio's tools land it; dispatch is parsed as Clio parses
  it, and no worker gets an empty, whole-workspace, record-covering or linked
  root, nor a `cwd` other than the project root
- The desk declares read access to the whole workspace, so under Clio's
  runtime permissions it sees every link in the project; a path whose landing
  it cannot inspect is refused
- Plan history is append-only, and re-pointing a manuscript, dropping an
  outline section, turning off a research, evidence or safety requirement, or
  stepping down the interaction mode waits for the author; on a plan gate the
  desk owns the wording of `approve`
- A required claim with a contradiction on record, linked or not, is not ready
  to draft, and neither is an outline claim its section does not record; only
  records at their protocol files that pass their schema count, and reused
  claim ids support nothing; citations, in every LaTeX `cite` form too, must
  resolve to one verified source of the project
- Campaign `execute` refuses any drift from what `prepare` bound, launcher and
  installed packages included, runs steps with Clio tool allowlists that hold
  no shell, script, job, git, verify or retrieval tool, and records
  per step the provider-reported models, the resolved thinking level, cost
  from Clio's sealed receipts by provenance, gate state and workspace digest;
  a gated step that raises no gate, or a headless step that adds an
  interaction record, never counts as completed, and an unfinished run exits
  non-zero; the desk's seal key is held in the runner's memory while steps
  run, every process a step leaves behind is stopped, and the whole Clio
  package root is bound; a program-running call is a policy violation, a step
  that changes the Clio configuration later steps load or leaves an unreadable
  worker receipt fails integrity, and `prepare` fails when an installed recipe
  declares a tool a step's workers may not hold; steps still run as the
  operator's user without an OS sandbox, and every run record says so
- Clio reviewer recipes are Clio's `read-only` class instead of
  `verification`, so they no longer hold `verify`, whose checks run commands
  from files a writer could plant; they bind no skill, since Clio refuses a
  skill load in a read-only run
- The capability docs now say the desk runs only in Clio's interactive
  sessions: Clio 0.6.2 loads no api 2 runtime in a headless `run`, so a
  campaign step runs without it
- Seven action contracts now declare record writes their workflows already
  made; plan-section and write-section route missing evidence to `research-gap`
  through a checkpoint instead of running it inline
- Clio playbook write boundaries project section artifacts to
  `.planning/sections/`
- The skill-description test still requires each description to name when the
  skill activates, but no longer requires it to open with "This skill"
- Five skill descriptions (`wtfp-deliver-research`, `wtfp-plan-section`,
  `wtfp-research-literature`, `wtfp-review-manuscript`, `wtfp-write-section`)
  name more of the requests they own. They came from a `clio-coder research`
  run on the routing corpus and were adopted only after they also held on 42
  held-out cases written without sight of them. Over three trials of a Clio
  routing probe, median held-out accuracy rose from 0.619 to 0.690 with
  negative specificity unchanged at 1.0, and median corpus accuracy rose from
  0.850 to 0.975

### Fixed

- On Clio 0.6.2 the installer failed and could not roll back because the
  plugin and the desk share the name `wtfp`; it now names `plugin:wtfp`
- A project-scope reinstall no longer rolls back over Clio's trust gate; the
  installer names `clio-coder config trust plugins` and never grants it
- Uninstall no longer removes the owned files of a package whose native removal
  was deferred by an unowned file, so a later uninstall can finish
- `hash-fixtures.js --check` no longer crashes on the user-acceptance template,
  and a sealed fixture that changes its schema fails the check
- A desk write that failed after its commit point is reported as committed,
  not as not written
- `run-clio-campaign.js` reads a campaign step's cost, worker tool counts and
  served models from Clio's sealed telemetry (`clio-coder telemetry`) when the
  campaign pins Clio 0.6.6 or later, which no longer writes receipt files, and
  compares only the first line of `--version`, which Clio 0.7.0 extends with
  its pane runtime
- Every desk record write failed on Clio 0.7.0, which runs the desk under
  Node's permission model; Node 24 refuses `fsync` there, so the desk now
  treats that flush as best effort and removes a staged file it could not
  write whole
- On Antigravity CLI 1.5 no action was reachable as a slash command and the
  project-state rule never applied: plugins no longer load `commands/`, and a
  named rule without a `trigger` fails `agy plugin validate`. Each action is
  now an explicitly invoked skill, `/wtfp-<action>` (`disable-model-invocation:
  true`, so model routing still sees only the seven router skills);
  `/wtfp-write-section` and `/wtfp-plan-section` open the router skill of that
  name. The rule is `trigger: always_on`, and the manifest carries `version`

## [0.8.0] - 2026-10-06

Adds the WTF-P writing desk for Clio Coder as its own Clio extension beside
the content plugin, and ships the two Clio fleet contracts as playbooks. The
Claude, Codex, Copilot, OpenCode, Antigravity and Gemini projections change
only in their version.

### Added in 0.8.0

- `vendors/clio-extension/` is a standalone Clio extension, `id: wtfp`,
  linked to the plugin it serves with `plugin: wtfp` and compiled from the
  human-edited `clio/` source. It carries every file it executes or reads:
  the runtime, its skin, the generated write-guard roots, the schema
  validator, the project schemas, the action contracts and the Clio action
  availability
- The desk workspace, entered with `/ext:wtfp:desk`, draws the project from
  `.planning/` and `paper/`: the phase track, sections by wave with stage
  strips and one word count, pending gates, the evidence ledger and running
  roles. Pressing a section card fills that section's next action. Leaving
  the desk in a folder with no project clears its status, band and islands.
  Without the plugin, the desk names only its own `/ext:wtfp:*` commands and
  says which steps need the plugin
- While the plugin is installed and enabled, the extension answers
  `/wtfp:progress`, `/wtfp:help` and `/wtfp:check-todos` in code with no
  model call. `/ext:wtfp:checkpoints` lists gates and snapshots, and
  `/ext:wtfp:validate` checks every planning record against its schema
- Three runtime tools. `record` writes one `.planning` record at its logical
  URI after checking its type, identifier, revision and canonical schema,
  then replaces it atomically and reads it back. `measure_section` counts a
  manuscript's body words by the desk's one method and records the count.
  `gate` asks the author a pending checkpoint as an interview and records
  only the author's answer
- A write guard. A manuscript-writing action confines `write` and `edit` to
  its declared roots, and a write into a section's manuscript waits for the
  section's blocking gates and an approved plan
- Package tests that `clio-coder extensions test vendors/clio-extension`
  runs: one per runtime tool, the write guard, entering and leaving the
  desk, and the desk without its plugin

### Changed in 0.8.0

- `wtf-p install clio` installs the plugin and then the desk extension as
  two separate Clio installs, `clio-coder library install` and
  `clio-coder extensions install`, under one receipt. It verifies each, a
  failed extension install compensates both, and uninstall removes each only
  when its files are unchanged and receipt-owned
- The 24 Clio prompts that write records, count words or ask a gate call the
  desk's runtime tools. Each keeps one line that falls back to its workflow
  with native tools and `ask_user` gates when the desk is absent, and the
  plugin's `compatibility/action-availability.json` names the preferred
  bindings under `runtimeBindings`
- Clio runs fleet contracts as playbooks. The canonical plugin declares
  `wtfp-plan-section` and `wtfp-draft-review` under the `playbooks` resource
  key and component kind in `ai.iowarp.clio/playbooks/`, and the
  `/wtfp:help` card lists them for `clio-coder fleet run <playbook>`. Their
  bodies are unchanged
- The Clio documentation, native integration test and evaluation runners
  check the playbooks with `clio-coder playbook list`, `playbook validate`
  and `playbook graph`, where Clio 0.6.2 moved playbook authoring.
  `clio-coder fleet run` still runs them
- The Claude envelope keeps its older Clio copy: a root `plugin.json`, the
  phase 1 prompts and `ai.iowarp.clio/fleets/`. Clio no longer adopts it and
  points to the canonical plugin instead
- Both Clio packages declare `compatibility.clio: >=0.6.2`. Clio 0.6.1 has
  no extension runtime API 2 and rejects the plugin's `playbooks` key

## [0.7.4] - 2026-09-23

This release repairs the Clio research path used by literature-heavy section
planning and drafting.

### Fixed in 0.7.4

- `research-gap` in Clio full-auto can search bounded public scholarly metadata
  through the bundled CiteNexus dispatcher using free no-key indexes without
  asking again for every provider/query set. A configured trusted read-class
  CiteNexus MCP connection is preferred where Clio supports it; the main agent
  calls it through `gateway` and passes candidates to the research specialist.
  Other providers, non-full-auto runs, and refused routes retain their gate.
  Search results remain unverified candidates
- Literature-heavy `plan-section` and `write-section` routes now require a
  section research artifact and resolvable source/evidence coverage before
  planning or drafting. Missing coverage routes to `research-gap` and then a
  checkpoint; it cannot be replaced with invented citations
- The Clio plugin names the exact WTF-P planning, checking and research roles,
  so generic coding agents cannot silently stand in for specialists
- The generated Clio tool dispatcher carries a CommonJS package boundary and
  runs under Clio's ESM plugin host
- The evaluation routing baseline and generated adapter inventories are
  resealed against the source that ships in this release

## [0.7.3] - 2026-09-17

Fixes `create-poster` output that was unusable on local models: a text
outline with no layout, invented author metadata, unsupported claims about
other systems, and architecture diagrams with no grounding in the source
tree. Also stops Clio from titling sessions with the compiler comment.

### Fixed in 0.7.3

- The poster scaffold now carries the design. It ships a self-contained HTML
  page with a fixed page size, a three or two column grid, a reading order, a
  type scale and a contrast-checked palette, which the author opens in a
  browser and prints to PDF. A venue-mandated template may replace it if it
  keeps the same grid and type scale. WTF-P still declares no renderer
- `create-poster` and `create-slides` run an evidence gate. Every claim,
  number, comparison and figure needs a row in a claim ledger naming a
  manuscript passage, source record, evidence record or project file.
  Statements about other systems need a cited source. Unsupported rows are
  cut rather than softened
- Author names, affiliations, emails, funding, venue and dates are never
  invented. Missing values stay as visible placeholders such as
  `[AFFILIATION NEEDED]` and are reported as unresolved
- Diagrams for software subjects must derive from named source files or
  documentation, with the source paths stated beneath each diagram. Without
  a grounded source the deliverable carries a labeled placeholder
- Generated action commands, blocked routes and the Clio help card place the
  `Generated by WTF-P adapter compiler` comment after the body, so hosts that
  title a session from the first text of an expanded command no longer show
  it. A compiler test enforces the placement
- Re-running `wtf-p install <target>` without `--force` over an older
  unmodified installation skipped every file, left the old version in place
  and deferred native registration. The installer now replaces files whose
  bytes still match the ownership receipt, keeps files that already hold the
  new bytes, and still preserves modified or unowned files

## [0.7.2] - 2026-09-17

Lets `research-gap` reach the CiteNexus backend that 0.7.0 added to
`check-refs`, and corrects documentation still pinned to the 0.6 line.

### Added in 0.7.2

- `research-gap` declares the logical tool `citation.fetch`, so it can run
  `citation-search --backend=cite-nexus` with an explicit `--providers` list.
  Its author gate now names the external providers and the bounded query set
  before any query runs. Results stay candidates, and the action never writes
  to the project bibliography. The workflow, the `research-synthesizer` role
  and the `wtfp-research-literature` action reference state the same boundary
- `docs/CITE_NEXUS.md` and the getting-started guide show how to reach
  CiteNexus in a session through `research-gap` and `check-refs`

### Fixed in 0.7.2

- The getting-started guide told users to confirm a `WTF-P v0.6.0` installer
  banner; it now names the banner the installer prints,
  `Write The F***ing Paper v0.7.2`
- The getting-started, proposal, compatibility and build guides still
  described themselves as 0.6 documentation, and the guide said npm `latest`
  resolved to the 0.6 line
- README and the getting-started guide now state that Clio Coder requires
  Node.js 22.19 or newer, above WTF-P's own Node.js 20 floor

## [0.7.1] - 2026-09-17

Documentation patch from installing the published 0.7.0 on a real Clio
Coder 0.4.9 profile. Generated envelopes change only by version string.

### Fixed in 0.7.1

- The getting-started and proposal guides installed and uninstalled
  `wtf-p@0.6.0`; every user-facing command now names `wtf-p@0.7.1`
- Document that `clio-coder library remove wtfp` leaves WTF-P's
  `.wtfp-version` receipt behind, and that `wtf-p uninstall clio --yes`
  removes it
- Document the Clio 0.4.9 `fleet validate` error for projects that
  gitignore `.planning/` or `paper/`, and how to find the ignore rule
- Document that `library list` shows the removed staging directory as the
  package source, and that `library import` cannot adopt WTF-P from a
  GitHub URL
- Maintainers: post-publish `npx` checks must run outside the checkout,
  and CI now fetches full history so the evaluation seal can resolve its
  sealed commit

## [0.7.0] - 2026-09-17

Adds an optional CiteNexus scholarly research backend to the existing
`citation.fetch` logical tool. CiteNexus is a separate Python package
(`cite-nexus-mcp` 0.2.0) that the operator installs; WTF-P never installs,
registers or updates it. The seven-tool registry, declared effects and host
capability matrix are unchanged.

### Added in 0.7.0

- `citation-search --backend=cite-nexus` runs the installed `cite-nexus-wtfp`
  companion, which calls the CiteNexus `search-papers` tool through the
  official MCP client over a per-call stdio server. Default providers are
  Crossref, DataCite and Europe PMC with no mandatory keys; `--providers`
  explicitly selects arXiv, Semantic Scholar, OpenAlex, SerpAPI, Scopus or
  Web of Science. `WTFP_CITE_NEXUS_COMMAND` may name an absolute companion
  executable
- Results stay `verification: candidate` and carry `citeNexus` source URLs,
  retrieval times, field attribution, per-provider metrics and warnings,
  candidate BibTeX without an inferred `wtfp_status=official`, and partial
  provider failures in `metadata.errors`. Citation counts are never combined
- A private companion client, `tools/support/cite-nexus-client.js`, is
  compiled into and inventory-authenticated in all nine envelopes. It has no
  independent execution grant
- `docs/CITE_NEXUS.md` covers installation, provider choice and cost,
  the result contract, verification and removal

### Changed in 0.7.0

- The bundled dispatcher rejects unknown flags per command and rejects
  partially numeric `--limit` and `--timeout` values such as `2junk`, which
  were previously truncated to integers
- A backend deadline now exits with status 124 like the dispatcher's own
  wall clock
- `npm run release` gives its preflight run a 20-minute budget instead of the
  300 s spawn default, which the full suite exceeds, so `--dry-run` and `--tag`
  no longer abort with `ETIMEDOUT`

### Security and limits

- Only `PATH`, locale and temporary-directory variables plus the credentials
  of explicitly selected providers reach the companion. `.env` files,
  unrelated secrets and `CITE_NEXUS_DEFAULT_PROVIDERS` are ignored; proxy and
  CA-bundle variables are not forwarded
- Queries are capped at 512 characters, responses at 2 MiB and JSON nesting
  at 32 levels. Malformed, incompatible, crashing, hanging and oversized
  companions fail explicitly with no fallback to another backend, and child
  stderr is drained without being relayed
- `--offline` and `WTFP_TOOL_OFFLINE=1` refuse the backend before process
  launch. Deadlines and cancellation stop the companion, which closes its MCP
  server process group
- Only `--intent=balanced` is accepted for this backend. `--limit` caps the
  displayed total; `metadata.total` counts the fetched, deduplicated provider
  page
- Research actions reach the backend on Clio Coder and Claude Code, the two
  hosts with the established dispatcher binding. Codex, Copilot, OpenCode,
  Antigravity and Gemini keep their `tool.execute` blockers. Companion process
  behavior is qualified on Linux only

## [0.6.0] - 2026-09-14

First stable release of the agent-plugin line. WTF-P is one canonical
[Agent Plugins 1.0.0](https://agent-plugins.org) bundle compiled into a
native package for Clio Coder, Claude Code, Codex, GitHub Copilot CLI,
OpenCode, Antigravity CLI, and Gemini CLI. This entry absorbs the unpublished
`0.6.0-rc.3` and `0.6.0-rc.4` candidates, which were prepared but never
tagged or published; everything listed below ships here for the first time
after `0.6.0-rc.2`. npm `latest` now resolves to this line.

### Added in 0.6.0

- Repository-root marketplaces (`.claude-plugin/marketplace.json`,
  `.agents/plugins/marketplace.json`, `.github/plugin/marketplace.json`), so
  Claude Code, Codex, and Copilot CLI install the committed envelope straight
  from Git with `<cli> plugin marketplace add PanStudio/panwrite` and
  `wtfp@wtf-p`, with no npm and no installer. The Codex route does not copy
  the role agents to `$CODEX_HOME/agents/`; the installer still does

### Changed in 0.6.0

- The plugin is named `wtfp` on every host. Codex, Copilot, Antigravity, and
  Gemini previously published it as `wtf-p`, so the selector was
  `wtf-p@wtfp` on some hosts and `wtfp@wtfp` on others. Generated envelopes
  move to `vendors/codex/plugins/wtfp` and `vendors/copilot/plugins/wtfp`;
  the Gemini extension installs to `extensions/wtfp` and the Antigravity
  source to `sources/wtfp`. The npm package stays `wtf-p`
- Codex documentation and the installer hint name the skill mention Codex
  actually resolves, `$wtfp-start-project`, instead of the
  `$wtf-p:wtfp-start-project` form, which Codex never parsed as a selector
- Clio Coder 0.4.7 and 0.4.8 are published as `@iowarp/clio-coder`; the
  documentation no longer describes the Clio route as needing a local build

### Removed in 0.6.0

- The v0.5 `core/write-the-f-paper` tree, the WCN workflow compressor under
  `tools/wcn`, the `tests/e2e` fixtures, and the unused `bin/lib` context
  primer, Git checkpoint helper, and WCN compiler. None of them was read by
  the 0.6 installer; they added 447 KB to the tarball. `wtf-p@0.5.0` remains
  installable by explicit version for anyone who needs them

The remainder of this entry is the release-candidate history since
`0.6.0-rc.2`.

### Changed

- **Breaking for Clio Coder.** WTF-P ships to Clio only as an Agent Plugins
  1.0.0 package and requires Clio Coder 0.4.7 or newer. The `vendors/clio`
  extension envelope, its `clio-coder-extension.yaml`, the extension install
  route, and the capability probe that chose between two routes are removed.
  `vendors/plugin/` is the one canonical bundle
- Clio installation delegates to the native plugin lifecycle: publish the
  bundle under the WTF-P receipt, stage it aside, run
  `clio-coder library install <staged-dir> --user|--project`, verify with
  `clio-coder library inspect wtfp --user|--project --json` (`valid`, zero diagnostics, the
  expected root and scope returning the InstalledPlugin shape), then publish the receipt.
  Integrity, provenance, drift, and enable/disable belong to Clio. WTF-P no longer re-enables a
  package the operator disabled and keeps only its exact-file receipt
- Clio prompt and agent bodies resolve packaged files through `${pluginRoot}`.
  The flat `wtfp-<action>` prompt aliases are gone; every action is invoked as
  `/wtfp:<action>` and nothing else
- `tool.execute` means exactly one thing: run the bundled `tools/wtfp-tool.js`
  dispatcher. It is bound on Clio (`bash`) and Claude Code (`Bash`) and fails
  closed on every other host. `research-gap`, `analyze-bib`, `check-refs`,
  `audit-milestone`, and `export-latex` are therefore available on Clio and
  Claude Code (31 of 36 actions) and unavailable elsewhere (26 of 36); the
  previous candidates projected 24 of 36 everywhere
- `create-poster`, `create-slides`, and `export-latex` no longer claim a
  rendering or compilation effect. They emit source and hand back an explicit
  author command, and are available rather than fail-closed
- The adapter compiler is a per-host factory. Claude Code gets a selectable
  academic output style, a write-guard hook set that confines `Write`/`Edit`
  during `write-section`, `execute-outline`, `quick`, and `polish-prose` to
  `.planning/` and `paper/`, and agents that preload their bound plugin skill.
  Codex gets a portable root manifest with the `com.openai` overlay and eleven
  TOML custom agents that the installer publishes to `$CODEX_HOME/agents/`.
  OpenCode roles declare `mode: subagent` with verifier permissions.
  Antigravity gets a schema-conformant manifest, `subagent: true` agents, and
  a project-state rule. Gemini agents move to the flat `agents/` layout its
  loader reads
- Adapter inventories and test expectations derive from canonical content
  instead of literal action, role, and skill counts

### Added

- The Claude envelope carries the byte-identical Agent Plugins 1.0.0 root
  `plugin.json` from `vendors/plugin`, including `extensions["ai.iowarp.clio"]`,
  together with the `ai.iowarp.clio/` prompts, agents, and fleets that graph
  names, so Clio can adopt an installed Claude plugin as `wtfp`. Claude Code
  keeps reading `.claude-plugin/plugin.json`
- `tools/wtfp-tool.js`, a bounded JSON dispatcher for the seven declared
  bibliography and citation tools, generated into every envelope and
  documented in `tools/README.md`. `list` prints each command's declared
  effects; `--offline` or `WTFP_TOOL_OFFLINE=1` refuses any command whose
  effects include `network.*`; network commands enforce `--timeout=<seconds>`
  (default 20, exit 124); `<command> --help` exits 0
- On Clio, `/wtfp:help` is a display-only operator card: one fenced block with
  a start-here sequence, every action in workflow order with its argument
  hint and description, unavailable actions marked with the blocking
  capability, and the two fleets. Clio prints it without a model call
- `protocol/templates/` scaffolds for manuscript outlines, grant-proposal
  outlines, conference posters, and conference talks, bound from `new-paper`,
  `create-outline`, `create-poster`, and `create-slides`
- `docs/HOST_CAPABILITIES.md`, the per-host capability matrix with the exact
  commands used as evidence, and `docs/README.md`, an index of the
  documentation set
- The Clio installer resolves the configuration profile the way Clio does:
  `CLIO_CODER_CONFIG_DIR`, then `CLIO_CODER_HOME/config`, then the platform
  default (`${XDG_CONFIG_HOME:-~/.config}/clio-coder` on Linux)
- Native Clio plugin installation with exact receipts and compensating
  rollback, a three-action research handoff guide, and an opt-in native Clio
  lifecycle test (`test/clio-native-integration.test.js`)

### Fixed

- Claude Code loads agents only from the top level of `agents/`, so the
  nested `agents/wtfp/<role>.md` layout loaded none of the eleven roles.
  Gemini CLI reads the same single directory. Both now use flat
  `agents/wtfp-<role>.md`
- The Antigravity manifest carried `version`, `author`, `commands`, `agents`,
  and `skills` keys that the published v1 plugin schema rejects
- The generated `tools/wtfp-tool.js` ran its dispatcher on import. OpenCode
  imports every `tools/*.js` below its config root as a custom tool, so any
  session that initialised its tool registry exited with a dispatcher error.
  The dispatcher now runs only as an entry point
- The installer's post-install hint told Codex users to run `/wtfp:help`, a
  command Codex does not have; without `clio-coder` on PATH the installer
  pointed at a `library install` source that Clio rejects. Both hints are
  corrected
- Generated `.js` files carry a `//` banner instead of an HTML comment, so
  they also parse as ES modules
- `npx wtf-p uninstall --help` prints the uninstaller's help,
  `uninstall <target>` maps to the uninstaller's `--<target>` selector, and the
  installer help lists the uninstall flags
- `bib-format` emits standard BibTeX entry types by default; the al-folio
  Jekyll projection is behind `--style=al-folio`. `wtfp_missing` also reports
  a missing title or year. `bib-index` flags repeated citation keys and
  refuses an ambiguous `--key`. `bib-impact` reports progress on stderr
- `create-outline`, `insert-section`, and `remove-section` carry the exact
  outline-budget invariant that only `new-paper` stated
- `help` names actions in the host's real `/wtfp:<action>` syntax and reports
  the actions the running adapter cannot execute
- Incremental mapping declares existing source/evidence reads and preserves
  curated records; outliner word budgets match the approved total; native
  receipts expose installed commands, skills, and agents in status

### Documentation

- README, `docs/`, and this changelog describe the shipped product: one
  canonical plugin, six verified hosts and Copilot unverified, per-host
  availability derived from the generated `compatibility/action-availability.json`,
  the four writing workflows, the evidence stance, and the protocol → compiler →
  projections architecture. Stale RC2 boundaries, 24/36 counts, Clio extension
  and flat-alias references, and MCP claims are removed. Historical evaluation
  evidence is retained and labelled as historical

### Validated

- Disposable-profile native discovery: Claude Code 2.1.267 (strict
  validation, install, `plugin details` reporting 43 skills, 11 agents, and 3
  hooks on this envelope; headless Sonnet 5 `/wtfp:help` and `/wtfp:new-paper`
  stopped at the interview gate on the factory-round envelope), Codex 0.153.3
  (marketplace add, plugin list, headless `gpt-5.6-luna` help and new-paper
  routes), Clio Coder 0.4.7 (native verification exit 0 against frozen interim snapshot
  in user and project profiles: 203 receipt files, `trust: "trusted"`, 7 skills,
  11 recipes, both fleets validate+graph, 508 contained references, library dry-run,
  scope coexistence, idempotence, preserved disable preference, and compensating rollback;
  observed historically via pre-unification `plugins` verbs by Fable at SHA 31a0600),
  OpenCode 1.18.30 (`agent list`, `debug skill`, server
  API), Antigravity CLI 1.1.28 (`plugin validate`/`install`/`list`, `agents`),
  and Gemini CLI 0.59.0 (`extensions validate`/`install`/`list`,
  `skills list`). GitHub Copilot CLI was not available and is unverified
- Clio Coder 0.4.7 `library inspect` (historically `plugins inspect`) accepts the Claude envelope as a valid
  `wtfp` plugin with zero diagnostics

### Known limitations

- Headless `clio-coder run` cannot satisfy a WTF-P `user.gate`; `ask_user` is
  registered in the TUI only
- Codex loads the TOML custom agents by published file format; runtime
  discovery was not observed
- Gemini exposes no listing surface for extension agents or commands, so their
  discovery is inferred from a clean extension load and loader source
- The Claude write guard was exercised with synthetic hook input, not a live
  `/wtfp:write-section` session
- Writing turns on the local `dynamo/qwen3.8-27b` target are impractically
  slow with the inlined schema set

## [0.6.0-rc.2] - 2026-08-29

Corrective release candidate for decision fidelity and durable lifecycle handling. This release does not claim a completed proposal lifecycle or improved writing quality.

### Fixed

- `create-outline` may supersede a deferred choice only from an explicit author answer; it preserves locked and unrelated decisions and appends a fresh locked replacement with provenance
- `plan-section` requires exactly one current passing `create-outline` validation and independently checks locked and deferred decision consistency before specialist dispatch
- `write-section` now reconciles project records only from a measured persisted manuscript, a present non-empty summary, and a persisted validation rather than worker self-report
- `review-section` bounds malformed-result retries, preserves accepted warning debt, uses only the closed validation schema, and cannot mutate project state or invent a paused phase
- `pause-writing` preserves the valid lifecycle phase while setting only `state.status` to `paused`
- `resume-writing` requires direct current-invocation reads, a host-native author gate, fail-closed no-mutation behavior before selection, and schema-valid checkpoint/state readback before reporting success
- Clio verifier recipes now require compact JSON-only results with bounded, non-duplicate checks

### Validated

- A monitored disposable mixed-autonomy Clio Coder 0.3.8 / Dynamo `qwen3.8-27b-dynamo` / thinking-off defect-finding UAT used supervised `suggest` through outline/plan, then `full-auto` for write/review/pause and the later resume/progress; it continued one section before the final RC2 write/review/pause hardening
- The provisional section's persisted writer/state count was 1,019 whitespace-delimited words; the independent reviewer used a different tokenizer and reported 1,026. Write and review validations retained explicit warning debt; the durable handoff/checkpoint remained coherent; and all 25 portable JSON records passed independent schema validation
- A genuinely fresh-process pre-hardening resume attempt failed by narrating tools it never called. Against the regenerated RC2 bundle, a new process read the durable records, invoked Clio's real `ask_user` interview, waited for the author selection, resolved the checkpoint, advanced state to revision 7/active while preserving phase `reviewing`, and read both records back. Independent schema validation passed 25/25; a following `progress` action was read-only and identified wave-2 planning as the next action.

### Known limitations

- `research-gap` remains adapter-unavailable because current adapters lack an exact `tool.execute` binding. No external literature was supplied or mapped in this toy UAT; the draft has zero citations, and authorized placeholders are not research evidence.
- This is one-section process-discipline evidence, not a completed seven-section proposal, paid lifecycle, observed semantic baseline, submission-ready artifact, or controlled writing-quality result.
- The final RC2 write/review/pause corrections have deterministic regression coverage but were not followed by a second end-to-end model rerun; only corrected resume/progress was rerun against the regenerated bundle.
- The exploratory mixed-autonomy run is not a safety certification: its `full-auto` phases used read-only shell helpers, inherited Clio's session tool surface, retained a pre-existing future pause timestamp that makes resume-time ordering imperfect, and its final progress prose misstated two passed plus two `issues-found` validation files as “4 of 6 passed.” The portable records themselves remained schema-valid.

## [0.6.0-rc.1] - 2026-08-29

Agent-platform modernization release candidate. WTF-P now has one portable academic protocol and deterministic native envelopes for seven coding-agent clients.

This entry describes the locally validated repository state; it does not assert npm or marketplace publication.

### Added

- **Clio Coder reference adapter** — self-contained extension with 36 namespaced prompts, 36 flat compatibility aliases, 11 strict agents, seven extension-bound skills, and two dependency-aware fleets; 24 semantic actions are adapter-available and the other 12 have nested and flat fail-closed aliases
- **Codex, GitHub Copilot CLI, and Antigravity CLI support** alongside modernized Claude Code, OpenCode, and Gemini adapters
- **GitHub Copilot cloud projection** — generated, committed `.github` prompts, agents, skills, instructions, and portable protocol resources in addition to the native CLI plugin; five actions are adapter-available and 31 fail closed until exact capability and approval bindings exist
- **Canonical protocol catalog** — 36 versioned action contracts describing reads, outputs, delegation, tools, effects, and approval boundaries
- **Seven standard Agent Skills** — focused packages for project setup, literature research, section planning, section writing, manuscript review, project management, and delivery
- **Portable specialist contracts** — 11 host-neutral roles with strict mutation or verifier result shapes
- **Portable `.planning` v1 protocol** — 11 JSON schemas, ten templates, and cross-record fixtures for project state, sources, evidence, decisions, outlines, sections, checkpoints, and validation results
- **Deterministic adapter compiler** — generates nine target/marketplace envelopes with provenance banners, cryptographic inventories, stale-output detection, and owned stale-file cleanup
- **Action-bound runtime context** — every generated command carries its exact action contract, relevant project schemas/templates, and a guarded native invocation-argument block
- **Explicit target grammar** — `wtfp install <clio|claude|codex|copilot|opencode|antigravity|gemini>` with compatibility flags retained
- **Seven-target isolated installer matrix** covering exact install, receipt, uninstall, sentinel preservation, environment-root resolution, and all-target overlap rejection
- **Versioned behavioral-evaluation layer** — 40 implicit routing cases, all 36 explicit actions, three primary-client routing surface contracts, authenticated identities for all nine generated envelopes, budgeted paid-matrix definitions, a ten-dimension semantic rubric, stable fixture/oracle hashes, independent planning validation, and fail-closed routing and lifecycle runners
- **Tool-execution ADR** — keeps transforms local, removes the unusable Claude-only MCP prototype, withholds unrestricted shell grants for logical tools, and defines executable gates for any future autonomous binding or optional network MCP server

### Changed

- Host-neutral Markdown is now the sole workflow-prose source; all 36 client command projections are generated from it
- The adapter compiler now fails closed when a canonical capability, semantic effect, or approval gate lacks an exact target binding. Every target receives a machine-readable `wtfp.action-availability/v1` manifest; unavailable routes emit deterministic `WTFP_ACTION_UNAVAILABLE` stubs without the normal workflow, arguments, or tools. Seven local/plugin projections mark 24/36 actions adapter-available; the GitHub Copilot cloud projection marks 5/36 because it has no exact explicit-approval binding.
- Clio action availability now records that 0.3.8 slash prompts inherit the host session tool surface rather than enforcing a per-prompt allowlist. Read-only previews or supervised `suggest` autonomy are required for behavioral certification, and any undeclared tool call fails the gate. The two native fleets are documented as explicit `fleet run` primitives, not implicit `/wtfp:*` routing.
- Concrete vendor model names and host-specific delegation syntax were removed from canonical workflows
- Each generated adapter is self-contained and carries the canonical protocol, skills, roles, project schemas, tools, and source inventory
- Claude commands now use a dual plugin/marketplace envelope and expose exact `/wtfp:<action>` names without redundant namespace segments
- OpenCode and Gemini commands embed static protocol resources when the host has no reliable prompt-time plugin-root variable
- Clio installation performs an isolated, credential-free extension capability probe and retains flat-prompt/skill compatibility with a warning when a legacy client lacks the full resource surface
- Host tool bundles contain only seven declared bibliography/citation implementations at URI-derived paths; installer internals and legacy Git-backed checkpoint code are excluded
- Tool metadata now reports network and clock effects truthfully; repeatable local ranking and formatting tests receive an explicit reference date
- The package now targets Node.js 20 or newer
- Noninteractive installation requires an explicit target or scope
- WCN remains as a legacy compatibility artifact but is no longer a canonical workflow source or selectable runtime mode

### Security

- Added import-safe CLIs, dangerous-root and symlink containment checks, source/destination race detection, and atomic file publication
- Added v2 exact-file ownership receipts with SHA-256 hashes; skipped files can no longer become owned implicitly
- Ownership receipts now identify adapter contract v1 and generator v4 instead of reporting stale generator metadata
- Added transactional rollback, receipt-race detection, modified-file preservation, and non-recursive uninstall cleanup
- Native marketplace/plugin activation now uses compensating rollback, including cleanup when registration succeeds but a later install or verification step fails
- A bundle with preserved conflict files remains receipted as partial and is never newly registered with a native client
- Added adversarial fault-injection coverage for symlink swaps, concurrent edits, malformed receipts, traversal, and overlapping target roots
- Clio fleet write boundaries now name `.planning/` and `paper/` as directories; the previous bare names authorized literal files and caused real nested worker output to be rolled back
- Canonical Clio fleet steps now declare only their bound roles' semantic write scopes: plan artifacts for `section-planner`, and manuscript plus execution-summary artifacts for `section-writer`; generated instructions reserve action-level approval and project-state reconciliation to the orchestrator, while Clio's native enforcement remains directory-granular
- `map-project` no longer misdeclares optional bibliography parsing as a required `tool.execute` effect; it remains available through contained project reads and records unsupported structured formats rather than substituting a shell command
- The obsolete, unregistered Claude research MCP prototype and its undeclared package contents are no longer shipped
- Removed the obsolete, unowned Claude `wtfp-marp` and `wtfp-echarts` skills and the stale Marp peer dependency; the archive now excludes their legacy namespace so it cannot bypass the authenticated seven-skill inventory

### Validated

- Native Claude plugin, Codex plugin, Copilot external plugin, and Antigravity plugin validators
- Native install/list discovery for Claude 2.1.251, Codex 0.144.1, Copilot 1.0.80, Clio, OpenCode 1.18.16, Antigravity 1.1.22, and Gemini 0.57.0 under disposable profiles
- Real isolated Claude Sonnet 5/xhigh (8/8 rubric), Codex GPT-5.4/xhigh (8/8), and Clio GPT-5.6 Terra/xhigh evaluations: the historical compiler-v3 Clio run scored 7/8; the paid compiler-v4 rerun scored 8/8 and independently validated all five previewed records. Claude/Codex raw packs are no longer retained and those two historical observations are not independently replayable from this tree; the Clio v4 pack is checked in and executable.
- Clio Coder `v0.3.8` at merged commit `9b7b80cc`: effective package discovery reports 72 prompts (36 nested and 36 flat), 11 agents, seven skills, two fleets, and zero diagnostics; exact raw `$ARGUMENTS`, nested `state.json`, same-extension skill resolution, and reserved-builtin refusal were exercised
- Both generated Clio fleet contracts pass native `fleet validate` with the corrected `.planning/` and `paper/` directory boundaries and canonical `protocol/fleets/*.json` sources
- The first retained Clio 0.3.8 `dynamo/qwen3.8-27b` lifecycle reading is deliberately reported as blocked at `new-paper`: high effort timed out safely; effort-off produced five schema-valid records but attempted one denied shell call and created a 5,600/6,000 word-budget mismatch. It binds earlier WTF-P source `6b58b298`, predates the current remediation, and is not a current-RC behavioral reading. No later lifecycle action or end-to-end fleet pass is claimed.
- Post-remediation local readings remain non-passing: exact `new-paper` arguments at `0245818` led to an agent-discovery loop and zero records; the `b4f0543` plan fleet completed only structurally; and the `cbba38c` draft fleet verified the corrected `paper/` projection but failed the approved-plan, state-reconciliation, and word-budget invariants. Raw traces and ledgers are retained without promoting them to a baseline.
- A final current-source `bf50e23` Dynamo reading created five literal schema-valid initialization records, but failed a cross-record dependency-wave invariant and the explicit no-shell boundary: three shell calls succeeded and ten retries were denied. The campaign stopped before `map-project`, has no terminal receipt, and is retained as blocked evidence rather than a lifecycle result.
- Exact catalog and discovery parity: all applicable adapters project 36 stable action IDs, seven skills, and 11 specialist roles. Adapter availability is target-specific: 24/36 on Clio, Claude, Codex, Copilot CLI, OpenCode, Antigravity, and Gemini; 5/36 on the Copilot cloud projection. These counts do not replace host enforcement or model-behavior evidence.
- Canonical workflow portability, standard-skill validation, project-schema conformance, reproducible generation, and legacy regression suites

## [0.5.0] - 2026-02-09

Multi-runtime parity release. 36 commands and 11 specialized agents now run on Claude Code, Gemini CLI, and OpenCode. Architecture overhauled with GSD-inspired thin orchestrators, quality loops, and model profiles.

### Added

- **Gemini CLI support** — 36 TOML-format commands + 11 agents, installable via `npx wtf-p --global --gemini`
- **OpenCode support** — 36 Markdown commands + 11 agents, installable via `npx wtf-p --global --opencode`
- **MANIFEST-based installer** — Tracks installed files per runtime for clean uninstall/upgrade
- **7 specialized agents** — section-planner, section-writer, section-reviewer, plan-checker, research-synthesizer, prose-polisher, argument-verifier
- **Plan-Check-Revise loop** — Pre-write validation across 7 dimensions (argument coverage, citation coverage, word budget, outline compliance, context fidelity, style consistency, task completeness) with up to 3 revision iterations
- **Goal-backward verification** — Post-write argument-verifier checks claims vs. plan, evidence presented, and word count targets
- **Model profiles** — `quality` / `balanced` / `budget` profiles route 11 agents to appropriate models (opus/sonnet/haiku) via `config.json`
- **Wave-based parallel writing** — `wave` and `depends_on` in section plans enable parallel execution of independent sections
- **8 new commands** — `verify-work`, `execute-outline`, `settings`, `add-todo`, `check-todos`, `update`, `audit-milestone`, `plan-milestone-gaps`
- **Context primer** (`bin/lib/context-primer.js`) — Section-specific context extraction for journal-scale papers
- **Preference inheritance** (`base-prefs.yaml`) — Global style/citation defaults with per-project overrides
- **Checkpoint system** (`bin/lib/checkpoint.js`) — Git-tagged checkpoint save/restore/list
- **`/wtfp:quick` command** — Minimal-ceremony writing for quick tasks
- **`/wtfp:checkpoint` command** — Save, restore, and list paper state checkpoints
- **Config extensions** — `model_profile`, `workflow.research`, `workflow.plan_check`, `workflow.verifier`, `parallelization.enabled`, `parallelization.max_concurrent_agents`
- **Reference docs** — `agent-model-matrix.md`, `orchestrator-pattern.md`, `context-fidelity.md`

### Changed

- **Thin orchestrator architecture** — Refactored 11 commands from monolithic implementations to thin orchestrators that spawn specialized agents via `Task()`. Total: 2,480 → 1,141 lines (54% reduction)
- **help.md** updated with all 36 commands
- **Installer** rewritten around `MANIFEST` object with per-runtime component definitions
- **Uninstaller** now uses MANIFEST for per-runtime file tracking

### Fixed

- `preflight.js` template path resolution
- `create-outline.wcn.md` step name (`git_commit` → `git_commit_initialization`)
- Dual installation (global + local) conflict detection and warning
- 5 install/uninstall edge cases found via E2E testing

## [0.4.0] - 2026-01-13

Citation Expert v2 — deterministic, plug-and-play citation pipeline with tiered API search and impact scoring.

### Added

- **Tiered search pipeline** — Semantic Scholar (primary), SerpAPI/Google Scholar (seminal), CrossRef (fallback)
- **Impact scoring engine** — Automated ranking by citation count, velocity, recency, and venue prestige
- **Provenance tracking** — BibTeX entries include `wtfp_*` fields for source, impact metrics, and verification status
- **Intent-aware search** — `/wtfp:research-gap` supports `--intent=seminal|recent|specific`
- **Auto-suggest** — `/wtfp:check-refs` suggests tiered API replacements for missing citations

### Changed

- `/wtfp:analyze-bib` — Added automated impact analysis and seminal work identification
- `bib-index` and `bib-format` — Refactored for large-scale bibliography management

## [0.3.0] - 2026-01-12

The 4 P's — expanded from papers to proposals, presentations, and posters. Multi-vendor repo structure and skills system.

### Added

- **Poster workflow** — `/wtfp:create-poster` with HTML/CSS academic poster template
- **Slides workflow** — `/wtfp:create-slides` with Marp presentation template
- **Skills system** (Claude Code) — `wtfp-marp` (Markdown → HTML/PDF) and `wtfp-echarts` (data → charts)
- **Plugin manifest** for Claude Code marketplace
- **Multi-vendor repo structure** — `vendors/claude/`, `vendors/gemini/`, `vendors/opencode/` with shared `core/`

## [0.2.0] - 2026-01-11

CLI improvements and contribution system.

### Added

- `/wtfp:report-bug`, `/wtfp:request-feature`, `/wtfp:contribute` commands
- Improved installer with conflict resolution and backup support

## [0.1.0] - 2026-01-11

Initial public release.

### Added

- 21 slash commands for paper lifecycle management
- 5 venue templates (ACM-CS, IEEE-CS, arXiv-ML, Nature, Thesis)
- WCN compressed workflows (35–50% token savings)
- Subagent architecture for section isolation
- BibTeX integration and citation management
- Git-based version control for drafts
- `npx wtf-p` interactive installer with `--global`, `--local`, `--config-dir` options

[Unreleased]: https://github.com/PanStudio/panwrite/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/PanStudio/panwrite/compare/v0.9.1...v1.0.0
[0.9.1]: https://github.com/PanStudio/panwrite/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/PanStudio/panwrite/compare/v0.8.5...v0.9.0
[0.8.5]: https://github.com/PanStudio/panwrite/compare/v0.8.4...v0.8.5
[0.8.4]: https://github.com/PanStudio/panwrite/compare/v0.8.3...v0.8.4
[0.8.3]: https://github.com/PanStudio/panwrite/compare/v0.8.2...v0.8.3
[0.8.2]: https://github.com/PanStudio/panwrite/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/PanStudio/panwrite/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/PanStudio/panwrite/compare/v0.7.4...v0.8.0
[0.7.4]: https://github.com/PanStudio/panwrite/compare/v0.7.3...v0.7.4
[0.7.3]: https://github.com/PanStudio/panwrite/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/PanStudio/panwrite/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/PanStudio/panwrite/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/PanStudio/panwrite/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/PanStudio/panwrite/compare/v0.6.0-rc.2...v0.6.0
[0.6.0-rc.2]: https://github.com/PanStudio/panwrite/compare/v0.6.0-rc.1...v0.6.0-rc.2
[0.6.0-rc.1]: https://github.com/PanStudio/panwrite/compare/v0.5.0...v0.6.0-rc.1
[0.5.0]: https://github.com/PanStudio/panwrite/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/PanStudio/panwrite/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/PanStudio/panwrite/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/PanStudio/panwrite/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/PanStudio/panwrite/releases/tag/v0.1.0
