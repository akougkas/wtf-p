<div align="center">

<img src="https://raw.githubusercontent.com/akougkas/wtf-p/main/assets/wtfp-banner.jpg" alt="WTF-P Banner" width="600">

# WTF-P

**Write The F\*\*\*ing Paper.**

Also: Proposal. Presentation. Poster.

Portable, evidence-grounded academic workflows for modern coding agents.

</div>

WTF-P turns an AI coding agent into a structured research and writing system. It plans before drafting, grounds claims in evidence, isolates section context, delegates bounded work to specialist agents, and verifies the result against the approved plan.

Version `0.6.0-rc.1` is a ground-up modernization of the agent platform. One canonical protocol now generates native resources for Clio Coder, Claude Code, Codex, GitHub Copilot CLI, OpenCode, Antigravity CLI, and Gemini CLI.

## Quick start

Install explicitly for the agent you use:

```bash
npx wtf-p install clio --advanced
npx wtf-p install claude --advanced
npx wtf-p install codex --advanced
npx wtf-p install copilot --advanced
npx wtf-p install opencode --advanced
npx wtf-p install antigravity --advanced
npx wtf-p install gemini --advanced
```

An interactive terminal can also run `npx wtf-p` and choose a target. A noninteractive bare invocation refuses to write anything; it requires an explicit target or scope.

Then start a paper with the native WTF-P action exposed by your client. The
following is the slash-command form used by Clio, Claude, Copilot, OpenCode,
Antigravity, and Gemini:

```text
/wtfp:new-paper
/wtfp:create-outline
/wtfp:plan-section 1
/wtfp:write-section 1
/wtfp:review-section 1
```

Clio also ships flat `/wtfp-new-paper` compatibility prompts for current releases. The coordinated Clio integration discovers the preferred nested `/wtfp:new-paper` namespace; installation probes that capability in a credential-free disposable profile and falls back gracefully for legacy clients.

Codex exposes the same academic methods as native Agent Skills instead of a
`/wtfp:*` command namespace. Select the owning plugin skill explicitly when the
route must be unambiguous (for example, `$wtf-p:wtfp-start-project` followed by
the `new-paper` request and its exact arguments). Existing user-level commands
can take precedence over extension commands in clients that support both; use
the client's discovery listing to confirm the reported source before testing a
new installation.

## First-class adapters

| Target | Native envelope | Actions | Specialists | Skills | Target-specific capabilities |
| --- | --- | ---: | ---: | ---: | --- |
| Clio Coder | Extension | 36, plus 36 flat aliases | 11 | 7 | Strict recipes, extension-bound skills, two fleets |
| Claude Code | Claude plugin | 36 | 11 | 7 | Native command permissions and plugin validation |
| Codex | Codex plugin | Through skills | Host-managed | 7 | `.codex-plugin` metadata and marketplace packaging |
| GitHub Copilot CLI | Native plugin plus committed `.github` projection | 36 | 11 | 7 | CLI discovery and cloud-safe prompts, agents, skills, and instructions |
| OpenCode | Filesystem bundle | 36 | 11 | 7 | Native commands and agents |
| Antigravity CLI | `agy` plugin | 36 | 11 | 7 | Commands converted to native skills by `agy` |
| Gemini CLI | Gemini extension | 36 | 11 | 7 | TOML commands and extension context |

The adapters are generated artifacts, not seven hand-maintained copies. Every generated envelope includes a cryptographic inventory and the portable protocol resources needed to understand its workflows. Copilot additionally receives a generated, commit-ready `.github` projection for cloud/repository use.

For a GitHub-hosted Copilot coding agent, review and copy the `.github/` tree from `vendors/copilot/project/` in the release archive into the target repository, then commit it through that repository's normal review process. The user-level `install copilot` command configures the CLI plugin; it deliberately does not write into an unrelated project checkout.

The release-candidate native-discovery matrix was exercised with Claude Code
2.1.251, Codex CLI 0.144.1, Copilot CLI 1.0.80, OpenCode 1.18.16,
Antigravity 1.1.22, Gemini CLI 0.57.0, and Clio Coder 0.3.8 at merged
commit `9b7b80cc`. Real isolated `new-paper` evaluations used Claude Sonnet
5/xhigh, Codex GPT-5.4/xhigh (GPT-5.6 was unavailable through that CLI's
ChatGPT-auth route), and Clio GPT-5.6 Terra/xhigh. The compiler-v4 Clio rerun
earned 8/8 with independent validation of all five previewed records. The
broader paid routing matrix, full lifecycle chain, and cross-version baseline
remain separate evidence gates. See [compatibility evidence](docs/COMPATIBILITY.md)
for exact claims and caveats. These are repository validation results, not a
claim that `0.6.0-rc.1` has been published.

The first retained local-model lifecycle reading used Clio 0.3.8 with
`dynamo/qwen3.8-27b`. Both native fleet contracts validated, but the lifecycle
did not pass: high effort timed out before writing, and an effort-off retry
stopped after `new-paper` because the model attempted a denied shell call and
made 5,600 section words disagree with the 6,000-word outline target. The five
records were individually schema-valid. See the
[blocked evidence](evaluation/v1/evidence/clio-dynamo-lifecycle-blocked/README.md);
the remaining lifecycle and routing roadmap items stay open.

## The paper lifecycle

WTF-P keeps the human in control while making the repeatable work deterministic:

1. `/wtfp:new-paper` captures research questions, intended contribution, evidence, audience, venue, and constraints.
2. `/wtfp:map-project` indexes existing drafts, sources, data, figures, and decisions.
3. `/wtfp:create-outline` turns the argument into sections, dependencies, and word budgets.
4. `/wtfp:research-gap` and `/wtfp:analyze-bib` build an evidence map without inventing citations.
5. `/wtfp:plan-section` creates a traceable section plan and can send it through an independent plan checker.
6. `/wtfp:write-section` drafts from the approved plan in bounded context.
7. `/wtfp:review-section`, `/wtfp:verify-work`, and `/wtfp:polish-prose` check argument coverage, evidence, coherence, venue requirements, and prose quality.
8. `/wtfp:audit-milestone`, `/wtfp:export-latex`, `/wtfp:create-slides`, and `/wtfp:create-poster` prepare deliverables.

Run `/wtfp:help` for all 36 stable actions.

## What became portable

The canonical source lives under `protocol/` and has four parts:

- A versioned `.planning` project protocol with 11 JSON schemas and ten templates for the project manifest, configuration, state, sources, evidence, decisions, outline, sections, checkpoints, and validation results.
- Seven standard Agent Skills for starting a project, literature research, section planning, section writing, manuscript review, project management, and research delivery.
- Thirty-six semantic action contracts declaring inputs, reads, outputs, specialist delegation, tools, effects, and approval boundaries.
- Eleven host-neutral specialist roles with strict mutation or verification result contracts.

Concrete model names and client tool syntax do not live in canonical workflow prose. Each adapter maps semantic needs such as filesystem access, research search, user interaction, and delegation into the active client's capabilities.

## Project state

New workflows use a versioned `.planning/` directory. Its records are JSON-schema validated and designed to survive movement between clients:

```text
.planning/
├── project.json
├── config.json
├── state.json
├── decisions.json
├── structure/outline.json
├── sources/*.json
├── evidence/*.json
├── sections/*/section.json
├── checkpoints/*.json
└── validations/*.json
```

The protocol records evidence separately from prose and records author decisions explicitly. That lets a reviewer trace a claim back to a source and lets a different agent resume without guessing what the author intended.

## Installation safety

The `0.6` installer is an ownership-aware transaction engine:

- It rejects filesystem roots, the home directory itself, the repository root, traversal, and symlink escapes.
- It snapshots package sources and refuses source or destination path races.
- It publishes files atomically where possible and rolls back a failed transaction.
- It compensates native marketplace/plugin registration if a later activation step fails.
- It does not register a partial adapter when any conflicting file was preserved.
- It records only files it actually wrote, with SHA-256 hashes, adapter-contract v1, and generator-v4 metadata, in a v2 receipt.
- Reinstallation cannot claim ownership of files it skipped.
- Uninstall removes exact unchanged owned files. It preserves modified files and unrelated siblings by default.
- Dry runs are byte-preserving.

Use a custom isolated client root when evaluating an adapter:

```bash
CODEX_HOME=/tmp/wtfp-codex npx wtf-p install codex --advanced
CLIO_CODER_CONFIG_DIR=/tmp/wtfp-clio npx wtf-p install clio --advanced
```

Inspect or remove an installation with:

```bash
npx wtf-p status
npx wtf-p doctor
npx wtf-p uninstall --clio --dry-run
npx wtf-p uninstall --clio --yes
```

The legacy `--global`, `--local`, `--claude`, `--gemini`, and `--opencode` selectors remain compatibility aliases during the release-candidate cycle.

## Developing adapters

Edit canonical resources under `protocol/`, then regenerate every native projection:

```bash
npm run build:adapters
npm run check:adapters
npm test
npm run test:integration
```

`check:adapters` fails when committed generated resources drift from their canonical inputs. The test suite also checks action parity, skills, portable roles, `.planning` schemas, resource containment, exact installer ownership, rollback, uninstall preservation, and native envelope structure.

The Clio reference integration is merged into Clio Coder `v0.3.8` at
`9b7b80cc`. It adds recursive namespaced extension prompts, extension-owned
agents and fleets, same-extension skill binding, contained `${extensionRoot}`
resource resolution, exact operator-argument preservation, preservation of
nested template `state.json` resources, and extension-aware fleet preflight.
Effective package discovery certifies 72 prompts (36 nested and 36 flat), 11
agents, seven skills, two fleets, and zero diagnostics. WTF-P capability-probes
that surface because Clio currently records, but does not enforce,
`compatibility.clio`. The generated fleet contracts use directory boundaries
(`.planning/` and `paper/`) so nested writes are authorized without broadening
the worker sandbox.

## Design principles

- Evidence before eloquence: a fluent paragraph is not a substitute for a supported claim.
- Specification before drafting: author intent and acceptance criteria remain explicit.
- Portable semantics, native ergonomics: share the method while respecting each client's real plugin model.
- Bounded delegation: specialists receive the minimum context and authority their task requires.
- Human approval at consequential boundaries: deletion, commits, merges, package updates, and external issue creation remain explicit effects.
- Reversible installation: WTF-P never treats an agent's whole configuration directory as its property.

## Origin

WTF-P was built at the [Gnosis Research Center](https://grc.iit.edu/) at Illinois Tech for research teams with papers to publish, grants to win, and no time for writer's block.

## Links

- [Changelog](CHANGELOG.md)
- [Modernization architecture](docs/agent-platform-modernization.md)
- [Compatibility evidence](docs/COMPATIBILITY.md)
- [Behavioral evaluation methodology](evaluation/README.md)
- [Tool execution and MCP decision](docs/adr/0001-hybrid-tool-execution.md)
- [v0.5 → v0.6 migration guide](docs/MIGRATION_V05_TO_V06.md)
- [Build and release](docs/BUILD_AND_RELEASE.md)
- [Contributing](CONTRIBUTING.md)
- [Roadmap](ROADMAP.md)
- [License](LICENSE)
- [GitHub](https://github.com/akougkas/wtf-p)

<div align="center">

**No more excuses. Ship the paper.**

</div>
