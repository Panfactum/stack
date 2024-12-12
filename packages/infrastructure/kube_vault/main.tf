terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    aws = {
      source                = "hashicorp/aws"
      version               = "5.80.0"
      configuration_aliases = [aws.secondary, aws.global]
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.5"
    }
  }
}

locals {
  name         = "vault"
  namespace    = module.namespace.namespace
  cluster_name = data.pf_metadata.metadata.kube_cluster_name
}

data "pf_kube_labels" "labels" {
  module = "kube_vault"
}
data "pf_metadata" "metadata" {}

module "util_server" {
  source = "../kube_workload_utility"

  workload_name                        = "vault"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  az_spread_required                   = true // stateful
  extra_labels                         = data.pf_kube_labels.labels.labels

  # Vault must be scheduled on arm64 nodes as we have installed custom
  # vault plugins and Vault verifies the sha256sum of these binaries before
  # executing them. Unfortunately, only one sha256sum can be assigned to a plugin
  # meaning we can only use a single CPU architecture
  # (as the checksums change depending on whether the binary was compiled for amd64 or arm64).
  # We have chosen to run on arm64 nodes as that is the cheaper architecture on AWS.
  node_requirements = {
    "kubernetes.io/arch" = ["arm64"]
  }
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
}

/***************************************
* AWS KMS Automatic Unseal
***************************************/

module "unseal_key" {
  source = "../aws_kms_encrypt_key"
  providers = {
    aws.secondary = aws.secondary
  }

  name        = "kube-${local.cluster_name}-vault-unseal"
  description = "Vault unseal key for ${local.cluster_name}"

  superuser_iam_arns         = var.superuser_iam_arns
  admin_iam_arns             = var.admin_iam_arns
  reader_iam_arns            = concat([module.aws_permissions.role_arn], var.reader_iam_arns)
  restricted_reader_iam_arns = var.restricted_reader_iam_arns
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
  iam_policy_json           = data.aws_iam_policy_document.sa.json
  ip_allow_list             = var.aws_iam_ip_allow_list
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
        enabled = false
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

        logLevel  = var.log_level
        logFormat = "json"

        image = {
          repository = "${module.constants.images.vault.registry}/${module.constants.images.vault.repository}"
          tag        = module.constants.images.vault.tag
        }
        resources = {
          requests = {
            memory = "200Mi"
          }
          limits = {
            memory = "260Mi"
          }
        }
        statefulSet = {
          annotations = {
            "reloader.stakater.com/auto" = "true"
            "panfactum.com/vault-addr"   = "https://${var.vault_domain}"
          }
        }
        updateStrategyType = "RollingUpdate"
        extraLabels = merge(
          module.util_server.labels,
          {
            customizationHash = md5(join("", [
              for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
            ]))
            "panfactum.com/inject-env-enabled" = "false"
          }
        )
        annotations = {
          // This is required to make the external nats plugin work
          // See https://github.com/linkerd/linkerd2/issues/13364
          // "config.linkerd.io/skip-outbound-ports" = "4222"
        }
        serviceAccount = {
          create = false,
          name   = kubernetes_service_account.vault.metadata[0].name
        }
        service = {
          active = {
            // TODO: This needs to ignore intra-cluster traffic as it causes
            // delays during failovers
            annotations = {
              "retry.linkerd.io/http"    = "5xx"
              "retry.linkerd.io/limit"   = "1"
              "retry.linkerd.io/timeout" = "5s"
            }
          }
        }
        dataStorage = {
          enabled      = true
          size         = "${var.vault_storage_size_gb}Gi"
          mountPath    = "/vault/data"
          storageClass = "ebs-standard-retained"
          labels = {
            "panfactum.com/pvc-group" = "${local.namespace}.vault"
          }
          annotations = {
            "resize.topolvm.io/initial-resize-group-by" = "panfactum.com/pvc-group"
          }
        }
        affinity                  = module.util_server.affinity
        tolerations               = module.util_server.tolerations
        topologySpreadConstraints = module.util_server.topology_spread_constraints
        priorityClassName         = module.constants.cluster_important_priority_class_name # Vault can go down temporarily without disrupting the cluster

        extraEnvironmentVars = {
          AWS_REGION   = data.aws_region.region.name
          AWS_ROLE_ARN = module.aws_permissions.role_arn

          // We noticed very slow startup times once the Vault db exceeds 100Mb.
          // This is due to this issue https://github.com/hashicorp/vault/issues/14635
          // which recommends VAULT_RAFT_FREELIST_SYNC as a solution
          VAULT_RAFT_FREELIST_SYNC = "true"
        }

        ha = {
          enabled  = true
          replicas = 3
          disruptionBudget = {
            enabled = false
          }
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

  timeout    = 60 * 10
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
* PVC Annotator
***************************************/

module "pvc_annotator" {
  source = "../kube_pvc_annotator"

  namespace = local.namespace
  config = {
    "${local.namespace}.vault" = {
      annotations = {
        "resize.topolvm.io/storage_limit" = "${var.vault_storage_limit_gb != null ? var.vault_storage_limit_gb : 10 * var.vault_storage_size_gb}Gi"
        "resize.topolvm.io/increase"      = "${var.vault_storage_increase_gb}Gi"
        "resize.topolvm.io/threshold"     = "${var.vault_storage_increase_threshold_percent}%"
      }
      labels = module.util_server.labels
    }
  }

  depends_on = [helm_release.vault]
}

/***************************************
* Vault Autoscaling
***************************************/

resource "kubectl_manifest" "pdb_server" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "vault"
      namespace = local.namespace
      labels    = module.util_server.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_server.match_labels
      }
      maxUnavailable = 1
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.vault]
}

resource "kubectl_manifest" "vpa_server" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "vault"
      namespace = local.namespace
      labels    = module.util_server.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "vault"
          minAllowed = {
            memory = "200Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "StatefulSet"
        name       = "vault"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.vault]
}

/***************************************
* Vault Ingress
***************************************/

module "ingress" {
  count  = var.ingress_enabled ? 1 : 0
  source = "../kube_ingress"

  namespace = local.namespace
  name      = "vault"
  domains   = [var.vault_domain]
  ingress_configs = [
    {
      service      = "vault-active"
      service_port = 8200
    }
  ]
  cdn_mode_enabled               = var.cdn_mode_enabled
  rate_limiting_enabled          = true
  cross_origin_isolation_enabled = false
  cross_origin_opener_policy     = "same-origin-allow-popups" // Required for SSO logins
  permissions_policy_enabled     = true
  csp_enabled                    = false
  cors_enabled                   = var.cors_enabled
  cors_extra_allowed_origins     = var.cors_extra_allowed_origins

  depends_on = [helm_release.vault]
}

module "cdn" {
  count  = var.ingress_enabled && var.cdn_mode_enabled ? 1 : 0
  source = "../kube_aws_cdn"
  providers = {
    aws.global = aws.global
  }

  name           = "vault"
  origin_configs = module.ingress[0].cdn_origin_configs
}

/***************************************
* Image Cache
***************************************/

module "image_cache" {
  count  = var.node_image_cached_enabled ? 1 : 0
  source = "../kube_node_image_cache"

  images = [
    {
      registry   = module.constants.images.vault.registry
      repository = module.constants.images.vault.repository
      tag        = module.constants.images.vault.tag
    }
  ]
}

