/**
 * Package tests for the WTF-P desk, run by `clio-coder extensions test
 * vendors/clio-extension`. Each case builds a small valid project in a
 * task-owned TMPDIR and drives the desk the way Clio does: tool calls,
 * interviews, hooks and observations. The kit serves no plugin unless a case
 * passes one. Answers here are simulated interview events, not a human's:
 * they test the desk's bookkeeping, never an author's judgment.
 */
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createExtensionTestHost } from "@iowarp/clio-coder/extensions/testing";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PROJECT = "desk-test";
const AT = "2026-10-01T12:00:00Z";
const GATE = "checkpoint-framing";
const PLAN_GATE = "approve-initial";
const PLAN_URI = "project://sections/introduction/plans/initial";
const PLAN_FILE = ".planning/sections/introduction/plans/initial.md";

type Json = Record<string, unknown>;
type Host = Awaited<ReturnType<typeof createExtensionTestHost>>;

function put(workspace: string, relative: string, value: unknown): void {
	mkdirSync(path.dirname(path.join(workspace, relative)), { recursive: true });
	writeFileSync(path.join(workspace, relative), typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
}

function project(): string {
	assert.ok(process.env.TMPDIR, "Tests need a task-owned TMPDIR.");
	const workspace = mkdtempSync(path.join(process.env.TMPDIR, "wtfp-desk-test-"));
	put(workspace, ".planning/project.json", {
		schema: "wtfp.project.manifest/v1",
		protocol_version: 1,
		id: PROJECT,
		title: "Logging on Shared Memory",
		document_type: "research-article",
		core_argument: "Shared memory removes the flush bottleneck without weakening durability.",
		target: { audience: "Storage researchers", word_limit: 100 },
		requirements: { must_have: [], should_have: [], out_of_scope: [] },
		created_at: AT,
		updated_at: AT,
		artifacts: {
			manifest: "project://manifest",
			config: "project://config",
			state: "project://state",
			decisions: "project://decisions",
			outline: "project://structure/outline",
			materials: [],
			manuscripts: ["project://paper/introduction"],
			deliverables: [],
			archives: [],
		},
	});
	put(workspace, ".planning/config.json", {
		schema: "wtfp.project.config/v1",
		project_id: PROJECT,
		interaction_mode: "standard",
		depth: "standard",
		output_format: "markdown",
		language: "en-US",
		citation_style: "author-date",
		gates: { confirm_outline: true, confirm_plan: true, confirm_write: true, confirm_review: true, confirm_delivery: true },
		workflow: { research: true, plan_validation: true, argument_validation: true, coherence_validation: true },
		safety: { destructive_requires_authorization: true, external_publish_requires_authorization: true, backup_before_major_edits: true },
		parallelism: { enabled: false, max_workers: 1 },
	});
	put(workspace, ".planning/state.json", {
		schema: "wtfp.project.state/v1",
		project_id: PROJECT,
		revision: 3,
		phase: "writing",
		status: "active",
		current_section_uri: "project://sections/introduction",
		progress: { sections_total: 1, sections_complete: 0, word_target: 100, word_count: 0 },
		active_checkpoint_uris: [`project://checkpoints/${GATE}`, `project://checkpoints/${PLAN_GATE}`],
		last_transition: { from: "planning", to: "writing", reason: "The plan is linked.", at: AT },
		updated_at: AT,
	});
	put(workspace, ".planning/structure/outline.json", {
		schema: "wtfp.project.outline/v1",
		project_id: PROJECT,
		revision: 1,
		thesis: "Shared memory removes the flush bottleneck without weakening durability.",
		target_words: 100,
		sections: [
			{
				id: "introduction",
				title: "Introduction",
				goal: "State the flush bottleneck and the contribution.",
				argument_role: "setup",
				word_target: 100,
				wave: 1,
				depends_on: [],
				claim_ids: [],
				research: { required: false, topics: [] },
			},
		],
		updated_at: AT,
	});
	put(workspace, ".planning/sections/introduction/section.json", {
		schema: "wtfp.project.section/v1",
		id: "introduction",
		project_id: PROJECT,
		outline_uri: "project://structure/outline",
		title: "Introduction",
		goal: "State the flush bottleneck and the contribution.",
		status: "planned",
		word_target: 100,
		word_count: 0,
		wave: 1,
		depends_on: [],
		claims: [],
		artifacts: { plans: [PLAN_URI], reviews: [], manuscript: "project://paper/introduction" },
		checkpoint_uris: [`project://checkpoints/${GATE}`, `project://checkpoints/${PLAN_GATE}`],
		validation_uris: [],
		updated_at: AT,
	});
	put(workspace, PLAN_FILE, "# Plan\n\n1. State the bottleneck.\n2. State the contribution.\n");
	put(workspace, `.planning/checkpoints/${GATE}.json`, {
		schema: "wtfp.project.checkpoint/v1",
		id: GATE,
		project_id: PROJECT,
		kind: "decision",
		status: "pending",
		blocking: true,
		scope_uri: "project://sections/introduction",
		request: "Lead with the protocol or with the workflow?",
		options: [
			{ id: "protocol-first", label: "Protocol first", implication: "Lead with interoperability." },
			{ id: "workflow-first", label: "Workflow first", implication: "Lead with the end-to-end process." },
		],
		resume_action: "write-section",
		created_at: AT,
	});
	put(workspace, `.planning/checkpoints/${PLAN_GATE}.json`, {
		schema: "wtfp.project.checkpoint/v1",
		id: PLAN_GATE,
		project_id: PROJECT,
		kind: "decision",
		status: "pending",
		blocking: true,
		scope_uri: PLAN_URI,
		request: "Approve the introduction plan?",
		options: [
			{ id: "approve", label: "Approve", implication: "The writer drafts from exactly this plan." },
			{ id: "revise", label: "Revise", implication: "The plan is rewritten before drafting." },
		],
		resume_action: "write-section",
		created_at: AT,
	});
	// Eleven body words: front matter, the heading, the citation key and the code block do not count.
	put(
		workspace,
		"paper/introduction.md",
		"---\ntitle: Introduction\n---\n# Introduction\n\nShared memory changes the cost of logging [@smith2024]. It's a well-known trade-off.\n\n```c\nint flush = 1;\n```\n",
	);
	return workspace;
}

const read = (workspace: string, relative: string): Json => JSON.parse(readFileSync(path.join(workspace, relative), "utf8")) as Json;
const sha = (workspace: string, relative: string): string => createHash("sha256").update(readFileSync(path.join(workspace, relative))).digest("hex");
const interactions = (workspace: string): Json[] => {
	const directory = path.join(workspace, ".planning/interactions");
	return existsSync(directory) ? readdirSync(directory).sort().map((name) => read(workspace, `.planning/interactions/${name}`)) : [];
};

function tree(workspace: string, relative = "."): Record<string, string> {
	const out: Record<string, string> = {};
	for (const entry of readdirSync(path.join(workspace, relative), { withFileTypes: true })) {
		const child = path.join(relative, entry.name);
		if (entry.isDirectory()) Object.assign(out, tree(workspace, child));
		else out[child] = sha(workspace, child);
	}
	return out;
}

const canonical = (value: unknown): string =>
	Array.isArray(value)
		? `[${value.map(canonical).join(",")}]`
		: value !== null && typeof value === "object"
			? `{${Object.keys(value).sort().map((name) => `${JSON.stringify(name)}:${canonical((value as Json)[name])}`).join(",")}}`
			: JSON.stringify(value);

/** An interaction sealed the way the desk seals one, for tests that need a valid seal on a changed record. */
const resealed = (body: Json, key: Buffer): Json => ({
	...body,
	seal: { method: "hmac-sha256", key_id: createHash("sha256").update(key).digest("hex").slice(0, 16), mac: createHmac("sha256", key).update(canonical(body)).digest("hex") },
});

const SERVED = { id: "wtfp", prompts: ["wtfp:check-todos", "wtfp:plan-section", "wtfp:progress", "wtfp:write-section", "wtfp:research-gap"] };

async function withDesk(run: (host: Host, workspace: string) => Promise<void>, plugin: typeof SERVED | null = null): Promise<void> {
	const workspace = project();
	const host = withClioFacts(await createExtensionTestHost(ROOT, { workspace, plugin }), workspace);
	try {
		await run(host, workspace);
	} finally {
		await host.dispose();
		rmSync(workspace, { recursive: true, force: true });
	}
}

async function ask(host: Host, checkpoint: string): Promise<string> {
	const asked = await host.tool("gate", { checkpoint });
	assert.equal(asked.interview?.id, "gate-one", asked.text);
	return asked.interview?.step.key as string;
}

async function answer(host: Host, checkpoint: string, choice: string): Promise<string> {
	const key = await ask(host, checkpoint);
	const done = await host.interview({ id: "gate-one", step: key, nav: "next", answers: { choice } });
	return "done" in done ? done.text : `step ${done.step.key}`;
}

const blocked = (result: { effects?: Array<{ kind: string }> }): string | null => {
	const effect = result.effects?.find((entry) => entry.kind === "block_tool") as { reason?: string } | undefined;
	return effect ? (effect.reason ?? "") : null;
};

const write = (host: Host, target: string) => host.hook({ point: "before_tool", tool: "write", turnId: "t1", args: { path: target } });

const rewriteOf = (result: { effects?: Array<{ kind: string }> }): Json | null =>
	(result.effects?.find((effect) => effect.kind === "rewrite_tool_input") as { args?: Json } | undefined)?.args ?? null;

// --- the host's facts ------------------------------------------------------------
// Clio 0.6.3 sends a before_tool hook where a path-taking tool lands and, for
// dispatch, the plan admission parsed, and judges a rewritten call again. The
// desk judges only those, so the test host models them as Clio resolves them,
// with the test process's own access.

const READ_ONLY_RECIPES = new Set((JSON.parse(readFileSync(path.join(ROOT, "runtime/write-guard.json"), "utf8")) as { readOnlyAgents: string[] }).readOnlyAgents);

/** A path with its existing part resolved through links; the rest is kept as named. */
function physical(file: string): string {
	let head = file;
	const rest: string[] = [];
	while (!existsSync(head) && path.dirname(head) !== head) {
		rest.unshift(path.basename(head));
		head = path.dirname(head);
	}
	return path.join(realpathSync(head), ...rest);
}

/**
 * Where a write through `joined` lands, as Clio's canonicalizeRawPath walks it
 * (src/core/path-canonical.ts): a link at any component, dangling or not, is
 * read and the walk goes on from its target, a `..` after a link steps up from
 * the link's target, and a missing component ends the walk. Null for a loop,
 * more than 40 links, or a component that cannot be inspected.
 */
function clioWalk(joined: string): string | null {
	const { root } = path.parse(joined);
	const parts = joined.slice(root.length).split(path.sep).filter((part) => part !== "" && part !== ".");
	const up = parts.indexOf("..");
	const pending = up === -1 ? [] : parts.slice(up);
	let cursor = path.resolve(path.join(root, ...(up === -1 ? parts : parts.slice(0, up))));
	const real = (file: string): string | null => {
		try {
			return path.resolve(realpathSync(file));
		} catch {
			return null;
		}
	};
	let current = real(cursor);
	while (current === null) {
		const parent = path.dirname(cursor);
		if (parent === cursor) return null;
		pending.unshift(path.basename(cursor));
		cursor = parent;
		current = real(cursor);
	}
	let hops = 0;
	while (pending.length > 0) {
		const part = pending.shift() as string;
		if (part === "..") {
			current = path.dirname(current);
			continue;
		}
		const next = path.join(current, part);
		let target: string;
		try {
			target = readlinkSync(next);
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code === "EINVAL") {
				current = next;
				continue;
			}
			if (code === "ENOENT" || code === "ENOTDIR") {
				if (!pending.includes("..")) return path.resolve(next, ...pending);
				current = next;
				continue;
			}
			return null;
		}
		hops += 1;
		if (hops > 40) return null;
		if (path.isAbsolute(target)) current = path.parse(target).root;
		pending.unshift(...target.split(path.sep).filter(Boolean));
	}
	return current;
}

/** Where Clio lands a tool's path: `@` dropped, Unicode spaces plain, `~` expanded, then Clio's physical walk from the workspace it runs in. */
function clioTarget(raw: string, workspace: string): Json {
	let spelled = (raw.startsWith("@") ? raw.slice(1) : raw).replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/gu, " ");
	if (spelled === "~") spelled = homedir();
	else if (spelled.startsWith("~/")) spelled = homedir() + spelled.slice(1);
	const real = realpathSync(workspace);
	// Clio runs in the workspace, so its own /proc/self/cwd is the workspace.
	if (spelled === "/proc/self/cwd" || spelled.startsWith("/proc/self/cwd/")) spelled = real + spelled.slice("/proc/self/cwd".length);
	const landed = clioWalk(path.isAbsolute(spelled) ? spelled : `${real}${path.sep}${spelled}`);
	const at = landed ?? (path.isAbsolute(spelled) ? spelled : `${real}${path.sep}${spelled}`);
	const relative = path.relative(real, at);
	const inside = landed !== null && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
	return { arg: "path", path: at, resolved: landed !== null, workspacePath: inside ? relative.split(path.sep).join("/") || "." : null };
}

/** The plan Clio's dispatch admission parses from a call, for the shapes these tests send. */
function clioPlan(args: Json, workspace: string): Json {
	const real = realpathSync(workspace);
	if (args.list === true) return { kind: "list" };
	if (args.apply_winner !== undefined) return { kind: "apply-winner", branch: String((args.apply_winner as Json).branch ?? ""), cwd: real };
	let tasks: unknown = args.tasks;
	if (typeof tasks === "string") {
		try {
			tasks = JSON.parse(tasks) as unknown;
		} catch {
			// A plain string is one task's text.
		}
	}
	if (tasks !== undefined && !Array.isArray(tasks)) tasks = [tasks];
	const items = (tasks === undefined ? [args] : (tasks as unknown[])).map((task) => (typeof task === "string" ? { task } : (task as Json)));
	const shared = (args.intent as Json | undefined)?.write_roots;
	return {
		kind: "tasks",
		mode: tasks === undefined ? "single" : "fanout",
		tasks: items.map((item) => {
			const named = typeof item.agent === "string" ? item.agent : typeof args.agent === "string" ? args.agent : "";
			const agent = named.trim() || "coder";
			const spelledCwd = typeof item.cwd === "string" ? item.cwd : typeof args.cwd === "string" ? args.cwd : ".";
			const cwd = physical(path.resolve(real, spelledCwd.trim() || "."));
			const roots = (((item.intent as Json | undefined)?.write_roots ?? shared ?? []) as string[]).map((root) => root.trim());
			return { role: "task", agent, cwd, writeRoots: roots, writeBoundaries: roots.map((root) => physical(path.resolve(cwd, root))), worktree: item.worktree === true, readOnly: READ_ONLY_RECIPES.has(agent) };
		}),
	};
}

/** A before_tool event with the facts Clio 0.6.3 adds, unless the test sent its own. */
function withFacts(event: Json, workspace: string): Json {
	if (event.point !== "before_tool" || "target" in event || "dispatch" in event) return event;
	const args = (event.args ?? {}) as Json;
	if (event.tool === "dispatch") return { ...event, dispatch: clioPlan(args, workspace) };
	const raw = args.path ?? args.file_path ?? args.filePath;
	if (["write", "edit", "artifact"].includes(event.tool as string) && typeof raw === "string" && raw.trim().length > 0)
		return { ...event, target: clioTarget(event.tool === "artifact" ? raw.trim() : raw, workspace) };
	return event;
}

/**
 * The test host as Clio 0.6.3 runs the desk: each before_tool event carries
 * Clio's facts, and a dispatch the desk rewrites is judged again with the plan
 * of what the rewritten call starts. An event marked `bare` reaches the desk
 * as Clio 0.6.2 sends it.
 */
function withClioFacts(host: Host, workspace: string): Host {
	const hook = host.hook.bind(host);
	const judged = async (event: Json, options?: Json) => {
		if (event.bare === true) {
			const { bare: _bare, ...sent } = event;
			return hook(sent as never, options as never);
		}
		const first = await hook(withFacts(event, workspace) as never, options as never);
		if (event.point !== "before_tool" || event.tool !== "dispatch" || "dispatch" in event) return first;
		const rewritten = rewriteOf(first);
		if (rewritten === null || blocked(first) !== null) return first;
		const second = await hook(withFacts({ ...event, args: rewritten }, workspace) as never, options as never);
		const refused = blocked(second);
		return refused === null ? first : { effects: [{ kind: "block_tool", reason: `extension wtfp rewrote dispatch input into a call that is blocked: ${refused}` }] };
	};
	return new Proxy(host, { get: (target, key) => (key === "hook" ? judged : Reflect.get(target, key)) }) as Host;
}

// --- record writes -------------------------------------------------------------

test("record writes at the revision or digest the caller read and refuses stale, blind and invalid writes", () =>
	withDesk(async (host, workspace) => {
		const state = read(workspace, ".planning/state.json");
		const written = await host.tool("record", { uri: "project://state", record: { ...state, phase: "reviewing" }, expect_revision: 3 });
		assert.equal(written.isError, undefined, written.text);
		assert.equal((written.data as Json).revision, 4);
		const stale = await host.tool("record", { uri: "project://state", record: { ...state, phase: "ready" }, expect_revision: 3 });
		assert.match(stale.text, /revision 4, not 3/);
		const blind = await host.tool("record", { uri: "project://state", record: { ...state, phase: "ready" } });
		assert.match(blind.text, /already exists; read it with extension_wtfp__read_record/);
		const invalid = await host.tool("record", { uri: "project://state", record: { ...state, phase: "drafting" }, expect_revision: 4 });
		assert.match(invalid.text, /would not validate/);
		assert.deepEqual([read(workspace, ".planning/state.json").phase, read(workspace, ".planning/state.json").revision], ["reviewing", 4]);

		// Two writers read the same section bytes; only the first lands (R1).
		const section = read(workspace, ".planning/sections/introduction/section.json");
		const seen = (await host.tool("read_record", { uri: "project://sections/introduction" })).data as Json;
		assert.equal(seen.sha256, sha(workspace, ".planning/sections/introduction/section.json"));
		const first = await host.tool("record", { uri: "project://sections/introduction", record: { ...section, goal: "First writer." }, expect_sha256: seen.sha256 });
		assert.equal(first.isError, undefined, first.text);
		const second = await host.tool("record", { uri: "project://sections/introduction", record: { ...section, goal: "Second writer." }, expect_sha256: seen.sha256 });
		assert.match(second.text, /changed since it was read/);
		assert.equal(read(workspace, ".planning/sections/introduction/section.json").goal, "First writer.");

		const gone = await host.tool("record", { uri: "project://sources/never-made", record: {}, expect_sha256: "0".repeat(64) });
		assert.match(gone.text, /holds wtfp.project.source\/v1|no longer exists/);
	}));

test("record refuses wrong type, id, project and unknown fields without touching the destination", () =>
	withDesk(async (host, workspace) => {
		const before = sha(workspace, ".planning/sections/introduction/section.json");
		const section = read(workspace, ".planning/sections/introduction/section.json");
		const expect_sha256 = before;
		const cases: Array<[Json, RegExp]> = [
			[{ ...section, schema: "wtfp.project.source/v1" }, /holds wtfp.project.section\/v1/],
			[{ ...section, id: "methods" }, /whose id is introduction/],
			[{ ...section, project_id: "another-project" }, /belongs to project another-project/],
			[{ ...section, surprise: true }, /would not validate: .*unknown property surprise|surprise/],
		];
		for (const [record, pattern] of cases) {
			const refused = await host.tool("record", { uri: "project://sections/introduction", record, expect_sha256 });
			assert.equal(refused.isError, true);
			assert.match(refused.text, pattern);
		}
		assert.equal(sha(workspace, ".planning/sections/introduction/section.json"), before);
	}));

test("no record write or file write escapes through a symbolic link", () =>
	withDesk(async (host, workspace) => {
		const outside = mkdtempSync(path.join(process.env.TMPDIR as string, "wtfp-outside-"));
		try {
			symlinkSync(outside, path.join(workspace, ".planning/sections/escape"));
			const section = { ...read(workspace, ".planning/sections/introduction/section.json"), id: "escape", title: "Escape" };
			const refused = await host.tool("record", { uri: "project://sections/escape", record: section });
			assert.match(refused.text, /symbolic link/);
			assert.deepEqual(readdirSync(outside), []);
			// A link that lands in paper/ is judged where it lands (W2).
			symlinkSync(path.join(workspace, "paper"), path.join(workspace, "drafts"));
			assert.match(blocked(await write(host, "drafts/introduction.md")) ?? "", /cannot be written yet/);
			// Clio follows a dangling link to its target, here outside the project, and refuses the write if the link changes after the hook.
			symlinkSync(path.join(outside, "missing"), path.join(workspace, "paper/dangling.md"));
			assert.equal(blocked(await write(host, "paper/dangling.md")), null);
			// A link Clio cannot resolve, such as a loop, is refused.
			symlinkSync("loop", path.join(workspace, "paper/loop"));
			assert.match(blocked(await write(host, "paper/loop/draft.md")) ?? "", /could not resolve/);
		} finally {
			rmSync(outside, { recursive: true, force: true });
		}
	}));

test("a readback that differs from what was written is reported against the file it names", () =>
	withDesk(async (host, workspace) => {
		const state = read(workspace, ".planning/state.json");
		process.env.WTFP_DESK_TEST_FAULT = "tamper-after-rename";
		try {
			const result = await host.tool("record", { uri: "project://state", record: { ...state, phase: "reviewing" }, expect_revision: 3 });
			assert.equal(result.isError, true);
			assert.match(result.text, /readback of \.planning\/state\.json differs from what was written/);
			assert.match(result.text, /^Committed, but/, "a write that landed is never reported as not written");
		} finally {
			delete process.env.WTFP_DESK_TEST_FAULT;
		}
	}));

// --- author gates --------------------------------------------------------------

test("a gate answer is recorded as a sealed interaction bound to what the author saw", () =>
	withDesk(async (host, workspace) => {
		const text = await answer(host, GATE, "workflow-first");
		assert.match(text, /Recorded the author's answer: checkpoint-framing: Workflow first/);
		const checkpoint = read(workspace, `.planning/checkpoints/${GATE}.json`);
		assert.equal(checkpoint.status, "resolved");
		assert.deepEqual(
			[(checkpoint.resolution as Json).resolved_by, (checkpoint.resolution as Json).selected_option],
			["author", "workflow-first"],
		);
		assert.deepEqual(read(workspace, ".planning/state.json").active_checkpoint_uris, [`project://checkpoints/${PLAN_GATE}`]);
		const [interaction] = interactions(workspace);
		assert.equal(interaction?.channel, "attested-interview");
		assert.equal(interaction?.outcome, "selected");
		assert.equal(interaction?.selected_option, "workflow-first");
		assert.match(String((interaction?.seal as Json).mac), /^[a-f0-9]{64}$/);
		const seen = (await host.tool("read_record", { uri: `project://checkpoints/${GATE}` })).data as Json;
		assert.equal(seen.trust, "attested");
		// The answer cannot be applied twice (G4).
		const again = await host.tool("gate", { checkpoint: GATE });
		assert.match(again.text, /already resolved by the author at this desk/);
	}));

test("cancelling, headless asking and keeping a gate pending never resolve it (G2)", () =>
	withDesk(async (host, workspace) => {
		let key = await ask(host, GATE);
		const cancelled = await host.interview({ id: "gate-one", step: key, nav: "cancel", answers: {}, reason: "operator" });
		assert.match("done" in cancelled ? cancelled.text : "", /stays pending/);
		key = await ask(host, GATE);
		const headless = await host.interview({ id: "gate-one", step: key, nav: "cancel", answers: {}, reason: "headless" });
		assert.match("done" in headless ? headless.text : "", /headless session; the gate stays pending and authorizes nothing/);
		const kept = await answer(host, GATE, "__keep");
		assert.match(kept, /kept checkpoint-framing pending/);
		assert.equal(read(workspace, `.planning/checkpoints/${GATE}.json`).status, "pending");
		assert.deepEqual(interactions(workspace).map((entry) => entry.outcome), ["kept-pending"]);
		assert.ok(blocked(await write(host, "paper/introduction.md")));
	}));

test("an answer that was not offered, replayed, or meant for another desk records nothing (G3, G4)", () =>
	withDesk(async (host, workspace) => {
		const key = await ask(host, GATE);
		const offered = await host.interview({ id: "gate-one", step: key, nav: "next", answers: { choice: "__resolve" } });
		assert.match("done" in offered ? offered.text : "", /not one of the options offered/);
		const replay = await host.interview({ id: "gate-one", step: key, nav: "next", answers: { choice: "workflow-first" } });
		assert.match("done" in replay ? replay.text : "", /matches no open question/);
		const forged = await host.interview({ id: "gate-one", step: "gate.0123456789ab", nav: "next", answers: { choice: "workflow-first" } });
		assert.match("done" in forged ? forged.text : "", /matches no open question/);
		const other = project();
		const elsewhere = withClioFacts(await createExtensionTestHost(ROOT, { workspace: other }), other);
		try {
			const foreign = await elsewhere.interview({ id: "gate-one", step: await ask(host, GATE), nav: "next", answers: { choice: "workflow-first" } });
			assert.match("done" in foreign ? foreign.text : "", /matches no open question/);
			assert.equal(read(other, `.planning/checkpoints/${GATE}.json`).status, "pending");
		} finally {
			await elsewhere.dispose();
			rmSync(other, { recursive: true, force: true });
		}
		assert.equal(read(workspace, `.planning/checkpoints/${GATE}.json`).status, "pending");
		assert.deepEqual(interactions(workspace), []);
	}));

test("a question that changes while it is open sets the old answer aside and asks again (G3)", () =>
	withDesk(async (host, workspace) => {
		const key = await ask(host, PLAN_GATE);
		writeFileSync(path.join(workspace, PLAN_FILE), "# Plan\n\n1. A different plan.\n");
		const stale = await host.interview({ id: "gate-one", step: key, nav: "next", answers: { choice: "approve" } });
		assert.ok(!("done" in stale), "a changed subject is asked again");
		assert.equal(read(workspace, `.planning/checkpoints/${PLAN_GATE}.json`).status, "pending");
		assert.deepEqual(interactions(workspace).map((entry) => entry.outcome), ["discarded-stale"]);
		const checkpoint = read(workspace, `.planning/checkpoints/${PLAN_GATE}.json`);
		const key2 = "step" in stale ? stale.step.key : "";
		put(workspace, `.planning/checkpoints/${PLAN_GATE}.json`, { ...checkpoint, request: "Approve the rewritten plan?" });
		const stale2 = await host.interview({ id: "gate-one", step: key2, nav: "next", answers: { choice: "approve" } });
		assert.ok(!("done" in stale2));
		assert.equal(read(workspace, `.planning/checkpoints/${PLAN_GATE}.json`).status, "pending");
	}));

test("an agent cannot fabricate, unblock, rescope or expire an author gate through any write path it has (G1)", () =>
	withDesk(async (host, workspace) => {
		const checkpoint = read(workspace, `.planning/checkpoints/${GATE}.json`);
		const expect_sha256 = sha(workspace, `.planning/checkpoints/${GATE}.json`);
		const resolution = { resolved_by: "author", selected_option: "workflow-first", summary: "The author chose it.", resolved_at: AT };
		const attempts: Array<[Json, RegExp]> = [
			[{ ...checkpoint, status: "resolved", resolution }, /only the author's answer at the desk/],
			[{ ...checkpoint, status: "resolved", resolution: { ...resolution, resolved_by: "policy" } }, /resolved only by the author/],
			[{ ...checkpoint, blocking: false }, /cannot be made nonblocking/],
			[{ ...checkpoint, scope_uri: "project://sections/elsewhere" }, /cannot change scope/],
			[{ ...checkpoint, status: "expired" }, /cannot be expired by the agent/],
		];
		for (const [record, pattern] of attempts) {
			const refused = await host.tool("record", { uri: `project://checkpoints/${GATE}`, record, expect_sha256 });
			assert.match(refused.text, pattern);
		}
		const interaction = await host.tool("record", { uri: "project://interactions/fake", record: { schema: "wtfp.project.interaction/v1", id: "fake" } });
		assert.match(interaction.text, /only the desk records an author's answer/);
		const first = await write(host, `.planning/checkpoints/${GATE}.json`);
		assert.match(blocked(first) ?? "", /portable record; write it with extension_wtfp__record/);
		assert.ok(first.effects?.some((effect) => effect.kind === "protect_path"), "the desk asks the host to protect its answers from shell mutation");
		assert.match(blocked(await write(host, ".planning/interactions/fake.json")) ?? "", /written only by the desk/);
		const shell = await host.hook({ point: "before_tool", tool: "bash", turnId: "t1", args: { command: "python3 -c 'open(\".planning/interactions/x.json\",\"w\")'" } });
		assert.match(blocked(shell) ?? "", /desk's own records/);

		// A resolution written straight to disk is not the author's answer: it holds its scope and is offered for confirmation.
		put(workspace, `.planning/checkpoints/${GATE}.json`, { ...checkpoint, status: "resolved", resolution });
		const seen = (await host.tool("read_record", { uri: `project://checkpoints/${GATE}` })).data as Json;
		assert.equal(seen.trust, "unattested");
		await answer(host, PLAN_GATE, "approve");
		assert.match(blocked(await write(host, "paper/introduction.md")) ?? "", /not observed by this desk and must be confirmed/);
		const gates = await host.command("check-todos");
		assert.match(gates.interview?.step.title ?? "", /Confirm a recorded answer/);
		const confirmed = await host.interview({ id: "gate", step: gates.interview?.step.key as string, nav: "next", answers: { choice: "workflow-first" } });
		assert.match("done" in confirmed ? confirmed.text : "", /Recorded: checkpoint-framing: Workflow first/);
		assert.equal(blocked(await write(host, "paper/introduction.md")), null);
	}));

test("nonblocking policy resolutions and state snapshots are not author gates", () =>
	withDesk(async (host, workspace) => {
		const note = {
			schema: "wtfp.project.checkpoint/v1",
			id: "note-figure-style",
			project_id: PROJECT,
			kind: "human-action",
			status: "pending",
			blocking: false,
			scope_uri: "project://sections/introduction",
			request: "Pick a figure palette when convenient.",
			options: [],
			resume_action: "write-section",
			created_at: AT,
		};
		const created = await host.tool("record", { uri: "project://checkpoints/note-figure-style", record: note });
		assert.equal(created.isError, undefined, created.text);
		const policy = { resolved_by: "policy", summary: "The configured default palette applies.", resolved_at: AT };
		const resolved = await host.tool("record", {
			uri: "project://checkpoints/note-figure-style",
			record: { ...note, status: "resolved", resolution: policy },
			expect_sha256: sha(workspace, ".planning/checkpoints/note-figure-style.json"),
		});
		assert.equal(resolved.isError, undefined, resolved.text);
		assert.equal(((await host.tool("read_record", { uri: "project://checkpoints/note-figure-style" })).data as Json).trust, "policy");
		const forged = await host.tool("record", {
			uri: "project://checkpoints/blocking-by-policy",
			record: { ...note, id: "blocking-by-policy", blocking: true, status: "resolved", resolution: policy },
		});
		assert.match(forged.text, /resolved only by the author/);
		const snapshot = await host.tool("record", {
			uri: "project://checkpoints/snapshot-before-revision",
			record: {
				...note,
				id: "snapshot-before-revision",
				kind: "state-snapshot",
				status: "available",
				request: "State before the revision.",
				snapshot: { archive_uri: "project://archives/checkpoints/snapshot-before-revision", resources: [{ uri: "project://state", revision: 3, sha256: sha(workspace, ".planning/state.json") }] },
			},
		});
		assert.equal(snapshot.isError, undefined, snapshot.text);
		await answer(host, GATE, "protocol-first");
		await answer(host, PLAN_GATE, "approve");
		assert.equal(blocked(await write(host, "paper/introduction.md")), null, "neither the policy-resolved note nor the snapshot holds the section");
		assert.match((await host.command("check-todos")).text, /No pending gates/);
	}));

// --- approved plans and write boundaries ---------------------------------------------

test("the manuscript waits for an author-approved plan whose exact bytes were approved (W1)", () =>
	withDesk(async (host, workspace) => {
		await answer(host, GATE, "protocol-first");
		assert.match(blocked(await write(host, "paper/introduction.md")) ?? "", /has not answered "Approve the introduction plan\?"/);
		const declined = project();
		const other = withClioFacts(await createExtensionTestHost(ROOT, { workspace: declined }), declined);
		try {
			await answer(other, GATE, "protocol-first");
			await answer(other, PLAN_GATE, "revise");
			assert.match(blocked(await write(other, "paper/introduction.md")) ?? "", /answered "revise" on approve-initial, not approve/);
		} finally {
			await other.dispose();
			rmSync(declined, { recursive: true, force: true });
		}
		await answer(host, PLAN_GATE, "approve");
		assert.equal(blocked(await write(host, "paper/introduction.md")), null);
		const ready = await host.tool("readiness", { section: "introduction" });
		assert.equal((ready.data as Json).ready, true, ready.text);
		// A linked plan is immutable, and changing its bytes anyway voids the approval.
		assert.match(blocked(await write(host, PLAN_FILE)) ?? "", /linked plans are immutable/);
		writeFileSync(path.join(workspace, PLAN_FILE), "# Plan\n\n1. Something the author never saw.\n");
		assert.match(blocked(await write(host, "paper/introduction.md")) ?? "", /plan changed after the author approved it/);
		rmSync(path.join(workspace, PLAN_FILE));
		assert.match(blocked(await write(host, "paper/introduction.md")) ?? "", /does not resolve to a plan file/);
		// A status alone never stands in for a plan.
		const section = read(workspace, ".planning/sections/introduction/section.json");
		put(workspace, ".planning/sections/introduction/section.json", { ...section, artifacts: { plans: [], reviews: [], manuscript: "project://paper/introduction" } });
		assert.match(blocked(await write(host, "paper/introduction.md")) ?? "", /no plan is linked/);
		// Nested and variant manuscript paths are the same section's manuscript.
		assert.ok(blocked(await write(host, "paper/introduction/results.md")));
		assert.ok(blocked(await write(host, "paper/introduction.v2.md")));
		assert.equal(blocked(await write(host, "paper/unrelated-notes.md")), null);
	}));

test("literature-heavy sections wait for verified evidence behind their required claims", () =>
	withDesk(async (host, workspace) => {
		const outline = read(workspace, ".planning/structure/outline.json");
		const [entry] = outline.sections as Json[];
		put(workspace, ".planning/structure/outline.json", { ...outline, sections: [{ ...entry, research: { required: true, topics: ["logging"] } }] });
		const section = read(workspace, ".planning/sections/introduction/section.json");
		put(workspace, ".planning/sections/introduction/section.json", {
			...section,
			claims: [{ id: "claim-flush", statement: "Flushes dominate logging cost.", status: "planned", evidence_required: true, evidence_uris: [] }],
		});
		await answer(host, GATE, "protocol-first");
		await answer(host, PLAN_GATE, "approve");
		const ready = await host.tool("readiness", { section: "introduction" });
		assert.equal((ready.data as Json).ready, false);
		assert.match(ready.text, /1 required claim lacks verified evidence \(claim-flush\); run research-gap first/);
		assert.match(blocked(await write(host, "paper/introduction.md")) ?? "", /research-gap/);
		// Verified, full-text support makes it ready; a contradiction on record, an invalid record or a reused id takes that back.
		put(workspace, ".planning/sources/source-flush.json", {
			schema: "wtfp.project.source/v1", id: "source-flush", project_id: PROJECT, kind: "journal-article", title: "Flush Costs", creators: ["A. Author"], year: 2025,
			identifiers: { doi: "10.1234/flush" }, citation_key: "author2025", status: "verified",
			provenance: { discovered_via: "scholarly-index", inspection_depth: "full-text", verified_at: AT },
		});
		const support = {
			schema: "wtfp.project.evidence/v1", id: "evidence-flush", project_id: PROJECT, source_uri: "project://sources/source-flush", claim_id: "claim-flush", relation: "supports",
			statement: "Flushes dominate.", locator: { kind: "section", value: "3" }, interpretation: "Direct measurement.", confidence: "high", inspection_depth: "full-text", verified_at: AT,
		};
		put(workspace, ".planning/evidence/evidence-flush.json", support);
		const linked = read(workspace, ".planning/sections/introduction/section.json");
		put(workspace, ".planning/sections/introduction/section.json", { ...linked, claims: [{ ...(linked.claims as Json[])[0], evidence_uris: ["project://evidence/evidence-flush"] }] });
		const readyNow = async () => ((await host.tool("readiness", { section: "introduction" })).data as Json).ready;
		assert.equal(await readyNow(), true);
		put(workspace, ".planning/evidence/evidence-against.json", { ...support, id: "evidence-against", relation: "contradicts" });
		assert.equal(await readyNow(), false, "an unlinked contradiction contests the claim");
		rmSync(path.join(workspace, ".planning/evidence/evidence-against.json"));
		const { statement: _statement, ...statementless } = support;
		put(workspace, ".planning/evidence/evidence-flush.json", statementless);
		assert.equal(await readyNow(), false, "an evidence record that fails its schema supports nothing");
		put(workspace, ".planning/evidence/evidence-flush.json", support);
		// A second copy can only sit away from the protocol file, so it is the copy that is ignored, and reported.
		put(workspace, ".planning/evidence/evidence-flush-copy.json", { ...support, relation: "contradicts" });
		assert.equal(await readyNow(), true);
		assert.match((await host.command("validate")).text, /record-ignored \.planning\/evidence\/evidence-flush-copy\.json/);
		rmSync(path.join(workspace, ".planning/evidence/evidence-flush-copy.json"));
		assert.equal(await readyNow(), true);
		// project://evidence/evidence-flush resolves to one file; the same record anywhere else is not it.
		writeFileSync(path.join(workspace, ".planning/evidence/renamed.json"), readFileSync(path.join(workspace, ".planning/evidence/evidence-flush.json")));
		rmSync(path.join(workspace, ".planning/evidence/evidence-flush.json"));
		assert.equal(await readyNow(), false, "evidence away from its protocol file supports nothing");
		assert.match((await host.command("validate")).text, /record-ignored \.planning\/evidence\/renamed\.json/);
		// A manuscript the desk will not follow cannot have its citations checked, and says so.
		rmSync(path.join(workspace, "paper/introduction.md"));
		symlinkSync(path.join(workspace, ".planning/project.json"), path.join(workspace, "paper/introduction.md"));
		assert.match((await host.command("validate")).text, /manuscript-unread project:\/\/sections\/introduction/);
		// A drafted section whose manuscript link names nothing under paper/ is reported too.
		const linked2 = read(workspace, ".planning/sections/introduction/section.json");
		put(workspace, ".planning/sections/introduction/section.json", { ...linked2, status: "writing", artifacts: { ...(linked2.artifacts as Json), manuscript: "project://materials/notes" } });
		assert.match((await host.command("validate")).text, /manuscript-unread project:\/\/sections\/introduction: project:\/\/materials\/notes could not be checked/);
	}, SERVED));

test("a section file counts only for the section whose id names its directory", () =>
	withDesk(async (host, workspace) => {
		const outline = read(workspace, ".planning/structure/outline.json");
		const [entry] = outline.sections as Json[];
		put(workspace, ".planning/structure/outline.json", { ...outline, sections: [{ ...entry, research: { required: true, topics: ["logging"] } }] });
		const section = read(workspace, ".planning/sections/introduction/section.json");
		const claims = [{ id: "claim-flush", statement: "Flushes dominate logging cost.", status: "planned", evidence_required: true, evidence_uris: [] }];
		put(workspace, ".planning/sections/introduction/section.json", { ...section, claims });
		await answer(host, GATE, "protocol-first");
		await answer(host, PLAN_GATE, "approve");
		const readyNow = async () => ((await host.tool("readiness", { section: "introduction" })).data as Json).ready;
		assert.equal(await readyNow(), false, "the unsupported required claim holds the section");
		// Renaming the record inside the file must not move its claims out of the section the outline names.
		put(workspace, ".planning/sections/introduction/section.json", { ...section, id: "intro-other", claims });
		assert.equal(await readyNow(), false);
		assert.ok(blocked(await write(host, "paper/introduction.md")));
		assert.match((await host.command("validate")).text, /record-ignored \.planning\/sections\/introduction\/section\.json/);
	}, SERVED));

test("a renamed section record cannot make a pending plan gate look superseded", () =>
	withDesk(async (host, workspace) => {
		const section = read(workspace, ".planning/sections/introduction/section.json");
		put(workspace, ".planning/sections/introduction/section.json", { ...section, id: "intro-other", artifacts: { ...(section.artifacts as Json), plans: [PLAN_URI, "project://sections/introduction/plans/decoy"] } });
		const checkpoint = read(workspace, `.planning/checkpoints/${PLAN_GATE}.json`);
		const expired = await host.tool("record", { uri: `project://checkpoints/${PLAN_GATE}`, record: { ...checkpoint, status: "expired" }, expect_sha256: sha(workspace, `.planning/checkpoints/${PLAN_GATE}.json`) });
		assert.match(expired.text, /cannot be expired by the agent/);
	}));

test("turning a gate off needs the author's confirmation at the desk", () =>
	withDesk(async (host, workspace) => {
		const config = read(workspace, ".planning/config.json");
		const proposal = { ...config, gates: { ...(config.gates as Json), confirm_plan: false } };
		const expect_sha256 = sha(workspace, ".planning/config.json");
		const asked = await host.tool("record", { uri: "project://config", record: proposal, expect_sha256 });
		assert.equal(asked.interview?.id, "confirm-write");
		assert.match(JSON.stringify(asked.interview?.step.intro), /gates.confirm_plan: on → off/);
		const declined = await host.interview({ id: "confirm-write", step: asked.interview?.step.key as string, nav: "next", answers: { choice: "decline" } });
		assert.match("done" in declined ? declined.text : "", /kept the current settings/);
		assert.equal(((read(workspace, ".planning/config.json").gates as Json).confirm_plan), true);
		const again = await host.tool("record", { uri: "project://config", record: proposal, expect_sha256 });
		const approved = await host.interview({ id: "confirm-write", step: again.interview?.step.key as string, nav: "next", answers: { choice: "approve" } });
		assert.match("done" in approved ? approved.text : "", /approved the change/);
		assert.equal(((read(workspace, ".planning/config.json").gates as Json).confirm_plan), false);
		assert.deepEqual(interactions(workspace).map((entry) => `${entry.kind}:${entry.outcome}`).sort(), ["record-change:approved", "record-change:declined"]);
		// With confirm_plan off, a contained linked plan stands without approval once no gate holds the section.
		rmSync(path.join(workspace, `.planning/checkpoints/${PLAN_GATE}.json`));
		assert.match(blocked(await write(host, "paper/introduction.md")) ?? "", /has not answered "Lead with the protocol/);
		await answer(host, GATE, "protocol-first");
		assert.equal(blocked(await write(host, "paper/introduction.md")), null);
	}));

test("an armed action writes only what its contract declares, for the section it names, until its turn ends", () =>
	withDesk(async (host, workspace) => {
		const armed = await host.hook({ point: "prompt_submit", text: "/wtfp:plan-section introduction" });
		assert.match(JSON.stringify(armed.effects), /plan-section introduction: files stay under \.planning\/sections\/introduction\/plans/);
		assert.match(blocked(await write(host, "paper/introduction.md")) ?? "", /may write only under \.planning\/sections\/introduction\/plans/);
		assert.equal(blocked(await write(host, ".planning/sections/introduction/plans/second.md")), null);
		assert.ok(blocked(await write(host, ".planning/sections/methods/plans/second.md")));
		const manifest = read(workspace, ".planning/project.json");
		const undeclared = await host.tool("record", { uri: "project://manifest", record: { ...manifest, title: "Retitled" }, expect_sha256: sha(workspace, ".planning/project.json") });
		assert.match(undeclared.text, /plan-section does not declare updating project:\/\/manifest/);
		await host.observe({ event: "turn_end", turnId: "t1", outcome: "completed", usage: null });
		assert.ok(!blocked(await write(host, ".planning/sections/methods/notes.md")), "the guard disarms when its turn ends");
		await host.hook({ point: "prompt_submit", text: "/wtfp:progress" });
		assert.match(blocked(await write(host, ".planning/sections/introduction/notes.md")) ?? "", /declares no file outputs/);
	}, SERVED));

test("WTF-P workers are dispatched only inside their action and only to manuscripts that are ready (W3)", () =>
	withDesk(async (host, workspace) => {
		const dispatch = (args: Json) => host.hook({ point: "before_tool", tool: "dispatch", turnId: "t1", args });
		assert.match(blocked(await dispatch({ agent: "wtfp-section-writer", task: "Draft the introduction." })) ?? "", /run only inside the WTF-P action/);
		await host.hook({ point: "prompt_submit", text: "/wtfp:write-section introduction" });
		assert.match(blocked(await dispatch({ agent: "wtfp-section-writer", task: "Draft the introduction." })) ?? "", /would have no manuscript it may write/);
		await answer(host, GATE, "protocol-first");
		await answer(host, PLAN_GATE, "approve");
		const allowed = await dispatch({ agent: "wtfp-section-writer", task: "Draft the introduction." });
		const rewrite = allowed.effects?.find((effect) => effect.kind === "rewrite_tool_input") as { args: Json } | undefined;
		assert.deepEqual((rewrite?.args.intent as Json).write_roots, [".planning/sections/introduction/summary.md", "paper/introduction.md", "paper/introduction/"]);
		const narrowed = await dispatch({ agent: "wtfp-section-writer", task: "Draft.", intent: { write_roots: ["."] } });
		const rewritten = narrowed.effects?.find((effect) => effect.kind === "rewrite_tool_input") as { args: Json } | undefined;
		assert.deepEqual((rewritten?.args.intent as Json).write_roots, [".planning/sections/introduction/summary.md", "paper/introduction.md", "paper/introduction/"]);
		assert.match(
			blocked(await dispatch({ tasks: [{ agent: "wtfp-section-writer", task: "a" }, { agent: "wtfp-section-writer", task: "b" }] })) ?? "",
			/give each task its own intent.write_roots/,
		);
		assert.match(blocked(await dispatch({ agent: "coder", task: "x", intent: { write_roots: ["src"] } })) ?? "", /lie outside what write-section may write/);
		assert.ok(existsSync(path.join(workspace, "paper/introduction.md")));
		// A root the action itself grants is refused when a link makes it lead somewhere else.
		symlinkSync(path.join(workspace, ".planning/sections"), path.join(workspace, "paper/introduction"));
		assert.match(blocked(await dispatch({ agent: "wtfp-section-writer", task: "Draft." })) ?? "", /paper\/introduction\/ does not lead where it reads/);
	}, SERVED));

test("the guard judges the file Clio's tools open, however the path is spelled (W2)", () =>
	withDesk(async (host, workspace) => {
		const manuscript = path.join(workspace, "paper/introduction.md");
		for (const spelling of ["@paper/introduction.md", `~/${path.relative(homedir(), manuscript)}`, "paper/./introduction.md"])
			assert.match(blocked(await write(host, spelling)) ?? "", /cannot be written yet/, spelling);
		assert.match(blocked(await write(host, "@.planning/config.json")) ?? "", /portable record/);
		// The kernel reads a link before the `..` after it, so latest/.. is paper/, not the workspace.
		mkdirSync(path.join(workspace, "paper/introduction"), { recursive: true });
		symlinkSync(path.join(workspace, "paper/introduction"), path.join(workspace, "latest"));
		assert.match(blocked(await write(host, "latest/../introduction.md")) ?? "", /cannot be written yet/);
		// The artifact tool trims its path and writes it like write does.
		const artifact = await host.hook({ point: "before_tool", tool: "artifact", turnId: "t1", args: { kind: "report", path: " paper/introduction.md ", content: "x" } });
		assert.match(blocked(artifact) ?? "", /cannot be written yet/);
		const script = await host.hook({ point: "before_tool", tool: "run_script", turnId: "t1", args: { interpreter: "python3", script: "x.py", args: [".planning/interactions/x.json"] } });
		assert.match(blocked(script) ?? "", /desk's own records/);
		const manifest = readFileSync(path.join(ROOT, "clio-coder-extension.yaml"), "utf8");
		const hooked = /on: before_tool, tools: \[([^\]]*)\]/u.exec(manifest)?.[1]?.split(/,\s*/u) ?? [];
		for (const tool of ["write", "edit", "artifact", "dispatch", "bash", "run_script", "job"]) assert.ok(hooked.includes(tool), `${tool} is hooked`);
	}));

test("where Clio resolves a call's landing and dispatch plan, the desk judges what Clio resolved", () =>
	withDesk(async (host, workspace) => {
		const real = realpathSync(workspace);
		const manuscript = path.join(real, "paper/introduction.md");
		const landed = (args: Json, target: unknown) => host.hook({ point: "before_tool", tool: "write", turnId: "t1", args, target });
		// The landing Clio sends is the file the tool opens, whatever the call spells.
		assert.match(blocked(await landed({ path: "notes.md" }, { arg: "path", path: manuscript, resolved: true, workspacePath: "paper/introduction.md" })) ?? "", /cannot be written yet/);
		// A path the desk could not inspect is judged where Clio says it lands.
		assert.match(blocked(await landed({ path: "/proc/self/cwd/paper/introduction.md" }, { arg: "path", path: manuscript, resolved: true, workspacePath: "paper/introduction.md" })) ?? "", /cannot be written yet/);
		// A worker's write in a task worktree is judged at the checkout path it merges into.
		assert.match(blocked(await landed({ path: "paper/introduction.md" }, { arg: "path", path: "/elsewhere/worktree/paper/introduction.md", resolved: true, workspacePath: "paper/introduction.md" })) ?? "", /cannot be written yet/);
		// Without a workspace path, the desk maps Clio's physical path itself.
		assert.match(blocked(await landed({ path: "x" }, { arg: "path", path: manuscript, resolved: true })) ?? "", /cannot be written yet/);
		assert.equal(blocked(await landed({ path: "/elsewhere/notes.md" }, { arg: "path", path: "/elsewhere/notes.md", resolved: true, workspacePath: null })), null);
		assert.match(blocked(await landed({ path: "loop/x" }, { arg: "path", path: path.join(real, "loop/x"), resolved: false, workspacePath: null })) ?? "", /Clio could not resolve/);
		assert.match(blocked(await landed({ path: "x" }, { arg: "path", path: 7, resolved: true })) ?? "", /form the desk cannot read/);

		const dispatch = (args: Json, plan: unknown) => host.hook({ point: "before_tool", tool: "dispatch", turnId: "t1", args, dispatch: plan });
		const task = (agent: string, extra: Json = {}) => ({ role: "task", agent, cwd: real, writeRoots: [], writeBoundaries: [], worktree: false, readOnly: false, ...extra });
		const plan = (...tasks: Json[]) => ({ kind: "tasks", mode: "single", tasks });
		const coder = { agent: "coder", task: "x", intent: { write_roots: ["src"] } };
		assert.equal(blocked(await dispatch(coder, plan(task("coder", { writeRoots: ["src"], writeBoundaries: [path.join(real, "src")] })))), null);
		// Clio resolves auto; a WTF-P agent it picks outside its action is refused like one named.
		assert.match(blocked(await dispatch({ agent: "auto", task: "Draft." }, plan(task("wtfp-section-writer")))) ?? "", /run only inside the WTF-P action/);
		assert.match(blocked(await dispatch(coder, plan(task("coder", { cwd: path.join(real, "paper") })))) ?? "", /cwd moves the write roots/);
		assert.match(
			blocked(await dispatch(coder, { kind: "tasks", mode: "compete", candidates: 2, tasks: [task("coder", { role: "candidate", worktree: true }), task("verifier", { role: "judge", readOnly: true })] })) ?? "",
			/refuses worktree writers/,
		);
		assert.match(blocked(await dispatch(coder, plan(task("coder", { writeRoots: ["src"] })))) ?? "", /form the desk cannot read/, "every root has its boundary");
		// A root lands where Clio says: one that resolves elsewhere does not lead where it reads, and one on the whole project is no boundary.
		assert.match(blocked(await dispatch(coder, plan(task("coder", { writeRoots: ["drafts/"], writeBoundaries: [path.join(real, "paper")] })))) ?? "", /drafts\/ does not lead where it reads/);
		assert.match(blocked(await dispatch(coder, plan(task("coder", { writeRoots: ["src", "."], writeBoundaries: [path.join(real, "src"), real] })))) ?? "", /intent\.write_roots/);
		assert.match(blocked(await dispatch({}, { kind: "apply-winner", branch: "winner", cwd: real })) ?? "", /compete winner/);
		assert.equal(blocked(await dispatch({}, { kind: "list" })), null);
		assert.match(blocked(await dispatch(coder, plan({ agent: "coder" }))) ?? "", /form the desk cannot read/);
		assert.match(blocked(await dispatch(coder, plan(task("coder", { agent: 7 })))) ?? "", /form the desk cannot read/);
		// Outside an action, a worker Clio runs read-only needs no roots either.
		assert.equal(blocked(await dispatch({ agent: "auto", task: "Look." }, plan(task("verifier", { readOnly: true })))), null);
		// Inside an action, a review loop's reviewer only judges: the builder is confined and the gate role leaves the count alone.
		await host.hook({ point: "prompt_submit", text: "/wtfp:write-section introduction" });
		await answer(host, GATE, "protocol-first");
		await answer(host, PLAN_GATE, "approve");
		const loop = await dispatch(
			{ agent: "wtfp-section-writer", task: "Draft the introduction.", review: { reviewer: "wtfp-section-reviewer" } },
			{ kind: "tasks", mode: "review", tasks: [task("wtfp-section-writer", { role: "builder" }), task("wtfp-section-reviewer", { role: "reviewer", readOnly: true })] },
		);
		assert.equal(blocked(loop), null);
		const rewrite = loop.effects?.find((effect) => effect.kind === "rewrite_tool_input") as { args: Json } | undefined;
		assert.deepEqual((rewrite?.args.intent as Json).write_roots, [".planning/sections/introduction/summary.md", "paper/introduction.md", "paper/introduction/"]);
		// A worker Clio runs read-only needs no write roots, whatever its recipe is called.
		const reader = await dispatch({ agent: "auto", task: "Review the introduction." }, plan(task("verifier", { readOnly: true })));
		assert.equal(blocked(reader), null);
		assert.equal(reader.effects?.find((effect) => effect.kind === "rewrite_tool_input"), undefined);
		// The desk adds roots only to Clio's canonical shapes, never reproducing its other spellings.
		const spelled = await dispatch({ tasks: JSON.stringify([{ agent: "wtfp-section-writer", task: "Draft." }]) }, { kind: "tasks", mode: "fanout", tasks: [task("wtfp-section-writer")] });
		assert.match(blocked(spelled) ?? "", /send tasks as an array of task objects/);
	}, SERVED));

test("a Clio that sends no landing or dispatch plan is refused inside a WTF-P project or action and left alone elsewhere", async () => {
	await withDesk(async (host) => {
		const bare = (tool: string, args: Json) => host.hook({ point: "before_tool", tool, turnId: "t1", args, bare: true } as never);
		assert.match(blocked(await bare("write", { path: "src/notes.md" })) ?? "", /needs Clio 0\.6\.3/);
		assert.match(blocked(await bare("dispatch", { agent: "coder", task: "x", intent: { write_roots: ["src/"] } })) ?? "", /needs Clio 0\.6\.3/);
		assert.equal(blocked(await bare("dispatch", { list: true })), null);
		assert.equal(blocked(await bare("bash", { command: "ls" })), null);
	});
	const folder = mkdtempSync(path.join(process.env.TMPDIR as string, "wtfp-no-project-"));
	const host = await createExtensionTestHost(ROOT, { workspace: folder, plugin: null });
	try {
		const bare = (tool: string, args: Json) => host.hook({ point: "before_tool", tool, turnId: "t1", args } as never);
		assert.equal(blocked(await bare("write", { path: "notes.md" })), null, "a folder that is no WTF-P project is not the desk's to guard");
		assert.equal(blocked(await bare("dispatch", { agent: "coder", task: "x" })), null);
		await host.hook({ point: "prompt_submit", text: "/wtfp:new-paper durable workflows" });
		assert.match(blocked(await bare("write", { path: "notes.md" })) ?? "", /needs Clio 0\.6\.3/, "inside a WTF-P action it is");
	} finally {
		await host.dispose();
		rmSync(folder, { recursive: true, force: true });
	}
});

/** Loads the desk the way Clio's runtime child does and prints the before_tool verdict for each call. */
const HARNESS = `
import { pathToFileURL } from "node:url";
const [entry, workspace, calls] = process.argv.slice(2);
const hooks = new Map();
const noop = () => {};
const kv = () => {
	const map = new Map();
	return {
		async get(key) { return map.has(key) ? { value: structuredClone(map.get(key)), version: 1 } : { value: undefined, version: 0 }; },
		async set(key, value) { map.set(key, structuredClone(value)); return { ok: true }; },
		async delete(key) { map.delete(key); },
		async keys() { return [...map.keys()]; },
	};
};
const ctx = { snapshot: { plugin: null, workspace, sessionId: "s", generation: 1, mode: "interactive", activeWorkspace: null }, requestId: "r", signal: new AbortController().signal, options: {}, state: kv(), store: kv() };
const module = await import(pathToFileURL(entry).href);
module.default({ handle: noop, action: noop, tool: noop, interview: noop, on: noop, hook: (point, handler) => hooks.set(point, handler) });
const verdicts = [];
for (const call of JSON.parse(calls)) {
	const out = await hooks.get("before_tool")({ point: "before_tool", turnId: "t1", ...call }, ctx);
	verdicts.push(out?.effects?.find((effect) => effect.kind === "block_tool")?.reason ?? null);
}
console.log(JSON.stringify(verdicts));
`;

test("under the read and write access Clio grants the desk, it judges every call by the landing and plan Clio sends (W2)", async () => {
	const workspace = project();
	const harness = path.join(process.env.TMPDIR as string, `wtfp-host-harness-${process.pid}-${Date.now()}.mjs`);
	try {
		symlinkSync(path.join(workspace, "paper"), path.join(workspace, "drafts"));
		mkdirSync(path.join(workspace, "notes"));
		symlinkSync(path.join(workspace, ".planning"), path.join(workspace, "notes/records"));
		writeFileSync(harness, HARNESS);
		// The flags Clio 0.6.2 builds from the manifest (runtimePermissionArgs in runtime-process-v2.ts).
		const declared = /fs: \{ read: \[([^\]]*)\], write: \[([^\]]*)\] \}/u.exec(readFileSync(path.join(ROOT, "clio-coder-extension.yaml"), "utf8"));
		assert.ok(declared, "the manifest declares its file access");
		const entries = (list: string): string[] => list.split(",").map((entry) => entry.trim().replace(/^"|"$/gu, "")).filter(Boolean);
		const directory = (root: string): string => (root.endsWith(path.sep) ? root : `${root}${path.sep}`);
		const read = entries(declared[1] as string).map((entry) => directory(entry === "workspace" ? workspace : entry === "home" ? homedir() : path.join(workspace, entry)));
		const write = entries(declared[2] as string).filter((entry) => entry !== "store").map((entry) => directory(path.join(workspace, entry)));
		const calls: Array<[Json, boolean]> = [
			[{ tool: "write", args: { path: "paper/introduction.md" } }, true],
			[{ tool: "write", args: { path: "drafts/introduction.md" } }, true],
			[{ tool: "write", args: { path: "notes/records/config.json" } }, true],
			[{ tool: "write", args: { path: "src/notes.md" } }, false],
			[{ tool: "dispatch", args: { agent: "coder", task: "x", intent: { write_roots: ["drafts/"] } } }, true],
			[{ tool: "dispatch", args: { agent: "coder", task: "x", intent: { write_roots: ["src/"] } } }, false],
			...(existsSync("/proc/self/cwd") ? ([[{ tool: "write", args: { path: "/proc/self/cwd/paper/introduction.md" } }, true]] as Array<[Json, boolean]>) : []),
		];
		const run = spawnSync(
			process.execPath,
			["--permission", ...[directory(ROOT), harness, ...read].map((root) => `--allow-fs-read=${root}`), ...write.map((root) => `--allow-fs-write=${root}`), harness, path.join(ROOT, "runtime/extension.ts"), workspace, JSON.stringify(calls.map(([call]) => withFacts({ point: "before_tool", ...call }, workspace)))],
			{ cwd: workspace, encoding: "utf8", timeout: 60000 },
		);
		assert.equal(run.status, 0, run.stderr);
		const verdicts = JSON.parse(run.stdout) as Array<string | null>;
		calls.forEach(([call, refused], index) => assert.equal(verdicts[index] !== null, refused, `${JSON.stringify(call)}: ${verdicts[index]}`));
	} finally {
		rmSync(harness, { force: true });
		rmSync(workspace, { recursive: true, force: true });
	}
});

test("a manuscript nested under another section's stem is judged by every section it belongs to", () =>
	withDesk(async (host, workspace) => {
		const outline = read(workspace, ".planning/structure/outline.json");
		const [entry] = outline.sections as Json[];
		put(workspace, ".planning/structure/outline.json", { ...outline, sections: [entry, { ...entry, id: "appendix", title: "Appendix" }] });
		const intro = read(workspace, ".planning/sections/introduction/section.json");
		put(workspace, ".planning/sections/appendix/section.json", {
			...intro,
			id: "appendix",
			title: "Appendix",
			artifacts: { plans: [], reviews: [], manuscript: "project://paper/introduction/appendix" },
			checkpoint_uris: [],
		});
		await answer(host, GATE, "protocol-first");
		await answer(host, PLAN_GATE, "approve");
		assert.equal(blocked(await write(host, "paper/introduction.md")), null);
		assert.match(blocked(await write(host, "paper/introduction/appendix.md")) ?? "", /Appendix cannot be written yet/);
		await host.hook({ point: "prompt_submit", text: "/wtfp:write-section introduction" });
		const result = await host.hook({ point: "before_tool", tool: "dispatch", turnId: "t1", args: { agent: "wtfp-section-writer", task: "Draft." } });
		const roots = (rewriteOf(result)?.intent as Json | undefined)?.write_roots;
		assert.deepEqual(roots, [".planning/sections/introduction/summary.md", "paper/introduction.md"], "no worker root covers the appendix");
	}, SERVED));

test("dispatch is judged as Clio parses it, and no worker gets an unbounded or record-covering root (W3)", () =>
	withDesk(async (host, workspace) => {
		const dispatch = (args: Json) => host.hook({ point: "before_tool", tool: "dispatch", turnId: "t1", args });
		// Clio trims agent ids and accepts a batch as a JSON string or a single object.
		for (const args of [
			{ tasks: [{ agent: "wtfp-section-writer ", task: "Draft." }] },
			{ tasks: JSON.stringify([{ agent: "wtfp-section-writer", task: "Draft." }]) },
			{ tasks: { agent: "wtfp-section-writer", task: "Draft." } },
			{ agent: " wtfp-section-writer", task: "Draft." },
		])
			assert.match(blocked(await dispatch(args)) ?? "", /run only inside the WTF-P action/, JSON.stringify(args));
		// Outside an action, a generic worker must name roots that leave the records and gated manuscripts alone.
		assert.match(blocked(await dispatch({ agent: "coder", task: "x" })) ?? "", /intent\.write_roots/);
		assert.match(blocked(await dispatch({ agent: "coder", task: "x", intent: { write_roots: ["."] } })) ?? "", /intent\.write_roots/);
		assert.match(blocked(await dispatch({ agent: "coder", task: "x", intent: { write_roots: ["paper/"] } })) ?? "", /paper\/introduction\.md/);
		assert.match(blocked(await dispatch({ agent: "coder", task: "x", intent: { write_roots: [".planning/sections/"] } })) ?? "", /\.planning/);
		assert.equal(blocked(await dispatch({ agent: "coder", task: "x", intent: { write_roots: ["src/"] } })), null);
		// Every spelling the section's manuscript can take is held, not only the file that exists now.
		for (const root of ["paper/introduction.tex", "paper/introduction.typ", "paper/introduction", "paper/introduction.v2.md"])
			assert.match(blocked(await dispatch({ agent: "coder", task: "x", intent: { write_roots: [root] } })) ?? "", /may not change/, root);
		assert.match(blocked(await dispatch({ apply_winner: { branch: "clio-coder/compete/g/1" } })) ?? "", /cannot see what/);
		// Clio resolves write roots against a worker's cwd, and fixes a boundary where a root physically leads.
		assert.match(blocked(await dispatch({ agent: "coder", task: "x", cwd: "paper", intent: { write_roots: ["introduction.md"] } })) ?? "", /cwd/);
		assert.match(blocked(await dispatch({ tasks: [{ agent: "coder", task: "x", cwd: ".planning", intent: { write_roots: ["checkpoints/"] } }] })) ?? "", /cwd/);
		assert.equal(blocked(await dispatch({ agent: "coder", task: "x", cwd: ".", intent: { write_roots: ["src/"] } })), null);
		symlinkSync(path.join(workspace, "paper"), path.join(workspace, "drafts"));
		assert.match(blocked(await dispatch({ agent: "coder", task: "x", intent: { write_roots: ["drafts/"] } })) ?? "", /does not lead where it reads/);
		// An action that declares no file outputs never hands a writer an empty list, which Clio reads as no boundary.
		await host.hook({ point: "prompt_submit", text: "/wtfp:progress" });
		assert.match(blocked(await dispatch({ tasks: [{ agent: "wtfp-section-planner", task: "x" }] })) ?? "", /declares no file outputs/);
		const reviewer = await dispatch({ tasks: [{ agent: "wtfp-plan-checker", task: "x" }] });
		assert.equal(blocked(reviewer), null, "a read-only reviewer needs no roots");
		assert.equal(rewriteOf(reviewer), null, "and is not given an empty list");
		// Without a named section, a planner would get every section's directory, records included.
		await host.observe({ event: "turn_end", turnId: "t1", outcome: "completed", usage: null });
		await host.hook({ point: "prompt_submit", text: "/wtfp:plan-section" });
		assert.match(blocked(await dispatch({ agent: "wtfp-section-planner", task: "x" })) ?? "", /name the section/);
	}, SERVED));

test("changes that loosen what the desk holds wait for the author at the desk", () =>
	withDesk(async (host, workspace) => {
		const asks = async (uri: string, file: string, record: Json, expect: Json) => {
			const before = sha(workspace, file);
			const result = await host.tool("record", { uri, record, ...expect });
			assert.equal(result.interview?.id, "confirm-write", `${uri}: ${result.text}`);
			assert.equal(sha(workspace, file), before, `${uri} was not written before the author answered`);
			return JSON.stringify(result.interview?.step.intro);
		};
		const sectionFile = ".planning/sections/introduction/section.json";
		const section = read(workspace, sectionFile);
		const artifacts = section.artifacts as Json;
		assert.match(
			await asks("project://sections/introduction", sectionFile, { ...section, artifacts: { ...artifacts, manuscript: "project://paper/elsewhere" } }, { expect_sha256: sha(workspace, sectionFile) }),
			/manuscript/,
		);
		assert.match(await asks("project://sections/introduction", sectionFile, { ...section, artifacts: { ...artifacts, plans: [] } }, { expect_sha256: sha(workspace, sectionFile) }), /plan history/);
		const claim = { id: "claim-flush", statement: "Flushes dominate logging cost.", status: "planned", evidence_required: true, evidence_uris: [] };
		put(workspace, sectionFile, { ...section, claims: [claim] });
		assert.match(
			await asks("project://sections/introduction", sectionFile, { ...section, claims: [{ ...claim, evidence_required: false }] }, { expect_sha256: sha(workspace, sectionFile) }),
			/claim-flush/,
		);
		const outlineFile = ".planning/structure/outline.json";
		const outline = read(workspace, outlineFile);
		const [entry] = outline.sections as Json[];
		assert.match(await asks("project://structure/outline", outlineFile, { ...outline, sections: [{ ...entry, id: "intro-renamed" }] }, { expect_revision: 1 }), /introduction/);
		put(workspace, outlineFile, { ...outline, sections: [{ ...entry, research: { required: true, topics: ["logging"] } }] });
		assert.match(await asks("project://structure/outline", outlineFile, { ...outline, sections: [{ ...entry, research: { required: false, topics: [] } }] }, { expect_revision: 1 }), /research/);
		const configFile = ".planning/config.json";
		const config = read(workspace, configFile);
		assert.match(
			await asks("project://config", configFile, { ...config, safety: { ...(config.safety as Json), backup_before_major_edits: false } }, { expect_sha256: sha(workspace, configFile) }),
			/safety\.backup_before_major_edits/,
		);
		put(workspace, configFile, { ...config, interaction_mode: "guided" });
		assert.match(await asks("project://config", configFile, { ...config, interaction_mode: "standard" }, { expect_sha256: sha(workspace, configFile) }), /guided → standard/);
	}));

test("a pending plan gate cannot be retired by briefly linking a decoy plan", () =>
	withDesk(async (host, workspace) => {
		await answer(host, GATE, "protocol-first");
		const sectionFile = ".planning/sections/introduction/section.json";
		const section = read(workspace, sectionFile);
		const decoy = { ...(section.artifacts as Json), plans: [PLAN_URI, "project://sections/introduction/plans/decoy"] };
		assert.equal((await host.tool("record", { uri: "project://sections/introduction", record: { ...section, artifacts: decoy }, expect_sha256: sha(workspace, sectionFile) })).isError, undefined);
		const checkpoint = read(workspace, `.planning/checkpoints/${PLAN_GATE}.json`);
		await host.tool("record", { uri: `project://checkpoints/${PLAN_GATE}`, record: { ...checkpoint, status: "expired" }, expect_sha256: sha(workspace, `.planning/checkpoints/${PLAN_GATE}.json`) });
		const restored = await host.tool("record", { uri: "project://sections/introduction", record: section, expect_sha256: sha(workspace, sectionFile) });
		assert.equal(restored.interview?.id, "confirm-write", "unlinking the decoy rewrites the plan history, so the author is asked");
		assert.ok(blocked(await write(host, "paper/introduction.md")), "the manuscript still waits on an approved current plan");
	}));

test("the author approves a plan under the desk's own label, whatever the checkpoint calls its options", () =>
	withDesk(async (host, workspace) => {
		const checkpoint = read(workspace, `.planning/checkpoints/${PLAN_GATE}.json`);
		const swapped = await host.tool("record", {
			uri: `project://checkpoints/${PLAN_GATE}`,
			record: {
				...checkpoint,
				options: [
					{ id: "approve", label: "Send it back for revision", implication: "The plan is rewritten." },
					{ id: "revise", label: "Approve", implication: "Draft from this plan." },
				],
			},
			expect_sha256: sha(workspace, `.planning/checkpoints/${PLAN_GATE}.json`),
		});
		assert.equal(swapped.isError, undefined, swapped.text);
		const asked = await host.tool("gate", { checkpoint: PLAN_GATE });
		const options = asked.interview?.step.questions[0]?.options ?? [];
		const approve = options.find((option) => option.value === "approve");
		assert.match(approve?.label ?? "", /^Approve this plan/);
		assert.ok(!options.some((option) => option.value !== "approve" && /approve/iu.test(option.label)), "no other option may read as approval");
	}));

test("a seal counts only in the exact form the desk writes", () =>
	withDesk(async (host, workspace) => {
		await answer(host, GATE, "protocol-first");
		const [name] = readdirSync(path.join(workspace, ".planning/interactions"));
		const file = `.planning/interactions/${name}`;
		const interaction = read(workspace, file);
		const seal = interaction.seal as Json;
		for (const altered of [{ ...seal, mac: String(seal.mac).toUpperCase() }, { ...seal, method: "none" }]) {
			put(workspace, file, { ...interaction, seal: altered });
			assert.notEqual(((await host.tool("read_record", { uri: `project://checkpoints/${GATE}` })).data as Json).trust, "attested", JSON.stringify(altered));
		}
		// Even sealed with this machine's key, only an answer given at the desk's interview counts.
		const key = Buffer.from(String((await host.store.get("seal-key")).value), "hex");
		const { seal: _seal, ...body } = interaction;
		put(workspace, file, resealed({ ...body, channel: "host-prompt" }, key));
		assert.notEqual(((await host.tool("read_record", { uri: `project://checkpoints/${GATE}` })).data as Json).trust, "attested", "a host-prompt answer");
		put(workspace, file, interaction);
		assert.equal(((await host.tool("read_record", { uri: `project://checkpoints/${GATE}` })).data as Json).trust, "attested");
	}));

test("a sealed answer stands only behind the exact question, option and project it answered", () =>
	withDesk(async (host, workspace) => {
		await answer(host, GATE, "protocol-first");
		const trust = async () => ((await host.tool("read_record", { uri: `project://checkpoints/${GATE}` })).data as Json).trust;
		assert.equal(await trust(), "attested");
		const checkpointFile = `.planning/checkpoints/${GATE}.json`;
		const checkpoint = read(workspace, checkpointFile);
		const resolution = checkpoint.resolution as Json;
		put(workspace, checkpointFile, { ...checkpoint, resolution: { ...resolution, selected_option: "workflow-first" } });
		assert.equal(await trust(), "unattested", "a hand-swapped option");
		put(workspace, checkpointFile, { ...checkpoint, request: "A question the author never saw." });
		assert.equal(await trust(), "unattested", "a rewritten question");
		put(workspace, checkpointFile, checkpoint);
		const [name] = readdirSync(path.join(workspace, ".planning/interactions"));
		const interaction = read(workspace, `.planning/interactions/${name}`);
		const { seal: _seal, ...body } = interaction;
		const key = Buffer.from(String((await host.store.get("seal-key")).value), "hex");
		put(workspace, `.planning/interactions/${name}`, resealed({ ...body, project_id: "another-project" }, key));
		assert.equal(await trust(), "unattested", "an answer sealed for another project");
		assert.match(blocked(await write(host, "paper/introduction.md")) ?? "", /not observed by this desk/);
	}));

test("recovery finishes only a journal of the desk's own record writes", () =>
	withDesk(async (host, workspace) => {
		put(workspace, "notes/draft.md", "Unplanned prose.\n");
		const digest = createHash("sha256").update("Unplanned prose.\n").digest("hex");
		const before = sha(workspace, "paper/introduction.md");
		for (const entries of [
			[{ file: "paper/introduction.md", staging: "notes/draft.md", sha256: digest }],
			[{ file: ".planning/state.json", staging: "notes/draft.md", sha256: digest }],
		]) {
			put(workspace, ".planning/.wtfp-journal.json", { schema: "wtfp.clio-journal/v1", at: AT, entries });
			assert.match((await host.command("validate")).text, /Set aside a journal/);
		}
		assert.equal(sha(workspace, "paper/introduction.md"), before);
		assert.equal(read(workspace, ".planning/state.json").revision, 3);
		assert.ok(existsSync(path.join(workspace, "notes/draft.md")));
	}));

// --- durability and recovery ---------------------------------------------------------

test("measure_section counts body words by the desk's one method and commits the section and state together", () =>
	withDesk(async (host, workspace) => {
		const measured = await host.tool("measure_section", { section: "introduction" });
		assert.equal(measured.isError, undefined, measured.text);
		assert.deepEqual(measured.data, { words: 11, target: 100, file: "paper/introduction.md", total: 11 });
		assert.equal(read(workspace, ".planning/sections/introduction/section.json").word_count, 11);
		assert.equal((read(workspace, ".planning/state.json").progress as Json).word_count, 11);
		assert.equal(read(workspace, ".planning/state.json").revision, 4);
	}));

test("a failure between paired writes leaves a journal the next write completes; one before the commit point leaves nothing (R2)", () =>
	withDesk(async (host, workspace) => {
		process.env.WTFP_DESK_TEST_FAULT = "between-renames";
		try {
			const failed = await host.tool("measure_section", { section: "introduction" });
			assert.equal(failed.isError, true);
			assert.match(failed.text, /injected fault at between-renames/);
			assert.match(failed.text, /^Committed; recovery pending: injected fault at between-renames/);
		} finally {
			delete process.env.WTFP_DESK_TEST_FAULT;
		}
		assert.ok(existsSync(path.join(workspace, ".planning/.wtfp-journal.json")));
		assert.equal(read(workspace, ".planning/sections/introduction/section.json").word_count, 11);
		assert.equal((read(workspace, ".planning/state.json").progress as Json).word_count, 0);
		const before = tree(workspace);
		const progress = await host.command("progress");
		assert.match(progress.text, /interrupted record write awaits recovery/);
		assert.deepEqual(tree(workspace), before, "progress reads and never repairs");
		const validated = await host.command("validate");
		assert.match(validated.text, /Completed an interrupted write of \.planning\/sections\/introduction\/section\.json, \.planning\/state\.json/);
		assert.equal((read(workspace, ".planning/state.json").progress as Json).word_count, 11);
		assert.ok(!existsSync(path.join(workspace, ".planning/.wtfp-journal.json")));

		process.env.WTFP_DESK_TEST_FAULT = "before-commit";
		const sectionBefore = sha(workspace, ".planning/sections/introduction/section.json");
		try {
			writeFileSync(path.join(workspace, "paper/introduction.md"), "Just four words here.\n");
			const failed = await host.tool("measure_section", { section: "introduction" });
			assert.match(failed.text, /injected fault at before-commit/);
		} finally {
			delete process.env.WTFP_DESK_TEST_FAULT;
		}
		assert.equal(sha(workspace, ".planning/sections/introduction/section.json"), sectionBefore);
		assert.ok(!existsSync(path.join(workspace, ".planning/.wtfp-journal.json")));
		assert.deepEqual(
			readdirSync(path.join(workspace, ".planning/sections/introduction")).filter((name) => name.endsWith(".partial")),
			[],
		);
	}));

test("a fresh process trusts only answers it can verify and reports drift instead of inventing state (L1)", async () => {
	const workspace = project();
	let key: unknown;
	const first = withClioFacts(await createExtensionTestHost(ROOT, { workspace, sessionId: "first" }), workspace);
	try {
		await answer(first, GATE, "protocol-first");
		await answer(first, PLAN_GATE, "approve");
		key = (await first.store.get("seal-key")).value;
		assert.match(String(key), /^[a-f0-9]{64}$/);
	} finally {
		await first.dispose();
	}
	const resumed = withClioFacts(await createExtensionTestHost(ROOT, { workspace, sessionId: "resumed" }), workspace);
	const elsewhere = withClioFacts(await createExtensionTestHost(ROOT, { workspace, sessionId: "other-machine" }), workspace);
	try {
		await resumed.store.set("seal-key", key);
		assert.equal(blocked(await write(resumed, "paper/introduction.md")), null, "the same machine's key verifies the sealed answers");
		assert.match(blocked(await write(elsewhere, "paper/introduction.md")) ?? "", /not observed by this desk/);
		const validated = await resumed.command("validate");
		assert.match(validated.text, /words-unmeasured/);
		writeFileSync(path.join(workspace, PLAN_FILE), "# Plan\n\nChanged between sessions.\n");
		assert.match(blocked(await write(resumed, "paper/introduction.md")) ?? "", /plan changed after the author approved it/);
	} finally {
		await resumed.dispose();
		await elsewhere.dispose();
		rmSync(workspace, { recursive: true, force: true });
	}
});

// --- simulated lifecycle rehearsal --------------------------------------------------------

/**
 * SIMULATED: every "author" answer below is a scripted interview event, not a
 * person. This rehearses the desk's bookkeeping across a whole section
 * lifecycle; it is never evidence that an author decided anything.
 */
test("SIMULATED rehearsal: initialize, outline, reject then approve a plan, draft through an interruption, review, revise, pause and resume in a fresh process", async () => {
	assert.ok(process.env.TMPDIR, "Tests need a task-owned TMPDIR.");
	const workspace = mkdtempSync(path.join(process.env.TMPDIR, "wtfp-desk-rehearsal-"));
	const ID = "rehearsal";
	const S = "evaluation";
	let host = withClioFacts(await createExtensionTestHost(ROOT, { workspace, plugin: SERVED, sessionId: "s1" }), workspace);
	const turn = async (command: string) => {
		await host.observe({ event: "turn_end", turnId: "t", outcome: "completed", usage: null });
		const armed = await host.hook({ point: "prompt_submit", text: command });
		assert.equal(armed.effects?.[0]?.kind, "notify_operator", `${command} did not arm`);
	};
	const write = async (uri: string, change: (record: Json | null) => Json) => {
		const seen = (await host.tool("read_record", { uri })).data as Json;
		const record = change(seen.exists ? (seen.record as Json) : null);
		const expect = !seen.exists ? {} : typeof seen.revision === "number" ? { expect_revision: seen.revision } : { expect_sha256: seen.sha256 };
		const result = await host.tool("record", { uri, record, ...expect });
		assert.equal(result.isError, undefined, `${uri}: ${result.text}`);
	};
	const file = async (relative: string, text: string) => {
		assert.equal(blocked(await host.hook({ point: "before_tool", tool: "write", turnId: "t", args: { path: relative } })), null, `writing ${relative} was refused`);
		put(workspace, relative, text);
	};
	const ask = async (checkpoint: string, choice: string) => {
		const asked = await host.tool("gate", { checkpoint });
		const done = await host.interview({ id: "gate-one", step: asked.interview?.step.key as string, nav: "next", answers: { choice } });
		assert.ok("done" in done, `answering ${checkpoint} was asked again`);
		return done.text;
	};
	const checkpoint = (id: string, scope: string, request: string, options: Array<[string, string]>): Json => ({
		schema: "wtfp.project.checkpoint/v1", id, project_id: ID, kind: "decision", status: "pending", blocking: true,
		scope_uri: scope, request, options: options.map(([option, label]) => ({ id: option, label, implication: `${label}.` })),
		resume_action: "write-section", created_at: AT,
	});
	const sectionUri = `project://sections/${S}`;
	try {
		await turn("/wtfp:new-paper durable workflows");
		await write("project://manifest", () => ({
			schema: "wtfp.project.manifest/v1", protocol_version: 1, id: ID, title: "Resilient Checkpoint Coordination",
			document_type: "research-article", core_argument: "Coordinated incremental checkpoints reduce interruption.",
			target: { audience: "Systems researchers", word_limit: 120 }, requirements: { must_have: [], should_have: [], out_of_scope: [] },
			created_at: AT, updated_at: AT,
			artifacts: { manifest: "project://manifest", config: "project://config", state: "project://state", decisions: "project://decisions", outline: "project://structure/outline", materials: [], manuscripts: [], deliverables: [], archives: [] },
		}));
		await write("project://config", () => ({ schema: "wtfp.project.config/v1", project_id: ID, interaction_mode: "standard", depth: "standard", output_format: "markdown", language: "en-US", gates: { confirm_outline: true, confirm_plan: true, confirm_write: true, confirm_review: true, confirm_delivery: true }, workflow: { research: true, plan_validation: true, argument_validation: true, coherence_validation: true }, safety: { destructive_requires_authorization: true, external_publish_requires_authorization: true, backup_before_major_edits: true }, parallelism: { enabled: false, max_workers: 1 } }));
		await write("project://state", () => ({ schema: "wtfp.project.state/v1", project_id: ID, revision: 0, phase: "initialized", status: "active", current_section_uri: null, progress: { sections_total: 0, sections_complete: 0, word_target: 120, word_count: 0 }, active_checkpoint_uris: [], updated_at: AT }));
		await write("project://decisions", () => ({ schema: "wtfp.project.decisions/v1", project_id: ID, revision: 0, items: [], updated_at: AT }));
		const entry = { id: S, title: "Evaluation", goal: "Report the measurements.", argument_role: "evidence", word_target: 120, wave: 1, depends_on: [], claim_ids: [], research: { required: false, topics: [] } };
		await write("project://structure/outline", () => ({ schema: "wtfp.project.outline/v1", project_id: ID, revision: 0, thesis: "Coordinated incremental checkpoints reduce interruption.", target_words: 120, sections: [entry], updated_at: AT }));

		await turn("/wtfp:create-outline");
		await write("project://structure/outline", (outline) => ({ ...(outline as Json), sections: [{ ...entry, goal: "Report the synthetic interruption measurements." }] }));
		await write(sectionUri, () => ({ schema: "wtfp.project.section/v1", id: S, project_id: ID, outline_uri: "project://structure/outline", title: "Evaluation", goal: "Report the synthetic interruption measurements.", status: "not-started", word_target: 120, word_count: 0, wave: 1, depends_on: [], claims: [], artifacts: { plans: [], reviews: [], manuscript: `project://paper/${S}` }, checkpoint_uris: [], validation_uris: [], updated_at: AT }));
		await write("project://state", (state) => ({ ...(state as Json), phase: "outlining", progress: { ...((state as Json).progress as Json), sections_total: 1 } }));

		await turn(`/wtfp:discuss-section ${S}`);
		await file(`.planning/sections/${S}/context.md`, "# Context\n\nReport only the supplied synthetic observations.\n");
		await write("project://checkpoints/framing", () => checkpoint("framing", sectionUri, "Lead with interruption time or recovery coverage?", [["interruption", "Interruption time"], ["coverage", "Recovery coverage"]]));
		assert.match(await ask("framing", "interruption"), /Recorded the author's answer/);
		await write(sectionUri, (section) => ({ ...(section as Json), checkpoint_uris: ["project://checkpoints/framing"], artifacts: { ...((section as Json).artifacts as Json), context: `${sectionUri}/context` } }));

		await turn(`/wtfp:plan-section ${S}`);
		await file(`.planning/sections/${S}/plans/first.md`, "# Plan\n\n1. Report every measurement at once.\n");
		await write("project://checkpoints/approve-first", () => checkpoint("approve-first", `${sectionUri}/plans/first`, "Approve the evaluation plan?", [["approve", "Approve"], ["revise", "Revise"], ["reject", "Reject"]]));
		assert.match(await ask("approve-first", "revise"), /Revise/, "the author's rejection is recorded, not approval");
		await file(`.planning/sections/${S}/plans/second.md`, "# Plan\n\n1. Lead with interruption time.\n2. Bound every claim to the synthetic workload.\n");
		await write("project://checkpoints/approve-second", () => checkpoint("approve-second", `${sectionUri}/plans/second`, "Approve the revised evaluation plan?", [["approve", "Approve"], ["revise", "Revise"], ["reject", "Reject"]]));
		assert.match(await ask("approve-second", "approve"), /Approve/);
		await write(sectionUri, (section) => ({ ...(section as Json), status: "planned", artifacts: { ...((section as Json).artifacts as Json), plans: [`${sectionUri}/plans/second`] } }));
		await write("project://state", (state) => ({ ...(state as Json), phase: "planning", current_section_uri: sectionUri }));

		await turn(`/wtfp:write-section ${S}`);
		assert.equal((((await host.tool("readiness", { section: S })).data) as Json).ready, true);
		const dispatched = await host.hook({ point: "before_tool", tool: "dispatch", turnId: "t", args: { agent: "wtfp-section-writer", task: "Draft the evaluation." } });
		assert.ok(dispatched.effects?.some((effect) => effect.kind === "rewrite_tool_input"), "the writer is dispatched with confined roots");
		await file(`paper/${S}.md`, "# Evaluation\n\nCoordinated incremental checkpoints reduced measured interruption in the synthetic workload.\n");
		process.env.WTFP_DESK_TEST_FAULT = "between-renames";
		try {
			assert.match((await host.tool("measure_section", { section: S })).text, /injected fault/);
		} finally {
			delete process.env.WTFP_DESK_TEST_FAULT;
		}
		assert.match((await host.command("validate")).text, /Completed an interrupted write/);
		await file(`.planning/sections/${S}/summary.md`, "Drafted from the second plan; eleven body words.\n");
		await write("project://manifest", (manifest) => ({ ...(manifest as Json), artifacts: { ...((manifest as Json).artifacts as Json), manuscripts: [`project://paper/${S}`] } }));
		await write(sectionUri, (section) => ({ ...(section as Json), status: "reviewing", artifacts: { ...((section as Json).artifacts as Json), summary: `${sectionUri}/summary` } }));

		await turn(`/wtfp:review-section ${S}`);
		await file(`.planning/sections/${S}/reviews/first.md`, "# Review\n\nThe sentence needs the workload size.\n");
		await write("project://validations/review-first", () => ({ schema: "wtfp.project.validation/v1", id: "review-first", project_id: ID, subject_uri: sectionUri, validator_role: "section-reviewer", action_id: "review-section", status: "issues-found", checks: [{ id: "scope", status: "failed", summary: "Workload size is missing.", evidence: ["paper/evaluation.md"] }], issues: [{ severity: "error", summary: "State the workload size." }], next_actions: [{ action: "plan-revision", reason: "One error to fix." }], effects_applied: [], executed_at: AT }));
		await write(sectionUri, (section) => ({ ...(section as Json), validation_uris: ["project://validations/review-first"], artifacts: { ...((section as Json).artifacts as Json), reviews: [`${sectionUri}/reviews/first`] } }));

		await turn(`/wtfp:plan-revision ${S}`);
		assert.ok(blocked(await host.hook({ point: "before_tool", tool: "write", turnId: "t", args: { path: `.planning/sections/${S}/plans/second.md` } })), "the approved plan cannot be edited in place");
		await file(`.planning/sections/${S}/plans/revision.md`, "# Revision plan\n\n1. Add the workload size to the measured sentence.\n");
		await write("project://checkpoints/approve-revision", () => checkpoint("approve-revision", `${sectionUri}/plans/revision`, "Approve the revision plan?", [["approve", "Approve"], ["revise", "Revise"], ["reject", "Reject"]]));
		assert.ok(blocked(await host.hook({ point: "before_tool", tool: "write", turnId: "t", args: { path: `paper/${S}.md` } })), "plan-revision never writes the manuscript");
		assert.match(await ask("approve-revision", "approve"), /Approve/);
		await write(sectionUri, (section) => ({ ...(section as Json), status: "writing", artifacts: { ...((section as Json).artifacts as Json), plans: [`${sectionUri}/plans/second`, `${sectionUri}/plans/revision`] } }));

		await turn(`/wtfp:write-section ${S}`);
		await file(`paper/${S}.md`, "# Evaluation\n\nIn the synthetic 512-node workload, coordinated incremental checkpoints reduced measured interruption.\n");
		assert.equal((await host.tool("measure_section", { section: S })).isError, undefined);

		await turn("/wtfp:pause-writing");
		await file(`.planning/sections/${S}/handoff.md`, "Resume by verifying the revised evaluation.\n");
		await write("project://checkpoints/resume", () => ({ ...checkpoint("resume", sectionUri, "Which action resumes the work?", [["verify", "Verify the section"], ["review", "Review again"]]), kind: "human-action", resume_action: "verify-work" }));
		await write(sectionUri, (section) => ({ ...(section as Json), checkpoint_uris: ["project://checkpoints/framing", "project://checkpoints/resume"], artifacts: { ...((section as Json).artifacts as Json), handoff: `${sectionUri}/handoff` } }));
		await write("project://state", (state) => ({ ...(state as Json), status: "paused", phase: "writing", active_checkpoint_uris: ["project://checkpoints/resume"] }));

		// A fresh process: no session state, the same machine's store.
		const key = (await host.store.get("seal-key")).value;
		await host.dispose();
		host = withClioFacts(await createExtensionTestHost(ROOT, { workspace, plugin: SERVED, sessionId: "s2" }), workspace);
		await host.store.set("seal-key", key);
		const progress = await host.command("progress");
		assert.match(progress.text, /evaluation: writing .* plan approved/);
		assert.match(progress.text, /Next: \/wtfp:check-todos \(Gate waiting on you: Which action resumes the work\?\)/);
		await turn("/wtfp:resume-writing");
		assert.match(await ask("resume", "verify"), /Verify the section/);
		await write("project://state", (state) => ({ ...(state as Json), status: "active" }));
		const validated = await host.command("validate");
		assert.doesNotMatch(validated.text, /^(blocker|error) /m, validated.text);
		assert.ok(blocked(await host.hook({ point: "before_tool", tool: "write", turnId: "t", args: { path: `paper/${S}.md` } })), "resume-writing declares no manuscript output");
		await host.observe({ event: "turn_end", turnId: "t", outcome: "completed", usage: null });
		assert.equal((((await host.tool("readiness", { section: S })).data) as Json).ready, true);
		assert.equal(blocked(await host.hook({ point: "before_tool", tool: "write", turnId: "t", args: { path: `paper/${S}.md` } })), null, "the approved revision still authorizes the manuscript");
		const decisions = interactions(workspace).map((entry) => `${entry.subject_uri}:${entry.outcome}:${entry.selected_option ?? ""}`).sort();
		assert.deepEqual(decisions, [
			"project://checkpoints/approve-first:selected:revise",
			"project://checkpoints/approve-revision:selected:approve",
			"project://checkpoints/approve-second:selected:approve",
			"project://checkpoints/framing:selected:interruption",
			"project://checkpoints/resume:selected:verify",
		]);
	} finally {
		await host.dispose();
		rmSync(workspace, { recursive: true, force: true });
	}
});

// --- the desk itself -------------------------------------------------------------------

test("the desk enters with its four regions and clears its ambient UI when left in a folder with no project", async () => {
	assert.ok(process.env.TMPDIR, "Tests need a task-owned TMPDIR.");
	const workspace = mkdtempSync(path.join(process.env.TMPDIR, "wtfp-desk-empty-"));
	const host = withClioFacts(await createExtensionTestHost(ROOT, { workspace }), workspace);
	try {
		const entered = await host.command("desk");
		assert.deepEqual(entered.workspace, { enter: "desk" });
		assert.deepEqual(Object.keys(entered.regions ?? {}), ["header", "board", "rail", "footer"]);
		assert.match(JSON.stringify(entered.band), /new-paper/);
		const left = await host.observe({ event: "workspace_leave", workspace: "desk" });
		assert.deepEqual(left, { text: "", status: null, band: null, islands: null });
		assert.ok(!existsSync(path.join(workspace, ".planning")), "drawing the desk creates nothing");
	} finally {
		await host.dispose();
		rmSync(workspace, { recursive: true, force: true });
	}
});

test("without its plugin the desk names only its own commands and never a /wtfp: prompt", () =>
	withDesk(async (host, workspace) => {
		const before = statSync(path.join(workspace, ".planning/state.json")).mtimeMs;
		const outputs: unknown[] = [];
		for (const name of ["desk", "progress", "help", "checkpoints", "validate"]) outputs.push(await host.command(name));
		for (const id of ["next", "help"]) outputs.push(await host.action(id));
		outputs.push(await host.action("section", "introduction"));
		outputs.push(await host.hook({ point: "prompt_submit", text: "/wtfp:write-section introduction" }));
		outputs.push(await write(host, "src/notes.md"));
		await host.hook({ point: "prompt_submit", text: "plain text" });
		outputs.push(await write(host, "paper/introduction.md"));
		outputs.push(await host.observe({ event: "session_open", reason: "startup" }));
		const emitted = JSON.stringify(outputs);
		assert.doesNotMatch(emitted, /\/wtfp:/);
		assert.match(emitted, /\/ext:wtfp:check-todos/);
		assert.match(emitted, /needs the WTF-P plugin|not installed and enabled/);
		assert.equal(statSync(path.join(workspace, ".planning/state.json")).mtimeMs, before);
	}));
