# NexusFlow

NexusFlow is an infrastructure-learning repository built from small Rust, Go,
and TypeScript components. The current repo is a development workspace for lab
prototypes, shared schemas, and supporting automation.

This README describes the checked-in repository as it exists today. It does not
describe future paths, chapters, or services that have not been implemented.

## Current Scope

- Rust workspace with three prototype crates:
  - `crates/afxdp-lab`
  - `crates/narrative-engine`
  - `crates/observability-core`
- Shared TypeScript schemas in `packages/types-shared`
- One runnable lab slice in `labs/path-1-sovereign-foundations/chapter-jwt-auth`
- One staged deployment target in `deploy/staging/jwt-auth-lab`
- GitHub Actions CI for Rust, TypeScript, and the JWT lab baseline

## Repository Layout

```text
.
├── Cargo.toml
├── Makefile
├── crates/
│   ├── afxdp-lab/
│   ├── narrative-engine/
│   └── observability-core/
├── labs/
│   └── path-1-sovereign-foundations/
│       └── chapter-jwt-auth/
├── deploy/
│   └── staging/
│       └── jwt-auth-lab/
├── packages/
│   └── types-shared/
└── .github/
    └── workflows/
```

## Status

- The Rust crates are prototype libraries and example binaries.
- The JWT auth chapter now exposes auth, narrative mutation, state, and metrics endpoints in one lab runtime, but it is still not a production auth service.
- The TypeScript package contains shared schemas and examples.
- The production roadmap and scope notes live in `docs/production-scope.md`.
- Runtime boundaries for the current integrated slice live in `docs/runtime-boundaries.md`.
- Release and environment guidance for the current lab slice live in `docs/jwt-lab-release-hardening.md`.
- Architecture, status, and staging-readiness docs live under `docs/`.
- The current Sprint 7-10 milestone map lives in `docs/milestone-plan-sprint7-10.md`.

## Prerequisites

- Rust stable with `cargo`
- Node.js 20+
- Go 1.22+
- Docker with Compose support

## Bootstrap

```bash
git clone <repo-url>
cd NexxusFlow
make bootstrap
cp labs/path-1-sovereign-foundations/chapter-jwt-auth/.env.example \
  labs/path-1-sovereign-foundations/chapter-jwt-auth/.env
```

`make bootstrap` installs the checked-in Node dependencies for the shared
TypeScript package. Rust and Go dependencies are resolved by their native tools
when you run the validation targets below. The JWT lab now requires explicit
environment configuration via `labs/path-1-sovereign-foundations/chapter-jwt-auth/.env`.

## Validation Commands

```bash
make fmt-check
make lint
make test
make smoke-jwt-lab
make smoke-jwt-staging
make smoke-jwt-staging-kind
make docker-build-jwt-lab
make walkthrough-jwt-lab
```

Target summary:

- `make lint` runs Rust Clippy, TypeScript lint, and Go tests for the JWT lab.
- `make test` runs Rust tests, TypeScript build and lint, and Go tests.
- `make smoke-jwt-lab` validates the JWT lab Compose configuration.
- `make smoke-jwt-staging` validates the staged Kubernetes manifests.
- `make smoke-jwt-staging-kind` probes the live `kind`-based staging endpoints.
- `make docker-build-jwt-lab` builds the JWT backend image locally using the hardened lab Dockerfile.
- `make walkthrough-jwt-lab` runs the documented local JWT lab user journey end to end.

## JWT Lab Quick Start

```bash
cd labs/path-1-sovereign-foundations/chapter-jwt-auth
cp .env.example .env
docker compose up -d --build
curl http://localhost:8080/health
curl http://localhost:8080/readyz
curl http://localhost:8080/auth \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-user","role":"admin"}'
curl http://localhost:8080/narrative/apply \
  -H "Content-Type: application/json" \
  -d '{"type":"inject_latency","delay_us":250000}'
curl http://localhost:8080/state
curl http://localhost:8080/metrics
curl http://localhost:8080/metrics/snapshot
curl -X POST http://localhost:8080/alerts -H "Content-Type: application/json" -d '{"status":"firing","alerts":[]}'
open http://localhost:9090
docker compose down
```

The current implementation returns a signed HS256 JWT with issuer, audience,
subject, role, and expiration claims. It is still a lab service, not a full
production auth system. The runtime mutation and state contracts are mirrored in
`packages/types-shared/src/runtime-contract.ts`. The `/metrics` endpoint now
serves Prometheus exposition format, while `/metrics/snapshot` keeps the JSON
view used by tests and debugging.

## Production Boundaries

Before promoting any component beyond local lab use, complete the post-Sprint 2
work in `docs/production-scope.md`, especially:

- strict secret management
- integrated observability
- end-to-end tests across Rust, Go, and TypeScript surfaces
- image signing, promotion, and centralized security operations

The staged deployment substrate for the current JWT lab slice lives in
`deploy/staging/jwt-auth-lab`, and the staged rollout procedure lives in
`docs/jwt-lab-staging-deploy.md`.

The promoted-image overlay for staged clusters lives in
`deploy/staging/jwt-auth-lab-ghcr`.

For local cluster exercise evidence, use `make exercise-jwt-staging-kind`,
`make smoke-jwt-staging-kind`, and `make rehearse-jwt-staging-rollback` when
`kind` is available.

For the current readiness view, also see:

- `docs/architecture-and-ownership.md`
- `docs/repository-status-matrix.md`
- `docs/repository-backlog.md`
- `docs/staging-readiness-review.md`

## License

This project is licensed under AGPL-3.0. See `LICENSE`.
