---
name: knowledge-curation
description: Curate a human-readable project knowledge base by extracting, validating, consolidating, and organizing durable knowledge. Use when asked to preserve investigation findings in the knowledge base, update architectural or domain knowledge after a review, or consolidate existing project knowledge.
---

# Knowledge Curation

## Purpose

Maintain a reliable, structured, human-readable knowledge base about software projects, their architecture, domain, and relevant engineering context.

The knowledge base should help both humans and AI agents develop an accurate mental model of a project, avoid repeated investigations, and make informed decisions.

Its purpose is not to document everything. Preserve knowledge whose absence in future tasks could lead to significant investigation effort or incorrect decisions.

Complement source code and existing documentation rather than reproduce them.

Apply this skill only when the user explicitly expresses an intention to create, update, or consolidate the knowledge base. Discovering valuable knowledge during an ordinary task does not itself authorize changes to the knowledge base.

## Core principles

- Preserve only verified knowledge.
- Maintain traceability to primary sources.
- Organize knowledge by projects, subprojects, and topics.
- Prefer coherent explanations over collections of isolated facts.
- Consolidate knowledge rather than accumulate records.
- Maintain a single canonical location for each piece of knowledge.
- Respect existing knowledge and user-defined organizational rules.
- Require explicit user approval before changing the meaning of or removing existing knowledge.
- Keep changes within the scope of the current curation task.

## Knowledge selection

### Mandatory requirements

Knowledge must satisfy all of the following requirements:

- **Reliability:** supported by sufficient evidence.
- **Self-containment:** understandable outside the context in which it was discovered.
- **Project relevance:** describes the project, its domain, environment, requirements, or constraints.

Do not preserve hypotheses, unresolved questions, speculative explanations, or unverified conclusions.

### Indicators of value

Evaluate knowledge according to the following characteristics:

- **Reusability:** useful beyond the original task.
- **Durability:** likely to remain relevant over time.
- **Non-obviousness:** difficult to discover through superficial examination of the project.
- **Recovery cost:** requires substantial investigation, experimentation, or communication to rediscover.
- **Significance:** overlooking it may lead to incorrect decisions or implementation errors.

These are indicators of value, not individually mandatory requirements.

Prefer knowledge that reduces the cost or risk of future work.

Avoid storing information that can be trivially recovered from source code or existing documentation, unless awareness of its existence is itself important.

## Evidence and traceability

Every substantive claim must be supported by references to its primary sources.

Distinguish between different kinds of evidence:

- Source code establishes implemented behavior.
- Tests establish tested expectations.
- Authoritative documentation establishes documented contracts and requirements.
- Explicit statements from responsible project stakeholders establish communicated requirements and decisions.
- Experiments establish observed behavior under specific conditions.

Do not treat these kinds of evidence as interchangeable.

In particular, implemented behavior does not necessarily establish intended behavior.

### Source code references

When referencing source code in a Git repository, include:

- Repository identity when necessary to resolve the reference.
- File path relative to the repository root.
- Full commit SHA.
- Line number or line range.

Prefer commit-pinned permalinks when available.

Otherwise, use an equivalent textual reference containing the same information.

Ensure that the referenced commit actually contains the examined code. Never attribute uncommitted changes to the current HEAD.

For source code outside Git, provide the file path and relevant line range, together with any available version information.

### Other sources

Reference original documents, specifications, issues, discussions, messages, or experiment records as appropriate.

Preserve relevant conditions and limitations of the evidence.

Place references close to the claims they support.

A historical source establishes the provenance of knowledge, not necessarily its current validity.

### Source availability and stability

Primary sources must be sufficiently stable and accessible to the intended readers of the knowledge base.

If a candidate relies exclusively on uncommitted changes, defer its inclusion until a verifiable source becomes available.

Knowledge discovered through uncommitted changes may still be included if independently supported by other sufficient primary sources. Ensure that the claim does not extend beyond what those sources establish.

A local commit is not necessarily a sufficient reference if it is inaccessible to the intended readers.

Do not commit, push, or otherwise publish source changes merely to establish a reference.

Report deferred candidates and the missing evidence in the completion report. Do not store them in the knowledge base or maintain a separate collection of pending knowledge.

## Knowledge base organization

### Knowledge base location

Use `~/.pi/agent/knowledge_db/` as the root of the knowledge base unless the user explicitly specifies a different root for the task.

### Project hierarchy

The knowledge base root contains project directories.

A project directory may contain subproject directories, recursively forming a hierarchy of logically related projects.

The hierarchy should reflect the logical organization of projects rather than necessarily reproduce the physical structure of their repositories.

Every project and subproject must contain the following thematic directories:

- `architecture/`
- `domain/`

Additional thematic directories may be introduced when justified by the available knowledge.

For example:

```text
knowledge_db/
  AGENTS.md
  index.md
  project-a/
    index.md
    architecture/
      index.md
    domain/
      index.md
    development/
    subproject-b/
      index.md
      architecture/
        index.md
      domain/
        index.md
      integrations/
  project-c/
    index.md
    architecture/
      index.md
    domain/
      index.md
```

The initial project hierarchy is defined by the user.

Adapt the thematic organization as knowledge evolves. Changes to the project and subproject hierarchy require user approval.

### Architecture

The `architecture/` directory contains technical knowledge, including:

- Architectural decisions and their rationale.
- Component responsibilities and interactions.
- Technical contracts and invariants.
- Non-obvious implementation characteristics.
- Technical constraints and trade-offs.

### Domain

The `domain/` directory contains knowledge about the project's problem domain, including:

- Domain concepts and terminology.
- Business entities and their relationships.
- Business rules and invariants.
- Entity lifecycles.
- Business processes and the meaning of operations.
- Exceptions to general rules.

Keep domain knowledge distinct from its technical implementation.

### Knowledge placement

Store knowledge at the most appropriate level of the project hierarchy.

Knowledge shared by multiple subprojects should normally reside in their common parent project.

Knowledge specific to a subproject should reside within that subproject.

Make the scope of applicability explicit when it is not obvious.

Do not duplicate parent-level knowledge in subprojects. Reference the canonical document instead.

### Navigation

Maintain an `index.md` at the knowledge base root, in every project and subproject, and in thematic directories.

Indexes should provide concise descriptions and relative links to relevant documents and child directories.

They should support progressive discovery of knowledge without requiring readers to load the entire knowledge base.

Keep indexes focused on navigation rather than duplicating substantive knowledge.

### Local rules

Respect organizational rules defined in the knowledge base's `AGENTS.md` and applicable local instructions.

These rules may define project boundaries, naming conventions, additional thematic categories, and project-specific requirements.

Do not change organizational rules without user approval.

### Initialization

If the knowledge base does not exist at the selected root, establish the initial project hierarchy and organizational rules with the user before creating it.

Create the required directories, navigation indexes, and root `AGENTS.md`.

If the knowledge base already exists, inspect and respect its current organization.

Do not silently replace an existing organizational model.

## Writing style

Write primarily for human understanding.

Present knowledge as coherent, technically precise explanatory prose. Connect related facts into a meaningful narrative that helps readers understand the subject rather than merely memorize individual statements.

Where supported by evidence, explain:

- How the relevant concepts and components relate to each other.
- Why particular decisions were made.
- What constraints shape the system.
- What consequences follow from its design and behavior.

Do not invent causal relationships, motivations, or explanations to make the narrative more coherent.

Explanatory connections must satisfy the same reliability requirements as individual facts.

Prefer clear, concise prose over exhaustive descriptions.

Use headings, lists, tables, diagrams, and code examples where they improve understanding.

Do not impose a rigid document template or fixed document size.

Organize documents around meaningful topics rather than individual facts, source materials, or completed tasks.

## Curation workflow

### 1. Discovery

Establish the scope of the curation task and locate the knowledge base using the default root or the root specified by the user.

Inspect:

- The provided source materials, if any.
- The relevant project and subproject.
- Applicable knowledge base rules.
- Existing navigation indexes.
- Existing knowledge relevant to the current task.

Use the knowledge base hierarchy to limit unnecessary context loading.

If essential information about the scope or destination is missing, ask the user for clarification.

### 2. Extraction

Identify candidate knowledge from the provided source materials or existing knowledge within the requested scope.

Evaluate candidates against the mandatory requirements and indicators of value.

Distinguish durable project knowledge from task-specific context, temporary decisions, implementation attempts, and incidental observations.

Failed approaches and experiments may contain valuable knowledge. Extract their verified, reusable findings rather than preserve the history of unsuccessful attempts.

Do not preserve information merely because it appears in the source materials.

### 3. Validation

Establish whether each candidate is sufficiently supported by evidence.

Perform targeted investigation when necessary to:

- Verify claims against primary sources.
- Recover precise source references.
- Clarify the scope and conditions of a claim.
- Resolve ambiguities.
- Distinguish observed behavior from intended behavior.

Investigation must remain focused on validating candidate knowledge.

Do not turn curation into an open-ended exploration of the project.

Reject candidates that cannot be sufficiently verified.

Defer candidates that lack sufficiently stable and accessible primary sources, following the source availability and stability requirements.

Ask the user for clarification when their input could resolve a significant uncertainty.

### 4. Consolidation

Compare verified candidate knowledge with relevant existing knowledge.

Determine whether each candidate:

- Introduces new knowledge.
- Complements existing knowledge.
- Refines an existing explanation without changing its meaning.
- Duplicates existing knowledge.
- Reveals a difference in context, applicability, or behavior.
- Contradicts or supersedes existing knowledge.

Integrate compatible knowledge into the existing narrative.

Avoid appending disconnected notes or creating documents that merely summarize individual source materials.

Maintain a single canonical location for each piece of knowledge.

Use cross-references instead of duplicating content.

#### Discrepancies and contradictions

When discrepancies arise, investigate both the existing and new evidence.

Do not automatically assume that newer evidence invalidates existing knowledge. A discrepancy may indicate a regression, a difference in scope, or a distinction between intended and implemented behavior.

When an apparent contradiction can be explained by differences in context or conditions, preserve the relevant knowledge together with its verified scope of applicability.

When implemented behavior differs from a documented contract, preserve the contract and describe the observed deviation separately, including its conditions and supporting evidence.

Document verified exceptions without presenting them as changes to the underlying contract unless such changes are independently established.

Do not characterize deviations as bugs, technical debt, intentional compromises, or other kinds of decisions without supporting evidence.

If incorporating new information changes the meaning or applicability of existing knowledge, follow the approval policy. This applies even when the original wording remains unchanged.

If existing knowledge is established to be incorrect or obsolete, propose its revision with supporting evidence.

If a contradiction cannot be resolved, leave the affected knowledge unchanged and report the issue.

### 5. Update

Apply permitted changes to the knowledge base.

Create, extend, merge, split, or relocate documents and thematic directories when doing so improves organization within the current task's scope.

Preserve existing knowledge, its meaning, and its source references during reorganization.

Restrict reorganization to documents directly affected by the current curation task.

Do not reorganize unrelated documents or neighboring thematic areas merely because an opportunity for improvement has been discovered.

Before relocating, merging, or splitting documents, identify their incoming references within the knowledge base.

Update affected indexes and internal cross-references, including those outside the immediate thematic area when necessary.

Such updates must be limited to maintaining navigational and referential integrity. They do not authorize unrelated content changes or further reorganization.

If broader reorganization would be beneficial, propose it as a separate task rather than applying it.

Follow the approval policy before applying restricted changes.

## Approval policy

The following changes may be applied without additional user approval:

- Adding verified knowledge.
- Extending existing explanations without changing their meaning.
- Consolidating duplicate knowledge without losing information or evidence.
- Reorganizing affected documents and thematic directories without changing the meaning of existing knowledge.
- Updating indexes and internal cross-references.

The following changes require explicit user approval:

- Changing the meaning or applicability of existing knowledge.
- Removing existing knowledge.
- Changing the project or subproject hierarchy.
- Changing knowledge base organizational rules.

An explicit request for a specific restricted change satisfies the approval requirement for that change. All applicable evidence requirements still apply.

A general request to update, review, or consolidate knowledge does not constitute approval of specific semantic changes identified during the task.

Determine whether approval is required based on the semantic effect of the proposed change, not its textual form.

Adding an exception, qualification, or additional explanation requires approval if it changes the meaning or applicability of an existing claim, even when the original text is preserved.

Documenting an independently verified observation or implementation deviation does not require approval when it leaves the meaning and applicability of existing knowledge intact.

For each restricted change not already explicitly authorized by the user, present:

- The affected knowledge or organizational structure.
- The proposed change.
- The reason for the change.
- Supporting evidence and relevant source references.

Do not apply restricted changes that have not been explicitly authorized by the user.

Independent changes that do not require approval may proceed.

## Completion report

After processing the source materials or consolidating existing knowledge, provide a concise report describing:

- New knowledge added.
- Existing knowledge extended or consolidated.
- Significant organizational changes.
- Rejected candidates and reasons for rejection, when noteworthy.
- Deferred candidates and the evidence required for their inclusion.
- Unresolved contradictions.
- Proposed changes awaiting user approval.
- Broader reorganization opportunities, when significant.

Reference affected knowledge base documents where appropriate.

The report is an operational summary, not part of the knowledge base.

## Final checks

Before completing the curation task, verify that:

- All added knowledge is sufficiently supported by evidence.
- Source references are accurate, stable, accessible, and resolvable.
- Knowledge is stored at the appropriate project and thematic level.
- Documents form coherent, human-readable explanations.
- No unsupported interpretations have been introduced.
- Contracts and observed implementation behavior are clearly distinguished.
- No existing knowledge or supporting evidence has been unintentionally lost.
- Reorganization has remained within the current task's scope.
- Affected indexes and internal cross-references are consistent.
- No change requiring approval has been applied without it.

The knowledge base should become more useful and coherent with each curation task, not merely larger.