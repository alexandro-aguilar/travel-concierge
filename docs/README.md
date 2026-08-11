# Architecture and Design Documentation

This directory turns the product handoff into reviewable implementation contracts.

## Architecture decision records

- [ADR-0001: Serverless Lambda slices and dependency direction](adr/0001-serverless-lambda-slices.md)
- [ADR-0002: Orchestrated Strands workflow on Amazon Bedrock](adr/0002-orchestrated-strands-workflow.md)
- [ADR-0003: Provider ports, normalized models, and mock-first development](adr/0003-provider-ports-and-mocks.md)
- [ADR-0004: Deterministic constraint evaluation and pricing](adr/0004-deterministic-optimization.md)
- [ADR-0005: DynamoDB session and trip state](adr/0005-dynamodb-session-state.md)
- [ADR-0006: Explicit approval and simulated booking](adr/0006-simulated-booking-approval.md)
- [ADR-0007: Observability and safe operational telemetry](adr/0007-observability.md)
- [ADR-0008: Terraform-managed infrastructure and secret handling](adr/0008-terraform-and-secrets.md)

## Software design documents

- [SDD-001: Foundation and session API](specs/001-foundation-and-session-api.md) — phases 1 and 6
- [SDD-002: Search, normalization, and deterministic optimization](specs/002-search-and-optimization.md) — phases 2–5
- [SDD-003: Approval, simulated booking, and observability](specs/003-approval-and-observability.md) — phases 7–8
- [SDD-004: Travel Concierge web client](specs/004-web-client.md) — phase 9

All SDDs use [the project template](SDD_TEMPLATE.md) as their structure and refine the requirements in the [development handoff](../TRAVEL_CONCIERGE_HANDOFF.md).
