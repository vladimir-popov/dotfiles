import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

/** Run Git in the given directory and expose Git diagnostics on failure. */
export function git(root: string, args: string[]): string {
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

/** Resolve the Git worktree root, falling back to the supplied working directory. */
export function projectRoot(cwd: string): string {
  try {
    return git(cwd, ["rev-parse", "--show-toplevel"]);
  } catch {
    return cwd;
  }
}

/** Check that the supplied project root is itself the Git worktree root. */
export function hasGitRepository(root: string): boolean {
  try {
    return (
      resolve(git(root, ["rev-parse", "--show-toplevel"])) === resolve(root)
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

/** Exclude a project-local task runtime in the repository’s local Git settings. */
export function ignoreRuntimeDirectory(
  root: string,
  directory: string,
): boolean {
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

/** Compare two entries (or absence) and normalize output paths to the worktree name. */
export function diffNoIndex(
  root: string,
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
        cwd: root,
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
