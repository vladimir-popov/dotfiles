---
name: knowledge-reflection
description: Compare existing entries within a specified project knowledge base directory
  to derive a useful new conclusion, explain a discrepancy, or identify a specific open question.
---

# Knowledge Reflection

Run one read-only pass over a directory in the project knowledge base (KB). Investigate
sequentially in the current session without subagents. Return the result in chat.

## 1. Explore candidate connections

Use `~/.pi/agent/knowledge_db/` as the KB root. Start at the `index.md` of the directory
specified by the user. Include its nested sections. Read applicable KB rules and use
`knowledge-criteria.md` at the KB root for knowledge selection and evidence.

Use the indexes to identify promising groups of entries. Look for overlapping guarantees,
shared constraints, or claims that describe different parts of the same process. Read
selectively and consider other connections as useful before choosing one to examine in
detail. Prioritize implications that could change how someone understands the system
or makes an engineering decision.

On repeated passes, use the current session and any reflection history provided to avoid
reexamining connections already investigated. Revisit a connection when you know of a
material change to its underlying claims or relevant evidence. Connections identified but
deferred before investigation remain eligible.

## 2. Evaluate the connection

Identify the claims that lead to the candidate finding and compare their conditions
and scope. Check the relevant KB entries where the implication would naturally be
documented. Treat a finding as already known when the KB captures the same implication
under the same conditions. A meaningful exception or a newly established limit on the
scope of a guarantee can be a finding in its own right.

Distinguish what follows logically from the cited claims from what requires further
evidence. For example, a per-entity ordering guarantee alone leaves subscription-wide
ordering undetermined. A claim about the actual ordering of subscription events
requires evidence about how the subscription processes events across entities.

Use targeted primary sources, such as code, tests, or contracts, when they can establish
the actual behavior or explain a discrepancy. Primary sources can lie outside the selected
KB directory. If resolving the issue would require a separate investigation, state what
remains unknown and formulate the question that would resolve it.

Discard trivial or already documented candidates and those with no meaningful basis in
the claims examined. A discrepancy or gap can be worth reporting when the cited claims
raise a specific question with a practical consequence. If a candidate yields no
substantive result, consider another promising connection within the same pass.

Keep exploration selective. Stop when you have one substantive result or when the
indexes and entries reviewed offer no promising direction without substantially
broadening the search.

## 3. Report

Return one substantive result. Link to the KB entries you compared, explain the practical
implication, and cite any primary sources used. For each material claim, make clear what
follows from the KB entries, what primary sources establish, and what remains open.
A single result may include both an established implication and a related open question.
If the pass yields no substantive result, briefly describe the area reviewed.

When it would help a later pass, briefly note other connections examined or deferred.
Identify the entries involved and record why the connection was set aside or what made
it worth revisiting. Include only notes that would prevent repeated work or help resume
a promising line of inquiry.

When useful, offer to run `knowledge-curation` to preserve a verified finding or
`knowledge-discovery` to investigate a specific open question. Wait for the user's request
before starting either workflow.
