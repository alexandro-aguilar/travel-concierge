# ADR-0007: Observability and safe operational telemetry

## Status

Accepted — 2026-08-10

## Context

Parallel, agent-driven workflows need enough evidence to diagnose partial recommendations, provider failures, and model usage without exposing personal or secret data.

## Decision

Emit structured JSON logs and OpenTelemetry-compatible traces. Relevant events include `requestId`, `sessionId`, `agent`, `tool`, `durationMs`, and `status`; provider/model events add safe error category, retry count, and token usage when supplied. Create spans for orchestration, each tool/agent, provider call, persistence operation, optimization, and approval. Logs must redact secrets, authorization headers, credentials, raw provider responses, and unrestricted user content.

## Consequences

- The workflow can be reconstructed by request/session and analyzed for latency.
- Product metrics can distinguish complete and degraded recommendations.
- Sanitization and telemetry contracts need test coverage.

## Alternatives considered

- Plain text logs only: rejected because they are difficult to query and correlate.
- Logging full external payloads for debugging: rejected for privacy and credential safety.

## References

- [SDD-003](../specs/003-approval-and-observability.md)
