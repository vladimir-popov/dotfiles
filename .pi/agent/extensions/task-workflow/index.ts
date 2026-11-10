import { execFileSync } from "node:child_process";
import {
  constants as fsConstants,
  promises as fsPromises,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  getMarkdownTheme,
  SessionManager,
  type ExtensionAPI,
  type ExtensionCommandContext,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { uuidv7, type Message } from "@earendil-works/pi-ai";
import {
  decodeKittyPrintable,
  Markdown,
  matchesKey,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";

type Phase =
  | "collect"
  | "research"
  | "roadmap"
  | "steps"
  | "implement"
  | "review"
  | "commit"
  | "complete";
type SessionRefs = {
  collect?: string;
  research?: string;
  roadmap?: string;
  steps?: Record<string, string>;
  implement?: Record<string, string>;
  review?: Record<string, string[]>;
  commit?: Record<string, string>;
};
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
  commitPendingFiles?: string[];
  commitPendingHashes?: Record<string, string | null>;
  commitReady?: boolean;
  commitResult?: string;
  reviewRound?: number;
  reviewPending?: boolean;
  interruptedSession?: string;
  implementationStarted?: boolean;
  sessions?: SessionRefs;
};
type TaskLink = {
  id: string;
  statePath: string;
  phase?: Phase;
  step?: number;
  round?: number;
};
type PhaseModel = {
  provider: string;
  model: string;
  thinkingLevel?:
    "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
};
type SkillPhase = "research" | "roadmap" | "steps" | "review";
type Config = {
  artifactDir?: string;
  autoCommit?: boolean;
  phaseModels?: Partial<
    Record<
      "collect" | "research" | "roadmap" | "steps" | "implement" | "review",
      PhaseModel | null
    >
  >;
  skills?: Partial<Record<SkillPhase, string | null>>;
  /** @deprecated Use skills.review. */
  reviewSkill?: string | null;
  reviewTools?: string[];
  allowTreeNavigation?: boolean;
  snapshotMaxFiles?: number;
  snapshotMaxMiB?: number;
  hotkeys?: Record<string, string | null>;
};

const ENTRY_TYPE = "task-workflow-link";
const ARTIFACT_TOOL = "task_write_artifact";
const ARTIFACT_LANGUAGE_RULE =
  "Use the user's language for normal conversation, including explanations, questions, and review discussion. Do not switch chat replies to English because the artifacts are English. Write only task artifact content in English, regardless of the language used in the conversation or source ticket. This includes artifact headings, summaries, decisions, roadmap items, step designs, and review findings. Translate or condense non-English discussion into English when writing an artifact rather than copying it. Preserve exact code, identifiers, paths, and required verbatim diff excerpts.";
const KICKOFF_TYPE = "task-workflow-kickoff";
const PHASE_WIDGET = "task-workflow-phase";
const READ_TOOLS = ["read", "grep", "find", "ls"];
const DEFAULT_SNAPSHOT_MAX_FILES = 4_000;
const DEFAULT_SNAPSHOT_MAX_MIB = 100;
const DEFAULT_HOTKEYS: Record<string, string> = {
  next: "alt+n",
  accept: "alt+a",
  status: "alt+s",
  show: "alt+w",
};
const HELP = `Task workflow

/task TASK-ID [--dir PATH]  Start or continue a task after confirmation
/task or /task list         Select a task to continue
/task delete [TASK-ID]      Permanently delete a task after confirmation
/task status                Show task state, current session, and artifact paths
/task resume                Return to an active task; resume an interrupted run
/task next                  Advance the current phase when it is ready
/task accept [NOTE]         Agree to pending proposals and advance; otherwise act like /task next
/task show [FILE.md]        Select or view an existing Markdown artifact without adding it to the session
/task help                  Show this help

Default hotkeys: Alt+N = next, Alt+A = accept, Alt+S = status, Alt+W = show.
Configure or disable them with hotkeys in task-workflow.json; use /hotkeys to inspect active bindings.

Quote an ID containing spaces, for example: /task "TASK 100500".
Starting or opening a specific task requires an explicit ID.
/task delete removes its artifact directory and saved sessions; code outside it remains.
Context and research share one saved Pi session. Later phases use their own sessions.
The implementation session stays open for the step and is reused for repairs.
Each review round uses a fresh read-only session. Review findings live in review-N.md.
An accepted review enters a separate commit phase before the next implementation step.
Commit-message generation failures stay in that phase; /task next retries them.
With manual commits, /task next verifies the reviewed files were committed.
Use /task resume to return to the active task in this project. It resumes an interrupted run or pending review; otherwise it just opens the saved session.
After discussion, /task next returns open findings to implementation or accepts
a clear review. Accepted reviews enter a separate commit phase; /task next leaves it.
Use Pi's normal progress and cancellation controls during implementation and review.
Use /task next when discussion is settled; use /task accept to agree to proposals and advance.
Agreement is implied by /task accept; add a note only to clarify a choice or decision.
Text ending in /task next is not parsed as a command.
Task artifacts may be updated in any phase; project code changes run only in implement.
The default artifact directory is <project>/.agents/projects/<task-id>/.
Set artifactDir, autoCommit, phaseModels, skills, reviewTools, hotkeys,
snapshotMaxFiles, snapshotMaxMiB, or allowTreeNavigation in
~/.pi/agent/task-workflow.json.
You can also pass --dir PATH to /task.
autoCommit defaults to false.
The config path may contain {projectRoot} and {taskId}. Relative paths use the project root.`;

function git(root: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    }).trimEnd();
  } catch (error) {
    const detail = (error as { stderr?: Buffer | string }).stderr
      ?.toString()
      .trim();
    throw new Error(detail || `git ${args[0]} failed.`);
  }
}

function projectRoot(cwd: string): string {
  try {
    return git(cwd, ["rev-parse", "--show-toplevel"]);
  } catch {
    return cwd;
  }
}

function defaultArtifactDir(root: string, id: string): string {
  return join(root, ".agents", "projects", id);
}
function taskDir(state: TaskState): string {
  return state.artifactDir || defaultArtifactDir(state.projectRoot, state.id);
}
function statePath(dir: string): string {
  return join(dir, "state.json");
}

function markdownArtifacts(state: TaskState): string[] {
  return readdirSync(taskDir(state), { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"),
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function completionArgument(value: string): string | undefined {
  if (!/[\s'"]/.test(value)) return value;
  if (!value.includes('"')) return `"${value}"`;
  if (!value.includes("'")) return `'${value}'`;
  return undefined;
}

function readConfig(): Config {
  const path = join(
    process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"),
    "task-workflow.json",
  );
  if (!existsSync(path)) return {};
  const config: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error(`Invalid config: ${path}`);
  const values = config as Record<string, unknown>;
  if (values.contextPath !== undefined)
    throw new Error(`Replace contextPath with artifactDir in ${path}.`);
  if (values.implementModel !== undefined || values.reviewModel !== undefined)
    throw new Error(
      `Move implementModel and reviewModel to phaseModels.implement and phaseModels.review in ${path}.`,
    );
  if (
    values.artifactDir !== undefined &&
    (typeof values.artifactDir !== "string" || !values.artifactDir.trim())
  )
    throw new Error(`Invalid artifactDir: ${path}`);
  if (values.autoCommit !== undefined && typeof values.autoCommit !== "boolean")
    throw new Error(`autoCommit must be a boolean: ${path}`);
  if (
    values.allowTreeNavigation !== undefined &&
    typeof values.allowTreeNavigation !== "boolean"
  )
    throw new Error(`allowTreeNavigation must be a boolean: ${path}`);
  if (
    values.reviewSkill !== undefined &&
    values.reviewSkill !== null &&
    (typeof values.reviewSkill !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.reviewSkill) ||
      values.reviewSkill.length > 64)
  )
    throw new Error(`reviewSkill must be a skill name or null: ${path}`);
  if (values.skills !== undefined) {
    if (
      !values.skills ||
      typeof values.skills !== "object" ||
      Array.isArray(values.skills)
    )
      throw new Error(`skills must be an object: ${path}`);
    for (const [phase, skill] of Object.entries(values.skills)) {
      if (
        !(["research", "roadmap", "steps", "review"] as string[]).includes(
          phase,
        )
      )
        throw new Error(`Unknown skills phase ${phase}: ${path}`);
      if (
        skill !== null &&
        (typeof skill !== "string" ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill) ||
          skill.length > 64)
      )
        throw new Error(`Invalid skills.${phase}: ${path}`);
    }
  }
  if (
    values.reviewTools !== undefined &&
    (!Array.isArray(values.reviewTools) ||
      values.reviewTools.some(
        (tool) => typeof tool !== "string" || !/^[A-Za-z0-9_:-]+$/.test(tool),
      ))
  )
    throw new Error(`reviewTools must be an array of tool names: ${path}`);
  if (values.hotkeys !== undefined) {
    if (
      !values.hotkeys ||
      typeof values.hotkeys !== "object" ||
      Array.isArray(values.hotkeys)
    )
      throw new Error(`hotkeys must be an object: ${path}`);
    for (const [command, key] of Object.entries(values.hotkeys)) {
      if (
        !command.trim() ||
        command !== command.trim() ||
        command.startsWith("/")
      )
        throw new Error(
          `Invalid hotkeys command ${JSON.stringify(command)}: ${path}`,
        );
      parseArguments(command);
      if (
        key !== null &&
        (typeof key !== "string" ||
          !key.trim() ||
          key !== key.trim() ||
          /\s/.test(key))
      )
        throw new Error(`Invalid hotkey for ${command}: ${path}`);
    }
  }
  if (values.phaseModels !== undefined) {
    if (
      !values.phaseModels ||
      typeof values.phaseModels !== "object" ||
      Array.isArray(values.phaseModels)
    )
      throw new Error(`phaseModels must be an object: ${path}`);
    for (const [phase, model] of Object.entries(values.phaseModels)) {
      if (
        ![
          "collect",
          "research",
          "roadmap",
          "steps",
          "implement",
          "review",
        ].includes(phase)
      )
        throw new Error(`Unknown phaseModels key ${phase}: ${path}`);
      if (model === null) continue;
      if (!model || typeof model !== "object" || Array.isArray(model))
        throw new Error(`Invalid phaseModels.${phase}: ${path}`);
      const settings = model as Record<string, unknown>;
      if (
        typeof settings.provider !== "string" ||
        !settings.provider.trim() ||
        typeof settings.model !== "string" ||
        !settings.model.trim()
      )
        throw new Error(
          `phaseModels.${phase} requires provider and model: ${path}`,
        );
      if (
        settings.thinkingLevel !== undefined &&
        (typeof settings.thinkingLevel !== "string" ||
          !["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(
            settings.thinkingLevel,
          ))
      )
        throw new Error(`Invalid phaseModels.${phase}.thinkingLevel: ${path}`);
    }
  }
  if (
    values.snapshotMaxFiles !== undefined &&
    (typeof values.snapshotMaxFiles !== "number" ||
      !Number.isSafeInteger(values.snapshotMaxFiles) ||
      values.snapshotMaxFiles < 1)
  )
    throw new Error(`snapshotMaxFiles must be a positive integer: ${path}`);
  if (
    values.snapshotMaxMiB !== undefined &&
    (typeof values.snapshotMaxMiB !== "number" ||
      !Number.isSafeInteger(values.snapshotMaxMiB) ||
      values.snapshotMaxMiB < 1 ||
      values.snapshotMaxMiB > 1_000_000)
  )
    throw new Error(
      `snapshotMaxMiB must be an integer from 1 to 1000000: ${path}`,
    );
  return values as Config;
}

function configuredPhaseSkill(
  config: Config,
  phase: SkillPhase,
): string | null | undefined {
  const skill = config.skills?.[phase];
  if (skill !== undefined) return skill;
  return phase === "review" ? config.reviewSkill : undefined;
}

function reviewSkillName(config: Config): string {
  const skill = configuredPhaseSkill(config, "review");
  return skill === undefined ? "task-review" : (skill ?? "(disabled)");
}

function configuredHotkeys(): Array<{ command: string; key: string }> {
  const configured = { ...DEFAULT_HOTKEYS, ...readConfig().hotkeys };
  const keys = new Set<string>();
  const hotkeys: Array<{ command: string; key: string }> = [];
  for (const [command, key] of Object.entries(configured)) {
    if (!key) continue;
    const normalized = key.toLowerCase();
    if (keys.has(normalized))
      throw new Error(
        `Duplicate task hotkey: ${key}. Assign each key to only one /task command.`,
      );
    keys.add(normalized);
    hotkeys.push({ command, key });
  }
  return hotkeys;
}

function parseArtifactDir(root: string, id: string, override?: string): string {
  const template =
    override || readConfig().artifactDir || ".agents/projects/{taskId}";
  const expanded = template
    .replaceAll("{projectRoot}", root)
    .replaceAll("{taskId}", id);
  return isAbsolute(expanded) ? resolve(expanded) : resolve(root, expanded);
}

type Argument = { value: string; quoted: boolean };

function parseArguments(input: string): Argument[] {
  const args: Argument[] = [];
  let index = 0;
  while (index < input.length) {
    while (/\s/.test(input[index] || "") && index < input.length) index++;
    if (index >= input.length) break;
    const quote =
      input[index] === '"' || input[index] === "'" ? input[index++] : undefined;
    const start = index;
    if (quote) {
      while (index < input.length && input[index] !== quote) index++;
      if (index >= input.length)
        throw new Error("Unclosed quote in /task arguments.");
      const value = input.slice(start, index++);
      if (index < input.length && !/\s/.test(input[index]))
        throw new Error("Separate quoted /task arguments with spaces.");
      args.push({ value, quoted: true });
    } else {
      while (index < input.length && !/\s/.test(input[index])) {
        if (input[index] === '"' || input[index] === "'")
          throw new Error("Quote the entire task ID when it contains spaces.");
        index++;
      }
      args.push({ value: input.slice(start, index), quoted: false });
    }
  }
  return args;
}

function validateTaskId(id: string): void {
  if (id.trim() !== id || !/^[A-Za-z0-9][A-Za-z0-9._ -]*$/.test(id)) {
    throw new Error(
      "Task ID may contain letters, digits, dots, underscores, hyphens, and internal spaces. Quote IDs with spaces.",
    );
  }
}

function loadState(path: string): TaskState {
  const data = JSON.parse(readFileSync(path, "utf8")) as TaskState;
  if (
    data.version !== 1 ||
    !data.id ||
    !data.projectRoot ||
    !data.contextPath ||
    !Array.isArray(data.completedSteps)
  ) {
    throw new Error(`Invalid task state: ${path}`);
  }
  return data;
}

function projectMismatchMessage(
  state: TaskState,
  currentRoot: string,
  path: string,
): string {
  const lines = [
    `Task ${state.id} was created for a different project directory.`,
    `State file: ${path}`,
    `Saved project root: ${state.projectRoot}`,
    `Current project root: ${currentRoot}`,
    `To continue the original task, start Pi from the saved project root. If you moved the task intentionally, update projectRoot, artifactDir, and contextPath in state.json to their new locations. You can also start a fresh task with a different ID.`,
  ];
  if (state.pendingBaselineDir)
    lines.push(
      "This task has an unfinished implementation or review. Its pendingBaselineDir snapshot and pendingFiles/pendingHashes paths still refer to the original project layout. Reconcile them before continuing; changing projectRoot alone is unsafe.",
    );
  return lines.join("\n");
}

type SessionSwitchOptions = NonNullable<
  Parameters<ExtensionCommandContext["switchSession"]>[1]
>;
type ReplacedContext = Parameters<
  NonNullable<SessionSwitchOptions["withSession"]>
>[0];

type DiscoveredTask = { state: TaskState; path: string };

function taskIndexDir(): string {
  return join(
    process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"),
    "task-workflow-index",
  );
}

function rememberTask(state: TaskState, path: string): void {
  const directory = taskIndexDir();
  mkdirSync(directory, { recursive: true });
  const name =
    createHash("sha256")
      .update(`${state.projectRoot}\0${state.id}`)
      .digest("hex") + ".json";
  const target = join(directory, name);
  const temporary = join(directory, `.task-index-${randomUUID()}.tmp`);
  try {
    writeFileSync(
      temporary,
      `${JSON.stringify({ projectRoot: state.projectRoot, id: state.id, statePath: path })}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
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
      const record = JSON.parse(
        readFileSync(join(directory, entry.name), "utf8"),
      ) as { projectRoot?: unknown; statePath?: unknown };
      if (record.projectRoot === root && typeof record.statePath === "string")
        paths.push(record.statePath);
    } catch {
      /* A stale index entry must not hide other tasks. */
    }
  }
  return paths;
}

function templateStatePaths(root: string, template: string): string[] {
  const expanded = template.replaceAll("{projectRoot}", root);
  const absolute = isAbsolute(expanded)
    ? resolve(expanded)
    : resolve(root, expanded);
  const marker = "{taskId}";
  const offset = absolute.indexOf(marker);
  if (offset < 0) return [statePath(absolute)];
  const before = absolute.slice(0, offset);
  const after = absolute.slice(offset + marker.length);
  if (
    !before.endsWith(sep) ||
    (after && !after.startsWith(sep)) ||
    after.includes(marker)
  )
    return [];
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
      if (
        state.projectRoot !== root ||
        resolve(statePath(taskDir(state))) !== resolve(path)
      )
        continue;
      if (!tasks.has(state.id)) tasks.set(state.id, { state, path });
    } catch {
      /* Ignore missing or invalid state files. */
    }
  }
  return [...tasks.values()].sort((a, b) =>
    a.state.id.localeCompare(b.state.id),
  );
}

function taskDescription(state: TaskState): string {
  try {
    const content = readFileSync(state.contextPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const text = line.trim();
      if (!text || text.startsWith("#") || text === "---") continue;
      const plain = text
        .replace(/^[-*]\s+/, "")
        .replace(/\*\*/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\s+/g, " ");
      if (plain) return plain.length > 90 ? `${plain.slice(0, 87)}...` : plain;
    }
  } catch {
    /* The task can still be listed without its context. */
  }
  return "No description yet";
}

function taskProgress(state: TaskState): string {
  let total: number | undefined;
  try {
    total = stepCount(state);
  } catch {
    /* Roadmap may not exist yet. */
  }
  if (state.phase === "collect") return "Collecting context";
  if (state.phase === "research") return "Researching code";
  if (state.phase === "roadmap") return "Planning roadmap";
  if (state.phase === "steps")
    return `Designing step ${state.currentStep}${total ? `/${total}` : ""}`;
  if (state.phase === "implement" && total && state.currentStep > total)
    return `Complete (${state.completedSteps.length}/${total} steps)`;
  if (state.phase === "implement")
    return `Implementing step ${state.currentStep}${total ? `/${total}` : ""}`;
  if (state.phase === "commit")
    return `Commit step ${state.currentStep}${total ? `/${total}` : ""}`;
  if (state.phase === "complete")
    return `Complete (${state.completedSteps.length}${total ? `/${total}` : ""} steps)`;
  const step = state.awaitingReview || state.currentStep;
  if (state.reviewPending)
    return `Reviewing step ${step}${total ? `/${total}` : ""} (review pending)`;
  let findings = "";
  try {
    findings = `, ${openReviewFindings(state, step)} open findings`;
  } catch {
    /* Review may be missing or stale. */
  }
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
    return {
      id: data?.id || "",
      statePath: data?.statePath || "",
      phase: data?.phase,
      step: data?.step,
      round: data?.round,
    };
  }
  return undefined;
}

function requireTask(ctx: ExtensionContext): TaskState {
  const link = taskLink(ctx);
  if (!link)
    throw new Error("No task is attached to this session. Use /task TASK-ID.");
  const root = projectRoot(ctx.cwd);
  let linked: TaskState;
  try {
    linked = loadState(link.statePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const recovered = listTasks(root).find((task) => task.state.id === link.id);
    if (!recovered) throw error;
    linked = recovered.state;
    rememberTask(linked, recovered.path);
    ctx.sessionManager.appendCustomEntry(ENTRY_TYPE, {
      ...link,
      statePath: recovered.path,
    } satisfies TaskLink);
  }
  if (root !== linked.projectRoot)
    throw new Error(projectMismatchMessage(linked, root, link.statePath));
  return linked;
}

function roadmapPath(state: TaskState): string {
  return join(taskDir(state), "roadmap.md");
}
function stepPath(state: TaskState, n: number): string {
  return join(taskDir(state), `step-${n}.md`);
}
function reviewPath(state: TaskState, n: number): string {
  return join(taskDir(state), `review-${n}.md`);
}

type ArtifactKind = "context" | "roadmap" | "step" | "review";

function artifactPath(
  state: TaskState,
  kind: ArtifactKind,
  step?: number,
): string {
  if (kind === "context") return state.contextPath;
  if (kind === "roadmap") return roadmapPath(state);
  if (kind === "review")
    return reviewPath(state, step || state.awaitingReview || state.currentStep);
  return stepPath(state, step || state.currentStep);
}

function writeArtifact(
  state: TaskState,
  kind: ArtifactKind,
  content: string,
  step?: number,
): string {
  if (step !== undefined && (kind === "context" || kind === "roadmap"))
    throw new Error(
      "The step argument is only valid for step and review artifacts.",
    );
  const targetStep =
    kind === "review"
      ? step || state.awaitingReview || state.currentStep
      : step || state.currentStep;
  const path = artifactPath(state, kind, step);
  if (
    kind === "context" &&
    resolve(path) !== resolve(taskDir(state), "context.md")
  ) {
    throw new Error(
      "This task uses a legacy context file outside artifactDir. Move it into the task directory before writing.",
    );
  }
  if (kind === "review") {
    const title = `# Review: step ${targetStep}`;
    const trimmed = content.replace(/\r\n/g, "\n").trimStart();
    content = /^# [^\n]*/.test(trimmed)
      ? trimmed.replace(/^# [^\n]*/, title)
      : `${title}\n\n${trimmed}`;
    validateReviewSnippets(state, targetStep, content);
  }
  if (existsSync(path) && lstatSync(path).isSymbolicLink())
    throw new Error(`Refusing to replace a symbolic link: ${path}`);
  const temporary = join(taskDir(state), `.task-write-${randomUUID()}.tmp`);
  try {
    writeFileSync(
      temporary,
      content.endsWith("\n") ? content : `${content}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) rmSync(temporary);
  }
  if (
    kind === "review" &&
    state.phase === "review" &&
    targetStep === state.currentStep
  ) {
    state.reviewPending = false;
    saveState(state);
  }
  return path;
}

function stepCount(state: TaskState): number {
  const text = readFileSync(roadmapPath(state), "utf8");
  const numbers = [...text.matchAll(/^([1-9]\d*)\.[ \t]+(?=\S)/gm)].map(
    (match) => Number(match[1]),
  );
  if (
    !numbers.length ||
    numbers.some((number, index) => number !== index + 1)
  ) {
    throw new Error(
      "roadmap.md must contain a top-level numbered list with consecutive steps starting at 1.",
    );
  }
  return numbers.length;
}

function exclusions(state: TaskState): string[] {
  const paths = [taskDir(state), state.contextPath];
  return paths.flatMap((path) => {
    const rel = relative(state.projectRoot, path);
    return rel && rel !== ".." && !rel.startsWith(`..${sep}`)
      ? [`:(exclude)${rel}`]
      : [];
  });
}

type Baseline = {
  directory: string;
  paths: Map<string, string | null>;
  hashes: Map<string, string | null>;
  gitRepository: boolean;
};

function hasGitRepository(state: TaskState): boolean {
  try {
    return (
      resolve(git(state.projectRoot, ["rev-parse", "--show-toplevel"])) ===
      resolve(state.projectRoot)
    );
  } catch {
    return false;
  }
}

async function projectFiles(
  state: TaskState,
  onProgress?: (message: string) => void,
  maxFiles?: number,
): Promise<Set<string>> {
  const files = new Set<string>();
  const artifactDirectory = resolve(taskDir(state));
  const stack = [state.projectRoot];
  let inspected = 0;
  while (stack.length) {
    const directory = stack.pop()!;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (resolve(path) === artifactDirectory || entry.isSymbolicLink())
        continue;
      if (entry.isDirectory()) {
        if (entry.name !== ".git") stack.push(path);
      } else if (entry.isFile()) {
        files.add(relative(state.projectRoot, path));
        if (maxFiles && files.size > maxFiles)
          throw new Error(
            `Snapshot limit exceeded: more than ${maxFiles} files. No files were copied. Raise snapshotMaxFiles in task-workflow.json to allow this project.`,
          );
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
    ...git(state.projectRoot, [
      "ls-files",
      "-z",
      "-m",
      "-d",
      "-o",
      "--exclude-standard",
      "--",
      ".",
      ...exclusions(state),
    ]).split("\0"),
    ...git(state.projectRoot, [
      "diff",
      "--cached",
      "--name-only",
      "-z",
      "--",
      ".",
      ...exclusions(state),
    ]).split("\0"),
  ];
  return [...new Set(paths.filter(Boolean))];
}

async function captureBaseline(
  state: TaskState,
  gitRepository: boolean,
  onProgress?: (message: string) => void,
): Promise<Baseline> {
  const config = readConfig();
  const maxFiles = config.snapshotMaxFiles ?? DEFAULT_SNAPSHOT_MAX_FILES;
  const maxMiB = config.snapshotMaxMiB ?? DEFAULT_SNAPSHOT_MAX_MIB;
  const files = gitRepository
    ? changedPaths(state)
    : [...(await projectFiles(state, onProgress, maxFiles))];
  let copyCount = 0;
  let totalBytes = 0;
  for (const [index, file] of files.entries()) {
    const source = join(state.projectRoot, file);
    if (!existsSync(source)) continue;
    copyCount++;
    if (copyCount > maxFiles)
      throw new Error(
        `Snapshot limit exceeded: ${copyCount} files (limit ${maxFiles}). No files were copied. Raise snapshotMaxFiles in task-workflow.json to allow this project.`,
      );
    totalBytes += (await fsPromises.stat(source)).size;
    if (totalBytes > maxMiB * 1024 * 1024)
      throw new Error(
        `Snapshot limit exceeded: more than ${maxMiB} MiB. No files were copied. Raise snapshotMaxMiB in task-workflow.json to allow this project.`,
      );
    if (index % 100 === 0)
      onProgress?.(
        `Checking snapshot size: ${index + 1}/${files.length} files`,
      );
  }
  const directory = mkdtempSync(
    join(taskDir(state), ".implementation-baseline-"),
  );
  const paths = new Map<string, string | null>();
  const hashes = new Map<string, string | null>();
  try {
    for (const [index, file] of files.entries()) {
      const source = join(state.projectRoot, file);
      if (!existsSync(source)) {
        paths.set(file, null);
        hashes.set(file, null);
        continue;
      }
      const snapshot = join(directory, String(index));
      await fsPromises.copyFile(source, snapshot, fsConstants.COPYFILE_FICLONE);
      paths.set(file, snapshot);
      hashes.set(file, fileHash(directory, String(index)));
      if (index % 100 === 0)
        onProgress?.(
          `Snapshotting project files: ${index + 1}/${files.length}`,
        );
    }
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
  writeFileSync(
    join(directory, "manifest.json"),
    JSON.stringify({
      gitRepository,
      paths: [...paths].map(([file, snapshot]) => [
        file,
        snapshot ? basename(snapshot) : null,
      ]),
      hashes: [...hashes],
    }),
    "utf8",
  );
  return { directory, paths, hashes, gitRepository };
}

function loadBaseline(directory: string): Baseline {
  const manifest = JSON.parse(
    readFileSync(join(directory, "manifest.json"), "utf8"),
  ) as {
    gitRepository: boolean;
    paths: Array<[string, string | null]>;
    hashes?: Array<[string, string | null]>;
  };
  return {
    directory,
    gitRepository: manifest.gitRepository,
    paths: new Map(
      manifest.paths.map(([file, snapshot]) => [
        file,
        snapshot ? join(directory, snapshot) : null,
      ]),
    ),
    hashes: new Map(manifest.hashes || []),
  };
}

function diffNoIndex(
  state: TaskState,
  before: string | null,
  after: string | null,
  file: string,
): string {
  try {
    return execFileSync(
      "git",
      [
        "diff",
        "--no-ext-diff",
        "--no-index",
        "--binary",
        "--",
        before || "/dev/null",
        after || "/dev/null",
      ],
      {
        cwd: state.projectRoot,
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    ).trimEnd();
  } catch (error) {
    const failure = error as {
      status?: number;
      stdout?: Buffer | string;
      stderr?: Buffer | string;
    };
    if (failure.status !== 1)
      throw new Error(
        failure.stderr?.toString().trim() || `Cannot diff ${file}.`,
      );
    const output = failure.stdout?.toString().trimEnd();
    return output ? `# ${file}\n${output}` : "";
  }
}

async function implementationDiff(
  state: TaskState,
  baseline: Baseline,
  onProgress?: (message: string) => void,
): Promise<{ diff: string; files: string[] }> {
  const parts: string[] = [];
  const files: string[] = [];
  const currentFiles = baseline.gitRepository
    ? undefined
    : await projectFiles(state, onProgress);
  const candidates = baseline.gitRepository
    ? changedPaths(state)
    : [...new Set([...baseline.paths.keys(), ...currentFiles!])];
  for (const [index, file] of candidates.entries()) {
    const current = join(state.projectRoot, file);
    let patch: string;
    if (!baseline.gitRepository) {
      const snapshot = baseline.paths.get(file);
      if (snapshot && currentFiles!.has(file)) {
        const before =
          baseline.hashes.get(file) ??
          fileHash(baseline.directory, basename(snapshot));
        if (before === fileHash(state.projectRoot, file)) {
          if (index % 100 === 0) {
            onProgress?.(
              `Comparing project files: ${index + 1}/${candidates.length}`,
            );
            await new Promise<void>((done) => setImmediate(done));
          }
          continue;
        }
      }
      patch = diffNoIndex(
        state,
        baseline.paths.get(file) || null,
        currentFiles!.has(file) ? current : null,
        file,
      );
    } else if (baseline.paths.has(file)) {
      const before = baseline.paths.get(file) || null;
      patch = diffNoIndex(
        state,
        before,
        existsSync(current) ? current : null,
        file,
      );
    } else {
      const tracked = git(state.projectRoot, ["ls-files", "--", file]);
      patch = tracked
        ? git(state.projectRoot, ["diff", "--binary", "HEAD", "--", file])
        : diffNoIndex(state, null, current, file);
    }
    if (patch) {
      parts.push(patch);
      files.push(file);
    }
    if (index % 100 === 0) {
      onProgress?.(
        `Comparing project files: ${index + 1}/${candidates.length}`,
      );
      await new Promise<void>((done) => setImmediate(done));
    }
  }
  return { diff: parts.join("\n\n"), files };
}

function fileHash(root: string, file: string): string | null {
  const path = join(root, file);
  return existsSync(path)
    ? createHash("sha256").update(readFileSync(path)).digest("hex")
    : null;
}

function validateReviewSnippets(
  state: TaskState,
  step: number,
  content: string,
): void {
  if (!content.startsWith(`# Review: step ${step}\n`))
    throw new Error(`Review must start with "# Review: step ${step}".`);
  if (!content.includes("\n## Summary\n"))
    throw new Error("Review needs a ## Summary section.");
  if (!content.includes("\n## Findings\n"))
    throw new Error("Review needs a ## Findings section.");
  const diff = readFileSync(
    join(taskDir(state), `implementation-${step}.diff`),
    "utf8",
  );
  const snippets = [...content.matchAll(/```diff\r?\n([\s\S]*?)\r?\n```/g)].map(
    (match) => match[1],
  );
  const findings = [...content.matchAll(/^### /gm)].length;
  if (snippets.length !== findings)
    throw new Error(
      "Each review finding must include one fenced diff snippet.",
    );
  for (const snippet of snippets)
    if (!snippet.trim() || !diff.includes(snippet))
      throw new Error("A review snippet does not match implementation-N.diff.");
  for (const section of content.split(/^### /m).slice(1)) {
    const statuses = [
      ...section.matchAll(/^Status: (open|resolved|dismissed)$/gm),
    ];
    if (statuses.length > 1)
      throw new Error("Each review finding may have only one Status line.");
    if (/^Status: /m.test(section) && statuses.length !== 1)
      throw new Error(
        "Review finding status must be open, resolved, or dismissed.",
      );
  }
}

function openReviewFindings(state: TaskState, step: number): number {
  const content = readFileSync(reviewPath(state, step), "utf8");
  validateReviewSnippets(state, step, content);
  return content
    .split(/^### /m)
    .slice(1)
    .filter((section) => !/^Status: (resolved|dismissed)$/m.test(section))
    .length;
}

type DraftedCommitMessage = { title: string; body: string; fallback?: boolean };

function fallbackCommitMessage(
  state: TaskState,
  step: number,
): DraftedCommitMessage {
  const files = state.pendingFiles || [];
  const title =
    files.length === 1
      ? `Update ${basename(files[0])}`
      : `Update reviewed changes for step ${step}`;
  return {
    title: title.slice(0, 72),
    body:
      state.pendingSummary?.trim().slice(0, 4000) ||
      `Apply the reviewed changes for step ${step}.`,
    fallback: true,
  };
}

function parseCommitMessage(
  text: string,
  state: TaskState,
  step: number,
): DraftedCommitMessage {
  const fallbackBody =
    state.pendingSummary?.trim().slice(0, 4000) ||
    `Apply the reviewed changes for step ${step}.`;
  const accept = (
    title: unknown,
    body: unknown,
  ): DraftedCommitMessage | null => {
    if (typeof title !== "string" || !title.trim()) return null;
    const cleanTitle = title
      .trim()
      .split(/\r?\n/, 1)[0]
      .replace(/^(?:title|subject)\s*:\s*/i, "")
      .trim()
      .slice(0, 72);
    if (!cleanTitle) return null;
    return {
      title: cleanTitle,
      body:
        typeof body === "string" && body.trim()
          ? body.trim().slice(0, 4000)
          : fallbackBody,
    };
  };
  const value = text
    .replace(/^```(?:json|text|markdown)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const parsedMessage = (candidate: string): DraftedCommitMessage | null => {
    try {
      const parsed = JSON.parse(candidate) as {
        title?: unknown;
        subject?: unknown;
        body?: unknown;
        description?: unknown;
      };
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        return null;
      return accept(
        parsed.title ?? parsed.subject,
        parsed.body ?? parsed.description,
      );
    } catch {
      return null;
    }
  };
  const whole = parsedMessage(value);
  if (whole) return whole;

  for (
    let start = value.indexOf("{");
    start >= 0;
    start = value.indexOf("{", start + 1)
  ) {
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let index = start; index < value.length; index++) {
      const char = value[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === "{") depth++;
      else if (char === "}" && --depth === 0) {
        const extracted = parsedMessage(value.slice(start, index + 1));
        if (extracted) return extracted;
        break;
      }
    }
  }

  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\*\*|\*\*$/g, ""));
  const titleLine = lines.findIndex((line) =>
    /^(?:title|subject)\s*:/i.test(line),
  );
  if (titleLine >= 0) {
    const title = lines[titleLine].replace(/^(?:title|subject)\s*:\s*/i, "");
    const bodyLine = lines.findIndex(
      (line, index) =>
        index > titleLine && /^(?:body|description)\s*:/i.test(line),
    );
    const body =
      bodyLine >= 0
        ? [
            lines[bodyLine].replace(/^(?:body|description)\s*:\s*/i, ""),
            ...lines.slice(bodyLine + 1),
          ].join("\n")
        : lines.slice(titleLine + 1).join("\n");
    const labeled = accept(title || lines[titleLine + 1], body);
    if (labeled) return { ...labeled, fallback: true };
  }

  const content = lines
    .filter(Boolean)
    .filter(
      (line) =>
        !/^(?:here(?:'s| is)\s+(?:the\s+)?(?:commit\s+)?message:?|commit message:?)$/i.test(
          line,
        ),
    );
  if (content.length) {
    const plain = accept(content[0], content.slice(1).join("\n"));
    if (plain) return { ...plain, fallback: true };
  }
  return fallbackCommitMessage(state, step);
}

async function draftCommitMessage(
  ctx: ExtensionContext,
  state: TaskState,
  step: number,
): Promise<DraftedCommitMessage> {
  if (!ctx.model)
    throw new Error("Select a model before drafting the commit message.");
  const diff = readFileSync(
    join(taskDir(state), `implementation-${step}.diff`),
    "utf8",
  );
  const user: Message = {
    role: "user",
    content: [
      {
        type: "text",
        text: `Task: ${state.id}\nStep: ${step}\nWorker summary:\n${state.pendingSummary || "(none)"}\n\nChanges in this step:\n${diff}`,
      },
    ],
    timestamp: Date.now(),
  };
  const response = await ctx.modelRegistry.complete(
    ctx.model,
    {
      systemPrompt:
        "Write an English Git commit message for exactly the supplied changes. Return only a JSON object with string fields title and body. Use a concise, specific imperative title. The body should explain the changes and their purpose in useful detail. Mention checks only when the supplied summary supports them. Do not invent behavior, motivation, or test outcomes.",
      messages: [user],
    },
    { cacheRetention: "none", sessionId: uuidv7() },
  );
  if (response.stopReason === "error" || response.stopReason === "aborted")
    throw new Error(
      "Commit-message generation failed. The commit phase remains open; use /task next to retry.",
    );
  const text = response.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
  const parsed = parseCommitMessage(text, state, step);
  return parsed.fallback ? { ...parsed, fallback: true } : parsed;
}

type TransitionAssessment = {
  openQuestions: string[];
  pendingProposal: string;
  reason: string;
};

async function assessTransition(
  ctx: ExtensionContext,
  state: TaskState,
  command: "next" | "accept",
  note: string,
): Promise<TransitionAssessment> {
  if (!ctx.model)
    throw new Error("Select a model before using /task next or /task accept.");
  const branch = ctx.sessionManager.getBranch();
  let boundary = 0;
  for (let index = 0; index < branch.length; index++) {
    const entry = branch[index];
    if (entry.type === "custom_message" && entry.customType === KICKOFF_TYPE) {
      boundary = index + 1;
      continue;
    }
    if (entry.type !== "message") continue;
    if (
      entry.message.role === "custom" &&
      ["task-review", "task-implementation", "task-commit"].includes(
        (entry.message as { customType?: string }).customType || "",
      )
    )
      boundary = index + 1;
    if (entry.message.role === "user") {
      const content = entry.message.content;
      const body =
        typeof content === "string"
          ? content
          : content
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("\n");
      if (body.startsWith("[task-workflow:")) boundary = index + 1;
    }
  }
  const messages = branch
    .slice(boundary)
    .flatMap((entry) => {
      if (
        entry.type !== "message" ||
        (entry.message.role !== "user" && entry.message.role !== "assistant")
      )
        return [];
      const content = entry.message.content;
      const body =
        typeof content === "string"
          ? content
          : content
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("\n");
      if (!body.trim() || body.startsWith("[task-workflow:")) return [];
      return [`${entry.message.role}: ${body.slice(0, 5000)}`];
    })
    .slice(-16)
    .join("\n\n")
    .slice(-24_000);
  const review =
    state.phase === "review" &&
    state.awaitingReview &&
    existsSync(reviewPath(state, state.awaitingReview))
      ? readFileSync(reviewPath(state, state.awaitingReview), "utf8").slice(
          0,
          10_000,
        )
      : "";
  const user: Message = {
    role: "user",
    content: [
      {
        type: "text",
        text: `Task: ${state.id}\nPhase: ${state.phase}\nCommand: /task ${command}\nCommand note: ${note || "(none)"}\n\nRecent discussion:\n${messages || "(none)"}\n\nCurrent review artifact, if any:\n${review || "(none)"}`,
      },
    ],
    timestamp: Date.now(),
  };
  const started = Date.now();
  const update = () =>
    ctx.ui.setStatus(
      "task-transition",
      `Checking task transition · ${Math.floor((Date.now() - started) / 1000)}s`,
    );
  update();
  const timer = setInterval(update, 1000);
  try {
    const response = await ctx.modelRegistry.complete(
      ctx.model,
      {
        systemPrompt: `You decide whether a task phase can advance. Analyze only the current phase's recent discussion and current review artifact. Return only JSON with fields openQuestions (array of strings), pendingProposal (string), reason (string). Keep each field concise.

/task accept is an explicit user decision: agree to the assistant's latest concrete proposal as stated, including its recommended/default choices. No agreement note is needed. If the assistant asks "Keep this proposed version, or add optional feature X?", accept chooses the proposed version and declines X. The question is resolved, so openQuestions must be empty unless another independent decision is still required. Summarize the accepted version in pendingProposal. If there is no pending proposal, accept behaves like /task next.

Example: Assistant says "I propose a game that picks 1–100, gives higher/lower hints, and ends when guessed. Keep that, or add an attempt limit?" Command /task accept with no note -> {"openQuestions":[],"pendingProposal":"Game with a number from 1 to 100, higher/lower hints, and no attempt limit; ends when guessed.","reason":"The user accepted the proposed version and declined the optional limit."}. This rule applies regardless of the discussion language.

An open question is a material uncertainty that still needs user input after applying the command's decision. If the assistant presents mutually exclusive alternatives without proposing or recommending one, /task accept alone cannot choose; report that choice as open unless the command note selects it. Missing information that cannot be inferred from an accepted proposal also stays open. Do not count optional invitations for more context, approval requests answered by /task accept, or optional alternatives to an accepted default. For /task next, do not treat the command as approval of a pending proposal. A pending proposal is an unapproved concrete assistant recommendation, plan, or decision; summarize all compatible proposals. Do not count proposals clearly accepted in an earlier ordinary user message. Review findings and suggested changes use a separate repair workflow; do not count the findings themselves as open questions or pending proposals. A later parent-assistant proposal about handling a finding can be pending. Do not invent questions or proposals from earlier phases.`,
        messages: [user],
      },
      { cacheRetention: "none", sessionId: uuidv7() },
    );
    if (response.stopReason === "error" || response.stopReason === "aborted")
      throw new Error(
        "Could not check whether the task is ready to advance. The phase is unchanged.",
      );
    const answer = response.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    let value: unknown;
    try {
      value = JSON.parse(
        answer.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
      );
    } catch {
      throw new Error(
        "The transition check returned an invalid response. The phase is unchanged.",
      );
    }
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error(
        "The transition check returned an invalid response. The phase is unchanged.",
      );
    const result = value as Partial<TransitionAssessment>;
    if (
      !Array.isArray(result.openQuestions) ||
      result.openQuestions.some((item) => typeof item !== "string") ||
      typeof result.pendingProposal !== "string" ||
      typeof result.reason !== "string"
    )
      throw new Error(
        "The transition check returned an invalid response. The phase is unchanged.",
      );
    return {
      openQuestions: result.openQuestions
        .slice(0, 5)
        .map((item) => item.replace(/\s+/g, " ").slice(0, 500)),
      pendingProposal: result.pendingProposal
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2000),
      reason: result.reason.replace(/\s+/g, " ").slice(0, 1000),
    };
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
  if (
    current.length !== expected.size ||
    current.some((file) => !expected.has(file))
  ) {
    throw new Error(
      "The working tree changed after the implementation diff was shown. Review it before retrying the commit.",
    );
  }
  for (const file of files) {
    if (fileHash(state.projectRoot, file) !== state.pendingHashes?.[file]) {
      throw new Error(
        `File changed after review: ${file}. Review it before retrying the commit.`,
      );
    }
  }
  git(state.projectRoot, ["add", "-A", "--", ...files]);
  git(state.projectRoot, [
    "commit",
    "--only",
    "-m",
    title,
    "-m",
    body,
    "--",
    ...files,
  ]);
  return git(state.projectRoot, ["rev-parse", "--short", "HEAD"]);
}

async function showArtifact(
  ctx: ExtensionCommandContext,
  title: string,
  content: string,
): Promise<void> {
  if (ctx.mode !== "tui") {
    ctx.ui.notify(`${title}\n\n${content}`, "info");
    return;
  }
  await ctx.ui.custom<void>(
    (tui, theme, _keys, done) => {
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
            row(
              theme.fg(
                "dim",
                `j/k (о/л) scroll · Enter/Esc close · ${scroll + 1}-${Math.min(scroll + height, lines.length)}/${lines.length}`,
              ),
            ),
            theme.fg("accent", `└${"─".repeat(Math.max(0, width - 2))}┘`),
          ];
        },
        handleInput(data: string): void {
          const printable = decodeKittyPrintable(data) ?? data;
          if (matchesKey(data, "enter") || matchesKey(data, "escape")) done();
          else if (
            matchesKey(data, "k") ||
            printable === "л" ||
            matchesKey(data, "up")
          )
            scroll = Math.max(0, scroll - 1);
          else if (
            matchesKey(data, "j") ||
            printable === "о" ||
            matchesKey(data, "down")
          )
            scroll++;
          else if (matchesKey(data, "pageUp"))
            scroll = Math.max(0, scroll - 10);
          else if (matchesKey(data, "pageDown")) scroll += 10;
          tui.requestRender();
        },
        invalidate(): void {
          markdown.invalidate();
        },
      };
    },
    { overlay: true, overlayOptions: { anchor: "center", width: "85%" } },
  );
}

function sessionDirectory(state: TaskState): string {
  return join(taskDir(state), "sessions");
}

function stepTitle(
  state: TaskState,
  step = state.currentStep,
): string | undefined {
  try {
    const roadmap = readFileSync(roadmapPath(state), "utf8");
    const line = roadmap
      .split(/\r?\n/)
      .find((value) => value.startsWith(`${step}. `));
    const title = (
      line?.match(/^\d+\.\s+\*\*(.+?)\*\*(?:\s+[-–—])?/)?.[1] ||
      line?.replace(/^\d+\.\s+/, "")
    )
      ?.replace(/\s+/g, " ")
      .trim();
    return title ? truncateToWidth(title, 28) : undefined;
  } catch {
    return undefined;
  }
}

function phaseLabel(state: TaskState): string {
  const phase =
    state.phase === "collect"
      ? "Context"
      : state.phase === "research"
        ? "Research"
        : state.phase === "roadmap"
          ? "Roadmap"
          : state.phase === "steps"
            ? "Step design"
            : state.phase === "implement"
              ? "Implementation"
              : state.phase === "review"
                ? "Review"
                : state.phase === "commit"
                  ? "Commit"
                  : "Complete";
  if (!["steps", "implement", "review", "commit"].includes(state.phase))
    return phase;
  let total: number | undefined;
  try {
    total = stepCount(state);
  } catch {
    /* The roadmap may still be a draft. */
  }
  const title = stepTitle(state);
  return `${phase} ${state.currentStep}${total ? `/${total}` : ""}${title ? ` · ${title}` : ""}`;
}

function sessionDisplayName(
  state: TaskState,
  phase = state.phase,
  step = state.currentStep,
): string {
  const title = ["steps", "implement", "review", "commit"].includes(phase)
    ? stepTitle(state, step)
    : undefined;
  const part =
    phase === "collect"
      ? "context"
      : phase === "research"
        ? "context + research"
        : phase === "steps" ||
            phase === "implement" ||
            phase === "review" ||
            phase === "commit"
          ? `${phase} ${step}`
          : phase;
  return `${state.id} · ${part}${phase === "review" ? ` · r${state.reviewRound || 1}` : ""}${title ? ` · ${title}` : ""}`;
}

function phaseHint(state: TaskState): string {
  if (state.interruptedSession)
    return "Run /task resume to continue the interrupted run.";
  if (state.phase === "collect")
    return "Add context; when ready, use /task next.";
  if (state.phase === "research")
    return "Discuss findings; when ready, use /task next.";
  if (state.phase === "roadmap" || state.phase === "steps")
    return "When agreed, use /task next (or /task accept for a proposal).";
  if (state.phase === "implement")
    return state.implementationStarted
      ? "Ready for review? Use /task next."
      : "Start implementation with /task next.";
  if (state.phase === "review")
    return state.reviewPending
      ? "Review is pending; use /task resume or save the review before /task next."
      : "Discuss findings; when ready, use /task next.";
  if (state.phase === "commit")
    return !state.commitReady
      ? "Commit proposal pending; use /task next to generate or retry it."
      : state.commitPendingFiles?.length
        ? "Commit the reviewed files; /task next verifies the commit before continuing."
        : "Commit action complete or skipped; use /task next to continue.";
  return "Task complete.";
}

function updatePhaseUi(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: TaskState,
  waiting: boolean,
): void {
  const name = sessionDisplayName(state);
  if (pi.getSessionName() !== name) pi.setSessionName(name);
  ctx.ui.setWidget(
    PHASE_WIDGET,
    [
      `Task ${state.id} · ${phaseLabel(state)}`,
      waiting ? phaseHint(state) : "Pi is working…",
    ],
    { placement: "aboveEditor" },
  );
}

function visibleTask(ctx: ExtensionContext): TaskState | undefined {
  try {
    const state = requireTask(ctx);
    if (sessionMatches(ctx, state)) return state;
    const link = taskLink(ctx);
    const current = ctx.sessionManager.getSessionFile();
    const completedPhaseSession =
      link?.phase === "review" || link?.phase === "commit"
        ? sessionFor(state, link.phase, state.currentStep)
        : undefined;
    if (
      state.phase === "complete" &&
      completedPhaseSession &&
      current &&
      resolve(current) === resolve(completedPhaseSession)
    )
      return state;
  } catch {
    /* This is not an active task session. */
  }
  return undefined;
}

function sessionFor(
  state: TaskState,
  phase = state.phase,
  step = state.currentStep,
): string | undefined {
  const sessions = state.sessions;
  if (!sessions) return undefined;
  if (phase === "collect") return sessions.collect;
  if (phase === "research") return sessions.research;
  if (phase === "roadmap") return sessions.roadmap;
  if (phase === "steps") return sessions.steps?.[String(step)];
  if (phase === "implement") return sessions.implement?.[String(step)];
  if (phase === "commit") return sessions.commit?.[String(step)];
  if (phase === "complete")
    return (
      sessions.commit?.[String(state.completedSteps.at(-1) || step)] ||
      sessions.review?.[String(state.completedSteps.at(-1) || step)]?.at(-1)
    );
  if (phase === "review") return sessions.review?.[String(step)]?.at(-1);
}

function setSessionFor(
  state: TaskState,
  phase: Phase,
  file: string,
  step = state.currentStep,
): void {
  const sessions = (state.sessions ??= {});
  if (phase === "collect") sessions.collect = file;
  else if (phase === "research") sessions.research = file;
  else if (phase === "roadmap") sessions.roadmap = file;
  else if (phase === "steps") (sessions.steps ??= {})[String(step)] = file;
  else if (phase === "implement")
    (sessions.implement ??= {})[String(step)] = file;
  else if (phase === "review")
    (sessions.review ??= {})[String(step)] = [
      ...(sessions.review?.[String(step)] || []),
      file,
    ];
  else if (phase === "commit") (sessions.commit ??= {})[String(step)] = file;
}

function sessionMatches(ctx: ExtensionContext, state: TaskState): boolean {
  const link = taskLink(ctx);
  const current = ctx.sessionManager.getSessionFile();
  const expected = sessionFor(state);
  return (
    !!link &&
    !!current &&
    !!expected &&
    link.id === state.id &&
    link.statePath === statePath(taskDir(state)) &&
    link.phase === state.phase &&
    (link.step || 1) === state.currentStep &&
    resolve(current) === resolve(expected)
  );
}

function configuredModel(phase: Phase): PhaseModel | null | undefined {
  const config = readConfig();
  if (phase === "complete" || phase === "commit") return undefined;
  return config.phaseModels?.[phase];
}

async function selectPhaseModel(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  phase: Phase,
  step: number,
): Promise<void> {
  const model = configuredModel(phase);
  if (!model) return;
  const ready = ctx.sessionManager
    .getBranch()
    .some(
      (entry) =>
        entry.type === "custom" &&
        entry.customType === "task-workflow-model-ready" &&
        (entry.data as { phase?: Phase; step?: number } | undefined)?.phase ===
          phase &&
        (entry.data as { step?: number } | undefined)?.step === step,
    );
  if (ready) return;
  const selected = ctx.modelRegistry.find(model.provider, model.model);
  if (!selected)
    throw new Error(`Task model not found: ${model.provider}/${model.model}`);
  if (!(await pi.setModel(selected)))
    throw new Error(
      `Task model has no configured authentication: ${model.provider}/${model.model}`,
    );
  if (model.thinkingLevel) pi.setThinkingLevel(model.thinkingLevel);
  ctx.sessionManager.appendCustomEntry("task-workflow-model-ready", {
    phase,
    step,
  });
}

function createPhaseSession(
  state: TaskState,
  phase: Phase,
  step: number,
  parent?: string,
  visibleMessage?: string,
): string {
  mkdirSync(sessionDirectory(state), { recursive: true });
  const session = SessionManager.create(
    state.projectRoot,
    sessionDirectory(state),
    parent ? { parentSession: parent } : undefined,
  );
  const round = phase === "review" ? state.reviewRound || 1 : undefined;
  session.appendCustomEntry(ENTRY_TYPE, {
    id: state.id,
    statePath: statePath(taskDir(state)),
    phase,
    step,
    round,
  } satisfies TaskLink);
  const infoId = session.appendSessionInfo(
    sessionDisplayName(state, phase, step),
  );
  // Pi persists a new session only after a user/assistant message. Keep that empty
  // persistence trigger off the active branch so it never enters editor history.
  session.appendMessage({ role: "user", content: [], timestamp: Date.now() });
  session.branch(infoId);
  session.appendCustomMessageEntry(
    "task-workflow-seed",
    `Task ${state.id}, ${phase} phase${step ? `, step ${step}` : ""}. The approved task artifacts are in ${taskDir(state)}. This is a fresh Pi session. Wait for the next message before taking action.`,
    false,
  );
  if (visibleMessage)
    session.appendCustomMessageEntry("task-commit", visibleMessage, true);
  const file = session.getSessionFile();
  if (!file || !existsSync(file))
    throw new Error("Pi did not save the new task session.");
  return file;
}

function phaseKickoff(state: TaskState, phase: Phase, step: number): string {
  if (phase === "collect")
    return `Describe the task and add context. Keep ${state.contextPath} compact and current after each answer.`;
  if (phase === "research")
    return `Read ${state.contextPath}, inspect the project, discuss feasibility and questions, and update agreed findings in the context artifact.`;
  if (phase === "roadmap")
    return `Read ${state.contextPath}. Propose a numbered roadmap with a short bold title and brief explanation for each step. Discuss additions and update context when we agree on them.`;
  if (phase === "steps")
    return `Read ${state.contextPath} and ${roadmapPath(state)}. Discuss the design and verification of step ${step}; update agreed task artifacts.`;
  if (phase === "implement")
    return `Read ${state.contextPath}, ${roadmapPath(state)}, and ${stepPath(state, step)}. Wait for /task next before editing code so the implementation baseline can be captured.`;
  if (phase === "commit")
    return `Review has been accepted. This is the separate commit phase for step ${step}. Check the commit result shown in this session; if generation failed, use /task next to retry. Commit the reviewed files if a manual commit is pending, then use /task next to continue.`;
  return `Read ${state.contextPath}, ${stepPath(state, step)}, and ${join(taskDir(state), `implementation-${step}.diff`)}. Review step ${step} independently and record findings in ${reviewPath(state, step)}. Each finding must include a short exact diff excerpt. In your response to me, place the same fenced diff excerpt directly beside each finding so I can see the changed code without opening the artifact. Discuss findings with me.`;
}

async function enterResearch(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  state: TaskState,
): Promise<void> {
  const file = ctx.sessionManager.getSessionFile();
  if (!file || !sessionMatches(ctx, state))
    throw new Error(
      "Open the task's context session before starting research.",
    );
  await selectPhaseModel(pi, ctx, "research", 1);
  state.phase = "research";
  delete state.interruptedSession;
  setSessionFor(state, "research", file, 1);
  ctx.sessionManager.appendCustomEntry(ENTRY_TYPE, {
    id: state.id,
    statePath: statePath(taskDir(state)),
    phase: "research",
    step: 1,
  } satisfies TaskLink);
  pi.setSessionName(sessionDisplayName(state));
  saveState(state);
  updatePhaseUi(pi, ctx, state, false);
  pi.sendMessage(
    {
      customType: KICKOFF_TYPE,
      content: phaseKickoff(state, "research", 1),
      display: false,
    },
    { triggerTurn: true },
  );
}

async function switchPhase(
  ctx: ExtensionCommandContext,
  state: TaskState,
  phase: Phase,
  step: number,
  kickoff: string,
  existing?: string,
  afterSwitch?: (fresh: ReplacedContext) => Promise<void>,
): Promise<boolean> {
  const previous = JSON.parse(JSON.stringify(state)) as TaskState;
  const parent = ctx.sessionManager.getSessionFile();
  const file = existing || createPhaseSession(state, phase, step, parent);
  state.phase = phase;
  state.currentStep = step;
  delete state.interruptedSession;
  if (!existing) setSessionFor(state, phase, file, step);
  saveState(state);
  try {
    const result = await ctx.switchSession(file, {
      withSession: async (fresh) => {
        if (kickoff)
          await fresh.sendMessage(
            { customType: KICKOFF_TYPE, content: kickoff, display: false },
            { triggerTurn: true },
          );
        if (afterSwitch) await afterSwitch(fresh);
      },
    });
    if (result.cancelled) {
      saveState(previous);
      ctx.ui.notify(
        `Session switch was cancelled. Use /task ${state.id} to open its saved ${state.phase} phase.`,
        "warning",
      );
      return false;
    }
    return true;
  } catch (error) {
    saveState(previous);
    throw error;
  }
}

function ensurePhaseSession(
  ctx: ExtensionContext,
  state: TaskState,
  phase: Phase,
  step: number,
): string {
  let file = sessionFor(state, phase, step);
  if (!file || !existsSync(file)) {
    // Tasks created by the previous extension have artifacts and state but no saved phase sessions.
    file = createPhaseSession(
      state,
      phase,
      step,
      ctx.sessionManager.getSessionFile(),
    );
    setSessionFor(state, phase, file, step);
    if (phase === "implement")
      state.implementationStarted = !!state.pendingBaselineDir;
    saveState(state);
  }
  return file;
}

async function continueTaskSession(
  ctx: ExtensionCommandContext,
  state: TaskState,
): Promise<void> {
  let phase = state.phase;
  let step = state.currentStep;
  if (phase === "complete") {
    step = state.completedSteps.at(-1) || step;
    phase = state.sessions?.commit?.[String(step)] ? "commit" : "review";
  }
  const file = ensurePhaseSession(ctx, state, phase, step);
  if (ctx.sessionManager.getSessionFile() === file) {
    ctx.ui.notify(
      `Task ${state.id} is already in its ${phase} session.`,
      "info",
    );
    return;
  }
  const result = await ctx.switchSession(file);
  if (result.cancelled)
    ctx.ui.notify("Session switch was cancelled.", "warning");
}

function resumeKickoff(state: TaskState): string {
  if (state.phase === "commit")
    return state.commitReady
      ? `Resume the separate commit phase for step ${state.currentStep}. Revisit the saved commit result, do not change project code or task artifacts, and wait for /task next before continuing.`
      : `Resume the separate commit phase for step ${state.currentStep}. The commit result is not ready; use /task next to generate or retry it.`;
  const step = state.awaitingReview || state.currentStep;
  const reviewReport = reviewPath(state, step);
  const reviewReminder =
    state.phase === "review" &&
    (state.reviewPending || !existsSync(reviewReport))
      ? ` The review is still pending; finish reviewing step ${step} and save ${reviewReport} before advancing.`
      : "";
  return `Resume task ${state.id} in its current ${state.phase} phase from the saved conversation. Review recent messages and the current project state, continue unfinished work, and update the artifacts required by this phase. Do not repeat completed work or advance phases.${reviewReminder}`;
}

function hasPendingResume(state: TaskState): boolean {
  const phaseSession = sessionFor(state);
  const interrupted =
    !!state.interruptedSession &&
    !!phaseSession &&
    resolve(state.interruptedSession) === resolve(phaseSession);
  const reviewStep = state.awaitingReview || state.currentStep;
  const pendingReview =
    state.phase === "review" &&
    (state.reviewPending || !existsSync(reviewPath(state, reviewStep)));
  return interrupted || pendingReview;
}

async function resumeOrOpenTask(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  state: TaskState,
): Promise<void> {
  if (state.phase === "complete" || hasPendingResume(state)) {
    await resumeTaskSession(pi, ctx, state);
    return;
  }
  await continueTaskSession(ctx, state);
}

async function resumeFromCurrentProject(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
): Promise<void> {
  if (!ctx.isIdle())
    throw new Error(
      "Wait for Pi to finish or cancel its current run before resuming a task.",
    );
  if (taskLink(ctx)) {
    await resumeOrOpenTask(pi, ctx, requireTask(ctx));
    return;
  }

  const root = projectRoot(ctx.cwd);
  const tasks = listTasks(root).filter(
    ({ state }) => state.phase !== "complete",
  );
  if (!tasks.length)
    throw new Error(
      `No active tasks found in ${root}. Use /task TASK-ID to start one.`,
    );

  let selected: DiscoveredTask | undefined;
  if (tasks.length === 1) {
    selected = tasks[0];
  } else if (ctx.mode === "tui") {
    const options = tasks.map(
      ({ state }) =>
        `${state.id} · ${taskProgress(state)} · ${taskDescription(state)}`,
    );
    const choice = await ctx.ui.select("Resume task:", options);
    if (choice === undefined) return;
    selected = tasks[options.indexOf(choice)];
  } else {
    const rows = tasks.map(
      ({ state }) =>
        `- ${state.id} · ${taskProgress(state)} · ${taskDescription(state)}`,
    );
    await showArtifact(
      ctx,
      "Choose a task to resume",
      `${rows.join("\n")}\n\nUse /task TASK-ID to open one, then /task resume.`,
    );
    return;
  }

  if (selected) await resumeOrOpenTask(pi, ctx, selected.state);
}

async function resumeTaskSession(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  state: TaskState,
): Promise<void> {
  if (state.phase === "complete")
    throw new Error(
      `Task ${state.id} is complete; there is no phase to resume.`,
    );
  if (!ctx.isIdle())
    throw new Error(
      "Wait for Pi to finish or cancel its current run before resuming a task.",
    );
  if (!hasPendingResume(state))
    throw new Error(
      "There is no interrupted run in this task session. Send a normal message to continue the phase.",
    );
  const file = ensurePhaseSession(ctx, state, state.phase, state.currentStep);
  const kickoff = resumeKickoff(state);
  const message = {
    customType: KICKOFF_TYPE,
    content: kickoff,
    display: false,
  };
  const current = ctx.sessionManager.getSessionFile();
  if (current && resolve(current) === resolve(file)) {
    await pi.sendMessage(message, { triggerTurn: true });
    return;
  }
  const result = await ctx.switchSession(file, {
    withSession: async (fresh) => {
      await fresh.sendMessage(message, { triggerTurn: true });
    },
  });
  if (result.cancelled)
    ctx.ui.notify(
      "Session switch was cancelled; the task was not resumed.",
      "warning",
    );
}

function lastAssistantSummary(ctx: ExtensionContext): string {
  const last = [...ctx.sessionManager.getBranch()]
    .reverse()
    .find(
      (entry) => entry.type === "message" && entry.message.role === "assistant",
    );
  if (!last || last.type !== "message" || last.message.role !== "assistant")
    return "";
  const content = last.message.content;
  return content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .slice(0, 4000);
}

async function finalizeArtifact(
  ctx: ExtensionContext,
  state: TaskState,
  kind: "context" | "roadmap" | "step",
  approval = "",
): Promise<void> {
  if (!ctx.model)
    throw new Error("Select a model before finalizing an artifact.");
  const path = artifactPath(state, kind);
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const discussion = ctx.sessionManager
    .getBranch()
    .flatMap((entry) => {
      if (
        entry.type !== "message" ||
        (entry.message.role !== "user" && entry.message.role !== "assistant")
      )
        return [];
      const content = entry.message.content;
      const body =
        typeof content === "string"
          ? content
          : content
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("\n");
      return body.trim()
        ? [`${entry.message.role}: ${body.slice(0, 4000)}`]
        : [];
    })
    .slice(-20)
    .join("\n\n")
    .slice(-30_000);
  const user: Message = {
    role: "user",
    content: [
      {
        type: "text",
        text: `Task: ${state.id}\nArtifact: ${kind}${kind === "step" ? ` ${state.currentStep}` : ""}\nApproved proposal: ${approval || "The discussion is settled."}\n\nExisting artifact:\n${existing || "(none)"}\n\nRecent phase discussion:\n${discussion || "(none)"}`,
      },
    ],
    timestamp: Date.now(),
  };
  const instructions =
    kind === "context"
      ? "Write the complete compact task context, including only agreed facts and decisions. Exclude open doubts. Preserve important constraints and code references discussed with the user."
      : kind === "roadmap"
        ? "Write the complete agreed roadmap as a consecutive numbered list. Begin every item with a short bold title, then a dash and brief explanation."
        : `Write the complete agreed implementation and verification design for step ${state.currentStep}. Do not include unresolved questions or unapproved alternatives.`;
  const response = await ctx.modelRegistry.complete(
    ctx.model,
    {
      systemPrompt: `${ARTIFACT_LANGUAGE_RULE} ${instructions} Return only the complete English Markdown document, without fences or commentary. Rewrite any non-English prose in the existing artifact into English.`,
      messages: [user],
    },
    { cacheRetention: "none", sessionId: uuidv7() },
  );
  if (response.stopReason === "error" || response.stopReason === "aborted")
    throw new Error("Artifact finalization failed; the phase is unchanged.");
  const content = response.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
  if (!content || content.startsWith("```"))
    throw new Error(
      "Artifact finalization returned invalid Markdown; the phase is unchanged.",
    );
  writeArtifact(state, kind, content);
}

async function beginImplementation(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  state: TaskState,
): Promise<void> {
  if (state.implementationStarted)
    throw new Error(
      "Implementation is already active. Use /task next when this step is ready for review.",
    );
  for (let n = 1; n <= stepCount(state); n++)
    if (!existsSync(stepPath(state, n)))
      throw new Error(`Approved design for step ${n} is missing.`);
  const gitRepository = hasGitRepository(state);
  const baselineClean = gitRepository && changedPaths(state).length === 0;
  if (gitRepository && readConfig().autoCommit && !baselineClean)
    throw new Error(
      "autoCommit requires a clean code working tree before implementation.",
    );
  ctx.ui.setStatus("task-baseline", "Preparing task baseline");
  let baseline: Baseline;
  try {
    baseline = state.pendingBaselineDir
      ? loadBaseline(state.pendingBaselineDir)
      : await captureBaseline(state, gitRepository, (message) =>
          ctx.ui.setStatus("task-baseline", message),
        );
  } finally {
    ctx.ui.setStatus("task-baseline", undefined);
  }
  state.pendingBaselineDir = baseline.directory;
  state.pendingGitRepository = gitRepository;
  state.pendingAutoCommitEligible = baselineClean;
  state.implementationStarted = true;
  saveState(state);
  pi.sendMessage(
    {
      customType: KICKOFF_TYPE,
      content: `Implement step ${state.currentStep} in this Pi session. Read ${state.contextPath}, ${roadmapPath(state)}, and ${stepPath(state, state.currentStep)}. Inspect the current code, make only the agreed changes, run focused checks, and do not commit. When finished, summarize the changes and checks. I will use /task next to start review.`,
      display: false,
    },
    { triggerTurn: true },
  );
}

async function beginReview(
  ctx: ExtensionCommandContext,
  state: TaskState,
): Promise<void> {
  if (!state.pendingBaselineDir)
    throw new Error(
      "The implementation baseline is missing. Restart the step before review.",
    );
  const n = state.currentStep;
  ctx.ui.setStatus("task-diff", "Comparing project files");
  let changes: { diff: string; files: string[] };
  try {
    changes = await implementationDiff(
      state,
      loadBaseline(state.pendingBaselineDir),
      (message) => ctx.ui.setStatus("task-diff", message),
    );
  } finally {
    ctx.ui.setStatus("task-diff", undefined);
  }
  const previousReview = reviewPath(state, n);
  if (existsSync(previousReview)) {
    const round = state.reviewRound || 1;
    writeFileSync(
      join(taskDir(state), `review-${n}-round-${round}.md`),
      readFileSync(previousReview, "utf8"),
      "utf8",
    );
  }
  writeFileSync(
    join(taskDir(state), `implementation-${n}.diff`),
    changes.diff ? `${changes.diff}\n` : "",
    "utf8",
  );
  state.pendingFiles = changes.files;
  state.pendingHashes = Object.fromEntries(
    changes.files.map((file) => [file, fileHash(state.projectRoot, file)]),
  );
  state.pendingSummary = lastAssistantSummary(ctx);
  state.awaitingReview = n;
  state.reviewPending = true;
  state.reviewRound = (state.reviewRound || 0) + 1;
  await switchPhase(ctx, state, "review", n, phaseKickoff(state, "review", n));
}

async function acceptReviewedStep(
  ctx: ExtensionCommandContext,
  state: TaskState,
  approval: string,
): Promise<void> {
  const n = state.awaitingReview || state.currentStep;
  if (state.reviewPending || !existsSync(reviewPath(state, n)))
    throw new Error(
      `The review is incomplete. Run /task resume to continue and save ${reviewPath(state, n)} before advancing.`,
    );
  const diffPath = join(taskDir(state), `implementation-${n}.diff`);
  if (state.pendingBaselineDir) {
    const current = await implementationDiff(
      state,
      loadBaseline(state.pendingBaselineDir),
    );
    if (current.diff.trimEnd() !== readFileSync(diffPath, "utf8").trimEnd()) {
      state.implementationStarted = true;
      await switchPhase(
        ctx,
        state,
        "implement",
        n,
        `Project files changed since review began. Inspect the changes and use /task next to start another review.`,
        state.sessions?.implement?.[String(n)],
      );
      return;
    }
  }
  if (approval)
    writeArtifact(
      state,
      "review",
      `${readFileSync(reviewPath(state, n), "utf8").trimEnd()}\n\n## Accepted proposal\n\n${approval}\n`,
      n,
    );
  const open = openReviewFindings(state, n);
  if (open) {
    state.implementationStarted = true;
    const implement = state.sessions?.implement?.[String(n)];
    if (!implement || !existsSync(implement)) {
      const file = createPhaseSession(
        state,
        "implement",
        n,
        ctx.sessionManager.getSessionFile(),
      );
      setSessionFor(state, "implement", file, n);
    }
    await switchPhase(
      ctx,
      state,
      "implement",
      n,
      `Read the agreed review findings in ${reviewPath(state, n)}. Fix only findings still marked Status: open. Preserve the existing implementation context in this session. Run focused checks; do not commit. Use /task next when ready for another review.`,
      state.sessions!.implement![String(n)],
    );
    return;
  }
  if (!state.completedSteps.includes(n)) state.completedSteps.push(n);
  state.completedSteps.sort((a, b) => a - b);
  state.awaitingReview = undefined;
  state.reviewPending = undefined;
  state.reviewRound = undefined;
  delete state.interruptedSession;
  state.implementationStarted = false;
  delete state.commitPendingFiles;
  delete state.commitPendingHashes;
  delete state.commitResult;
  state.commitReady = false;
  state.phase = "commit";
  state.currentStep = n;
  const file = createPhaseSession(
    state,
    "commit",
    n,
    ctx.sessionManager.getSessionFile(),
    `Review accepted for step ${n}. This is the separate commit phase. The commit result will appear here; use /task next to generate or retry it if needed.`,
  );
  setSessionFor(state, "commit", file, n);
  saveState(state);
  await switchPhase(ctx, state, "commit", n, "", file, async (fresh) => {
    try {
      await prepareCommitPhase(fresh, state, (content) =>
        fresh.sendMessage(
          { customType: "task-commit", content, display: true },
          { triggerTurn: false },
        ),
      );
    } catch (error) {
      fresh.ui.notify(
        error instanceof Error ? error.message : String(error),
        "error",
      );
    }
  });
}

async function prepareCommitPhase(
  ctx: ExtensionContext,
  state: TaskState,
  sendResult: (content: string) => Promise<void> | void,
): Promise<void> {
  if (state.phase !== "commit" || state.commitReady) return;
  const n = state.currentStep;
  let result: string;
  let commitPendingFiles: string[] | undefined;
  let commitPendingHashes: Record<string, string | null> | undefined;
  if (state.pendingGitRepository === false || !hasGitRepository(state)) {
    result = `Step ${n} accepted. No Git repository; commit skipped.`;
  } else if (!state.pendingFiles?.length) {
    result =
      "No code changes were produced, so there is no commit message to propose.";
  } else {
    const message = await draftCommitMessage(ctx, state, n);
    if (readConfig().autoCommit) {
      if (message.fallback)
        throw new Error(
          "The model response was unstructured, so auto-commit was skipped. Use /task next to retry.",
        );
      if (!state.pendingAutoCommitEligible)
        throw new Error(
          "This step began with existing changes, so it cannot be committed automatically.",
        );
      const sha = commitStep(state, message.title, message.body);
      result = `Committed step ${n} as ${sha}:\n\n${message.title}\n\n${message.body}${message.fallback ? "\n\nNote: Used a fallback message because the model response was unavailable or unstructured." : ""}`;
    } else {
      result = `${message.fallback ? "Fallback commit proposal" : `Suggested commit for step ${n}`}:\n\n${message.title}\n\n${message.body}`;
      commitPendingFiles = [...state.pendingFiles];
      commitPendingHashes = { ...(state.pendingHashes || {}) };
    }
  }
  state.commitPendingFiles = commitPendingFiles;
  state.commitPendingHashes = commitPendingHashes;
  state.commitResult = result;
  state.commitReady = true;
  if (state.pendingBaselineDir)
    rmSync(state.pendingBaselineDir, { recursive: true, force: true });
  state.pendingBaselineDir = undefined;
  state.pendingFiles = undefined;
  state.pendingHashes = undefined;
  state.pendingSummary = undefined;
  state.pendingAutoCommitEligible = undefined;
  state.pendingGitRepository = undefined;
  saveState(state);
  ctx.ui.setWidget(
    PHASE_WIDGET,
    [`Task ${state.id} · ${phaseLabel(state)}`, phaseHint(state)],
    { placement: "aboveEditor" },
  );
  await sendResult(result);
}

async function finishCommitPhase(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  state: TaskState,
): Promise<void> {
  if (!state.commitReady) {
    await prepareCommitPhase(ctx, state, (content) =>
      pi.sendMessage({ customType: "task-commit", content, display: true }),
    );
    return;
  }
  const n = state.currentStep;
  if (state.commitPendingFiles?.length) {
    const expected = new Set(state.commitPendingFiles);
    const stillChanged = changedPaths(state).filter((file) =>
      expected.has(file),
    );
    const mismatched = state.commitPendingFiles.filter(
      (file) =>
        fileHash(state.projectRoot, file) !== state.commitPendingHashes?.[file],
    );
    if (stillChanged.length || mismatched.length) {
      const files = [...new Set([...stillChanged, ...mismatched])];
      throw new Error(
        `Commit phase is not complete. Commit the reviewed versions of these files before /task next: ${files.join(", ")}`,
      );
    }
  }
  delete state.commitPendingFiles;
  delete state.commitPendingHashes;
  delete state.commitReady;
  delete state.commitResult;
  const more = n < stepCount(state);
  if (more) {
    state.phase = "implement";
    state.currentStep = n + 1;
    saveState(state);
    await switchPhase(
      ctx,
      state,
      "implement",
      n + 1,
      `The commit phase for step ${n} is complete. Step ${n + 1} is ready. Use /task next when you want to start implementation; that command captures its baseline first.`,
    );
  } else {
    state.phase = "complete";
    saveState(state);
    updatePhaseUi(pi, ctx, state, true);
    pi.sendMessage({
      customType: "task-commit",
      content: `The commit phase for step ${n} is complete. All planned steps are complete.`,
      display: true,
    });
  }
}

function pathWithin(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return (
    path === "" ||
    (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
  );
}

function taskDirectoryForDeletion(state: TaskState, path: string): string {
  const directory = resolve(taskDir(state));
  if (resolve(path) !== resolve(statePath(directory)))
    throw new Error(`Task state is outside its artifact directory: ${path}`);
  if (
    !lstatSync(directory).isDirectory() ||
    lstatSync(directory).isSymbolicLink()
  )
    throw new Error(`Refusing to delete a linked task directory: ${directory}`);
  if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
    throw new Error(`Refusing to delete a linked task state: ${path}`);
  const actual = realpathSync(directory);
  if (realpathSync(path) !== join(actual, "state.json"))
    throw new Error(`Task state does not belong to ${directory}.`);
  const root = realpathSync(state.projectRoot);
  if (pathWithin(actual, root))
    throw new Error(
      `Refusing to delete the project root or one of its parents: ${directory}`,
    );
  const agentRoot = resolve(
    process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"),
  );
  if (
    pathWithin(actual, agentRoot) ||
    actual === resolve(agentRoot, "sessions") ||
    actual === resolve(taskIndexDir())
  )
    throw new Error(
      `Refusing to delete a Pi configuration or sessions directory: ${directory}`,
    );
  return directory;
}

function deleteTaskFiles(state: TaskState, path: string): void {
  const directory = taskDirectoryForDeletion(state, path);
  rmSync(directory, { recursive: true });
  const index = join(
    taskIndexDir(),
    createHash("sha256")
      .update(`${state.projectRoot}\0${state.id}`)
      .digest("hex") + ".json",
  );
  try {
    const record = JSON.parse(readFileSync(index, "utf8")) as {
      id?: string;
      projectRoot?: string;
      statePath?: string;
    };
    if (
      record.id === state.id &&
      record.projectRoot === state.projectRoot &&
      record.statePath === path
    )
      rmSync(index);
  } catch {
    /* Task discovery ignores stale index entries. */
  }
}

function createNeutralSession(root: string): string {
  const session = SessionManager.create(root);
  const anchor = session.appendCustomEntry("task-workflow-neutral", {});
  session.appendMessage({ role: "user", content: [], timestamp: Date.now() });
  session.branch(anchor);
  session.appendCustomEntry("task-workflow-neutral-ready", {});
  const file = session.getSessionFile();
  if (!file || !existsSync(file))
    throw new Error(
      "Pi did not save the session needed to leave the deleted task.",
    );
  return file;
}

export default function taskExtension(pi: ExtensionAPI): void {
  for (const { command, key } of configuredHotkeys()) {
    pi.registerShortcut(key, {
      description: `/task ${command}`,
      handler: (ctx) => {
        if (!ctx.isIdle()) {
          ctx.ui.notify(
            `Wait for Pi to finish before using /task ${command}.`,
            "warning",
          );
          return;
        }
        if (ctx.ui.getEditorText().trim()) {
          ctx.ui.notify(
            `The editor has unsent text. Submit or clear it before /task ${command}.`,
            "warning",
          );
          return;
        }
        pi.sendUserMessage(`/task ${command}`, { expandPromptTemplates: true });
      },
    });
  }
  pi.registerTool({
    name: ARTIFACT_TOOL,
    label: "Write Task Artifact",
    description:
      "Replace a task artifact in the task directory. Write prose and headings in English, regardless of the conversation language; preserve exact code, paths, and required diff excerpts. The extension chooses the file path.",
    defaultActive: false,
    parameters: Type.Object({
      artifact: Type.Union([
        Type.Literal("context"),
        Type.Literal("roadmap"),
        Type.Literal("step"),
        Type.Literal("review"),
      ]),
      step: Type.Optional(Type.Integer({ minimum: 1 })),
      content: Type.String({ minLength: 1 }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const state = requireTask(ctx);
      if (!sessionMatches(ctx, state))
        throw new Error(
          "This is an old task session. Use /task TASK-ID to open the current phase before changing artifacts.",
        );
      const path = writeArtifact(
        state,
        params.artifact,
        params.content,
        params.step,
      );
      const reminder =
        params.artifact === "review"
          ? " In your response to the user, include each finding's exact fenced diff excerpt beside its explanation; do not only report that the review was saved."
          : "";
      return {
        content: [{ type: "text", text: `Saved ${path}.${reminder}` }],
        details: { artifact: params.artifact, path },
      };
    },
  });

  pi.on("tool_call", (event, ctx) => {
    if (!taskLink(ctx)) return;
    let state: TaskState;
    try {
      state = requireTask(ctx);
    } catch {
      return {
        block: true,
        reason:
          "Task state is unavailable; tools are blocked until it is restored.",
      };
    }
    if (!sessionMatches(ctx, state))
      return {
        block: true,
        reason:
          "This task session is not the active phase. Use /task TASK-ID to continue the current session.",
      };
    if (state.phase === "implement" && state.implementationStarted) return;
    const allowed = new Set(
      state.phase === "commit"
        ? READ_TOOLS
        : [
            ...READ_TOOLS,
            ARTIFACT_TOOL,
            ...(state.phase === "review" ? readConfig().reviewTools || [] : []),
          ],
    );
    if (allowed.has(event.toolName)) return;
    return {
      block: true,
      reason:
        state.phase === "implement"
          ? "Use /task next to capture the baseline before editing code."
          : `The ${state.phase} phase cannot change project files. Code edits belong to implementation.`,
    };
  });

  pi.on("session_before_tree", (_event, ctx) => {
    if (!taskLink(ctx)) return;
    if (readConfig().allowTreeNavigation === true) return;
    ctx.ui.notify(
      "/tree is blocked in task sessions because artifacts are shared across branches. Set allowTreeNavigation to true to allow it.",
      "warning",
    );
    return { cancel: true };
  });

  let completionContext: ExtensionContext | undefined;
  pi.on("session_start", async (_event, ctx) => {
    completionContext = ctx;
    const state = visibleTask(ctx);
    if (!state) {
      ctx.ui.setWidget(PHASE_WIDGET, undefined);
      return;
    }
    updatePhaseUi(pi, ctx, state, true);
    if (!sessionMatches(ctx, state)) return;
    try {
      await selectPhaseModel(pi, ctx, state.phase, state.currentStep);
    } catch (error) {
      ctx.ui.notify(
        error instanceof Error ? error.message : String(error),
        "error",
      );
    }
  });

  pi.on("session_shutdown", (_event, ctx) => {
    ctx.ui.setWidget(PHASE_WIDGET, undefined);
  });
  pi.on("agent_start", (_event, ctx) => {
    const state = visibleTask(ctx);
    if (state) updatePhaseUi(pi, ctx, state, false);
  });
  pi.on("agent_settled", (event, ctx) => {
    const state = visibleTask(ctx);
    const session = ctx.sessionManager.getSessionFile();
    if (
      state &&
      state.phase !== "complete" &&
      session &&
      sessionMatches(ctx, state)
    ) {
      if (event.aborted) {
        state.interruptedSession = session;
        saveState(state);
      } else if (
        session &&
        state.interruptedSession &&
        resolve(state.interruptedSession) === resolve(session)
      ) {
        delete state.interruptedSession;
        saveState(state);
      }
    }
    if (state) updatePhaseUi(pi, ctx, state, true);
  });

  pi.on("before_agent_start", (event, ctx) => {
    if (!taskLink(ctx)) return;
    let state: TaskState;
    try {
      state = requireTask(ctx);
    } catch {
      event.systemPromptOptions.selectedTools = [];
      event.systemPromptOptions.sections.task_workflow =
        "Task state is unavailable. Do not call tools.";
      return;
    }
    if (!sessionMatches(ctx, state)) {
      event.systemPromptOptions.selectedTools = [];
      event.systemPromptOptions.sections.task_workflow = `This is an archived task session. The active phase is ${state.phase}. Do not edit files. Use /task ${state.id} to continue.`;
      return;
    }
    const writable = state.phase === "implement" && state.implementationStarted;
    const config = readConfig();
    event.systemPromptOptions.selectedTools =
      state.phase === "commit"
        ? [...READ_TOOLS]
        : writable
          ? [
              ...new Set([
                ...pi.getActiveTools(),
                "read",
                "bash",
                "edit",
                "write",
                ...READ_TOOLS,
                ARTIFACT_TOOL,
              ]),
            ]
          : [
              ...READ_TOOLS,
              ARTIFACT_TOOL,
              ...(state.phase === "review" ? config.reviewTools || [] : []),
            ];
    const common = `Task ${state.id}. Phase ${state.phase}, step ${state.currentStep}. Canonical context: ${state.contextPath}. ${state.phase === "commit" ? "This is a separate commit phase. Do not edit project code, task artifacts, state, or implementation diffs. Only /task commands change phases." : `Update task artifacts with ${ARTIFACT_TOOL}; it accepts complete replacement content. ${ARTIFACT_LANGUAGE_RULE} When updating an existing artifact, convert its non-English prose to English while preserving its agreed meaning. Only /task commands change phases. Do not edit state.json or implementation diffs.`}`;
    const rule =
      state.phase === "collect"
        ? "After each user message, keep context.md concise and current with confirmed facts and important provisional options. Do not invent code findings."
        : state.phase === "research"
          ? "Inspect code and discuss feasibility. Add agreed findings and code references to context.md; leave unresolved doubts out."
          : state.phase === "roadmap"
            ? "Discuss the roadmap. Update context.md when agreed facts change, then present a complete revised numbered roadmap. Draft roadmap.md as decisions settle."
            : state.phase === "steps"
              ? `Discuss step ${state.currentStep}. Update agreed context, roadmap, and step artifacts. Do not edit project code.`
              : state.phase === "implement"
                ? writable
                  ? `Implement or repair step ${state.currentStep} in this session. Read approved artifacts and, when repairing, ${reviewPath(state, state.currentStep)}. Address only open findings. Run focused checks and summarize changes. Do not commit. Use /task next when ready for review.`
                  : "Implementation has not started. Read the approved artifacts, but do not edit project code until /task next captures the baseline."
                : state.phase === "review"
                  ? `Review step ${state.currentStep} independently with read-only project tools. Read the approved artifacts and ${join(taskDir(state), `implementation-${state.currentStep}.diff`)}. If a skill named ${reviewSkillName(config)} is available, follow its compatible read-only instructions. Save ${reviewPath(state, state.currentStep)} with a Summary and Findings section. Each finding needs a ### heading, Status: open, a precise code location, and one short exact fenced diff excerpt. Write "No findings." when clear. In your final response, show every actionable finding with its severity, code location, concrete impact, and a short fenced diff excerpt copied exactly from implementation-${state.currentStep}.diff beside the explanation. Do not replace the excerpt with only a path, line number, or link to the review artifact. If there are no findings, say so plainly. Discuss findings with the user; update their statuses only after agreement. Do not edit project code.`
                  : state.phase === "commit"
                    ? state.commitReady
                      ? `Present and explain the commit result already saved in this session. This phase has a clear boundary: do not implement, review, or modify task artifacts. If a manual commit is pending, the user must commit the reviewed files before leaving; /task next verifies this. Only /task next (or /task accept) leaves this phase and starts the next step or completes the task.`
                      : "The commit result is not ready. Do not invent one or modify files; tell the user to run /task next to generate or retry it. This is the separate commit phase."
                    : "The task is complete. Do not edit project files through this task session.";
    const phaseSkill =
      state.phase === "research" ||
      state.phase === "roadmap" ||
      state.phase === "steps"
        ? configuredPhaseSkill(config, state.phase)
        : undefined;
    const skillGuidance = phaseSkill
      ? ` If the discovered skill "${phaseSkill}" is available, use it as supplementary guidance for this phase. It must not override the task workflow's phase boundaries, artifact rules, or tool restrictions. If unavailable, continue with the built-in instructions.`
      : "";
    event.systemPromptOptions.sections.task_workflow = `${common}\n${rule}${skillGuidance}`;
  });

  pi.registerCommand("task", {
    description: "Guided task workflow; use /task help for commands",
    getArgumentCompletions: (prefix) => {
      const commands = [
        "list",
        "delete",
        "status",
        "resume",
        "next",
        "accept",
        "show",
        "help",
      ];
      let items = commands.map((value) => ({ value, label: value }));
      if (prefix.startsWith("show ")) {
        try {
          if (completionContext) {
            const state = requireTask(completionContext);
            items = markdownArtifacts(state).flatMap((name) => {
              const argument = completionArgument(name);
              return argument
                ? [{ value: `show ${argument}`, label: name }]
                : [];
            });
          }
        } catch {
          items = [];
        }
      } else if (prefix.startsWith("delete ")) {
        try {
          const root = projectRoot(completionContext?.cwd || process.cwd());
          items = listTasks(root).map(({ state }) => ({
            value: `delete ${state.id.includes(" ") ? `"${state.id}"` : state.id}`,
            label: `${state.id} · ${taskProgress(state)}`,
          }));
        } catch {
          items = [];
        }
      } else if (
        !prefix.includes(" ") ||
        prefix.startsWith('"') ||
        prefix.startsWith("'")
      ) {
        try {
          const root = projectRoot(completionContext?.cwd || process.cwd());
          for (const task of listTasks(root)) {
            const id = task.state.id;
            const value =
              id.includes(" ") ||
              commands.includes(id) ||
              prefix.startsWith("'") ||
              prefix.startsWith('"')
                ? `${prefix.startsWith("'") ? "'" : '"'}${id}${prefix.startsWith("'") ? "'" : '"'}`
                : id;
            items.push({ value, label: `${id} · ${taskProgress(task.state)}` });
          }
        } catch {
          /* Keep command completions. */
        }
      }
      const filtered = items.filter((item) => item.value.startsWith(prefix));
      return filtered.length ? filtered : null;
    },
    handler: async (rawArgs, ctx) => {
      try {
        const parsed = parseArguments(rawArgs);
        const requestedCommand =
          parsed.length === 0
            ? "list"
            : parsed[0] &&
                !parsed[0].quoted &&
                [
                  "help",
                  "list",
                  "delete",
                  "status",
                  "resume",
                  "next",
                  "accept",
                  "show",
                  "start",
                  "log",
                  "abort",
                ].includes(parsed[0].value)
              ? parsed[0].value
              : undefined;
        const command = requestedCommand;
        const args = parsed
          .slice(requestedCommand ? 1 : 0)
          .map((arg) => arg.value);
        if (command === "start")
          throw new Error(`Use /task TASK-ID instead of /task ${command}.`);
        if (command === "log" || command === "abort")
          throw new Error(
            "The task now uses normal Pi sessions. Use Pi's native progress and cancellation controls.",
          );
        if (command === "help") {
          if (args.length) throw new Error("Usage: /task help");
          await showArtifact(ctx, "Task help", HELP);
          return;
        }
        if (command === "resume") {
          if (args.length)
            throw new Error("Usage: /task resume (no task ID is needed).");
          await resumeFromCurrentProject(pi, ctx);
          return;
        }
        if (command === "list") {
          if (args.length) throw new Error("Usage: /task list");
          const root = projectRoot(ctx.cwd);
          const tasks = listTasks(root);
          if (ctx.mode === "tui" && tasks.length) {
            const options = tasks.map(
              ({ state }) =>
                `${state.id} · ${taskProgress(state)} · ${taskDescription(state)}`,
            );
            const selected = await ctx.ui.select("Continue task:", options);
            if (selected === undefined) return;
            const task = tasks[options.indexOf(selected)];
            if (task) await continueTaskSession(ctx, loadState(task.path));
            return;
          }
          const rows = tasks.map(
            ({ state }) =>
              `| \`${state.id}\` | ${taskProgress(state)} | ${taskDescription(state).replaceAll("|", "\\|")} |`,
          );
          await showArtifact(
            ctx,
            "Task list",
            tasks.length
              ? `# Tasks in ${root}\n\n| Task ID | State | Context |\n| --- | --- | --- |\n${rows.join("\n")}\n\nUse /task TASK-ID to continue.`
              : `# Tasks in ${root}\n\nNo tasks found. Start one with /task TASK-ID.`,
          );
          return;
        }
        if (command === "delete") {
          if (args.length > 1) throw new Error("Usage: /task delete [TASK-ID]");
          if (!ctx.isIdle())
            throw new Error(
              "Wait for Pi to finish or cancel its current run before deleting a task.",
            );
          const root = projectRoot(ctx.cwd);
          const tasks = listTasks(root);
          let target: DiscoveredTask | undefined;
          if (args.length) {
            validateTaskId(args[0]);
            target = tasks.find(({ state }) => state.id === args[0]);
            if (!target)
              throw new Error(
                `Task ${args[0]} was not found in ${root}. Use /task list to see available tasks.`,
              );
          } else {
            if (!tasks.length) {
              await showArtifact(
                ctx,
                "Task delete",
                `No tasks found in ${root}.`,
              );
              return;
            }
            if (ctx.mode !== "tui")
              throw new Error(
                "Choose a task in the terminal UI or specify /task delete TASK-ID.",
              );
            const options = tasks.map(
              ({ state }) =>
                `${state.id} · ${taskProgress(state)} · ${taskDescription(state)}`,
            );
            const selected = await ctx.ui.select("Delete task:", options);
            if (selected === undefined) return;
            target = tasks[options.indexOf(selected)];
          }
          if (!target) return;
          const targetPath = target.path;
          const state = loadState(targetPath);
          if (state.id !== target.state.id || state.projectRoot !== root)
            throw new Error(
              "Task changed while choosing it; run /task delete again.",
            );
          const directory = taskDirectoryForDeletion(state, targetPath);
          const confirmed = await ctx.ui.confirm(
            `Permanently delete task ${state.id}?`,
            `Delete ${directory} and all its artifacts and saved sessions? This cannot be undone.`,
          );
          if (!confirmed) return;
          const latest = loadState(targetPath);
          if (
            latest.id !== state.id ||
            latest.projectRoot !== root ||
            resolve(taskDir(latest)) !== directory
          )
            throw new Error(
              "Task changed before deletion; run /task delete again.",
            );
          const current = ctx.sessionManager.getSessionFile();
          const link = taskLink(ctx);
          const active =
            (current && pathWithin(directory, resolve(current))) ||
            (link?.id === state.id && link.statePath === targetPath);
          if (active) {
            const neutral = createNeutralSession(root);
            if (pathWithin(directory, resolve(neutral)))
              throw new Error(
                "The replacement session would be inside the task directory; deletion was cancelled.",
              );
            const result = await ctx.switchSession(neutral, {
              withSession: async (fresh) => {
                try {
                  deleteTaskFiles(loadState(targetPath), targetPath);
                  fresh.ui.notify(
                    `Task ${state.id} was permanently deleted.`,
                    "info",
                  );
                } catch (error) {
                  fresh.ui.notify(
                    error instanceof Error ? error.message : String(error),
                    "error",
                  );
                }
              },
            });
            if (result.cancelled)
              ctx.ui.notify(
                "Deletion was cancelled; the task is unchanged.",
                "warning",
              );
          } else {
            deleteTaskFiles(latest, targetPath);
            ctx.ui.notify(`Task ${state.id} was permanently deleted.`, "info");
          }
          return;
        }
        if (!command) {
          const optionAt = args.indexOf("--dir");
          let override: string | undefined;
          if (optionAt >= 0) {
            override = args[optionAt + 1];
            if (!override || optionAt !== args.length - 2)
              throw new Error("Usage: /task TASK-ID [--dir PATH]");
            args.splice(optionAt, 2);
          }
          if (args.length !== 1 || !args[0] || args[0].startsWith("--"))
            throw new Error(
              "A task ID is required. Usage: /task TASK-ID [--dir PATH]",
            );
          const root = projectRoot(ctx.cwd);
          const id = args[0];
          validateTaskId(id);
          const artifactDir = parseArtifactDir(root, id, override);
          let path = statePath(artifactDir);
          if (!existsSync(path) && !override) {
            const fallback = statePath(defaultArtifactDir(root, id));
            if (existsSync(fallback)) path = fallback;
            else
              path =
                listTasks(root).find((task) => task.state.id === id)?.path ||
                path;
          }
          if (existsSync(path)) {
            const state = loadState(path);
            if (state.id !== id)
              throw new Error(
                `Task ID mismatch in ${path}: requested ${id}, but state.json contains ${state.id}.`,
              );
            if (state.projectRoot !== root)
              throw new Error(projectMismatchMessage(state, root, path));
            if (
              ctx.mode === "tui" &&
              !(await ctx.ui.confirm(
                `Continue task ${id}?`,
                `Open its current ${state.phase} session?`,
              ))
            )
              return;
            await continueTaskSession(ctx, state);
            return;
          }
          if (existsSync(artifactDir))
            throw new Error(
              `Artifact directory already exists without task state: ${artifactDir}`,
            );
          if (
            ctx.mode === "tui" &&
            !(await ctx.ui.confirm(
              `Start task ${id}?`,
              `Create ${artifactDir} and a context session?`,
            ))
          )
            return;
          mkdirSync(artifactDir, { recursive: true });
          const contextPath = join(artifactDir, "context.md");
          writeFileSync(contextPath, `# ${id}\n`, "utf8");
          const state: TaskState = {
            version: 1,
            id,
            projectRoot: root,
            artifactDir,
            contextPath,
            phase: "collect",
            currentStep: 1,
            completedSteps: [],
            sessions: {},
          };
          const file = createPhaseSession(
            state,
            "collect",
            1,
            ctx.sessionManager.getSessionFile(),
          );
          setSessionFor(state, "collect", file);
          saveState(state);
          try {
            rememberTask(state, statePath(artifactDir));
          } catch {
            ctx.ui.notify(
              "Task started, but its discovery index could not be updated.",
              "warning",
            );
          }
          const result = await ctx.switchSession(file, {
            withSession: async (fresh) => {
              fresh.ui.notify(
                `Task ${id} started. Describe the problem and add context.`,
                "info",
              );
            },
          });
          if (result.cancelled)
            ctx.ui.notify(
              `Task created at ${artifactDir}; use /task ${id} to open it.`,
              "warning",
            );
          return;
        }
        const state = requireTask(ctx);
        if (command === "status") {
          if (args.length) throw new Error("Usage: /task status");
          const config = readConfig();
          const model = configuredModel(state.phase);
          await showArtifact(
            ctx,
            "Task status",
            `Task: ${state.id}\nPhase: ${state.phase}\nCurrent step: ${state.currentStep}\nActive session: ${sessionFor(state) || "none"}\nThis session: ${ctx.sessionManager.getSessionFile() || "ephemeral"}\nSessions directory: ${sessionDirectory(state)}\nArtifacts: ${taskDir(state)}\nGit repository: ${hasGitRepository(state) ? "yes" : "no"}\nCompleted steps: ${state.completedSteps.join(", ") || "none"}\nAwaiting review: ${state.awaitingReview || "none"}\nOpen review findings: ${state.phase === "review" && !state.reviewPending && existsSync(reviewPath(state, state.currentStep)) ? openReviewFindings(state, state.currentStep) : state.reviewPending ? "review artifact pending" : "none"}\nCommit result: ${state.phase === "commit" ? (state.commitReady ? "ready" : "pending") : "none"}\nPending commit files: ${state.commitPendingFiles?.join(", ") || (state.phase === "commit" ? state.pendingFiles?.join(", ") : undefined) || "none"}\nResearch skill: ${configuredPhaseSkill(config, "research") || "none"}\nRoadmap skill: ${configuredPhaseSkill(config, "roadmap") || "none"}\nStep skill: ${configuredPhaseSkill(config, "steps") || "none"}\nReview skill: ${reviewSkillName(config)}\nAuto-commit: ${config.autoCommit === true ? "on" : "off"}\n/tree: ${config.allowTreeNavigation === true ? "allowed" : "blocked"}\nPhase model: ${model ? `${model.provider}/${model.model}` : "Inherited Pi model"}\nSnapshot limits: ${config.snapshotMaxFiles ?? DEFAULT_SNAPSHOT_MAX_FILES} files, ${config.snapshotMaxMiB ?? DEFAULT_SNAPSHOT_MAX_MIB} MiB`,
          );
          return;
        }
        if (command === "show") {
          if (args.length > 1) throw new Error("Usage: /task show [FILE.md]");
          const files = markdownArtifacts(state);
          if (!files.length) {
            await showArtifact(
              ctx,
              "Task artifacts",
              "No Markdown artifacts found.",
            );
            return;
          }
          const name =
            args[0] ||
            (ctx.mode === "tui"
              ? await ctx.ui.select("Show task artifact:", files)
              : undefined);
          if (!name) {
            if (ctx.mode !== "tui")
              await showArtifact(
                ctx,
                "Task artifacts",
                files.map((file) => `- ${file}`).join("\n"),
              );
            return;
          }
          if (!files.includes(name))
            throw new Error(
              `Markdown artifact ${name} was not found. Use /task show to choose an available file.`,
            );
          const path = join(taskDir(state), name);
          if (!lstatSync(path).isFile())
            throw new Error(`Artifact is no longer a regular file: ${path}`);
          await showArtifact(ctx, name, readFileSync(path, "utf8"));
          return;
        }
        if (command === "next" || command === "accept") {
          if (!sessionMatches(ctx, state))
            throw new Error(
              `This is not the active task session. Use /task ${state.id} to continue ${state.phase}.`,
            );
          if (state.phase === "complete")
            throw new Error("All planned steps are complete.");
          if (command === "next" && args.length)
            throw new Error(
              "/task next does not accept approval text. Use /task accept [NOTE].",
            );
          const note = args.join(" ").trim();
          if (note.length > 4000)
            throw new Error(
              "Approval note is too long; keep it under 4000 characters.",
            );
          if (state.phase === "implement" && !state.implementationStarted) {
            await beginImplementation(pi, ctx, state);
            return;
          }
          const reviewStep = state.awaitingReview || state.currentStep;
          if (
            state.phase === "review" &&
            (state.reviewPending || !existsSync(reviewPath(state, reviewStep)))
          )
            throw new Error(
              `The review is incomplete. Run /task resume to continue and save ${reviewPath(state, reviewStep)} before advancing.`,
            );
          if (state.phase === "commit") {
            if (command === "accept" && note)
              throw new Error(
                "The commit phase does not accept approval notes. Use /task next when ready to continue.",
              );
            await finishCommitPhase(pi, ctx, state);
            return;
          }
          const assessment = await assessTransition(ctx, state, command, note);
          if (assessment.openQuestions.length)
            throw new Error(
              `The phase is unchanged. Resolve these open questions first: ${assessment.openQuestions.join("; ")}`,
            );
          if (command === "next" && assessment.pendingProposal.trim())
            throw new Error(
              `The phase is unchanged. A proposal still needs approval: ${assessment.pendingProposal}. Use /task accept if you agree.`,
            );
          const approval =
            command === "accept"
              ? [
                  assessment.pendingProposal.trim(),
                  note
                    ? `User clarification: ${note.replace(/\s+/g, " ")}`
                    : "",
                ]
                  .filter(Boolean)
                  .join("; ")
              : "";
          if (state.phase === "collect") {
            await enterResearch(pi, ctx, state);
            return;
          }
          if (state.phase === "research") {
            await finalizeArtifact(ctx, state, "context", approval);
            await switchPhase(
              ctx,
              state,
              "roadmap",
              1,
              phaseKickoff(state, "roadmap", 1),
            );
            return;
          }
          if (state.phase === "roadmap") {
            await finalizeArtifact(ctx, state, "roadmap", approval);
            stepCount(state);
            await switchPhase(
              ctx,
              state,
              "steps",
              1,
              phaseKickoff(state, "steps", 1),
            );
            return;
          }
          if (state.phase === "steps") {
            await finalizeArtifact(ctx, state, "step", approval);
            const n = state.currentStep;
            if (n < stepCount(state))
              await switchPhase(
                ctx,
                state,
                "steps",
                n + 1,
                phaseKickoff(state, "steps", n + 1),
              );
            else {
              state.implementationStarted = false;
              await switchPhase(
                ctx,
                state,
                "implement",
                1,
                phaseKickoff(state, "implement", 1),
              );
            }
            return;
          }
          if (state.phase === "implement") {
            await beginReview(ctx, state);
            return;
          }
          if (state.phase === "review") {
            await acceptReviewedStep(ctx, state, approval);
            return;
          }
        }
        throw new Error(`Unknown subcommand: ${command}. Use /task help.`);
      } catch (error) {
        ctx.ui.notify(
          error instanceof Error ? error.message : String(error),
          "error",
        );
      }
    },
  });
}
