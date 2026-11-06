# Contributor instructions

## Code formatting

Keep source files formatted with the repository's configured formatters:

- Lua: StyLua, configured in `.stylua.toml`.
- TypeScript and JSON: Prettier, configured in `.prettierrc.json`.

After changing code, run `npm run format` before finishing. Then run `npm run format:check` and make sure it passes. Install StyLua if it is not available on your system (for example, with `brew install stylua`); Prettier is installed through the project's npm development dependencies (`npm install`).
