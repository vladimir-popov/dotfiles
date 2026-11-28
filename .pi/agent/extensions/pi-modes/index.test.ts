import assert from "node:assert/strict";
import { test } from "node:test";
import readOnlyModeExtension from "./index.ts";

type Handler = (...args: any[]) => any;

function createHarness(options: {
  tools?: string[];
  activeTools?: string[];
  confirm?: () => Promise<boolean>;
  idle?: boolean;
  draft?: string;
} = {}) {
  const events = new Map<string, Handler>();
  let commandHandler: Handler | undefined;
  const shortcuts = new Map<string, Handler>();
  let draft = options.draft ?? "";
  let activeTools = options.activeTools ?? ["read", "bash", "write", "custom"]; 
  const notifications: string[] = [];
  const statuses = new Map<string, string | undefined>();
  let confirmations = 0;

  const pi = {
    on(name: string, handler: Handler) {
      events.set(name, handler);
    },
    registerCommand(_name: string, command: { handler: Handler }) {
      commandHandler = command.handler;
    },
    registerShortcut(key: string, shortcut: { handler: Handler }) {
      shortcuts.set(key, shortcut.handler);
    },
    getActiveTools: () => [...activeTools],
    getSettings: () => ({
      "pi-modes": {
        readOnlyTools: ["read", "grep", "find", "ls", "web_search", "fetch_content", "get_search_content", "docs_search", "missing_custom"],
        editingTools: ["write", "edit", "bash"],
      },
    }),
    setActiveTools: (tools: string[]) => {
      activeTools = [...tools];
    },
    getAllTools: () => (options.tools ?? ["read", "grep", "find", "ls", "bash", "write", "custom"])
      .map((name) => ({ name })),
  };
  const context = {
    hasUI: true,
    isIdle: () => options.idle ?? true,
    ui: {
      getEditorText: () => draft,
      setEditorText: (text: string) => { draft = text; },
      notify: (message: string) => notifications.push(message),
      setStatus: (key: string, value: string | undefined) => statuses.set(key, value),
      confirm: async () => {
        confirmations++;
        return options.confirm ? options.confirm() : true;
      },
    },
  };

  readOnlyModeExtension(pi as never);
  return {
    command: async (args = "") => commandHandler!(args, context),
    press: async (key: string) => {
      const handler = shortcuts.get(key);
      assert.ok(handler, `Expected shortcut ${key}`);
      await handler(context);
    },
    event: (name: string) => name === "session_start"
      ? (...args: any[]) => events.get(name)!(args[0] ?? {}, context)
      : events.get(name)!,
    context,
    notifications,
    statuses,
    activeTools: () => [...activeTools],
    confirmations: () => confirmations,
  };
}

test("/ro command toggles, sets, reports, and rejects invalid arguments", async () => {
  const harness = createHarness();
  await harness.event("session_start")();
  await harness.command();
  assert.deepEqual(harness.activeTools(), ["read", "grep", "find", "ls"]);
  assert.equal(harness.statuses.get("pi-modes"), "👀");
  await harness.command(" STATUS ");
  assert.match(harness.notifications.at(-1)!, /is on/);

  await harness.command("off");
  assert.deepEqual(harness.activeTools(), ["read", "bash", "write", "custom"]);
  assert.equal(harness.statuses.get("pi-modes"), "⁉️ (custom)");
  await harness.command("ON");
  assert.deepEqual(harness.activeTools(), ["read", "grep", "find", "ls"]);
  const stateBeforeInvalid = harness.activeTools();
  await harness.command("invalid");
  await harness.command("off extra");
  assert.deepEqual(harness.activeTools(), stateBeforeInvalid);
  assert.match(harness.notifications.at(-1)!, /Usage:/);
});

for (const idle of [true, false]) {
  test(`Alt+R toggles and preserves the editor draft while ${idle ? "idle" : "working"}`, async () => {
    const draft = "Inspect the implementation.\nThen explain the trade-offs.";
    const harness = createHarness({ idle, draft, activeTools: ["read", "write"] });
    await harness.event("session_start")();
    const write = () => harness.event("tool_call")({ toolName: "write", input: {} }, harness.context);

    await harness.press("alt+r");
    assert.deepEqual(harness.activeTools(), ["read", "grep", "find", "ls"]);
    assert.equal(harness.statuses.get("pi-modes"), "👀");
    assert.equal((await write())?.block, true);
    assert.equal(harness.context.ui.getEditorText(), draft);
    await harness.command("status");
    assert.match(harness.notifications.at(-1)!, /is on/);

    await harness.press("alt+r");
    assert.deepEqual(harness.activeTools(), ["read", "write"]);
    assert.equal(harness.statuses.get("pi-modes"), "🚀");
    assert.equal(await write(), undefined);
    assert.equal(harness.context.ui.getEditorText(), draft);
  });
}

test("status classifies active tools and lists unknown tools", async () => {
  const knownTools = ["read", "write", "bash", "custom", "other"];
  const writableHarness = createHarness({ tools: knownTools, activeTools: ["read", "write"] });
  await writableHarness.event("session_start")();
  assert.equal(writableHarness.statuses.get("pi-modes"), "🚀");

  const harness = createHarness({ tools: knownTools });
  await harness.event("session_start")();
  assert.equal(harness.statuses.get("pi-modes"), "⁉️ (custom)");
  await harness.command("on");
  assert.equal(harness.statuses.get("pi-modes"), "👀");
});

test("read-only mode permits configured research tools and blocks other tools", async () => {
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
});

test("configured web and custom tools work when present and absent", async () => {
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
