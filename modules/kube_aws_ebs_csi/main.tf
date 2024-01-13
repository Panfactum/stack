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

  service = "aws-ebs-csi-driver"
  namespace = module.namespace.namespace

}

module "kube_labels" {
  source = "../kube_labels"
  additional_labels = {
    service = local.service
  }
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

module "constants" {
  source = "../constants"
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
  source            = "../kube_namespace"
  namespace         = local.service
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
data "aws_region" "main" {}

resource "kubernetes_service_account" "ebs_csi" {
  metadata {
    name      = local.service
    namespace = local.namespace
    labels    = module.kube_labels.kube_labels
  }
}

data "aws_iam_policy_document" "extra_permissions" {
  statement {
    effect = "Allow"
    actions = [
      "kms:Decrypt",
      "kms:GenerateDataKeyWithoutPlaintext",
      "kms:CreateGrant"
    ]
    resources = ["*"]
  }
}

module "aws_permissions" {
  source                    = "../kube_sa_auth_aws"
  service_account           = kubernetes_service_account.ebs_csi.metadata[0].name
  service_account_namespace = kubernetes_service_account.ebs_csi.metadata[0].namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.extra_permissions.json
  public_outbound_ips       = var.public_outbound_ips
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

resource "aws_iam_role_policy_attachment" "default_permissions" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
  role       = module.aws_permissions.role_name
}

/***************************************
* CSI Driver
***************************************/

resource "helm_release" "ebs_csi_driver" {
  namespace       = local.namespace
  name            = local.service
  repository      = "https://kubernetes-sigs.github.io/aws-ebs-csi-driver"
  chart           = "aws-ebs-csi-driver"
  version         = var.aws_ebs_csi_driver_helm_version
  recreate_pods   = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({

      controller = {
        // Does not need to be highly available
        replicaCount = 1
        tolerations  = module.constants.spot_node_toleration_helm
        affinity     = module.constants.controller_node_affinity_helm
        serviceAccount = {
          create                       = false
          name                         = kubernetes_service_account.ebs_csi.metadata[0].name
          autoMountServiceAccountToken = true
        }
      }

      node = {
        serviceAccount = {
          create                       = false
          name                         = kubernetes_service_account.ebs_csi.metadata[0].name
          autoMountServiceAccountToken = true
        }
      }
    })
  ]
  depends_on = [module.aws_permissions]
}

/***************************************
* Storage Classes
***************************************/

resource "kubernetes_storage_class" "standard" {
  metadata {
    name = "ebs-standard"
  }
  storage_provisioner    = "ebs.csi.aws.com"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = true
  reclaim_policy         = "Delete"
  parameters = {
    type      = "gp3"
    encrypted = true
    tagSpecification_1 : "Name={{ .PVCNamespace }}/{{ .PVCName }}"
  }
}

resource "kubernetes_storage_class" "standard_retained" {
  metadata {
    name = "ebs-standard-retained"
  }
  storage_provisioner    = "ebs.csi.aws.com"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = true
  reclaim_policy         = "Retain"
  parameters = {
    type      = "gp3"
    encrypted = true
    tagSpecification_1 : "Name={{ .PVCNamespace }}/{{ .PVCName }}"
  }
}

/***************************************
* VPA
***************************************/

resource "kubernetes_manifest" "vpa_deployment" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "ebs-csi-driver-deployment"
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "ebs-csi-controller"
      }
    }
  }
}

resource "kubernetes_manifest" "vpa_daemonset" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "ebs-csi-driver-daemonset"
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "DaemonSet"
        name       = "ebs-csi-node"
      }
    }
  }
}
