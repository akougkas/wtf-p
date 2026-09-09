# Clio Coder 0.4.6 headless help smoke

Date: 2026-09-09. Host: Clio Coder 0.4.6 (`~/.local/bin/clio-coder`), WTF-P extension `wtfp@0.6.0-rc.2` installed at user scope with `clio-coder extensions install vendors/clio --user` (enabled, zero diagnostics).

Command, run in an empty scratch directory:

```bash
clio-coder --no-context-files run --target dynamo --json "/wtfp:help"
```

`events.jsonl` holds the JSON event stream; `stderr.txt` holds the one non-JSON diagnostic line the CLI printed first. The final `agent_end` event reports model `dynamo/qwen3.8-27b`, stop reason `stop`, 1 measured API call, 14,360 input tokens, 2,729 output tokens, 17,089 total (351 reasoning).

This establishes that the namespaced prompt is discovered and executed natively on 0.4.6. It says nothing about `new-paper`, author gates, fleets, or the project lifecycle on 0.4.6.
