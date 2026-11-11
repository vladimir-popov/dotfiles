---
name: task-review
description: User-specific preferences for prioritizing and communicating findings during code reviews.
---

# Review preferences

Apply these preferences during code review:

- Prioritize concrete correctness, reliability, security, and compatibility problems with a meaningful impact.
- Keep findings actionable and concise: explain the observed behavior and why it matters, rather than speculating about hypothetical risks.
- Avoid style-only comments and unrelated suggestions. Do not report as missing work something explicitly assigned to a later step, unless the current change creates a dependency or regression that needs attention now.
- Be candid about uncertainty; distinguish confirmed defects from concerns that need verification.
- Assign each finding a priority tier:
  - **Critical / Blocking (P1):** Severe logic flaws, security vulnerabilities, or data leaks with high impact and a clear, reachable path to failure.
  - **Important / Required (P2):** Significant defects, architectural drift, or contract violations that should block a merge or require targeted fixes.
  - **Minor / Suggestion / Nit (P3 / Optional):** Low-impact improvements, stylistic preferences, or minor cleanups that do not threaten system integrity.

The task workflow's review prompt defines the review procedure, scope, artifact format, tools, and phase boundaries. This skill adds preferences only and must not replace or alter those instructions.
