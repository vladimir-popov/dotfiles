import { fromMarkdown } from "mdast-util-from-markdown";

type DiscussionMessage = { role: "user" | "assistant"; body: string };
type CodeAddition = { summary: string; code: string; language?: string };
/** A validated Research entry: new Markdown or a verbatim reference to the assessed context. */
export type HandoffCandidate =
  { append: string | CodeAddition } | { existing: string };

type HandoffOptions = {
  handoff: unknown;
  context: string;
  required: { acceptedProposal: string; clarificationNote: string };
  readContext: () => string;
  verifyAcceptance: (
    note: string,
    candidate: HandoffCandidate,
    proposal: string | undefined,
    staged: readonly string[],
    settled: boolean,
  ) => Promise<boolean | { existing: string } | { staged: string[] }>;
  appendContext: (content: string) => void;
  openRoadmap: () => Promise<unknown>;
};

const utf8 = new TextEncoder();
const jsonBytes = (value: unknown) => utf8.encode(JSON.stringify(value)).length;
const PROSE_SPLIT_BYTES = 4000;
const LEGACY_READINESS_PREFIX = 5000;

type DiscussionPassage = { body: string; fenced: boolean };

function indentColumn(whitespace: string, column = 0): number {
  for (const char of whitespace) column += char === "\t" ? 4 - (column % 4) : 1;
  return column;
}

function scanMarkdown(body: string): DiscussionPassage[] {
  const passages: DiscussionPassage[] = [];
  const listIndents: number[] = [];
  let prose: string[] = [];
  let code: string[] = [];
  let fence: { marker: string; containerIndent: number } | undefined;
  const flushProse = () => {
    const paragraph = prose.join("");
    if (paragraph.trim())
      passages.push(
        ...(jsonBytes(paragraph) <= PROSE_SPLIT_BYTES
          ? [paragraph]
          : prose
        ).map((body) => ({ body, fenced: false })),
      );
    prose = [];
  };
  const flushFence = () => {
    passages.push({ body: code.join(""), fenced: true });
    code = [];
    fence = undefined;
  };
  for (const [line] of body.matchAll(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/g)) {
    const [, whitespace, listMarker, padding, content] = line
      .replace(/(?:\r\n|\r|\n)$/, "")
      .match(/^([\t ]*)(?:([-+*]|[0-9]{1,9}[.)])([\t ]+))?([\s\S]*)$/)!;
    const indent = indentColumn(whitespace);
    const marker = content.match(/^(`{3,}|~{3,})([\s\S]*)$/);
    // A nonblank outdent ends an unclosed list fence; parse that same line outside it.
    if (fence && indent < fence.containerIndent && line.trim()) flushFence();
    if (fence) {
      code.push(line);
      if (
        marker &&
        !listMarker &&
        indent >= fence.containerIndent &&
        indent <= fence.containerIndent + 3 &&
        marker[1][0] === fence.marker[0] &&
        marker[1].length >= fence.marker.length &&
        !marker[2].trim()
      )
        flushFence();
      continue;
    }
    if (!line.trim()) {
      flushProse();
      continue;
    }
    while (listIndents.length && indent < listIndents.at(-1)!)
      listIndents.pop();
    let containerIndent = listIndents.at(-1) ?? 0;
    const listItem = !!listMarker && indent <= containerIndent + 3;
    if (listItem) {
      containerIndent = indentColumn(padding, indent + listMarker.length);
      listIndents.push(containerIndent);
    }
    if (
      marker &&
      !(marker[1][0] === "`" && marker[2].includes("`")) &&
      (listMarker ? listItem : indent <= containerIndent + 3)
    ) {
      flushProse();
      fence = { marker: marker[1], containerIndent };
      code.push(line);
    } else prose.push(line);
  }
  flushProse();
  if (fence) flushFence();
  return passages;
}

function discussionPassages(body: string): DiscussionPassage[] {
  return jsonBytes(body) <= PROSE_SPLIT_BYTES
    ? [{ body, fenced: false }]
    : scanMarkdown(body);
}

function evidencePassages(body: string): string[] {
  let offset = 0;
  return discussionPassages(body).flatMap(({ body: passage, fenced }) => {
    const start = body.indexOf(passage, offset);
    offset = start + passage.length;
    const prefixEnd =
      !fenced && jsonBytes(passage) > PROSE_SPLIT_BYTES
        ? Math.min(passage.length, Math.max(0, LEGACY_READINESS_PREFIX - start))
        : 0;
    return prefixEnd && prefixEnd < passage.length
      ? [passage.slice(0, prefixEnd), passage.slice(prefixEnd)]
      : [passage];
  });
}

/**
 * Selects verbatim handoff evidence within a serialized byte budget. Ranks passages by
 * relevance, using recency as a tiebreaker, and returns them in chronological order.
 * Fenced code competes as an intact passage. This selector does not size the readiness gate.
 */
export function selectResearchEvidence(
  sources: readonly DiscussionMessage[],
  query: string,
  budget: number,
): { discussion: DiscussionMessage[]; excerpted: boolean } {
  const terms = (text: string) =>
    new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
  const wanted = terms(query);
  const candidates = sources.flatMap(({ body, role }) =>
    evidencePassages(body).flatMap((text) => {
      if (!text.trim()) return [];
      const message = { role, body: text };
      const bytes = jsonBytes(message) + 1;
      if (bytes > budget) return [];
      const score = [...terms(text)].filter((word) => wanted.has(word)).length;
      return [{ message, bytes, score }];
    }),
  );
  const selected = new Set<(typeof candidates)[number]>();
  let remaining = budget;
  for (const item of [...candidates]
    .reverse()
    .sort((a, b) => b.score - a.score)) {
    if (item.bytes > remaining) continue;
    selected.add(item);
    remaining -= item.bytes;
  }
  const discussion = candidates
    .filter((item) => selected.has(item))
    .map(({ message }) => message);
  const excerpted =
    discussion.length !== sources.length ||
    discussion.some(
      (message, index) =>
        message.role !== sources[index].role ||
        message.body !== sources[index].body,
    );
  return { discussion, excerpted };
}

function invalidHandoff(detail: string): never {
  throw new Error(
    `Invalid Research handoff: ${detail}. The phase is unchanged.`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseEntry(
  entry: unknown,
  context: string,
  label: string,
): HandoffCandidate {
  if (!isRecord(entry) || Object.keys(entry).length !== 1)
    invalidHandoff(`${label} must be an addition or an exact reference`);
  if (
    typeof entry.append === "string" &&
    entry.append.trim() &&
    !/[\r\n]/.test(entry.append)
  )
    return { append: entry.append.trim() };
  if (isRecord(entry.append)) {
    const { summary, code, language } = entry.append;
    if (
      typeof summary === "string" &&
      summary.trim() &&
      !/[\r\n]/.test(summary) &&
      typeof code === "string" &&
      code.trim() &&
      (language === undefined ||
        (typeof language === "string" && /^[\w+.-]+$/.test(language))) &&
      Object.keys(entry.append).every((key) =>
        ["summary", "code", "language"].includes(key),
      )
    )
      return {
        append: {
          summary: summary.trim(),
          code,
          ...(language === undefined ? {} : { language }),
        },
      };
  }
  if (
    typeof entry.existing === "string" &&
    entry.existing.trim() &&
    context.includes(entry.existing)
  )
    return { existing: entry.existing };
  invalidHandoff(
    `${label} has no valid addition or exact reference in context.md`,
  );
}

function renderAddition(append: string | CodeAddition): string {
  if (typeof append === "string") return `- ${append}`;
  const { summary, code, language = "" } = append;
  const longestRun = [...code.matchAll(/`+/g)].reduce(
    (max, [run]) => Math.max(max, run.length),
    0,
  );
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `- ${summary}\n\n${fence}${language}\n${code}${code.endsWith("\n") ? "" : "\n"}${fence}\n`;
}

/**
 * Completes a ready Research handoff. Validate additions and exact references against the
 * assessed snapshot, verify decisions and skip entries covered by context or a staged addition.
 * Persist the batch only after all checks pass and before opening Roadmap. A stale snapshot or
 * failed check prevents the switch. Reject an append whose heading would not be top-level;
 * a no-op never invokes the writer.
 */
export async function completeResearchHandoff({
  handoff,
  context,
  required,
  readContext,
  verifyAcceptance,
  appendContext,
  openRoadmap,
}: HandoffOptions): Promise<void> {
  if (!isRecord(handoff) || !Array.isArray(handoff.decisions))
    invalidHandoff("expected a list of accepted decisions");

  const settled = handoff.decisions.map((entry: unknown) =>
    parseEntry(entry, context, "decision"),
  );
  const requiredEntry = (
    field: "proposal" | "clarification",
    needed: boolean,
    label: string,
  ) => {
    if (needed) return parseEntry(handoff[field], context, label);
    if (handoff[field] !== null) invalidHandoff(`expected null for ${label}`);
    return undefined;
  };
  const proposal = requiredEntry(
    "proposal",
    !!required.acceptedProposal,
    "accepted proposal",
  );
  const clarification = requiredEntry(
    "clarification",
    !!required.clarificationNote,
    "explicit /task accept clarification",
  );
  const additions = new Set<string>();
  const verify = async (
    entry: HandoffCandidate,
    label: string,
    {
      proposal,
      settled = false,
    }: { proposal?: string; settled?: boolean } = {},
  ) => {
    const verdict = await verifyAcceptance(
      required.clarificationNote,
      entry,
      proposal,
      [...additions],
      settled,
    );
    if (verdict === true) {
      if ("append" in entry) additions.add(renderAddition(entry.append));
      return;
    }
    if ("append" in entry && verdict) {
      if (
        "existing" in verdict &&
        verdict.existing.trim() &&
        context.includes(verdict.existing)
      )
        return;
      if (
        "staged" in verdict &&
        verdict.staged.length > 0 &&
        verdict.staged.every(
          (passage) =>
            passage.trim() &&
            [...additions].some((item) => item.includes(passage)),
        )
      )
        return;
    }
    invalidHandoff(`the proposed text does not verify the ${label}`);
  };
  for (const entry of settled)
    await verify(entry, "accepted decision", { settled: true });
  if (proposal)
    await verify(proposal, "accepted proposal", {
      proposal: required.acceptedProposal,
    });
  if (clarification)
    await verify(clarification, "explicit /task accept clarification");

  if (readContext() !== context)
    throw new Error(
      "context.md changed during the Research assessment. The phase is unchanged; retry the transition.",
    );
  if (additions.size) {
    const append = `\n## Research handoff decisions\n\n${[...additions].join("\n")}\n`;
    // Match the writer's separator, but use the parser's offsets (which exclude a leading BOM).
    const separator = context && !context.endsWith("\n") ? "\n" : "";
    const bomWidth = context.startsWith("\uFEFF") ? 1 : 0;
    const headingOffset = context.length + separator.length + 1 - bomWidth;
    const document = fromMarkdown(`${context}${separator}${append}`);
    if (
      !document.children.some(
        (node) =>
          node.type === "heading" &&
          node.depth === 2 &&
          node.position?.start.offset === headingOffset,
      )
    )
      throw new Error(
        "The Research handoff heading would not be top-level. Close the fenced code block at the end of context.md or fix the surrounding Markdown before retrying. The phase is unchanged.",
      );
    appendContext(append);
  }
  await openRoadmap();
}
