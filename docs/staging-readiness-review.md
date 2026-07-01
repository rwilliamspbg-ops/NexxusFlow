# Staging Readiness Review

This document is the current pre-staging review for the repository.

## Review Date

- 2026-07-01

## Scope Reviewed

- JWT auth lab runtime
- local Docker Compose deployment
- shared TypeScript runtime contracts
- CI validation and image hardening workflow

## Ready Now

- signed JWT issuance with explicit config loading
- in-process runtime mutation/state/metrics flow
- local Prometheus scraping and rule evaluation
- hardened local image build
- CI build, SBOM, and image vulnerability scan
- staged Kubernetes manifests for the JWT lab runtime
- stateless runtime topology for the current JWT lab slice
- staged ExternalSecret manifest for runtime secret injection
- staged Alertmanager and Grafana manifests
- CI publish/sign/attest/verify workflow on `main`

## Not Ready for Staging

- no exercised managed-secret path in a real cluster
- no exercised signed-image promotion from CI into the staged target
- no exercised Grafana/Alertmanager stack in a real cluster
- no exercised rollback beyond local guidance

## Recommendation

Do not call the repository staging-ready yet.

The repo is suitable for continued internal development and repeated local/CI
validation, but it still lacks the minimum controls expected for a staged
service environment because the newly added staged controls are not yet backed
by exercise evidence.

## Exit Criteria for This Review

The next staging-readiness review should only pass when all of the following are true:

1. the staged deployment target is exercised end to end, not just checked in
2. secrets are injected without local files
3. image signing or provenance verification is required in CI
4. alerting and dashboards exist outside local Compose
5. rollback is exercised against the staged target
