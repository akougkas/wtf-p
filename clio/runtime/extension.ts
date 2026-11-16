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
	writeFileSync,
	writeSync,
} from "node:fs";
import { createRequire } from "node:module";
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
	indexRecords(
		entries: Array<{ file: string; record: Json }>,
		collection: string,
		location?: (id: string) => string,
	): { byUri: Record<string, Json>; ignored: Array<{ file: string; reason: string }> };
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
const TEMPLATES = path.join(PACKAGE_ROOT, "project", "templates");

/**
 * The example record of a type, so a model creating one sees every field it
 * needs at once instead of learning them from one refusal per call.
 */
function templateFor(type: string): string {
	try {
		return JSON.stringify(JSON.parse(readFileSync(path.join(TEMPLATES, `${type}.json`), "utf8")));
	} catch {
		return "";
	}
}

function withTemplate(message: string, type: string): string {
	const template = templateFor(type);
	return template ? `${message}\nA ${type} record looks like this example; replace its ids, project_id and content, and omit ${CREATED_AT[type] ? `updated_at and ${CREATED_AT[type]}, which the desk sets` : "updated_at, which the desk sets"}: ${template}` : message;
}
interface GuardAction {
	/** The Clio agent IDs of the roles the action's contract delegates to. */
	agents: string[];
	produces: Array<{ uri: string; mode: string }>;
}
const GUARD = JSON.parse(readFileSync(new URL("./write-guard.json", import.meta.url), "utf8")) as {
	schema: string;
	actions: Record<string, GuardAction>;
	paperWriters: string[];
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
	/** When the author's sealed approval of these bytes was given. */
	approvedAt?: string;
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
	/** `claimless`: the record names no live claim that requires evidence, so coverage is vacuous. */
	research: { required: boolean; present: boolean; claimless: boolean };
	dependsOn: string[];
	plan: PlanState;
	unsupported: string[];
	record: Json | null;
	/** The author's acceptance after review, from verify-work and its sealed checkpoint. */
	acceptance: Acceptance;
	/** When the manuscript file was last written, in epoch milliseconds, or null when it does not exist. */
	writtenAt: number | null;
	/** When write-section last validated a draft of this section, in epoch milliseconds, or null. */
	writeValidatedAt: number | null;
}

interface Acceptance {
	/** A review validation or linked review exists for the section. */
	reviewed: boolean;
	/** A verify-work validation is at least as new as the latest review. */
	verified: boolean;
	/** The attested author answer on that validation's acceptance checkpoint, if any. */
	decision: "accept" | "revise" | null;
	/** The note the author attached to that answer, if any. */
	note?: string;
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
	/** The latest milestone audit: fresh when nothing the desk tracks was recorded after it; errors counts its error and blocker issues. */
	audit: { fresh: boolean; errors: number } | null;
	/** A passed submit-milestone validation that no later draft or record outdates. */
	delivered: boolean;
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
	return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
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

/** The workspace's real path, against which Clio reports every landing. */
function realWorkspace(workspace: string): string {
	try {
		return realpathSync(workspace);
	} catch {
		return workspace;
	}
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

/** The top-level fields a record type's schema defines. */
function recordFields(schema: string): Set<string> {
	const match = /^wtfp\.project\.([a-z][a-z0-9-]*)\/v1$/u.exec(schema);
	if (!match) return new Set();
	try {
		const parsed = JSON.parse(readFileSync(path.join(SCHEMAS, `${match[1]}.schema.json`), "utf8")) as Json;
		return new Set(Object.keys((parsed.properties as Json | undefined) ?? {}));
	} catch {
		return new Set();
	}
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

// --- the author's acceptance after review -------------------------------------

function writtenAt(workspace: string, manuscript: string | null): number | null {
	if (manuscript === null || contained(workspace, manuscript) === null) return null;
	try {
		return statSync(path.join(workspace, manuscript)).mtimeMs;
	} catch {
		return null;
	}
}

/**
 * A plan the author approved after the manuscript was last written has not
 * been applied yet: a revision plan approved for a reviewed section is drafted
 * before anything reviews or accepts the section again. Answers are stamped to
 * the second, so a write later in the same second counts as applying it.
 */
function unappliedPlan(section: SectionRow): boolean {
	if (section.plan.state !== "approved" || !section.plan.approvedAt) return false;
	const approved = Date.parse(section.plan.approvedAt);
	if (!Number.isFinite(approved)) return false;
	if (section.writtenAt === null || section.writtenAt < approved) return true;
	// Saving the manuscript is not drafting it: write-section ends on its validation, after the measured
	// count and summary. Live, a writer saved the revision, could not count it, and the section went to review.
	return section.writeValidatedAt === null || section.writeValidatedAt < Math.floor(approved / 1000) * 1000;
}

/** When write-section last recorded a validation for this section, from its executed_at, or null. */
function writeValidatedAt(validations: Json[], id: string, manuscriptUri: string): number | null {
	const times = validations
		.filter((record) => record.action_id === "write-section" && validates(record, id, manuscriptUri))
		.map((record) => Date.parse(text(record.executed_at)))
		.filter(Number.isFinite);
	return times.length > 0 ? Math.max(...times) : null;
}

const ACCEPT = "accept";
const REVISE = "revise";

/** Whether a validation's subject is this section, one of its artifacts, or its manuscript. */
function validates(record: Json, id: string, manuscriptUri: string): boolean {
	const subject = text(record.subject_uri);
	const section = `project://sections/${id}`;
	return subject === section || subject.startsWith(`${section}/`) || subject === manuscriptUri || subject.startsWith(`${manuscriptUri}/`);
}

/**
 * Where a reviewed section stands with its author. Review is critique only;
 * verify-work records the acceptance checks and closes with a checkpoint scoped
 * to its validation, and only an attested answer on that checkpoint counts.
 */
/** When the desk wrote each validation record, by file time. */
const recordedAt = new WeakMap<Json, number>();

function acceptanceOf(validations: Json[], checkpoints: Checkpoint[], id: string, manuscriptUri: string, reviewsLinked: boolean, drafted: number | null): Acceptance {
	const mine = validations.filter((record) => validates(record, id, manuscriptUri));
	const latest = (action: string): Json | undefined =>
		mine.filter((record) => record.action_id === action).sort((a, b) => text(b.executed_at).localeCompare(text(a.executed_at)))[0];
	const review = latest("review-section");
	const verify = latest("verify-work");
	// A review counts only for the draft it read: a revision written after it waits for a new review.
	const reviewed = review !== undefined ? drafted === null || (recordedAt.get(review) ?? 0) >= drafted : reviewsLinked && drafted === null;
	const verified = verify !== undefined && (review === undefined || text(verify.executed_at) >= text(review.executed_at));
	if (!verified || verify === undefined) return { reviewed, verified: false, decision: null };
	const answered = checkpoints
		.filter((checkpoint) => checkpoint.scope_uri === `project://validations/${text(verify.id)}` && checkpoint.trust === "attested" && checkpoint.status === "resolved")
		.sort((a, b) => text(b.answer?.answered_at).localeCompare(text(a.answer?.answered_at)))[0];
	const picked = answered?.resolution?.selected_option;
	const note = authorNote(answered);
	return { reviewed, verified: true, decision: picked === ACCEPT || picked === REVISE ? picked : null, ...(note ? { note } : {}) };
}

/** How the desk records the text an author attaches to a gate answer, inside the checkpoint's resolution summary. */
const NOTE_LEAD = " The author's note: ";
const NOTE_LIMIT = 4000;

/** The note an author attached to an answer this desk attested; null when there is none or the answer is not the author's. */
function authorNote(checkpoint: Checkpoint | undefined): string | null {
	if (!checkpoint || checkpoint.trust !== "attested") return null;
	const summary = checkpoint.resolution?.summary ?? "";
	const at = summary.indexOf(NOTE_LEAD);
	return at < 0 ? null : summary.slice(at + NOTE_LEAD.length).trim() || null;
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
		if (latest.resolution?.selected_option !== APPROVE || latest.status !== "resolved") {
			const note = authorNote(latest);
			return {
				state: "declined",
				uri,
				file,
				sha256: digest,
				reason: `the author answered "${latest.resolution?.selected_option ?? latest.status}" on ${latest.id}, not approve${note ? `, with this note for the next plan: ${note}` : ""}`,
			};
		}
		const shown = ((latest.answer?.presented as Json | undefined)?.artifact as Json | undefined)?.sha256;
		if (shown !== digest)
			return confirmPlan ? { state: "changed", uri, file, sha256: digest, reason: `the plan changed after the author approved it on ${latest.id}` } : policy;
		return { state: "approved", uri, file, sha256: digest, reason: `approved by the author on ${latest.id}`, approvedAt: text(latest.answer?.answered_at) };
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
	const gap = evidenceGap(section);
	if (gap) reasons.push(`${gap}; run research-gap first`);
	return reasons;
}

/** Why a literature-heavy section's evidence does not cover it yet; null when it does or when it needs no research. */
function evidenceGap(section: SectionRow): string | null {
	if (!section.research.required) return null;
	if (section.unsupported.length > 0)
		return `${section.unsupported.length} required ${section.unsupported.length === 1 ? "claim lacks" : "claims lack"} verified evidence (${section.unsupported.slice(0, 3).join(", ")})`;
	if (section.research.claimless) return "it requires research but records no claim that needs evidence, so no source can be shown to cover it";
	return null;
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
		const index = coverage.indexRecords(entries, collection, (id) => `.planning/${collection}/${id}.json`);
		ignored.push(...index.ignored);
		return index.byUri;
	};
	const sourceRecords = indexed("sources");
	const evidenceRecords = indexed("evidence");

	const validations = listJson(workspace, ".planning/validations")
		.map((file) => {
			const record = readRecord(workspace, file);
			// The desk writes every record itself, so the file's time is a clock the model cannot set.
			if (record) recordedAt.set(record, writtenAt(workspace, file) ?? 0);
			return record;
		})
		.filter((record): record is Json => record !== null);

	const outlined = Array.isArray(outline?.sections) ? (outline.sections as Json[]) : [];
	const loaded = outlined.map((entry) => {
		const id = text(entry.id, "section");
		// A section file holds the section its directory names; a record with another id is not this section's.
		const file = `.planning/sections/${id}/section.json`;
		const found = readRecord(workspace, file);
		if (found && found.id !== id) ignored.push({ file, reason: `it holds section ${String(found.id)}, not ${id}` });
		const record = found && found.id === id ? found : null;
		const artifacts = (record?.artifacts ?? {}) as Json;
		const manuscript = manuscriptFile(workspace, artifacts.manuscript ?? `project://paper/${id}`, outputFormat);
		const source = manuscript ? readText(workspace, manuscript) : null;
		return { entry, id, record, artifacts, manuscript, source };
	});
	// A manuscript that exists but cannot be read safely, or that a drafted section lacks, leaves its citations unchecked.
	const unread = loaded.flatMap((item) => {
		if (item.source !== null) return [];
		const drafted = ["writing", "reviewing", "complete"].includes(text(item.record?.status));
		if (item.manuscript === null)
			return drafted ? [{ section: item.id, file: text((item.artifacts as Json).manuscript), reason: "its manuscript link does not name a file under paper/" }] : [];
		let present = false;
		try {
			lstatSync(path.join(workspace, item.manuscript));
			present = true;
		} catch {
			present = false;
		}
		if (present) return [{ section: item.id, file: item.manuscript, reason: "it is a link, not a regular file, or too large" }];
		const status = text(item.record?.status);
		return ["writing", "reviewing", "complete"].includes(status) ? [{ section: item.id, file: item.manuscript, reason: `the section is ${status} but its manuscript does not exist` }] : [];
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
		unread,
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
			research: {
				required: research.required === true,
				present: readBytes(workspace, `${base}/research.md`) !== null,
				claimless: !claims.some((claim) => claim.evidence_required === true && claim.status !== "rejected"),
			},
			dependsOn: Array.isArray(entry.depends_on) ? entry.depends_on.filter((dep): dep is string => typeof dep === "string") : [],
			plan: planState(workspace, id, record, checkpoints, confirmPlan),
			unsupported,
			record,
			acceptance: acceptanceOf(validations, checkpoints, id, text(artifacts.manuscript, `project://paper/${id}`), reviews.length > 0, writtenAt(workspace, manuscript)),
			writtenAt: writtenAt(workspace, manuscript),
			writeValidatedAt: writeValidatedAt(validations, id, text(artifacts.manuscript, `project://paper/${id}`)),
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
		audit: auditOf(validations, sections),
		delivered: deliveredOf(validations, sections),
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

/**
 * Writes a new file and flushes it where the process may. Node's permission
 * model, which Clio runs the desk under, refuses every flush (fsync,
 * fdatasync, flush: true) with ERR_ACCESS_DENIED, so there a write is still
 * all-or-nothing by its rename but not durable across power loss. A file that
 * could not be written whole is removed.
 */
function writeDurably(file: string, data: string): void {
	const handle = openSync(file, "wx", 0o644);
	try {
		writeSync(handle, data);
		try {
			fsyncSync(handle);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ERR_ACCESS_DENIED") throw error;
		}
	} catch (error) {
		closeSync(handle);
		try {
			unlinkSync(file);
		} catch {
			// Already removed.
		}
		throw error;
	}
	closeSync(handle);
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
 * journal exists only after every staged file was written whole, so finishing it is
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
/** The time a record type is created at; the desk stamps it on create when the writer leaves it out, since a model has no clock. */
const CREATED_AT: Readonly<Record<string, string>> = { validation: "executed_at", checkpoint: "created_at", evidence: "verified_at" };

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
	try {
		return prepareRecord(workspace, input, origin, armed);
	} catch (error) {
		// A create refused for its content carries the record's example, so the next call can succeed.
		const route = RECORD_URIS.find((entry) => entry.pattern.test(input.uri));
		const creating = route !== undefined && !existsSync(path.join(workspace, route.file(route.pattern.exec(input.uri)?.[1] ?? "")));
		const content = error instanceof Error && /holds wtfp\.project|whose id is|project_id|belongs to project|would not validate/u.test(error.message);
		if (creating && content && route) throw new Error(withTemplate((error as Error).message, route.type));
		throw error;
	}
}

function prepareRecord(workspace: string, input: RecordWrite, origin: "agent" | "desk", armed: Armed | null): Prepared {
	const { uri } = input;
	const record = input.record;
	if (record === null || typeof record !== "object" || Array.isArray(record)) throw new Error(`${uri}: record must be a JSON object`);
	const route = RECORD_URIS.find((entry) => entry.pattern.test(uri));
	if (!route) throw new Error(notARecord(uri));
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
		throw new Error(
			projectId === undefined
				? `${uri} needs project_id "${manifest.id}"`
				: `${uri} belongs to project ${String(projectId)}, not ${manifest.id}`,
		);
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
			`${uri} already exists; read it with extension_wtfp__read_record and pass ${REVISIONED.has(route.type) ? "the revision you read as expect_revision" : "the sha256 you read as expect_sha256"} so a newer change is never overwritten, then send the write again. A missing version is not a refusal and does not end the step`,
		);
	} else {
		const byRevision = input.expect_revision !== undefined && REVISIONED.has(route.type) && input.expect_revision === priorRevision;
		const bySha = input.expect_sha256 !== undefined && input.expect_sha256 === priorSha;
		if (!byRevision && !bySha)
			throw new Error(
				REVISIONED.has(route.type) && input.expect_revision !== undefined
					? `${uri} is at revision ${String(priorRevision)}, not ${input.expect_revision}; read it again and send the write again. A stale read is not a refusal and does not end the step`
					: `${uri} changed since it was read; read it again and send the write again. A stale read is not a refusal and does not end the step`,
			);
	}
	if (origin === "agent" && armed && !declares(armed, uri, bytes === null ? "create" : "update"))
		throw new Error(`${armed.action} does not declare ${bytes === null ? "creating" : "updating"} ${uri}; record what remains as a handoff instead`);
	if (origin === "agent" && route.type === "checkpoint") {
		const plan = new RegExp(`^project://sections/(${IDENTIFIER})/plans/${IDENTIFIER}$`, "u").exec(text(prior?.scope_uri));
		const owner = plan ? readRecord(workspace, `.planning/sections/${plan[1]}/section.json`) : null;
		const plans = plan && owner?.id === plan[1] ? ((owner.artifacts as Json | undefined)?.plans as unknown[] | undefined) : undefined;
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
	const createdAt = CREATED_AT[route.type];
	// A model has no clock: an invented time can order a validation before the answer it follows, so the desk's time stands.
	if (bytes === null && createdAt && (origin === "agent" || next[createdAt] === undefined)) next[createdAt] = timestamp();
	const errors = validateRecord(next);
	// Every error at once: a model fixing one per call resends its whole context each time.
	if (errors.length > 0)
		throw new Error(
			`${uri} would not validate: ${errors.slice(0, 8).join("; ")}${errors.length > 8 ? `; and ${errors.length - 8} more` : ""}. Fix these and send the write again; a record that does not validate is not a refusal and does not end the step`,
		);
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
	/** The catalog action this step runs, when one does. */
	action?: string;
	/** The section the action takes as its input, when it takes one. */
	section?: string | null;
	/** The checkpoint that must be answered first, when a gate holds the way. */
	gate?: string;
}

/** One rung of the ladder; a step only the absent plugin can run says so instead of naming it. */
function step(served: ServedPlugin, action: string, args: string, reason: string, gate?: string): Next {
	const command = commandFor(served, action, args);
	const named = { action, section: args || null, ...(gate ? { gate } : {}) };
	return command ? { command, reason, ...named } : { command: null, reason: `${reason} Its next step, ${action}, needs the WTF-P plugin.`, ...named };
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
			gate.id,
		);
	if (desk.sections.length === 0) return step(served, "create-outline", "", "No outline yet.");
	// new-paper writes an outline but no section records, and only create-outline
	// declares creating one; every later action may only update it.
	const unrecorded = desk.sections.filter((section) => section.record === null).map((section) => section.id);
	if (unrecorded.length > 0)
		return step(served, "create-outline", "", `The outline lists ${unrecorded.join(", ")} without a section record; create-outline creates them.`);
	const complete = new Set(desk.sections.filter((section) => section.status === "complete").map((section) => section.id));
	const ordered = [...desk.sections].sort((a, b) => a.wave - b.wave);
	for (const section of ordered) {
		if (section.status === "complete") continue;
		if (!section.dependsOn.every((dep) => complete.has(dep)) && section.status === "not-started") continue;
		return sectionNext(served, section);
	}
	if (desk.phase === "delivered" || desk.delivered) return { command: null, reason: "Delivered: every section is complete, audited and archived; a later change reopens review." };
	// audit-milestone writes only its validation, so the audit itself, not a phase it cannot set, says the draft is ready.
	if (desk.phase === "ready" || (desk.audit?.fresh && desk.audit.errors === 0)) return step(served, "submit-milestone", "", "Every section is complete and audited.");
	if (desk.audit?.fresh)
		return step(served, "plan-milestone-gaps", "", `The milestone audit found ${desk.audit.errors} ${desk.audit.errors === 1 ? "error" : "errors"} to close before delivery.`);
	return step(served, "audit-milestone", "", "Every section is complete; audit before delivery.");
}

/**
 * The latest audit-milestone validation, by the desk's file time. It is fresh
 * when no other validation and no manuscript was written after it, so an audit
 * of an earlier draft never stands for the current one.
 */
function auditOf(validations: Json[], sections: SectionRow[]): Desk["audit"] {
	const at = (record: Json): number => recordedAt.get(record) ?? 0;
	const audits = validations.filter((record) => record.action_id === "audit-milestone").sort((a, b) => at(b) - at(a));
	const latest = audits[0];
	if (!latest) return null;
	const later = validations.some((record) => record.action_id !== "audit-milestone" && at(record) > at(latest)) || sections.some((section) => (section.writtenAt ?? 0) > at(latest));
	const errors = (Array.isArray(latest.issues) ? (latest.issues as Json[]) : []).filter((issue) => issue.severity === "error" || issue.severity === "blocker").length;
	return { fresh: !later && latest.status !== "failed", errors: latest.status === "failed" ? Math.max(errors, 1) : errors };
}

/** Whether the latest passed milestone submission still stands: nothing but audits and submissions came after it. */
function deliveredOf(validations: Json[], sections: SectionRow[]): boolean {
	const at = (record: Json): number => recordedAt.get(record) ?? 0;
	const submitted = validations.filter((record) => record.action_id === "submit-milestone" && record.status === "passed").sort((a, b) => at(b) - at(a))[0];
	if (!submitted) return false;
	const delivery = new Set(["audit-milestone", "submit-milestone"]);
	return !validations.some((record) => !delivery.has(text(record.action_id)) && at(record) > at(submitted)) && !sections.some((section) => (section.writtenAt ?? 0) > at(submitted));
}

/** A drafted section's next step: review the current draft, then the author's acceptance or a revision. */
function reviewNext(served: ServedPlugin, section: SectionRow): Next {
	const id = section.id;
	const acceptance = section.acceptance;
	if (unappliedPlan(section)) return step(served, "write-section", id, `${section.title} has an approved revision plan that no draft has applied yet.`);
	if (!acceptance.reviewed) return step(served, "review-section", id, `${section.title} is drafted and waits for review.`);
	if (!acceptance.verified)
		return step(served, "verify-work", id, `${section.title} is reviewed; the author checks it against its plan and accepts it or sends it back.`);
	if (acceptance.decision === REVISE)
		return step(served, "plan-revision", id, `The author sent ${section.title} back for revision${acceptance.note ? `, with this note: ${acceptance.note}` : "."}`);
	return step(
		served,
		"verify-work",
		id,
		acceptance.decision === ACCEPT ? `The author accepted ${section.title}; verify-work marks it complete.` : `${section.title} waits for the author's acceptance.`,
	);
}

/** The next step for one section, by the same ladder the band follows. */
function sectionNext(served: ServedPlugin, section: SectionRow): Next {
	const id = section.id;
	if (section.gates.length > 0) return step(served, "check-todos", "", `${section.title} waits on a gate.`, section.gates[0]?.id);
	switch (section.status) {
		case "complete":
			return step(served, "review-section", id, `${section.title} is complete; review it again if it changed.`);
		case "blocked":
			return step(served, "check-todos", "", `${section.title} is blocked.`);
		case "reviewing":
			return reviewNext(served, section);
		case "writing":
		case "planned":
			if (evidenceGap(section))
				return step(served, "research-gap", id, `${section.title}: ${evidenceGap(section)}.`);
			if (!planReady(section.plan))
				return step(served, "plan-section", id, `${section.title} cannot be drafted: ${section.plan.reason}.`);
			// A draft written and validated after its plan's approval is past drafting even when the record still says writing.
			if (section.plan.state === "approved" && section.plan.approvedAt && !unappliedPlan(section)) return reviewNext(served, section);
			return step(served, "write-section", id, `${section.title} has an approved plan.`);
		default:
			if (!section.stages.discuss) return step(served, "discuss-section", id, `Settle what ${section.title} must argue.`);
			if (section.research.required && !section.research.present)
				return step(served, "research-gap", id, `${section.title} needs verified evidence first.`);
			if (evidenceGap(section))
				return step(served, "research-gap", id, `${section.title}: ${evidenceGap(section)}.`);
			return step(served, "plan-section", id, `${section.title} is ready to plan.`);
	}
}

// --- driver --------------------------------------------------------------------

/**
 * The actions `/wtfp:advance` may chain. Each runs under its own contract; the
 * driver never runs an action that starts, maps or reshapes the project, since
 * those are the author's to begin.
 */
const DRIVEN = new Set(["create-outline", "discuss-section", "research-gap", "plan-section", "write-section", "review-section", "verify-work", "plan-revision", "audit-milestone", "submit-milestone"]);
/** Steps one advance run may take before it hands the session back. */
const MAX_DRIVE_STEPS = 24;

/** One `/wtfp:advance` run: the steps the desk armed and the gates it put to the author. */
interface Drive {
	workspace: string;
	/** `finish`: the step was handed back once to record outputs it skipped. */
	steps: Array<{ action: string; section: string | null; fingerprint: string; finish?: boolean }>;
	asked: string[];
}

type DriveDecision =
	| { kind: "step"; action: string; section: string | null; prompt: string; reason: string; finish?: boolean }
	| { kind: "gate"; checkpoint: string; reason: string }
	| { kind: "stop"; reason: string };

/** What the project looks like to the ladder; an unchanged fingerprint means a step changed nothing it reads. */
function driveFingerprint(desk: Desk): string {
	return sha256(
		JSON.stringify({
			phase: desk.phase,
			status: desk.status,
			sections: desk.sections.map((section) => [
				section.id,
				section.status,
				section.stages,
				section.plan.state,
				section.plan.sha256,
				section.unsupported,
				section.research,
				section.words,
				section.recorded,
				section.acceptance,
				section.gates.map((gate) => [gate.id, gate.status, gate.trust]),
			]),
			checkpoints: desk.checkpoints.map((checkpoint) => [checkpoint.id, checkpoint.status, checkpoint.trust]),
			sources: desk.sources,
			evidence: desk.evidence,
		}),
	);
}

/**
 * The driver's next move, chosen by the same ladder `progress` follows. The
 * desk, never the model, picks the action and section; the model only runs it.
 */
function driveStep(desk: Desk, drive: Drive): DriveDecision {
	if (!desk.present)
		return { kind: "stop", reason: "There is no WTF-P project here yet. Start one with new-paper, or map-project for an existing manuscript; advance continues a project, it never starts one." };
	const next = nextAction(desk);
	if (next.gate) {
		if (drive.asked.includes(next.gate)) return { kind: "stop", reason: `${next.gate} is still waiting on you. ${next.reason}` };
		return { kind: "gate", checkpoint: next.gate, reason: next.reason };
	}
	if (!next.action || next.action === "check-todos") return { kind: "stop", reason: next.reason };
	if (!DRIVEN.has(next.action))
		return { kind: "stop", reason: `${next.reason} The next action, ${next.command ?? next.action}, starts or reshapes the project, so it is yours to run.` };
	if (next.command === null) return { kind: "stop", reason: next.reason };
	if (!GUARD.actions[next.action]) return { kind: "stop", reason: `${next.action} is not available on this host, so the desk cannot arm it.` };
	if (drive.steps.length >= MAX_DRIVE_STEPS)
		return { kind: "stop", reason: `This run took ${MAX_DRIVE_STEPS} steps, its limit. Run advance again to continue from ${next.command}.` };
	const section = next.section ?? null;
	const fingerprint = driveFingerprint(desk);
	const last = drive.steps[drive.steps.length - 1];
	if (last && last.action === next.action && last.section === section && last.fingerprint === fingerprint) {
		// Live, review-section reported findings and skipped its review record; one hand-back names what to record.
		const creates = (GUARD.actions[next.action]?.produces ?? []).filter((output) => output.mode === "create").map((output) => output.uri.replace("{section}", section ?? "{section}"));
		if (!last.finish && creates.length > 0)
			return {
				kind: "step",
				action: next.action,
				section,
				prompt: `ai.iowarp.clio/prompts/wtfp/${next.action}.md`,
				reason: `Continue ${next.command}; it has not failed. It recorded nothing the next step depends on, so record its outputs for what it found, whatever the outcome (${creates.join(", ")}), then call extension_wtfp__next_step. Do not repeat its work.`,
				finish: true,
			};
		return { kind: "stop", reason: `${next.command} ran and changed nothing the next step depends on, so the desk stops instead of repeating it. ${next.reason}` };
	}
	return { kind: "step", action: next.action, section, prompt: `ai.iowarp.clio/prompts/wtfp/${next.action}.md`, reason: next.reason };
}

/**
 * Every next_step result ends with this rule, so a turn Clio compacted after
 * dropping the advance prompt can still continue from the last result alone.
 */
const DRIVER_RULE =
	"Driver rule for this /wtfp:advance run: the desk, not you, picks every step, so finish the step it armed and call extension_wtfp__next_step with after naming that step (\"start\" for the first call), call extension_wtfp__gate with the checkpoint it names and then extension_wtfp__next_step, and on a stop, a failed step or a refused call report the steps taken and end the turn without choosing another action.";

/** Where a step's prompt lives, stated so it survives the loss of the advance prompt's resolved plugin root. */
function stepPrompt(prompt: string): string {
	return `<plugin root>/${prompt}, where <plugin root> is the WTF-P plugin root (two directories above the base_dir of the loaded wtfp-manage-project skill; the prompt's \${pluginRoot} paths mean that root)`;
}

/** The arming of an advance run between steps: nothing may be written until the desk arms a step. */
function idleArm(workspace: string): Armed {
	return { action: "advance", produces: [], section: null, workspace };
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

/** verify-work's closing question: an acceptance checkpoint scoped to its validation. */
function acceptanceGate(checkpoint: Checkpoint): boolean {
	return new RegExp(`^project://validations/${IDENTIFIER}$`, "u").test(checkpoint.scope_uri) && (checkpoint.options ?? []).some((option) => option.id === ACCEPT);
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
	// Only `accept` completes a section, so only it reads as acceptance.
	if (acceptanceGate(checkpoint)) {
		if (option.id === ACCEPT) return { label: "Accept this section as written", detail: "It is marked complete; a later change needs review and your acceptance again." };
		if (option.id === REVISE) return { label: "Send it back for revision", detail: "The next step plans a revision for you to approve." };
		if (/accept/iu.test(option.label)) return { label: `Do not accept it yet (${option.id})`, detail: "Any answer but accept leaves the section unaccepted." };
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

async function ask(ctx: ExtensionContextV2, desk: Desk, checkpoint: Checkpoint, hint?: string): Promise<InterviewStep> {
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
				...(hint ? [{ t: "text", text: hint, tone: "warning", wrap: "wrap" } as View] : []),
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
async function answer(ctx: ExtensionContextV2, stepKey: string, picked: unknown, note: string | null = null): Promise<AnswerResult> {
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
	let linkedIn: string | null = null;
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
						summary: `${
							option
								? `The author chose "${shown(checkpoint, option).label}" at the Clio WTF-P desk.`
								: picked === WAIVE
									? "The author waived this gate at the Clio WTF-P desk."
									: "The author marked this done at the Clio WTF-P desk."
						}${note ? `${NOTE_LEAD}${note}` : ""}`,
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
		// The author's approval links the plan in the same commit: live, the model asked the desk for its next
		// step before linking, and the approved plan sat unlinked while the driver planned again.
		const planned = option?.id === APPROVE && planGate(checkpoint) ? /^project:\/\/sections\/([^/]+)\/plans\//u.exec(checkpoint.scope_uri)?.[1] : undefined;
		const sectionFile = planned ? `.planning/sections/${planned}/section.json` : null;
		const section = sectionFile ? readRecord(workspace, sectionFile) : null;
		if (planned && sectionFile && section) {
			const artifacts = isObject(section.artifacts) ? section.artifacts : {};
			const plans = Array.isArray(artifacts.plans) ? (artifacts.plans as unknown[]) : [];
			if (plans[plans.length - 1] !== checkpoint.scope_uri) {
				linkedIn = `project://sections/${planned}`;
				const status = text(section.status, "not-started");
				writes.push({
					input: {
						uri: `project://sections/${planned}`,
						expect_sha256: sha256(readBytes(workspace, sectionFile) ?? ""),
						record: {
							...section,
							status: status === "not-started" ? "planned" : status,
							artifacts: { ...artifacts, plans: [...plans.filter((entry) => entry !== checkpoint.scope_uri), checkpoint.scope_uri] },
						},
					},
				});
			}
		}
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
		text: `${option ? `${checkpoint.id}: ${shown(checkpoint, option).label}` : `${checkpoint.id}: ${picked === WAIVE ? "waived" : "done"}`}${
			linkedIn ? `. The desk linked ${checkpoint.scope_uri} in ${linkedIn} with this answer; do not link it again` : ""
		}. The desk wrote ${writes
			.slice(1)
			.map((entry) => entry.input.uri)
			.join(", ")}; read any of them again before writing it`,
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

/** The text the author attached to their chosen option, bounded; null when none. */
function noteOf(event: { notes?: Record<string, string> }): string | null {
	const note = event.notes?.choice?.replace(/\s+/gu, " ").trim() ?? "";
	return note ? note.slice(0, NOTE_LIMIT) : null;
}

const FREE_TEXT = "A typed answer names no option, so nothing was recorded. Choose an option and attach your text to it with [n] note.";

/**
 * A gate answered with free text instead of an option. Nothing is recorded and
 * the question's binding is spent; the text goes back with how to send it.
 */
async function freeText(ctx: ExtensionContextV2, event: { step: string; answers: Record<string, string | string[]>; other?: Record<string, true> }): Promise<AnswerResult | null> {
	if (event.other?.choice !== true) return null;
	const nonce = /^gate\.([a-f0-9]{12})$/u.exec(event.step)?.[1];
	const asked = nonce ? (await ctx.state.get<Asked>(`ask:${nonce}`)).value : undefined;
	if (nonce) await ctx.state.delete(`ask:${nonce}`);
	const typed = String(choiceOf(event.answers) ?? "").replace(/\s+/gu, " ").trim().slice(0, NOTE_LIMIT);
	return {
		kind: "refused",
		text: `The author typed an answer instead of choosing an option, so nothing was recorded and the gate stays pending. Ask again; the author chooses an option and attaches their text with [n] note.${typed ? ` They wrote: "${typed}"` : ""}`,
		...(asked ? { checkpoint: asked.checkpoint } : {}),
	};
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
	// The manifest lets unknown top-level keys through so the desk, not the gateway, can say where they belong:
	// a long record whose object closed early leaves its last fields beside it.
	const stray = Object.keys(input).filter((key) => !["uri", "record", "expect_revision", "expect_sha256", "writes"].includes(key));
	let folded: string[] = [];
	if (stray.length > 0) {
		const record = input.record !== null && typeof input.record === "object" && !Array.isArray(input.record) ? (input.record as Json) : null;
		const fields = record ? recordFields(text(record.schema)) : new Set<string>();
		// Fields the record's own schema defines and the record lacks are folded in; validation still judges the result.
		if (!record || stray.some((key) => !fields.has(key) || key in record))
			throw new Error(`${stray.join(", ")} ${stray.length === 1 ? "is not a record tool argument" : "are not record tool arguments"}; if ${stray.length === 1 ? "it is a field" : "they are fields"} of the record, put ${stray.length === 1 ? "it" : "them"} inside record and send the call again`);
		input = { ...input, record: { ...record, ...Object.fromEntries(stray.map((key) => [key, input[key]])) } };
		for (const key of stray) delete input[key];
		folded = stray;
	}
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
			...(folded.length > 0 ? [`${folded.join(", ")} arrived beside record and were moved inside it; send record fields inside record.`] : []),
			...done.map((write) => `Wrote ${write.uri}${write.revision === null ? "" : ` at revision ${write.revision}`}; it validated and read back (sha256 ${write.sha256}).`),
			...(done.length > 1 ? ["They committed together."] : []),
		].join(" "),
		data:
			done.length === 1
				? { uri: done[0]?.uri, file: done[0]?.file, revision: done[0]?.revision, sha256: done[0]?.sha256 }
				: { writes: done.map((write) => ({ uri: write.uri, file: write.file, revision: write.revision, sha256: write.sha256 })) },
	};
}

/**
 * Authored artifacts keep their own format and are read and written with
 * Clio's file tools; a refusal names the conventional file so the model does
 * not search the workspace for it.
 */
const ARTIFACT_URIS: ReadonlyArray<{ pattern: RegExp; file: (match: RegExpExecArray) => string }> = [
	{ pattern: new RegExp(`^project://sections/(${IDENTIFIER})/(context|research|summary|handoff)$`, "u"), file: (m) => `.planning/sections/${m[1]}/${m[2]}.md` },
	{ pattern: new RegExp(`^project://sections/(${IDENTIFIER})/(plans|reviews)/(${IDENTIFIER})$`, "u"), file: (m) => `.planning/sections/${m[1]}/${m[2]}/${m[3]}.md` },
	{ pattern: /^project:\/\/paper\/([^\s]+)$/u, file: (m) => `paper/${m[1]}` },
];

function notARecord(uri: string): string {
	for (const artifact of ARTIFACT_URIS) {
		const match = artifact.pattern.exec(uri);
		if (match) return `${uri} is an authored artifact, not a JSON record; read or write ${artifact.file(match)} with the file tools`;
	}
	const family = /^project:\/\/(sections|sources|evidence|checkpoints|validations)\/([^/]+)$/u.exec(uri);
	if (family && !new RegExp(`^${IDENTIFIER}$`, "u").test(family[2] ?? ""))
		return `${uri} has an invalid id; record ids are lowercase letters and digits joined by single hyphens, such as ${(family[2] ?? "").toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || "outline-gate"}`;
	return `${uri} is not a logical record URI this adapter maps`;
}

/** How much record JSON one family read returns before it names the rest by id. */
const FAMILY_LIMIT = 48 * 1024;

/**
 * Every record of one family, such as `project://sources`, in one call: each
 * as a single read returns it, until the family outgrows FAMILY_LIMIT; the
 * rest are named so they can be read one at a time.
 */
function readFamily(ctx: ExtensionContextV2, desk: Desk, collection: string, after: string | null = null): { text: string; data: unknown } {
	const workspace = ctx.snapshot.workspace;
	const identifier = new RegExp(`^${IDENTIFIER}$`, "u");
	let ids: string[];
	if (collection === "sections") {
		const directory = contained(workspace, ".planning/sections");
		ids =
			directory === null || !existsSync(directory) || !lstatSync(directory).isDirectory()
				? []
				: readdirSync(directory, { withFileTypes: true })
						.filter((entry) => entry.isDirectory() && identifier.test(entry.name) && readBytes(workspace, `.planning/sections/${entry.name}/section.json`) !== null)
						.map((entry) => entry.name)
						.sort();
	} else ids = listJson(workspace, `.planning/${collection}`).map((file) => path.posix.basename(file, ".json")).filter((id) => identifier.test(id));
	const records: unknown[] = [];
	const omitted: string[] = [];
	const failed: string[] = [];
	let size = 0;
	const total = ids.length;
	if (after !== null) ids = ids.filter((id) => id > after);
	for (const id of ids) {
		if (omitted.length > 0) {
			omitted.push(id);
			continue;
		}
		let one: { data: unknown };
		try {
			one = readTool(ctx, desk, `project://${collection}/${id}`);
		} catch (error) {
			failed.push(`${id} (${error instanceof Error ? error.message : String(error)})`);
			continue;
		}
		const length = JSON.stringify(one.data).length;
		if (records.length > 0 && size + length > FAMILY_LIMIT) {
			omitted.push(id);
			continue;
		}
		records.push(one.data);
		size += length;
	}
	const uri = `project://${collection}`;
	return {
		text: [
			total === 0 ? `${uri} holds no records yet.` : `${uri} holds ${total} ${total === 1 ? "record" : "records"}; ${records.length}${after !== null ? ` after ${after}` : ""} returned in full, each with the revision and sha256 to pass back to record.`,
			omitted.length > 0 ? `${omitted.length} more not returned, to keep this read small; read the next page with ${uri}?after=${String((records[records.length - 1] as Json | undefined)?.uri ?? "").split("/").pop()}.` : "",
			failed.length > 0 ? `Not readable: ${failed.join("; ")}.` : "",
		]
			.filter(Boolean)
			.join(" "),
		data: { uri, records, omitted, ...(failed.length > 0 ? { failed } : {}) },
	};
}

function readTool(ctx: ExtensionContextV2, desk: Desk, uri: string): { text: string; data: unknown } {
	const workspace = ctx.snapshot.workspace;
	const family = new RegExp(`^project://(sections|sources|evidence|checkpoints|validations|interactions)/?\\*?(?:\\?after=(${IDENTIFIER}))?$`, "u").exec(uri);
	if (family) return readFamily(ctx, desk, family[1] as string, family[2] ?? null);
	const route = RECORD_URIS.find((entry) => entry.pattern.test(uri));
	if (!route) throw new Error(notARecord(uri));
	const file = route.file(route.pattern.exec(uri)?.[1] ?? "");
	const bytes = readBytes(workspace, file);
	if (bytes === null) {
		if (contained(workspace, file) === null) throw new Error(`${uri} is reached through a symbolic link; the desk does not follow links`);
		return { text: withTemplate(`${uri} does not exist yet; create it without expect_revision or expect_sha256.`, route.type), data: { uri, file, exists: false } };
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

/**
 * An immutable milestone snapshot: every `.planning` file outside the archives
 * and every `paper/` file, copied byte for byte under
 * `.planning/archives/<archive>/` beside a manifest of their sha256 digests.
 * Live, a model could not copy a whole project by hand within a turn. Only an
 * armed action that declares the archive may make one, links are never
 * followed, and an existing archive is never touched.
 */
function archiveProject(workspace: string, archive: string, armed: Armed | null, projectId: string | null): { uri: string; files: number; manifest: string; sha256: string } {
	if (!new RegExp(`^${IDENTIFIER}$`, "u").test(archive)) throw new Error(`${archive} is not a valid archive id; use lowercase letters and digits joined by single hyphens`);
	const uri = `project://archives/${archive}`;
	if (!armed || !declares(armed, `${uri}/manifest.json`, "archive"))
		throw new Error(`${armed ? armed.action : "nothing armed"} does not declare archiving ${uri}; only the action that owns a milestone archive may make one`);
	return withLock(workspace, () => {
		recover(workspace);
		const target = `.planning/archives/${archive}`;
		const destination = contained(workspace, target);
		if (destination === null) throw new Error(`${target} is reached through a symbolic link; the desk does not follow links`);
		if (existsSync(destination)) throw new Error(`${uri} already exists, and an archive is immutable; choose another id`);
		const files: Array<{ path: string; sha256: string; bytes: number }> = [];
		const walk = (relative: string): void => {
			const directory = contained(workspace, relative);
			if (directory === null || !existsSync(directory) || !lstatSync(directory).isDirectory()) return;
			for (const entry of readdirSync(directory, { withFileTypes: true })) {
				const child = path.posix.join(relative, entry.name);
				if (entry.name.startsWith(".") || child === ".planning/archives" || entry.isSymbolicLink()) continue;
				if (entry.isDirectory()) walk(child);
				else if (entry.isFile()) {
					const bytes = readBytes(workspace, child);
					if (bytes === null) throw new Error(`${child} could not be read whole, so the archive would be incomplete`);
					files.push({ path: child, sha256: sha256(bytes), bytes: bytes.length });
				}
			}
		};
		walk(".planning");
		walk("paper");
		const staging = `${destination}.staging-${randomBytes(4).toString("hex")}`;
		mkdirSync(staging, { recursive: true });
		for (const file of files) {
			const out = path.join(staging, file.path);
			mkdirSync(path.dirname(out), { recursive: true });
			writeFileSync(out, readFileSync(path.join(workspace, file.path)));
		}
		const manifest = `${JSON.stringify({ archive: uri, project_id: projectId, created_at: timestamp(), files }, null, 2)}\n`;
		writeFileSync(path.join(staging, "manifest.json"), manifest);
		renameSync(staging, destination);
		return { uri, files: files.length, manifest: `${target}/manifest.json`, sha256: sha256(manifest) };
	});
}

function measureSection(workspace: string, sectionId: string, key: Buffer | null, armed: Armed | null): { words: number; target: number; file: string | null; total: number; recorded: boolean } {
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
		// An action that may not update these records still gets the desk's count, so it never counts by hand.
		if (armed && !writes.every((write) => declares(armed, write.uri, "update")))
			return { words: section.words, target: section.target, file: section.manuscript, total: recorded, recorded: false };
		const prepared = writes.map((write) => prepare(workspace, write, "agent", armed));
		commit(workspace, prepared.map((entry) => entry.write));
		return { words: section.words, target: section.target, file: section.manuscript, total: recorded, recorded: true };
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

/**
 * The project as one compact record for an agent: what an action would
 * otherwise reconstruct from many record reads. It reports, never decides;
 * an action still reads the records it will change or quote.
 */
function statusDigest(desk: Desk): Json {
	const next = nextAction(desk);
	return {
		present: desk.present,
		...(desk.present
			? {
					project: { id: desk.projectId, title: desk.title, document_type: desk.documentType, venue: desk.venue, deadline: desk.deadline, argument: desk.argument },
					phase: desk.phase,
					status: desk.status,
					words: { total: totalWords(desk), target: desk.targetWords, method: WORD_METHOD },
					sections: desk.sections.map((section) => ({
						id: section.id,
						title: section.title,
						wave: section.wave,
						status: section.status,
						depends_on: section.dependsOn,
						words: section.words,
						target: section.target,
						manuscript: section.manuscript,
						stages: section.stages,
						plan: { state: section.plan.state, uri: section.plan.uri, reason: section.plan.reason },
						research_required: section.research.required,
						claims: section.claims,
						unsupported_claims: section.unsupported,
						blockers: blockers(desk, section),
					})),
					open_gates: openGates(desk).map((gate) => ({ id: gate.id, kind: gate.kind, scope: gate.scope_uri, request: gate.request, trust: gate.trust })),
					evidence: { sources: desk.sources, evidence: desk.evidence },
					issues: desk.issues,
					invalid_records: desk.invalid.map((entry) => entry.file),
					interrupted_write: desk.journal,
				}
			: {}),
		next: { action: next.action ?? null, section: next.section ?? null, gate: next.gate ?? null, command: next.command, reason: next.reason },
	};
}

/** Clio refuses effect text longer than this many UTF-16 code units. */
const EFFECT_TEXT_LIMIT = 2000;

/** Text cut to Clio's effect limit with `tail` appended, never splitting a surrogate pair. */
function clip(message: string, tail: string): string {
	if (message.length <= EFFECT_TEXT_LIMIT) return message;
	let end = EFFECT_TEXT_LIMIT - tail.length;
	const last = message.charCodeAt(end - 1);
	if (last >= 0xd800 && last <= 0xdbff) end -= 1;
	return `${message.slice(0, end)}${tail}`;
}

/** The desk's status as one reminder within Clio's effect limit. */
function statusReminder(desk: Desk): string {
	const gates = openGates(desk);
	const lines = [
		"WTF-P desk status at the start of this turn (extension_wtfp__status returns it as structured data):",
		progressText(desk),
		...(gates.length > 0 ? [`Open gates: ${gates.map((gate) => `${gate.id} (${gate.scope_uri.replace(/^project:\/\//u, "")})`).join(", ")}`] : []),
	];
	return clip(lines.join("\n"), "\n… (truncated; call extension_wtfp__status)");
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

/**
 * What Clio 0.6.3 and later resolve for a tool hook beside its `args`
 * (public-api-v2 ExtensionToolHookLanding): where a path-taking tool lands,
 * and a dispatch call's tasks as admission parsed them. The desk judges only
 * these, never its own reading of a call, so it cannot drift from Clio's
 * grammar. Clio 0.6.2 sends `args` alone; the desk then refuses writes and
 * dispatches inside a WTF-P project or action and leaves the rest alone.
 */
interface HostTarget {
	path: string;
	resolved: boolean;
	/** The landing relative to the session's workspace, a worker's task worktree mapped back to the checkout; null outside it. */
	workspacePath?: string | null;
}

interface HostDispatchTask {
	role?: string;
	agent: string;
	cwd: string;
	writeRoots: string[];
	writeBoundaries: string[];
	worktree: boolean;
	readOnly: boolean;
}

type HostDispatch =
	| { kind: "tasks"; mode: string; tasks: HostDispatchTask[]; candidates?: number }
	| { kind: "list" }
	| { kind: "apply-winner"; branch: string; cwd: string };

interface HostLanding {
	target?: HostTarget;
	dispatch?: HostDispatch;
}

/** Roles that only judge a dispatch's work; Clio runs them read-only with no write roots. */
const GATE_ROLES = new Set(["reviewer", "judge", "member", "synthesis"]);

const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === "string");

/**
 * The host's facts for a hook event. A fact in a shape the desk cannot read,
 * or a dispatch kind it does not know, counts as no fact, and `malformed` says
 * so: the desk then refuses the call inside a WTF-P project or action and
 * leaves other folders alone, as for a host that sends none.
 */
function hostLanding(event: unknown): HostLanding & { malformed?: string } {
	const fields = isObject(event) ? event : {};
	const landing: HostLanding & { malformed?: string } = {};
	if (fields.target !== undefined) {
		const target = fields.target;
		if (
			!isObject(target) ||
			typeof target.path !== "string" ||
			typeof target.resolved !== "boolean" ||
			(target.workspacePath !== undefined && target.workspacePath !== null && typeof target.workspacePath !== "string")
		)
			landing.malformed = "landing";
		else landing.target = { path: target.path, resolved: target.resolved, workspacePath: target.workspacePath as string | null | undefined };
	}
	if (fields.dispatch !== undefined) {
		const dispatch = fields.dispatch;
		const tasks = isObject(dispatch) && dispatch.kind === "tasks" && typeof dispatch.mode === "string" && Array.isArray(dispatch.tasks) ? dispatch.tasks : null;
		if (isObject(dispatch) && dispatch.kind === "list") landing.dispatch = { kind: "list" };
		else if (isObject(dispatch) && dispatch.kind === "apply-winner" && typeof dispatch.branch === "string" && typeof dispatch.cwd === "string")
			landing.dispatch = { kind: "apply-winner", branch: dispatch.branch, cwd: dispatch.cwd };
		else if (
			tasks !== null &&
			tasks.every(
				(task) =>
					isObject(task) &&
					typeof task.agent === "string" &&
					typeof task.cwd === "string" &&
					strings(task.writeRoots) &&
					strings(task.writeBoundaries) &&
					task.writeRoots.length === task.writeBoundaries.length &&
					typeof task.worktree === "boolean" &&
					typeof task.readOnly === "boolean" &&
					(task.role === undefined || typeof task.role === "string"),
			)
		)
			landing.dispatch = {
				kind: "tasks",
				mode: (dispatch as Json).mode as string,
				tasks: (tasks as Json[]).map((task) => ({
					...(task.role === undefined ? {} : { role: task.role as string }),
					agent: task.agent as string,
					cwd: task.cwd as string,
					writeRoots: [...(task.writeRoots as string[])],
					writeBoundaries: [...(task.writeBoundaries as string[])],
					worktree: task.worktree as boolean,
					readOnly: task.readOnly as boolean,
				})),
			};
		else landing.malformed = "dispatch plan";
	}
	return landing;
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

/**
 * The held manuscript a worker root would reach, judged like a direct write:
 * by every section the path belongs to, so a `.tex` or `.typ` spelling of a
 * section whose file does not exist yet is held too.
 */
function heldBy(desk: Desk, held: string[], root: string): string | undefined {
	const hit = held.find((file) => overlaps(root, file));
	if (hit) return hit;
	const lexical = root.replace(/\/$/u, "");
	return sectionsForPaper(desk, lexical).some((section) => blockers(desk, section).length > 0) ? lexical : undefined;
}

/** Whether the session is in a WTF-P project or inside a WTF-P action, where a call the desk cannot judge is refused. */
async function projectOrArmed(ctx: ExtensionContextV2): Promise<boolean> {
	if (await armedFor(ctx)) return true;
	return loadDesk(ctx.snapshot.workspace, await storedKey(ctx, false)).present;
}

/** Why a host that sends no landing or dispatch plan cannot be guarded. */
const NEEDS_HOST_FACTS = "WTF-P needs Clio 0.6.3 or later, which tells the desk where each call lands and what each dispatch starts; this Clio does not, so the desk refuses the call inside a WTF-P project or action.";

/** Why a call Clio sent no usable facts for is refused, once this Clio has shown it sends them. */
async function missingFacts(ctx: ExtensionContextV2, malformed: string | undefined): Promise<string> {
	if (malformed) return `Clio's ${malformed} for this call is in a form the desk cannot read; refused.`;
	return (await ctx.state.get<boolean>("host-facts")).value ? "Clio sent no landing for this call, so the desk cannot see where it lands; refused." : NEEDS_HOST_FACTS;
}

/**
 * Where a write lands, relative to the project, or null outside it, as Clio
 * resolved it: the file the tool opens, which Clio refuses to change before
 * the tool runs, and for a worker in a task worktree the checkout path it
 * merges into.
 */
function writeLanding(target: string, workspace: string, host: HostTarget): { relative: string | null } | { refused: string } {
	if (!host.resolved) return { refused: `WTF-P write guard: Clio could not resolve where ${target} lands (a link loop, or a component it cannot inspect); refused.` };
	if (host.workspacePath !== undefined) return { relative: host.workspacePath };
	const root = realWorkspace(workspace);
	return { relative: inside(root, host.path) ? posix(path.relative(root, host.path)) || "." : null };
}

async function guardWrite(ctx: ExtensionContextV2, target: string, host?: HostTarget, malformed?: string): Promise<ExtensionHookResult> {
	const workspace = ctx.snapshot.workspace;
	const served = ctx.snapshot.plugin ?? null;
	if (!host) return (await projectOrArmed(ctx)) ? block(`WTF-P write guard: ${await missingFacts(ctx, malformed)}`) : {};
	const landed = writeLanding(target, workspace, host);
	if ("refused" in landed) return block(landed.refused);
	if (landed.relative === null) return {};
	const relative = landed.relative;
	if (deskOwned(relative)) return block(`WTF-P write guard: ${relative} is written only by the desk; nothing else may change it.`);
	if (under(".planning", relative) && relative.endsWith(".json") && !under(".planning/archives", relative))
		return block(
			`WTF-P write guard: ${relative} is a portable record; write it with extension_wtfp__record so it is validated and checked against the version you read.`,
		);
	const desk = loadDesk(workspace, await storedKey(ctx, false));
	const armed = await armedFor(ctx);
	// Clio's own artifact directory is no project file; a link that leads it into the project lands, and is judged, elsewhere.
	if (armed && !under(".clio-coder/artifacts", relative)) {
		const roots = writeRoots(desk, armed);
		if (!roots.some((allowed) => under(allowed, relative)))
			return block(
				armed.action === "advance"
					? `WTF-P write guard: nothing is armed between /wtfp:advance steps; refused ${relative}. Call extension_wtfp__next_step; it arms the step that may write, and that step's own prompt says what it writes.`
					: `WTF-P write guard: ${actionName(served, armed.action)}${armed.section ? ` ${armed.section}` : ""} may write only under ${roots.join(", ") || "nothing (it declares no file outputs)"}; refused ${relative}. Record other changes as a handoff instead.`,
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

/** One worker a dispatch names, as Clio parsed it. */
interface DispatchTask {
	/** The agent Clio resolved, `auto` and an omitted agent included. */
	agent: string;
	/** Project-relative write roots, or null when the worker would have no boundary. */
	roots: string[] | null;
	/** True when Clio runs the worker read-only, as it does every read-only recipe's; it then has no write roots. */
	readOnly: boolean;
}

function isObject(value: unknown): value is Json {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** A write root as a plain project path: no `./`, doubled or trailing slash. */
function plainSpelling(root: string): string {
	return root.trim().replace(/\/{2,}/gu, "/").replace(/^(?:\.\/)+/u, "").replace(/\/$/u, "");
}

/**
 * The workers a dispatch starts, from the plan Clio parsed. Gate roles only
 * judge, so they are left out. Every worker runs from the project root, no
 * writer works in a task worktree whose merge the desk would not see, and a
 * write root must land where it reads: Clio fixes a boundary at the root's
 * physical location, so a root through a link would let a worker write
 * wherever the link points. A root that lands on the whole project is no
 * boundary. Throws for any of these. Clio judges a rewritten call again, so
 * the roots the desk itself hands a worker are checked the same way.
 */
function planTasks(plan: Extract<HostDispatch, { kind: "tasks" }>, workspace: string, present: boolean): DispatchTask[] {
	const root = realWorkspace(workspace);
	for (const task of plan.tasks)
		if (task.cwd !== root) throw new Error("WTF-P dispatch guard: a worker's cwd moves the write roots the desk judged; dispatch from the project root without cwd.");
	if (present && plan.tasks.some((task) => task.worktree && !task.readOnly))
		throw new Error("WTF-P dispatch guard: the desk cannot see what a task worktree merges back, so a WTF-P project refuses worktree writers, compete candidates included.");
	// With no role reported, every task is one the call named.
	return plan.tasks
		.filter((task) => task.role === undefined || !GATE_ROLES.has(task.role))
		.map((task) => {
			let unbounded = task.writeRoots.length === 0;
			const roots: string[] = [];
			task.writeRoots.forEach((spelled, index) => {
				const boundary = task.writeBoundaries[index] as string;
				const landed = inside(root, boundary) ? posix(path.relative(root, boundary)) || "." : null;
				if (landed === ".") {
					unbounded = true;
					return;
				}
				if (landed === null || landed !== plainSpelling(spelled))
					throw new Error(`WTF-P dispatch guard: write root ${spelled} does not lead where it reads (a link, or a path outside the project); name the real project path.`);
				roots.push(`${landed}${spelled.trim().endsWith("/") ? "/" : ""}`);
			});
			return { agent: task.agent, roots: unbounded ? null : roots, readOnly: task.readOnly };
		});
}

/** The call's arguments without Clio's private admission keys, which Clio recomputes for any rewritten call. */
function withoutHostKeys(args: Json): Json {
	return Object.fromEntries(Object.entries(args).filter(([key]) => !key.startsWith("__clio_")));
}

/**
 * The call with each named worker held to its roots, in the shape Clio
 * prepares for hooks: `tasks` an array of task objects or task strings, one
 * per named worker, whose own intent overrides the shared one.
 */
function confineCall(args: Json, narrowed: Array<string[] | null>): Json {
	const confine = (item: unknown, roots: string[] | null): unknown => {
		if (roots === null) return item;
		const task = typeof item === "string" ? { task: item } : (item as Json);
		return { ...task, intent: { ...(isObject(task.intent) ? task.intent : {}), write_roots: roots } };
	};
	const tasks = args.tasks;
	if (args.tasks === undefined && narrowed.length === 1) return { ...withoutHostKeys(args), intent: { ...(isObject(args.intent) ? args.intent : {}), write_roots: narrowed[0] } };
	if (Array.isArray(tasks) && tasks.length === narrowed.length && tasks.every((item) => isObject(item) || typeof item === "string"))
		return { ...withoutHostKeys(args), tasks: tasks.map((item, index) => confine(item, narrowed[index] ?? null)) };
	throw new Error("WTF-P dispatch guard: the desk confines each worker through its intent.write_roots, so send tasks as an array of task objects.");
}

const sameRoots = (left: string[] | null, right: string[] | null): boolean =>
	left !== null && right !== null && left.length === right.length && [...left].sort().every((root, index) => root === [...right].sort()[index]);

async function guardDispatch(ctx: ExtensionContextV2, args: Json, host?: HostDispatch, malformed?: string): Promise<ExtensionHookResult> {
	if (args.list === true || host?.kind === "list") return {};
	// Clio could not prepare this call and refuses it itself, with its own reason; nothing of it runs.
	if (!host && typeof args.__clio_dispatch_plan_preparation_error === "string") return {};
	if (!host) return (await projectOrArmed(ctx)) ? block(`WTF-P dispatch guard: ${await missingFacts(ctx, malformed)}`) : {};
	const workspace = ctx.snapshot.workspace;
	const served = ctx.snapshot.plugin ?? null;
	const desk = loadDesk(workspace, await storedKey(ctx, false));
	const armed = await armedFor(ctx);
	if (!desk.present && !armed) {
		// Outside a WTF-P project and action, only the WTF-P recipes are the desk's business.
		const wtfp = host.kind === "tasks" ? host.tasks.filter((task) => WTFP_AGENT.test(task.agent)).map((task) => task.agent) : [];
		return wtfp.length > 0
			? block(`WTF-P dispatch guard: ${wtfp.join(", ")} run only inside the WTF-P action that owns them, so the desk can confine their writes; start it with its /wtfp: command.`)
			: {};
	}
	if (desk.present && (args.from_scout !== undefined || host.kind === "apply-winner"))
		return block("WTF-P dispatch guard: the desk cannot see what a scout continuation or a compete winner writes, so a WTF-P project refuses them.");
	if (host.kind !== "tasks") return {};
	const entries = planTasks(host, workspace, desk.present);
	if (!armed) {
		const wtfp = entries.filter((entry) => WTFP_AGENT.test(entry.agent));
		if (wtfp.length > 0)
			return block(
				`WTF-P dispatch guard: ${wtfp.map((entry) => entry.agent).join(", ")} run only inside the WTF-P action that owns them, so the desk can confine their writes; start it with its /wtfp: command.`,
			);
		// Workers run no desk check, so outside an action each must be kept off the records and the manuscripts still held.
		const held = [".planning/", ...heldManuscripts(desk).roots];
		for (const entry of entries) {
			if (entry.readOnly) continue;
			if (entry.roots === null)
				return block(
					`WTF-P dispatch guard: outside a WTF-P action, give each worker intent.write_roots that leave out ${held.join(", ")}; a worker runs no desk check, so without roots it could change the records or a gated manuscript.`,
				);
			for (const root of entry.roots) {
				const hit = heldBy(desk, held, root);
				if (hit) return block(`WTF-P dispatch guard: write root ${root} reaches ${hit}, which a worker outside a WTF-P action may not change.`);
			}
		}
		return {};
	}
	const name = actionName(served, armed.action);
	// Inside an action that delegates, a writing worker is one of its roles; a call without agent falls to Clio's default worker.
	const agents = GUARD.actions[armed.action]?.agents ?? [];
	const stranger = agents.length > 0 ? entries.find((entry) => !entry.readOnly && !agents.includes(entry.agent)) : undefined;
	if (stranger)
		return block(
			`WTF-P dispatch guard: ${name} delegates only to ${agents.join(", ")}, and this call would start ${stranger.agent}; name the role with agent (for example agent: "${agents.find((agent) => GUARD.paperWriters.includes(agent)) ?? agents[0]}").`,
		);
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
		if (entry.readOnly) return null;
		const roots = entry.roots === null ? allowed : narrow(entry.roots, allowed);
		if (paperWriters.has(entry.agent) && !roots.some((root) => root.startsWith("paper/")))
			throw new Error(
				entry.roots !== null && allowed.some((root) => root.startsWith("paper/"))
					? `WTF-P dispatch guard: ${entry.agent} names write_roots ${entry.roots.join(", ")}, which reach no manuscript ${name} may write; give it intent.write_roots ${allowed.join(", ")} (workspace paths, not project:// URIs).`
					: `WTF-P dispatch guard: ${entry.agent} would have no manuscript it may write. ${notes.length > 0 ? notes.join(" · ") : "Name the section and approve its plan first."}`,
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
	// A worker whose roots already are its confinement, in any order, needs no rewrite.
	const needed = narrowed.map((roots, index) => (roots === null || sameRoots(roots, entries[index]?.roots ?? null) ? null : roots));
	if (needed.every((roots) => roots === null)) return {};
	// Clio admits a rewritten call afresh, without the operator's approval of the original, so a call
	// that needs approval (more than one worker, a review loop, compete) is refused with the exact roots instead.
	if (host.tasks.length > 1)
		return block(
			`WTF-P dispatch guard: give each worker exactly these intent.write_roots, so the call you approve runs unchanged: ${entries
				.map((entry, index) => `task ${index + 1} (${entry.agent}): ${(narrowed[index] ?? []).join(", ") || "none, it only reads"}`)
				.join("; ")}.`,
		);
	// Clio admits an extension's rewrite only as a narrowing. A declared intent without write roots is an empty
	// write ceiling there, although the worker itself treats it as no boundary, so the desk cannot fill the roots in.
	const declaresEmpty = (item: unknown): boolean =>
		isObject(item) && isObject(item.intent) && (!Array.isArray(item.intent.write_roots) || item.intent.write_roots.length === 0);
	if (declaresEmpty(args) || (Array.isArray(args.tasks) && args.tasks.some(declaresEmpty)))
		return block(
			`WTF-P dispatch guard: an intent without write_roots bounds nothing for the worker, and Clio will not let the desk fill them in. Send ${entries
				.map((entry, index) => `${entries.length > 1 ? `task ${index + 1} (${entry.agent}) ` : ""}intent.write_roots ${(needed[index] ?? []).join(", ") || "omitted, since it only reads"}`)
				.join("; ")} in that intent.`,
		);
	const rewritten = confineCall(args, needed);
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

/**
 * Inside a WTF-P action every question is the author's. Clio answers an
 * unanswered `ask_user` round with its recommended option after
 * `safety.unattendedAfterSeconds`, unless the question is `operator_only`, so
 * the desk marks a lone question that way and refuses a round that would need
 * splitting, since an `operator_only` question is asked alone.
 */
async function guardQuestions(ctx: ExtensionContextV2, input: Json): Promise<ExtensionHookResult> {
	if (input.action === "complete") return {};
	const questions = Array.isArray(input.questions) ? (input.questions as unknown[]) : [];
	if (questions.length === 0 || questions.every((question) => (question as Json | null)?.operator_only === true)) return {};
	if (!(await armedFor(ctx))) return {};
	if (questions.length > 1)
		return block("WTF-P: inside a WTF-P action each question is the author's to answer. Ask them one call at a time, each with operator_only: true and its own options, so Clio never answers one for an absent author.");
	return {
		effects: [
			{
				kind: "rewrite_tool_input",
				args: { ...input, questions: [{ ...(questions[0] as Json), operator_only: true }] },
				reason: "WTF-P asks the author, and only the author may answer: Clio never takes a recommended option for this question.",
			},
		],
	};
}

async function guard(ctx: ExtensionContextV2, tool: string, args: unknown, event: unknown = {}): Promise<ExtensionHookResult> {
	const input = args !== null && typeof args === "object" ? (args as Json) : {};
	const effects: ExtensionEffect[] = [];
	if (!(await ctx.state.get<boolean>("protected")).value) {
		// The host's protected-artifact guard then refuses bash rm, mv, cp and redirects into the desk's own records.
		effects.push({ kind: "protect_path", path: path.join(ctx.snapshot.workspace, ".planning", "interactions"), reason: "WTF-P author answers are written only by the desk." });
		await ctx.state.set("protected", true);
	}
	let result: ExtensionHookResult = {};
	try {
		const host = hostLanding(event);
		// A host that sends facts once sends them for every call it can resolve, so a later call without them failed in Clio.
		if ((host.target || host.dispatch) && !(await ctx.state.get<boolean>("host-facts")).value) await ctx.state.set("host-facts", true);
		if (tool === "dispatch") result = await guardDispatch(ctx, input, host.dispatch, host.malformed);
		else if (tool === "ask_user") result = await guardQuestions(ctx, input);
		else if (COMMAND_TOOLS.has(tool)) {
			if (BASH_DESK_PATHS.test(JSON.stringify(input))) result = block("WTF-P write guard: commands may not touch the desk's own records under .planning.");
		} else {
			const raw = input.path ?? input.file_path ?? input.filePath;
			// The artifact tool trims its path; without one it writes under Clio's own artifact directory, where Clio's landing still says it lands.
			const target = typeof raw === "string" ? (tool === "artifact" ? raw.trim() : raw) : "";
			if (target.length > 0 || host.target) result = await guardWrite(ctx, target || "the artifact", host.target, host.malformed);
		}
	} catch (error) {
		result = block(error instanceof Error ? error.message : String(error));
	}
	return effects.length === 0 ? result : { ...result, effects: [...effects, ...(result.effects ?? [])] };
}

/**
 * A note on a successful write or edit that changed a manuscript the armed
 * action may measure: its recorded word count is stale until measure_section
 * runs. It rides on the tool result, so it spends none of the turn's shared
 * continuation budget, and it reaches a dispatched worker too, whose writes
 * Clio hooks, so it says whose call the measurement is. Each section is noted
 * once until it is measured again.
 */
async function noteManuscriptWrite(ctx: ExtensionContextV2, event: unknown): Promise<ExtensionHookResult> {
	const armed = await armedFor(ctx);
	if (!armed || !armed.produces.some((output) => output.uri.startsWith("project://paper/"))) return {};
	const target = hostLanding(event).target;
	if (!target) return {};
	const landed = writeLanding("", ctx.snapshot.workspace, target);
	if ("refused" in landed || landed.relative === null || !under("paper", landed.relative)) return {};
	const desk = loadDesk(ctx.snapshot.workspace);
	const noted = (await ctx.state.get<string[]>("measure-noted")).value ?? [];
	const sections = sectionsForPaper(desk, landed.relative)
		.map((section) => section.id)
		.filter((id) => !noted.includes(id) && declares(armed, `project://sections/${id}`, "update"));
	if (sections.length === 0) return {};
	await ctx.state.set("measure-noted", [...noted, ...sections]);
	const calls = sections.map((id) => `gateway(op="call", capability="extension_wtfp__measure_section", args={section: "${id}"})`).join(" and ");
	return {
		effects: [
			{
				kind: "annotate_tool_result",
				severity: "info",
				message: clip(
					`WTF-P: ${landed.relative} is the manuscript of ${sections.join(", ")}, so the desk's recorded word count is stale. When drafting it is done, the WTF-P action records the count with ${calls}; never count words by hand. A dispatched worker leaves this call to the action that dispatched it.`,
					"…",
				),
			},
		],
	};
}

function arm(text: string, desk: Desk, workspace: string): Armed | null {
	const match = /^\s*\/wtfp:([a-z][a-z0-9-]*)(?:\s+(\S+))?/u.exec(text);
	if (!match) return null;
	// The driver arms nothing itself; next_step arms each step it selects.
	if (match[1] === "advance") return GUARD.actions.advance ? idleArm(workspace) : null;
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
	api.action("advance", async (_event, ctx) => {
		const command = commandFor(ctx.snapshot.plugin ?? null, "advance");
		return command
			? { text: command, prompt: { fill: command } }
			: { text: "advance needs the WTF-P plugin.", toast: { text: "advance needs the WTF-P plugin." } };
	});
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
	api.tool("status", async (_input, ctx) => {
		const desk = await deskFor(ctx);
		return { text: progressText(desk), data: statusDigest(desk) };
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
	api.tool("archive", async (input, ctx) => {
		try {
			const desk = await deskFor(ctx);
			const made = archiveProject(ctx.snapshot.workspace, String((input as Json).archive ?? ""), await armedFor(ctx), desk.projectId);
			return {
				text: `Archived ${made.files} files to ${made.uri}; its manifest ${made.manifest} has sha256 ${made.sha256} and lists each file's sha256. Record the archive in the manifest and state as the procedure says.`,
				data: made,
			};
		} catch (error) {
			return { text: failure("Not archived", error), isError: true };
		}
	});
	api.tool("measure_section", async (input, ctx) => {
		try {
			const sectionId = String((input as Json).section ?? "");
			const measured = measureSection(ctx.snapshot.workspace, sectionId, await storedKey(ctx, false), await armedFor(ctx));
			const noted = (await ctx.state.get<string[]>("measure-noted")).value ?? [];
			if (noted.includes(sectionId)) await ctx.state.set("measure-noted", noted.filter((id) => id !== sectionId));
			const share = measured.target > 0 ? Math.round((measured.words / measured.target) * 100) : null;
			return {
				text: `${measured.file ?? "the manuscript"} has ${measured.words} body words${share === null ? "" : ` (${share}% of ${measured.target}; within 15% counts as on target)`}. ${measured.recorded ? `Recorded in the section and state records, which committed together; the paper totals ${measured.total}.` : `Not recorded: ${actionName(ctx.snapshot.plugin ?? null, (await armedFor(ctx))?.action ?? "this action")} does not update the section's word count; use this count instead of counting by hand.`} ${WORD_METHOD}`,
				data: measured,
			};
		} catch (error) {
			return { text: failure("Not measured", error), isError: true };
		}
	});
	api.tool("next_step", async (_input, ctx) => {
		const workspace = ctx.snapshot.workspace;
		const drive = (await ctx.state.get<Drive>("drive")).value;
		if (!drive || drive.workspace !== workspace)
			return { text: "Only a /wtfp:advance turn can ask the desk for its next step; nothing was armed.", isError: true };
		let desk = await deskFor(ctx);
		let recovered: string | null = null;
		if (desk.journal) {
			try {
				recovered = withLock(workspace, () => recover(workspace));
			} catch (error) {
				await ctx.state.set("armed", idleArm(workspace));
				return { text: `${failure("An interrupted record write could not be completed, so the run stops", error)} ${DRIVER_RULE}`, data: { kind: "stop" }, isError: true };
			}
			desk = await deskFor(ctx);
		}
		const decision = driveStep(desk, drive);
		const lead = recovered ? `${recovered} ` : "";
		if (decision.kind !== "step") {
			// Between steps and after the last one, nothing stays armed for writing.
			await ctx.state.set("armed", idleArm(workspace));
			if (decision.kind === "gate") {
				await ctx.state.set("drive", { ...drive, asked: [...drive.asked, decision.checkpoint] } satisfies Drive);
				return { text: `${lead}Gate ${decision.checkpoint}: ${decision.reason} Call extension_wtfp__gate with checkpoint ${decision.checkpoint}. ${DRIVER_RULE}`, data: decision };
			}
			return { text: `${lead}Stop: ${decision.reason} ${DRIVER_RULE}`, data: decision };
		}
		const contract = GUARD.actions[decision.action] as GuardAction;
		await ctx.state.set("armed", { action: decision.action, produces: contract.produces, section: decision.section, workspace } satisfies Armed);
		await ctx.state.set("drive", {
			...drive,
			steps: [...drive.steps, { action: decision.action, section: decision.section, fingerprint: driveFingerprint(desk), ...(decision.finish ? { finish: true } : {}) }],
		} satisfies Drive);
		const invocation = `/wtfp:${decision.action}${decision.section ? ` ${decision.section}` : ""}`;
		return {
			text: `${lead}Step ${drive.steps.length + 1}: ${invocation}. ${decision.reason} The write guard is armed for ${decision.action}${decision.section ? ` ${decision.section}` : ""} only. Read and follow ${stepPrompt(decision.prompt)} with ${decision.section ? `invocation input ${decision.section}` : "no invocation input"}. ${DRIVER_RULE}`,
			data: decision,
		};
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
			const typed = await freeText(ctx, event);
			if (typed?.checkpoint) {
				const desk = await deskFor(ctx);
				const current = desk.checkpoints.find((entry) => entry.id === typed.checkpoint);
				if (current && askable(desk, []).includes(current)) return { step: await ask(ctx, desk, current, FREE_TEXT), total: 1 };
			}
			const result = typed ?? (await answer(ctx, event.step, choiceOf(event.answers), noteOf(event)));
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
			const typed = await freeText(ctx, event);
			if (typed?.checkpoint) {
				const desk = await deskFor(ctx);
				const current = desk.checkpoints.find((entry) => entry.id === typed.checkpoint);
				const remaining = askable(desk, kept);
				if (current && remaining.includes(current)) return { step: await ask(ctx, desk, current, FREE_TEXT), total: remaining.length + recorded.length + kept.length };
			}
			const result = typed ?? (await answer(ctx, event.step, choiceOf(event.answers), noteOf(event)));
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
		// Clio continuing a stopped yolo turn (tool budget, loop guard, a failure) resumes that turn's drive and armed step.
		const held = (await ctx.state.get<{ armed?: Armed; drive?: Drive; workspace: string }>("held")).value;
		await ctx.state.delete("held");
		if (event.point === "prompt_submit" && (event as { origin?: string }).origin === "continuation") {
			if (held && held.workspace === ctx.snapshot.workspace) {
				if (held.armed) await ctx.state.set("armed", held.armed);
				if (held.drive) await ctx.state.set("drive", held.drive);
			}
			return {};
		}
		const typed = event.point === "prompt_submit" ? (event.text ?? "") : "";
		const desk = loadDesk(ctx.snapshot.workspace);
		const armed = arm(typed, desk, ctx.snapshot.workspace);
		// Only a prompt that starts an advance run starts a drive; any other prompt ends one.
		await ctx.state.delete("drive");
		await ctx.state.delete("measure-noted");
		if (!armed) {
			await ctx.state.delete("armed");
			return {};
		}
		await ctx.state.set("armed", armed);
		if (armed.action === "advance") {
			await ctx.state.set("drive", { workspace: ctx.snapshot.workspace, steps: [], asked: [] } satisfies Drive);
			return {
				effects: [
					{
						kind: "notify_operator",
						key: "wtfp-guard",
						message: "WTF-P driver armed: the desk picks each step from the project and confines it to that action's contract; it stops at the first gate only you can answer.",
					},
				],
			};
		}
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
	api.hook("before_tool", async (event, ctx) => (event.point === "before_tool" ? guard(ctx, event.tool, event.args, event) : {}));
	api.hook("after_tool", async (event, ctx) => (event.point === "after_tool" && event.outcome === "ok" ? noteManuscriptWrite(ctx, event) : {}));
	// A WTF-P turn starts from the desk's picture of the project, so the action need not rebuild it from records.
	api.hook("turn_start", async (event, ctx) => {
		if (event.point !== "turn_start" || !(await armedFor(ctx))) return {};
		const desk = await deskFor(ctx);
		if (!desk.present) return {};
		return { effects: [{ kind: "inject_reminder", audience: "model", severity: "info", message: statusReminder(desk) }] };
	});

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
		// An action arms for the turn its command starts; nothing it allowed outlives that turn. Clio's own
		// continuation of the turn may resume it, so the desk holds what it had until the next prompt says whose it is.
		const armed = (await ctx.state.get<Armed>("armed")).value;
		const drive = (await ctx.state.get<Drive>("drive")).value;
		if (armed || drive) await ctx.state.set("held", { ...(armed ? { armed } : {}), ...(drive ? { drive } : {}), workspace: ctx.snapshot.workspace });
		await ctx.state.delete("armed");
		await ctx.state.delete("drive");
		await ctx.state.delete("measure-noted");
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
