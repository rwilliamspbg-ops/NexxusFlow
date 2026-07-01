# Runtime Boundaries

This document describes the current integrated runtime slice implemented in the
repository after Sprint 3.

## Current Runtime Shape

The JWT lab service in
`labs/path-1-sovereign-foundations/chapter-jwt-auth/main.go` is the only
checked-in process that currently integrates multiple concerns in one runnable
flow.

It owns these HTTP surfaces:

- `GET /health`: liveness check
- `GET /readyz`: readiness details
- `POST /auth`: signed JWT issuance
- `POST /narrative/apply`: apply an in-memory narrative mutation
- `GET /state`: current in-memory lab state snapshot
- `GET /metrics`: Prometheus exposition endpoint
- `GET /metrics/snapshot`: current in-memory metrics snapshot in JSON form

## How This Maps to the Repo

- Go runtime: owns the executable integration path and the current handler tests.
- Docker Compose + Prometheus: own the current local scrape path for runtime metrics.
- TypeScript shared schemas: mirror the runtime mutation/state/metrics contract in
  `packages/types-shared/src/runtime-contract.ts`.
- Rust `narrative-engine`: remains the reference prototype for state mutation
  semantics.
- Rust `observability-core`: remains the reference prototype for buffered metrics
  collection semantics.

## Important Constraint

The Go runtime currently mirrors the Rust concepts; it does not call the Rust
crates directly. That is intentional for the current stage and should be treated
as a boundary, not as full cross-language integration.

## Sprint 4+ Direction

The next integration step should replace or wrap the mirrored Go runtime logic
with one of these approaches:

1. a Rust service boundary that the Go lab calls over HTTP or gRPC
2. a shared command/controller process that owns narrative and metrics state
3. a simplified single-language runtime if the multi-language split is not
  providing enough value
