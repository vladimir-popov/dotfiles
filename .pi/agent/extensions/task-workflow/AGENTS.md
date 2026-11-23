# Project instructions

## Project versioning

After every project change made in response to a user request, propose a specific
new version. Increment the patch version for backward-compatible changes
(for example, 2.1.0 → 2.1.1) or the major version for backward-incompatible changes
(for example, 2.1.1 → 3.0.0).

Do not change the version until the user responds. If the user approves the
proposal, use the proposed version. If the user supplies a specific version, use
that version instead. If the user asks to leave the version unchanged, do not bump it.

When changing the version, keep it synchronized in `package.json`, the version
heading in `README.md`, and the `APP_VERSION` constant in `index.ts`. The
`/task status` output must display `APP_VERSION`.

## TypeScript formatting

After changing TypeScript files in this repository, run Prettier on every changed `.ts` file before finishing:

```bash
npx --yes prettier --write <changed-file.ts> [<another-changed-file.ts> ...]
```

Format only files changed for the task. Use any Prettier configuration present in the repository, then inspect the diff for unrelated formatting changes. Report the formatter command and result. If Prettier cannot run, state that clearly; do not claim the files were formatted.
