/**
 * WTF-P writing desk for Clio Coder. Human-edited source; the adapter
 * compiler copies it to vendors/clio-extension/runtime/ beside the
 * generated write-guard.json, json-schema.cjs and claim-coverage.cjs.
 *
 * The desk reads the portable `.planning` records and the manuscript and
 * draws them. It is also the project's one JSON record writer on Clio: each
 * write is validated, compared with the version its writer read, and
 * committed under a project lock, with paired records journaled so a failed
 * process leaves a state the next write completes. It alone records an
 * author's answer, as a sealed interaction record; a resolution counts as the
 * author's only while such a record still matches the checkpoint it answered.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
	appendFileSync,
	closeSync,
	existsSync,
	fsyncSync,
	lstatSync,
	mkdirSync,
	openSync,
	readdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	statSync,
	unlinkSync,
	writeSync,
} from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import type {
	ExtensionApiV2,
	ExtensionContextV2,
	ExtensionEffect,
	ExtensionHookResult,
	ExtensionIsland,
	ExtensionOutputV2,
	ExtensionSkin,
	InterviewNext,
	InterviewStep,
	View,
	ViewTone,
} from "@iowarp/clio-coder/extensions";

const require = createRequire(import.meta.url);
const { SchemaRegistry, validateInstance } = require("./json-schema.cjs") as {
	SchemaRegistry: new (files: string[]) => { get(file: string): unknown };
	validateInstance: (value: unknown, schema: unknown, file: string, registry: unknown) => string[];
};
const deskTrust = require("./desk-trust.cjs") as {
	canonical(value: unknown): string;
	checkpointDigest(record: Json): string;
	seal(record: Json, key: Buffer): Json;
	trustOf(checkpoint: Json, interactions: Json[], key: Buffer | null, projectId: string | null): { trust: Trust; answer?: Json };
};
const coverage = require("./claim-coverage.cjs") as {
	STRUCTURAL_SCOPE: string;
	analyzeCoverage(input: unknown): CoverageReport;
	indexRecords(entries: Array<{ file: string; record: Json }>, collection: string): { byUri: Record<string, Json>; ignored: Array<{ file: string; reason: string }> };
	unsupportedRequired(report: CoverageReport, section: string): string[];
};

interface CoverageFinding {
	severity: "blocker" | "error" | "warning" | "info";
	code: string;
	subject: string;
	message: string;
}

interface CoverageReport {
	scope: string;
	findings: CoverageFinding[];
	claims: Array<{ section: string; claim: string; status: string; evidence_required: boolean; support: "full" | "partial" | "none"; contested: boolean }>;
}

const PACKAGE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCHEMAS = path.join(PACKAGE_ROOT, "project", "schemas");
interface GuardAction {
	produces: Array<{ uri: string; mode: string }>;
}
const GUARD = JSON.parse(readFileSync(new URL("./write-guard.json", import.meta.url), "utf8")) as {
	schema: string;
	actions: Record<string, GuardAction>;
	paperWriters: string[];
	readOnlyAgents: string[];
};
const SKIN = JSON.parse(readFileSync(new URL("../skins/wtfp.json", import.meta.url), "utf8")) as ExtensionSkin;
const RECORD_LIMIT = 1024 * 1024;
const PHASES = ["initialized", "mapped", "outlining", "planning", "writing", "reviewing", "ready", "delivered"] as const;
const WORDMARK = [
	"██╗    ██╗████████╗███████╗      ██████╗ ",
	"██║    ██║╚══██╔══╝██╔════╝      ██╔══██╗",
	"██║ █╗ ██║   ██║   █████╗  █████╗██████╔╝",
	"██║███╗██║   ██║   ██╔══╝  ╚════╝██╔═══╝ ",
	"╚███╔███╔╝   ██║   ██║           ██║     ",
	" ╚══╝╚══╝    ╚═╝   ╚═╝           ╚═╝     ",
];
const WORD_METHOD =
	"Body words: front matter, headings, code, math, comments, citation keys and markup are left out; a word is a run of letters or digits, joined across an apostrophe or hyphen.";
/** Files only the desk writes. A model tool call that would change one is refused. */
const DESK_OWNED = [".planning/interactions", ".planning/.wtfp-lock", ".planning/.wtfp-journal.json"];
const LOCK = ".planning/.wtfp-lock";
const JOURNAL = ".planning/.wtfp-journal.json";
const LOCK_WAIT_MS = 2000;
const LOCK_STALE_MS = 30_000;
const SEAL_KEY = "seal-key";
/** The option id a plan-approval checkpoint uses for approval; any other answer leaves the plan unapproved. */
const APPROVE = "approve";

// --- records -----------------------------------------------------------------

type Json = Record<string, unknown>;
type ServedPlugin = ExtensionContextV2["snapshot"]["plugin"];

/**
 * How far an author answer can be trusted. `attested` means a sealed desk
 * interaction still matches the checkpoint; `unattested` is a resolution the
 * desk never observed (a hand edit, another host or an older desk); `foreign`
 * was sealed with another machine's key and cannot be checked here.
 */
type Trust = "pending" | "attested" | "unattested" | "foreign" | "policy" | "expired" | "snapshot";

interface Checkpoint {
	file: string;
	id: string;
	kind: string;
	status: string;
	blocking: boolean;
	scope_uri: string;
	request: string;
	context?: string;
	options?: Array<{ id: string; label: string; implication?: string }>;
	created_at?: string;
	resolution?: { resolved_by?: string; selected_option?: string; summary?: string; resolved_at?: string };
	trust: Trust;
	/** The sealed interaction behind an attested resolution. */
	answer?: Json;
	[key: string]: unknown;
}

interface PlanState {
	state: "none" | "missing" | "awaiting" | "approved" | "policy" | "changed" | "declined" | "unconfirmed";
	uri: string | null;
	file: string | null;
	sha256: string | null;
	reason: string;
}

interface SectionRow {
	id: string;
	title: string;
	wave: number;
	status: string;
	target: number;
	words: number;
	recorded: number | null;
	manuscript: string | null;
	claims: { total: number; verified: number; unsupported: number };
	stages: { discuss: boolean; plan: boolean; write: boolean; review: boolean };
	gates: Checkpoint[];
	research: { required: boolean; present: boolean };
	dependsOn: string[];
	plan: PlanState;
	unsupported: string[];
	record: Json | null;
}

interface Finding {
	severity: "blocker" | "error" | "warning" | "info";
	code: string;
	subject: string;
	message: string;
}

interface Desk {
	workspace: string;
	present: boolean;
	projectId: string | null;
	title: string;
	documentType: string;
	venue: string | null;
	deadline: string | null;
	argument: string;
	phase: string;
	status: string;
	confirmPlan: boolean;
	outputFormat: string;
	sections: SectionRow[];
	checkpoints: Checkpoint[];
	interactions: Json[];
	sources: Record<string, number>;
	evidence: number;
	issues: Record<"blocker" | "error" | "warning" | "info", number>;
	invalid: Array<{ file: string; errors: string[] }>;
	targetWords: number;
	paperExists: boolean;
	journal: boolean;
	coverage: CoverageReport;
	/** The WTF-P plugin while Clio serves it; null when it is not installed and enabled. */
	served: ServedPlugin;
}

/** Actions the desk answers itself; they stay reachable as `/ext:wtfp:<name>` without the plugin. */
const DESK_COMMANDS = new Set(["progress", "help", "check-todos"]);

/**
 * How the desk names an action: the plugin's `/wtfp:` prompt while the plugin
 * serves it, else the desk's own `/ext:wtfp:` command, else null because only
 * the plugin can run it.
 */
function commandFor(served: ServedPlugin, action: string, args = ""): string | null {
	const tail = args ? ` ${args}` : "";
	if (served?.prompts.includes(`wtfp:${action}`)) return `/wtfp:${action}${tail}`;
	if (DESK_COMMANDS.has(action)) return `/ext:wtfp:${action}${tail}`;
	return null;
}

/** An action's command, or its bare name where no command runs it here. */
function actionName(served: ServedPlugin, action: string): string {
	return commandFor(served, action) ?? action;
}

function inside(root: string, candidate: string): boolean {
	const relative = path.relative(root, candidate);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function posix(relative: string): string {
	return relative.split(path.sep).join("/");
}

/**
 * A project-relative path inside the workspace whose existing components are
 * all real files or directories. A symbolic link anywhere on the way could
 * carry a read or write outside the project, so it yields null.
 */
function contained(workspace: string, relative: string): string | null {
	const file = path.resolve(workspace, relative);
	if (!inside(workspace, file)) return null;
	let current = workspace;
	for (const part of path.relative(workspace, file).split(path.sep).filter(Boolean)) {
		current = path.join(current, part);
		let stat;
		try {
			stat = lstatSync(current);
		} catch {
			return file;
		}
		if (stat.isSymbolicLink()) return null;
	}
	return file;
}

const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/gu;

/**
 * Where a Clio file tool lands a path argument, resolved the way Clio's
 * src/tools/path-utils.ts and core/path-canonical.ts resolve it: a leading `@`
 * is dropped, Unicode spaces become plain ones, `~` is the home directory, and
 * the components are walked as the kernel walks them, so a `..` after a link
 * steps up from the link's target. Null when a link on the way does not
 * resolve; the guard refuses those rather than guess where they land.
 */
function toolTarget(raw: string, workspace: string): string | null {
	let spelled = (raw.startsWith("@") ? raw.slice(1) : raw).replace(UNICODE_SPACES, " ");
	if (spelled === "~") spelled = homedir();
	else if (spelled.startsWith("~/")) spelled = homedir() + spelled.slice(1);
	const joined = path.isAbsolute(spelled) ? spelled : `${workspace}${path.sep}${spelled}`;
	const { root } = path.parse(joined);
	let current = root;
	for (const part of joined.slice(root.length).split(path.sep)) {
		if (part === "" || part === ".") continue;
		if (part === "..") {
			current = path.dirname(current);
			continue;
		}
		const next = path.join(current, part);
		let link = false;
		try {
			link = lstatSync(next).isSymbolicLink();
		} catch {
			// Missing: nothing below it is a link, and a later `..` climbs back lexically.
		}
		if (!link) {
			current = next;
			continue;
		}
		try {
			current = realpathSync(next);
		} catch {
			return null;
		}
	}
	return current;
}

function readBytes(workspace: string, relative: string): Buffer | null {
	const file = contained(workspace, relative);
	if (file === null || !existsSync(file)) return null;
	const stat = lstatSync(file);
	if (!stat.isFile() || stat.size > RECORD_LIMIT) return null;
	return readFileSync(file);
}

function readText(workspace: string, relative: string): string | null {
	return readBytes(workspace, relative)?.toString("utf8") ?? null;
}

function readRecord(workspace: string, relative: string): Json | null {
	const source = readText(workspace, relative);
	if (source === null) return null;
	try {
		const value = JSON.parse(source) as unknown;
		return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
	} catch {
		// An unreadable record shows up as a schema problem from validation, not here.
		return null;
	}
}

function listJson(workspace: string, relative: string): string[] {
	const directory = contained(workspace, relative);
	if (directory === null || !existsSync(directory) || !lstatSync(directory).isDirectory()) return [];
	return readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".json") && !entry.name.startsWith("."))
		.map((entry) => path.posix.join(relative, entry.name))
		.sort();
}

function text(value: unknown, fallback = ""): string {
	return typeof value === "string" && value.length > 0 ? value : fallback;
}

function sha256(data: string | Buffer): string {
	return createHash("sha256").update(data).digest("hex");
}

/** JSON with object keys in code-unit order and no insignificant whitespace; the input to every digest and seal. */
function canonical(value: unknown): string {
	return deskTrust.canonical(value);
}

/** What a checkpoint asks, independent of whether and how it was answered. */
export function checkpointDigest(record: Json): string {
	return deskTrust.checkpointDigest(record);
}

function timestamp(): string {
	return new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
}

const EXTENSIONS: Record<string, string> = { markdown: ".md", latex: ".tex", typst: ".typ" };

/** `project://paper/{artifact}` to a manuscript file, trying the authored formats in order. */
function manuscriptFile(workspace: string, uri: unknown, format = "markdown"): string | null {
	if (typeof uri !== "string" || !uri.startsWith("project://paper/")) return null;
	const artifact = uri.slice("project://paper/".length);
	if (artifact.length === 0 || artifact.split("/").some((part) => part === ".." || part === "." || part === "")) return null;
	for (const candidate of [artifact, `${artifact}.md`, `${artifact}.tex`, `${artifact}.typ`]) {
		const relative = path.posix.join("paper", candidate);
		const file = contained(workspace, relative);
		if (file !== null && existsSync(file) && lstatSync(file).isFile()) return relative;
	}
	return path.posix.join("paper", /\.(md|tex|typ)$/u.test(artifact) ? artifact : `${artifact}${EXTENSIONS[format] ?? ".md"}`);
}

/** A section-scoped artifact URI to its conventional file, or null when it names no file. */
function artifactFile(workspace: string, uri: string, format = "markdown"): string | null {
	if (uri.startsWith("project://paper/")) return manuscriptFile(workspace, uri, format);
	const named = new RegExp(`^project://sections/(${IDENTIFIER})/(context|research|summary|handoff)$`, "u").exec(uri);
	if (named) return `.planning/sections/${named[1]}/${named[2]}.md`;
	const listed = new RegExp(`^project://sections/(${IDENTIFIER})/(plans|reviews)/(${IDENTIFIER})$`, "u").exec(uri);
	if (listed) return `.planning/sections/${listed[1]}/${listed[2]}/${listed[3]}.md`;
	const route = RECORD_URIS.find((entry) => entry.pattern.test(uri));
	return route ? route.file(route.pattern.exec(uri)?.[1] ?? "") : null;
}

/** The one counting method every meter and tolerance uses (see WORD_METHOD). */
export function bodyWords(source: string, file: string): number {
	let body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, "");
	body = body.replace(/```[\s\S]*?```/gu, " ").replace(/`[^`\n]*`/gu, " ");
	body = body.replace(/<!--[\s\S]*?-->/gu, " ");
	body = body.replace(/\$\$[\s\S]*?\$\$/gu, " ").replace(/\$[^$\n]*\$/gu, " ");
	if (file.endsWith(".tex")) {
		body = body.replace(/(^|[^\\])%.*$/gmu, "$1");
		body = body.replace(/\\(?:begin|end)\{[^}]*\}/gu, " ");
		body = body.replace(/\\(?:cite[a-z]*|ref|eqref|autoref|label|input|include|bibliography\w*)\*?(?:\[[^\]]*\])*\{[^}]*\}/gu, " ");
		body = body.replace(/\\(?:section|subsection|subsubsection|chapter|paragraph)\*?\{[^}]*\}/gu, " ");
		body = body.replace(/\\[a-zA-Z@]+\*?/gu, " ");
	}
	if (file.endsWith(".typ")) body = body.replace(/^\s*=+\s.*$/gmu, " ").replace(/\/\/.*$/gmu, " ").replace(/#[a-z-]+(?:\([^)]*\))?/gu, " ");
	body = body.replace(/^\s{0,3}#{1,6}\s.*$/gmu, " ");
	body = body.replace(/\[@[^\]]+\]|@[A-Za-z][\w:-]+/gu, " ");
	body = body.replace(/!\[[^\]]*\]\([^)]*\)/gu, " ").replace(/\[([^\]]*)\]\([^)]*\)/gu, "$1");
	return (body.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

let registry: InstanceType<typeof SchemaRegistry> | undefined;
function schemaRegistry(): InstanceType<typeof SchemaRegistry> {
	registry ??= new SchemaRegistry(
		readdirSync(SCHEMAS)
			.filter((name) => name.endsWith(".schema.json"))
			.map((name) => path.join(SCHEMAS, name)),
	);
	return registry;
}

/** Schema errors for one record, as the canonical validator reports them. */
function validateRecord(value: unknown): string[] {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return ["$: planning record must be a JSON object"];
	const match = /^wtfp\.project\.([a-z][a-z0-9-]*)\/v1$/u.exec(text((value as Json).schema));
	if (!match) return ["$: missing or unsupported wtfp.project.<record>/v1 schema discriminator"];
	const schemaFile = path.join(SCHEMAS, `${match[1]}.schema.json`);
	if (!existsSync(schemaFile)) return [`$: no canonical schema for record type ${match[1]}`];
	const schemas = schemaRegistry();
	return validateInstance(value, schemas.get(schemaFile), schemaFile, schemas);
}

function validateFile(workspace: string, relative: string): string[] {
	const source = readText(workspace, relative);
	if (source === null) return contained(workspace, relative) === null ? ["$: reached through a symbolic link; the desk does not follow links"] : [];
	try {
		return validateRecord(JSON.parse(source));
	} catch (error) {
		return [`$: invalid JSON (${error instanceof Error ? error.message : String(error)})`];
	}
}

function planningRecords(workspace: string, relative = ".planning"): string[] {
	const directory = contained(workspace, relative);
	if (directory === null || !existsSync(directory) || !lstatSync(directory).isDirectory()) return [];
	const out: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
		if (entry.name.startsWith(".")) continue;
		const child = path.posix.join(relative, entry.name);
		if (entry.isDirectory() && entry.name !== "archives") out.push(...planningRecords(workspace, child));
		else if (entry.isFile() && entry.name.endsWith(".json")) out.push(child);
	}
	return out;
}

// --- seals -------------------------------------------------------------------

/** The desk's seal over an interaction record (evaluation/lib/desk-trust.js, shared with the campaign collector). */
function sealed(record: Json, key: Buffer): Json {
	return deskTrust.seal(record, key);
}

async function storedKey(ctx: ExtensionContextV2, create: boolean): Promise<Buffer | null> {
	const current = await ctx.store.get<string>(SEAL_KEY);
	if (typeof current.value === "string" && /^[a-f0-9]{64}$/u.test(current.value)) return Buffer.from(current.value, "hex");
	if (!create) return null;
	// ifVersion keeps two sessions from each minting a key; the loser reads the winner's.
	await ctx.store.set(SEAL_KEY, randomBytes(32).toString("hex"), { ifVersion: current.version });
	const settled = await ctx.store.get<string>(SEAL_KEY);
	return typeof settled.value === "string" ? Buffer.from(settled.value, "hex") : null;
}

function trustOf(checkpoint: Checkpoint, interactions: Json[], key: Buffer | null, projectId: string | null): { trust: Trust; answer?: Json } {
	return deskTrust.trustOf(checkpoint, interactions, key, projectId);
}

/** Recorded as answered, but with no author answer sealed by this desk behind it. */
function unconfirmed(checkpoint: Checkpoint): boolean {
	return checkpoint.trust === "unattested" || checkpoint.trust === "foreign" || checkpoint.trust === "policy";
}

/** A blocking checkpoint holds its scope until the author's answer is attested here. */
function holds(checkpoint: Checkpoint): boolean {
	return checkpoint.blocking && (checkpoint.trust === "pending" || unconfirmed(checkpoint));
}

function scopes(id: string, manuscript: string | null): string[] {
	return [`project://sections/${id}`, ...(manuscript ? [`project://${manuscript.replace(/\.(md|tex|typ)$/u, "")}`] : [])];
}

function sectionGates(checkpoints: Checkpoint[], id: string, manuscript: string | null): Checkpoint[] {
	const owned = scopes(id, manuscript);
	return checkpoints.filter(
		(checkpoint) =>
			holds(checkpoint) && owned.some((scope) => checkpoint.scope_uri === scope || checkpoint.scope_uri.startsWith(`${scope}/`) || checkpoint.scope_uri.startsWith(`${scope}.`)),
	);
}

// --- the approved-plan predicate ---------------------------------------------

/**
 * Whether a section's current plan may drive its manuscript. The current plan
 * is the last one linked from the section record; it must be a real contained
 * file, and while confirm_plan is on, an attested author answer of `approve`
 * on a checkpoint scoped to that plan must have been given for exactly these
 * bytes. A later edit, a declined or unconfirmed answer, or no answer at all
 * leaves it unapproved.
 */
function planState(workspace: string, id: string, record: Json | null, checkpoints: Checkpoint[], confirmPlan: boolean): PlanState {
	const plans = Array.isArray((record?.artifacts as Json | undefined)?.plans) ? ((record?.artifacts as Json).plans as unknown[]) : [];
	const uri = plans.length > 0 && typeof plans[plans.length - 1] === "string" ? (plans[plans.length - 1] as string) : null;
	if (uri === null) return { state: "none", uri: null, file: null, sha256: null, reason: "no plan is linked from the section record" };
	const file = new RegExp(`^project://sections/${id}/plans/${IDENTIFIER}$`, "u").test(uri) ? artifactFile(workspace, uri) : null;
	const bytes = file === null ? null : readBytes(workspace, file);
	if (file === null || bytes === null)
		return { state: "missing", uri, file, sha256: null, reason: `${uri} does not resolve to a plan file in this project` };
	const digest = sha256(bytes);
	const policy: PlanState = { state: "policy", uri, file, sha256: digest, reason: "confirm_plan is off, so the linked plan stands without an author approval" };
	const asked = checkpoints.filter((checkpoint) => checkpoint.scope_uri === uri && checkpoint.kind !== "state-snapshot");
	const answered = asked
		.filter((checkpoint) => checkpoint.trust === "attested" && checkpoint.answer)
		.sort((a, b) => text(b.answer?.answered_at).localeCompare(text(a.answer?.answered_at)));
	const latest = answered[0];
	// An author's explicit answer on this plan decides even when confirm_plan is off: a rejection is never overridden by policy.
	if (latest) {
		if (latest.resolution?.selected_option !== APPROVE || latest.status !== "resolved")
			return { state: "declined", uri, file, sha256: digest, reason: `the author answered "${latest.resolution?.selected_option ?? latest.status}" on ${latest.id}, not approve` };
		const shown = ((latest.answer?.presented as Json | undefined)?.artifact as Json | undefined)?.sha256;
		if (shown !== digest)
			return confirmPlan ? { state: "changed", uri, file, sha256: digest, reason: `the plan changed after the author approved it on ${latest.id}` } : policy;
		return { state: "approved", uri, file, sha256: digest, reason: `approved by the author on ${latest.id}` };
	}
	if (!confirmPlan) return policy;
	if (asked.some((checkpoint) => checkpoint.trust === "pending"))
		return { state: "awaiting", uri, file, sha256: digest, reason: "its approval checkpoint waits on the author" };
	if (asked.some((checkpoint) => checkpoint.trust === "unattested" || checkpoint.trust === "foreign"))
		return { state: "unconfirmed", uri, file, sha256: digest, reason: "its recorded approval was not observed by this desk; confirm it at the gate" };
	return { state: "awaiting", uri, file, sha256: digest, reason: `no approval checkpoint is scoped to ${uri}` };
}

function planReady(plan: PlanState): boolean {
	return plan.state === "approved" || plan.state === "policy";
}

/** Why a section's manuscript may not be written now; empty when it may. */
function blockers(desk: Desk, section: SectionRow): string[] {
	const reasons: string[] = [];
	for (const gate of section.gates)
		reasons.push(
			gate.trust === "pending"
				? `the author has not answered "${gate.request}" (${gate.id})`
				: `the recorded answer to ${gate.id} was not observed by this desk and must be confirmed`,
		);
	if (!planReady(section.plan)) reasons.push(`${section.plan.reason}`);
	if (section.research.required && section.unsupported.length > 0)
		reasons.push(`${section.unsupported.length} required ${section.unsupported.length === 1 ? "claim lacks" : "claims lack"} verified evidence (${section.unsupported.slice(0, 3).join(", ")}); run research-gap first`);
	return reasons;
}

// --- loading -----------------------------------------------------------------

function loadDesk(workspace: string, key: Buffer | null = null): Desk {
	const manifest = readRecord(workspace, ".planning/project.json");
	const config = readRecord(workspace, ".planning/config.json");
	const state = readRecord(workspace, ".planning/state.json");
	const outline = readRecord(workspace, ".planning/structure/outline.json");
	const target = (manifest?.target ?? {}) as Json;
	const progress = (state?.progress ?? {}) as Json;
	const projectId = typeof manifest?.id === "string" ? manifest.id : null;
	const interactions = listJson(workspace, ".planning/interactions").flatMap((file) => {
		const record = readRecord(workspace, file);
		return record && record.schema === "wtfp.project.interaction/v1" ? [record] : [];
	});
	const checkpoints: Checkpoint[] = listJson(workspace, ".planning/checkpoints").flatMap((file) => {
		const record = readRecord(workspace, file);
		if (!record || typeof record.id !== "string") return [];
		const checkpoint = {
			...record,
			file,
			id: record.id,
			kind: text(record.kind, "decision"),
			status: text(record.status, "pending"),
			blocking: record.blocking === true,
			scope_uri: text(record.scope_uri),
			request: text(record.request, record.id),
		} as Checkpoint;
		Object.assign(checkpoint, trustOf(checkpoint, interactions, key, projectId));
		return [checkpoint];
	});
	checkpoints.sort((a, b) => text(a.created_at).localeCompare(text(b.created_at)) || a.id.localeCompare(b.id));
	const gates = (config?.gates ?? {}) as Json;
	const confirmPlan = gates.confirm_plan !== false;
	const outputFormat = text(config?.output_format, "markdown");

	// Only a record that passes its schema can support a claim, and an id carried by two records names neither.
	const ignored: Array<{ file: string; reason: string }> = [];
	const sources: Record<string, number> = {};
	const indexed = (collection: string): Record<string, Json> => {
		const entries: Array<{ file: string; record: Json }> = [];
		for (const file of listJson(workspace, `.planning/${collection}`)) {
			const record = readRecord(workspace, file);
			if (!record) continue;
			if (collection === "sources") sources[text(record.status, "unknown")] = (sources[text(record.status, "unknown")] ?? 0) + 1;
			if (validateRecord(record).length > 0) ignored.push({ file, reason: "it fails its schema" });
			else entries.push({ file, record });
		}
		const index = coverage.indexRecords(entries, collection);
		ignored.push(...index.ignored);
		return index.byUri;
	};
	const sourceRecords = indexed("sources");
	const evidenceRecords = indexed("evidence");

	const outlined = Array.isArray(outline?.sections) ? (outline.sections as Json[]) : [];
	const loaded = outlined.map((entry) => {
		const id = text(entry.id, "section");
		const record = readRecord(workspace, `.planning/sections/${id}/section.json`);
		const artifacts = (record?.artifacts ?? {}) as Json;
		const manuscript = manuscriptFile(workspace, artifacts.manuscript ?? `project://paper/${id}`, outputFormat);
		const source = manuscript ? readText(workspace, manuscript) : null;
		return { entry, id, record, artifacts, manuscript, source };
	});
	const report = coverage.analyzeCoverage({
		projectId,
		outline,
		sections: loaded.filter((item) => item.record).map((item) => ({ uri: `project://sections/${item.id}`, record: item.record })),
		evidence: evidenceRecords,
		sources: sourceRecords,
		manuscripts: loaded
			.filter((item) => item.source !== null && item.manuscript !== null)
			.map((item) => ({ section: item.id, file: item.manuscript, text: item.source })),
		ignored,
	});

	const sections: SectionRow[] = loaded.map(({ entry, id, record, artifacts, manuscript, source }) => {
		const base = `.planning/sections/${id}`;
		const words = source === null || manuscript === null ? 0 : bodyWords(source, manuscript);
		const status = text(record?.status, "not-started");
		const claims = Array.isArray(record?.claims) ? (record.claims as Json[]) : [];
		const plans = Array.isArray(artifacts.plans) ? artifacts.plans : [];
		const reviews = Array.isArray(artifacts.reviews) ? artifacts.reviews : [];
		const research = (entry.research ?? {}) as Json;
		const unsupported = coverage.unsupportedRequired(report, id);
		return {
			id,
			title: text(entry.title, id),
			wave: typeof entry.wave === "number" ? entry.wave : 1,
			status,
			target: typeof entry.word_target === "number" ? entry.word_target : Number(record?.word_target ?? 0),
			words,
			recorded: typeof record?.word_count === "number" ? record.word_count : null,
			manuscript,
			claims: {
				total: claims.length,
				verified: claims.filter((claim) => claim.status === "verified").length,
				unsupported: unsupported.length,
			},
			stages: {
				discuss: readBytes(workspace, `${base}/context.md`) !== null,
				plan: plans.length > 0 || ["planned", "writing", "reviewing", "complete"].includes(status),
				write: words > 0 || ["reviewing", "complete"].includes(status),
				review: reviews.length > 0 || status === "complete",
			},
			gates: sectionGates(checkpoints, id, manuscript),
			research: { required: research.required === true, present: readBytes(workspace, `${base}/research.md`) !== null },
			dependsOn: Array.isArray(entry.depends_on) ? entry.depends_on.filter((dep): dep is string => typeof dep === "string") : [],
			plan: planState(workspace, id, record, checkpoints, confirmPlan),
			unsupported,
			record,
		};
	});
	const issues = { blocker: 0, error: 0, warning: 0, info: 0 };
	for (const file of listJson(workspace, ".planning/validations")) {
		const record = readRecord(workspace, file);
		for (const issue of Array.isArray(record?.issues) ? (record.issues as Json[]) : []) {
			const severity = text(issue.severity) as keyof typeof issues;
			if (severity in issues) issues[severity] += 1;
		}
	}
	const journal = contained(workspace, JOURNAL);
	return {
		workspace,
		present: manifest !== null,
		projectId,
		title: text(manifest?.title, "Untitled paper"),
		documentType: text(manifest?.document_type, "paper"),
		venue: typeof target.venue === "string" ? target.venue : null,
		deadline: typeof target.deadline === "string" ? target.deadline : null,
		argument: text(manifest?.core_argument),
		phase: text(state?.phase, manifest ? "initialized" : "none"),
		status: text(state?.status, "active"),
		confirmPlan,
		outputFormat,
		sections,
		checkpoints,
		interactions,
		sources,
		evidence: Object.keys(evidenceRecords).length,
		issues,
		invalid: [],
		targetWords:
			typeof outline?.target_words === "number"
				? outline.target_words
				: typeof progress.word_target === "number"
					? progress.word_target
					: typeof target.word_limit === "number"
						? target.word_limit
						: sections.reduce((sum, section) => sum + section.target, 0),
		paperExists: contained(workspace, "paper") !== null && existsSync(path.join(workspace, "paper")),
		journal: journal !== null && existsSync(journal),
		coverage: report,
		served: null,
	};
}

/**
 * Disagreements between the records and the files they describe. Each one is
 * a reason not to trust a count or a link until the action that owns it runs
 * again; none is repaired here.
 */
function reconcile(workspace: string, desk: Desk): Finding[] {
	const out: Finding[] = [];
	const add = (severity: Finding["severity"], code: string, subject: string, message: string): void => {
		out.push({ severity, code, subject, message });
	};
	if (desk.journal) add("blocker", "write-interrupted", "project://state", "A journaled record write was interrupted; the next desk write or /ext:wtfp:validate completes it.");
	if (!desk.present) return out;
	const state = readRecord(workspace, ".planning/state.json");
	const manifest = readRecord(workspace, ".planning/project.json");
	const progress = (state?.progress ?? {}) as Json;
	if (state) {
		if (typeof progress.sections_total === "number" && progress.sections_total !== desk.sections.length)
			add("warning", "state-sections-total", "project://state", `state counts ${progress.sections_total} sections; the outline has ${desk.sections.length}.`);
		const complete = desk.sections.filter((section) => section.status === "complete").length;
		if (typeof progress.sections_complete === "number" && progress.sections_complete !== complete)
			add("warning", "state-sections-complete", "project://state", `state counts ${progress.sections_complete} complete sections; the section records say ${complete}.`);
		const recorded = desk.sections.reduce((sum, section) => sum + (section.recorded ?? 0), 0);
		if (typeof progress.word_count === "number" && progress.word_count !== recorded)
			add("warning", "state-word-count", "project://state", `state records ${progress.word_count} words; the section records sum to ${recorded}.`);
		const active = new Set(Array.isArray(state.active_checkpoint_uris) ? (state.active_checkpoint_uris as string[]) : []);
		const pending = new Set(desk.checkpoints.filter((checkpoint) => checkpoint.status === "pending").map((checkpoint) => `project://checkpoints/${checkpoint.id}`));
		for (const uri of active)
			if (!pending.has(uri)) add("warning", "state-active-stale", uri, `state lists ${uri} as active, but it is not a pending checkpoint.`);
		for (const uri of pending)
			if (!active.has(uri)) add("info", "state-active-missing", uri, `${uri} is pending but state does not list it as active.`);
	}
	const manuscripts = new Set(Array.isArray((manifest?.artifacts as Json | undefined)?.manuscripts) ? ((manifest?.artifacts as Json).manuscripts as string[]) : []);
	for (const section of desk.sections) {
		const subject = `project://sections/${section.id}`;
		if (!section.record) {
			if (section.status !== "not-started") add("error", "section-missing", subject, `the outline names ${section.id}, but its section record is missing.`);
			continue;
		}
		const artifacts = (section.record.artifacts ?? {}) as Json;
		for (const uri of [
			...(Array.isArray(artifacts.plans) ? (artifacts.plans as string[]) : []),
			...(Array.isArray(artifacts.reviews) ? (artifacts.reviews as string[]) : []),
			...["context", "research", "summary", "handoff"].map((key) => artifacts[key]).filter((uri): uri is string => typeof uri === "string"),
		]) {
			const file = artifactFile(workspace, uri, desk.outputFormat);
			if (file === null || readBytes(workspace, file) === null) add("error", "artifact-dangling", subject, `${uri} is linked but does not resolve to a file.`);
		}
		for (const uri of Array.isArray(section.record.checkpoint_uris) ? (section.record.checkpoint_uris as string[]) : [])
			if (!desk.checkpoints.some((checkpoint) => `project://checkpoints/${checkpoint.id}` === uri))
				add("error", "checkpoint-dangling", subject, `${uri} is linked but no such checkpoint exists.`);
		if (section.words > 0) {
			if (section.recorded !== section.words)
				add("warning", "words-unmeasured", subject, `${section.manuscript} has ${section.words} body words; the section record says ${section.recorded ?? "nothing"}. It changed after the last measurement.`);
			const uri = typeof artifacts.manuscript === "string" ? artifacts.manuscript : `project://paper/${section.id}`;
			if (!manuscripts.has(uri)) add("warning", "manuscript-unindexed", subject, `${uri} has text but is missing from the manifest's manuscripts index.`);
			if (!planReady(section.plan))
				add("warning", "draft-without-approved-plan", subject, `${section.manuscript} has text, but ${section.plan.reason}. The desk did not authorize those writes; they were imported or written outside an orchestrated action.`);
		}
	}
	for (const checkpoint of desk.checkpoints)
		if (checkpoint.blocking && unconfirmed(checkpoint))
			add("warning", "resolution-unattested", `project://checkpoints/${checkpoint.id}`, `${checkpoint.id} is recorded as ${checkpoint.status}, but no author answer sealed by this desk stands behind it; it still holds its scope.`);
	return out;
}

// --- the lock and the journal ------------------------------------------------

const SLEEP = new Int32Array(new SharedArrayBuffer(4));

/** Runs `work` while this process holds the project's write lock. */
function withLock<T>(workspace: string, work: () => T): T {
	const planning = contained(workspace, ".planning");
	if (planning === null) throw new Error(".planning is a symbolic link or escapes the project; the desk writes only real project directories");
	mkdirSync(planning, { recursive: true });
	const lock = path.join(workspace, LOCK);
	const deadline = performance.now() + LOCK_WAIT_MS;
	for (;;) {
		try {
			const handle = openSync(lock, "wx", 0o600);
			writeSync(handle, `${process.pid} ${new Date().toISOString()}\n`);
			closeSync(handle);
			break;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
			try {
				if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
					unlinkSync(lock);
					continue;
				}
			} catch {
				continue;
			}
			if (performance.now() > deadline) throw new Error(`another writer holds ${LOCK}; nothing was written, try again`);
			Atomics.wait(SLEEP, 0, 0, 20);
		}
	}
	try {
		return work();
	} finally {
		try {
			unlinkSync(lock);
		} catch {
			// Already gone: a stale-lock sweep by another process is the only way, and it changes nothing here.
		}
	}
}

function writeDurably(file: string, data: string): void {
	const handle = openSync(file, "wx", 0o644);
	try {
		writeSync(handle, data);
		fsyncSync(handle);
	} finally {
		closeSync(handle);
	}
}

/** Fault injection for the package tests; unset in every real session. */
function fault(point: string): void {
	if (process.env.WTFP_DESK_TEST_FAULT === point) throw new Error(`injected fault at ${point}`);
}

interface PendingWrite {
	uri: string;
	file: string;
	text: string;
	sha256: string;
	revision: number | null;
}

interface JournalEntry {
	file: string;
	staging: string;
	sha256: string;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const STAGING = new RegExp(`\\.${UUID}\\.partial$`, "u");

/** Whether a journal entry is one `commit` could have written: a record file and its own staged copy. */
function journaled(entry: unknown): entry is JournalEntry {
	if (entry === null || typeof entry !== "object") return false;
	const { file, staging, sha256: digest } = entry as Json;
	return (
		typeof file === "string" &&
		RECORD_URIS.some((route) => route.filePattern.test(file)) &&
		typeof staging === "string" &&
		new RegExp(`^${file.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\.${UUID}\\.partial$`, "u").test(staging) &&
		typeof digest === "string" &&
		/^[a-f0-9]{64}$/u.test(digest)
	);
}

/**
 * A failure after the commit point. The write is in place, or the journal
 * finishes it, so it must never be reported as not written. `pending` says
 * recovery still has to finish it.
 */
class AfterCommit extends Error {
	readonly pending: boolean;
	constructor(message: string, pending: boolean) {
		super(message);
		this.pending = pending;
	}
}

/** What a failed write tells the agent: before the commit point nothing changed; after it, the write stands. */
function failure(refused: string, error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	if (error instanceof AfterCommit)
		return error.pending
			? `Committed; recovery pending: ${message}. The next desk write or /ext:wtfp:validate completes it.`
			: `Committed, but ${message}`;
	return `${refused}: ${message}`;
}

function stagingFiles(workspace: string, relative = ".planning"): string[] {
	const directory = contained(workspace, relative);
	if (directory === null || !existsSync(directory) || !lstatSync(directory).isDirectory()) return [];
	const out: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const child = path.posix.join(relative, entry.name);
		if (entry.isDirectory() && entry.name !== "archives") out.push(...stagingFiles(workspace, child));
		else if (entry.isFile() && STAGING.test(entry.name)) out.push(child);
	}
	return out;
}

/**
 * Finishes or discards an interrupted commit; call with the lock held. A
 * journal exists only after every staged file was durable, so finishing it is
 * always safe. Staged files without a journal never became visible and are
 * removed. Returns what it did, or null when there was nothing to do.
 */
function recover(workspace: string): string | null {
	const journal = path.join(workspace, JOURNAL);
	if (!existsSync(journal)) {
		const orphans = stagingFiles(workspace);
		for (const orphan of orphans) unlinkSync(path.join(workspace, orphan));
		return orphans.length > 0 ? `Removed ${orphans.length} staged file${orphans.length === 1 ? "" : "s"} from a write that never committed.` : null;
	}
	let entries: JournalEntry[];
	try {
		const parsed = JSON.parse(readFileSync(journal, "utf8")) as { entries?: JournalEntry[] };
		entries = Array.isArray(parsed.entries) ? parsed.entries : [];
	} catch {
		const aside = `${JOURNAL}.unreadable-${randomUUID()}`;
		renameSync(journal, path.join(workspace, aside));
		return `Set aside an unreadable journal as ${aside}; check the records it may have touched before continuing.`;
	}
	// The desk journals only its own record writes, each staged beside its target; anything else did not come from a commit.
	const foreign = entries.filter((entry) => !journaled(entry));
	if (foreign.length > 0) {
		const aside = `${JOURNAL}.untrusted-${randomUUID()}`;
		renameSync(journal, path.join(workspace, aside));
		return `Set aside a journal naming writes the desk never journals (${foreign.map((entry) => String((entry as Partial<JournalEntry>)?.file)).join(", ")}) as ${aside}; nothing it named was moved.`;
	}
	const finished: string[] = [];
	const drifted: string[] = [];
	for (const entry of entries) {
		const target = contained(workspace, entry.file);
		const staging = contained(workspace, entry.staging);
		if (target === null || staging === null) {
			drifted.push(entry.file);
			continue;
		}
		if (existsSync(staging)) {
			renameSync(staging, target);
			finished.push(entry.file);
		}
		const bytes = readBytes(workspace, entry.file);
		if (bytes === null || sha256(bytes) !== entry.sha256) drifted.push(entry.file);
	}
	unlinkSync(journal);
	for (const orphan of stagingFiles(workspace)) unlinkSync(path.join(workspace, orphan));
	return [
		`Completed an interrupted write of ${entries.map((entry) => entry.file).join(", ")}${finished.length === 0 ? " (every file had already landed)" : ""}.`,
		...(drifted.length > 0 ? [`These no longer hold what that write committed: ${drifted.join(", ")}; read them before relying on them.`] : []),
	].join(" ");
}

/**
 * Makes every write visible or, before the commit point, none. One write is
 * a staged file renamed over its target. Several are staged, then a journal
 * naming all of them is written, which is the commit point, then each is
 * renamed into place and the journal removed. Call with the lock held.
 */
function commit(workspace: string, writes: PendingWrite[]): void {
	const staged: JournalEntry[] = [];
	try {
		for (const write of writes) {
			const target = contained(workspace, write.file);
			if (target === null) throw new Error(`refusing to write ${write.file} through a symbolic link`);
			mkdirSync(path.dirname(target), { recursive: true });
			if (contained(workspace, write.file) === null) throw new Error(`refusing to write ${write.file} through a symbolic link`);
			const staging = `${write.file}.${randomUUID()}.partial`;
			writeDurably(path.join(workspace, staging), write.text);
			staged.push({ file: write.file, staging, sha256: write.sha256 });
		}
		fault("before-commit");
		if (staged.length > 1) {
			const journal = `${JOURNAL}.${randomUUID()}.partial`;
			writeDurably(path.join(workspace, journal), `${JSON.stringify({ schema: "wtfp.clio-journal/v1", at: timestamp(), entries: staged }, null, 2)}\n`);
			renameSync(path.join(workspace, journal), path.join(workspace, JOURNAL));
		}
	} catch (error) {
		for (const entry of staged) {
			try {
				unlinkSync(path.join(workspace, entry.staging));
			} catch {
				// Already removed.
			}
		}
		throw error;
	}
	if (staged.length === 1) {
		// One write commits by its rename; a failed rename changed nothing.
		const [entry] = staged as [JournalEntry];
		try {
			renameSync(path.join(workspace, entry.staging), path.join(workspace, entry.file));
		} catch (error) {
			try {
				unlinkSync(path.join(workspace, entry.staging));
			} catch {
				// Already removed.
			}
			throw error;
		}
	} else {
		// Committed: a failure from here leaves the journal for recover() to finish.
		try {
			staged.forEach((entry, index) => {
				if (index > 0) fault("between-renames");
				renameSync(path.join(workspace, entry.staging), path.join(workspace, entry.file));
			});
			unlinkSync(path.join(workspace, JOURNAL));
		} catch (error) {
			throw new AfterCommit(error instanceof Error ? error.message : String(error), true);
		}
	}
	// Stands in for another process changing a file between the rename and the readback.
	if (process.env.WTFP_DESK_TEST_FAULT === "tamper-after-rename" && staged[0]) appendFileSync(path.join(workspace, staged[0].file), " ");
	for (const entry of staged) {
		const back = readBytes(workspace, entry.file);
		if (back === null || sha256(back) !== entry.sha256)
			throw new AfterCommit(`readback of ${entry.file} differs from what was written; another writer changed it after the commit, so read it again before relying on it`, false);
	}
}

// --- portable record writes --------------------------------------------------

const IDENTIFIER = "[a-z][a-z0-9]*(?:-[a-z0-9]+)*";
/** The adapter mapping of project/README.md: logical URI to record type and project-relative file. */
const RECORD_URIS: ReadonlyArray<{ pattern: RegExp; type: string; file: (id: string) => string; filePattern: RegExp }> = [
	{ pattern: /^project:\/\/manifest$/u, type: "manifest", file: () => ".planning/project.json", filePattern: /^\.planning\/project\.json$/u },
	{ pattern: /^project:\/\/config$/u, type: "config", file: () => ".planning/config.json", filePattern: /^\.planning\/config\.json$/u },
	{ pattern: /^project:\/\/state$/u, type: "state", file: () => ".planning/state.json", filePattern: /^\.planning\/state\.json$/u },
	{ pattern: /^project:\/\/decisions$/u, type: "decisions", file: () => ".planning/decisions.json", filePattern: /^\.planning\/decisions\.json$/u },
	{
		pattern: /^project:\/\/structure\/outline$/u,
		type: "outline",
		file: () => ".planning/structure/outline.json",
		filePattern: /^\.planning\/structure\/outline\.json$/u,
	},
	...(
		[
			["section", "sections", (id: string) => `.planning/sections/${id}/section.json`, `^\\.planning/sections/${IDENTIFIER}/section\\.json$`],
			["source", "sources", (id: string) => `.planning/sources/${id}.json`, `^\\.planning/sources/${IDENTIFIER}\\.json$`],
			["evidence", "evidence", (id: string) => `.planning/evidence/${id}.json`, `^\\.planning/evidence/${IDENTIFIER}\\.json$`],
			["checkpoint", "checkpoints", (id: string) => `.planning/checkpoints/${id}.json`, `^\\.planning/checkpoints/${IDENTIFIER}\\.json$`],
			["validation", "validations", (id: string) => `.planning/validations/${id}.json`, `^\\.planning/validations/${IDENTIFIER}\\.json$`],
			["interaction", "interactions", (id: string) => `.planning/interactions/${id}.json`, `^\\.planning/interactions/${IDENTIFIER}\\.json$`],
		] as const
	).map(([type, collection, file, filePattern]) => ({
		pattern: new RegExp(`^project://${collection}/(${IDENTIFIER})$`, "u"),
		type,
		file,
		filePattern: new RegExp(filePattern, "u"),
	})),
];
const REVISIONED = new Set(["state", "outline", "decisions"]);
const STAMPED = new Set(["state", "outline", "decisions", "manifest", "section"]);

interface RecordWrite {
	uri: string;
	record: Json;
	expect_revision?: number;
	expect_sha256?: string;
}

/** Interaction modes from the least to the most the workflow asks the author. */
const MODES = ["autonomous", "standard", "guided"];

const list = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);

/**
 * Changes that weaken an author's control or what the desk holds, each as the
 * line the author is shown before it may land: a gate, check or safeguard
 * turned off, a less interactive mode, a locked decision changed, a section
 * dropped from the outline or no longer researched, a manuscript re-pointed
 * away from the file its gates hold, plan history rewritten, or a claim
 * released from needing evidence.
 */
function weakening(type: string, prior: Json | null, next: Json): string[] {
	const changes: string[] = [];
	if (type === "config") {
		for (const group of ["gates", "workflow", "safety"]) {
			const before = (prior?.[group] ?? {}) as Json;
			for (const [key, value] of Object.entries((next[group] ?? {}) as Json))
				if (value === false && before[key] !== false) changes.push(`${group}.${key}: on → off`);
		}
		const from = prior ? text(prior.interaction_mode, "standard") : null;
		const to = text(next.interaction_mode, "standard");
		if (from === null ? to === "autonomous" : MODES.indexOf(to) < MODES.indexOf(from)) changes.push(`interaction_mode: ${from ?? "unset"} → ${to}`);
	}
	if (type === "outline" && prior) {
		const after = new Map(list(next.sections).map((entry) => [entry.id, entry]));
		for (const entry of list(prior.sections)) {
			const kept = after.get(entry.id);
			if (!kept) changes.push(`removes ${String(entry.id)} from the outline, so the desk no longer holds its manuscript`);
			else if ((entry.research as Json | undefined)?.required === true && (kept.research as Json | undefined)?.required !== true)
				changes.push(`${String(entry.id)}: research.required on → off, so its claims may be drafted without verified evidence`);
		}
	}
	if (type === "section" && prior) {
		const id = text(next.id);
		const before = (prior.artifacts ?? {}) as Json;
		const after = (next.artifacts ?? {}) as Json;
		const mapped = (artifacts: Json): string => text(artifacts.manuscript, `project://paper/${id}`);
		if (mapped(before) !== mapped(after))
			changes.push(`${id}: manuscript ${mapped(before)} → ${mapped(after)}, so the desk no longer holds the old file`);
		const plansBefore = Array.isArray(before.plans) ? (before.plans as unknown[]) : [];
		const plansAfter = Array.isArray(after.plans) ? (after.plans as unknown[]) : [];
		if (plansBefore.some((uri, index) => plansAfter[index] !== uri))
			changes.push(`${id}: rewrites the plan history (${plansBefore.join(", ") || "none"} → ${plansAfter.join(", ") || "none"}); plans are only ever appended`);
		const claims = new Map(list(next.claims).map((claim) => [claim.id, claim]));
		for (const claim of list(prior.claims))
			if (claim.evidence_required === true && claims.get(claim.id)?.evidence_required !== true)
				changes.push(`${id}: claim ${String(claim.id)} no longer requires evidence`);
	}
	if (type === "decisions" && prior) {
		const after = new Map((Array.isArray(next.items) ? (next.items as Json[]) : []).map((item) => [item.id, item]));
		for (const item of Array.isArray(prior.items) ? (prior.items as Json[]) : []) {
			if (item.authority !== "author" || item.disposition !== "locked") continue;
			const changed = after.get(item.id);
			if (!changed) changes.push(`removes the author's locked decision ${String(item.id)}: ${text(item.statement)}`);
			else if (canonical(changed) !== canonical(item))
				changes.push(`changes the author's locked decision ${String(item.id)} (${text(item.disposition as string)} → ${text(changed.disposition as string)}): ${text(changed.statement)}`);
		}
	}
	return changes;
}

/**
 * Why the agent may not make this checkpoint change; null when it may.
 * `superseded` says whether the checkpoint asks about a plan that is no longer
 * its section's current plan, so retiring it can authorize nothing.
 */
function checkpointRefusal(prior: Json | null, next: Json, superseded: boolean): string | null {
	const snapshot = next.kind === "state-snapshot";
	const answered = (status: unknown): boolean => status === "resolved" || status === "waived";
	if (prior && prior.kind !== next.kind) return "a checkpoint's kind cannot change";
	if (snapshot) return null;
	if (prior && answered(prior.status)) return "it is answered, so its record is immutable; create a new checkpoint to ask again";
	if (next.status === "pending" && next.resolution !== undefined) return "a pending checkpoint carries no resolution";
	if (answered(next.status)) {
		if ((next.resolution as Json | undefined)?.resolved_by === "author")
			return "only the author's answer at the desk resolves it as the author's; call extension_wtfp__gate with its id";
		if (next.blocking === true) return "a blocking checkpoint is resolved only by the author; call extension_wtfp__gate with its id";
	}
	if (prior && prior.status === "pending" && prior.blocking === true) {
		if (next.blocking !== true) return "a pending blocking checkpoint cannot be made nonblocking";
		if (next.scope_uri !== prior.scope_uri) return "a pending blocking checkpoint cannot change scope";
		if (next.status === "expired" && !superseded)
			return "a pending blocking checkpoint cannot be expired by the agent; the author can waive it at the desk";
	}
	return null;
}

/** Whether an armed action's contract declares this write. */
function declares(armed: Armed, uri: string, mode: string): boolean {
	return armed.produces.some((output) => output.mode === mode && patternMatches(output.uri, uri, armed.section));
}

function patternMatches(pattern: string, uri: string, section: string | null): boolean {
	const expression = pattern
		.split(/(\{[a-z]+\})/u)
		.map((part) => {
			if (part === "{section}" && section) return section.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
			if (part === "{artifact}") return "[A-Za-z0-9._~-]+(?:/[A-Za-z0-9._~-]+)*";
			if (/^\{[a-z]+\}$/u.test(part)) return IDENTIFIER;
			return part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
		})
		.join("");
	return new RegExp(`^${expression}$`, "u").test(uri);
}

interface Prepared {
	write: PendingWrite;
	type: string;
	prior: Json | null;
	priorSha: string | null;
	confirm: string[];
}

/**
 * Checks one record write against everything the desk enforces and returns
 * the bytes to commit. Call with the lock held. `origin` is "agent" for a
 * model's tool call and "desk" for the desk's own writes of the author's
 * answers and its derived counts.
 */
function prepare(workspace: string, input: RecordWrite, origin: "agent" | "desk", armed: Armed | null): Prepared {
	const { uri } = input;
	const record = input.record;
	if (record === null || typeof record !== "object" || Array.isArray(record)) throw new Error(`${uri}: record must be a JSON object`);
	const route = RECORD_URIS.find((entry) => entry.pattern.test(uri));
	if (!route) throw new Error(`${uri} is not a logical record URI this adapter maps`);
	if (route.type === "interaction" && origin === "agent")
		throw new Error(`${uri}: only the desk records an author's answer; ask with extension_wtfp__gate`);
	const id = route.pattern.exec(uri)?.[1] ?? "";
	if (record.schema !== `wtfp.project.${route.type}/v1`) throw new Error(`${uri} holds wtfp.project.${route.type}/v1 records`);
	if (id && record.id !== id) throw new Error(`${uri} must hold the record whose id is ${id}`);
	const file = route.file(id);
	if (contained(workspace, file) === null) throw new Error(`refusing to write ${uri} through a symbolic link or outside the project`);
	const manifest = readRecord(workspace, ".planning/project.json");
	const projectId = route.type === "manifest" ? record.id : record.project_id;
	if (manifest && typeof manifest.id === "string" && projectId !== manifest.id)
		throw new Error(`${uri} belongs to project ${String(projectId)}, not ${manifest.id}`);
	const bytes = readBytes(workspace, file);
	if (bytes === null && existsSync(path.join(workspace, file))) throw new Error(`${file} is not a regular file the desk can replace`);
	const priorSha = bytes === null ? null : sha256(bytes);
	let prior: Json | null = null;
	if (bytes !== null) {
		try {
			const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
			prior = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Json) : null;
		} catch {
			prior = null;
		}
	}
	const priorRevision = typeof prior?.revision === "number" ? prior.revision : null;
	const expectation = input.expect_revision !== undefined || input.expect_sha256 !== undefined;
	if (bytes === null) {
		if (expectation) throw new Error(`${uri} no longer exists; read the project again before writing`);
	} else if (!expectation) {
		throw new Error(
			`${uri} already exists; read it with extension_wtfp__read_record and pass ${REVISIONED.has(route.type) ? "the revision you read as expect_revision" : "the sha256 you read as expect_sha256"} so a newer change is never overwritten`,
		);
	} else {
		const byRevision = input.expect_revision !== undefined && REVISIONED.has(route.type) && input.expect_revision === priorRevision;
		const bySha = input.expect_sha256 !== undefined && input.expect_sha256 === priorSha;
		if (!byRevision && !bySha)
			throw new Error(
				REVISIONED.has(route.type) && input.expect_revision !== undefined
					? `${uri} is at revision ${String(priorRevision)}, not ${input.expect_revision}; read it again before writing`
					: `${uri} changed since it was read; read it again before writing`,
			);
	}
	if (origin === "agent" && armed && !declares(armed, uri, bytes === null ? "create" : "update"))
		throw new Error(`${armed.action} does not declare ${bytes === null ? "creating" : "updating"} ${uri}; record what remains as a handoff instead`);
	if (origin === "agent" && route.type === "checkpoint") {
		const plan = new RegExp(`^project://sections/(${IDENTIFIER})/plans/${IDENTIFIER}$`, "u").exec(text(prior?.scope_uri));
		const plans = plan ? ((readRecord(workspace, `.planning/sections/${plan[1]}/section.json`)?.artifacts as Json | undefined)?.plans as unknown[] | undefined) : undefined;
		const superseded = plan !== null && Array.isArray(plans) && plans.length > 0 && plans[plans.length - 1] !== prior?.scope_uri;
		const refusal = checkpointRefusal(prior, record, superseded);
		if (refusal) throw new Error(`${uri}: ${refusal}`);
	}
	const next: Json = { ...record };
	let revision: number | null = null;
	if (REVISIONED.has(route.type)) {
		revision = priorRevision === null ? (typeof record.revision === "number" ? record.revision : 0) : priorRevision + 1;
		next.revision = revision;
	}
	if (STAMPED.has(route.type)) next.updated_at = timestamp();
	const errors = validateRecord(next);
	if (errors.length > 0) throw new Error(`${uri} would not validate: ${errors[0]}`);
	const serialized = `${JSON.stringify(next, null, 2)}\n`;
	return {
		write: { uri, file, text: serialized, sha256: sha256(serialized), revision },
		type: route.type,
		prior,
		priorSha,
		confirm: origin === "agent" ? weakening(route.type, prior, next) : [],
	};
}

function normalizeWrites(input: Json): RecordWrite[] {
	if (Array.isArray(input.writes)) {
		if (input.uri !== undefined || input.record !== undefined) throw new Error("pass either uri and record or writes, not both");
		if (input.writes.length === 0 || input.writes.length > 16) throw new Error("writes holds one to sixteen records");
		return input.writes as RecordWrite[];
	}
	if (typeof input.uri !== "string") throw new Error("uri is required");
	return [{ uri: input.uri, record: input.record as Json, expect_revision: input.expect_revision as number | undefined, expect_sha256: input.expect_sha256 as string | undefined }];
}

// --- views -------------------------------------------------------------------

interface Next {
	command: string | null;
	reason: string;
}

/** One rung of the ladder; a step only the absent plugin can run says so instead of naming it. */
function step(served: ServedPlugin, action: string, args: string, reason: string): Next {
	const command = commandFor(served, action, args);
	return command ? { command, reason } : { command: null, reason: `${reason} Its next step, ${action}, needs the WTF-P plugin.` };
}

function openGates(desk: Desk): Checkpoint[] {
	return desk.checkpoints.filter((checkpoint) => holds(checkpoint));
}

function nextAction(desk: Desk): Next {
	const served = desk.served;
	if (!desk.present)
		return desk.paperExists
			? step(served, "map-project", "", "A manuscript exists but no WTF-P project records do.")
			: step(served, "new-paper", "", "Start a project: brief, decisions and outline.");
	if (desk.journal) return { command: "/ext:wtfp:validate", reason: "A record write was interrupted; validating completes it." };
	const gate = openGates(desk)[0];
	if (gate)
		return step(
			served,
			"check-todos",
			"",
			gate.trust === "pending" ? `Gate waiting on you: ${gate.request}` : `Confirm the recorded answer to ${gate.id}: ${gate.request}`,
		);
	if (desk.sections.length === 0) return step(served, "create-outline", "", "No outline yet.");
	const complete = new Set(desk.sections.filter((section) => section.status === "complete").map((section) => section.id));
	const ordered = [...desk.sections].sort((a, b) => a.wave - b.wave);
	for (const section of ordered) {
		if (section.status === "complete") continue;
		if (!section.dependsOn.every((dep) => complete.has(dep)) && section.status === "not-started") continue;
		return sectionNext(served, section);
	}
	if (desk.phase === "delivered") return { command: null, reason: "Delivered." };
	if (desk.phase === "ready") return step(served, "submit-milestone", "", "Every section is complete and audited.");
	return step(served, "audit-milestone", "", "Every section is complete; audit before delivery.");
}

/** The next step for one section, by the same ladder the band follows. */
function sectionNext(served: ServedPlugin, section: SectionRow): Next {
	const id = section.id;
	if (section.gates.length > 0) return step(served, "check-todos", "", `${section.title} waits on a gate.`);
	switch (section.status) {
		case "complete":
			return step(served, "review-section", id, `${section.title} is complete; review it again if it changed.`);
		case "blocked":
			return step(served, "check-todos", "", `${section.title} is blocked.`);
		case "reviewing":
			return step(served, "review-section", id, `${section.title} is drafted and waits for review.`);
		case "writing":
		case "planned":
			if (section.research.required && section.unsupported.length > 0)
				return step(served, "research-gap", id, `${section.title} has required claims without verified evidence.`);
			if (!planReady(section.plan))
				return step(served, "plan-section", id, `${section.title} cannot be drafted: ${section.plan.reason}.`);
			return step(served, "write-section", id, `${section.title} has an approved plan.`);
		default:
			if (!section.stages.discuss) return step(served, "discuss-section", id, `Settle what ${section.title} must argue.`);
			if (section.research.required && (!section.research.present || section.unsupported.length > 0))
				return step(served, "research-gap", id, `${section.title} needs verified evidence first.`);
			return step(served, "plan-section", id, `${section.title} is ready to plan.`);
	}
}

function meter(words: number, target: number, cells = 8): string {
	if (target <= 0) return "";
	const filled = Math.max(0, Math.min(cells, Math.round((words / target) * cells)));
	return `${"▰".repeat(filled)}${"▱".repeat(cells - filled)}`;
}

/** Within 15 percent of the target, by the same count the meter draws. */
function tolerance(words: number, target: number): ViewTone {
	if (target <= 0 || words === 0) return "muted";
	const delta = Math.abs(words - target) / target;
	return delta <= 0.15 ? "positive" : words > target ? "warning" : "neutral";
}

function stageStrip(section: SectionRow): string {
	const active = (stage: keyof SectionRow["stages"]): boolean =>
		(stage === "discuss" && section.status === "researching") ||
		(stage === "write" && section.status === "writing") ||
		(stage === "review" && section.status === "reviewing");
	const mark = (stage: keyof SectionRow["stages"], letter: string): string =>
		`${letter}${section.stages[stage] && !active(stage) ? "✓" : active(stage) ? "▸" : "·"}`;
	return `${mark("discuss", "D")} ${mark("plan", "P")} ${mark("write", "W")} ${mark("review", "R")}`;
}

function daysLeft(deadline: string | null): string | null {
	if (!deadline) return null;
	const due = Date.parse(`${deadline}T23:59:59Z`);
	if (Number.isNaN(due)) return null;
	const days = Math.ceil((due - Date.now()) / 86_400_000);
	return days < 0 ? `${-days} days past ${deadline}` : days === 0 ? `due today (${deadline})` : `${days} days to ${deadline}`;
}

function totalWords(desk: Desk): number {
	return desk.sections.reduce((sum, section) => sum + section.words, 0);
}

function header(desk: Desk): View {
	if (!desk.present)
		return {
			t: "box",
			dir: "col",
			children: [
				{ t: "art", lines: WORDMARK, tone: "brand" },
				{ t: "text", text: "Write The F***ing Paper · no project here yet", tone: "muted" },
			],
		};
	const facts = [desk.documentType.replaceAll("-", " "), desk.venue, daysLeft(desk.deadline)].filter(
		(fact): fact is string => typeof fact === "string",
	);
	const phaseIndex = PHASES.indexOf(desk.phase as (typeof PHASES)[number]);
	return {
		t: "box",
		dir: "col",
		children: [
			{
				t: "box",
				dir: "row",
				gap: 2,
				children: [
					{ t: "box", dir: "col", width: 42, children: [{ t: "art", lines: WORDMARK, tone: "brand" }] },
					{
						t: "box",
						dir: "col",
						grow: 1,
						children: [
							{ t: "text", text: desk.title, bold: true, wrap: "wrap" },
							{ t: "text", text: facts.join(" · "), tone: "info" },
							...(desk.argument ? [{ t: "text", text: desk.argument, tone: "muted", wrap: "wrap" } as View] : []),
						],
					},
				],
			},
			{
				t: "steps",
				items: PHASES.map((phase, index) => ({
					label: phase,
					state:
						desk.status === "blocked" && index === phaseIndex
							? "blocked"
							: index < phaseIndex || desk.phase === "delivered"
								? "done"
								: index === phaseIndex
									? "active"
									: "todo",
				})),
			},
		],
	};
}

function planBadge(section: SectionRow): { text: string; tone: ViewTone } | null {
	switch (section.plan.state) {
		case "approved":
			return { text: "plan ✓", tone: "positive" };
		case "policy":
			return { text: "plan", tone: "info" };
		case "changed":
			return { text: "plan changed", tone: "warning" };
		case "declined":
			return { text: "plan declined", tone: "warning" };
		case "unconfirmed":
			return { text: "plan unconfirmed", tone: "warning" };
		case "awaiting":
			return section.status === "not-started" ? null : { text: "plan awaits you", tone: "warning" };
		case "missing":
			return { text: "plan missing", tone: "error" };
		default:
			return null;
	}
}

function board(desk: Desk): View {
	if (desk.sections.length === 0)
		return { t: "text", text: `No outline yet. ${nextAction(desk).command ?? ""}`.trim(), tone: "muted" };
	const waves = [...new Set(desk.sections.map((section) => section.wave))].sort((a, b) => a - b).slice(0, 8);
	return {
		t: "board",
		action: "section",
		columns: waves.map((wave) => {
			const cards = desk.sections.filter((section) => section.wave === wave);
			const done = cards.filter((section) => section.status === "complete").length;
			return {
				title: `Wave ${wave} · ${done}/${cards.length}`,
				tone: done === cards.length ? "positive" : "info",
				cards: cards.slice(0, 60).map((section) => {
					const plan = planBadge(section);
					return {
						key: section.id,
						title: section.title,
						detail: [
							stageStrip(section),
							section.target > 0 ? `${meter(section.words, section.target)} ${section.words}/${section.target}w` : `${section.words}w`,
							section.claims.total > 0
								? `${section.claims.verified}/${section.claims.total} claims${section.claims.unsupported > 0 ? `, ${section.claims.unsupported} unsupported` : ""}`
								: "",
						]
							.filter(Boolean)
							.join("  "),
						badges: [
							{
								text: section.status,
								tone: (section.status === "complete"
									? "positive"
									: section.status === "blocked"
										? "error"
										: section.status === "not-started"
											? "muted"
											: "info") as ViewTone,
							},
							...(plan ? [plan] : []),
							...(section.gates.length > 0 ? [{ text: `GATE ×${section.gates.length}`, tone: "warning" as ViewTone }] : []),
							...(section.words > 0 && section.target > 0
								? [{ text: `${Math.round((section.words / section.target) * 100)}%`, tone: tolerance(section.words, section.target) }]
								: []),
						],
					};
				}),
			};
		}),
	};
}

function agentLabel(agentId: string): string {
	const agent = SKIN.agents?.[agentId];
	return agent ? `${agent.glyph ?? ""} ${agent.label ?? agentId}`.trim() : agentId;
}

function islands(desk: Desk, running: Record<string, { agentId: string; at: number }>): ExtensionIsland[] {
	const out: ExtensionIsland[] = [];
	const gate = openGates(desk)[0];
	if (gate)
		out.push({
			key: "gate",
			title: "⚑ Gate",
			meta: gate.trust === "pending" ? gate.kind : "unconfirmed",
			tone: "warning",
			view: {
				t: "box",
				dir: "col",
				children: [
					{ t: "text", text: gate.request, wrap: "wrap", bold: true },
					...(gate.options && gate.options.length > 0
						? [
								{
									t: "list",
									items: gate.options.slice(0, 6).map((option) => ({
										key: option.id,
										label: option.label,
										...(option.implication ? { detail: option.implication } : {}),
										mark: "◇",
									})),
								} as View,
							]
						: []),
					{
						t: "text",
						text:
							gate.trust === "pending"
								? "Leader c answers it; only your answer resolves it."
								: "Recorded as answered, but not by you at this desk. Leader c confirms it.",
						tone: "muted",
					},
				],
			},
		});
	const verified = desk.sources.verified ?? 0;
	const provisional = desk.sources.provisional ?? 0;
	const lost = (desk.sources.unavailable ?? 0) + (desk.sources.retracted ?? 0);
	const unsupported = desk.sections.reduce((sum, section) => sum + section.claims.unsupported, 0);
	if (desk.present)
		out.push({
			key: "evidence",
			title: "❝ Evidence ledger",
			tone: unsupported > 0 || lost > 0 ? "warning" : "info",
			view: {
				t: "kv",
				items: [
					{ label: "sources verified", value: String(verified), tone: verified > 0 ? "positive" : "muted" },
					{ label: "provisional", value: String(provisional), tone: provisional > 0 ? "warning" : "muted" },
					...(lost > 0 ? [{ label: "unavailable or retracted", value: String(lost), tone: "error" as ViewTone }] : []),
					{ label: "evidence items", value: String(desk.evidence) },
					{ label: "required claims without support", value: String(unsupported), tone: unsupported > 0 ? "warning" : "positive" },
				],
			},
		});
	for (const [runId, run] of Object.entries(running).slice(0, 2))
		out.push({
			key: `run-${runId}`,
			title: agentLabel(run.agentId),
			meta: `${Math.max(0, Math.round((Date.now() - run.at) / 1000))}s`,
			tone: "info",
			view: { t: "text", text: `working on ${desk.title}`, tone: "muted" },
		});
	if (desk.invalid.length > 0)
		out.push({
			key: "schema",
			title: "✗ Schema",
			meta: `${desk.invalid.length} record${desk.invalid.length === 1 ? "" : "s"}`,
			tone: "error",
			view: {
				t: "list",
				items: desk.invalid.slice(0, 4).map((record) => ({
					key: record.file,
					label: record.file.replace(/^\.planning\//u, ""),
					detail: record.errors[0] ?? "",
					tone: "error" as ViewTone,
				})),
			},
		});
	return out.slice(0, 4);
}

function footer(desk: Desk): View {
	if (!desk.present) {
		const start = commandFor(desk.served, "new-paper");
		return {
			t: "text",
			text: `WTF-P · no .planning here · ${start ? `${start} starts one` : "the WTF-P plugin's new-paper starts one"}`,
			tone: "muted",
		};
	}
	const complete = desk.sections.filter((section) => section.status === "complete").length;
	const issues = (["blocker", "error", "warning"] as const)
		.filter((severity) => desk.issues[severity] > 0)
		.map((severity) => `${desk.issues[severity]} ${severity}${desk.issues[severity] === 1 ? "" : "s"}`);
	const next = nextAction(desk).command;
	return {
		t: "text",
		tone: "muted",
		text: [
			`${totalWords(desk).toLocaleString("en-US")}/${desk.targetWords.toLocaleString("en-US")} words`,
			`${complete}/${desk.sections.length} sections`,
			issues.length > 0 ? `issues ${issues.join(", ")}` : "no open issues",
			desk.invalid.length > 0 ? `schema ✗ ${desk.invalid.length}` : "schema ✓",
			next ? `next ${next}` : "",
		]
			.filter(Boolean)
			.join(" · "),
	};
}

function rail(desk: Desk): View {
	return {
		t: "text",
		text: desk.present
			? `WTF-P ◆ ${desk.phase} ◆ ${totalWords(desk).toLocaleString("en-US")}/${desk.targetWords.toLocaleString("en-US")}`
			: "WTF-P ◆ no project",
		tone: "brand",
		bold: true,
	};
}

function band(desk: Desk): View {
	const next = nextAction(desk);
	return {
		t: "box",
		dir: "row",
		gap: 2,
		children: [
			{ t: "box", dir: "col", grow: 1, children: [{ t: "text", text: `✎ ${next.reason}`, tone: "info" }] },
			...(next.command
				? [{ t: "actions", items: [{ id: "next", label: `Fill ${next.command}`, hotkey: "f", primary: true }] } as View]
				: []),
		],
	};
}

// --- session state -----------------------------------------------------------

type Running = Record<string, { agentId: string; at: number }>;

async function running(ctx: ExtensionContextV2): Promise<Running> {
	return (await ctx.state.get<Running>("running")).value ?? {};
}

async function deskFor(ctx: ExtensionContextV2): Promise<Desk> {
	const desk = loadDesk(ctx.snapshot.workspace, await storedKey(ctx, false));
	desk.invalid = (await ctx.state.get<Desk["invalid"]>("invalid")).value ?? [];
	desk.served = ctx.snapshot.plugin ?? null;
	return desk;
}

async function picture(
	ctx: ExtensionContextV2,
	desk?: Desk,
	active: string | null = ctx.snapshot.activeWorkspace,
): Promise<Omit<ExtensionOutputV2, "text">> {
	const current = desk ?? (await deskFor(ctx));
	if (!current.present && !current.paperExists && active === null) return { status: null, band: null, islands: null };
	return {
		status: current.present
			? {
					text: `WTF-P · ${current.phase} · ${totalWords(current).toLocaleString("en-US")}/${current.targetWords.toLocaleString("en-US")}w`,
					tone: openGates(current).length > 0 || current.journal ? "warning" : "neutral",
				}
			: null,
		band: band(current),
		regions: { header: header(current), board: board(current), rail: rail(current), footer: footer(current) },
		islands: islands(current, await running(ctx)),
	};
}

/** Validate the named records; a newly invalid record gets one card naming it and the field. */
async function revalidate(ctx: ExtensionContextV2, files: string[]): Promise<View | undefined> {
	const workspace = ctx.snapshot.workspace;
	const before = (await ctx.state.get<Desk["invalid"]>("invalid")).value ?? [];
	const current = new Map(before.map((record) => [record.file, record]));
	const fresh: Desk["invalid"] = [];
	for (const file of files) {
		const errors = existsSync(path.join(workspace, file)) ? validateFile(workspace, file) : [];
		const prior = current.get(file);
		if (errors.length === 0) current.delete(file);
		else {
			current.set(file, { file, errors: errors.slice(0, 5) });
			if (!prior || prior.errors[0] !== errors[0]) fresh.push({ file, errors });
		}
	}
	await ctx.state.set("invalid", [...current.values()]);
	if (fresh.length === 0) return undefined;
	return {
		t: "box",
		dir: "col",
		border: "round",
		title: "WTF-P · schema violation",
		children: fresh.slice(0, 4).flatMap((record) => [
			{ t: "text", text: record.file, bold: true, tone: "error" } as View,
			...record.errors.slice(0, 3).map((error) => ({ t: "text", text: `  ${error}`, tone: "muted", wrap: "wrap" }) as View),
		]),
	};
}

// --- gates -------------------------------------------------------------------

const KEEP = "__keep";
const RESOLVE = "__resolve";
const WAIVE = "__waive";

/** What the author was shown, kept until the answer arrives so a changed question cannot take an old answer. */
interface Asked {
	checkpoint: string;
	workspace: string;
	project: string | null;
	content_sha256: string;
	options: string[];
	artifact: { uri: string; sha256: string } | null;
	asked_at: string;
	confirming: boolean;
}

/** The gates that want the author: pending ones, and blocking answers the desk never saw. */
function askable(desk: Desk, skip: readonly string[]): Checkpoint[] {
	return desk.checkpoints.filter(
		(checkpoint) =>
			checkpoint.kind !== "state-snapshot" &&
			!skip.includes(checkpoint.id) &&
			(checkpoint.status === "pending" || (checkpoint.blocking && unconfirmed(checkpoint))),
	);
}

function planGate(checkpoint: Checkpoint): boolean {
	return new RegExp(`^project://sections/${IDENTIFIER}/plans/${IDENTIFIER}$`, "u").test(checkpoint.scope_uri);
}

/**
 * The words the author sees for an option. On a plan gate the desk owns them:
 * `approve` is what authorizes drafting, so it always reads as approval and
 * nothing else does, whatever the checkpoint's own labels say.
 */
function shown(checkpoint: Checkpoint, option: { id: string; label: string; implication?: string }): { label: string; detail?: string } {
	if (planGate(checkpoint)) {
		if (option.id === APPROVE) return { label: "Approve this plan as shown", detail: "Drafting may start from exactly these plan bytes; any later change asks you again." };
		if (/approv/iu.test(option.label)) return { label: `Do not draft from this plan yet (${option.id})`, detail: "Any answer but approval leaves the plan unapproved." };
	}
	return { label: option.label, ...(option.implication ? { detail: option.implication } : {}) };
}

function choices(checkpoint: Checkpoint): Array<{ value: string; label: string; detail?: string }> {
	return checkpoint.options && checkpoint.options.length > 0
		? checkpoint.options.map((option) => ({ value: option.id, ...shown(checkpoint, option) }))
		: [
				{ value: RESOLVE, label: checkpoint.kind === "human-verify" ? "Verified" : "Done", detail: "Mark it resolved by you." },
				{ value: WAIVE, label: "Waive it", detail: "Record that you chose to skip it." },
			];
}

function subjectOf(workspace: string, desk: Desk, checkpoint: Checkpoint): { uri: string; sha256: string } | null {
	const file = artifactFile(workspace, checkpoint.scope_uri, desk.outputFormat);
	const bytes = file === null ? null : readBytes(workspace, file);
	return bytes === null ? null : { uri: checkpoint.scope_uri, sha256: sha256(bytes) };
}

async function ask(ctx: ExtensionContextV2, desk: Desk, checkpoint: Checkpoint): Promise<InterviewStep> {
	const nonce = randomBytes(6).toString("hex");
	const artifact = subjectOf(ctx.snapshot.workspace, desk, checkpoint);
	const offered = [...choices(checkpoint), { value: KEEP, label: "Keep it pending", detail: "Answer later; its writes stay blocked." }];
	const confirming = checkpoint.status !== "pending";
	await ctx.state.set(`ask:${nonce}`, {
		checkpoint: checkpoint.id,
		workspace: ctx.snapshot.workspace,
		project: desk.projectId,
		content_sha256: checkpointDigest(checkpoint),
		options: offered.map((option) => option.value),
		artifact,
		asked_at: timestamp(),
		confirming,
	} satisfies Asked);
	const recorded = checkpoint.resolution?.selected_option ?? (checkpoint.status === "waived" ? "waived" : "done");
	return {
		key: `gate.${nonce}`,
		title: confirming ? "Confirm a recorded answer" : checkpoint.blocking ? "Blocking gate" : "Pending task",
		// The question carries the request; the intro adds only what it cannot.
		intro: {
			t: "box",
			dir: "col",
			children: [
				...(checkpoint.context ? [{ t: "text", text: checkpoint.context, wrap: "wrap" } as View] : []),
				...(confirming
					? [{ t: "text", text: `Recorded as "${recorded}" by the author, but this desk did not see that answer. Confirm it or choose again.`, tone: "warning", wrap: "wrap" } as View]
					: []),
				{ t: "text", text: `${checkpoint.kind} · ${checkpoint.scope_uri.replace(/^project:\/\//u, "")} · ${checkpoint.id}`, tone: "muted" },
				...(artifact ? [{ t: "text", text: `You are answering about ${artifact.uri.replace(/^project:\/\//u, "")} as it is now (sha256 ${artifact.sha256.slice(0, 12)}).`, tone: "muted", wrap: "wrap" } as View] : []),
			],
		},
		questions: [
			{
				id: "choice",
				label: checkpoint.request.length > 120 ? `${checkpoint.request.slice(0, 117)}...` : checkpoint.request,
				kind: "single",
				options: offered,
			},
		],
	};
}

function interactionId(): string {
	return `interaction-${timestamp().replace(/[^0-9]/gu, "")}-${randomBytes(4).toString("hex")}`;
}

type AnswerResult = { kind: "recorded" | "kept" | "stale" | "refused"; text: string; checkpoint?: string };

/**
 * Records one gate answer. The answer counts only if it names an option the
 * author was offered for this exact checkpoint, project and subject, and only
 * once: the binding is consumed before anything is written.
 */
async function answer(ctx: ExtensionContextV2, stepKey: string, picked: unknown): Promise<AnswerResult> {
	const workspace = ctx.snapshot.workspace;
	const nonce = /^gate\.([a-f0-9]{12})$/u.exec(stepKey)?.[1];
	const asked = nonce ? (await ctx.state.get<Asked>(`ask:${nonce}`)).value : undefined;
	if (!nonce || !asked) return { kind: "refused", text: "That answer matches no open question; nothing was recorded." };
	await ctx.state.delete(`ask:${nonce}`);
	const key = await storedKey(ctx, true);
	if (key === null) return { kind: "refused", text: "The desk could not establish its seal key; nothing was recorded." };
	const desk = loadDesk(workspace, key);
	const checkpoint = desk.checkpoints.find((entry) => entry.id === asked.checkpoint);
	if (asked.workspace !== workspace || asked.project !== desk.projectId)
		return { kind: "refused", text: "That answer was given for another project; nothing was recorded." };
	if (typeof picked !== "string" || !asked.options.includes(picked))
		return { kind: "refused", text: "That answer is not one of the options offered; nothing was recorded." };
	if (!checkpoint) return { kind: "refused", text: `${asked.checkpoint} no longer exists; nothing was recorded.` };
	const stillAskable = checkpoint.status === "pending" || (asked.confirming && checkpoint.blocking && unconfirmed(checkpoint));
	if (!stillAskable) return { kind: "refused", text: `${checkpoint.id} is already ${checkpoint.status}; nothing was recorded.`, checkpoint: checkpoint.id };
	const now = timestamp();
	const artifact = subjectOf(workspace, desk, checkpoint);
	const base: Json = {
		schema: "wtfp.project.interaction/v1",
		id: interactionId(),
		project_id: desk.projectId,
		kind: "checkpoint-answer",
		subject_uri: `project://checkpoints/${checkpoint.id}`,
		channel: "attested-interview",
		presented: { content_sha256: asked.content_sha256, options: asked.options.filter((option) => option !== KEEP), ...(asked.artifact ? { artifact: asked.artifact } : {}) },
		asked_at: asked.asked_at,
		answered_at: now,
	};
	const stale = checkpointDigest(checkpoint) !== asked.content_sha256 || (artifact?.sha256 ?? null) !== (asked.artifact?.sha256 ?? null);
	const option = checkpoint.options?.find((entry) => entry.id === picked);
	const interaction = sealed(
		{
			...base,
			outcome: stale ? "discarded-stale" : picked === KEEP ? "kept-pending" : picked === WAIVE ? "waived" : option ? "selected" : "done",
			...(option && !stale ? { selected_option: option.id } : {}),
		},
		key,
	);
	const writes: Array<{ input: RecordWrite }> = [{ input: { uri: `project://interactions/${String(interaction.id)}`, record: interaction } }];
	if (!stale && picked !== KEEP) {
		const { file: _file, trust: _trust, answer: _answer, ...stored } = checkpoint;
		writes.push({
			input: {
				uri: `project://checkpoints/${checkpoint.id}`,
				expect_sha256: sha256(readBytes(workspace, checkpoint.file) ?? ""),
				record: {
					...stored,
					status: picked === WAIVE ? "waived" : "resolved",
					resolution: {
						resolved_by: "author",
						...(option ? { selected_option: option.id } : {}),
						summary: option
							? `The author chose "${shown(checkpoint, option).label}" at the Clio WTF-P desk.`
							: picked === WAIVE
								? "The author waived this gate at the Clio WTF-P desk."
								: "The author marked this done at the Clio WTF-P desk.",
						resolved_at: now,
					},
				},
			},
		});
		const state = readRecord(workspace, ".planning/state.json");
		const uri = `project://checkpoints/${checkpoint.id}`;
		if (state && Array.isArray(state.active_checkpoint_uris) && state.active_checkpoint_uris.includes(uri))
			writes.push({
				input: {
					uri: "project://state",
					expect_revision: typeof state.revision === "number" ? state.revision : 0,
					record: { ...state, active_checkpoint_uris: (state.active_checkpoint_uris as string[]).filter((entry) => entry !== uri) },
				},
			});
	}
	withLock(workspace, () => {
		recover(workspace);
		commit(
			workspace,
			writes.map((entry) => prepare(workspace, entry.input, "desk", null).write),
		);
	});
	if (stale)
		return {
			kind: "stale",
			text: `${checkpoint.id} or what it asks about changed while you were answering, so that answer was set aside; it is asked again as it is now.`,
			checkpoint: checkpoint.id,
		};
	if (picked === KEEP) return { kind: "kept", text: `${checkpoint.id}: kept pending`, checkpoint: checkpoint.id };
	return {
		kind: "recorded",
		text: option ? `${checkpoint.id}: ${shown(checkpoint, option).label}` : `${checkpoint.id}: ${picked === WAIVE ? "waived" : "done"}`,
		checkpoint: checkpoint.id,
	};
}

async function startGates(ctx: ExtensionContextV2): Promise<ExtensionOutputV2> {
	const desk = await deskFor(ctx);
	const pending = askable(desk, []);
	await ctx.state.set("gate-kept", []);
	await ctx.state.set("gate-recorded", []);
	if (pending.length === 0)
		return {
			text: "No pending gates or author tasks.",
			card: { t: "text", text: "✓ No pending gates or author tasks.", tone: "positive" },
		};
	return {
		text: `${pending.length} gate${pending.length === 1 ? "" : "s"} want${pending.length === 1 ? "s" : ""} your answer.`,
		interview: { id: "gate", title: "WTF-P gates", total: pending.length, step: await ask(ctx, desk, pending[0] as Checkpoint) },
	};
}

function choiceOf(answers: Record<string, string | string[]>): unknown {
	const choice = answers.choice;
	return Array.isArray(choice) ? (choice.length === 1 ? choice[0] : undefined) : choice;
}

// --- confirmations of weakening record writes --------------------------------

interface PendingConfirm {
	write: RecordWrite;
	workspace: string;
	project: string | null;
	base_sha256: string | null;
	content_sha256: string;
	changes: string[];
	asked_at: string;
}

async function confirmStep(ctx: ExtensionContextV2, write: RecordWrite, prepared: Prepared): Promise<InterviewStep> {
	const nonce = randomBytes(6).toString("hex");
	await ctx.state.set(`confirm:${nonce}`, {
		write,
		workspace: ctx.snapshot.workspace,
		project: readRecord(ctx.snapshot.workspace, ".planning/project.json")?.id as string | null,
		base_sha256: prepared.priorSha,
		content_sha256: sha256(canonical(write.record)),
		changes: prepared.confirm,
		asked_at: timestamp(),
	} satisfies PendingConfirm);
	return {
		key: `confirm.${nonce}`,
		title: "Confirm a change to your controls",
		intro: {
			t: "box",
			dir: "col",
			children: [
				{ t: "text", text: `The agent wants to change ${write.uri}. This lowers what the workflow asks you or what the desk holds back:`, wrap: "wrap" },
				...prepared.confirm.slice(0, 8).map((change) => ({ t: "text", text: `  ${change}`, tone: "warning", wrap: "wrap" }) as View),
			],
		},
		questions: [
			{
				id: "choice",
				label: "Apply this change?",
				kind: "single",
				options: [
					{ value: "approve", label: "Apply it", detail: "Write the record exactly as shown." },
					{ value: "decline", label: "Keep my current settings", detail: "Nothing is written." },
				],
			},
		],
	};
}

// --- runtime tool handlers ---------------------------------------------------

async function armedFor(ctx: ExtensionContextV2): Promise<Armed | null> {
	const armed = (await ctx.state.get<Armed>("armed")).value;
	if (!armed) return null;
	// Arming belongs to the workspace and turn it was set in; anything else is stale.
	if (armed.workspace !== ctx.snapshot.workspace) return null;
	return armed;
}

async function recordTool(ctx: ExtensionContextV2, input: Json): Promise<{ text: string; data?: unknown; isError?: boolean; interview?: { id: string; title: string; total: number; step: InterviewStep } }> {
	const workspace = ctx.snapshot.workspace;
	const armed = await armedFor(ctx);
	const writes = normalizeWrites(input);
	const uris = writes.map((write) => write.uri);
	if (new Set(uris).size !== uris.length) throw new Error("each record may appear once in writes");
	const outcome = withLock(workspace, (): { recovered: string | null; done: PendingWrite[]; confirm: Prepared | null } => {
		const recovered = recover(workspace);
		const prepared = writes.map((write) => prepare(workspace, write, "agent", armed));
		const weakening = prepared.filter((entry) => entry.confirm.length > 0);
		if (weakening.length > 0) {
			if (prepared.length > 1) throw new Error(`${weakening[0]?.write.uri} weakens the author's controls; write it alone so the author can confirm it`);
			return { recovered, done: [], confirm: prepared[0] as Prepared };
		}
		commit(workspace, prepared.map((entry) => entry.write));
		return { recovered, done: prepared.map((entry) => entry.write), confirm: null };
	});
	const { recovered, done } = outcome;
	if (outcome.confirm) {
		const write = writes[0] as RecordWrite;
		return {
			text: `${write.uri} weakens the author's controls; asking the author.`,
			interview: { id: "confirm-write", title: "WTF-P · your controls", total: 1, step: await confirmStep(ctx, write, outcome.confirm) },
		};
	}
	return {
		text: [
			...(recovered ? [recovered] : []),
			...done.map((write) => `Wrote ${write.uri}${write.revision === null ? "" : ` at revision ${write.revision}`}; it validated and read back (sha256 ${write.sha256}).`),
			...(done.length > 1 ? ["They committed together."] : []),
		].join(" "),
		data:
			done.length === 1
				? { uri: done[0]?.uri, file: done[0]?.file, revision: done[0]?.revision, sha256: done[0]?.sha256 }
				: { writes: done.map((write) => ({ uri: write.uri, file: write.file, revision: write.revision, sha256: write.sha256 })) },
	};
}

function readTool(ctx: ExtensionContextV2, desk: Desk, uri: string): { text: string; data: unknown } {
	const workspace = ctx.snapshot.workspace;
	const route = RECORD_URIS.find((entry) => entry.pattern.test(uri));
	if (!route) throw new Error(`${uri} is not a logical record URI this adapter maps`);
	const file = route.file(route.pattern.exec(uri)?.[1] ?? "");
	const bytes = readBytes(workspace, file);
	if (bytes === null) {
		if (contained(workspace, file) === null) throw new Error(`${uri} is reached through a symbolic link; the desk does not follow links`);
		return { text: `${uri} does not exist yet; create it without expect_revision or expect_sha256.`, data: { uri, file, exists: false } };
	}
	let record: unknown;
	try {
		record = JSON.parse(bytes.toString("utf8"));
	} catch (error) {
		throw new Error(`${file} is not valid JSON (${error instanceof Error ? error.message : String(error)})`);
	}
	const revision = typeof (record as Json).revision === "number" ? ((record as Json).revision as number) : null;
	const checkpoint = route.type === "checkpoint" ? desk.checkpoints.find((entry) => entry.file === file) : undefined;
	return {
		text: `${uri}${revision === null ? "" : ` at revision ${revision}`}, sha256 ${sha256(bytes)}${checkpoint ? `, ${checkpoint.status}, author answer ${checkpoint.trust}` : ""}.`,
		data: { uri, file, exists: true, revision, sha256: sha256(bytes), record, ...(checkpoint ? { trust: checkpoint.trust } : {}) },
	};
}

function measureSection(workspace: string, sectionId: string, key: Buffer | null, armed: Armed | null): { words: number; target: number; file: string | null; total: number } {
	return withLock(workspace, () => {
		recover(workspace);
		const desk = loadDesk(workspace, key);
		const section = desk.sections.find((entry) => entry.id === sectionId);
		if (!section) throw new Error(`no section ${sectionId} in the outline`);
		const sectionFile = `.planning/sections/${sectionId}/section.json`;
		const record = readRecord(workspace, sectionFile);
		if (!record) throw new Error(`${sectionFile} does not exist yet`);
		const writes: RecordWrite[] = [
			{ uri: `project://sections/${sectionId}`, expect_sha256: sha256(readBytes(workspace, sectionFile) ?? ""), record: { ...record, word_count: section.words } },
		];
		const recorded = desk.sections.reduce((sum, entry) => sum + (entry.id === sectionId ? section.words : (entry.recorded ?? 0)), 0);
		const state = readRecord(workspace, ".planning/state.json");
		if (state && typeof state.progress === "object" && state.progress !== null)
			writes.push({
				uri: "project://state",
				expect_revision: typeof state.revision === "number" ? state.revision : 0,
				record: { ...state, progress: { ...(state.progress as Json), word_count: recorded } },
			});
		const prepared = writes.map((write) => prepare(workspace, write, "agent", armed));
		commit(workspace, prepared.map((entry) => entry.write));
		return { words: section.words, target: section.target, file: section.manuscript, total: recorded };
	});
}

function readiness(desk: Desk, sectionId: string): Json {
	const section = desk.sections.find((entry) => entry.id === sectionId);
	if (!section) throw new Error(`no section ${sectionId} in the outline`);
	const reasons = blockers(desk, section);
	return {
		section: section.id,
		ready: reasons.length === 0,
		reasons,
		plan: { state: section.plan.state, uri: section.plan.uri, sha256: section.plan.sha256, reason: section.plan.reason },
		gates: section.gates.map((gate) => ({ id: gate.id, status: gate.status, trust: gate.trust, request: gate.request })),
		research_required: section.research.required,
		unsupported_required_claims: section.unsupported,
		findings: desk.coverage.findings.filter((entry) => entry.subject.startsWith(`project://sections/${section.id}`)),
		coverage_scope: desk.coverage.scope,
	};
}

// --- commands ----------------------------------------------------------------

function progressCard(desk: Desk): View {
	const next = nextAction(desk);
	const totals = totalWords(desk);
	return {
		t: "box",
		dir: "col",
		border: "round",
		title: `WTF-P · ${desk.title}`,
		meta: desk.phase,
		children: [
			{
				t: "kv",
				items: [
					{ label: "words", value: `${totals.toLocaleString("en-US")} / ${desk.targetWords.toLocaleString("en-US")}`, tone: tolerance(totals, desk.targetWords) },
					{ label: "sections", value: `${desk.sections.filter((section) => section.status === "complete").length} of ${desk.sections.length} complete` },
					{
						label: "gates waiting on you",
						value: String(askable(desk, []).length),
						tone: askable(desk, []).length > 0 ? "warning" : "positive",
					},
					...(desk.journal ? [{ label: "interrupted write", value: "pending recovery", tone: "error" as ViewTone }] : []),
					...(daysLeft(desk.deadline) ? [{ label: "deadline", value: daysLeft(desk.deadline) as string }] : []),
					{ label: "next", value: next.command ? `${next.command} · ${next.reason}` : next.reason, tone: "info" },
				],
			},
			...(desk.sections.length > 0
				? [
						{
							t: "table",
							columns: ["wave", "section", "status", "stages", "plan", "words", "claims", "gates"],
							rows: desk.sections.map((section) => [
								String(section.wave),
								section.title,
								section.status,
								stageStrip(section),
								section.plan.state,
								section.target > 0 ? `${section.words}/${section.target}` : String(section.words),
								`${section.claims.verified}/${section.claims.total}`,
								String(section.gates.length),
							]),
						} as View,
					]
				: []),
			{ t: "text", text: WORD_METHOD, tone: "muted", wrap: "wrap" },
		],
	};
}

function progressText(desk: Desk): string {
	const next = nextAction(desk);
	if (!desk.present) return `No WTF-P project here. ${next.command ?? next.reason}`;
	return [
		`${desk.title} · ${desk.phase}`,
		`${totalWords(desk)}/${desk.targetWords} words; ${desk.sections.filter((section) => section.status === "complete").length}/${desk.sections.length} sections complete`,
		...(desk.journal ? ["An interrupted record write awaits recovery."] : []),
		...desk.sections.map((section) => `  w${section.wave} ${section.id}: ${section.status} ${stageStrip(section)} plan ${section.plan.state} ${section.words}/${section.target}w`),
		next.command ? `Next: ${next.command} (${next.reason})` : `Next: ${next.reason}`,
	].join("\n");
}

function helpCard(served: ServedPlugin): { text: string; card: View } {
	const availability = JSON.parse(
		readFileSync(path.join(PACKAGE_ROOT, "compatibility", "action-availability.json"), "utf8"),
	) as { actions: Array<{ id: string; status: string; unavailableCapabilities: string[] }> };
	const rows = availability.actions.map((entry) => {
		const contract = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, "actions", `${entry.id}.json`), "utf8")) as {
			description?: string;
		};
		return [
			actionName(served, entry.id),
			entry.status === "available" ? text(contract.description) : `unavailable: ${entry.unavailableCapabilities.join(", ")}`,
		];
	});
	const local = [...DESK_COMMANDS].map((id) => actionName(served, id));
	return {
		text: rows.map((row) => `${row[0]}  ${row[1]}`).join("\n"),
		card: {
			t: "box",
			dir: "col",
			border: "round",
			title: "WTF-P actions",
			meta: `${rows.length}`,
			children: [
				{ t: "table", columns: ["action", "what it does"], rows },
				{
					t: "text",
					wrap: "wrap",
					tone: "muted",
					text: `${served ? "" : "The WTF-P plugin is not installed and enabled, so the actions above are not commands here; install and enable it to run them. "}Answered locally with no model: ${local.join(", ")}, /ext:wtfp:checkpoints, /ext:wtfp:validate. Write guard: a running action may write only what its contract declares, and the workers it dispatches are confined to the same roots. A section's manuscript waits for its blocking gates, an approved plan whose bytes the author approved, and verified evidence for required claims in literature-heavy sections. Only your answers at the desk count as yours. ${WORD_METHOD}`,
				},
			],
		},
	};
}

function checkpointsCard(desk: Desk): View {
	return desk.checkpoints.length === 0
		? { t: "text", text: "No checkpoints recorded.", tone: "muted" }
		: {
				t: "box",
				dir: "col",
				border: "round",
				title: "WTF-P checkpoints",
				meta: String(desk.checkpoints.length),
				children: [
					{
						t: "table",
						columns: ["id", "kind", "status", "answer", "blocking", "scope"],
						rows: desk.checkpoints.slice(0, 100).map((checkpoint) => [
							checkpoint.id,
							checkpoint.kind,
							checkpoint.status,
							checkpoint.trust,
							checkpoint.blocking ? "yes" : "no",
							checkpoint.scope_uri.replace(/^project:\/\//u, ""),
						]),
					},
				],
			};
}

async function validateAll(ctx: ExtensionContextV2): Promise<ExtensionOutputV2> {
	const workspace = ctx.snapshot.workspace;
	let recovered: string | null = null;
	if (contained(workspace, JOURNAL) !== null && existsSync(path.join(workspace, JOURNAL)))
		recovered = withLock(workspace, () => recover(workspace));
	const files = planningRecords(workspace);
	const failures = files
		.map((file) => ({ file, errors: validateFile(workspace, file) }))
		.filter((record) => record.errors.length > 0);
	await ctx.state.set(
		"invalid",
		failures.map((record) => ({ file: record.file, errors: record.errors.slice(0, 5) })),
	);
	const desk = await deskFor(ctx);
	const findings: Finding[] = [...reconcile(workspace, desk), ...desk.coverage.findings];
	const order = ["blocker", "error", "warning", "info"];
	findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
	const serious = findings.filter((finding) => finding.severity !== "info");
	const lines = [
		...(recovered ? [recovered] : []),
		failures.length === 0 ? `${files.length} records valid against their schemas.` : failures.map((record) => `${record.file}: ${record.errors[0]}`).join("\n"),
		...findings.map((finding) => `${finding.severity} ${finding.code} ${finding.subject}: ${finding.message}`),
		...(desk.coverage.claims.length > 0 ? [desk.coverage.scope] : []),
	];
	const view: View = {
		t: "box",
		dir: "col",
		border: "round",
		title: failures.length === 0 && serious.length === 0 ? "WTF-P · records consistent" : "WTF-P · findings",
		meta: `${files.length} records · ${failures.length} invalid · ${serious.length} findings`,
		children: [
			...(recovered ? [{ t: "text", text: recovered, tone: "warning", wrap: "wrap" } as View] : []),
			failures.length === 0
				? ({ t: "text", text: `✓ ${files.length} planning records valid against their schemas.`, tone: "positive" } as View)
				: ({ t: "text", text: `✗ ${failures.length} of ${files.length} records fail their schemas.`, tone: "error" } as View),
			...failures.slice(0, 4).flatMap((record) => [
				{ t: "text", text: record.file, bold: true, tone: "error" } as View,
				...record.errors.slice(0, 2).map((error) => ({ t: "text", text: `  ${error}`, tone: "muted", wrap: "wrap" }) as View),
			]),
			...(findings.length > 0
				? [
						{
							t: "table",
							columns: ["severity", "finding", "subject", "detail"],
							rows: findings.slice(0, 40).map((finding) => [finding.severity, finding.code, finding.subject.replace(/^project:\/\//u, ""), finding.message]),
						} as View,
					]
				: []),
			...(desk.coverage.claims.length > 0 ? [{ t: "text", text: desk.coverage.scope, tone: "muted", wrap: "wrap" } as View] : []),
		],
	};
	return { text: lines.join("\n"), card: view, ...(await picture(ctx, desk)) };
}

// --- the write guard ---------------------------------------------------------

interface Armed {
	action: string;
	produces: GuardAction["produces"];
	section: string | null;
	workspace: string;
}

/**
 * The project roots an armed action's file tools may write, from its declared
 * outputs. Author-selected materials are never one: a "." root would be the
 * whole workspace.
 */
function writeRoots(desk: Desk, armed: Armed): string[] {
	const roots = new Set<string>();
	const section = armed.section;
	for (const output of armed.produces) {
		const uri = output.uri;
		if (uri.startsWith("project://paper/")) roots.add("paper");
		else if (uri.startsWith("project://deliverables/")) {
			const kind = uri.split("/")[3] ?? "";
			roots.add(kind.startsWith("{") ? "deliverables" : `deliverables/${kind}`);
		} else if (uri.startsWith("project://archives/")) {
			const kind = uri.split("/")[3] ?? "";
			roots.add(kind.startsWith("{") ? ".planning/archives" : `.planning/archives/${kind}`);
		} else {
			const match = /^project:\/\/sections\/\{section\}\/(context|research|summary|handoff|plans|reviews)/u.exec(uri);
			if (match && !section) roots.add(".planning/sections");
			else if (match) roots.add(match[1] === "plans" || match[1] === "reviews" ? `.planning/sections/${section}/${match[1]}` : `.planning/sections/${section}/${match[1]}.md`);
		}
	}
	if (roots.has("paper") && section) {
		roots.delete("paper");
		const row = desk.sections.find((entry) => entry.id === section);
		for (const root of manuscriptRoots(row)) roots.add(root);
	}
	return [...roots].sort();
}

function manuscriptRoots(section: SectionRow | undefined): string[] {
	if (!section?.manuscript) return [];
	const stem = section.manuscript.replace(/\.(md|tex|typ)$/u, "");
	return [section.manuscript, `${stem}/`];
}

/** Every section whose manuscript this file is: its own file, a variant of it, or a file nested under its stem. */
function sectionsForPaper(desk: Desk, relative: string): SectionRow[] {
	return desk.sections.filter((section) => {
		if (section.manuscript === null) return false;
		const stem = section.manuscript.replace(/\.(md|tex|typ)$/u, "");
		return relative === section.manuscript || relative === stem || relative.startsWith(`${stem}.`) || relative.startsWith(`${stem}/`);
	});
}

function under(root: string, relative: string): boolean {
	const trimmed = root.replace(/\/$/u, "");
	return trimmed === "." || relative === trimmed || relative.startsWith(`${trimmed}/`);
}

/** Whether two project paths share a file: one is the other or lies under it. */
function overlaps(left: string, right: string): boolean {
	const a = left.replace(/\/$/u, "");
	const b = right.replace(/\/$/u, "");
	return under(a, b) || under(b, a);
}

function block(reason: string): ExtensionHookResult {
	return { effects: [{ kind: "block_tool", reason }] };
}

function deskOwned(relative: string): boolean {
	return DESK_OWNED.some((owned) => under(owned, relative)) || /^\.planning\/(?:.*\/)?\.wtfp-/u.test(relative);
}

/** The manuscripts a write must not reach now: those of sections that are not ready to draft. */
function heldManuscripts(desk: Desk): { roots: string[]; notes: string[] } {
	const roots: string[] = [];
	const notes: string[] = [];
	for (const section of desk.sections) {
		const reasons = blockers(desk, section);
		if (reasons.length === 0) continue;
		roots.push(...manuscriptRoots(section));
		notes.push(`${section.id}: ${reasons.join("; ")}`);
	}
	return { roots, notes };
}

async function guardWrite(ctx: ExtensionContextV2, target: string): Promise<ExtensionHookResult> {
	const workspace = ctx.snapshot.workspace;
	const served = ctx.snapshot.plugin ?? null;
	const real = toolTarget(target, workspace);
	if (real === null) return block(`WTF-P write guard: ${target} goes through a dangling symbolic link; refused.`);
	const root = realpathSync(workspace);
	if (!inside(root, real)) return {};
	const relative = posix(path.relative(root, real)) || ".";
	if (deskOwned(relative)) return block(`WTF-P write guard: ${relative} is written only by the desk; nothing else may change it.`);
	if (under(".planning", relative) && relative.endsWith(".json") && !under(".planning/archives", relative))
		return block(
			`WTF-P write guard: ${relative} is a portable record; write it with extension_wtfp__record so it is validated and checked against the version you read.`,
		);
	const desk = loadDesk(workspace, await storedKey(ctx, false));
	const armed = await armedFor(ctx);
	if (armed) {
		const roots = writeRoots(desk, armed);
		if (!roots.some((allowed) => under(allowed, relative)))
			return block(
				`WTF-P write guard: ${actionName(served, armed.action)}${armed.section ? ` ${armed.section}` : ""} may write only under ${roots.join(", ") || "nothing (it declares no file outputs)"}; refused ${relative}. Record other changes as a handoff instead.`,
			);
	}
	for (const section of desk.sections) {
		const linked = Array.isArray((section.record?.artifacts as Json | undefined)?.plans) ? (((section.record?.artifacts as Json).plans as string[]) ?? []) : [];
		for (const uri of linked)
			if (artifactFile(workspace, uri) === relative)
				return block(`WTF-P write guard: ${relative} is a linked plan, and linked plans are immutable; write a revision plan instead.`);
	}
	if (!under("paper", relative) || !desk.present) return {};
	// A file can be the manuscript of more than one section (one nested under another's stem); every one must be ready.
	const held = sectionsForPaper(desk, relative)
		.map((section) => ({ section, reasons: blockers(desk, section) }))
		.find((entry) => entry.reasons.length > 0);
	if (!held) return {};
	const { section, reasons } = held;
	const gate = section.gates[0];
	return block(
		`WTF-P gate: ${section.title} cannot be written yet: ${reasons.join("; ")}. ${
			gate
				? `Answer it with ${actionName(served, "check-todos")}.`
				: !planReady(section.plan)
					? commandFor(served, "plan-section", section.id) !== null
						? `Run ${commandFor(served, "plan-section", section.id)} and approve its plan at the gate.`
						: "Planning it needs the WTF-P plugin; approve a plan at the gate."
					: `Run ${actionName(served, "research-gap")} for it first.`
		}`,
	);
}

/** Narrows requested write roots to those inside the allowed ones; a broader request becomes the allowed roots inside it. */
function narrow(requested: string[], allowed: string[]): string[] {
	const out = new Set<string>();
	for (const want of requested) {
		for (const root of allowed) {
			const bare = root.replace(/\/$/u, "");
			if (under(bare, want)) out.add(want);
			else if (under(want, bare)) out.add(root);
		}
	}
	return [...out].sort();
}

const WTFP_AGENT = /^wtfp-[a-z-]+$/u;
const READ_ONLY_AGENTS = new Set(GUARD.readOnlyAgents);

interface DispatchTask {
	item: Json;
	/** The trimmed agent id, or null for Clio's default agent. */
	agent: string | null;
	/** Normalized write roots, or null when the worker would have no boundary. */
	roots: string[] | null;
}

function isObject(value: unknown): value is Json {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * A dispatch call's tasks as Clio 0.6.2 parses them (src/tools/dispatch-arguments.ts,
 * domains/dispatch/intent.ts): a batch may arrive as a JSON string or as one
 * object, `task` alone is a one-task batch, an agent id is trimmed and a blank
 * one means Clio's default agent, a task's intent inherits the shared one, and
 * a write root of "." or "./" is the whole workspace, as no list is. Throws
 * for a shape the desk cannot read, since it could not confine it.
 */
function dispatchTasks(args: Json): DispatchTask[] {
	const unreadable = (what: string): Error => new Error(`WTF-P dispatch guard: the desk cannot read this dispatch's ${what}, so it cannot confine its workers.`);
	let tasks: unknown = args.tasks;
	if (typeof tasks === "string") {
		const raw = tasks.trim();
		if (raw.startsWith("[") || raw.startsWith("{")) {
			try {
				tasks = JSON.parse(raw) as unknown;
			} catch {
				// Clio refuses the call with its own shape error.
			}
		}
	}
	if (isObject(tasks) || typeof tasks === "string") tasks = [tasks];
	if (tasks === undefined && typeof args.task === "string") tasks = [{ task: args.task }];
	if (!Array.isArray(tasks) || tasks.length === 0) throw unreadable("tasks");
	const shared = args.intent;
	if (shared !== undefined && !isObject(shared)) throw unreadable("intent");
	return tasks.map((task) => {
		const item = typeof task === "string" ? { task } : task;
		if (!isObject(item)) throw unreadable("tasks");
		if (item.intent !== undefined && !isObject(item.intent)) throw unreadable("intent");
		const named = Object.hasOwn(item, "agent") ? item.agent : args.agent;
		const agent = typeof named === "string" && named.trim().length > 0 ? named.trim() : null;
		const declared = (item.intent as Json | undefined)?.write_roots ?? shared?.write_roots;
		if (declared !== undefined && !Array.isArray(declared)) throw unreadable("write_roots");
		const roots: string[] = [];
		for (const entry of (declared as unknown[] | undefined) ?? []) {
			if (typeof entry !== "string") throw unreadable("write_roots");
			const trimmed = entry.trim().replace(/\/{2,}/gu, "/");
			if (/^\.\/?$/u.test(trimmed)) continue;
			const segments = trimmed.split("/").filter(Boolean);
			if (trimmed.startsWith("/") || trimmed.includes("\\") || segments.includes("..") || segments.includes("."))
				throw new Error(`WTF-P dispatch guard: write root ${entry} must be a plain project-relative path.`);
			roots.push(trimmed);
		}
		return { item, agent, roots: roots.length === 0 ? null : roots };
	});
}

/** Where a worker root really leads inside the project, so a link cannot dress up a held path. */
function rootSpellings(workspace: string, root: string): string[] {
	const real = toolTarget(root.replace(/\/$/u, ""), workspace);
	const base = realpathSync(workspace);
	const physical = real !== null && inside(base, real) ? posix(path.relative(base, real)) || "." : null;
	return physical === null || physical === root.replace(/\/$/u, "") ? [root] : [root, physical];
}

async function guardDispatch(ctx: ExtensionContextV2, args: Json): Promise<ExtensionHookResult> {
	if (args.list === true) return {};
	const workspace = ctx.snapshot.workspace;
	const served = ctx.snapshot.plugin ?? null;
	const desk = loadDesk(workspace, await storedKey(ctx, false));
	if (desk.present && (args.from_scout !== undefined || args.apply_winner !== undefined))
		return block("WTF-P dispatch guard: the desk cannot see what a scout continuation or a compete winner writes, so a WTF-P project refuses them.");
	const entries = dispatchTasks(args);
	const armed = await armedFor(ctx);
	if (!armed) {
		const wtfp = entries.filter((entry) => entry.agent !== null && WTFP_AGENT.test(entry.agent));
		if (wtfp.length > 0)
			return block(
				`WTF-P dispatch guard: ${wtfp.map((entry) => entry.agent).join(", ")} run only inside the WTF-P action that owns them, so the desk can confine their writes; start it with its /wtfp: command.`,
			);
		if (!desk.present) return {};
		// Workers run no desk check, so outside an action each must be kept off the records and the manuscripts still held.
		const held = [".planning/", ...heldManuscripts(desk).roots];
		for (const entry of entries) {
			if (entry.roots === null)
				return block(
					`WTF-P dispatch guard: outside a WTF-P action, give each worker intent.write_roots that leave out ${held.join(", ")}; a worker runs no desk check, so without roots it could change the records or a gated manuscript.`,
				);
			for (const root of entry.roots) {
				const hit = held.find((file) => rootSpellings(workspace, root).some((spelling) => overlaps(spelling, file)));
				if (hit) return block(`WTF-P dispatch guard: write root ${root} reaches ${hit}, which a worker outside a WTF-P action may not change.`);
			}
		}
		return {};
	}
	const name = actionName(served, armed.action);
	// A worker never gets a root that holds records: the record tool is the only way records change.
	const base = writeRoots(desk, armed).filter((root) => ![".", ".planning", ".planning/sections"].includes(root.replace(/\/$/u, "")));
	const held = heldManuscripts(desk);
	let allowed = base;
	const notes: string[] = [];
	if (base.includes("paper")) {
		// Without a named section, a worker may reach only manuscripts whose sections are ready now.
		notes.push(...held.notes);
		allowed = [...base.filter((root) => root !== "paper"), ...desk.sections.filter((section) => blockers(desk, section).length === 0).flatMap((section) => manuscriptRoots(section))];
	} else if (armed.section) {
		const section = desk.sections.find((entry) => entry.id === armed.section);
		const reasons = section ? blockers(desk, section) : [];
		if (section && reasons.length > 0 && base.some((root) => root.startsWith("paper/"))) notes.push(`${section.id}: ${reasons.join("; ")}`);
	}
	// No worker root may cover a manuscript that is still held, even one nested under a ready section's stem.
	allowed = [...new Set(allowed.filter((root) => !held.roots.some((file) => overlaps(root, file))))].sort();
	const sectionScoped = armed.produces.some((output) => output.uri.includes("{section}"));
	const paperWriters = new Set(GUARD.paperWriters);
	const narrowed = entries.map((entry): string[] | null => {
		if (entry.roots === null && entry.agent !== null && READ_ONLY_AGENTS.has(entry.agent)) return null;
		const roots = entry.roots === null ? allowed : narrow(entry.roots, allowed);
		if (entry.agent && paperWriters.has(entry.agent) && !roots.some((root) => root.startsWith("paper/")))
			throw new Error(
				`WTF-P dispatch guard: ${entry.agent} would have no manuscript it may write. ${notes.length > 0 ? notes.join(" · ") : "Name the section and approve its plan first."}`,
			);
		if (roots.length > 0) return roots;
		// Clio reads an empty write_roots as no boundary at all, so an empty list is refused, never sent.
		if (entry.roots !== null && allowed.length > 0)
			throw new Error(`WTF-P dispatch guard: ${entry.roots.join(", ")} lie outside what ${armed.action} may write (${allowed.join(", ")}).`);
		throw new Error(
			sectionScoped && armed.section === null
				? `WTF-P dispatch guard: ${name} names no section, so its workers would reach every section's records; name the section in the command.`
				: `WTF-P dispatch guard: ${name} declares no file outputs a worker may write; only its read-only reviewers may be dispatched.`,
		);
	});
	const writers = entries.filter((entry, index) => narrowed[index] !== null);
	if (writers.length > 1 && writers.some((entry) => entry.roots === null))
		return block(
			`WTF-P dispatch guard: give each task its own intent.write_roots inside ${allowed.join(", ")}, one section's manuscript and summary per writer, so parallel writers stay disjoint.`,
		);
	const confine = (item: Json, roots: string[] | null): Json => (roots === null ? item : { ...item, intent: { ...((item.intent as Json | undefined) ?? {}), write_roots: roots } });
	const single = args.tasks === undefined;
	const rewritten: Json = single
		? confine(args, narrowed[0] ?? null)
		: { ...args, tasks: entries.map((entry, index) => confine(entry.item, narrowed[index] ?? null)) };
	if (canonical(rewritten) === canonical(args)) return {};
	return {
		effects: [
			{
				kind: "rewrite_tool_input",
				args: rewritten,
				reason: `WTF-P confines ${name} workers to ${[...new Set(narrowed.flatMap((roots) => roots ?? []))].join(", ") || "no writes"}.`,
			},
		],
	};
}

const BASH_DESK_PATHS = /\.planning\/(?:interactions\b|\.wtfp-)/u;
/** Tools that run a command or script; the desk can only refuse ones that name its own records. */
const COMMAND_TOOLS = new Set(["bash", "run_script", "job"]);

async function guard(ctx: ExtensionContextV2, tool: string, args: unknown): Promise<ExtensionHookResult> {
	const input = args !== null && typeof args === "object" ? (args as Json) : {};
	const effects: ExtensionEffect[] = [];
	if (!(await ctx.state.get<boolean>("protected")).value) {
		// The host's protected-artifact guard then refuses bash rm, mv, cp and redirects into the desk's own records.
		effects.push({ kind: "protect_path", path: path.join(ctx.snapshot.workspace, ".planning", "interactions"), reason: "WTF-P author answers are written only by the desk." });
		await ctx.state.set("protected", true);
	}
	let result: ExtensionHookResult = {};
	try {
		if (tool === "dispatch") result = await guardDispatch(ctx, input);
		else if (COMMAND_TOOLS.has(tool)) {
			if (BASH_DESK_PATHS.test(JSON.stringify(input))) result = block("WTF-P write guard: commands may not touch the desk's own records under .planning.");
		} else {
			const raw = input.path ?? input.file_path ?? input.filePath;
			// The artifact tool trims its path, and without one writes under Clio's own artifact directory.
			const target = typeof raw === "string" ? (tool === "artifact" ? raw.trim() : raw) : "";
			if (target.length > 0) result = await guardWrite(ctx, target);
		}
	} catch (error) {
		result = block(error instanceof Error ? error.message : String(error));
	}
	return effects.length === 0 ? result : { ...result, effects: [...effects, ...(result.effects ?? [])] };
}

function arm(text: string, desk: Desk, workspace: string): Armed | null {
	const match = /^\s*\/wtfp:([a-z][a-z0-9-]*)(?:\s+(\S+))?/u.exec(text);
	if (!match) return null;
	const action = GUARD.actions[match[1] as string];
	if (!action) return null;
	const candidate = match[2] ?? "";
	const sectionScoped = action.produces.some((output) => output.uri.includes("{section}"));
	const section = sectionScoped && desk.sections.some((entry) => entry.id === candidate) ? candidate : null;
	return { action: match[1] as string, produces: action.produces, section, workspace };
}

// --- registration ------------------------------------------------------------

export default function extension(api: ExtensionApiV2): void {
	api.handle("desk", async (_args, ctx) => {
		const desk = await deskFor(ctx);
		return { text: progressText(desk), workspace: { enter: "desk" }, ...(await picture(ctx, desk, "desk")) };
	});
	api.handle("progress", async (_args, ctx) => {
		const desk = await deskFor(ctx);
		return { text: progressText(desk), card: progressCard(desk), ...(await picture(ctx, desk)) };
	});
	api.handle("help", async (_args, ctx) => helpCard(ctx.snapshot.plugin ?? null));
	api.handle("check-todos", async (_args, ctx) => startGates(ctx));
	api.handle("checkpoints", async (_args, ctx) => {
		const desk = await deskFor(ctx);
		return {
			text: desk.checkpoints.map((checkpoint) => `${checkpoint.id} ${checkpoint.kind} ${checkpoint.status} ${checkpoint.trust}`).join("\n") || "No checkpoints.",
			card: checkpointsCard(desk),
		};
	});
	api.handle("validate", async (_args, ctx) => validateAll(ctx));

	api.action("next", async (_event, ctx) => {
		const next = nextAction(await deskFor(ctx));
		return next.command ? { text: next.command, prompt: { fill: next.command } } : { text: next.reason, toast: { text: next.reason } };
	});
	api.action("gates", async (_event, ctx) => startGates(ctx));
	api.action("validate", async (_event, ctx) => validateAll(ctx));
	api.action("help", async (_event, ctx) => helpCard(ctx.snapshot.plugin ?? null));
	api.action("section", async (event, ctx) => {
		const desk = await deskFor(ctx);
		const section = desk.sections.find((entry) => entry.id === event.key);
		if (!section) return { text: "Unknown section." };
		const next = sectionNext(desk.served, section);
		return {
			text: `${section.title}: ${next.reason}`,
			toast: { text: `${section.title}: ${next.reason}` },
			...(next.command ? { prompt: { fill: next.command } } : {}),
		};
	});

	api.tool("record", async (input, ctx) => {
		try {
			return await recordTool(ctx, (input ?? {}) as Json);
		} catch (error) {
			return { text: failure("Not written", error), isError: true };
		}
	});
	api.tool("read_record", async (input, ctx) => {
		try {
			return readTool(ctx, await deskFor(ctx), String((input as Json).uri ?? ""));
		} catch (error) {
			return { text: `Not read: ${error instanceof Error ? error.message : String(error)}`, isError: true };
		}
	});
	api.tool("readiness", async (input, ctx) => {
		try {
			const report = readiness(await deskFor(ctx), String((input as Json).section ?? ""));
			return {
				text:
					report.ready === true
						? `${String(report.section)} may be drafted: ${(report.plan as Json).reason as string}. ${coverage.STRUCTURAL_SCOPE}`
						: `${String(report.section)} may not be drafted yet: ${(report.reasons as string[]).join("; ")}.`,
				data: report,
			};
		} catch (error) {
			return { text: `No readiness: ${error instanceof Error ? error.message : String(error)}`, isError: true };
		}
	});
	api.tool("measure_section", async (input, ctx) => {
		try {
			const measured = measureSection(ctx.snapshot.workspace, String((input as Json).section ?? ""), await storedKey(ctx, false), await armedFor(ctx));
			const share = measured.target > 0 ? Math.round((measured.words / measured.target) * 100) : null;
			return {
				text: `${measured.file ?? "the manuscript"} has ${measured.words} body words${share === null ? "" : ` (${share}% of ${measured.target}; within 15% counts as on target)`}. Recorded in the section and state records, which committed together; the paper totals ${measured.total}. ${WORD_METHOD}`,
				data: measured,
			};
		} catch (error) {
			return { text: failure("Not measured", error), isError: true };
		}
	});
	api.tool("gate", async (input, ctx) => {
		const id = String((input as Json).checkpoint ?? "");
		const desk = await deskFor(ctx);
		const checkpoint = desk.checkpoints.find((entry) => entry.id === id);
		if (!checkpoint) return { text: `No checkpoint ${id}.`, isError: true };
		if (!askable(desk, []).includes(checkpoint)) return { text: `${id} is already ${checkpoint.status}${checkpoint.trust === "attested" ? " by the author at this desk" : ""}.` };
		return { text: `Asking the author: ${checkpoint.request}`, interview: { id: "gate-one", title: "WTF-P gate", total: 1, step: await ask(ctx, desk, checkpoint) } };
	});
	api.interview("gate-one", async (event, ctx): Promise<InterviewNext> => {
		if (event.nav === "cancel")
			return {
				done: true,
				text:
					event.reason === "headless"
						? "No author could be asked in this headless session; the gate stays pending and authorizes nothing."
						: "The author did not answer; the gate stays pending.",
			};
		try {
			const result = await answer(ctx, event.step, choiceOf(event.answers));
			if (result.kind === "stale" && result.checkpoint) {
				const desk = await deskFor(ctx);
				const current = desk.checkpoints.find((entry) => entry.id === result.checkpoint);
				if (current && askable(desk, []).includes(current)) return { step: await ask(ctx, desk, current), total: 1 };
			}
			if (result.kind === "recorded") return { done: true, text: `Recorded the author's answer: ${result.text}.`, ...(await picture(ctx)) };
			if (result.kind === "kept") return { done: true, text: `The author kept ${result.checkpoint} pending.`, ...(await picture(ctx)) };
			return { done: true, text: result.text };
		} catch (error) {
			return { done: true, text: failure("Nothing was recorded", error) };
		}
	});
	api.interview("gate", async (event, ctx): Promise<InterviewNext> => {
		if (event.nav === "cancel")
			return {
				done: true,
				text: event.reason === "headless" ? "No author could be asked in this headless session; gates left as they were." : "Gates left as they were.",
				toast: { text: "WTF-P gates unchanged" },
				...(await picture(ctx)),
			};
		const kept = (await ctx.state.get<string[]>("gate-kept")).value ?? [];
		const recorded = (await ctx.state.get<string[]>("gate-recorded")).value ?? [];
		let note = "";
		try {
			const result = await answer(ctx, event.step, choiceOf(event.answers));
			if (result.kind === "recorded") recorded.push(result.text);
			else if (result.kind === "kept" && result.checkpoint) kept.push(result.checkpoint);
			else if (result.kind === "refused") {
				note = result.text;
				if (result.checkpoint) kept.push(result.checkpoint);
			}
		} catch (error) {
			note = failure("Nothing was recorded", error);
		}
		await ctx.state.set("gate-kept", kept);
		await ctx.state.set("gate-recorded", recorded);
		const desk = await deskFor(ctx);
		const remaining = askable(desk, kept);
		const next = remaining[0];
		if (next && !note.startsWith("Nothing was recorded")) return { step: await ask(ctx, desk, next), total: remaining.length + recorded.length + kept.length };
		await ctx.state.set("gate-recorded", []);
		const summary = [recorded.length > 0 ? `Recorded: ${recorded.join("; ")}.` : "Nothing recorded.", note].filter(Boolean).join(" ");
		return {
			done: true,
			text: summary,
			card: { t: "text", text: `${recorded.length > 0 ? "✓" : "·"} ${summary}`, tone: recorded.length > 0 ? "positive" : "muted", wrap: "wrap" },
			...(await picture(ctx, desk)),
		};
	});
	api.interview("confirm-write", async (event, ctx): Promise<InterviewNext> => {
		const nonce = /^confirm\.([a-f0-9]{12})$/u.exec(event.step)?.[1];
		const pending = nonce ? (await ctx.state.get<PendingConfirm>(`confirm:${nonce}`)).value : undefined;
		if (nonce) await ctx.state.delete(`confirm:${nonce}`);
		if (!pending) return { done: true, text: "That answer matches no open question; nothing was written." };
		if (event.nav === "cancel")
			return { done: true, text: event.reason === "headless" ? "No author could be asked; the change was not written." : "The author did not answer; the change was not written." };
		const workspace = ctx.snapshot.workspace;
		const picked = choiceOf(event.answers);
		if (pending.workspace !== workspace) return { done: true, text: "That answer was given for another project; nothing was written." };
		if (picked !== "approve" && picked !== "decline") return { done: true, text: "That answer is not one of the options offered; nothing was written." };
		const key = await storedKey(ctx, true);
		if (key === null) return { done: true, text: "The desk could not establish its seal key; nothing was written." };
		try {
			const outcome = withLock(workspace, () => {
				recover(workspace);
				const file = artifactFile(workspace, pending.write.uri);
				const current = file === null ? null : readBytes(workspace, file);
				const stale = (current === null ? null : sha256(current)) !== pending.base_sha256 || sha256(canonical(pending.write.record)) !== pending.content_sha256;
				const prepared = stale || picked === "decline" ? null : prepare(workspace, pending.write, "desk", null);
				const interaction = sealed(
					{
						schema: "wtfp.project.interaction/v1",
						id: interactionId(),
						project_id: pending.project ?? readRecord(workspace, ".planning/project.json")?.id,
						kind: "record-change",
						subject_uri: pending.write.uri,
						channel: "attested-interview",
						outcome: stale ? "discarded-stale" : picked === "approve" ? "approved" : "declined",
						presented: { content_sha256: pending.content_sha256, options: ["approve", "decline"], ...(pending.base_sha256 ? { base_sha256: pending.base_sha256 } : {}) },
						asked_at: pending.asked_at,
						answered_at: timestamp(),
					},
					key,
				);
				const writes = [prepare(workspace, { uri: `project://interactions/${String(interaction.id)}`, record: interaction }, "desk", null).write];
				if (prepared) writes.push(prepared.write);
				commit(workspace, writes);
				return stale ? "stale" : picked;
			});
			return {
				done: true,
				text:
					outcome === "stale"
						? `${pending.write.uri} changed while the author was asked; nothing was written. Read it again and propose the change anew.`
						: outcome === "approve"
							? `The author approved the change; ${pending.write.uri} was written: ${pending.changes.join("; ")}.`
							: `The author kept the current settings; ${pending.write.uri} was not changed.`,
				...(await picture(ctx)),
			};
		} catch (error) {
			return { done: true, text: failure("Nothing was written", error) };
		}
	});

	api.hook("prompt_submit", async (event, ctx) => {
		const typed = event.point === "prompt_submit" ? (event.text ?? "") : "";
		const desk = loadDesk(ctx.snapshot.workspace);
		const armed = arm(typed, desk, ctx.snapshot.workspace);
		if (!armed) {
			await ctx.state.delete("armed");
			return {};
		}
		await ctx.state.set("armed", armed);
		const roots = writeRoots(desk, armed);
		return {
			effects: [
				{
					kind: "notify_operator",
					key: "wtfp-guard",
					message: `WTF-P write guard armed for ${actionName(ctx.snapshot.plugin ?? null, armed.action)}${armed.section ? ` ${armed.section}` : ""}: files stay under ${roots.join(", ") || "nothing"}, records under what it declares.`,
				},
			],
		};
	});
	api.hook("before_tool", async (event, ctx) => (event.point === "before_tool" ? guard(ctx, event.tool, event.args) : {}));

	api.on("session_open", async (_event, ctx) => {
		const workspace = ctx.snapshot.workspace;
		let recovered: string | null = null;
		try {
			if (contained(workspace, JOURNAL) !== null && existsSync(path.join(workspace, JOURNAL))) recovered = withLock(workspace, () => recover(workspace));
		} catch (error) {
			recovered = `An interrupted write could not be completed: ${error instanceof Error ? error.message : String(error)}`;
		}
		return { text: recovered ?? "", ...(recovered ? { toast: { text: recovered, tone: "warning" as const } } : {}), ...(await picture(ctx)) };
	});
	api.on("turn_end", async (_event, ctx) => {
		// An action arms for the turn its command starts; nothing it allowed outlives that turn.
		await ctx.state.delete("armed");
		return undefined;
	});
	api.on("workspace_enter", async (_event, ctx) => ({ text: "", ...(await picture(ctx)) }));
	// Leaving means the desk no longer holds the screen, whatever the snapshot says yet.
	api.on("workspace_leave", async (_event, ctx) => ({ text: "", ...(await picture(ctx, undefined, null)) }));
	api.on("fs_changed", async (event, ctx) => {
		if (event.event !== "fs_changed") return undefined;
		const records = event.paths.filter(
			(file) => file.startsWith(".planning/") && file.endsWith(".json") && !file.includes("/archives/") && !/(^|\/)\./u.test(file.slice(".planning/".length)),
		);
		const card = records.length > 0 ? await revalidate(ctx, records) : undefined;
		return { text: "", ...(card ? { card } : {}), ...(await picture(ctx)) };
	});
	api.on("dispatch_started", async (event, ctx) => {
		if (event.event !== "dispatch_started" || !event.agentId.startsWith("wtfp-")) return undefined;
		const runs = await running(ctx);
		runs[event.runId] = { agentId: event.agentId, at: Date.now() };
		await ctx.state.set("running", runs);
		return { text: "", ...(await picture(ctx)) };
	});
	const finished = async (runId: string, ctx: ExtensionContextV2): Promise<ExtensionOutputV2 | undefined> => {
		const runs = await running(ctx);
		if (!(runId in runs)) return undefined;
		delete runs[runId];
		await ctx.state.set("running", runs);
		return { text: "", ...(await picture(ctx)) };
	};
	api.on("dispatch_completed", async (event, ctx) => (event.event === "dispatch_completed" ? finished(event.runId, ctx) : undefined));
	api.on("dispatch_failed", async (event, ctx) => (event.event === "dispatch_failed" ? finished(event.runId, ctx) : undefined));
}
