# Repository Status Matrix

This matrix is the public-facing status view for the current repository.

## Status Legend

- `production-ready`: suitable for operated deployment with defined support expectations
- `beta`: feature-complete enough for repeated use, but still missing production controls
- `prototype`: useful for development and experiments, not stable enough for operational use
- `example-only`: illustrative assets only

## Current Matrix

| Surface | Status | Validation | Notes |
| --- | --- | --- | --- |
| JWT auth lab runtime | Beta | Go tests, Compose validation, local image build, Prometheus scrape path, staged manifest validation | Managed secret injection, signing, and staged observability are implemented in repo, but not yet fully exercised end to end |
| TypeScript shared schemas | Beta | Build and lint in CI | Shared contracts are usable, but consumers are still limited |
| Rust narrative-engine | Prototype | Unit tests only | Reference semantics, not integrated runtime |
| Rust observability-core | Prototype | Unit tests only | Reference metrics buffering, not active production collector |
| Rust afxdp-lab | Prototype | Unit tests only | Experimental networking surface |
| Staged JWT lab manifests | Beta | Kustomize validation and staging deploy docs | Includes ExternalSecret, Prometheus, Alertmanager, Grafana, and GHCR overlay; still needs cluster exercise evidence |
| Local Prometheus rules/config | Beta | Compose validation and runtime scrape path | Local lab only, not centralized monitoring |
| Release hardening docs | Beta | Human-reviewed repo docs plus CI workflow wiring | Guidance and CI automation now exist, but main-branch release exercise is still pending |
| Placeholder future lab paths/assets | Example-only | None beyond source control | Do not describe as shipped functionality |

## Release Gate Summary

Nothing in the repository should currently be labeled `production-ready`.

The nearest candidate is the JWT auth lab runtime, but it must first gain:

1. staged deployment exercise and rollback evidence
2. cluster-side secret store provisioning and rotation evidence
3. main-branch publish/sign/provenance verification evidence
4. centralized alerting and dashboard exercise evidence
5. contract and operational hardening beyond the current stateless lab baseline
