# Importing a research workflow into PanWrite

A research plugin can hand its results to PanWrite through three separate public actions. Keep research artifacts in their authored format and location. Only PanWrite's actions create or update portable `.planning/` records, after their declared gates. The spelling below is the canonical namespace; use the host's matching command or the `panwrite-start-project` skill with an explicit action request.

1. `panwrite:new-paper`: provide the document type, working title, core argument, audience, venue constraints, known findings, limitations, exclusions, author decisions, and open questions. When materials already exist, explicitly choose initialization first. PanWrite interviews the author and previews five records before writing. An existing manifest stops initialization; inspect that project instead of overwriting it.
2. `panwrite:map-project`: provide an explicit list of contained, project-relative material paths, source metadata, inspection depth, provenance, claim interpretations, locators, and uncertainty. Explicitly include hidden `.research/` material when intended. Mapping is local and does not upload, rewrite, or move the files. Repeat mapping reads existing records, preserves stronger verification and curated annotations, reports identity collisions, and reconciles manifest material/manuscript indexes without dropping existing entries.
3. `panwrite:create-outline`: provide structural preferences and unresolved author choices grounded in the mapped records. The orchestrator delegates structural work, handles requests for author input, and obtains approval of the outline and decision diffs. Section word targets must sum exactly to the approved target.

## Host invocation spelling

Use these entry points for the generated host adapters. Append the corresponding payload after the command or action request; run each step separately.

| Host | Initialize | Map supplied research | Create outline |
| --- | --- | --- | --- |
| Clio Coder | `/panwrite:new-paper` | `/panwrite:map-project` | `/panwrite:create-outline` |
| Claude Code | `/panwrite:new-paper` | `/panwrite:map-project` | `/panwrite:create-outline` |
| Codex | `$panwrite-start-project Run the new-paper action.` | `$panwrite-start-project Run the map-project action.` | `$panwrite-start-project Run the create-outline action.` |
| GitHub Copilot CLI, OpenCode, Antigravity CLI, Gemini CLI | `/panwrite:new-paper` | `/panwrite:map-project` | `/panwrite:create-outline` |

On Codex the plugin is `panwrite` and all three actions belong to its `panwrite-start-project` skill, mentioned as `$panwrite-start-project`. Codex does not expose these actions as slash commands. If the canonical bundle is installed directly in another Agent Plugins host, use that host's discovered skill qualifier. Every slash-command host exposes the `/panwrite:<action>` form and nothing else.

A handoff should contain three paste-ready payloads, each usable separately. For example:

```text
Action: panwrite:new-paper
Initialize first, then offer mapping. Write a research article for [audience].
Contribution: [claim]. Evidence available: [observations].
Limitations and unresolved choices: [items]. Interview me before initialization.
```

```text
Action: panwrite:map-project
Inspect only .research/data/paper-notes.md and .research/results/measurements.csv
inside this project. Hidden .research material is explicitly included.
Source identity/provenance: [author-supplied metadata and inspection depth].
Claim interpretations: [claim, source locator, relation, uncertainty].
Preserve provisional status where identity or findings have not been verified.
```

```text
Action: panwrite:create-outline
Use the mapped evidence to propose [structure and word target].
Keep [locked choice]; ask me to resolve [open choice]. Preview the full diff.
```

Structured bibliography parsing requires an exact declared parser binding. The current `map-project` action has no such binding and reports that structured parsing as unavailable; do not substitute shell execution or fabricate missing identity fields. Author-provided narrative source metadata remains usable. The follow-on research routes `research-gap`, `analyze-bib`, and `check-refs` are available on Clio Coder and Claude Code, where `tool.execute` is bound to the bundled `tools/panwrite-tool.js` dispatcher and nothing else, and they return `PANWRITE_ACTION_UNAVAILABLE` on Codex, Copilot CLI, OpenCode, Antigravity, and Gemini until their shell tools are verified and bound. [HOST_CAPABILITIES.md](HOST_CAPABILITIES.md) records the per-host availability.

No bridge initializes Git, commits research, creates Git-tag checkpoints, or writes legacy `.planning/PROJECT.md`. Research checkpoint archives and task completion do not substitute for PanWrite author gates or readback.
