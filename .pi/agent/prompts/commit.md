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
- Outside a Git worktree, determine the scope from the current session's history, ending at this invocation. Find the most recent earlier `/commit` invocation that completed successfully by producing a usable commit title and description. Include session changes made after that successful invocation's response. Do not use a failed, interrupted, or incomplete `/commit` attempt as the boundary: look back past such attempts to the prior successful invocation, expanding the scope to include the changes since then. If no earlier `/commit` invocation succeeded, include changes from the start of the current session. Treat an invocation as unsuccessful if it was interrupted, errored, returned no usable proposal, or only reported that changes could not be determined. Inspect the files changed in the selected interval and construct diffs against their pre-change versions where available. Do not include changes already covered by the last successful proposal. Do not guess at unavailable prior contents; if the history cannot establish the changed files or their prior state, explain the limitation instead of inventing a diff.

Inspect status and the applicable patch(es) and summaries before drafting. For staged-only scope use `git diff --cached`; for tracked changes combine staged and unstaged patches without describing overlaps twice. For `all`, also inspect untracked non-ignored files as new-file content. In non-Git mode, use the successful-invocation boundary rules above and inspect each included file's relevant changes. Read surrounding code only as needed. If output is truncated, inspect included files individually until the changes are understood. If the selected scope contains no changes, say so rather than inventing a message.

Return only a proposed commit title and a detailed commit description. Write them in English. Make the title concise and specific, preferably in the imperative mood. In the description, explain the substantive changes and their purpose using short paragraphs or bullets; mention important behavior changes and tests only when the patch supports them. Keep every description line at or below 70 characters. Do not invent motivation, tests, or outcomes. Do not stage files, create a commit, or modify the working tree.
