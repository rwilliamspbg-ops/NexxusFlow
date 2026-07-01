# JWT Lab Staging Deploy

This document defines the current staged deployment target for the JWT lab
runtime.

## Deployment Target

- manifest root: `deploy/staging/jwt-auth-lab`
- registry overlay: `deploy/staging/jwt-auth-lab-ghcr`
- expected namespace: `nexusflow-staging`
- runtime image: `nexusflow/jwt-auth-backend:local` by default for local staging clusters

The current staged target is Kubernetes-oriented and intended for a local staging
cluster such as `kind` or another development Kubernetes environment.

## Preconditions

- a working Kubernetes cluster context
- `kubectl` available locally
- a built backend image:

```bash
make docker-build-jwt-lab
```

If you use `kind`, load the image into the cluster:

```bash
kind load docker-image nexusflow/jwt-auth-backend:local --name <cluster-name>
```

## Managed Secret Injection

The staging manifests now expect the External Secrets Operator CRD and a
`ClusterSecretStore` named `nexusflow-staging-secrets`.

The checked-in `ExternalSecret` requests:

- remote key: `nexusflow/staging/jwt-auth`
- property: `JWT_SECRET`
- target secret: `jwt-auth-runtime-secrets`

Cluster prerequisite:

```bash
kubectl get crd externalsecrets.external-secrets.io
kubectl get clustersecretstore nexusflow-staging-secrets
```

This removes the need to create runtime secrets from local files for staging.

## Apply the Staging Manifests

```bash
kubectl apply -k deploy/staging/jwt-auth-lab
kubectl rollout status deployment/jwt-auth-backend -n nexusflow-staging
kubectl rollout status deployment/prometheus -n nexusflow-staging
kubectl rollout status deployment/alertmanager -n nexusflow-staging
kubectl rollout status deployment/grafana -n nexusflow-staging
```

If you are consuming a CI-published image instead of a locally loaded one, use:

```bash
kubectl apply -k deploy/staging/jwt-auth-lab-ghcr
```

## Access the Services

```bash
kubectl port-forward service/jwt-auth-backend 8080:8080 -n nexusflow-staging
kubectl port-forward service/prometheus 9090:9090 -n nexusflow-staging
kubectl port-forward service/alertmanager 9093:9093 -n nexusflow-staging
kubectl port-forward service/grafana 3000:3000 -n nexusflow-staging
```

Validation checks:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/readyz
curl http://localhost:8080/metrics
open http://localhost:9090
open http://localhost:3000
```

## Rollback

```bash
kubectl delete -k deploy/staging/jwt-auth-lab
kubectl delete secret jwt-auth-runtime-secrets -n nexusflow-staging
```

## Current Limits

- the GHCR overlay depends on the CI publish/sign job running on `main`
- the External Secrets operator and `ClusterSecretStore` are prerequisites, not deployed by this repo
- there is no persistent backing service in this staged target because the JWT lab runtime is currently stateless
