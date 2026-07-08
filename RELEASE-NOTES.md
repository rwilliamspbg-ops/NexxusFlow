# NexxusFlow v1.0.0-rc1: The Educational Release

We are excited to announce the first release candidate of NexxusFlow, transformed from an internal lab into a polished educational package.

## Highlights
- **Production-Grade JWT Lab**: Fully hardened Go backend with rate limiting, revocation, and secret rotation.
- **New Educational Folder**: Structured learning paths from "Getting Started" to "Observability Deep Dive".
- **Interactive Walkthrough**: A new CLI script (\`./scripts/interactive-walkthrough.sh\`) to demonstrate system flows.
- **Vite/React Frontend**: A visual cockpit to manage tokens and view live system metrics.
- **Hardened CI**: Integrated Trivy vulnerability scanning and image signing with Cosign.

## Changes Since Beta
- Upgraded to Go 1.25.0 and Rust stable.
- Implemented OpenTelemetry tracing for auth flows.
- Added detailed instructional comments to core Rust crates.
- Optimized Docker Compose configuration for better reliability.

## Known Issues
- AF_XDP data plane is still in prototype stage (simulated mode by default).
- Grafana iframe in the frontend requires manual dashboard import in this RC.

## Contributors
- NexxusFlow Production Agent (Lead)
- NexusFlow Team
