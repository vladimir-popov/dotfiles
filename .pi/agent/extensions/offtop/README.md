# Offtop

`/offtop` asks a question in a separate Pi process, with the current session transcript
included as background. The child can inspect the current working directory and use the
web-search tools from `pi-web-access`. It cannot run shell commands or use file-editing
or file-writing tools. Its own session is not saved.

The transcript is taken from Pi's active, compaction-aware session context. Thinking blocks
are omitted, and the transcript is capped at its most recent 60,000 characters. Project
context files such as `AGENTS.md` are also available to the child. Skills, prompt templates,
and other extensions are not loaded.

## Usage

```text
/offtop Why does this API use pagination?
/offtop-last
```

Pi shows a progress indicator while the child is running. The answer opens in a bordered
overlay. Use `j` and `k` (or the arrow keys) to scroll, `Page Up` and `Page Down` to move
faster, and `Enter` or `Esc` to close it. Each completed answer is saved as a custom entry
in the current session, without adding it to the main conversation context. `/offtop-last`
reopens the latest saved answer on the current session branch.

The child uses the model in `~/.pi/agent/offtop.json`. For example:

```json
{
  "provider": "openrouter",
  "model": "openai/gpt-6-luna",
  "thinkingLevel": "medium"
}
```

If that file is absent, the child uses Pi's normal model settings. The command is available
in interactive mode. The read-only file and web tools require `pi-web-access` to be
installed under the Pi agent directory.

## Files

- `index.ts` implements the commands, context transfer, and answer overlay.
- `~/.pi/agent/offtop.json` holds the optional model override.
