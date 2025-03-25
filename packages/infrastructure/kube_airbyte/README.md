# Terraform Kubernetes Airbyte Module

This module deploys Airbyte onto a Kubernetes cluster with a focus on AWS infrastructure, though it can be adapted for other cloud providers. The module follows the Panfactum module infrastructure pattern.

## Features

- Configurable deployment of Airbyte Community or Enterprise edition
- Support for high availability configurations through SLA targeting
- S3 integration for logs, state, and workload output storage
- PostgreSQL database with backup and recovery capabilities
- Built-in ingress configuration with Vault-based authentication
- Vertical Pod Autoscaler (VPA) support for efficient resource allocation
- Pod Disruption Budgets for high availability guarantees
- Node image caching for faster deployments
- Configurable resource allocation for all Airbyte components

## Usage


```hcl
// to be replaced with actual reference example
module "airbyte" {
  source = "../kube_airbyte"
  
  namespace           = "airbyte"
  domain              = "airbyte.example.com"
  airbyte_helm_version = "1.3.1"
  vault_domain        = "vault.example.com"
  
  # High availability configuration
  sla_target         = 2
  worker_replicas    = 2
  
  # Resource settings
  webapp_memory_request_mb = 512
  server_memory_request_mb = 512
  worker_memory_request_mb = 512
  temporal_memory_request_mb = 512
  
  # Optional features
  connector_builder_enabled = true
  vpa_enabled = true
  monitoring_enabled = true
  
  # Admin configuration
  admin_email = "admin@example.com"
  
  # Database config
  pg_initial_storage_gb = 20
  
  # Additional S3 buckets for destinations
  additional_s3_bucket_arns = [
    "arn:aws:s3:::my-destination-bucket"
  ]
}
```

## Authentication

The module uses Vault for authentication when ingress is enabled, providing secure access to the Airbyte UI.