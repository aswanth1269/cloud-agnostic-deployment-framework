# Argo CD Integration

This folder adds optional GitOps CD for this project.

## What It Does

- Uses Argo CD to continuously sync Kubernetes manifests from this repository.
- Keeps GitHub Actions focused on CI (tests, quality checks).
- Moves deployment reconciliation to Argo CD.
- Syncs Argo CD destination namespace from policy selection (`aws`, `azure`, `gcp`).

## Files

- `application.yaml`: Argo CD Application for syncing `k8s/` from `main`.

## One-Time Setup

Install Argo CD into your cluster:

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

Expose the Argo CD UI (optional):

```bash
kubectl port-forward svc/argocd-server -n argocd 8081:443
```

Default UI URL: `https://localhost:8081`

## Register This Project

Before applying, edit `repoURL` and `namespace` in `application.yaml` for your repository and target namespace.

Apply the application:

```bash
kubectl apply -f argocd/application.yaml
```

Check sync status:

```bash
kubectl get applications -n argocd
kubectl describe application cloud-agnostic-demo -n argocd
```

## Policy-Aware Namespace Sync

Generate/update Argo CD destination namespace from `policy-engine/policy.json`:

```bash
npm run sync:argocd
```

This command evaluates policy rules and updates `argocd/application.yaml` destination namespace.

The main deployment flow (`npm run deploy:k8s`) also performs this sync automatically before applying Kubernetes resources.

## Notes

- The current `destination.namespace` in `application.yaml` is just a starting value.
- Running policy sync updates the namespace to match current policy outcome.
