# Standard Agent Plugin packaging

The generated `vendors/plugin/` directory is WTF-P's Agent Plugins 1.0.0 bundle. Its root `plugin.json` uses the official schema at https://agent-plugins.org/schemas/1.0.0/plugin.schema.json, standard metadata, the stable package name `wtfp`, and conventional `skills/`. The npm distribution remains `wtf-p`.

Clio resource roots and the component graph live under `extensions["ai.iowarp.clio"]`. Native prompts, agents, and fleets are under `ai.iowarp.clio/`; shared protocol records, schemas, resources, and skills retain their contained paths. Public prompts retain `wtfp` names. This domain bundle does not register new harness tools or enable MCP execution.

The Codex projection also includes a standard root manifest, with its existing `wtf-p` package identity and `.codex-plugin/plugin.json` compatibility fallback. Claude, Copilot, OpenCode, Antigravity, and Gemini retain their native projections. The compiler remains the source of every generated adapter; never hand-edit these bundles.

## Clio installation and compatibility

For a fresh destination, WTF-P probes `clio-coder plugins list --all --json` in a credential-free disposable profile. A client exposing that contract receives `plugins/wtfp/` and native `plugins install` activation. Legacy clients retain the capability-checked `extensions/wtfp/` route. Missing binaries retain explicit pending activation instructions.

An existing WTF-P extension stays on the extension lifecycle, including on a newer client. This avoids duplicate prompts and preserves user modifications and native provenance. To migrate an existing installation, inspect the exact-file uninstall plan, remove the old installation through the WTF-P uninstaller, resolve any preserved modified or unowned files, then install with a plugin-capable client. The installer refuses a destination containing both forms. It never silently retires an unowned legacy registration.

Installing a previously disabled plugin requests activation; WTF-P explicitly enables it after replacement and restores the prior disabled state if activation or receipt publication fails. An unchanged active reinstall leaves native state untouched.

An existing standard plugin continues to use its plugin path even if the binary later disappears. Uninstall follows the receipt's owned paths, not current CLI capability. Native recursive removal requires an exact unchanged owned tree; modified or unowned files defer native removal. Registration and file publication are compensated if native installation, verification, or receipt publication fails. Concurrent edits preserve a recovery tree and produce explicit diagnostics.

Whole-tree inventories cover the standard manifest and every generated resource. Native integrity and provenance remain owned by Clio; the WTF-P receipt owns exact generated file writes. The temporary native installation source is not a durable update origin: update through WTF-P with the selected distribution/source, rather than trying to reuse a removed staging directory.

## Research execution boundaries

A discovered route is not necessarily executable. Local adapters preserve the 36-action catalog with 24 available actions; the remaining routes fail closed. Clio has no bound web search or generic portable tool executor. Its main-agent prompts inherit session tools, so semantic availability does not claim action-scoped enforcement.

Clio recipes retain supported mutation-report/verifier-report envelopes. A single `wtfp.role-result` validation/check carries serialized portable result JSON in `evidence`, preserving `needs_input`, `blocked`, and failure states. The orchestrator validates that result, handles author input, and redispatches; completion never replaces author approval or artifact readback.

See [RESEARCH_HANDOFF.md](RESEARCH_HANDOFF.md) for the three-action research bridge and [COMPATIBILITY.md](COMPATIBILITY.md) for historical native/model evidence. Standard packaging and deterministic tests do not establish a new model-backed lifecycle claim.

Native fleet write-boundary validation requires an existing Git checkout in the current Clio build. WTF-P never initializes that checkout as a workflow side effect. The opt-in integration test creates its own disposable Git fixture solely to exercise the host's boundary validator.

To repeat the isolated native test against an explicitly selected build:

```bash
WTFP_CLIO_ENTRY=/absolute/path/to/clio-coder/dist/cli/index.js node test/clio-native-integration.test.js
```

The test creates credential-free user and project profiles, verifies exact receipt hashes and native active flags, discovers all eleven recipes, validates both fleets, exercises idempotence and reactivation, removes both installations, and deletes its temporary roots. It makes no model call.
