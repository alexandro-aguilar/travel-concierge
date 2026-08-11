# ADR-0006: Explicit approval and simulated booking

## Status

Accepted — 2026-08-10

## Context

Recommendations may lead users to believe an external booking will occur. The MVP must demonstrate human-in-the-loop control without payments or reservations.

## Decision

Enter `AWAITING_APPROVAL` only after persisting a complete recommendation. `POST /sessions/{sessionId}/approve` must contain an explicit affirmative approval and succeeds only from that state. A conditional state update makes the operation idempotent and invokes a simulation-only booking service, which returns `simulation: true` and a `DEMO-` confirmation ID. Every UI and API response labels the result as simulated.

## Consequences

- No provider booking, payment, or reservation endpoint is implemented.
- Approval intent is auditable and cannot be inferred from casual conversational text alone.
- Attempts to approve stale, failed, or already completed trips return a mapped conflict response.

## Alternatives considered

- Treating “book it” as approval: rejected because explicit API/UI confirmation is required.
- Integrating real booking: rejected as outside MVP scope.

## References

- [SDD-003](../specs/003-approval-and-observability.md)
