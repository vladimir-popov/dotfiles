import { basename } from "node:path";
import type { TaskState } from "./phase-model.ts";

/** Normalized commit title and body; fallback marks a less structured draft. */
export type DraftedCommitMessage = {
  title: string;
  body: string;
  fallback?: boolean;
};

const COMMIT_BODY_LINE_LIMIT = 70;

function wrapCommitBody(body: string): string {
  return body
    .split(/\r?\n/)
    .flatMap((line) => {
      if (line.length <= COMMIT_BODY_LINE_LIMIT || !line.trim()) return [line];

      const indentation = line.match(/^\s*/)?.[0] || "";
      const content = line.slice(indentation.length);
      const marker = content.match(/^(?:[-*+]|\d+[.)])\s+/)?.[0] || "";
      const firstPrefix = `${indentation}${marker}`;
      const continuationPrefix = `${indentation}${" ".repeat(marker.length)}`;
      const words = content.slice(marker.length).trim().split(/\s+/);
      const wrapped: string[] = [];
      let current = firstPrefix;

      for (const word of words) {
        const separator = current === firstPrefix ? "" : " ";
        if (`${current}${separator}${word}`.length <= COMMIT_BODY_LINE_LIMIT) {
          current += `${separator}${word}`;
          continue;
        }

        if (current !== firstPrefix) wrapped.push(current);
        current = continuationPrefix;
        let remaining = word;
        while (
          `${current}${current === continuationPrefix ? "" : " "}${remaining}`
            .length > COMMIT_BODY_LINE_LIMIT
        ) {
          const available = COMMIT_BODY_LINE_LIMIT - current.length;
          const characters = Array.from(remaining);
          wrapped.push(`${current}${characters.slice(0, available).join("")}`);
          remaining = characters.slice(available).join("");
          current = continuationPrefix;
        }
        current += `${current === continuationPrefix ? "" : " "}${remaining}`;
      }

      if (current !== firstPrefix || wrapped.length === 0)
        wrapped.push(current);
      return wrapped;
    })
    .join("\n");
}

function fallbackCommitMessage(
  state: TaskState,
  step: number,
): DraftedCommitMessage {
  const files = state.pendingFiles || [];
  const title =
    files.length === 1
      ? `Update ${basename(files[0])}`
      : `Update reviewed changes for step ${step}`;
  return {
    title: title.slice(0, 72),
    body: wrapCommitBody(
      state.pendingSummary?.trim().slice(0, 4000) ||
        `Apply the reviewed changes for step ${step}.`,
    ),
    fallback: true,
  };
}

/** Normalize model output or return the deterministic fallback message. */
export function parseCommitMessage(
  text: string,
  state: TaskState,
  step: number,
): DraftedCommitMessage {
  const fallbackBody =
    state.pendingSummary?.trim().slice(0, 4000) ||
    `Apply the reviewed changes for step ${step}.`;
  const accept = (
    title: unknown,
    body: unknown,
  ): DraftedCommitMessage | null => {
    if (typeof title !== "string" || !title.trim()) return null;
    const cleanTitle = title
      .trim()
      .split(/\r?\n/, 1)[0]
      .replace(/^(?:title|subject)\s*:\s*/i, "")
      .trim()
      .slice(0, 72);
    if (!cleanTitle) return null;
    return {
      title: cleanTitle,
      body: wrapCommitBody(
        (typeof body === "string" && body.trim()
          ? body.trim()
          : fallbackBody
        ).slice(0, 4000),
      ),
    };
  };
  const value = text
    .replace(/^```(?:json|text|markdown)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const parsedMessage = (candidate: string): DraftedCommitMessage | null => {
    try {
      const parsed = JSON.parse(candidate) as {
        title?: unknown;
        subject?: unknown;
        body?: unknown;
        description?: unknown;
      };
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        return null;
      return accept(
        parsed.title ?? parsed.subject,
        parsed.body ?? parsed.description,
      );
    } catch {
      return null;
    }
  };
  const whole = parsedMessage(value);
  if (whole) return whole;

  for (
    let start = value.indexOf("{");
    start >= 0;
    start = value.indexOf("{", start + 1)
  ) {
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let index = start; index < value.length; index++) {
      const char = value[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === "{") depth++;
      else if (char === "}" && --depth === 0) {
        const extracted = parsedMessage(value.slice(start, index + 1));
        if (extracted) return extracted;
        break;
      }
    }
  }

  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\*\*|\*\*$/g, ""));
  const titleLine = lines.findIndex((line) =>
    /^(?:title|subject)\s*:/i.test(line),
  );
  if (titleLine >= 0) {
    const title = lines[titleLine].replace(/^(?:title|subject)\s*:\s*/i, "");
    const bodyLine = lines.findIndex(
      (line, index) =>
        index > titleLine && /^(?:body|description)\s*:/i.test(line),
    );
    const body =
      bodyLine >= 0
        ? [
            lines[bodyLine].replace(/^(?:body|description)\s*:\s*/i, ""),
            ...lines.slice(bodyLine + 1),
          ].join("\n")
        : lines.slice(titleLine + 1).join("\n");
    const labeled = accept(title || lines[titleLine + 1], body);
    if (labeled) return { ...labeled, fallback: true };
  }

  const content = lines
    .filter(Boolean)
    .filter(
      (line) =>
        !/^(?:here(?:'s| is)\s+(?:the\s+)?(?:commit\s+)?message:?|commit message:?)$/i.test(
          line,
        ),
    );
  if (content.length) {
    const plain = accept(content[0], content.slice(1).join("\n"));
    if (plain) return { ...plain, fallback: true };
  }
  return fallbackCommitMessage(state, step);
}
