# Agent Model Matrix

Model assignments per agent across quality/balanced/budget profiles. Resolved at runtime from `.planning/config.json` `model_profile` field.

## Lookup Table

| Agent | Role | quality | balanced | budget |
|-------|------|---------|----------|--------|
| section-planner | Creates PLAN.md with argument decomposition, word budgets, citation planning | opus | opus | sonnet |
| plan-checker | Pre-write validation of plans (7 dimensions) | sonnet | sonnet | haiku |
| section-writer | Executes PLAN.md, writes prose, atomic commits | opus | sonnet | sonnet |
| argument-verifier | Goal-backward verification of written sections | sonnet | sonnet | haiku |
| section-reviewer | 3-layer verification with reviewer personas | opus | sonnet | haiku |
| prose-polisher | De-robotize text, voice adjustment, sentence variety | opus | sonnet | haiku |
| research-synthesizer | Literature discovery, gap analysis, positioning | opus | sonnet | haiku |
| citation-expert | Search papers, manage BibTeX, identify gaps | sonnet | sonnet | haiku |
| citation-formatter | BibTeX validation, formatting, deduplication | sonnet | haiku | haiku |
| citation-retriever | Literature discovery, BibTeX generation | sonnet | haiku | haiku |
| coherence-checker | Cross-section coherence, argument flow, terminology consistency | sonnet | sonnet | haiku |
| outliner | Generates outline.md, argument-map.md, narrative-arc.md from PROJECT.md | opus | sonnet | sonnet |

## Resolution Pattern

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | \
  grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | \
  grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

Default: `balanced` when config missing or field absent.

## Orchestrator → Agent Mapping

| Orchestrator Command | Primary Agent | Quality Agent |
|---------------------|---------------|---------------|
| /wtfp:plan-section | section-planner | plan-checker |
| /wtfp:write-section | section-writer | argument-verifier |
| /wtfp:review-section | section-reviewer | — |
| /wtfp:polish-prose | prose-polisher | — |
| /wtfp:research-gap | research-synthesizer | — |
| /wtfp:analyze-bib | citation-expert | — |
| /wtfp:check-refs | citation-formatter | — |
| /wtfp:execute-outline | outliner | coherence-checker |
| /wtfp:create-outline | outliner | — |

## Profile Selection Guide

**quality** — Use for final drafts, critical sections (introduction, discussion), submission-ready work. Higher token cost, maximum reasoning depth.

**balanced** — Default. Good for most drafting, planning, and revision work. Planner stays at opus for argument quality; writer uses sonnet for cost efficiency.

**budget** — Use for iterative rough drafts, boilerplate sections (acknowledgments, author contributions), or when iterating rapidly. Significantly lower cost.

## Setting Profile

```bash
# Via config.json
cat .planning/config.json | jq '.model_profile = "quality"' > tmp && mv tmp .planning/config.json

# Via command
/wtfp:settings → model_profile → quality|balanced|budget
```
