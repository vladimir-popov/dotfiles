import assert from "node:assert/strict";
import { test } from "node:test";
import readOnlyModeExtension from "./index.ts";

type Handler = (...args: any[]) => any;

function createHarness(options: { tools?: string[]; confirm?: () => Promise<boolean> } = {}) {
  const events = new Map<string, Handler>();
  let commandHandler: Handler | undefined;
  let activeTools = ["read", "bash", "write", "custom"];
  const notifications: string[] = [];
  let confirmations = 0;

  const pi = {
    on(name: string, handler: Handler) {
      events.set(name, handler);
    },
    registerCommand(_name: string, command: { handler: Handler }) {
      commandHandler = command.handler;
    },
    getActiveTools: () => [...activeTools],
    setActiveTools: (tools: string[]) => {
      activeTools = [...tools];
    },
    getAllTools: () => (options.tools ?? ["read", "grep", "find", "ls", "bash", "write", "custom"])
      .map((name) => ({ name })),
  };
  const context = {
    hasUI: true,
    ui: {
      notify: (message: string) => notifications.push(message),
      confirm: async () => {
        confirmations++;
        return options.confirm ? options.confirm() : true;
      },
    },
  };

  readOnlyModeExtension(pi as never);
  return {
    command: async (args = "") => commandHandler!(args, context),
    event: (name: string) => events.get(name)!,
    context,
    notifications,
    activeTools: () => [...activeTools],
    confirmations: () => confirmations,
  };
}

test("/ro command toggles, sets, reports, and rejects invalid arguments", async () => {
  const harness = createHarness();
  await harness.event("session_start")();
  await harness.command();
  assert.deepEqual(harness.activeTools(), ["read", "grep", "find", "ls"]);
  await harness.command(" STATUS ");
  assert.match(harness.notifications.at(-1)!, /is on/);

  await harness.command("off");
  assert.deepEqual(harness.activeTools(), ["read", "bash", "write", "custom"]);
  await harness.command("ON");
  assert.deepEqual(harness.activeTools(), ["read", "grep", "find", "ls"]);
  const stateBeforeInvalid = harness.activeTools();
  await harness.command("invalid");
  await harness.command("off extra");
  assert.deepEqual(harness.activeTools(), stateBeforeInvalid);
  assert.match(harness.notifications.at(-1)!, /Usage:/);
});

test("read-only mode permits built-in and configured research tools, blocks other tools", async () => {
  process.env.PI_READONLY_TOOLS = "docs_search";
  try {
    const harness = createHarness({
      tools: ["read", "grep", "find", "ls", "bash", "write", "docs_search"],
    });
    await harness.event("session_start")();
    await harness.command("on");
    const toolCall = harness.event("tool_call");
    for (const toolName of ["read", "grep", "find", "ls", "docs_search"]) {
      assert.equal(await toolCall({ toolName, input: {} }, harness.context), undefined);
    }
    for (const toolName of ["write", "edit", "custom"]) {
      assert.equal((await toolCall({ toolName, input: {} }, harness.context))?.block, true);
    }
  } finally {
    delete process.env.PI_READONLY_TOOLS;
  }
});

test("optional web tools and configured names work when present and absent", async () => {
  process.env.PI_READONLY_TOOLS = "docs_search,missing_custom";
  try {
    const harness = createHarness({
      tools: ["read", "bash", "web_search", "fetch_content", "get_search_content", "docs_search"],
    });
    await harness.event("session_start")();
    await harness.command("on");
    const toolCall = harness.event("tool_call");
    for (const toolName of ["web_search", "fetch_content", "get_search_content"]) {
      assert.equal(await toolCall({ toolName, input: {} }, harness.context), undefined);
    }
    assert.equal(await toolCall({ toolName: "docs_search", input: {} }, harness.context), undefined);
    assert.equal(await toolCall({ toolName: "missing_custom", input: {} }, harness.context), undefined);
    assert.deepEqual(harness.activeTools(), [
      "read", "web_search", "fetch_content", "get_search_content", "docs_search",
    ]);
  } finally {
    delete process.env.PI_READONLY_TOOLS;
  }
});

test("Bash approval is requested for each exact command and cannot authorize a changed command", async () => {
  let approve = true;
  const harness = createHarness({ confirm: async () => approve });
  await harness.event("session_start")();
  await harness.command("on");
  const toolCall = harness.event("tool_call");

  assert.equal(await toolCall({ toolName: "bash", input: { command: "pwd" } }, harness.context), undefined);
  approve = false;
  assert.equal((await toolCall({ toolName: "bash", input: { command: "pwd" } }, harness.context))?.block, true);
  assert.equal(harness.confirmations(), 2);

  let resolveConfirmation!: (approved: boolean) => void;
  const pendingHarness = createHarness({ confirm: () => new Promise((resolve) => { resolveConfirmation = resolve; }) });
  await pendingHarness.event("session_start")();
  await pendingHarness.command("on");
  const input = { command: "pwd" };
  const pending = pendingHarness.event("tool_call")({ toolName: "bash", input }, pendingHarness.context);
  input.command = "rm -rf target";
  resolveConfirmation(true);
  assert.equal((await pending)?.block, true);
});

test("Bash remains blocked without an interactive UI", async () => {
  const harness = createHarness();
  await harness.event("session_start")();
  await harness.command("on");
  const result = await harness.event("tool_call")(
    { toolName: "bash", input: { command: "pwd" } },
    { ...harness.context, hasUI: false },
  );
  assert.equal(result?.block, true);
  assert.equal(harness.confirmations(), 0);
});
