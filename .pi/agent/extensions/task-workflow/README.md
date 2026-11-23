# Task workflow

**Version: 2.5.4**

A [Pi](https://pi.dev/) extension for LLM-assisted coding tasks with phase-specific context and tool permissions. It guides tasks through research, planning, implementation, and review, using purpose-specific sessions and artifacts to manage context while limiting tool access at each stage.

![A small waterfall flowing into a river past stepping stones](assets/task-flow-waterfall.png)

`/task` guides a coding task through research, roadmap, implementation, review, and commit.
By default, semi-auto mode pauses for manual review between automated review and commit.
Research covers task context, discussion, and code investigation in one saved Pi session;
later phases use separate sessions, with compact task artifacts carrying agreed decisions
forward. Each implementation session starts with final discussion of just its current step
before coding begins.

## 🔄 Workflow

```mermaid
flowchart LR
    A["Research"] -->|/task next| B["Roadmap"]
    B -->|/task next| C["Step preparation"]
    C -->|/task next: finalize step; status planned → in_progress; capture baseline| D["Implement"]
    D -->|/task next: save implementation-N.diff; start review round 0| E["Review"]
    E -->|/task next: open findings; preserve round; repair| D
    E -->|clear: semi-auto with manualReview enabled| F["Manual review"]
    E -->|clear: manual mode or manualReview disabled| G["Commit phase"]
    F -->|/task next: findings| D
    F -->|/task accept: accepted fix| D
    F -->|/task next: clear| G
    G -->|/task next: verify commit; summarize rounds; delete diff; status completed| H["Step completed"]
    H -->|next step| C
    H -->|final step| I["Task complete"]
```

Research gathers task context and investigates code in one saved conversation. Each step's
preparation discussion and implementation share one saved session; after review finds
issues, repairs return to that same session. Each review round opens a fresh session. A
clear review opens a separate commit phase. In semi-auto mode with `manualReview` enabled,
it opens a separate manual-review phase first. The next step cannot start until commit is completed.
In Git projects, manual mode requires the reviewed files to be committed before
`/task next`; `autoCommit: true` commits them automatically. If Git is not
detected, the commit phase remains open. `/task next` retries Git detection and
commit-message generation; `/task accept` skips this commit and continues, recording the
intentional skip in the step execution record. Projects without Git remain in commit until
Git is created or the user accepts the skip.

All task files use a fixed project-local layout:

```text
.agents/task-workflow/
├── config.json                     # Optional project settings
└── <task-id>/
    ├── config.json                 # Optional task settings
    ├── state.json                  # Workflow state
    ├── sessions/
    ├── baselines/
    └── context/
        ├── context.md
        ├── roadmap.md
        ├── step-N.md                # Retains compact review execution summaries
        ├── review-N-round-M.md      # Temporary; removed when the step completes
        └── implementation-N.diff   # Temporary; removed when the step completes
```

Task paths are fixed under `.agents/task-workflow/`; project `config.json` lives alongside task directories. The full directory contains local task data; add it to `.gitignore` if desired.

### Optional phase skills

The extension owns the review contract: the approved scope is reviewed read-only, the workflow
cannot advance, and the coordinator saves exactly one final artifact at the extension-selected
path using `task_write_artifact`. The existing report structure and single-agent procedure are
the defaults. An available skill configured in `skills.review` may define the review procedure,
including delegating checks to subagents and consolidating their findings, but cannot override
that contract or allow subagents to write the artifact. Tools needed by a procedure must be
explicitly enabled with `reviewTools`; this does not grant them in other phases. If the skill is
missing or unavailable, the built-in procedure applies.

The commit session may use `skills.commit`. The separate commit-message generation request
does not receive the skill contents. Its built-in prompt provides the commit-message rules
regardless of configuration, and references the configured commit skill by name when one is
set. A missing skill does not block the workflow.

## 🚀 Usage

Start Pi in the project directory and enter `/task TASK-100500`. Pi asks whether to create a missing task or continue an existing one. Declining leaves the current session unchanged. `/task` and `/task list` show tasks with a short state description and their last worked time, based on the newest saved task session. Both open the same selector in the terminal UI. Existing IDs also appear in command completion. If you rename a project directory, close Pi and start it from the new path. In the terminal UI, `/task` or `/task resume` can show project-local tasks marked as moved and ask for confirmation before relocating their state and saved sessions. Declining leaves the task unchanged. Outside the terminal UI, relocation is refused. Session/state paths are rebased, but historical prose in the conversation or artifacts is not rewritten.

The extension shows the current phase in a small header above the editor when a task session opens. Once Pi finishes a response, the second line tells you when `/task next` is useful; a pending proposal may instead need `/task accept`. The first line colors the task name, current settings (mode, auto-commit, manual review, and extension version), phase, and phase description separately. By default, the task name is bright green, settings are bright black, and the phase and description are blue. When the project is not inside a Git repository, the widget adds a red `⚠ No Git repository` warning. Configure the other colors with `statusColors` (see Configuration). Pi's built-in footer shows the session name. For implementation preparation, implementation, review, manual review, and commit, the extension adds a short title from the current numbered roadmap step to that name. These UI labels do not enter the model conversation.

Phase kickoffs are hidden extension messages. They guide Pi and start its work without appearing in the editor's ↑ history. After a session switch, ↑ browses the new session's history; the `/task next` command entered in the previous session may therefore not be the first item.

Describe the task over ordinary messages. Use `/task next` when the current discussion is settled. Use `/task accept` to agree to pending proposals and advance; agreement is implied by the command, with no extra note needed. If Pi proposes a version and asks whether to keep it or add an optional feature, `/task accept` keeps the proposed version. If Pi offers several alternatives without recommending one, choose explicitly, for example `/task accept "I prefer option B"`. If there is no pending proposal, `/task accept` advances like `/task next`, except that it can skip a commit when Git is unavailable. In semi-auto manual review, `/task next` routes findings to implementation or a clear review to commit; `/task accept` first accepts the proposed solution. Both commands stop when material questions remain, and `/task next` also stops when a proposal still needs approval. A slash command embedded in ordinary text, such as `I agree. /task next`, does not run.

| Command                     | Action                                                                                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/task new TASK-ID`         | Create a task with the given ID.                                                                                                                                                                                                                                 |
| `/task TASK-ID`             | Open an existing task.                                                                                                                                                                                                                                           |
| `/task` or `/task list`     | Select an existing task, or show a list outside the terminal UI.                                                                                                                                                                                                 |
| `/task delete [TASK-ID]`    | Permanently delete a task after a separate confirmation. Without an ID, choose from a selector in the terminal UI.                                                                                                                                               |
| `/task status`              | Show the phase, step, session paths, review status, and settings without adding text to the conversation.                                                                                                                                                        |
| `/task config`              | Show the full effective configuration for the active task without changing it.                                                                                                                                                                                  |
| `/task config change`       | Edit mode, manual review, and auto-commit in the terminal UI and save them in the active task's `config.json`.                                                                                                                                                                   |
| `/task config init project` | Create `.agents/task-workflow/config.json` with inherited settings; refuses to overwrite an existing file.                                                                                                                                                      |
| `/task config init task`    | Create `.agents/task-workflow/<task-id>/config.json` with inherited settings; refuses to overwrite an existing file.                                                                                                                                           |
| `/task resume`              | Return to the active task in this project. If multiple tasks are available, choose one in the terminal UI; outside it, use `/task TASK-ID` to select. An interrupted run or pending review resumes automatically; otherwise the saved task session simply opens. |
| `/task show [FILE.md]`      | Select an existing Markdown artifact or show the named file without adding it to the conversation. File names have completion.                                                                                                                                   |
| `/task next`                | Advance after checking the current discussion. In implementation preparation, finalize the design and begin work. Manual-review findings return to implementation; an empty review proceeds to commit. In commit, verify files or retry Git detection. |
| `/task accept [NOTE]`       | Agree to pending proposals and advance. In semi-auto manual review, accept the proposed solution; accepted findings return to implementation, otherwise proceed to commit. Without Git in commit, skip the commit and continue. |
| `/task help`                | Show a short command summary outside the conversation.                                                                                                                                                                                                           |

### Hotkeys

The extension binds **Alt+N** to `/task next`, **Alt+A** to `/task accept`, **Alt+S** to `/task status`, and **Alt+W** to `/task show` by default. They invoke the same commands and checks as the slash forms. Hotkeys work when Pi is idle and the input editor is empty; otherwise the extension shows a reminder and leaves the draft untouched. Run Pi's `/hotkeys` to inspect active bindings. On macOS, your terminal may need Option configured as Meta for Alt shortcuts to work.

`/task show` and Alt+W open a selector containing the existing `.md` files directly in the task artifact directory, including review rounds for active steps. `/task show roadmap.md` opens one directly; `/task show ` completes existing Markdown file names. Outside the terminal UI, `/task show` lists available files. Diff files are not included in this Markdown viewer.

Set `hotkeys` in `~/.pi/agent/task-workflow.json` to change a binding or give any `/task` command a key. Map a command string without `/task` to a Pi key name; use `null` to disable a default. Commands with arguments work too, for example `"show roadmap.md"` or `"TASK-100500"`. Reload Pi after changing the configuration.

```json
{
  "hotkeys": {
    "next": "alt+n",
    "accept": "alt+a",
    "status": "alt+s",
    "show": "alt+w",
    "list": "alt+l",
    "delete": null
  }
}
```

### Task ID parsing

An ID is required to create or open a particular task; `/task` alone opens the list. An
unquoted ID ends at a space; quote an ID with internal spaces: `/task "TASK 100500"` or
`/task 'TASK 100500'`. `/task TASK 100500` is invalid. IDs may contain ASCII letters,
digits, dots, underscores, hyphens, and internal spaces. They must begin with a letter or
digit and have no leading or trailing spaces. Slashes and quote characters are invalid.
The unquoted command words `help`, `list`, `delete`, `status`, `log`, `abort`, `next`,
`accept`, `show`, `start`, `config`, and `resume` are reserved; quote one to use it as an
ID. The retired word `skip-commit` is rejected; quote it if you want to use it as a task
ID. Task storage paths are fixed.

`/task delete` lists tasks in the current project for selection. `/task delete TASK-100500` selects one directly; quote IDs with spaces as above. Both routes ask you to confirm the artifact and runtime directories before deleting. The command removes both directories, including task artifacts, local state, baselines, and saved Pi sessions; project files outside them remain. If the task is open, Pi first switches to a normal session outside the task directory. Finish or cancel a running Pi response before deleting. Outside the terminal UI, provide an explicit ID because there is no selector.

### Phases and artifacts

| Phase              | What happens                                                                                                                                                                                                                                                                                                                                                                                                                | Artifact updates                                                                                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Research**       | Describe the problem, constraints, and possible approaches; inspect project files and use available read-only web search/fetch tools to discuss feasibility, code locations, and unresolved questions. The extension enables `tool_search` when available and includes matching deferred web tools in the Research tool allowlist. Project files cannot be edited in this phase.                                                                                                                                    | Pi keeps `context.md` compact and current; `task_write_artifact` may write only `context.md` in Research.                                                                                                                                   |
| **Roadmap**        | Discuss a numbered plan. New agreed requirements update context and cause a revised complete roadmap proposal.                                                                                                                                                                                                                                                                                                              | `context.md` and a draft `roadmap.md`; `/task next` finalizes the roadmap. Top-level steps must be numbered consecutively from 1; short bold titles and dash explanations are preferred, but ordinary numbered Markdown steps are accepted. |
| **Implementation** | This is one workflow phase with two stages in the same saved session. **Preparation:** discuss the current step and checks; project code is read-only. `/task next` resolves open questions/proposals, finalizes `step-N.md`, marks it `in_progress`, captures a baseline, and starts implementation. **Coding:** implement the approved step; after review, repair open findings in this same session. | Only the current step needs a `step-N.md`; future step designs are deferred. `/task next` after coding writes the temporary `implementation-N.diff` and opens review. |
| **Review**         | Each round uses a fresh read-only session. The first report is `review-N-round-0.md`; every subsequent round gets the next number.                                                                                                                                                                                                                                                             | `/task next` returns open findings to implementation or accepts a clear review.                                                                                                                                                             |
| **Manual review**  | Semi-auto only, when `manualReview` is enabled. After automated review and before commit, a separate read-only session lets the user inspect the implementation diff and changed files. `/task next` sends findings to implementation or an empty review to commit; `/task accept` accepts a proposed solution and follows the same routing. | No artifact is required.                                                                                                                                                                                                                     |
| **Commit**         | A distinct phase after review acceptance. After the commit is verified, the extension records review outcomes in `step-N.md`, marks it `completed`, and removes `implementation-N.diff` and all `review-N-round-M.md` files for that step.                                                                                                                                                                                                                                    | The compact execution record in `step-N.md` preserves review summaries, accepted decisions, and finding dispositions.                                                                                                                                                                                       |
| **Commit**         | A distinct phase after review acceptance, with its own saved session and visible commit result. With `autoCommit: false`, commit the reviewed files manually; `/task next` verifies they are committed before continuing. With `autoCommit: true`, the extension commits them automatically.                                                                                                                                | Commit title/body are shown in the commit session; no separate Markdown artifact.                                                                                                                                                           |

On accepting a clear review, the extension proceeds directly to commit in manual mode or
when `manualReview` is disabled. Otherwise, it opens a separate manual-review session first.
Disabling the setting does not close an already-open manual review. `/task next` moves
findings back to implementation and an empty review to commit; `/task accept` accepts a
proposed solution before following the same routing. The commit phase has its own saved
session and generates the commit result.
With `autoCommit: true`, it commits the reviewed files automatically and shows the result
there. Otherwise it proposes a commit
title and body; `/task next` remains blocked until the reviewed file contents have been
committed. If Git is not detected, the phase remains open. `/task next` retries Git
detection and commit-message generation; `/task accept` skips this commit and continues,
recording the intentional skip in the step execution record. If commit-message generation
fails, the task remains in the commit phase and `/task next` retries generation. If the
model response is unstructured, manual mode uses a labeled fallback based on the changed
file names and implementation summary; auto-commit mode skips the commit and asks for a
retry. Once the commit phase ends, the next step's preparation session opens with a short
summary of its roadmap scope. After the final step's commit phase, the task is complete.
Steps with no code changes still pass through without a commit action.

`/task resume` returns to the active task in the current project, including from a fresh `/new` session. If several active tasks exist, the terminal UI offers a selector; outside it, use `/task TASK-ID` to choose one. It also detects confirmed project-directory renames for project-local tasks. An aborted run resumes in its saved session with current phase instructions. A review with no saved `review-N-round-M.md` for the active round also resumes; `/task next` remains blocked until that artifact is saved. If no run needs resuming, the command simply opens the saved task session. It does not advance the phase or clear pending artifacts.

Artifacts can be updated in any phase when an agreed change requires it. Project code can be edited only after `/task next` starts implementation and captures a baseline. The extension tracks the current phase and all saved session files in `state.json`.

The task instructions tell Pi to converse in your language, including explanations, questions, and review discussion. Only task artifact content uses English prose and headings. Pi translates the agreed meaning into English when it writes or revises `context.md`, `roadmap.md`, `step-N.md`, and `review-N-round-M.md`. Exact code, identifiers, paths, and required diff excerpts remain unchanged. Existing non-English prose is rewritten when an artifact is next updated or finalized; loading an old task does not rewrite its files automatically.

### 👀 What each Pi sees

Research gathers task context and investigates the code in the same Pi conversation. The configured research model is selected when the task starts; otherwise the current model continues. `/task next` advances to the roadmap and changes the phase instructions and allowed tools without switching sessions.

Roadmap, each step's implementation session, each review round, each semi-auto manual-review phase, and each commit phase have their own saved sessions. A new implementation session starts with a preparation discussion and a short summary of the current roadmap item; the same session continues into coding after `/task next` captures the baseline. It does not inherit the roadmap chat transcript. The durable handoff is `context.md`, `roadmap.md`, and the current `step-N.md`; the commit session keeps the commit result and its phase boundary.

Returning from review restores that step's implementation session, including preparation decisions, implementation messages, and tool output, and adds the current `review-N-round-M.md` as repair guidance. Review is a separate conversation and sees task artifacts, the current implementation diff, and code it reads. Each repeated review is a new conversation, so it checks the repaired code independently. Sessions and baselines are saved under the task directory, separate from its `context/` artifacts. Opening an older task without a session map creates a saved session for its current phase; earlier background worker conversations cannot be reconstructed.

## ⚙️ Configuration

The extension reads `~/.pi/agent/task-workflow.json` (or `task-workflow.json` in
`PI_CODING_AGENT_DIR`). Project overrides live in
`<projectRoot>/.agents/task-workflow/config.json`; task settings live in
`<projectRoot>/.agents/task-workflow/<task-id>/config.json`. Settings in existing task
state files are ignored and are not migrated.
Settings resolve in task → project → global → built-in-default order. For
`skills`, `phaseModels`, `phaseTools`, `additionalPhaseTools`, `hotkeys`, and
`statusColors`, entries resolve by key; other values, including arrays, are replaced by
the most local setting. Missing keys inherit; `null` explicitly disables skills and
phase models, and can disable default hotkeys. The global file is optional; omitted
properties use the defaults below. Run `/task config init project` or `/task config init task`
to create a config without overwriting an existing file. These commands copy the current
inherited `mode`, `manualReview`, and `autoCommit` (defaults: `manual`, `true`, and `false`),
and the `include` and
`exclude` pattern lists (both default to `[]`). An empty `include` means no allowlist;
legacy `include: null` is still accepted and is written as `[]` in new configs. An empty
`exclude` means no exclusions. The project inherits from global settings; the task inherits
from project and global settings. Delete a copied key to resume inheriting its value. Other
settings continue to inherit. These lists are saved but do not yet filter files. Use
`/task config` to view the effective workflow settings.
Use `/task config change` in the terminal UI to change mode, manual review, and auto-commit
for the active task; it creates or updates the task's `config.json` and preserves its other settings.
Edit the config file directly to change other values. Here is a complete example
with different models for implementation and review:

```json
{
  "mode": "manual",
  "manualReview": true,
  "autoCommit": false,
  "statusColors": {
    "taskName": "brightGreen",
    "currentSettings": "brightBlack",
    "currentPhase": "blue",
    "phaseDescription": "blue"
  },
  "phaseModels": {
    "implement": {
      "provider": "openrouter",
      "model": "openai/gpt-6-luna",
      "thinkingLevel": "medium"
    },
    "review": {
      "provider": "openrouter",
      "model": "openai/gpt-6-luna",
      "thinkingLevel": "high"
    }
  },
  "skills": {
    "research": null,
    "roadmap": null,
    "implement": null,
    "review": null,
    "commit": null
  },
  "additionalPhaseTools": {
    "research": ["my_web_search"],
    "roadmap": ["my_planning_tool"],
    "implement": ["my_nvim_tool"],
    "review": ["my_review_tool"]
  },
  "reviewTools": [],
  "allowTreeNavigation": false,
  "snapshotMaxFiles": 4000,
  "snapshotMaxMiB": 100
}
```

The model IDs above are examples. Use a provider and model available in your Pi installation.

| Property              | Type and default                                                                     | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                | `manual` or `semi-auto`; `manual`                                                    | Workflow transition policy. `manual` requires `/task next` or `/task accept`; the user can perform manual code review during each Review phase. In `semi-auto`, when an agent turn settles, implementation advances to review and a saved review advances to repair or acceptance if the transition check finds no open questions or unapproved proposals. It pauses on uncertainty. Configure globally, per project, or per task; more local values override broader ones. |
| `manualReview`        | Boolean; `true`                                                                      | In `semi-auto`, pause for manual review after a clear automated review. Set to `false` to enter commit directly. Has no effect in `manual` mode. |
| `autoCommit`          | Boolean; `false`                                                                     | After a clear review in a Git project, `false` prepares an English commit title and body; `true` commits the reviewed code files when the step reaches commit. Automatic commit requires a clean code working tree when implementation starts. With no Git repository, neither mode creates a commit. It can be overridden per project and task.                                                                                                                                                                                                                      |
| `statusColors`        | Object; bright green, bright black, blue, blue                                       | Colors for `taskName`, `currentSettings`, `currentPhase`, and `phaseDescription`, respectively. Each value accepts an ANSI color name (`black`, `red`, `green`, `yellow`, `blue`, `purple`, `cyan`, `white`, or a `bright`-prefixed variant), a 0–255 palette index, or a hex color such as `#RRGGBB`. Unspecified values use their defaults.                                                                                                                                                                                            |
| `phaseModels`         | Object; `{}`                                                                         | Model overrides by phase. Valid keys: `research`, `roadmap`, `implement`, `review`. New tasks use `phaseModels.implement` throughout step preparation and coding. Each value is a model object or `null`; omitted keys and `null` leave Pi's current model in place.                                                                                                                                                                                                                                                                     |
| `skills`              | Object; `{}`                                                                         | Maps phase names to Pi skill names. Valid keys: `research`, `roadmap`, `implement`, `review`, `commit`. Each value is a skill name or `null`; omitted entries inherit from the broader scope, while `null` explicitly disables the skill. An available review skill may define the procedure, within the extension-owned contract. A missing skill does not block the phase. Use names such as `roadmap-planning`, not paths to `SKILL.md`.                                                                                     |
| `phaseTools`          | Object; built-in phase-specific tool sets                                                    | Optional replacement allowlists by phase, including `manual-review`. A configured list replaces the phase's built-in user-tool list. The internal `task_write_artifact` remains available in non-commit, non-manual-review phases. Prefer `additionalPhaseTools` when you only want to grant extra extension tools without replacing defaults. |
| `additionalPhaseTools`| Object; `{}`                                                                               | Maps phases, including `manual-review`, to arrays of extra tool names, added to that phase's normal allowlist. This is the recommended way to enable tools from other extensions while retaining defaults (including discovered read-only web tools in Research). For `implement`, additions apply during Preparation; during Coding the extension already enables active Pi tools plus `read`, `bash`, `edit`, and `write`. Entries resolve by phase across global → project → task scopes; a more local list replaces the same phase's broader list. |
| `reviewTools`         | Array of tool names; `[]`                                                            | Replaces the additional review tool list from broader scopes. These tools are added to the automated review's built-in set: `read`, `grep`, `find`, `ls`, and `task_write_artifact`. The same `reviewTools` are available in manual review, without `task_write_artifact`. Add only tools the configured procedure needs and that you trust for read-only project work. For example, enable a delegation tool explicitly with `"reviewTools": ["subagent"]` (use the actual tool name provided by your environment).                                                                                                                                                                                                                                                                                                              |
| `allowTreeNavigation` | Boolean; `false`                                                                     | Allows Pi's `/tree` command inside task sessions when `true`. Branches still share the same task state and artifacts.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `hotkeys`             | Object; `{ "next": "alt+n", "accept": "alt+a", "status": "alt+s", "show": "alt+w" }` | Maps `/task` command text to a key. Set a command to `null` to disable its default; omitted commands keep defaults. Each active key must be unique within this extension. Hotkey registrations are global and apply when Pi starts or reloads the extension; project/task-specific hotkeys are not supported.                                                                                                                                                                                                                            |
| `snapshotMaxFiles`    | Positive integer; `4000`                                                             | Maximum number of files included in the baseline before implementation. Without Git this covers all regular project files except the exclusions described below; with Git it covers existing changed files needing a copy. Exceeding the limit stops implementation before copying.                                                                                                                                                                                                                                                      |
| `snapshotMaxMiB`      | Integer from `1` to `1000000`; `100`                                                 | Maximum combined size, in MiB, of files copied into the baseline. Exceeding it stops implementation before copying.                                                                                                                                                                                                                                                                                                                                                                                                                      |

### Model settings

A model object has this shape:

```json
{
  "provider": "openrouter",
  "model": "openai/gpt-6-luna",
  "thinkingLevel": "medium"
}
```

`provider` and `model` are required nonempty strings and must identify a model Pi can find and authenticate. `thinkingLevel` is optional and accepts `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`. When omitted, Pi keeps the current thinking level. A missing or `null` override keeps Pi's current model.

Add any supported phase to `phaseModels` using the same object shape. For example, `phaseModels.research` selects a model when the task starts, while `phaseModels.review` selects one for each new review session.

The research model is selected when its session opens. Other overrides apply when their new phase session opens. Reopening a session with an already applied override keeps its saved model; changing configuration does not retroactively replace it. You can also change a session's model with Pi's normal controls.

Task artifacts live in `.agents/task-workflow/<task-id>/context/`; `implementation-N.diff` and review round files exist only while the step is active. `config.json`, `state.json`, `sessions/`, and `baselines/` live directly under `.agents/task-workflow/<task-id>/`. Task discovery scans these fixed task directories and a small index under `~/.pi/agent/task-workflow-index/`.

## 🔧 Implementation notes

`task_write_artifact` replaces a complete task artifact atomically. The model supplies an artifact kind and optional step number, while the extension chooses the path. It refuses to replace a symbolic link. The extension writes task state and implementation diffs itself. The transition check uses the recent phase discussion and current review artifact to identify open questions or unapproved proposals; it is a model judgment, so important decisions should be explicit.

The English-only artifact rule appears in each phase's system instructions, in the artifact tool description, and in the separate model request that finalizes an artifact. It guides generation; the extension does not try to classify the language of code, file names, or quoted diff lines.

The extension's review prompt defines the invariant contract and default artifact format/procedure. A configured, available review skill may define the procedure within that contract; no review skill is selected by default. The extension does not validate or normalize review artifact formatting; it only requires the review artifact to be saved before the phase can advance. Review status summaries recognize Markdown `###` finding headings and `Status: resolved` or `Status: dismissed` markers when present.

### Safety mechanisms

The `before_agent_start` hook shows only the phase's allowed tools. A `tool_call` hook also blocks calls to other tools. Research, roadmap, and implementation Preparation allow reading project files and writing task artifacts. Implementation is a single workflow phase with a guarded Preparation stage followed by Coding: `/task next` captures a baseline and starts Coding in the same session. At that point the extension adds `pi.getActiveTools()` (tools from active extensions) plus `read`, `bash`, `edit`, and `write`; `phaseTools.implement` no longer limits the tool set. Review, manual review, and commit use read-only tools; commit-phase code must be committed through Git outside the model's tool access. These are Pi tool controls, not operating system file permissions; a user command or another extension's own code can still write files.

### Tree navigation

`/tree` changes the conversation branch but does not roll task artifacts or project code back. The extension blocks it in task sessions by default. Set `allowTreeNavigation: true` to remove this block; all branches still share the latest artifacts and state. `/task status` shows the setting.

### Implementation diff

Before editing begins, the extension captures a baseline under the task directory. With Git, it copies existing changed files and later combines their before/after patches with Git's diff for newly changed files. Without Git, it snapshots all regular project files below the project root except the task directory, `.git` directories, and symbolic links. It compares changed files using `git diff --no-index`, which requires the Git executable but not a repository. The baseline remains through repair and review rounds, then is removed when the commit phase is prepared.

The defaults limit a snapshot to 4,000 files and 100 MiB. The extension checks those limits before copying and does not start implementation when either is exceeded. `implementation-N.diff` contains the full result with paths relative to the project root; large diffs can still be expensive to review and to use for commit-message generation. It is removed after the step's commit phase completes. Review reports for that step are removed at the same time; the execution record in `step-N.md` retains concise summaries.

Each `step-N.md` includes a workflow status: `planned` after its design is finalized, `in_progress` from implementation through review and commit, and `completed` only after the commit phase finishes. At completion, the extension adds a compact execution record with review-round summaries, accepted decisions, and finding dispositions. The complete round reports are removed when the step completes; their compact summaries remain in `step-N.md`.
