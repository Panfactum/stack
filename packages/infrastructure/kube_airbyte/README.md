# Terraform Kubernetes Airbyte Module

This module deploys Airbyte onto a Kubernetes cluster with a focus on AWS infrastructure, though it can be adapted for other cloud providers. The module follows the Panfactum module infrastructure pattern.

## Features

- Configurable deployment of Airbyte Community or Enterprise edition
- Support for high availability configurations through SLA targeting
- Integration with AWS services (S3 for storage, optional AWS Secrets Manager)
- Built-in ingress configuration with optional CDN support
- Support for external PostgreSQL database or built-in cluster
- Configurable resource allocation for all components
- Vertical Pod Autoscaler (VPA) support
- Pod Disruption Budgets for high availability
- Node image caching for faster deployments

## Usage

```hcl
module "airbyte" {
  source = "../kube_airbyte"
  
  namespace          = "airbyte"
  domain             = "airbyte.example.com"
  airbyte_helm_version = "1.3.1"
  
  # High availability configuration
  sla_target         = 2
  webapp_replicas    = 2
  server_replicas    = 2
  worker_replicas    = 2
  
  # Storage configuration - using S3
  storage_type       = "s3"
  s3_bucket_name     = "my-airbyte-bucket"
  aws_region         = "us-east-1"
  s3_auth_type       = "instanceProfile"
  
  # Ingress configuration
  ingress_enabled    = true
  cdn_mode_enabled   = true
  
  # Resource settings
  webapp_memory_request  = "1Gi"
  webapp_memory_limit    = "2Gi"
  server_memory_request  = "1Gi"
  server_memory_limit    = "2Gi"
  worker_memory_request  = "1Gi"
  worker_memory_limit    = "2Gi"
  
  # Monitoring
  monitoring_enabled = true
  vpa_enabled        = true
}
```

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.0.0 |
| kubernetes | >= 2.10.0 |
| helm | >= 2.5.0 |
| aws | >= 4.0.0 |
| kubectl | >= 1.14.0 |

## AWS Policy Requirements

For S3 storage and secrets management, appropriate IAM policies are required. The following policies are recommended:

### S3 Policy

```json
{
  "Version": "2012-10-17",
  "Statement":
    [
      { "Effect": "Allow", "Action": "s3:ListAllMyBuckets", "Resource": "*" },
      {
        "Effect": "Allow",
        "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
        "Resource": "arn:aws:s3:::YOUR-S3-BUCKET-NAME"
      },
      {
        "Effect": "Allow",
        "Action":
          [
            "s3:PutObject",
            "s3:PutObjectAcl",
            "s3:GetObject",
            "s3:GetObjectAcl",
            "s3:DeleteObject"
          ],
        "Resource": "arn:aws:s3:::YOUR-S3-BUCKET-NAME/*"
      }
    ]
}
```

### Secrets Manager Policy (if using AWS Secrets Manager)

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue",
                "secretsmanager:CreateSecret",
                "secretsmanager:ListSecrets",
                "secretsmanager:DescribeSecret",
                "secretsmanager:TagResource",
                "secretsmanager:UpdateSecret"
            ],
            "Resource": [
                "*"
            ],
            "Condition": {
                "ForAllValues:StringEquals": {
                    "secretsmanager:ResourceTag/AirbyteManaged": "true"
                }
            }
        }
    ]
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| namespace | The namespace to deploy Airbyte into | `string` | `"airbyte"` | no |
| airbyte_edition | The edition of Airbyte to deploy (community or enterprise) | `string` | `"community"` | no |
| airbyte_helm_version | The version of the Airbyte Helm chart to deploy | `string` | `"1.3.1"` | no |
| domain | The domain to access Airbyte (e.g., airbyte.example.com) | `string` | `""` | no |
| sla_target | SLA target level (1-3) affecting high availability settings | `number` | `1` | no |
| storage_type | The type of storage to use (minio, s3, gcs, azure) | `string` | `"minio"` | no |
| s3_bucket_name | The name of the S3 bucket to use for storage | `string` | `""` | no |
| aws_region | The AWS region to use for S3 | `string` | `"us-east-1"` | no |
| s3_auth_type | The authentication method to use for S3 (credentials or instanceProfile) | `string` | `"instanceProfile"` | no |
| external_db_enabled | Whether to use an external database | `bool` | `false` | no |
| ingress_enabled | Whether to enable the ingress for Airbyte | `bool` | `true` | no |
| cdn_mode_enabled | Whether to enable CDN mode for the ingress | `bool` | `false` | no |
| monitoring_enabled | Whether to enable monitoring for Airbyte | `bool` | `false` | no |
| vpa_enabled | Whether to enable Vertical Pod Autoscaler | `bool` | `false` | no |

For a complete list of inputs, see the [variables.tf](variables.tf) file.

## Outputs

| Name | Description |
|------|-------------|
| namespace | The namespace where Airbyte is deployed |
| ingress_domain | The domain configured for Airbyte ingress |
| airbyte_url | The URL to access Airbyte |
| webapp_service_name | The name of the Airbyte webapp service |
| server_service_name | The name of the Airbyte server service |
| database_credentials_secret | The name of the secret containing database credentials |

For a complete list of outputs, see the [outputs.tf](outputs.tf) file.

## Notes

- The module assumes that certain dependencies (like `kube_workload_utility`, `kube_namespace`, `kube_pg_cluster`, etc.) are available in parent directories. These modules provide the infrastructure utilities used by the Airbyte deployment.
- When using S3 storage, make sure the appropriate IAM roles and policies are configured for the Kubernetes cluster.
- For high availability (HA) deployments, set `sla_target` to 2 or 3, and ensure multiple replicas for key components.

## References

- [Airbyte Documentation](https://docs.airbyte.com/deploying-airbyte/)
- [Airbyte Helm Chart](https://github.com/airbytehq/helm-charts)
- [AWS Documentation for S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html)