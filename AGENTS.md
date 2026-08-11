# Travel Concierge — Agent Instructions

## Project Context

Build the Travel Concierge as a TypeScript-first, serverless application. The
authoritative product and architecture requirements are in
[`TRAVEL_CONCIERGE_HANDOFF.md`](TRAVEL_CONCIERGE_HANDOFF.md). Infrastructure is
managed with Terraform.

## Architecture Decision Records

Accepted architecture decisions are recorded in [`docs/adr/`](docs/adr/). Review
the ADRs relevant to a change before making a material architectural decision;
they provide the rationale and constraints behind this project's design.

Keep this file focused on agent workflow, engineering standards, and safety
rules. Keep durable architecture decisions, their context, and alternatives in
ADRs. When a long-lived decision affects multiple components or changes an
accepted architectural direction, add or update an ADR alongside the change.

If guidance conflicts, follow this file for agent workflow and safety,
`TRAVEL_CONCIERGE_HANDOFF.md` for product requirements, and accepted ADRs for
architecture decisions. Escalate an unresolved conflict instead of silently
overriding an accepted decision.

## Non-Negotiable Lambda Engineering Rules

### Test-Driven Development

TDD is required for **every code change** in a Lambda.

1. Write or update a failing automated test that describes the requested behavior.
2. Implement the smallest change that makes the test pass.
3. Refactor while keeping the test suite green.
4. Run the relevant tests before completing the change.

Do not add or modify Lambda production code without corresponding test coverage.
Tests must not require live third-party APIs; use mocks, fakes, or provider test doubles.

### Architecture and Design

- Apply Clean Architecture: domain and application rules must not depend on AWS,
  Lambda runtime types, Strands, Bedrock, provider SDKs, DynamoDB, or HTTP.
- Use vertical slices and screaming architecture. Organize each Lambda around its
  business capability (for example, `sessions`, `trip-recommendation`, or
  `approval`), not generic technical layers alone.
- Keep each slice cohesive: command/query handler, use case, domain models,
  ports, adapters, and tests that serve one capability should be easy to locate.
- Use OOP and SOLID principles. Prefer small, focused classes with explicit
  responsibilities, interfaces at boundaries, and dependency inversion.
- Use dependency injection for Lambda composition. Use `inversify` as the DI
  container; construct and bind dependencies in a Lambda-specific composition
  root.
- Use simple CQRS: separate commands (state-changing operations) from queries
  (read-only operations). Do not introduce event sourcing, a message broker, or
  a complex CQRS framework unless explicitly requested.
- Keep deterministic work in TypeScript code: monetary arithmetic, date and
  budget validation, hard-constraint filtering, and state transitions must not
  be delegated to an LLM.

### Lambda Isolation

- Every Lambda owns its own code. Do **not** create or use shared application,
  domain, handler, service, repository, DI, or utility code between Lambdas.
- Each Lambda has its own composition root, `inversify` bindings, domain-facing
  interfaces, adapters, configuration, and test suite.
- Duplicate a small amount of code when needed to preserve Lambda independence;
  do not introduce a shared package as a convenience abstraction.
- Terraform may define the deployment resources, but Lambda implementation code
  remains independently owned and deployed.

### HTTP Boundary

- Use the native AWS Lambda/API Gateway event and response types, or small
  project-owned adapters.
- Do **not** use HTTP frameworks such as Express, Fastify, NestJS, Hapi, Koa,
  or similar wrappers.
- Parse and validate all untrusted HTTP input with Zod at the boundary.
- Map expected domain/application errors to explicit HTTP responses. Do not leak
  provider error payloads, implementation details, credentials, or stack traces.

## Recommended Slice Layout

Adapt names to the capability while retaining the ownership and dependency
direction below:

```text
apps/api/src/lambdas/<capability>/
├── handler.ts                 # Lambda/API Gateway adapter
├── composition-root.ts         # inversify container and bindings
├── commands/
│   └── <command>/
│       ├── command.ts
│       ├── handler.ts
│       └── handler.test.ts
├── queries/
│   └── <query>/
│       ├── query.ts
│       ├── handler.ts
│       └── handler.test.ts
├── domain/
│   ├── models/
│   ├── ports/
│   └── errors/
├── infrastructure/
│   ├── repositories/
│   └── providers/
└── config/
```

The exact folder names are flexible. Preserve these rules: dependencies point
inward, commands and queries are separate, and no code in this Lambda is shared
with another Lambda.

## Implementation Standards

- Use strict TypeScript. Prefer `unknown` over `any`, named exports, explicit
  return types for public APIs, immutable values where practical, and small
  focused modules.
- Define TypeScript types and Zod schemas at all agent, tool, provider, API, and
  persistence boundaries. Do not pass arbitrary objects between components.
- Wrap Amadeus, Ticketmaster, Open-Meteo, DynamoDB, Bedrock, and Secrets Manager
  behind Lambda-owned ports/adapters. Normalize provider results before they
  enter domain/application logic.
- Apply bounded timeouts, retry with exponential backoff where appropriate,
  provider-error mapping, and graceful degradation for optional dependencies.
- Require explicit user approval before any simulated booking action. Clearly
  identify all booking results as simulated; never implement payments or real
  reservations.
- Never commit or log secrets, authorization headers, credentials, or raw
  provider responses. Use AWS Secrets Manager when deployed and placeholders in
  `.env.example` for local development.
- Provision cloud resources with Terraform and apply least-privilege IAM.

## Observability and Verification

- Emit structured logs containing `requestId`, `sessionId`, `agent`, `tool`,
  `durationMs`, and `status` where applicable.
- Preserve trace context and add spans that make orchestration and provider calls
  visible. Capture model token usage when available.
- Run the relevant unit and integration tests, linting, type checking, and
  formatting checks for every change. State any check that could not be run and
  why.
- Default local provider execution to mocks (`PROVIDER_MODE=mock`). Do not make
  tests dependent on live providers or credentials.

## Decision Priority

When an implementation decision is unclear, prioritize:

```text
simplicity
→ testability
→ explicit interfaces
→ observability
→ agent autonomy
```
