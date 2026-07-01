# Contributing to NexusFlow

## Before You Open a PR

Run the repo checks that are currently enforced:

```bash
make bootstrap
make fmt-check
make lint
make test
make smoke-jwt-lab
```

If you are changing only one surface, run the narrow target as well:

- Rust workspace: `cargo test --workspace --all-targets`
- TypeScript schemas: `npm test --prefix packages/types-shared`
- JWT lab: `cd labs/path-1-sovereign-foundations/chapter-jwt-auth && go test ./...`

## Documentation Rules

- Keep the README and lab docs aligned with code that is checked in.
- Do not describe services, paths, or integrations as complete unless they are
  present in the repository and validated by CI.
- Prefer explicit status language such as `prototype`, `demo`, or `production`
  when documenting components.
- If a status change affects release readiness, update the docs in `docs/` that
  define architecture, status, backlog, and staging readiness.

## Code Quality Rules

- Rust changes must pass `cargo fmt`, `cargo clippy`, and `cargo test`.
- TypeScript changes must pass `npm run build` and `npm run lint` in
  `packages/types-shared`.
- Go changes in the JWT lab must pass `go test ./...`.
- Keep changes scoped. Do not mix roadmap work, unrelated refactors, and bug
  fixes in one PR.

## Repo Readiness Docs

When changes affect roadmap or release readiness, update these files together:

- `docs/architecture-and-ownership.md`
- `docs/repository-status-matrix.md`
- `docs/repository-backlog.md`
- `docs/staging-readiness-review.md`
- `docs/production-scope.md`
