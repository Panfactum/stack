# packages/infrastructure/ Table of Contents

## Authentik Modules

- `authentik_aws_sso/` - Configures AWS IAM Identity Center as a SAML identity provider in Authentik, enabling SSO for AWS account access.
- `authentik_core_resources/` - Establishes core Authentik resources including authentication flows, stages, and property mappings that support user login and MFA.
- `authentik_github_sso/` - Sets up GitHub as an OAuth2 identity provider in Authentik for federated user authentication.
- `authentik_mongodb_atlas_sso/` - Configures MongoDB Atlas as a SAML identity provider in Authentik, enabling SSO for MongoDB infrastructure access.
- `authentik_vault_sso/` - Integrates HashiCorp Vault with Authentik as a SAML identity provider for centralized secret management authentication.
- `authentik_zoho_sso/` - Configures Zoho as a SAML identity provider in Authentik, allowing Zoho organization authentication.

## AWS Modules

- `aws_account/` - Sets up fundamental AWS account configurations including account alias, contact information, and service quotas.
- `aws_account_permission_binding/` - Maps IAM Identity Center groups to AWS account roles and permission sets for centralized access management.
- `aws_cdn/` - Deploys an AWS CloudFront CDN distribution with SSL/TLS certificates, custom domains, and caching policies.
- `aws_cloudwatch_log_group/` - Creates and configures CloudWatch log groups with retention policies and encryption settings.
- `aws_core_permissions/` - Establishes base IAM permissions and policies required across AWS accounts in the Panfactum framework.
- `aws_delegated_zones/` - Creates Route53 delegation sets and configures DNS zone delegation to subsidiary AWS accounts.
- `aws_dns_iam_role/` - Provisions an IAM role with permissions for managing Route53 DNS records across multiple AWS accounts.
- `aws_dns_links/` - Establishes DNS delegation relationships between parent and child domain zones.
- `aws_dns_records/` - Creates and manages Route53 DNS records within specified zones with support for multiple record types.
- `aws_dns_zones/` - Establishes Route53 hosted zones for domain name resolution and DNS management.
- `aws_dnssec/` - Enables DNSSEC signing for Route53 hosted zones to ensure DNS query integrity and authentication.
- `aws_ecr_public_repos/` - Creates public Amazon ECR repositories for sharing container images publicly.
- `aws_ecr_pull_through_cache/` - Sets up ECR pull-through cache rules for Docker Hub, Quay, GitHub, and other registries to cache and mirror images.
- `aws_ecr_pull_through_cache_addresses/` - Provides the DNS addresses for accessing cached container images from configured upstream registries.
- `aws_ecr_repos/` - Creates and configures private Amazon ECR repositories with lifecycle policies, encryption, and access controls.
- `aws_eks/` - Deploys a fully configured AWS EKS Kubernetes cluster with control plane, node groups, and networking.
- `aws_iam_identity_center_permissions/` - Configures IAM Identity Center permission sets and account assignments for user access management.
- `aws_kms_encrypt_key/` - Creates KMS encryption keys with multi-region replication and rotation policies for data encryption.
- `aws_organization/` - Sets up AWS Organizations structure with master account, member accounts, and organization policies.
- `aws_registered_domains/` - Registers domain names with Route53 domains and configures associated DNS zones.
- `aws_s3_private_bucket/` - Creates private S3 buckets with encryption, versioning, logging, and access restrictions.
- `aws_s3_public_website/` - Deploys S3 buckets configured as static websites with CloudFront distribution and public access.
- `aws_ses_domain/` - Configures SES domain identities with DKIM, SPF, and DMARC records for email sending.
- `aws_vpc/` - Creates a VPC with configurable subnets, internet gateways, NAT gateways, and VPC peering connections.

## Kubernetes Modules

- `kube_airbyte/` - Deploys Airbyte data integration platform into Kubernetes for managing data pipelines.
- `kube_alloy/` - Installs Grafana Alloy observability collector into Kubernetes for telemetry data collection.
- `kube_argo/` - Deploys Argo Workflows into Kubernetes for CI/CD and workflow orchestration.
- `kube_argo_event_bus/` - Sets up Argo EventBus for event-driven workflow triggering and orchestration.
- `kube_argo_event_source/` - Configures Argo EventSource for consuming events from external systems and cloud services.
- `kube_argo_sensor/` - Creates Argo Sensors to trigger workflows based on events from EventSources.
- `kube_authentik/` - Deploys Authentik identity provider into Kubernetes for centralized authentication and authorization.
- `kube_aws_cdn/` - Configures CDN integration for Kubernetes-deployed applications with DNS and certificate management.
- `kube_aws_creds/` - Provisions AWS credentials for Kubernetes workloads using IAM roles and Vault integration.
- `kube_aws_ebs_csi/` - Deploys the AWS EBS CSI driver to enable EBS volume mounting in Kubernetes pods.
- `kube_aws_lb_controller/` - Installs the AWS Load Balancer Controller for provisioning ALB/NLB resources from Kubernetes Ingress.
- `kube_bastion/` - Deploys a bastion host pod in Kubernetes for secure SSH access to private infrastructure.
- `kube_buildkit/` - Sets up BuildKit in Kubernetes for efficient container image building with caching and layer reuse.
- `kube_cert_issuers/` - Configures certificate issuers (ACME, Vault, internal CA) for use with cert-manager in Kubernetes.
- `kube_cert_manager/` - Deploys cert-manager into Kubernetes for automated certificate provisioning and lifecycle management.
- `kube_certificates/` - Requests and manages TLS certificates using configured certificate issuers in Kubernetes.
- `kube_cilium/` - Deploys Cilium as the CNI plugin for Kubernetes networking with advanced network policies.
- `kube_cloudnative_pg/` - Installs CloudNativePG operator into Kubernetes for managing PostgreSQL database clusters.
- `kube_constants/` - Provides constant values and configurations used across other Panfactum Kubernetes modules.
- `kube_core_dns/` - Configures CoreDNS for service discovery and DNS resolution within the Kubernetes cluster.
- `kube_cron_job/` - Creates Kubernetes CronJobs with standard Panfactum configurations for scheduled task execution.
- `kube_daemon_set/` - Deploys Kubernetes DaemonSets with standard Panfactum configurations for node-local workloads.
- `kube_deployment/` - Creates Kubernetes Deployments with standard Panfactum configurations for stateless application workloads.
- `kube_descheduler/` - Deploys the Kubernetes descheduler to optimize pod placement and resource utilization.
- `kube_disruption_window_controller/` - Manages disruption windows to control when pod evictions and maintenance operations are permitted.
- `kube_external_dns/` - Deploys ExternalDNS to automatically manage DNS records based on Kubernetes Ingress and Service resources.
- `kube_external_snapshotter/` - Installs the Kubernetes external snapshotter for managing volume snapshots.
- `kube_gha/` - Deploys GitHub Actions runner controller into Kubernetes for CI/CD with auto-scaling.
- `kube_gha_runners/` - Provisions GitHub Actions self-hosted runner pods in Kubernetes with auto-scaling capabilities.
- `kube_grist/` - Deploys Grist spreadsheet database into Kubernetes for collaborative data management.
- `kube_ingress/` - Creates Kubernetes Ingress resources with TLS, routing rules, and service integration.
- `kube_ingress_nginx/` - Deploys NGINX Ingress Controller into Kubernetes for HTTP(S) load balancing and routing.
- `kube_internal_cert/` - Creates internally-signed certificates for Kubernetes components not requiring public CAs.
- `kube_job/` - Creates Kubernetes Jobs with standard Panfactum configurations for one-off or batch workloads.
- `kube_karpenter/` - Deploys Karpenter autoscaler into Kubernetes for dynamic node management and cost optimization.
- `kube_karpenter_node_pools/` - Configures Karpenter NodePools defining instance types, availability zones, and scaling behaviors.
- `kube_keda/` - Installs KEDA for scaling Kubernetes workloads based on external event-driven metrics.
- `kube_kyverno/` - Deploys Kyverno policy engine into Kubernetes for enforcing security and compliance policies.
- `kube_linkerd/` - Installs Linkerd service mesh into Kubernetes for traffic management, mTLS, and observability.
- `kube_logging/` - Deploys Loki logging stack into Kubernetes for log aggregation and analysis.
- `kube_metrics_server/` - Installs metrics-server into Kubernetes for pod resource usage metrics collection.
- `kube_monitoring/` - Deploys Prometheus and Grafana stacks into Kubernetes for comprehensive monitoring and alerting.
- `kube_namespace/` - Creates Kubernetes namespaces with RBAC roles and resource quotas.
- `kube_nats/` - Deploys NATS message broker into Kubernetes for event streaming and request-response messaging.
- `kube_nlb_common_resources/` - Provisions shared resources for Network Load Balancers in Kubernetes clusters.
- `kube_nocodb/` - Deploys NocoDB into Kubernetes as an open-source Airtable alternative for database management.
- `kube_node_image_cache/` - Caches container images on Kubernetes nodes for faster pod startup times.
- `kube_node_image_cache_controller/` - Manages and maintains the node image cache across the Kubernetes cluster.
- `kube_node_settings/` - Configures Kubernetes node settings for kernel parameters, security policies, and runtime options.
- `kube_open_cost/` - Deploys OpenCost into Kubernetes for cost allocation and monitoring of cloud resources.
- `kube_opensearch/` - Deploys OpenSearch into Kubernetes for search, analytics, and logging.
- `kube_pg_cluster/` - Creates PostgreSQL database clusters using CloudNativePG operator with replication and backups.
- `kube_pod/` - Creates individual Kubernetes Pods with standard Panfactum configurations.
- `kube_policies/` - Applies Panfactum security policies and best-practice Kyverno policies across the cluster.
- `kube_pvc_annotator/` - Annotates persistent volume claims with metadata for resource management and optimization.
- `kube_pvc_autoresizer/` - Automatically resizes persistent volume claims when storage usage reaches configured thresholds.
- `kube_redis_sentinel/` - Deploys Redis with Sentinel for high-availability caching and session management.
- `kube_reloader/` - Installs Reloader to automatically restart pods when ConfigMaps or Secrets are updated.
- `kube_sa_auth_aws/` - Configures Kubernetes service account authentication to AWS using IRSA (IAM Roles for Service Accounts).
- `kube_sa_auth_vault/` - Configures Kubernetes service account authentication to HashiCorp Vault for secret retrieval.
- `kube_sa_auth_workflow/` - Sets up service account authentication for Argo Workflow workloads.
- `kube_scheduler/` - Configures the Kubernetes scheduler with custom scheduling policies and bin-packing optimization.
- `kube_service/` - Creates Kubernetes Services for exposing pod workloads with load balancing and discovery.
- `kube_stateful_set/` - Deploys Kubernetes StatefulSets with standard Panfactum configurations for stateful applications.
- `kube_sync_config_map/` - Synchronizes ConfigMap values from external sources into Kubernetes ConfigMaps.
- `kube_sync_secret/` - Synchronizes Secret values from external sources (e.g., Vault) into Kubernetes Secrets.
- `kube_vault/` - Deploys HashiCorp Vault into Kubernetes for secure secret management and encryption.
- `kube_vault_proxy/` - Installs OAuth2 proxy for Vault UI with Authentik-based authentication in Kubernetes.
- `kube_velero/` - Deploys Velero into Kubernetes for backup and disaster recovery of cluster resources.
- `kube_vpa/` - Installs Vertical Pod Autoscaler into Kubernetes for automatic resource request optimization.
- `kube_workload_utility/` - Provides utility labels, selectors, and common configurations for Kubernetes workload modules.

## Other Modules

- `mongodb_atlas_identity_provider/` - Configures MongoDB Atlas federated authentication using an external identity provider.
- `test_kube_pg_cluster/` - Test module for validating PostgreSQL cluster creation and functionality in Kubernetes.
- `tf_bootstrap_resources/` - Creates S3 and DynamoDB resources required for Terraform state management and locking.
- `vault_auth_oidc/` - Configures OpenID Connect authentication in Vault for user identity federation.
- `vault_core_resources/` - Establishes core Vault resources including secrets engines, auth methods, and RBAC policies.
- `wf_dockerfile_build/` - Creates Argo Workflow templates for building container images from Dockerfiles in git repositories.
- `wf_spec/` - Defines base Argo Workflow specifications and templates for workflow execution in Kubernetes.
- `wf_tf_deploy/` - Creates Argo Workflow templates for deploying Terraform/OpenTofu configurations with state management.
