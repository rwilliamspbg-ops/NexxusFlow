#!/usr/bin/env bash

set -euo pipefail

cluster_name="${1:-nexusflow-staging}"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
overlay_dir="$repo_root/deploy/staging/jwt-auth-lab-kind"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

require_command kind
require_command kubectl
require_command docker

cd "$repo_root"

if ! kind get clusters | grep -qx "$cluster_name"; then
  kind create cluster --name "$cluster_name"
fi

make docker-build-jwt-lab
kind load docker-image nexusflow/jwt-auth-backend:local --name "$cluster_name"

kubectl apply -k "$overlay_dir"
kubectl rollout status deployment/jwt-auth-backend -n nexusflow-staging --timeout=180s
kubectl rollout status deployment/prometheus -n nexusflow-staging --timeout=180s
kubectl rollout status deployment/alertmanager -n nexusflow-staging --timeout=180s
kubectl rollout status deployment/grafana -n nexusflow-staging --timeout=180s

echo "kind staging exercise complete"
echo "next: run kubectl port-forward for jwt-auth-backend/prometheus/grafana if you want interactive checks"
