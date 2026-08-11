# ADR-0004: Deterministic constraint evaluation and pricing

## Status

Accepted — 2026-08-10

## Context

Trip recommendations must honor dates, traveler counts, direct-flight preferences, ratings, and budgets. Monetary arithmetic and hard constraints must be correct, explainable, and testable.

## Decision

Use TypeScript application/domain code for date validation, currency consistency/conversion policy, cost totals, budget checks, hard-constraint filtering, and state transitions. The optimizer receives normalized options and produces a typed recommendation containing itemized and total costs, budget delta, rejected-constraint reasons, and selected options. Configurable weighted scoring ranks only feasible combinations. An LLM may interpret soft preferences and explain a computed result, but cannot calculate or override prices, totals, or hard filters.

## Consequences

- Recommendations remain repeatable and unit-testable.
- Unsupported currency conversion must be surfaced explicitly rather than guessed.
- The product needs an explicit currency conversion source before it can compare mixed currencies.

## Alternatives considered

- LLM-only optimization: rejected because arithmetic and constraints are nondeterministic.
- Returning the cheapest result only: rejected because it ignores stated preferences.

## References

- [SDD-002](../specs/002-search-and-optimization.md)
