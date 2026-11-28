import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { it, type TestContext } from "node:test";
import { taskExtension } from "./load-task-extension.ts";

const id = "context-test";
const contextMarker = "TASK_CONTEXT_CONTENT_SENTINEL";
const noteMarker = "SUPPORTING_NOTE_CONTENT_SENTINEL";
const transcriptMarker = "OLD_DISCUSSION_SENTINEL";
const stalePath = "/old/project/context/context.md";
const baselineSource = "export const value = 1;\n";
const codingDesign = "# Step 1\n\nUse the new value.\n";
const roadmap = "1. **Update value** — Update the example.\n";

type Host = Parameters<typeof taskExtension>[0];
type Handler = Parameters<Host["registerCommand"]>[1]["handler"];
type CommandContext = Parameters<Handler>[1];
type ArtifactTool = Parameters<Host["registerTool"]>[0];
type Phase =
  | "research"
  | "roadmap"
  | "prepare"
  | "implement"
  | "review"
  | "manual-review"
  | "commit"
  | "complete";
type Message = {
  customType: string;
  content: string;
  display: boolean;
  details?: unknown;
};
type Delivered = Message & { triggerTurn: boolean; session: string };
type State = {
  phase: Phase;
  currentStep?: number;
  implementationStarted?: boolean;
  commitReady?: boolean;
  interruptedSession?: string;
  completedSteps?: readonly number[];
  pendingBaselineDir?: string;
  pendingHashes?: Record<string, string | null>;
  commitPendingHashes?: Record<string, string | null>;
  reviewPending?: boolean;
  reviewRound?: number;
  sessions?: Record<string, unknown>;
};

function fixture(
  t: TestContext,
  startup?: {
    global: { hotkeys: Record<string, string | null> };
    project: { hotkeys: Record<string, string | null> };
    task: { hotkeys: Record<string, string | null> };
  },
) {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), "phase-context-test-")));
  const cwd = join(temp, "project");
  mkdirSync(cwd);
  const previousDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = temp;
  t.after(() => {
    if (previousDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousDir;
    rmSync(temp, { recursive: true, force: true });
  });
  const runtime = join(cwd, ".agents", "task-workflow", id);
  const artifacts = join(runtime, "context");
  const statePath = join(runtime, "state.json");
  const contextPath = join(artifacts, "context.md");
  const configPath = join(temp, "task-workflow.json");
  const source = join(cwd, "example.ts");
  if (startup) {
    mkdirSync(runtime, { recursive: true });
    writeFileSync(configPath, JSON.stringify(startup.global));
    writeFileSync(
      join(dirname(runtime), "config.json"),
      JSON.stringify(startup.project),
    );
    writeFileSync(join(runtime, "config.json"), JSON.stringify(startup.task));
  }
  const shortcuts: [string, string][] = [];
  const state = (): State => JSON.parse(readFileSync(statePath, "utf8"));
  const writeState = (values: State) =>
    writeFileSync(
      statePath,
      JSON.stringify({
        id,
        version: 1,
        currentStep: 1,
        completedSteps: [],
        projectRoot: cwd,
        contextPath,
        ...values,
      }),
    );
  const writeArtifact = (name: string, content: string) =>
    writeFileSync(join(artifacts, name), content);
  const messages: Delivered[] = [];
  const notices: string[] = [];
  const confirmations: { title: string; description: string }[] = [];
  const switches: string[] = [];
  const dispatchedCommands: string[] = [];
  const modelCalls: { systemPrompt: string; input: string }[] = [];
  let commitDraft = "Update example value\n\nUse the new value.";
  let session = join(temp, "unlinked.jsonl");
  let cancelNextSwitch = false;
  let name: string | undefined;
  let entries: unknown[] = [];
  let branch: unknown[] = [];
  function appendEntry(entry: unknown) {
    entries.push(entry);
    branch.push(entry);
    writeFileSync(session, JSON.stringify(entries));
  }
  let onStatus: (key: string, value?: string) => void = () => {};
  let onMessage: (message: Delivered) => void = () => {};
  let manualReviewFindings: string[] = [];
  const deliver = (message: Message, options?: { triggerTurn?: boolean }) => {
    const delivered = {
      ...message,
      triggerTurn: !!options?.triggerTurn,
      session,
    };
    appendEntry({ type: "custom_message", ...message });
    messages.push(delivered);
    onMessage(delivered);
  };
  const hooks = new Map<
    string,
    (event: unknown, ctx: CommandContext) => unknown
  >();
  let handler: Handler | undefined;
  let artifactTool: ArtifactTool | undefined;
  taskExtension({
    on(event: string, hook: (event: unknown, ctx: CommandContext) => unknown) {
      hooks.set(event, hook);
    },
    registerTool(tool: ArtifactTool) {
      if (tool.name === "task_write_artifact") artifactTool = tool;
    },
    registerShortcut(key: string, definition: { description: string }) {
      shortcuts.push([key, definition.description]);
    },
    registerCommand(command: string, definition: { handler: Handler }) {
      if (command === "task") handler = definition.handler;
    },
    getActiveTools: () => ["read"],
    getAllTools: () => [{ name: "read" }],
    getSessionName: () => name,
    setSessionName: (value: string) => {
      name = value;
    },
    sendMessage: deliver,
  } as unknown as Host);
  const ctx = {
    cwd,
    mode: "print",
    isIdle: () => true,
    model: { contextWindow: 128_000, maxTokens: 4096 },
    getSystemPromptOptions: () => ({
      skills: [
        { name: "fixture-commit", filePath: join(temp, "commit-skill.md") },
      ],
    }),
    ui: {
      async confirm(title: string, description: string) {
        confirmations.push({ title, description });
        return false;
      },
      notify(message: string) {
        notices.push(message);
      },
      setStatus(key: string, value?: string) {
        onStatus(key, value);
      },
      setWidget() {},
    },
    sessionManager: {
      getSessionFile: () => session,
      getBranch: () => branch,
      getEntries: () => entries,
    },
    async switchSession(
      file: string,
      options?: { withSession?: (context: unknown) => Promise<void> },
    ) {
      if (cancelNextSwitch) {
        cancelNextSwitch = false;
        return { cancelled: true };
      }
      switches.push(file);
      session = file;
      entries = JSON.parse(readFileSync(file, "utf8"));
      branch = [...entries];
      await fire("session_start", { reason: "resume" });
      await options?.withSession?.({
        ...ctx,
        sendMessage: deliver,
        async sendUserMessage(
          command: string,
          options: { expandPromptTemplates?: boolean },
        ) {
          assert.equal(session, file);
          assert.equal(options.expandPromptTemplates, true);
          assert.equal(command, "/task next");
          dispatchedCommands.push(command);
          await run("next");
        },
      });
      return { cancelled: false };
    },
    modelRegistry: {
      async complete(
        _model: unknown,
        request: {
          systemPrompt: string;
          messages: { content: { text: string }[] }[];
        },
      ) {
        const { systemPrompt } = request;
        modelCalls.push({
          systemPrompt,
          input: request.messages[0].content[0].text,
        });
        const text = systemPrompt.startsWith("You decide whether")
          ? JSON.stringify({
              openQuestions: [],
              pendingProposal: "",
              manualReviewFindings,
              researchHandoff: {
                decisions: [],
                proposal: null,
                clarification: null,
              },
              reason: "ready",
            })
          : systemPrompt.includes("Write the complete agreed roadmap")
            ? roadmap
            : systemPrompt.includes("Write the complete agreed implementation")
              ? codingDesign
              : systemPrompt.startsWith("Draft an English Git commit message")
                ? commitDraft
                : assert.fail(
                    `Unexpected model call: ${systemPrompt.slice(0, 80)}`,
                  );
        return { stopReason: "stop", content: [{ type: "text", text }] };
      },
    },
  };
  function fire(event: string, payload: unknown) {
    const hook = hooks.get(event);
    assert.ok(hook, `Expected ${event} hook`);
    return hook(payload, ctx as unknown as CommandContext);
  }
  function savedPhase(phase: Phase, more: Partial<State> = {}) {
    mkdirSync(artifacts, { recursive: true });
    writeArtifact(
      "context.md",
      `# ${contextMarker}\n\n[Supporting note](note.md)\n`,
    );
    writeArtifact("note.md", noteMarker);
    writeArtifact("roadmap.md", roadmap);
    writeArtifact("step-1.md", "# Preparation draft\n");
    const linkPhase = phase === "complete" ? "commit" : phase;
    const file = join(runtime, `${linkPhase}.jsonl`);
    const refs =
      linkPhase === "research" || linkPhase === "roadmap"
        ? { [linkPhase]: file }
        : linkPhase === "manual-review" || linkPhase === "review"
          ? {
              [linkPhase === "manual-review" ? "manualReview" : "review"]: {
                "1": [file],
              },
            }
          : { [linkPhase]: { "1": file } };
    writeState({ phase, sessions: refs, ...more });
    writeFileSync(
      file,
      JSON.stringify([
        {
          type: "custom",
          customType: "task-workflow-link",
          data: { id, statePath, phase: linkPhase, step: 1 },
        },
        {
          type: "custom_message",
          customType: "task-workflow-kickoff",
          content: `Read ${stalePath}`,
          display: false,
        },
        {
          type: "message",
          message: {
            role: "assistant",
            content: [{ type: "text", text: transcriptMarker }],
          },
        },
      ]),
    );
    return file;
  }
  function prompt(message?: Message) {
    const systemPromptOptions = {
      sections: {} as Record<string, string>,
      selectedTools: ["read", "write"],
    };
    const result = fire("before_agent_start", {
      ...(message
        ? { messageType: "custom", message }
        : { messageType: "user", prompt: "Continue" }),
      systemPromptOptions,
    });
    assert.equal(result, undefined, "context entry does not inject a message");
    return {
      text: systemPromptOptions.sections.task_workflow,
      tools: systemPromptOptions.selectedTools,
    };
  }
  async function run(args: string, commandCwd = cwd) {
    assert.ok(handler);
    await handler(args, {
      ...ctx,
      cwd: commandCwd,
    } as unknown as CommandContext);
  }
  return {
    cwd,
    contextPath,
    configPath,
    shortcuts,
    state,
    statePath,
    writeState,
    writeArtifact,
    async editArtifact(params: Parameters<ArtifactTool["execute"]>[1]) {
      assert.ok(artifactTool);
      return artifactTool.execute(
        "test",
        params,
        undefined,
        undefined,
        ctx as unknown as CommandContext,
      );
    },
    savedPhase,
    source,
    messages,
    dispatchedCommands,
    modelCalls,
    notices,
    confirmations,
    switches,
    prompt,
    session: () => session,
    entryMessages: () =>
      branch.filter(
        (item) => (item as { type: string }).type === "custom_message",
      ) as Message[],
    compactBranch() {
      // Pi keeps raw branch entries but projects only the summary and newer messages
      // when firstKeptEntryId is the compaction's own ID (retain none).
      const id = `compact-${entries.length}`;
      appendEntry({
        type: "compaction",
        id,
        firstKeptEntryId: id,
        summary: "Repair was discussed.",
      });
    },
    selectEarlierBranch(content: string) {
      assert.equal(
        fire("session_before_tree", {}),
        undefined,
        "tree navigation is allowed",
      );
      const leaf = entries.findLastIndex(
        (entry) => (entry as Partial<Message>).content === content,
      );
      assert.ok(leaf >= 0);
      branch = entries.slice(0, leaf + 1);
    },
    saveKickoff(message: Message) {
      appendEntry({ type: "custom_message", ...message });
    },
    saveAssistantSummary(text: string) {
      appendEntry({
        type: "message",
        message: { role: "assistant", content: [{ type: "text", text }] },
      });
    },
    projectedMessages() {
      const compactedAt = branch.findLastIndex(
        (item) => (item as { type: string }).type === "compaction",
      );
      return branch
        .slice(compactedAt + 1)
        .filter(
          (item) => (item as { type: string }).type === "custom_message",
        ) as Message[];
    },
    setStatusObserver: (observer: typeof onStatus) => {
      onStatus = observer;
    },
    setMessageObserver: (observer: typeof onMessage) => {
      onMessage = observer;
    },
    setManualFindings: (findings: string[]) => {
      manualReviewFindings = findings;
    },
    setCommitDraft: (text: string) => {
      commitDraft = text;
    },
    checkWrite: () =>
      fire("tool_call", { toolName: "write" }) as
        { block: boolean; reason: string } | undefined,
    cancelNextSwitch: () => {
      cancelNextSwitch = true;
    },
    open: (file: string) => ctx.switchSession(file),
    run,
  };
}

type Fixture = ReturnType<typeof fixture>;

function assertContextEntry(f: Fixture, message?: Message) {
  const prompt = f.prompt(message);
  assert.ok(prompt.text.includes(f.contextPath));
  assert.equal(prompt.text.split(f.contextPath).length - 1, 1);
  assert.match(
    prompt.text,
    /Use this path, not any older path in the conversation/,
  );
  assert.match(prompt.text, /Read it first on phase or mode entry/);
  assert.match(prompt.text, /reuse a current copy/);
  assert.match(
    prompt.text,
    /Open linked notes and other files in the task's context directory only as needed/,
  );
  assert.ok(prompt.tools.includes("task_write_artifact"));
  assert.ok(
    !message?.content.includes(f.contextPath),
    "canonical context is supplied by the system section, not the kickoff",
  );
  for (const text of [prompt.text, message?.content ?? ""])
    for (const marker of [
      contextMarker,
      noteMarker,
      transcriptMarker,
      stalePath,
    ])
      assert.ok(
        !text.includes(marker),
        `Unexpected text in the handoff: ${marker}`,
      );
  return prompt;
}

function assertReviewHandoff(f: Fixture, prompt: string) {
  const handoff = join(dirname(f.contextPath), "step-result-1.md");
  assert.ok(
    prompt.includes(
      `Read the current implementation handoff at ${handoff} if it exists, before drawing conclusions.`,
    ),
  );
}

for (const [phase, state, instruction, skill] of [
  ["research", {}, /Gather task context/, "task-research"],
  ["roadmap", {}, /Discuss the roadmap/, "task-roadmap"],
  ["prepare", {}, /final preparation/, "task-prepare"],
  ["implement", {}, /Implement or repair/, "public-api-docs"],
  ["review", {}, /implementation diff/, "task-review"],
  ["manual-review", {}, /manual review phase/, "task-manual-review"],
  [
    "commit",
    { commitReady: false },
    /commit result is not ready/,
    "commit-message",
  ],
  [
    "commit",
    { commitReady: true },
    /commit result already saved/,
    "commit-message",
  ],
  ["complete", { completedSteps: [1] }, /task is complete/, "task-complete"],
] as const) {
  it(`quietly reopens ${phase}: ${instruction.source}`, async (t) => {
    const f = fixture(t);
    const original = f.savedPhase(phase, {
      ...state,
      ...(phase === "implement" && { pendingBaselineDir: "/saved-baseline" }),
    });
    if (phase === "review") f.writeArtifact("step-result-1.md", noteMarker);
    await f.run(id);
    assert.equal(f.session(), original, f.notices.join("\n"));
    assert.deepEqual(f.messages, []);
    assert.ok(
      f.entryMessages().some(({ content }) => content.includes(stalePath)),
    );
    const prompt = assertContextEntry(f);
    assert.match(prompt.text, instruction);
    assert.ok(prompt.text.includes(`configured phase skill "${skill}"`));
    assert.ok(prompt.tools.includes("read"));
    if (phase === "review") assertReviewHandoff(f, prompt.text);
    const writable = phase === "implement";
    if (writable || ["review", "manual-review", "commit"].includes(phase)) {
      assert.match(
        prompt.text,
        /step-result-1\.md only if there is reusable knowledge/,
      );
      assert.match(
        prompt.text,
        /Never index temporary review reports or diffs/,
      );
    } else {
      assert.doesNotMatch(prompt.text, /only if there is reusable knowledge/);
    }
    assert.equal(prompt.tools.includes("write"), writable);
    assert.equal(f.checkWrite()?.block ?? false, writable === false);
  });
}

for (const phase of ["manual-review", "complete"] as const) {
  it(`resolves ${phase} skill overrides by scope and honors null`, async (t) => {
    const f = fixture(t);
    await f.open(f.savedPhase(phase));
    const projectConfig = join(dirname(dirname(f.statePath)), "config.json");
    const taskConfig = join(dirname(f.statePath), "config.json");
    const writeSkill = (path: string, value: string | null) =>
      writeFileSync(path, JSON.stringify({ skills: { [phase]: value } }));
    writeSkill(f.configPath, "global-skill");
    assert.match(f.prompt().text, /configured phase skill "global-skill"/);
    writeSkill(projectConfig, "project-skill");
    assert.match(f.prompt().text, /configured phase skill "project-skill"/);
    writeSkill(taskConfig, "task-skill");
    assert.match(f.prompt().text, /configured phase skill "task-skill"/);
    writeSkill(taskConfig, null);
    assert.doesNotMatch(f.prompt().text, /configured phase skill/);
    writeSkill(projectConfig, "invalid skill");
    assert.throws(() => f.prompt(), new RegExp(`Invalid skills\\.${phase}`));
  });
}

it("registers global startup shortcut overrides and ignores project and task bindings", (t) => {
  const f = fixture(t, {
    global: { hotkeys: { next: "ctrl+n", status: null } },
    project: { hotkeys: { next: "ctrl+p", status: "ctrl+s" } },
    task: { hotkeys: { show: "ctrl+w", list: "ctrl+l" } },
  });
  assert.deepEqual(f.shortcuts, [
    ["ctrl+n", "/task next"],
    ["alt+a", "/task accept"],
    ["alt+w", "/task show"],
  ]);
});

it("discovers an indexed task but refuses to advance it from an archived session", async (t) => {
  const f = fixture(t);
  const archived = f.savedPhase("research");
  const active = f.savedPhase("roadmap");
  const indexDir = join(dirname(f.configPath), "task-workflow-index");
  mkdirSync(indexDir);
  const locator = join(indexDir, "matching.json");
  const record = JSON.stringify({
    id,
    projectRoot: f.cwd,
    statePath: f.statePath,
  });
  writeFileSync(locator, record);

  const otherProject = join(dirname(f.configPath), "other-project");
  mkdirSync(otherProject);
  await f.run("browse", otherProject);
  assert.ok(
    f.notices
      .at(-1)
      ?.includes(`- ${id} · current · ${f.cwd} · ${f.statePath} ·`),
  );
  await f.open(archived);
  const before = readFileSync(f.statePath, "utf8");
  const switchCount = f.switches.length;
  await f.run("next");
  assert.match(f.notices.at(-1) ?? "", /not the active task session/i);
  assert.equal(f.session(), archived);
  assert.equal(f.switches.length, switchCount);
  assert.equal(f.modelCalls.length, 0);
  assert.equal(readFileSync(f.statePath, "utf8"), before);
  assert.equal(readFileSync(locator, "utf8"), record);
  assert.equal(f.state().sessions?.roadmap, active);
});

it("does not give active-task guidance to unlinked, missing-state, or archived sessions", async (t) => {
  const f = fixture(t);
  assert.equal(f.prompt().text, undefined);
  const old = f.savedPhase("research");
  await f.open(old);
  rmSync(f.statePath);
  assert.match(f.prompt().text, /Task state is unavailable/);
  f.savedPhase("roadmap");
  const archived = f.prompt();
  assert.match(archived.text, /archived task session/);
  assert.ok(!archived.text.includes(f.contextPath));
  assert.deepEqual(archived.tools, []);
});

it("starts fresh Research without a turn and preserves the interrupted Research resume kickoff", async (t) => {
  const f = fixture(t);
  await f.run(id);
  assert.equal(f.state().phase, "research", f.notices.join("\n"));
  assert.deepEqual(f.messages, []);
  assertContextEntry(f);
  const saved = f.session();
  f.writeState({ ...f.state(), interruptedSession: saved });
  await f.run("resume");
  assert.deepEqual(f.switches, [saved]);
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].customType, "task-workflow-research-resume");
  assert.ok(f.messages[0].triggerTurn);
  assertContextEntry(f, f.messages[0]);
});

it("opens fresh Roadmap and Implementation preparation with focused kickoffs", async (t) => {
  const f = fixture(t);
  await f.open(f.savedPhase("research"));
  const originalContext = readFileSync(f.contextPath, "utf8");
  await f.run("next");
  assert.equal(f.state().phase, "roadmap", f.notices.join("\n"));
  assert.equal(f.messages.length, 1);
  assert.ok(f.messages[0].triggerTurn);
  assert.match(f.messages[0].content, /Propose a numbered roadmap/);
  assertContextEntry(f, f.messages[0]);
  await f.run("next");
  assert.equal(f.state().phase, "prepare", f.notices.join("\n"));
  assert.equal(f.messages.length, 2);
  assert.ok(f.messages[1].triggerTurn);
  assert.match(f.messages[1].content, /Planned work: Update value/);
  assertContextEntry(f, f.messages[1]);
  assert.ok(f.checkWrite()?.block);
  assert.equal(readFileSync(f.contextPath, "utf8"), originalContext);
});

it("opens Step preparation for the next roadmap item after Commit", async (t) => {
  const f = fixture(t);
  await f.open(
    f.savedPhase("commit", { commitReady: true, completedSteps: [1] }),
  );
  f.writeArtifact(
    "roadmap.md",
    roadmap.trimEnd() + "\n2. **Add coverage** — Test the updated value.\n",
  );
  await f.run("next");
  assert.equal(f.state().phase, "prepare", f.notices.join("\n"));
  assert.equal(f.state().currentStep, 2);
  assert.deepEqual(f.state().sessions?.prepare, { "2": f.session() });
  assert.match(
    f.messages.at(-1)!.content,
    /preparation session for step 2 of 2.*Add coverage/,
  );
  assert.ok(f.checkWrite()?.block);
});

it("resumes an interrupted saved phase after switching sessions, with just its existing kickoff", async (t) => {
  const f = fixture(t);
  const file = f.savedPhase("roadmap");
  f.writeState({ ...f.state(), interruptedSession: file });
  await f.run("resume");
  assert.deepEqual(f.switches, [file], f.notices.join("\n"));
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].customType, "task-workflow-kickoff");
  assert.ok(f.messages[0].triggerTurn);
  assertContextEntry(f, f.messages[0]);
});

it("requires the current implementation handoff when resuming a pending Review", async (t) => {
  const f = fixture(t);
  const file = f.savedPhase("review", { reviewPending: true });
  f.writeArtifact("step-result-1.md", noteMarker);
  await f.run("resume");
  assert.deepEqual(f.switches, [file], f.notices.join("\n"));
  assert.equal(f.messages.length, 1);
  const [kickoff] = f.messages;
  assert.ok(kickoff.triggerTurn);
  assert.match(kickoff.content, /The review is still pending/);
  assertReviewHandoff(f, assertContextEntry(f, kickoff).text);
});

it("opens a fresh coding session only after the baseline and design are saved", async (t) => {
  const f = fixture(t);
  const preparation = f.savedPhase("prepare");
  await f.open(preparation);
  writeFileSync(f.source, baselineSource);
  assert.ok(f.checkWrite()?.block);
  const captureChecks: boolean[] = [];
  let atDispatch:
    | { design: string; phase: Phase; baseline: string; blocked: boolean }
    | undefined;
  f.setStatusObserver((key, value) => {
    if (
      key === "task-baseline" &&
      value?.startsWith("Snapshotting project files")
    )
      captureChecks.push(
        !!f.checkWrite()?.block && f.state().phase === "prepare",
      );
  });
  f.setMessageObserver((message) => {
    if (!message.triggerTurn) return;
    const { pendingBaselineDir, phase } = f.state();
    assert.ok(pendingBaselineDir);
    const manifest = JSON.parse(
      readFileSync(join(pendingBaselineDir, "manifest.json"), "utf8"),
    );
    const snapshot = new Map<string, string>(manifest.paths).get("example.ts");
    assert.ok(snapshot);
    atDispatch = {
      design: readFileSync(join(dirname(f.contextPath), "step-1.md"), "utf8"),
      phase,
      baseline: readFileSync(join(pendingBaselineDir, snapshot), "utf8"),
      blocked: !!f.checkWrite()?.block,
    };
  });
  await f.run("next");
  const implementation = f.session();
  assert.notEqual(implementation, preparation);
  assert.deepEqual(f.switches, [preparation, implementation]);
  assert.deepEqual(f.state().sessions?.prepare, { "1": preparation });
  assert.deepEqual(f.state().sessions?.implement, { "1": implementation });
  assert.ok(captureChecks.length > 0);
  assert.ok(captureChecks.every(Boolean));
  assert.deepEqual(
    atDispatch,
    {
      design: codingDesign,
      phase: "implement",
      baseline: baselineSource,
      blocked: false,
    },
    f.notices.join("\n"),
  );
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].session, implementation);
  assert.match(f.messages[0].content, /Implement step 1/);
  assert.ok(assertContextEntry(f, f.messages[0]).tools.includes("write"));
  assert.ok(
    !f.entryMessages().some(({ content }) => content.includes(stalePath)),
  );
  await f.open(preparation);
  assert.ok(f.checkWrite()?.block);
  assert.match(f.prompt().text, /archived task session/);
});

it("reopens legacy preparation without replaying its kickoff and moves to a new coding session", async (t) => {
  const f = fixture(t);
  const legacy = f.savedPhase("implement", { implementationStarted: false });
  await f.run(id);
  assert.equal(f.session(), legacy, f.notices.join("\n"));
  assert.deepEqual(f.messages, []);
  assert.match(f.prompt().text, /Phase prepare/);
  assert.ok(f.checkWrite()?.block);
  writeFileSync(f.source, baselineSource);
  await f.run("next");
  assert.equal(f.state().phase, "implement", f.notices.join("\n"));
  assert.equal(f.state().implementationStarted, undefined);
  assert.notEqual(f.session(), legacy);
  assert.deepEqual(f.state().sessions?.prepare, { "1": legacy });
  assert.deepEqual(f.state().sessions?.implement, { "1": f.session() });
});

it("keeps the preparation session active and recaptures the baseline after a cancelled switch", async (t) => {
  const f = fixture(t);
  const preparation = f.savedPhase("prepare");
  await f.open(preparation);
  writeFileSync(f.source, baselineSource);
  f.cancelNextSwitch();
  await f.run("next");
  assert.match(f.notices.at(-1) ?? "", /cancelled.*saved prepare phase/);
  assert.equal(f.session(), preparation);
  assert.equal(f.state().phase, "prepare");
  assert.equal(f.state().pendingBaselineDir, undefined);
  assert.equal(f.state().sessions?.implement, undefined);
  assert.deepEqual(readdirSync(join(dirname(f.statePath), "baselines")), []);
  assert.deepEqual(f.messages, []);
  assert.ok(f.checkWrite()?.block);

  writeFileSync(f.source, "export const value = 17;\n");
  await f.run("next");
  assert.equal(f.state().phase, "implement", f.notices.join("\n"));
  const baseline = f.state().pendingBaselineDir!;
  const { paths } = JSON.parse(
    readFileSync(join(baseline, "manifest.json"), "utf8"),
  );
  const snapshot = new Map<string, string>(paths).get("example.ts")!;
  assert.equal(
    readFileSync(join(baseline, snapshot), "utf8"),
    readFileSync(f.source, "utf8"),
  );
});

it("supports independent preparation skills and preserves the legacy tool defaults", async (t) => {
  const f = fixture(t);
  await f.open(f.savedPhase("prepare"));
  const legacy = {
    phaseTools: { implement: ["grep"] },
    additionalPhaseTools: { implement: ["find"] },
    skills: { implement: "coding-skill" },
  };
  writeFileSync(f.configPath, JSON.stringify(legacy));
  assert.deepEqual(f.prompt().tools, ["grep", "task_write_artifact", "find"]);
  assert.match(f.prompt().text, /configured phase skill "task-prepare"/);
  writeFileSync(
    f.configPath,
    JSON.stringify({
      phaseTools: { ...legacy.phaseTools, prepare: ["read"] },
      additionalPhaseTools: { ...legacy.additionalPhaseTools, prepare: [] },
      skills: { ...legacy.skills, prepare: null },
    }),
  );
  assert.deepEqual(f.prompt().tools, ["read", "task_write_artifact"]);
  assert.doesNotMatch(f.prompt().text, /configured phase skill/);
  writeFileSync(f.source, baselineSource);
  await f.run("next");
  assert.equal(f.state().phase, "implement", f.notices.join("\n"));
  assert.match(f.prompt().text, /coding-skill/);
  assert.ok(f.prompt().tools.includes("write"));
});

it("uses task-scoped snapshot filters, including null overriding an inherited include", async (t) => {
  const f = fixture(t);
  await f.open(f.savedPhase("prepare"));
  writeFileSync(
    f.configPath,
    JSON.stringify({ include: ["never.ts"], exclude: ["*.ts"] }),
  );
  writeFileSync(
    join(dirname(dirname(f.statePath)), "config.json"),
    JSON.stringify({ include: ["other.ts"] }),
  );
  writeFileSync(
    join(dirname(f.statePath), "config.json"),
    JSON.stringify({ include: null, exclude: ["other.ts"] }),
  );
  writeFileSync(f.source, baselineSource);
  writeFileSync(join(f.cwd, "other.ts"), baselineSource);
  await f.run("next");
  const dir = f.state().pendingBaselineDir;
  assert.ok(dir, f.notices.join("\n"));
  const { paths } = JSON.parse(
    readFileSync(join(dir, "manifest.json"), "utf8"),
  );
  assert.deepEqual(
    paths
      .map(([path]: [string, string]) => path)
      .filter((path: string) => path.endsWith(".ts")),
    ["example.ts"],
  );
});

it("keeps preparation read-only and does not dispatch coding on baseline failure", async (t) => {
  const f = fixture(t);
  await f.open(f.savedPhase("prepare"));
  writeFileSync(f.configPath, JSON.stringify({ snapshotMaxFiles: 1 }));
  writeFileSync(f.source, baselineSource);
  writeFileSync(join(f.cwd, "other.ts"), baselineSource);
  await f.run("next");
  assert.match(f.notices.join("\n"), /Snapshot limit exceeded/);
  assert.equal(f.state().phase, "prepare");
  assert.equal(f.state().pendingBaselineDir, undefined);
  assert.ok(f.checkWrite()?.block);
  assert.deepEqual(f.messages, []);
});

it("uses the discovered layout's scoped deletion mode at confirmation", async (t) => {
  const f = fixture(t);
  f.savedPhase("research");
  const runtime = dirname(f.statePath);
  const projectConfig = join(dirname(runtime), "config.json");
  writeFileSync(f.configPath, JSON.stringify({ deleteMode: "trash" }));
  writeFileSync(projectConfig, JSON.stringify({ deleteMode: "permanent" }));
  await f.run(`delete ${id}`);
  assert.equal(f.confirmations.at(-1)?.title, `Permanently delete task ${id}?`);
  assert.ok(f.confirmations.at(-1)?.description.includes(runtime));

  const historical = join(f.cwd, ".agents", "projects", id);
  mkdirSync(dirname(historical), { recursive: true });
  renameSync(runtime, historical);
  const historicState = join(historical, "state.json");
  writeFileSync(
    historicState,
    JSON.stringify({
      ...JSON.parse(readFileSync(historicState, "utf8")),
      contextPath: join(historical, "context", "context.md"),
    }),
  );
  writeFileSync(
    join(historical, "config.json"),
    JSON.stringify({ deleteMode: "trash" }),
  );
  await f.run(`delete ${id}`);
  assert.equal(
    f.confirmations.at(-1)?.title,
    `Move task ${id} to the OS trash?`,
  );
  assert.ok(f.confirmations.at(-1)?.description.includes(historical));
  assert.ok(existsSync(historicState), "both confirmations were declined");
});

it(
  "preserves a written Review report when the subsequent state save fails",
  { skip: process.getuid?.() === 0 },
  async (t) => {
    const f = fixture(t);
    await f.open(f.savedPhase("review", { reviewPending: true }));
    const before = readFileSync(f.statePath, "utf8");
    chmodSync(f.statePath, 0o444);
    try {
      await assert.rejects(
        f.editArtifact({
          artifact: "review",
          operation: "create",
          content: "# Review\n",
        }),
        { code: "EACCES" },
      );
      assert.equal(
        readFileSync(
          join(dirname(f.contextPath), "review-1-round-0.md"),
          "utf8",
        ),
        "# Review\n",
      );
      assert.equal(readFileSync(f.statePath, "utf8"), before);
    } finally {
      chmodSync(f.statePath, 0o644);
    }
  },
);

it("retains Commit evidence on a no-Git retry and cleans up only after explicit skip", async (t) => {
  const f = fixture(t);
  const baseline = join(dirname(f.statePath), "baseline");
  await f.open(
    f.savedPhase("commit", {
      completedSteps: [1],
      pendingBaselineDir: baseline,
    }),
  );
  mkdirSync(baseline);
  writeFileSync(join(baseline, "manifest.json"), "{}");
  const diff = join(dirname(f.contextPath), "implementation-1.diff");
  const report = join(dirname(f.contextPath), "review-1-round-0.md");
  writeFileSync(diff, "# example.ts\n");
  writeFileSync(report, "# Review\n");
  const before = readFileSync(f.statePath, "utf8");
  await f.run("next");
  assert.match(
    f.messages.at(-1)?.content ?? "",
    /Git repository not detected.*remains open/,
  );
  assert.equal(readFileSync(f.statePath, "utf8"), before);
  assert.ok([baseline, diff, report].every((path) => existsSync(path)));
  await f.run("accept");
  assert.equal(f.state().phase, "complete");
  assert.equal(f.state().pendingBaselineDir, undefined);
  assert.ok([baseline, diff, report].every((path) => !existsSync(path)));
  assert.equal(f.modelCalls.length, 0);
});

function initGit(f: Fixture) {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: f.cwd, encoding: "utf8" }).trimEnd();
  git("init", "-q");
  git("config", "user.name", "Workflow Test");
  git("config", "user.email", "workflow@example.invalid");
  git("config", "commit.gpgSign", "false");
  git("config", "core.hooksPath", "/dev/null");
  writeFileSync(join(f.cwd, ".git", "info", "exclude"), "/.agents/\n");
  writeFileSync(f.source, baselineSource);
  git("add", "example.ts");
  git("commit", "-qm", "Baseline");
  return git;
}

for (const destination of ["review", "manual-review", "commit"] as const) {
  it(`preserves caller effects when the switch to ${destination} is cancelled`, async (t) => {
    const f = fixture(t);
    await f.open(f.savedPhase("prepare"));
    initGit(f);
    writeFileSync(
      f.configPath,
      JSON.stringify({
        mode: "semi-auto",
        manualReview: destination === "manual-review",
        autoCommit: true,
      }),
    );
    await f.run("next");
    const baseline = f.state().pendingBaselineDir;
    assert.ok(baseline, f.notices.join("\n"));
    writeFileSync(f.source, "export const value = 2;\n");
    const diffPath = join(dirname(f.contextPath), "implementation-1.diff");
    if (destination !== "review") {
      await f.run("next");
      assert.equal(f.state().phase, "review", f.notices.join("\n"));
      await f.editArtifact({
        artifact: "review",
        operation: "create",
        content: "# Review\n\n## Findings\n\nNo findings.\n",
      });
    }
    const before = {
      file: f.session(),
      messages: f.messages.length,
      calls: f.modelCalls.length,
      switches: f.switches.length,
      dispatched: f.dispatchedCommands.length,
    };
    f.cancelNextSwitch();
    await f.run("next");
    const state = f.state();
    assert.match(f.notices.at(-1) ?? "", /Session switch was cancelled/);
    assert.equal(f.session(), before.file);
    assert.ok(
      f.messages
        .slice(before.messages)
        .every(
          (message) =>
            !message.triggerTurn && message.customType !== "task-commit",
        ),
    );
    assert.deepEqual(
      f.modelCalls
        .slice(before.calls)
        .map(({ systemPrompt }) =>
          systemPrompt.startsWith("You decide whether"),
        ),
      [true],
    );
    assert.equal(f.switches.length, before.switches);
    assert.equal(f.dispatchedCommands.length, before.dispatched);
    assert.match(readFileSync(diffPath, "utf8"), /\+export const value = 2;/);
    assert.equal(state.pendingBaselineDir, baseline);
    if (destination === "review") {
      assert.equal(state.phase, "implement");
      assert.equal(state.reviewPending, true);
      assert.equal(state.sessions?.review, undefined);
      assert.equal(
        readdirSync(join(dirname(f.statePath), "sessions")).length,
        2,
      );
    } else {
      assert.equal(state.phase, destination);
      assert.deepEqual(state.completedSteps, [1]);
      const sessions = state.sessions?.[
        destination === "manual-review" ? "manualReview" : "commit"
      ] as Record<string, string | string[]>;
      const ref = sessions["1"];
      assert.ok(existsSync(Array.isArray(ref) ? ref[0] : ref));
      assert.equal(state.commitReady, false);
      assert.ok(
        existsSync(join(dirname(f.contextPath), "review-1-round-0.md")),
      );
    }
  });
}

it("carries automated and manual repairs through verified Commit and preserves reusable findings", async (t) => {
  const f = fixture(t);
  await f.open(f.savedPhase("prepare"));
  const git = initGit(f);
  writeFileSync(
    f.configPath,
    JSON.stringify({
      mode: "semi-auto",
      autoCommit: false,
      manualReview: true,
      allowTreeNavigation: true,
    }),
  );
  const originalContext = readFileSync(f.contextPath, "utf8");
  await f.run("next");
  const file = f.session();
  const baseline = f.state().pendingBaselineDir;
  assert.ok(baseline, f.notices.join("\n"));
  const changeValue = (value: number) =>
    writeFileSync(f.source, `export const value = ${value};\n`);
  changeValue(2);
  await f.run("next");
  assert.equal(f.state().phase, "review", f.notices.join("\n"));
  assert.ok(f.checkWrite()?.block);
  const reviewKickoff = f.messages.at(-1)!;
  assertReviewHandoff(f, assertContextEntry(f, reviewKickoff).text);
  assert.match(reviewKickoff.content, /implementation-1\.diff/);
  assert.doesNotMatch(
    reviewKickoff.content,
    /step-result-1\.md/,
    "the shared Review instruction owns the handoff requirement",
  );
  const artifacts = dirname(f.contextPath);
  const diffPath = join(artifacts, "implementation-1.diff");
  assert.match(readFileSync(diffPath, "utf8"), /\+export const value = 2;/);
  const review = () => `review-1-round-${f.state().reviewRound}.md`;
  const saveReview = (finding = "No findings.") => {
    f.writeArtifact(
      review(),
      `# Review: step 1\n\n## Findings\n\n${finding}\n`,
    );
    f.writeState({ ...f.state(), reviewPending: false });
  };
  saveReview("### [Major] Stale finding\nStatus: open");
  changeValue(3);
  await f.run("next");
  assert.equal(f.state().phase, "implement", f.notices.join("\n"));
  assert.equal(f.state().pendingBaselineDir, baseline);
  assert.match(
    f.messages.at(-1)!.content,
    /changed since review began.*start another review/,
  );
  assert.doesNotMatch(
    f.messages.at(-1)!.content,
    /review-1-round-0\.md|Stale finding/,
  );

  await f.run("next");
  assert.equal(review(), "review-1-round-1.md");
  saveReview("### [Major] Incorrect value\nStatus: open");
  const reusable = `# Portability constraint\n\n${noteMarker}: Consumers require the same value across platforms.\n`;
  await f.editArtifact({
    artifact: "step-result",
    step: 1,
    operation: "create",
    content: reusable,
  });
  const indexLink =
    "- [Step 1 result](step-result-1.md) — portability constraint.";
  await f.editArtifact({
    artifact: "context",
    operation: "append",
    content: `${indexLink}\n`,
  });
  const indexedContext = readFileSync(f.contextPath, "utf8");
  assert.equal(indexedContext, `${originalContext}${indexLink}\n`);
  const resultPath = join(artifacts, "step-result-1.md");
  assert.equal(readFileSync(resultPath, "utf8"), reusable);
  await f.run("next");
  assert.equal(f.state().phase, "implement", f.notices.join("\n"));
  assert.equal(f.state().pendingBaselineDir, baseline);
  assert.equal(f.session(), file);
  const auto = f.messages.at(-1)!;
  const currentReport = join(artifacts, "review-1-round-1.md");
  assert.match(auto.content, /Automated review report: review-1-round-1\.md/);
  assert.deepEqual(auto.details, { reportName: "review-1-round-1.md" });
  assert.ok(!auto.content.includes(artifacts));
  assert.doesNotMatch(
    auto.content,
    /Incorrect value|review-1-round-0\.md|Manual-review findings/,
  );
  assert.match(auto.content, /fix findings marked Status: open/);
  assert.ok(assertContextEntry(f, auto).text.includes(currentReport));
  f.compactBranch();
  await f.open(file);
  assert.deepEqual(f.projectedMessages(), []);
  const autoPrompt = assertContextEntry(f).text;
  assert.ok(autoPrompt.includes(currentReport));
  assert.doesNotMatch(
    autoPrompt,
    /Project files changed since review began|review-1-round-0\.md/,
  );

  changeValue(4);
  await f.run("next");
  saveReview();
  const messageCount = f.messages.length;
  await f.run("next");
  assert.equal(f.state().phase, "manual-review", f.notices.join("\n"));
  assert.equal(f.messages.length, messageCount);
  assert.ok(
    f
      .entryMessages()
      .some(
        ({ customType, display }) =>
          customType === "task-manual-review" && display,
      ),
  );
  assertContextEntry(f);
  assert.ok(f.checkWrite()?.block);

  const beforeManualRepair = readdirSync(artifacts).sort();
  // Manual review forwards actionable findings without recomputing the diff.
  changeValue(5);
  f.setManualFindings([
    "Use the documented example value.",
    "Keep the exported name.",
  ]);
  await f.run("next");
  assert.equal(f.state().phase, "implement", f.notices.join("\n"));
  assert.equal(f.state().pendingBaselineDir, baseline);
  assert.equal(f.session(), file);
  const manual = f.messages.at(-1)!;
  assert.match(
    manual.content,
    /Manual-review findings:\n- Use the documented example value\.\n- Keep the exported name\./,
  );
  assert.deepEqual(readdirSync(artifacts).sort(), beforeManualRepair);
  const manualPrompt = assertContextEntry(f, manual).text;
  assert.match(manualPrompt, /Current repair handoff:/);
  assert.doesNotMatch(
    `${manual.content}\n${manualPrompt}`,
    /review-1-round-\d+\.md/,
  );
  f.compactBranch();
  f.writeState({ ...f.state(), interruptedSession: file });
  await f.run("resume");
  assert.ok(
    f.entryMessages().some(({ content }) => content === manual.content),
  );
  assert.ok(
    !f.projectedMessages().some(({ content }) => content === manual.content),
  );
  const resumed = assertContextEntry(f, f.messages.at(-1)).text;
  assert.ok(resumed.includes(manual.content));
  assert.doesNotMatch(resumed, /review-1-round-\d+\.md/);

  f.setManualFindings([]);
  changeValue(6);
  await f.run("next");
  assert.equal(f.state().phase, "review", f.notices.join("\n"));
  saveReview("### [Major] Do not forward this stale finding.\nStatus: open");
  changeValue(7);
  await f.run("next");
  assert.equal(f.state().phase, "implement", f.notices.join("\n"));
  assert.equal(f.state().pendingBaselineDir, baseline);
  assert.equal(f.session(), file);
  assert.deepEqual(f.state().completedSteps, []);
  const staleReview = f.messages.at(-1)!;
  assert.match(staleReview.content, /Project files changed since review began/);
  assert.doesNotMatch(staleReview.content, /Do not forward this stale finding/);
  f.compactBranch();
  await f.open(file);
  assert.deepEqual(f.projectedMessages(), []);
  const stalePrompt = assertContextEntry(f).text;
  assert.ok(stalePrompt.includes(staleReview.content));
  assert.doesNotMatch(
    stalePrompt,
    /Use the documented example value|Do not forward this stale finding|review-1-round-\d+\.md/,
  );

  f.selectEarlierBranch(manual.content);
  assert.equal(f.projectedMessages().at(-1)?.content, manual.content);
  const earlierBranchPrompt = assertContextEntry(f).text;
  assert.ok(earlierBranchPrompt.includes(staleReview.content));
  assert.doesNotMatch(earlierBranchPrompt, /Use the documented example value/);

  f.saveAssistantSummary(transcriptMarker);
  await f.run("next");
  saveReview();
  const reviewedDiff = readFileSync(diffPath, "utf8");
  assert.match(reviewedDiff, /\+export const value = 7;/);
  await f.run("next");
  const beforeCommit = f.messages.length;
  writeFileSync(
    join(dirname(f.configPath), "commit-skill.md"),
    "Fixture commit drafting guidance.",
  );
  writeFileSync(
    join(dirname(f.statePath), "config.json"),
    JSON.stringify({
      skills: { commit: "fixture-commit" },
    }),
  );
  await f.run("next");
  assert.equal(f.state().phase, "commit", f.notices.join("\n"));
  assert.equal(f.state().commitReady, true, f.notices.join("\n"));
  assert.ok(f.checkWrite()?.block);
  assertContextEntry(f);
  assert.deepEqual(
    f.messages
      .slice(beforeCommit)
      .map(({ customType, display, triggerTurn }) => ({
        customType,
        display,
        triggerTurn,
      })),
    [{ customType: "task-commit", display: true, triggerTurn: false }],
  );
  assert.ok(
    f
      .entryMessages()
      .some(
        ({ content, display }) =>
          display && content.startsWith("Review accepted"),
      ),
  );
  assert.ok(
    !f
      .entryMessages()
      .some(({ customType }) => customType === "task-workflow-kickoff"),
  );
  const draft = f.modelCalls.at(-1)!;
  assert.match(draft.systemPrompt, /^Draft an English Git commit message/);
  assert.match(draft.systemPrompt, /plain-text commit message/);
  assert.match(draft.systemPrompt, /Fixture commit drafting guidance\./);
  assert.match(
    f.messages.at(-1)?.content ?? "",
    /Update example value\n\nUse the new value\.$/,
  );
  assert.ok(draft.input.endsWith(reviewedDiff));
  assert.ok(draft.input.includes(`Worker summary:\n${transcriptMarker}`));
  assert.ok(
    !draft.input.includes(contextMarker) && !draft.input.includes(noteMarker),
  );

  f.writeArtifact("review-2-round-0.md", "Unrelated review\n");
  f.writeArtifact("implementation-2.diff", "Unrelated diff\n");
  const temporary = [
    "implementation-1.diff",
    ...Array.from({ length: 5 }, (_, i) => `review-1-round-${i}.md`),
  ];
  const beforeCleanup = readdirSync(artifacts).sort();
  for (const name of temporary) assert.ok(beforeCleanup.includes(name));
  await f.run("next");
  assert.match(
    f.notices.join("\n"),
    /Uncommitted changes on reviewed paths: example\.ts/,
  );
  assert.equal(f.state().phase, "commit");
  assert.deepEqual(readdirSync(artifacts).sort(), beforeCleanup);

  git("add", "example.ts");
  git("commit", "-qm", "Commit reviewed value");
  await f.run("next");
  assert.equal(f.state().phase, "complete", f.notices.join("\n"));
  assert.deepEqual(
    readdirSync(artifacts).sort(),
    beforeCleanup.filter((name) => !temporary.includes(name)),
  );
  assert.equal(readFileSync(f.contextPath, "utf8"), indexedContext);
  assert.equal(readFileSync(resultPath, "utf8"), reusable);
});

for (const format of [
  "with report identity",
  "legacy absolute path",
] as const) {
  it(`recovers the same automated repair round after relocation (${format})`, async (t) => {
    const f = fixture(t);
    const file = f.savedPhase("implement", {
      implementationStarted: true,
      reviewRound: 7,
    });
    await f.open(file);
    const oldRoot = join(dirname(f.cwd), "old project");
    mkdirSync(oldRoot);
    const reportName = "review-1-round-2.md";
    const oldReport = join(oldRoot, reportName);
    const report = join(dirname(f.contextPath), reportName);
    writeFileSync(oldReport, "Exact review report from round 2.\n");
    f.saveKickoff(
      format === "with report identity"
        ? {
            customType: "task-workflow-repair",
            content: `Automated review report: ${reportName}`,
            details: { reportName },
            display: false,
          }
        : {
            customType: "task-workflow-kickoff",
            content: `Read the agreed review findings in ${oldReport}. Fix findings marked Status: open.`,
            display: false,
          },
    );
    // Model relocation's result: the canonical artifact directory is under the new
    // root, while preserved kickoff content and details have not been rewritten.
    renameSync(oldReport, report);
    rmSync(oldRoot, { recursive: true });
    f.writeArtifact("review-1-round-7.md", "A different review round.\n");
    await f.open(file);
    const prompt = assertContextEntry(f).text;
    assert.ok(prompt.includes(`Automated review report: ${report}.`));
    assert.ok(!prompt.includes(oldRoot));
    assert.doesNotMatch(prompt, /review-1-round-7\.md/);
    assert.equal(
      readFileSync(report, "utf8"),
      "Exact review report from round 2.\n",
    );
  });
}

it("reviews and commits a dangling symlink even when it is the only change", async (t) => {
  const f = fixture(t);
  await f.open(f.savedPhase("prepare"));
  const git = initGit(f);
  writeFileSync(
    f.configPath,
    JSON.stringify({ mode: "semi-auto", autoCommit: true, manualReview: true }),
  );
  await f.run("next");
  const link = join(f.cwd, "dangling");
  symlinkSync("missing-target", link);
  await f.run("next");
  assert.equal(f.state().phase, "review", f.notices.join("\n"));
  const diff = readFileSync(
    join(dirname(f.contextPath), "implementation-1.diff"),
    "utf8",
  );
  assert.match(diff, /^# dangling$/m);
  assert.match(diff, /^new file mode 120000$/m);
  assert.match(diff, /^\+missing-target$/m);
  const targetHash = createHash("sha256")
    .update("missing-target")
    .digest("hex");
  assert.deepEqual(f.state().pendingHashes, {
    dangling: `symlink:${targetHash}`,
  });
  f.writeArtifact(
    "review-1-round-0.md",
    "# Review: step 1\n\n## Findings\n\nNo findings.\n",
  );
  f.writeState({ ...f.state(), reviewPending: false });
  await f.run("next");
  assert.equal(f.state().phase, "manual-review", f.notices.join("\n"));
  await f.run("next");
  assert.equal(f.state().phase, "complete", f.notices.join("\n"));
  assert.match(git("ls-tree", "HEAD", "dangling"), /^120000 blob /);
  assert.equal(git("show", "HEAD:dangling"), "missing-target");
});

it("finishes a saved manual Commit with a legacy symlink hash", async (t) => {
  const f = fixture(t);
  await f.open(f.savedPhase("prepare"));
  const git = initGit(f);
  writeFileSync(
    f.configPath,
    JSON.stringify({ mode: "manual", autoCommit: false }),
  );
  await f.run("next");
  symlinkSync("example.ts", join(f.cwd, "reviewed-link"));
  await f.run("next");
  assert.equal(f.state().phase, "review", f.notices.join("\n"));
  f.writeArtifact(
    "review-1-round-0.md",
    "# Review: step 1\n\n## Findings\n\nNo findings.\n",
  );
  f.writeState({ ...f.state(), reviewPending: false });
  await f.run("next");
  assert.equal(f.state().phase, "commit", f.notices.join("\n"));
  assert.ok(f.state().commitReady);
  const legacy = createHash("sha256").update(baselineSource).digest("hex");
  git("add", "reviewed-link");
  git("commit", "-qm", "Commit the reviewed link");
  assert.equal(git("status", "--porcelain"), "");
  f.writeState({
    ...f.state(),
    commitPendingHashes: { "reviewed-link": "0".repeat(64) },
  });
  await f.run("next");
  assert.equal(f.state().phase, "commit");
  assert.match(
    f.notices.at(-1)!,
    /Clean paths that differ from review: reviewed-link/,
  );
  f.writeState({
    ...f.state(),
    commitPendingHashes: { "reviewed-link": legacy },
  });
  await f.run("next");
  assert.equal(f.state().phase, "complete", f.notices.join("\n"));
});

it("requires fresh Review before auto-committing a legacy symlink snapshot", async (t) => {
  const f = fixture(t);
  await f.open(f.savedPhase("prepare"));
  const git = initGit(f);
  const baselineCommit = git("rev-parse", "HEAD");
  writeFileSync(
    f.configPath,
    JSON.stringify({
      mode: "semi-auto",
      autoCommit: true,
      manualReview: false,
    }),
  );
  await f.run("next");
  const baseline = f.state().pendingBaselineDir;
  symlinkSync("example.ts", join(f.cwd, "reviewed-link"));
  await f.run("next");
  assert.equal(f.state().phase, "review", f.notices.join("\n"));
  const legacy = createHash("sha256").update(baselineSource).digest("hex");
  const clearReport = "# Review: step 1\n\n## Findings\n\nNo findings.\n";
  f.writeArtifact("review-1-round-0.md", clearReport);
  f.writeState({
    ...f.state(),
    pendingHashes: { "reviewed-link": legacy },
    reviewPending: false,
  });
  await f.run("next");
  assert.equal(f.state().phase, "commit", f.notices.join("\n"));
  assert.ok(!f.state().commitReady);
  assert.match(
    f.notices.at(-1)!,
    /Use \/task next to start a fresh automated review/,
  );
  assert.equal(git("rev-parse", "HEAD"), baselineCommit);
  const waiting = f.state();
  const diffPath = join(dirname(f.contextPath), "implementation-1.diff");
  const reviewedDiff = readFileSync(diffPath, "utf8");
  f.cancelNextSwitch();
  await f.run("next");
  assert.deepEqual(f.state(), waiting);
  assert.equal(readFileSync(diffPath, "utf8"), reviewedDiff);
  assert.equal(git("rev-parse", "HEAD"), baselineCommit);

  await f.run("next");
  assert.equal(f.state().phase, "review", f.notices.join("\n"));
  assert.equal(f.state().reviewRound, 1);
  assert.equal(f.state().pendingBaselineDir, baseline);
  assert.match(f.state().pendingHashes?.["reviewed-link"] ?? "", /^symlink:/);
  assert.equal(git("rev-parse", "HEAD"), baselineCommit);
  f.writeArtifact("review-1-round-1.md", clearReport);
  f.writeState({ ...f.state(), reviewPending: false });
  await f.run("next");
  assert.equal(f.state().phase, "complete", f.notices.join("\n"));
  assert.match(git("ls-tree", "HEAD", "reviewed-link"), /^120000 blob /);
  assert.equal(git("show", "HEAD:reviewed-link"), "example.ts");
});

it("accepts omitted reviewed files only after the reviewed paths are clean", async (t) => {
  const f = fixture(t);
  await f.open(f.savedPhase("prepare"));
  const git = initGit(f);
  writeFileSync(
    f.configPath,
    JSON.stringify({ mode: "manual", autoCommit: false }),
  );
  await f.run("next");
  const omitted = join(f.cwd, "omitted.ts");
  writeFileSync(omitted, baselineSource);
  writeFileSync(f.source, "export const value = 2;\n");
  await f.run("next");
  assert.equal(f.state().phase, "review", f.notices.join("\n"));
  const report = "review-1-round-0.md";
  f.writeArtifact(report, "# Review: step 1\n\n## Findings\n\nNo findings.\n");
  f.writeState({ ...f.state(), reviewPending: false });
  await f.run("next");
  assert.equal(f.state().phase, "commit", f.notices.join("\n"));
  const commitSession = f.session();

  await f.run("accept");
  assert.match(
    f.notices.at(-1)!,
    /Uncommitted changes on reviewed paths:.*omitted\.ts/,
  );
  rmSync(omitted);
  git("add", "example.ts");
  await f.run("accept");
  assert.equal(f.state().phase, "commit");
  assert.match(
    f.notices.at(-1)!,
    /Uncommitted changes on reviewed paths: example\.ts/,
  );
  assert.match(
    f.notices.at(-1)!,
    /Clean paths that differ from review: omitted\.ts/,
  );
  assert.doesNotMatch(f.notices.at(-1)!, /Use \/task accept/);

  git("commit", "-qm", "Commit without the omitted file");
  git("mv", "example.ts", "renamed.ts");
  await f.run("accept");
  assert.equal(f.state().phase, "commit");
  assert.match(
    f.notices.at(-1)!,
    /Uncommitted changes on reviewed paths: example\.ts/,
  );
  git("mv", "renamed.ts", "example.ts");
  writeFileSync(join(f.cwd, "unrelated.ts"), baselineSource);
  const head = git("rev-parse", "HEAD");

  await f.run("next");
  assert.equal(f.state().phase, "commit");
  assert.match(
    f.notices.at(-1)!,
    /Clean paths that differ from review: omitted\.ts/,
  );
  assert.match(
    f.notices.at(-1)!,
    /Use \/task accept to keep the current result/,
  );
  const artifacts = dirname(f.contextPath);
  const diff = join(artifacts, "implementation-1.diff");
  assert.ok(existsSync(diff));
  assert.ok(existsSync(join(artifacts, report)));
  assert.ok(
    !f.messages.some(({ content }) =>
      content.startsWith("Accepted differences"),
    ),
  );

  await f.run("accept");
  assert.equal(f.state().phase, "complete", f.notices.join("\n"));
  assert.ok(!existsSync(diff));
  assert.ok(!existsSync(join(artifacts, report)));
  const accepted = f
    .entryMessages()
    .find(({ content }) => content.startsWith("Accepted differences"));
  assert.equal(
    accepted?.content,
    "Accepted differences from review for step 1:\n\n- omitted.ts",
  );
  assert.equal(accepted?.display, true);
  assert.ok(
    readFileSync(commitSession, "utf8").includes(
      JSON.stringify(accepted?.content),
    ),
  );
  assert.equal(git("rev-parse", "HEAD"), head);
  assert.equal(git("status", "--porcelain"), "?? unrelated.ts");
});

it("rejects a committed symlink in place of a newly reviewed regular file", async (t) => {
  const f = fixture(t);
  await f.open(f.savedPhase("prepare"));
  const git = initGit(f);
  writeFileSync(
    f.configPath,
    JSON.stringify({ mode: "manual", autoCommit: false }),
  );
  await f.run("next");
  const path = join(f.cwd, "reviewed.ts");
  writeFileSync(path, baselineSource);
  await f.run("next");
  assert.equal(f.state().phase, "review", f.notices.join("\n"));
  const report = "review-1-round-0.md";
  f.writeArtifact(report, "# Review: step 1\n\n## Findings\n\nNo findings.\n");
  f.writeState({ ...f.state(), reviewPending: false });
  await f.run("next");
  assert.equal(f.state().phase, "commit", f.notices.join("\n"));
  const digest = createHash("sha256").update(baselineSource).digest("hex");
  assert.equal(
    f.state().commitPendingHashes?.["reviewed.ts"],
    `file:${digest}`,
  );
  rmSync(path);
  symlinkSync("example.ts", path);
  git("add", "reviewed.ts");
  git("commit", "-qm", "Commit a link instead of the reviewed file");
  assert.equal(git("status", "--porcelain"), "");
  assert.equal(readFileSync(path, "utf8"), baselineSource);
  await f.run("next");
  assert.equal(f.state().phase, "commit", f.notices.join("\n"));
  assert.match(
    f.notices.at(-1)!,
    /Clean paths that differ from review: reviewed\.ts/,
  );
  const artifacts = readdirSync(dirname(f.contextPath));
  assert.ok(
    artifacts.includes(report) && artifacts.includes("implementation-1.diff"),
  );
});

it("rejects a committed gitlink in place of a reviewed deletion", async (t) => {
  const f = fixture(t);
  await f.open(f.savedPhase("prepare"));
  const git = initGit(f);
  writeFileSync(
    f.configPath,
    JSON.stringify({ mode: "manual", autoCommit: false }),
  );
  await f.run("next");
  rmSync(f.source);
  await f.run("next");
  assert.equal(f.state().phase, "review", f.notices.join("\n"));
  const artifacts = dirname(f.contextPath);
  const report = "review-1-round-0.md";
  const diff = join(artifacts, "implementation-1.diff");
  assert.match(readFileSync(diff, "utf8"), /^deleted file mode /m);
  f.writeArtifact(report, "# Review: step 1\n\n## Findings\n\nNo findings.\n");
  f.writeState({ ...f.state(), reviewPending: false });
  await f.run("next");
  assert.equal(f.state().phase, "commit", f.notices.join("\n"));
  assert.equal(f.state().commitPendingHashes?.["example.ts"], "missing");

  git("rm", "--", "example.ts");
  git(
    "-c",
    "protocol.file.allow=always",
    "submodule",
    "add",
    f.cwd,
    "example.ts",
  );
  git("commit", "-qm", "Substitute a submodule for the reviewed deletion");
  assert.equal(git("status", "--porcelain"), "");
  assert.match(git("ls-tree", "HEAD", "--", "example.ts"), /^160000 commit /);
  await f.run("next");
  assert.equal(f.state().phase, "commit", f.notices.join("\n"));
  assert.match(
    f.notices.at(-1)!,
    /Clean paths that differ from review: example\.ts/,
  );
  assert.ok(readdirSync(artifacts).includes(report));
  assert.match(readFileSync(diff, "utf8"), /^deleted file mode /m);

  git("rm", "-f", "--", "example.ts");
  git("commit", "-qm", "Remove the unreviewed submodule");
  assert.equal(git("ls-tree", "HEAD", "--", "example.ts"), "");
  assert.equal(git("status", "--porcelain"), "");
  await f.run("next");
  assert.equal(f.state().phase, "complete", f.notices.join("\n"));
  assert.ok(!readdirSync(artifacts).includes(report));
});

it("does not auto-commit an empty model response", async (t) => {
  const f = fixture(t);
  await f.open(f.savedPhase("prepare"));
  const git = initGit(f);
  const initialHead = git("rev-parse", "HEAD");
  writeFileSync(f.configPath, JSON.stringify({ autoCommit: true }));
  f.setCommitDraft(" \n\n");
  await f.run("next");
  writeFileSync(f.source, "export const value = 6;\n");
  await f.run("next");
  assert.equal(f.state().phase, "review", f.notices.join("\n"));
  f.writeArtifact(
    "review-1-round-0.md",
    "# Review: step 1\n\n## Findings\n\nNo findings.\n",
  );
  f.writeState({ ...f.state(), reviewPending: false });
  await f.run("next");
  assert.equal(f.state().phase, "commit", f.notices.join("\n"));
  assert.notEqual(f.state().commitReady, true);
  assert.match(f.notices.at(-1) ?? "", /returned no commit title/);
  assert.equal(git("rev-parse", "HEAD"), initialHead);
});

it("finishes semi-auto Commit with a title-only message and no agent turn", async (t) => {
  const f = fixture(t);
  await f.open(f.savedPhase("prepare"));
  const git = initGit(f);
  f.setCommitDraft("Update example value");
  writeFileSync(
    join(dirname(f.configPath), "commit-skill.md"),
    "Return only a title.",
  );
  writeFileSync(
    f.configPath,
    JSON.stringify({
      mode: "semi-auto",
      autoCommit: true,
      manualReview: false,
      skills: { commit: "fixture-commit" },
    }),
  );
  const originalContext = readFileSync(f.contextPath, "utf8");
  const artifacts = dirname(f.contextPath);
  const durableFiles = readdirSync(artifacts).sort();
  await f.run("next");
  writeFileSync(f.source, "export const value = 6;\n");
  await f.run("next");
  assert.equal(f.state().phase, "review", f.notices.join("\n"));
  f.writeArtifact(
    "review-1-round-0.md",
    "# Review: step 1\n\n## Findings\n\nNo findings.\n",
  );
  f.writeState({ ...f.state(), reviewPending: false });
  const beforeCommit = f.messages.length;
  const beforeCommitCalls = f.modelCalls.length;
  const transitionStatuses: { session: string; value?: string }[] = [];
  f.setStatusObserver((key, value) => {
    if (key === "task-transition")
      transitionStatuses.push({ session: f.session(), value });
  });
  await f.run("next");
  assert.equal(f.state().phase, "complete", f.notices.join("\n"));
  assert.deepEqual(f.dispatchedCommands, ["/task next"]);
  assert.deepEqual(
    transitionStatuses
      .filter(({ session }) => session === f.session())
      .map(({ value }) => value),
    ["Transitioning to the next task phase…", undefined],
  );
  const commitMessages = f.messages.slice(beforeCommit);
  assert.equal(commitMessages.length, 2);
  assert.ok(
    commitMessages.every(
      ({ triggerTurn, session }) => !triggerTurn && session === f.session(),
    ),
  );
  assert.match(
    commitMessages[0].content,
    /Committed step 1 as .*:\n\nUpdate example value$/,
  );
  assert.match(commitMessages[1].content, /All planned steps are complete/);
  assert.match(
    f.modelCalls.at(-1)?.systemPrompt ?? "",
    /Return only a title\./,
  );
  assert.equal(git("log", "-1", "--format=%B"), "Update example value");
  assert.equal(
    f.modelCalls.length,
    beforeCommitCalls + 2,
    "only readiness and commit drafting",
  );
  assert.equal(git("show", "HEAD:example.ts"), "export const value = 6;");
  assert.deepEqual(readdirSync(artifacts).sort(), durableFiles);
  assert.equal(readFileSync(f.contextPath, "utf8"), originalContext);
});
