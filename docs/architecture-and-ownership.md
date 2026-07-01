# Architecture and Ownership

This document defines the current architecture shape and the ownership boundary
for each checked-in surface in the repository.

## System Shape

NexusFlow currently consists of one integrated lab runtime plus several
prototype libraries and shared contracts.

### Executable Runtime

- JWT lab service:
  `labs/path-1-sovereign-foundations/chapter-jwt-auth/main.go`
  - owns HTTP endpoints for health, readiness, auth, narrative mutations,
    runtime state, and metrics
  - owns the currently runnable integration path in the repo
  - runs locally with Docker Compose and a local Prometheus instance

### Shared Contract Layer

- TypeScript schemas:
  `packages/types-shared/src`
  - owns shared contract definitions consumed by future UI or orchestration code
  - includes the mirrored runtime contract for the JWT lab integration slice

### Prototype Libraries

- `crates/narrative-engine`
  - reference prototype for narrative state mutation semantics
- `crates/observability-core`
  - reference prototype for buffered metrics semantics
- `crates/afxdp-lab`
  - reference prototype for networking/data-plane experiments

## Ownership Matrix

| Surface | Current owner | Responsibility |
| --- | --- | --- |
| JWT lab Go runtime | Application/runtime owner | Endpoint behavior, auth flow, runtime state, observability surface |
| JWT lab Docker/Compose assets | Platform owner | Container build, Compose topology, local deployment behavior |
| TypeScript shared schemas | Contract owner | Schema compatibility and consumer-facing type stability |
| Rust prototype crates | Research/prototype owner | Reference implementations and future integration direction |
| CI workflows | Build/release owner | Validation gates, image build, SBOM, and scan coverage |
| Docs under `docs/` | Repo owner | Truthful status, readiness criteria, and operator guidance |

## Current Architectural Constraint

The JWT lab runtime mirrors the Rust concepts in-process. It does not yet call
the Rust crates directly and should not be described as a full cross-language
runtime.

## Decision Boundary for Future Work

Before adding more labs or deployment targets, the repo should choose one of
these long-term directions:

1. Keep the Go runtime as the integration host and treat Rust crates as service or helper boundaries.
2. Promote the Rust crates into first-class runtime services and demote the Go lab to a thin adapter.
3. Collapse the multi-language split where it does not produce clear product value.
