// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.10.1"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.10"
    }
  }
}

locals {
  name      = "cilium"
  namespace = module.namespace.namespace
}

module "base_labels" {
  source = "../../modules/kube_labels"
  additional_labels = {
    customizationHash = md5(join("", [for filename in fileset(path.module, "cilium_kustomize/*") : filesha256(filename)]))
  }
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

module "operator_labels" {
  source = "../../modules/kube_labels"
  additional_labels = merge(module.base_labels.kube_labels, {service = "operator"})
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

module "agent_labels" {
  source = "../../modules/kube_labels"
  additional_labels = merge(module.base_labels.kube_labels, {service = "agent"})
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

data "aws_region" "region" {}

module "constants" {
  source          = "../../modules/constants"
  matching_labels = module.operator_labels.kube_labels
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

/***************************************
* Namespace
***************************************/

module "namespace" {
  source            = "../../modules/kube_namespace"
  namespace         = local.name
  admin_groups      = ["system:admins"]
  reader_groups     = ["system:readers"]
  bot_reader_groups = ["system:bot-readers"]
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

/***************************************
* AWS Permissions
***************************************/

data "aws_iam_policy_document" "cilium" {
  statement {
    effect = "Allow"
    actions = [
      "ec2:DeleteNetworkInterface",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DescribeSubnets",
      "ec2:DescribeVpcs",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeInstances",
      "ec2:DescribeInstanceTypes",
      "ec2:UnassignPrivateIpAddresses",
      "ec2:CreateNetworkInterface",
      "ec2:AttachNetworkInterface",
      "ec2:ModifyNetworkInterfaceAttribute",
      "ec2:AssignPrivateIpAddresses",
      "ec2:CreateTags",
      "ec2:DescribeTags"
    ]
    resources = ["*"]
  }
}

module "aws_permissions" {
  source                    = "../../modules/kube_sa_auth_aws"
  service_account           = "cilium-operator"
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.cilium.json
  public_outbound_ips       = var.public_outbound_ips
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local

  // The helm chart creates the service account
  annotate_service_account = false
}

resource "kubernetes_annotations" "service_account" {
  api_version = "v1"
  kind        = "ServiceAccount"
  metadata {
    name      = "cilium-operator"
    namespace = local.namespace
  }
  annotations = {
    "eks.amazonaws.com/role-arn" = module.aws_permissions.role_arn
  }
  depends_on = [helm_release.cilium]
}


/***************************************
* Cilium
***************************************/

resource "helm_release" "cilium" {
  namespace       = local.namespace
  name            = "cilium"
  repository      = "https://helm.cilium.io/"
  chart           = "cilium"
  version         = var.cilium_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      eni = {
        enabled = true

        // Required to ensure that all IPs get assigned to a single
        // ENI; otherwise, traffic will get dropped
        // https://github.com/cilium/cilium/issues/19250
        awsEnablePrefixDelegation = true
        awsReleaseExcessIPs       = true
      }
      ipam = {
        mode    = "eni"
        iamRole = module.aws_permissions.role_arn
      }
      egressMasqueradeInterfaces = "eth0"
      routingMode                = "native"

      podLabels = module.base_labels.kube_labels

      policyEnforcementMode = "default"

      // The docs don't state this, but the EKS API IP address
      // shifts so you MUST use the internal EKS API DNS name
      // in order for this to continue to work
      kubeProxyReplacement = true
      k8sServiceHost       = trimprefix(var.eks_cluster_url, "https://")
      k8sServicePort       = 443

      // Enhanced load balancing capabilities
      loadBalancer = {
        serviceTopology = true
        algorithm       = "maglev"
      }

      // Used to facilitate the proper scaling in the cluster autoscaler
      agentNotReadyTaintKey = module.constants.cilium_taint.key

      // Required for Linkerd to work properly
      // See https://linkerd.io/2.13/reference/cluster-configuration/#cilium
      socketLB = {
        hostNamespaceOnly = true
      }

      nodeinit = {
        podLabels = module.agent_labels.kube_labels
      }

      // Add in 1.15.0 as currently hardcoded and requires postrender
      # cni = {
      #   resources = {
      #     cpu = "10m"
      #     memory = "10Mi"
      #   }
      # }

      operator = {
        replicas = 2
        tolerations = [

          // This is needed b/c the cilium agents on each node need the operator
          // to be running in order for them to remove this taint
          {
            key      = module.constants.cilium_taint.key
            operator = "Equal"
            value    = module.constants.cilium_taint.value
            effect   = module.constants.cilium_taint.effect
          }
        ]

        podLabels = module.operator_labels.kube_labels

        affinity = merge(
          module.constants.controller_node_affinity_helm,
          module.constants.pod_anti_affinity_helm
        )

        priorityClassName = "system-cluster-critical"
        extraArgs = [
          "--cluster-name=${var.eks_cluster_name}"
        ]
        extraEnv = [
          { name : "AWS_ROLE_ARN", value = module.aws_permissions.role_arn },
          { name : "AWS_REGION", value = data.aws_region.region.name }
        ]
      }
    })
  ]

    // Be default, the init container
  // has way too many resources and ends up
  // utilizing all of the resource request allocations
  // on each node.
  // Unfortunately, they do node provide a way to modify this via the input
  // variable so we have to do some string manipulation directly.
  postrender {
    binary_path = "${path.module}/cilium_kustomize/kustomize.sh"
  }
}

resource "kubernetes_manifest" "vpa_operator" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "cilium-operator"
      namespace = local.namespace
      labels    = module.operator_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "cilium-operator"
      }
    }
  }
  depends_on = [helm_release.cilium]
}

resource "kubernetes_manifest" "vpa_node" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "cilium-nodes"
      namespace = local.namespace
      labels    = module.agent_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "DaemonSet"
        name       = "cilium"
      }
    }
  }
  depends_on = [helm_release.cilium]
}

resource "kubernetes_manifest" "pdb_operator" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${local.name}-pdb-operator"
      namespace = local.namespace
      labels    = module.operator_labels.kube_labels
    }
    spec = {
      selector = {
        matchLabels = module.operator_labels.kube_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.cilium]
}
