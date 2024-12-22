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
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "4.5.0"
    }
  }
}

data "pf_kube_labels" "labels" {
  module = "kube_nats"
}

resource "random_id" "id" {
  byte_length = 2
  prefix      = "nats-"
}

module "util" {
  source = "../kube_workload_utility"

  workload_name                        = random_id.id.hex
  controller_nodes_enabled             = var.controller_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  arm_nodes_enabled                    = var.arm_nodes_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = var.instance_type_anti_affinity_required
  az_spread_required                   = true
  lifetime_evictions_enabled           = false
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

locals {
  cluster_name = nonsensitive(random_id.id.hex)
}

/***************************************
* Root Credential Setup
***************************************/

module "cluster_certs" {
  source        = "../kube_internal_cert"
  secret_name   = "${random_id.id.hex}-cluster-certs"
  namespace     = var.namespace
  usages        = ["client auth", "server auth"]
  service_names = [random_id.id.hex]
  duration      = "720h0m0s"
}

module "server_certs" {
  source            = "../kube_internal_cert"
  secret_name       = "${random_id.id.hex}-server-certs"
  namespace         = var.namespace
  usages            = ["server auth"]
  service_names     = [random_id.id.hex]
  include_localhost = true
  duration          = "720h0m0s"
}

/***************************************
* NATS Deployment
***************************************/

resource "helm_release" "nats" {
  namespace       = var.namespace
  name            = random_id.id.hex
  repository      = "oci://registry-1.docker.io/bitnamicharts"
  chart           = "nats"
  version         = var.helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({

      fullnameOverride = random_id.id.hex

      podAnnotations = {
        "config.linkerd.io/opaque-ports" = "4222,6222"
        "linkerd.io/inject"              = "disabled"
      }

      podLabels    = module.util.labels
      commonLabels = data.pf_kube_labels.labels.labels

      replicaCount              = 3 # Always use 3 as this uses RAFT consensus
      resourceType              = "statefulset"
      tolerations               = module.util.tolerations
      topologySpreadConstraints = module.util.topology_spread_constraints
      affinity                  = module.util.affinity
      priorityClassName         = module.constants.workload_important_priority_class_name

      jetstream = {
        enabled = true
      }

      persistence = {
        enabled      = true
        storageClass = var.persistence_storage_class_name
        size         = "${var.persistence_initial_storage_gb}Gi"
        annotations = {
          "resize.topolvm.io/initial-resize-group-by" = "panfactum.com/pvc-group"
        }
      }

      # Data is automatically retained by the storage class and velero backups
      persistentVolumeClaimRetentionPolicy = {
        enabled     = true
        whenScaled  = "Delete"
        whenDeleted = "Delete"
      }

      extraVolumes = [
        {
          name = "cluster-certs"
          secret = {
            secretName  = module.cluster_certs.secret_name
            defaultMode = 288 # 440 in octal
            optional    = false
          }
        },
        {
          name = "server-certs"
          secret = {
            secretName  = module.server_certs.secret_name
            defaultMode = 288 # 440 in octal
            optional    = false
          }
        }
      ]

      extraVolumeMounts = [
        {
          name      = "cluster-certs"
          mountPath = "/etc/cluster-certs"
          readOnly  = true
        },
        {
          name      = "server-certs"
          mountPath = "/etc/server-certs"
          readOnly  = true
        }
      ]

      resources = {
        requests = {
          cpu    = "100m"
          memory = "${var.minimum_memory_mb}Mi"
        }
        limits = {
          memory = "${floor(var.minimum_memory_mb * 1.1)}Mi"
        }
      }

      configuration = templatefile("${path.module}/nats.conf", {
        cluster_name            = local.cluster_name
        debug_logs_enabled      = var.log_level == "debug" || var.log_level == "trace"
        trace_logs_enabled      = var.log_level == "trace"
        max_connections         = var.max_connections
        max_control_line        = var.max_control_line_kb * 1024
        max_payload             = var.max_payload_mb * 1024 * 1024
        write_deadline          = "${var.write_deadline_seconds}s"
        ping_interval           = "${var.ping_interval_seconds}s"
        write_deadline          = "${var.write_deadline_seconds}s"
        sync_interval           = var.fsync_interval_seconds == 0 ? "always" : "${var.fsync_interval_seconds}s"
        max_outstanding_catchup = var.max_outstanding_catchup_mb * 1024 * 1024
        max_file_store          = (var.persistence_storage_limit_gb != null ? var.persistence_storage_limit_gb : var.persistence_initial_storage_gb * 10) * 1024 * 1024 * 1024
      })

      # We use our own
      pdb = {
        create = false
      }
      networkPolicy = {
        enabled = false
      }
      service = {
        labels = data.pf_kube_labels.labels.labels
      }
    })
  ]

  timeout = 60 * 15

  depends_on = [
    kubectl_manifest.sts_fixup,
    kubectl_manifest.pvc_label_policy
  ]
}

resource "kubectl_manifest" "sts_fixup" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "Policy"
    metadata = {
      name      = "${local.cluster_name}-fixup"
      namespace = var.namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      useServerSideApply = true
      rules = [
        {
          name = "add-sts-annotations"
          match = {
            any = [
              {
                resources = {
                  kinds      = ["StatefulSet"]
                  names      = [local.cluster_name]
                  operations = ["CREATE", "UPDATE"]
                }
              }
            ]
          }
          mutate = {
            mutateExistingOnPolicyUpdate = true
            targets = [
              {
                apiVersion = "apps/v1"
                kind       = "StatefulSet"
                name       = local.cluster_name
              }
            ]
            patchStrategicMerge = {
              metadata = {
                annotations = merge(
                  {
                    "panfactum.com/db-type"      = "NATS"
                    "panfactum.com/service"      = "${local.cluster_name}.${var.namespace}.svc.cluster.local"
                    "panfactum.com/service-port" = "4222"
                  },
                  {
                    for role in toset(["superuser", "reader", "admin"]) : "panfactum.com/${role}-role" =>
                    vault_pki_secret_backend_role.pki_roles[role].name
                  }
                )
              }
            }
          }
        },

        // volume claim templates can be updated so we need to remove the labels as they are frequently updated
        {
          name = "replace-sts-volume-claim-template-labels"
          match = {
            any = [
              {
                resources = {
                  kinds      = ["StatefulSet"]
                  names      = [local.cluster_name]
                  operations = ["CREATE", "UPDATE"]
                }
              }
            ]
          }
          mutate = {
            mutateExistingOnPolicyUpdate = false // This cannot be updated after creation
            patchesJson6902 = yamlencode([
              {
                op   = "replace"
                path = "/spec/volumeClaimTemplates/0/metadata/labels"
                value = {
                  "panfactum.com/pvc-group" = "${var.namespace}.${random_id.id.hex}" // This wont change and is required by the autoresizer
                }
              }
            ])
          }
        }
      ]
    }
  })

  force_new         = true
  force_conflicts   = true
  server_side_apply = true
}

resource "kubectl_manifest" "pdb" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = random_id.id.hex
      namespace = var.namespace
      labels = merge(
        module.util.labels,
        var.voluntary_disruption_window_enabled ? {
          "panfactum.com/voluntary-disruption-window-id" = var.voluntary_disruption_window_enabled ? module.disruption_window_controller[0].disruption_window_id : "false"
        } : {}
      )
      annotations = var.voluntary_disruption_window_enabled ? {
        "panfactum.com/voluntary-disruption-window-max-unavailable" = "1"
        "panfactum.com/voluntary-disruption-window-seconds"         = tostring(var.voluntary_disruption_window_seconds)
      } : {}
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util.match_labels
      }
      maxUnavailable = var.voluntary_disruptions_enabled ? (var.voluntary_disruption_window_enabled ? 0 : 1) : 0
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.nats]
  ignore_fields = concat(
    [
      "metadata.annotations.panfactum.com/voluntary-disruption-window-start"
    ],
    var.voluntary_disruption_window_enabled ? [
      "spec.maxUnavailable"
    ] : []
  )
}

resource "kubectl_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = random_id.id.hex
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "StatefulSet"
        name       = random_id.id.hex
      }
      resourcePolicy = {
        containerPolicies = [{
          containerName = "nats"
          minAllowed = {
            memory = "${var.minimum_memory_mb}Mi"
          }
        }]
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.nats]
}

/***************************************
* PVC Annotations
***************************************/

// PVC labels cannot be applied via the STS template
resource "kubectl_manifest" "pvc_label_policy" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "Policy"
    metadata = {
      name      = "${local.cluster_name}-add-pvc-labels"
      namespace = var.namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      useServerSideApply = true
      rules = [{
        name = "add-pvc-group-label"
        match = {
          any = [{
            resources = {
              kinds      = ["PersistentVolumeClaim"]
              names      = ["data-${local.cluster_name}-*"]
              operations = ["CREATE", "UPDATE"]
            }
          }]
        }
        mutate = {
          mutateExistingOnPolicyUpdate = true
          targets = [
            {
              apiVersion = "apps/v1"
              kind       = "StatefulSet"
              name       = "{{ request.object.metadata.name }}"
            }
          ]
          patchStrategicMerge = {
            metadata = {
              labels = data.pf_kube_labels.labels.labels
            }
          }
        }
      }]
    }
  })

  force_new         = true
  force_conflicts   = true
  server_side_apply = true
}

module "pvc_annotator" {
  source = "../kube_pvc_annotator"

  namespace = var.namespace
  config = {
    "${var.namespace}.${random_id.id.hex}" = {
      annotations = {
        "velero.io/exclude-from-backups"  = tostring(!var.persistence_backups_enabled)
        "resize.topolvm.io/storage_limit" = "${var.persistence_storage_limit_gb != null ? var.persistence_storage_limit_gb : var.persistence_initial_storage_gb * 10}Gi"
        "resize.topolvm.io/increase"      = "${var.persistence_storage_increase_gb}Gi"
        "resize.topolvm.io/threshold"     = "${var.persistence_storage_increase_threshold_percent}%"
      }
      labels = module.util.labels
    }
  }
}

/***************************************
* Vault Integration
***************************************/

resource "vault_pki_secret_backend_role" "pki_roles" {
  for_each = toset(["superuser", "reader", "admin"])
  backend  = "pki/internal"
  name     = "nats-${each.key}-${random_id.id.hex}"

  allow_any_name              = false
  allow_wildcard_certificates = false
  enforce_hostnames           = true
  allow_ip_sans               = false
  require_cn                  = false
  allow_bare_domains          = true
  client_flag                 = true
  server_flag                 = false
  allowed_domains             = ["${each.key}-${local.cluster_name}"]

  key_type = "ec"
  key_bits = 256

  max_ttl = 60 * 60 * var.vault_credential_lifetime_hours
}

resource "kubernetes_service_account" "vault_issuer" {
  metadata {
    name      = "issuer-${local.cluster_name}"
    namespace = var.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
}

resource "kubernetes_role" "vault_issuer" {
  metadata {
    name      = kubernetes_service_account.vault_issuer.metadata[0].name
    namespace = var.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
  rule {
    verbs          = ["create"]
    resources      = ["serviceaccounts/token"]
    resource_names = [kubernetes_service_account.vault_issuer.metadata[0].name]
    api_groups     = [""]
  }
}

resource "kubernetes_role_binding" "vault_issuer" {
  metadata {
    name      = kubernetes_service_account.vault_issuer.metadata[0].name
    namespace = var.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = "cert-manager"
    namespace = var.cert_manager_namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.vault_issuer.metadata[0].name
  }
}

data "vault_policy_document" "vault_issuer" {
  dynamic "rule" {
    for_each = toset(["superuser", "reader", "admin"])
    content {
      capabilities = ["create", "read", "update"]
      path         = "${var.vault_internal_pki_backend_mount_path}/sign/${vault_pki_secret_backend_role.pki_roles[rule.key].name}"
    }
  }
}

module "vault_role" {
  source = "../kube_sa_auth_vault"

  service_account           = kubernetes_service_account.vault_issuer.metadata[0].name
  service_account_namespace = var.namespace
  vault_policy_hcl          = data.vault_policy_document.vault_issuer.hcl
  audience                  = "vault://${var.namespace}/${local.cluster_name}"
  token_ttl_seconds         = 120
}

resource "kubectl_manifest" "issuer" {
  for_each = toset(["superuser", "reader", "admin"])
  yaml_body = yamlencode({
    apiVersion = "cert-manager.io/v1"
    kind       = "Issuer"
    metadata = {
      name      = "nats-${each.key}-${local.cluster_name}"
      namespace = var.namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      vault = {
        path   = "${var.vault_internal_pki_backend_mount_path}/sign/${vault_pki_secret_backend_role.pki_roles[each.key].name}"
        server = var.vault_internal_url
        auth = {
          kubernetes = {
            role      = module.vault_role.role_name
            mountPath = "/v1/auth/kubernetes"
            serviceAccountRef = {
              name      = kubernetes_service_account.vault_issuer.metadata[0].name
              audiences = ["vault://${var.namespace}/${local.cluster_name}"]
            }
          }
        }
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
}


module "vault_credentials" {
  for_each = toset(["superuser", "reader", "admin"])
  source   = "../kube_internal_cert"

  secret_name = "${random_id.id.hex}-${each.key}-creds"
  namespace   = var.namespace

  usages            = ["client auth"]
  common_name       = "${each.key}-${local.cluster_name}"
  include_localhost = false

  use_cluster_issuer = false
  issuer_name        = "nats-${each.key}-${local.cluster_name}"

  duration     = "${var.vault_credential_lifetime_hours}h0m0s"
  renew_before = "${floor(var.vault_credential_lifetime_hours / 2)}h0m0s"

  depends_on = [kubectl_manifest.issuer]
}

/***************************************
* Disruption Windows
***************************************/

module "disruption_window_controller" {
  count  = var.voluntary_disruptions_enabled && var.voluntary_disruption_window_enabled ? 1 : 0
  source = "../kube_disruption_window_controller"

  namespace                   = var.namespace
  vpa_enabled                 = var.vpa_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  pull_through_cache_enabled  = var.pull_through_cache_enabled

  cron_schedule = var.voluntary_disruption_window_cron_schedule
}

/***************************************
* Image Cache
***************************************/

module "image_cache" {
  count  = var.node_image_cached_enabled ? 1 : 0
  source = "../kube_node_image_cache"

  images = [
    {
      registry          = "docker.io"
      repository        = "bitnami/nats"
      tag               = "2.10.22-debian-12-r0"
      arm_nodes_enabled = var.arm_nodes_enabled
    }
  ]
}