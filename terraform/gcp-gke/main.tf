# Starter GKE cluster. Set project_id before applying.
terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

variable "project_id" {
  description = "Your GCP project id"
  type        = string
}

variable "region" {
  default = "us-central1"
}

variable "cluster_name" {
  default = "cadf-gke"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_container_cluster" "this" {
  name             = var.cluster_name
  location         = var.region
  initial_node_count = 1
  deletion_protection = false

  node_config {
    machine_type = "e2-small"
    disk_size_gb = 30
  }
}

output "kubeconfig_command" {
  value = "gcloud container clusters get-credentials ${var.cluster_name} --region ${var.region} --project ${var.project_id}"
}
