import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionFor, setSessionFor } from "../src/phase-model.ts";

type State = Parameters<typeof sessionFor>[0];

function state(overrides: Partial<State> = {}): State {
  return {
    version: 1,
    id: "example",
    projectRoot: "/example",
    contextPath: "/example/context.md",
    phase: "review",
    currentStep: 2,
    completedSteps: [9, 1],
    reviewRound: 99,
    ...overrides,
  };
}

test("selects phase and step references, using the last stored review round", () => {
  const task = state({
    sessions: {
      research: "research",
      roadmap: "roadmap",
      prepare: { "1": "prepare-1", "2": "prepare-2" },
      implement: { "1": "implement-1", "2": "implement-2" },
      review: { "1": [], "2": ["review-first", "review-last"] },
      manualReview: { "1": [], "2": ["manual-first", "manual-last"] },
      commit: { "2": "commit-2" },
    },
  });
  assert.equal(sessionFor(task), "review-last");
  assert.equal(sessionFor(task, "research", 42), "research");
  assert.equal(sessionFor(task, "roadmap", 42), "roadmap");
  assert.equal(sessionFor(task, "prepare"), "prepare-2");
  assert.equal(sessionFor(task, "prepare", 1), "prepare-1");
  assert.equal(sessionFor(task, "implement"), "implement-2");
  assert.equal(sessionFor(task, "implement", 1), "implement-1");
  assert.equal(sessionFor(task, "manual-review"), "manual-last");
  assert.equal(sessionFor(task, "commit"), "commit-2");
  assert.equal(sessionFor(task, "commit", 1), undefined);
  assert.equal(sessionFor(task, "review", 1), undefined);
  assert.equal(sessionFor(task, "manual-review", 1), undefined);
  assert.equal(sessionFor(state({ sessions: {} })), undefined);
  assert.equal(sessionFor(state()), undefined);
});

test("Complete prefers Commit then Review for the last completed step, or falls back to the requested step", () => {
  const task = state({
    phase: "complete",
    sessions: {
      commit: { "1": "commit-1", "9": "commit-9" },
      review: { "1": ["review-1a", "review-1b"], "2": ["review-2"] },
      manualReview: { "1": ["manual-1"], "3": ["manual-3"] },
    },
  });
  assert.equal(sessionFor(task, "complete", 9), "commit-1");
  delete task.sessions!.commit!["1"];
  assert.equal(sessionFor(task), "review-1b");
  task.completedSteps = [9, 0];
  assert.equal(sessionFor(task), "review-2");
  task.completedSteps = [];
  assert.equal(sessionFor(task, "complete", 9), "commit-9");
  assert.equal(sessionFor(task, "complete", 3), undefined);
});

test("updates only the selected reference, appends duplicate rounds, and preserves the serialized shape", () => {
  const task = state();
  const initial = JSON.stringify(task);
  assert.equal(JSON.parse(initial).sessions, undefined);
  setSessionFor(task, "complete", "ignored");
  assert.equal(JSON.stringify(task), initial.slice(0, -1) + ',"sessions":{}}');

  const expected = {
    research: "research-new",
    roadmap: "roadmap-new",
    prepare: { "2": "prepare-2" },
    implement: { "1": "implement-1", "2": "implement-new" },
    review: { "1": ["review-1"], "2": ["review-2", "review-2"] },
    manualReview: { "1": ["manual-1"], "2": ["manual-2", "manual-2"] },
    commit: { "1": "commit-new", "2": "commit-2" },
  };
  setSessionFor(task, "research", "research-old");
  setSessionFor(task, "research", expected.research);
  setSessionFor(task, "roadmap", "roadmap-old");
  setSessionFor(task, "roadmap", expected.roadmap);
  setSessionFor(task, "prepare", "prepare-2");
  setSessionFor(task, "implement", "implement-1", 1);
  setSessionFor(task, "implement", "implement-old");
  setSessionFor(task, "implement", "implement-new");
  setSessionFor(task, "review", "review-1", 1);
  setSessionFor(task, "review", "review-2");
  setSessionFor(task, "review", "review-2");
  setSessionFor(task, "manual-review", "manual-1", 1);
  setSessionFor(task, "manual-review", "manual-2");
  setSessionFor(task, "manual-review", "manual-2");
  setSessionFor(task, "commit", "commit-old", 1);
  setSessionFor(task, "commit", "commit-2");
  setSessionFor(task, "commit", "commit-new", 1);
  setSessionFor(task, "complete", "ignored");
  assert.equal(
    JSON.stringify(task),
    JSON.stringify({ ...JSON.parse(initial), sessions: expected }),
  );
});
