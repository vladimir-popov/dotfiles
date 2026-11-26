# Task workflow

**Version: 2.10.0**

A [Pi](https://pi.dev/) extension for LLM-assisted coding tasks with phase-specific context and tool permissions. It guides tasks through research, planning, implementation, and review, using purpose-specific sessions and artifacts to manage context while limiting tool access at each stage.

## Changelog

### 2.10.0

- Research now appends verified decisions and `/task accept` clarifications to `context.md`
  before opening Roadmap, preserving existing notes and multiline code snippets. If verification
  or saving fails, the task stays in Research.
- Every phase uses the current `context.md` as its entry point and opens linked notes as needed.
  Coding, repair, review, and commit can record reusable findings in optional `step-result-N.md`
  files that survive step cleanup.
- Repair resumes with the exact automated review round or the inline manual-review findings,
  even after session compaction or branch changes. Stale automated findings require a fresh review.
- Review and commit verification distinguish regular files, symlinks (including dangling links),
  and deletions. Auto-commit requires a fresh review for older snapshots that lack entry types;
  saved manual commits retain their legacy verification behavior.
- Implementation starts only after the baseline is saved. Semi-auto commit can finish without
  an extra assistant turn.

### 2.9.0

- Added `/task browse` and `/task delete --global [TASK-ID]` to find and delete tasks
  across indexed project roots; the browser can also remove broken index entries.
- Added discovery and deletion support for historical tasks under
  `.agents/projects/<task-id>/`.
- Added configurable deletion modes: move task data to the OS trash by default or
  permanently delete it. If moving to trash fails, the extension can ask to retry
  the remaining paths with permanent deletion.
- Hardened task discovery and deletion with path and index validation; unrecognized or
  unsafe task data is preserved, and deletion confirmations identify the selected paths.

![A small waterfall flowing into a river past stepping stones](assets/task-flow-waterfall.png)

`/task` guides a coding task through research, roadmap, implementation, review, and commit.
The default mode is `manual`. If you switch to `semi-auto`, it pauses for manual review
between automated review and commit unless you disable `manualReview`.
Research covers task context, discussion, and code investigation in one saved Pi session;
later phases use separate sessions, with compact task artifacts carrying agreed decisions
forward. Each implementation session starts with final discussion of just its current step
before coding begins.

## 🔄 Workflow

```mermaid
flowchart LR
    A["Research"] -->|/task next| B["Roadmap"]
    B -->|/task next| C["Step preparation"]
    C -->|/task next: finalize design; capture baseline| D["Implement"]
    D -->|/task next: save implementation-N.diff; start review round 0| E["Review"]
    E -->|/task next: open findings; preserve round; repair| D
    E -->|clear: semi-auto with manualReview enabled| F["Manual review"]
    E -->|clear: manual mode or manualReview disabled| G["Commit phase"]
    F -->|/task next: findings| D
    F -->|/task accept: accepted fix| D
    F -->|/task next: clear| G
    G -->|verify commit or skip without Git; clean up| H["Step completed"]
    H -->|next step| C
    H -->|final step| I["Task complete"]
```

Research gathers task context and investigates code in one saved conversation. Each step's
preparation discussion and implementation share one saved session; after review finds
issues, repairs return to that same session. Each review round opens a fresh session. A
clear review opens a separate commit phase. In semi-auto mode with `manualReview` enabled,
it opens a separate manual-review phase first. The next step cannot start until the commit phase
finishes. The approved design and implementation handoff remain; workflow status lives in task
state.

With `autoCommit: false`, commit the reviewed files yourself, then run `/task next`. With
`autoCommit: true`, the extension commits eligible changes and, in `semi-auto` mode, can finish
the phase without another assistant turn. Without a Git repository, `/task next` retries
detection and commit-message generation; `/task accept` skips the commit and continues.

New tasks use this project-local layout:

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
        ├── step-N.md                # Approved implementation design
        ├── step-result-N.md         # Implementation knowledge passed downstream
        ├── review-N-round-M.md      # Temporary; removed when the step completes
        └── implementation-N.diff   # Temporary; removed when the step completes
```

The extension also recognizes historical tasks stored under
`.agents/projects/<task-id>/`. Project settings remain in `.agents/task-workflow/config.json`.
The full task directories contain local data; add them to `.gitignore` if desired.

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

Start Pi in the project directory and enter `/task TASK-100500`. Pi asks whether to create a missing
task or continue an existing one. Declining leaves the current session unchanged. `/task` and
`/task list` show project-local tasks with a short state description and their last worked time,
based on the newest saved task session. Both open the same selector in the terminal UI. Use
`/task browse` to inspect tasks across indexed projects and recognized layouts; in the terminal
UI, this selector is for deletion only. Existing project-local IDs also appear in command
completion.

If you rename a project directory, close Pi and start it from the new path. In the terminal UI,
`/task` or `/task resume` can show project-local tasks marked as moved and ask for confirmation
before relocating their state and saved sessions. Declining leaves the task unchanged. Outside
the terminal UI, relocation is refused. Session/state paths are rebased, but historical prose in
the conversation or artifacts is not rewritten.

The extension shows the current phase in a small header above the editor when a task session opens. Once Pi finishes a response, the second line tells you when `/task next` is useful; a pending proposal may instead need `/task accept`. The first line colors the task name, current settings (mode, auto-commit, manual review, and extension version), phase, and phase description separately. By default, the task name is bright green, settings are bright black, and the phase and description are blue. When the project is not inside a Git repository, the widget adds a red `⚠ No Git repository` warning. Configure the other colors with `statusColors` (see Configuration). Pi's built-in footer shows the session name. For implementation preparation, implementation, review, manual review, and commit, the extension adds a short title from the current numbered roadmap step to that name. These UI labels do not enter the model conversation.

Phase kickoffs are hidden extension messages. They guide Pi and start its work without appearing in the editor's ↑ history. After a session switch, ↑ browses the new session's history; the `/task next` command entered in the previous session may therefore not be the first item.

Describe the task over ordinary messages. Use `/task next` when the current discussion is settled. Use `/task accept` to agree to pending proposals and advance; agreement is implied by the command, with no extra note needed. If Pi proposes a version and asks whether to keep it or add an optional feature, `/task accept` keeps the proposed version. If Pi offers several alternatives without recommending one, choose explicitly, for example `/task accept "I prefer option B"`. If there is no pending proposal, `/task accept` advances like `/task next`, except that it can skip a commit when Git is unavailable. In semi-auto manual review, `/task next` routes findings to implementation or a clear review to commit; `/task accept` first accepts the proposed solution. Both commands stop when material questions remain, and `/task next` also stops when a proposal still needs approval. A slash command embedded in ordinary text, such as `I agree. /task next`, does not run.

| Command                     | Action                                                                                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/task new TASK-ID`         | Create a task with the given ID.                                                                                                                                                                                                                                 |
| `/task TASK-ID`             | Open an existing task.                                                                                                                                                                                                                                           |
| `/task` or `/task list`     | Select an existing task, or show a list outside the terminal UI.                                                                                                                                                                                                 |
| `/task browse`              | Browse tasks across indexed projects and select a task or broken index entry for deletion in the terminal UI.                                                                                                                                                     |
| `/task delete [TASK-ID]`    | Delete a project-local task after a separate confirmation. Without an ID, choose from a selector in the terminal UI.                                                                                                                                              |
| `/task delete --global [ID]` | Select and delete a task across indexed projects after a separate confirmation. An ID is required outside the terminal UI.                                                                                                                                    |
| `/task status`              | Show the phase, step, session paths, review status, and settings without adding text to the conversation.                                                                                                                                                        |
| `/task config`              | Show the full effective configuration for the active task without changing it.                                                                                                                                                                                  |
| `/task config change`       | Edit mode, deletion mode, manual review, and auto-commit in the terminal UI and save them in the active task's `config.json`.                                                                                                                                                  |
| `/task config init project` | Create `.agents/task-workflow/config.json` with inherited settings; refuses to overwrite an existing file.                                                                                                                                                      |
| `/task config init task`    | Create `.agents/task-workflow/<task-id>/config.json` with inherited settings; refuses to overwrite an existing file.                                                                                                                                           |
| `/task resume`              | Return to the active task in this project. If multiple tasks are available, choose one in the terminal UI; outside it, use `/task TASK-ID` to select. An interrupted run or pending review resumes automatically; otherwise the saved task session simply opens. |
| `/task show [FILE.md]`      | Select an existing Markdown artifact or show the named file without adding it to the conversation. File names have completion.                                                                                                                                   |
| `/task next`                | Advance after checking the current discussion. In implementation preparation, finalize the design and begin work. Manual-review findings return to implementation; an empty review proceeds to commit. In commit, verify files or retry Git detection. |
| `/task accept [NOTE]`       | Agree to pending proposals and advance. In semi-auto manual review, accept the proposed solution; accepted findings return to implementation, otherwise proceed to commit. Without Git in commit, skip the commit and continue. |
| `/task help`                | Show a short command summary outside the conversation.                                                                                                                                                                                                           |

### Hotkeys

The extension binds **Alt+N** to `/task next`, **Alt+A** to `/task accept`, **Alt+S** to `/task status`, and **Alt+W** to `/task show` by default. They invoke the same commands and checks as the slash forms. Hotkeys work when Pi is idle and the input editor is empty; otherwise the extension shows a reminder and leaves the draft untouched. Run Pi's `/hotkeys` to inspect active bindings. On macOS, your terminal may need Option configured as Meta for Alt shortcuts to work.

`/task show` and Alt+W open a selector containing the existing `.md` files directly in the task
artifact directory, including review rounds for active steps. `/task show roadmap.md` opens one
directly; `/task show ` completes existing Markdown file names. In fullscreen TUI mode, scroll the
viewer with the mouse wheel or `j`/`k` (also `о`/`л`), and drag within the text to select and copy
it without selecting the window frame or rest of the interface. Enter or Escape closes it.
Outside the terminal UI, `/task show` lists available files. Diff files are not included in this
Markdown viewer.

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
The unquoted command words `help`, `list`, `browse`, `new`, `delete`, `status`, `log`, `abort`,
`next`, `accept`, `show`, `start`, `config`, and `resume` are reserved; quote one to use it as an
ID. The retired word `skip-commit` is rejected; quote it if you want to use it as a task
ID. Task storage paths are fixed.

`/task delete` lists tasks in the current project for selection. `/task delete TASK-100500`
selects one directly; quote IDs with spaces as above. `/task delete --global TASK-100500` selects a
task across indexed projects. If an ID occurs in multiple projects, use `/task browse` in the
terminal UI and choose the exact project and path. Global browsing also offers
`/task delete --global` with no ID in the terminal UI. All routes require a separate confirmation
that names the selected data paths; `/task browse` uses `x` to begin deletion, not to confirm it.
Deletion is limited to validated task directories; project files outside them remain untouched.
Finish or cancel a running Pi response before deleting.

Deletion moves recognized task data to the OS trash by default. Set `deleteMode` to `permanent`
to delete it permanently instead; permanent deletion cannot be undone. If trashing fails,
deletion stops and the index record is retained; Pi offers a separate confirmation to set the
task's deletion mode to permanent and retry only the remaining paths. It never switches to
permanent deletion silently. When deleting a task that is open, Pi first switches to a normal
session outside its task directory.

Global discovery is bounded to the active project and project roots named by valid records in the
shared task index. It checks the current `.agents/task-workflow/<task-id>/` and recognized
historical `.agents/projects/<task-id>/` layouts; it does not recursively scan projects. Tasks or
entries with unknown layouts or invalid data are shown in a warning color and preserved.
`/task browse` can remove a broken index entry without touching task data. If a valid index record
identifies a recognized task directory but its `state.json` is missing, the selector offers to
remove only the index record or also the remaining task directory. Removing that directory
requires explicit selection and confirmation. Malformed records or unvalidated paths never
authorize deleting task data. Outside the terminal UI, use an explicit ID for task deletion;
broken index entries can only be removed in the terminal UI.

### Phases and artifacts

**Workflow lifecycle.** Tasks move through Research, Roadmap, Implementation, Review, optional
Manual review, and Commit. Research records agreed context, Roadmap turns it into a numbered plan,
and Implementation prepares and codes each step. Review examines the implementation; optional
Manual review and Commit follow according to the phase instructions. The step record and task state
carry the work into the next step or mark the task complete.

`state.json` tracks the active phase, current step, completion state, and saved phase-session paths.
When a new phase session is created, the extension attaches task metadata and a hidden seed with the
task ID, phase, step, and task-artifact directory. At the start of each model run in the active
session, the common system section directs the model to the canonical `context.md` from current
state. The extension also selects allowed tools and adds phase-specific instructions. Kickoffs give
the immediate scope and any direct work inputs. Manual review and Commit begin with visible phase
messages instead of an automatic assistant turn. Implementation preparation and coding share a
session; each Review round gets its own session.

Outside Commit, the separate transition-assessment call receives the task and phase, command and
note, recent phase discussion, and applicable context: the approved roadmap item during
Implementation preparation or the current review artifact during Review. Unresolved questions or unapproved proposals block
advancement; `/task accept` can accept the latest proposal, but does not bypass open questions.
Open Review findings and manual-review findings return to Implementation; a clear manual review
proceeds to Commit.

#### Research

Research turns an initial request into a clear, evidence-based understanding of the work before
planning begins. The model discusses the expected outcome and constraints with the user, then
inspects the project and investigates feasibility using read-only sources. Keep `context.md` as a
standalone task summary with constraints, accepted decisions, and annotated links to supporting
notes. Record durable findings in topical Markdown notes as they are discovered, including evidence,
rationale, and nonblocking uncertainties. Keep the links current so later sessions can find the
notes without needing the Research transcript.

**Phase instructions.** Research starts with the shared context entry point and records durable
findings in supporting notes. A fresh Research session waits for the user to describe the task;
the phase guidance lists the enabled Research tools and forbids project edits.

**Tools and artifact restrictions.** By default, Research provides `read`, `grep`, `find`, `ls`,
`task_write_artifact`, and available directly listed web, search, and fetch tools that are not
marked as mutating. The model may read project files and is instructed not to edit them. The
artifact tool remains available even when `phaseTools` replaces the phase's default tool list; it
can edit standard and custom Markdown artifacts. The `phaseTools` setting can replace other tools,
while `additionalPhaseTools` can extend it; see [Configuration](#-configuration).

**Transition.** Material questions block both `/task next` and `/task accept`. Use `/task accept`
to approve a pending proposal; an optional note clarifies the decision, even if no proposal is
pending. Before switching to a fresh Roadmap session, the extension appends newly accepted decisions
and explicit clarifications to `context.md`. It preserves existing text and links, never edits
supporting notes, and skips the write when nothing is missing. If the update cannot be validated or
saved, the task stays in Research.

Research treats everything after `/task accept` as free-form text, without requiring quotes.
When the note contains multiline code, use matching Markdown fences with the closing fence on
its own line. Pi trims whitespace at the start and
end of the terminal submission. The closing fence keeps the snippet's final indentation and
trailing spaces inside the submission instead of at its trimmed edge.

#### Roadmap

Roadmap turns confirmed findings into an ordered plan that defines the work before implementation
begins. The model discusses the proposed steps with the user, revises the plan as requirements are
agreed, and records the settled plan in `roadmap.md` for the later implementation-preparation
sessions.

**Phase instructions.** Roadmap starts with `context.md` and opens only linked notes relevant to the
planning work. As decisions settle, it updates `context.md` when agreed facts change and drafts a
complete, numbered `roadmap.md`.

**Session state and prompt context.** On entry, `state.json` records the active Roadmap phase,
step, and session path in `sessions.roadmap`. The session seed identifies the task, Roadmap phase,
step 1, and task-artifact directory. The turn's common system context includes the task ID, phase,
step, canonical `context.md` path, and artifact and language rules; the extension separately selects
the allowed tools and appends the Roadmap-specific instruction.

**Kickoff message.** The hidden kickoff starts the Roadmap turn with this request:

> Propose a numbered roadmap with a short bold title and brief explanation for each step. Discuss
> additions and update context when we agree on them.

**Tools and artifacts.** By default, Roadmap provides `read`, `grep`, `find`, `ls`, and
`task_write_artifact`. `phaseTools` can replace the default tool list;
`task_write_artifact` remains available, and `additionalPhaseTools` can add tools. As requirements
are agreed, update `context.md` with new facts and draft a complete, numbered `roadmap.md`.
Top-level steps are numbered consecutively from 1; short bold titles and dash explanations are
preferred, though ordinary numbered Markdown steps are also accepted. See
[Configuration](#-configuration) for tool settings.

**Transition.** `/task next` assesses unresolved questions and unapproved proposals. Once the
roadmap discussion is settled, the extension finalizes `roadmap.md` and opens Implementation
preparation.

#### Implementation

Implementation turns one approved roadmap item into a reviewed change. It begins with a
preparation discussion that settles the current step design and checks, then continues into coding
in the same saved session. `/task next` finalizes the design and saves the starting file baseline
before lifting the write restriction and sending the coding kickoff. If baseline capture fails,
preparation stays read-only and no coding kickoff is sent.

**System instructions.** In preparation, the phase-specific instructions tell the model to review
the task context, roadmap, current step design, and relevant earlier implementation knowledge;
discuss implementation details and checks; update only the design and refrain from editing project
code. During coding, the instructions direct the model to implement or repair only the approved
step,
address open review findings, run focused checks, capture useful implementation knowledge for later
steps, and avoid committing.

**Phase-specific extension instructions.** The extension adds one of these Implementation
instructions to the common task context, depending on whether coding has started. These are the
phase-specific additions, not Pi’s full assembled system prompt.

**Preparation instruction.** The model reads the context, roadmap, current design, and earlier
`step-result-N.md` artifacts relevant to the planned step. It discusses implementation details and
checks, updates only the agreed design in `step-N.md`, and does not edit project code. Step status
is held in workflow state, not in the design artifact.

**Coding instruction.** The model implements or repairs only the approved step, reads relevant
prior result artifacts, runs focused checks, and does not commit. For repair, the extension
recovers the latest repair kickoff from the saved session even if compaction removed it from
model context or `/tree` selected an older branch. A later stale-review notice invalidates that
kickoff. Record findings that matter to later work while the evidence is available, as described
under Task artifacts.

**Kickoff messages.** Each hidden kickoff starts a model turn with the immediate task. The
preparation kickoff introduces the approved roadmap item and asks the model to discuss and record
the current step design without coding:

```text
This is the preparation session for step ${step}${total ? ` of ${total}` : ""}.
Planned work: ${summary}. Begin by briefly explaining this scope and making clear that this is the
final discussion before coding. Read ${roadmapPath(state)}; read
${stepPath(state, step)} if it already exists. Read earlier implementation-knowledge
artifacts only when relevant to this step. Discuss remaining implementation details and checks,
and keep the agreed current-step design in ${stepPath(state, step)}. Do not edit project code yet.
/task next checks for unresolved questions or proposals, finalizes ${stepPath(state, step)},
captures the implementation baseline, and starts coding.
```

After preparation succeeds, a second hidden kickoff starts coding in that same saved session and
specifies the approved scope and initial checks:

```text
Implement step ${state.currentStep} in this Pi session. The agreed design is in
${stepPath(state, state.currentStep)}. Read ${roadmapPath(state)}, the current code, and only
earlier step-result artifacts relevant to this step. Make only the agreed changes and run focused
checks. Do not commit. When finished, summarize the changes and checks. I will use /task next
to start review.
```

**Tools and artifacts.** The internal `task_write_artifact` tool remains available in every phase,
including when `phaseTools` replaces the default allowlist, and supports all standard and custom
Markdown artifacts. Coding also receives the active Pi tools and project-editing tools after the
baseline is captured; other phases retain their existing project-code restrictions. `step-N.md`
contains only the approved design. A `step-result-N.md` is optional and holds reusable knowledge
from coding, repair, either kind of review, or commit. Review reads the current step's result
when present; later preparation reads only relevant earlier results. `/task next` writes the temporary
`implementation-N.diff` from the captured baseline.

**Transition.** During preparation, `/task next` checks for unresolved questions and unapproved
proposals. Once settled, it finalizes `step-N.md`, captures the implementation baseline, and starts
the coding turn in the same session. After coding, `/task next` saves `implementation-N.diff` and
opens Review in a fresh session. Open review findings return to
the saved Implementation session with repair guidance; the model addresses open findings and runs
focused checks before requesting another review.

Review acceptance routes to Manual review or Commit as described in those phase subsections.

`/task resume` returns to the active task in the current project, including from a fresh `/new` session. If several active tasks exist, the terminal UI offers a selector; outside it, use `/task TASK-ID` to choose one. It also detects confirmed project-directory renames for project-local tasks. An aborted run resumes in its saved session with current phase instructions. A review with no saved `review-N-round-M.md` for the active round also resumes; `/task next` remains blocked until that artifact is saved. If no run needs resuming, the command simply opens the saved task session. It does not advance the phase or clear pending artifacts.

Standard and custom Markdown artifacts can be created or updated in every phase, including
read-only phases, Commit, and Complete. Project code remains editable only after `/task next` starts
Implementation and captures a baseline. The extension tracks the current phase and saved sessions
in `state.json`.

The task instructions tell Pi to converse in your language, including explanations, questions, and
review discussion. Standard task artifacts use English prose and headings: Pi translates the agreed
meaning when it writes or revises `context.md`, `roadmap.md`, `step-N.md`, `step-result-N.md`, and
`review-N-round-M.md`. Custom artifacts may use the user's language and retain it when updated.
Exact code, identifiers, paths, and required diff excerpts remain unchanged. Existing non-English
prose in standard artifacts is rewritten when next updated or finalized; loading an old task does
not rewrite files automatically.

#### Review

Review begins in a fresh session that checks the implementation independently against the approved
context and step design. The reviewer inspects the generated implementation diff and relevant
project code; each later review round starts in another fresh session, so repaired changes receive
an independent review.

**System instructions.** Review-specific instructions require an independent, read-only examination
of the approved scope, step design, implementation-knowledge handoff, implementation diff, and
relevant code. They prescribe the report structure and direct the model to discuss findings
without editing project code or advancing the workflow. Whether Review is fresh, reopened, or
resumed, the shared Review instruction requires reading the current `step-result-N.md` if it
exists. Earlier step results remain optional.

**Phase-specific extension instruction.** The extension adds this Review instruction; it is a
phase-specific addition, not Pi’s full assembled system prompt:

```text
Review step ${state.currentStep} independently against the approved context, design, and
implementation knowledge. Read ${stepPath(state, state.currentStep)}, the implementation
diff, and relevant project code using read-only tools. Read the current implementation handoff at
${stepResultPath(state, state.currentStep)} if it exists, before drawing conclusions. Save
${reviewPath(state, state.currentStep)} as an English artifact using task_write_artifact with
artifact "review", step ${state.currentStep}, and operation "create" (or "replace" when revising
an existing report).

Start with # Review: step ${state.currentStep}, then include ## Summary and ## Findings.
For every finding, place one short, exact excerpt copied verbatim from
implementation-${state.currentStep}.diff in a fenced diff block immediately before its heading.
Then use a heading ### [Severity] Short title, followed by exactly one Status: open line, a
precise Location:, and a concise explanation of the defect and concrete impact. Do not report
style preferences as defects. If there are no findings, write No findings. under ## Findings and
include no finding headings or diff blocks.
In your response, show each finding with its severity, location, impact, and the same diff
excerpt. Discuss findings with the user; change statuses only after agreement, using resolved
for fixed and dismissed for rejected. Do not edit project code or advance the workflow.
```

**Kickoff message.** This hidden kickoff starts the Review turn in its new session, identifying the
approved artifacts and diff to inspect, the report to save, and the requirement to discuss findings:

```text
Review step ${step}. Read ${stepPath(state, step)} and
${join(taskDir(state), `implementation-${step}.diff`)}. Review the changes independently
against the approved scope and inspect relevant project code. Save the review at
${reviewPath(state, step)} using task_write_artifact with artifact "review", step ${step},
and operation "create" (or "replace" if revising an existing report). Do not edit project code or
advance the workflow. Discuss findings with me and update their statuses only after we agree.
```

**Tools and report.** By default, Review provides `read`, `grep`, `find`, `ls`, and
`task_write_artifact`; project code is read-only. `reviewTools` can add review tools,
`phaseTools` can replace the default list, and `additionalPhaseTools` can extend it. The artifact
tool remains available. The report is saved in the task directory as `review-N-round-M.md`, with
rounds beginning at 0 and increasing for each new review session.

Each report starts with `# Review: step N`, then `## Summary` and `## Findings`. For every finding,
a short exact excerpt from `implementation-N.diff` appears in a fenced `diff` block immediately
before `### [Severity] Short title`. The finding then has exactly one `Status: open` line, a precise
`Location:`, and a concise explanation of the defect and concrete impact. Style preferences are
not defects. If there are no findings, `## Findings` contains `No findings.` and no finding headings
or diff blocks. The response also presents each finding with its severity, location, impact, and
the same excerpt. After discussion, statuses change to `resolved` for fixed findings or `dismissed`
for rejected findings.

**Transition.** `/task next` assesses the current review and report. Open findings return to the
saved Implementation session with a kickoff that identifies the exact current round's report.
The extension resolves that report under the current artifact directory, including after a project
move. Implementation reads it and addresses only open findings. If the reviewed diff has
changed, the workflow asks for a fresh review instead of handing off stale findings. After repair,
`/task next` starts a fresh Review round. Once no findings remain open, the workflow proceeds to
Manual review only in semi-auto mode when `manualReview` is enabled; otherwise it proceeds to
Commit.

#### Manual review (optional)

Manual review is a separate session offered only in semi-auto mode when `manualReview` is enabled.
It follows a clear automated review and gives the user a chance to inspect the implementation
before Commit. It is skipped in manual mode or when the setting is disabled.

**System instructions.** Manual-review instructions say the automated review found no remaining
issues and direct the user to inspect `implementation-N.diff` and changed project files. The model
reads the current `step-result-N.md` when available and relevant. Do not conduct another automated
review, edit project code, or commit. Agreed task-artifact updates remain available through
`task_write_artifact`; no separate report is automatically written or required.

**Phase-specific extension instruction.** This Manual review instruction is added by the extension;
it is distinct from the common system instructions:

```text
This is the manual review phase for step ${state.currentStep}. Read
${stepResultPath(state, state.currentStep)} if relevant and available. The automated review
found no remaining issues. Direct the user to inspect
${join(taskDir(state), `implementation-${state.currentStep}.diff`)} and the changed project
files. Do not conduct another automated review, edit code, or commit. Use task_write_artifact for
any agreed task-artifact updates. Manual-review findings route to implementation; an empty
review proceeds to commit.
```

**Session message.** Manual review has no separate hidden kickoff. It starts in its own session with
a visible phase message directing the user to inspect the implementation diff and changed files;
when available, the message also lists the changed file paths.

**Tools and artifacts.** By default, the phase provides `read`, `grep`, `find`, `ls`,
`task_write_artifact`, and configured `reviewTools`. `phaseTools` can replace the default list, but
`task_write_artifact` remains included; `additionalPhaseTools` can extend the tools. The model may
edit standard or custom task Markdown artifacts, but not project code, state, implementation diffs,
or saved sessions.

**Transition.** Use `/task next` when the discussion is settled, or `/task accept` to accept a
proposed solution. The standard transition checks still apply. Manual-review findings are sent to
the saved Implementation session inline in the repair kickoff. No manual review report is
created, and the cleared automated report is not a source of manual repair findings. An empty
findings result proceeds to Commit. Manual review does not recompute the diff. If the worktree
changed, explicitly ask in Manual review to return to Implementation for a fresh automated
review before proceeding. After repair or an explicit re-review request, `/task next` in
Implementation starts a new automated Review round.

#### Commit

Commit gives each accepted step a clear closeout in its own saved session. The extension prepares
and presents a commit result for the reviewed changes; depending on `autoCommit`, it either
creates the commit or waits for the user to commit the reviewed files. Completing the phase removes
temporary step artifacts and moves to the next step or marks the task complete.

**System instructions.** The phase-specific instructions depend on whether a commit result is
ready. When one is ready, they direct the model to explain it and avoid project-code edits. They
also tell the user when a manual commit is pending. For a pending result, they direct the model not
to invent one and explain how to retry or skip if Git is unavailable. Task-artifact edits remain
available in either state.

**Phase-specific extension instructions.** The extension adds one of these Commit instructions to
the common task context, depending on whether a result is ready. These are phase-specific additions,
not Pi’s full assembled system prompt.

Ready-result instruction:

> Present and explain the commit result already saved in this session. Do not implement, review,
> or edit project code, state, or implementation diffs. Task-artifact edits remain available through
> task_write_artifact. If a manual commit is pending, the user must commit the reviewed files before
> leaving; /task next verifies this. Only /task next (or /task accept) leaves this phase and starts
> the next step or completes the task.

Pending-result instruction:

> The commit result is not ready. Do not invent one or edit project code. Task-artifact edits remain
> available through task_write_artifact. Tell the user that /task next retries Git detection and
> commit-message generation, while /task accept skips the commit and
> continues if Git is unavailable. This is the separate commit phase.

**Commit-message preparation.** Commit-message generation is a separate model call. The extension
supplies the implementation summary and step diff, requests an English JSON object with a concise
title and body grounded only in those changes, then displays the result. With `autoCommit: true`,
the extension commits eligible reviewed changes automatically; otherwise it proposes a message and
waits for the user to commit. If the model response is unstructured, manual mode presents a labeled
fallback based on changed file names and the implementation summary; auto-commit mode skips the
commit and asks the user to retry.

**Session message.** Commit has a separate session and no separate hidden kickoff. Its visible
phase message introduces the phase and explains how to obtain or retry the result:

```text
Review accepted for step ${step}. This is the separate commit phase. The commit result will
appear here; use /task next to generate or retry it if needed.
```

The extension then displays the commit outcome or retry instructions as a separate visible
message. Commit writes no separate report. The approved design remains in `step-N.md`;
implementation knowledge is retained in `step-result-N.md`.

**Tools and artifacts.** By default, Commit provides `read`, `grep`, `find`, `ls`, and
`task_write_artifact`. `phaseTools` can replace the default tools and `additionalPhaseTools` can
extend them, but the artifact tool remains available. Commit does not allow project-code edits.

**Transition and completion.** If Git is unavailable, the phase remains open. `/task next` retries
Git detection and commit-message generation; if Git is still unavailable, the phase remains open.
`/task accept` (without a note) intentionally skips the commit and continues. Commit does not
accept approval notes. If message generation fails, `/task next` retries it. If an older saved
snapshot does not distinguish file types, auto-commit
waits and `/task next` starts a fresh automated review using the original baseline. For a manual
commit, `/task next` verifies the reviewed file contents and entry types for new snapshots before
leaving the phase. A saved legacy manual Commit retains its original content-hash comparison.

After successful verification (or an allowed skip), the extension removes only this step's
`implementation-N.diff` and `review-N-round-M.md` files. It keeps the approved `step-N.md` and any
`step-result-N.md`, along with their durable index links. Save reusable findings when they are
learned: semi-auto Commit can finish without an interactive turn. If an interactive Commit turn
identifies knowledge that still needs to be saved, record it before leaving without rerunning
Review. The extension does not copy review reports or statuses into durable files. If Git is
available and no code changes were produced, the step passes through without a commit action.
If Git is unavailable, even a no-change step remains in Commit: `/task next` retries detection,
and `/task accept` skips the commit. In `semi-auto` mode with `autoCommit: true`, the extension
can dispatch `/task next` itself when the commit result is ready, including for a no-change step.
If another step remains, its Implementation preparation session opens with a summary of its
roadmap scope. After the final step, the task is complete.

### 👀 What each Pi sees

Every phase starts with the current `context.md`, including Commit and reopened Complete sessions.
The file summarizes the task and indexes durable artifacts. Open linked notes and other files in
`context/` only when relevant. Reuse a current copy already read in the same phase, but read it
again on phase or mode entry, if it may have changed, or if a resume needs current context. The
shared instruction provides the current path, not file contents or the preceding phase's
transcript. The current path takes precedence over paths in saved kickoffs. Direct work inputs,
such as the approved step design and the current review diff, are identified separately. The
scripted Commit message draft still uses the reviewed diff and implementation summary, not task
notes.

Fresh phase sessions, interrupted resumes, and transitions within the same session all use the
same context instruction. Opening a saved session normally waits for the user to send a message;
resuming interrupted work or a pending Review sends the existing resume kickoff. Research gathers
context and investigates the code in its own conversation. After the Research handoff is saved
(or no write is needed), Roadmap starts in a fresh session.

Roadmap, each step's implementation session, each review round, each semi-auto manual-review phase,
and each commit phase have their own saved sessions. A new implementation session starts with a
preparation discussion and a short summary of the current roadmap item; the same session continues
into coding after `/task next` captures the baseline. It does not inherit the roadmap chat transcript.
The durable handoff is `context.md`, `roadmap.md`, the approved `step-N.md` design, and each
`step-result-N.md` containing knowledge relevant to later work. The commit session keeps the commit
result and its phase boundary.

Returning from review restores that step's Implementation session and baseline. The repair
kickoff references the current automated report or includes the manual findings inline. Review is
a separate conversation and sees task artifacts, the current implementation diff, and code it
reads. Each repeated review is a new conversation, so it checks the repaired code independently.
Sessions and baselines are saved under the task directory, separate from its `context/` artifacts.
Opening an older task without a session map creates a saved session for its current phase;
earlier background worker conversations cannot be reconstructed.

## ⚙️ Configuration

The extension reads `~/.pi/agent/task-workflow.json` (or `task-workflow.json` in
`PI_CODING_AGENT_DIR`). Project overrides live in
`<projectRoot>/.agents/task-workflow/config.json`; task settings for current-layout tasks live in
`<projectRoot>/.agents/task-workflow/<task-id>/config.json`. For deletion-mode overrides only,
historical tasks under `.agents/projects/<task-id>/` use
`<projectRoot>/.agents/projects/<task-id>/config.json`. Settings in existing task state files are
ignored and are not migrated.
Settings resolve in task → project → global → built-in-default order. For
`skills`, `phaseModels`, `phaseTools`, `additionalPhaseTools`, `hotkeys`, and
`statusColors`, entries resolve by key; other values, including arrays, are replaced by
the most local setting. Missing keys inherit; `null` explicitly disables skills and
phase models, and can disable default hotkeys. The global file is optional; omitted
properties use the defaults below. Run `/task config init project` or `/task config init task`
to create a config without overwriting an existing file. These commands copy the current
inherited `mode`, `deleteMode`, `manualReview`, and `autoCommit`
(defaults: `manual`, `trash`, `true`, and `false`), and the `include` and
`exclude` pattern lists (both default to `[]`). An empty `include` means no allowlist;
legacy `include: null` is still accepted and is written as `[]` in new configs. An empty
`exclude` means no exclusions. The project inherits from global settings; the task inherits
from project and global settings. Delete a copied key to resume inheriting its value. Other
settings continue to inherit. `include` and `exclude` filter the baseline and implementation
diff using globs matched against project-relative paths. A file must match at least one
`include` pattern when the allowlist is nonempty. The last matching `exclude` pattern wins;
a `!` prefix removes an exclusion but does not override the allowlist. These filters do not
grant or restrict tool access. Use `/task config` to view the effective workflow settings.
Use `/task config change` in the terminal UI to change mode, deletion mode, manual review, and
auto-commit for the active task; it creates or updates the task's `config.json` and preserves
its other settings.
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
| `deleteMode`          | `trash` or `permanent`; `trash`                                                      | Controls how selected task data is deleted. `trash` moves it to the OS trash; `permanent` removes it without using the trash and cannot be undone. The value resolves task → project → global → built-in default. A trash failure stops deletion; Pi asks separately before saving `permanent` for the task and retrying remaining paths. |
| `statusColors`        | Object; bright green, bright black, blue, blue                                       | Colors for `taskName`, `currentSettings`, `currentPhase`, and `phaseDescription`, respectively. Each value accepts an ANSI color name (`black`, `red`, `green`, `yellow`, `blue`, `purple`, `cyan`, `white`, or a `bright`-prefixed variant), a 0–255 palette index, or a hex color such as `#RRGGBB`. Unspecified values use their defaults.                                                                                                                                                                                            |
| `phaseModels`         | Object; `{}`                                                                         | Model overrides by phase. Valid keys: `research`, `roadmap`, `implement`, `review`. New tasks use `phaseModels.implement` throughout step preparation and coding. Each value is a model object or `null`; omitted keys and `null` leave Pi's current model in place.                                                                                                                                                                                                                                                                     |
| `skills`              | Object; `{}`                                                                         | Maps phase names to Pi skill names. Valid keys: `research`, `roadmap`, `implement`, `review`, `commit`. Each value is a skill name or `null`; omitted entries inherit from the broader scope, while `null` explicitly disables the skill. An available review skill may define the procedure, within the extension-owned contract. A missing skill does not block the phase. Use names such as `roadmap-planning`, not paths to `SKILL.md`.                                                                                     |
| `phaseTools`          | Object; built-in phase-specific tool sets                                                    | Optional replacement allowlists by phase, including `manual-review`. A configured list replaces the phase's built-in user-tool list. The internal `task_write_artifact` remains available in every phase, including Commit and Complete. Prefer `additionalPhaseTools` when you only want to grant extra extension tools without replacing defaults. |
| `additionalPhaseTools`| Object; `{}`                                                                               | Maps phases, including `manual-review`, to arrays of extra tool names, added to that phase's normal allowlist. This is the recommended way to enable tools from other extensions while retaining defaults (including discovered read-only web tools in Research). For `implement`, additions apply during Preparation; during Coding the extension already enables active Pi tools plus `read`, `bash`, `edit`, and `write`. Entries resolve by phase across global → project → task scopes; a more local list replaces the same phase's broader list. |
| `reviewTools`         | Array of tool names; `[]`                                                            | Replaces the additional review tool list from broader scopes. These tools are added to the automated review's built-in set: `read`, `grep`, `find`, `ls`, and `task_write_artifact`. The same `reviewTools` are available in manual review; `task_write_artifact` is always included. Add only tools the configured procedure needs and that you trust for read-only project work. For example, enable a delegation tool explicitly with `"reviewTools": ["subagent"]` (use the actual tool name provided by your environment).                                                                                                                                                                                                                                                                                                              |
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

New task artifacts live under `.agents/task-workflow/<task-id>/context/`; implementation diffs
and review-round files exist only while a step is active. Runtime files live directly under the
task directory. Discovery uses the known current layout, the recognized historical
`.agents/projects/<task-id>/` layout, and records in the shared index under
`~/.pi/agent/task-workflow-index/` (or under `PI_CODING_AGENT_DIR`). Global discovery checks only
the active project and roots from valid index records; it does not broadly scan the filesystem.

## 🔧 Implementation notes

### Artifact editing

`task_write_artifact` edits standard and custom Markdown artifacts in every phase, including
Research, Review, Manual review, Commit, and Complete. Every call requires an explicit `operation`:

- `create` writes a new artifact and fails if the target exists.
- `append` adds content to an existing artifact.
- `replace_text` replaces one unique exact partial `oldText` match; it rejects whole-file matches.
- `replace` replaces the complete content of an existing artifact.

Updates require an existing file; use `create` for a missing artifact. `oldText` is valid only for
`replace_text`. Standard artifact kinds are `context`, `roadmap`, `step`, `step-result`, and
`review`; the extension selects their fixed paths from the kind and optional step number. Custom
artifacts require a Markdown basename and are confined to the task context directory. Custom names
cannot collide with standard artifact names. Writes are atomic and refuse symbolic links and
non-regular files. The fixed task-context directory and its ancestors must be real directories,
not symlinks.

The tool cannot target `state.json`, implementation diffs, saved session files, or project code.
Standard paths are fixed by the extension; custom paths accept only Markdown basenames inside the
task context directory. These path restrictions complement phase tool allowlists, which continue to
limit project-code access. Run `npm test` to exercise operation semantics, path confinement, and
phase availability.

`step-N.md` stores only the approved implementation design. Workflow status is kept in task state,
not injected into the design file. Create `step-result-N.md` only when coding, repair, automated
or manual review, or commit produces knowledge useful to later steps or later task work. Save it
before handoff or automatic advancement, and extend existing results without replacing unrelated
material. Record what matters and why or when it applies, not a change log, test log, or
review-history summary. Make the result
understandable without the temporary report or diff. Add a descriptive link in `context.md` for a
new durable artifact and surface task-wide changes there. Leave the index unchanged otherwise;
never add temporary review reports or implementation diffs to it. Review reads the current step's
result if present; later preparation reads only relevant earlier results. Existing task artifacts
are not migrated or rewritten automatically.

Standard artifacts use English prose. Custom artifacts may use the user's language and retain it
when updated. The language rule guides generation; the extension does not classify artifact content.

### Review reports

The extension's review prompt defines the invariant contract and default artifact format/procedure.
A configured, available review skill may define the procedure within that contract; no review skill
is selected by default. The extension does not validate or normalize report formatting; it only
requires the current review artifact to be saved before the phase can advance. Review status
summaries recognize Markdown `###` finding headings and `Status: resolved` or `Status: dismissed`
markers when present.

### Safety mechanisms

The `before_agent_start` hook shows only the phase's allowed tools. A `tool_call` hook also blocks
calls to other tools. The artifact tool is always retained in active task phases, including when
`phaseTools` replaces the default list; Complete exposes only artifact editing. Research, Roadmap,
Review, Manual review, and Commit remain read-only with respect to project code. Implementation is a
single workflow phase with a guarded Preparation stage followed by Coding: `/task next` captures a
baseline and starts Coding in the same session. At that point the extension adds
`pi.getActiveTools()` plus `read`, `bash`, `edit`, and `write`;
`phaseTools.implement` no longer limits the tool set.
These are Pi tool controls, not operating system file permissions; a user command or another
extension's own code can still write files.

### Implementation diff

Before editing begins, the extension captures a baseline under the task directory. With Git, it
copies existing changed files and later combines their before/after patches with Git's diff for
newly changed files. Without Git, it snapshots regular project files except the task directory,
`.git` directories, and symbolic links. It compares changed files using `git diff --no-index`, which
requires the Git executable but not a repository. The baseline remains through repair and review
rounds. It is removed once the commit result is ready, or during step cleanup if the commit is
skipped.

The defaults limit a snapshot to 4,000 files and 100 MiB. The extension checks those limits before
copying and does not start implementation when either is exceeded. `implementation-N.diff` contains
the filtered result with paths relative to the project root; large diffs can still be expensive to
review and to use for commit-message generation. The diff and temporary `review-N-round-M.md`
reports are removed when the step completes. `step-N.md` and any `step-result-N.md` remain as durable task
artifacts; step completion is recorded in `state.json`.

### Tree navigation

`/tree` changes the conversation branch but does not roll task artifacts or project code back. The extension blocks it in task sessions by default. Set `allowTreeNavigation: true` to remove this block; all branches still share the latest artifacts and state. `/task status` shows the setting.
