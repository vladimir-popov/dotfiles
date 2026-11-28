import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

// Match Pi's footer thresholds and precision.
function compactTokens(tokens: number): string {
  if (tokens < 1_000) return String(tokens);
  if (tokens < 10_000) return `${(tokens / 1_000).toFixed(1)}k`;
  if (tokens < 1_000_000) return `${Math.round(tokens / 1_000)}k`;
  if (tokens < 10_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  return `${Math.round(tokens / 1_000_000)}M`;
}

/**
 * Format saved token usage and estimated cost across the task's session files.
 * Count all branches, but only once per entry copied by a fork or clone. Mark the
 * total as partial if known session data cannot be read or parsed.
 */
export function formatTaskUsage(
  sessionsDir: string,
  knownSessions: readonly string[],
): string {
  const files = new Set(knownSessions.map((file) => resolve(file)));
  let partial = false;
  try {
    if (!lstatSync(sessionsDir).isDirectory()) throw new Error();
    for (const entry of readdirSync(sessionsDir, { withFileTypes: true })) {
      if (
        entry.name.endsWith(".jsonl") &&
        (entry.isFile() || entry.isSymbolicLink())
      ) {
        files.add(resolve(join(sessionsDir, entry.name)));
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") partial = true;
  }

  const seen = new Set<string>();
  let tokens = 0;
  let cost = 0;
  for (const file of files) {
    let lines: string[];
    try {
      if (!lstatSync(file).isFile()) throw new Error();
      lines = readFileSync(file, "utf8").trim().split("\n");
      if (record(JSON.parse(lines[0]))?.type !== "session") throw new Error();
    } catch {
      partial = true;
      continue;
    }
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      try {
        const entry = record(JSON.parse(line));
        if (!entry || typeof entry.type !== "string") throw new Error();
        const message = record(entry.message);
        const required =
          entry.type === "usage" ||
          (entry.type === "message" && message?.role === "assistant");
        const rawUsage =
          entry.type === "message" &&
          (message?.role === "assistant" || message?.role === "toolResult")
            ? message.usage
            : entry.type === "usage" ||
                entry.type === "compaction" ||
                entry.type === "branch_summary"
              ? entry.usage
              : undefined;
        if (rawUsage === undefined && !required) continue;
        const usage = record(rawUsage);
        if (!usage) throw new Error();
        const counts = [
          usage.input,
          usage.output,
          usage.cacheRead,
          usage.cacheWrite,
        ];
        const amount = record(usage.cost)?.total;
        if (!counts.every(isAmount) || !isAmount(amount)) throw new Error();
        if (
          typeof entry.id === "string" &&
          typeof entry.timestamp === "string"
        ) {
          const key = JSON.stringify([entry.type, entry.id, entry.timestamp]);
          if (seen.has(key)) continue;
          seen.add(key);
        }
        tokens += counts.reduce((sum, count) => sum + count, 0);
        cost += amount;
      } catch {
        partial = true;
      }
    }
  }

  return `${tokens >= 1_000 ? "~ " : ""}${compactTokens(tokens)} tokens · $${cost.toFixed(3)}${partial ? " (partial)" : ""}`;
}
