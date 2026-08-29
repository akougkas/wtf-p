# Synthetic Evaluation

This section reports what the supplied fixture recorded and draws only the interpretations that those records support. The scenario is the one declared in the method: 128 compute nodes, a single synthetic stencil workload, and eight recorded trials per configuration. All figures below are arithmetic means over those recorded trials; the fixture supplies no raw trial values, so every statement here is bounded to this scenario.

## Recorded interruption comparison

Across the eight recorded trials per configuration, the baseline full-checkpoint configuration had a mean checkpoint interruption of 41.2 seconds, and the coordinated incremental-checkpoint configuration had a mean of 27.8 seconds. The coordinated incremental configuration therefore had a lower recorded mean interruption than the baseline in this supplied scenario. This is a comparison of two recorded means; it is not a claim that the difference is statistically significant, because the fixture supplies no variance, confidence intervals, or significance test.

## Recovery-check completion

Every recorded trial in the fixture completed its recovery check. This observation covers only the recorded fixture trials: it reports that no recorded trial failed its recovery check, and it does not establish comparative reliability between the two configurations, nor any behavior under failure modes that the fixture does not exercise.

## Evidence boundary

The observations above are complete with respect to what the fixture records, but they do not support generalization. The fixture provides no evidence of uncertainty in the recorded means, no energy measurements, no scaling results, no independent replication, and nothing about other workloads, node counts, storage systems, or production deployments. Accordingly, this section claims only that, in the supplied 128-node synthetic scenario, the coordinated incremental configuration had a lower recorded mean checkpoint interruption and that all recorded fixture recovery checks completed; it makes no claim of universal speedup, statistical significance, optimality, production readiness, or comparative reliability.
