import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  customArtifactPath as resolveCustomArtifactPath,
  validateTaskContextDirectory,
  writeArtifactOperation as applyArtifactOperation,
  type ArtifactOperation,
} from "./artifact-operations.ts";
import type { TaskState } from "./phase-model.ts";
import { taskDir } from "./task-state.ts";

/** List sorted Markdown basenames of regular files in the task context. */
export function markdownArtifacts(state: TaskState): string[] {
  return readdirSync(taskDir(state), { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"),
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Return the canonical roadmap artifact path. */
export function roadmapPath(state: TaskState): string {
  return join(taskDir(state), "roadmap.md");
}

/** Return the design artifact path for a numbered step. */
export function stepPath(state: TaskState, n: number): string {
  return join(taskDir(state), `step-${n}.md`);
}

/** Return the durable result artifact path for a numbered step. */
export function stepResultPath(state: TaskState, n: number): string {
  return join(taskDir(state), `step-result-${n}.md`);
}

/** Return paths for earlier step results that exist on disk. */
export function previousStepResultPaths(
  state: TaskState,
  step: number,
): string[] {
  return Array.from({ length: Math.max(0, step - 1) }, (_, index) =>
    stepResultPath(state, index + 1),
  ).filter(existsSync);
}

/** Return the review artifact path for a step and round. */
export function reviewPath(
  state: TaskState,
  n: number,
  round = state.reviewRound ?? 0,
): string {
  return join(taskDir(state), `review-${n}-round-${round}.md`);
}

/** Standard task artifact categories; custom artifacts are selected separately. */
export type ArtifactKind =
  "context" | "roadmap" | "step" | "step-result" | "review";

/** Resolve a standard artifact path; selecting it does not authorize access. */
export function artifactPath(
  state: TaskState,
  kind: ArtifactKind,
  step?: number,
): string {
  if (kind === "context") return state.contextPath;
  if (kind === "roadmap") return roadmapPath(state);
  if (kind === "review")
    return reviewPath(state, step || state.awaitingReview || state.currentStep);
  if (kind === "step-result")
    return stepResultPath(state, step || state.currentStep);
  return stepPath(state, step || state.currentStep);
}

function writeArtifactFile(
  state: TaskState,
  path: string,
  content: string,
): string {
  validateTaskContextDirectory(state.projectRoot, state.id, taskDir(state));
  try {
    if (lstatSync(path).isSymbolicLink())
      throw new Error(`Refusing to replace a symbolic link: ${path}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
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
  return path;
}

/** Apply a tool-requested operation after path checks, without updating workflow state. */
export function applyTaskArtifact(
  state: TaskState,
  kind: ArtifactKind | "custom",
  operation: ArtifactOperation,
  content: string,
  step?: number,
  filename?: string,
  oldText?: string,
): { path: string; targetStep: number } {
  if (kind === "custom") {
    if (!filename)
      throw new Error("A filename is required for custom artifacts.");
    if (step !== undefined)
      throw new Error("The step argument is not valid for custom artifacts.");
  } else if (filename !== undefined) {
    throw new Error("filename is only valid for custom artifacts.");
  }
  if (step !== undefined && (kind === "context" || kind === "roadmap"))
    throw new Error(
      "The step argument is only valid for step, step-result, and review artifacts.",
    );
  const targetStep =
    kind === "review"
      ? step || state.awaitingReview || state.currentStep
      : step || state.currentStep;
  const path =
    kind === "custom"
      ? resolveCustomArtifactPath(taskDir(state), filename!)
      : artifactPath(state, kind, step);
  if (
    kind === "context" &&
    resolve(path) !== resolve(taskDir(state), "context.md")
  )
    throw new Error(
      "Task context must be stored inside the fixed task context directory.",
    );
  validateTaskContextDirectory(state.projectRoot, state.id, taskDir(state));
  applyArtifactOperation({
    path,
    temporaryDirectory: taskDir(state),
    operation,
    content,
    oldText,
  });
  return { path, targetStep };
}

/** Write a trusted generated artifact, without updating workflow state. */
export function writeGeneratedArtifact(
  state: TaskState,
  kind: ArtifactKind,
  content: string,
  step?: number,
): { path: string; targetStep: number } {
  if (step !== undefined && (kind === "context" || kind === "roadmap"))
    throw new Error(
      "The step argument is only valid for step, step-result, and review artifacts.",
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
      "Task context must be stored inside the fixed task context directory.",
    );
  }
  writeArtifactFile(state, path, content);
  return { path, targetStep };
}
