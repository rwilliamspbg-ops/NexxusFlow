# JWT Lab Release Hardening

This document captures the current Sprint 5 release and security baseline for
the JWT lab runtime.

## Image Build and Scan

- Local image build target: `make docker-build-jwt-lab`
- CI image build job: `.github/workflows/ci.yml` job `jwt-auth-image-security`
- SBOM output: SPDX JSON artifact generated from the built backend image
- Vulnerability scan: Trivy image scan with SARIF upload for `HIGH` and `CRITICAL`
- Release publish/sign job: `.github/workflows/ci.yml` job `jwt-auth-image-release`

## Environment Promotion Strategy

Current supported environments:

1. Local development via Docker Compose
2. CI validation via GitHub Actions image build and scan

Planned next environments:

1. Staging with external secret injection
2. Production with signed images, managed secrets, and centralized observability

Promotion rule for the current lab slice:

- local changes must pass Go tests, TypeScript tests, Compose validation, and image build
- CI must pass build, lint, smoke, SBOM, and vulnerability scan jobs before promotion to any staged environment
- pushes to `main` publish the backend image to GHCR, sign it with keyless Sigstore, and attach provenance attestation

## Secret Handling Baseline

- `JWT_SECRET` is a required input and must not rely on in-code defaults
- `.env.example` documents shape only and must never be treated as deployable secret material
- local Compose uses `.env`; staged environments should inject secrets through the platform runtime
- staged Kubernetes deployment expects an External Secrets Operator-managed `ExternalSecret`

Rotation procedure for staging:

1. update the managed secret at the external source referenced by `nexusflow/staging/jwt-auth`
2. force or wait for the `ExternalSecret` refresh interval
3. restart the JWT backend deployment if your operator does not trigger pod restart automatically
4. verify `GET /readyz` and `GET /metrics` after rotation

## Backup and Restore

Current persisted data surface:

- none in the JWT lab runtime after Sprint 7

Implication:

- backup and restore for this slice currently focus on manifests, image provenance, and secret recovery rather than database volume recovery

## Security Review Summary

Current protections in place:

- non-root backend container user
- `no-new-privileges` and `cap_drop: ALL`
- read-only root filesystem for backend and Prometheus containers
- explicit secret requirement for auth startup
- signed JWT issuance with issuer, audience, and expiry claims
- CI image scan and SBOM generation

## Persistence Decision

Sprint 7 removes the unused Postgres placeholder from the JWT lab stack.

Future persistence work must be introduced only when the runtime has a concrete
stateful requirement and a matching test and recovery story.

Known remaining gaps:

- no centralized alert routing yet
- no rate limiting or request authentication beyond the current lab auth flow
- the managed secret source itself is external to this repo and must exist in the cluster
- registry promotion is only exercised in GitHub Actions, not locally
