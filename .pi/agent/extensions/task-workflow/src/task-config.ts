import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { TASK_PHASES, type Phase, type TaskState } from "./phase-model.ts";
import { PHASE_DEFINITIONS } from "./phase-prompts.ts";
import { parseArguments } from "./task-arguments.ts";
import { runtimeDir, type TaskLayout } from "./task-state.ts";

/** Provider, model, and optional thinking level selected for a phase. */
export type PhaseModel = {
  provider: string;
  model: string;
  thinkingLevel?:
    "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
};

/** Workflow phases that accept configurable tool lists. */
export type ToolPhase = Exclude<Phase, "complete">;

/** Configured mechanism for removing task files. */
export type DeleteMode = "trash" | "permanent";

/** Settings as stored at any supported scope; values may be omitted. */
export type Config = {
  mode?: "manual" | "semi-auto";
  deleteMode?: DeleteMode;
  autoCommit?: boolean;
  manualReview?: boolean;
  include?: string[] | null;
  exclude?: string[];
  phaseModels?: Partial<
    Record<
      "research" | "roadmap" | "prepare" | "implement" | "review",
      PhaseModel | null
    >
  >;
  skills?: Partial<Record<Phase, string | null>>;
  phaseTools?: Partial<Record<ToolPhase, string[]>>;
  additionalPhaseTools?: Partial<Record<ToolPhase, string[]>>;
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

/** Default maximum number of files copied into an implementation baseline. */
export const DEFAULT_SNAPSHOT_MAX_FILES = 4_000;

/** Default total size limit for an implementation baseline. */
export const DEFAULT_SNAPSHOT_MAX_MIB = 100;

/** Default global shortcut bindings, keyed by task subcommand. */
export const DEFAULT_HOTKEYS: Record<string, string> = {
  next: "alt+n",
  accept: "alt+a",
  status: "alt+s",
  show: "alt+w",
};

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

/** Return the project-wide task workflow settings path. */
export function projectConfigPath(root: string): string {
  return join(root, ".agents", "task-workflow", "config.json");
}

/** Return the settings path for a current-layout task. */
export function taskConfigPath(state: TaskState): string {
  return join(runtimeDir(state), "config.json");
}

/** Write settings explicitly, optionally refusing to replace an existing file. */
export function writeScopedConfig(
  path: string,
  config: Config,
  createOnly = false,
): void {
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf8",
    flag: createOnly ? "wx" : "w",
    mode: 0o600,
  });
}

/** Fill the defaults used when writing an initial scoped configuration. */
export function materializedConfig(config: Config): Config {
  return {
    ...config,
    mode: config.mode ?? "manual",
    deleteMode: config.deleteMode ?? "trash",
    autoCommit: config.autoCommit ?? false,
    manualReview: config.manualReview ?? true,
    phaseModels: config.phaseModels ?? {},
    skills: effectivePhaseSkills(config),
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

/** Resolve a phase skill after scope merging. An explicit null disables the default. */
export function configuredPhaseSkill(
  config: Config,
  phase: Phase,
): string | null {
  const skill = config.skills?.[phase];
  return skill === undefined ? PHASE_DEFINITIONS[phase].defaultSkill : skill;
}

/** List the effective skill names (or null) for every workflow phase. */
export function effectivePhaseSkills(
  config: Config,
): Record<Phase, string | null> {
  return Object.fromEntries(
    TASK_PHASES.map((phase) => [phase, configuredPhaseSkill(config, phase)]),
  ) as Record<Phase, string | null>;
}

/** Bind scoped configuration reads to the host color parser.
 * Each scope is validated when read, before any precedence rules are applied.
 */
export function createTaskConfig<Color>(
  parseColor: (value: string | number) => Color,
) {
  /** Convert a configured ANSI name or color value using the Pi TUI parser. */
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
    if (
      values.autoCommit !== undefined &&
      typeof values.autoCommit !== "boolean"
    )
      throw new Error(`autoCommit must be a boolean: ${path}`);
    if (
      values.deleteMode !== undefined &&
      !["trash", "permanent"].includes(String(values.deleteMode))
    )
      throw new Error(`deleteMode must be trash or permanent: ${path}`);
    if (
      values.manualReview !== undefined &&
      typeof values.manualReview !== "boolean"
    )
      throw new Error(`manualReview must be a boolean: ${path}`);
    if (values.skills !== undefined) {
      if (
        !values.skills ||
        typeof values.skills !== "object" ||
        Array.isArray(values.skills)
      )
        throw new Error(`skills must be an object: ${path}`);
      for (const [phase, skill] of Object.entries(values.skills)) {
        if (!TASK_PHASES.some((candidate) => candidate === phase))
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
    for (const key of ["include", "exclude"] as const) {
      const patterns = values[key];
      if (patterns === undefined || (key === "include" && patterns === null))
        continue;
      if (
        !Array.isArray(patterns) ||
        patterns.some((item) => typeof item !== "string")
      )
        throw new Error(
          `${key} must be an array of strings${key === "include" ? " or null" : ""}: ${path}`,
        );
    }
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

  /** Read project or task settings, or return empty settings when absent. */
  function readScopedConfig(path: string): Config {
    if (!existsSync(path)) return {};
    return validateConfig(JSON.parse(readFileSync(path, "utf8")), path);
  }

  /** Merge changes into the settings saved for the current task. */
  function updateTaskConfig(state: TaskState, changes: Config): void {
    const path = taskConfigPath(state);
    writeScopedConfig(path, { ...readScopedConfig(path), ...changes });
  }

  /** Resolve global, project, and task settings in increasing precedence. */
  function effectiveConfig(state: TaskState): Config {
    const global = readConfig();
    const project = readScopedConfig(projectConfigPath(state.projectRoot));
    const task = readScopedConfig(taskConfigPath(state));
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
      phaseTools: {
        ...global.phaseTools,
        ...project.phaseTools,
        ...task.phaseTools,
      },
      additionalPhaseTools: {
        ...global.additionalPhaseTools,
        ...project.additionalPhaseTools,
        ...task.additionalPhaseTools,
      },
      hotkeys: { ...global.hotkeys, ...project.hotkeys, ...task.hotkeys },
      statusColors: {
        ...global.statusColors,
        ...project.statusColors,
        ...task.statusColors,
      },
    };
  }

  /** Resolve deletion mode using the task settings file for the discovered layout. */
  function effectiveDeletionMode(
    state: TaskState,
    stateFile: string,
    layout: TaskLayout,
  ): DeleteMode {
    const globalMode = readConfig().deleteMode;
    const projectMode = readScopedConfig(
      projectConfigPath(state.projectRoot),
    ).deleteMode;
    const taskConfig =
      layout === "historical"
        ? join(dirname(stateFile), "config.json")
        : taskConfigPath(state);
    const taskMode = readScopedConfig(taskConfig).deleteMode;
    return taskMode ?? projectMode ?? globalMode ?? "trash";
  }

  /** Save the deletion mode at the task scope for the selected layout. */
  function setTaskDeletionMode(
    state: TaskState,
    stateFile: string,
    layout: TaskLayout,
    mode: DeleteMode,
  ): void {
    const path =
      layout === "historical"
        ? join(dirname(stateFile), "config.json")
        : taskConfigPath(state);
    writeScopedConfig(path, { ...readScopedConfig(path), deleteMode: mode });
  }

  /** Resolve a workflow setting with its existing default. */
  function effectiveSetting<K extends "mode" | "autoCommit" | "manualReview">(
    state: TaskState,
    key: K,
  ): K extends "mode" ? "manual" | "semi-auto" : boolean {
    const fallback = key === "mode" ? "manual" : key === "manualReview";
    return (effectiveConfig(state)[key] ?? fallback) as K extends "mode"
      ? "manual" | "semi-auto"
      : boolean;
  }

  /** Read and validate global settings, including startup-only rules. */
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
    if (
      values.autoCommit !== undefined &&
      typeof values.autoCommit !== "boolean"
    )
      throw new Error(`autoCommit must be a boolean: ${path}`);
    if (
      values.allowTreeNavigation !== undefined &&
      typeof values.allowTreeNavigation !== "boolean"
    )
      throw new Error(`allowTreeNavigation must be a boolean: ${path}`);
    if (values.phaseTools !== undefined) {
      if (
        !values.phaseTools ||
        typeof values.phaseTools !== "object" ||
        Array.isArray(values.phaseTools)
      )
        throw new Error(`phaseTools must be an object: ${path}`);
      for (const [phase, tools] of Object.entries(values.phaseTools)) {
        if (
          !(
            [
              "research",
              "roadmap",
              "prepare",
              "implement",
              "review",
              "manual-review",
              "commit",
            ] as string[]
          ).includes(phase)
        )
          throw new Error(`Unknown phaseTools phase ${phase}: ${path}`);
        if (
          !Array.isArray(tools) ||
          tools.some(
            (tool) =>
              typeof tool !== "string" || !/^[A-Za-z0-9_:-]+$/.test(tool),
          )
        )
          throw new Error(
            `phaseTools.${phase} must be an array of tool names: ${path}`,
          );
      }
    }
    if (values.additionalPhaseTools !== undefined) {
      if (
        !values.additionalPhaseTools ||
        typeof values.additionalPhaseTools !== "object" ||
        Array.isArray(values.additionalPhaseTools)
      )
        throw new Error(`additionalPhaseTools must be an object: ${path}`);
      for (const [phase, tools] of Object.entries(
        values.additionalPhaseTools,
      )) {
        if (
          !(
            [
              "research",
              "roadmap",
              "prepare",
              "implement",
              "review",
              "manual-review",
              "commit",
            ] as string[]
          ).includes(phase)
        )
          throw new Error(
            `Unknown additionalPhaseTools phase ${phase}: ${path}`,
          );
        if (
          !Array.isArray(tools) ||
          tools.some(
            (tool) =>
              typeof tool !== "string" || !/^[A-Za-z0-9_:-]+$/.test(tool),
          )
        )
          throw new Error(
            `additionalPhaseTools.${phase} must be an array of tool names: ${path}`,
          );
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
          !["research", "roadmap", "prepare", "implement", "review"].includes(
            phase,
          )
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
            ![
              "off",
              "minimal",
              "low",
              "medium",
              "high",
              "xhigh",
              "max",
            ].includes(settings.thinkingLevel))
        )
          throw new Error(
            `Invalid phaseModels.${phase}.thinkingLevel: ${path}`,
          );
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

  /** Resolve startup bindings from global settings and reject duplicate keys. */
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
  return {
    parseStatusColor,
    readScopedConfig,
    updateTaskConfig,
    effectiveConfig,
    effectiveDeletionMode,
    setTaskDeletionMode,
    effectiveSetting,
    readConfig,
    configuredHotkeys,
  };
}
