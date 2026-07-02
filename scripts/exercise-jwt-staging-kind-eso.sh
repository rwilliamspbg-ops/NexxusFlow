#!/usr/bin/env bash

set -euo pipefail

cluster_name="${1:-nexusflow-staging}"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
overlay_dir="$repo_root/deploy/staging/jwt-auth-lab-kind-eso"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

require_command kind
require_command kubectl
require_command docker
require_command helm

cd "$repo_root"

if ! kind get clusters | grep -qx "$cluster_name"; then
  kind create cluster --name "$cluster_name"
fi

helm repo add external-secrets https://charts.external-secrets.io >/dev/null 2>&1 || true
helm repo update >/dev/null
helm upgrade --install external-secrets external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace \
  --wait

for _ in $(seq 1 30); do
  if kubectl api-resources --api-group=external-secrets.io | grep -q ExternalSecret; then
    break
  fi
  sleep 2
done

make docker-build-jwt-lab
kind load docker-image nexusflow/jwt-auth-backend:local --name "$cluster_name"

kubectl apply -k "$overlay_dir"
kubectl wait --for=condition=ready pod -n external-secrets -l app.kubernetes.io/name=external-secrets --timeout=180s

for _ in $(seq 1 30); do
  if kubectl get secret jwt-auth-runtime-secrets -n nexusflow-staging >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

kubectl rollout status deployment/jwt-auth-backend -n nexusflow-staging --timeout=180s
kubectl rollout status deployment/prometheus -n nexusflow-staging --timeout=180s
kubectl rollout status deployment/alertmanager -n nexusflow-staging --timeout=180s
kubectl rollout status deployment/grafana -n nexusflow-staging --timeout=180s

echo "kind staging External Secrets exercise complete"
