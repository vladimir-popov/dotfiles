import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it, type TestContext } from "node:test";
import type { HandoffCandidate } from "../src/research-handoff.ts";
import { taskExtension } from "./load-task-extension.ts";

const initial = "# Export\n\nExport format: JSON.\n";
const ready = { openQuestions: [], pendingProposal: "", reason: "ready" };
const noChange = { decisions: [], proposal: null, clarification: null };

type VerificationInput = {
  note: string;
  candidate: HandoffCandidate;
  proposal?: string;
  originalDiscussion: { role: string; body: string }[];
  context: string;
  staged?: string[];
  settled?: true;
  excerptedDiscussion?: true;
};

type DiscussionWindows = {
  readinessDiscussion: string;
  decisionDiscussion?: string;
};

type AssessmentInput = Pick<
  VerificationInput,
  "note" | "originalDiscussion" | "context" | "excerptedDiscussion"
> &
  DiscussionWindows & { command: "/task next" | "/task accept" };

type Host = Parameters<typeof taskExtension>[0];
type Command = Parameters<Host["registerCommand"]>[1];

function fixture(
  t: TestContext,
  assess: (
    input: AssessmentInput,
    request: { systemPrompt: string; maxTokens: number },
  ) => unknown,
  {
    discussion = [],
    context = initial,
    model = { contextWindow: 128_000, maxTokens: 4096 },
    verify = ({ settled }) => (settled ? "true" : "false"),
  }: {
    discussion?: (
      | string
      | { resume: true }
      | { legacyResume: true }
      | { kickoff: true }
      | { assistant: string }
    )[];
    context?: string;
    model?: { contextWindow: number; maxTokens: number };
    verify?: (
      input: VerificationInput,
      systemPrompt: string,
      windows: DiscussionWindows,
    ) => string;
  } = {},
) {
  const cwd = realpathSync(
    mkdtempSync(join(tmpdir(), "research-command-test-")),
  );
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const id = "test-task";
  const task = join(cwd, ".agents", "task-workflow", id);
  const statePath = join(task, "state.json");
  const contextPath = join(task, "context", "context.md");
  const session = join(task, "research.jsonl");
  mkdirSync(join(task, "context"), { recursive: true });
  writeFileSync(contextPath, context);
  writeFileSync(
    statePath,
    JSON.stringify({
      id,
      version: 1,
      projectRoot: cwd,
      contextPath,
      phase: "research",
      currentStep: 1,
      completedSteps: [],
      sessions: { research: session },
    }),
  );
  const notices: string[] = [];
  const calls: string[] = [];
  const switchContexts: string[] = [];
  let assessedWindows: DiscussionWindows | undefined;
  let handler: Command["handler"] | undefined;
  taskExtension({
    on() {},
    registerTool() {},
    registerShortcut() {},
    registerCommand(name: string, command: Command) {
      if (name === "task") handler = command.handler;
    },
  } as Host);
  const ctx = {
    cwd,
    model,
    ui: {
      setStatus() {},
      notify(message: string) {
        notices.push(message);
      },
    },
    sessionManager: {
      getSessionFile: () => session,
      getBranch: () => [
        {
          type: "custom",
          customType: "task-workflow-link",
          data: { id, statePath, phase: "research", step: 1 },
        },
        ...discussion.map((content) =>
          typeof content === "string"
            ? { type: "message", message: { role: "user", content } }
            : "assistant" in content
              ? {
                  type: "message",
                  message: { role: "assistant", content: content.assistant },
                }
              : {
                  type: "custom_message",
                  customType:
                    "resume" in content
                      ? "task-workflow-research-resume"
                      : "task-workflow-kickoff",
                  content:
                    "resume" in content || "legacyResume" in content
                      ? `Resume task ${id} in its current research phase from the saved conversation. Review recent messages and the current project state, continue unfinished work, and update the artifacts required by this phase. Do not repeat completed work or advance phases.`
                      : "Start Research.",
                },
        ),
      ],
    },
    modelRegistry: {
      async complete(
        _model: unknown,
        {
          messages,
          systemPrompt,
        }: {
          messages: { content: { text: string }[] }[];
          systemPrompt: string;
        },
        options: { maxTokens?: number },
      ) {
        const input = messages[0].content[0].text;
        calls.push(input);
        const isVerifier = systemPrompt.startsWith(
          "Verify a Research handoff entry.",
        );
        assert.ok(options.maxTokens && options.maxTokens <= model.maxTokens);
        assert.ok(
          Buffer.byteLength(systemPrompt) +
            Buffer.byteLength(input) +
            options.maxTokens <=
            model.contextWindow,
        );
        let response: string;
        if (isVerifier) {
          const { readinessDiscussion, decisionDiscussion, ...entry } =
            JSON.parse(input) as VerificationInput & DiscussionWindows;
          const windows = { readinessDiscussion, decisionDiscussion };
          assert.deepEqual(windows, assessedWindows);
          response = verify(entry, systemPrompt, windows);
        } else {
          const assessmentInput = JSON.parse(input) as AssessmentInput;
          assessedWindows = {
            readinessDiscussion: assessmentInput.readinessDiscussion,
            decisionDiscussion: assessmentInput.decisionDiscussion,
          };
          response = JSON.stringify(
            assess(assessmentInput, {
              systemPrompt,
              maxTokens: options.maxTokens,
            }),
          );
        }
        return {
          stopReason: "stop",
          content: [{ type: "text", text: response }],
        };
      },
    },
    async switchSession() {
      switchContexts.push(readFileSync(contextPath, "utf8"));
      calls.push("switch");
      return { cancelled: false };
    },
  };
  return {
    run: (args: string) => {
      assert.ok(handler);
      return handler(args, ctx as unknown as Parameters<Command["handler"]>[1]);
    },
    calls,
    switchContexts,
    notices,
    phase: () => JSON.parse(readFileSync(statePath, "utf8")).phase,
    context: () => readFileSync(contextPath, "utf8"),
    inode: () => statSync(contextPath).ino,
  };
}

for (const [command, result, notice] of [
  ["next", { openQuestions: ["Which format?"] }, /Which format/],
  ["accept Use CSV.", { openQuestions: ["Which filename?"] }, /Which filename/],
  ["next", { pendingProposal: "Use CSV." }, /needs approval/],
] as const) {
  it(`blocks /task ${command} on ${notice.source} before writing or switching`, async (t) => {
    const f = fixture(t, () => ({
      ...ready,
      ...result,
      researchHandoff: {
        ...noChange,
        decisions: [{ append: "Keep the previous export path." }],
        clarification: command.startsWith("accept")
          ? { append: "Use CSV." }
          : null,
      },
    }));
    const inode = f.inode();
    await f.run(command);
    assert.equal(f.calls.length, 1);
    assert.match(f.notices.join("\n"), notice);
    assert.equal(f.phase(), "research");
    assert.equal(f.context(), initial);
    assert.equal(f.inode(), inode);
  });
}

it("passes a free-form accept note with quotes and repeated whitespace intact", async (t) => {
  const note = 'Keep `mode="strict"` and the label `north  star`.';
  const f = fixture(
    t,
    () => ({
      ...ready,
      researchHandoff: {
        ...noChange,
        clarification: { append: note },
      },
    }),
    {
      verify(input) {
        assert.deepEqual(input, {
          note,
          candidate: { append: note },
          originalDiscussion: [],
          context: initial,
        });
        return "true";
      },
    },
  );
  await f.run(`  accept   ${note}`);
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  assert.equal((JSON.parse(f.calls[0]) as AssessmentInput).note, note);
  assert.ok(f.context().includes(note));
});

for (const [command, field, notice] of [
  ["next", "openQuestions", /Which data may be exported/],
  ["accept", "openQuestions", /Which data may be exported/],
  ["next", "pendingProposal", /needs approval/],
] as const) {
  it(`keeps a pre-resume ${field} blocker for /task ${command}`, async (t) => {
    const blocker =
      field === "openQuestions"
        ? "Which data may be exported?"
        : "I propose CSV export.";
    const f = fixture(
      t,
      (input) => {
        assert.ok(
          input.originalDiscussion.some(({ body }) => body === blocker),
        );
        return {
          ...ready,
          [field]: field === "openQuestions" ? [blocker] : blocker,
        };
      },
      {
        discussion: [
          { assistant: blocker },
          { resume: true },
          "Continuing Research.",
        ],
        verify() {
          assert.fail("A blocked transition must not verify a handoff");
        },
      },
    );
    const inode = f.inode();
    await f.run(command);
    assert.equal(f.calls.length, 1);
    assert.match(f.notices.join("\n"), notice);
    assert.equal(f.phase(), "research");
    assert.equal(f.inode(), inode);
  });
}

for (const [command, tail] of [
  ["next", false],
  ["accept", false],
  ["next", true],
  ["accept", true],
] as const) {
  it(`retains a ${tail ? "tail" : "short"} readiness blocker before a budget-filling diagnostic for /task ${command}`, async (t) => {
    const blocker = "Which data may be exported?";
    const reply = tail ? `${"background ".repeat(275)}${blocker}` : blocker;
    const diagnostic = `\`\`\`text\n${"diagnostic ".repeat(tail ? 1750 : 2175)}\n\`\`\`\n`;
    assert.ok(Buffer.byteLength(diagnostic) < 24_000);
    const f = fixture(
      t,
      (input) => {
        assert.equal(input.note, "");
        assert.equal(
          input.readinessDiscussion,
          `assistant: ${reply}\n\nuser: ${diagnostic.slice(0, 5000)}`,
        );
        return { ...ready, openQuestions: [blocker] };
      },
      {
        discussion: [{ assistant: reply }, { resume: true }, diagnostic],
        verify() {
          assert.fail("A blocked transition must not verify a handoff");
        },
      },
    );
    const inode = f.inode();
    await f.run(command);
    assert.equal(f.calls.length, 1);
    assert.match(f.notices.join("\n"), /Which data may be exported/);
    assert.equal(f.phase(), "research");
    assert.equal(f.context(), initial);
    assert.equal(f.inode(), inode);
  });
}

for (const [command, crowded] of [
  ["next", false],
  ["accept", true],
] as const) {
  it(`keeps a middle-of-reply blocker visible for /task ${command}${crowded ? " with intervening messages" : ""}`, async (t) => {
    const blocker = "Which data may be exported?";
    const reply = `${"background ".repeat(136)}${blocker} ${"background ".repeat(136)}`;
    const diagnostic = `\`\`\`text\n${"diagnostic ".repeat(1900)}\n\`\`\`\n`;
    const followUps = crowded
      ? Array.from({ length: 12 }, (_, i) => `Observation ${i + 1}.`)
      : [];
    const f = fixture(
      t,
      (input) => {
        assert.ok(
          input.readinessDiscussion.startsWith(`assistant: ${reply}\n\n`),
        );
        return { ...ready, openQuestions: [blocker] };
      },
      {
        discussion: [{ assistant: reply }, ...followUps, diagnostic],
        verify() {
          assert.fail("A blocked transition must not verify a handoff");
        },
      },
    );
    const inode = f.inode();
    await f.run(command);
    assert.equal(f.calls.length, 1);
    assert.match(f.notices.join("\n"), /Which data may be exported/);
    assert.equal(f.phase(), "research");
    assert.equal(f.context(), initial);
    assert.equal(f.inode(), inode);
  });
}

for (const command of ["next", "accept"] as const) {
  it(`sees an outdented blocker after an unclosed list fence for /task ${command}`, async (t) => {
    const blocker = "Which data may be exported?";
    const fence = `- \`\`\`text\n  ${"code ".repeat(200)}\n\n`;
    const reply = `Diagnostic from the test run:\n\n${fence}${blocker}\n${"trailing text ".repeat(2000)}`;
    const f = fixture(
      t,
      (input) => {
        assert.equal(
          input.readinessDiscussion,
          `assistant: ${reply.slice(0, 5000)}`,
        );
        assert.ok(input.originalDiscussion.some(({ body }) => body === fence));
        assert.ok(
          input.originalDiscussion.some(({ body }) => body === `${blocker}\n`),
        );
        return { ...ready, openQuestions: [blocker] };
      },
      {
        discussion: [{ assistant: reply }],
        verify() {
          assert.fail("A blocked transition must not verify a handoff");
        },
      },
    );
    const inode = f.inode();
    await f.run(command);
    assert.equal(f.calls.length, 1);
    assert.match(f.notices.join("\n"), /Which data may be exported/);
    assert.equal(f.phase(), "research");
    assert.equal(f.context(), initial);
    assert.equal(f.inode(), inode);
  });
}

for (const [command, evidenceBytes, mode] of [
  ["next", 0, "blocked"],
  ["accept", 8, "blocked"],
  ["next", 0, "empty"],
  ["next", 100, "question-fits"],
  ["next", 100, "partial"],
  ["accept", 100, "partial"],
] as const) {
  it(`handles ${evidenceBytes} readiness evidence bytes for /task ${command} (${mode})`, async (t) => {
    const model = { contextWindow: 8192, maxTokens: 1024 };
    const readyHandoff = { ...ready, researchHandoff: noChange };
    let baseBudget: number | undefined;
    const baseline = fixture(
      t,
      (input, { systemPrompt, maxTokens }) => {
        // Calibrate against the actual prompt and fixed fields so the test hits the byte boundary.
        const reservedPayload = JSON.stringify({
          ...input,
          excerptedDiscussion: true,
        });
        baseBudget =
          model.contextWindow -
          maxTokens -
          512 -
          Buffer.byteLength(systemPrompt) -
          Buffer.byteLength(reservedPayload);
        return readyHandoff;
      },
      { model },
    );
    await baseline.run(command);
    assert.equal(baseline.phase(), "roadmap", baseline.notices.join("\n"));
    assert.ok(baseBudget !== undefined && baseBudget > evidenceBytes);

    const context = `${initial}${"x".repeat(baseBudget - evidenceBytes)}`;
    const question = "Which data may be exported?";
    const f = fixture(
      t,
      (input) => {
        if (mode === "question-fits") {
          assert.equal(input.readinessDiscussion, `assistant: ${question}`);
          assert.equal(input.decisionDiscussion, undefined);
          return { ...readyHandoff, openQuestions: [question] };
        }
        if (mode === "empty") {
          assert.equal(input.readinessDiscussion, "");
          assert.deepEqual(input.originalDiscussion, []);
        }
        // An unconditional ready response would otherwise advance the blocked cases.
        return readyHandoff;
      },
      {
        model,
        context,
        discussion:
          mode === "empty"
            ? []
            : mode === "partial"
              ? [
                  {
                    assistant: `${"x".repeat(150 - question.length)}${question}`,
                  },
                  "I'll check.",
                ]
              : [{ assistant: question }],
      },
    );
    const inode = f.inode();
    await f.run(command);
    assert.equal(f.context(), context);
    assert.equal(f.inode(), inode);
    if (mode === "blocked" || mode === "partial") {
      assert.deepEqual(f.calls, []);
      assert.equal(f.phase(), "research");
      assert.match(
        f.notices.join("\n"),
        /mandatory Research readiness window, decision window, and context\.md do not fit/,
      );
    } else if (mode === "empty") {
      assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
    } else {
      assert.equal(f.calls.length, 1);
      assert.equal(f.phase(), "research");
      assert.match(f.notices.join("\n"), /Which data may be exported/);
    }
  });
}

for (const command of ["next", "accept"] as const) {
  it(`preserves the full readiness window with a large context for /task ${command}`, async (t) => {
    const model = { contextWindow: 48_000, maxTokens: 4096 };
    const blocker = "Which data may be exported?";
    const reply = `${"background ".repeat(136)}${blocker} ${"background ".repeat(136)}`;
    const followUps = Array.from(
      { length: 15 },
      (_, i) => `Observation ${i + 1}.`,
    );
    const discussion = [
      { assistant: reply },
      { resume: true as const },
      ...followUps,
    ];
    const required = [
      `assistant: ${reply}`,
      ...followUps.map((body) => `user: ${body}`),
    ].join("\n\n");
    let padding: number | undefined;
    const baseline = fixture(
      t,
      (input, { systemPrompt, maxTokens }) => {
        assert.equal(input.readinessDiscussion, required);
        const fixed = {
          ...input,
          originalDiscussion: [],
          excerptedDiscussion: true,
        };
        padding =
          model.contextWindow -
          maxTokens -
          512 -
          Buffer.byteLength(systemPrompt) -
          Buffer.byteLength(JSON.stringify(fixed));
        return { ...ready, openQuestions: [blocker] };
      },
      { model, discussion },
    );
    await baseline.run(command);
    assert.ok(padding !== undefined && padding > 0);
    assert.match(baseline.notices.join("\n"), /Which data may be exported/);

    const contextAtLimit = `${initial}${"x".repeat(padding)}`;
    const atLimit = fixture(
      t,
      (input) => {
        assert.equal(input.readinessDiscussion, required);
        assert.deepEqual(input.originalDiscussion, []);
        return { ...ready, openQuestions: [blocker] };
      },
      { model, context: contextAtLimit, discussion },
    );
    const originalInode = atLimit.inode();
    await atLimit.run(command);
    assert.equal(atLimit.calls.length, 1);
    assert.match(atLimit.notices.join("\n"), /Which data may be exported/);
    assert.equal(atLimit.phase(), "research");
    assert.equal(atLimit.context(), contextAtLimit);
    assert.equal(atLimit.inode(), originalInode);

    const context = `${contextAtLimit}x`;
    const overLimit = fixture(
      t,
      () => ({ ...ready, researchHandoff: noChange }),
      { model, context, discussion },
    );
    const inode = overLimit.inode();
    await overLimit.run(command);
    assert.deepEqual(overLimit.calls, []);
    assert.match(
      overLimit.notices.join("\n"),
      /mandatory Research readiness window, decision window, and context\.md do not fit/,
    );
    assert.equal(overLimit.phase(), "research");
    assert.equal(overLimit.context(), context);
    assert.equal(overLimit.inode(), inode);
  });
}

for (const [command, expectedToFit] of [
  ["next", true],
  ["accept", true],
  ["accept", false],
] as const) {
  it(`protects the legacy readiness prefix of a long unwrapped reply for /task ${command} (${expectedToFit ? "fits" : "too large"})`, async (t) => {
    const blocker = "Which data may be exported?";
    const prefix = `${"background ".repeat(137)}${blocker} `;
    const reply = prefix.padEnd(30_000, "x");
    const f = fixture(
      t,
      (input) => {
        assert.equal(
          input.readinessDiscussion,
          `assistant: ${reply.slice(0, 5000)}`,
        );
        assert.ok(
          input.originalDiscussion.some(
            ({ role, body }) =>
              role === "assistant" && body === reply.slice(0, 5000),
          ),
        );
        return {
          ...ready,
          openQuestions: [blocker],
          researchHandoff: noChange,
        };
      },
      {
        discussion: [{ assistant: reply }],
        ...(expectedToFit
          ? {}
          : { model: { contextWindow: 9000, maxTokens: 1024 } }),
        verify() {
          assert.fail("A blocked transition must not verify a handoff");
        },
      },
    );
    const inode = f.inode();
    await f.run(command);
    assert.equal(f.calls.length, expectedToFit ? 1 : 0);
    assert.match(
      f.notices.join("\n"),
      expectedToFit
        ? /Which data may be exported/
        : /mandatory Research readiness window, decision window, and context\.md do not fit/,
    );
    assert.equal(f.phase(), "research");
    assert.equal(f.context(), initial);
    assert.equal(f.inode(), inode);
  });
}

for (const [command, scenario, replyLength] of [
  ["next", "diagnostics", 4500],
  ["accept", "diagnostics", 4500],
  ["next", "blocker", 4500],
  ["accept", "blocker", 4500],
  ["next", "tight budget", 4500],
  ["next", "blocker", 3900],
  ["accept", "blocker", 3900],
] as const) {
  it(`preserves the legacy readiness window for /task ${command} (${scenario}, ${replyLength} chars)`, async (t) => {
    const blocker = "Which data may be exported?";
    const diagnostics = Array.from({ length: 6 }, (_, i) => {
      const start = `Diagnostic ${i + 1}: `.padEnd(
        replyLength === 3900 ? 1500 : 1000,
        "x",
      );
      const blockerIndex = replyLength === 3900 ? 0 : 2;
      return `${start}${i === blockerIndex && scenario !== "diagnostics" ? blocker : ""}`.padEnd(
        replyLength,
        "x",
      );
    });
    const legacy = diagnostics
      .map((body) => `assistant: ${body}`)
      .join("\n\n")
      .slice(-24_000);
    const f = fixture(
      t,
      (input) => {
        assert.equal(input.readinessDiscussion, legacy);
        return {
          ...ready,
          openQuestions:
            scenario === "blocker" &&
            input.readinessDiscussion.includes(blocker)
              ? [blocker]
              : [],
          researchHandoff: noChange,
        };
      },
      {
        ...(scenario === "tight budget"
          ? { model: { contextWindow: 29_000, maxTokens: 4096 } }
          : {}),
        discussion: diagnostics.map((assistant) => ({ assistant })),
        verify() {
          assert.fail("No proposed entries require verification");
        },
      },
    );
    const inode = f.inode();
    await f.run(command);
    if (scenario === "diagnostics") {
      assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
      assert.equal(f.calls.length, 2);
    } else {
      assert.equal(f.phase(), "research", f.notices.join("\n"));
      assert.equal(f.calls.length, scenario === "blocker" ? 1 : 0);
      assert.match(
        f.notices.join("\n"),
        scenario === "blocker"
          ? /Which data may be exported/
          : /mandatory Research readiness window, decision window, and context\.md do not fit/,
      );
    }
    assert.equal(f.context(), initial);
    assert.equal(f.inode(), inode);
  });
}

it("verifies a settled decision from the same verbatim prefix retained by assessment", async (t) => {
  const decision = "Keep audit export filenames immutable.";
  const reply = `${"background ".repeat(137)}Agreed: ${decision} `.padEnd(
    30_000,
    "x",
  );
  const prefix = reply.slice(0, 5000);
  const candidate = { append: decision };
  const f = fixture(
    t,
    (input) => {
      assert.equal(input.readinessDiscussion, `user: ${prefix}`);
      assert.ok(input.originalDiscussion.some(({ body }) => body === prefix));
      return {
        ...ready,
        researchHandoff: { ...noChange, decisions: [candidate] },
      };
    },
    {
      discussion: [reply],
      verify(input) {
        assert.equal(input.settled, true);
        assert.deepEqual(input.candidate, candidate);
        assert.deepEqual(input.originalDiscussion, [
          { role: "user", body: prefix },
        ]);
        assert.equal(input.excerptedDiscussion, true);
        return "true";
      },
    },
  );
  await f.run("next");
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  assert.equal(f.calls.length, 3);
  assert.equal(
    f.context(),
    `${initial}\n## Research handoff decisions\n\n- ${decision}\n`,
  );
});

it("budgets assessment and verifier evidence without dropping complete relevant passages", async (t) => {
  const note = "Use CSV only for exports under 10 MB.";
  const prose = "Use CSV only for exports under 10 MB.\r\n";
  const fenced =
    "```text\r\nCSV export limit: 10 MB.\r\n\r\n  Do not trim.  \r\n```\r\n";
  const oversized = `\`\`\`text\n${"λ".repeat(100_000)}\n\`\`\`\n\n${prose}\r\n${fenced}`;
  const candidate = { append: note };
  const checkEvidence = (input: AssessmentInput | VerificationInput) => {
    assert.equal(input.excerptedDiscussion, true);
    assert.ok(input.originalDiscussion.some(({ body }) => body === prose));
    assert.ok(input.originalDiscussion.some(({ body }) => body === fenced));
    assert.ok(
      input.originalDiscussion.every(({ body }) => !body.includes("λλλλ")),
    );
  };
  const f = fixture(
    t,
    (input) => {
      checkEvidence(input);
      return {
        ...ready,
        researchHandoff: { ...noChange, clarification: candidate },
      };
    },
    {
      model: { contextWindow: 65_000, maxTokens: 1024 },
      discussion: [
        { assistant: oversized },
        ...Array.from(
          { length: 8 },
          (_, i) => `Unrelated log ${i}: ${"abc ".repeat(700)}`,
        ),
      ],
      verify(input) {
        checkEvidence(input);
        assert.deepEqual(input.candidate, candidate);
        return "true";
      },
    },
  );
  await f.run(`accept ${note}`);
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  assert.ok(f.context().includes(note));
});

it("preserves an older agreement in the mandatory decision window despite newer diagnostics", async (t) => {
  const decision = "Keep audit export filenames immutable across retries.";
  const agreement =
    `Agreed: ${decision} Tell Roadmap to keep this constraint.`.padEnd(
      120,
      " ",
    );
  const diagnostics = Array.from({ length: 6 }, (_, i) =>
    `Diagnostic ${i + 1}: `.padEnd(3960, "x"),
  );
  const discussion = [
    "Initial request.",
    { resume: true as const },
    agreement,
    ...Array.from({ length: 10 }, (_, i) => `Follow-up ${i + 1}.`),
    ...diagnostics,
  ];
  const expected = discussion
    .filter((body) => typeof body === "string")
    .map((body) => `user: ${body}`)
    .join("\n\n");
  const candidate = { append: decision };
  const f = fixture(
    t,
    (input) => {
      assert.ok(!input.readinessDiscussion.includes(agreement));
      assert.ok(
        input.originalDiscussion.every(({ body }) => body !== agreement),
      );
      assert.equal(input.decisionDiscussion, expected);
      return {
        ...ready,
        researchHandoff: {
          ...noChange,
          decisions: input.decisionDiscussion?.includes(agreement)
            ? [candidate]
            : [],
        },
      };
    },
    {
      discussion,
      verify(input) {
        assert.equal(input.settled, true);
        assert.deepEqual(input.candidate, candidate);
        assert.ok(
          input.originalDiscussion.some(
            ({ role, body }) => role === "user" && body === agreement,
          ),
        );
        return "true";
      },
    },
  );
  await f.run("next");
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  assert.equal(f.calls.length, 3);
  assert.equal(
    f.context(),
    `${initial}\n## Research handoff decisions\n\n- ${decision}\n`,
  );
});

it("keeps Research when the decision window would be the part omitted from the model request", async (t) => {
  const model = { contextWindow: 16_384, maxTokens: 1024 };
  const discussion = Array.from(
    { length: 20 },
    (_, i) => `Settled Research detail ${i + 1}: keep the audit record.`,
  );
  const decisionWindow = discussion.map((body) => `user: ${body}`).join("\n\n");
  const readinessWindow = discussion
    .slice(-16)
    .map((body) => `user: ${body}`)
    .join("\n\n");
  const readyHandoff = { ...ready, researchHandoff: noChange };
  let padding: number | undefined;
  const baseline = fixture(
    t,
    (input, { systemPrompt, maxTokens }) => {
      assert.equal(input.readinessDiscussion, readinessWindow);
      assert.equal(input.decisionDiscussion, decisionWindow);
      const fixed = {
        ...input,
        originalDiscussion: [],
        excerptedDiscussion: true,
      };
      padding =
        model.contextWindow -
        maxTokens -
        512 -
        Buffer.byteLength(systemPrompt) -
        Buffer.byteLength(JSON.stringify(fixed));
      return readyHandoff;
    },
    { model, discussion },
  );
  await baseline.run("next");
  assert.equal(baseline.phase(), "roadmap", baseline.notices.join("\n"));
  assert.ok(padding !== undefined && padding > 0);

  const contextAtLimit = `${initial}${"x".repeat(padding)}`;
  const atLimit = fixture(
    t,
    (input) => {
      assert.equal(input.readinessDiscussion, readinessWindow);
      assert.equal(input.decisionDiscussion, decisionWindow);
      assert.deepEqual(input.originalDiscussion, []);
      return readyHandoff;
    },
    { model, context: contextAtLimit, discussion },
  );
  const inodeAtLimit = atLimit.inode();
  await atLimit.run("next");
  assert.equal(atLimit.phase(), "roadmap", atLimit.notices.join("\n"));
  assert.equal(atLimit.inode(), inodeAtLimit);

  const context = `${contextAtLimit}x`;
  const overLimit = fixture(t, () => readyHandoff, {
    model,
    context,
    discussion,
  });
  const inode = overLimit.inode();
  await overLimit.run("next");
  assert.deepEqual(overLimit.calls, []);
  assert.match(
    overLimit.notices.join("\n"),
    /mandatory Research readiness window, decision window, and context\.md do not fit/,
  );
  assert.equal(overLimit.phase(), "research");
  assert.equal(overLimit.context(), context);
  assert.equal(overLimit.inode(), inode);
});

it("includes older agreed decisions in the Research handoff history", async (t) => {
  const decision = "We agreed to keep the CSV export path.";
  const f = fixture(
    t,
    (input) => ({
      ...ready,
      researchHandoff: {
        ...noChange,
        decisions: input.originalDiscussion.some(
          ({ body }) => body === decision,
        )
          ? [{ append: decision }]
          : [],
      },
    }),
    {
      discussion: [
        decision,
        ...Array.from({ length: 19 }, (_, i) => `Follow-up ${i}`),
      ],
    },
  );
  await f.run("next");
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  const input = JSON.parse(f.calls[0]) as AssessmentInput;
  assert.equal(input.originalDiscussion.length, 20);
  assert.equal(input.originalDiscussion[0].body, decision);
  assert.ok(f.context().includes(decision));
});

it("keeps Research discussion across resumes but not across the phase boundary", async (t) => {
  const decision = "We agreed to keep the CSV export path.";
  const f = fixture(
    t,
    (input) => {
      assert.deepEqual(
        input.originalDiscussion.map(({ body }) => body),
        [decision, "First resume", "Second resume"],
      );
      return {
        ...ready,
        researchHandoff: { ...noChange, decisions: [{ append: decision }] },
      };
    },
    {
      discussion: [
        "Earlier phase decision.",
        { kickoff: true },
        decision,
        { legacyResume: true },
        "First resume",
        { resume: true },
        "Second resume",
      ],
    },
  );
  await f.run("next");
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  assert.ok(f.context().includes(decision));
});

it("accepts a proposal from the wider readiness history without a note", async (t) => {
  const proposal = "I propose CSV exports only under 10 MB.";
  const candidate = { append: "Use CSV only for exports under 10 MB." };
  const followUps = Array.from(
    { length: 16 },
    (_, i) => `Related observation ${i + 1}.`,
  );
  const f = fixture(
    t,
    (input) => {
      assert.equal(input.originalDiscussion.length, 17);
      assert.equal(input.originalDiscussion[0].body, proposal);
      return {
        ...ready,
        pendingProposal: proposal,
        researchHandoff: { ...noChange, proposal: candidate },
      };
    },
    {
      discussion: [{ assistant: proposal }, ...followUps],
      verify(input) {
        assert.equal(input.note, "");
        assert.deepEqual(input.candidate, candidate);
        assert.deepEqual(input.originalDiscussion[0], {
          role: "assistant",
          body: proposal,
        });
        return "true";
      },
    },
  );
  const inode = f.inode();
  await f.run("next");
  assert.match(f.notices.join("\n"), /needs approval/);
  assert.equal(f.phase(), "research");
  assert.equal(f.inode(), inode);
  await f.run("accept");
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  assert.ok(f.context().includes(candidate.append));
});

it("keeps a whole fenced proposal over the prose split threshold when it fits the budget", async (t) => {
  const proposal = "I recommend keeping the export template verbatim.";
  const code = `template-start\n${"record  ".repeat(650)}\n  template-end  `;
  const fence = `\`\`\`text\n${code}\n\`\`\`\n`;
  const original = `${proposal}\n\n${fence}`;
  assert.ok(fence.length > 5000);
  const candidate = {
    append: {
      summary: "Keep the export template verbatim.",
      code,
      language: "text",
    },
  };
  const f = fixture(
    t,
    (input) => {
      assert.equal(input.command, "/task accept");
      assert.equal(input.note, "");
      assert.deepEqual(input.originalDiscussion, [
        { role: "assistant", body: `${proposal}\n` },
        { role: "assistant", body: fence },
      ]);
      return {
        ...ready,
        pendingProposal: proposal,
        researchHandoff: { ...noChange, proposal: candidate },
      };
    },
    {
      discussion: [{ assistant: original }],
      verify(input) {
        assert.deepEqual(input.candidate, candidate);
        assert.equal(input.excerptedDiscussion, true);
        assert.deepEqual(input.originalDiscussion, [
          { role: "assistant", body: `${proposal}\n` },
          { role: "assistant", body: fence },
        ]);
        return "true";
      },
    },
  );
  await f.run("accept");
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  assert.ok(f.context().includes(fence));
});

it("preserves significant blank lines inside a long numbered-list fence", async (t) => {
  const proposal = "10. Keep this export template verbatim:";
  const code = `template-start\n${"record  ".repeat(650)}\n\n\n  template-end  `;
  const nested = `    \`\`\`text\n${code
    .split("\n")
    .map((line) => (line ? `    ${line}` : ""))
    .join("\n")}\n    \`\`\`\n`;
  assert.ok(nested.length > 5000);
  const original = `${proposal}\n\n${nested}`;
  const candidate = {
    append: {
      summary: "Keep the export template verbatim.",
      code,
      language: "text",
    },
  };
  const checkEvidence = (input: AssessmentInput | VerificationInput) => {
    assert.deepEqual(input.originalDiscussion, [
      { role: "assistant", body: `${proposal}\n` },
      { role: "assistant", body: nested },
    ]);
  };
  const f = fixture(
    t,
    (input) => {
      checkEvidence(input);
      return {
        ...ready,
        pendingProposal: proposal,
        researchHandoff: { ...noChange, proposal: candidate },
      };
    },
    {
      discussion: [{ assistant: original }],
      verify(input) {
        checkEvidence(input);
        assert.deepEqual(input.candidate, candidate);
        return "true";
      },
    },
  );
  await f.run("accept");
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  assert.ok(f.context().includes(`\n\`\`\`text\n${code}\n\`\`\`\n`));
});

for (const listMarker of ["- ", "10. "]) {
  it(`keeps a long fence opened on the ${listMarker.trim()} list marker intact`, async (t) => {
    const proposal = "I recommend keeping this export template verbatim.";
    const code = `${"record  ".repeat(650)}\n\n- \`\`\`\n\n  template-end  `;
    const indent = " ".repeat(listMarker.length);
    const fence = `${listMarker}\`\`\`text\n${code
      .split("\n")
      .map((line) => (line ? `${indent}${line}` : ""))
      .join("\n")}\n${indent}\`\`\`\n`;
    assert.ok(fence.length > 5000);
    const candidate = {
      append: {
        summary: "Keep the export template verbatim.",
        code,
        language: "text",
      },
    };
    const checkEvidence = (input: AssessmentInput | VerificationInput) => {
      assert.deepEqual(input.originalDiscussion, [
        { role: "assistant", body: `${proposal}\n` },
        { role: "assistant", body: fence },
      ]);
    };
    const f = fixture(
      t,
      (input) => {
        checkEvidence(input);
        return {
          ...ready,
          pendingProposal: proposal,
          researchHandoff: { ...noChange, proposal: candidate },
        };
      },
      {
        discussion: [{ assistant: `${proposal}\n\n${fence}` }],
        verify(input) {
          checkEvidence(input);
          assert.deepEqual(input.candidate, candidate);
          return "true";
        },
      },
    );
    await f.run("accept");
    assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
    assert.ok(f.context().includes(`\n\`\`\`\`text\n${code}\n\`\`\`\`\n`));
  });
}

for (const container of ["top level", "numbered list"] as const) {
  it(`preserves literal indented fence lines inside a ${container} code block`, async (t) => {
    const proposal = "I recommend keeping the export template verbatim.";
    const code = `template-start\n${"record  ".repeat(650)}\n    \`\`\`\n\n\n  template-end  `;
    const indent = container === "numbered list" ? "    " : "";
    const opener = container === "numbered list" ? "10. " : "";
    const sourceFence = `${opener}\`\`\`text\n${code
      .split("\n")
      .map((line) => (line ? `${indent}${line}` : ""))
      .join("\n")}\n${indent}\`\`\`\n`;
    assert.ok(sourceFence.length > 5000);
    const candidate = {
      append: {
        summary: "Keep the export template verbatim.",
        code,
        language: "text",
      },
    };
    const checkEvidence = (input: AssessmentInput | VerificationInput) =>
      assert.deepEqual(input.originalDiscussion, [
        { role: "assistant", body: `${proposal}\n` },
        { role: "assistant", body: sourceFence },
      ]);
    const f = fixture(
      t,
      (input) => {
        checkEvidence(input);
        return {
          ...ready,
          pendingProposal: proposal,
          researchHandoff: { ...noChange, proposal: candidate },
        };
      },
      {
        discussion: [{ assistant: `${proposal}\n\n${sourceFence}` }],
        verify(input) {
          checkEvidence(input);
          assert.deepEqual(input.candidate, candidate);
          return "true";
        },
      },
    );
    await f.run("accept");
    assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
    assert.ok(f.context().includes(`\n\`\`\`\`text\n${code}\n\`\`\`\`\n`));
  });
}

it("verifies the original proposal before writing when newer diagnostics outrank it", async (t) => {
  const proposal =
    "I propose exporting audit records as signed CSV files and retaining the originals.".padEnd(
      120,
      " ",
    );
  const append =
    "Export audit records as signed CSV files and retain the originals.";
  const diagnostics = Array.from({ length: 6 }, (_, i) =>
    `Diagnostic ${i + 1}: Expected ${proposal} ${append}`.padEnd(3960, "x"),
  );
  const candidate = { append };
  const expectedContext = `${initial}\n## Research handoff decisions\n\n- ${append}\n`;
  const f = fixture(
    t,
    (input) => {
      assert.equal(input.command, "/task accept");
      assert.equal(input.note, "");
      assert.ok(
        input.readinessDiscussion.startsWith(`assistant: ${proposal}\n\n`),
      );
      assert.equal(input.decisionDiscussion, undefined);
      return {
        ...ready,
        pendingProposal: append,
        researchHandoff: { ...noChange, proposal: candidate },
      };
    },
    {
      discussion: [{ assistant: proposal }, ...diagnostics],
      verify(input, _systemPrompt, windows) {
        assert.equal(input.note, "");
        assert.deepEqual(input.candidate, candidate);
        assert.equal(input.originalDiscussion.length, diagnostics.length);
        assert.ok(
          input.originalDiscussion.every(({ role }) => role === "user"),
        );
        assert.ok(
          windows.readinessDiscussion.startsWith(`assistant: ${proposal}\n\n`),
        );
        assert.equal(f.context(), initial);
        assert.equal(f.phase(), "research");
        return "true";
      },
    },
  );
  await f.run("accept");
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  assert.equal(f.calls.length, 3);
  assert.deepEqual(f.switchContexts, [expectedContext]);
  assert.equal(f.context(), expectedContext);
});

it("reports a mandatory verification budget error before writing or switching", async (t) => {
  const proposal = "Keep the accepted format.";
  const candidate = { append: proposal.padEnd(6000, "x") };
  const f = fixture(
    t,
    () => ({
      ...ready,
      pendingProposal: proposal,
      researchHandoff: { ...noChange, proposal: candidate },
    }),
    {
      model: { contextWindow: 9000, maxTokens: 1024 },
      discussion: [{ assistant: proposal }],
      verify() {
        assert.fail("The mandatory verifier request does not fit");
      },
    },
  );
  const inode = f.inode();
  await f.run("accept");
  assert.equal(f.calls.length, 1);
  assert.match(
    f.notices.join("\n"),
    /mandatory Research verification inputs do not fit/,
  );
  assert.equal(f.phase(), "research");
  assert.equal(f.context(), initial);
  assert.equal(f.inode(), inode);
  assert.deepEqual(f.switchContexts, []);
});

it("rejects a matching summary that omits a condition from the actual approval", async (t) => {
  const proposal = "Use CSV for export.";
  const original = "I recommend CSV only for exports under 10 MB.";
  const candidate = { append: proposal };
  const f = fixture(
    t,
    () => ({
      ...ready,
      pendingProposal: proposal,
      researchHandoff: { ...noChange, proposal: candidate },
    }),
    {
      discussion: [{ assistant: original }],
      verify(input) {
        assert.deepEqual(input, {
          note: "",
          proposal,
          candidate,
          originalDiscussion: [{ role: "assistant", body: original }],
          context: initial,
        });
        return "false";
      },
    },
  );
  await f.run("accept");
  assert.match(
    f.notices.join("\n"),
    /Invalid Research handoff.*accepted proposal/,
  );
  assert.equal(f.calls.length, 2);
  assert.equal(f.context(), initial);
  assert.equal(f.phase(), "research");
});

it("cannot substitute an old format for the approved proposal", async (t) => {
  const proposal = "Use CSV for export.";
  const candidate = { existing: "Export format: JSON." };
  const f = fixture(
    t,
    () => ({
      ...ready,
      pendingProposal: proposal,
      researchHandoff: {
        ...noChange,
        proposal: candidate,
      },
    }),
    {
      discussion: [{ assistant: proposal }],
      verify(input) {
        assert.deepEqual(input, {
          note: "",
          candidate,
          proposal,
          originalDiscussion: [{ role: "assistant", body: proposal }],
          context: initial,
        });
        return "false";
      },
    },
  );
  const inode = f.inode();
  await f.run("accept");
  assert.match(
    f.notices.join("\n"),
    /Invalid Research handoff.*accepted proposal/,
  );
  assert.equal(f.calls.length, 2);
  assert.equal(f.inode(), inode);
  assert.equal(f.context(), initial);
  assert.equal(f.phase(), "research");
});

it("rejects a settled addition that broadens the agreement before a Research resume", async (t) => {
  const original = [
    { role: "assistant", body: "Use CSV only for exports under 10 MB." },
    { role: "user", body: "Agreed, only under 10 MB." },
  ];
  const candidate = { append: "Use CSV for exports." };
  const f = fixture(
    t,
    () => ({
      ...ready,
      researchHandoff: { ...noChange, decisions: [candidate] },
    }),
    {
      discussion: [
        { assistant: original[0].body },
        original[1].body,
        { resume: true },
      ],
      verify(input) {
        assert.deepEqual(input, {
          note: "",
          candidate,
          settled: true,
          originalDiscussion: original,
          context: initial,
        });
        return "false";
      },
    },
  );
  const inode = f.inode();
  await f.run("next");
  assert.match(
    f.notices.join("\n"),
    /Invalid Research handoff.*accepted decision/,
  );
  assert.equal(f.calls.length, 2);
  assert.equal(f.phase(), "research");
  assert.equal(f.context(), initial);
  assert.equal(f.inode(), inode);
});

for (const matchesAgreement of [false, true]) {
  it(
    matchesAgreement
      ? "verifies a current settled quotation and advances without writing"
      : "rejects a settled quotation that does not record the agreement",
    async (t) => {
      const agreement = "Use CSV only for exports under 10 MB.";
      const existing = matchesAgreement ? agreement : "Export format: JSON.";
      const context = `# Export\n\n${existing}\n`;
      const candidate = { existing };
      const f = fixture(
        t,
        () => ({
          ...ready,
          researchHandoff: { ...noChange, decisions: [candidate] },
        }),
        {
          context,
          discussion: [
            { assistant: agreement },
            "Agreed, only for exports under 10 MB.",
          ],
          verify(input) {
            assert.deepEqual(input, {
              note: "",
              candidate,
              settled: true,
              originalDiscussion: [
                { role: "assistant", body: agreement },
                { role: "user", body: "Agreed, only for exports under 10 MB." },
              ],
              context,
            });
            return JSON.stringify(matchesAgreement);
          },
        },
      );
      const inode = f.inode();
      await f.run("next");
      assert.equal(
        f.phase(),
        matchesAgreement ? "roadmap" : "research",
        f.notices.join("\n"),
      );
      assert.equal(f.calls.length, matchesAgreement ? 3 : 2);
      if (!matchesAgreement)
        assert.match(
          f.notices.join("\n"),
          /Invalid Research handoff.*accepted decision/,
        );
      assert.equal(f.context(), context);
      assert.equal(f.inode(), inode);
    },
  );
}

it("resolves a clarification using Research discussion even without a pending proposal", async (t) => {
  const source =
    "The available options are: 1. Export as JSON; 2. Export as CSV.";
  const note = "Use the second option.";
  const candidate = { append: "Export as CSV." };
  const f = fixture(
    t,
    () => ({
      ...ready,
      researchHandoff: { ...noChange, clarification: candidate },
    }),
    {
      discussion: [{ assistant: source }, { resume: true }],
      verify(input) {
        assert.deepEqual(input, {
          note,
          candidate,
          originalDiscussion: [{ role: "assistant", body: source }],
          context: initial,
        });
        return "true";
      },
    },
  );
  await f.run(`accept ${note}`);
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  assert.ok(f.context().includes(candidate.append));
});

it("resolves an approval note from the shared Research evidence window", async (t) => {
  const earlier = "Filename options: 1. weekly.csv; 2. daily.csv.";
  const proposal = "I propose exporting as CSV.";
  const note = "Use the second filename we discussed.";
  const accepted = { append: "Export as CSV using `daily.csv`." };
  const clarification = { append: "Name the export file `daily.csv`." };
  const followUps = Array.from({ length: 15 }, (_, i) => `Follow-up ${i + 1}`);
  const intervening = followUps.map((body) => ({ role: "user", body }));
  const f = fixture(
    t,
    (input) => {
      assert.equal(input.originalDiscussion[0].body, earlier);
      return {
        ...ready,
        pendingProposal: proposal,
        researchHandoff: { ...noChange, proposal: accepted, clarification },
      };
    },
    {
      discussion: [
        { assistant: earlier },
        { resume: true },
        ...followUps,
        { assistant: proposal },
      ],
      verify(input) {
        const preResume = { role: "assistant", body: earlier };
        const postResume = { role: "assistant", body: proposal };
        if (input.proposal) {
          assert.deepEqual(input, {
            note,
            proposal,
            candidate: accepted,
            originalDiscussion: [preResume, ...intervening, postResume],
            context: initial,
          });
          return "true";
        }
        assert.deepEqual(input, {
          note,
          candidate: clarification,
          originalDiscussion: [preResume, ...intervening, postResume],
          context: initial,
          staged: [`- ${accepted.append}`],
        });
        return JSON.stringify({ staged: [accepted.append] });
      },
    },
  );
  await f.run(`accept ${note}`);
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  assert.equal(f.calls.length, 4);
  assert.equal(
    f.context(),
    `${initial}\n## Research handoff decisions\n\n- ${accepted.append}\n`,
  );
});

it("rejects an unmarked replacement before changing context or switching phase", async (t) => {
  const note = "Use CSV instead of the JSON export format.";
  const candidate = { append: "Export data as CSV." };
  const f = fixture(
    t,
    () => ({
      ...ready,
      researchHandoff: { ...noChange, clarification: candidate },
    }),
    {
      verify(input, systemPrompt) {
        assert.deepEqual(input, {
          note,
          candidate,
          originalDiscussion: [],
          context: initial,
        });
        assert.match(
          systemPrompt,
          /return false unless the append itself explicitly identifies the old decision and states that it is replaced/,
        );
        return "false";
      },
    },
  );
  const inode = f.inode();
  await f.run(`accept ${note}`);
  assert.equal(f.calls.length, 2);
  assert.match(f.notices.join("\n"), /Invalid Research handoff.*clarification/);
  assert.equal(f.phase(), "research");
  assert.equal(f.context(), initial);
  assert.equal(f.inode(), inode);
});

it("records an explicit supersession once when the clarification only repeats the approved proposal", async (t) => {
  const proposal = "Export data as JSON.";
  const note = "Use CSV instead.";
  const updated = {
    append: "Export data as CSV, replacing the earlier JSON format decision.",
  };
  const f = fixture(
    t,
    () => ({
      ...ready,
      pendingProposal: proposal,
      researchHandoff: {
        ...noChange,
        proposal: updated,
        clarification: { append: note },
      },
    }),
    {
      discussion: [{ assistant: proposal }],
      verify(input, systemPrompt) {
        assert.match(
          systemPrompt,
          /return false unless the append itself explicitly identifies the old decision and states that it is replaced/,
        );
        assert.deepEqual(
          input,
          input.proposal
            ? {
                note,
                proposal,
                candidate: updated,
                originalDiscussion: [{ role: "assistant", body: proposal }],
                context: initial,
              }
            : {
                note,
                candidate: { append: note },
                originalDiscussion: [{ role: "assistant", body: proposal }],
                context: initial,
                staged: [`- ${updated.append}`],
              },
        );
        return input.proposal
          ? "true"
          : JSON.stringify({ staged: [updated.append] });
      },
    },
  );
  await f.run(`accept ${note}`);
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  assert.equal(f.calls.length, 4);
  assert.equal(
    f.context(),
    `${initial}\n## Research handoff decisions\n\n- ${updated.append}\n`,
  );
});

it("rejects a settled entry superseded by the current accept note before writing", async (t) => {
  const original = "We agreed that all exports use JSON.";
  const note = "Use CSV for all exports.";
  const candidate = { append: "Use JSON for all exports." };
  const f = fixture(
    t,
    () => ({
      ...ready,
      researchHandoff: {
        ...noChange,
        decisions: [candidate],
        clarification: { append: note },
      },
    }),
    {
      discussion: [original],
      verify(input) {
        assert.deepEqual(input, {
          note,
          candidate,
          settled: true,
          originalDiscussion: [{ role: "user", body: original }],
          context: initial,
        });
        return "false";
      },
    },
  );
  const inode = f.inode();
  await f.run(`accept ${note}`);
  assert.equal(f.calls.length, 2);
  assert.match(
    f.notices.join("\n"),
    /Invalid Research handoff.*accepted decision/,
  );
  assert.equal(f.phase(), "research");
  assert.equal(f.context(), initial);
  assert.equal(f.inode(), inode);
});

for (const invalid of [false, true]) {
  it(
    invalid
      ? "rejects a citation batch with one missing staged passage"
      : "accepts multiple exact staged passages that together cover the note",
    async (t) => {
      const format = "Use CSV for exports.";
      const filename = "Name the export file `daily.csv`.";
      const note = "Use CSV and name the file daily.csv.";
      const candidate = {
        append: "Use CSV for exports and name the file `daily.csv`.",
      };
      const f = fixture(
        t,
        () => ({
          ...ready,
          researchHandoff: {
            ...noChange,
            decisions: [{ append: format }, { append: filename }],
            clarification: candidate,
          },
        }),
        {
          discussion: [
            "Agreed: export as CSV and use daily.csv as the filename.",
          ],
          verify(input) {
            assert.equal(input.note, note);
            if (input.settled) return "true";
            assert.deepEqual(input.candidate, candidate);
            assert.deepEqual(input.staged, [`- ${format}`, `- ${filename}`]);
            return JSON.stringify({
              staged: [
                format,
                invalid ? "Name the export file `weekly.csv`." : filename,
              ],
            });
          },
        },
      );
      const inode = f.inode();
      await f.run(`accept ${note}`);
      if (invalid) {
        assert.match(
          f.notices.join("\n"),
          /Invalid Research handoff.*clarification/,
        );
        assert.equal(f.phase(), "research");
        assert.equal(f.context(), initial);
        assert.equal(f.inode(), inode);
      } else {
        assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
        assert.equal(
          f.context(),
          `${initial}\n## Research handoff decisions\n\n- ${format}\n- ${filename}\n`,
        );
      }
    },
  );
}

it("writes a multiline snippet in a Markdown fence without changing code bytes", async (t) => {
  const code = "def render():\n    return '''\n```\n    '''  ";
  const note = `Keep this Python snippet verbatim:\n\n\`\`\`\`python\n${code}\n\`\`\`\``;
  const candidate = {
    append: {
      summary: "Keep the Python render snippet verbatim.",
      code,
      language: "python",
    },
  };
  const f = fixture(
    t,
    () => ({
      ...ready,
      researchHandoff: { ...noChange, clarification: candidate },
    }),
    {
      verify(input) {
        assert.deepEqual(input, {
          note,
          candidate,
          originalDiscussion: [],
          context: initial,
        });
        return "true";
      },
    },
  );
  // Pi trims the entire editor submission before removing the slash-command name.
  const submitted = `  /task accept ${note}\n  `.trim();
  await f.run(submitted.slice("/task ".length));
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  assert.equal((JSON.parse(f.calls[0]) as AssessmentInput).note, note);
  assert.ok(f.context().includes(`\n\`\`\`\`python\n${code}\n\`\`\`\`\n`));
});

for (const [candidate, verification] of [
  [{ existing: "JSON" }, "false"],
  [{ append: "Keep the existing export path." }, "false"],
  [{ append: "Use CSV." }, "true and here's why"],
  [{ append: "Use CSV." }, JSON.stringify({ existing: "Use CSV." })],
]) {
  it(`fails closed for ${JSON.stringify(candidate)} with verification ${verification}`, async (t) => {
    const f = fixture(
      t,
      () => ({
        ...ready,
        researchHandoff: {
          ...noChange,
          clarification: candidate,
        },
      }),
      {
        verify(input) {
          assert.equal(input.note, "Use CSV.");
          assert.deepEqual(input.candidate, candidate);
          return verification;
        },
      },
    );
    const inode = f.inode();
    await f.run("accept Use CSV.");
    assert.match(
      f.notices.join("\n"),
      /Invalid Research handoff.*clarification/,
    );
    assert.equal(f.calls.length, 2);
    assert.equal(f.context(), initial);
    assert.equal(f.inode(), inode);
    assert.equal(f.phase(), "research");
  });
}

it("skips a requested append when the decision is already current in context", async (t) => {
  const note = "Use CSV for export.";
  const context = `# Export\n\n- ${note}\n`;
  const candidate = { append: note };
  const f = fixture(
    t,
    () => ({
      ...ready,
      researchHandoff: { ...noChange, clarification: candidate },
    }),
    {
      context,
      verify(input) {
        assert.deepEqual(input, {
          note,
          candidate,
          originalDiscussion: [],
          context,
        });
        return JSON.stringify({ existing: note });
      },
    },
  );
  const inode = f.inode();
  await f.run(`accept ${note}`);
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  assert.equal(f.context(), context);
  assert.equal(f.inode(), inode);
});

it("advances without writing when an exact quotation conveys the note in different words", async (t) => {
  const existing = "Use CSV for export.";
  const context = `# Export\n\n${existing}\n`;
  const note = "Export as CSV.";
  const f = fixture(
    t,
    () => ({
      ...ready,
      researchHandoff: {
        ...noChange,
        clarification: { existing },
      },
    }),
    {
      context,
      verify(input) {
        assert.deepEqual(input, {
          note,
          candidate: { existing },
          originalDiscussion: [],
          context,
        });
        return "true";
      },
    },
  );
  const inode = f.inode();
  await f.run(`accept ${note}`);
  assert.equal(f.phase(), "roadmap", f.notices.join("\n"));
  assert.equal(f.context(), context);
  assert.equal(f.inode(), inode);
});
