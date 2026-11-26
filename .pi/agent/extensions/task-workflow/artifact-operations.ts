import { randomUUID } from "node:crypto";
import {
  existsSync,
  linkSync,
  lstatSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

/** Operation to apply to a Markdown task artifact. */
export type ArtifactOperation =
  "create" | "append" | "replace_text" | "replace";

const OPERATIONS = new Set<ArtifactOperation>([
  "create",
  "append",
  "replace_text",
  "replace",
]);
const CUSTOM_FILENAME = /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,116}\.md$/iu;
const STANDARD_FILENAME = new Set(["context.md", "roadmap.md"]);

/**
 * Validates a custom artifact basename and rejects names owned by the workflow.
 * Custom names cannot contain paths and must end in `.md`, keeping all writes in the task context.
 */
export function validateCustomArtifactFilename(filename: string): void {
  if (!CUSTOM_FILENAME.test(filename))
    throw new Error(
      "Custom artifact names must be Markdown basenames with no path separators.",
    );
  const normalized = filename.toLowerCase();
  if (
    STANDARD_FILENAME.has(normalized) ||
    /^step-\d+\.md$/.test(normalized) ||
    /^step-result-\d+\.md$/.test(normalized) ||
    /^review-\d+-round-\d+\.md$/.test(normalized)
  )
    throw new Error(
      "Custom artifacts cannot use a standard artifact filename.",
    );
}

/**
 * Verifies the task context directory is fixed beneath the project root and follows no symlinks.
 */
export function validateTaskContextDirectory(
  projectRoot: string,
  taskId: string,
  taskContextDirectory: string,
): string {
  if (!taskId || taskId !== taskId.trim() || /[\\/]/.test(taskId))
    throw new Error("Invalid task ID for the artifact directory.");
  const root = resolve(projectRoot);
  const expected = resolve(root, ".agents", "task-workflow", taskId, "context");
  const actual = resolve(taskContextDirectory);
  const relativePath = relative(root, expected);
  if (
    !isAbsolute(projectRoot) ||
    actual !== expected ||
    !relativePath ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`)
  )
    throw new Error(
      "Task artifacts must remain in the fixed project-local context directory.",
    );

  let current = root;
  for (const part of relativePath.split(sep)) {
    current = join(current, part);
    const info = lstatSync(current);
    if (info.isSymbolicLink() || !info.isDirectory())
      throw new Error(`Refusing an unsafe task artifact directory: ${current}`);
  }
  return actual;
}

/**
 * Resolves a validated custom Markdown basename inside the fixed task context directory.
 */
export function customArtifactPath(
  taskContextDirectory: string,
  filename: string,
): string {
  validateCustomArtifactFilename(filename);
  return join(taskContextDirectory, filename);
}

function readArtifact(path: string): string | undefined {
  try {
    const info = lstatSync(path);
    if (info.isSymbolicLink())
      throw new Error(`Refusing to read a symbolic link: ${path}`);
    if (!info.isFile())
      throw new Error(`Artifact is not a regular file: ${path}`);
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT")
      return undefined;
    throw error;
  }
}

function writeExistingArtifact(
  path: string,
  temporaryDirectory: string,
  content: string,
): string {
  try {
    if (lstatSync(path).isSymbolicLink())
      throw new Error(`Refusing to replace a symbolic link: ${path}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code !== "ENOENT") throw error;
  }
  const temporary = join(temporaryDirectory, `.task-write-${randomUUID()}.tmp`);
  try {
    writeFileSync(
      temporary,
      content.endsWith("\n") ? content : `${content}\n`,
      {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      },
    );
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) rmSync(temporary);
  }
  return path;
}

function createArtifact(
  path: string,
  temporaryDirectory: string,
  content: string,
): string {
  const temporary = join(temporaryDirectory, `.task-write-${randomUUID()}.tmp`);
  try {
    writeFileSync(
      temporary,
      content.endsWith("\n") ? content : `${content}\n`,
      {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      },
    );
    try {
      linkSync(temporary, path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException | null)?.code === "EEXIST")
        throw new Error(`Artifact already exists: ${path}`);
      throw error;
    }
  } finally {
    if (existsSync(temporary)) rmSync(temporary);
  }
  return path;
}

/**
 * Applies one explicit artifact operation using atomic writes and refuses symlink targets.
 * `create` requires a missing file; update operations require an existing regular file.
 * `replace_text` requires one exact partial match for `oldText`.
 */
export function writeArtifactOperation({
  path,
  temporaryDirectory,
  operation,
  content,
  oldText,
}: {
  path: string;
  temporaryDirectory: string;
  operation: ArtifactOperation;
  content: string;
  oldText?: string;
}): string {
  if (!OPERATIONS.has(operation))
    throw new Error(`Unknown artifact operation: ${operation}`);
  const targetText = oldText ?? "";
  if (operation === "replace_text" && !targetText)
    throw new Error("oldText is required for the replace_text operation.");
  if (operation !== "replace_text" && oldText !== undefined)
    throw new Error("oldText is only valid for the replace_text operation.");

  const existing = readArtifact(path);
  if (operation === "create") {
    if (existing !== undefined)
      throw new Error(`Artifact already exists: ${path}`);
    return createArtifact(path, temporaryDirectory, content);
  }
  if (existing === undefined)
    throw new Error(`Artifact does not exist: ${path}`);
  if (operation === "replace")
    return writeExistingArtifact(path, temporaryDirectory, content);
  if (operation === "append") {
    const separator = existing && !existing.endsWith("\n") ? "\n" : "";
    return writeExistingArtifact(
      path,
      temporaryDirectory,
      `${existing}${separator}${content}`,
    );
  }

  if (targetText === existing || targetText === existing.trimEnd())
    throw new Error(
      "replace_text cannot replace the entire artifact; use replace instead.",
    );
  const firstMatch = existing.indexOf(targetText);
  if (firstMatch < 0)
    throw new Error("oldText was not found in the artifact; nothing changed.");
  if (existing.indexOf(targetText, firstMatch + 1) >= 0)
    throw new Error(
      "oldText matches more than once in the artifact; nothing changed.",
    );
  const updated =
    existing.slice(0, firstMatch) +
    content +
    existing.slice(firstMatch + targetText.length);
  return writeExistingArtifact(path, temporaryDirectory, updated);
}

/**
 * Checks whether a saved session's phase label remains valid for the task's current phase.
 * Commit sessions continue as Manual review or Complete without creating another session.
 */
export function sessionPhaseMatches(
  linkedPhase: string,
  taskPhase: string,
): boolean {
  return (
    linkedPhase === taskPhase ||
    (linkedPhase === "commit" &&
      (taskPhase === "manual-review" || taskPhase === "complete")) ||
    (linkedPhase === "collect" && taskPhase === "research")
  );
}

/**
 * Adds the internal artifact tool after phase-specific allowlists, including in Commit and Complete.
 * Complete remains limited to artifact editing; other phases retain their configured tools.
 */
export function includeArtifactTool(
  phase: string,
  baseTools: string[],
  additionalTools: string[],
  artifactTool: string,
): string[] {
  if (phase === "complete") return [artifactTool];
  return [...new Set([...baseTools, artifactTool, ...additionalTools])];
}
