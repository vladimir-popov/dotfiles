import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it, type TestContext } from "node:test";
import { writeArtifactOperation } from "../artifact-operations.ts";
import { completeResearchHandoff } from "../research-handoff.ts";

const context =
  "# Task\r\n\r\nLegacy detail.\r\n\r\n- Name exports `daily.csv`.\r\n\r\n[Notes](research.md) — Evidence.\r\n";
const note = "Rejected Hypothesis A under Condition B.\n";
const empty = { decisions: [], proposal: null, clarification: null };
const decision = { append: "Keep `parserV2`." };
const proposal = { append: "Use CSV for export." };
const clarification = { append: "Name exports `weekly.csv`." };

type HandoffOptions = Parameters<typeof completeResearchHandoff>[0];

function fixture(
  t: TestContext,
  {
    handoff = empty,
    acceptedProposal = "",
    clarificationNote = "",
    initialContext = context,
  }: {
    handoff?: unknown;
    acceptedProposal?: string;
    clarificationNote?: string;
    initialContext?: string;
  } = {},
) {
  const dir = mkdtempSync(join(tmpdir(), "research-handoff-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "context.md");
  const notePath = join(dir, "research.md");
  writeFileSync(path, initialContext);
  writeFileSync(notePath, note);
  const calls: string[] = [];
  const readContext = () => readFileSync(path, "utf8");
  const options: HandoffOptions = {
    handoff,
    context: initialContext,
    required: { acceptedProposal, clarificationNote },
    readContext,
    async verifyAcceptance(note, candidate, proposal) {
      if (!note && !proposal) return true;
      return (
        (proposal ?? note) ===
        ("append" in candidate
          ? candidate.append
          : candidate.existing.replace(/^- /, ""))
      );
    },
    appendContext(content) {
      calls.push("append");
      writeArtifactOperation({
        path,
        temporaryDirectory: dir,
        operation: "append",
        content,
      });
    },
    async openRoadmap() {
      calls.push("roadmap");
    },
  };
  return { path, notePath, readContext, options, calls };
}

for (const [name, config, expected] of [
  [
    "a decision settled before /task next",
    { handoff: { ...empty, decisions: [decision] } },
    [decision],
  ],
  [
    "a proposal approved without a note",
    { handoff: { ...empty, proposal }, acceptedProposal: proposal.append },
    [proposal],
  ],
  [
    "an approved proposal with a clarification",
    {
      handoff: { ...empty, proposal, clarification },
      acceptedProposal: proposal.append,
      clarificationNote: clarification.append,
    },
    [proposal, clarification],
  ],
  [
    "a clarification without a pending proposal",
    {
      handoff: { ...empty, clarification },
      clarificationNote: clarification.append,
    },
    [clarification],
  ],
] as const) {
  it(`persists ${name} before opening Roadmap`, async (t) => {
    const { options, calls, readContext, notePath } = fixture(t, config);
    const expectedContext = `${context}\n## Research handoff decisions\n\n${expected.map(({ append }) => `- ${append}\n`).join("")}`;
    const openRoadmap = options.openRoadmap;
    options.openRoadmap = async () => {
      assert.equal(readContext(), expectedContext);
      assert.deepEqual(readFileSync(notePath), Buffer.from(note));
      await openRoadmap();
    };
    await completeResearchHandoff(options);
    assert.deepEqual(calls, ["append", "roadmap"]);
  });
}

for (const [label, initialContext] of [
  ["backticks with no final newline", "# Task\n\n```text\nlegacy snippet"],
  ["tildes with CRLF", "# Task\r\n\r\n~~~text\r\nlegacy snippet\r\n"],
  ["a leading BOM", "\uFEFF# Task\n\n```text\nlegacy snippet\n"],
  [
    "a literal indented backtick line",
    "# Task\n\n```text\n    ```\nlegacy snippet\n",
  ],
  [
    "a numbered line that cannot interrupt a paragraph",
    "# Task\n\nLegacy paragraph.\n2. Not a list item\n   ```text\n   legacy snippet",
  ],
] as const) {
  it(`rejects an append inside an unclosed top-level fence (${label})`, async (t) => {
    const { options, path, calls } = fixture(t, {
      initialContext,
      handoff: { ...empty, decisions: [decision] },
    });
    await assert.rejects(
      completeResearchHandoff(options),
      /Close the fenced code block at the end of context\.md/,
    );
    assert.deepEqual(calls, []);
    assert.deepEqual(readFileSync(path), Buffer.from(initialContext));
  });
}

for (const [label, initialContext] of [
  ["a closed top-level fence", "# Task\n\n```text\nlegacy snippet\n```"],
  ["a BOM and final newline", "\uFEFF# Task\n"],
  ["a BOM and no final newline", "\uFEFF# Task"],
  ["an EOF list fence", "# Task\n\n- ```text\n  legacy snippet"],
  [
    "an actual numbered list fence",
    "# Task\n\nLegacy paragraph.\n\n2. List item\n   ```text\n   legacy snippet",
  ],
] as const) {
  it(`appends outside ${label} without changing the existing bytes`, async (t) => {
    const { options, path, calls } = fixture(t, {
      initialContext,
      handoff: { ...empty, decisions: [decision] },
    });
    await completeResearchHandoff(options);
    assert.deepEqual(calls, ["append", "roadmap"]);
    const separator = initialContext.endsWith("\n") ? "\n" : "\n\n";
    assert.deepEqual(
      readFileSync(path),
      Buffer.from(
        `${initialContext}${separator}## Research handoff decisions\n\n- ${decision.append}\n`,
      ),
    );
  });
}

it("does not require closing a legacy fence for a handoff that writes nothing", async (t) => {
  const initialContext = "# Task\n\n```text\nlegacy snippet";
  const { options, readContext, calls } = fixture(t, { initialContext });
  await completeResearchHandoff(options);
  assert.deepEqual(calls, ["roadmap"]);
  assert.equal(readContext(), initialContext);
});

it("does not invoke the writer when no additions are needed", async (t) => {
  const { options, calls, readContext } = fixture(t);
  await completeResearchHandoff(options);
  assert.deepEqual(calls, ["roadmap"]);
  assert.equal(readContext(), context);
});

it("does not duplicate an already-recorded proposal or clarification", async (t) => {
  const { options, calls, readContext } = fixture(t, {
    handoff: {
      ...empty,
      proposal: { existing: "Legacy detail." },
      clarification: { existing: "- Name exports `daily.csv`." },
    },
    acceptedProposal: "Legacy detail.",
    clarificationNote: "Name exports `daily.csv`.",
  });
  await completeResearchHandoff(options);
  assert.deepEqual(calls, ["roadmap"]);
  assert.equal(readContext(), context);
});

for (const [name, handoff] of [
  [
    "malformed decisions",
    { ...empty, decisions: "rewrite the summary", clarification },
  ],
  ["an omitted clarification", { decisions: [decision], proposal: null }],
  [
    "an inexact clarification reference",
    { ...empty, clarification: { existing: "legacy detail" } },
  ],
  [
    "an exact but unrelated clarification reference",
    { ...empty, clarification: { existing: "Legacy detail." } },
  ],
  [
    "an unrelated appended clarification",
    {
      ...empty,
      decisions: [decision],
      clarification: { append: "Keep the existing export path." },
    },
  ],
]) {
  it(`does not write or switch on ${name}`, async (t) => {
    const { options, calls, readContext } = fixture(t, {
      handoff,
      clarificationNote: "Use CSV.",
    });
    await assert.rejects(
      completeResearchHandoff(options),
      /Invalid Research handoff/,
    );
    assert.deepEqual(calls, []);
    assert.equal(readContext(), context);
  });
}

it("requires an entry for an accepted pending proposal", async (t) => {
  const { options, calls } = fixture(t, { acceptedProposal: proposal.append });
  await assert.rejects(completeResearchHandoff(options), /accepted proposal/);
  assert.deepEqual(calls, []);
});

it("rechecks the snapshot after asynchronous clarification verification", async (t) => {
  const { options, path, calls } = fixture(t, {
    handoff: { ...empty, clarification },
    clarificationNote: clarification.append,
  });
  options.verifyAcceptance = async () => {
    writeFileSync(path, `${context}\nConcurrent edit.\n`);
    return true;
  };
  await assert.rejects(
    completeResearchHandoff(options),
    /changed during the Research assessment/,
  );
  assert.deepEqual(calls, []);
});

it("does not switch when writing fails", async (t) => {
  const { options, calls, readContext } = fixture(t, {
    handoff: { ...empty, decisions: [decision] },
  });
  options.appendContext = () => {
    calls.push("append");
    throw new Error("simulated write failure");
  };
  await assert.rejects(
    completeResearchHandoff(options),
    /simulated write failure/,
  );
  assert.deepEqual(calls, ["append"]);
  assert.equal(readContext(), context);
});

it("does not apply an assessment to context modified while it was running", async (t) => {
  const { options, path, calls, readContext } = fixture(t);
  const updated = `${context}\nConcurrent edit.\n`;
  writeFileSync(path, updated);
  await assert.rejects(
    completeResearchHandoff(options),
    /changed during the Research assessment/,
  );
  assert.deepEqual(calls, []);
  assert.equal(readContext(), updated);
});
