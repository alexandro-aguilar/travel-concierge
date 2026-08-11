# SDD-002: Search, normalization, and deterministic optimization

## Document Control

| Field | Value |
| --- | --- |
| Title | Search, normalization, and deterministic optimization |
| Status | Draft |
| Owner | Travel Concierge team |
| Reviewers | Architecture and provider-integration reviewers |
| Created / last updated | 2026-08-10 |
| Related ADR | [0002](../adr/0002-orchestrated-strands-workflow.md), [0003](../adr/0003-provider-ports-and-mocks.md), [0004](../adr/0004-deterministic-optimization.md) |
| Target phase | 2–5 |

## 1. Overview

### Problem statement

Natural-language requests must become trustworthy travel recommendations even when optional sources fail. Provider-specific data must not leak into the recommendation or domain logic.

### Goals

- Extract/validate requirements, concurrently retrieve normalized choices, and present an itemized recommendation.
- Enforce dates, traveler count, currency/budget, direct-flight, and hotel-rating hard constraints deterministically.
- Demonstrate a Strands/Bedrock orchestrator with typed tool/agent boundaries and mock-first execution.

### Non-goals

- Real booking/payment and currency conversion without an approved exchange-rate source.
- Guaranteed availability, prices, or weather outside provider forecast coverage.

## 2. Requirements

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-1 | Build requirements | Zod validates origin, destination, chronological dates, travelers, budget, and preferences; missing required fields cause a conversational prompt. |
| FR-2 | Search providers | Flights/hotels/events start concurrently after valid requirements; weather is attempted when dates are forecastable. |
| FR-3 | Normalize results | Each adapter returns typed options, never raw SDK/provider payloads. |
| FR-4 | Optimize | Infeasible combinations are rejected, feasible alternatives scored, and selected cost/budget delta computed in TypeScript. |
| FR-5 | Degrade safely | Events/weather failure yields a labeled partial result; unavailable flights or hotels prevents a complete recommendation. |

| Area | Requirement | Approach / metric |
| --- | --- | --- |
| Performance | Independent searches are parallel and bounded | `Promise.allSettled` with per-provider timeout and bounded retries. |
| Reliability | Retry only transient failures | Exponential backoff; rate-limit/provider errors map to categories. |
| Security | Provider data is untrusted | Validate adapter boundary; redact logs; secrets only through config port. |
| Observability | Search fan-out is visible | Span/log per agent/tool/provider including duration and outcome. |

Open questions: scoring weights and a currency conversion service require product decisions; until then, accept only a single recommendation currency or return a clear unsupported-currency result.

## 3. Architecture and workflow

```text
message → Concierge (Strands/Bedrock) → requirements validation
                                      ├─ flight port → Amadeus/mock
                                      ├─ hotel port  → Amadeus/mock
                                      └─ event port  → Ticketmaster/mock
                                              ↓ all settled
                                    weather port → Open-Meteo/mock
                                              ↓
                           deterministic optimizer → typed recommendation
                                              ↓
                         Concierge explanation → persisted trip state
```

The concierge decides what to ask and when to invoke tools. Flight, hotel, event, weather, and optimizer agents/tools own a single capability. Provider SDKs stay behind Lambda-local adapters. Start as a single fully tested concierge workflow against mocks; only then extract the specialized collaborators while preserving the contracts.

## 4. Domain and contracts

`TripRequirements` has origin/destination, departure/return dates, travelers, `Money` budget, and preferences. Dates are calendar dates in the trip destination context; departure must precede return; travelers are positive integers. Define Zod schemas for every HTTP, model/tool, provider, and persistence boundary.

| Contract | Required normalized fields |
| --- | --- |
| Flight option | id, airline, origin, destination, departure/arrival, stops, per-trip price |
| Hotel option | id, name, rating, location, total price |
| Event option | id, name, date, venue, category, estimated price |
| Weather | date, conditions, min/max C, precipitation probability; unavailable is explicit |
| Recommendation | selected options, itemized total, budget, remaining/overage, tradeoffs, completeness |

The optimizer filters direct flights when requested, minimum hotel rating when specified, invalid date options, and any combination over budget. A configurable score ranks feasible combinations using budget compliance, flight convenience, hotel quality/location, interests, and weather suitability. The LLM receives calculated facts and may explain them; it does not calculate or amend them.

## 5. Integration design

| Provider | Port | Required failure behavior | Mock |
| --- | --- | --- | --- |
| Amadeus | `FlightProvider`, `HotelProvider` | Essential; mapped error blocks complete recommendation | deterministic options/empty/timeout/rate limit |
| Ticketmaster | `EventProvider` | Optional; continue without events | ranked interest fixtures/failure |
| Open-Meteo | `WeatherProvider` | Optional; unavailable outside forecast window | available/unavailable fixture |
| Bedrock/Strands | `ConciergeModel` boundary | return safe workflow failure, no raw model data | scripted responses/tool calls |

Live adapters use documented official APIs only after current documentation review. Provider configuration is `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `TICKETMASTER_API_KEY`, and `BEDROCK_MODEL_ID`; local mode defaults to mocks.

## 6. Testing and rollout

| Level | Scenarios | Doubles |
| --- | --- | --- |
| Unit | schemas, date/budget arithmetic, filtering, scoring, error mapping | providers and model mocked |
| Agent | missing fields, complete request, budget breach, direct-flight preference, partial event/weather result | scripted agent/model and provider fakes |
| Integration | Lambda boundary and persistence of normalized recommendation | LocalStack/mocks |

Implement in TDD slices: tests for a failing requirement/constraint first, minimal code, then refactor. Verify concurrent search behavior rather than only result values. Release behind mock mode first; enable live adapters independently after credentials, provider limits, timeouts, and degraded behavior are verified.

## Definition of done

- [ ] Typed, Zod-validated contracts cover every boundary.
- [ ] Mock workflow demonstrates all core searches with no credentials.
- [ ] Essential/optional failure behavior matches this SDD.
- [ ] Optimizer pricing and hard constraints have deterministic unit tests.
- [ ] Concurrent calls, retries/timeouts, and telemetry are tested.
