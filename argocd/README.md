# GitOps CD with Argo CD

GitHub Actions handles CI (lint, test, build, scan, push image). Argo CD
handles CD: it watches this repository and continuously reconciles the
kustomize overlay in `k8s/overlays/<cloud>` to the cluster.

## Install Argo CD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

## Register the application

```bash
kubectl apply -f argocd/application.yaml
```

## Policy-aware sync

`npm run sync:argocd` evaluates `policy-engine/policy.json` and rewrites
`application.yaml` so Argo CD tracks the overlay and namespace for the
selected cloud. Commit and push the change - Argo CD does the rest:

```bash
npm run sync:argocd
git add argocd/application.yaml
git commit -m "chore: retarget Argo CD to policy-selected cloud"
git push
```

## Access the Argo CD UI

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
# username: admin
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```
