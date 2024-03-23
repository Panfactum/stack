// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    aws = {
      source                = "hashicorp/aws"
      version               = "5.39.1"
      configuration_aliases = [aws.secondary]
    }
  }
}

locals {

  name      = "vault"
  namespace = module.namespace.namespace

  server_submodule = "server"
  server_match = {
    pf_root_module = var.pf_root_module
    submodule      = local.server_submodule
  }

  csi_submodule = "csi"
  csi_match = {
    pf_root_module = var.pf_root_module
    submodule      = local.csi_submodule
  }

  vault_domains = [for domain in var.environment_domains : "vault.${domain}"]
}

module "server_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags = merge(var.extra_tags, {
    submodule = local.server_submodule
  })
}

module "csi_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags = merge(var.extra_tags, {
    submodule = local.csi_submodule
  })
}

module "constants" {
  source         = "../constants"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

data "aws_region" "region" {}
data "aws_caller_identity" "id" {}

/***************************************
* Kubernetes Namespace
***************************************/

module "namespace" {
  source         = "../kube_namespace"
  namespace      = local.name
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

/***************************************
* AWS KMS Automatic Unseal
***************************************/

module "unseal_key" {
  source = "../aws_kms_encrypt_key"
  providers = {
    aws.secondary = aws.secondary
  }


  name          = "kube-${var.eks_cluster_name}-vault-unseal"
  description   = "Vault unseal key for ${var.eks_cluster_name}"
  user_iam_arns = [module.aws_permissions.role_arn]


  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}


data "aws_iam_policy_document" "sa" {
  statement {
    sid    = "VaultKMSUnseal"
    effect = "Allow"
    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:DescribeKey",
    ]
    resources = [module.unseal_key.arn, module.unseal_key.arn2]
  }
}

resource "kubernetes_service_account" "vault" {
  metadata {
    name      = local.name
    namespace = local.namespace
    labels    = module.server_labels.kube_labels
  }
}

module "aws_permissions" {
  source                    = "../kube_sa_auth_aws"
  service_account           = kubernetes_service_account.vault.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.sa.json
  ip_allow_list             = var.ip_allow_list
  environment               = var.environment
  pf_root_module            = var.pf_root_module
  region                    = var.region
  is_local                  = var.is_local
  extra_tags                = var.extra_tags
}

/***************************************
* Vault Deployment
***************************************/

resource "helm_release" "vault" {
  namespace       = local.namespace
  name            = "vault"
  repository      = "https://helm.releases.hashicorp.com"
  chart           = "vault"
  version         = var.vault_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({

      global = {
        tlsDisable = true // we use a service mesh for this
      }

      // The injector will not work b/c it creates init
      // sidecar containers which means that the linkerd proxy won't
      // be running yet and thus the sidecar cannot communicate with vault.
      // Instead, we utilize secrets-store-csi-driver-provider-vault
      injector = {
        enabled = false
      }

      csi = {
        enabled = true
        daemonSet = {
          annotations = {
            "reloader.stakater.com/auto" = "true"
          }
        }
        pod = {
          affinity    = module.constants.controller_node_affinity_helm
          tolerations = module.constants.spot_node_toleration_helm
          extraLabels = module.csi_labels.kube_labels
        }
        priorityClassName = "system-node-critical"
      }

      ui = {
        enabled = true
      }

      server = {
        statefulSet = {
          annotations = {
            "reloader.stakater.com/auto" = "true"
          }
        }
        updateStrategyType = "RollingUpdate"
        extraLabels        = module.server_labels.kube_labels
        serviceAccount = {
          create = false,
          name   = kubernetes_service_account.vault.metadata[0].name
        }
        dataStorage = {
          enabled      = true
          size         = "${var.vault_storage_size_gb}Gi"
          mountPath    = "/vault/data"
          storageClass = "ebs-standard-retained"
        }
        affinity = merge({
          podAntiAffinity = {
            requiredDuringSchedulingIgnoredDuringExecution = [{
              labelSelector = {
                matchLabels = local.server_match
              }
              topologyKey : "kubernetes.io/hostname"
            }]
          }
        }, module.constants.controller_node_affinity_helm)
        topologySpreadConstraints = [{
          maxSkew           = 1
          topologyKey       = "topology.kubernetes.io/zone"
          whenUnsatisfiable = "DoNotSchedule"
          labelSelector = {
            matchLabels = local.server_match
          }
        }]
        priorityClassName = "system-cluster-critical"

        extraEnvironmentVars = {
          AWS_REGION   = data.aws_region.region.name
          AWS_ROLE_ARN = module.aws_permissions.role_arn
        }

        ha = {
          enabled  = true
          replicas = 3
          raft = {
            enabled   = true
            setNodeId = true
            config = templatefile("./ha.hcl", {
              aws_region   = data.aws_region.region.name
              kms_key_id   = module.unseal_key.id
              aws_role_arn = module.aws_permissions.role_arn
            })
          }
        }
      }
    })
  ]
  depends_on = [module.aws_permissions]
}

/***************************************
* Vault Autoscaling
***************************************/

resource "kubernetes_manifest" "vpa_csi" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "vault-csi-provider"
      namespace = local.namespace
      labels    = module.csi_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "DaemonSet"
        name       = "vault-csi-provider"
      }
    }
  }
  depends_on = [helm_release.vault]
}

resource "kubernetes_manifest" "vpa_server" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "vault"
      namespace = local.namespace
      labels    = module.server_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "StatefulSet"
        name       = "vault"
      }
    }
  }
  depends_on = [helm_release.vault]
}

/***************************************
* Vault Ingress
***************************************/

#module "ingress" {
#  count        = var.ingress_enabled ? 1 : 0
#  source       = "../kube_ingress"
#  namespace    = local.namespace
#  ingress_name = local.server_submodule
#  ingress_configs = [{
#    domains      = [local.vault_domain]
#    service      = "vault-active"
#    service_port = 8200
#  }]
#  depends_on   = [helm_release.vault]
#  app          = var.app
#  environment  = var.environment
#  module       = var.module
#  region       = var.region
#  version_tag  = var.version_tag
#  version_hash = var.version_hash
#  is_local     = var.is_local
#}


