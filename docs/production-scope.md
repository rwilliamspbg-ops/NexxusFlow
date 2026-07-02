# Production Scope

This document defines the current production boundary for the repository.

## Repository Status by Surface

| Surface | Current status | Notes |
| --- | --- | --- |
| Rust crates | Prototype | Libraries and example binaries exist, but no integrated production runtime is wired together yet. |
| TypeScript shared schemas | Active | Build and lint are enforced; schemas are usable as shared contracts. |
| JWT auth lab | Beta lab service | Signed JWT issuance, explicit config loading, handler tests, in-process narrative runtime/state/metrics endpoints, and Compose smoke validation exist, but the service is not yet production auth. |
| Observability examples | Example-only | Example files exist, but there is no deployed metrics server in the JWT lab. |

## Sprint 0 Outcome

- top-level docs match the current repository layout
- lab documentation describes implemented behavior only
- contributor guidance references enforceable commands
- misleading placeholder repository structure has been removed from the docs

## Sprint 1 Outcome

- TypeScript package has a committed lockfile and ESLint configuration
- CI strictly builds and lints TypeScript without skip-on-failure fallbacks
- Go validation exists for the JWT lab
- Docker Compose smoke validation exists for the JWT lab

## Sprint 2 Outcome

- JWT auth lab issues signed HS256 JWTs with issuer, audience, subject, role, and expiration claims
- the service refuses to start without `JWT_SECRET`
- handler validation covers methods, payload structure, and allowed roles
- Go tests verify config loading and token validation behavior

## Sprint 3 Outcome

- the JWT lab now exposes one integrated runtime slice for auth, narrative mutation, state, and metrics
- the narrative mutation contract is mirrored in `packages/types-shared/src/runtime-contract.ts`
- Go integration tests cover auth issuance, mutation application, state snapshots, and metrics snapshots
- runtime boundaries are documented explicitly in `docs/runtime-boundaries.md`

## Sprint 4 Outcome

- `/metrics` now exposes Prometheus-format metrics for the JWT lab runtime
- `/metrics/snapshot` preserves the JSON debugging view used in tests and local inspection
- `/readyz` exposes readiness details for runtime configuration
- Docker Compose now includes a local Prometheus service and valid scrape/rule files
- an operator runbook for the JWT lab exists in `docs/jwt-lab-operations.md`

## Sprint 5 Outcome

- the JWT auth backend image has a hardened build context and runtime defaults
- CI now builds the backend image, emits an SBOM artifact, and runs a Trivy image scan
- local image build validation exists via `make docker-build-jwt-lab`
- release, environment promotion, secret handling, backup/restore, and security review notes exist in `docs/jwt-lab-release-hardening.md`

## Sprint 6 Outcome

- architecture and ownership are documented explicitly in `docs/architecture-and-ownership.md`
- a public-facing repository status matrix exists in `docs/repository-status-matrix.md`
- a ticket-ready repository backlog exists in `docs/repository-backlog.md`
- versioning and release expectations are documented in `docs/versioning-and-release-policy.md`
- a formal staging readiness review exists in `docs/staging-readiness-review.md`

## Sprint 7 Outcome

- a staged Kubernetes deployment target exists in `deploy/staging/jwt-auth-lab`
- staged deployment instructions exist in `docs/jwt-lab-staging-deploy.md`
- local and CI validation now include staged manifest checks
- the unused Postgres placeholder dependency has been removed from the JWT lab stack, making the current runtime explicitly stateless

## Sprint 8 Outcome

- the staged JWT deployment now uses an `ExternalSecret` manifest instead of imperative secret creation
- staging docs now describe an operator-managed secret injection path for `JWT_SECRET`

## Sprint 9 Outcome

- CI now includes a publish/sign/attest/verify image release job for the JWT backend on `main`
- the staged deployment has a GHCR overlay for promoted images

## Sprint 10 Outcome

- the staged deployment now includes Alertmanager and Grafana alongside Prometheus
- the JWT runtime exposes an `/alerts` webhook sink for staged alert routing
- staging docs now cover centralized observability access paths and promoted-image deployment usage

## Still Out of Scope for Production

- cluster-side secret store provisioning and rotation exercise
- deployment manifests beyond local Docker Compose and local container builds
- direct runtime integration with the Rust crates instead of mirrored Go contracts
- enterprise-grade alert delivery integrations and centralized runbooks beyond the current staged lab slice

## Promotion Criteria for Sprint 2+

Before any service in this repo is called production-ready, it must have:

1. a truthful architecture and ownership document
2. reproducible local setup and strict CI coverage
3. service-level tests beyond unit coverage
4. deployment configuration for staging and production
5. metrics, logs, health probes, and rollback guidance
