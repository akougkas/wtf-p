# Contributing to WTF-P

WTF-P is a portable academic-research and writing protocol for AI coding agents. Contributions are welcome across workflows, project schemas, Agent Skills, specialist roles, runtime adapters, installation safety, documentation, and tests.

## Before you start

- Open an issue for behavior changes that affect the public action catalog, project protocol, or compatibility claims.
- Never test an installer against your normal agent profile. Use explicit disposable client homes and a disposable fixture project.
- Treat `protocol/` as the source of truth and `vendors/` as generated output.
- Preserve user-authored worktree changes and unrelated files.
- Do not publish packages, push branches, register personal marketplaces, or modify a user's normal client configuration as part of a development test.

## Development setup

WTF-P requires Node.js 20 or newer and has no runtime package dependencies.

```bash
git clone https://github.com/YOUR_USERNAME/wtf-p.git
cd wtf-p
npm test
```

Useful commands:

```bash
npm run build:adapters       # Regenerate all native envelopes
npm run check:adapters       # Fail if generated output is stale
npm run test:protocol        # Catalog, workflows, roles, schemas, skills, compiler
npm run test:installer       # Import safety, containment, ownership, races, targets
npm run test:compatibility   # Retained v0.5 behavior and v0.6 product structure
npm run test:integration     # Isolated install/uninstall lifecycle
npm run test:all             # Complete regression suite
npm run preflight            # Complete suite plus release-archive inspection
```

## Architecture and ownership

The repository has four layers:

```text
protocol/
  actions/                  machine-readable action contracts
  workflows/                canonical host-neutral workflow prose
  skills/                   seven standard Agent Skills
  roles/                    eleven semantic specialist contracts
  project/                  portable .planning v1 schemas and templates
  catalog.json              stable public action/skill inventory
  effects.json              effect and capability vocabulary
  tools.json                exact portable-tool allowlist

bin/
  lib/adapter-compiler.js    deterministic native-envelope compiler
  lib/manifest.js            installer target and component definitions
  lib/native-registration.js native marketplace/plugin lifecycle drivers
  commands/install-logic.js  transactional installation

vendors/                    generated client resources; do not hand-edit
  clio/                     Clio extension, prompts, agents, skills, fleets
  claude/                   Claude Code plugin and marketplace
  codex/                    Codex plugin and personal-marketplace envelope
  copilot/                  Copilot CLI plugin plus .github project projection
  opencode/                 OpenCode filesystem bundle
  antigravity/              Antigravity CLI plugin
  gemini/                   Gemini CLI extension

core/write-the-f-paper/     retained v0.5 compatibility and migration material
test/                       contract, regression, adversarial, and integration tests
```

Canonical changes flow in one direction:

```text
protocol source → adapter compiler → vendors/* → isolated native validation
```

Generated files carry a compiler provenance marker and are authenticated by `.wtfp-generated.json` inventories. A generated output may be inspected or tested, but its fix belongs in the canonical source or compiler. Run the compiler once after the source change and commit its complete output.

## Adding or changing an action

The stable public namespace currently contains 36 `wtfp:<action>` aliases. To add or change one:

1. Add or edit `protocol/actions/<action>.json`.
2. Add or edit `protocol/workflows/<action>.md`.
3. Assign an academic action to exactly one skill in `protocol/catalog.json`; product operations remain outside default skill trigger space.
4. Update the owning skill's `references/actions.md` and, when the trigger boundary changes, its `SKILL.md` description.
5. Declare every read, output mode, delegation, capability, tool, effect, and user gate exactly. An update or deletion must read the target first.
6. Use logical `project://`, `protocol://`, `role://`, and `wtfp://tools/` URIs. Do not embed a workstation path, client home, concrete model, or vendor tool name in canonical content.
7. Run `npm run build:adapters` once.
8. Run `npm run test:protocol` and `npm run check:adapters`.

Do not add a second hand-maintained Claude, Gemini, OpenCode, or other runtime body. The compiler owns native syntax, resource roots, frontmatter, command namespaces, argument placeholders, and relevant action/schema/template binding.

## Changing project state

Portable control state lives in versioned JSON records under `.planning/`; authored manuscripts, context, research, plans, reviews, summaries, and deliverables retain their natural formats and are linked from those records.

When changing the project protocol:

- Update the relevant schema and minimal valid template together.
- Keep objects closed with `additionalProperties: false` unless a documented extension point requires otherwise.
- Preserve stable identifiers, revision rules, timestamps, cross-record references, and logical-URI containment.
- Extend positive and negative fixtures in `test/project-protocol.test.js`.
- Never infer v1 state from legacy `PROJECT.md`, `ROADMAP.md`, or `STATE.md` files.
- Implement checkpoints as portable records and immutable hashed archives, not Git commits, tags, resets, branches, or worktree movement.

## Skills and specialist roles

Skills follow the Agent Skills standard:

- `SKILL.md` has valid `name` and trigger-focused `description` frontmatter.
- Keep the main skill concise; place action detail in `references/actions.md`.
- Avoid vendor names, absolute paths, and hidden state assumptions.
- Keep each academic action uniquely owned.
- Store OpenAI UI metadata in `agents/openai.yaml` when present.

Roles are semantic contracts, not vendor-specific agent recipes. Each role must declare purpose, capability classes, inputs, procedure, boundaries, and the `wtfp.role-result/v1` return contract. A role never prompts the user directly; unresolved judgment returns through its structured result.

## Adapter compiler changes

Compiler output must be deterministic across machines and isolated homes. Adapter changes must preserve:

- exact 36-action alias parity on command-capable hosts;
- all seven skills and eleven roles;
- target-native command syntax and invocation-argument forwarding;
- contained resource references with no unresolved include;
- exact, fail-closed generated inventories and stale-file cleanup;
- only the seven tools declared by `protocol/tools.json`;
- marketplace/plugin manifests that native validators accept;
- no incidental network, VCS, package-publish, or profile mutation behavior.

Update `test/adapter-compiler.test.js` for a new invariant. Never loosen a test merely to accept nondeterminism or a broader permission projection.

## Installer and uninstaller safety

Installation code handles user data and has a higher review bar. Preserve these invariants:

- CLI modules remain silent and mutation-free when imported.
- Noninteractive mutation requires an explicit target or scope.
- Roots, homes, repository roots, traversal, and symlink escapes are rejected.
- Planning snapshots source and destination identity before publication.
- Writes and receipts are atomic where the platform permits.
- A v2 receipt records only actual owned writes with SHA-256 hashes.
- Rollback preserves concurrent edits and reports any residual recovery work.
- Uninstall removes exact unchanged owned files only, unless an explicit force policy applies.
- Generic directories and unowned siblings are never recursively deleted.
- Native marketplace registration is idempotent and collision-safe.
- Native activation compensates registrations created by a failed activation attempt.
- A partial bundle with preserved conflicts is never newly registered as native.
- Every test uses disposable client roots; a developer's real profile is out of scope.

Add adversarial coverage for path, race, receipt, rollback, and repeated-operation behavior. A happy-path test is not sufficient for a new filesystem mutation.

## Native validation

Static tests are the minimum. Before advertising a client as verified, validate its generated envelope with the actual supported CLI under an isolated home. Record exact client/model versions and distinguish discovery, static validation, and paid model evaluation.

Never copy or expose credentials in logs. If an isolated credential store is necessary, use restrictive permissions, verify normal-profile hashes before and after the run, and securely remove copied credentials. See `docs/COMPATIBILITY.md` and `docs/BUILD_AND_RELEASE.md` for the current matrix and release procedure.

## Pull requests

Before opening a PR:

1. Run `npm run check:adapters`.
2. Run `npm run test:all` for code or protocol changes.
3. Run `npm run preflight` for release-facing changes.
4. Check `git diff --check` and review the package archive summary.
5. Describe canonical sources changed, generated outputs affected, tests run, compatibility implications, and any deliberate deferral.

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(optional-scope): <imperative description>
```

Common types are `feat`, `fix`, `docs`, `refactor`, `test`, and `chore`. Useful scopes include `protocol`, `skills`, `adapters`, `clio`, `cli`, `installer`, `safety`, and `release`. A scope is encouraged when it makes the ownership boundary clearer, but is not required.

## Questions and responsible reports

- Use [Discussions](https://github.com/akougkas/wtf-p/discussions) for design questions.
- Search existing [Issues](https://github.com/akougkas/wtf-p/issues) before filing a report.
- Do not include credentials, unpublished manuscripts, private bibliographies, or isolated live-test traces in an issue.

Thank you for helping make rigorous academic workflows portable across agent platforms.
