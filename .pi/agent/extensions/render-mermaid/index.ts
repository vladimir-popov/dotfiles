import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface MermaidDiagram {
	number: number;
	label?: string;
	effectiveLabel?: string;
	source: string;
}

export type DiagramSelection =
	| { kind: "selected"; diagram: MermaidDiagram }
	| { kind: "none" }
	| { kind: "not-found"; selector: string }
	| { kind: "ambiguous"; selector: string; aliases: string[] };

const MERMAID_CLI_URL = "https://github.com/mermaid-js/mermaid-cli";

type MmdcCheckResult =
	| { kind: "available"; version: string }
	| { kind: "missing" }
	| { kind: "failed"; diagnostics: string };

/** Check only that mmdc can run; this intentionally does not probe Chrome/Chromium. */
export function checkMmdcAvailability(): Promise<MmdcCheckResult> {
	return new Promise((resolve) => {
		execFile("mmdc", ["--version"], { encoding: "utf8" }, (error, stdout, stderr) => {
			if (!error) {
				resolve({ kind: "available", version: stdout.trim() || stderr.trim() || "version unavailable" });
				return;
			}

			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				resolve({ kind: "missing" });
				return;
			}

			resolve({ kind: "failed", diagnostics: commandDiagnostics(error, stdout, stderr) });
		});
	});
}

/** Format an actual generation failure, distinguishing browser startup from other mmdc errors. */
export function formatMmdcRenderFailure(error: unknown): string {
	const diagnostics = error instanceof Error
		? commandDiagnostics(error, (error as NodeJS.ErrnoException & { stdout?: string }).stdout, (error as NodeJS.ErrnoException & { stderr?: string }).stderr)
		: commandDiagnostics(error, undefined, undefined);
	const browserFailure = /(?:could not find|cannot find|failed to launch|failed to start|error while launching|browser process|chrome(?:ium)?(?: executable)?|executable doesn't exist)/i.test(diagnostics);
	const summary = browserFailure
		? "mmdc could not launch Chrome/Chromium. Install or configure a compatible browser, then retry."
		: "mmdc failed while generating the SVG.";
	return `${summary}${diagnostics ? `\n\n${diagnostics}` : ""}`;
}

function commandDiagnostics(error: unknown, stdout?: string, stderr?: string): string {
	const output = [stderr, stdout]
		.map((part) => part?.trim())
		.filter((part): part is string => Boolean(part));
	if (output.length > 0) return [...new Set(output)].join("\n");
	return error instanceof Error ? error.message : String(error);
}

class MmdcRenderError extends Error {
	readonly stdout: string;
	readonly stderr: string;

	constructor(message: string, stdout = "", stderr = "") {
		super(message);
		this.name = "MmdcRenderError";
		this.stdout = stdout;
		this.stderr = stderr;
	}
}

function safeFilenameLabel(label: string): string {
	return label
		.normalize("NFKD")
		.replace(/[^A-Za-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80)
		.replace(/-+$/g, "");
}

/** Generate and retain an SVG in a unique directory under the system temp root. */
export async function generateMermaidSvg(diagram: MermaidDiagram): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "render-mermaid-"));
	const label = diagram.effectiveLabel ? safeFilenameLabel(diagram.effectiveLabel) : "";
	const basename = `${diagram.number}${label ? `-${label}` : ""}.svg`;
	const outputPath = join(directory, basename);

	try {
		await runMmdc(diagram.source, outputPath);
		const output = await stat(outputPath).catch(() => undefined);
		if (!output?.isFile() || output.size === 0) {
			throw new MmdcRenderError("mmdc exited successfully but did not produce a non-empty SVG file.");
		}
		return outputPath;
	} catch (error) {
		await rm(outputPath, { force: true }).catch(() => undefined);
		await rm(directory, { recursive: true, force: true }).catch(() => undefined);
		throw error;
	}
}

/** Open a generated SVG with the host OS's default application. */
export async function openSvgWithSystemApplication(svgPath: string, platform: NodeJS.Platform = process.platform): Promise<void> {
	const file = await stat(svgPath).catch(() => undefined);
	if (!file?.isFile()) throw new Error("The SVG file does not exist or is not a regular file.");

	let command: string;
	let args: string[];
	if (platform === "darwin") {
		command = "open";
		args = [svgPath];
	} else if (platform === "linux") {
		command = "xdg-open";
		args = [svgPath];
	} else if (platform === "win32") {
		// rundll32 delegates FileProtocolHandler to the Windows default application.
		command = "rundll32.exe";
		args = ["url.dll,FileProtocolHandler", svgPath];
	} else {
		throw new Error(`No system opener is configured for platform ${platform}.`);
	}

	await new Promise<void>((resolve, reject) => {
		execFile(command, args, { encoding: "utf8" }, (error, stdout, stderr) => {
			if (error) {
				const reason = (error as NodeJS.ErrnoException).code === "ENOENT"
					? `System opener "${command}" is unavailable.`
					: commandDiagnostics(error, stdout, stderr);
				reject(new Error(reason));
				return;
			}
			resolve();
		});
	});
}

function runMmdc(source: string, outputPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn("mmdc", ["--input", "-", "--output", outputPath], { stdio: ["pipe", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		let stdinError: Error | undefined;
		child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
		child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
		child.stdin.on("error", (error) => { stdinError = error; });
		child.on("error", (error) => reject(new MmdcRenderError(error.message, stdout, stderr)));
		child.on("close", (code, signal) => {
			if (code === 0 && !stdinError) {
				resolve();
				return;
			}
			const reason = stdinError?.message ?? (signal ? `mmdc terminated by signal ${signal}` : `mmdc exited with code ${code}`);
			reject(new MmdcRenderError(reason, stdout, stderr));
		});
		child.stdin.end(source, "utf8");
	});
}

interface SourceLine {
	text: string;
	start: number;
	end: number;
}

function getLines(source: string): SourceLine[] {
	const lines: SourceLine[] = [];
	const linePattern = /[^\r\n]*(?:\r\n|\n|\r|$)/g;
	for (const match of source.matchAll(linePattern)) {
		if (match[0] === "") continue;
		const line = match[0];
		const contentLength = line.replace(/(?:\r\n|\n|\r)$/, "").length;
		lines.push({ text: line.slice(0, contentLength), start: match.index!, end: match.index! + line.length });
	}
	return lines;
}

function extractMermaidBlocks(text: string): Array<{ source: string; label?: string }> {
	const lines = getLines(text);
	const diagrams: Array<{ source: string; label?: string }> = [];

	for (let index = 0; index < lines.length; index++) {
		const opening = lines[index].text.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
		if (!opening) continue;
		const isMermaid = /^\s*mermaid(?:\s|$)/i.test(opening[2]);

		const fence = opening[1];
		const fenceChar = fence[0];
		const fenceLength = fence.length;
		let closingIndex = index + 1;
		for (; closingIndex < lines.length; closingIndex++) {
			const close = lines[closingIndex].text.match(/^ {0,3}(`+|~+)\s*$/);
			if (close && close[1][0] === fenceChar && close[1].length >= fenceLength) break;
		}
		if (closingIndex === lines.length) continue;

		if (isMermaid) {
			const source = text.slice(lines[index].end, lines[closingIndex].start);
			const firstLine = source.split(/\r\n|\n|\r/, 1)[0];
			const labelMatch = firstLine.match(/^%%\s*@render:\s*(.*?)\s*$/);
			const label = labelMatch?.[1].trim() || undefined;
			diagrams.push({ source, label });
		}
		index = closingIndex;
	}

	return diagrams;
}

/** Find Mermaid blocks in assistant messages from the supplied active branch, in branch order. */
export function findMermaidDiagrams(branchEntries: readonly unknown[]): MermaidDiagram[] {
	const diagrams: MermaidDiagram[] = [];

	for (const entry of branchEntries) {
		if (!entry || typeof entry !== "object" || (entry as { type?: unknown }).type !== "message") continue;
		const message = (entry as { message?: unknown }).message;
		if (!message || typeof message !== "object" || (message as { role?: unknown }).role !== "assistant") continue;
		const content = (message as { content?: unknown }).content;
		const textParts = typeof content === "string"
			? [content]
			: Array.isArray(content)
				? content.flatMap((part) => {
					if (typeof part === "string") return [part];
					if (part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string") {
						return [(part as { text: string }).text];
					}
					return [];
				})
			: [];

		for (const text of textParts) {
			for (const block of extractMermaidBlocks(text)) {
				diagrams.push({ number: diagrams.length + 1, ...block });
			}
		}
	}

	const labelCounts = new Map<string, number>();
	for (const diagram of diagrams) {
		if (diagram.label) labelCounts.set(diagram.label, (labelCounts.get(diagram.label) ?? 0) + 1);
	}
	const labelOccurrences = new Map<string, number>();
	const reservedLabels = new Set(labelCounts.keys());
	const assignedLabels = new Set(reservedLabels);
	for (const diagram of diagrams) {
		if (!diagram.label) continue;
		const count = labelCounts.get(diagram.label)!;
		const occurrence = (labelOccurrences.get(diagram.label) ?? 0) + 1;
		labelOccurrences.set(diagram.label, occurrence);
		if (count === 1) {
			diagram.effectiveLabel = diagram.label;
			continue;
		}

		const baseAlias = `${diagram.label}-${occurrence}`;
		let alias = baseAlias;
		let collision = 2;
		while (assignedLabels.has(alias)) alias = `${baseAlias}-${collision++}`;
		diagram.effectiveLabel = alias;
		assignedLabels.add(alias);
	}

	return diagrams;
}

/** Resolve a number, label/alias, or an empty selector (latest diagram). */
export function selectMermaidDiagram(diagrams: readonly MermaidDiagram[], selector: string): DiagramSelection {
	const value = selector.trim();
	if (diagrams.length === 0) return { kind: "none" };
	if (!value) return { kind: "selected", diagram: diagrams[diagrams.length - 1] };

	if (/^\d+$/.test(value)) {
		const number = Number(value);
		const diagram = Number.isSafeInteger(number) && number > 0
			? diagrams.find((candidate) => candidate.number === number)
			: undefined;
		// Numbers take precedence when a numeric selector matches both a diagram number and a label.
		if (diagram) return { kind: "selected", diagram };
	}

	const exactMatches = diagrams.filter((diagram) => diagram.effectiveLabel === value);
	if (exactMatches.length === 1) return { kind: "selected", diagram: exactMatches[0] };
	if (exactMatches.length > 1) {
		return { kind: "ambiguous", selector: value, aliases: exactMatches.map((diagram) => diagram.effectiveLabel!).filter(Boolean) };
	}

	const repeatedLabelMatches = diagrams.filter((diagram) => diagram.label === value);
	if (repeatedLabelMatches.length > 1) {
		return {
			kind: "ambiguous",
			selector: value,
			aliases: repeatedLabelMatches.map((diagram) => diagram.effectiveLabel!),
		};
	}
	return { kind: "not-found", selector: value };
}

export default function renderMermaidExtension(pi: ExtensionAPI): void {
	pi.registerCommand("render", {
		description: "Render a Mermaid diagram by number or label",
		handler: async (args, ctx) => {
			const diagrams = findMermaidDiagrams(ctx.sessionManager.getBranch());
			const selection = selectMermaidDiagram(diagrams, args);
			if (selection.kind === "none") {
				ctx.ui.notify("No Mermaid diagrams found in assistant messages on the current branch.", "warning");
				return;
			}
			if (selection.kind === "not-found") {
				ctx.ui.notify(`No Mermaid diagram matches selector \"${selection.selector}\".`, "warning");
				return;
			}
			if (selection.kind === "ambiguous") {
				ctx.ui.notify(`Label \"${selection.selector}\" is ambiguous; use one of: ${selection.aliases.join(", ")}.`, "warning");
				return;
			}

			const dependency = await checkMmdcAvailability();
			if (dependency.kind === "missing") {
				ctx.ui.notify(
					`The Mermaid CLI (mmdc) is required to convert Mermaid source into an SVG, which this extension uses for rendering. Install it by following the official instructions: ${MERMAID_CLI_URL}`,
					"error",
				);
				return;
			}
			if (dependency.kind === "failed") {
				ctx.ui.notify(`Could not check the Mermaid CLI (mmdc) version.${dependency.diagnostics ? `\n${dependency.diagnostics}` : ""}`, "error");
				return;
			}

			let outputPath: string;
			try {
				outputPath = await generateMermaidSvg(selection.diagram);
			} catch (error) {
				ctx.ui.notify(formatMmdcRenderFailure(error), "error");
				return;
			}

			try {
				await openSvgWithSystemApplication(outputPath);
				ctx.ui.notify(`Opened SVG: ${outputPath}`, "info");
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`Could not open the SVG: ${reason}\nThe generated file remains available at: ${outputPath}`, "error");
			}
		},
	});
}
