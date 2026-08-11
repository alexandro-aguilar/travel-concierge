# ADR-0003: Provider ports, normalized models, and mock-first development

## Status

Accepted — 2026-08-10

## Context

Amadeus, Ticketmaster, Open-Meteo, and Bedrock have different availability, rate limits, failure modes, and response structures. Tests and local demonstrations must work without credentials or live APIs.

## Decision

Each Lambda declares its own domain-facing provider ports and adapter implementations. Provider adapters validate and normalize external responses before returning typed domain models; raw provider payloads never cross the adapter boundary or enter persistence. Local development defaults to `PROVIDER_MODE=mock`, with deterministic mock adapters that support success, empty, timeout, rate-limit, and unavailable scenarios. Live adapters use bounded timeouts, exponential-backoff retries only for retryable failures, and mapped errors.

## Consequences

- Tests have no live-provider dependency and can cover failure behavior precisely.
- Real provider replacements are localized to infrastructure adapters.
- Adapter code is deliberately duplicated between Lambda owners where a boundary is needed.

## Alternatives considered

- Passing provider SDK responses through the workflow: rejected because it couples domain logic and risks logging/persisting sensitive data.
- Live APIs as the default local mode: rejected for cost, reliability, and reproducibility.

## References

- [SDD-002](../specs/002-search-and-optimization.md)
