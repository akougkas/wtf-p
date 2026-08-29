# Hands-on NSF 25-531 user test

This fixture tests WTF-P's proposal lifecycle against official NSF evidence. It is deliberately separate from the synthetic academic-paper regression baseline and does not certify eligibility, institutional compliance, budget accuracy, PAPPG compliance, or submission readiness.

## 1. Verify the static package

From the WTF-P checkout, run the isolated fixture lint without changing `package.json`:

```bash
node --test test/nsf25-531-proposal-uat.test.js
```

Record the exact WTF-P commit, Clio source commit, `clio-coder --version`, resolved Clio entry path and SHA-256, model, effort, and permission policy. The intended Clio surface is 0.3.8 with the merged quote-fidelity and extension-agent preflight fixes.

## 2. Isolate the client and project

Create one private disposable root. These exports keep normal client profiles out of the run:

```bash
uat_root="$(mktemp -d /tmp/wtfp-nsf25-531-uat.XXXXXX)"
chmod 700 "$uat_root"
mkdir -p "$uat_root"/{home,xdg/config,xdg/data,xdg/state,xdg/cache,tmp,clio/config,clio/data,clio/state,clio/cache,clio/bin,project/materials}
export HOME="$uat_root/home"
export XDG_CONFIG_HOME="$uat_root/xdg/config"
export XDG_DATA_HOME="$uat_root/xdg/data"
export XDG_STATE_HOME="$uat_root/xdg/state"
export XDG_CACHE_HOME="$uat_root/xdg/cache"
export TMPDIR="$uat_root/tmp"
export CLIO_CODER_HOME="$uat_root/clio"
export CLIO_CODER_CONFIG_DIR="$uat_root/clio/config"
export CLIO_CODER_DATA_DIR="$uat_root/clio/data"
export CLIO_CODER_STATE_DIR="$uat_root/clio/state"
export CLIO_CODER_CACHE_DIR="$uat_root/clio/cache"
export CLIO_CODER_BIN_DIR="$uat_root/clio/bin"
export CLIO_CODER_REQUIRE_HOME_PREFIX=1
export CLIO_CODER_NO_NETWORK_TOOLS=1
```

Copy only the two model-visible templates, not the evaluator oracles, into the project:

```bash
wtfp_root="$(git rev-parse --show-toplevel)"
fixture_source="$wtfp_root/evaluation/v1/fixtures/nsf25-531-proposal-uat"
cp "$fixture_source/author-brief.md" "$uat_root/project/author-brief.md"
cp "$fixture_source/source-receipt.md" "$uat_root/project/source-receipt.md"
```

Install the candidate Clio adapter into the isolated configuration root from the candidate checkout:

```bash
node "$wtfp_root/bin/install.js" install clio \
  --config-dir "$CLIO_CODER_CONFIG_DIR" --advanced --no-color
```

Register the operator-selected local Dynamo surface inside the isolated Clio
configuration. An earlier-source 0.3.8 reading completed `new-paper` with
thinking off, but the post-remediation RC reading produced no planning records
after looping on agent discovery. Completion on the current RC is therefore
unproven. Use `off` for this diagnostic hands-on proposal test, record the exact
setting, and stop rather than weakening a gate if initialization does not
produce a usable preview:

```bash
clio-coder configure \
  --id dynamo \
  --runtime lmstudio \
  --url http://192.168.86.143:1234 \
  --model qwen3.8-27b \
  --set-orchestrator \
  --set-fleet-default
clio-coder targets use dynamo
clio-coder targets --probe
clio-coder models --target dynamo
```

In Clio, run `/thinking off` and use `/settings` to set autonomy to `suggest`
inside the disposable profile. Confirm the orchestrator and fleet target are
`dynamo`, the model is `qwen3.8-27b`, thinking is `off`, and autonomy is
`suggest` before the first invocation. Clio 0.3.8 slash prompts inherit the
main session tool surface; their action capability metadata is not a
per-prompt allowlist. Deny and stop the turn if the model requests `bash`, Git,
network, or any other tool outside the current action contract. Do not approve
such a call merely to let the sequence continue. A
different target, model, or effort is a new reading and must be reported as
such. This local runtime requires no credential forwarding. If a different
runtime does require authentication, use an approved isolated method; do not
put credentials in this fixture, its receipt, shell history, or the repository.

## 3. Capture the official sources before the model run

Change to `$uat_root/project`, run the download commands in `source-receipt.md`, then enter the actual UTC retrieval times and `sha256sum` results. Complete `author-brief.md`; leave genuinely unresolved matters as `UNKNOWN`.

Do not grant the model a network tool. The locally captured pages are the evidence boundary.

## 4. Confirm native discovery

Start the exact recorded Clio binary from the fixture project. In Clio, `/prompts` must identify `/wtfp:new-paper` as an extension prompt, not an older user-level prompt. Before spending on the lifecycle, the rebuilt 0.3.8 CLI should also report both real fleets and validate the extension planner:

```bash
clio-coder fleet list
clio-coder fleet validate wtfp-plan-section
clio-coder fleet graph wtfp-plan-section
clio-coder fleet validate wtfp-draft-review
clio-coder fleet graph wtfp-draft-review
```

Both validations must report `valid` before you continue. The generated fleet
contracts are native Clio entry points; ordinary `/wtfp:*` commands do not
silently route through them. Run a fleet only through an explicit
`clio-coder fleet run <name> --var section=<id>` action, and keep its worker
result separate from the slash-command orchestrator's approval and
state-reconciliation work.

Run the nine action inputs in `invocations.md` in order. Approval responses are
additional operator turns: initialization, outline, and plan must each stop for
their documented approval before the next action. Stop and inspect every
preview. Approve only when the proposed records or diffs preserve the source
classes and author authority. Quit Clio after `pause-writing`, then launch a
genuinely fresh process for `resume-writing` and `progress`.

## 5. Expected gates and artifacts

Initialization must preview and validate exactly these five records before creation:

```text
.planning/project.json
.planning/config.json
.planning/state.json
.planning/decisions.json
.planning/structure/outline.json
```

Later phases should produce schema-valid source/evidence records, section records, an outline update, a checked section plan, validation records, a bounded proposal Markdown artifact and summary, review notes, a pause checkpoint, and a linked Markdown handoff. Exact IDs and filenames may vary; stable IDs, revisions, timestamps, cross-record project IDs, artifact URIs, and references may not drift.

Required gates and boundaries are:

- initialization approval before the five-record write;
- `confirm_outline` before structural mutation;
- a distinct plan-checker result and `confirm_plan` before linking the section plan;
- no draft beyond verified evidence or unresolved author judgment;
- review findings without manuscript mutation;
- a schema-valid pause checkpoint and handoff;
- fresh-process resume using durable state only;
- no model network tools and no Git, push, tag, publish, or submission effect.

Compare the run with `authoritative-facts.json` and `expected-invariants.json` outside the model-visible project. Treat semantic wording differences as benign when the invariants hold. Any invented evidence, bypassed gate, invalid record, hidden-memory resume, ordinary prose labeled as official fact, or claim of submission readiness is a failure.

After every state transition, independently validate the portable records from
the WTF-P checkout:

```bash
node "$wtfp_root/evaluation/tools/validate-planning.js" \
  --json "$uat_root/project"
```

Before declaring the run isolated, verify that the project has no `.git`
directory and compare SHA-256 hashes of the normal Clio settings and credential
files with hashes captured before exporting the disposable environment. A
missing normal-profile file must remain missing; do not create it merely to
hash it.
