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
| JWT auth lab runtime | Beta | Go tests, Compose validation, local image build, Prometheus scrape path | Still missing staged deployment manifests, image signing, secret manager integration, and centralized ops |
| TypeScript shared schemas | Beta | Build and lint in CI | Shared contracts are usable, but consumers are still limited |
| Rust narrative-engine | Prototype | Unit tests only | Reference semantics, not integrated runtime |
| Rust observability-core | Prototype | Unit tests only | Reference metrics buffering, not active production collector |
| Rust afxdp-lab | Prototype | Unit tests only | Experimental networking surface |
| Local Prometheus rules/config | Beta | Compose validation and runtime scrape path | Local lab only, not centralized monitoring |
| Release hardening docs | Beta | Human-reviewed repo docs | Guidance exists, but signing/provenance/promotion are not fully automated |
| Placeholder future lab paths/assets | Example-only | None beyond source control | Do not describe as shipped functionality |

## Release Gate Summary

Nothing in the repository should currently be labeled `production-ready`.

The nearest candidate is the JWT auth lab runtime, but it must first gain:

1. staged deployment manifests
2. managed secret injection
3. image signing and provenance
4. centralized alerting and dashboards
5. persistent-state and recovery testing beyond local volume backup examples
