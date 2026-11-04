---
name: ticket
description: Investigate a proposed software task in the current codebase, discuss open decisions and a proposed Definition of Done with the user, and draft an English Jira ticket description. Use for /ticket requests and when the user asks for a Jira-ready task draft without creating the issue.
---

# Draft a Jira ticket

Treat the user's initial description as the starting point for an investigation, not as a complete specification. Your deliverable is a Jira-ready task description in English. Do not create or update a Jira issue, commit code, or modify project files unless separately asked.

## Investigate before drafting

1. Read the user's account of the problem, candidate solutions, and code locations. Identify the behavior to change, affected users or systems, constraints, and proposed direction. Preserve distinctions between facts, hypotheses, and preferences.
2. Inspect the current project. Read relevant project instructions, locate the named code and its callers, trace the relevant behavior, and examine nearby tests and documentation. Search narrowly first, then follow dependencies as needed. Use code findings to confirm or correct the initial account. Do not claim that code proves product intent.
3. Compare plausible options when more than one exists. Explain the tradeoffs that actually matter for this task. Prefer the user's stated choice when it is sound; if evidence points elsewhere, explain why and ask before treating a different choice as decided.
4. Ask the user focused questions about decisions, requirements, or context that the code cannot establish and that materially affect the ticket. Group related questions. State what you found and why each answer matters. Continue independent investigation while waiting. Do not ask for facts that can be read from the project.
5. Propose an initial Definition of Done based on the user's goals and the code findings. Present it as a proposal, explain any consequential assumptions, and ask the user to confirm or revise it. Do not treat inferred acceptance criteria as agreed requirements.
6. After the material questions and Definition of Done are discussed, draft the ticket. If a remaining uncertainty is minor, state a narrow assumption in the draft. If it changes scope or acceptance criteria, ask rather than inventing an answer.

## Jira description

Write the final ticket body in English, as connected prose that a teammate can understand without this conversation. Begin with the problem: the current behavior, its concrete trigger, and its impact. Then, if there are meaningful alternatives, briefly explain them and why the chosen approach is preferable. Describe the proposed solution at the level of behavior, interfaces, data flow, and key implementation points; avoid prescribing incidental code structure.

Use Jira wiki markup by default (`h2.` headings, `*` bullets, and `[label|URL]` links). When a diagram genuinely clarifies the task, write it in Mermaid. Use the project's supported Mermaid markup if rendering is verified. Otherwise, include the Mermaid source in a Jira `{code:language=mermaid}` block (or a `mermaid` fenced block when the target accepts Markdown), without claiming that Jira will render it. Omit diagrams that merely restate the prose.

Refer to relevant code with precise file and line references. If the project has a root `.gitlab-ci.yml`, inspect its Git remotes (starting with `origin`) and derive the GitLab project URL from the remote's host and repository path. Normalize SSH remotes such as `git@<host>:<group>/<project>.git` and HTTPS remotes to `https://<host>/<group>/<project>`; never infer the project URL from links to other repositories in the project files. For committed code, use GitLab file or line permalinks with a full commit SHA, such as `<project-url>/-/blob/<commit-sha>/<path>#L42` (or `#L42-48` for a range). Encode URL paths as needed and verify that the referenced file and lines exist at that commit. The CI file alone does not establish the project URL. For projects outside GitLab, uncommitted code, or an unverifiable or ambiguous remote, use absolute local file paths with line numbers instead. Do not include a long inventory of files. Do not invent links, line numbers, behavior, tests, or outcomes.

End with `h2. Definition of Done`, using the criteria discussed with the user. List observable, testable conditions that establish the intended behavior, including important edge cases. Include test, documentation, migration, and rollout conditions only when they follow from the actual task and have been discussed. Do not replace acceptance criteria with vague items such as "code is clean" or "tests pass" alone.

Return the draft as a single copyable ticket body. Keep commentary and unresolved questions outside the final ticket body. If the user asks for a revision, update the same draft using the new answers and code evidence.
