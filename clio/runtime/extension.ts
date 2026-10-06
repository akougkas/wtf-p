/**
 * WTF-P writing desk for Clio Coder. Human-edited source; the adapter
 * compiler copies it to vendors/plugin/ai.iowarp.clio/runtime/ beside the
 * generated write-guard.json and json-schema.cjs.
 *
 * The desk reads the portable `.planning` records and the manuscript, and
 * draws them. It writes only two things, both under `.planning`: an author's
 * answer to a gate (the checkpoint record and `state.active_checkpoint_uris`),
 * each schema-validated before an atomic replace. Everything else stays with
 * the actions' own workflows.
 */
import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
	ExtensionApiV2,
	ExtensionContextV2,
	ExtensionHookResult,
	ExtensionIsland,
	ExtensionOutputV2,
	ExtensionSkin,
	InterviewStep,
	View,
	ViewTone,
} from "@iowarp/clio-coder/extensions";

const require = createRequire(import.meta.url);
const { SchemaRegistry, validateInstance } = require("./json-schema.cjs") as {
	SchemaRegistry: new (files: string[]) => { get(file: string): unknown };
	validateInstance: (value: unknown, schema: unknown, file: string, registry: unknown) => string[];
};

const PACKAGE_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SCHEMAS = path.join(PACKAGE_ROOT, "project", "schemas");
const GUARD = JSON.parse(readFileSync(new URL("./write-guard.json", import.meta.url), "utf8")) as {
	actions: Record<string, string[]>;
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

// --- records -----------------------------------------------------------------

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
	[key: string]: unknown;
}

interface SectionRow {
	id: string;
	title: string;
	wave: number;
	status: string;
	target: number;
	words: number;
	manuscript: string | null;
	claims: { total: number; verified: number; unsupported: number };
	stages: { discuss: boolean; plan: boolean; write: boolean; review: boolean };
	gates: Checkpoint[];
	research: { required: boolean; present: boolean };
	dependsOn: string[];
}

interface Desk {
	workspace: string;
	present: boolean;
	title: string;
	documentType: string;
	venue: string | null;
	deadline: string | null;
	argument: string;
	phase: string;
	status: string;
	confirmPlan: boolean;
	sections: SectionRow[];
	checkpoints: Checkpoint[];
	sources: Record<string, number>;
	evidence: number;
	issues: Record<"blocker" | "error" | "warning" | "info", number>;
	invalid: Array<{ file: string; errors: string[] }>;
	targetWords: number;
	paperExists: boolean;
}

type Json = Record<string, unknown>;

function inside(root: string, candidate: string): boolean {
	const relative = path.relative(root, candidate);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function readText(workspace: string, relative: string): string | null {
	const file = path.resolve(workspace, relative);
	if (!inside(workspace, file) || !existsSync(file)) return null;
	const stat = lstatSync(file);
	if (!stat.isFile() || stat.size > RECORD_LIMIT) return null;
	return readFileSync(file, "utf8");
}

function readRecord(workspace: string, relative: string): Json | null {
	const text = readText(workspace, relative);
	if (text === null) return null;
	try {
		const value = JSON.parse(text) as unknown;
		return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
	} catch {
		// An unreadable record shows up as a schema problem from validation, not here.
		return null;
	}
}

function listJson(workspace: string, relative: string): string[] {
	const directory = path.resolve(workspace, relative);
	if (!inside(workspace, directory) || !existsSync(directory)) return [];
	return readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
		.map((entry) => path.posix.join(relative, entry.name))
		.sort();
}

function text(value: unknown, fallback = ""): string {
	return typeof value === "string" && value.length > 0 ? value : fallback;
}

/** `project://paper/{artifact}` to a manuscript file, trying the authored formats in order. */
function manuscriptFile(workspace: string, uri: unknown): string | null {
	if (typeof uri !== "string" || !uri.startsWith("project://paper/")) return null;
	const artifact = uri.slice("project://paper/".length);
	if (artifact.length === 0 || artifact.split("/").some((part) => part === ".." || part === "")) return null;
	for (const candidate of [artifact, `${artifact}.md`, `${artifact}.tex`, `${artifact}.typ`]) {
		const relative = path.posix.join("paper", candidate);
		const file = path.resolve(workspace, relative);
		if (inside(workspace, file) && existsSync(file) && lstatSync(file).isFile()) return relative;
	}
	return path.posix.join("paper", artifact);
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

function sectionGates(checkpoints: Checkpoint[], id: string, manuscript: string | null): Checkpoint[] {
	const scopes = [`project://sections/${id}`, ...(manuscript ? [`project://${manuscript}`] : [])];
	return checkpoints.filter(
		(checkpoint) =>
			checkpoint.status === "pending" &&
			checkpoint.blocking &&
			scopes.some((scope) => checkpoint.scope_uri === scope || checkpoint.scope_uri.startsWith(`${scope}/`)),
	);
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
	if (source === null) return [];
	try {
		return validateRecord(JSON.parse(source));
	} catch (error) {
		return [`$: invalid JSON (${error instanceof Error ? error.message : String(error)})`];
	}
}

function planningRecords(workspace: string, relative = ".planning"): string[] {
	const directory = path.resolve(workspace, relative);
	if (!existsSync(directory)) return [];
	const out: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
		const child = path.posix.join(relative, entry.name);
		if (entry.isDirectory() && entry.name !== "archives") out.push(...planningRecords(workspace, child));
		else if (entry.isFile() && entry.name.endsWith(".json")) out.push(child);
	}
	return out;
}

function loadDesk(workspace: string): Desk {
	const manifest = readRecord(workspace, ".planning/project.json");
	const config = readRecord(workspace, ".planning/config.json");
	const state = readRecord(workspace, ".planning/state.json");
	const outline = readRecord(workspace, ".planning/structure/outline.json");
	const target = (manifest?.target ?? {}) as Json;
	const progress = (state?.progress ?? {}) as Json;
	const checkpoints: Checkpoint[] = listJson(workspace, ".planning/checkpoints").flatMap((file) => {
		const record = readRecord(workspace, file);
		if (!record || typeof record.id !== "string") return [];
		return [
			{
				...record,
				file,
				id: record.id,
				kind: text(record.kind, "decision"),
				status: text(record.status, "pending"),
				blocking: record.blocking === true,
				scope_uri: text(record.scope_uri),
				request: text(record.request, record.id),
			} as Checkpoint,
		];
	});
	checkpoints.sort((a, b) => text(a.created_at).localeCompare(text(b.created_at)) || a.id.localeCompare(b.id));
	const outlined = Array.isArray(outline?.sections) ? (outline.sections as Json[]) : [];
	const sections: SectionRow[] = outlined.map((entry) => {
		const id = text(entry.id, "section");
		const base = `.planning/sections/${id}`;
		const record = readRecord(workspace, `${base}/section.json`);
		const artifacts = (record?.artifacts ?? {}) as Json;
		const manuscript = manuscriptFile(workspace, artifacts.manuscript ?? `project://paper/${id}`);
		const source = manuscript ? readText(workspace, manuscript) : null;
		const words = source === null || manuscript === null ? 0 : bodyWords(source, manuscript);
		const status = text(record?.status, "not-started");
		const claims = Array.isArray(record?.claims) ? (record.claims as Json[]) : [];
		const plans = Array.isArray(artifacts.plans) ? artifacts.plans : [];
		const reviews = Array.isArray(artifacts.reviews) ? artifacts.reviews : [];
		const research = (entry.research ?? {}) as Json;
		return {
			id,
			title: text(entry.title, id),
			wave: typeof entry.wave === "number" ? entry.wave : 1,
			status,
			target: typeof entry.word_target === "number" ? entry.word_target : Number(record?.word_target ?? 0),
			words,
			manuscript,
			claims: {
				total: claims.length,
				verified: claims.filter((claim) => claim.status === "verified").length,
				unsupported: claims.filter(
					(claim) =>
						claim.evidence_required === true &&
						(!Array.isArray(claim.evidence_uris) || claim.evidence_uris.length === 0),
				).length,
			},
			stages: {
				discuss: existsSync(path.join(workspace, base, "context.md")),
				plan: plans.length > 0 || ["planned", "writing", "reviewing", "complete"].includes(status),
				write: words > 0 || ["reviewing", "complete"].includes(status),
				review: reviews.length > 0 || status === "complete",
			},
			gates: sectionGates(checkpoints, id, manuscript),
			research: { required: research.required === true, present: existsSync(path.join(workspace, base, "research.md")) },
			dependsOn: Array.isArray(entry.depends_on) ? entry.depends_on.filter((dep): dep is string => typeof dep === "string") : [],
		};
	});
	const sources: Record<string, number> = {};
	for (const file of listJson(workspace, ".planning/sources")) {
		const status = text(readRecord(workspace, file)?.status, "unknown");
		sources[status] = (sources[status] ?? 0) + 1;
	}
	const issues = { blocker: 0, error: 0, warning: 0, info: 0 };
	for (const file of listJson(workspace, ".planning/validations")) {
		const record = readRecord(workspace, file);
		for (const issue of Array.isArray(record?.issues) ? (record.issues as Json[]) : []) {
			const severity = text(issue.severity) as keyof typeof issues;
			if (severity in issues) issues[severity] += 1;
		}
	}
	const gates = (config?.gates ?? {}) as Json;
	return {
		workspace,
		present: manifest !== null,
		title: text(manifest?.title, "Untitled paper"),
		documentType: text(manifest?.document_type, "paper"),
		venue: typeof target.venue === "string" ? target.venue : null,
		deadline: typeof target.deadline === "string" ? target.deadline : null,
		argument: text(manifest?.core_argument),
		phase: text(state?.phase, manifest ? "initialized" : "none"),
		status: text(state?.status, "active"),
		confirmPlan: gates.confirm_plan !== false,
		sections,
		checkpoints,
		sources,
		evidence: listJson(workspace, ".planning/evidence").length,
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
		paperExists: existsSync(path.join(workspace, "paper")),
	};
}

// --- the rule ladder ---------------------------------------------------------

interface Next {
	command: string | null;
	reason: string;
}

function nextAction(desk: Desk): Next {
	if (!desk.present)
		return desk.paperExists
			? { command: "/wtfp:map-project", reason: "A manuscript exists but no WTF-P project records do." }
			: { command: "/wtfp:new-paper", reason: "Start a project: brief, decisions and outline." };
	const gate = desk.checkpoints.find((checkpoint) => checkpoint.status === "pending" && checkpoint.blocking);
	if (gate) return { command: "/wtfp:check-todos", reason: `Gate waiting on you: ${gate.request}` };
	if (desk.sections.length === 0) return { command: "/wtfp:create-outline", reason: "No outline yet." };
	const complete = new Set(desk.sections.filter((section) => section.status === "complete").map((section) => section.id));
	const ordered = [...desk.sections].sort((a, b) => a.wave - b.wave);
	for (const section of ordered) {
		if (section.status === "complete") continue;
		if (!section.dependsOn.every((dep) => complete.has(dep)) && section.status === "not-started") continue;
		const id = section.id;
		switch (section.status) {
			case "blocked":
				return { command: "/wtfp:check-todos", reason: `${section.title} is blocked.` };
			case "reviewing":
				return { command: `/wtfp:review-section ${id}`, reason: `${section.title} is drafted and waits for review.` };
			case "writing":
			case "planned":
				return { command: `/wtfp:write-section ${id}`, reason: `${section.title} has an approved plan.` };
			default:
				if (!section.stages.discuss) return { command: `/wtfp:discuss-section ${id}`, reason: `Settle what ${section.title} must argue.` };
				if (section.research.required && !section.research.present)
					return { command: `/wtfp:research-gap ${id}`, reason: `${section.title} needs verified evidence first.` };
				return { command: `/wtfp:plan-section ${id}`, reason: `${section.title} is ready to plan.` };
		}
	}
	if (desk.phase === "delivered") return { command: null, reason: "Delivered." };
	if (desk.phase === "ready") return { command: "/wtfp:submit-milestone", reason: "Every section is complete and audited." };
	return { command: "/wtfp:audit-milestone", reason: "Every section is complete; audit before delivery." };
}

// --- views -------------------------------------------------------------------

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
				cards: cards.slice(0, 60).map((section) => ({
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
						...(section.gates.length > 0 ? [{ text: `GATE ×${section.gates.length}`, tone: "warning" as ViewTone }] : []),
						...(section.words > 0 && section.target > 0
							? [{ text: `${Math.round((section.words / section.target) * 100)}%`, tone: tolerance(section.words, section.target) }]
							: []),
					],
				})),
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
	const gate = desk.checkpoints.find((checkpoint) => checkpoint.status === "pending" && checkpoint.blocking);
	if (gate)
		out.push({
			key: "gate",
			title: "⚑ Gate",
			meta: gate.kind,
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
					{ t: "text", text: "Leader c answers it; only your answer resolves it.", tone: "muted" },
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
					{ label: "claims without evidence", value: String(unsupported), tone: unsupported > 0 ? "warning" : "positive" },
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
	if (!desk.present) return { t: "text", text: "WTF-P · no .planning here · /wtfp:new-paper starts one", tone: "muted" };
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
	const desk = loadDesk(ctx.snapshot.workspace);
	desk.invalid = (await ctx.state.get<Desk["invalid"]>("invalid")).value ?? [];
	return desk;
}

async function picture(ctx: ExtensionContextV2, desk?: Desk): Promise<Omit<ExtensionOutputV2, "text">> {
	const current = desk ?? (await deskFor(ctx));
	if (!current.present && !current.paperExists && ctx.snapshot.activeWorkspace === null) return { status: null, band: null };
	return {
		status: current.present
			? {
					text: `WTF-P · ${current.phase} · ${totalWords(current).toLocaleString("en-US")}/${current.targetWords.toLocaleString("en-US")}w`,
					tone: current.checkpoints.some((checkpoint) => checkpoint.status === "pending" && checkpoint.blocking) ? "warning" : "neutral",
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

function pendingGates(desk: Desk, skip: readonly string[]): Checkpoint[] {
	return desk.checkpoints.filter(
		(checkpoint) => checkpoint.status === "pending" && checkpoint.kind !== "state-snapshot" && !skip.includes(checkpoint.id),
	);
}

function gateStep(checkpoint: Checkpoint): InterviewStep {
	const choices =
		checkpoint.options && checkpoint.options.length > 0
			? checkpoint.options.map((option) => ({
					value: option.id,
					label: option.label,
					...(option.implication ? { detail: option.implication } : {}),
				}))
			: [
					{ value: "__resolve", label: checkpoint.kind === "human-verify" ? "Verified" : "Done", detail: "Mark it resolved by you." },
					{ value: "__waive", label: "Waive it", detail: "Record that you chose to skip it." },
				];
	return {
		key: checkpoint.id,
		title: checkpoint.blocking ? "Blocking gate" : "Pending task",
		// The question carries the request; the intro adds only what it cannot.
		intro: {
			t: "box",
			dir: "col",
			children: [
				...(checkpoint.context ? [{ t: "text", text: checkpoint.context, wrap: "wrap" } as View] : []),
				{ t: "text", text: `${checkpoint.kind} · ${checkpoint.scope_uri.replace(/^project:\/\//u, "")}`, tone: "muted" },
			],
		},
		questions: [
			{
				id: "choice",
				label: checkpoint.request.length > 120 ? `${checkpoint.request.slice(0, 117)}...` : checkpoint.request,
				kind: "single",
				options: [...choices, { value: KEEP, label: "Keep it pending", detail: "Answer later; its writes stay blocked." }],
			},
		],
	};
}

function writeRecord(workspace: string, relative: string, value: Json): void {
	const errors = validateRecord(value);
	if (errors.length > 0) throw new Error(`${relative} would not validate: ${errors[0]}`);
	const file = path.resolve(workspace, relative);
	if (!inside(path.join(workspace, ".planning"), file)) throw new Error(`refusing to write outside .planning: ${relative}`);
	const staging = `${file}.${randomUUID()}.partial`;
	try {
		writeFileSync(staging, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
		renameSync(staging, file);
	} finally {
		if (existsSync(staging)) unlinkSync(staging);
	}
	const back = JSON.parse(readFileSync(file, "utf8")) as unknown;
	if (JSON.stringify(back) !== JSON.stringify(value)) throw new Error(`readback of ${relative} differs from what was written`);
}

/** The one place an author's answer is recorded: only from the interview the operator answered. */
function resolveGate(workspace: string, checkpoint: Checkpoint, choice: string): string {
	const now = new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
	const option = checkpoint.options?.find((entry) => entry.id === choice);
	const waived = choice === "__waive";
	const { file, ...stored } = checkpoint;
	const record: Json = {
		...stored,
		status: waived ? "waived" : "resolved",
		resolution: {
			resolved_by: "author",
			...(option ? { selected_option: option.id } : {}),
			summary: option
				? `The author chose "${option.label}" at the Clio WTF-P desk.`
				: waived
					? "The author waived this gate at the Clio WTF-P desk."
					: "The author marked this done at the Clio WTF-P desk.",
			resolved_at: now,
		},
	};
	writeRecord(workspace, file, record);
	const state = readRecord(workspace, ".planning/state.json");
	const uri = `project://checkpoints/${checkpoint.id}`;
	if (state && Array.isArray(state.active_checkpoint_uris) && state.active_checkpoint_uris.includes(uri)) {
		writeRecord(workspace, ".planning/state.json", {
			...state,
			revision: typeof state.revision === "number" ? state.revision + 1 : 1,
			active_checkpoint_uris: state.active_checkpoint_uris.filter((entry) => entry !== uri),
			updated_at: now,
		});
	}
	return option ? `${checkpoint.id}: ${option.label}` : `${checkpoint.id}: ${waived ? "waived" : "done"}`;
}

async function startGates(ctx: ExtensionContextV2): Promise<ExtensionOutputV2> {
	const desk = await deskFor(ctx);
	const pending = pendingGates(desk, []);
	await ctx.state.set("gate-kept", []);
	if (pending.length === 0)
		return {
			text: "No pending gates or author tasks.",
			card: { t: "text", text: "✓ No pending gates or author tasks.", tone: "positive" },
		};
	return {
		text: `${pending.length} pending gate${pending.length === 1 ? "" : "s"}.`,
		interview: { id: "gate", title: "WTF-P gates", total: pending.length, step: gateStep(pending[0] as Checkpoint) },
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
						label: "pending gates and tasks",
						value: String(pendingGates(desk, []).length),
						tone: pendingGates(desk, []).length > 0 ? "warning" : "positive",
					},
					...(daysLeft(desk.deadline) ? [{ label: "deadline", value: daysLeft(desk.deadline) as string }] : []),
					{ label: "next", value: next.command ? `${next.command} · ${next.reason}` : next.reason, tone: "info" },
				],
			},
			...(desk.sections.length > 0
				? [
						{
							t: "table",
							columns: ["wave", "section", "status", "stages", "words", "claims", "gates"],
							rows: desk.sections.map((section) => [
								String(section.wave),
								section.title,
								section.status,
								stageStrip(section),
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
	if (!desk.present) return `No WTF-P project here. ${nextAction(desk).command}`;
	const next = nextAction(desk);
	return [
		`${desk.title} · ${desk.phase}`,
		`${totalWords(desk)}/${desk.targetWords} words; ${desk.sections.filter((section) => section.status === "complete").length}/${desk.sections.length} sections complete`,
		...desk.sections.map((section) => `  w${section.wave} ${section.id}: ${section.status} ${stageStrip(section)} ${section.words}/${section.target}w`),
		`Next: ${next.command ?? "nothing"} (${next.reason})`,
	].join("\n");
}

function helpCard(): { text: string; card: View } {
	const availability = JSON.parse(
		readFileSync(path.join(PACKAGE_ROOT, "compatibility", "action-availability.json"), "utf8"),
	) as { actions: Array<{ id: string; status: string; unavailableCapabilities: string[] }> };
	const rows = availability.actions.map((entry) => {
		const contract = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, "actions", `${entry.id}.json`), "utf8")) as {
			description?: string;
		};
		return [
			`/wtfp:${entry.id}`,
			entry.status === "available" ? text(contract.description) : `unavailable: ${entry.unavailableCapabilities.join(", ")}`,
		];
	});
	const guarded = Object.keys(GUARD.actions).map((id) => `/wtfp:${id}`);
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
					text: `Answered locally with no model: /wtfp:progress, /wtfp:help, /wtfp:check-todos, /ext:wtfp:checkpoints, /ext:wtfp:validate. Write guard: ${guarded.join(", ")} may write only under the roots each declares. A manuscript write waits for its section's blocking gates and approved plan. ${WORD_METHOD}`,
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
						columns: ["id", "kind", "status", "blocking", "scope"],
						rows: desk.checkpoints.slice(0, 100).map((checkpoint) => [
							checkpoint.id,
							checkpoint.kind,
							checkpoint.status,
							checkpoint.blocking ? "yes" : "no",
							checkpoint.scope_uri.replace(/^project:\/\//u, ""),
						]),
					},
				],
			};
}

async function validateAll(ctx: ExtensionContextV2): Promise<ExtensionOutputV2> {
	const files = planningRecords(ctx.snapshot.workspace);
	const failures = files
		.map((file) => ({ file, errors: validateFile(ctx.snapshot.workspace, file) }))
		.filter((record) => record.errors.length > 0);
	await ctx.state.set(
		"invalid",
		failures.map((record) => ({ file: record.file, errors: record.errors.slice(0, 5) })),
	);
	const view: View =
		failures.length === 0
			? { t: "text", text: `✓ ${files.length} planning records valid against their schemas.`, tone: "positive" }
			: {
					t: "box",
					dir: "col",
					border: "round",
					title: "WTF-P · schema violations",
					meta: `${failures.length}/${files.length}`,
					children: failures.slice(0, 6).flatMap((record) => [
						{ t: "text", text: record.file, bold: true, tone: "error" } as View,
						...record.errors.slice(0, 3).map((error) => ({ t: "text", text: `  ${error}`, tone: "muted", wrap: "wrap" }) as View),
					]),
				};
	return {
		text: failures.length === 0 ? `${files.length} records valid.` : failures.map((record) => `${record.file}: ${record.errors[0]}`).join("\n"),
		card: view,
		...(await picture(ctx)),
	};
}

// --- the write guard ---------------------------------------------------------

interface Armed {
	action: string;
	roots: string[];
}

function sectionForPaper(desk: Desk, relative: string): SectionRow | undefined {
	return desk.sections.find(
		(section) =>
			section.manuscript !== null &&
			(relative === section.manuscript || relative.startsWith(`${section.manuscript.replace(/\.(md|tex|typ)$/u, "")}.`)),
	);
}

async function guard(ctx: ExtensionContextV2, args: unknown): Promise<ExtensionHookResult> {
	const target = args !== null && typeof args === "object" ? (args as Json).path : undefined;
	if (typeof target !== "string" || target.length === 0) return {};
	const workspace = ctx.snapshot.workspace;
	const absolute = path.resolve(workspace, target);
	const armed = (await ctx.state.get<Armed>("armed")).value;
	if (armed) {
		const roots = armed.roots.map((root) => path.resolve(workspace, root));
		if (!roots.some((root) => inside(root, absolute)))
			return {
				effects: [
					{
						kind: "block_tool",
						reason: `WTF-P write guard: /wtfp:${armed.action} may write only under ${armed.roots.join(", ")}; refused ${path.relative(workspace, absolute)}. Record other changes as a handoff instead.`,
					},
				],
			};
	}
	if (!inside(path.join(workspace, "paper"), absolute)) return {};
	const desk = loadDesk(workspace);
	if (!desk.present) return {};
	const section = sectionForPaper(desk, path.relative(workspace, absolute).split(path.sep).join("/"));
	if (!section) return {};
	const gate = section.gates[0];
	if (gate)
		return {
			effects: [
				{
					kind: "block_tool",
					reason: `WTF-P gate: ${section.title} waits on the author's answer to "${gate.request}" (${gate.id}). Answer it with /wtfp:check-todos before writing ${section.manuscript}.`,
				},
			],
		};
	if (desk.confirmPlan && (section.status === "not-started" || section.status === "researching"))
		return {
			effects: [
				{
					kind: "block_tool",
					reason: `WTF-P gate: ${section.title} has no approved plan, and confirm_plan is on. Run /wtfp:plan-section ${section.id} and approve it before writing ${section.manuscript}.`,
				},
			],
		};
	return {};
}

// --- registration ------------------------------------------------------------

export default function extension(api: ExtensionApiV2): void {
	api.handle("desk", async (_args, ctx) => ({
		text: progressText(await deskFor(ctx)),
		workspace: { enter: "desk" },
		...(await picture(ctx)),
	}));
	api.handle("progress", async (_args, ctx) => {
		const desk = await deskFor(ctx);
		return { text: progressText(desk), card: progressCard(desk), ...(await picture(ctx, desk)) };
	});
	api.handle("help", async () => helpCard());
	api.handle("check-todos", async (_args, ctx) => startGates(ctx));
	api.handle("checkpoints", async (_args, ctx) => {
		const desk = await deskFor(ctx);
		return {
			text: desk.checkpoints.map((checkpoint) => `${checkpoint.id} ${checkpoint.kind} ${checkpoint.status}`).join("\n") || "No checkpoints.",
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
	api.action("help", async () => helpCard());
	api.action("section", async (event, ctx) => {
		const desk = await deskFor(ctx);
		const section = desk.sections.find((entry) => entry.id === event.key);
		return section
			? { text: `${section.title}: ${section.status}`, prompt: { fill: `/wtfp:progress` } }
			: { text: "Unknown section." };
	});

	api.interview("gate", async (answer, ctx) => {
		if (answer.nav === "cancel")
			return { done: true, text: "Gates left as they were.", toast: { text: "WTF-P gates unchanged" }, ...(await picture(ctx)) };
		const kept = (await ctx.state.get<string[]>("gate-kept")).value ?? [];
		const desk = await deskFor(ctx);
		const checkpoint = desk.checkpoints.find((entry) => entry.id === answer.step);
		const choice = answer.answers.choice;
		const picked = Array.isArray(choice) ? choice[0] : choice;
		const recorded: string[] = (await ctx.state.get<string[]>("gate-recorded")).value ?? [];
		if (checkpoint && checkpoint.status === "pending" && typeof picked === "string") {
			if (picked === KEEP) kept.push(checkpoint.id);
			else recorded.push(resolveGate(ctx.snapshot.workspace, checkpoint, picked));
		}
		await ctx.state.set("gate-kept", kept);
		await ctx.state.set("gate-recorded", recorded);
		const remaining = pendingGates(loadDesk(ctx.snapshot.workspace), kept);
		const next = remaining[0];
		if (next) return { step: gateStep(next), total: remaining.length + recorded.length + kept.length };
		await ctx.state.set("gate-recorded", []);
		const summary = recorded.length > 0 ? `Recorded: ${recorded.join("; ")}.` : "Nothing recorded.";
		return {
			done: true,
			text: summary,
			card: { t: "text", text: `✓ ${summary}`, tone: recorded.length > 0 ? "positive" : "muted", wrap: "wrap" },
			...(await picture(ctx)),
		};
	});

	api.hook("prompt_submit", async (event, ctx) => {
		const typed = event.point === "prompt_submit" ? (event.text ?? "") : "";
		const match = /^\s*\/wtfp:([a-z][a-z0-9-]*)\b/u.exec(typed);
		const roots = match ? GUARD.actions[match[1] as string] : undefined;
		if (!match || !roots) {
			await ctx.state.delete("armed");
			return {};
		}
		await ctx.state.set("armed", { action: match[1], roots } satisfies Armed);
		return {
			effects: [
				{
					kind: "notify_operator",
					key: "wtfp-guard",
					message: `WTF-P write guard armed for /wtfp:${match[1]}: write and edit stay under ${roots.join(", ")}.`,
				},
			],
		};
	});
	api.hook("before_tool", async (event, ctx) =>
		event.point === "before_tool" ? guard(ctx, event.args) : {},
	);

	api.on("session_open", async (_event, ctx) => ({ text: "", ...(await picture(ctx)) }));
	api.on("workspace_enter", async (_event, ctx) => ({ text: "", ...(await picture(ctx)) }));
	api.on("fs_changed", async (event, ctx) => {
		if (event.event !== "fs_changed") return undefined;
		const records = event.paths.filter((file) => file.startsWith(".planning/") && file.endsWith(".json") && !file.includes("/archives/"));
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
