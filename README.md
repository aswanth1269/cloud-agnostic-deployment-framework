# Policy-Driven Cloud-Agnostic Deployment Framework

A production-like prototype that demonstrates how to prevent vendor lock-in by deploying containerized applications across multiple cloud providers (AWS, Azure, GCP) using a policy-driven approach.

## Problem: Vendor Lock-in

Organizations often become dependent on a single cloud provider's proprietary services and tools, making it difficult and expensive to migrate to another provider. This project solves this by:

- Using declarative policies to select deployment targets
- Supporting multiple cloud providers with the same application code
- Automating deployment decisions based on business requirements

## Architecture Overview

The framework consists of four main components:

1. **Policy Engine**: Reads deployment policies and evaluates cloud selection rules
2. **Cloud Selector**: Deterministic logic for selecting the best cloud provider based on priorities
3. **Deployment Engine**: Orchestrates Docker builds and Kubernetes deployments
4. **CI/CD Pipeline**: Automated build and deployment on code push

## Tech Stack

- **Runtime**: Node.js 18
- **Framework**: Express.js
- **Containerization**: Docker
- **Orchestration**: Kubernetes (Minikube)
- **CI/CD**: GitHub Actions
- **Configuration**: JSON-based policies

## Project Structure

```
cloud-agnostic-deployment-framework/
├── app/
│   ├── server.js           # Express.js demo application
│   └── package.json        # Node.js dependencies
├── policy-engine/
│   ├── policy.json         # Deployment policy configuration
│   ├── policyEngine.js     # Policy evaluation logic
│   └── cloudSelector.js    # Cloud selection algorithm
├── deployment/
│   └── deploy.js           # Kubernetes deployment orchestration
├── docker/
│   └── Dockerfile          # Container image definition
├── k8s/
│   └── deployment.yaml     # Kubernetes manifests
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions CI/CD pipeline
├── README.md               # This file
└── .gitignore              # Git ignore rules
```

## Demo Application

The Express.js server listens on port 3000 and provides:

| Endpoint | Response |
|----------|----------|
| `GET /` | Cloud Agnostic Deployment Framework Demo |
| `GET /health` | `{"status":"running"}` |

### Run Locally

```bash
cd app
npm install
node server.js
```

The server will start on `http://localhost:3000`

## Policy Engine

The policy engine reads a JSON configuration file and evaluates deployment priorities.

### Policy Format

File: `policy-engine/policy.json`

```json
{
  "deployment_policy": {
    "preferred_cloud": "aws",
    "cost_preference": "low",
    "latency_requirement": "low"
  }
}
```

### Policy Parameters

- **preferred_cloud**: Explicit cloud choice (aws | azure | gcp)
- **cost_preference**: Cost priority (low | medium | high)
- **latency_requirement**: Performance priority (low | medium | high)

### Cloud Selection Logic

The `selectCloud(policy)` function implements a priority hierarchy:

**Priority 1: preferred_cloud**
- If `preferred_cloud` is valid (aws, azure, or gcp), it is always selected
- Example: `preferred_cloud: "aws"` → returns "aws"

**Priority 2: cost_preference**
- Only evaluated if `preferred_cloud` is missing or invalid
- Mappings:
  - `low` → gcp (lowest cost)
  - `medium` → azure (medium cost)
  - `high` → aws (premium features)

**Priority 3: latency_requirement**
- Only evaluated if previous priorities don't match
- Mappings:
  - `low` → aws (lowest latency)
  - `medium` → azure
  - `high` → gcp

**Default**: Returns "aws" if no conditions match

### Example Selections

| Policy | Selected Cloud |
|--------|----------------|
| `preferred_cloud: "azure"` | azure (priority 1) |
| `preferred_cloud: "invalid", cost_preference: "low"` | gcp (priority 2) |
| `cost_preference: "medium", latency_requirement: "low"` | azure (priority 2) |

## Deployment Engine

The `deployment/deploy.js` script orchestrates the complete deployment workflow:

### Execution Steps

1. **Read Policy**: Evaluates `policy-engine/policy.json`
2. **Select Cloud**: Determines target cloud provider
3. **Log Decision**: Prints `Policy selected <CLOUD> deployment`
4. **Build Docker**: Creates container image
   ```bash
   docker build -t cloud-demo -f docker/Dockerfile .
   ```
5. **Create Namespace**: Maps cloud to Kubernetes namespace
   - aws → aws
   - azure → azure
   - gcp → gcp
6. **Deploy to Kubernetes**: Applies manifests to selected namespace
   ```bash
   kubectl apply -f k8s/deployment.yaml -n <namespace>
   ```

### Run Deployment

```bash
# From project root
node deployment/deploy.js
```

Output:
```
Policy selected AWS deployment
Running command: docker build -t cloud-demo -f docker/Dockerfile .
Running command: kubectl create namespace aws --dry-run=client -o yaml | kubectl apply -f -
Running command: kubectl apply -f k8s/deployment.yaml -n aws
```

## Docker Setup

File: `docker/Dockerfile`

- Base image: `node:18`
- Copies app files and installs dependencies
- Exposes port 3000
- Runs `node server.js`

The image is tagged as `cloud-demo` and uses `imagePullPolicy: Never` to load from local Minikube.

## Kubernetes Configuration

File: `k8s/deployment.yaml`

Defines two resources:

**Deployment**
- Name: cloud-agnostic-demo
- Replicas: 1
- Container image: cloud-demo
- Container port: 3000
- Image pull policy: Never (uses local Minikube images)

**Service**
- Type: ClusterIP
- Exposes port 80 → container port 3000
- Selector: app: cloud-agnostic-demo

## CI/CD Pipeline

File: `.github/workflows/deploy.yml`

### Trigger

Runs automatically on `push` to the `main` branch.

### Build Steps

1. **Checkout**: Clones the repository
2. **Setup Node.js**: Installs Node.js 18
3. **Install Dependencies**: Runs `npm install` in the app directory
4. **Build Docker Image**: Creates `cloud-demo:latest` image
5. **Success Message**: Confirms completion

### Workflow Definition

```yaml
name: Policy-Driven Deployment Pipeline

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd app && npm install
      - run: docker build -t cloud-demo:latest -f docker/Dockerfile .
      - run: echo "Policy-driven build pipeline completed successfully!"
```

## Complete Setup Instructions

### Prerequisites

- Docker
- Kubernetes (Minikube recommended)
- kubectl CLI
- Node.js 18+
- Git

### Initial Setup

```bash
# Clone repository
git clone https://github.com/your-org/cloud-agnostic-deployment-framework.git
cd cloud-agnostic-deployment-framework

# Install dependencies
cd app && npm install && cd ..

# Start Minikube (if using)
minikube start
```

### Run Demo Application

```bash
cd app
npm start
# Server runs on http://localhost:3000
```

### Run Automated Tests

```bash
# From project root
cd app
npm test
```

The automated suite covers:

- Policy selection priority rules in `policy-engine/cloudSelector.js`
- Policy loading and error handling in `policy-engine/policyEngine.js`
- API endpoint behavior for `/` and `/health`

### Deploy to Kubernetes

```bash
# From project root
node deployment/deploy.js

# Check deployment status
kubectl get deployments -n aws
kubectl get pods -n aws
kubectl get svc -n aws

# View logs
kubectl logs -l app=cloud-agnostic-demo -n aws

# Test health endpoint (port-forward)
kubectl port-forward -n aws svc/cloud-agnostic-demo-service 8080:80
curl http://localhost:8080/health
```

### Test Different Cloud Policies

Edit `policy-engine/policy.json`:

```json
{
  "deployment_policy": {
    "preferred_cloud": "gcp"
  }
}
```

Then redeploy:
```bash
node deployment/deploy.js
# Will deploy to 'gcp' namespace instead
```

## How CI/CD Works

1. **Developer** pushes code to `main` branch
2. **GitHub Actions** automatically triggers the workflow
3. **Build step** runs:
   - Checks out code
   - Sets up Node.js
   - Installs dependencies
  - Runs automated tests
   - Builds Docker image
4. **Success confirmation** is sent
5. **Manual deployment** (optional): Run `node deployment/deploy.js` to deploy to Kubernetes

## Error Handling

The system includes error handling for:

- **Missing policy file**: Throws error if `policy.json` cannot be read
- **Invalid policy structure**: Validates policy object before processing
- **Invalid policy values**: Falls back to default (aws) if values are unrecognized
- **Command failures**: Deployment script prints command output for debugging

## Logging System

The deployment process logs:

- Policy selection decision: `Policy selected <CLOUD> deployment`
- Command execution: `Running command: <command>`
- Error messages: Detailed error descriptions for troubleshooting

## Key Features

✅ **Multi-cloud support** (AWS, Azure, GCP)
✅ **Policy-driven selection** with clear priority rules
✅ **Containerized application** with Docker
✅ **Kubernetes orchestration** with automatic namespace mapping
✅ **Automated CI/CD** with GitHub Actions
✅ **Production-like structure** with modular architecture
✅ **Error handling** for missing or invalid configurations
✅ **Comprehensive logging** of decisions and actions

## Development Workflow

1. Modify application in `app/server.js`
2. Update policy in `policy-engine/policy.json` if needed
3. Commit and push to main branch
4. GitHub Actions builds Docker image automatically
5. Run `node deployment/deploy.js` to deploy to Kubernetes
6. Verify with `kubectl` commands

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Docker image not found | Ensure `docker build` completed successfully |
| Namespace doesn't exist | Deployment script creates namespace automatically |
| Policy file missing | Check `policy-engine/policy.json` exists and is valid JSON |
| kubectl fails | Ensure Minikube is running: `minikube start` |
| Pod won't start | Check image with `minikube image ls` |

## License

MIT

## Author

Cloud-Agnostic Deployment Framework Team

GitHub Actions workflow at .github/workflows/deploy.yml runs on pushes to main and performs:

1. Checkout
2. Node setup
3. Dependency installation
4. Docker image build

## Prototype Outcomes

This system demonstrates:

- containerization
- policy-driven deployment
- simulated multi-cloud targeting through namespaces
- Kubernetes orchestration
- CI/CD automation
