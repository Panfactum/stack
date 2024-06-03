terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
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
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
  }
}

locals {
  name      = "vault"
  namespace = module.namespace.namespace
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "util_server" {
  source                                = "../kube_workload_utility"
  workload_name                         = "vault"
  burstable_nodes_enabled               = true
  instance_type_anti_affinity_preferred = true
  topology_spread_strict                = true

  # generate: common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

module "util_csi" {
  source                                = "../kube_workload_utility"
  workload_name                         = "vault-csi"
  burstable_nodes_enabled               = true
  instance_type_anti_affinity_preferred = true

  # generate: common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

module "constants" {
  source = "../kube_constants"
}

data "aws_region" "region" {}
data "aws_caller_identity" "id" {}

/***************************************
* Kubernetes Namespace
***************************************/

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

/***************************************
* AWS KMS Automatic Unseal
***************************************/

module "unseal_key" {
  source = "../aws_kms_encrypt_key"
  providers = {
    aws.secondary = aws.secondary
  }


  name        = "kube-${var.eks_cluster_name}-vault-unseal"
  description = "Vault unseal key for ${var.eks_cluster_name}"


  superuser_iam_arns         = var.superuser_iam_arns
  admin_iam_arns             = var.admin_iam_arns
  reader_iam_arns            = concat([module.aws_permissions.role_arn], var.reader_iam_arns)
  restricted_reader_iam_arns = var.restricted_reader_iam_arns

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
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
    labels    = module.util_server.labels
  }
}

module "aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.vault.metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.sa.json
  ip_allow_list             = var.aws_iam_ip_allow_list

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
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
  max_history     = 5

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
        image = {
          repository = "${var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"}/hashicorp/vault-csi-provider"
        }
        resources = {
          requests = {
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
          }
        }
        agent = {
          image = {
            repository = "${var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"}/hashicorp/vault"
            tag        = var.vault_image_tag
          }
          resources = {
            requests = {
              memory = "100Mi"
            }
            limits = {
              memory = "130Mi"
            }
          }
        }
        daemonSet = {
          annotations = {
            "reloader.stakater.com/auto" = "true"
          }
        }
        pod = {
          tolerations = module.util_csi.tolerations
          extraLabels = module.util_csi.labels
        }
        priorityClassName = "system-node-critical"
      }

      ui = {
        enabled = true
      }

      serverTelemetry = {
        serviceMonitor = {
          enabled  = var.monitoring_enabled
          interval = "60s"
        }
        prometheusRules = {
          enabled = var.monitoring_enabled
        }
      }

      server = {
        image = {
          repository = "${var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"}/hashicorp/vault"
          tag        = var.vault_image_tag
        }
        resources = {
          requests = {
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
          }
        }
        statefulSet = {
          annotations = {
            "reloader.stakater.com/auto" = "true"
            "panfactum.com/vault-addr"   = "https://${var.vault_domain}"
          }
        }
        updateStrategyType = "RollingUpdate"
        extraLabels        = module.util_server.labels
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
        affinity                  = module.util_server.affinity
        tolerations               = module.util_server.tolerations
        topologySpreadConstraints = module.util_server.topology_spread_constraints
        priorityClassName         = module.constants.cluster_important_priority_class_name # Vault can go down temporarily without disrupting the cluster

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

resource "kubernetes_config_map" "dashboard" {
  count = var.monitoring_enabled ? 1 : 0
  metadata {
    name   = "vault-dashboard"
    labels = merge(module.util_server.labels, { "grafana_dashboard" = "1" })
  }
  data = {
    "vault.json" = file("${path.module}/dashboard.json")
  }
}

/***************************************
* Vault Autoscaling
***************************************/

resource "kubernetes_annotations" "vault_pvc" {
  count       = 3
  api_version = "v1"
  kind        = "PersistentVolumeClaim"
  metadata {
    name      = "data-vault-${count.index}"
    namespace = local.namespace
  }
  annotations = {
    "resize.topolvm.io/storage_limit" = "${var.vault_storage_limit_gb != null ? var.vault_storage_limit_gb : 10 * var.vault_storage_size_gb}Gi"
    "resize.topolvm.io/increase"      = "${var.vault_storage_increase_percent}%"
    "resize.topolvm.io/threshold"     = "${var.vault_storage_increase_threshold_percent}%"
  }
  force = true

  depends_on = [helm_release.vault]
}

resource "kubernetes_manifest" "vpa_csi" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "vault-csi-provider"
      namespace = local.namespace
      labels    = module.util_csi.labels
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
      labels    = module.util_server.labels
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
  count  = var.ingress_enabled ? 1 : 0
  source = "../kube_ingress"

  namespace = local.namespace
  name      = "vault"
  ingress_configs = [{
    domains      = [var.vault_domain]
    service      = "vault-active"
    service_port = 8200
  }]
  rate_limiting_enabled          = true
  cross_origin_isolation_enabled = false
  cross_origin_opener_policy     = "same-origin-allow-popups" // Required for SSO logins
  permissions_policy_enabled     = true
  csp_enabled                    = false

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate

  depends_on = [helm_release.vault]
}


