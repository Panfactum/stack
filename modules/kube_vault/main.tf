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
      source                = "hashicorp/aws"
      version               = "5.10"
      configuration_aliases = [aws.secondary]
    }
  }
}

locals {

  name      = "vault"
  namespace = module.namespace.namespace

  environment = var.environment
  module      = var.module
  version     = var.version_tag

  labels = merge(var.kube_labels, {
    service = local.name
  })

  injector_labels = merge(local.labels, {
    submodule = "injector"
  })

  server_submodule = "server"
  server_labels = merge(local.labels, {
    submodule = local.server_submodule
  })
  server_match = {
    module    = local.module
    submodule = local.server_submodule
  }

  csi_submodule = "csi"
  csi_labels = merge(local.labels, {
    submodule = local.csi_submodule
  })
  csi_match = {
    module    = local.module
    submodule = local.csi_submodule
  }


  vault_domain = "vault.${var.environment_domain}"
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

data "aws_region" "region" {}
data "aws_caller_identity" "id" {}

/***************************************
* Kubernetes Namespace
***************************************/

module "namespace" {
  source            = "../kube_namespace"
  namespace         = local.name
  admin_groups      = ["system:admins"]
  reader_groups     = ["system:readers"]
  bot_reader_groups = ["system:bot-readers"]
  kube_labels       = local.labels
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

/***************************************
* AWS KMS Seal
***************************************/
data "aws_iam_policy_document" "kms" {
  statement {
    sid    = "VaultKMSUnseal"
    effect = "Allow"
    actions = [
      "kms:*"
    ]
    principals {
      identifiers = [
        "arn:aws:iam::${data.aws_caller_identity.id.account_id}:root",
        module.aws_permissions.role_arn
      ]
      type = "AWS"
    }
    resources = ["*"]
  }
}
resource "aws_kms_key" "vault" {
  description              = "vault unseal key for ${var.eks_cluster_name}"
  key_usage                = "ENCRYPT_DECRYPT"
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  deletion_window_in_days  = 30
  is_enabled               = true
  multi_region             = true
  policy                   = data.aws_iam_policy_document.kms.json
}

resource "aws_kms_alias" "alias" {
  target_key_id = aws_kms_key.vault.key_id
  name          = "alias/${var.eks_cluster_name}"
}

resource "aws_kms_replica_key" "replica" {
  provider                = aws.secondary
  primary_key_arn         = aws_kms_key.vault.arn
  description             = "vault unseal key for ${var.eks_cluster_name}"
  deletion_window_in_days = 30
  enabled                 = true
  policy                  = data.aws_iam_policy_document.kms.json
}

resource "aws_kms_alias" "replica_alias" {
  provider      = aws.secondary
  target_key_id = aws_kms_replica_key.replica.key_id
  name          = "alias/${var.eks_cluster_name}"
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
    resources = [aws_kms_key.vault.arn, aws_kms_replica_key.replica.arn]
  }
}

resource "kubernetes_service_account" "vault" {
  metadata {
    name      = local.name
    namespace = local.namespace
    labels    = local.labels
  }
}

module "aws_permissions" {
  source                    = "../kube_sa_auth_aws"
  service_account           = kubernetes_service_account.vault.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.sa.json
  public_outbound_ips       = var.public_outbound_ips
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
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
          extraLabels = local.csi_labels
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
        extraLabels = local.server_labels
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
              kms_key_id   = aws_kms_key.vault.id
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
      labels    = local.injector_labels
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
      labels    = local.server_labels
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

module "ingress" {
  source       = "../kube_ingress"
  namespace    = local.namespace
  kube_labels  = local.server_labels
  ingress_name = local.server_submodule
  ingress_configs = [{
    domains      = [local.vault_domain]
    service      = "vault-active"
    service_port = 8200
  }]
  depends_on = [helm_release.vault]
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}


