# WTF-P documentation

Version `0.7.2`. Start with the [README](../README.md) for the two-screen
overview, then use the guide that matches your role.

## For scientists and operators

| Guide | Read it when |
| --- | --- |
| [Getting started](GETTING_STARTED.md) | You want to install WTF-P into one host, launch it, run the first actions, or remove it |
| [Proposal workflow](PROPOSAL_WORKFLOW.md) | You are writing a solicitation-driven grant proposal and want the full interview, outline, section, review, and pause/resume loop |
| [Migrating from v0.5](MIGRATION_V05_TO_V06.md) | You have a v0.5 installation or project and need the conservative upgrade path |
| [CiteNexus companion](CITE_NEXUS.md) | You want source-backed scholarly search through the optional, separately installed CiteNexus backend, its provider choices, and its limits |
| [Research handoff](RESEARCH_HANDOFF.md) | Another tool or plugin produced research artifacts and you want WTF-P to initialize, map, and outline from them |

## For people integrating or verifying a host

| Reference | What it holds |
| --- | --- |
| [Host capabilities](HOST_CAPABILITIES.md) | Per-host loader facts, what WTF-P projects into each package, the exact verification commands and their observed output, and the per-host action availability table |
| [Agent plugin packaging](AGENT_PLUGIN.md) | The canonical Agent Plugins 1.0.0 bundle, the Clio install lifecycle the installer follows, and the research execution boundaries |
| [Compatibility and evidence](COMPATIBILITY.md) | What "verified" means, the current discovery evidence, known limitations, and the labelled historical evidence from earlier candidates |
| [Portable project protocol](../protocol/project/README.md) | The `.planning` v1 records, logical URIs, and invariants every workflow obeys |
| [Authored-artifact templates](../protocol/templates/README.md) | The paper, grant-proposal, poster, and slides scaffolds |

## For maintainers

| Reference | What it holds |
| --- | --- |
| [Building and releasing](BUILD_AND_RELEASE.md) | Source and generated boundaries, development commands, the routing-matrix reseal, preflight, version preparation, tagging, and publication |
| [Contributing](../CONTRIBUTING.md) | Repository layout, how to change an action, project state, skills, roles, the compiler, and installer safety invariants |
| [ADR 0001: tool execution](adr/0001-hybrid-tool-execution.md) | Why bibliography transforms stay local, why no MCP server ships, and the gates for any future network service, with its 2026-09-09 dispatcher and 2026-09-16 CiteNexus amendments |
| [Agent-platform modernization](agent-platform-modernization.md) | The original design contract for the 0.6 line, kept as a historical record with a status banner |
| [Evaluation methodology](../evaluation/README.md) | Routing corpus, rubrics, fixtures, sealed manifests, and the retained evidence packs |
| [Changelog](../CHANGELOG.md) | Release notes per version |
