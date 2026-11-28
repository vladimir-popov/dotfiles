# Read-Only Mode Extension

This Pi extension adds `/ro` to switch between the tool set active when the extension loads and a
restricted research tool set. Mode state is session-runtime-local, starts off, and is not persisted.

## Commands

- `/ro`, `/ro toggle`, or **Alt+R** toggles read-only mode.
- `/ro on` enables it; `/ro off` disables it.
- `/ro status` reports the current mode.

**Alt+R** works while you are composing a prompt and while Pi is working. It does not edit or
submit the editor draft. Switching does not cancel tool calls that have already been approved or
started. On macOS, configure Option as Meta in your terminal if Alt shortcuts are not recognized.

Arguments are case-insensitive. Invalid or extra arguments display usage without changing mode.
The footer status shows `🚀` when an editing tool is active, `👀` when all active tools are
read-only, or `⁉️ (tool_a, tool_b)` when active tools are missing from both configured lists.

## Read-only tools

The `pi-modes` section in `~/.pi/agent/settings.json` defines complete `readOnlyTools` and
`editingTools` arrays. Read-only mode allows only tools listed in `readOnlyTools` that are
available in the current session; every other tool is blocked. These lists also classify active
tools for the footer status indicator.
Bash is blocked by default. Each Bash call requires an interactive confirmation for the exact
command and, if approved, that call only. Without an interactive UI, Bash remains blocked.

## Installation

This extension is discovered from this directory as `index.ts` when the directory is placed in
`~/.pi/agent/extensions/` (or configured as an extension path in Pi settings). For local testing,
load the entry point with `pi -e /path/to/pi-modes/index.ts`.

## Tests

Run the automated behavior tests with a Node.js release that supports TypeScript type stripping:

```sh
node --experimental-strip-types --test index.test.ts
```
