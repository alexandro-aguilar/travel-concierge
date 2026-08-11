# ADR-0005: DynamoDB session and trip state

## Status

Accepted — 2026-08-10

## Context

The concierge needs durable conversation context, trip requirements, recommendation state, and simulated-booking results across stateless Lambda invocations.

## Decision

Persist normalized records in DynamoDB under `PK = SESSION#{sessionId}` with `SK = METADATA`, `MESSAGE#{timestamp}#{messageId}`, and `TRIP`. The trip record contains requirements, selected options, recommendation, workflow state, and simulated-booking result. Repository ports encapsulate conditional writes and optimistic state transitions. Do not persist raw provider responses, prompts containing secrets, authorization headers, or credentials. Sessions are anonymous initially and all normalized records receive an `expiresAt` DynamoDB TTL attribute, with a configurable 30-day default. User messages are trimmed and limited to 4,000 characters.

## Consequences

- Session retrieval is a single partition query.
- Conditional updates prevent duplicate approvals and invalid state transitions.
- Terraform enables DynamoDB TTL with a 30-day default; encryption uses DynamoDB's managed default.

## Alternatives considered

- In-memory conversation state: rejected because Lambda invocations are stateless.
- Separate tables per record type: rejected because the access patterns are session-centered.

## References

- [SDD-001](../specs/001-foundation-and-session-api.md)
