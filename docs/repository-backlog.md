# Repository Backlog

This backlog is the current replacement for a formal issue tracker plan inside
the repository. Each item is written as a ticket-ready unit with acceptance
criteria.

## Launch-Blocking

### RL-01 Managed Secret Injection

- Scope: replace `.env`-style runtime secret injection with a managed source for staging and production
- Acceptance criteria:
  - JWT runtime starts without local `.env` files in staged environments
  - secret rotation path is documented and tested
  - no secret defaults remain in deployment assets
  - Current repo status: manifests and docs are in place; cluster exercise still pending

### RL-02 Staging Deployment Manifests

- Scope: add one supported staged deployment target beyond local Docker Compose
- Acceptance criteria:
  - manifests or deployment definitions are checked in
  - staged deployment can be reproduced from docs
  - readiness, health, and metrics endpoints are reachable in staging

### RL-03 Image Signing and Provenance

- Scope: sign backend images and attach provenance attestation in CI
- Acceptance criteria:
  - CI emits a signed image or attested artifact
  - verification steps are documented
  - promotion policy requires successful verification
  - Current repo status: workflow and verification steps are checked in; GitHub Actions execution on `main` still needs evidence

### RL-04 Centralized Observability

- Scope: move from local-only Prometheus to a centralized observability path
- Acceptance criteria:
  - metrics are scraped outside local Compose
  - alerts route somewhere actionable
  - dashboards or equivalent visualizations exist for auth/runtime health
  - Current repo status: staged Prometheus, Alertmanager, Grafana, and webhook routing are checked in; cluster exercise still pending

## High Priority

### HP-01 Persistence Strategy Revisit

- Scope: only add persistence back into the JWT lab when there is a concrete stateful product need
- Acceptance criteria:
  - any new persistence surface is justified in architecture docs
  - tests and recovery procedures exist for the chosen data surface

### HP-02 Rust Integration Strategy Decision

- Scope: choose whether the runtime will call Rust services, mirror them, or consolidate languages
- Acceptance criteria:
  - decision recorded in architecture docs
  - one follow-up implementation issue opened per chosen direction

### HP-03 Rate Limiting and Abuse Controls

- Scope: add basic protection around auth and mutation endpoints
- Acceptance criteria:
  - request throttling behavior exists
  - failure metrics reflect rejected requests
  - tests cover the throttle path

## Medium Priority

### MP-01 Contract Compatibility Tests

- Scope: add explicit compatibility tests between Go runtime payloads and TypeScript schemas
- Acceptance criteria:
  - one automated check validates runtime JSON against shared schemas

### MP-02 Ops Runbook Expansion

- Scope: turn the current lab operations notes into incident-oriented runbooks
- Acceptance criteria:
  - startup, failure, restore, and rollback flows are documented as separate procedures

### MP-03 Status Automation

- Scope: ensure repo status docs can be kept current without manual drift
- Acceptance criteria:
  - release note or status update template references the status matrix and backlog

## Resolved in Sprint 7

- the JWT lab now has a checked-in staged deployment target under `deploy/staging/jwt-auth-lab`
- the unused Postgres placeholder dependency has been removed from the JWT lab runtime stack

## Implemented in Sprint 8-10, Pending Exercise Evidence

- managed secret injection path via `ExternalSecret`
- GHCR publish/sign/attest/verify workflow
- staged centralized observability stack with Prometheus, Alertmanager, and Grafana
