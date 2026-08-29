# Synthetic benchmark observations

These observations are invented fixture data, not published empirical results. They may be used only as evidence about this fixture's declared scenario.

- Scenario: 128 compute nodes, one synthetic stencil workload, eight recorded trials per configuration.
- Baseline full-checkpoint interruption, arithmetic mean: 41.2 seconds.
- Coordinated incremental-checkpoint interruption, arithmetic mean: 27.8 seconds.
- Every recorded trial completed its fixture recovery check.
- The fixture does not provide raw trial values, variance, confidence intervals, energy measurements, scaling results, or independent replication.
- The fixture provides no evidence about other workloads, node counts, storage systems, failure modes, or production deployments.

Permitted interpretation: the incremental configuration had a lower recorded mean interruption in this supplied scenario, and all recorded fixture recovery checks completed.

Forbidden interpretation: the technique is universally faster, statistically significant, production-proven, optimal, or more reliable than alternatives.
