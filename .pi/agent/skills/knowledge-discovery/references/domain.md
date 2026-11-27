# Domain discovery

Recover the business concepts, rules, and processes that explain the requested behavior across
technical boundaries. Start with relevant integration and end-to-end tests, which often express
expected behavior through recognizable scenarios. If those tests are unavailable or unhelpful,
start with domain documentation, unit tests, or implementation entry points.

1. Find and group scenarios by the business operation and outcome. Compare preconditions, actions,
   and expected results across successful, alternative, and exceptional paths.
2. Identify the entities involved, their relationships and lifecycles, and which conditions permit
   an operation or trigger a state transition. Look for invariants, eligibility rules, and business
   constraints that explain why outcomes differ.
3. Check the implementation to verify hypotheses, clarify conditions, and fill coverage gaps. Follow
   the relevant scenario across service boundaries and identify who owns each domain decision or
   transition when the evidence establishes it.

Tests establish expectations under their conditions. Check how the implementation actually behaves,
especially outside the tested path. Treat fixture values as examples unless further evidence
establishes a constraint. Require broader support before generalizing from a single scenario.
