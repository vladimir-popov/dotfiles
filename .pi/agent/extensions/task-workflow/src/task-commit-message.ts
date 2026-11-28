import { basename } from "node:path";
import type { TaskState } from "./phase-model.ts";

/** Normalized commit title and optional body; fallback marks an empty model response. */
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

/** Parse the first non-empty line as the title and retain the rest as optional body. */
export function parseCommitMessage(
  text: string,
  state: TaskState,
  step: number,
): DraftedCommitMessage {
  const message = text.trim();
  if (!message) return fallbackCommitMessage(state, step);

  const [title, ...body] = message.split(/\r?\n/);
  return {
    title: title.trim().slice(0, 72),
    body: wrapCommitBody(body.join("\n").trim().slice(0, 4000)),
  };
}
