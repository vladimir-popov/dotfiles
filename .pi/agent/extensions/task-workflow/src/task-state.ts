import { existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { setSessionFor, TASK_PHASES, type TaskState } from "./phase-model.ts";

const taskPhaseNames: ReadonlySet<string> = new Set(TASK_PHASES);

/** Recognized project-local layouts; only the current layout is used for new tasks. */
export type TaskLayout = "current" | "historical";

/** Return the canonical runtime directory for a current-layout task. */
export function defaultRuntimeDir(root: string, id: string): string {
  return join(root, ".agents", "task-workflow", id);
}

/** Return the current-layout artifact directory inside the runtime directory. */
export function defaultArtifactDir(root: string, id: string): string {
  return join(defaultRuntimeDir(root, id), "context");
}

/** Return the canonical artifact directory, independent of the stored context path. */
export function taskDir(state: TaskState): string {
  return defaultArtifactDir(state.projectRoot, state.id);
}

/** Return the canonical runtime directory from the saved project root and task ID. */
export function runtimeDir(state: TaskState): string {
  return defaultRuntimeDir(state.projectRoot, state.id);
}

/** Return the canonical save path; this does not relocate or validate the record. */
export function taskStatePath(state: TaskState): string {
  return statePath(runtimeDir(state));
}

/** Return the state filename inside a supplied runtime directory. */
export function statePath(dir: string): string {
  return join(dir, "state.json");
}

/** Return the canonical directory for saved task sessions. */
export function sessionDirectory(state: TaskState): string {
  return join(runtimeDir(state), "sessions");
}

/** Reject identifiers that do not match the task naming rules. */
export function validateTaskId(id: string): void {
  if (id.trim() !== id || !/^[A-Za-z0-9][A-Za-z0-9._ -]*$/.test(id)) {
    throw new Error(
      "Task ID may contain letters, digits, dots, underscores, hyphens, and internal spaces. Quote IDs with spaces.",
    );
  }
}

/** Report a noncanonical context path for an existing state file. */
export function checkTaskLayout(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  const data = JSON.parse(readFileSync(path, "utf8")) as TaskState;
  const expectedContext = join(
    defaultArtifactDir(data.projectRoot, data.id),
    "context.md",
  );
  if (resolve(data.contextPath) !== resolve(expectedContext))
    return `Task ${data.id} contextPath must be ${expectedContext}.`;
  return undefined;
}

/**
 * Decode version-1 state and normalize legacy preparation and manual-review
 * markers in memory. Loading never rewrites saved state or session files.
 */
export function loadState(path: string, maintainLegacyFiles = true): TaskState {
  const data = JSON.parse(readFileSync(path, "utf8")) as TaskState & {
    implementationStarted?: boolean;
  };
  if (
    data.version !== 1 ||
    !data.id ||
    !data.projectRoot ||
    !data.contextPath ||
    !Array.isArray(data.completedSteps)
  ) {
    throw new Error(`Invalid task state: ${path}`);
  }
  const step = String(data.currentStep);
  // Older tasks could be saved before the start flag or baseline existed.
  if (
    data.phase === "implement" &&
    (data.implementationStarted === false ||
      (data.implementationStarted === undefined &&
        !data.pendingBaselineDir &&
        !data.sessions?.prepare?.[step]))
  ) {
    data.phase = "prepare";
    const legacySession = data.sessions?.implement?.[step];
    if (legacySession) {
      setSessionFor(data, "prepare", legacySession);
      delete data.sessions!.implement![step];
    }
  }
  delete data.implementationStarted;
  if (data.phase === "commit" && data.manualReviewPending) {
    const step = String(data.currentStep);
    const legacySession = data.sessions?.commit?.[step];
    data.phase = "manual-review";
    if (legacySession) {
      const sessions = ((data.sessions ??= {}).manualReview ??= {});
      sessions[step] = [...(sessions[step] || []), legacySession];
    }
    delete data.manualReviewPending;
  }
  return data;
}

/** Write state to its canonical path; the runtime directory must already exist. */
export function saveState(state: TaskState): void {
  const path = taskStatePath(state);
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

/** Recognize a current or historical state path lexically, without checking the filesystem. */
export function taskLayoutForPath(
  root: string,
  path: string,
): { layout: TaskLayout; id: string } | undefined {
  const parts = relative(resolve(root), resolve(path)).split(sep);
  if (parts.length !== 4 || parts[0] !== ".agents" || parts[3] !== "state.json")
    return undefined;
  if (parts[1] === "task-workflow") return { layout: "current", id: parts[2] };
  if (parts[1] === "projects") return { layout: "historical", id: parts[2] };
  return undefined;
}

/** Require an existing project root that is a directory, not a symlink. */
export function assertSafeTaskRoot(root: string): void {
  const rootPath = resolve(root);
  const info = lstatSync(rootPath);
  if (info.isSymbolicLink())
    throw new Error(`Refusing to follow symbolic link: ${rootPath}`);
  if (!info.isDirectory()) throw new Error("Project root is not a directory.");
}

/**
 * Require a regular state file in a recognized layout. Reject symlinks at the
 * supplied root and below it; ancestors above the root are not checked.
 */
export function assertSafeTaskStatePath(root: string, path: string): void {
  const layout = taskLayoutForPath(root, path);
  if (!layout)
    throw new Error("State path is outside a recognized task layout.");
  const rootPath = resolve(root);
  assertSafeTaskRoot(rootPath);
  const parts = relative(rootPath, resolve(path)).split(sep);
  let current = rootPath;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    const info = lstatSync(current);
    if (info.isSymbolicLink())
      throw new Error(`Refusing to follow symbolic link: ${current}`);
    if (!info.isDirectory())
      throw new Error(`Expected a directory in task path: ${current}`);
  }
  const info = lstatSync(resolve(path));
  if (info.isSymbolicLink())
    throw new Error(`Refusing to follow symbolic link: ${resolve(path)}`);
  if (!info.isFile())
    throw new Error(`Task state is not a file: ${resolve(path)}`);
}

/** Apply the stricter format checks used for discovery, without authorizing task access. */
export function validateDiscoveredState(state: TaskState): void {
  if (
    typeof state.id !== "string" ||
    typeof state.projectRoot !== "string" ||
    typeof state.contextPath !== "string" ||
    !isAbsolute(state.projectRoot) ||
    !isAbsolute(state.contextPath) ||
    !taskPhaseNames.has(state.phase) ||
    !Number.isInteger(state.currentStep) ||
    state.currentStep < 1 ||
    !Array.isArray(state.completedSteps) ||
    !state.completedSteps.every((step) => Number.isInteger(step) && step > 0)
  )
    throw new Error("Task state has an unsupported or malformed format.");
  validateTaskId(state.id);
}

/**
 * Validate the saved context against its layout and check existing components at the
 * discovered root. Missing components are allowed; symlinks and wrong file types are not.
 */
export function assertSafeTaskContextPath(
  root: string,
  state: TaskState,
  layout: TaskLayout,
): void {
  const savedTaskDirectory =
    layout === "current"
      ? defaultArtifactDir(state.projectRoot, state.id)
      : join(state.projectRoot, ".agents", "projects", state.id);
  const expectedContext =
    layout === "current" ? join(savedTaskDirectory, "context.md") : undefined;
  if (
    (expectedContext &&
      resolve(state.contextPath) !== resolve(expectedContext)) ||
    (!expectedContext &&
      !pathWithin(savedTaskDirectory, resolve(state.contextPath)))
  )
    throw new Error("Task context path is outside its recognized layout.");

  const contextPath =
    resolve(state.projectRoot) === resolve(root)
      ? resolve(state.contextPath)
      : resolve(root, relative(state.projectRoot, resolve(state.contextPath)));
  if (!pathWithin(resolve(root), contextPath))
    throw new Error("Task context path is outside the discovered project.");
  const parts = relative(resolve(root), contextPath).split(sep);
  let current = resolve(root);
  for (let index = 0; index < parts.length; index++) {
    current = join(current, parts[index]);
    let info;
    try {
      info = lstatSync(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    if (info.isSymbolicLink())
      throw new Error(`Refusing to follow symbolic link: ${current}`);
    if (index === parts.length - 1) {
      if (!info.isFile())
        throw new Error(`Task context is not a file: ${current}`);
    } else if (!info.isDirectory()) {
      throw new Error(`Expected a directory in task context path: ${current}`);
    }
  }
}

/** Test lexical containment, including equality; does not resolve symlinks. */
export function pathWithin(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return (
    path === "" ||
    (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
  );
}
