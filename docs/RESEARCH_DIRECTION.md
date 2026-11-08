# Research direction and competitive evidence

Recorded 2026-10-13. Repository baseline: WTF-P 0.8.0, commit `eff98ba`.

## Maintainer decisions

Anthony Kougkas established these priorities on 2026-10-13:

1. **Clio Coder is the reference implementation.** Other hosts progressively match its guarantees through the canonical protocol and verified native bindings.
2. **Separate human gates are essential.** Humans remain in the loop at the writing workflow's consequential boundaries. Improved ergonomics must preserve those decisions and their records.
3. **The decisive demonstration is a real, citation-grounded paper or proposal completed in Clio.** After hardening the system, use WTF-P to write about WTF-P and evaluate it against relevant research.

These are confirmed product decisions. The positioning, priorities, and experimental design below are recommendations for achieving them, not approved manuscript claims or a completed evaluation protocol.

## Candidate research contribution

Investigate whether a portable academic workflow with explicit author decisions, source-to-claim evidence records, independently checked plans and drafts, and durable project state can improve the reliability of manuscript production at acceptable human effort and runtime cost.

Clio provides the reference implementation in which to test this proposition. Host portability remains an architectural commitment; equal behavioral guarantees on every host require additional evidence.

The presence of multiple agents, citation search, human interaction, or provenance alone does not establish novelty. The contribution needs a precise account of the combined mechanism, observable failure modes, and a comparison showing what that mechanism changes.

## The supplied comparison set

The five supplied links identify four works. PaperVizAgent is the renamed implementation of PaperBanana, whose paper is arXiv:2601.23265.

Sources were retrieved on 2026-10-13. Inspection covered the Nature articles' main text and relevant methods/results/limitations, both arXiv PDFs, and the PaperVizAgent repository README. Supplementary evidence was not independently reproduced, and no competing system was executed. Reported results below belong to the respective authors. This is an initial comparison set, not a systematic literature review or a novelty determination.

### The AI Scientist: autonomous research

**Source:** [Towards end-to-end automation of AI research](https://www.nature.com/articles/s41586-026-10265-5), DOI `10.1038/s41586-026-10265-5`. Relevant sections: “Generating manuscripts,” “Human evaluation results,” and “Limitations.”

The system combines ideation, literature search, experiment implementation and execution, plots, manuscript writing, and automated review. It evaluates template-based and template-free research workflows.

Three manuscripts were submitted to an ICLR workshop; one received reviews above the workshop acceptance threshold. The authors report a 70% workshop acceptance rate and explain that submissions were withdrawn under the predetermined protocol. They also disclose manual selection of promising outputs between stages. This result must not be described as a main-conference acceptance or a wholly human-free evaluation pipeline.

The authors identify inaccurate citations, implementation errors, and methodological weaknesses among failure modes. WTF-P can investigate these concerns where they intersect manuscript production. It does not currently reproduce this system's autonomous experimentation scope, so a whole-system superiority claim would be unsupported.

### Paper2Agent: executable research dissemination

**Source:** [Reimagining research papers as interactive and reliable AI agents](https://www.nature.com/articles/s41586-026-11044-y), DOI `10.1038/s41586-026-11044-y`. Relevant sections: “Overview of Paper2Agent,” “Large-scale evaluation of Paper2Agent,” and “Paper agents collaborate for discovery.”

Paper2Agent converts papers and associated code into MCP tools, resources, and prompts. Generated tools undergo automated validation against reference behavior and retain links to source code. Its case studies include AlphaGenome, Scanpy, and TISSUE, and its evaluation compares against direct repository access and other agents.

For example, the authors report successful agentification of 74 of 100 computational biology papers, with 593 of 599 proposed tools passing automated validation. They also report task accuracy, cost, latency, independent expert assessment, and ablations. These are a useful methodological standard for WTF-P's evaluation.

Reliability, provenance, and human scientific choice already appear in this work. WTF-P's potential distinction concerns the authoring lifecycle: how decisions and evidence remain connected to a manuscript through planning, drafting, review, and recovery. Paper2Agent is also a possible future source of validated research artifacts; integration is not yet implemented or committed by this brief.

### Proactive thought partners: writing interaction

**Source:** [Designing Proactive Thought Partners for Writing](https://arxiv.org/abs/2609.01588), inspected version `2609.01588v1`. Relevant sections: abstract, interaction design, findings, and section 9, “Limitations.”

The study deployed customizable proactive writing partners with 16 participants for one week. It examines higher-level cognitive support, intervention timing, user engagement, and visual representation. Users retain control over whether to ignore, inspect, or apply suggestions.

The authors explicitly state that the probe study does not establish causal effects on writing quality, productivity, learning, or long-term agency. WTF-P should learn from its interaction findings while measuring its own approval burden and decision fidelity. Human involvement alone is not a differentiator, and a high gate count is not evidence of meaningful control.

### PaperBanana / PaperVizAgent: scientific illustrations

**Sources:** [PaperBanana: Automating Academic Illustration for AI Scientists](https://arxiv.org/abs/2601.23265), inspected version `2601.23265v2`; [PaperVizAgent implementation](https://github.com/google-research/papervizagent). Relevant paper sections: 5, “Experiments,” 6, statistical plots, and 9, “Limitations and Future Directions”; repository overview and workflow descriptions.

The pipeline uses Retriever, Planner, Stylist, Visualizer, and Critic agents. PaperBananaBench includes 292 methodology-diagram test cases; evaluation measures faithfulness, conciseness, readability, and aesthetics, with human evaluation and component ablations. The paper also extends the method to code-generated statistical plots for numerical precision.

The authors acknowledge diagram faithfulness failures such as incorrect arrow directions and connectivity, and limitations of raster editability. WTF-P's current poster/slide scaffolds and evidence gates do not establish equivalent illustration-generation capabilities. Future visual work should connect diagram elements to methods and source artifacts, connect plotted values to data and executable plotting code, and retain author approval. PaperVizAgent is both a comparison target for that narrower task and a possible integration candidate.

## Recommended order of work

| Priority | Work | Evidence required before claiming completion |
| --- | --- | --- |
| 1 | Audit and harden the Clio lifecycle | Exercise interview, mapping, outline, section discussion, research, plan, write, review, revision, pause/resume, and delivery against an explicit checklist; retain failures and recovery paths. |
| 2 | Verify evidence and gate behavior | Demonstrate that candidate citations cannot silently become verified support, author choices cannot be fabricated, and changed inputs cannot silently reuse stale approval. Audit runtime tools, native edits, delegated work, and alternative write paths separately. |
| 3 | Complete a real manuscript | Finish a real paper or proposal with citations, inspectable artifacts, separate author gates, independent review, and fresh-process resumption. Capture interventions and defects as well as successful steps. |
| 4 | Establish comparative evidence | Freeze a benchmark and rubric, run matched baselines and targeted ablations, and report quality, reliability, human effort, latency, and cost separately. |
| 5 | Write the WTF-P paper using WTF-P | Ground every system and evaluation claim in the frozen implementation and retained evidence. Obtain independent assessment; authoring its own paper is a case study, not proof of comparative efficacy. |
| 6 | Transfer demonstrated guarantees | Extend other host bindings and conformance tests from Clio's observed behavior. Add visual or executable-paper integrations when a demonstrated authoring need justifies them. |

These are work items, not findings from a completed security or correctness audit. In particular, declared workflow rules and schema-valid JSON do not prove enforcement or factual support. The existing [evaluation methodology](../evaluation/README.md) and [compatibility evidence](COMPATIBILITY.md) document the narrower results already observed.

## Proposed readiness criteria for the real manuscript

- The full workflow completes on a pinned Clio/WTF-P build and identified model configuration, with the author making each required decision.
- All factual claims requiring external support resolve to inspected sources and claim-level evidence with usable locators. Unsupported claims are removed or explicitly unresolved; a valid DOI alone is insufficient.
- Approved plans, manuscript artifacts, reviews, and portable state agree. Rejected and deferred author decisions survive subsequent writing and resumption.
- A fresh process resumes from durable records without relying on prior chat history. Interruptions or partial writes produce a recoverable state and an honest next action.
- Independent review assesses argument quality, scientific fidelity, citation support, and completeness. A successful compile or schema check is one check among these.
- The retained record includes artifact revisions, gate answers, tool effects, actual human work, model usage, failures, and fixes. Missing cost telemetry remains unavailable.
- Delivery includes manuscript source and a reproducible rendering handoff under the current source-only contract. Rendering or submission automation would require a separately specified change.

Thresholds and manuscript scope should be fixed before the evaluation campaign, so the acceptance bar does not move in response to observed results.

## Proposed evaluation design

The first useful baseline is the same Clio/model configuration with the same materials and task but without WTF-P. A second baseline can use a documented expert prompt/checklist. Match or explicitly account for model access, evidence access, compute budget, and human assistance. Preserve independent sessions and actual client/model identities.

Measure unsupported-claim rate, citation-support precision, coverage of claims needing citations, author-decision violations, recovery success, completion rate, and independently judged manuscript quality. Also measure active author minutes, approval/revision effort, latency, and model cost. Gate counts alone cannot show either usefulness or burden.

Use targeted evaluation variants to isolate durable state, evidence tracking, reviewer separation, and runtime enforcement. Any comparison of approval mechanisms should retain human scientific decisions and be confined to an explicitly designed study; removing production gates is not the maintainer's direction.

Compare competing systems only on tasks and inputs they actually support. PaperVizAgent belongs in a figure study; Paper2Agent belongs in an executable-method/reuse study; the writing-partner work informs interaction evaluation; The AI Scientist informs research-generation comparisons. A single score across their different scopes would obscure what was measured.

A complete real manuscript establishes practical feasibility. Repeated tasks, independent assessors, disclosed failures, and an appropriate controlled comparison are needed for general efficacy claims. A manuscript about WTF-P also requires protection against circular evaluation: freeze implementation claims and evaluation inputs, keep scoring independent of the writing agents, and retain unsuccessful runs. An additional external-topic manuscript would strengthen generalizability.
