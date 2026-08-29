# Clio compiler-v4 `new-paper` evidence

This directory is the sanitized, versioned evidence pack for the completed WTF-P compiler-v4 `new-paper` behavioral evaluation. Run its independent checks from the repository root:

```sh
node test/compiler-v4-evidence.test.js
```

The run used Clio Coder 0.3.8, target `openai-codex`, model `gpt-5.6-terra`, `xhigh` effort, and a mediated read-only permission policy. It scored 8/8 across evidence safety, literal `.planning` v1 correctness, approval/effect boundaries, and the usefulness of the next safe action. All five previewed initialization records validate literally against the canonical v1 schemas in `protocol/project/schemas/` and satisfy the tested cross-record invariants.

The exact run identity remains in `rubric.json`: WTF-P commit `ae3b674629e5b0a13da2ed855d267474351417ee`, Clio quote-fidelity fix `b6419b24510b4a4b09d82f6e8590644a5f338476`, merge `5b335d4a66321ac28c8f043b5e88bd96b7530dd8`, release-build tree `1a31de76de0093e2c7950ed76110836ba690e07e`, and binary SHA-256 `24d542d275733ab4ec13200992835b94bab5d4a00c17f37a63c66bd878b89cd1`. This is the exact earlier run identity; it is not the later Clio merge `9b7b80cc`.

The argument preflight and trace summary independently agree on a byte-exact 1,908-byte payload, SHA-256 `88cb937f67e740270b63d65c21c011d1e523e7d0aef66177bd4380d271b91326`, with both literal quote characters preserved. Normal-profile pre/post hashes are unchanged. The isolated credential path was reported absent after cleanup, and no credential material is included here. The `$1.5429764` cost is a Clio receipt estimate derived from measured token usage; it is not provider-metered or independently reconciled to provider billing.

## Contents and sanitization

- `manifest.json` authenticates every retained artifact, the executable validator, and the canonical schemas used for literal validation.
- `rubric.json`, `schema-validation-v2.json`, `trace-summary.json`, and `argument-expansion-preflight.json` retain the scored and independently derived facts.
- `records/` contains only the five previewed `.planning` v1 JSON records.
- Every occurrence of the disposable run-root absolute path was replaced mechanically with the explicit `<disposable-root>` marker. Behavioral values, relative paths, hashes, counts, timing, and identities were otherwise preserved.

## Limitations

- The original event stream does not cryptographically bind the launch executable path or environment. Those launch details are operator attestations rechecked after the run.
- The raw event trace is retained privately only; it is intentionally absent from this repository pack. No raw events, settings, credentials, receipts, SQLite files, audit material, or run ledger were opened or copied while creating this pack.
- Credential cleanup method provenance is operator-attested because no cleanup-command log was retained.
- The five records are a read-only preview, not evidence that project files were mutated.
- This evidence supports only the compiler-v4 Clio `new-paper` evaluation. It makes no full-lifecycle, fleet, routing, cross-version, or broader skill-activation claim.
