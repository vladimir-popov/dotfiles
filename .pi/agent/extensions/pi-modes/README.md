# Read-Only Mode Extension

This Pi extension adds `/ro` to switch between the tool set active when the extension loads and a
restricted research tool set. Mode state is session-runtime-local, starts off, and is not persisted.

## Commands

- `/ro` or `/ro toggle` toggles read-only mode.
- `/ro on` enables it; `/ro off` disables it.
- `/ro status` reports the current mode.

Arguments are case-insensitive. Invalid or extra arguments display usage without changing mode.

## Read-only tools

The `pi-modes` section in `~/.pi/agent/settings.json` defines complete `readOnlyTools` and
`editingTools` arrays. Read-only mode allows only tools listed in `readOnlyTools` that are
available in the current session; every other tool is blocked.
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
