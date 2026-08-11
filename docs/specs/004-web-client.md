# SDD-004: Travel Concierge web client

## Document Control

| Field | Value |
| --- | --- |
| Title | Travel Concierge web client |
| Status | Draft |
| Owner | Travel Concierge team |
| Reviewers | Product, accessibility, and API reviewers |
| Created / last updated | 2026-08-10 |
| Related ADR | [0002](../adr/0002-orchestrated-strands-workflow.md), [0006](../adr/0006-simulated-booking-approval.md) |
| Target phase | 9 |

## 1. Overview

### Problem statement

The agent workflow needs a minimal, comprehensible UI that exposes conversational collection, recommendation tradeoffs, partial results, budget, and a safe approval action.

### Goals

- Build a React + Vite client against the documented session API.
- Clearly present itinerary, selected flight/hotel/events, weather availability, itemized costs, budget delta, and workflow status.
- Make simulated booking approval deliberate and accessible.

### Non-goals

- Real payment, booking, account management, or a visual design system beyond MVP needs.
- Reimplementing server-side validation, calculations, or state authority in the browser.

## 2. Requirements

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-1 | Session conversation | Client creates/resumes a session and sends message requests with loading/error state. |
| FR-2 | Recommendation view | Render only normalized API data; show costs, currency, budget remaining/overage, options, and tradeoffs. |
| FR-3 | Degraded results | Clearly identify unavailable optional events/weather and avoid inventing values. |
| FR-4 | Approval | Display approval only in `AWAITING_APPROVAL`; require deliberate confirmation and label outcome simulated. |
| FR-5 | Accessibility | Keyboard operation, semantic controls, status announcements, and non-color-only state/error cues. |

## 3. Architecture and API boundary

The web client is a presentation layer. A typed API client validates response shape defensively and calls `POST /sessions`, message submission, session/trip reads, and approval. The server remains the authority for requirements, state transitions, costs, and recommendation selection. Do not expose provider credentials, Bedrock configuration, or direct provider calls to the browser.

```text
Conversation panel → typed session API client → API Gateway
Trip summary panel ← normalized session/trip response
Approval dialog → explicit approval endpoint → simulated confirmation view
```

## 4. User experience

The initial screen asks for trip details conversationally. When required details are missing, it renders the assistant’s question and retains entered messages. During search/optimization, it exposes a clear in-progress status. A ready recommendation includes itemized cost, budget comparison, selected options, and tradeoffs. Optional provider absences are explicit. The approval control opens a confirmation dialog stating no real reservation/payment will be made. After success, show the `DEMO-` confirmation and `simulation: true` label prominently.

## 5. Reliability, telemetry, and testing

Network errors offer retry/reload without claiming that an action completed. Disable duplicate message/approval submissions while pending; refresh trip state after uncertain network outcomes. Emit privacy-safe client telemetry correlated with the API `requestId` where available; do not send message contents by default.

| Level | Scenarios | Doubles |
| --- | --- | --- |
| Unit | status mapping, cost/partial-result rendering, approval visibility | typed API client fake |
| Component | keyboard dialog, loading/error states, simulation labels | mock server |
| End-to-end | create → message → recommendation → explicit approval | mock API/provider mode |

## Definition of done

- [ ] UI consumes documented normalized contracts only.
- [ ] All states and partial results are understandable without raw provider data.
- [ ] Approval is unavailable outside `AWAITING_APPROVAL` and is visibly simulated.
- [ ] Accessibility and mock-backed tests pass.
