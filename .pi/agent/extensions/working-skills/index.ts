import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function resolveReadPath(input: string, cwd: string): string | undefined {
  let path = input.startsWith("@") ? input.slice(1) : input;
  if (path.startsWith("~/") || path.startsWith(`~${sep}`)) {
    path = resolve(homedir(), path.slice(2));
  } else if (path.startsWith("file://")) {
    try {
      path = fileURLToPath(path);
    } catch {
      return undefined;
    }
  }
  return resolve(cwd, path);
}

/**
 * Lists skill instructions successfully read during the current Pi activity.
 * Uses the built-in Working line and restores it once the agent settles.
 */
export default function workingSkillsExtension(pi: ExtensionAPI): void {
  const skillsByPath = new Map<string, string>();
  const pending = new Map<string, string>();
  const skillsRead = new Set<string>();

  pi.on("before_agent_start", (event, ctx) => {
    skillsByPath.clear();
    if (!ctx.hasUI) return;
    for (const { filePath, name } of event.systemPromptOptions.skills) {
      skillsByPath.set(resolve(ctx.cwd, filePath), name);
    }
  });

  // Observe execution events instead of intercepting (and potentially blocking) tool calls.
  pi.on("tool_execution_start", (event, ctx) => {
    if (!ctx.hasUI || event.toolName !== "read" || typeof event.args?.path !== "string") return;

    const path = resolveReadPath(event.args.path, ctx.cwd);
    const name = path === undefined ? undefined : skillsByPath.get(path);
    if (name) pending.set(event.toolCallId, name);
  });

  pi.on("tool_execution_end", (event, ctx) => {
    const name = pending.get(event.toolCallId);
    pending.delete(event.toolCallId);
    if (!name || event.isError || skillsRead.has(name)) return;

    skillsRead.add(name);
    ctx.ui.setWorkingMessage(`Working · skills: ${[...skillsRead].join(", ")}`);
  });

  pi.on("agent_settled", (_event, ctx) => {
    pending.clear();
    if (skillsRead.size > 0) ctx.ui.setWorkingMessage();
    skillsRead.clear();
  });
}
