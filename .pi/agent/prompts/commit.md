---
description: Draft a commit title and detailed description from Git changes
argument-hint: "[all]"
---

Draft a Git commit message for the current repository. Arguments: ${@:-<none>}.

Interpret arguments strictly: accept no arguments or exactly `all`; otherwise explain `/commit` and `/commit all` and stop.

Determine whether the current directory is inside a Git worktree (for example, `git rev-parse --is-inside-work-tree`). Select changes as follows:
- In a Git worktree, with no arguments and staged changes present, include only the staged patch (`git diff --cached`). Do not include unstaged changes or untracked files.
- In a Git worktree, with no arguments and nothing staged, include all changes to Git-tracked files (both staged and unstaged); exclude untracked files.
- In a Git worktree with the `all` argument, include all non-ignored files in the working directory, including untracked files. Use Git's exclude-aware listing (such as `git ls-files --cached --others --exclude-standard`) and include staged and unstaged changes; do not include ignored files.
- Outside a Git worktree, use the current session's conversation history to identify files changed since the most recent `/commit` prompt, or since the start of this session if none has been used. Inspect those files and construct a diff against their pre-change versions where available. Use only changes attributable to that interval; do not guess at unavailable prior contents. If the session history cannot establish the files or their prior state, explain the limitation rather than inventing a diff.

Inspect status and the applicable patch(es) and summaries before drafting. For staged-only scope use `git diff --cached`; for tracked changes combine staged and unstaged patches without describing overlaps twice. For `all`, also inspect untracked non-ignored files as new-file content. Read surrounding code only as needed. If output is truncated, inspect included files individually until the changes are understood. If the selected scope contains no changes, say so rather than inventing a message.

Return only a proposed commit title and a detailed commit description. Write them in English. Make the title concise and specific, preferably in the imperative mood. In the description, explain the substantive changes and their purpose using short paragraphs or bullets; mention important behavior changes and tests only when the patch supports them. Do not invent motivation, tests, or outcomes. Do not stage files, create a commit, or modify the working tree.
