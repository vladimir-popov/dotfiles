import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const USAGE = "Usage: /ro [on|off|toggle|status]";

type PiModesSettings = {
  readOnlyTools?: unknown;
  editingTools?: unknown;
};

function readToolList(value: unknown, settingName: string): string[] {
  if (!Array.isArray(value) || !value.every((name) => typeof name === "string" && name.trim())) {
    throw new Error(`pi-modes.${settingName} must be an array of non-empty tool names`);
  }
  return value.map((name) => name.trim());
}

/**
 * Adds `/ro` to switch between the initial tool set and a restricted research set.
 * Tool access is configured in the `pi-modes` section of settings.json.
 */
export default function readOnlyModeExtension(pi: ExtensionAPI): void {
  let readOnly = false;
  let defaultTools: string[] | undefined;
  let allowedTools = new Set<string>();
  let blockedTools = new Set<string>();

  function updateStatus(ctx: ExtensionContext): void {
    const activeTools = pi.getActiveTools();
    const knownTools = new Set([...allowedTools, ...blockedTools]);
    const unknownTools = activeTools.filter((name) => !knownTools.has(name));
    const indicator = unknownTools.length > 0
      ? `⁉️ (${unknownTools.join(", ")})`
      : activeTools.some((name) => blockedTools.has(name))
        ? "🚀"
        : "👀";
    ctx.ui.setStatus("pi-modes", indicator);
  }

  function setMode(enabled: boolean, ctx: ExtensionContext): void {
    readOnly = enabled;
    if (readOnly) {
      const knownTools = new Set(pi.getAllTools().map((tool) => tool.name));
      pi.setActiveTools([...allowedTools].filter((name) => knownTools.has(name)));
    } else {
      pi.setActiveTools(defaultTools ?? pi.getActiveTools());
    }
    updateStatus(ctx);
    ctx.ui.notify(`Read-only mode ${readOnly ? "on" : "off"}.`, "info");
  }

  pi.on("session_start", async (_event, ctx) => {
    const settings = pi.getSettings() as Record<string, unknown>;
    const modesSettings = (settings["pi-modes"] ?? {}) as PiModesSettings;
    allowedTools = new Set(readToolList(modesSettings.readOnlyTools, "readOnlyTools"));
    blockedTools = new Set(readToolList(modesSettings.editingTools, "editingTools"));
    readOnly = false;
    defaultTools = pi.getActiveTools();
    updateStatus(ctx);
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

    if (blockedTools.has(event.toolName) || !allowedTools.has(event.toolName)) {
      return {
        block: true,
        reason: `Tool '${event.toolName}' is blocked in read-only mode. Use /ro off to restore default tools.`,
      };
    }
  });
}
