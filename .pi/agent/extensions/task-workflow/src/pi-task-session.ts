import { existsSync, mkdirSync } from "node:fs";
import {
  SessionManager,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Phase, TaskState } from "./phase-model.ts";
import type { PhaseModel } from "./task-config.ts";
import { sessionDirectory, taskDir, taskStatePath } from "./task-state.ts";

/** The locator recorded on a saved Pi session branch; it does not grant task access. */
export type TaskLink = {
  id: string;
  statePath: string;
  phase?: Phase;
  step?: number;
  round?: number;
};

/** Custom Pi session entry used to store a task locator. */
export const ENTRY_TYPE = "task-workflow-link";

/** Read the most recent task locator from the current branch without repairing it. */
export function taskLink(ctx: ExtensionContext): TaskLink | undefined {
  const entries = ctx.sessionManager.getBranch();
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type !== "custom" || entry.customType !== ENTRY_TYPE) continue;
    const data = entry.data as Partial<TaskLink> | undefined;
    return {
      id: data?.id || "",
      statePath: data?.statePath || "",
      phase: data?.phase,
      step: data?.step,
      round: data?.round,
    };
  }
  return undefined;
}

/** Apply an already selected model once per phase and step and record it in Pi. */
export async function applyPhaseModel(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  model: PhaseModel | null | undefined,
  phase: Phase,
  step: number,
): Promise<void> {
  if (!model) return;
  const ready = ctx.sessionManager
    .getBranch()
    .some(
      (entry) =>
        entry.type === "custom" &&
        entry.customType === "task-workflow-model-ready" &&
        (entry.data as { phase?: Phase; step?: number } | undefined)?.phase ===
          phase &&
        (entry.data as { step?: number } | undefined)?.step === step,
    );
  if (ready) return;
  const selected = ctx.modelRegistry.find(model.provider, model.model);
  if (!selected)
    throw new Error(`Task model not found: ${model.provider}/${model.model}`);
  if (!(await pi.setModel(selected)))
    throw new Error(
      `Task model has no configured authentication: ${model.provider}/${model.model}`,
    );
  if (model.thinkingLevel) pi.setThinkingLevel(model.thinkingLevel);
  ctx.sessionManager.appendCustomEntry("task-workflow-model-ready", {
    phase,
    step,
  });
}

/** Create and persist a linked session, leaving switching decisions to the caller. */
export function createPhaseSession(
  state: TaskState,
  phase: Phase,
  step: number,
  displayName: (state: TaskState, phase: Phase, step: number) => string,
  parent?: string,
  visibleMessage?: string,
  visibleMessageType = "task-commit",
): string {
  mkdirSync(sessionDirectory(state), { recursive: true });
  const session = SessionManager.create(
    state.projectRoot,
    sessionDirectory(state),
    parent ? { parentSession: parent } : undefined,
  );
  const round = phase === "review" ? (state.reviewRound ?? 0) : undefined;
  session.appendCustomEntry(ENTRY_TYPE, {
    id: state.id,
    statePath: taskStatePath(state),
    phase,
    step,
    round,
  } satisfies TaskLink);
  const infoId = session.appendSessionInfo(displayName(state, phase, step));
  // Pi persists a new session only after a user/assistant message. Keep that empty
  // persistence trigger off the active branch so it never enters editor history.
  session.appendMessage({ role: "user", content: [], timestamp: Date.now() });
  session.branch(infoId);
  session.appendCustomMessageEntry(
    "task-workflow-seed",
    `Task ${state.id}, ${phase} phase${step ? `, step ${step}` : ""}. The approved task artifacts are in ${taskDir(state)}. This is a fresh Pi session. Wait for the next message before taking action.`,
    false,
  );
  if (visibleMessage)
    session.appendCustomMessageEntry(visibleMessageType, visibleMessage, true);
  const file = session.getSessionFile();
  if (!file || !existsSync(file))
    throw new Error("Pi did not save the new task session.");
  return file;
}

/** Persist an unlinked session outside the task runtime for detachment. */
export function createNeutralSession(root: string): string {
  const session = SessionManager.create(root);
  const anchor = session.appendCustomEntry("task-workflow-neutral", {});
  session.appendMessage({ role: "user", content: [], timestamp: Date.now() });
  session.branch(anchor);
  session.appendCustomEntry("task-workflow-neutral-ready", {});
  const file = session.getSessionFile();
  if (!file || !existsSync(file))
    throw new Error(
      "Pi did not save the session needed to leave the deleted task.",
    );
  return file;
}
