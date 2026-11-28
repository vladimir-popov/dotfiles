import { join } from "node:path";
import type { Phase, TaskState } from "./phase-model.ts";
import {
  previousStepResultPaths,
  reviewPath,
  roadmapPath,
  stepPath,
  stepResultPath,
} from "./task-artifacts.ts";
import { taskDir } from "./task-state.ts";

/** Shared research handoff rule for the phase prompt and the kickoff. */
export const RESEARCH_CONTEXT_RULE =
  "Keep context.md as a standalone task summary with constraints, accepted decisions, and annotated links to supporting notes. Record durable findings in topical Markdown notes as you discover them, including evidence, rationale, and nonblocking uncertainties. Keep the links current; do not rely on the transition to recover findings from history.";

type PhasePromptInput = { state: TaskState; researchTools: readonly string[] };
type PhaseDefinition = {
  defaultSkill: string;
  prompt(input: PhasePromptInput): string;
};

/** Built-in instructions and default skill for every phase, including terminal sessions. */
export const PHASE_DEFINITIONS: Readonly<Record<Phase, PhaseDefinition>> = {
  research: {
    defaultSkill: "task-research",
    prompt: ({ state, researchTools }) =>
      `Gather task context and inspect project files read-only. ${RESEARCH_CONTEXT_RULE} Artifact edits are available for any task Markdown file; do not edit project code. Research tools enabled for this turn: ${researchTools.join(", ") || "none"}.`,
  },
  roadmap: {
    defaultSkill: "task-roadmap",
    prompt: () =>
      `Discuss the roadmap. Update context.md when agreed facts change, then present a complete revised numbered roadmap. Draft roadmap.md as decisions settle.`,
  },
  prepare: {
    defaultSkill: "task-prepare",
    prompt: ({ state }) =>
      `This is final preparation for step ${state.currentStep}. Read ${roadmapPath(state)} and ${stepPath(state, state.currentStep)} if it exists. Read only earlier step-result artifacts relevant to this roadmap item: ${previousStepResultPaths(state, state.currentStep).join(", ") || "none exist"}. Briefly summarize the planned work and remind the user that this session is for final discussion, not coding. Discuss implementation details and checks; keep the agreed current-step design in ${stepPath(state, state.currentStep)}. Do not edit project code yet. /task next checks unresolved questions and proposals, finalizes the design, captures the baseline, and starts coding.`,
  },
  implement: {
    defaultSkill: "public-api-docs",
    prompt: ({ state }) =>
      `Implement or repair step ${state.currentStep} in this session. Read ${roadmapPath(state)}, ${stepPath(state, state.currentStep)}, and relevant earlier step-result artifacts. Follow the current repair handoff below if present. Continue only unfinished work; do not use earlier repair inputs. Run focused checks. Do not commit. Use /task next when ready for review.`,
  },
  review: {
    defaultSkill: "task-review",
    prompt: ({
      state,
    }) => `Review step ${state.currentStep} independently against the approved context, design, and implementation knowledge. Read ${stepPath(state, state.currentStep)}, the implementation diff, and relevant project code using read-only tools. Read the current implementation handoff at ${stepResultPath(state, state.currentStep)} if it exists, before drawing conclusions. Save ${reviewPath(state, state.currentStep)} as an English artifact using task_write_artifact with artifact "review", step ${state.currentStep}, and operation "create" (or "replace" when revising an existing report).

Start with # Review: step ${state.currentStep}, then include ## Summary and ## Findings. For every finding, place one short, exact excerpt copied verbatim from implementation-${state.currentStep}.diff in a fenced diff block immediately before its heading. Then use a heading ### [Severity] Short title, followed by exactly one Status: open line, a precise Location:, and a concise explanation of the defect and concrete impact. Do not report style preferences as defects. If there are no findings, write No findings. under ## Findings and include no finding headings or diff blocks. In your response, show each finding with its severity, location, impact, and the same diff excerpt. Discuss findings with the user; change statuses only after agreement, using resolved for fixed and dismissed for rejected. Do not edit project code or advance the workflow.`,
  },
  "manual-review": {
    defaultSkill: "task-manual-review",
    prompt: ({ state }) =>
      `This is the manual review phase for step ${state.currentStep}. Read ${stepResultPath(state, state.currentStep)} if relevant and available. The automated review found no remaining issues. Direct the user to inspect ${join(taskDir(state), `implementation-${state.currentStep}.diff`)} and the changed project files. Do not conduct another automated review, edit code, or commit. Use task_write_artifact for any agreed task-artifact updates. Manual-review findings route to implementation; an empty review proceeds to commit.`,
  },
  commit: {
    defaultSkill: "commit-message",
    prompt: ({ state }) =>
      state.commitReady
        ? `Present and explain the commit result already saved in this session. Do not implement, review, or edit project code. Task-artifact edits remain available through task_write_artifact. If a manual commit is pending, the user must commit the reviewed files before leaving; /task next verifies this. Only /task next (or /task accept) leaves this phase and starts the next step or completes the task.`
        : "The commit result is not ready. Do not invent one or edit project code. Task-artifact edits remain available through task_write_artifact. Tell the user that /task next retries Git detection and commit-message generation, while /task accept skips the commit and continues if Git is unavailable.",
  },
  complete: {
    defaultSkill: "task-complete",
    prompt: () =>
      "The task is complete. Do not edit project code through this task session; task-artifact edits remain available through task_write_artifact.",
  },
};
