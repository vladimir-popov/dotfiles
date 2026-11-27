import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import {
  assertSafeTaskContextPath,
  assertSafeTaskStatePath,
  checkTaskLayout,
  loadState,
  saveState,
  taskLayoutForPath,
  taskStatePath,
} from "../src/task-state.ts";

test("saves version-1 state explicitly at the current canonical path", (t) => {
  const root = mkdtempSync(join(tmpdir(), "task-state-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, ".agents", "task-workflow", "sample");
  const path = join(dir, "state.json");
  const state = {
    version: 1,
    id: "sample",
    projectRoot: root,
    contextPath: join(dir, "context", "context.md"),
    phase: "research",
    currentStep: 1,
    completedSteps: [],
  } as const;
  const initial = { ...state, completedSteps: [] };
  mkdirSync(dirname(state.contextPath), { recursive: true });
  writeFileSync(state.contextPath, "# Sample\n");
  assert.equal(taskStatePath(initial), path);
  saveState(initial);
  assert.equal(
    readFileSync(path, "utf8"),
    `${JSON.stringify(initial, null, 2)}\n`,
  );
  assert.deepEqual(loadState(path), initial);
  assert.deepEqual(taskLayoutForPath(root, path), {
    layout: "current",
    id: "sample",
  });
  assertSafeTaskStatePath(root, path);
  assertSafeTaskContextPath(root, initial, "current");
  assert.equal(checkTaskLayout(path), undefined);
  writeFileSync(path, JSON.stringify({ ...initial, version: 2 }));
  assert.throws(() => loadState(path), {
    message: `Invalid task state: ${path}`,
  });
});

test("recognizes historical layout and normalizes legacy manual review without writing", (t) => {
  const root = mkdtempSync(join(tmpdir(), "task-state-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, ".agents", "projects", "legacy");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "state.json");
  const contextPath = join(dir, "notes.md");
  writeFileSync(contextPath, "# Legacy\n");
  const { manualReviewPending, ...state } = {
    version: 1,
    id: "legacy",
    projectRoot: root,
    contextPath,
    phase: "commit",
    currentStep: 3,
    completedSteps: [1],
    manualReviewPending: true,
    sessions: {
      commit: { "3": "legacy-session" },
      manualReview: { "3": ["previous"] },
    },
  };
  const raw = JSON.stringify({ ...state, manualReviewPending });
  writeFileSync(path, raw);
  const expected = {
    ...state,
    phase: "manual-review",
    sessions: {
      ...state.sessions,
      manualReview: { "3": ["previous", "legacy-session"] },
    },
  };
  assert.deepEqual(loadState(path), expected);
  assert.deepEqual(loadState(path, false), expected);
  assert.equal(readFileSync(path, "utf8"), raw);
  assert.deepEqual(taskLayoutForPath(root, path), {
    layout: "historical",
    id: "legacy",
  });
  assertSafeTaskStatePath(root, path);
  assertSafeTaskContextPath(root, loadState(path), "historical");
  assert.match(checkTaskLayout(path)!, /contextPath must be/);
  assert.throws(
    () => assertSafeTaskStatePath(root, join(dir, "nested", "state.json")),
    /outside a recognized task layout/,
  );
});
