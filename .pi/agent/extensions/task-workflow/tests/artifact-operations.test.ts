import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  customArtifactPath,
  includeArtifactTool,
  sessionPhaseMatches,
  validateTaskContextDirectory,
  writeArtifactOperation,
  type ArtifactOperation,
} from "../artifact-operations.ts";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "task-workflow-artifact-test-"));
  const context = join(root, ".agents", "task-workflow", "task-id", "context");
  mkdirSync(context, { recursive: true });
  temporaryRoots.push(root);
  return { root, context };
}

function write(
  context: string,
  filename: string,
  operation: ArtifactOperation,
  content: string,
  oldText?: string,
) {
  return writeArtifactOperation({
    path: join(context, filename),
    temporaryDirectory: context,
    operation,
    content,
    oldText,
  });
}

describe("artifact operations", () => {
  it("creates a missing artifact and refuses to overwrite an existing one", () => {
    const { context } = fixture();
    const path = write(context, "notes.md", "create", "First line");
    assert.equal(readFileSync(path, "utf8"), "First line\n");
    assert.throws(
      () => write(context, "notes.md", "create", "Other"),
      /already exists/,
    );
    assert.equal(readFileSync(path, "utf8"), "First line\n");
  });

  it("appends content while preserving the existing artifact", () => {
    const { context } = fixture();
    const path = join(context, "notes.md");
    writeFileSync(path, "First line");
    write(context, "notes.md", "append", "Second line");
    assert.equal(readFileSync(path, "utf8"), "First line\nSecond line\n");
  });

  it("replaces one exact partial match and rejects absent, duplicate, or whole-file matches", () => {
    const { context } = fixture();
    const path = join(context, "notes.md");
    writeFileSync(path, "alpha beta alpha\n");
    write(context, "notes.md", "replace_text", "gamma", "beta");
    assert.equal(readFileSync(path, "utf8"), "alpha gamma alpha\n");
    assert.throws(
      () => write(context, "notes.md", "replace_text", "x", "missing"),
      /not found/,
    );
    assert.throws(
      () => write(context, "notes.md", "replace_text", "x", "alpha"),
      /more than once/,
    );
    assert.throws(
      () =>
        write(context, "notes.md", "replace_text", "x", "alpha gamma alpha\n"),
      /use replace/,
    );
  });

  it("fully replaces an existing artifact and does not create a missing one", () => {
    const { context } = fixture();
    const path = join(context, "notes.md");
    writeFileSync(path, "Old body\n");
    write(context, "notes.md", "replace", "New body");
    assert.equal(readFileSync(path, "utf8"), "New body\n");
    assert.throws(
      () => write(context, "missing.md", "replace", "body"),
      /does not exist/,
    );
  });

  it("rejects symlink and non-file targets", () => {
    const { context, root } = fixture();
    const outside = join(root, "outside.md");
    const linked = join(context, "linked.md");
    writeFileSync(outside, "protected\n");
    symlinkSync(outside, linked);
    assert.throws(
      () => write(context, "linked.md", "replace", "changed"),
      /symbolic link/,
    );
    assert.equal(readFileSync(outside, "utf8"), "protected\n");
    assert.throws(
      () => write(context, ".", "append", "changed"),
      /regular file/,
    );
  });
});

describe("custom artifact confinement", () => {
  it("rejects symlinked task-context ancestors", () => {
    const { root } = fixture();
    const artifacts = join(root, ".agents");
    const external = join(root, "project-code");
    mkdirSync(join(external, "task-workflow", "task-id", "context"), {
      recursive: true,
    });
    rmSync(artifacts, { recursive: true });
    symlinkSync(external, artifacts);
    assert.throws(
      () =>
        validateTaskContextDirectory(
          root,
          "task-id",
          join(artifacts, "task-workflow", "task-id", "context"),
        ),
      /unsafe task artifact directory/,
    );
  });

  it("resolves only Markdown basenames inside the task context", () => {
    const { context } = fixture();
    assert.equal(
      customArtifactPath(context, "notes.md"),
      join(context, "notes.md"),
    );
    for (const filename of [
      "../state.json",
      "state.json",
      "implementation-1.diff",
      "sessions/session.md",
      "../../src/project.md",
      "step-1.md",
      "step-result-1.md",
      "review-1-round-0.md",
      "roadmap.md",
    ])
      assert.throws(() => customArtifactPath(context, filename));
  });
});

describe("phase artifact access", () => {
  it("accepts the saved Commit session after transition to Complete", () => {
    assert.equal(sessionPhaseMatches("commit", "complete"), true);
    assert.equal(sessionPhaseMatches("commit", "manual-review"), true);
    assert.equal(sessionPhaseMatches("collect", "research"), true);
    assert.equal(sessionPhaseMatches("review", "complete"), false);
  });

  it("keeps the artifact tool available across every phase and tool override", () => {
    const phases = [
      "research",
      "roadmap",
      "implement",
      "review",
      "manual-review",
      "commit",
      "complete",
    ];
    for (const phase of phases) {
      const allowed = includeArtifactTool(
        phase,
        ["read"],
        ["search"],
        "task_write_artifact",
      );
      assert.ok(allowed.includes("task_write_artifact"), phase);
      if (phase !== "complete")
        assert.deepEqual(allowed, ["read", "task_write_artifact", "search"]);
      else assert.deepEqual(allowed, ["task_write_artifact"]);
    }
  });
});
