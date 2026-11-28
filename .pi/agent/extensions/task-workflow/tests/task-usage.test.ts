import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it, type TestContext } from "node:test";
import { formatTaskUsage } from "../src/task-usage.ts";

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "task-usage-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, "sessions");
  mkdirSync(dir);
  const header = JSON.stringify({ type: "session", version: 3 });
  function save(file: string, ...entries: unknown[]) {
    writeFileSync(
      file,
      [header, ...entries.map((entry) => JSON.stringify(entry)), ""].join("\n"),
    );
    return file;
  }
  return { root, dir, save };
}

function usage(input: number, total: number) {
  return { input, output: 1, cacheRead: 2, cacheWrite: 3, cost: { total } };
}

it("adds up all saved branches and known sessions without counting fork history twice", (t) => {
  const { root, dir, save } = fixture(t);
  const assistant = {
    type: "message",
    id: "assistant",
    timestamp: "2026-01-01T00:00:00.000Z",
    message: { role: "assistant", usage: usage(8_000, 0.1) },
  };
  const abandoned = {
    type: "branch_summary",
    parentId: "earlier",
    usage: usage(90, 0.02),
  };
  const original = save(join(dir, "original.jsonl"), assistant, abandoned);
  save(
    join(dir, "fork.jsonl"),
    { ...assistant, parentId: null },
    {
      type: "compaction",
      usage: usage(90, 0.03),
    },
  );
  save(join(dir, "archived-review.jsonl"), {
    type: "message",
    message: { role: "toolResult", usage: usage(90, 0.04) },
  });
  const legacy = save(join(root, "legacy.jsonl"), {
    type: "usage",
    usage: usage(100, 0.01),
  });
  writeFileSync(join(dir, "ignored.txt"), "not a session");

  assert.equal(
    formatTaskUsage(dir, [original, original, legacy]),
    "~ 8.4k tokens · $0.200",
  );
});

it("preserves readable usage and marks the result partial for broken or missing sessions", (t) => {
  const { dir, save } = fixture(t);
  save(join(dir, "good.jsonl"), { type: "usage", usage: usage(10, 0.001) });
  writeFileSync(
    join(dir, "broken.jsonl"),
    '{"type":"session"}\nnot JSON\n' +
      JSON.stringify({ type: "usage", usage: usage(10, 0.001) }) +
      "\n",
  );
  assert.equal(
    formatTaskUsage(dir, [join(dir, "missing.jsonl")]),
    "32 tokens · $0.002 (partial)",
  );
});

it("reports zero usage before any calls", (t) => {
  const { dir } = fixture(t);
  assert.equal(formatTaskUsage(dir, []), "0 tokens · $0.000");
});
