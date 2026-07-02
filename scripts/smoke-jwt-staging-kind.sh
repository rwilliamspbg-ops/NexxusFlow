#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

require_command kubectl
require_command curl
require_command jq

backend_pf=""
prometheus_pf=""
alertmanager_pf=""
grafana_pf=""

cleanup() {
  [[ -n "$backend_pf" ]] && kill "$backend_pf" >/dev/null 2>&1 || true
  [[ -n "$prometheus_pf" ]] && kill "$prometheus_pf" >/dev/null 2>&1 || true
  [[ -n "$alertmanager_pf" ]] && kill "$alertmanager_pf" >/dev/null 2>&1 || true
  [[ -n "$grafana_pf" ]] && kill "$grafana_pf" >/dev/null 2>&1 || true
}

trap cleanup EXIT

cd "$repo_root"

kubectl get pods -n nexusflow-staging

kubectl port-forward service/jwt-auth-backend 18080:8080 -n nexusflow-staging >/tmp/jwt-auth-backend-pf.log 2>&1 &
backend_pf=$!
kubectl port-forward service/prometheus 19090:9090 -n nexusflow-staging >/tmp/jwt-auth-prometheus-pf.log 2>&1 &
prometheus_pf=$!
kubectl port-forward service/alertmanager 19093:9093 -n nexusflow-staging >/tmp/jwt-auth-alertmanager-pf.log 2>&1 &
alertmanager_pf=$!
kubectl port-forward service/grafana 13000:3000 -n nexusflow-staging >/tmp/jwt-auth-grafana-pf.log 2>&1 &
grafana_pf=$!

wait_for_url() {
  local url="$1"
  for _ in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "timed out waiting for $url" >&2
  return 1
}

wait_for_url http://localhost:18080/health
wait_for_url http://localhost:19090/-/ready
wait_for_url http://localhost:19093/-/ready
wait_for_url http://localhost:13000/api/health

curl -fsS http://localhost:18080/health
printf '\n'
curl -fsS http://localhost:18080/readyz
printf '\n'
curl -fsS http://localhost:18080/metrics | grep 'jwt_lab_auth_requests_total'
printf '\n'
auth_status="$(curl -s -o /tmp/jwt-auth-invalid-response.json -w '%{http_code}' http://localhost:18080/auth -H "Content-Type: application/json" -d '{"user_id":"smoke-user","role":"owner"}')"
if [[ "$auth_status" != "400" ]]; then
  echo "expected invalid auth request to return 400, got $auth_status" >&2
  cat /tmp/jwt-auth-invalid-response.json >&2
  exit 1
fi
for _ in $(seq 1 30); do
  alerts_received="$(curl -fsS http://localhost:18080/metrics/snapshot | jq -r '.alerts_received_total')"
  if [[ "$alerts_received" != "0" ]]; then
    break
  fi
  sleep 5
done
final_snapshot="$(curl -fsS http://localhost:18080/metrics/snapshot)"
echo "$final_snapshot" | jq .
final_alerts_received="$(echo "$final_snapshot" | jq -r '.alerts_received_total')"
if [[ "$final_alerts_received" == "0" ]]; then
  echo "expected Alertmanager to deliver at least one alert webhook, but alerts_received_total remained 0" >&2
  curl -fsS 'http://localhost:19090/api/v1/query?query=ALERTS' | jq . >&2 || true
  curl -fsS 'http://localhost:19093/api/v2/alerts' | jq . >&2 || true
  exit 1
fi
printf '\n'
curl -fsS http://localhost:19090/-/ready
printf '\n'
curl -fsS 'http://localhost:19090/api/v1/query?query=up' 
printf '\n'
curl -fsS http://localhost:19093/-/ready
printf '\n'
curl -fsS http://localhost:13000/api/health
printf '\n'

echo "kind staging smoke checks passed"
