---
name: commit-message
description: Draft or edit Git commit messages from a diff or change summary. Use whenever asked to prepare, improve, or review a commit title or description, including requests outside the /commit command.
---

# Draft commit messages

Write the title and description in English. Keep the title concise, specific, and preferably imperative. Explain the substantive changes and their purpose in the description using short paragraphs or bullets.

Before returning the message, check the character count of every description line. Each line must contain no more than 70 characters, excluding the line break. If any line is too long, rewrap it at a sensible word boundary without changing the meaning, then check all lines again. Do not return the message until every description line passes this check. The limit does not apply to the title.

Describe only changes supported by the supplied or inspected diff and relevant context. Mention behavior changes and tests only when supported by evidence. Do not invent motivation, implementation details, checks, or outcomes. Avoid duplicating information between the title and description.

Return only the proposed title and description unless the user asks for additional explanation. Do not create a commit or modify files unless explicitly requested.
