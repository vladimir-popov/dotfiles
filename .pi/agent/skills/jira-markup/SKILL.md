---
name: jira-markup
description: Format Jira-ready descriptions, comments, and tickets using Jira wiki markup. Use whenever the user asks for Jira markup, Jira-ready text, or formatting content for Jira.
---

# Jira wiki markup

When preparing content intended to be pasted into Jira, use Jira wiki markup rather than Markdown. Return only the requested content unless the user asks for explanation.

## Code

- Wrap every multi-line code block exactly as `{code}` followed by the code, followed by `{code}` on its own line.
- Do not use Markdown triple-backtick fences.
- For a short inline code identifier or command, use Jira's double-curly-brace syntax: `{{identifier}}`.
- Preserve code exactly; do not reformat or alter it unless asked.

Example:

{code}
const result = await run();
{code}

## Common formatting

Use Jira wiki syntax where appropriate:

- Headings: `h1.`, `h2.`, `h3.`
- Bold: `*bold*`
- Italic: `_italic_`
- Monospace: `{{inline code}}`
- Bulleted lists: `* item`
- Numbered lists: `# item`
- Links: `[label|https://example.com]`
- Quotes: `{quote}quoted text{quote}`

Avoid Markdown syntax such as `## heading`, `**bold**`, fenced code blocks, and Markdown link syntax when producing Jira-formatted content. If the user provides a required Jira instance or project-specific syntax, follow that instead of these defaults. Do not claim that Jira markup will render identically across all Jira versions; keep to the requested format.
