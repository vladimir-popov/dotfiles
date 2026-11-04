# Offtop

`/offtop` asks a question in a separate, temporary Pi process. The child receives no conversation history, project context files, skills, prompt templates, extensions, or tools. Its session is not saved, so the question does not become part of the current task's working context.

## Usage

```text
/offtop Why does this API use pagination?
```

Pi shows a progress indicator while the child is running. The answer opens in a bordered overlay. Use `j` and `k` (or the arrow keys) to scroll, `Page Up` and `Page Down` to move faster, and `Enter` or `Esc` to close it.

The child uses the model in `~/.pi/agent/offtop.json`. For example:

```json
{
  "provider": "openrouter",
  "model": "openai/gpt-6-luna",
  "thinkingLevel": "medium"
}
```

If that file is absent, the child uses Pi's normal model settings. The command is available in interactive mode.

## Files

- `index.ts` implements the command and answer overlay.
- `~/.pi/agent/offtop.json` holds the optional model override.
