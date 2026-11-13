import { spawnSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("n", {
    description: "Открыть nnn во всплывающем окне tmux",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/n доступна только в интерактивном TUI Pi.", "warning");
        return;
      }

      if (!process.env.TMUX) {
        ctx.ui.notify(
          "Для всплывающего окна нужен tmux. Запустите Pi внутри tmux и повторите /n.",
          "warning",
        );
        return;
      }

      const result = spawnSync(
        "tmux",
        ["display-popup", "-E", "-w", "90%", "-h", "90%", "-d", process.cwd(), "nnn"],
        { stdio: "inherit" },
      );

      if (result.error) {
        ctx.ui.notify(`Не удалось открыть nnn: ${result.error.message}`, "error");
      } else if (result.status !== 0) {
        ctx.ui.notify(
          result.status === null
            ? `tmux завершился по сигналу ${result.signal ?? "неизвестно"}.`
            : `tmux display-popup завершился с кодом ${result.status}. Проверьте, что nnn установлен.`,
          "error",
        );
      }
    },
  });
}
