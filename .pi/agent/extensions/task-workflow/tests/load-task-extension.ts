import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

// Load the real extension without Pi's host-only modules in npm test.
const hostModules = new Map([
  [
    "@earendil-works/pi-coding-agent",
    `
    import { writeFileSync } from "node:fs";
    import { randomUUID } from "node:crypto";
    import { join } from "node:path";
    export const getMarkdownTheme = () => {};
    export const SessionManager = { create(_root, dir) {
      const path = join(dir, randomUUID() + ".jsonl");
      const branch = [];
      const save = () => writeFileSync(path, JSON.stringify(branch));
      return {
        appendCustomEntry(customType, data) {
          branch.push({ type: "custom", customType, data });
        },
        appendSessionInfo() {}, branch() {}, getSessionFile: () => path,
        appendMessage() { save(); },
        appendCustomMessageEntry(customType, content, display) {
          branch.push({ type: "custom_message", customType, content, display });
          save();
        }
      };
    } };`,
  ],
  ["@earendil-works/pi-ai", 'export const uuidv7 = () => "test";'],
  [
    "@earendil-works/pi-tui",
    `export const truncateToWidth = (value, width) => value.slice(0, width);
    export const visibleWidth = (value) => value.length;
    export const wrapTextWithAnsi = (value, width) => {
      const lines = [];
      for (let i = 0; i < value.length; i += width) lines.push(value.slice(i, i + width));
      return lines.length ? lines : [""];
    };
    export const stripTerminalSequences = (value) => value;
    export const parseColor = (value) => value;
    export const ${[
      "decodeKittyPrintable",
      "getNativeClipboard",
      "Markdown",
      "Text",
      "matchesKey",
      "sliceByColumn",
    ]
      .map((name) => `${name} = () => {}`)
      .join(", ")};`,
  ],
  ["typebox", "export const Type = new Proxy({}, { get: () => () => ({}) });"],
]);
const implementationUrl = new URL("../src/index.ts", import.meta.url);
const hooks = registerHooks({
  load(url, context, next) {
    if (url !== implementationUrl.href) return next(url, context);
    // src/index.ts uses parameter properties, which Node's strip-only loader cannot handle.
    const { outputText } = ts.transpileModule(
      readFileSync(implementationUrl, "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      },
    );
    return { shortCircuit: true, format: "module", source: outputText };
  },
  resolve(specifier, context, next) {
    if (!hostModules.has(specifier)) return next(specifier, context);
    return {
      shortCircuit: true,
      url: `data:text/javascript,${encodeURIComponent(hostModules.get(specifier))}`,
    };
  },
});

/** Load the task extension against minimal host stubs shared by command integration tests. */
export const { default: taskExtension } = await import("../index.ts").finally(
  () => hooks.deregister(),
);
