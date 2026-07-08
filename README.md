# Policy-Driven Cloud-Agnostic Deployment Framework

Deploy anywhere. Locked in nowhere.

Declare what matters — cost, latency, SLA — and a weighted policy engine scores
AWS, Azure and GCP to pick the deployment target. Deploys run as background
jobs with live log streaming into a built-in web dashboard, and the same
manifests work with GitOps (Argo CD) for production-grade continuous delivery.

## Feature overview

| Area | What you get |
| ---- | ------------ |
| Policy engine | Data-driven weighted scoring (`providers.json`), SLA hard-filter, per-decision explanations |
| Web dashboard | React 18 + Three.js 3D hero, Framer Motion animations, deploy form, decision preview, live log streaming (SSE), history |
| API | Async job queue (202 + job id), Server-Sent Events log streaming, JSON deployment history |
| Security | Helmet + strict CSP, API-key auth, rate limiting, spawn-based command execution (no shell injection), input validation |
| Containers | Multi-stage Alpine image, non-root user, healthcheck, `.dockerignore` |
| Kubernetes | Hardened manifests (resources, securityContext, probes, HPA), kustomize base + per-cloud overlays |
| CI/CD | GitHub Actions: lint -> test -> smoke test -> build -> Trivy scan -> push to GHCR; Argo CD for CD |
| Real multi-cloud | kubectl-context targeting per cloud + Terraform starters for EKS / AKS / GKE |

## Quick start (no cluster required)

```bash
git clone https://github.com/aswanth1269/cloud-agnostic-deployment-framework.git
cd cloud-agnostic-deployment-framework
npm install
npm run web:install && npm run web:build   # build the React frontend
npm start
```

Open http://localhost:3000, keep **Dry run** checked, pick an SLA and press
**Deploy**. You get the full policy decision, score breakdown and the exact
commands the framework would run — without needing Docker or Kubernetes.

Run the test suite and linter:

```bash
npm test
npm run lint
```

## Frontend

`web/` is a Vite + React 18 app: a Three.js scene (react-three-fiber) with the
policy-engine core and orbiting cloud nodes, Framer Motion micro-interactions
(split-text hero, count-up stats, 3D tilt cards, magnetic buttons, animated
segmented controls), an SSE-streaming terminal and a live history table.

```bash
npm run web:dev      # dev server on :5173, proxies API to :3000
npm run web:build    # outputs web/dist — Express serves it automatically
```

Express serves `web/dist` when it exists and falls back to the zero-build
vanilla dashboard in `app/public` otherwise, so the API works even without
a frontend build step.

## How a deployment works

```
 policy (cost / latency / SLA / preference)
        |
        v
 policy engine ── scores AWS / Azure / GCP, explains the decision
        |
        v
 job queue ── builds image ── pushes to registry (or loads into Minikube)
        |
        v
 kubectl --context <cloud>  apply -k k8s/overlays/<cloud>     (real cluster)
        └─ or ─ kubectl apply -f k8s/local -n <cloud>          (local simulation)
```

Two target modes, decided per selected cloud:

1. **Real cluster** — if a kubectl context is configured for the selected
   cloud (`KUBE_CONTEXT_AWS` / `_AZURE` / `_GCP` in `.env`), the kustomize
   overlay in `k8s/overlays/<cloud>` is applied to that cluster.
2. **Local simulation** — with no context configured, the image is built
   locally, loaded into Minikube and deployed into a namespace named after
   the cloud. Great for demos; clearly labeled in logs and history.

## Policy engine

Provider characteristics live in `policy-engine/providers.json` — the
selection logic is data, not hardcoded if/else:

```json
{
  "aws":   { "cost_index": 1, "latency_index": 2, "sla": 99.99 },
  "azure": { "cost_index": 2, "latency_index": 3, "sla": 99.95 },
  "gcp":   { "cost_index": 3, "latency_index": 1, "sla": 99.90 }
}
```

Evaluation steps:

1. **SLA filter (hard constraint)** — providers below `sla_requirement` are excluded.
2. **Weighted scoring** — `cost_preference` and `latency_requirement` weights
   (low = 3, medium = 1, high = 0) multiply each provider's rank points;
   a matching `preferred_cloud` adds a bonus; the closest SLA match adds a tiebreaker point.
3. **Selection** — highest score wins. If nothing scores, the catalog default applies.

Every decision returns the scores and a human-readable explanation — visible
in the dashboard, the API response and the deploy logs.

Example outcomes:

| Policy | Selected | Why |
| ------ | -------- | --- |
| `cost_preference: low` | aws | cheapest provider, weight 3 |
| `latency_requirement: low` | gcp | fastest provider, weight 3 |
| `sla_requirement: 99.95` | azure | closest provider meeting the SLA |
| `sla_requirement: 99.99` | aws | only provider meeting the SLA |
| `preferred_cloud: azure` | azure | preference bonus, no stronger rule |
| nothing set | azure | catalog default |

## API reference

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/health` | Liveness probe: `{"status":"running"}` |
| GET | `/api/providers` | Provider catalog, SLA options, whether auth is required |
| POST | `/api/policy/evaluate` | Dry evaluation: selected cloud, scores, explanation |
| POST | `/deploy` | Enqueue a deployment -> `202 { job_id, ... }`. Body: `preferred_cloud`, `cost_preference`, `latency_requirement`, `sla_requirement` (required), `dry_run` |
| GET | `/api/deployments` | Deployment history (newest first) |
| GET | `/api/deployments/:id` | Job detail including logs |
| GET | `/api/deployments/:id/logs` | Server-Sent Events: replays existing lines, then streams live |

When `API_KEY` is set in the environment, `POST /deploy` requires the
`x-api-key` header. Rate limits: 10 deploys/minute, 300 API requests/15 min.

## Configuration

Copy `.env.example` to `.env`. Highlights:

| Variable | Purpose |
| -------- | ------- |
| `API_KEY` | Protects `POST /deploy` (always set in production) |
| `DEPLOY_DRY_RUN` | Default deploy mode |
| `IMAGE_REGISTRY` / `IMAGE_TAG` | Push to a registry (e.g. `ghcr.io/aswanth1269`) instead of Minikube image load |
| `KUBE_CONTEXT_AWS/_AZURE/_GCP` | Real-cluster targeting per cloud |
| `HISTORY_FILE` | Deployment history location (JSON) |

## CI/CD

**CI — `.github/workflows/ci.yml`** (push/PR to main): lint, tests, API smoke
test, then on main: Docker build, Trivy vulnerability scan (fails on CRITICAL),
push to GHCR as `latest` + commit SHA.

**CD — Argo CD** (`argocd/`): Argo CD watches this repo and reconciles
`k8s/overlays/<cloud>` continuously. `npm run sync:argocd` retargets the
Argo application from the current policy. See `argocd/README.md`.

**E2E smoke test — `.github/workflows/deploy.yml`** (manual trigger): boots
Minikube inside the runner and exercises the full policy -> build -> deploy
flow, then verifies the rollout.

## Real multi-cloud clusters

`terraform/` contains starter configs for EKS, AKS and GKE plus a guide for
wiring their kubectl contexts into the framework. Budget option: three k3s
VMs work exactly the same way. See `terraform/README.md`.

## Project structure

```
├── app/
│   ├── server.js          # Express API (helmet, auth, rate limit, SSE)
│   ├── config.js          # env-driven configuration
│   ├── jobs.js            # async deploy job queue + SSE fan-out
│   ├── historyStore.js    # persisted deployment history
│   └── public/            # web dashboard (vanilla JS SPA)
├── policy-engine/
│   ├── providers.json     # provider data + scoring weights
│   ├── cloudSelector.js   # weighted scoring + explanations
│   └── policyEngine.js    # policy file loading / evaluation
├── deployment/
│   ├── deploy.js          # async orchestrator (context or local mode)
│   ├── commandRunner.js   # spawn-based executor (no shell)
│   └── syncArgoFromPolicy.js
├── docker/Dockerfile      # multi-stage, non-root, healthcheck
├── k8s/
│   ├── base/              # hardened manifests + HPA (kustomize base)
│   ├── overlays/{aws,azure,gcp}/
│   └── local/             # Minikube simulation manifest
├── web/                   # React frontend (Vite + R3F + Framer Motion)
├── argocd/                # GitOps application + sync tooling
├── terraform/             # EKS / AKS / GKE starters
├── tests/                 # node:test suite (37 tests)
└── .github/workflows/     # ci.yml + manual e2e smoke test
```

## Production checklist

Done in this repo: async deploys, auth + rate limiting, strict CSP, no shell
interpolation, non-root containers, resource limits, HPA, image scanning,
GitOps split, per-cloud overlays.

Still on you before going live: TLS + Ingress (cert-manager), a real secret
store for `API_KEY`, Postgres instead of the JSON history file if you need
multi-instance, Prometheus metrics, and provisioned clusters (see `terraform/`).

## License

MIT
