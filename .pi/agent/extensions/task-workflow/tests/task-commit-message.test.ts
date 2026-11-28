import assert from "node:assert/strict";
import { it } from "node:test";
import type { TaskState } from "../src/phase-model.ts";
import { parseCommitMessage } from "../src/task-commit-message.ts";

const state: TaskState = {
  version: 1,
  id: "example",
  projectRoot: "/project",
  contextPath: "/project/context.md",
  phase: "commit",
  currentStep: 1,
  completedSteps: [],
  pendingFiles: ["src/example.ts"],
  pendingSummary: "Use the reviewed value.",
};

it("keeps a title-only response without substituting a body", () => {
  assert.deepEqual(
    parseCommitMessage(" \r\nUse the new value\r\n ", state, 1),
    {
      title: "Use the new value",
      body: "",
    },
  );
});

it("accepts a body without a separator and retains its paragraphs", () => {
  const text = "Use the new value\r\nFirst paragraph.\r\n\r\nSecond paragraph.";
  assert.deepEqual(parseCommitMessage(text, state, 1), {
    title: "Use the new value",
    body: "First paragraph.\n\nSecond paragraph.",
  });
});

it("marks the deterministic fallback when the model returns no title", () => {
  assert.deepEqual(parseCommitMessage(" \n\t\n", state, 1), {
    title: "Update example.ts",
    body: "Use the reviewed value.",
    fallback: true,
  });
});
