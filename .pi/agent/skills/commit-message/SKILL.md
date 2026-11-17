---
name: commit-message
description: Draft or edit Git commit messages from a diff or change summary. Use whenever asked to prepare, improve, or review a commit title or description, including requests outside the /commit command.
---

# Draft commit messages

Write the title and description in English. Keep the title concise, specific, and preferably imperative. Explain the substantive changes and their purpose in the description using short paragraphs or bullets.

Draft the description as continuous prose or bullets without manual line breaks,
then wrap it at word boundaries, filling lines as close to 70 characters as
practical. Each description line must contain no more than 70 characters,
excluding the line break. Prefer 55–70 characters for non-final lines; avoid
short fragments, isolated words, and breaks inside hyphenated terms. If a line
is under 45 characters and is not the final line, reflow or rephrase it with
adjacent text. After wrapping, check every line's character count and reread
the description for natural flow. Do not return it until it meets both the
length and readability requirements. The limit does not apply to the title. The limit does not apply to the title.

Do not indent title and description lines, including wrapped lines.

Describe only changes supported by the supplied or inspected diff and relevant context. Mention behavior changes and tests only when supported by evidence. Do not invent motivation, implementation details, checks, or outcomes. Avoid duplicating information between the title and description.

Return only the proposed title and description unless the user asks for additional explanation. Do not create a commit or modify files unless explicitly requested.
