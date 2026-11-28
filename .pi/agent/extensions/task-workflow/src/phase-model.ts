/** Persisted workflow phases, in their usual progression order. */
export const TASK_PHASES = [
  "research",
  "roadmap",
  "prepare",
  "implement",
  "review",
  "manual-review",
  "commit",
  "complete",
] as const;

/** Phase identifier used by task state, sessions, and per-phase settings. */
export type Phase = (typeof TASK_PHASES)[number];

/** Saved session paths; step maps use stringified steps and rounds use append order. */
export type SessionRefs = {
  research?: string;
  roadmap?: string;
  prepare?: Record<string, string>;
  implement?: Record<string, string>;
  review?: Record<string, string[]>;
  manualReview?: Record<string, string[]>;
  commit?: Record<string, string>;
};

/** Version-1 project-local workflow record, independent of the host and catalog. */
export type TaskState = {
  version: 1;
  id: string;
  projectRoot: string;
  contextPath: string;
  phase: Phase;
  currentStep: number;
  completedSteps: number[];
  awaitingReview?: number;
  pendingFiles?: string[];
  pendingHashes?: Record<string, string | null>;
  pendingSummary?: string;
  pendingAutoCommitEligible?: boolean;
  pendingGitRepository?: boolean;
  pendingBaselineDir?: string;
  commitPendingFiles?: string[];
  commitPendingHashes?: Record<string, string | null>;
  commitReady?: boolean;
  /** Legacy marker migrated to the manual-review phase when loading state. */
  manualReviewPending?: boolean;
  commitResult?: string;
  reviewRound?: number;
  reviewPending?: boolean;
  /** Name of the latest round's snapshot directory inside the step baseline. */
  reviewSnapshot?: string;
  /** The current round has a delta and a preceding report to review against. */
  reviewFocused?: boolean;
  /** Repair returns under the current approved design, not the review round number. */
  reviewRepairReturns?: number;
  /** A paused review cannot advance until the user chooses a checkpoint action. */
  reviewPaused?: boolean;
  /** Exact finding headings the user explicitly deferred on this step. */
  reviewDeferredFindings?: string[];
  /** Recheck the full step after approving a revised design. */
  reviewNeedsFull?: boolean;
  interruptedSession?: string;
  sessions?: SessionRefs;
};

/**
 * Read a saved session reference without checking the file or repairing missing data.
 * Review rounds use the last stored entry. Complete prefers Commit over Review for
 * the last completed step, falling back to the requested step if that step is falsy.
 */
export function sessionFor(
  state: TaskState,
  phase = state.phase,
  step = state.currentStep,
): string | undefined {
  const sessions = state.sessions;
  if (!sessions) return undefined;
  if (phase === "research") return sessions.research;
  if (phase === "roadmap") return sessions.roadmap;
  if (phase === "prepare") return sessions.prepare?.[String(step)];
  if (phase === "implement") return sessions.implement?.[String(step)];
  if (phase === "manual-review")
    return sessions.manualReview?.[String(step)]?.at(-1);
  if (phase === "commit") return sessions.commit?.[String(step)];
  if (phase === "complete")
    return (
      sessions.commit?.[String(state.completedSteps.at(-1) || step)] ||
      sessions.review?.[String(state.completedSteps.at(-1) || step)]?.at(-1)
    );
  if (phase === "review") return sessions.review?.[String(step)]?.at(-1);
}

/**
 * Update the supplied state in memory without saving it. Review references append
 * without deduplication. Complete initializes the session map but records no path.
 */
export function setSessionFor(
  state: TaskState,
  phase: Phase,
  file: string,
  step = state.currentStep,
): void {
  const sessions = (state.sessions ??= {});
  if (phase === "research") sessions.research = file;
  else if (phase === "roadmap") sessions.roadmap = file;
  else if (phase === "prepare") (sessions.prepare ??= {})[String(step)] = file;
  else if (phase === "implement")
    (sessions.implement ??= {})[String(step)] = file;
  else if (phase === "review")
    (sessions.review ??= {})[String(step)] = [
      ...(sessions.review?.[String(step)] || []),
      file,
    ];
  else if (phase === "manual-review")
    (sessions.manualReview ??= {})[String(step)] = [
      ...(sessions.manualReview?.[String(step)] || []),
      file,
    ];
  else if (phase === "commit") (sessions.commit ??= {})[String(step)] = file;
}
