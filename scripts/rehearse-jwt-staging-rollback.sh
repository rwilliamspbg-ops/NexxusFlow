#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

cd "$repo_root"

bash scripts/exercise-jwt-staging-kind.sh
bash scripts/smoke-jwt-staging-kind.sh

kubectl delete -k deploy/staging/jwt-auth-lab-kind
kubectl wait --for=delete namespace/nexusflow-staging --timeout=180s

echo "kind staging rollback rehearsal complete"
