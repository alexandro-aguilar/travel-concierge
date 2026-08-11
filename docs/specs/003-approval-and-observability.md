# SDD-003: Approval, simulated booking, and observability

## Document Control

| Field | Value |
| --- | --- |
| Title | Approval, simulated booking, and observability |
| Status | Draft |
| Owner | Travel Concierge team |
| Reviewers | Product, security, and platform reviewers |
| Created / last updated | 2026-08-10 |
| Related ADR | [0006](../adr/0006-simulated-booking-approval.md), [0007](../adr/0007-observability.md) |
| Target phase | 7–8 |

## 1. Overview

### Problem statement

Users must control any booking-like operation, and operators need a safe way to understand a multi-agent workflow and its degraded results.

### Goals

- Require an explicit, state-valid approval before creating a clearly simulated confirmation.
- Produce correlated logs, metrics, and traces for requests, tool calls, provider calls, and model usage.

### Non-goals

- Payments, real reservations, or provider booking APIs.
- Logging raw messages, credentials, headers, provider payloads, or unrestricted prompts.

## 2. Requirements and workflow

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-1 | Await approval | Complete recommendation is persisted before transition to `AWAITING_APPROVAL`. |
| FR-2 | Explicit confirmation | `POST /sessions/{id}/approve` accepts `{ approval: true }` only; it rejects other input/state. |
| FR-3 | Simulate only | Success returns `{ status: "confirmed", simulation: true, confirmationId: "DEMO-..." }`. |
| FR-4 | Idempotent transition | Repeated approval returns the persisted simulated result or a documented conflict, never a second booking. |
| FR-5 | Trace workflow | Request, session, agent/tool status, duration, provider failure category, and model token usage when available are recorded safely. |

```text
RECOMMENDATION_READY → AWAITING_APPROVAL → SIMULATED_BOOKING_COMPLETE
                  └──────── failed/invalid action → explicit error
```

The command handler validates the request then conditionally changes state. Only the simulation service can create the confirmation ID. UI and response copy must use “simulated booking” / “simulation” rather than “reservation” or “ticket issued.”

## 3. API and error design

| Method/path | Request | Success | Error behavior |
| --- | --- | --- | --- |
| `POST /sessions/{id}/approve` | `{ "approval": true }` | simulated confirmation plus trip state | `400` invalid body; `404` session; `409` wrong/stale state; `500` safe internal error |

The endpoint must not infer confirmation from a free-form message. Each error response uses `{ code, message, requestId }`; messages disclose no stack, provider, or secret detail.

## 4. Observability and reliability

| Signal | Required fields/name | Purpose |
| --- | --- | --- |
| Structured log | `requestId`, `sessionId`, `agent`, `tool`, `durationMs`, `status` | correlate workflow work |
| Metric | recommendation completeness, provider failures, approval attempts/outcomes, workflow latency | monitor quality/reliability |
| Trace span | `concierge.orchestration`, `provider.*`, `optimizer`, `repository.*`, `booking.simulation` | locate latency/failures |
| Model usage | model ID and token counts if exposed | cost/capacity visibility |

Redaction is enforced before logging. Optional provider failure generates a degraded-result log/metric, while an essential-provider failure moves the trip to `FAILED` with a recoverable user message. Approval persistence uses conditional writes so retries do not duplicate effects.

## 5. Testing, infrastructure, and rollout

| Level | Scenarios | Doubles/environment |
| --- | --- | --- |
| Unit | approval schema, valid transitions, confirmation format, telemetry sanitization | repository and clock/ID fakes |
| Agent/API | recommendation prompt, invalid approval, duplicate request, simulated result labels | model/provider mocks |
| Integration | conditional DynamoDB transition and trace/log emission | LocalStack/telemetry exporter double |

Terraform adds least-privilege DynamoDB update/read rights, CloudWatch logging, and tracing export permissions. Roll out in mock mode, first validating invalid/duplicate approvals and log redaction; alert on workflow failures, elevated provider timeouts, and approval transition conflicts.

## Definition of done

- [ ] Explicit approval and state constraints are covered by automated tests.
- [ ] No code path invokes payments or real booking providers.
- [ ] Every result is visibly and structurally marked `simulation: true`.
- [ ] Logs/traces are correlated and redaction tests pass.
