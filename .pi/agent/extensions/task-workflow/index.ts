import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerTaskWorkflow from "./src/index.ts";

const APP_VERSION = "2.10.0";

/** Register the task workflow extension from its stable Pi entry point. */
export default function taskExtension(pi: ExtensionAPI): void {
  registerTaskWorkflow(APP_VERSION, pi);
}
