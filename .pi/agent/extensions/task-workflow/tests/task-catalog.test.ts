import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import type { TaskState } from "../src/phase-model.ts";
import { listTasksDetailed, rememberTask } from "../src/task-catalog.ts";

test("bounds discovery to project and indexed roots, deduplicates candidates, and reports stale records", (t) => {
  const base = mkdtempSync(join(tmpdir(), "task-catalog-"));
  const oldAgentDir = process.env.PI_CODING_AGENT_DIR;
  const agentDir = join(base, "agent");
  process.env.PI_CODING_AGENT_DIR = agentDir;
  t.after(() => {
    if (oldAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = oldAgentDir;
    rmSync(base, { recursive: true, force: true });
  });

  function fixture(
    project: string,
    id: string,
    layout = "task-workflow",
    stale = false,
  ) {
    const projectRoot = join(base, project);
    const dir = join(projectRoot, ".agents", layout, id);
    const path = join(dir, "state.json");
    const contextPath = join(
      dir,
      ...(layout === "projects" ? [] : ["context"]),
      "context.md",
    );
    const state: TaskState = {
      version: 1,
      id,
      projectRoot,
      contextPath,
      phase: "research",
      currentStep: 1,
      completedSteps: [],
    };
    mkdirSync(dirname(contextPath), { recursive: true });
    if (!stale) writeFileSync(path, JSON.stringify(state));
    return { state, path };
  }

  const active = fixture("active", "current");
  const historical = fixture("active", "current", "projects");
  const indexed = fixture("indexed", "remote");
  const stale = fixture("indexed", "stale", "task-workflow", true);
  fixture("unindexed", "unseen");
  for (const { state, path } of [active, indexed, stale])
    rememberTask(state, path);
  const indexDir = join(agentDir, "task-workflow-index");
  const duplicate = join(indexDir, "duplicate.json");
  const raw = JSON.stringify({
    id: indexed.state.id,
    projectRoot: indexed.state.projectRoot,
    statePath: indexed.path,
  });
  writeFileSync(duplicate, raw);
  const projectSettings = '{"mode":"semi-auto"}\n';
  const localConfig = join(dirname(dirname(active.path)), "config.json");
  const indexedConfig = join(dirname(dirname(indexed.path)), "config.json");
  writeFileSync(localConfig, projectSettings);
  writeFileSync(indexedConfig, projectSettings);

  const local = listTasksDetailed(active.state.projectRoot);
  assert.deepEqual(local.issues, []);
  assert.deepEqual(
    local.tasks.map(({ path }) => path),
    [resolve(active.path)],
  );
  assert.deepEqual(
    local.historical.map(({ path }) => path),
    [resolve(historical.path)],
  );
  const global = listTasksDetailed(active.state.projectRoot, "global");
  assert.deepEqual(
    global.tasks.map(({ path }) => path),
    [resolve(active.path), resolve(indexed.path)],
  );
  assert.deepEqual(global.historical, []);
  assert.ok(!global.issues.some(({ path }) => path.endsWith("/config.json")));
  assert.equal(readFileSync(localConfig, "utf8"), projectSettings);
  assert.equal(readFileSync(indexedConfig, "utf8"), projectSettings);
  assert.equal(global.indexRecords.length, 4);
  assert.ok(
    global.indexIssues.some(
      ({ record, reason }) =>
        record?.statePath === stale.path && reason.includes("missing"),
    ),
  );
  assert.equal(readFileSync(duplicate, "utf8"), raw);
  assert.equal(
    readFileSync(indexed.path, "utf8"),
    JSON.stringify(indexed.state),
  );

  const movedRoot = join(base, "moved");
  renameSync(indexed.state.projectRoot, movedRoot);
  const moved = listTasksDetailed(movedRoot);
  assert.equal(
    moved.tasks[0]?.relocatedFrom,
    resolve(indexed.state.projectRoot),
  );
  const afterMove = listTasksDetailed(active.state.projectRoot);
  assert.deepEqual(afterMove.issues, []);
  assert.ok(
    afterMove.indexIssues.some(
      ({ record, missingProjectRoot }) =>
        record?.statePath === indexed.path && missingProjectRoot,
    ),
  );

  const historicalConfig = join(
    dirname(dirname(historical.path)),
    "config.json",
  );
  const unexpectedFile = join(dirname(localConfig), "unexpected.txt");
  writeFileSync(historicalConfig, projectSettings);
  writeFileSync(unexpectedFile, "not a task");
  rmSync(localConfig);
  symlinkSync(unexpectedFile, localConfig);
  assert.deepEqual(
    listTasksDetailed(active.state.projectRoot)
      .issues.map(({ path }) => path)
      .sort(),
    [historicalConfig, unexpectedFile, localConfig]
      .map((path) => resolve(path))
      .sort(),
  );
});
