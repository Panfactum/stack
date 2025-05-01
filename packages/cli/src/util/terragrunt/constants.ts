export const MANAGEMENT_ENVIRONMENT = "management"
export const GLOBAL_REGION = "global"
import panfactumHCL from "@/files/terragrunt/panfactum.hcl" with { type: "file" };
import authentikTftpl from "@/files/terragrunt/providers/authentik.tftpl" with { type: "file" };
import authentikOverrideHCL from "@/files/terragrunt/providers/authentik_override.tf" with { type: "file" };
import awsTftpl from "@/files/terragrunt/providers/aws.tftpl" with { type: "file" };
import awsGlobalTftpl from "@/files/terragrunt/providers/aws_global.tftpl" with { type: "file" };
import awsSecondaryTftpl from "@/files/terragrunt/providers/aws_secondary.tftpl" with { type: "file" };
import helmTftpl from "@/files/terragrunt/providers/helm.tftpl" with { type: "file" };
import kubectlTftpl from "@/files/terragrunt/providers/kubectl.tftpl" with { type: "file" };
import kubectlOverrideTf from "@/files/terragrunt/providers/kubectl_override.tf" with { type: "file" };
import kubernetesTftpl from "@/files/terragrunt/providers/kubernetes.tftpl" with { type: "file" };
import localTf from "@/files/terragrunt/providers/local.tf" with { type: "file" };
import mongodbAtlasTf from "@/files/terragrunt/providers/mongodb_atlas.tf" with { type: "file" };
import pfTftpl from "@/files/terragrunt/providers/pf.tftpl" with { type: "file" };
import pfOverrideTf from "@/files/terragrunt/providers/pf_override.tf" with { type: "file" };
import randomTf from "@/files/terragrunt/providers/random.tf" with { type: "file" };
import timeTf from "@/files/terragrunt/providers/time.tf" with { type: "file" };
import tlsTf from "@/files/terragrunt/providers/tls.tf" with { type: "file" };
import vaultTftpl from "@/files/terragrunt/providers/vault.tftpl" with { type: "file" };

export enum MODULES {
    IAM_IDENTIY_CENTER_PERMISSIONS = "aws_iam_identity_center_permissions",
    AWS_ORGANIZATION = "aws_organization",
    TF_BOOTSTRAP_RESOURCES = "tf_bootstrap_resources",
    AWS_KMS_ENCRYPT_KEY = "aws_kms_encrypt_key",
    AWS_ACCOUNT = "aws_account",
    AWS_EKS = "aws_eks",
    KUBE_BASTION = "kube_bastion",
    AWS_VPC = "aws_vpc",
    AWS_ECR_PULL_THROUGH_CACHE = "aws_ecr_pull_through_cache",
    KUBE_CILIUM = "kube_cilium",
    KUBE_CORE_DNS = "kube_core_dns",
    KUBE_KYVERNO = "kube_kyverno",
    KUBE_POLICIES = "kube_policies",
    KUBE_AWS_EBS_CSI = "kube_aws_ebs_csi",
    KUBE_VAULT = "kube_vault",
    VAULT_CORE_RESOURCES = "vault_core_resources",
    KUBE_LINKERD = "kube_linkerd",
    KUBE_METRICS_SERVER = "kube_metrics_server",
    KUBE_VPA = "kube_vpa",
    KUBE_KARPENTER = "kube_karpenter",
    KUBE_KARPENTER_NODE_POOLS = "kube_karpenter_node_pools",
    KUBE_SCHEDULER = "kube_scheduler",
    KUBE_KEDA = "kube_keda",
    KUBE_EXTERNAL_DNS = "kube_external_dns",
    KUBE_AWS_LB_CONTROLLER = "kube_aws_lb_controller",
    KUBE_EXTERNAL_SNAPSHOTTER = "kube_external_snapshotter",
    KUBE_VELERO = "kube_velero",
    KUBE_NODE_IMAGE_CACHE_CONTROLLER = "kube_node_image_cache_controller",
    KUBE_PVC_AUTORESIZER = "kube_pvc_autoresizer",
    KUBE_RELOADER = "kube_reloader",
    KUBE_DESCHEDULER = "kube_descheduler",
    KUBE_CLOUDNATIVE_PG = "kube_cloudnative_pg",
    KUBE_INGRESS_NGINX = "kube_ingress_nginx",
    AWS_REGISTERED_DOMAINS = "aws_registered_domains",
    AWS_DNS_ZONES = "aws_dns_zones",
    AWS_DNS_RECORDS = "aws_dns_records",
    AWS_DNS_LINKS = "aws_dns_links",
    KUBE_CERTIFICATES = "kube_certificates",
    AWS_SES_DOMAIN = "aws_ses_domain",
    KUBE_AUTHENTIK = "kube_authentik",
    AUTHENTIK_CORE_RESOURCES = "authentik_core_resources"
}

export const TERRAGRUNT_FILES = [
    { path: "panfactum.hcl", contentPath: panfactumHCL },
    { path: "providers/authentik_override.tf", contentPath: authentikOverrideHCL },
    { path: "providers/kubectl.tftpl", contentPath: kubectlTftpl },
    { path: "providers/kubectl_override.tf", contentPath: kubectlOverrideTf },
    { path: "providers/kubernetes.tftpl", contentPath: kubernetesTftpl },
    { path: "providers/local.tf", contentPath: localTf },
    { path: "providers/mongodb_atlas.tf", contentPath: mongodbAtlasTf },
    { path: "providers/pf.tftpl", contentPath: pfTftpl },
    { path: "providers/pf_override.tf", contentPath: pfOverrideTf },
    { path: "providers/random.tf", contentPath: randomTf },
    { path: "providers/time.tf", contentPath: timeTf },
    { path: "providers/tls.tf", contentPath: tlsTf },
    { path: "providers/vault.tftpl", contentPath: vaultTftpl },
    { path: "providers/authentik.tftpl", contentPath: authentikTftpl },
    { path: "providers/aws.tftpl", contentPath: awsTftpl },
    { path: "providers/aws_global.tftpl", contentPath: awsGlobalTftpl },
    { path: "providers/aws_secondary.tftpl", contentPath: awsSecondaryTftpl },
    { path: "providers/helm.tftpl", contentPath: helmTftpl }
] as const