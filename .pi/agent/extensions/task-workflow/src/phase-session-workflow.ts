import { existsSync } from "node:fs";
import {
  sessionFor,
  setSessionFor,
  type Phase,
  type TaskState,
} from "./phase-model.ts";
import { saveState } from "./task-state.ts";

/** Optional message to send only after switching to the replacement session. */
export type PhaseKickoff =
  string | { customType: string; content: string; details?: unknown };

type PhaseSessionPorts<Context, Fresh> = {
  currentFile(ctx: Context): string | undefined;
  notify(ctx: Context, message: string, severity: "info" | "warning"): void;
  createPhaseSession(
    state: TaskState,
    phase: Phase,
    step: number,
    parent?: string,
  ): string;
  switchSession(
    ctx: Context,
    file: string,
    kickoff?: PhaseKickoff,
    afterSwitch?: (fresh: Fresh) => Promise<void>,
  ): Promise<{ cancelled: boolean }>;
};

/** Compose phase persistence policy with host session operations. */
export function createPhaseSessionWorkflow<Context, Fresh>(
  ports: PhaseSessionPorts<Context, Fresh>,
) {
  /** Save a destination, switch sessions, and restore only the entry state snapshot on cancellation or error. */
  async function switchPhase(
    ctx: Context,
    state: TaskState,
    phase: Phase,
    step: number,
    kickoff: PhaseKickoff,
    existing?: string,
    afterSwitch?: (fresh: Fresh) => Promise<void>,
  ): Promise<boolean> {
    const previous = JSON.parse(JSON.stringify(state)) as TaskState;
    const parent = ports.currentFile(ctx);
    const file =
      existing || ports.createPhaseSession(state, phase, step, parent);
    state.phase = phase;
    state.currentStep = step;
    delete state.interruptedSession;
    if (!existing) setSessionFor(state, phase, file, step);
    saveState(state);
    try {
      const result = await ports.switchSession(ctx, file, kickoff, afterSwitch);
      if (result.cancelled) {
        saveState(previous);
        ports.notify(
          ctx,
          `Session switch was cancelled. Use /task ${state.id} to open its saved ${state.phase} phase.`,
          "warning",
        );
        return false;
      }
      return true;
    } catch (error) {
      saveState(previous);
      throw error;
    }
  }

  /** Find or create the saved phase session and save a missing reference explicitly. */
  function ensurePhaseSession(
    ctx: Context,
    state: TaskState,
    phase: Phase,
    step: number,
  ): string {
    let file = sessionFor(state, phase, step);
    if (!file || !existsSync(file)) {
      // Tasks created by the previous extension have artifacts and state but no saved phase sessions.
      file = ports.createPhaseSession(
        state,
        phase,
        step,
        ports.currentFile(ctx),
      );
      setSessionFor(state, phase, file, step);
      if (phase === "implement")
        state.implementationStarted = !!state.pendingBaselineDir;
      saveState(state);
    }
    return file;
  }

  /** Open the saved phase session quietly, without requesting a kickoff. */
  async function continueTaskSession(
    ctx: Context,
    state: TaskState,
  ): Promise<void> {
    let phase = state.phase;
    let step = state.currentStep;
    if (phase === "complete") {
      step = state.completedSteps.at(-1) || step;
      phase = state.sessions?.commit?.[String(step)] ? "commit" : "review";
    }
    const file = ensurePhaseSession(ctx, state, phase, step);
    if (ports.currentFile(ctx) === file) {
      ports.notify(
        ctx,
        `Task ${state.id} is already in its ${phase} session.`,
        "info",
      );
      return;
    }
    const result = await ports.switchSession(ctx, file);
    if (result.cancelled)
      ports.notify(ctx, "⚠️ Session switch was cancelled.", "warning");
  }
  return { switchPhase, continueTaskSession, ensurePhaseSession };
}
