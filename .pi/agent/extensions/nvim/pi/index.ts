import { timingSafeEqual } from "node:crypto";
import { chmodSync, unlinkSync } from "node:fs";
import { createConnection, createServer, type Server, type Socket } from "node:net";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const SOCKET_PATH_RE = /^\/tmp\/pin-[a-f0-9]{20}\/s\.sock$/;
const REFERENCES_SOCKET_PATH_RE = /^\/tmp\/pin-[a-f0-9]{20}\/r\.sock$/;
const TOKEN_RE = /^[a-f0-9]{64}$/;

type Selection = {
  text: string;
  source: { kind: "file" | "buffer"; name: string };
  startLine: number;
  endLine: number;
};

type InputRequest = {
  kind: "input";
  version: 2;
  token: string;
  prompt: string;
  selection?: Selection;
};

function isInputRequest(value: unknown): value is InputRequest {
  if (typeof value !== "object" || value === null) return false;
  const request = value as Record<string, unknown>;
  if (
    request.kind !== "input" ||
    request.version !== 2 ||
    typeof request.token !== "string" ||
    typeof request.prompt !== "string" ||
    Buffer.byteLength(request.prompt, "utf8") > MAX_REQUEST_BYTES
  )
    return false;
  if (request.selection === undefined) return true;
  if (typeof request.selection !== "object" || request.selection === null) return false;
  const selection = request.selection as Record<string, unknown>;
  const source = selection.source as Record<string, unknown> | undefined;
  return (
    typeof selection.text === "string" &&
    Buffer.byteLength(selection.text, "utf8") <= MAX_REQUEST_BYTES &&
    typeof source === "object" &&
    source !== null &&
    (source.kind === "file" || source.kind === "buffer") &&
    typeof source.name === "string" &&
    source.name.length > 0 &&
    Number.isSafeInteger(selection.startLine) &&
    Number.isSafeInteger(selection.endLine) &&
    (selection.startLine as number) > 0 &&
    (selection.endLine as number) >= (selection.startLine as number)
  );
}

function hasMatchingToken(candidate: string, expected: string): boolean {
  if (!TOKEN_RE.test(candidate) || !TOKEN_RE.test(expected)) return false;
  return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(expected, "hex"));
}

function formatSelection(request: Selection): string {
  let longestBacktickRun = 2;
  for (const match of request.text.matchAll(/`+/g)) {
    longestBacktickRun = Math.max(longestBacktickRun, match[0].length);
  }
  const fence = "`".repeat(longestBacktickRun + 1);
  const location = `Selection from ${request.source.kind} ${JSON.stringify(request.source.name)} (lines ${request.startLine}-${request.endLine}):`;
  const body = request.text.endsWith("\n") ? request.text : `${request.text}\n`;
  return `${location}\n\n${fence}text\n${body}${fence}\n\n`;
}

function removeSocketFile(socketPath: string): void {
  try {
    unlinkSync(socketPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export default function (pi: ExtensionAPI): void {
  let closeBridge: (() => void) | undefined;
  let referencesSocketPath: string | undefined;
  let bridgeToken: string | undefined;
  let workingDirectory = process.cwd();

  pi.on("session_start", (_event, ctx) => {
    const socketPath = process.env.PI_NVIM_SOCKET_PATH;
    const token = process.env.PI_NVIM_SOCKET_TOKEN;
    const configuredReferencesSocket = process.env.PI_NVIM_REFERENCES_SOCKET_PATH;
    if (!socketPath && !token && !configuredReferencesSocket) return;
    if (
      !socketPath ||
      !token ||
      !configuredReferencesSocket ||
      !SOCKET_PATH_RE.test(socketPath) ||
      !REFERENCES_SOCKET_PATH_RE.test(configuredReferencesSocket) ||
      socketPath.replace(/s\.sock$/, "r.sock") !== configuredReferencesSocket ||
      !TOKEN_RE.test(token)
    ) {
      if (ctx.hasUI)
        ctx.ui.notify(
          "pi-nvim: invalid socket configuration; input and references are disabled",
          "error",
        );
      return;
    }

    closeBridge?.();
    referencesSocketPath = configuredReferencesSocket;
    bridgeToken = token;
    workingDirectory = process.env.PI_NVIM_CWD || process.cwd();
    const openSockets = new Set<Socket>();
    let stopped = false;
    let ownsSocketPath = false;
    let server: Server;

    const cleanupPath = () => {
      if (!ownsSocketPath) return;
      ownsSocketPath = false;
      try {
        removeSocketFile(socketPath);
      } catch {
        // Shutdown cleanup is best-effort; the Neovim owner also removes the endpoint.
      }
    };

    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (referencesSocketPath === configuredReferencesSocket) {
        referencesSocketPath = undefined;
        bridgeToken = undefined;
      }
      for (const socket of openSockets) socket.destroy();
      try {
        server.close();
      } catch {
        // The server may not have begun listening yet.
      }
      cleanupPath();
      process.off("exit", cleanupPath);
    };
    closeBridge = stop;

    server = createServer((socket) => {
      openSockets.add(socket);
      let data = Buffer.alloc(0);
      let handled = false;
      socket.setTimeout(5000, () => {
        if (handled) return;
        handled = true;
        reply(socket, { ok: false, error: "request timed out" });
      });

      const reject = (error: string) => reply(socket, { ok: false, error });

      socket.on("data", (chunk) => {
        if (handled) return;
        data = Buffer.concat([data, chunk]);
        if (data.length > MAX_REQUEST_BYTES) {
          handled = true;
          reject("input request is too large");
          return;
        }
        const newline = data.indexOf(0x0a);
        if (newline < 0) return;
        handled = true;
        if (newline !== data.length - 1) {
          reject("expected one newline-delimited request");
          return;
        }

        let value: unknown;
        try {
          value = JSON.parse(data.subarray(0, newline).toString("utf8"));
        } catch {
          reject("request is not valid JSON");
          return;
        }
        const request =
          typeof value === "object" && value !== null
            ? (value as Record<string, unknown>)
            : undefined;
        if (
          !request ||
          typeof request.token !== "string" ||
          !hasMatchingToken(request.token, token)
        ) {
          reject("request authentication failed");
          return;
        }
        if (request.kind === "ping" && request.version === 2) {
          if (!ctx.hasUI) {
            reject("this Pi session has no interactive editor");
            return;
          }
          reply(socket, { ok: true, ready: true });
          return;
        }
        if (!isInputRequest(value)) {
          reject("request has an invalid input payload");
          return;
        }
        if (!ctx.hasUI) {
          reject("this Pi session has no interactive editor");
          return;
        }

        try {
          const selection = value.selection ? formatSelection(value.selection) : "";
          const separator = value.prompt && selection ? "\n\n" : "";
          ctx.ui.pasteToEditor(`${value.prompt}${separator}${selection}`);
          reply(socket, { ok: true });
        } catch (error) {
          reject(`could not paste into the Pi editor: ${String(error)}`);
        }
      });
      socket.on("close", () => openSockets.delete(socket));
      socket.on("error", () => openSockets.delete(socket));
    });

    server.on("error", (error) => {
      if (!stopped && ctx.hasUI) {
        ctx.ui.notify(`pi-nvim: could not open input socket: ${error.message}`, "error");
      }
      stop();
    });
    server.listen(socketPath, () => {
      ownsSocketPath = true;
      if (stopped) {
        try {
          server.close();
        } catch {
          // Already stopped.
        }
        cleanupPath();
        return;
      }
      try {
        chmodSync(socketPath, 0o600);
      } catch (error) {
        if (ctx.hasUI)
          ctx.ui.notify(`pi-nvim: could not secure input socket: ${String(error)}`, "error");
        stop();
      }
    });
    process.once("exit", cleanupPath);
  });

  pi.on("turn_end", async (event, ctx) => {
    if (
      event.outcome !== "completed" ||
      event.toolResults.length > 0 ||
      event.message.role !== "assistant" ||
      !referencesSocketPath ||
      !bridgeToken
    )
      return;
    const references = extractFileReferences(assistantText(event.message), workingDirectory);
    try {
      await sendReferences(referencesSocketPath, bridgeToken, references);
    } catch (error) {
      if (ctx.hasUI) {
        ctx.ui.notify(`pi-nvim: could not update Neovim references: ${String(error)}`, "error");
      }
    }
  });

  pi.on("session_shutdown", () => {
    closeBridge?.();
    closeBridge = undefined;
    referencesSocketPath = undefined;
    bridgeToken = undefined;
  });
}

type FileReference = { path: string; line: number };

function isFileReferencePath(path: string): boolean {
  return path.length > 0 && !/^[a-z][a-z\d+.-]*:/i.test(path);
}

function parseReferenceTarget(target: string): { path: string; line: number } | undefined {
  const path = target.startsWith("<") && target.endsWith(">") ? target.slice(1, -1) : target;
  let decodedPath = path;
  try {
    decodedPath = decodeURIComponent(path);
  } catch {
    // Preserve malformed percent escapes as a literal local path.
  }
  const withLine = /^(.*):([1-9]\d*)$/.exec(decodedPath);
  const referencePath = withLine?.[1] ?? decodedPath;
  const line = withLine ? Number(withLine[2]) : 1;
  if (!isFileReferencePath(referencePath) || !Number.isSafeInteger(line)) return;
  return { path: referencePath, line };
}

export function extractFileReferences(text: string, workingDirectory: string): FileReference[] {
  const candidates: { index: number; value: string }[] = [];
  const markdownLink = /\[[^\]]*\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
  for (const match of text.matchAll(markdownLink)) {
    candidates.push({ index: match.index, value: match[1] });
  }

  const pathLine =
    /(^|[\s(`"'=])((?:\/|\.{1,2}\/)?[^\s()[\]<>:"'`=]+?):([1-9]\d*)(?=$|[\s),.;\]`"'!?])/gm;
  for (const match of text.matchAll(pathLine)) {
    candidates.push({ index: match.index, value: `${match[2]}:${match[3]}` });
  }
  candidates.sort((left, right) => left.index - right.index);

  const results: FileReference[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const parsed = parseReferenceTarget(candidate.value.replace(/[.,;!?]+$/, ""));
    if (!parsed) continue;
    const path = resolve(workingDirectory, parsed.path);
    const key = `${path}\0${parsed.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ path, line: parsed.line });
  }
  return results;
}

function sendReferences(socketPath: string, token: string, items: FileReference[]): Promise<void> {
  return new Promise((resolveRequest, rejectRequest) => {
    const socket = createConnection(socketPath);
    let response = "";
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) rejectRequest(error);
      else resolveRequest();
    };

    socket.setTimeout(3000, () => finish(new Error("Neovim references socket timed out")));
    socket.on("connect", () => {
      socket.end(`${JSON.stringify({ kind: "references", version: 1, token, items })}\n`);
    });
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (response.length > 4096) {
        finish(new Error("Neovim references response was too large"));
        return;
      }
      const newline = response.indexOf("\n");
      if (newline < 0) return;
      try {
        const result = JSON.parse(response.slice(0, newline)) as { ok?: boolean; error?: string };
        if (result.ok === true) finish();
        else finish(new Error(result.error ?? "Neovim rejected the references update"));
      } catch {
        finish(new Error("Neovim returned an invalid references response"));
      }
    });
    socket.on("end", () => {
      if (!settled) finish(new Error("Neovim closed the references socket without a response"));
    });
    socket.on("error", (error) => finish(error));
  });
}

function assistantText(message: unknown): string {
  if (typeof message !== "object" || message === null) return "";
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("\n");
}

function reply(socket: Socket, response: { ok: boolean; ready?: boolean; error?: string }): void {
  if (socket.destroyed) return;
  socket.end(`${JSON.stringify(response)}\n`);
}
