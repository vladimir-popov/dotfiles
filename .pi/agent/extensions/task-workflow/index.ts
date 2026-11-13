import { execFileSync } from "node:child_process";
import {
  constants as fsConstants,
  cpSync,
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
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
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
  parseColor,
  Text,
  matchesKey,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";
const CURRENT_STRUCTURE_VERSION = "3.0";

type Phase =
  "research" | "roadmap" | "implement" | "review" | "commit" | "complete";
type SessionRefs = {
  research?: string;
  roadmap?: string;
  implement?: Record<string, string>;
  review?: Record<string, string[]>;
  commit?: Record<string, string>;
};
type TaskState = {
  version: 1;
  structureVersion: string;
  id: string;
  projectRoot: string;
  contextPath: string;
  phase: Phase;
  currentStep: number;
  completedSteps: number[];
  awaitingReview?: number;
  pendingFiles?: string[];
  pendingHashes?: Record<string, string | null>;
  pendingSummary?: string;
  pendingAutoCommitEligible?: boolean;
  workflowMode?: "manual" | "semi-auto";
  autoCommit?: boolean;
  configOverrides?: Config;
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
type SkillPhase = "research" | "roadmap" | "implement" | "review" | "commit";
type Config = {
  mode?: "manual" | "semi-auto";
  autoCommit?: boolean;
  phaseModels?: Partial<
    Record<"research" | "roadmap" | "implement" | "review", PhaseModel | null>
  >;
  skills?: Partial<Record<SkillPhase, string | null>>;
  reviewTools?: string[];
  allowTreeNavigation?: boolean;
  snapshotMaxFiles?: number;
  snapshotMaxMiB?: number;
  hotkeys?: Record<string, string | null>;
  statusColors?: Partial<
    Record<
      "taskName" | "currentSettings" | "currentPhase" | "phaseDescription",
      string | number
    >
  >;
};

const ENTRY_TYPE = "task-workflow-link";
const ARTIFACT_TOOL = "task_write_artifact";
const ARTIFACT_LANGUAGE_RULE =
  "Use the user's language for normal conversation, including explanations, questions, and review discussion. Do not switch chat replies to English because the artifacts are English. Write only task artifact content in English, regardless of the language used in the conversation or source ticket. This includes artifact headings, summaries, decisions, roadmap items, step designs, and review findings. Translate or condense non-English discussion into English when writing an artifact rather than copying it. Preserve exact code, identifiers, paths, and required verbatim diff excerpts.";
const KICKOFF_TYPE = "task-workflow-kickoff";
const PHASE_WIDGET = "task-workflow-phase";
const READ_TOOLS = ["read", "grep", "find", "ls"];
const RESEARCH_WEB_TOOL_PATTERN = /web|browser|internet|search|fetch|url/i;
const RESEARCH_MUTATION_TOOL_PATTERN =
  /write|edit|delete|remove|submit|click|post|put|patch|execute|run|shell|bash/i;

function researchAllowedTools(pi: ExtensionAPI): string[] {
  const tools = pi.getAllTools();
  const availableNames = new Set(tools.map((tool) => tool.name));
  const readTools = READ_TOOLS.filter((name) => availableNames.has(name));
  const webTools = tools
    .filter(
      (tool) =>
        tool.exposure !== "hidden" &&
        tool.exposure !== "deferred" &&
        tool.exposure !== "codemode" &&
        RESEARCH_WEB_TOOL_PATTERN.test(tool.name) &&
        !RESEARCH_MUTATION_TOOL_PATTERN.test(tool.name) &&
        tool.annotations?.readOnlyHint !== false,
    )
    .map((tool) => tool.name);
  return [...new Set([...readTools, ...webTools, ARTIFACT_TOOL])];
}
const DEFAULT_SNAPSHOT_MAX_FILES = 4_000;
const DEFAULT_SNAPSHOT_MAX_MIB = 100;
const DEFAULT_HOTKEYS: Record<string, string> = {
  next: "alt+n",
  accept: "alt+a",
  status: "alt+s",
  show: "alt+w",
};
const HELP = `Task workflow

/task TASK-ID              Start or continue a task after confirmation
/task or /task list         Select a task to continue
/task delete [TASK-ID]      Permanently delete a task after confirmation
/task status                Show task state, current session, and artifact paths
/task config                Show effective settings for the current task
/task config init project   Create project config with current effective settings
/task config init task      Save current effective settings as task overrides
/task resume                Return to an active task; resume an interrupted run
/task next                  Advance the current phase when it is ready
/task accept [NOTE]         Agree to pending proposals and advance; otherwise act like /task next
/task skip-commit           Explicitly skip the current commit phase
/task show [FILE.md]        Select or view an existing Markdown artifact without adding it to the session
/task help                  Show this help

Default hotkeys: Alt+N = next, Alt+A = accept, Alt+S = status, Alt+W = show.
Configure or disable them with hotkeys in task-workflow.json; use /hotkeys to inspect active bindings.

Quote an ID containing spaces, for example: /task "TASK 100500".
Starting or opening a specific task requires an explicit ID.
/task delete removes its artifact directory and saved sessions; code outside it remains.
Research gathers task context and investigates the code in one saved Pi session. Later phases use their own sessions.
Each implementation session begins with final discussion of its current step; /task next finalizes that step and starts coding in the same session.
The implementation session stays open for the step and is reused for repairs.
Each review round uses a fresh read-only session. Reports use review-N-round-M.md, starting at round 0.
Step status in step-N.md is planned, in_progress, or completed.
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
Task data uses the fixed path <project>/.agents/task-workflow/<task-id>/, with artifacts under context/.
Global settings live in ~/.pi/agent/task-workflow.json. Project settings live in
<project>/.agents/task-workflow/config.json; task overrides live in that task's
state.json. Resolution order is task, project, global, then defaults.
Use /task config init project|task to create/materialize the scoped settings;
edit the resulting files to change values. Project initialization refuses to
overwrite an existing config. Project and task initialization materialize the current effective settings at that scope.
Settings resolve from task, project, global, then defaults; nested phase maps resolve by key, while lists and scalar values are replaced by the more local scope. Task files are fixed under
.agents/task-workflow/<task-id>/context/ and state/sessions under the task directory.
mode defaults to manual; autoCommit defaults to false.
Global settings live in task-workflow.json; project settings live in .agents/task-workflow/config.json; task overrides live in state.json.
Set global statusColors keys taskName, currentSettings, currentPhase, and phaseDescription to ANSI color names
(black, red, green, yellow, blue, purple, cyan, white, or bright-prefixed variants), palette indices 0-255,
or hex colors such as #RRGGBB. Defaults: brightGreen, brightBlack, blue, blue. Example:
{"statusColors":{"taskName":"brightGreen","currentSettings":"brightBlack","currentPhase":"blue","phaseDescription":"blue"}}.`;
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

function defaultRuntimeDir(root: string, id: string): string {
  return join(root, ".agents", "task-workflow", id);
}
function defaultArtifactDir(root: string, id: string): string {
  return join(defaultRuntimeDir(root, id), "context");
}
function taskDir(state: TaskState): string {
  return defaultArtifactDir(state.projectRoot, state.id);
}
function runtimeDir(state: TaskState): string {
  return defaultRuntimeDir(state.projectRoot, state.id);
}
function taskStatePath(state: TaskState): string {
  return statePath(runtimeDir(state));
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

const ANSI_STATUS_COLORS: Record<string, number> = {
  black: 0,
  red: 1,
  green: 2,
  yellow: 3,
  blue: 4,
  purple: 5,
  cyan: 6,
  white: 7,
  brightBlack: 8,
  brightRed: 9,
  brightGreen: 10,
  brightYellow: 11,
  brightBlue: 12,
  brightPurple: 13,
  brightCyan: 14,
  brightWhite: 15,
};

function parseStatusColor(value: string | number) {
  if (typeof value === "string" && value in ANSI_STATUS_COLORS)
    return parseColor(ANSI_STATUS_COLORS[value]);
  return parseColor(value);
}

function validateConfig(config: unknown, path: string): Config {
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error(`Invalid config: ${path}`);
  const values = config as Record<string, unknown>;
  if (
    values.mode !== undefined &&
    !["manual", "semi-auto"].includes(String(values.mode))
  )
    throw new Error(`mode must be manual or semi-auto: ${path}`);
  if (values.autoCommit !== undefined && typeof values.autoCommit !== "boolean")
    throw new Error(`autoCommit must be a boolean: ${path}`);
  if (values.statusColors !== undefined) {
    if (
      !values.statusColors ||
      typeof values.statusColors !== "object" ||
      Array.isArray(values.statusColors)
    )
      throw new Error(`statusColors must be an object: ${path}`);
    const colors = values.statusColors as Record<string, unknown>;
    for (const [name, color] of Object.entries(colors)) {
      if (
        ![
          "taskName",
          "currentSettings",
          "currentPhase",
          "phaseDescription",
        ].includes(name)
      )
        throw new Error(`Unknown statusColors key ${name}: ${path}`);
      if (
        typeof color !== "string" &&
        (typeof color !== "number" ||
          !Number.isInteger(color) ||
          color < 0 ||
          color > 255)
      )
        throw new Error(`Invalid statusColors.${name}: ${path}`);
      try {
        parseStatusColor(color as string | number);
      } catch {
        throw new Error(`Invalid statusColors.${name}: ${path}`);
      }
    }
  }
  return values as Config;
}

function projectConfigPath(root: string): string {
  return join(root, ".agents", "task-workflow", "config.json");
}

function readProjectConfig(root: string): Config {
  const path = projectConfigPath(root);
  if (!existsSync(path)) return {};
  const config = validateConfig(JSON.parse(readFileSync(path, "utf8")), path);
  return config;
}

function effectiveConfig(state: TaskState): Config {
  const global = readConfig();
  const project = readProjectConfig(state.projectRoot);
  const task = {
    ...state.configOverrides,
    ...(state.workflowMode !== undefined ? { mode: state.workflowMode } : {}),
    ...(state.autoCommit !== undefined ? { autoCommit: state.autoCommit } : {}),
  };
  return {
    ...global,
    ...project,
    ...task,
    phaseModels: {
      ...global.phaseModels,
      ...project.phaseModels,
      ...task.phaseModels,
    },
    skills: { ...global.skills, ...project.skills, ...task.skills },
    hotkeys: { ...global.hotkeys, ...project.hotkeys, ...task.hotkeys },
    statusColors: {
      ...global.statusColors,
      ...project.statusColors,
      ...task.statusColors,
    },
  };
}

function materializedConfig(config: Config): Config {
  return {
    ...config,
    mode: config.mode ?? "manual",
    autoCommit: config.autoCommit ?? false,
    phaseModels: config.phaseModels ?? {},
    skills: {
      research: config.skills?.research ?? null,
      roadmap: config.skills?.roadmap ?? null,
      implement: config.skills?.implement ?? null,
      review: config.skills?.review ?? null,
      commit: config.skills?.commit ?? null,
    },
    reviewTools: config.reviewTools ?? [],
    allowTreeNavigation: config.allowTreeNavigation ?? false,
    hotkeys: { ...DEFAULT_HOTKEYS, ...config.hotkeys },
    statusColors: {
      taskName: config.statusColors?.taskName ?? "brightGreen",
      currentSettings: config.statusColors?.currentSettings ?? "brightBlack",
      currentPhase: config.statusColors?.currentPhase ?? "blue",
      phaseDescription: config.statusColors?.phaseDescription ?? "blue",
    },
    snapshotMaxFiles: config.snapshotMaxFiles ?? DEFAULT_SNAPSHOT_MAX_FILES,
    snapshotMaxMiB: config.snapshotMaxMiB ?? DEFAULT_SNAPSHOT_MAX_MIB,
  };
}

function effectiveSetting<K extends "mode" | "autoCommit">(
  state: TaskState,
  key: K,
): K extends "mode" ? "manual" | "semi-auto" : boolean {
  const legacy = key === "mode" ? state.workflowMode : state.autoCommit;
  const fallback = key === "mode" ? "manual" : false;
  return (legacy ?? effectiveConfig(state)[key] ?? fallback) as K extends "mode"
    ? "manual" | "semi-auto"
    : boolean;
}

function readConfig(): Config {
  const path = join(
    process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"),
    "task-workflow.json",
  );
  if (!existsSync(path)) return {};
  const validated = validateConfig(
    JSON.parse(readFileSync(path, "utf8")),
    path,
  );
  const values = validated as Record<string, unknown>;
  if (values.implementModel !== undefined || values.reviewModel !== undefined)
    throw new Error(
      `Move implementModel and reviewModel to phaseModels.implement and phaseModels.review in ${path}.`,
    );
  if (values.autoCommit !== undefined && typeof values.autoCommit !== "boolean")
    throw new Error(`autoCommit must be a boolean: ${path}`);
  if (
    values.allowTreeNavigation !== undefined &&
    typeof values.allowTreeNavigation !== "boolean"
  )
    throw new Error(`allowTreeNavigation must be a boolean: ${path}`);
  if (values.skills !== undefined) {
    if (
      !values.skills ||
      typeof values.skills !== "object" ||
      Array.isArray(values.skills)
    )
      throw new Error(`skills must be an object: ${path}`);
    for (const [phase, skill] of Object.entries(values.skills)) {
      if (
        !(
          ["research", "roadmap", "implement", "review", "commit"] as string[]
        ).includes(phase)
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
      if (!["research", "roadmap", "implement", "review"].includes(phase))
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
  return config.skills?.[phase];
}

function reviewSkillName(config: Config): string {
  const skill = configuredPhaseSkill(config, "review");
  return skill ?? "(disabled)";
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

function parsePathTemplate(root: string, id: string, template: string): string {
  const expanded = template
    .replaceAll("{projectRoot}", root)
    .replaceAll("{taskId}", id);
  return isAbsolute(expanded) ? resolve(expanded) : resolve(root, expanded);
}

function parseArtifactDir(root: string, id: string): string {
  return defaultArtifactDir(root, id);
}

function parseRuntimeDir(root: string, id: string): string {
  return defaultRuntimeDir(root, id);
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

function checkStructureVersion(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  const data = JSON.parse(readFileSync(path, "utf8")) as TaskState;
  const detected: unknown = data.structureVersion;
  if (detected !== CURRENT_STRUCTURE_VERSION)
    return `Task ${data.id} uses an unsupported structure version: ${JSON.stringify(detected)}.`;
  const expectedContext = join(
    defaultArtifactDir(data.projectRoot, data.id),
    "context.md",
  );
  if (resolve(data.contextPath) !== resolve(expectedContext))
    return `Task ${data.id} contextPath must be ${expectedContext}.`;
  return undefined;
}

function loadState(path: string, maintainLegacyFiles = true): TaskState {
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
  if (data.configOverrides !== undefined)
    data.configOverrides = validateConfig(data.configOverrides, path);
  if (data.structureVersion !== CURRENT_STRUCTURE_VERSION)
    throw new Error(
      `Task structure version must be ${CURRENT_STRUCTURE_VERSION}: ${path}`,
    );
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
    "After moving the project directory, close and restart Pi from the new project path. In the terminal UI, /task can offer a confirmed relocation if the saved root no longer exists. Do not update only projectRoot manually; saved session paths and the task index also need migration.",
  ];
  if (state.pendingBaselineDir)
    lines.push(
      "This task has an unfinished implementation or review. The relocation confirmation rebases its baseline and session paths together; if the task is not offered for relocation, do not edit projectRoot manually because those paths may no longer be valid.",
    );
  return lines.join("\n");
}

type SessionSwitchOptions = NonNullable<
  Parameters<ExtensionCommandContext["switchSession"]>[1]
>;
type ReplacedContext = Parameters<
  NonNullable<SessionSwitchOptions["withSession"]>
>[0];

type DiscoveredTask = {
  state: TaskState;
  path: string;
  relocatedFrom?: string;
};

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

function relocatedIndexedStatePaths(root: string): string[] {
  const directory = taskIndexDir();
  if (!existsSync(directory)) return [];
  const paths: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    try {
      const record = JSON.parse(
        readFileSync(join(directory, entry.name), "utf8"),
      ) as { projectRoot?: unknown; statePath?: unknown };
      if (
        typeof record.projectRoot !== "string" ||
        typeof record.statePath !== "string"
      )
        continue;
      const oldRoot = resolve(record.projectRoot);
      if (
        oldRoot === resolve(root) ||
        existsSync(oldRoot) ||
        !pathWithin(oldRoot, resolve(record.statePath))
      )
        continue;
      const movedPath = resolve(
        root,
        relative(oldRoot, resolve(record.statePath)),
      );
      if (existsSync(movedPath)) paths.push(movedPath);
    } catch {
      /* Ignore stale or malformed index entries. */
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

function relocatedProjectRoot(
  state: TaskState,
  path: string,
  currentRoot: string,
): string | undefined {
  const previousRoot = resolve(state.projectRoot);
  const root = resolve(currentRoot);
  if (
    previousRoot === root ||
    existsSync(previousRoot) ||
    !pathWithin(previousRoot, resolve(taskDir(state))) ||
    !pathWithin(previousRoot, resolve(runtimeDir(state)))
  )
    return undefined;
  const movedRuntimeDir = resolve(
    root,
    relative(previousRoot, resolve(runtimeDir(state))),
  );
  if (
    resolve(path) !== resolve(statePath(movedRuntimeDir)) ||
    !pathWithin(root, resolve(path))
  )
    return undefined;
  return previousRoot;
}

function listTasks(root: string): DiscoveredTask[] {
  readConfig();
  const candidates = [
    ...templateStatePaths(root, ".agents/task-workflow/{taskId}"),
    ...indexedStatePaths(root),
    ...relocatedIndexedStatePaths(root),
  ];
  const tasks = new Map<string, DiscoveredTask>();
  for (const path of candidates) {
    try {
      if (!lstatSync(path).isFile()) continue;
      const state = loadState(path, false);
      const currentStatePath = existsSync(taskStatePath(state))
        ? taskStatePath(state)
        : path;
      const task: DiscoveredTask = { state, path: currentStatePath };
      if (resolve(state.projectRoot) !== resolve(root)) {
        const previousRoot = relocatedProjectRoot(
          state,
          currentStatePath,
          root,
        );
        if (!previousRoot) continue;
        task.relocatedFrom = previousRoot;
      } else if (resolve(taskStatePath(state)) !== resolve(currentStatePath)) {
        continue;
      }
      const existing = tasks.get(state.id);
      if (!existing || existing.relocatedFrom) tasks.set(state.id, task);
    } catch {
      /* Ignore missing or invalid state files. */
    }
  }
  return [...tasks.values()].sort((a, b) =>
    a.state.id.localeCompare(b.state.id),
  );
}

function rebaseMovedPath(
  path: string,
  oldRoot: string,
  newRoot: string,
): string {
  if (!isAbsolute(path)) return path;
  const absolute = resolve(path);
  return pathWithin(oldRoot, absolute)
    ? resolve(newRoot, relative(oldRoot, absolute))
    : path;
}

function rebaseSessionRefs(
  sessions: SessionRefs | undefined,
  oldRoot: string,
  newRoot: string,
): SessionRefs | undefined {
  if (!sessions) return undefined;
  const rebaseMap = (paths?: Record<string, string>) =>
    paths
      ? Object.fromEntries(
          Object.entries(paths).map(([key, path]) => [
            key,
            rebaseMovedPath(path, oldRoot, newRoot),
          ]),
        )
      : undefined;
  return {
    research: sessions.research
      ? rebaseMovedPath(sessions.research, oldRoot, newRoot)
      : undefined,
    roadmap: sessions.roadmap
      ? rebaseMovedPath(sessions.roadmap, oldRoot, newRoot)
      : undefined,
    implement: rebaseMap(sessions.implement),
    review: sessions.review
      ? Object.fromEntries(
          Object.entries(sessions.review).map(([key, paths]) => [
            key,
            paths.map((path) => rebaseMovedPath(path, oldRoot, newRoot)),
          ]),
        )
      : undefined,
    commit: rebaseMap(sessions.commit),
  };
}

function rewriteMigrationSessionFile(
  file: string,
  taskId: string,
  newStatePath: string,
): string {
  const original = readFileSync(file, "utf8");
  let hasHeader = false;
  let taskLinks = 0;
  let latestTaskLinkId: string | undefined;
  const lines = original.split("\n").map((line) => {
    if (!line) return line;
    let entry: Record<string, any>;
    try {
      entry = JSON.parse(line) as Record<string, any>;
    } catch {
      throw new Error(`Cannot safely migrate malformed Pi session: ${file}`);
    }
    if (entry.type === "session") hasHeader = true;
    if (entry.type === "custom" && entry.customType === ENTRY_TYPE) {
      if (!entry.data || typeof entry.data.id !== "string")
        throw new Error(
          `Cannot safely migrate malformed task association: ${file}`,
        );
      latestTaskLinkId = entry.data.id;
      if (entry.data.id === taskId) {
        entry.data.statePath = newStatePath;
        taskLinks++;
      }
    }
    return JSON.stringify(entry);
  });
  if (!hasHeader)
    throw new Error(
      `Cannot safely migrate Pi session without a header: ${file}`,
    );
  if (!taskLinks || latestTaskLinkId !== taskId)
    throw new Error(
      `Cannot safely migrate Pi session without its current task association: ${file}`,
    );
  return lines.join("\n");
}

function relocateSessionFile(
  file: string,
  taskId: string,
  oldRoot: string,
  newRoot: string,
  newStatePath: string,
  relocationNote: string,
): string {
  const original = readFileSync(file, "utf8");
  const lines = original.split("\n");
  let hasHeader = false;
  let hasTaskLink = false;
  let lastEntryId = "";
  const ids = new Set<string>();
  const rewritten = lines.map((line) => {
    if (!line) return line;
    let entry: Record<string, any>;
    try {
      entry = JSON.parse(line) as Record<string, any>;
    } catch {
      throw new Error(`Cannot safely relocate malformed Pi session: ${file}`);
    }
    if (typeof entry.id === "string") {
      ids.add(entry.id);
      lastEntryId = entry.id;
    }
    if (entry.type === "session") {
      hasHeader = true;
      if (typeof entry.cwd === "string")
        entry.cwd = rebaseMovedPath(entry.cwd, oldRoot, newRoot);
      if (typeof entry.parentSession === "string")
        entry.parentSession = rebaseMovedPath(
          entry.parentSession,
          oldRoot,
          newRoot,
        );
    } else if (
      entry.type === "custom" &&
      entry.customType === ENTRY_TYPE &&
      entry.data?.id === taskId
    ) {
      hasTaskLink = true;
      entry.data.statePath = newStatePath;
    }
    return JSON.stringify(entry);
  });
  if (!hasHeader)
    throw new Error(
      `Cannot safely relocate Pi session without a header: ${file}`,
    );
  const hadTrailingNewline = original.endsWith("\n");
  if (hadTrailingNewline && rewritten.at(-1) === "") rewritten.pop();
  if (hasTaskLink) {
    let id = randomUUID().slice(0, 8);
    while (ids.has(id)) id = randomUUID().slice(0, 8);
    rewritten.push(
      JSON.stringify({
        type: "custom_message",
        customType: KICKOFF_TYPE,
        content: relocationNote,
        display: false,
        id,
        parentId: lastEntryId || undefined,
        timestamp: new Date().toISOString(),
      }),
    );
  }
  if (hadTrailingNewline) rewritten.push("");
  return rewritten.join("\n");
}

function atomicWriteTextFiles(updates: Map<string, string>): void {
  const staged: Array<{
    path: string;
    temporary: string;
    original: string | undefined;
    mode: number;
  }> = [];
  const committed: typeof staged = [];
  try {
    for (const [path, content] of updates) {
      let original: string | undefined;
      let mode = 0o600;
      if (existsSync(path)) {
        const info = lstatSync(path);
        if (!info.isFile() || info.isSymbolicLink())
          throw new Error(
            `Refusing to replace a non-regular relocation target: ${path}`,
          );
        original = readFileSync(path, "utf8");
        mode = info.mode & 0o777;
      }
      const temporary = join(
        dirname(path),
        `.task-relocate-${randomUUID()}.tmp`,
      );
      writeFileSync(temporary, content, {
        encoding: "utf8",
        flag: "wx",
        mode,
      });
      staged.push({ path, temporary, original, mode });
    }
    for (const item of staged) {
      renameSync(item.temporary, item.path);
      committed.push(item);
    }
  } catch (error) {
    let rollbackError: unknown;
    for (const item of committed.reverse()) {
      try {
        if (item.original === undefined) {
          rmSync(item.path, { force: true });
        } else {
          const restore = join(
            dirname(item.path),
            `.task-relocate-rollback-${randomUUID()}.tmp`,
          );
          writeFileSync(restore, item.original, {
            encoding: "utf8",
            flag: "wx",
            mode: item.mode,
          });
          renameSync(restore, item.path);
        }
      } catch (failure) {
        rollbackError ??= failure;
      }
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      rollbackError
        ? `Task relocation failed (${detail}) and rollback was incomplete (${String(rollbackError)}). Do not continue this task until its files are checked.`
        : `Task relocation failed and was rolled back: ${detail}`,
    );
  } finally {
    for (const item of staged)
      if (existsSync(item.temporary)) rmSync(item.temporary, { force: true });
  }
}

function taskIndexPath(root: string, id: string): string {
  return join(
    taskIndexDir(),
    `${createHash("sha256").update(`${root}\0${id}`).digest("hex")}.json`,
  );
}

function relocateTask(
  discovered: DiscoveredTask,
  currentRoot: string,
  relocationNote: string,
): TaskState {
  const state = loadState(discovered.path);
  const oldRoot = resolve(discovered.relocatedFrom || state.projectRoot);
  const newRoot = resolve(currentRoot);
  if (
    !discovered.relocatedFrom ||
    oldRoot !== resolve(state.projectRoot) ||
    existsSync(oldRoot) ||
    !pathWithin(oldRoot, resolve(taskDir(state))) ||
    !pathWithin(oldRoot, resolve(runtimeDir(state)))
  )
    throw new Error(
      "The task no longer matches the detected project relocation.",
    );
  const artifactDir = resolve(
    newRoot,
    relative(oldRoot, resolve(taskDir(state))),
  );
  const runtimeDirectory = resolve(
    newRoot,
    relative(oldRoot, resolve(runtimeDir(state))),
  );
  const targetStatePath = statePath(runtimeDirectory);
  if (
    resolve(discovered.path) !== resolve(statePath(runtimeDir(state))) ||
    !pathWithin(newRoot, resolve(discovered.path))
  )
    throw new Error(
      "The task artifact directory is not inside the renamed project.",
    );
  const artifactInfo = lstatSync(artifactDir);
  const runtimeInfo = lstatSync(runtimeDirectory);
  if (
    !artifactInfo.isDirectory() ||
    artifactInfo.isSymbolicLink() ||
    !runtimeInfo.isDirectory() ||
    runtimeInfo.isSymbolicLink()
  )
    throw new Error(
      `Cannot safely relocate linked task directories: ${artifactDir}, ${runtimeDirectory}`,
    );
  if (
    !pathWithin(realpathSync(newRoot), realpathSync(artifactDir)) ||
    !lstatSync(discovered.path).isFile() ||
    lstatSync(discovered.path).isSymbolicLink()
  )
    throw new Error(
      "The task state is not a regular file inside the renamed project.",
    );

  const relocated: TaskState = {
    ...state,
    projectRoot: newRoot,
    contextPath: rebaseMovedPath(state.contextPath, oldRoot, newRoot),
    sessions: rebaseSessionRefs(state.sessions, oldRoot, newRoot),
    pendingBaselineDir: state.pendingBaselineDir
      ? rebaseMovedPath(state.pendingBaselineDir, oldRoot, newRoot)
      : undefined,
    interruptedSession: state.interruptedSession
      ? rebaseMovedPath(state.interruptedSession, oldRoot, newRoot)
      : undefined,
  };
  if (!existsSync(relocated.contextPath))
    throw new Error(
      `Task context file is missing after relocation: ${relocated.contextPath}`,
    );
  if (relocated.pendingBaselineDir && !existsSync(relocated.pendingBaselineDir))
    throw new Error(
      `The task baseline is missing after relocation: ${relocated.pendingBaselineDir}`,
    );

  const sessionsDir = join(runtimeDirectory, "sessions");
  const referencedSessions = new Set<string>();
  const addPath = (path?: string) => {
    if (path) referencedSessions.add(path);
  };
  addPath(relocated.sessions?.research);
  addPath(relocated.sessions?.roadmap);
  for (const sessions of [
    relocated.sessions?.implement,
    relocated.sessions?.commit,
  ])
    for (const path of Object.values(sessions || {})) addPath(path);
  for (const paths of Object.values(relocated.sessions?.review || {}))
    for (const path of paths) addPath(path);
  addPath(relocated.interruptedSession);
  for (const session of referencedSessions) {
    if (!pathWithin(resolve(sessionsDir), resolve(session)))
      throw new Error(
        `A saved task session is outside the project-local sessions directory and cannot be relocated safely: ${session}`,
      );
    if (!existsSync(session))
      throw new Error(
        `A saved task session is missing after relocation: ${session}`,
      );
  }

  const updates = new Map<string, string>();
  if (existsSync(sessionsDir)) {
    const info = lstatSync(sessionsDir);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error(`Cannot safely relocate task sessions: ${sessionsDir}`);
    for (const entry of readdirSync(sessionsDir, { withFileTypes: true })) {
      if (entry.isSymbolicLink())
        throw new Error(
          `Cannot safely relocate linked session: ${join(sessionsDir, entry.name)}`,
        );
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
      const file = join(sessionsDir, entry.name);
      const content = relocateSessionFile(
        file,
        state.id,
        oldRoot,
        newRoot,
        targetStatePath,
        relocationNote,
      );
      updates.set(file, content);
    }
  }
  const oldIndex = taskIndexPath(state.projectRoot, state.id);
  const newIndex = taskIndexPath(newRoot, state.id);
  mkdirSync(taskIndexDir(), { recursive: true });
  if (existsSync(newIndex)) {
    const existing = JSON.parse(readFileSync(newIndex, "utf8")) as {
      projectRoot?: string;
      id?: string;
      statePath?: string;
    };
    if (
      existing.projectRoot !== newRoot ||
      existing.id !== state.id ||
      resolve(existing.statePath || "") !== resolve(targetStatePath)
    )
      throw new Error(
        `A conflicting task index entry already exists: ${newIndex}`,
      );
  }
  updates.set(
    newIndex,
    `${JSON.stringify({ projectRoot: newRoot, id: state.id, statePath: targetStatePath })}\n`,
  );
  updates.set(targetStatePath, `${JSON.stringify(relocated, null, 2)}\n`);
  atomicWriteTextFiles(updates);
  try {
    if (existsSync(oldIndex) && !lstatSync(oldIndex).isSymbolicLink())
      rmSync(oldIndex, { force: true });
  } catch {
    /* A stale old-root index entry is ignored by discovery after relocation. */
  }
  return relocated;
}

async function confirmTaskRelocation(
  ctx: ExtensionCommandContext,
  task: DiscoveredTask,
  currentRoot: string,
): Promise<TaskState | undefined> {
  if (!task.relocatedFrom) return task.state;
  if (!ctx.isIdle()) {
    ctx.ui.notify(
      "Wait for Pi to finish or cancel its current run before relocating a task.",
      "warning",
    );
    return undefined;
  }
  const currentSession = ctx.sessionManager.getSessionFile();
  if (
    taskLink(ctx) ||
    (currentSession &&
      (pathWithin(resolve(taskDir(task.state)), resolve(currentSession)) ||
        pathWithin(resolve(runtimeDir(task.state)), resolve(currentSession))))
  ) {
    ctx.ui.notify(
      "Start a fresh Pi session in the renamed project before relocating this task; do not migrate an open task session.",
      "warning",
    );
    return undefined;
  }
  if (ctx.mode !== "tui") {
    ctx.ui.notify(
      `Task ${task.state.id} appears to have moved from ${task.relocatedFrom} to ${currentRoot}. Open it in Pi's terminal UI to confirm relocation.`,
      "warning",
    );
    return undefined;
  }
  const confirmed = await ctx.ui.confirm(
    `Relocate task ${task.state.id}?`,
    `This task moved from ${task.relocatedFrom} to ${currentRoot}. Update saved task and session paths, then continue its current phase?`,
  );
  if (!confirmed) {
    ctx.ui.notify(
      `Task ${task.state.id} was not changed; continuation was cancelled.`,
      "warning",
    );
    return undefined;
  }
  const latest = loadState(task.path);
  if (
    latest.id !== task.state.id ||
    relocatedProjectRoot(latest, task.path, currentRoot) !== task.relocatedFrom
  )
    throw new Error(
      "Task paths changed while confirming relocation; no files were modified.",
    );
  const relocationNote = `The project directory was moved from ${task.relocatedFrom} to ${currentRoot}. Use current project paths; old absolute paths in saved messages or artifacts are historical.`;
  const relocated = relocateTask(
    { ...task, state: latest },
    currentRoot,
    relocationNote,
  );
  ctx.ui.notify(
    `Task ${relocated.id} was relocated. Opening its ${relocated.phase} session.`,
    "info",
  );
  return relocated;
}

function taskDisplayState(task: DiscoveredTask, root: string): TaskState {
  if (!task.relocatedFrom) return task.state;
  const oldRoot = resolve(task.relocatedFrom);
  const newRoot = resolve(root);
  return {
    ...task.state,
    projectRoot: newRoot,
    contextPath: rebaseMovedPath(task.state.contextPath, oldRoot, newRoot),
  };
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
  if (state.phase === "research") return "Researching code";
  if (state.phase === "roadmap") return "Planning roadmap";
  if (state.phase === "implement" && total && state.currentStep > total)
    return `Complete (${state.completedSteps.length}/${total} steps)`;
  if (state.phase === "implement")
    return state.implementationStarted
      ? `Implementing step ${state.currentStep}${total ? `/${total}` : ""}`
      : `Preparing step ${state.currentStep}${total ? `/${total}` : ""}`;
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
  const path = taskStatePath(state);
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

function requireTask(
  ctx: ExtensionContext,
  maintainLegacyFiles = true,
): TaskState {
  const link = taskLink(ctx);
  if (!link)
    throw new Error("No task is attached to this session. Use /task TASK-ID.");
  const root = projectRoot(ctx.cwd);
  let linked: TaskState;
  try {
    linked = loadState(link.statePath, maintainLegacyFiles);
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== "ENOENT" ||
      !maintainLegacyFiles
    )
      throw error;
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
  const currentSession = ctx.sessionManager.getSessionFile();
  const phaseMatches =
    link.phase === linked.phase ||
    ((link.phase as string) === "collect" && linked.phase === "research");
  if (
    !sessionFor(linked) &&
    currentSession &&
    existsSync(currentSession) &&
    link.id === linked.id &&
    resolve(link.statePath) === resolve(taskStatePath(linked)) &&
    phaseMatches &&
    (link.step || 1) === linked.currentStep &&
    pathWithin(resolve(sessionDirectory(linked)), resolve(currentSession))
  ) {
    setSessionFor(linked, linked.phase, currentSession, linked.currentStep);
    saveState(linked);
  }
  return linked;
}

function taskStatusText(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: TaskState,
): string {
  const config = effectiveConfig(state);
  const model = configuredModel(state.phase, state);
  const phaseStatus =
    state.phase === "implement" && !state.implementationStarted
      ? "implementation preparation"
      : state.phase;
  return `Task: ${state.id}\nPhase: ${phaseStatus}\nCurrent step: ${state.currentStep}\nImplementation started: ${state.phase === "implement" ? (state.implementationStarted ? "yes" : "no") : "n/a"}\nActive session: ${sessionFor(state) || "none"}\nThis session: ${ctx.sessionManager.getSessionFile() || "ephemeral"}\nSessions directory: ${sessionDirectory(state)}\nArtifacts: ${taskDir(state)}\nGit repository: ${hasGitRepository(state) ? "yes" : "no"}\nCompleted steps: ${state.completedSteps.join(", ") || "none"}\nAwaiting review: ${state.awaitingReview || "none"}\nOpen review findings: ${state.phase === "review" && !state.reviewPending && existsSync(reviewPath(state, state.currentStep)) ? openReviewFindings(state, state.currentStep) : state.reviewPending ? "review artifact pending" : "none"}\nCommit result: ${state.phase === "commit" ? (state.commitReady ? "ready" : "pending") : "none"}\nPending commit files: ${state.commitPendingFiles?.join(", ") || (state.phase === "commit" ? state.pendingFiles?.join(", ") : undefined) || "none"}\nResearch skill: ${configuredPhaseSkill(config, "research") || "none"}\nRoadmap skill: ${configuredPhaseSkill(config, "roadmap") || "none"}\nReview skill: ${reviewSkillName(config)}\nMode: ${effectiveSetting(state, "mode")}\nAuto-commit: ${effectiveSetting(state, "autoCommit") ? "on" : "off"}\n/tree: ${config.allowTreeNavigation === true ? "allowed" : "blocked"}\nPhase model: ${model ? `${model.provider}/${model.model}` : "Inherited Pi model"}\nResearch tools available: ${researchAllowedTools(pi).join(", ") || "none"}\nSnapshot limits: ${config.snapshotMaxFiles ?? DEFAULT_SNAPSHOT_MAX_FILES} files, ${config.snapshotMaxMiB ?? DEFAULT_SNAPSHOT_MAX_MIB} MiB`;
}

function roadmapPath(state: TaskState): string {
  return join(taskDir(state), "roadmap.md");
}
function stepPath(state: TaskState, n: number): string {
  return join(taskDir(state), `step-${n}.md`);
}
type StepStatus = "planned" | "in_progress" | "completed";
function stepStatus(content: string): StepStatus | undefined {
  const match = content.match(/^Status: (planned|in_progress|completed)$/m);
  return match?.[1] as StepStatus | undefined;
}
function withStepStatus(content: string, status: StepStatus): string {
  const lines = content.split(/\r?\n/);
  const heading = lines.findIndex(
    (line) => line.trim() === "## Workflow status",
  );
  if (heading >= 0) {
    let end = heading + 1;
    while (end < lines.length && !/^## /.test(lines[end])) end++;
    lines.splice(
      heading,
      end - heading,
      "## Workflow status",
      "",
      `Status: ${status}`,
      "",
    );
  } else {
    const title = lines.findIndex((line) => /^# /.test(line));
    if (title >= 0)
      lines.splice(
        title + 1,
        0,
        "",
        "## Workflow status",
        "",
        `Status: ${status}`,
      );
    else lines.unshift(`Status: ${status}`, "");
  }
  return lines.join("\n").trimEnd();
}
function updateStepStatus(
  state: TaskState,
  step: number,
  status: StepStatus,
): void {
  const path = stepPath(state, step);
  if (!existsSync(path)) return;
  const current = readFileSync(path, "utf8");
  const updated = withStepStatus(current, status);
  if (updated !== current.trimEnd())
    writeArtifact(state, "step", updated, step);
}
function reviewPath(
  state: TaskState,
  n: number,
  round = state.reviewRound ?? 0,
): string {
  return join(taskDir(state), `review-${n}-round-${round}.md`);
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
  if (kind === "step") {
    const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
    const status = stepStatus(existing) || "planned";
    content = withStepStatus(content, status);
    const record = existing.match(/^## Execution record\n[\s\S]*$/m)?.[0];
    if (record && !/^## Execution record\n/m.test(content))
      content = `${content.trimEnd()}\n\n${record}`;
  }
  if (
    kind === "context" &&
    resolve(path) !== resolve(taskDir(state), "context.md")
  ) {
    throw new Error(
      "Task context must be stored inside the fixed task context directory.",
    );
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
  const paths = [taskDir(state), runtimeDir(state), state.contextPath];
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

function appendGitExcludePatterns(root: string, patterns: string[]): boolean {
  try {
    const excludePath = git(root, ["rev-parse", "--git-path", "info/exclude"]);
    const path = isAbsolute(excludePath)
      ? excludePath
      : resolve(root, excludePath);
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) return false;
    const current = existsSync(path) ? readFileSync(path, "utf8") : "";
    const existing = new Set(current.split(/\r?\n/));
    const missing = patterns.filter((pattern) => !existing.has(pattern));
    if (!missing.length) return true;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      `${current.trimEnd()}${current.trimEnd() ? "\n" : ""}# Pi task workflow local runtime\n${missing.join("\n")}\n`,
      "utf8",
    );
    return true;
  } catch {
    return false;
  }
}

function ignoreRuntimeDirectory(root: string, directory: string): boolean {
  try {
    const relativeDirectory = relative(root, directory);
    if (
      !relativeDirectory ||
      relativeDirectory === ".." ||
      relativeDirectory.startsWith(`..${sep}`)
    )
      return true;
    const pattern = `/${relativeDirectory
      .split(sep)
      .map((part) => part.replace(/[\\*?\[\]#!]/g, "\\$&"))
      .join("/")}/`;
    return appendGitExcludePatterns(root, [pattern]);
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
  const excludedDirectories = new Set([
    resolve(taskDir(state)),
    resolve(runtimeDir(state)),
  ]);
  const stack = [state.projectRoot];
  let inspected = 0;
  while (stack.length) {
    const directory = stack.pop()!;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (excludedDirectories.has(resolve(path)) || entry.isSymbolicLink())
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
  const config = effectiveConfig(state);
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
  const baselineParent = join(runtimeDir(state), "baselines");
  mkdirSync(baselineParent, { recursive: true });
  const directory = mkdtempSync(join(baselineParent, "implementation-"));
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
    if (!output) return "";
    const quotePath = (prefix: string) => {
      const path = `${prefix}${file}`;
      return /[\s"\\]/.test(path)
        ? `"${path.replace(/(["\\])/g, "\\$1")}"`
        : path;
    };
    const source = quotePath("a/");
    const target = quotePath("b/");
    const normalized = output
      .replace(/^diff --git .*$/m, `diff --git ${source} ${target}`)
      .replace(/^--- a\/.*$/m, `--- ${source}`)
      .replace(/^\+\+\+ b\/.*$/m, `+++ ${target}`);
    return `# ${file}\n${normalized}`;
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

function openReviewFindings(state: TaskState, step: number): number {
  const content = readFileSync(reviewPath(state, step), "utf8");
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
  const preparation =
    state.phase === "implement" && !state.implementationStarted;
  const approvedRoadmapItem = preparation
    ? roadmapStepSummary(state) || "(not found)"
    : "(not applicable)";
  const user: Message = {
    role: "user",
    content: [
      {
        type: "text",
        text: `Task: ${state.id}\nPhase: ${state.phase}\nImplementation started: ${state.phase === "implement" ? state.implementationStarted : "n/a"}\nApproved roadmap item for current step: ${approvedRoadmapItem}\nCommand: /task ${command}\nCommand note: ${note || "(none)"}\n\nRecent discussion:\n${messages || "(none)"}\n\nCurrent review artifact, if any:\n${review || "(none)"}`,
      },
    ],
    timestamp: Date.now(),
  };
  try {
    ctx.ui.setStatus("task-transition-check", "Checking task transition…");
  } catch {
    // The session may already have been replaced.
  }
  try {
    const response = await ctx.modelRegistry.complete(
      ctx.model,
      {
        systemPrompt: `You decide whether a task phase can advance. Analyze only the current phase's recent discussion and current review artifact. During implementation preparation (implementation has not started), the current roadmap item and the kickoff's summary of it are already approved; do not count them as a pending proposal. Check only newly discussed implementation details for unresolved questions or proposals. Return only JSON with fields openQuestions (array of strings), pendingProposal (string), reason (string). Keep each field concise.

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
    try {
      ctx.ui.setStatus("task-transition-check", undefined);
    } catch {
      // The session may have been replaced while the transition check ran.
    }
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
  return join(runtimeDir(state), "sessions");
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

function roadmapStepSummary(
  state: TaskState,
  step = state.currentStep,
): string | undefined {
  try {
    const line = readFileSync(roadmapPath(state), "utf8")
      .split(/\r?\n/)
      .find((value) => value.startsWith(`${step}. `));
    const summary = line
      ?.replace(/^\d+\.\s+/, "")
      .replace(/\*\*/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return summary ? summary.slice(0, 400) : undefined;
  } catch {
    return undefined;
  }
}

function phaseLabel(state: TaskState): string {
  const phase =
    state.phase === "research"
      ? "Research"
      : state.phase === "roadmap"
        ? "Roadmap"
        : state.phase === "implement"
          ? state.implementationStarted
            ? "Implementation"
            : "Step preparation"
          : state.phase === "review"
            ? "Review"
            : state.phase === "commit"
              ? "Commit"
              : "Complete";
  if (!["implement", "review", "commit"].includes(state.phase)) return phase;
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
  const title = ["implement", "review", "commit"].includes(phase)
    ? stepTitle(state, step)
    : undefined;
  const part =
    phase === "research"
      ? "research"
      : phase === "implement"
        ? `${state.implementationStarted ? "implement" : "prepare"} ${step}`
        : phase === "review" || phase === "commit"
          ? `${phase} ${step}`
          : phase;
  return `${state.id} · ${part}${phase === "review" ? ` · r${state.reviewRound ?? 0}` : ""}${title ? ` · ${title}` : ""}`;
}

function phaseHint(state: TaskState): string {
  if (state.interruptedSession)
    return "Run /task resume to continue the interrupted run.";
  if (state.phase === "research")
    return "Discuss findings; when ready, use /task next.";
  if (state.phase === "roadmap")
    return "When agreed, use /task next (or /task accept for a proposal).";
  if (state.phase === "implement")
    return state.implementationStarted
      ? "Ready for review? Use /task next."
      : `Final discussion for step ${state.currentStep}; /task next finalizes its plan, captures the baseline, and starts implementation.`;
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
  setPhaseWidget(ctx, state, waiting);
}

function setPhaseWidget(
  ctx: ExtensionContext,
  state: TaskState,
  waiting: boolean,
): void {
  const config = effectiveConfig(state);
  const title = ["implement", "review", "commit"].includes(state.phase)
    ? stepTitle(state)
    : undefined;
  const fullPhase = phaseLabel(state);
  const phase = title
    ? fullPhase.slice(0, fullPhase.lastIndexOf(` · ${title}`))
    : fullPhase;
  const settings = `[mode: ${effectiveSetting(state, "mode")}, auto-commit: ${effectiveSetting(state, "autoCommit") ? "on" : "off"}]`;
  const colors = {
    taskName: parseStatusColor(config.statusColors?.taskName ?? "brightGreen"),
    currentSettings: parseStatusColor(
      config.statusColors?.currentSettings ?? "brightBlack",
    ),
    currentPhase: parseStatusColor(config.statusColors?.currentPhase ?? "blue"),
    phaseDescription: parseStatusColor(
      config.statusColors?.phaseDescription ?? "blue",
    ),
  };
  ctx.ui.setWidget(
    PHASE_WIDGET,
    (_tui, theme) =>
      new Text(
        [
          theme.style(`Task ${state.id}`, { fg: colors.taskName }),
          " ",
          theme.style(settings, { fg: colors.currentSettings }),
          " · ",
          theme.style(phase, { fg: colors.currentPhase }),
          title
            ? ` · ${theme.style(title, { fg: colors.phaseDescription })}`
            : "",
          "\n",
          waiting ? phaseHint(state) : "Pi is working…",
        ].join(""),
        0,
        0,
      ),
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

function legacySourceMatchesCopies(
  source: string,
  artifactDirectory: string,
  runtimeDirectory: string,
  task: TaskState,
  sourceStateSnapshot: string,
): boolean {
  try {
    if (
      readFileSync(join(source, "state.json"), "utf8") !== sourceStateSnapshot
    )
      return false;
    const sourceState = JSON.parse(sourceStateSnapshot) as TaskState;
    if (sourceState.id !== task.id) return false;
    for (const entry of readdirSync(source, { withFileTypes: true })) {
      if (entry.name === "state.json") continue;
      if (entry.isSymbolicLink()) return false;
      const runtimeEntry =
        entry.name === "sessions" || entry.name === "baselines";
      const original = join(source, entry.name);
      const copied = join(
        runtimeEntry ? runtimeDirectory : artifactDirectory,
        entry.name,
      );
      if (
        !treeMatches(
          original,
          copied,
          runtimeEntry && entry.name === "sessions",
          task,
        )
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

function treeMatches(
  source: string,
  destination: string,
  rewriteSessions: boolean,
  task: TaskState,
): boolean {
  const sourceInfo = lstatSync(source);
  const destinationInfo = lstatSync(destination);
  if (sourceInfo.isSymbolicLink() || destinationInfo.isSymbolicLink())
    return false;
  if (sourceInfo.isDirectory() || destinationInfo.isDirectory()) {
    if (!sourceInfo.isDirectory() || !destinationInfo.isDirectory())
      return false;
    const sourceEntries = readdirSync(source).sort();
    const destinationEntries = readdirSync(destination).sort();
    return (
      sourceEntries.length === destinationEntries.length &&
      sourceEntries.every(
        (name, index) =>
          name === destinationEntries[index] &&
          treeMatches(
            join(source, name),
            join(destination, name),
            rewriteSessions,
            task,
          ),
      )
    );
  }
  if (!sourceInfo.isFile() || !destinationInfo.isFile()) return false;
  const sourceContent = readFileSync(source);
  const destinationContent = readFileSync(destination);
  if (rewriteSessions && source.endsWith(".jsonl")) {
    if (sourceContent.equals(destinationContent)) return true;
    try {
      const rewritten = rewriteMigrationSessionFile(
        source,
        task.id,
        taskStatePath(task),
      );
      return destinationContent.toString("utf8") === rewritten;
    } catch {
      return false;
    }
  }
  return sourceContent.equals(destinationContent);
}

function sessionReferencesExist(state: TaskState): boolean {
  const files = [
    state.sessions?.research,
    state.sessions?.roadmap,
    state.interruptedSession,
    ...Object.values(state.sessions?.implement || {}),
    ...Object.values(state.sessions?.commit || {}),
    ...Object.values(state.sessions?.review || {}).flat(),
  ].filter((file): file is string => !!file);
  return files.every((file) => existsSync(file));
}

function sessionFor(
  state: TaskState,
  phase = state.phase,
  step = state.currentStep,
): string | undefined {
  const sessions = state.sessions;
  if (!sessions) return undefined;
  if (phase === "research") return sessions.research;
  if (phase === "roadmap") return sessions.roadmap;
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
  if (phase === "research") sessions.research = file;
  else if (phase === "roadmap") sessions.roadmap = file;
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
    link.statePath === taskStatePath(state) &&
    (link.phase === state.phase ||
      ((link.phase as string) === "collect" && state.phase === "research")) &&
    (link.step || 1) === state.currentStep &&
    resolve(current) === resolve(expected)
  );
}

function configuredModel(
  phase: Phase,
  state?: TaskState,
): PhaseModel | null | undefined {
  const config = state ? effectiveConfig(state) : readConfig();
  if (phase === "complete" || phase === "commit") return undefined;
  return config.phaseModels?.[phase];
}

async function selectPhaseModel(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: TaskState,
  phase: Phase,
  step: number,
): Promise<void> {
  const model = configuredModel(phase, state);
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
  const round = phase === "review" ? (state.reviewRound ?? 0) : undefined;
  session.appendCustomEntry(ENTRY_TYPE, {
    id: state.id,
    statePath: taskStatePath(state),
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
  if (phase === "research")
    return `First discuss the task, constraints, and expected outcome; keep ${state.contextPath} concise and current. Then inspect the project, discuss feasibility and questions, and add agreed findings to the context artifact.`;
  if (phase === "roadmap")
    return `Read ${state.contextPath}. Propose a numbered roadmap with a short bold title and brief explanation for each step. Discuss additions and update context when we agree on them.`;
  if (phase === "implement") {
    const total = stepCount(state);
    const summary =
      roadmapStepSummary(state, step) || "the current roadmap item";
    return `This is the preparation session for step ${step}${total ? ` of ${total}` : ""}. Planned work: ${summary}. Begin by briefly explaining this scope and making clear that this is the final discussion before coding. Read ${state.contextPath} and ${roadmapPath(state)}; read ${stepPath(state, step)} if it already exists. Discuss remaining implementation details and checks, and keep the agreed current-step design in ${stepPath(state, step)}. Do not edit project code yet. /task next checks for unresolved questions or proposals, finalizes ${stepPath(state, step)}, captures the implementation baseline, and starts coding.`;
  }
  if (phase === "commit")
    return `Review has been accepted. This is the separate commit phase for step ${step}. Check the commit result shown in this session; if generation failed, use /task next to retry. Commit the reviewed files if a manual commit is pending, then use /task next to continue.`;
  return `Review step ${step}. Read ${state.contextPath}, ${stepPath(state, step)}, and ${join(taskDir(state), `implementation-${step}.diff`)}. Review the changes independently against the approved scope and inspect relevant project code. Save the review at ${reviewPath(state, step)} using task_write_artifact with artifact "review" and step ${step}. Do not edit project code or advance the workflow. Discuss findings with me and update their statuses only after we agree.`;
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
  if (state.phase === "implement" && !state.implementationStarted)
    return `Resume final preparation for step ${state.currentStep}. Continue discussing the roadmap summary and agreed implementation/checks; update ${stepPath(state, state.currentStep)}. Do not edit project code until /task next finalizes the design and captures the baseline.`;
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
    const options = tasks.map((task) => {
      const state = taskDisplayState(task, root);
      return `${state.id} · ${taskProgress(state)} · ${taskDescription(state)}${task.relocatedFrom ? ` · moved from ${task.relocatedFrom}` : ""}`;
    });
    const choice = await ctx.ui.select("Resume task:", options);
    if (choice === undefined) return;
    selected = tasks[options.indexOf(choice)];
  } else {
    const rows = tasks.map((task) => {
      const state = taskDisplayState(task, root);
      return `- ${state.id} · ${taskProgress(state)} · ${taskDescription(state)}${task.relocatedFrom ? ` · moved from ${task.relocatedFrom}` : ""}`;
    });
    await showArtifact(
      ctx,
      "Choose a task to resume",
      `${rows.join("\n")}\n\nUse /task TASK-ID to open one, then /task resume.`,
    );
    return;
  }

  if (selected) {
    const state = await confirmTaskRelocation(ctx, selected, root);
    if (state) await resumeOrOpenTask(pi, ctx, state);
  }
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
  const total = stepCount(state);
  if (state.currentStep > total)
    throw new Error(
      `Current step ${state.currentStep} is not present in the roadmap. Update the roadmap before implementation.`,
    );
  if (!existsSync(stepPath(state, state.currentStep)))
    throw new Error(
      `The design for current step ${state.currentStep} is missing. Discuss it in this session before starting implementation.`,
    );
  const gitRepository = hasGitRepository(state);
  const baselineClean = gitRepository && changedPaths(state).length === 0;
  if (gitRepository && effectiveSetting(state, "autoCommit") && !baselineClean)
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
  updateStepStatus(state, state.currentStep, "in_progress");
  state.pendingBaselineDir = baseline.directory;
  state.pendingGitRepository = gitRepository;
  state.pendingAutoCommitEligible = baselineClean;
  state.implementationStarted = true;
  saveState(state);
  pi.setSessionName(sessionDisplayName(state));
  updatePhaseUi(pi, ctx, state, false);
  pi.sendMessage(
    {
      customType: KICKOFF_TYPE,
      content: `Implement step ${state.currentStep} in this Pi session. The agreed design is in ${stepPath(state, state.currentStep)}. Read ${state.contextPath}, ${roadmapPath(state)}, and the current code. Make only the agreed changes, run focused checks, and do not commit. When finished, summarize the changes and checks. I will use /task next to start review.`,
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
  state.reviewRound =
    state.reviewRound === undefined ? 0 : state.reviewRound + 1;
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
  await switchPhase(ctx, state, "review", n, phaseKickoff(state, "review", n));
}

async function acceptReviewedStep(
  pi: ExtensionAPI,
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
      `Read the agreed review findings in ${reviewPath(state, n)}. Fix findings marked Status: open or with no status; only findings explicitly marked resolved or dismissed are closed. Preserve the existing implementation context in this session. Run focused checks; do not commit. Use /task next when ready for another review.`,
      state.sessions!.implement![String(n)],
    );
    return;
  }
  if (!state.completedSteps.includes(n)) state.completedSteps.push(n);
  state.completedSteps.sort((a, b) => a - b);
  state.awaitingReview = undefined;
  state.reviewPending = undefined;
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
      if (
        effectiveSetting(state, "mode") === "semi-auto" &&
        effectiveSetting(state, "autoCommit") &&
        state.commitReady
      )
        await finishCommitPhase(pi, fresh as ExtensionCommandContext, state);
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
  if (!hasGitRepository(state)) {
    await sendResult(
      `Git repository not detected. The commit phase is still open. Create or initialize a Git repository, then run /task next to retry commit-message generation. If you intentionally want to skip committing this step, run /task skip-commit.`,
    );
    setPhaseWidget(ctx, state, true);
    return;
  } else if (!state.pendingFiles?.length) {
    result =
      "No code changes were produced, so there is no commit message to propose.";
  } else {
    const message = await draftCommitMessage(ctx, state, n);
    if (effectiveSetting(state, "autoCommit")) {
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
  setPhaseWidget(ctx, state, true);
  await sendResult(result);
}

async function advanceSemiAutomatically(
  pi: ExtensionAPI,
  state: TaskState,
): Promise<void> {
  const shouldAdvance =
    (state.phase === "implement" && state.implementationStarted) ||
    (state.phase === "review" &&
      !state.reviewPending &&
      existsSync(reviewPath(state, state.currentStep))) ||
    (state.phase === "commit" &&
      state.commitReady &&
      effectiveSetting(state, "autoCommit"));
  if (!shouldAdvance) return;

  // Session-control methods exist only on ExtensionCommandContext. Dispatch the
  // workflow command through Pi so its handler receives a valid command context.
  await pi.sendUserMessage("/task next", { expandPromptTemplates: true });
}

function sectionBody(content: string, heading: string): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return "";
  let end = start + 1;
  while (end < lines.length && !/^## /.test(lines[end])) end++;
  return lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
}

function updateStepExecutionRecord(
  state: TaskState,
  step: number,
  commitResult?: string,
): void {
  const path = stepPath(state, step);
  if (!existsSync(path)) return;
  const names = readdirSync(taskDir(state)).filter((name) => {
    const match = name.match(new RegExp(`^review-${step}-round-(\\d+)\\.md$`));
    return !!match;
  });
  names.sort((left, right) => {
    const round = (name: string) =>
      Number(name.match(/-round-(\d+)\.md$/)?.[1] || 0);
    return round(left) - round(right);
  });
  const rounds = names.map((name) => {
    const round = Number(name.match(/-round-(\d+)\.md$/)?.[1] || 0);
    const content = readFileSync(join(taskDir(state), name), "utf8");
    const summary = sectionBody(content, "## Summary");
    const accepted = sectionBody(content, "## Accepted proposal");
    const findings = content
      .split(/^### /m)
      .slice(1)
      .map((section) => {
        const title = section.split(/\r?\n/, 1)[0]?.trim();
        const status = section.match(/^Status: (.+)$/m)?.[1] || "open";
        const location = section.match(/^Location: (.+)$/m)?.[1];
        return title
          ? `- ${title} — ${status}${location ? `; ${location}` : ""}`
          : "";
      })
      .filter(Boolean);
    return [
      `### Review round ${round}`,
      summary,
      accepted ? `Accepted decisions:\n${accepted}` : "",
      findings.length ? `Findings:\n${findings.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  });
  if (!rounds.length) return;
  const current = readFileSync(path, "utf8");
  const commitNote = commitResult?.startsWith("Commit intentionally skipped")
    ? `\n\n${commitResult}`
    : "";
  const record = `## Execution record\n\n${rounds.join("\n\n")}${commitNote}`;
  const updated = /^## Execution record\n[\s\S]*$/m.test(current)
    ? current.replace(/^## Execution record\n[\s\S]*$/m, record)
    : `${current.trimEnd()}\n\n${record}\n`;
  writeArtifact(state, "step", updated, step);
}

async function finishCommitPhase(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  state: TaskState,
): Promise<void> {
  if (
    state.commitReady &&
    state.commitResult?.includes("No Git repository; commit skipped")
  ) {
    state.commitReady = false;
    state.commitResult = undefined;
    state.commitPendingFiles = undefined;
    state.commitPendingHashes = undefined;
    if (hasGitRepository(state)) {
      const diffPath = join(
        taskDir(state),
        `implementation-${state.currentStep}.diff`,
      );
      const diff = existsSync(diffPath) ? readFileSync(diffPath, "utf8") : "";
      const files = [...diff.matchAll(/^# (.+)$/gm)].map((match) => match[1]);
      if (!files.length)
        throw new Error(
          "The previous no-Git commit result cannot be retried because the implementation diff has no file list. Review the task diff before proceeding.",
        );
      state.pendingFiles = [...new Set(files)];
      state.pendingHashes = Object.fromEntries(
        state.pendingFiles.map((file) => [
          file,
          fileHash(state.projectRoot, file),
        ]),
      );
    }
    saveState(state);
  }
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
  const more = n < stepCount(state);
  delete state.commitPendingFiles;
  delete state.commitPendingHashes;
  delete state.commitReady;
  delete state.commitResult;
  updateStepExecutionRecord(state, n, state.commitResult);
  updateStepStatus(state, n, "completed");
  const diffPath = join(taskDir(state), `implementation-${n}.diff`);
  if (existsSync(diffPath)) {
    if (lstatSync(diffPath).isSymbolicLink() || !lstatSync(diffPath).isFile())
      throw new Error(
        `Refusing to remove a non-regular implementation diff: ${diffPath}`,
      );
    rmSync(diffPath);
  }
  state.reviewRound = undefined;
  if (more) {
    state.phase = "implement";
    state.currentStep = n + 1;
    saveState(state);
    await switchPhase(
      ctx,
      state,
      "implement",
      n + 1,
      phaseKickoff(state, "implement", n + 1),
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

function directoryContentsEqual(left: string, right: string): boolean {
  const leftInfo = lstatSync(left);
  const rightInfo = lstatSync(right);
  if (
    !leftInfo.isDirectory() ||
    leftInfo.isSymbolicLink() ||
    !rightInfo.isDirectory() ||
    rightInfo.isSymbolicLink()
  )
    return false;
  const leftEntries = readdirSync(left).sort();
  const rightEntries = readdirSync(right).sort();
  if (leftEntries.length !== rightEntries.length) return false;
  for (let i = 0; i < leftEntries.length; i++) {
    const name = leftEntries[i];
    if (name !== rightEntries[i]) return false;
    const leftPath = join(left, name);
    const rightPath = join(right, name);
    const leftEntry = lstatSync(leftPath);
    const rightEntry = lstatSync(rightPath);
    if (leftEntry.isSymbolicLink() || rightEntry.isSymbolicLink()) return false;
    if (leftEntry.isDirectory() || rightEntry.isDirectory()) {
      if (!directoryContentsEqual(leftPath, rightPath)) return false;
    } else if (
      !leftEntry.isFile() ||
      !rightEntry.isFile() ||
      !readFileSync(leftPath).equals(readFileSync(rightPath))
    ) {
      return false;
    }
  }
  return true;
}

function pathWithin(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return (
    path === "" ||
    (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
  );
}

function taskDirectoryForDeletion(state: TaskState, path: string): string {
  const artifactDirectory = resolve(taskDir(state));
  const runtimeDirectory = resolve(runtimeDir(state));
  if (resolve(path) !== resolve(taskStatePath(state)))
    throw new Error(`Task state is outside its runtime directory: ${path}`);
  if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
    throw new Error(`Refusing to delete a linked task state: ${path}`);
  const root = realpathSync(state.projectRoot);
  const agentRoot = resolve(
    process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"),
  );
  for (const directory of new Set([artifactDirectory, runtimeDirectory])) {
    const info = lstatSync(directory);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error(
        `Refusing to delete a linked task directory: ${directory}`,
      );
    const actual = realpathSync(directory);
    if (pathWithin(actual, root))
      throw new Error(
        `Refusing to delete the project root or one of its parents: ${directory}`,
      );
    if (
      pathWithin(actual, agentRoot) ||
      actual === resolve(agentRoot, "sessions") ||
      actual === resolve(taskIndexDir())
    )
      throw new Error(
        `Refusing to delete a Pi configuration or sessions directory: ${directory}`,
      );
  }
  const actualRuntime = realpathSync(runtimeDirectory);
  if (realpathSync(path) !== join(actualRuntime, "state.json"))
    throw new Error(`Task state does not belong to ${runtimeDirectory}.`);
  return artifactDirectory;
}

function deleteTaskFiles(state: TaskState, path: string): void {
  const directory = taskDirectoryForDeletion(state, path);
  for (const target of new Set([directory, resolve(runtimeDir(state))]))
    rmSync(target, { recursive: true });
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
          if (command === "status") {
            try {
              ctx.ui.notify(
                `Task status\n\n${taskStatusText(pi, ctx, requireTask(ctx, false))}`,
                "info",
              );
            } catch (error) {
              ctx.ui.notify(
                error instanceof Error ? error.message : String(error),
                "warning",
              );
            }
            return;
          }
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
      "Replace a task artifact in the task directory. Write prose and headings in English, regardless of the conversation language; preserve exact code, paths, and quoted excerpts. Review artifact formatting is guided by the review skill, not validated by the extension. The extension chooses the file path.",
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
      if (state.phase === "research" && params.artifact !== "context")
        throw new Error(
          "Research can write only context.md. Other artifacts are available in their corresponding phases.",
        );
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
        : state.phase === "research"
          ? researchAllowedTools(pi)
          : [
              ...READ_TOOLS,
              ARTIFACT_TOOL,
              ...(state.phase === "review"
                ? effectiveConfig(state).reviewTools || []
                : []),
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
    const state = visibleTask(ctx);
    if (state && effectiveConfig(state).allowTreeNavigation === true) return;
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
      await selectPhaseModel(pi, ctx, state, state.phase, state.currentStep);
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
  pi.on("agent_settled", async (event, ctx) => {
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
    if (
      !event.aborted &&
      state &&
      sessionMatches(ctx, state) &&
      effectiveSetting(state, "mode") === "semi-auto"
    ) {
      try {
        await advanceSemiAutomatically(pi, state);
      } catch (error) {
        ctx.ui.notify(
          `Semi-auto transition stopped: ${error instanceof Error ? error.message : String(error)}. Continue manually with /task next when ready.`,
          "warning",
        );
      }
    }
  });

  pi.on("before_agent_start", (event, ctx) => {
    if (!taskLink(ctx)) return;
    let state: TaskState;
    try {
      state = requireTask(ctx);
    } catch (error) {
      event.systemPromptOptions.selectedTools = [];
      event.systemPromptOptions.sections.task_workflow = `Task state is unavailable, so task tools are disabled. Cause: ${error instanceof Error ? error.message : String(error)}. Do not claim to inspect files or use tools. Tell the user to run /task status or reopen the task with /task TASK-ID.`;
      return;
    }
    if (!sessionMatches(ctx, state)) {
      event.systemPromptOptions.selectedTools = [];
      event.systemPromptOptions.sections.task_workflow = `This is an archived task session. The active phase is ${state.phase}. Do not edit files. Use /task ${state.id} to continue.`;
      return;
    }
    const writable = state.phase === "implement" && state.implementationStarted;
    const config = effectiveConfig(state);
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
          : state.phase === "research"
            ? researchAllowedTools(pi)
            : [
                ...READ_TOOLS,
                ARTIFACT_TOOL,
                ...(state.phase === "review" ? config.reviewTools || [] : []),
              ];
    const common = `Task ${state.id}. Phase ${state.phase}, step ${state.currentStep}. Canonical context: ${state.contextPath}. ${state.phase === "commit" ? "This is a separate commit phase. Do not edit project code, task artifacts, state, or implementation diffs. Only /task commands change phases." : `Update task artifacts with ${ARTIFACT_TOOL}; it accepts complete replacement content. ${ARTIFACT_LANGUAGE_RULE} When updating an existing artifact, convert its non-English prose to English while preserving its agreed meaning. Only /task commands change phases. Do not edit state.json or implementation diffs.`}`;
    const rule =
      state.phase === "research"
        ? `Gather and clarify task context, then inspect project files and use available read-only web search/fetch tools to research feasibility. If none is directly listed, use tool_search to discover an available read-only web tool. You may read project files but must not edit them. Write only context.md using task_write_artifact; do not write roadmap, step, or review artifacts in Research. Keep context.md concise and current with confirmed facts; add agreed findings and code references, and leave unresolved doubts out. Research tools enabled for this turn: ${researchAllowedTools(pi).join(", ") || "none"}.`
        : state.phase === "roadmap"
          ? "Discuss the roadmap. Update context.md when agreed facts change, then present a complete revised numbered roadmap. Draft roadmap.md as decisions settle."
          : state.phase === "implement"
            ? writable
              ? `Implement or repair step ${state.currentStep} in this session. Read approved artifacts and, when repairing, ${reviewPath(state, state.currentStep)}. Address only open findings. Run focused checks and summarize changes. Do not commit. Use /task next when ready for review.`
              : `This is final preparation for step ${state.currentStep}. Read ${state.contextPath}, ${roadmapPath(state)}, and ${stepPath(state, state.currentStep)} if it exists. Briefly summarize the planned work and remind the user that this session is for final discussion, not coding. Discuss implementation details and checks; keep the agreed design in ${stepPath(state, state.currentStep)}. Do not edit project code. /task next checks unresolved questions and proposals, finalizes the step design, captures the baseline, and starts implementation.`
            : state.phase === "review"
              ? `Review step ${state.currentStep} independently against the approved context and step design. Read the implementation diff and relevant project code using read-only tools. Save ${reviewPath(state, state.currentStep)} as an English artifact with the exact structure below, using task_write_artifact with artifact "review" and step ${state.currentStep}.

Start with # Review: step ${state.currentStep}, then include ## Summary and ## Findings. For every finding, place one short, exact excerpt copied verbatim from implementation-${state.currentStep}.diff in a fenced diff block immediately before its heading. Then use a heading ### [Severity] Short title, followed by exactly one Status: open line, a precise Location:, and a concise explanation of the defect and concrete impact. Do not report style preferences as defects. If there are no findings, write No findings. under ## Findings and include no finding headings or diff blocks. In your response, show each finding with its severity, location, impact, and the same diff excerpt. Discuss findings with the user; change statuses only after agreement, using resolved for fixed and dismissed for rejected. Do not edit project code or advance the workflow.`
              : state.phase === "commit"
                ? state.commitReady
                  ? `Present and explain the commit result already saved in this session. This phase has a clear boundary: do not implement, review, or modify task artifacts. If a manual commit is pending, the user must commit the reviewed files before leaving; /task next verifies this. Only /task next (or /task accept) leaves this phase and starts the next step or completes the task.`
                  : "The commit result is not ready. Do not invent one or modify files; tell the user to run /task next to generate or retry it. If Git is unavailable and the user deliberately wants to skip this commit, they can run /task skip-commit. This is the separate commit phase."
                : "The task is complete. Do not edit project files through this task session.";
    const phaseSkill =
      state.phase === "research" ||
      state.phase === "roadmap" ||
      state.phase === "implement" ||
      state.phase === "review" ||
      state.phase === "commit"
        ? configuredPhaseSkill(config, state.phase)
        : undefined;
    const skillGuidance = phaseSkill
      ? state.phase === "review"
        ? ` If the review preference skill "${phaseSkill}" is available, load and use it for the user's review preferences. The review format, workflow procedure, artifact path, and tool boundaries are defined above and must not be overridden. If the skill is unavailable, follow the review instructions above without additional user preferences.`
        : ` If the discovered skill "${phaseSkill}" is available, use it as supplementary guidance for this phase. It must not override the task workflow's phase boundaries, artifact rules, or tool restrictions. If unavailable, continue with the built-in instructions.`
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
        "skip-commit",
        "show",
        "config",
        "help",
      ];
      let items = commands.map((value) => ({ value, label: value }));
      if (prefix.startsWith("config")) {
        items = [
          { value: "config init project", label: "init project" },
          { value: "config init task", label: "init task" },
        ];
      } else if (prefix.startsWith("show ")) {
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
      let transitionStatus = false;
      let sessionReplaced = false;
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
                  "config",
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
        if (command === "config") {
          if (args.length === 0) {
            const state = requireTask(ctx, false);
            const global = effectiveConfig(state);
            const effectiveSettings = {
              mode: effectiveSetting(state, "mode"),
              autoCommit: effectiveSetting(state, "autoCommit"),
              statusColors: {
                taskName: global.statusColors?.taskName ?? "brightGreen",
                currentSettings:
                  global.statusColors?.currentSettings ?? "brightBlack",
                currentPhase: global.statusColors?.currentPhase ?? "blue",
                phaseDescription:
                  global.statusColors?.phaseDescription ?? "blue",
              },
              phaseModels: global.phaseModels ?? {},
              skills: {
                research: configuredPhaseSkill(global, "research") ?? null,
                roadmap: configuredPhaseSkill(global, "roadmap") ?? null,
                implement: configuredPhaseSkill(global, "implement") ?? null,
                review: configuredPhaseSkill(global, "review") ?? null,
                commit: configuredPhaseSkill(global, "commit") ?? null,
              },
              reviewTools: global.reviewTools ?? [],
              allowTreeNavigation: global.allowTreeNavigation ?? false,
              hotkeys: { ...DEFAULT_HOTKEYS, ...global.hotkeys },
              snapshotMaxFiles:
                global.snapshotMaxFiles ?? DEFAULT_SNAPSHOT_MAX_FILES,
              snapshotMaxMiB: global.snapshotMaxMiB ?? DEFAULT_SNAPSHOT_MAX_MIB,
            };
            await showArtifact(
              ctx,
              "Effective task configuration",
              JSON.stringify(effectiveSettings, null, 2),
            );
            return;
          }
          if (
            args.length !== 2 ||
            args[0] !== "init" ||
            !["project", "task"].includes(args[1])
          )
            throw new Error("Usage: /task config init project|task");
          const scope = args[1];
          if (scope === "project") {
            const root = projectRoot(ctx.cwd);
            const path = projectConfigPath(root);
            mkdirSync(dirname(path), { recursive: true });
            const project = readProjectConfig(root);
            const global = readConfig();
            const values = {
              ...global,
              ...project,
              phaseModels: { ...global.phaseModels, ...project.phaseModels },
              skills: { ...global.skills, ...project.skills },
              hotkeys: { ...global.hotkeys, ...project.hotkeys },
              statusColors: { ...global.statusColors, ...project.statusColors },
            };
            Object.assign(values, materializedConfig(values));
            writeFileSync(path, `${JSON.stringify(values, null, 2)}\n`, {
              encoding: "utf8",
              flag: "wx",
              mode: 0o600,
            });
            await showArtifact(
              ctx,
              "Project configuration",
              `Created ${path}\n\n${JSON.stringify(values, null, 2)}`,
            );
            return;
          }
          const state = requireTask(ctx, false);
          state.configOverrides = materializedConfig(effectiveConfig(state));
          state.workflowMode = undefined;
          state.autoCommit = undefined;
          saveState(state);
          await showArtifact(
            ctx,
            "Task configuration",
            `Saved task overrides in ${taskStatePath(state)}\n\n${JSON.stringify(state.configOverrides, null, 2)}`,
          );
          return;
        }
        if (command === "list") {
          if (args.length) throw new Error("Usage: /task list");
          const root = projectRoot(ctx.cwd);
          const tasks = listTasks(root);
          if (ctx.mode === "tui" && tasks.length) {
            const options = tasks.map((task) => {
              const state = taskDisplayState(task, root);
              return `${state.id} · ${taskProgress(state)} · ${taskDescription(state)}${task.relocatedFrom ? ` · moved from ${task.relocatedFrom}` : ""}`;
            });
            const selected = await ctx.ui.select("Continue task:", options);
            if (selected === undefined) return;
            const task = tasks[options.indexOf(selected)];
            if (task) {
              const mismatch = checkStructureVersion(task.path);
              if (mismatch) {
                ctx.ui.notify(
                  `${mismatch}\nThis task cannot be continued. Start a new task and use the contents of ${task.state.contextPath} as its context; this will not be done automatically.`,
                  "warning",
                );
                return;
              }
              const state = await confirmTaskRelocation(ctx, task, root);
              if (state) await continueTaskSession(ctx, state);
            }
            return;
          }
          const rows = tasks.map((task) => {
            const state = taskDisplayState(task, root);
            return `| \`${state.id}\` | ${taskProgress(state)}${task.relocatedFrom ? ` (moved from ${task.relocatedFrom})` : ""} | ${taskDescription(state).replaceAll("|", "\\|")} |`;
          });
          await showArtifact(
            ctx,
            "Task list",
            tasks.length
              ? `# Tasks in ${root}\n\n| Task ID | State | Context |\n| --- | --- | --- |\n${rows.join("\n")}\n\nUse /task TASK-ID to continue.`
              : `# Tasks in ${root}\n\nNo tasks found. Start one with /task TASK-ID.`,
          );
          return;
        }
        const root = projectRoot(ctx.cwd);
        let versionPath: string | undefined;
        const explicitTaskId =
          command && command !== "delete" ? args[0] : undefined;
        if ((!command || command === "delete") && args.length) {
          const id = args[0];
          const candidates = [statePath(parseRuntimeDir(root, id))].filter(
            (candidate) => existsSync(candidate),
          );
          if (candidates.length > 1)
            throw new Error(
              `Multiple task state files exist for ${id}: ${candidates.join(", ")}. Resolve the duplicate state files before continuing.`,
            );
          versionPath = candidates[0];
        } else if (explicitTaskId) {
          const candidates = [
            statePath(parseRuntimeDir(root, explicitTaskId)),
          ].filter((candidate) => existsSync(candidate));
          if (candidates.length > 1)
            throw new Error(
              `Multiple task state files exist for ${explicitTaskId}: ${candidates.join(", ")}. Resolve the duplicate state files before continuing.`,
            );
          versionPath = candidates[0];
        } else if (command) {
          const link = taskLink(ctx);
          if (link && existsSync(link.statePath)) {
            const linkedState = JSON.parse(
              readFileSync(link.statePath, "utf8"),
            ) as TaskState;
            const current = ctx.sessionManager.getSessionFile();
            if (
              link.id === linkedState.id &&
              resolve(link.statePath) === resolve(taskStatePath(linkedState)) &&
              link.phase === linkedState.phase &&
              (link.step || 1) === linkedState.currentStep &&
              !!current &&
              !!sessionFor(linkedState) &&
              resolve(current) === resolve(sessionFor(linkedState)!)
            )
              versionPath = link.statePath;
          }
        }
        if (versionPath) {
          const mismatch = checkStructureVersion(versionPath);
          if (mismatch) {
            const state = JSON.parse(
              readFileSync(versionPath, "utf8"),
            ) as TaskState;
            const context = resolve(state.contextPath);
            const guidance = `${mismatch}\nThis task cannot be continued with the current structure. Start a new task and use the contents of ${context} as its context; this will not be done automatically.`;
            if (ctx.mode === "tui") {
              ctx.ui.notify(guidance, "warning");
              return;
            }
            throw new Error(guidance);
          }
        }
        if (command === "resume") {
          if (args.length)
            throw new Error("Usage: /task resume (no task ID is needed).");
          await resumeFromCurrentProject(pi, ctx);
          return;
        }
        if (command === "delete") {
          if (args.length > 1) throw new Error("Usage: /task delete [TASK-ID]");
          if (!ctx.isIdle())
            throw new Error(
              "Wait for Pi to finish or cancel its current run before deleting a task.",
            );
          const root = projectRoot(ctx.cwd);
          if (!args.length)
            throw new Error(
              "Specify a task ID with /task delete TASK-ID. ID-less deletion is unavailable because task state must be checked before loading it.",
            );
          const discovered = listTasks(root);
          const tasks = discovered.filter((task) => !task.relocatedFrom);
          let target: DiscoveredTask | undefined;
          if (args.length) {
            validateTaskId(args[0]);
            const candidate = discovered.find(
              ({ state }) => state.id === args[0],
            );
            if (candidate?.relocatedFrom)
              throw new Error(
                `Task ${args[0]} was moved from ${candidate.relocatedFrom}. Open it with /task ${args[0]} and confirm relocation before deleting it.`,
              );
            target = candidate;
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
          const mismatch = checkStructureVersion(targetPath);
          if (mismatch)
            throw new Error(
              `${mismatch}\nThis task cannot be continued. Start a new task and use the contents of ${target.state.contextPath} as its context; this will not be done automatically.`,
            );
          const state = loadState(targetPath);
          if (state.id !== target.state.id || state.projectRoot !== root)
            throw new Error(
              "Task changed while choosing it; run /task delete again.",
            );
          const directory = taskDirectoryForDeletion(state, targetPath);
          const runtimeDirectory = resolve(runtimeDir(state));
          const confirmed = await ctx.ui.confirm(
            `Permanently delete task ${state.id}?`,
            `Delete artifacts at ${directory} and local workflow state at ${runtimeDirectory}? This cannot be undone.`,
          );
          if (!confirmed) return;
          const latest = loadState(targetPath);
          if (
            latest.id !== state.id ||
            latest.projectRoot !== root ||
            resolve(taskDir(latest)) !== directory ||
            resolve(runtimeDir(latest)) !== runtimeDirectory
          )
            throw new Error(
              "Task changed before deletion; run /task delete again.",
            );
          const current = ctx.sessionManager.getSessionFile();
          const link = taskLink(ctx);
          const active =
            (current &&
              (pathWithin(directory, resolve(current)) ||
                pathWithin(runtimeDirectory, resolve(current)))) ||
            (link?.id === state.id && link.statePath === targetPath);
          if (active) {
            const neutral = createNeutralSession(root);
            if (
              pathWithin(directory, resolve(neutral)) ||
              pathWithin(runtimeDirectory, resolve(neutral))
            )
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
          if (args.length !== 1 || !args[0] || args[0].startsWith("--"))
            throw new Error("A task ID is required. Usage: /task TASK-ID");
          const root = projectRoot(ctx.cwd);
          const id = args[0];
          validateTaskId(id);
          const artifactDir = parseArtifactDir(root, id);
          const taskRuntime = parseRuntimeDir(root, id);
          const path = statePath(taskRuntime);
          if (existsSync(path)) {
            const mismatch = checkStructureVersion(path);
            if (mismatch)
              throw new Error(
                `${mismatch}\nThis task cannot be continued. Start a new task and use the contents of ${JSON.parse(readFileSync(path, "utf8")).contextPath} as its context; this will not be done automatically.`,
              );
            const state = loadState(path);
            if (state.id !== id)
              throw new Error(
                `Task ID mismatch in ${path}: requested ${id}, but state.json contains ${state.id}.`,
              );
            if (resolve(state.projectRoot) !== resolve(root)) {
              const relocatedFrom = relocatedProjectRoot(state, path, root);
              if (!relocatedFrom)
                throw new Error(projectMismatchMessage(state, root, path));
              const relocated = await confirmTaskRelocation(
                ctx,
                { state, path, relocatedFrom },
                root,
              );
              if (relocated) await continueTaskSession(ctx, relocated);
              return;
            }
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
          if (existsSync(taskRuntime) && readdirSync(taskRuntime).length)
            throw new Error(
              `Runtime directory already exists without task state: ${taskRuntime}`,
            );
          if (
            ctx.mode === "tui" &&
            !(await ctx.ui.confirm(
              `Start task ${id}?`,
              `Create task files under ${taskRuntime}, and a research session?`,
            ))
          )
            return;
          mkdirSync(artifactDir, { recursive: true });
          mkdirSync(taskRuntime, { recursive: true });
          const ignoredRuntime = ignoreRuntimeDirectory(root, taskRuntime);
          const contextPath = join(artifactDir, "context.md");
          writeFileSync(contextPath, `# ${id}\n`, "utf8");
          const state: TaskState = {
            version: 1,
            structureVersion: CURRENT_STRUCTURE_VERSION,
            id,
            projectRoot: root,
            contextPath,
            phase: "research",
            currentStep: 1,
            completedSteps: [],
            sessions: {},
          };
          await selectPhaseModel(pi, ctx, "research", 1);
          const file = createPhaseSession(
            state,
            "research",
            1,
            ctx.sessionManager.getSessionFile(),
          );
          setSessionFor(state, "research", file);
          saveState(state);
          try {
            rememberTask(state, taskStatePath(state));
            if (hasGitRepository(state) && !ignoredRuntime)
              ctx.ui.notify(
                `Could not add ${taskRuntime} to .git/info/exclude; add it to .gitignore to keep local task state out of Git.`,
                "warning",
              );
          } catch {
            ctx.ui.notify(
              "Task started, but its discovery index could not be updated.",
              "warning",
            );
          }
          const result = await ctx.switchSession(file, {
            withSession: async (fresh) => {
              fresh.ui.notify(
                `Task ${id} started in Research. Describe the problem, constraints, and expected outcome.`,
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
        const state = requireTask(ctx, command !== "status");
        if (command === "status") {
          if (args.length) throw new Error("Usage: /task status");
          await showArtifact(
            ctx,
            "Task status",
            taskStatusText(pi, ctx, state),
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
        if (command === "skip-commit") {
          transitionStatus = true;
          ctx.ui.setStatus(
            "task-transition",
            "Recording intentional commit skip…",
          );
          if (!sessionMatches(ctx, state))
            throw new Error(
              `This is not the active task session. Use /task ${state.id} to continue ${state.phase}.`,
            );
          if (state.phase !== "commit")
            throw new Error(
              "/task skip-commit is only available during the commit phase.",
            );
          if (args.length)
            throw new Error("/task skip-commit does not accept arguments.");
          if (state.commitResult?.startsWith("Committed step"))
            throw new Error(
              "This step was already committed automatically; /task skip-commit cannot undo it.",
            );
          state.commitPendingFiles = undefined;
          state.commitPendingHashes = undefined;
          state.commitReady = true;
          state.commitResult = `Commit intentionally skipped by user for step ${state.currentStep}.`;
          saveState(state);
          await finishCommitPhase(pi, ctx, state);
          return;
        }
        if (command === "next" || command === "accept") {
          transitionStatus = true;
          ctx.ui.setStatus(
            "task-transition",
            "Transitioning to the next task phase…",
          );
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
            sessionReplaced = true;
            return;
          }
          const assessment = await assessTransition(ctx, state, command, note);
          if (assessment.openQuestions.length) {
            ctx.ui.notify(
              "The phase is unchanged. Resolve these open questions first:",
              "warning",
            );
            for (const question of assessment.openQuestions)
              ctx.ui.notify(question, "info");
            return;
          }
          if (command === "next" && assessment.pendingProposal.trim()) {
            ctx.ui.notify(
              "The phase is unchanged. A proposal still needs approval:",
              "warning",
            );
            ctx.ui.notify(
              `${assessment.pendingProposal}. Use /task accept if you agree.`,
              "info",
            );
            return;
          }
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
          if (state.phase === "implement" && !state.implementationStarted) {
            await finalizeArtifact(ctx, state, "step", approval);
            await beginImplementation(pi, ctx, state);
            sessionReplaced = true;
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
            sessionReplaced = true;
            return;
          }
          if (state.phase === "roadmap") {
            await finalizeArtifact(ctx, state, "roadmap", approval);
            stepCount(state);
            state.implementationStarted = false;
            await switchPhase(
              ctx,
              state,
              "implement",
              1,
              phaseKickoff(state, "implement", 1),
            );
            sessionReplaced = true;
            return;
          }
          if (state.phase === "implement") {
            await beginReview(ctx, state);
            sessionReplaced = true;
            return;
          }
          if (state.phase === "review") {
            await acceptReviewedStep(pi, ctx, state, approval);
            sessionReplaced = true;
            return;
          }
        }
        throw new Error(`Unknown subcommand: ${command}. Use /task help.`);
      } catch (error) {
        ctx.ui.notify(
          error instanceof Error ? error.message : String(error),
          "error",
        );
      } finally {
        if (transitionStatus && !sessionReplaced)
          ctx.ui.setStatus("task-transition", undefined);
      }
    },
  });
}
