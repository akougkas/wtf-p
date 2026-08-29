# Clio/Dynamo lifecycle reading: blocked at `new-paper`

This directory preserves the first real local-model reading of the versioned
HPC-checkpointing lifecycle fixture against WTF-P compiler v4. It is an
observed blocked result, not a completed lifecycle baseline and not a prose
quality claim.

This reading predates the current canonical remediation that added exact
outline-total and direct-tool constraints. It remains evidence for the exact
source identity below; no claim is made that it measures the remediated RC.

## Exact surface

- WTF-P canonical source: `6b58b298cd6c41a587718d279cb0b0b21c0fbd7f`
- generated Clio source SHA-256:
  `4db9d0405a4cc5722ede1734cad55e3918c005167b9524736cffee324700d7c2`
- Clio Coder: `0.3.8`, source
  `9b7b80ccbd3d2211d4079bc76558bb06d66a8583`
- executable SHA-256:
  `f02f31c7480ac4f9532980f8df93e07816111626bdce9879e1ee9e98fd3ec162`
- target/runtime/model: `dynamo`, LM Studio HTTP/OpenAI completions,
  `qwen3.8-27b`
- fixture model-input SHA-256:
  `7b0edf03180806732fa4a77d59861c66beb75ee7dac3789e62297c4f442c7e16`
- exact invocation: 1,478 bytes, SHA-256
  `874b6070dfbc2b23ab6efcae6a88b7adf5e40c080d8333f45f5f44a9263e5a24`
- exact argument payload: 1,462 bytes, SHA-256
  `d6aa82a299dbb34fb8acb33025ad819dc670d72be12fda12ac3c78d9efcbc2e1`

Before model execution, native `fleet validate` accepted both generated
two-step fleet contracts with their corrected `.planning/` and `paper/`
directory boundaries. The fleet contract hashes are retained in
[`run-summary.json`](evidence/run-summary.json).

## Observed runs

The first attempt requested Clio `high` thinking; the LM Studio request mapped
that to provider reasoning effort `xhigh`. It remained active for
1,133,725 ms, emitted 22,986 native JSON events and 68,443 tokens, made no
write, shell, network, or VCS call, and produced no planning record. The
evaluator stopped its owned process group at the fixed ceiling. The outcome is
an honest timeout, not a pass.

A fresh process then retried only the same `new-paper` action with thinking
`off`, a material response to the timeout rather than a prompt change. It
finished in 171,852 ms with exit 0, 18 API calls, and 563,708 total tokens.
Exactly five planning records were produced, and independent literal schema
validation passed 5/5.

The campaign nevertheless stopped before action 2 for two independent reasons:

1. The outline declares a 6,000-word target, but its section targets sum to
   5,600. The independent cross-record validator rejected that state.
2. The candidate model attempted one `bash` call even though the exact action
   invocation forbade shell tools. Clio denied it in 17 ms, and no shell effect
   occurred. The safety layer worked, but a denied forbidden attempt is not
   rounded up to behavioral compliance.

The retained records preserve the closed synthetic evidence boundary, contain
no fabricated citation, and keep the three author decisions under author
authority. Those partial successes do not override either hard failure.

## Scope and retention

Only `new-paper` was exercised successfully enough to produce records. The
remaining lifecycle actions, specialist dispatches, fleet executions,
pause/resume process boundary, and final progress action were not run after the
first-transition failure. The semantic baseline therefore remains
`definition-only`; weakening it to accept a blocked run would make the word
“baseline” misleading.

The original mode-0700 temporary roots and raw JSONL traces were removed after
their hashes, event counts, timings, tool activity, and five non-secret records
were retained here. No credential was forwarded. Normal Clio settings and
credential hashes were unchanged before and after. The raw traces are not a
release dependency. Their bytes are no longer available, so the retained
identity/tool receipts are sanitized evaluator summaries bound to the recorded
raw-trace digests, not independently replay-auditable native event streams.
Exact argument delivery, the denied tool event, wire model ID, and usage totals
should therefore be treated as observed-and-sanitized evidence rather than a
claim that another reviewer can reconstruct the event stream from this tree.

This evaluation has no no-WTF-P control arm. It can establish process
discipline and failure modes, but it cannot establish that WTF-P produces
better writing than the same model and task without WTF-P.

## Verify

Literal record validation:

```bash
node evaluation/tools/validate-planning.js \
  evaluation/v1/evidence/clio-dynamo-lifecycle-blocked/records
```

Validate the typed evidence and compare it to the lifecycle floor:

```bash
set +e
node evaluation/tools/compare-results.js --json \
  evaluation/v1/baselines/hpc-checkpointing.json \
  evaluation/v1/evidence/clio-dynamo-lifecycle-blocked/result.json
status=$?
set -e
test "$status" -eq 1
```

Exit `1` is the expected, successful verification result: the candidate
evidence is well-formed and independently bound, and the comparator honestly
classifies it as a regression. Exit `2` would indicate malformed or forged
evidence rather than a valid blocked reading.
