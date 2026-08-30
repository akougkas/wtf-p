# Migrating from WTF-P v0.5 to v0.6

WTF-P v0.6 preserves the familiar 36 `wtfp:*` actions, but replaces copied client-specific workflows with a canonical portable protocol and generated native adapters. Migration is intentionally conservative: the installer does not infer ownership of old files, delete an existing project, or silently convert manuscript content.

## What changes

| v0.5 | v0.6 |
| --- | --- |
| Claude, Gemini, and OpenCode command trees maintained separately | One `protocol/` source generates seven client envelopes |
| Markdown files such as `.planning/STATE.md`, `PROJECT.md`, and `ROADMAP.md` act as control state | Versioned JSON records under `.planning/` are the interoperable source of truth |
| Checkpoints may rely on Git commits or tags | Checkpoints use portable records and immutable SHA-256 state archives |
| Client-specific agent paths and model tables appear in workflows | Semantic roles and capabilities are mapped by the active host |
| Broad copied helper directories | Exactly seven registered portable bibliography/citation tools |
| Uninstall infers paths from package layout | A v2 receipt owns exact files and hashes |

Authored manuscripts, section context, research notes, plans, reviews, summaries, bibliographies, and deliverables remain in their existing formats. The v1 protocol links those artifacts; it does not rewrite prose into JSON.

## 1. Back up and inspect

Commit or otherwise back up the academic project using your normal process before migrating. This is a user-owned project backup, not a WTF-P workflow side effect.

Inspect each existing installation:

```bash
npx --yes --package=wtf-p@0.5.0 -- wtf-p status --claude
npx --yes --package=wtf-p@0.5.0 -- wtf-p doctor --claude
npx --yes --package=wtf-p@0.5.0 -- wtf-p uninstall --claude --dry-run
```

Replace `--claude` with `--gemini` or `--opencode` for another v0.5 target. A legacy installation without a v2 ownership receipt is diagnostic-only by default. WTF-P reports it and preserves it unless you explicitly choose the documented forced migration path.

## 2. Remove or preserve the legacy client copy

If the dry run identifies a trustworthy v2 installation, uninstall exact owned files:

```bash
npx --yes --package=wtf-p@0.5.0 -- wtf-p uninstall --claude --backup --yes
```

If ownership cannot be proven, either leave the legacy copy in place while testing v0.6 under an isolated client home, or review the reported files and use the explicit force policy only after making a backup. The uninstaller never recursively removes a generic `commands/`, `skills/`, `agents/`, `bin/`, or `mcp/` directory.

An earlier development build may have copied the obsolete unregistered
`vendors/claude/mcp/research-server` prototype. An in-place v0.6 installation
does not guess that those files are disposable or terminate a process started
outside WTF-P. Use the receipt-backed dry run and uninstall above before
installing the release candidate; if the prototype is not receipt-owned, review
and remove that exact legacy copy yourself. The release-candidate archive and
generated inventories contain no MCP server or registration.

Avoid activating both the old direct Claude commands and the v0.6 Claude plugin at once; duplicate command names are confusing even when the files themselves are safe.

## 3. Install one explicit v0.6 target

Each modern target maps to that client's documented native user configuration
root. The examples below pin the immutable release candidate; changing the
package selector to `--package=wtf-p@next` instead selects the newest moving
prerelease. Keep the explicit `--package … -- wtf-p` form so an older globally
installed executable cannot shadow the requested package. An unqualified
`npx wtf-p` still selects the v0.5 stable line. Use `--config-dir` for a
deliberate custom installation destination. It does not, by itself, isolate
every runtime home, data, state, cache, and temporary path used by the client.

```bash
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install clio
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install claude
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install codex
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install copilot
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install opencode
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install antigravity
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p install gemini
```

The deprecated `--global` and `--local` flags remain Claude compatibility aliases during the release-candidate cycle. No targetless noninteractive invocation installs anything.

In RC2, `status` and `doctor` remain legacy Claude-oriented diagnostics; a
modern target selector passed to either command is not authoritative. Verify a
modern adapter with the client's native discovery surface instead. For Clio,
check `clio-coder --version`, `/prompts`, `clio-coder agents`, and
`clio-coder fleet list`; use the equivalent native command, plugin, or skill
listing for another client. A successful install plus native discovery is the
RC2 verification boundary.

For Clio, the installer also performs an isolated, credential-free capability
probe. Clio Coder 0.3.8 includes recursive `/wtfp:*` prompts, extension agents,
and fleets. The manifest's `compatibility.clio` field is advisory in 0.3.8, so
the probe—not the field—is the authoritative gate. Older builds retain flat
prompts and skills but can silently load zero extension agents or fleets.

Clio preserves the raw operator prose bound to `$ARGUMENTS` in 0.3.8, including
quotes, tabs, repeated spaces, and literal `$1`; positional forms such as `$1`,
`$@`, and `${@:N:L}` retain tokenized semantics. Existing user-level prompts
may take precedence over an extension prompt. Inspect `/prompts` and its
reported source before assuming `/wtfp:new-paper` resolves to the newly
installed extension; preserve or remove an older copy through the user's normal
backup process rather than letting WTF-P overwrite it.

Codex exposes academic workflows through Agent Skills, not the slash-command
surface shown below. Use the owning `$wtf-p:<skill>` selector when explicit
routing is required.

For a GitHub-hosted Copilot coding agent, the user-level CLI installation is not enough: review and copy `vendors/copilot/project/.github/` from the release archive into the academic repository and commit it through the repository's normal review process. WTF-P does not silently merge or overwrite a project's existing `.github` instructions.

## 4. Migrate project control state deliberately

Do not rename legacy Markdown control files to `.json`. Their structures are not equivalent.

For a new project, run `/wtfp:new-paper`; it previews and schema-validates these five initial records before creation:

```text
.planning/project.json
.planning/config.json
.planning/state.json
.planning/decisions.json
.planning/structure/outline.json
```

For an existing paper that does **not** already contain
`.planning/project.json`, run `/wtfp:new-paper` first. Tell the agent explicitly
to preserve and initialize around the existing manuscript and materials. Review
and approve the five proposed control records, then run `/wtfp:map-project` to
inventory the existing drafts, source/evidence material, decisions, and section
artifacts. `map-project` reads an existing portable manifest and state; it does
not create those initialization records by itself.

An already initialized portable-v1 project can begin with `/wtfp:progress`,
`/wtfp:map-project`, or `/wtfp:resume-writing`, depending on its durable state.
Keep legacy planning files during the release-candidate cycle as historical
input, but v0.6 workflows must not treat them as current control state.

Key distinctions to verify during review:

- `source` records establish bibliographic or data provenance;
- `evidence` records describe what a source supports, contradicts, or contextualizes;
- `decisions` preserve locked, deferred, and discretionary author choices;
- section records link authored context, research, plans, reviews, summaries, and manuscript artifacts;
- validation records report findings and never imply a mutation was applied;
- checkpoints record interaction gates or immutable state snapshots without changing Git state.

## 5. Validate a harmless workflow

Start with read-only actions:

```text
/wtfp:progress
/wtfp:list-assumptions <section>
/wtfp:verify-work <scope>
```

Then preview one bounded write, such as `/wtfp:plan-section`, and confirm that:

- logical resources resolve inside the project;
- the action loads its bound schema and template resources;
- a required specialist/checker pass is not skipped;
- the mutation preview matches the action contract;
- no repository initialization, commit, branch, push, or publish occurs;
- the receipt and normal client profile outside the selected root remain unchanged.

## 6. Roll back the client installation if needed

Preview exact removal:

```bash
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p uninstall --<target> --dry-run
```

Then remove unchanged owned files:

```bash
npx --yes --package=wtf-p@0.6.0-rc.2 -- wtf-p uninstall --<target> --backup --yes
```

Modified files and unowned siblings are preserved by default. A client-install rollback does not delete or downgrade `.planning/` records in an academic project; restore project data only from an independently verified project backup or a v0.6 recovery archive.

## Compatibility boundary

The `core/write-the-f-paper/` tree remains in the npm package for v0.5 compatibility and archaeological reference, but v0.6 native adapters do not install or execute it. Generated v0.6 workflows use only the canonical protocol, standard skills, semantic roles, the seven-entry logical tool registry, and portable project records. The registry is a package/provenance allowlist, not permission to invoke a general shell: a client without an exact contained logical-tool binding must report `tool.execute` unavailable.

See [GETTING_STARTED.md](GETTING_STARTED.md) for client invocation, full runtime
isolation, and troubleshooting; [COMPATIBILITY.md](COMPATIBILITY.md) for exact
client versions and live-evaluation caveats; and
[BUILD_AND_RELEASE.md](BUILD_AND_RELEASE.md) for maintainer validation and
package checks.
