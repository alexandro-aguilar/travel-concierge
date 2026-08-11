# Software Design Document (SDD) Template

> Use this template to describe a feature or increment of the Travel Concierge
> application. Replace text in `[brackets]`, remove sections that do not apply,
> and link to the relevant implementation, tests, and Terraform changes.

## Document Control

| Field | Value |
| --- | --- |
| Title | `[Feature or increment name]` |
| Status | `Draft \| In review \| Approved \| Superseded` |
| Owner | `[Name or team]` |
| Reviewers | `[Names or roles]` |
| Created | `[YYYY-MM-DD]` |
| Last updated | `[YYYY-MM-DD]` |
| Related issue/ADR | `[Link]` |
| Target phase | `[1–9]` |

## 1. Overview

### Problem Statement

`[Describe the user or system problem and why it matters.]`

### Goals

- `[Measurable outcome]`
- `[Measurable outcome]`

### Non-Goals

- `[Explicitly excluded scope]`
- Real purchases, payments, or reservations are out of scope; booking flows are simulated.

### User Experience

`[Describe the user journey, including messages, recommendation presentation, and any approval step.]`

## 2. Requirements

### Functional Requirements

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-1 | `[Requirement]` | `[Observable result]` |
| FR-2 | `[Requirement]` | `[Observable result]` |

### Non-Functional Requirements

| Area | Requirement | Approach / metric |
| --- | --- | --- |
| Performance | `[Latency/concurrency expectation]` | `[How measured]` |
| Reliability | `[Failure behavior]` | `[Timeout/retry/fallback]` |
| Security | `[Data/permission requirement]` | `[Control]` |
| Observability | `[Logs, metrics, traces]` | `[Fields/dashboard/alert]` |

### Assumptions and Open Questions

| Item | Type | Owner | Resolution / due date |
| --- | --- | --- | --- |
| `[Question or assumption]` | `Assumption \| Open question \| Risk` | `[Owner]` | `[Answer/date]` |

## 3. Architecture and Boundaries

### System Context

```text
React + Vite Web Client
        │ HTTPS
        ▼
API Gateway → Lambda / Travel Concierge (Strands) → Amazon Bedrock
        │                    │
        │                    ├── Flight Agent → Amadeus
        │                    ├── Hotel Agent  → Amadeus
        │                    ├── Event Agent  → Ticketmaster
        │                    └── Weather Tool → Open-Meteo
        ▼
 DynamoDB (sessions and trip state)
```

`[Explain which components this change affects and which remain unchanged.]`

### Component Responsibilities

| Component | Responsibility | Inputs / outputs | Change? |
| --- | --- | --- | --- |
| Web client | Conversation, trip summary, approval action | `[Contracts]` | `[Yes/No]` |
| API Gateway + Lambda | HTTP boundary and request orchestration | `[Contracts]` | `[Yes/No]` |
| Concierge Agent | Intent, requirement collection, orchestration | `[Contracts]` | `[Yes/No]` |
| Specialized agent/tool | `[Single responsibility]` | `[Typed contracts]` | `[Yes/No]` |
| Trip Optimizer | Deterministic filtering/costing plus recommendation | `[Typed inputs/output]` | `[Yes/No]` |
| Provider adapter | Normalize external responses | `[Provider ↔ domain]` | `[Yes/No]` |
| Repository | Persist normalized session/trip state | `[Entities]` | `[Yes/No]` |

### Dependency Rules

- Domain code must not directly depend on Strands, Bedrock, provider SDKs, or DynamoDB.
- Provider and persistence access must be behind injectable interfaces/adapters.
- Agent and tool boundaries use typed, runtime-validated inputs and outputs.
- Use TypeScript application code for arithmetic, dates, currency, and hard constraints; use LLMs for interpretation, planning, ranking ambiguous choices, and explanation.

## 4. Domain and Data Design

### Domain Model Changes

| Model | Purpose | Fields / invariants | Validation |
| --- | --- | --- | --- |
| `TripRequirements` | User travel constraints | `[origin, destination, dates, travelers, budget, preferences]` | `Zod schema` |
| `[Model]` | `[Purpose]` | `[Fields and invariants]` | `[Schema]` |

### Example Contract

```ts
export interface [Name] {
  // [Use strict, explicit TypeScript types.]
}
```

### Persistence Design

| Record | Key pattern | Contents | Lifecycle |
| --- | --- | --- | --- |
| Session metadata | `PK: SESSION#{sessionId}; SK: METADATA` | `[Metadata]` | `[Creation/retention]` |
| Message | `PK: SESSION#{sessionId}; SK: MESSAGE#{timestamp}` | `[Normalized message]` | `[Creation/retention]` |
| Trip | `PK: SESSION#{sessionId}; SK: TRIP` | `[Requirements, selections, state]` | `[Updates]` |

Do not persist raw third-party API responses or secrets.

## 5. Workflow and Agent Design

### State Transitions

```text
COLLECTING_REQUIREMENTS
        ↓
SEARCHING → OPTIMIZING → RECOMMENDATION_READY → AWAITING_APPROVAL
                                                      ↓
                                      SIMULATED_BOOKING_COMPLETE

Any state → FAILED
```

`[Specify valid transitions, recovery behavior, and who owns each state update.]`

### Orchestration

1. `[Collect and validate requirements.]`
2. `[Run independent searches concurrently.]`
3. `[Normalize results and calculate deterministic costs.]`
4. `[Optimize and explain the recommendation.]`
5. `[Persist state and require explicit approval before a simulated booking.]`

### Agent/Tool Contracts

| Name | Type | Input | Output | Failure behavior |
| --- | --- | --- | --- | --- |
| `[searchFlights]` | `Tool` | `[FlightSearchInput]` | `[FlightOption[]]` | `[Mapped provider error/partial result]` |
| `[Agent name]` | `Agent` | `[Typed request]` | `[Typed response]` | `[Fallback]` |

### Concurrency and Timeouts

`[Identify independent calls (for example flights, hotels, and events) and how Promise-based concurrency, bounded concurrency, timeouts, retries, and cancellation are applied.]`

## 6. API Design

| Method and path | Purpose | Request | Response | Auth/error behavior |
| --- | --- | --- | --- | --- |
| `POST /sessions` | Create a conversation | `[Schema]` | `[Schema]` | `[Behavior]` |
| `POST /sessions/{sessionId}/messages` | Submit a user message | `[Schema]` | `[Schema]` | `[Behavior]` |
| `GET /sessions/{sessionId}` | Retrieve session | — | `[Schema]` | `[Behavior]` |
| `GET /sessions/{sessionId}/trip` | Retrieve trip state | — | `[Schema]` | `[Behavior]` |
| `POST /sessions/{sessionId}/approve` | Approve a simulated booking | `[Schema]` | `[Schema]` | `[Behavior]` |

`[Add or remove endpoints. Include example JSON payloads for any changed contract.]`

## 7. External Integrations

| Provider | Capability | Adapter/interface | Configuration | Mock strategy |
| --- | --- | --- | --- | --- |
| Amadeus | Flights and hotels | `[Provider interface]` | `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET` | `[Mock behavior]` |
| Ticketmaster | Events | `[Provider interface]` | `TICKETMASTER_API_KEY` | `[Mock behavior]` |
| Open-Meteo | Weather | `[Provider interface]` | `[If needed]` | `[Mock behavior]` |
| Bedrock | Model invocation through Strands | `[Model client]` | `BEDROCK_MODEL_ID` | `[Test boundary]` |

Document provider limits, response normalization, retry policy, and behavior when an optional integration is unavailable. Verify current official documentation before implementing an integration.

## 8. Infrastructure, Security, and Configuration

### Terraform Changes

| Resource/change | Purpose | Least-privilege/security considerations |
| --- | --- | --- |
| `[Terraform module/resource]` | `[Purpose]` | `[Permissions, encryption, networking, tags]` |

### Configuration and Secrets

- Local: `.env` with `.env.example` containing placeholders only.
- Deployed: AWS Secrets Manager; never commit or log credentials.
- `[List new configuration names and their owners.]`

### Security Review

- `[Validate external and HTTP input with Zod.]`
- `[Confirm IAM permissions are restricted to required Bedrock, DynamoDB, Secrets Manager, CloudWatch, and tracing actions.]`
- `[Confirm authorization headers, secrets, and provider responses are not logged.]`

## 9. Reliability and Observability

### Error Handling

| Failure | User-visible behavior | System behavior |
| --- | --- | --- |
| Provider timeout/rate limit | `[Message or partial recommendation]` | `[Timeout, backoff, mapping]` |
| Optional provider unavailable | `[Continue without it]` | `[Log/metric]` |
| Essential provider unavailable | `[No complete recommendation]` | `[Recovery]` |

### Telemetry

Every request should include `requestId`, `sessionId`, `agent`, `tool`, `durationMs`, and `status` in structured logs. Add the following design-specific telemetry:

| Signal | Name / fields | Purpose |
| --- | --- | --- |
| Log | `[Event]` | `[Diagnosis]` |
| Metric | `[Name]` | `[Monitoring]` |
| Trace span | `[Name]` | `[Workflow visibility]` |

`[Include model token usage when the provider exposes it.]`

## 10. Testing and Rollout

### Test Plan

| Level | Scenarios | Test doubles / environment |
| --- | --- | --- |
| Unit | `[Schemas, adapters, calculations, scoring]` | `[Mocks]` |
| Agent | `[Missing data, budget breach, approval, partial results]` | `[Mock providers]` |
| Integration | `[API → Lambda → DynamoDB/provider/Bedrock boundary]` | `[LocalStack/mocks]` |

Tests must not depend on live third-party APIs. Default local development to `PROVIDER_MODE=mock`.

### Rollout Plan

1. `[Implementation slice / feature flag.]`
2. `[Validation in local and deployed environments.]`
3. `[Monitoring and rollback trigger.]`

### Definition of Done

- [ ] Requirements and non-goals approved.
- [ ] Typed models and Zod validation implemented at untrusted boundaries.
- [ ] Domain logic remains independent from framework/provider details.
- [ ] Deterministic calculations and hard-constraint filtering are covered by tests.
- [ ] Provider failures produce the documented fallback behavior.
- [ ] Terraform, IAM, secret, and configuration changes are reviewed.
- [ ] Logs, metrics, and traces cover the new workflow.
- [ ] The feature works with mock providers and automated tests pass.
- [ ] Simulated booking is clearly identified as simulated and requires explicit approval.

## 11. Alternatives and Decision Record

| Option | Benefits | Drawbacks | Decision |
| --- | --- | --- | --- |
| `[Option A]` | `[Benefits]` | `[Drawbacks]` | `[Chosen/rejected and why]` |
| `[Option B]` | `[Benefits]` | `[Drawbacks]` | `[Chosen/rejected and why]` |

## 12. References

- [Travel Concierge development handoff](../TRAVEL_CONCIERGE_HANDOFF.md)
- `[API documentation]`
- `[Terraform module or plan]`
- `[Issue, ADR, or design review]`
