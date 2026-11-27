# Architecture discovery

Build a top-down mental model of how the system is organized and how it executes the relevant work.
Start with project overviews, design records, runtime entry points, or composition and configuration
that reveal which components are actually wired together.

1. Establish the service's purpose and responsibilities, then identify the components that carry
   those responsibilities and the boundaries around them.
2. Follow dependency direction and one or more representative control and data flows. Read the
   implementation or tests at meaningful handoffs, including how state is owned and managed and how
   components coordinate.
3. Explain the mechanisms, constraints, and trade-offs that materially affect the flow, such as
   execution ordering, state transitions, or recovery responsibilities. Use design records or other
   primary evidence for the rationale behind decisions.

Use classes, packages, modules, and technologies to locate evidence and explain relationships. A
catalog of them cannot explain how the system works. Keep verified design rationale distinct from
consequences that follow from the implementation.

Strongly prefer inline UML diagrams in Mermaid when they clarify an architectural finding. Use
sequence diagrams for interactions, class diagrams for structural relationships, and state diagrams
for lifecycles. Show only the elements and relationships relevant to the finding and supported by
the evidence.
