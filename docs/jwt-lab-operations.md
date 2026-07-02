# JWT Lab Operations

This runbook covers the currently implemented JWT lab runtime in
`labs/path-1-sovereign-foundations/chapter-jwt-auth`.

## Services and Ports

- JWT backend: `http://localhost:8080`
- Prometheus UI: `http://localhost:9090`
- Alertmanager UI/API: `http://localhost:9093`
- Grafana UI: `http://localhost:3000`

Local persisted volume surfaces:

- Prometheus TSDB volume: `jwt-auth-prometheus-data`

## Start and Stop

```bash
cd labs/path-1-sovereign-foundations/chapter-jwt-auth
cp .env.example .env
docker compose up -d --build
docker compose down
```

## Health and Readiness

- Liveness: `GET /health`
- Readiness: `GET /readyz`

Examples:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/readyz
```

## Metrics

- Prometheus scrape endpoint: `GET /metrics`
- JSON debugging snapshot: `GET /metrics/snapshot`
- Alert webhook sink: `POST /alerts`

Useful checks:

```bash
curl http://localhost:8080/metrics
curl http://localhost:8080/metrics/snapshot
curl -X POST http://localhost:8080/alerts -H "Content-Type: application/json" -d '{"status":"firing","alerts":[]}'
open http://localhost:9090
open http://localhost:3000
```

Useful metric names:

- `jwt_lab_auth_requests_total`
- `jwt_lab_auth_success_total`
- `jwt_lab_auth_failure_total`
- `jwt_lab_narrative_mutations_total`
- `jwt_lab_narrative_mutation_failures_total`
- `jwt_lab_latency_injected_milliseconds`
- `jwt_lab_alerts_received_total`

## Common Failure Cases

- Missing `JWT_SECRET`: Compose config or container startup fails fast.
- `GET /readyz` failing: the backend did not start correctly or env configuration is invalid.
- Prometheus target down: inspect `docker compose ps` and confirm the backend is reachable at `jwt-auth-backend:8080` inside the Compose network.
- Alert flow missing in staging: verify Alertmanager can resolve `jwt-auth-backend:8080` and that `/alerts` returns `200`.

## Current Limits

- Metrics are local to the lab runtime and are not pushed to any centralized system.
- Alerts are defined in local Prometheus rules only; no Alertmanager integration exists.
- The runtime state is in-memory and resets when the backend container restarts.
- The runtime is currently stateless; there is no persisted service data surface in the JWT lab stack.
