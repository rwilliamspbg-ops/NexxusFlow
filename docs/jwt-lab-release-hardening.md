# JWT Lab Release Hardening

This document captures the current Sprint 5 release and security baseline for
the JWT lab runtime.

## Image Build and Scan

- Local image build target: `make docker-build-jwt-lab`
- CI image build job: `.github/workflows/ci.yml` job `jwt-auth-image-security`
- SBOM output: SPDX JSON artifact generated from the built backend image
- Vulnerability scan: Trivy image scan with SARIF upload for `HIGH` and `CRITICAL`

## Environment Promotion Strategy

Current supported environments:

1. Local development via Docker Compose
2. CI validation via GitHub Actions image build and scan

Planned next environments:

1. Staging with external secret injection and persistent storage
2. Production with signed images, managed secrets, and centralized observability

Promotion rule for the current lab slice:

- local changes must pass Go tests, TypeScript tests, Compose validation, and image build
- CI must pass build, lint, smoke, SBOM, and vulnerability scan jobs before promotion to any staged environment

## Secret Handling Baseline

- `JWT_SECRET` and `POSTGRES_PASSWORD` are required inputs and must not rely on in-code defaults
- `.env.example` documents shape only and must never be treated as deployable secret material
- local Compose uses `.env`; staged environments should inject secrets through the platform runtime

## Backup and Restore

Current persisted data surface:

- PostgreSQL data volume: `jwt-auth-db-data`

Local backup example:

```bash
docker run --rm \
  -v jwt-auth-db-data:/volume \
  -v "$PWD":/backup \
  alpine:3.20 \
  tar czf /backup/jwt-auth-db-data.tgz -C /volume .
```

Local restore example:

```bash
docker run --rm \
  -v jwt-auth-db-data:/volume \
  -v "$PWD":/backup \
  alpine:3.20 \
  sh -c 'rm -rf /volume/* && tar xzf /backup/jwt-auth-db-data.tgz -C /volume'
```

## Security Review Summary

Current protections in place:

- non-root backend container user
- `no-new-privileges` and `cap_drop: ALL`
- read-only root filesystem for backend and Prometheus containers
- explicit secret requirement for auth and database startup
- signed JWT issuance with issuer, audience, and expiry claims
- CI image scan and SBOM generation

Known remaining gaps:

- no image signing or provenance attestation yet
- no external secret manager integration yet
- no centralized alert routing yet
- no rate limiting or request authentication beyond the current lab auth flow
- no staged deployment manifests beyond local Compose
