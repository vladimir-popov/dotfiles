---
name: calculate-diff
description: Select and inspect Git changes or reconstruct session changes for a commit message, review, or change summary. Use when determining what changed, especially under ~/.pi/agent.
---

# Calculate a diff

Use the requested paths or project directory; if neither is specified, start with the current
directory. Do not stage files, create a commit, or modify the working tree.

## Select the repository

For paths under `~/.pi/agent`, use the dotfiles repository before trying normal Git discovery:
`git --git-dir="$HOME/.git_dot/" --work-tree="$HOME"`.
Run from the project directory if it is inside `$HOME`; otherwise use `git -C "$HOME"`
with the same flags. Always pass explicit pathspecs rooted at `$HOME` after `--`, for example
`':(top,literal).pi/agent/prompts/commit.md'`. Keep the requested scope; never inspect all of
`$HOME` through the dotfiles repository. If the repository is unavailable, report the error
rather than falling back to another repository or to session history.

For other paths, use their normal Git worktree. If the requested scope spans multiple
repositories, inspect them separately. Use session history only for paths outside Git worktrees.

## Select and inspect changes

- Default: if the selected paths contain staged changes, inspect only `git diff --cached`.
  Otherwise inspect unstaged changes to tracked files with `git diff`. Exclude untracked files.
- `all`: inspect staged and unstaged tracked changes and include non-ignored untracked files
  as new-file content. List the latter with `git ls-files --others --exclude-standard`.
  Do not omit tracked deletions or tracked changes to paths now covered by ignore rules.
- If the caller explicitly requests both staged and unstaged changes, inspect both patches
  without describing overlapping changes twice.
- Without Git: inspect changes supported by the session history in the caller's specified
  interval, or since the start of the session if no boundary was supplied. Reconstruct diffs
  only where prior contents are available; report what cannot be verified instead of guessing.

Inspect status and the relevant patches within the selected scope. If output is truncated,
inspect included files individually. Distinguish an empty diff from one you cannot determine,
and make the inspected scope clear when reporting results to the caller.
