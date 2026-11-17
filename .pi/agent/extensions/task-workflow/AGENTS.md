# Project instructions

## Project versioning

After every project change made in response to a user request, increment the
minor version before finishing (for example, 2.0.5 → 2.1.0; reset the patch
component to 0). For a backward-incompatible change, increment the major
version instead (for example, 2.1.0 → 3.0.0). Keep the version synchronized in
`package.json`, the version heading in `README.md`, and the `APP_VERSION`
constant in `index.ts`. The `/task status` output must display `APP_VERSION`.

## TypeScript formatting

After changing TypeScript files in this repository, run Prettier on every changed `.ts` file before finishing:

```bash
npx --yes prettier --write <changed-file.ts> [<another-changed-file.ts> ...]
```

Format only files changed for the task. Use any Prettier configuration present in the repository, then inspect the diff for unrelated formatting changes. Report the formatter command and result. If Prettier cannot run, state that clearly; do not claim the files were formatted.
