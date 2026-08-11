# ADR-0002: Orchestrated Strands workflow on Amazon Bedrock

## Status

Accepted — 2026-08-10

## Context

The product must demonstrate genuine agentic behavior: conversational requirement collection, specialization, parallel work, explanations, and handoffs without placing provider integrations in the conversational agent.

## Decision

Use a Travel Concierge orchestrator built with Strands Agents and an Amazon Bedrock model selected by `BEDROCK_MODEL_ID`. The orchestrator owns intent interpretation, missing-information prompts, delegation, recommendation explanation, and approval requests. It invokes typed tool/agent ports for flights, hotels, events, weather, and optimization.

Once the required trip fields are valid, independent flight, hotel, and event searches run concurrently with bounded timeouts. Weather is an optional tool, not an autonomous agent. The implementation starts with one complete concierge workflow against mocks, then extracts specialized agents after the contracts are stable.

## Consequences

- Agent reasoning stays focused on ambiguity, planning, preference interpretation, and explanation.
- Provider adapters remain replaceable and inaccessible to the orchestrator except through typed ports.
- Bedrock/Strands interactions require a test double at the boundary.

## Alternatives considered

- A single agent with direct SDK calls: rejected because it mixes orchestration and integration responsibilities.
- Sequential searches: rejected because independent provider latency needlessly delays recommendations.

## References

- [SDD-002](../specs/002-search-and-optimization.md)
