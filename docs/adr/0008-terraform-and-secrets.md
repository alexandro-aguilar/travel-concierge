# ADR-0008: Terraform-managed infrastructure and secret handling

## Status

Accepted — 2026-08-10

## Context

The application needs repeatable AWS infrastructure, provider credentials, and narrowly scoped permissions.

## Decision

Define API Gateway, independently deployed Lambdas, DynamoDB, Secrets Manager references, CloudWatch, and tracing configuration with Terraform. Lambda roles receive only the required actions for their own table records, Bedrock invocation, named secrets, logs, and tracing. Deployed credentials reside in Secrets Manager; `.env.example` contains placeholders only. `BEDROCK_MODEL_ID` and `PROVIDER_MODE` are configuration, not source constants.

## Consequences

- Infrastructure changes are reviewable and reproducible.
- IAM is more verbose because permissions are capability-specific.
- Local mock mode works without AWS/provider secrets.

## Alternatives considered

- Manual AWS console setup: rejected because it is not reproducible or reviewable.
- Secrets in Lambda environment source files: rejected for security.

## References

- [SDD-001](../specs/001-foundation-and-session-api.md)
