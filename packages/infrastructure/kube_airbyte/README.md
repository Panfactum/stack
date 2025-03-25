# Airbyte

This module deploys Airbyte onto a Kubernetes cluster with a focus on AWS infrastructure, though it can be adapted for other cloud providers.

## Scope and Connectors

This module only deploys the core Airbyte engine components required for the platform to function. It does not include or configure any source or destination connectors, which must be installed separately after deployment. The Airbyte platform provides a connector catalog within its user interface where administrators can install the specific connectors needed for their data integration workflows.

To install connectors:

1. After deployment, log in to the Airbyte UI using the credentials provided
2. Navigate to the "Sources" or "Destinations" section
3. Search for and install the required connectors from the catalog

For custom connector development, this module includes the Connector Builder Server component (disabled by default), which provides a development environment for creating and testing custom connectors to meet specialized integration needs.

If you need to pre-install specific connectors or automate connector configuration, consider implementing additional Terraform modules that interact with the Airbyte API after core deployment is complete.

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