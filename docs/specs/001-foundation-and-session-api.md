# SDD-001: Foundation and session API

## Document Control

| Field | Value |
| --- | --- |
| Title | Foundation and session API |
| Status | Draft |
| Owner | Travel Concierge team |
| Reviewers | Architecture, platform, and security reviewers |
| Created / last updated | 2026-08-10 |
| Related ADR | [0001](../adr/0001-serverless-lambda-slices.md), [0005](../adr/0005-dynamodb-session-state.md), [0008](../adr/0008-terraform-and-secrets.md) |
| Target phase | 1 and 6 |

## 1. Overview

### Problem statement

The concierge needs a safe, typed HTTP and persistence foundation before agent/provider work can be introduced. Users need a durable session in which their messages and evolving trip can be retrieved.

### Goals

- Create and retrieve a session and its normalized trip state through native API Gateway/Lambda handlers.
- Validate every HTTP request with Zod and return stable, documented errors.
- Persist session metadata, messages, and trip state without raw provider data.

### Non-goals

- Search, recommendation generation, and approval behavior (specified separately).
- Authentication/identity design; callers remain anonymous until an approved auth design exists.

### User experience

The client creates a session, sends messages, and can reload the session/trip after any interruption. Until a later workflow phase runs, a message response reports `COLLECTING_REQUIREMENTS`.

## 2. Requirements

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-1 | Create a session | `POST /sessions` returns a generated `sessionId`, timestamp, and `COLLECTING_REQUIREMENTS`. |
| FR-2 | Accept a message | `POST /sessions/{sessionId}/messages` validates a non-empty bounded message, persists it, and returns current status/trip. |
| FR-3 | Read session/trip | `GET /sessions/{sessionId}` and `/trip` return normalized records or `404`. |
| FR-4 | Validate input/state | Malformed JSON/schema input is `400`; unsupported state operations are `409`; internal details never reach responses. |

| Area | Requirement | Approach / metric |
| --- | --- | --- |
| Performance | Reads/writes are bounded single-session operations | One DynamoDB partition query or item operation per endpoint where possible. |
| Reliability | Writes do not create invalid state | Repository conditional writes and explicit state transition validator. |
| Security | Untrusted body/path input is validated | Zod at handler boundary; no secrets/raw bodies in logs. |
| Observability | Every request is correlated | Structured fields required by ADR-0007. |

Open question: select session TTL/retention and authentication before production; owner: platform/security review.

## 3. Architecture and boundaries

Each endpoint capability is a Lambda-owned vertical slice: native handler → command/query handler → domain port → DynamoDB adapter. Its composition root binds only local interfaces with Inversify. Domain models do not import AWS, Lambda, or DynamoDB types.

| Component | Responsibility | Change |
| --- | --- | --- |
| API handlers | Parse/validate request and map errors | Yes |
| Session command/query handlers | Create, append, and retrieve normalized state | Yes |
| Session repository port/adapter | Persistence and conditional writes | Yes |
| DynamoDB | Durable session partition | Yes |

## 4. Domain and data design

`TripState` begins as `COLLECTING_REQUIREMENTS` and may hold partial requirements. Valid states are `COLLECTING_REQUIREMENTS`, `SEARCHING`, `OPTIMIZING`, `RECOMMENDATION_READY`, `AWAITING_APPROVAL`, `SIMULATED_BOOKING_COMPLETE`, and `FAILED`.

| Record | Key pattern | Contents |
| --- | --- | --- |
| Metadata | `SESSION#{id}` / `METADATA` | version, created/updated timestamps, state |
| Message | `SESSION#{id}` / `MESSAGE#{timestamp}#{id}` | role, bounded content, timestamp |
| Trip | `SESSION#{id}` / `TRIP` | partial requirements, selections, recommendation, approval/result |

Use ISO-8601 timestamps, opaque generated IDs, a record version, and conditional updates. Never store raw provider response data or secrets.

## 5. API design

| Method/path | Request | Success response | Errors |
| --- | --- | --- | --- |
| `POST /sessions` | none | `{ sessionId, status, createdAt }` | `500` |
| `POST /sessions/{id}/messages` | `{ message: string }` | `{ sessionId, message, trip, status }` | `400`, `404`, `409` |
| `GET /sessions/{id}` | — | metadata and normalized messages | `404` |
| `GET /sessions/{id}/trip` | — | normalized trip state | `404` |

`message` must be trimmed and bounded (exact maximum to be set with UX/security review); an empty value is invalid. Error bodies are `{ code: string, message: string, requestId: string }` and never include stacks/provider payloads.

## 6. Infrastructure, testing, and rollout

Terraform provisions the API routes, Lambda roles, DynamoDB table, logging/tracing, and config/secrets references. Roles are capability-specific. `.env.example` exposes placeholders and defaults `PROVIDER_MODE=mock`.

| Level | Scenarios | Doubles/environment |
| --- | --- | --- |
| Unit | schemas, state transitions, error mapping, repository command/query behavior | repository fake/mocks |
| Integration | handler → Lambda adapter → DynamoDB contract | LocalStack or DynamoDB adapter test double |

TDD rule: add a failing test before every Lambda behavior change, implement minimally, then refactor green. Roll out first with a feature route in a non-production environment; monitor validation failures, conditional-write conflicts, and error rate before enabling clients.

## Definition of done

- [ ] All endpoints have Zod schemas and request/error contract tests.
- [ ] Session records conform to the stated key patterns and state validation.
- [ ] Lambda composition roots are local and use Inversify.
- [ ] Terraform/IAM and secret configuration are reviewed.
- [ ] Unit and integration tests run without live providers.
