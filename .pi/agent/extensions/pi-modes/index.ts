import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const READ_ONLY_TOOLS = [
  "read",
  "grep",
  "find",
  "ls",
  "web_search",
  "fetch_content",
  "get_search_content",
] as const;
const USAGE = "Usage: /ro [on|off|toggle|status]";

/**
 * Adds `/ro` to switch between the initial tool set and a restricted research set.
 * Optional research tools can be added with PI_READONLY_TOOLS, a comma-separated list.
 */
export default function readOnlyModeExtension(pi: ExtensionAPI): void {
  let readOnly = false;
  let defaultTools: string[] | undefined;
  const configuredTools = (process.env.PI_READONLY_TOOLS ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const allowedTools = new Set<string>([...READ_ONLY_TOOLS, ...configuredTools]);

  function setMode(enabled: boolean, ctx: ExtensionContext): void {
    readOnly = enabled;
    if (readOnly) {
      const knownTools = new Set(pi.getAllTools().map((tool) => tool.name));
      pi.setActiveTools([...allowedTools].filter((name) => knownTools.has(name)));
    } else {
      pi.setActiveTools(defaultTools ?? pi.getActiveTools());
    }
    ctx.ui.notify(`Read-only mode ${readOnly ? "on" : "off"}.`, "info");
  }

  pi.on("session_start", async () => {
    readOnly = false;
    defaultTools = pi.getActiveTools();
  });

  pi.registerCommand("ro", {
    description: "Switch read-only mode on or off",
    handler: async (args, ctx) => {
      const input = args.trim();
      const tokens = input ? input.split(/\s+/) : [];
      if (tokens.length > 1) {
        ctx.ui.notify(USAGE, "warning");
        return;
      }

      const action = (tokens[0] ?? "toggle").toLowerCase();
      switch (action) {
        case "on":
          setMode(true, ctx);
          return;
        case "off":
          setMode(false, ctx);
          return;
        case "toggle":
          setMode(!readOnly, ctx);
          return;
        case "status":
          ctx.ui.notify(`Read-only mode is ${readOnly ? "on" : "off"}.`, "info");
          return;
        default:
          ctx.ui.notify(`${USAGE}\nUnknown argument: ${tokens[0]}`, "warning");
      }
    },
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!readOnly) return;

    if (event.toolName === "bash") {
      const command = event.input.command;
      if (typeof command !== "string" || !ctx.hasUI) {
        return {
          block: true,
          reason: "Bash is blocked in read-only mode unless an interactive approval is available.",
        };
      }

      const approved = await ctx.ui.confirm(
        "Approve one Bash command?",
        `Read-only mode blocks Bash by default. Allow this exact command once?\n\n${command}`,
      );
      if (!approved || event.input.command !== command) {
        return { block: true, reason: "Bash command not approved in read-only mode." };
      }
      return;
    }

    if (!allowedTools.has(event.toolName)) {
      return {
        block: true,
        reason: `Tool '${event.toolName}' is blocked in read-only mode. Use /ro off to restore default tools.`,
      };
    }
  });
}
