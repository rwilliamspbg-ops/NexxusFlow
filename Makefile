# NexusFlow — Development Makefile
# Run `make help` to see all available targets.

.PHONY: help bootstrap dev up down lint lint-ts clippy fmt fmt-check test test-rust test-ts test-go smoke-jwt-lab smoke-jwt-staging docker-build-jwt-lab bench clean verify-bridge

# ── Meta ──────────────────────────────────────────────────────────────────────
help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Bootstrap ────────────────────────────────────────────────────────────────
bootstrap: ## Install local package dependencies required for TypeScript checks
	npm ci --prefix packages/types-shared

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

test: test-rust test-ts test-go ## Run all tests (Rust + TypeScript + Go)

test-rust: ## Run cargo tests across the workspace
	cargo test --workspace --all-targets

bench: ## Run microbenchmark suite for data-plane hot-path validation
	cargo bench --workspace --all-targets

# ── TypeScript / npm ──────────────────────────────────────────────────────────
test-ts: ## Build and lint packages/types-shared
	npm test --prefix packages/types-shared

lint-ts: ## Run eslint for packages/types-shared
	npm run lint --prefix packages/types-shared

# ── Go / lab validation ───────────────────────────────────────────────────────
test-go: ## Run Go tests for the JWT auth lab
	cd labs/path-1-sovereign-foundations/chapter-jwt-auth && go test ./...

smoke-jwt-lab: ## Validate the JWT auth lab Docker Compose configuration
	docker compose --env-file labs/path-1-sovereign-foundations/chapter-jwt-auth/.env.example -f labs/path-1-sovereign-foundations/chapter-jwt-auth/docker-compose.yml config > /dev/null

smoke-jwt-staging: ## Validate the staged Kubernetes manifests for the JWT auth lab
	kubectl kustomize deploy/staging/jwt-auth-lab > /dev/null
	kubectl kustomize deploy/staging/jwt-auth-lab-ghcr > /dev/null

docker-build-jwt-lab: ## Build the JWT auth backend image locally
	docker build -f labs/path-1-sovereign-foundations/chapter-jwt-auth/Dockerfile.backend -t nexusflow/jwt-auth-backend:local labs/path-1-sovereign-foundations/chapter-jwt-auth

lint: clippy lint-ts test-go ## Run all enforceable code-quality checks

# ── Utilities ─────────────────────────────────────────────────────────────────
clean: ## Remove Rust build artefacts
	cargo clean

verify-bridge: test ## Verify bridge contracts between Rust crates and TypeScript packages
	@echo "✅ Bridge verification complete"
