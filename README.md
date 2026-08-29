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

Then start a paper with the native WTF-P action exposed by your client:

```text
/wtfp:new-paper
/wtfp:create-outline
/wtfp:plan-section 1
/wtfp:write-section 1
/wtfp:review-section 1
```

Clio also ships flat `/wtfp-new-paper` compatibility prompts for current releases. The patched Clio integration discovers the preferred nested `/wtfp:new-paper` namespace.

## First-class adapters

| Target | Native envelope | Actions | Specialists | Skills | Target-specific capabilities |
| --- | --- | ---: | ---: | ---: | --- |
| Clio Coder | Extension | 36, plus 36 flat aliases | 11 | 7 | Strict recipes, extension-bound skills, two fleets |
| Claude Code | Claude plugin | 36 | 11 | 7 | Native command permissions and plugin validation |
| Codex | Codex plugin | Through skills | Host-managed | 7 | `.codex-plugin` metadata and marketplace packaging |
| GitHub Copilot CLI | Copilot/Claude-compatible plugin | 36 | 11 | 7 | CLI plugin discovery and cloud-safe resources |
| OpenCode | Filesystem bundle | 36 | 11 | 7 | Native commands and agents |
| Antigravity CLI | `agy` plugin | 36 | 11 | 7 | Commands converted to native skills by `agy` |
| Gemini CLI | Gemini extension | 36 | 11 | 7 | TOML commands and extension context |

The adapters are generated artifacts, not seven hand-maintained copies. Every generated envelope includes a cryptographic inventory and the portable protocol resources needed to understand its workflows.

The release-candidate matrix was exercised with Claude Code 2.1.251, Codex CLI 0.144.1, Copilot CLI 1.0.80, OpenCode 1.18.16, Antigravity 1.1.22, Gemini CLI 0.57.0, and the coordinated Clio branch. Real isolated evaluations used Claude Sonnet 5/xhigh, Codex GPT-5.4/xhigh (GPT-5.6 was unavailable through that CLI's ChatGPT-auth route), and Clio GPT-5.6 Terra/xhigh. See [compatibility evidence](docs/COMPATIBILITY.md) for exact claims and caveats.

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

- A versioned `.planning` project protocol for the project manifest, configuration, state, sources, evidence, decisions, outline, sections, checkpoints, and validation results.
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
- It records only files it actually wrote, with SHA-256 hashes, in a v2 receipt.
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

The Clio reference integration is developed alongside WTF-P in `clio-coder`. It adds recursive namespaced extension prompts, extension-owned agents and fleets, same-extension skill binding, and contained `${extensionRoot}` resource resolution.

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
- [Contributing](CONTRIBUTING.md)
- [Roadmap](ROADMAP.md)
- [License](LICENSE)
- [GitHub](https://github.com/akougkas/wtf-p)

<div align="center">

**No more excuses. Ship the paper.**

</div>
