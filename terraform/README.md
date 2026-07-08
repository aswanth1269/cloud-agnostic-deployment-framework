# Real multi-cloud clusters with Terraform

These are starter configurations for provisioning one managed Kubernetes
cluster per cloud. Once a cluster exists, add its kubectl context to your
`.env` (KUBE_CONTEXT_AWS / _AZURE / _GCP) and the framework deploys to the
real cluster instead of the Minikube simulation.

> WARNING: managed clusters cost real money (roughly $70-150/month each for
> control plane + nodes). Destroy them when finished: `terraform destroy`.

## Workflow (same for every cloud)

```bash
cd terraform/aws-eks        # or azure-aks / gcp-gke
terraform init
terraform plan
terraform apply
```

Then fetch the kubeconfig context:

| Cloud | Command |
| ----- | ------- |
| AWS   | `aws eks update-kubeconfig --name cadf-eks --region us-east-1` |
| Azure | `az aks get-credentials --resource-group cadf-rg --name cadf-aks` |
| GCP   | `gcloud container clusters get-credentials cadf-gke --region us-central1` |

List contexts with `kubectl config get-contexts` and copy the names into `.env`:

```bash
KUBE_CONTEXT_AWS=arn:aws:eks:us-east-1:123456789:cluster/cadf-eks
KUBE_CONTEXT_AZURE=cadf-aks
KUBE_CONTEXT_GCP=gke_myproject_us-central1_cadf-gke
```

## Budget alternative

Three small VMs (or free-tier instances) running [k3s](https://k3s.io) give
you three real, distinct clusters for a fraction of the cost. The framework
only needs a kubectl context - it does not care how the cluster was built.
