import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import type { TaskState } from "./phase-model.ts";
import {
  assertSafeTaskContextPath,
  assertSafeTaskRoot,
  assertSafeTaskStatePath,
  loadState,
  pathWithin,
  runtimeDir,
  statePath,
  taskDir,
  taskLayoutForPath,
  taskStatePath,
  validateDiscoveredState,
  validateTaskId,
  type TaskLayout,
} from "./task-state.ts";

type TaskDiscoveryIssue = { path: string; reason: string };

/** An index locator and the original bytes used for later revalidation. */
export type TaskIndexRecord = {
  id: string;
  projectRoot: string;
  statePath: string;
  indexPath: string;
  rawContent: string;
};

type TaskIndexEntrySnapshot = {
  dev: number;
  ino: number;
  mode: number;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  kind: "directory" | "other";
};

/** An unusable index entry and any evidence available to revalidate its removal. */
export type TaskIndexIssue = {
  path: string;
  reason: string;
  record?: TaskIndexRecord;
  rawContent?: string;
  symlinkTarget?: string;
  entrySnapshot?: TaskIndexEntrySnapshot;
};

/** A validated discovery candidate, not authorization to open or delete a task. */
export type DiscoveredTask = {
  state: TaskState;
  path: string;
  layout?: TaskLayout;
  discoveredRoot?: string;
  relocatedFrom?: string;
};

/** Current and historical candidates, with index and discovery diagnostics. */
export type TaskDiscoveryResult = {
  tasks: DiscoveredTask[];
  historical: DiscoveredTask[];
  issues: TaskDiscoveryIssue[];
  indexIssues: TaskIndexIssue[];
  indexRecords: TaskIndexRecord[];
};

/** Restrict discovery to this project or include roots named by valid records. */
export type TaskDiscoveryScope = "project" | "global";

/** Return the index directory for the active Pi agent directory. */
export function taskIndexDir(): string {
  return join(
    process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"),
    "task-workflow-index",
  );
}

/** Explicitly write a discovery locator without modifying project-local state. */
export function rememberTask(state: TaskState, path: string): void {
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

function readTaskIndexRecords(
  issues: TaskDiscoveryIssue[],
  indexIssues: TaskIndexIssue[] = [],
): TaskIndexRecord[] {
  const directory = taskIndexDir();
  try {
    const info = lstatSync(directory);
    if (info.isSymbolicLink() || !info.isDirectory())
      throw new Error("Task index root is not a regular directory.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    issues.push({ path: directory, reason: String(error) });
    return [];
  }

  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    issues.push({ path: directory, reason: String(error) });
    return [];
  }
  const records: TaskIndexRecord[] = [];
  for (const entry of entries) {
    const indexPath = join(directory, entry.name);
    if (!entry.name.endsWith(".json")) continue;
    if (entry.isSymbolicLink()) {
      const reason = "Symbolic links are not followed in the task index.";
      issues.push({ path: indexPath, reason });
      try {
        indexIssues.push({
          path: indexPath,
          reason,
          symlinkTarget: readlinkSync(indexPath),
        });
      } catch {
        /* Keep the issue visible but do not make an unverifiable link actionable. */
      }
      continue;
    }
    if (!entry.isFile()) {
      const reason = "Task index records must be regular files.";
      issues.push({ path: indexPath, reason });
      try {
        const info = lstatSync(indexPath);
        indexIssues.push({
          path: indexPath,
          reason,
          entrySnapshot: {
            dev: info.dev,
            ino: info.ino,
            mode: info.mode,
            size: info.size,
            mtimeMs: info.mtimeMs,
            ctimeMs: info.ctimeMs,
            kind: info.isDirectory() ? "directory" : "other",
          },
        });
      } catch {
        /* Keep entries without a stable snapshot visible but not actionable. */
      }
      continue;
    }
    let rawContent: string | undefined;
    try {
      rawContent = readFileSync(indexPath, "utf8");
      const record = JSON.parse(rawContent) as {
        id?: unknown;
        projectRoot?: unknown;
        statePath?: unknown;
      };
      if (
        typeof record.id !== "string" ||
        typeof record.projectRoot !== "string" ||
        typeof record.statePath !== "string" ||
        !isAbsolute(record.projectRoot) ||
        !isAbsolute(record.statePath)
      )
        throw new Error("Malformed task index record.");
      validateTaskId(record.id);
      const layout = taskLayoutForPath(record.projectRoot, record.statePath);
      if (!layout || layout.id !== record.id)
        throw new Error(
          "Index record points outside a recognized layout or task ID.",
        );
      const validRecord = {
        id: record.id,
        projectRoot: record.projectRoot,
        statePath: record.statePath,
        indexPath,
        rawContent,
      };
      records.push(validRecord);
      try {
        lstatSync(validRecord.statePath);
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code === "ENOENT" &&
          existsSync(validRecord.projectRoot)
        )
          indexIssues.push({
            path: indexPath,
            reason: `Indexed task state is missing: ${validRecord.statePath}`,
            record: validRecord,
            rawContent,
          });
      }
    } catch (error) {
      const reason = String(error);
      issues.push({ path: indexPath, reason });
      indexIssues.push({ path: indexPath, reason, rawContent });
    }
  }
  return records;
}

function indexedStatePaths(root: string, records: TaskIndexRecord[]): string[] {
  return records
    .filter((record) => resolve(record.projectRoot) === resolve(root))
    .map((record) => record.statePath);
}

function indexedProjectRoots(
  activeRoot: string,
  records: TaskIndexRecord[],
): string[] {
  return [
    ...new Set([
      resolve(activeRoot),
      ...records.map((record) => resolve(record.projectRoot)),
    ]),
  ];
}

function relocatedIndexedStatePaths(
  root: string,
  records: TaskIndexRecord[],
  issues: TaskDiscoveryIssue[],
): string[] {
  const paths: string[] = [];
  for (const record of records) {
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
    else
      issues.push({
        path: movedPath,
        reason: `Indexed state file from ${oldRoot} was not found after relocation.`,
      });
  }
  return paths;
}

/** Recognize a candidate under the current root when the saved root no longer exists. */
export function relocatedProjectRoot(
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

function scanTaskLayout(
  root: string,
  layout: TaskLayout,
  issues: TaskDiscoveryIssue[],
): string[] {
  const directory =
    layout === "current"
      ? join(root, ".agents", "task-workflow")
      : join(root, ".agents", "projects");
  const agentsDirectory = join(root, ".agents");
  try {
    const agentsInfo = lstatSync(agentsDirectory);
    if (agentsInfo.isSymbolicLink() || !agentsInfo.isDirectory())
      throw new Error("Task storage root is not a regular directory.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    issues.push({ path: agentsDirectory, reason: String(error) });
    return [];
  }
  try {
    const info = lstatSync(directory);
    if (info.isSymbolicLink() || !info.isDirectory())
      throw new Error("Task layout root is not a regular directory.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    issues.push({ path: directory, reason: String(error) });
    return [];
  }

  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    issues.push({ path: directory, reason: String(error) });
    return [];
  }
  const paths: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      issues.push({
        path: join(directory, entry.name),
        reason: "Symbolic links are not followed during task discovery.",
      });
      continue;
    }
    if (!entry.isDirectory()) {
      issues.push({
        path: join(directory, entry.name),
        reason: entry.isFile()
          ? "Expected a task directory; found a regular file."
          : "Expected a task directory; found a non-directory entry.",
      });
      continue;
    }
    const path = statePath(join(directory, entry.name));
    try {
      assertSafeTaskStatePath(root, path);
      paths.push(path);
    } catch (error) {
      issues.push({ path, reason: String(error) });
    }
  }
  return paths;
}

function isSafeTaskDiscoveryRoot(
  root: string,
  issues: TaskDiscoveryIssue[],
): boolean {
  try {
    assertSafeTaskRoot(root);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    issues.push({ path: root, reason: String(error) });
    return false;
  }
}

/** Read candidates locally or across index-known roots; do not authorize task access. */
export function listTasksDetailed(
  root: string,
  scope: TaskDiscoveryScope = "project",
): TaskDiscoveryResult {
  const issues: TaskDiscoveryIssue[] = [];
  const indexIssues: TaskIndexIssue[] = [];
  const indexRecords = readTaskIndexRecords(issues, indexIssues);
  // Global discovery is bounded to the active root and roots from valid records.
  const roots =
    scope === "global"
      ? indexedProjectRoots(root, indexRecords)
      : [resolve(root)];
  const safeRoots = roots.filter((searchRoot) =>
    isSafeTaskDiscoveryRoot(searchRoot, issues),
  );
  const candidates: Array<{ root: string; path: string }> = [];
  for (const searchRoot of safeRoots) {
    const paths = [
      ...scanTaskLayout(searchRoot, "current", issues),
      ...scanTaskLayout(searchRoot, "historical", issues),
      ...indexedStatePaths(searchRoot, indexRecords),
    ];
    candidates.push(...paths.map((path) => ({ root: searchRoot, path })));
  }
  if (safeRoots.includes(resolve(root)))
    candidates.push(
      ...relocatedIndexedStatePaths(resolve(root), indexRecords, issues).map(
        (path) => ({ root: resolve(root), path }),
      ),
    );

  const tasks = new Map<string, DiscoveredTask>();
  const historical = new Map<string, DiscoveredTask>();
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const searchRoot = resolve(candidate.root);
    const path = resolve(candidate.path);
    const candidateKey = `${searchRoot}\0${path}`;
    if (seen.has(candidateKey)) continue;
    seen.add(candidateKey);
    const layout = taskLayoutForPath(searchRoot, path);
    if (!layout) {
      issues.push({
        path: candidate.path,
        reason: "State path is outside the recognized task layouts.",
      });
      continue;
    }
    try {
      assertSafeTaskStatePath(searchRoot, path);
      const state = loadState(path, false);
      validateDiscoveredState(state);
      assertSafeTaskContextPath(searchRoot, state, layout.layout);
      if (state.id !== layout.id) {
        throw new Error(
          `State task ID ${state.id} does not match its directory ${layout.id}.`,
        );
      }
      const task: DiscoveredTask = {
        state,
        path,
        layout: layout.layout,
        discoveredRoot: searchRoot,
      };
      if (resolve(state.projectRoot) !== searchRoot) {
        const previousRoot = relocatedProjectRoot(state, path, searchRoot);
        if (!previousRoot || layout.layout !== "current") {
          issues.push({
            path,
            reason: "Saved project root does not match the discovered project.",
          });
          continue;
        }
        task.relocatedFrom = previousRoot;
      } else if (
        layout.layout === "current" &&
        resolve(taskStatePath(state)) !== path
      ) {
        throw new Error("Current task state path does not match its layout.");
      }
      const destination = layout.layout === "current" ? tasks : historical;
      const key = `${searchRoot}\0${state.id}`;
      const existing = destination.get(key);
      if (!existing || existing.relocatedFrom) destination.set(key, task);
    } catch (error) {
      issues.push({ path, reason: String(error) });
    }
  }
  if (scope === "global") {
    // Prefer the current layout when both layouts contain the same task identity.
    for (const key of tasks.keys()) historical.delete(key);
  }
  const sortTasks = (items: Map<string, DiscoveredTask>) =>
    [...items.values()].sort(
      (a, b) =>
        a.state.id.localeCompare(b.state.id) ||
        (a.discoveredRoot || "").localeCompare(b.discoveredRoot || ""),
    );
  const uniqueIssues = new Map<string, TaskDiscoveryIssue>();
  for (const issue of issues)
    uniqueIssues.set(`${issue.path}\0${issue.reason}`, issue);
  for (const record of indexRecords) {
    if (!existsSync(record.projectRoot)) continue;
    const relatedIssue = [...uniqueIssues.values()].find(
      (issue) => resolve(issue.path) === resolve(record.statePath),
    );
    if (
      !relatedIssue ||
      indexIssues.some((issue) => issue.path === record.indexPath)
    )
      continue;
    try {
      indexIssues.push({
        path: record.indexPath,
        reason: relatedIssue.reason,
        record,
        rawContent: readFileSync(record.indexPath, "utf8"),
      });
    } catch {
      indexIssues.push({
        path: record.indexPath,
        reason: relatedIssue.reason,
        record,
      });
    }
  }
  return {
    tasks: sortTasks(tasks),
    historical: sortTasks(historical),
    issues: [...uniqueIssues.values()],
    indexIssues,
    indexRecords,
  };
}

/** Return the canonical index record path for a project root and task ID. */
export function taskIndexPath(root: string, id: string): string {
  return join(
    taskIndexDir(),
    `${createHash("sha256").update(`${root}\0${id}`).digest("hex")}.json`,
  );
}

/** Recheck the selected index entry against the observed evidence without modifying it. */
export function taskIndexSnapshotMatches(issue: TaskIndexIssue): boolean {
  try {
    const directory = resolve(taskIndexDir());
    const rootInfo = lstatSync(directory);
    if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) return false;
    const path = resolve(issue.path);
    if (dirname(path) !== directory || !basename(path).endsWith(".json"))
      return false;
    const info = lstatSync(path);
    if (info.isSymbolicLink())
      return (
        issue.symlinkTarget !== undefined &&
        readlinkSync(path) === issue.symlinkTarget
      );
    if (info.isFile())
      return (
        issue.rawContent !== undefined &&
        readFileSync(path, "utf8") === issue.rawContent
      );
    const snapshot = issue.entrySnapshot;
    const kind = info.isDirectory() ? "directory" : "other";
    return (
      snapshot !== undefined &&
      snapshot.kind === kind &&
      snapshot.dev === info.dev &&
      snapshot.ino === info.ino &&
      snapshot.mode === info.mode &&
      snapshot.size === info.size &&
      snapshot.mtimeMs === info.mtimeMs &&
      snapshot.ctimeMs === info.ctimeMs
    );
  } catch {
    return false;
  }
}

/** Remove only the selected index entry after revalidation, never task data. */
export function removeBrokenTaskIndexEntry(issue: TaskIndexIssue): void {
  if (!taskIndexSnapshotMatches(issue))
    throw new Error(
      `Task index entry changed or is unsafe; no files were removed: ${issue.path}`,
    );
  const info = lstatSync(issue.path);
  if (info.isDirectory() && !info.isSymbolicLink()) {
    rmdirSync(issue.path);
    return;
  }
  rmSync(issue.path);
}

/** Find records matching both the task identity and the selected state path. */
export function taskIndexRecordsForTask(
  records: TaskIndexRecord[],
  state: TaskState,
  statePath: string,
): TaskIndexRecord[] {
  return records.filter(
    (record) =>
      record.id === state.id &&
      resolve(record.projectRoot) === resolve(state.projectRoot) &&
      resolve(record.statePath) === resolve(statePath),
  );
}

/** Refuse when the selected index mappings have changed since discovery. */
export function assertTaskIndexRecordsUnchanged(
  selectedRecords: TaskIndexRecord[],
  state: TaskState,
  statePath: string,
): void {
  const issues: TaskDiscoveryIssue[] = [];
  const currentRecords = taskIndexRecordsForTask(
    readTaskIndexRecords(issues),
    state,
    statePath,
  );
  if (currentRecords.length !== selectedRecords.length)
    throw new Error(
      `Task index mapping changed; run /task list all again before deleting ${state.id}.`,
    );
  for (const selected of selectedRecords) {
    const current = currentRecords.find(
      (record) => resolve(record.indexPath) === resolve(selected.indexPath),
    );
    if (
      !current ||
      current.rawContent !== selected.rawContent ||
      !taskIndexSnapshotMatches({
        path: selected.indexPath,
        reason: "Selected task index mapping changed.",
        record: selected,
        rawContent: selected.rawContent,
      })
    )
      throw new Error(
        `Task index mapping changed; run /task list all again before deleting ${state.id}.`,
      );
  }
}
