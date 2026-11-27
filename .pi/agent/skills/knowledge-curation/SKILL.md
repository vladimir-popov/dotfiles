---
name: knowledge-curation
description: Curate a human-readable project knowledge base by extracting, validating, consolidating, and organizing durable knowledge. Use when asked to preserve investigation findings in the knowledge base, update architectural or domain knowledge after a review, or consolidate existing project knowledge.
---

# Knowledge Curation

Use this skill only when the user explicitly asks to create, update, or consolidate a knowledge
base (KB). Preserve durable project knowledge that helps readers make decisions or avoid
rediscovery. Complement existing code and documentation.

## 1. Establish scope

Use `~/.pi/agent/knowledge_db/` as the KB root. Read its
[`AGENTS.md`](../../knowledge_db/AGENTS.md) when present and any applicable local instructions.
Use the [shared knowledge criteria](../../knowledge_db/knowledge-criteria.md) for selection,
evidence, and source stability.

If the KB does not exist, agree on the initial project hierarchy and organizational rules with
the user before creating its root `AGENTS.md`, required directories, and indexes.
For an existing base, work within its established organization.

Use the project the user specifies. Otherwise, identify the local Git roots of files in the
source materials, falling back to the current directory's Git root only if the materials
identify none. Match the roots against the root index after expanding `~/` paths. Select the
project only if every detected root maps unambiguously to the same project. Ask the user when
no root is found, a mapping is absent or ambiguous, the roots map to different projects, or the
scope or destination is otherwise unclear.

Read the provided materials and follow the relevant project, subproject, and thematic indexes
to find the knowledge affected by the request.

## 2. Select and verify candidates

Extract candidates from the provided materials, including working sessions, or from existing
knowledge in scope. Apply the shared criteria. Retain verified, reusable findings from
experiments and failed approaches when valuable. Omit task history, temporary decisions,
implementation attempts, and incidental observations that add no durable knowledge.

Check each claim against primary sources. Investigate only as needed to verify the claim,
recover precise references, resolve ambiguity, and establish scope and conditions. Ask the user
when their input could resolve a significant uncertainty. Reject candidates with insufficient
support. If stable, accessible evidence is missing or verification needs a separate investigation,
defer the candidate and report the unresolved question or missing evidence. Keep deferred
candidates out of the KB and any separate pending collection.

## 3. Consolidate

Compare verified candidates with the existing knowledge they affect. Plan additions for new
knowledge, integrate compatible refinements into the relevant explanation, and merge duplicates
while preserving their information and evidence. Link to the canonical location.

Draw the conclusions needed to integrate candidates or consolidate the entries in scope.
Do not search for unrelated discrepancies or derive independent findings from existing entries.

When claims differ, examine both sets of evidence. Check for different scopes, conditions,
or a deviation between documented intent and implementation before proposing a revision.

- If context explains the discrepancy, preserve each supported claim with its verified scope.
- If implementation differs from a documented contract, retain the contract and document the
  observed deviation or exception separately with its conditions and evidence. Establish any
  change to the contract independently. Attribute causes or characterize deviations only when
  supported by evidence.
- If existing knowledge is incorrect or obsolete, propose a revision with evidence. If the
  contradiction remains unresolved, retain the existing entries and report the discrepancy.

## 4. Apply changes

Follow the [approval rules in `AGENTS.md`](../../knowledge_db/AGENTS.md#approval-for-changes).

For any restricted change awaiting approval, present the affected knowledge or structure,
proposed change, rationale, and supporting references. Proceed with independent changes that
are already authorized.

Create or reorganize articles and thematic directories as needed within scope. Preserve existing
knowledge and references during reorganization. Before moving, merging, or splitting articles,
find incoming references and update affected indexes and links, including those outside the
immediate area. Limit edits outside that area to link and navigation fixes. Propose broader
reorganization as a separate task.

## 5. Verify and report

Check that changed articles are coherent, correctly placed, and supported by accurate, stable,
accessible references that resolve. Check that the edits preserve knowledge and evidence, keep
contracts distinct from observed behavior, maintain navigation, and respect scope and approvals.

Briefly report additions, refinements, consolidations, and significant organizational changes,
with links to affected articles. Include noteworthy rejections, deferred candidates and missing
evidence, unresolved discrepancies, proposals awaiting approval, and significant opportunities
for separate reorganization when relevant. Return this report to the user outside the KB.
