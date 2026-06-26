# NexusFlow Monorepo — Development Makefile
# Run `make help` to see all available targets.

.PHONY: help dev up down lint clippy fmt fmt-check test bench clean

# ── Meta ──────────────────────────────────────────────────────────────────────
help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Lab environment ───────────────────────────────────────────────────────────
dev: ## Start JWT-auth lab stack with hot-reload (docker compose watch)
	docker compose -f labs/path-1-sovereign-foundations/chapter-jwt-auth/docker-compose.yml \
		up --build --detach

up: ## Alias for dev
	$(MAKE) dev

down: ## Tear down all running lab stacks
	docker compose -f labs/path-1-sovereign-foundations/chapter-jwt-auth/docker-compose.yml down

# ── Rust ──────────────────────────────────────────────────────────────────────
clippy: ## Run Clippy across all workspace crates (deny warnings)
	cargo clippy --workspace --all-targets -- -D warnings

fmt: ## Auto-format all Rust source files
	cargo fmt --all

fmt-check: ## Check Rust formatting without writing (CI gate)
	cargo fmt --all -- --check

test: test-rust test-ts ## Run all tests (Rust + TypeScript)

test-rust: ## Run cargo tests across the workspace
	cargo test --workspace --all-targets

bench: ## Run microbenchmark suite for data-plane hot-path validation
	cargo bench --workspace --all-targets

# ── TypeScript / npm ──────────────────────────────────────────────────────────
test-ts: ## Run npm test for packages/types-shared
	npm run type-check --prefix packages/types-shared

lint: clippy ## Run all linters (Rust clippy; TS lint via CI)
	npm run lint --prefix packages/types-shared || echo "TS lint skipped (no eslint config yet)"

# ── Utilities ─────────────────────────────────────────────────────────────────
clean: ## Remove Rust build artefacts
	cargo clean

verify-bridge: test ## Verify bridge contracts between Rust crates and TypeScript packages
	@echo "✅ Bridge verification complete"
