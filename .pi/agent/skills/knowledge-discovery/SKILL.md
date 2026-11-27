---
name: knowledge-discovery
description: Investigate a user-selected topic from a project or subproject to discover durable, evidence-backed knowledge. Use for guided exploration of domain behavior, architecture, service contracts, or any other user-defined project question.
---

# Knowledge Discovery

Run one guided, read-only investigation. Take the project or subproject and topic from the user's
request and context. Ask for clarification if either is materially unclear. Keep all investigation
work read-only, including source code, the knowledge base (KB), and other files. Read tests as
evidence. Run actions only when they are known to be read-only. Work sequentially in the current
session without subagents or parallel investigation. Keep the plan and findings in session context
without creating artifacts or persistent investigation state.

## 1. Orient

Start from the project, subproject, or path the user identifies. Resolve relative paths from the
current working directory. If the user gives no explicit entry point, start from the current
working directory. Use nearby build files such as `build.sbt`, module definitions, and directory
layout to identify the entry project's boundaries. If a build file covers multiple projects, use
its module definitions and layout to locate the relevant subproject. Ask for clarification if the
investigation target remains ambiguous.

Use `~/.pi/agent/knowledge_db/` as the KB root. Read the applicable KB rules and start at its root
`index.md`. When the index maps projects by repository path, expand home-relative paths and use the
enclosing Git root to locate the relevant KB project. If the target is clear but unmapped, continue
and state the limit on your comparison with the KB.

Follow project, subproject, and thematic indexes to read relevant knowledge. Identify established
ground, material gaps, and explanations worth refining. Verify findings against primary sources.
Read `~/.pi/agent/knowledge_db/knowledge-criteria.md` for the shared selection and evidence rules.

Load the strategies relevant to the requested topic. Combine them where useful.

- For business scenarios, entities, or rules, read [Domain](references/domain.md).
- For internal structure and runtime flows, read [Architecture](references/architecture.md).
- For interaction semantics and cross-system guarantees, read [Contracts](references/contracts.md).

Adapt the general workflow to questions outside these strategies.

## 2. Plan

Choose a small set of lines of inquiry that can yield a useful, coherent increment. Aim for at most
three substantive lines in one pass. Proceed without routine plan approval. If coverage is sparse,
build an overview first. If the KB already provides one, use it as a starting point for deeper
inquiry. Prioritize gaps, refinements, exceptions, and harder scenarios or relationships. Revisit
known ground only for a concrete reason, such as verifying a discrepancy or establishing context
for a deeper finding.

## 3. Explore

Search for relevant symbols, scenarios, and boundaries, and read only the relevant parts of large
files. Follow a connection into related services, libraries, tests, or documentation when it helps
answer the original question. Trace transitive dependencies only when the topic requires it. Move on
when another layer of detail is unlikely to yield a meaningful finding or strengthen essential
evidence. Defer new standalone topics and reserve enough context to synthesize the findings.

## 4. Extract and screen

Explain behavior, rules, constraints, guarantees, and relationships in a self-contained account.
Apply the shared criteria and collect the required evidence. Keep open questions and hypotheses
clearly separate from established findings. Screen out code paraphrases and material the KB already
covers unless the investigation adds something meaningful. Check possible contradictions or stale
KB entries against available evidence and surface them in the report.

## 5. Stop and report

Stop with a coherent, evidenced increment when further work would mostly add detail, require a
separate inquiry, or risk disproportionate effort or loss of context. Stop when the KB already
covers the topic adequately and the investigation finds no meaningful additions. State limitations
if the investigation ends before the result is sufficiently supported or complete within its scope.

Reply with ordinary Markdown in the current session. Include findings and meaningful additions to
existing knowledge, with supporting references. Where relevant, describe KB discrepancies, research
limitations or missing evidence, and promising follow-up topics. Organize the response around the
findings, without a fixed report template or proposed KB document structure.
