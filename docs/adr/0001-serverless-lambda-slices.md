# ADR-0001: Serverless Lambda slices and dependency direction

## Status

Accepted — 2026-08-10

## Context

The API must run serverlessly while remaining testable and independent of AWS, Strands, Bedrock, HTTP, persistence, and provider SDK details. The project rules additionally prohibit shared application code between Lambdas.

## Decision

Implement each API capability as an independently owned Lambda vertical slice. Each slice has its own handler, Inversify composition root, commands, queries, domain models, ports, adapters, configuration, and tests. Handlers validate HTTP input with Zod and translate expected application errors to explicit responses. Commands change state; queries only read state.

Dependencies point inward: handler and infrastructure adapters depend on application/domain ports, never the reverse. Small duplicate code is preferable to a shared application package.

## Consequences

- Lambda deployment, testing, and ownership remain isolated.
- Dependency injection makes provider and repository doubles straightforward in tests.
- Cross-cutting implementation convenience is intentionally traded for explicit local composition.

## Alternatives considered

- A shared domain/services package: rejected because it violates Lambda isolation and increases coupling.
- An HTTP framework: rejected; native API Gateway/Lambda contracts are sufficient.

## References

- [SDD-001](../specs/001-foundation-and-session-api.md)
- [Travel Concierge handoff](../../TRAVEL_CONCIERGE_HANDOFF.md)
