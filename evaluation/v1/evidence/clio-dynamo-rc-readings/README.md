# Clio 0.3.8 / Dynamo RC readings

This pack retains three distinct local-model observations. They were not one
continuous run and bind different WTF-P commits. None is an observed semantic
baseline, and none establishes that WTF-P improves prose relative to a
no-WTF-P control.

The common client was Clio Coder 0.3.8, entry SHA-256
`f02f31c7480ac4f9532980f8df93e07816111626bdce9879e1ee9e98fd3ec162`,
using target `dynamo`, exact wire model `qwen3.8-27b`, and effective thinking
`off`. Network tools were disabled. Client receipts report numeric zero with
`costProvenance: unknown`, so cost is **unavailable**, not measured USD 0.

The `slash-024` trace does not support a generic "no effects" claim. It records
zero mutating effects and zero network effects, but Clio allowed two read-only
policy violations: the model listed 10 of 11 entries under the fixture's
contract-excluded `.git` metadata and read the absolute host path
`/home/akougkas/iowarp/clio-coder/docs/extensions-and-sharing.md`, outside the
authorized project and installed-extension roots. Both accesses are disclosed
in `observations.json` and `slash-024/tool-summary.json`.

## Observed results

1. `slash-024` binds WTF-P `024581816148cd6e962f36ceb210d08343605123`.
   `/wtfp:new-paper` received the exact 1,462-byte payload, made the two
   successful read-only accesses disclosed above, then made two denied `bash`
   attempts and looped on agent discovery. The loop guard stopped the fourth
   repeated dispatch. Exit was 0, but no `.planning` directory or JSON record
   was produced, so the lifecycle stopped before `map-project`.
2. `plan-b4` binds WTF-P `b4f0543658a14855ba41b68626c9771dd977cd11`.
   Both native agents executed, the nested Markdown plan survived the
   `.planning/` boundary, and no boundary violation occurred. Result envelopes
   conformed structurally, but Clio marked semantic quality `unmeasured` and
   grounded none of four claimed validations. This is a structural dispatch
   observation, not a semantic plan pass.
3. `draft-cbba` binds manuscript-path projection observation commit
   `cbba38cb0036bc42de6d0ace3e5ebe1d46b3c0e5`. Both agents executed and the
   physical-path repair worked: the manuscript is `paper/evaluation.md`, the
   summary is under `.planning/`, and `.planning/paper/` was not created. Both
   result contracts conform, but both report `quality: fail`. Independent
   inspection counted 304 words against a 700-word target (allowed range
   595–805), and the direct fleet proceeded without the required approved plan.
   All ten JSON records validate literally but remain seed-identical, leaving
   section/state lifecycle data unreconciled. Native exit 0 therefore does not
   mean behavioral acceptance.

The checked-in semantic baseline remains `definition-only` with no observed
runs. The nine-action lifecycle, approval chain, pause, fresh-process resume,
and a passing plan-to-draft fleet chain remain unobserved.

`observations.json` records the machine-readable claims and exact identities.
`SHA256SUMS` authenticates every retained file except itself. Raw JSONL traces
and native ledgers are retained so the summaries can be audited independently.
No credential file or credential value is included.
