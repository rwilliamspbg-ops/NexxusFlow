#!/usr/bin/env bash

set -euo pipefail

cluster_name="${1:-nexusflow-staging}"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

require_command kind
require_command kubectl

cd "$repo_root"

if kind get clusters | grep -qx "$cluster_name"; then
  kubectl delete -k deploy/staging/jwt-auth-lab-kind --ignore-not-found=true || true
  kubectl delete -k deploy/staging/jwt-auth-lab-kind-eso --ignore-not-found=true || true
  kubectl wait --for=delete namespace/nexusflow-staging --timeout=180s || true
  kubectl delete namespace nexusflow-secrets --ignore-not-found=true || true
  helm uninstall external-secrets -n external-secrets >/dev/null 2>&1 || true
  kubectl delete namespace external-secrets --ignore-not-found=true || true
  kind delete cluster --name "$cluster_name"
fi

echo "kind staging cleanup complete"
