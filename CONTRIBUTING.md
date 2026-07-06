# Contributing to NexxusFlow

Thank you for your interest in NexxusFlow! This document provides guidelines for contributing to our monorepo.

## Development Environment

Refer to the main `README.md` for prerequisites. Once installed, run:

```bash
make bootstrap
```

This ensures all local dependencies are ready for development.

## Language Guidelines

### Rust
- Use `cargo fmt` for formatting.
- Run `cargo clippy --workspace --all-targets -- -D warnings` before submitting.
- Always include unit tests in `src/tests.rs` or inline `mod tests`.
- Maintain the root `Cargo.lock` for reproducible builds.

### Go
- Use `gofmt` for formatting (or `make fmt-go`).
- Run `go vet ./...` (or `make lint-go`) to check for common issues.
- Integrated lab services should include a `main_test.go` for integration coverage.

### TypeScript
- Use ESLint for linting (`npm run lint`).
- All shared contracts must be defined in `packages/types-shared` using Zod schemas.
- Run `npm test` to ensure builds and lints pass.

## Quality Gates

Before opening a Pull Request, ensure:
1. All tests pass: `make test`
2. Formatting is correct: `make fmt-check`
3. Contracts are verified: `make verify-bridge`

## Pull Request Process

1. Create a descriptive branch from `develop`.
2. Implement your changes with accompanying tests.
3. Update relevant documentation in `docs/` if you've added new features or changed behaviors.
4. Open a PR against `develop`.
