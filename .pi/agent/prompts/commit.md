---
description: Draft a commit title and detailed description from Git changes
argument-hint: "[all]"
---

Draft a Git commit message for the current repository. Arguments: ${@:-<none>}.

Interpret the arguments strictly:
- With no arguments, consider only staged changes.
- With the single argument `all`, consider staged changes and unstaged changes to Git-tracked files. Exclude untracked files.
- For any other arguments, explain the supported usage (`/commit` or `/commit all`) and stop.

First inspect `git status --short` so you know which files are staged, unstaged, or untracked. For the default mode, inspect the staged patch with `git diff --cached --no-ext-diff --` and its summary with `git diff --cached --stat --`. For `all`, also inspect the unstaged patch with `git diff --no-ext-diff --` and its summary with `git diff --stat --`. Read relevant surrounding code only if needed to understand the changes. If a patch is too large or truncated, inspect it file by file until you can describe the included changes accurately.

Treat the staged and unstaged patches together as the intended final change in `all` mode; do not describe overlapping edits twice. Ignore untracked files in both modes. If there are no changes in the selected scope, say so instead of inventing a commit message.

Return only a proposed commit title and a detailed commit description. Write them in English. Make the title concise and specific, preferably in the imperative mood. In the description, explain the substantive changes and their purpose using short paragraphs or bullets; mention important behavior changes and tests only when the patch supports them. Do not invent motivation, tests, or outcomes. Do not stage files, create a commit, or modify the working tree.
