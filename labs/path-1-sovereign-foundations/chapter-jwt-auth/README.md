# JWT Auth Lab

This directory contains the current JWT authentication lab prototype for
NexusFlow. It is a runnable demo used for local learning and CI smoke checks.

## What Is Here

- a Go HTTP service with `/health` and `/auth`
- readiness at `/readyz`
- in-process narrative runtime endpoints at `/narrative/apply`, `/state`, and `/metrics`
- a JSON metrics snapshot endpoint at `/metrics/snapshot`
- an alert webhook endpoint at `/alerts`
- a Docker Compose stack for a stateless JWT lab runtime
- a Prometheus service with a writable local TSDB volume that scrapes the backend on port 9090
- a hardened Dockerfile and build context for local image builds
- a staged Kubernetes deployment target under `deploy/staging/jwt-auth-lab`
- example provisioning files for Prometheus and Grafana
- a Rust file with narrative hook prototypes used for future integration work

## What This Lab Does Today

- starts a backend service on port 8080
- responds to `GET /health` with a simple JSON health payload
- responds to `GET /readyz` with runtime readiness details
- accepts a JSON request on `/auth` and returns a signed HS256 JWT
- validates required config, allowed roles, and HTTP methods
- applies narrative mutations and exposes state plus Prometheus metrics
- accepts Alertmanager webhook deliveries in staged environments
- validates that the Compose stack is structurally correct
- can be built locally as a standalone container image
- can be rendered as a staged Kubernetes deployment target

## What This Lab Does Not Do Yet

- use a real persistence layer
- expose dashboards and alert delivery beyond the local Prometheus instance
- replace the mirrored in-process runtime with a direct Rust integration layer
- rotate or externally manage signing secrets
- sign and promote images across environments

## Prerequisites

- Docker with Compose support
- Go 1.22+ if you want to run the handler tests locally

## Local Validation

From the repository root:

```bash
make test-go
make smoke-jwt-lab
make smoke-jwt-staging
make docker-build-jwt-lab
make walkthrough-jwt-lab
```

From this directory directly:

```bash
cp .env.example .env
go test ./...
docker compose --env-file .env config
```

From the repository root, you can also run the full local walkthrough with:

```bash
make walkthrough-jwt-lab
```

## Run the Lab

```bash
cp .env.example .env
docker compose up -d --build
curl http://localhost:8080/health
curl http://localhost:8080/readyz
curl http://localhost:8080/auth \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-user","role":"admin"}'
curl http://localhost:8080/narrative/apply \
  -H "Content-Type: application/json" \
  -d '{"type":"partition_network","channels":["eth0","eth1"]}'
curl http://localhost:8080/state
curl http://localhost:8080/metrics
curl http://localhost:8080/metrics/snapshot
open http://localhost:9090
docker compose down
```

Example response:

```json
{"token":"<signed-jwt>","payload":{"user_id":"test-user","role":"admin"}}
```

The token includes these claims:

- `iss`: `JWT_ISSUER` or `nexusflow-jwt-lab`
- `aud`: `JWT_AUDIENCE` or `nexusflow-lab-clients`
- `sub`: the submitted `user_id`
- `role`: the submitted role when it is `admin`, `operator`, or `viewer`
- `exp`: current time plus `JWT_TTL` or 15 minutes

The runtime endpoints use these mutation types:

- `inject_latency` with `delay_us`
- `partition_network` with `channels`
- `fail_node` with `node_id` and `cause`

Operational endpoints:

- `/health` for liveness
- `/readyz` for readiness
- `/metrics` for Prometheus scraping
- `/metrics/snapshot` for JSON debugging output
- `/alerts` for Alertmanager webhook delivery

The shared TypeScript mirror for these payloads and responses lives in
`packages/types-shared/src/runtime-contract.ts`.

## Production Follow-Up

Before this lab can be treated as a real service, it needs:

- a deliberate persistence strategy if stateful behavior is introduced
- metrics, logs, and readiness behavior suitable for deployment
- secret rotation and managed secret storage

Sprint 2 completed the signed-token, config-loading, and request-validation
baseline for this lab. Sprint 3 added the integrated narrative runtime, state
snapshot, and metrics snapshot endpoints. Sprint 4 added Prometheus-format
metrics, readiness, and a Compose-level Prometheus service. Sprint 5 adds image
build hardening, SBOM/scanning workflow coverage, and release/security docs.
Sprint 7 adds a staged Kubernetes deployment target and removes the unused
Postgres placeholder dependency from the JWT lab stack. Sprints 8-10 add
managed-secret manifests, promoted-image signing/provenance workflow wiring,
and staged Grafana/Alertmanager observability components.

See `docs/production-scope.md` at the repo root for the current production
roadmap.
