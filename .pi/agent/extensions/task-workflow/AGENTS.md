# Project instructions

## TypeScript formatting

After changing TypeScript files in this repository, run Prettier on every changed `.ts` file before finishing:

```bash
npx --yes prettier --write <changed-file.ts> [<another-changed-file.ts> ...]
```

Format only files changed for the task. Use any Prettier configuration present in the repository, then inspect the diff for unrelated formatting changes. Report the formatter command and result. If Prettier cannot run, state that clearly; do not claim the files were formatted.
