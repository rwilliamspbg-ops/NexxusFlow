#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
lab_dir="$repo_root/labs/path-1-sovereign-foundations/chapter-jwt-auth"

cleanup() {
  cd "$lab_dir"
  docker compose down --remove-orphans >/dev/null 2>&1 || true
}

trap cleanup EXIT

cd "$lab_dir"
cp .env.example .env
docker compose up -d --build

curl -fsS http://localhost:8080/health | jq .
curl -fsS http://localhost:8080/readyz | jq .
curl -fsS http://localhost:8080/auth \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-user","role":"admin"}' | jq .
curl -fsS http://localhost:8080/narrative/apply \
  -H "Content-Type: application/json" \
  -d '{"type":"partition_network","channels":["eth0","eth1"]}' | jq .
curl -fsS http://localhost:8080/state | jq .
curl -fsS http://localhost:8080/metrics/snapshot | jq .
curl -fsS -X POST http://localhost:8080/alerts \
  -H "Content-Type: application/json" \
  -d '{"status":"firing","alerts":[{"status":"firing","labels":{"alertname":"JWTLabAuthFailuresDetected"},"annotations":{"summary":"auth failures"}}]}' | jq .

# Wait for the first Prometheus scrape so the immediate query path is stable.
for _ in $(seq 1 15); do
  result="$(curl -fsS 'http://localhost:9090/api/v1/query?query=jwt_lab_auth_requests_total' | jq -r '.data.result | length' 2>/dev/null || echo 0)"
  if [[ "$result" != "0" ]]; then
    break
  fi
  sleep 2
done

curl -fsS http://localhost:9090/-/ready
printf '\n'
curl -fsS 'http://localhost:9090/api/v1/query?query=jwt_lab_auth_requests_total' | jq .
