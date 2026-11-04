import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { getMarkdownTheme, type ExtensionAPI, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Markdown, matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const MAX_OUTPUT_BYTES = 1024 * 1024;
const TIMEOUT_MS = 180_000;
const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

function loadModelArgs(): string[] {
	const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
	const path = join(agentDir, "offtop.json");
	let contents: string;
	try { contents = readFileSync(path, "utf8"); }
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
	let config: unknown;
	try { config = JSON.parse(contents); }
	catch { throw new Error(`Invalid JSON in ${path}.`); }
	if (!config || typeof config !== "object" || Array.isArray(config)) {
		throw new Error(`Expected an object in ${path}.`);
	}
	const { provider, model, thinkingLevel } = config as Record<string, unknown>;
	if (typeof model !== "string" || !model.trim()) throw new Error(`Set a non-empty model in ${path}.`);
	if (provider !== undefined && (typeof provider !== "string" || !provider.trim())) {
		throw new Error(`Set a non-empty provider in ${path}, or omit it.`);
	}
	if (thinkingLevel !== undefined && (typeof thinkingLevel !== "string" || !THINKING_LEVELS.includes(thinkingLevel))) {
		throw new Error(`Invalid thinkingLevel in ${path}.`);
	}
	const args: string[] = [];
	if (provider) args.push("--provider", provider as string);
	args.push("--model", model);
	if (thinkingLevel) args.push("--thinking", thinkingLevel as string);
	return args;
}

function askSeparatePi(question: string, onProgress: (phase: string) => void): Promise<string> {
	return new Promise((resolve, reject) => {
		const modelArgs = loadModelArgs();
		const child = spawn(process.execPath, [
			process.argv[1], "--mode", "json", "--no-session", "--no-extensions",
			"--no-context-files", "--no-skills", "--no-prompt-templates", "--no-tools",
			...modelArgs,
		], { cwd: tmpdir(), stdio: ["pipe", "pipe", "pipe"] });
		const decoder = new StringDecoder("utf8");
		let pending = "";
		let outputBytes = 0;
		let answer = "";
		let stderr = "";
		let settled = false;
		const timeout = setTimeout(() => {
			child.kill();
			finish(new Error("The child Pi did not finish within 3 minutes."));
		}, TIMEOUT_MS);
		function finish(error?: Error): void {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			if (error) reject(error);
			else resolve(answer.trim());
		}
		function handleRecord(line: string): void {
			if (!line.trim()) return;
			const event = JSON.parse(line) as {
				type?: string;
				assistantMessageEvent?: { type?: string };
				message?: { role?: string; content?: Array<{ type?: string; text?: string }> };
			};
			if (event.type === "agent_start") onProgress("Thinking");
			if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") onProgress("Answering");
			if (event.type === "auto_retry_start") onProgress("Retrying");
			if (event.type === "message_end" && event.message?.role === "assistant") {
				answer = (event.message.content ?? [])
					.filter((part) => part.type === "text")
					.map((part) => part.text ?? "")
					.join("\n");
			}
		}
		function append(chunk: Buffer, stream: "stdout" | "stderr"): void {
			if (settled) return;
			outputBytes += chunk.length;
			if (outputBytes > MAX_OUTPUT_BYTES) {
				child.kill();
				finish(new Error("The child Pi produced more than 1 MB of output."));
				return;
			}
			if (stream === "stderr") { stderr += chunk.toString(); return; }
			pending += decoder.write(chunk);
			let newline = pending.indexOf("\n");
			while (newline !== -1) {
				const line = pending.slice(0, newline).replace(/\r$/, "");
				pending = pending.slice(newline + 1);
				try { handleRecord(line); }
				catch {
					child.kill();
					finish(new Error("The child Pi returned an invalid event stream."));
					return;
				}
				newline = pending.indexOf("\n");
			}
		}
		child.stdout.on("data", (chunk: Buffer) => append(chunk, "stdout"));
		child.stderr.on("data", (chunk: Buffer) => append(chunk, "stderr"));
		child.on("error", finish);
		child.on("close", (code) => {
			if (settled) return;
			pending += decoder.end();
			if (pending.trim()) {
				try { handleRecord(pending.replace(/\r$/, "")); }
				catch { finish(new Error("The child Pi returned an invalid event stream.")); return; }
			}
			if (code !== 0) finish(new Error(stderr.trim() || `Pi exited with code ${code}.`));
			else if (!answer.trim()) finish(new Error("The child Pi returned an empty answer."));
			else finish();
		});
		child.stdin.on("error", () => {});
		child.stdin.end(question);
	});
}

async function showAnswer(answer: string, ctx: ExtensionCommandContext): Promise<void> {
	await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
		const markdown = new Markdown(answer, 0, 0, getMarkdownTheme());
		let scroll = 0;
		return {
			render(width: number): string[] {
				const innerWidth = Math.max(1, width - 4);
				const lines = markdown.render(innerWidth);
				const visibleCount = Math.max(1, Math.floor(tui.terminal.rows * 0.7) - 4);
				scroll = Math.min(scroll, Math.max(0, lines.length - visibleCount));
				const frameLine = (content: string): string => {
					const text = truncateToWidth(content, innerWidth);
					return `${theme.fg("accent", "│")} ${text}${" ".repeat(Math.max(0, innerWidth - visibleWidth(text)))} ${theme.fg("accent", "│")}`;
				};
				const footer = theme.fg("dim", `j/k or ↑↓ · PgUp/PgDn · Enter/Esc close · ${scroll + 1}-${Math.min(scroll + visibleCount, lines.length)}/${lines.length}`);
				return [
					theme.fg("accent", `┌${"─".repeat(Math.max(0, width - 2))}┐`),
					frameLine(theme.fg("accent", theme.bold("Offtop"))),
					...lines.slice(scroll, scroll + visibleCount).map(frameLine),
					frameLine(footer),
					theme.fg("accent", `└${"─".repeat(Math.max(0, width - 2))}┘`),
				];
			},
			handleInput(data: string): void {
				if (matchesKey(data, "enter") || matchesKey(data, "escape")) done();
				else if (data === "k" || matchesKey(data, "up")) scroll = Math.max(0, scroll - 1);
				else if (data === "j" || matchesKey(data, "down")) scroll += 1;
				else if (matchesKey(data, "pageUp")) scroll = Math.max(0, scroll - 10);
				else if (matchesKey(data, "pageDown")) scroll += 10;
				tui.requestRender();
			},
			invalidate(): void { markdown.invalidate(); },
		};
	}, { overlay: true, overlayOptions: { anchor: "center", width: "85%" } });
}

export default function (pi: ExtensionAPI): void {
	pi.registerCommand("offtop", {
		description: "Ask a one-off question in a separate, unsaved Pi session",
		handler: async (args, ctx) => {
			const question = args.trim();
			if (!question) { ctx.ui.notify("Usage: /offtop your question", "warning"); return; }
			if (ctx.mode !== "tui") { ctx.ui.notify("/offtop requires interactive Pi.", "error"); return; }
			const startedAt = Date.now();
			const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
			let frame = 0;
			let phase = "Starting";
			const updateStatus = () => {
				const seconds = Math.floor((Date.now() - startedAt) / 1000);
				ctx.ui.setStatus("offtop", `${frames[frame++ % frames.length]} Offtop: ${phase} · ${seconds}s`);
			};
			updateStatus();
			const progressTimer = setInterval(updateStatus, 250);
			try {
				const answer = await askSeparatePi(question, (nextPhase) => { phase = nextPhase; updateStatus(); });
				clearInterval(progressTimer);
				await showAnswer(answer, ctx);
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			} finally {
				clearInterval(progressTimer);
				ctx.ui.setStatus("offtop", undefined);
			}
		},
	});
}
