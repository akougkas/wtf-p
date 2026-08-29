---
version: 4
name: wtfp-plan-section
description: Create and independently check one evidence-grounded section plan.
steps:
  - kind: agent
    id: plan
    agent: wtfp-section-planner
    scope: workspace
    writes: [.planning/]
    dependencies: []
  - kind: agent
    id: check
    agent: wtfp-plan-checker
    scope: readonly
    dependencies: [plan]
maxWorkers: 1
onFailure: stop
---

Plan section {{section}} from the portable project state. The checker must independently assess traceability, evidence coverage, author-decision fidelity, and feasibility.
