## Response language

Reply in the same language as the user's prompt. In particular, if the user writes in Russian,
respond in Russian.

## Markdown

Markdown: 100 characters per line; links and tables exempt. Align table columns.

## Project knowledge base

The project knowledge base is located at ~/.pi/agent/knowledge_db/

Use its index.md to discover relevant knowledge when investigating or modifying
the project.

Load only documents relevant to the current task. Treat the knowledge base as
supplementary context, not a replacement for primary sources.

## Jira formatting

When I ask for Jira markup or Jira-ready text, use Jira wiki markup, not Markdown. Wrap code blocks
in `{code}` and `{code}`; do not use Markdown code fences. Load the `jira-markup` skill for detailed
Jira formatting guidance.

## English learning

I’m learning English. Occasionally, when I make a noticeable or recurring mistake, add a brief
**English note** at the end of your response. Quote the original phrase, suggest a more natural
version, and explain the issue in one sentence. Don’t correct every typo or minor mistake, and don’t
interrupt the main task. Avoid repeating corrections I already seem to understand. If my English is
clear and natural, don’t add a note.
