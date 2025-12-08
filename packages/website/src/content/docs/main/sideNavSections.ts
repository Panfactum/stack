
import { makeModuleDir } from "@/components/layouts/docs/util/makeModuleDir.ts";

import modules from "./modules.json";
import {
  NavIcons,
  type TopLevelDocsSectionMetadata,
} from "../../../components/layouts/docs/types.ts";

export const SIDENAV_SECTIONS: TopLevelDocsSectionMetadata[] = [
  {
    text: "Concepts",
    path: "/concepts",
    icon: NavIcons.lightBulb,
    sub: [
      {
        text: "Infrastructure-as-Code",
        path: "/iac",
      },
      {
        text: "Networking",
        path: "/networking",
        sub: [
          {
            text: "Cryptography",
            path: "/cryptography",
          },
          {
            text: "AWS Network Primitives",
            path: "/aws-primitives",
          },
          {
            text: "Network Address Translation (NAT)",
            path: "/nat",
          },
          {
            text: "Subdomain Delegation",
            path: "/subdomain-delegation",
          },
          {
            text: "Kubernetes Networking",
            path: "/cluster-networking",
          },
        ],
      },
      {
        text: "Autoscaling",
        path: "/autoscaling",
      },
      {
        text: "BuildKit",
        path: "/buildkit",
      },
      {
        text: "CI / CD",
        path: "/cicd",
        sub: [
          {
            text: "Recommended Architecture",
            path: "/recommended-architecture",
          },
          {
            text: "GHA",
            path: "/gha",
          },
        ],
      },
    ],
  },
  {
    text: "Guides",
    path: "/guides",
    icon: NavIcons.book,
    sub: [
      {
        text: "Getting Started",
        path: "/"
      },
      {
        text: "devShell Setup",
        path: "/getting-started",
        sub: [
          {
            text: "Overview",
            path: "/overview",
          },
          {
            text: "Install Tooling",
            path: "/install-tooling",
          },
          {
            text: "Boot Developer Environment",
            path: "/boot-developer-environment",
          },
          {
            text: "Connect to Infrastructure",
            path: "/connect-to-infrastructure",
          },
        ],
      },
      {
        text: "Bootstrapping Guide",
        path: "/bootstrapping",
        sub: [
          {
            text: "Overview",
            path: "/overview",
          },
          {
            text: "Installing the Development Shell",
            path: "/installing-devshell",
          },
          {
            text: "Preparing AWS",
            path: "/preparing-aws",
          },
          {
            text: "Configuring IaC",
            path: "/configuring-infrastructure-as-code",
          },
          {
            text: "Bootstrapping IaC",
            path: "/infrastructure-as-code",
          },
          {
            text: "DNS",
            path: "/dns",
          },
          {
            text: "AWS Networking",
            path: "/aws-networking",
          },
          {
            text: "Kubernetes Cluster",
            path: "/kubernetes-cluster",
          },
          {
            text: "Internal Cluster Networking",
            path: "/internal-cluster-networking",
          },
          {
            text: "Policy Controller",
            path: "/policy-controller",
          },
          {
            text: "Storage Interfaces",
            path: "/storage-interfaces",
          },
          {
            text: "Vault",
            path: "/vault",
          },
          {
            text: "Certificate Management",
            path: "/certificate-management",
          },
          {
            text: "Service Mesh",
            path: "/service-mesh",
          },
          {
            text: "Autoscaling",
            path: "/autoscaling",
          },
          {
            text: "Inbound Networking",
            path: "/inbound-networking",
          },
          {
            text: "Maintenance Controllers",
            path: "/maintenance-controllers",
          },
          {
            text: "Databases",
            path: "/databases",
          },
          {
            text: "Identity Provider",
            path: "/identity-provider",
          },
          {
            text: "Federated Auth",
            path: "/federated-auth",
          },
          {
            text: "Review and Next Steps",
            path: "/next-steps",
          },
        ],
      },
      {
        text: "Stack Addons",
        path: "/addons",
        sub: [
          {
            text: "Overview",
            path: "/overview",
          },
          {
            text: "Workflow Engine",
            path: "/workflow-engine",
            sub: [
              {
                text: "Installing",
                path: "/installing",
              },
              {
                text: "Creating Workflows",
                path: "/creating-workflows",
              },
              {
                text: "Triggering Workflows",
                path: "/triggering-workflows",
              },
              {
                text: "Prebuilt Workflows",
                path: "/prebuilt-workflows",
              },
              {
                text: "Debugging",
                path: "/debugging",
              },
            ],
          },
          {
            text: "Event Bus",
            path: "/event-bus",
            sub: [
              {
                text: "Installing",
                path: "/installing",
              },
              {
                text: "Use Cases",
                path: "/use-cases",
              },
            ],
          },
          {
            text: "BuildKit",
            path: "/buildkit",
            sub: [
              {
                text: "Installing",
                path: "/installing",
              },
              {
                text: "Building Images",
                path: "/building-images",
              },
              {
                text: "Debugging",
                path: "/debugging",
              },
            ],
          },
          {
            text: "GitHub Actions",
            path: "/github-actions",
            sub: [
              {
                text: "Installing",
                path: "/installing",
              },
            ],
          },
        ],
      },
      {
        text: "Development Shell",
        path: "/development-shell",
        sub: [
          {
            text: "Customizing",
            path: "/customizing",
          },
          {
            text: "Debugging",
            path: "/debugging",
          },
        ],
      },
      {
        text: "Infrastructure-as-Code",
        path: "/iac",
        sub: [
          {
            text: "Overview",
            path: "/overview",
          },
          {
            text: "Repository Setup",
            path: "/repo-setup",
          },
          {
            text: "Deploying Modules",
            path: "/deploying-modules",
          },
          {
            text: "Developing First-Party Modules",
            path: "/first-party-modules",
          },
          {
            text: "Extending Panfactum Configuration",
            path: "/extending-panfactum",
          },
          {
            text: "Debugging",
            path: "/debugging",
          },
        ],
      },
      {
        text: "Deploying Workloads",
        path: "/deploying-workloads",
        sub: [
          {
            text: "Basics",
            path: "/basics",
          },
          {
            text: "Networking",
            path: "/networking",
          },
          {
            text: "Persistence",
            path: "/persistence",
          },
          {
            text: "High Availability",
            path: "/high-availability",
          },
          {
            text: "Permissions",
            path: "/permissions",
          },
          {
            text: "Checklist",
            path: "/checklist",
          },
        ],
      },
      {
        text: "CI / CD",
        path: "/cicd",
        sub: [
          {
            text: "Getting Started",
            path: "/getting-started",
          },
          {
            text: "Checking Out Code",
            path: "/checking-out-code",
          },
          {
            text: "Rolling Deployments",
            path: "/rolling-deployments",
          },
        ],
      },
      {
        text: "Networking",
        path: "/networking",
        sub: [
          {
            text: "SSH Tunneling",
            path: "/ssh-tunnel",
          },
          {
            text: "Database Connections",
            path: "/database-connections",
          },
        ],
      },
      {
        text: "User Management",
        path: "/user-management",
        sub: [
          {
            text: "Provisioning",
            path: "/provisioning-new-user",
          },
          {
            text: "New User Setup",
            path: "/setting-up-new-user",
          },
        ],
      },
      {
        text: "Panfactum Versioning",
        path: "/versioning",
        sub: [
          {
            text: "Releases",
            path: "/releases",
          },
          {
            text: "Pinning",
            path: "/pinning",
          },
          {
            text: "Upgrading",
            path: "/upgrading",
            sub: [
              {
                text: "General Guide",
                path: "/general",
              },
            ],
          },
        ],
      },
      {
        text: "Contributing",
        path: "/contributing",
        sub: [
          {
            text: "Getting Started",
            path: "/getting-started",
          },
          {
            text: "Pull Requests",
            path: "/pull-requests",
          },
          {
            text: "Releasing",
            path: "/releasing",
          },
        ],
      },
    ],
  },
  {
    text: "Modules",
    path: "/modules",
    icon: NavIcons.book,
    sub: [
      {
        text: "Airbyte",
        path: "/kube_airbyte",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Alloy",
        path: "/kube_alloy",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Argo",
        path: "/kube_argo",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Argo Event Bus",
        path: "/kube_argo_event_bus",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Argo Event Source",
        path: "/kube_argo_event_source",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Argo Sensor",
        path: "/kube_argo_sensor",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Authentik",
        path: "/kube_authentik",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Authentik AWS SSO",
        path: "/authentik_aws_sso",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Authentik Core Resources",
        path: "/authentik_core_resources",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Authentik GitHub SSO",
        path: "/authentik_github_sso",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Authentik MongoDB Atlas SSO",
        path: "/authentik_mongodb_atlas_sso",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Authentik Vault SSO",
        path: "/authentik_vault_sso",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Authentik Zoho SSO",
        path: "/authentik_zoho_sso",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS Account",
        path: "/aws_account",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS Account Permission Binding",
        path: "/aws_account_permission_binding",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS CDN",
        path: "/aws_cdn",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS CloudWatch Log Group",
        path: "/aws_cloudwatch_log_group",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS Core Permissions",
        path: "/aws_core_permissions",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS Credentials",
        path: "/kube_aws_creds",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS Delegated Zones",
        path: "/aws_delegated_zones",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS DNS IAM Role",
        path: "/aws_dns_iam_role",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS DNS Links",
        path: "/aws_dns_links",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS DNS Records",
        path: "/aws_dns_records",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS DNS Zones",
        path: "/aws_dns_zones",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS DNSSEC",
        path: "/aws_dnssec",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS EBS CSI",
        path: "/kube_aws_ebs_csi",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS ECR Public Repos",
        path: "/aws_ecr_public_repos",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS ECR Pull Through Cache",
        path: "/aws_ecr_pull_through_cache",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS ECR Pull Through Cache Addresses",
        path: "/aws_ecr_pull_through_cache_addresses",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS ECR Repos",
        path: "/aws_ecr_repos",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS EKS",
        path: "/aws_eks",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS IAM Identity Center Permissions",
        path: "/aws_iam_identity_center_permissions",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS KMS Encrypt Key",
        path: "/aws_kms_encrypt_key",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS Load Balancer Controller",
        path: "/kube_aws_lb_controller",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS Organization",
        path: "/aws_organization",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS Registered Domains",
        path: "/aws_registered_domains",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS S3 Private Bucket",
        path: "/aws_s3_private_bucket",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS S3 Public Website",
        path: "/aws_s3_public_website",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS SES Domain",
        path: "/aws_ses_domain",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "AWS VPC",
        path: "/aws_vpc",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Bastion",
        path: "/kube_bastion",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "BuildKit",
        path: "/kube_buildkit",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Certificate Issuers",
        path: "/kube_cert_issuers",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Certificate Manager",
        path: "/kube_cert_manager",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Certificates",
        path: "/kube_certificates",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Cilium",
        path: "/kube_cilium",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "CloudNativePG",
        path: "/kube_cloudnative_pg",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Constants",
        path: "/kube_constants",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "CoreDNS",
        path: "/kube_core_dns",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Cron Job",
        path: "/kube_cron_job",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Daemon Set",
        path: "/kube_daemon_set",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Deployment",
        path: "/kube_deployment",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Descheduler",
        path: "/kube_descheduler",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Disruption Window Controller",
        path: "/kube_disruption_window_controller",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Dockerfile Build Workflow",
        path: "/wf_dockerfile_build",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "External DNS",
        path: "/kube_external_dns",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "External Snapshotter",
        path: "/kube_external_snapshotter",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "GitHub Actions",
        path: "/kube_gha",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "GitHub Actions Runners",
        path: "/kube_gha_runners",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Grist",
        path: "/kube_grist",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Ingress",
        path: "/kube_ingress",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Ingress NGINX",
        path: "/kube_ingress_nginx",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Internal Certificate",
        path: "/kube_internal_cert",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Job",
        path: "/kube_job",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Karpenter",
        path: "/kube_karpenter",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Karpenter Node Pools",
        path: "/kube_karpenter_node_pools",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "KEDA",
        path: "/kube_keda",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Kubernetes AWS CDN",
        path: "/kube_aws_cdn",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Kyverno",
        path: "/kube_kyverno",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Linkerd",
        path: "/kube_linkerd",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Logging",
        path: "/kube_logging",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Metrics Server",
        path: "/kube_metrics_server",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "MongoDB Atlas Identity Provider",
        path: "/mongodb_atlas_identity_provider",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Monitoring",
        path: "/kube_monitoring",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Namespace",
        path: "/kube_namespace",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "NATS",
        path: "/kube_nats",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "NLB Common Resources",
        path: "/kube_nlb_common_resources",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "NocoDB",
        path: "/kube_nocodb",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Node Image Cache",
        path: "/kube_node_image_cache",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Node Image Cache Controller",
        path: "/kube_node_image_cache_controller",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Node Settings",
        path: "/kube_node_settings",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "OpenCost",
        path: "/kube_open_cost",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "OpenSearch",
        path: "/kube_opensearch",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Pod",
        path: "/kube_pod",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Policies",
        path: "/kube_policies",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "PostgreSQL Cluster",
        path: "/kube_pg_cluster",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "PVC Annotator",
        path: "/kube_pvc_annotator",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "PVC Autoresizer",
        path: "/kube_pvc_autoresizer",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Redis Sentinel",
        path: "/kube_redis_sentinel",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Reloader",
        path: "/kube_reloader",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Scheduler",
        path: "/kube_scheduler",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Service",
        path: "/kube_service",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Service Account Auth AWS",
        path: "/kube_sa_auth_aws",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Service Account Auth Vault",
        path: "/kube_sa_auth_vault",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Service Account Auth Workflow",
        path: "/kube_sa_auth_workflow",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Stateful Set",
        path: "/kube_stateful_set",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Sync ConfigMap",
        path: "/kube_sync_config_map",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Sync Secret",
        path: "/kube_sync_secret",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Terraform Bootstrap Resources",
        path: "/tf_bootstrap_resources",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Terraform Deploy Workflow",
        path: "/wf_tf_deploy",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Test PostgreSQL Cluster",
        path: "/test_kube_pg_cluster",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Vault",
        path: "/kube_vault",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Vault Auth OIDC",
        path: "/vault_auth_oidc",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Vault Core Resources",
        path: "/vault_core_resources",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Vault Proxy",
        path: "/kube_vault_proxy",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Velero",
        path: "/kube_velero",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Vertical Pod Autoscaler",
        path: "/kube_vpa",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Workload Utility",
        path: "/kube_workload_utility",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
      {
        text: "Workflow Spec",
        path: "/wf_spec",
        sub: [
          { text: "Overview", path: "/overview" },
          { text: "Reference", path: "/reference" },
        ],
      },
    ],
  },
  {
    text: "Reference",
    path: "/reference",
    icon: NavIcons.analyze,
    sub: [
      {
        text: "Configuration",
        path: "/configuration",
        sub: [
          {
            text: "Repository Variables",
            path: "/repo-variables",
          },
          {
            text: ".env Variables",
            path: "/dotenv",
          },
          {
            text: "Terragrunt Variables",
            path: "/terragrunt-variables",
          },
          {
            text: "SSH Config Files",
            path: "/ssh",
          },
          {
            text: "AWS Config Files",
            path: "/aws",
          },
          {
            text: "BuildKit Config Files",
            path: "/buildkit",
          },
        ],
      },
      {
        text: "Infrastructure Modules",
        path: "/infrastructure-modules",
        sub: [
          {
            text: "Overview",
            path: "/overview",
          },
          {
            text: "Direct Modules",
            path: "/direct",
            sub: [
              {
                text: "AWS",
                path: "/aws",
                sub: makeModuleDir(modules.modules, "aws", "direct"),
              },
              {
                text: "Authentik",
                path: "/authentik",
                sub: makeModuleDir(modules.modules, "authentik", "direct"),
              },
              {
                text: "Kubernetes",
                path: "/kubernetes",
                sub: makeModuleDir(modules.modules, "kubernetes", "direct"),
              },
              {
                text: "Vault",
                path: "/vault",
                sub: makeModuleDir(modules.modules, "vault", "direct"),
              },
            ],
          },
          {
            text: "Submodules",
            path: "/submodule",
            sub: [
              {
                text: "AWS",
                path: "/aws",
                sub: makeModuleDir(modules.modules, "aws", "submodule"),
              },
              {
                text: "Kubernetes",
                path: "/kubernetes",
                sub: makeModuleDir(modules.modules, "kubernetes", "submodule"),
              },
              {
                text: "Workflows",
                path: "/workflow",
                sub: makeModuleDir(modules.modules, "workflow", "submodule"),
              },
            ],
          },
        ],
      },
      {
        text: "Resource Tags",
        path: "/resource-tags",
      },
      {
        text: "RBAC",
        path: "/rbac",
      },
    ],
  }
];
