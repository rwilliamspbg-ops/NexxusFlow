# Milestone Plan: Sprint 7-10

This plan maps the remaining launch blockers to the next four implementation
sprints.

## Sprint 7: Staging Substrate and Persistence Decision

Goal:

- add one checked-in staged deployment target
- remove the unused Postgres placeholder dependency from the JWT lab stack

Primary deliverables:

- `deploy/staging/jwt-auth-lab` Kubernetes-oriented manifests
- `docs/jwt-lab-staging-deploy.md`
- local and CI validation for staged manifests
- stateless runtime topology for the current JWT lab slice

Exit criteria:

1. staged manifests are checked in and validated
2. staged rollout steps are documented
3. Postgres placeholder dependency is removed from the lab stack

## Sprint 8: Managed Secret Injection

Goal:

- replace file-based staged secrets with a managed injection path

Primary deliverables:

- managed secret source for staging
- secret rotation procedure
- startup validation for staged secret availability

Exit criteria:

1. staging deploy succeeds without local `.env` files
2. secret rotation is documented and exercised
3. no staged deployment asset depends on `.env.example`

## Sprint 9: Signing and Promotion Gate

Goal:

- make the built backend image promotable rather than just scannable

Primary deliverables:

- CI image signing
- provenance attestation
- verification gate before promotion

Exit criteria:

1. CI emits a signed or attested image artifact
2. verification is required before staged promotion
3. release notes and promotion policy reflect the new gate

## Sprint 10: Centralized Observability and Staging Readiness Closeout

Goal:

- move beyond local-only Prometheus and close the staged-service operations gap

Primary deliverables:

- centralized scrape target outside local Compose
- alert routing
- dashboards for runtime health and auth behavior
- updated staging readiness review with exercised evidence

Exit criteria:

1. metrics and alerts work outside local Compose
2. dashboards exist for runtime health and auth failures
3. rollback is exercised against the staged target
4. the staging readiness review can be re-run with evidence instead of planned work
