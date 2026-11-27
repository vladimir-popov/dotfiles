import assert from "node:assert/strict";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import workingSkillsExtension from "./index.ts";

function harness(hasUI = true) {
  const cwd = resolve("project");
  const skills = [
    { name: "ticket", filePath: resolve(cwd, "skills/task/SKILL.md") },
    { name: "jira-markup", filePath: resolve(homedir(), "skills/jira-markup/SKILL.md") },
  ];
  const messages: (string | undefined)[] = [];
  type Handler = (event: unknown, context: unknown) => void;
  const events = new Map<string, Handler>();
  const ctx = {
    cwd,
    hasUI,
    ui: { setWorkingMessage: (message?: string) => messages.push(message) },
  };
  workingSkillsExtension({ on: (name: string, handler: Handler) => events.set(name, handler) } as never);
  assert.equal(events.has("tool_call"), false, "status updates must not intercept tool calls");

  const begin = (catalog = skills) =>
    events.get("before_agent_start")!({ systemPromptOptions: { skills: catalog } }, ctx);
  begin();

  return {
    begin,
    messages,
    call: (toolCallId: string, path: string, toolName = "read") =>
      events.get("tool_execution_start")!({ toolCallId, toolName, args: { path } }, ctx),
    finish: (toolCallId: string, isError = false) =>
      events.get("tool_execution_end")!({ toolCallId, isError }, ctx),
    settle: () => events.get("agent_settled")!({}, ctx),
  };
}

test("shows successful skill reads once, including nested and parallel reads", () => {
  const h = harness();
  h.call("a", "@skills/task/SKILL.md");
  h.call("codemode/1", "~/skills/jira-markup/SKILL.md");
  assert.deepEqual(h.messages, []);

  h.finish("codemode/1");
  h.finish("a");
  h.call("b", "skills/task/SKILL.md");
  h.finish("b");
  assert.deepEqual(h.messages, [
    "Working · skills: jira-markup",
    "Working · skills: jira-markup, ticket",
  ]);
});

test("ignores failed, unrelated, and non-read calls", () => {
  const h = harness();
  h.call("a", "skills/task/SKILL.md");
  h.call("b", "other/SKILL.md");
  h.call("c", "skills/task/SKILL.md", "edit");
  h.finish("a", true);
  h.finish("b");
  h.finish("c");
  h.settle();
  assert.deepEqual(h.messages, []);
});

test("settling restores the default and clears the activity state", () => {
  const h = harness();
  h.call("a", "skills/task/SKILL.md");
  h.finish("a");
  h.call("pending", "~/skills/jira-markup/SKILL.md");
  h.settle();
  h.finish("pending");
  h.call("b", "skills/task/SKILL.md");
  h.finish("b");
  assert.deepEqual(h.messages, ["Working · skills: ticket", undefined, "Working · skills: ticket"]);
});

test("refreshes the skill catalog from the next run's prompt options", () => {
  const h = harness();
  h.settle();
  h.begin([]);
  h.call("a", "skills/task/SKILL.md");
  h.finish("a");
  assert.deepEqual(h.messages, []);
});

test("does nothing without a UI", () => {
  const h = harness(false);
  h.call("a", "skills/task/SKILL.md");
  h.finish("a");
  h.settle();
  assert.deepEqual(h.messages, []);
});
