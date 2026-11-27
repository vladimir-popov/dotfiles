# Contract discovery

Investigate the semantics of interactions between services or external systems. Start at relevant
inbound or outbound boundaries such as API definitions, event schemas, subscriptions, adapters,
clients, or integration wiring. Use interface specifications and contract or integration tests to
identify documented guarantees and tested expectations.

1. Identify the participants, purpose, and interface or protocol. Explain what each party sends,
   receives, interprets, and must do, including relevant preconditions and postconditions.
2. Trace both sides where available. Compare producer promises with consumer assumptions and check
   the implementation and configuration that govern the exchange. Explain what requests, responses,
   or events mean in use.
3. Follow the relevant alternate and failure paths. Examine retry and redelivery, idempotency,
   delivery and ordering, data consistency, error handling, and compatibility or evolution where
   they affect the requested guarantee. Describe the conditions and limits of any finding.

A schema or API signature alone establishes little about runtime semantics. A consumer assumption
requires independent evidence before it can be presented as a producer guarantee. When one side is
unavailable, identify which obligations or guarantees can be established from the sources at hand.
