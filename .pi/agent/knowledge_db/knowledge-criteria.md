# Knowledge criteria

Apply this policy when looking for project knowledge, deciding what to report as an established
finding, or evaluating what can be recorded in the knowledge base (KB).

## Knowledge selection

### Mandatory requirements

Knowledge must satisfy all of the following requirements:

- **Reliability:** supported by sufficient evidence.
- **Self-containedness:** understandable outside the context in which it was discovered.
- **Project relevance:** describes the project, its domain, environment, requirements, or
  constraints.

Hypotheses, unresolved questions, speculative explanations, and unverified conclusions do not
qualify as established knowledge.

### Indicators of value

Evaluate knowledge according to the following characteristics:

- **Reusability:** useful beyond the original task.
- **Durability:** likely to remain relevant over time.
- **Non-obviousness:** difficult to discover through superficial examination of the project.
- **Cost of rediscovery:** requires substantial investigation, experimentation, or communication to
  rediscover.
- **Significance:** overlooking it may lead to incorrect decisions or implementation errors.

These are indicators of value, not individually mandatory requirements.

Prefer knowledge that reduces the cost or risk of future work.

Avoid including information that can be trivially recovered from source code or existing
documentation, unless awareness of its existence is itself important.

## Evidence and traceability

Every substantive claim must be supported by references to its primary sources.

Distinguish between different kinds of evidence:

- Source code establishes implemented behavior.
- Tests establish tested expectations.
- Authoritative documentation establishes documented contracts and requirements.
- Explicit statements from responsible project stakeholders establish communicated requirements and
  decisions.
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

Ensure that the referenced commit actually contains the examined code. Never attribute uncommitted
changes to the current HEAD.

For source code outside Git, provide the file path and relevant line range, together with any
available version information.

### Other sources

Reference original documents, specifications, issues, discussions, messages, or experiment records
as appropriate.

Preserve relevant conditions and limitations of the evidence.

Place references close to the claims they support.

A historical source establishes the provenance of knowledge, not necessarily its current validity.

### Source availability and stability

Primary sources must be sufficiently stable and accessible to the intended readers of the knowledge
base.

If a candidate relies exclusively on uncommitted changes, defer its inclusion as knowledge until
a verifiable source becomes available.

Knowledge discovered through uncommitted changes may still qualify if independently supported by
other sufficient primary sources. Ensure that the claim does not extend beyond what those sources
establish.

A local commit is not necessarily a sufficient reference if it is inaccessible to the intended
readers.

Do not commit, push, or otherwise publish source changes merely to establish a reference.
