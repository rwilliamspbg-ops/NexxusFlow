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
| JWT auth lab runtime | Beta | Go tests, Compose validation, local image build, local walkthrough automation, staged kind exercise, External Secrets-backed kind exercise, Prometheus scrape path, staged manifest validation, **Go lint/fmt checks** | Managed secret injection, signing, and staged observability are implemented; remaining proof gaps are around CI-published images and non-local staging evidence |
| TypeScript shared schemas | Beta | Build, lint, and **contract validation script** in CI | Shared contracts are usable and verified against runtime snapshots |
| Rust narrative-engine | Beta | Unit tests, **lockfile enforcement**, consolidated logic | Reference semantics, now strictly validated with (0, 1s) latency bounds |
| Rust observability-core | Prototype | Unit tests, **lockfile enforcement** | Reference metrics buffering, not active production collector |
| Rust afxdp-lab | Prototype | Unit tests, **lockfile enforcement** | Experimental networking surface |
| Staged JWT lab manifests | Beta | Kustomize validation, kind exercise, live endpoint smoke checks, rollback rehearsal, External Secrets-backed kind exercise, and staging deploy docs | Includes ExternalSecret, Prometheus, Alertmanager, Grafana, and GHCR overlay; still needs promoted-image exercise evidence |
| Local Prometheus rules/config | Beta | Compose validation and runtime scrape path | Local lab only, not centralized monitoring |
| Release hardening docs | Beta | Human-reviewed repo docs plus CI workflow wiring | Guidance and CI automation now exist, but main-branch release exercise is still pending |
| Placeholder future lab paths/assets | Example-only | None beyond source control | Do not describe as shipped functionality |

## Release Gate Summary

Nothing in the repository should currently be labeled `production-ready`.

The nearest candidate is the JWT auth lab runtime, but it must first gain:

1. main-branch publish/sign/provenance verification evidence
2. non-local staged environment evidence
3. contract and operational hardening beyond the current stateless lab baseline
4. any additional production guardrails needed after the first staged dry run
5. production-facing operational review after non-local staging evidence exists
