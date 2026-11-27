import { createHash } from "node:crypto";
import {
  constants as fsConstants,
  promises as fsPromises,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import picomatch from "picomatch";
import type { TaskState } from "./phase-model.ts";
import {
  DEFAULT_SNAPSHOT_MAX_FILES,
  DEFAULT_SNAPSHOT_MAX_MIB,
  type Config,
} from "./task-config.ts";
import { git, diffNoIndex } from "./task-git.ts";
import { runtimeDir, taskDir } from "./task-state.ts";

function exclusions(state: TaskState): string[] {
  const paths = [taskDir(state), runtimeDir(state), state.contextPath];
  return paths.flatMap((path) => {
    const rel = relative(state.projectRoot, path);
    return rel && rel !== ".." && !rel.startsWith(`..${sep}`)
      ? [`:(exclude)${rel}`]
      : [];
  });
}

/** Local baseline manifest and snapshot paths used to reconstruct implementation changes. */
export type Baseline = {
  directory: string;
  paths: Map<string, string | null>;
  hashes: Map<string, string | null>;
  gitRepository: boolean;
};

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

function createFileFilter(
  includes: string[] | undefined,
  excludes: string[],
): (file: string) => boolean {
  const includeMatchers = includes?.map((pattern) => picomatch(pattern));
  const excludeMatchers = excludes.map((pattern) => ({
    negated: pattern.startsWith("!"),
    matcher: picomatch(pattern.startsWith("!") ? pattern.slice(1) : pattern),
  }));
  return (file) => {
    const normalized = file.split(sep).join("/");
    const included =
      !includeMatchers ||
      includeMatchers.some((matches) => matches(normalized));
    let excluded = false;
    for (const { negated, matcher } of excludeMatchers) {
      if (matcher(normalized)) excluded = !negated;
    }
    return included && !excluded;
  };
}

/** Enumerate changed Git paths, excluding task state and artifact paths. */
export function changedPaths(state: TaskState): string[] {
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
      // Keep both paths of a staged rename visible to exact-path checks.
      "--no-renames",
      "-z",
      "--",
      ".",
      ...exclusions(state),
    ]).split("\0"),
  ];
  return [...new Set(paths.filter(Boolean))];
}

/** Capture filtered worktree entries within the effective snapshot limits. */
export async function captureBaseline(
  state: TaskState,
  gitRepository: boolean,
  config: Config,
  onProgress?: (message: string) => void,
): Promise<Baseline> {
  const maxFiles = config.snapshotMaxFiles ?? DEFAULT_SNAPSHOT_MAX_FILES;
  const maxMiB = config.snapshotMaxMiB ?? DEFAULT_SNAPSHOT_MAX_MIB;
  const includes = config.include?.length ? config.include : undefined;
  const excludes = config.exclude ?? [];
  const matchesFilters = createFileFilter(includes, excludes);
  const files = (
    gitRepository
      ? changedPaths(state)
      : [...(await projectFiles(state, onProgress))]
  ).filter(matchesFilters);
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

/** Load a previously captured baseline, including legacy manifest data. */
export function loadBaseline(directory: string): Baseline {
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

function worktreeEntry(path: string) {
  try {
    return lstatSync(path, { throwIfNoEntry: false });
  } catch (error) {
    // A tracked descendant is also absent when an ancestor was replaced by a file.
    if ((error as NodeJS.ErrnoException).code === "ENOTDIR") return undefined;
    throw error;
  }
}

/** Generate baseline-relative diff text and the corresponding changed paths. */
export async function implementationDiff(
  state: TaskState,
  baseline: Baseline,
  config: Config,
  onProgress?: (message: string) => void,
): Promise<{ diff: string; files: string[] }> {
  const parts: string[] = [];
  const files: string[] = [];
  const includes = config.include?.length ? config.include : undefined;
  const excludes = config.exclude ?? [];
  const matchesFilters = createFileFilter(includes, excludes);
  const currentFiles = baseline.gitRepository
    ? undefined
    : await projectFiles(state, onProgress);
  const candidates = (
    baseline.gitRepository
      ? changedPaths(state)
      : [...new Set([...baseline.paths.keys(), ...currentFiles!])]
  ).filter(matchesFilters);
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
        state.projectRoot,
        baseline.paths.get(file) || null,
        currentFiles!.has(file) ? current : null,
        file,
      );
    } else if (baseline.paths.has(file)) {
      const before = baseline.paths.get(file) || null;
      patch = diffNoIndex(
        state.projectRoot,
        before,
        existsSync(current) ? current : null,
        file,
      );
    } else {
      const tracked = git(state.projectRoot, ["ls-files", "--", file]);
      patch = tracked
        ? git(state.projectRoot, ["diff", "--binary", "HEAD", "--", file])
        : diffNoIndex(state.projectRoot, null, current, file);
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
  const entry = worktreeEntry(path);
  if (!entry || entry.isDirectory()) return null;
  // Hash the link itself, as Git does, rather than the contents at its target.
  if (entry.isSymbolicLink())
    return `symlink:${createHash("sha256")
      .update(readlinkSync(path, { encoding: "buffer" }))
      .digest("hex")}`;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Hash the worktree entry with its type, including symlink or missing entries. */
export function reviewFileHash(root: string, file: string): string {
  const hash = fileHash(root, file);
  if (hash === null) return "missing";
  return hash.startsWith("symlink:") ? hash : `file:${hash}`;
}

/** Recognize an untyped legacy SHA-256 digest. */
export function isLegacyReviewDigest(
  hash: string | null | undefined,
): hash is string {
  return typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash);
}

/** Verify a saved Commit digest, retaining compatibility with legacy evidence. */
export function matchesManualCommitHash(
  root: string,
  file: string,
  expected: string | null | undefined,
): boolean {
  const actual = reviewFileHash(root, file);
  if (expected === "missing") {
    if (actual !== "missing") return false;
    // A submodule checkout looks like a directory on disk but is a gitlink in HEAD.
    const entry = git(root, [
      "--literal-pathspecs",
      "ls-tree",
      "--full-tree",
      "HEAD",
      "--",
      file,
    ]);
    return !/^\d+ (?:blob|commit) /.test(entry);
  }
  if (actual === expected) return true;
  if (expected === null) return actual === "missing";
  if (!isLegacyReviewDigest(expected)) return false;
  if (actual === `file:${expected}`) return true;
  if (!actual.startsWith("symlink:")) return false;
  // Older ready Commit states stored the digest of the file the symlink resolved to.
  // Keep that comparison only for legacy expectations, never for link-aware hashes.
  const path = join(root, file);
  return (
    existsSync(path) &&
    statSync(path).isFile() &&
    createHash("sha256").update(readFileSync(path)).digest("hex") === expected
  );
}

/** Verify the reviewed path set and digests before staging and committing those paths only. */
export function commitStep(
  state: TaskState,
  title: string,
  body: string,
): string {
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
    if (
      reviewFileHash(state.projectRoot, file) !== state.pendingHashes?.[file]
    ) {
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
