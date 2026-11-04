import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { constants as fsConstants, promises as fsPromises, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { getMarkdownTheme, type ExtensionAPI, type ExtensionCommandContext, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { uuidv7, type Message } from "@earendil-works/pi-ai";
import { Markdown, matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";

type Phase = "collect" | "research" | "roadmap" | "steps" | "implement" | "review";
type TaskState = {
	version: 1;
	id: string;
	projectRoot: string;
	artifactDir?: string;
	contextPath: string;
	phase: Phase;
	currentStep: number;
	completedSteps: number[];
	awaitingReview?: number;
	pendingFiles?: string[];
	pendingHashes?: Record<string, string | null>;
	pendingSummary?: string;
	pendingAutoCommitEligible?: boolean;
	pendingGitRepository?: boolean;
	pendingBaselineDir?: string;
	reviewRound?: number;
	reviewPending?: boolean;
	pendingAction?: "research" | "roadmap" | "step";
	pendingStep?: number;
	pendingArtifactWritten?: boolean;
};
type TaskLink = { id: string; statePath: string };
type ImplementModel = { provider: string; model: string; thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" };
type Config = { artifactDir?: string; autoCommit?: boolean; implementModel?: ImplementModel | null; reviewSkill?: string | null; allowTreeNavigation?: boolean; snapshotMaxFiles?: number; snapshotMaxMiB?: number };

const ENTRY_TYPE = "task-workflow-link";
const ARTIFACT_TOOL = "task_write_artifact";
const READ_TOOLS = ["read", "grep", "find", "ls"];
const DEFAULT_SNAPSHOT_MAX_FILES = 4_000;
const DEFAULT_SNAPSHOT_MAX_MIB = 100;
const HELP = `Task workflow

/task TASK-ID [--dir PATH]                Start or continue a task after confirmation
/task list                              Select a task to continue (or show tasks outside the TUI)
/task status                            Show task, phase, and artifact paths
/task log                               Reopen the running task's progress log
/task abort                             Stop the running implementation or review worker
/task next                              Advance if no questions or proposals are pending
/task accept [NOTE]                     Accept a pending proposal, then advance if ready
/task show PHASE                        View an artifact without adding it to the session
/task help                              Show this help

Quote an ID containing spaces, for example: /task "TASK 100500".
An explicit task ID is required.
After starting a task, describe the problem and share any context you have.
Add more details as they come to mind.
Use /task next when the discussion is settled. Use /task accept when Pi has made
a concrete proposal that you want to approve; it stops if questions remain.
After implementation,
a separate read-only review runs automatically and saves review-N.md.
Enter or Esc closes the progress log without stopping the worker. Use /task log
to reopen it; /task abort is the extension's command for stopping a worker.
Discuss findings and update their status. After the discussion is settled,
/task next repairs open findings or accepts a clear review.
Use /task accept "I prefer option B" to add a specific approval note.
Text ending in /task next is not parsed as a command.
Task artifacts may be updated in any phase; project code changes run only in implement.
The default artifact directory is <project>/.agents/projects/<task-id>/.
Set artifactDir, autoCommit, implementModel, reviewSkill, snapshotMaxFiles,
snapshotMaxMiB, or allowTreeNavigation in ~/.pi/agent/task-workflow.json.
You can also pass --dir PATH to /task.
autoCommit defaults to false.
The config path may contain {projectRoot} and {taskId}. Relative paths use the project root.`;

function git(root: string, args: string[]): string {
	try {
		return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
	} catch (error) {
		const detail = (error as { stderr?: Buffer | string }).stderr?.toString().trim();
		throw new Error(detail || `git ${args[0]} failed.`);
	}
}

function projectRoot(cwd: string): string {
	try { return git(cwd, ["rev-parse", "--show-toplevel"]); }
	catch { return cwd; }
}

function defaultArtifactDir(root: string, id: string): string { return join(root, ".agents", "projects", id); }
function taskDir(state: TaskState): string { return state.artifactDir || defaultArtifactDir(state.projectRoot, state.id); }
function statePath(dir: string): string { return join(dir, "state.json"); }

function readConfig(): Config {
	const path = join(process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"), "task-workflow.json");
	if (!existsSync(path)) return {};
	const config: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error(`Invalid config: ${path}`);
	const values = config as Record<string, unknown>;
	if (values.contextPath !== undefined) throw new Error(`Replace contextPath with artifactDir in ${path}.`);
	if (values.artifactDir !== undefined && (typeof values.artifactDir !== "string" || !values.artifactDir.trim())) throw new Error(`Invalid artifactDir: ${path}`);
	if (values.autoCommit !== undefined && typeof values.autoCommit !== "boolean") throw new Error(`autoCommit must be a boolean: ${path}`);
	if (values.allowTreeNavigation !== undefined && typeof values.allowTreeNavigation !== "boolean") throw new Error(`allowTreeNavigation must be a boolean: ${path}`);
	if (values.reviewSkill !== undefined && values.reviewSkill !== null && (typeof values.reviewSkill !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.reviewSkill) || values.reviewSkill.length > 64)) throw new Error(`reviewSkill must be a skill name or null: ${path}`);
	if (values.snapshotMaxFiles !== undefined && (typeof values.snapshotMaxFiles !== "number" || !Number.isSafeInteger(values.snapshotMaxFiles) || values.snapshotMaxFiles < 1)) throw new Error(`snapshotMaxFiles must be a positive integer: ${path}`);
	if (values.snapshotMaxMiB !== undefined && (typeof values.snapshotMaxMiB !== "number" || !Number.isSafeInteger(values.snapshotMaxMiB) || values.snapshotMaxMiB < 1 || values.snapshotMaxMiB > 1_000_000)) throw new Error(`snapshotMaxMiB must be an integer from 1 to 1000000: ${path}`);
	if (values.implementModel !== undefined && values.implementModel !== null) {
		const model = values.implementModel;
		if (!model || typeof model !== "object" || Array.isArray(model)) throw new Error(`Invalid implementModel: ${path}`);
		const settings = model as Record<string, unknown>;
		if (typeof settings.provider !== "string" || !settings.provider.trim() || typeof settings.model !== "string" || !settings.model.trim()) {
			throw new Error(`implementModel requires non-empty provider and model: ${path}`);
		}
		if (settings.thinkingLevel !== undefined && (typeof settings.thinkingLevel !== "string" || !["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(settings.thinkingLevel))) {
			throw new Error(`Invalid implementModel.thinkingLevel: ${path}`);
		}
	}
	return values as Config;
}

function parseArtifactDir(root: string, id: string, override?: string): string {
	const template = override || readConfig().artifactDir || ".agents/projects/{taskId}";
	const expanded = template.replaceAll("{projectRoot}", root).replaceAll("{taskId}", id);
	return isAbsolute(expanded) ? resolve(expanded) : resolve(root, expanded);
}

type Argument = { value: string; quoted: boolean };

function parseArguments(input: string): Argument[] {
	const args: Argument[] = [];
	let index = 0;
	while (index < input.length) {
		while (/\s/.test(input[index] || "") && index < input.length) index++;
		if (index >= input.length) break;
		const quote = input[index] === '"' || input[index] === "'" ? input[index++] : undefined;
		const start = index;
		if (quote) {
			while (index < input.length && input[index] !== quote) index++;
			if (index >= input.length) throw new Error("Unclosed quote in /task arguments.");
			const value = input.slice(start, index++);
			if (index < input.length && !/\s/.test(input[index])) throw new Error("Separate quoted /task arguments with spaces.");
			args.push({ value, quoted: true });
		} else {
			while (index < input.length && !/\s/.test(input[index])) {
				if (input[index] === '"' || input[index] === "'") throw new Error("Quote the entire task ID when it contains spaces.");
				index++;
			}
			args.push({ value: input.slice(start, index), quoted: false });
		}
	}
	return args;
}

function validateTaskId(id: string): void {
	if (id.trim() !== id || !/^[A-Za-z0-9][A-Za-z0-9._ -]*$/.test(id)) {
		throw new Error("Task ID may contain letters, digits, dots, underscores, hyphens, and internal spaces. Quote IDs with spaces.");
	}
}

function loadState(path: string): TaskState {
	const data = JSON.parse(readFileSync(path, "utf8")) as TaskState;
	if (data.version !== 1 || !data.id || !data.projectRoot || !data.contextPath || !Array.isArray(data.completedSteps)) {
		throw new Error(`Invalid task state: ${path}`);
	}
	return data;
}

function projectMismatchMessage(state: TaskState, currentRoot: string, path: string): string {
	const lines = [
		`Task ${state.id} was created for a different project directory.`,
		`State file: ${path}`,
		`Saved project root: ${state.projectRoot}`,
		`Current project root: ${currentRoot}`,
		`To continue the original task, start Pi from the saved project root. If you moved the task intentionally, update projectRoot, artifactDir, and contextPath in state.json to their new locations. You can also start a fresh task with a different ID.`,
	];
	if (state.pendingBaselineDir) lines.push("This task has an unfinished implementation or review. Its pendingBaselineDir snapshot and pendingFiles/pendingHashes paths still refer to the original project layout. Reconcile them before continuing; changing projectRoot alone is unsafe.");
	return lines.join("\n");
}

type DiscoveredTask = { state: TaskState; path: string };

function taskIndexDir(): string {
	return join(process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"), "task-workflow-index");
}

function rememberTask(state: TaskState, path: string): void {
	const directory = taskIndexDir();
	mkdirSync(directory, { recursive: true });
	const name = createHash("sha256").update(`${state.projectRoot}\0${state.id}`).digest("hex") + ".json";
	const target = join(directory, name);
	const temporary = join(directory, `.task-index-${randomUUID()}.tmp`);
	try {
		writeFileSync(temporary, `${JSON.stringify({ projectRoot: state.projectRoot, id: state.id, statePath: path })}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
		renameSync(temporary, target);
	} finally {
		if (existsSync(temporary)) rmSync(temporary);
	}
}

function indexedStatePaths(root: string): string[] {
	const directory = taskIndexDir();
	if (!existsSync(directory)) return [];
	const paths: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
		try {
			const record = JSON.parse(readFileSync(join(directory, entry.name), "utf8")) as { projectRoot?: unknown; statePath?: unknown };
			if (record.projectRoot === root && typeof record.statePath === "string") paths.push(record.statePath);
		} catch { /* A stale index entry must not hide other tasks. */ }
	}
	return paths;
}

function templateStatePaths(root: string, template: string): string[] {
	const expanded = template.replaceAll("{projectRoot}", root);
	const absolute = isAbsolute(expanded) ? resolve(expanded) : resolve(root, expanded);
	const marker = "{taskId}";
	const offset = absolute.indexOf(marker);
	if (offset < 0) return [statePath(absolute)];
	const before = absolute.slice(0, offset);
	const after = absolute.slice(offset + marker.length);
	if (!before.endsWith(sep) || (after && !after.startsWith(sep)) || after.includes(marker)) return [];
	const parent = resolve(before);
	if (!existsSync(parent)) return [];
	const suffix = after.replace(/^[/\\]+/, "");
	return readdirSync(parent, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => statePath(join(parent, entry.name, suffix)));
}

function listTasks(root: string): DiscoveredTask[] {
	const configured = readConfig().artifactDir || ".agents/projects/{taskId}";
	const candidates = [
		...templateStatePaths(root, configured),
		...templateStatePaths(root, ".agents/projects/{taskId}"),
		...indexedStatePaths(root),
	];
	const tasks = new Map<string, DiscoveredTask>();
	for (const path of candidates) {
		try {
			if (!lstatSync(path).isFile()) continue;
			const state = loadState(path);
			if (state.projectRoot !== root || resolve(statePath(taskDir(state))) !== resolve(path)) continue;
			if (!tasks.has(state.id)) tasks.set(state.id, { state, path });
		} catch { /* Ignore missing or invalid state files. */ }
	}
	return [...tasks.values()].sort((a, b) => a.state.id.localeCompare(b.state.id));
}

function taskDescription(state: TaskState): string {
	try {
		const content = readFileSync(state.contextPath, "utf8");
		for (const line of content.split(/\r?\n/)) {
			const text = line.trim();
			if (!text || text.startsWith("#") || text === "---") continue;
			const plain = text.replace(/^[-*]\s+/, "").replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ");
			if (plain) return plain.length > 90 ? `${plain.slice(0, 87)}...` : plain;
		}
	} catch { /* The task can still be listed without its context. */ }
	return "No description yet";
}

function taskProgress(state: TaskState): string {
	let total: number | undefined;
	try { total = stepCount(state); } catch { /* Roadmap may not exist yet. */ }
	if (state.phase === "collect") return "Collecting context";
	if (state.phase === "research") return "Researching code";
	if (state.phase === "roadmap") return "Planning roadmap";
	if (state.phase === "steps") return `Designing step ${state.currentStep}${total ? `/${total}` : ""}`;
	if (state.phase === "implement" && total && state.currentStep > total) return `Complete (${state.completedSteps.length}/${total} steps)`;
	if (state.phase === "implement") return `Implementing step ${state.currentStep}${total ? `/${total}` : ""}`;
	const step = state.awaitingReview || state.currentStep;
	if (state.reviewPending) return `Reviewing step ${step}${total ? `/${total}` : ""} (review pending)`;
	let findings = "";
	try { findings = `, ${openReviewFindings(state, step)} open findings`; } catch { /* Review may be missing or stale. */ }
	return `Reviewing step ${step}${total ? `/${total}` : ""}${findings}`;
}

function saveState(state: TaskState): void {
	const path = statePath(taskDir(state));
	writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function taskLink(ctx: ExtensionContext): TaskLink | undefined {
	const entries = ctx.sessionManager.getBranch();
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type !== "custom" || entry.customType !== ENTRY_TYPE) continue;
		const data = entry.data as Partial<TaskLink> | undefined;
		return { id: data?.id || "", statePath: data?.statePath || "" };
	}
	return undefined;
}

function requireTask(ctx: ExtensionContext): TaskState {
	const link = taskLink(ctx);
	if (!link) throw new Error("No task is attached to this session. Use /task TASK-ID.");
	const linked = loadState(link.statePath);
	const root = projectRoot(ctx.cwd);
	if (root !== linked.projectRoot) throw new Error(projectMismatchMessage(linked, root, link.statePath));
	return linked;
}

function attachTask(pi: ExtensionAPI, ctx: ExtensionCommandContext, state: TaskState, path: string): void {
	const current = taskLink(ctx);
	if (current?.id === state.id && current.statePath === path) {
		ctx.ui.notify(`Task ${state.id} is already attached to this session.`, "info");
		return;
	}
	pi.appendEntry(ENTRY_TYPE, { id: state.id, statePath: path } satisfies TaskLink);
	pi.setSessionName(`Task ${state.id}`);
	try { rememberTask(state, path); } catch { ctx.ui.notify("Task attached, but its discovery index could not be updated.", "warning"); }
	ctx.ui.notify(`Attached task ${state.id} (${state.phase}).`, "info");
}

async function continueTask(pi: ExtensionAPI, ctx: ExtensionCommandContext, state: TaskState, path: string): Promise<void> {
	const current = taskLink(ctx);
	if (current && (current.id !== state.id || current.statePath !== path)) {
		const result = await ctx.newSession({
			setup: async (session) => {
				session.appendCustomEntry(ENTRY_TYPE, { id: state.id, statePath: path } satisfies TaskLink);
				session.appendSessionInfo(`Task ${state.id}`);
			},
			withSession: async (fresh) => {
				try { rememberTask(state, path); } catch { fresh.ui.notify("Task attached, but its discovery index could not be updated.", "warning"); }
				fresh.ui.notify(`Attached task ${state.id} (${state.phase}) in a new session.`, "info");
			},
		});
		if (result.cancelled) ctx.ui.notify("New session was cancelled.", "warning");
		return;
	}
	attachTask(pi, ctx, state, path);
}

function send(pi: ExtensionAPI, action: string, instruction: string): void {
	pi.sendUserMessage(`[task-workflow:${action}]\n${instruction}`);
}

function roadmapPath(state: TaskState): string { return join(taskDir(state), "roadmap.md"); }
function stepPath(state: TaskState, n: number): string { return join(taskDir(state), `step-${n}.md`); }
function reviewPath(state: TaskState, n: number): string { return join(taskDir(state), `review-${n}.md`); }

type ArtifactKind = "context" | "roadmap" | "step" | "review";

function artifactPath(state: TaskState, kind: ArtifactKind, step?: number): string {
	if (kind === "context") return state.contextPath;
	if (kind === "roadmap") return roadmapPath(state);
	if (kind === "review") return reviewPath(state, step || state.awaitingReview || state.currentStep);
	return stepPath(state, step || state.pendingStep || state.currentStep);
}

function writeArtifact(state: TaskState, kind: ArtifactKind, content: string, step?: number): string {
	if (step !== undefined && (kind === "context" || kind === "roadmap")) throw new Error("The step argument is only valid for step and review artifacts.");
	const targetStep = kind === "review" ? step || state.awaitingReview || state.currentStep : step || state.pendingStep || state.currentStep;
	const path = artifactPath(state, kind, step);
	if (kind === "context" && resolve(path) !== resolve(taskDir(state), "context.md")) {
		throw new Error("This task uses a legacy context file outside artifactDir. Move it into the task directory before writing.");
	}
	if (kind === "review") validateReviewSnippets(state, targetStep, content);
	if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error(`Refusing to replace a symbolic link: ${path}`);
	const temporary = join(taskDir(state), `.task-write-${randomUUID()}.tmp`);
	try {
		writeFileSync(temporary, content.endsWith("\n") ? content : `${content}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
		renameSync(temporary, path);
	} finally {
		if (existsSync(temporary)) rmSync(temporary);
	}
	if ((state.pendingAction === "research" && kind === "context") || (state.pendingAction === "roadmap" && kind === "roadmap") || (state.pendingAction === "step" && kind === "step" && targetStep === (state.pendingStep || state.currentStep))) {
		state.pendingArtifactWritten = true;
		saveState(state);
	}
	return path;
}

function stepCount(state: TaskState): number {
	const text = readFileSync(roadmapPath(state), "utf8");
	const numbers = [...text.matchAll(/^(\d+)\.\s+\*\*[^\n]+\*\*\s+[-–—]\s+/gm)].map((match) => Number(match[1]));
	if (!numbers.length || numbers.some((number, index) => number !== index + 1)) {
		throw new Error("roadmap.md must contain consecutive numbered steps in the required format.");
	}
	return numbers.length;
}

function exclusions(state: TaskState): string[] {
	const paths = [taskDir(state), state.contextPath];
	return paths.flatMap((path) => {
		const rel = relative(state.projectRoot, path);
		return rel && rel !== ".." && !rel.startsWith(`..${sep}`) ? [`:(exclude)${rel}`] : [];
	});
}

type Baseline = { directory: string; paths: Map<string, string | null>; hashes: Map<string, string | null>; gitRepository: boolean };

function hasGitRepository(state: TaskState): boolean {
	try { return resolve(git(state.projectRoot, ["rev-parse", "--show-toplevel"])) === resolve(state.projectRoot); }
	catch { return false; }
}

async function projectFiles(state: TaskState, onProgress?: (message: string) => void, maxFiles?: number): Promise<Set<string>> {
	const files = new Set<string>();
	const artifactDirectory = resolve(taskDir(state));
	const stack = [state.projectRoot];
	let inspected = 0;
	while (stack.length) {
		const directory = stack.pop()!;
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (resolve(path) === artifactDirectory || entry.isSymbolicLink()) continue;
			if (entry.isDirectory()) {
				if (entry.name !== ".git") stack.push(path);
			} else if (entry.isFile()) {
				files.add(relative(state.projectRoot, path));
				if (maxFiles && files.size > maxFiles) throw new Error(`Snapshot limit exceeded: more than ${maxFiles} files. No files were copied. Raise snapshotMaxFiles in task-workflow.json to allow this project.`);
			}
			if (++inspected % 100 === 0) {
				onProgress?.(`Scanning project files: ${inspected} entries`);
				await new Promise<void>((done) => setImmediate(done));
			}
		}
	}
	return files;
}

function changedPaths(state: TaskState): string[] {
	const paths = [
		...git(state.projectRoot, ["ls-files", "-z", "-m", "-d", "-o", "--exclude-standard", "--", ".", ...exclusions(state)]).split("\0"),
		...git(state.projectRoot, ["diff", "--cached", "--name-only", "-z", "--", ".", ...exclusions(state)]).split("\0"),
	];
	return [...new Set(paths.filter(Boolean))];
}

async function captureBaseline(state: TaskState, gitRepository: boolean, onProgress?: (message: string) => void): Promise<Baseline> {
	const config = readConfig();
	const maxFiles = config.snapshotMaxFiles ?? DEFAULT_SNAPSHOT_MAX_FILES;
	const maxMiB = config.snapshotMaxMiB ?? DEFAULT_SNAPSHOT_MAX_MIB;
	const files = gitRepository ? changedPaths(state) : [...await projectFiles(state, onProgress, maxFiles)];
	let copyCount = 0;
	let totalBytes = 0;
	for (const [index, file] of files.entries()) {
		const source = join(state.projectRoot, file);
		if (!existsSync(source)) continue;
		copyCount++;
		if (copyCount > maxFiles) throw new Error(`Snapshot limit exceeded: ${copyCount} files (limit ${maxFiles}). No files were copied. Raise snapshotMaxFiles in task-workflow.json to allow this project.`);
		totalBytes += (await fsPromises.stat(source)).size;
		if (totalBytes > maxMiB * 1024 * 1024) throw new Error(`Snapshot limit exceeded: more than ${maxMiB} MiB. No files were copied. Raise snapshotMaxMiB in task-workflow.json to allow this project.`);
		if (index % 100 === 0) onProgress?.(`Checking snapshot size: ${index + 1}/${files.length} files`);
	}
	const directory = mkdtempSync(join(taskDir(state), ".implementation-baseline-"));
	const paths = new Map<string, string | null>();
	const hashes = new Map<string, string | null>();
	try {
		for (const [index, file] of files.entries()) {
			const source = join(state.projectRoot, file);
			if (!existsSync(source)) { paths.set(file, null); hashes.set(file, null); continue; }
			const snapshot = join(directory, String(index));
			await fsPromises.copyFile(source, snapshot, fsConstants.COPYFILE_FICLONE);
			paths.set(file, snapshot);
			hashes.set(file, fileHash(directory, String(index)));
			if (index % 100 === 0) onProgress?.(`Snapshotting project files: ${index + 1}/${files.length}`);
		}
	} catch (error) {
		rmSync(directory, { recursive: true, force: true });
		throw error;
	}
	writeFileSync(join(directory, "manifest.json"), JSON.stringify({ gitRepository, paths: [...paths].map(([file, snapshot]) => [file, snapshot ? basename(snapshot) : null]), hashes: [...hashes] }), "utf8");
	return { directory, paths, hashes, gitRepository };
}

function loadBaseline(directory: string): Baseline {
	const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8")) as { gitRepository: boolean; paths: Array<[string, string | null]>; hashes?: Array<[string, string | null]> };
	return { directory, gitRepository: manifest.gitRepository, paths: new Map(manifest.paths.map(([file, snapshot]) => [file, snapshot ? join(directory, snapshot) : null])), hashes: new Map(manifest.hashes || []) };
}

function diffNoIndex(state: TaskState, before: string | null, after: string | null, file: string): string {
	try {
		return execFileSync("git", ["diff", "--no-ext-diff", "--no-index", "--binary", "--", before || "/dev/null", after || "/dev/null"], {
			cwd: state.projectRoot, encoding: "utf8", maxBuffer: 20 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
		}).trimEnd();
	} catch (error) {
		const failure = error as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
		if (failure.status !== 1) throw new Error(failure.stderr?.toString().trim() || `Cannot diff ${file}.`);
		const output = failure.stdout?.toString().trimEnd();
		return output ? `# ${file}\n${output}` : "";
	}
}

async function implementationDiff(state: TaskState, baseline: Baseline, onProgress?: (message: string) => void): Promise<{ diff: string; files: string[] }> {
	const parts: string[] = [];
	const files: string[] = [];
	const currentFiles = baseline.gitRepository ? undefined : await projectFiles(state, onProgress);
	const candidates = baseline.gitRepository ? changedPaths(state) : [...new Set([...baseline.paths.keys(), ...currentFiles!])];
	for (const [index, file] of candidates.entries()) {
		const current = join(state.projectRoot, file);
		let patch: string;
		if (!baseline.gitRepository) {
			const snapshot = baseline.paths.get(file);
			if (snapshot && currentFiles!.has(file)) {
				const before = baseline.hashes.get(file) ?? fileHash(baseline.directory, basename(snapshot));
				if (before === fileHash(state.projectRoot, file)) {
					if (index % 100 === 0) { onProgress?.(`Comparing project files: ${index + 1}/${candidates.length}`); await new Promise<void>((done) => setImmediate(done)); }
					continue;
				}
			}
			patch = diffNoIndex(state, baseline.paths.get(file) || null, currentFiles!.has(file) ? current : null, file);
		} else if (baseline.paths.has(file)) {
			const before = baseline.paths.get(file) || null;
			patch = diffNoIndex(state, before, existsSync(current) ? current : null, file);
		} else {
			const tracked = git(state.projectRoot, ["ls-files", "--", file]);
			patch = tracked ? git(state.projectRoot, ["diff", "--binary", "HEAD", "--", file]) : diffNoIndex(state, null, current, file);
		}
		if (patch) { parts.push(patch); files.push(file); }
		if (index % 100 === 0) { onProgress?.(`Comparing project files: ${index + 1}/${candidates.length}`); await new Promise<void>((done) => setImmediate(done)); }
	}
	return { diff: parts.join("\n\n"), files };
}

function fileHash(root: string, file: string): string | null {
	const path = join(root, file);
	return existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex") : null;
}

function validateReviewSnippets(state: TaskState, step: number, content: string): void {
	if (!content.startsWith(`# Review: step ${step}\n`) || !content.includes("\n## Findings\n")) throw new Error("Keep the review title and Findings section in review-N.md.");
	const diff = readFileSync(join(taskDir(state), `implementation-${step}.diff`), "utf8");
	const snippets = [...content.matchAll(/```diff\r?\n([\s\S]*?)\r?\n```/g)].map((match) => match[1]);
	const findings = [...content.matchAll(/^### /gm)].length;
	if (snippets.length !== findings) throw new Error("Each review finding must include one fenced diff snippet.");
	for (const snippet of snippets) if (!snippet.trim() || !diff.includes(snippet)) throw new Error("A review snippet does not match implementation-N.diff.");
	for (const section of content.split(/^### /m).slice(1)) {
		const statuses = [...section.matchAll(/^Status: (open|resolved|dismissed)$/gm)];
		if (statuses.length > 1) throw new Error("Each review finding may have only one Status line.");
		if (/^Status: /m.test(section) && statuses.length !== 1) throw new Error("Review finding status must be open, resolved, or dismissed.");
	}
}

function openReviewFindings(state: TaskState, step: number): number {
	const content = readFileSync(reviewPath(state, step), "utf8");
	validateReviewSnippets(state, step, content);
	return content.split(/^### /m).slice(1).filter((section) => !/^Status: (resolved|dismissed)$/m.test(section)).length;
}

type ReviewFinding = { severity: string; file: string; line: number; issue: string; snippet: string; recommendation: string };

function formatReview(state: TaskState, step: number, answer: string): string {
	const json = answer.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
	let value: unknown;
	try { value = JSON.parse(json); } catch { throw new Error("The review agent did not return valid JSON. Use /task next to retry review."); }
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid review response.");
	const review = value as { summary?: unknown; findings?: unknown };
	if (typeof review.summary !== "string" || !Array.isArray(review.findings) || review.findings.length > 20) throw new Error("Invalid review summary or findings.");
	const diff = readFileSync(join(taskDir(state), `implementation-${step}.diff`), "utf8");
	const parts = [`# Review: step ${step}`, "", "## Summary", "", review.summary.trim(), "", "## Findings", ""];
	if (!review.findings.length) parts.push("No findings.");
	for (const item of review.findings) {
		if (!item || typeof item !== "object") throw new Error("Invalid review finding.");
		const finding = item as Partial<ReviewFinding>;
		if (typeof finding.severity !== "string" || typeof finding.file !== "string" || typeof finding.line !== "number" || !Number.isInteger(finding.line) || finding.line < 1 || typeof finding.issue !== "string" || typeof finding.snippet !== "string" || typeof finding.recommendation !== "string" || !finding.snippet.trim() || finding.snippet.length > 3000 || !diff.includes(finding.snippet)) {
			throw new Error("Review findings need valid locations and exact snippets from the implementation diff. Use /task next to retry review.");
		}
		parts.push(`### ${finding.severity}: ${finding.file}:${finding.line}`, "", "Status: open", "", finding.issue.trim(), "", "```diff", finding.snippet, "```", "", `Suggested change: ${finding.recommendation.trim()}`, "");
	}
	const content = parts.join("\n").trimEnd() + "\n";
	validateReviewSnippets(state, step, content);
	return content;
}

async function draftCommitMessage(ctx: ExtensionContext, state: TaskState, step: number): Promise<{ title: string; body: string }> {
	if (!ctx.model) throw new Error("Select a model before drafting the commit message.");
	const diff = readFileSync(join(taskDir(state), `implementation-${step}.diff`), "utf8");
	const user: Message = { role: "user", content: [{ type: "text", text: `Task: ${state.id}\nStep: ${step}\nWorker summary:\n${state.pendingSummary || "(none)"}\n\nChanges in this step:\n${diff}` }], timestamp: Date.now() };
	const response = await ctx.modelRegistry.complete(ctx.model, {
		systemPrompt: "Write an English Git commit message for exactly the supplied changes. Return only a JSON object with string fields title and body. Use a concise, specific imperative title. The body should explain the changes and their purpose in useful detail. Mention checks only when the supplied summary supports them. Do not invent behavior, motivation, or test outcomes.",
		messages: [user],
	}, { cacheRetention: "none", sessionId: uuidv7() });
	if (response.stopReason === "error" || response.stopReason === "aborted") throw new Error("Commit-message generation failed.");
	const text = response.content.filter((part) => part.type === "text").map((part) => part.text).join("\n").trim();
	const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
	let message: { title?: unknown; body?: unknown };
	try { message = JSON.parse(json) as { title?: unknown; body?: unknown }; }
	catch { throw new Error("The model did not return a valid commit message. Use /task next to retry."); }
	if (typeof message.title !== "string" || !message.title.trim() || message.title.includes("\n") || typeof message.body !== "string" || !message.body.trim()) {
		throw new Error("The model returned an incomplete commit message. Use /task next to retry.");
	}
	return { title: message.title.trim(), body: message.body.trim() };
}

type TransitionAssessment = { openQuestions: string[]; pendingProposal: string; reason: string };

async function assessTransition(ctx: ExtensionContext, state: TaskState, command: "next" | "accept", note: string): Promise<TransitionAssessment> {
	if (!ctx.model) throw new Error("Select a model before using /task next or /task accept.");
	const branch = ctx.sessionManager.getBranch();
	let boundary = 0;
	for (let index = 0; index < branch.length; index++) {
		const entry = branch[index];
		if (entry.type !== "message") continue;
		if (entry.message.role === "custom" && ["task-review", "task-implementation", "task-commit"].includes((entry.message as { customType?: string }).customType || "")) boundary = index + 1;
		if (entry.message.role === "user") {
			const content = entry.message.content;
			const body = typeof content === "string" ? content : content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
			if (body.startsWith("[task-workflow:")) boundary = index + 1;
		}
	}
	const messages = branch.slice(boundary).flatMap((entry) => {
		if (entry.type !== "message" || (entry.message.role !== "user" && entry.message.role !== "assistant")) return [];
		const content = entry.message.content;
		const body = typeof content === "string" ? content : content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
		if (!body.trim() || body.startsWith("[task-workflow:")) return [];
		return [`${entry.message.role}: ${body.slice(0, 5000)}`];
	}).slice(-16).join("\n\n").slice(-24_000);
	const review = state.phase === "review" && state.awaitingReview && existsSync(reviewPath(state, state.awaitingReview)) ? readFileSync(reviewPath(state, state.awaitingReview), "utf8").slice(0, 10_000) : "";
	const user: Message = { role: "user", content: [{ type: "text", text: `Task: ${state.id}\nPhase: ${state.phase}\nCommand: /task ${command}\nCommand note: ${note || "(none)"}\n\nRecent discussion:\n${messages || "(none)"}\n\nCurrent review artifact, if any:\n${review || "(none)"}` }], timestamp: Date.now() };
	const started = Date.now();
	const update = () => ctx.ui.setStatus("task-transition", `Checking task transition · ${Math.floor((Date.now() - started) / 1000)}s`);
	update();
	const timer = setInterval(update, 1000);
	try {
		const response = await ctx.modelRegistry.complete(ctx.model, {
			systemPrompt: `You are a conservative gate for a task workflow. Analyze only the current phase's recent discussion and the current review artifact. Return only JSON with fields openQuestions (array of strings), pendingProposal (string), reason (string). An open question is a material question or uncertainty that the assistant still needs the user to answer before this phase can advance. Do not count optional invitations for more context. A routine request to approve one clear proposal (such as "Does this plan look good?") is not an open question; /task accept answers it. If the assistant offers several options without a clear recommendation and the command note does not select one, that choice is an open question. A pending proposal is a concrete assistant recommendation, option, plan, or decision awaiting the user's approval. Do not count a proposal already clearly accepted in a previous ordinary user message. Review findings and their suggested changes are handled by a separate repair workflow; do not treat the findings themselves as open questions or pending proposals. A later proposal by the parent assistant about how to handle a finding can be pending. For /task accept, consider the command note as the user's answer or choice, but still report any questions it does not settle. Summarize the exact proposal that /task accept would approve in pendingProposal. For /task next, do not treat the command as approval of a pending proposal. If evidence is ambiguous, report the uncertainty as an open question. Do not invent questions or proposals from earlier phases. Keep each field concise.`,
			messages: [user],
		}, { cacheRetention: "none", sessionId: uuidv7() });
		if (response.stopReason === "error" || response.stopReason === "aborted") throw new Error("Could not check whether the task is ready to advance. The phase is unchanged.");
		const answer = response.content.filter((part) => part.type === "text").map((part) => part.text).join("\n").trim();
		let value: unknown;
		try { value = JSON.parse(answer.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); }
		catch { throw new Error("The transition check returned an invalid response. The phase is unchanged."); }
		if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The transition check returned an invalid response. The phase is unchanged.");
		const result = value as Partial<TransitionAssessment>;
		if (!Array.isArray(result.openQuestions) || result.openQuestions.some((item) => typeof item !== "string") || typeof result.pendingProposal !== "string" || typeof result.reason !== "string") throw new Error("The transition check returned an invalid response. The phase is unchanged.");
		return { openQuestions: result.openQuestions.slice(0, 5).map((item) => item.replace(/\s+/g, " ").slice(0, 500)), pendingProposal: result.pendingProposal.replace(/\s+/g, " ").trim().slice(0, 2000), reason: result.reason.replace(/\s+/g, " ").slice(0, 1000) };
	} finally {
		clearInterval(timer);
		ctx.ui.setStatus("task-transition", undefined);
	}
}

function commitStep(state: TaskState, title: string, body: string): string {
	const files = state.pendingFiles || [];
	if (!files.length) throw new Error("There are no changed files to commit.");
	const expected = new Set(files);
	const current = changedPaths(state);
	if (current.length !== expected.size || current.some((file) => !expected.has(file))) {
		throw new Error("The working tree changed after the implementation diff was shown. Review it before retrying the commit.");
	}
	for (const file of files) {
		if (fileHash(state.projectRoot, file) !== state.pendingHashes?.[file]) {
			throw new Error(`File changed after review: ${file}. Review it before retrying the commit.`);
		}
	}
	git(state.projectRoot, ["add", "-A", "--", ...files]);
	git(state.projectRoot, ["commit", "--only", "-m", title, "-m", body, "--", ...files]);
	return git(state.projectRoot, ["rev-parse", "--short", "HEAD"]);
}

async function showArtifact(ctx: ExtensionCommandContext, title: string, content: string): Promise<void> {
	if (ctx.mode !== "tui") {
		ctx.ui.notify(`${title}\n\n${content}`, "info");
		return;
	}
	await ctx.ui.custom<void>((tui, theme, _keys, done) => {
		const markdown = new Markdown(content, 0, 0, getMarkdownTheme());
		let scroll = 0;
		return {
			render(width: number): string[] {
				const inner = Math.max(1, width - 4);
				const lines = markdown.render(inner);
				const height = Math.max(1, Math.floor(tui.terminal.rows * 0.75) - 4);
				scroll = Math.min(scroll, Math.max(0, lines.length - height));
				const row = (value: string): string => {
					const text = truncateToWidth(value, inner);
					return `${theme.fg("accent", "│")} ${text}${" ".repeat(Math.max(0, inner - visibleWidth(text)))} ${theme.fg("accent", "│")}`;
				};
				return [
					theme.fg("accent", `┌${"─".repeat(Math.max(0, width - 2))}┐`),
					row(theme.bold(title)),
					...lines.slice(scroll, scroll + height).map(row),
					row(theme.fg("dim", `j/k scroll · Enter/Esc close · ${scroll + 1}-${Math.min(scroll + height, lines.length)}/${lines.length}`)),
					theme.fg("accent", `└${"─".repeat(Math.max(0, width - 2))}┘`),
				];
			},
			handleInput(data: string): void {
				if (matchesKey(data, "enter") || matchesKey(data, "escape")) done();
				else if (data === "k" || matchesKey(data, "up")) scroll = Math.max(0, scroll - 1);
				else if (data === "j" || matchesKey(data, "down")) scroll++;
				else if (matchesKey(data, "pageUp")) scroll = Math.max(0, scroll - 10);
				else if (matchesKey(data, "pageDown")) scroll += 10;
				tui.requestRender();
			},
			invalidate(): void { markdown.invalidate(); },
		};
	}, { overlay: true, overlayOptions: { anchor: "center", width: "85%" } });
}

function piInvocation(args: string[]): { command: string; args: string[] } {
	const script = process.argv[1];
	if (script && !script.startsWith("/$bunfs/root/") && existsSync(script)) return { command: process.execPath, args: [script, ...args] };
	const executable = basename(process.execPath).toLowerCase();
	if (!/^(node|bun)(\.exe)?$/.test(executable)) return { command: process.execPath, args };
	return { command: "pi", args };
}

async function runWorker(state: TaskState, step: number, ctx: ExtensionContext, onProgress: (message: string) => void, review?: string, approval?: string, signal?: AbortSignal, onText?: (text: string) => void): Promise<string> {
	const count = stepCount(state);
	const allSteps = Array.from({ length: count }, (_, index) => {
		const n = index + 1;
		return `## Step ${n} (${state.completedSteps.includes(n) ? "completed" : n === step ? "implement now" : "planned"})\n${readFileSync(stepPath(state, n), "utf8")}`;
	}).join("\n\n");
	const prompt = `${review ? "Repair" : "Implement"} step ${step} of task ${state.id} in the current working tree.\n\n# Task context\n${readFileSync(state.contextPath, "utf8")}\n\n# Approved roadmap\n${readFileSync(roadmapPath(state), "utf8")}\n\n# Approved step details\n${allSteps}${review ? `\n\n# Review discussion\n${review}\n\nAddress only findings marked Status: open. Respect resolved or dismissed decisions. Inspect the current code before changing it.` : ""}${approval ? `\n\n# User approval\n${approval}` : ""}\n\nWork only on step ${step}. Respect project instructions. Inspect existing code before editing. Run focused checks where useful. Do not commit. End with a concise summary of changes and checks; the parent will collect and display the diff.`;
	const args = ["--mode", "json", "-p", "--no-session", "--no-extensions"];
	const override = readConfig().implementModel;
	if (override) {
		args.push("--provider", override.provider, "--model", override.model);
		const thinking = override.thinkingLevel ?? ctx.thinkingLevel;
		if (thinking) args.push("--thinking", thinking);
	} else {
		if (ctx.model) args.push("--provider", ctx.model.provider, "--model", ctx.model.id);
		if (ctx.thinkingLevel) args.push("--thinking", ctx.thinkingLevel);
	}
	args.push(prompt);
	return runPiProcess(state, args, onProgress, "implementation", signal, onText);
}

async function runPiProcess(state: TaskState, args: string[], onProgress: (message: string) => void, label: string, signal?: AbortSignal, onText?: (text: string) => void): Promise<string> {
	const invocation = piInvocation(args);
	return await new Promise<string>((resolvePromise, reject) => {
		const child = spawn(invocation.command, invocation.args, { cwd: state.projectRoot, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
		let pending = "";
		let stderr = "";
		let answer = "";
		let stopReason = "";
		let lastToolUpdate = 0;
		let stopped: Error | undefined;
		let killTimer: ReturnType<typeof setTimeout> | undefined;
		const killWorker = (force = false) => {
			if (!child.pid) return;
			try {
				if (process.platform !== "win32") process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
				else child.kill(force ? "SIGKILL" : "SIGTERM");
			} catch { /* The process may already have exited. */ }
		};
		const stop = (reason: Error) => {
			if (stopped) return;
			stopped = reason;
			onProgress("Stopping worker");
			killWorker();
			killTimer = setTimeout(() => { killWorker(true); child.stdout.destroy(); child.stderr.destroy(); }, 3000);
		};
		const timeout = setTimeout(() => stop(new Error(`The ${label} agent exceeded 30 minutes.`)), 30 * 60_000);
		const abort = () => stop(new Error(`The ${label} agent was cancelled.`));
		if (signal?.aborted) abort();
		else signal?.addEventListener("abort", abort, { once: true });
		const cleanup = () => { clearTimeout(timeout); if (killTimer) clearTimeout(killTimer); signal?.removeEventListener("abort", abort); };
		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (chunk: string) => {
			pending += chunk;
			if (pending.length > 16 * 1024 * 1024) { stop(new Error(`The ${label} agent produced an oversized event.`)); return; }
			let index = pending.indexOf("\n");
			while (index >= 0) {
				const line = pending.slice(0, index);
				pending = pending.slice(index + 1);
				try {
					if (line.length > 8 * 1024 * 1024) { onProgress("Skipped a large worker event"); index = pending.indexOf("\n"); continue; }
					const event = JSON.parse(line) as { type?: string; toolName?: string; args?: Record<string, unknown>; isError?: boolean; result?: { content?: Array<{ type?: string; text?: string }> }; partialResult?: { content?: Array<{ type?: string; text?: string }> }; assistantMessageEvent?: { type?: string; delta?: string }; message?: { role?: string; stopReason?: string; content?: Array<{ type?: string; text?: string }> } };
					if (event.type === "agent_start") onProgress("Thinking");
					if (event.type === "auto_retry_start") onProgress("Retrying request");
					if (event.type === "tool_execution_start") {
						const detail = event.args ? JSON.stringify(event.args).replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 140) : "";
						onProgress(`Using ${event.toolName || "a tool"}${detail ? `: ${detail}` : ""}`);
					}
					if (event.type === "tool_execution_update" && Date.now() - lastToolUpdate > 1000) {
						const output = (event.partialResult?.content || []).filter((part) => part.type === "text").map((part) => part.text || "").join(" ").replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").slice(-180);
						if (output) { onProgress(`${event.toolName || "Tool"}: ${output}`); lastToolUpdate = Date.now(); }
					}
					if (event.type === "tool_execution_end") {
						const output = (event.result?.content || []).filter((part) => part.type === "text").map((part) => part.text || "").join(" ").replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").slice(-180);
						onProgress(`${event.toolName || "Tool"} ${event.isError ? "failed" : "finished"}${output ? `: ${output}` : ""}`);
					}
					if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta" && event.assistantMessageEvent.delta) onText?.(event.assistantMessageEvent.delta);
					if (event.type === "message_end" && event.message?.role === "assistant") {
						answer = (event.message.content || []).filter((part) => part.type === "text").map((part) => part.text || "").join("\n");
						stopReason = event.message.stopReason || "";
					}
				} catch { /* Ignore malformed progress records; process exit still determines success. */ }
				index = pending.indexOf("\n");
			}
		});
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (chunk: string) => { stderr = (stderr + chunk).slice(-64_000); });
		child.on("error", (error) => { cleanup(); reject(error); });
		child.on("close", (code) => {
			cleanup();
			if (stopped) reject(stopped);
			else if (code !== 0 || stopReason === "error" || stopReason === "aborted") reject(new Error(stderr.trim() || `${label} agent failed (exit ${code}, ${stopReason || "no stop reason"}).`));
			else resolvePromise(answer.trim() || `The ${label} agent finished without a text response.`);
		});
	});
}

type LiveTaskWorker = {
	statePath: string;
	id: string;
	step: number;
	phase: "implement" | "repair" | "review";
	controller: AbortController;
	started: number;
	lastActivity: number;
	activity: string[];
	response: string;
	logOpen: boolean;
	render?: () => void;
	closeLog?: () => void;
	worker?: Promise<string>;
};

let activeTaskWorker: LiveTaskWorker | undefined;
let activeTaskOperation: string | undefined;

function launchTaskOperation(ctx: ExtensionContext, state: TaskState, work: () => Promise<void>): void {
	const path = statePath(taskDir(state));
	if (activeTaskOperation) throw new Error("A task process is already running. Use /task status, /task log, or /task abort.");
	activeTaskOperation = path;
	void Promise.resolve().then(work)
		.catch((error) => ctx.ui.notify(error instanceof Error ? error.message : String(error), "error"))
		.finally(() => { if (activeTaskOperation === path) activeTaskOperation = undefined; });
}

function recordWorkerActivity(run: LiveTaskWorker, message: string): void {
	run.lastActivity = Date.now();
	run.activity.push(message);
	if (run.activity.length > 200) run.activity.shift();
	run.render?.();
}

async function showWorkerLog(ctx: ExtensionContext, run: LiveTaskWorker): Promise<void> {
	if (ctx.mode !== "tui" || run.logOpen) return;
	run.logOpen = true;
	const ticker = setInterval(() => run.render?.(), 1000);
	try {
		await ctx.ui.custom<void>((tui, theme, _keys, done) => {
			let scroll = 0;
			let follow = true;
			let maxScroll = 0;
			let closed = false;
			const close = () => { if (!closed) { closed = true; done(); } };
			run.render = () => tui.requestRender();
			run.closeLog = close;
			run.worker?.then(close, close);
			return {
				render(width: number): string[] {
					const inner = Math.max(1, width - 4);
					const height = Math.max(5, Math.floor(tui.terminal.rows * 0.7) - 5);
					const responseLines = run.response.trim() ? ["", "Assistant output:", ...run.response.split(/\r?\n/).slice(-12)] : [];
					const lines = [...run.activity, ...responseLines];
					maxScroll = Math.max(0, lines.length - height);
					if (follow) scroll = maxScroll;
					else scroll = Math.min(scroll, maxScroll);
					const row = (value: string) => {
						const shown = truncateToWidth(value, inner);
						return `${theme.fg("accent", "│")} ${shown}${" ".repeat(Math.max(0, inner - visibleWidth(shown)))} ${theme.fg("accent", "│")}`;
					};
					return [
						theme.fg("accent", `┌${"─".repeat(Math.max(0, width - 2))}┐`),
						row(theme.bold(`${run.phase} step ${run.step} · ${Math.floor((Date.now() - run.started) / 1000)}s · idle ${Math.floor((Date.now() - run.lastActivity) / 1000)}s`)),
						...lines.slice(scroll, scroll + height).map(row),
						row("Enter/Esc close log · j/k scroll"),
						row("/task log reopen · /task abort stop worker"),
						theme.fg("accent", `└${"─".repeat(Math.max(0, width - 2))}┘`),
					];
				},
				handleInput(data: string): void {
					if (matchesKey(data, "enter") || matchesKey(data, "escape")) close();
					else if (data === "k" || matchesKey(data, "up")) { follow = false; scroll = Math.max(0, scroll - 1); }
					else if (data === "j" || matchesKey(data, "down")) { scroll = Math.min(maxScroll, scroll + 1); follow = scroll >= maxScroll; }
					tui.requestRender();
				},
				invalidate(): void {},
			};
		}, { overlay: true, overlayOptions: { anchor: "center", width: "85%" } });
	} finally {
		clearInterval(ticker);
		run.render = undefined;
		run.closeLog = undefined;
		run.logOpen = false;
	}
}

async function runImplementationWithProgress(state: TaskState, step: number, ctx: ExtensionContext, onProgress: (message: string) => void, run: LiveTaskWorker, review?: string, approval?: string): Promise<string> {
	if (run.controller.signal.aborted) throw new Error("The implementation was cancelled before the worker started.");
	let lastRender = 0;
	const worker = runWorker(state, step, ctx, onProgress, review, approval, run.controller.signal, (text) => {
		run.lastActivity = Date.now();
		run.response = (run.response + text.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, " ")).slice(-4000);
		const now = Date.now();
		if (now - lastRender > 150) { lastRender = now; run.render?.(); }
	});
	run.worker = worker;
	if (run.closeLog) worker.then(run.closeLog, run.closeLog);
	return worker;
}

async function runReviewWorker(state: TaskState, step: number, ctx: ExtensionContext, onProgress: (message: string) => void, signal?: AbortSignal): Promise<string> {
	const diffPath = join(taskDir(state), `implementation-${step}.diff`);
	const configuredSkill = readConfig().reviewSkill;
	const skill = configuredSkill === undefined ? "task-review" : configuredSkill;
	const skillInstruction = skill ? `If a skill named ${skill} is available in your discovered skills, read its SKILL.md and follow instructions compatible with this read-only review.` : "No review skill is configured.";
	const previousReview = existsSync(reviewPath(state, step)) ? ` Read ${reviewPath(state, step)} for the previous review discussion. Recheck earlier findings against the current code; do not repeat dismissed findings unless new evidence changes the conclusion.` : "";
	const prompt = `Review step ${step} of task ${state.id}. Read these files first: ${state.contextPath}, ${roadmapPath(state)}, ${stepPath(state, step)}, and ${diffPath}.${previousReview} Inspect relevant project code as needed. ${skillInstruction} Do not modify files or run commands. Review the current implementation against the approved task and look for concrete defects or missing checks. Return only a JSON object with "summary" (string) and "findings" (array). Each finding must have "severity", "file" (repository-relative), "line" (positive line number in the current file), "issue", "snippet", and "recommendation". Copy each snippet as exact contiguous lines from the implementation diff, including diff markers; keep it short and near the reported issue. Include only actionable findings. Use an empty findings array when there are none. Do not wrap the JSON in commentary.`;
	const args = ["--mode", "json", "-p", "--no-session", "--no-extensions", "--no-mcp", "--tools", READ_TOOLS.join(",")];
	if (ctx.model) args.push("--provider", ctx.model.provider, "--model", ctx.model.id);
	if (ctx.thinkingLevel) args.push("--thinking", ctx.thinkingLevel);
	args.push(prompt);
	return runPiProcess(state, args, onProgress, "review", signal);
}

async function startReview(pi: ExtensionAPI, ctx: ExtensionContext, state: TaskState): Promise<void> {
	const step = state.awaitingReview;
	if (!step) throw new Error("No implementation is awaiting review.");
	const run: LiveTaskWorker = {
		statePath: statePath(taskDir(state)), id: state.id, step, phase: "review", controller: new AbortController(),
		started: Date.now(), lastActivity: Date.now(), activity: ["Starting review Pi..."], response: "", logOpen: false,
	};
	activeTaskWorker = run;
	state.reviewPending = true;
	saveState(state);
	const started = Date.now();
	let progress = "Starting";
	const update = () => ctx.ui.setStatus("task-review", `Task ${state.id} · review ${step} · ${progress} · ${Math.floor((Date.now() - started) / 1000)}s`);
	update();
	const timer = setInterval(update, 1000);
	try {
		const worker = runReviewWorker(state, step, ctx, (message) => { progress = message; recordWorkerActivity(run, message); update(); }, run.controller.signal);
		run.worker = worker;
		if (ctx.mode === "tui") void showWorkerLog(ctx, run).catch((error) => ctx.ui.notify(`Task log closed: ${error instanceof Error ? error.message : String(error)}`, "warning"));
		const answer = await worker;
		const content = formatReview(state, step, answer);
		const path = reviewPath(state, step);
		if (existsSync(path)) {
			const round = state.reviewRound || 1;
			writeFileSync(join(taskDir(state), `review-${step}-round-${round}.md`), readFileSync(path, "utf8"), "utf8");
			state.reviewRound = round + 1;
			saveState(state);
		} else { state.reviewRound = 1; saveState(state); }
		writeFileSync(path, content, "utf8");
		state.reviewPending = false;
		saveState(state);
		pi.sendMessage({ customType: "task-review", content: `${content}\nReview saved to ${path}. Discuss findings and update each Status. Use /task accept to approve a pending proposal, or /task next after the discussion is settled. Open findings start a repair run; otherwise the step is accepted.`, display: true });
	} finally {
		run.closeLog?.();
		clearInterval(timer);
		ctx.ui.setStatus("task-review", undefined);
		if (activeTaskWorker === run) activeTaskWorker = undefined;
	}
}

async function startImplementation(pi: ExtensionAPI, ctx: ExtensionContext, state: TaskState, review?: string, approval?: string): Promise<void> {
	const step = state.currentStep;
	const count = stepCount(state);
	if (step > count) throw new Error("All implementation steps are complete.");
	for (let n = 1; n <= count; n++) if (!existsSync(stepPath(state, n))) throw new Error(`Approved design for step ${n} is missing.`);
	const gitRepository = hasGitRepository(state);
	const run: LiveTaskWorker = {
		statePath: statePath(taskDir(state)), id: state.id, step, phase: review ? "repair" : "implement", controller: new AbortController(),
		started: Date.now(), lastActivity: Date.now(), activity: ["Preparing project baseline..."], response: "", logOpen: false,
	};
	const baselineClean = review || state.pendingBaselineDir ? state.pendingAutoCommitEligible === true : gitRepository && changedPaths(state).length === 0;
	if (!review && !state.pendingBaselineDir && gitRepository && readConfig().autoCommit && !baselineClean) {
		throw new Error("autoCommit requires a clean working tree before each implementation run. Commit or resolve existing code changes first.");
	}
	activeTaskWorker = run;
	const started = Date.now();
	let progress = state.pendingBaselineDir ? "Loading baseline" : "Scanning project files";
	let preparing = true;
	const update = () => {
		ctx.ui.setStatus("task-worker", `Task ${state.id} · step ${step} · ${progress} · ${Math.floor((Date.now() - started) / 1000)}s`);
		if (preparing) ctx.ui.setWidget("task-worker-preparing", [`Task ${state.id} · step ${step}: ${progress}`]);
	};
	const setProgress = (message: string) => { progress = message.slice(0, 100); recordWorkerActivity(run, progress); update(); };
	update();
	const timer = setInterval(update, 1000);
	let baseline: Baseline | undefined;
	let legacyRepair = false;
	let reviewReady = false;
	try {
		baseline = state.pendingBaselineDir ? loadBaseline(state.pendingBaselineDir) : await captureBaseline(state, gitRepository, setProgress);
		if (run.controller.signal.aborted) {
			if (!state.pendingBaselineDir) rmSync(baseline.directory, { recursive: true, force: true });
			throw new Error("The implementation was cancelled before the worker started.");
		}
		legacyRepair = !!review && !state.pendingBaselineDir;
		const priorDiff = legacyRepair ? readFileSync(join(taskDir(state), `implementation-${step}.diff`), "utf8").trimEnd() : "";
		if (!legacyRepair && !state.pendingBaselineDir) {
			state.pendingBaselineDir = baseline.directory;
			state.pendingAutoCommitEligible = baselineClean;
			state.pendingGitRepository = gitRepository;
			saveState(state);
		}
		preparing = false;
		ctx.ui.setWidget("task-worker-preparing", undefined);
		let summary: string;
		let succeeded = true;
		try {
			const worker = runImplementationWithProgress(state, step, ctx, setProgress, run, review, approval);
			if (ctx.mode === "tui") void showWorkerLog(ctx, run).catch((error) => ctx.ui.notify(`Task log closed: ${error instanceof Error ? error.message : String(error)}`, "warning"));
			summary = await worker;
		}
		catch (error) { succeeded = false; summary = error instanceof Error ? error.message : String(error); }
		run.closeLog?.();
		if (activeTaskWorker === run) activeTaskWorker = undefined;
		preparing = true;
		setProgress("Comparing project files");
		const changes = await implementationDiff(state, baseline, setProgress);
		const diff = priorDiff ? `${priorDiff}\n\n${changes.diff}` : changes.diff;
		const files = priorDiff ? [...new Set([...(state.pendingFiles || []), ...changes.files])] : changes.files;
		const path = join(taskDir(state), succeeded ? `implementation-${step}.diff` : `implementation-${step}-failed.diff`);
		writeFileSync(path, diff ? `${diff}\n` : "", "utf8");
		if (!succeeded && legacyRepair && changes.diff) writeFileSync(join(taskDir(state), `implementation-${step}.diff`), `${diff}\n`, "utf8");
		if (succeeded) {
			state.phase = "review";
			state.reviewPending = true;
			state.awaitingReview = step;
			state.pendingFiles = files;
			state.pendingHashes = Object.fromEntries(files.map((file) => [file, fileHash(state.projectRoot, file)]));
			state.pendingSummary = summary;
			state.pendingAutoCommitEligible = baselineClean;
			state.pendingGitRepository = gitRepository;
			state.pendingBaselineDir = legacyRepair ? undefined : baseline.directory;
			saveState(state);
			reviewReady = true;
		}
		const shown = diff.length > 60_000 ? `${diff.slice(0, 60_000)}\n... [truncated; full diff in ${path}]` : diff || "(No code changes were produced.)";
		pi.sendMessage({ customType: "task-implementation", content: `Step ${step} ${review ? "repair" : "implementation"} ${succeeded ? "finished" : "failed"}.\n\n${summary}\n\nDiff saved to ${path}. ${succeeded ? "A separate read-only review is starting." : "Review any partial changes before retrying /task next."}\n\n\`\`\`diff\n${shown}\n\`\`\``, display: true });
	} finally {
		run.closeLog?.();
		if (activeTaskWorker === run) activeTaskWorker = undefined;
		if (legacyRepair && baseline) rmSync(baseline.directory, { recursive: true, force: true });
		clearInterval(timer);
		ctx.ui.setStatus("task-worker", undefined);
		ctx.ui.setWidget("task-worker-preparing", undefined);
	}
	if (reviewReady && !run.controller.signal.aborted) await startReview(pi, ctx, state);
}

export default function taskExtension(pi: ExtensionAPI): void {
	pi.registerTool({
		name: ARTIFACT_TOOL,
		label: "Write Task Artifact",
		description: "Replace a task artifact in the task directory, regardless of the current phase. The extension chooses the file path.",
		defaultActive: false,
		parameters: Type.Object({
			artifact: Type.Union([Type.Literal("context"), Type.Literal("roadmap"), Type.Literal("step"), Type.Literal("review")]),
			step: Type.Optional(Type.Integer({ minimum: 1 })),
			content: Type.String({ minLength: 1 }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const state = requireTask(ctx);
			const path = writeArtifact(state, params.artifact, params.content, params.step);
			const next = state.phase === "roadmap" && params.artifact === "context" ? " Present the complete revised roadmap in your final response." : "";
			return { content: [{ type: "text", text: `Saved ${path}.${next}` }], details: { artifact: params.artifact, path } };
		},
	});
	pi.on("tool_call", (event, ctx) => {
		if (!taskLink(ctx)) return;
		try { requireTask(ctx); }
		catch { return { block: true, reason: "Task state is unavailable; all tools are blocked until it is restored." }; }
		if (READ_TOOLS.includes(event.toolName) || event.toolName === ARTIFACT_TOOL) return;
		return { block: true, reason: `The main task session allows only read tools and ${ARTIFACT_TOOL}. Code changes run in the implementation agent.` };
	});
	pi.on("session_before_tree", (_event, ctx) => {
		if (!taskLink(ctx)) return;
		try {
			if (readConfig().allowTreeNavigation === true) return;
		} catch (error) {
			ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			return { cancel: true };
		}
		ctx.ui.notify("/tree is blocked in task sessions because task artifacts and state are shared across conversation branches. Set allowTreeNavigation to true in task-workflow.json to allow it.", "warning");
		return { cancel: true };
	});
	let completionContext: ExtensionContext | undefined;
	pi.on("session_start", (_event, ctx) => { completionContext = ctx; });
	pi.on("session_shutdown", () => { activeTaskWorker?.controller.abort(); });
	pi.on("agent_settled", (event, ctx) => {
		let state: TaskState;
		try { state = requireTask(ctx); } catch { return; }
		const action = state.pendingAction;
		if (!action) return;
		const artifactWritten = state.pendingArtifactWritten === true;
		state.pendingAction = undefined;
		state.pendingArtifactWritten = undefined;
		const lastAssistant = [...ctx.sessionManager.getBranch()].reverse().find((entry) => entry.type === "message" && entry.message.role === "assistant");
		const stopReason = lastAssistant?.type === "message" && lastAssistant.message.role === "assistant" ? lastAssistant.message.stopReason : undefined;
		if (event.aborted || stopReason === "error" || stopReason === "aborted") {
			state.pendingStep = undefined;
			saveState(state);
			ctx.ui.notify("Transition did not finish; the current phase is unchanged.", "warning");
			return;
		}
		if (!artifactWritten) {
			state.pendingStep = undefined;
			saveState(state);
			ctx.ui.notify("The agreed artifact was not saved. The current phase is unchanged; retry the transition after clarifying the discussion.", "error");
			return;
		}
		try {
			if (action === "research") {
				if (!existsSync(state.contextPath)) throw new Error("The context file is missing.");
				state.phase = "roadmap";
				saveState(state);
				send(pi, "roadmap", `Read ${state.contextPath}. Propose the implementation roadmap. Use a numbered list. Start every item with a concise bold title, followed by a dash and a brief explanation. Discuss it with me. If we establish new task facts or decisions, update context.md and propose a revised roadmap. You may maintain a draft ${roadmapPath(state)}; /task accept approves a pending proposal, while /task next advances after approval is already settled.`);
			} else if (action === "roadmap") {
				stepCount(state);
				state.phase = "steps";
				state.currentStep = 1;
				saveState(state);
				send(pi, "step", `Read ${state.contextPath} and ${roadmapPath(state)}. Discuss step 1 in detail with me. Explain behavior, implementation points, and meaningful checks. Keep relevant task artifacts current when we agree on changes; /task accept approves a pending proposal, while /task next advances after approval is already settled.`);
			} else {
				const n = state.pendingStep || state.currentStep;
				state.pendingStep = undefined;
				if (!existsSync(stepPath(state, n))) throw new Error(`Approved design for step ${n} was not saved.`);
				const count = stepCount(state);
				if (n < count) {
					state.currentStep = n + 1;
					saveState(state);
					send(pi, "step", `Read ${state.contextPath}, ${roadmapPath(state)}, and the approved prior steps. Discuss step ${n + 1} in detail with me. Keep relevant task artifacts current when we agree on changes; /task accept approves a pending proposal, while /task next advances after approval is already settled.`);
				} else {
					state.phase = "implement";
					state.currentStep = 1;
					saveState(state);
					ctx.ui.notify("All step designs are approved. Use /task next to start implementation of step 1.", "info");
				}
			}
		} catch (error) {
			state.pendingStep = undefined;
			saveState(state);
			ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
		}
	});
	pi.on("before_agent_start", (event, ctx) => {
		if (!taskLink(ctx)) return;
		let state: TaskState;
		try { state = requireTask(ctx); }
		catch {
			event.systemPromptOptions.selectedTools = [];
			event.systemPromptOptions.sections.task_write_policy = "Task state is unavailable. Do not call tools until it is restored.";
			return;
		}
		event.systemPromptOptions.selectedTools = [...READ_TOOLS, ARTIFACT_TOOL];
		event.systemPromptOptions.sections.task_write_policy = `This main task session may only read project code. Do not use shell, edit, write, or other tools that can modify project files. Use ${ARTIFACT_TOOL} to update context, roadmap, step, or review artifacts in the task directory whenever agreed changes require it, regardless of the current phase. Pass the complete replacement content, not a file path. For a non-current step or review, pass its number as step. Do not edit state.json or implementation diffs.`;
		if (event.messageType !== "user" || event.prompt?.startsWith("[task-workflow:")) return;
		const common = `Task ${state.id}. Canonical context: ${state.contextPath}. Current phase: ${state.phase}. Do not infer phase transitions from casual wording; use /task commands.`;
		const phaseRule = state.phase === "collect"
			? `Treat the user's message as task input. Read the context file, incorporate confirmed facts and decisions in a compact form, and use ${ARTIFACT_TOOL} with artifact=context to save the complete updated content before responding. Preserve important requirements and explicitly proposed options from the user's description or ticket text; label unchosen options as provisional. Do not add guesses, open questions, or unsupported code claims to the file.`
			: state.phase === "research"
				? `Read the current context before responding. Discuss research findings and open questions. If this turn establishes new facts or decisions that the user has confirmed, update context.md using ${ARTIFACT_TOOL} with artifact=context before your final response. Keep it compact and self-contained. Add code references only after discussing them with the user. Do not record unresolved doubts or unapproved conclusions. If there is nothing newly agreed, leave the artifact unchanged.`
				: state.phase === "roadmap"
					? `Read the current context before responding. Discuss the roadmap and any questions or additions. When the user confirms new task facts, constraints, or decisions, update context.md using ${ARTIFACT_TOOL} with artifact=context before your final response, then present a complete revised numbered roadmap in that same response. Each item begins with a short bold title, a dash, and a brief explanation. Maintain roadmap.md as a draft when agreed changes call for it; /task accept approves a pending proposal and /task next advances after prior approval. If nothing new is agreed, leave context.md unchanged; revise the proposal in chat when the user asks. Add code references only after discussing them with the user. Keep unresolved doubts out of context.md.`
					: state.phase === "steps"
						? `Discuss step ${state.currentStep}. When the user approves a change to context, roadmap, or any step design, update the corresponding task artifact immediately using ${ARTIFACT_TOOL}. In particular, if a new roadmap item emerges, revise roadmap.md and explain how it affects the remaining step designs. Do not change project code. /task accept approves a pending proposal and /task next advances after prior approval.`
						: state.phase === "review"
							? existsSync(reviewPath(state, state.awaitingReview || state.currentStep))
								? `Read ${reviewPath(state, state.awaitingReview || state.currentStep)} and the implementation diff before responding. Discuss the review findings and the user's decisions. Update any task artifact when the user agrees to a change. For review-N.md, preserve its title and Findings section, use ### headings only for findings, keep one exact diff snippet beside each finding, and put discussion notes under a ## Discussion heading. Each finding has Status: open, resolved, or dismissed. Change a status only after the user and you have agreed on the outcome; resolved means the code is verified fixed, dismissed means the finding is rejected with a reason. Keep open until then. /task accept approves a pending proposal; /task next acts only after questions and proposals are settled. A successful command launches repair while findings remain open, otherwise it accepts the step and prepares the commit.`
								: "The review worker has not produced its artifact. Tell the user to use /task next to retry review; do not accept the step yet. Agreed changes to other task artifacts may still be recorded."
							: "Discuss implementation results. Do not mark a step complete until the user uses /task next or /task accept.";
		event.systemPromptOptions.sections.task_workflow = `${common}\n${phaseRule}`;
	});

	pi.registerCommand("task", {
		description: "Guided task workflow; use /task help for commands",
		getArgumentCompletions: (prefix) => {
			const commands = ["list", "status", "log", "abort", "next", "accept", "show", "help"];
			let items = commands.map((value) => ({ value, label: value }));
			if (prefix.startsWith("show ")) {
				const values = ["show context", "show research"];
				try {
					if (completionContext) {
						const state = requireTask(completionContext);
						if (existsSync(roadmapPath(state))) {
							values.push("show roadmap");
							for (let n = 1; n <= stepCount(state); n++) {
								if (existsSync(stepPath(state, n))) values.push(`show step-${n}`);
								if (existsSync(join(taskDir(state), `implementation-${n}.diff`))) values.push(`show implementation-${n}`);
								if (existsSync(reviewPath(state, n))) values.push(`show review-${n}`);
							}
						}
					}
				} catch { /* Keep the basic completions if task state is unavailable. */ }
				items = values.map((value) => ({ value, label: value }));
			} else if (!prefix.includes(" ") || prefix.startsWith("\"") || prefix.startsWith("'")) {
				try {
					const root = projectRoot(completionContext?.cwd || process.cwd());
					for (const task of listTasks(root)) {
						const id = task.state.id;
						const value = id.includes(" ") || commands.includes(id) || prefix.startsWith("'") || prefix.startsWith("\"") ? `${prefix.startsWith("'") ? "'" : "\""}${id}${prefix.startsWith("'") ? "'" : "\""}` : id;
						items.push({ value, label: `${id} · ${taskProgress(task.state)}` });
					}
				} catch { /* Keep command completions if task discovery fails. */ }
			}
			const filtered = items.filter((item) => item.value.startsWith(prefix));
			return filtered.length ? filtered : null;
		},
		handler: async (rawArgs, ctx) => {
			try {
				const parsed = parseArguments(rawArgs);
				const command = parsed[0] && !parsed[0].quoted && ["help", "list", "status", "log", "abort", "next", "accept", "show", "start", "continue"].includes(parsed[0].value) ? parsed[0].value : undefined;
				const args = parsed.slice(command ? 1 : 0).map((arg) => arg.value);
				if (activeTaskOperation && !["help", "status", "log", "abort", "show"].includes(command || "")) throw new Error("A task process is running. Use /task log to view it, /task status for its state, or /task abort to stop it.");
				if (command === "start" || command === "continue") throw new Error(`Use /task TASK-ID instead of /task ${command}.`);
				if (command === "help") {
					if (args.length) throw new Error("Usage: /task help");
					await showArtifact(ctx, "Task help", HELP);
					return;
				}
				if (command === "list") {
					if (args.length) throw new Error("Usage: /task list");
					const root = projectRoot(ctx.cwd);
					const tasks = listTasks(root);
					if (ctx.mode === "tui" && tasks.length) {
						const options = tasks.map(({ state }) => `${state.id} · ${taskProgress(state)} · ${taskDescription(state)}`);
						const selected = await ctx.ui.select("Continue task:", options);
						if (selected === undefined) return;
						const task = tasks[options.indexOf(selected)];
						if (!task) return;
						const state = loadState(task.path);
						if (state.id !== task.state.id || state.projectRoot !== root) throw new Error("The selected task changed while the selector was open. Run /task list again.");
						await continueTask(pi, ctx, state, task.path);
						return;
					}
					const rows = tasks.map(({ state }) => `| \`${state.id}\` | ${taskProgress(state)} | ${taskDescription(state).replaceAll("|", "\\|")} |`);
					const content = tasks.length
						? `# Tasks in ${root}\n\n| Task ID | State | Context |\n| --- | --- | --- |\n${rows.join("\n")}\n\nUse /task TASK-ID to continue a task.`
						: `# Tasks in ${root}\n\nNo tasks found. Start one with /task TASK-ID.`;
					await showArtifact(ctx, "Task list", content);
					return;
				}
				if (!command) {
					if (ctx.mode !== "tui") throw new Error("Starting or continuing a task requires interactive Pi.");
					const optionAt = args.indexOf("--dir");
					let override: string | undefined;
					if (optionAt >= 0) {
						override = args[optionAt + 1];
						if (!override || optionAt !== args.length - 2) throw new Error("Usage: /task TASK-ID [--dir PATH]");
						args.splice(optionAt, 2);
					}
					if (args.length !== 1 || !args[0] || args[0].startsWith("--")) throw new Error("A task ID is required. Usage: /task TASK-ID [--dir PATH]");
					const root = projectRoot(ctx.cwd);
					const id = args[0];
					validateTaskId(id);
					const artifactDir = parseArtifactDir(root, id, override);
					let path = statePath(artifactDir);
					if (!existsSync(path) && !override) {
						const fallback = statePath(defaultArtifactDir(root, id));
						if (existsSync(fallback)) path = fallback;
						else path = listTasks(root).find((task) => task.state.id === id)?.path || path;
					}
					if (existsSync(path)) {
						const state = loadState(path);
						if (state.id !== id) throw new Error(`Task ID mismatch in ${path}: requested ${id}, but state.json contains ${state.id}. Open the task using its saved ID or correct the state file.`);
						if (state.projectRoot !== root) throw new Error(projectMismatchMessage(state, root, path));
						const current = taskLink(ctx);
						const destination = current && (current.id !== id || current.statePath !== path) ? "Open it in a new Pi session?" : "Attach it to this Pi session?";
						if (!await ctx.ui.confirm(`Continue task ${id}?`, `Existing task (${state.phase}). ${destination}`)) return;
						await continueTask(pi, ctx, state, path);
						return;
					}
					if (existsSync(artifactDir)) throw new Error(`Artifact directory already exists without task state: ${artifactDir}`);
					if (!await ctx.ui.confirm(`Start task ${id}?`, `Create ${artifactDir} and open a new Pi session?`)) return;
					const contextPath = join(artifactDir, "context.md");
					const state: TaskState = { version: 1, id, projectRoot: root, artifactDir, contextPath, phase: "collect", currentStep: 1, completedSteps: [] };
					const result = await ctx.newSession({
						setup: async (session) => {
							session.appendCustomEntry(ENTRY_TYPE, { id, statePath: path } satisfies TaskLink);
							session.appendSessionInfo(`Task ${id}`);
						},
						withSession: async (fresh) => {
							mkdirSync(artifactDir, { recursive: true });
							if (!existsSync(contextPath)) writeFileSync(contextPath, `# ${id}\n`, "utf8");
							saveState(state);
							try { rememberTask(state, path); } catch { fresh.ui.notify("Task started, but its discovery index could not be updated.", "warning"); }
							fresh.ui.notify(`Task ${id} started. Describe the problem or task and share any context you have. Add details as you go.`, "info");
						},
					});
					if (result.cancelled) ctx.ui.notify("New session was cancelled.", "warning");
					return;
				}
				const state = requireTask(ctx);
				if (command === "log" || command === "abort") {
					if (args.length) throw new Error(`Usage: /task ${command}`);
					const run = activeTaskWorker;
					if (!run || run.statePath !== statePath(taskDir(state))) throw new Error("No worker is running for this task.");
					if (command === "log") {
						if (run.logOpen) { ctx.ui.notify("The task log is already open.", "info"); return; }
						await showWorkerLog(ctx, run);
					} else {
						if (run.controller.signal.aborted) { ctx.ui.notify("The worker is already stopping.", "info"); return; }
						recordWorkerActivity(run, "Abort requested with /task abort...");
						run.controller.abort();
						ctx.ui.notify(`Stopping ${run.phase} step ${run.step}.`, "warning");
					}
					return;
				}
				if (command === "status") {
					const config = readConfig();
					const model = config.implementModel;
					const implementationModel = model ? `${model.provider}/${model.model} (thinking: ${model.thinkingLevel || "inherited"})` : "inherit active Pi model and thinking level";
					const run = activeTaskWorker?.statePath === statePath(taskDir(state)) ? activeTaskWorker : undefined;
					await showArtifact(ctx, "Task status", `Task: ${state.id}\nPhase: ${state.phase}\nRunning worker: ${run ? `${run.phase} step ${run.step} · ${run.activity.at(-1) || "starting"} · /task log to view · /task abort to stop` : activeTaskOperation === statePath(taskDir(state)) ? "preparing or finishing" : "none"}\nArtifacts: ${taskDir(state)}\nGit repository: ${hasGitRepository(state) ? "yes" : "no"}\nCurrent step: ${state.currentStep}\nCompleted steps: ${state.completedSteps.join(", ") || "none"}\nAwaiting review: ${state.awaitingReview || "none"}\nOpen review findings: ${state.reviewPending ? "review pending" : state.awaitingReview && existsSync(reviewPath(state, state.awaitingReview)) ? openReviewFindings(state, state.awaitingReview) : "none"}\nReview skill: ${config.reviewSkill === null ? "disabled" : config.reviewSkill || "task-review"}\nAuto-commit: ${config.autoCommit === true ? "on" : "off"}\n/tree: ${config.allowTreeNavigation === true ? "allowed" : "blocked"}\nSnapshot limits: ${config.snapshotMaxFiles ?? DEFAULT_SNAPSHOT_MAX_FILES} files, ${config.snapshotMaxMiB ?? DEFAULT_SNAPSHOT_MAX_MIB} MiB\nImplementation model: ${implementationModel}`);
					return;
				}
				if (command === "show") {
					if (ctx.mode !== "tui") throw new Error("/task show requires interactive Pi.");
					if (args.length !== 1) throw new Error("Usage: /task show context|research|roadmap|step-N|implementation-N|review-N");
					const name = args[0];
					let path: string;
					if (name === "context" || name === "collect" || name === "research") path = state.contextPath;
					else if (name === "roadmap") path = roadmapPath(state);
					else if (/^step-[1-9]\d*$/.test(name)) path = stepPath(state, Number(name.slice(5)));
					else if (/^implementation-[1-9]\d*$/.test(name)) path = join(taskDir(state), `${name}.diff`);
					else if (/^review-[1-9]\d*$/.test(name)) path = reviewPath(state, Number(name.slice(7)));
					else throw new Error("Unknown artifact. Use /task show context|research|roadmap|step-N|implementation-N|review-N.");
					if (!existsSync(path)) throw new Error(`Artifact does not exist yet: ${path}`);
					const content = readFileSync(path, "utf8");
					await showArtifact(ctx, name, name.startsWith("implementation-") ? `\`\`\`diff\n${content}\n\`\`\`` : content);
					return;
				}
				if (command === "next" || command === "accept") {
					if (command === "next" && args.length) throw new Error("/task next does not accept approval text. Use /task accept [NOTE] to approve a proposal.");
					const note = args.join(" ").trim();
					if (note.length > 4000) throw new Error("Approval note is too long; keep it under 4000 characters.");
					if (state.pendingAction) throw new Error("A phase transition is still running. Wait for it to finish.");
					if (command === "accept" && state.reviewPending) throw new Error("Review is still pending. Use /task next to retry it before accepting a proposal.");
					const assessment = await assessTransition(ctx, state, command, note);
					if (assessment.openQuestions.length) throw new Error(`The phase is unchanged. Resolve these open questions first: ${assessment.openQuestions.join("; ")}`);
					if (command === "next" && assessment.pendingProposal.trim()) throw new Error(`The phase is unchanged. A proposal still needs approval: ${assessment.pendingProposal}. Use /task accept if you agree.`);
					if (command === "accept" && !assessment.pendingProposal.trim()) throw new Error(`The phase is unchanged. There is no pending proposal to accept.${assessment.reason ? ` ${assessment.reason}` : ""}`);
					const approval = command === "accept" ? `${assessment.pendingProposal.trim()}${note ? `; user clarification: ${note.replace(/\s+/g, " ")}` : ""}` : "";
					const approvalNote = approval ? `\n\nUser-approved proposal: ${approval}` : "";
					if (state.phase === "collect") {
						state.phase = "research";
						saveState(state);
						send(pi, "research", `Read ${state.contextPath} and inspect the current project. Check feasibility against the code. Present verified findings, conflicting assumptions, relevant code locations, and focused questions. Discuss conclusions with me. Update the context artifact during research when we establish new facts or decisions; add code locations only after discussing them with me. Do not record unresolved doubts or unapproved conclusions.${approvalNote}`);
						return;
					}
					if (state.phase === "research") {
						state.pendingAction = "research";
						state.pendingArtifactWritten = false;
						saveState(state);
						send(pi, "accept-research", `Consolidate only the research findings and decisions that I accepted into the task context. Keep it compact and self-contained. Exclude unresolved doubts; briefly record only rejected dead-end approaches that matter. Add code references only where discussed with me. Save the complete content using ${ARTIFACT_TOOL} with artifact=context. The next phase will discuss the roadmap.${approvalNote}`);
						return;
					}
					if (state.phase === "roadmap") {
						state.pendingAction = "roadmap";
						state.pendingArtifactWritten = false;
						saveState(state);
						send(pi, "accept-roadmap", `Read the latest ${state.contextPath}. Save only the roadmap we agreed on using ${ARTIFACT_TOOL} with artifact=roadmap. If the agreed roadmap conflicts with the latest context, explain the conflict instead of saving. Use a consecutive numbered list; each item must begin with a short bold title, followed by a dash and a brief explanation. Do not add unapproved steps. Do not start step design in this turn.${approvalNote}`);
						return;
					}
					if (state.phase === "steps") {
						const n = state.currentStep;
						state.pendingAction = "step";
						state.pendingStep = n;
						state.pendingArtifactWritten = false;
						saveState(state);
						send(pi, "accept-step", `Save only our agreed design for step ${n} using ${ARTIFACT_TOOL} with artifact=step. Keep the file self-contained, focused on implementation and verification. Do not include open doubts or unapproved choices. Do not start another step in this turn.${approvalNote}`);
						return;
					}
					if (state.awaitingReview && state.phase === "implement") {
						state.phase = "review";
						saveState(state);
					}
					if (state.phase === "review" && (state.reviewPending || !existsSync(reviewPath(state, state.awaitingReview || state.currentStep)))) {
						launchTaskOperation(ctx, state, () => startReview(pi, ctx, state));
						return;
					}
					if (state.awaitingReview) {
						const n = state.awaitingReview;
						if (state.pendingBaselineDir) {
							let currentProgress = "Checking project files";
							ctx.ui.setStatus("task-diff", currentProgress);
							let current: { diff: string; files: string[] };
							try { current = await implementationDiff(state, loadBaseline(state.pendingBaselineDir), (message) => { currentProgress = message; ctx.ui.setStatus("task-diff", currentProgress); }); }
							finally { ctx.ui.setStatus("task-diff", undefined); }
							const diffPath = join(taskDir(state), `implementation-${n}.diff`);
							if (current.diff.trimEnd() !== readFileSync(diffPath, "utf8").trimEnd()) {
								writeFileSync(diffPath, current.diff ? `${current.diff}\n` : "", "utf8");
								state.pendingFiles = current.files;
								state.pendingHashes = Object.fromEntries(current.files.map((file) => [file, fileHash(state.projectRoot, file)]));
								state.reviewPending = true;
								saveState(state);
							launchTaskOperation(ctx, state, () => startReview(pi, ctx, state));
								return;
							}
						}
						if (command === "accept") {
							const path = reviewPath(state, n);
							const content = readFileSync(path, "utf8").trimEnd();
							writeArtifact(state, "review", `${content}\n\n## Accepted proposal\n\n${approval}\n`, n);
						}
						const open = openReviewFindings(state, n);
						if (open) {
							launchTaskOperation(ctx, state, () => startImplementation(pi, ctx, state, readFileSync(reviewPath(state, n), "utf8"), approval));
							return;
						}
						let result: string;
						if (state.pendingGitRepository === false || !hasGitRepository(state)) result = `Step ${n} accepted. This project has no Git repository, so the commit step was skipped.`;
						else if (!state.pendingFiles?.length) result = "No code changes were produced, so there is no commit message to propose.";
						else {
							const message = await draftCommitMessage(ctx, state, n);
							if (readConfig().autoCommit) {
								if (!state.pendingAutoCommitEligible) throw new Error("This step began with existing changes, so it cannot be committed automatically. Set autoCommit to false to get a commit proposal.");
								const sha = commitStep(state, message.title, message.body);
								result = `Committed step ${n} as ${sha}:\n\n${message.title}\n\n${message.body}`;
							} else result = `Suggested commit for step ${n}:\n\n${message.title}\n\n${message.body}`;
						}
						if (!state.completedSteps.includes(n)) state.completedSteps.push(n);
						state.completedSteps.sort((a, b) => a - b);
						state.awaitingReview = undefined;
						state.pendingFiles = undefined;
						state.pendingHashes = undefined;
						state.pendingSummary = undefined;
						state.pendingAutoCommitEligible = undefined;
						state.pendingGitRepository = undefined;
						if (state.pendingBaselineDir) rmSync(state.pendingBaselineDir, { recursive: true, force: true });
						state.pendingBaselineDir = undefined;
						state.reviewRound = undefined;
						state.reviewPending = undefined;
						state.phase = "implement";
						state.currentStep = n + 1;
						saveState(state);
						const more = n < stepCount(state) ? `\n\nUse /task next to implement step ${n + 1}.` : "\n\nAll planned implementation steps are complete.";
						pi.sendMessage({ customType: "task-commit", content: result + more, display: true });
						return;
					}
					launchTaskOperation(ctx, state, () => startImplementation(pi, ctx, state, undefined, approval));
					return;
				}
				throw new Error(`Unknown subcommand: ${command}. Use /task help.`);
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			}
		},
	});
}
