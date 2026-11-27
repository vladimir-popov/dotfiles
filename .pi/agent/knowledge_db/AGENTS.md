# Knowledge base rules

- Write knowledge base articles and index entries in English, regardless of the conversation
  language. Preserve the original language of direct quotations when it matters to the evidence.
- Apply [the shared knowledge criteria](knowledge-criteria.md) when evaluating claims and sources.
  For Git sources in this base, always include the repository identity.

## Project hierarchy

The root contains projects, which may contain nested subprojects. Organize them by logical
relationships. Repository layout can inform the hierarchy. Each project and subproject has
`architecture/` and `domain/`. Add other thematic directories when the knowledge warrants them.

## Navigation

Maintain an `index.md` at the root, in every project and subproject, and in each thematic directory.
Use concise descriptions and relative links to articles and child directories. Keep indexes
focused on navigation so readers can load only the relevant material.

In the root index, list each known local Git repository root next to the relative link to its
project index. Use absolute paths or home-relative paths beginning with `~/`. Include separate
clones and worktrees as additional roots when applicable. Start with this index to map a local
repository to its project, then follow the project, subproject, and thematic indexes.

## Knowledge placement

Organize knowledge by project scope first and by topic second. State the scope of applicability
when it is unclear.

- Store knowledge specific to a subproject in that subproject.
- Use `architecture/` for technical decisions and their rationale, component responsibilities and
  interactions, technical contracts, implementation behavior, constraints, and trade-offs.
- Use `domain/` for terminology, business entities and their relationships, rules, invariants and
  exceptions, processes, and lifecycles. Keep domain rules distinct from implementation details.
- Use `development/` for build, verification, and engineering practices where applicable.
- Store shared knowledge at the nearest common parent scope to which it applies. Keep one
  canonical location for each claim and link to it from relevant subprojects.
- Update affected indexes and links when moving documents.

### Local rules for this base

- Use service or subsystem subprojects where the KB contains knowledge specific to them. Use the
  repository paths listed in subproject indexes to find the relevant scope.
- If service-specific knowledge has no matching subproject, propose creating one and wait for
  approval before placing the knowledge. Do not place such knowledge at the parent scope as a
  fallback.

## Writing articles

Write concise, technically precise explanations around coherent topics. Explain relationships,
decision rationale, constraints, and consequences where the evidence supports them. Apply the
same evidence standard to explanatory connections as to individual claims. Use headings, lists,
tables, diagrams, or code examples where they clarify the topic. Choose the structure and length
that suit the material.

## Approval for changes

Get explicit approval before changing the meaning or applicability of existing knowledge,
removing it, changing the project or subproject hierarchy, or changing organizational rules.

Judge a change by its effect on meaning and applicability. An addition, exception, or
qualification that changes either requires approval even when the existing wording stays
intact. An independently verified observation or implementation deviation may be added
within the requested scope if it preserves the meaning and applicability of existing knowledge.

An explicit request for a specific restricted change supplies its approval. General requests to
update, review, or consolidate the KB leave individual restricted changes subject to approval.
All applicable evidence requirements still apply.

Within an authorized task, adding verified knowledge, extending explanations without changing
their meaning, merging duplicates without losing information or evidence, reorganizing affected
articles or thematic directories while preserving meaning and evidence, and fixing navigation
require no additional approval.
