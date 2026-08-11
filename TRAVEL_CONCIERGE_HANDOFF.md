# Travel Concierge Agent — Development Handoff

## 1. Project Overview

Build an agentic **Travel Concierge** application using **Strands Agents** and Amazon Bedrock.

The application should allow a user to describe a trip conversationally, for example:

> "I want to travel from Mexico City to London from September 12 to September 18 for two people. My total budget is $35,000 MXN. I prefer direct flights and I'd like to attend at least one interesting event."

The system should autonomously:

1. Understand the user's travel requirements.
2. Identify missing information.
3. Search for flights.
4. Search for hotels.
5. Search for events and activities.
6. Retrieve weather forecasts when available.
7. Evaluate options against the user's constraints.
8. Build an optimized itinerary.
9. Estimate the total cost.
10. Explain the recommendation.
11. Ask for user approval before any action that would represent a booking.

Real purchases or bookings are **out of scope for the MVP**.

The objective is to demonstrate an actual agentic workflow rather than a chatbot that simply generates travel recommendations.

---

## 2. Primary Goals

The project should demonstrate:

- Strands Agents
- Amazon Bedrock
- TypeScript
- Tool calling
- Multi-agent orchestration
- Parallel tool/agent execution
- Structured outputs
- Agent handoffs
- Persistent conversation/trip state
- Constraint-based reasoning
- Human-in-the-loop approval
- Error handling and retries
- Observability
- Serverless AWS architecture

The system should favor deterministic application logic for calculations and validation while using agents for reasoning, planning, selection, and explanation.

---

## 3. Technology Stack

Use **TypeScript** across the entire project.

Recommended stack:

- Node.js 24+
- TypeScript
- Strands Agents SDK for TypeScript
- Amazon Bedrock
- AWS Lambda
- Amazon API Gateway
- Amazon DynamoDB
- AWS Secrets Manager
- Terraform
- React + Vite
- Vitest or Jest
- ESLint
- Prettier

Avoid introducing Python unless there is a hard technical requirement that cannot reasonably be solved in TypeScript.

---

## 4. Suggested Architecture

```text
┌──────────────────────────┐
│        Web Client        │
│      React + Vite        │
└────────────┬─────────────┘
             │
             │ HTTPS
             ▼
┌──────────────────────────┐
│       API Gateway        │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│         Lambda           │
│                          │
│  Travel Concierge Agent  │
│       (Strands)          │
└────────────┬─────────────┘
             │
     ┌───────┼───────────────┐
     │       │               │
     ▼       ▼               ▼
 Flight   Hotel          Event
 Agent    Agent          Agent
     │       │               │
     ▼       ▼               ▼
        External APIs
     │       │               │
     └───────┼───────────────┘
             │
             ▼
       Trip Optimizer
             │
             ▼
        Amazon Bedrock

Additional services:

DynamoDB
    └── sessions / trip state

CloudWatch
    └── logs / metrics

AWS X-Ray / OpenTelemetry
    └── distributed tracing
```

Infrastructure must be defined using **Terraform**.

Keep infrastructure and application code clearly separated.

---

## 5. Agent Architecture

Use an orchestrator-based architecture.

### Travel Concierge Agent

The main agent owns the conversation.

Responsibilities:

- Interpret user intent.
- Extract travel constraints.
- Determine missing required information.
- Delegate work to specialized agents/tools.
- Coordinate parallel searches.
- Send results to the Trip Optimizer.
- Present recommendations.
- Maintain conversational context.
- Request approval before simulated booking actions.

The orchestrator should NOT directly implement integrations with external travel APIs.

---

## 6. Trip Requirements Model

Convert natural-language requests into a structured object.

Example:

```json
{
  "origin": {
    "city": "Mexico City",
    "iataCode": "MEX"
  },
  "destination": {
    "city": "London",
    "iataCodes": ["LHR", "LGW"]
  },
  "departureDate": "2026-09-12",
  "returnDate": "2026-09-18",
  "travelers": 2,
  "budget": {
    "amount": 35000,
    "currency": "MXN"
  },
  "preferences": {
    "directFlights": true,
    "hotelMinimumRating": 4,
    "interests": [
      "music",
      "history",
      "food"
    ]
  }
}
```

Represent domain models with TypeScript interfaces or types and validate runtime inputs with a schema validation library such as Zod.

Example:

```ts
export interface Money {
  amount: number;
  currency: string;
}

export interface TripRequirements {
  origin: {
    city: string;
    iataCode?: string;
  };
  destination: {
    city: string;
    iataCodes?: string[];
  };
  departureDate: string;
  returnDate: string;
  travelers: number;
  budget: Money;
  preferences: {
    directFlights?: boolean;
    hotelMinimumRating?: number;
    interests?: string[];
  };
}
```

Use typed models for all agent/tool boundaries.

Avoid passing arbitrary objects between agents when a typed schema can be defined.

---

## 7. Flight Agent

The Flight Agent searches and evaluates flight options.

Integration:

**Amadeus Self-Service APIs**

Responsibilities:

- Resolve airports when necessary.
- Search flight offers.
- Normalize results.
- Rank options.
- Respect constraints such as:
  - departure dates
  - number of travelers
  - direct flights
  - maximum budget
  - preferred schedules

Return a structured response.

Example:

```json
{
  "options": [
    {
      "id": "flight-001",
      "airline": "Example Airline",
      "origin": "MEX",
      "destination": "LHR",
      "departure": "2026-09-12T20:00:00",
      "arrival": "2026-09-13T13:30:00",
      "stops": 0,
      "price": {
        "amount": 14200,
        "currency": "MXN"
      }
    }
  ]
}
```

Do not expose raw Amadeus responses to other agents.

Create an adapter that converts provider responses into domain models.

---

## 8. Hotel Agent

Use the Amadeus hotel APIs where supported by the development environment.

Responsibilities:

- Search destination hotels.
- Filter based on dates and number of guests.
- Normalize pricing.
- Rank hotels according to:
  - price
  - rating
  - location
  - user preferences

Return normalized hotel options.

Example:

```json
{
  "options": [
    {
      "id": "hotel-001",
      "name": "Example Hotel",
      "rating": 4.4,
      "location": "Westminster",
      "totalPrice": {
        "amount": 12800,
        "currency": "MXN"
      }
    }
  ]
}
```

---

## 9. Event Agent

Integration:

**Ticketmaster Discovery API**

Responsibilities:

- Search events at the destination.
- Restrict results to the travel dates.
- Consider the user's interests.
- Return relevant:
  - concerts
  - sports
  - theater
  - cultural events

The agent should rank events based on user preferences rather than simply returning the first API results.

Example:

```json
{
  "events": [
    {
      "id": "event-001",
      "name": "Example Concert",
      "date": "2026-09-14",
      "venue": "Example Arena",
      "category": "music",
      "estimatedPrice": {
        "amount": 1500,
        "currency": "MXN"
      }
    }
  ]
}
```

---

## 10. Weather Tool

Integration:

**Open-Meteo**

Weather should initially be implemented as a tool rather than a separate autonomous agent.

Responsibilities:

- Retrieve weather information for the destination and relevant dates when forecast data is available.
- Normalize weather information.
- Make it available to the Trip Optimizer.

Example:

```json
{
  "date": "2026-09-14",
  "conditions": "rain",
  "temperatureMinC": 13,
  "temperatureMaxC": 18,
  "precipitationProbability": 80
}
```

The system must gracefully handle dates outside the available forecast window.

Do not hallucinate weather for future dates where forecasts are unavailable.

---

## 11. Trip Optimizer Agent

This agent receives normalized results from all search agents.

Inputs:

- Trip requirements
- Flight options
- Hotel options
- Events
- Weather
- Budget

Responsibilities:

- Compare combinations.
- Reject combinations exceeding hard constraints.
- Optimize soft preferences.
- Estimate total cost.
- Identify tradeoffs.
- Produce the recommended itinerary.

Example scoring considerations:

```text
Budget compliance        30%
Flight convenience       25%
Hotel quality/location   20%
User interests           15%
Weather suitability      10%
```

These values should be configurable.

Do not ask the LLM to perform critical monetary arithmetic.

Implement budget calculations deterministically in TypeScript application code.

The optimizer can use calculated values to reason about the best combination.

---

## 12. Parallel Execution

Independent searches should execute concurrently.

Use native Promise-based concurrency where appropriate.

Example:

```ts
const [flights, hotels, events] = await Promise.all([
  flightAgent.search(requirements),
  hotelAgent.search(requirements),
  eventAgent.search(requirements),
]);
```

Conceptually:

```text
                 Trip Requirements
                        │
           ┌────────────┼────────────┐
           │            │            │
           ▼            ▼            ▼
        Flights       Hotels       Events
           │            │            │
           └────────────┼────────────┘
                        │
                     Weather
                        │
                        ▼
                  Trip Optimizer
```

Do not execute flight, hotel, and event searches sequentially unless there is a dependency.

Measure and log execution time for every agent/tool.

---

## 13. Human-in-the-Loop

Any operation representing an external side effect must require explicit approval.

Example:

```text
Agent:

Recommended trip

Flights:      $14,200 MXN
Hotel:        $12,800 MXN
Events:        $2,900 MXN
Transport:     $1,500 MXN
────────────────────────
Estimated:    $31,400 MXN

Budget:       $35,000 MXN
Remaining:     $3,600 MXN

Would you like me to proceed?
```

The user must explicitly approve before invoking a booking-like tool.

For the MVP, booking should be simulated.

Example:

```ts
await simulateBooking(...);
```

Return something similar to:

```json
{
  "status": "confirmed",
  "simulation": true,
  "confirmationId": "DEMO-123456"
}
```

Never imply that a real reservation was created.

---

## 14. Conversation State

Persist sessions in DynamoDB.

Suggested structure:

```text
PK: SESSION#{sessionId}
SK: METADATA

PK: SESSION#{sessionId}
SK: MESSAGE#{timestamp}

PK: SESSION#{sessionId}
SK: TRIP
```

Store:

- user messages
- assistant messages
- extracted trip requirements
- selected options
- recommendation
- approval state
- simulated booking result

Do not store entire provider API responses.

Store normalized domain objects when persistence is necessary.

---

## 15. API

Initial endpoints:

```http
POST /sessions
POST /sessions/{sessionId}/messages
GET  /sessions/{sessionId}
GET  /sessions/{sessionId}/trip
POST /sessions/{sessionId}/approve
```

Example:

```http
POST /sessions/{sessionId}/messages
```

Request:

```json
{
  "message": "I want to visit London for a week in September."
}
```

Response:

```json
{
  "sessionId": "...",
  "message": "...",
  "trip": {},
  "status": "COLLECTING_REQUIREMENTS"
}
```

Possible statuses:

```text
COLLECTING_REQUIREMENTS
SEARCHING
OPTIMIZING
RECOMMENDATION_READY
AWAITING_APPROVAL
SIMULATED_BOOKING_COMPLETE
FAILED
```

---

## 16. Bedrock

Use Amazon Bedrock as the model provider for Strands.

The model ID must be configurable through environment variables.

Example:

```text
BEDROCK_MODEL_ID
```

Do not hardcode a specific model throughout the application.

Centralize model configuration.

---

## 17. External API Configuration

Secrets must never be committed.

Expected environment configuration:

```text
AMADEUS_CLIENT_ID
AMADEUS_CLIENT_SECRET

TICKETMASTER_API_KEY

BEDROCK_MODEL_ID
```

Use AWS Secrets Manager for deployed environments.

Local development may use `.env`.

Provide:

```text
.env.example
```

with placeholder values only.

---

## 18. Tool Design

Tools should:

- Perform one clearly defined operation.
- Have typed inputs.
- Have typed outputs.
- Validate parameters.
- Handle provider errors.
- Implement reasonable timeouts.
- Avoid leaking provider-specific structures into the domain.

Examples:

```text
searchFlights()
searchHotels()
searchEvents()
getWeather()
calculateTripCost()
simulateBooking()
```

Agents should decide **when** tools are required.

Application code should define **how** those operations execute safely.

---

## 19. Error Handling

External APIs can fail.

Implement:

- request timeout
- retry with exponential backoff
- provider error mapping
- rate-limit handling
- structured logging

Agents should be capable of producing partial recommendations.

For example:

```text
Flights     ✓
Hotels      ✓
Events      ✗ Ticketmaster unavailable
Weather     ✓
```

The entire workflow should not fail because one optional integration is unavailable.

Flights and accommodation should be considered essential dependencies for a complete trip recommendation.

---

## 20. Observability

Implement structured logs.

Every request should include:

```text
requestId
sessionId
agent
tool
duration
status
```

Example:

```json
{
  "requestId": "abc",
  "sessionId": "xyz",
  "agent": "flight-agent",
  "tool": "searchFlights",
  "durationMs": 843,
  "status": "success"
}
```

Add tracing using OpenTelemetry and/or AWS X-Ray where practical.

The trace should make agent orchestration visible:

```text
TravelConcierge
 │
 ├── FlightAgent
 │     └── Amadeus
 │
 ├── HotelAgent
 │     └── Amadeus
 │
 ├── EventAgent
 │     └── Ticketmaster
 │
 ├── WeatherTool
 │     └── OpenMeteo
 │
 └── TripOptimizer
       └── Bedrock
```

Capture token usage when exposed by the model provider.

---

## 21. Testing Strategy

Follow TDD where practical.

Use:

```text
Red → Green → Refactor
```

Tests should not depend on live third-party APIs.

Create provider interfaces and mock implementations.

### Unit Tests

Test:

- requirement parsing
- adapters
- currency/budget calculations
- scoring
- validation
- provider error handling

### Agent Tests

Test scenarios such as:

```text
User provides complete requirements.
→ Agent starts search.

User omits travel dates.
→ Agent asks for dates.

Budget is exceeded.
→ Agent proposes alternatives.

Weather unavailable.
→ Agent continues without weather.

Ticketmaster unavailable.
→ Agent still creates a trip.

User says "book it".
→ Agent requests/validates approval.

User approves.
→ simulated booking executes.
```

### Integration Tests

Test:

```text
API Gateway → Lambda
Lambda → DynamoDB
Lambda → mocked provider
Lambda → Bedrock/Strands boundary
```

Prefer Vitest unless there is a strong reason to use Jest.

---

## 22. Local Development

The project must be runnable locally.

Provide commands similar to:

```bash
yarn install
yarn test
yarn lint
yarn dev
```

Use LocalStack where it provides meaningful value for:

- DynamoDB
- supporting AWS resources

External APIs should support two modes:

```text
PROVIDER_MODE=mock
PROVIDER_MODE=live
```

Default local development to:

```text
PROVIDER_MODE=mock
```

This allows the full agentic workflow to be demonstrated without API credentials.

---

## 23. Repository Structure

Suggested structure:

```text
travel-concierge/
│
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── agents/
│   │       │   ├── concierge-agent.ts
│   │       │   ├── flight-agent.ts
│   │       │   ├── hotel-agent.ts
│   │       │   ├── event-agent.ts
│   │       │   └── trip-optimizer-agent.ts
│   │       │
│   │       ├── tools/
│   │       │   ├── search-flights.tool.ts
│   │       │   ├── search-hotels.tool.ts
│   │       │   ├── search-events.tool.ts
│   │       │   ├── get-weather.tool.ts
│   │       │   ├── calculate-trip-cost.tool.ts
│   │       │   └── simulate-booking.tool.ts
│   │       │
│   │       ├── providers/
│   │       │   ├── amadeus/
│   │       │   ├── ticketmaster/
│   │       │   ├── open-meteo/
│   │       │   └── mock/
│   │       │
│   │       ├── domain/
│   │       │   ├── models/
│   │       │   ├── schemas/
│   │       │   └── errors/
│   │       │
│   │       ├── repositories/
│   │       ├── services/
│   │       ├── handlers/
│   │       └── config/
│   │
│   └── web/
│       └── src/
│
├── packages/
│   └── shared/
│
├── infrastructure/
│   └── terraform/
│
├── tests/
│
├── docs/
│
├── docker-compose.yml
├── package.json
├── yarn.lock
├── .env.example
└── README.md
```

Prefer domain boundaries over framework-driven organization when the two conflict.

---

## 24. Engineering Principles

Follow these principles throughout implementation.

### Clean Architecture

Domain logic must not depend directly on:

- Strands
- Bedrock
- Amadeus
- Ticketmaster
- DynamoDB

Use interfaces/adapters where appropriate.

### Dependency Injection

External providers should be injectable.

Example:

```ts
export interface FlightProvider {
  searchFlights(input: FlightSearchInput): Promise<FlightOption[]>;
}

export class AmadeusFlightProvider implements FlightProvider {
  // ...
}

export class MockFlightProvider implements FlightProvider {
  // ...
}
```

This is critical for testing.

### Small Tools

Avoid tools such as:

```text
doEverythingForTrip()
```

Prefer composable operations.

### Deterministic Logic

Use normal TypeScript application code for:

- arithmetic
- date validation
- budget validation
- currency calculations
- hard constraint filtering

Use LLM reasoning for:

- intent interpretation
- preference understanding
- ranking ambiguous choices
- itinerary planning
- explanations

---

## 25. TypeScript Conventions

Use strict TypeScript.

Recommended compiler settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022"
  }
}
```

Prefer:

- `async/await`
- immutable domain values where practical
- explicit return types for public APIs
- interfaces at provider boundaries
- Zod schemas for untrusted input
- `unknown` instead of `any`
- named exports
- small focused modules

Avoid:

- `any`
- large service classes
- static/global mutable state
- provider response types leaking into domain code
- hidden side effects
- unbounded concurrency

---

## 26. Security

Apply least privilege.

The Lambda role should only receive required permissions for:

- Bedrock model invocation
- DynamoDB
- Secrets Manager
- CloudWatch
- tracing

Never log:

- API secrets
- authorization headers
- credentials

Validate all external input.

Treat external API content as untrusted data.

---

## 27. MVP Definition of Done

The MVP is complete when a user can submit:

> "I want to travel from Mexico City to London from September 12 to September 18 for two people. My budget is 35,000 MXN and I prefer direct flights."

And the application can autonomously:

1. Parse the requirements.
2. Persist the trip.
3. Search flights.
4. Search hotels.
5. Search events.
6. Query weather when forecast data exists.
7. Execute independent searches concurrently.
8. Normalize provider responses.
9. Calculate total prices deterministically.
10. Compare options.
11. Generate a recommended itinerary.
12. Explain why it selected those options.
13. Display estimated total cost.
14. Identify whether the recommendation fits the budget.
15. Request explicit approval.
16. Execute a simulated booking after approval.
17. Persist the result.
18. Produce observable logs/traces for the workflow.

All core behavior must have automated tests.

The application must also work entirely with mock providers so a developer can clone the repository and run the demo without external API credentials.

---

## 28. Implementation Order

Implement incrementally.

### Phase 1 — Foundation

Create:

- repository structure
- TypeScript application
- domain models
- Zod schemas
- configuration
- dependency injection
- test framework
- Terraform project

No agents yet.

### Phase 2 — Provider Layer

Implement:

- mock flight provider
- mock hotel provider
- mock event provider
- mock weather provider

Then implement real adapters:

- Amadeus
- Ticketmaster
- Open-Meteo

### Phase 3 — Tools

Expose providers as typed Strands-compatible tools.

Add:

- validation
- retries
- timeouts
- logging

### Phase 4 — Single Agent

Create the Travel Concierge agent.

Validate:

```text
user → requirements → tools → recommendation
```

before introducing multi-agent complexity.

### Phase 5 — Multi-Agent

Extract:

- Flight Agent
- Hotel Agent
- Event Agent
- Trip Optimizer Agent

Implement orchestration and parallel execution.

### Phase 6 — Persistence

Add:

- DynamoDB
- sessions
- messages
- trip state

### Phase 7 — Human Approval

Implement:

```text
recommendation
      ↓
AWAITING_APPROVAL
      ↓
user approval
      ↓
simulateBooking()
```

### Phase 8 — Observability

Add:

- structured logs
- metrics
- traces
- model usage information

### Phase 9 — Frontend

Build a minimal React UI containing:

- conversational interface
- trip summary
- flight recommendation
- hotel recommendation
- events
- estimated budget
- itinerary
- approval action

Prioritize demonstrating the agent workflow over visual complexity.

---

## 29. Important Constraints for Codex

Do not invent undocumented capabilities of Strands, Bedrock, or third-party APIs.

Before implementing an integration, verify the current official API/library documentation.

Do not tightly couple domain logic to the agent framework.

Do not use an LLM where deterministic code is more appropriate.

Do not implement real payments.

Do not claim simulated bookings are real bookings.

Do not commit credentials.

Do not make tests dependent on external services.

Do not implement all agents at once.

Get the complete workflow working with mock providers first, then progressively introduce real integrations.

Use TypeScript for application code, agents, tools, provider adapters, Lambda handlers, infrastructure, shared libraries, and frontend code.

When an architectural decision is unclear, favor:

```text
simplicity
→ testability
→ explicit interfaces
→ observability
→ agent autonomy
```

in that order.

The final result should demonstrate why an agentic architecture is useful rather than simply wrapping API calls in an LLM.
