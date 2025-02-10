// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "4.5.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.10.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

locals {
  name      = "argo"
  namespace = module.namespace.namespace

  configmap_name = "argo-controller"
}

data "aws_region" "current" {}

data "pf_kube_labels" "labels" {
  module = "kube_argo"
}

module "util_controller" {
  source                               = "../kube_workload_utility"
  workload_name                        = "argo-controller"
  host_anti_affinity_required          = false // single instance
  instance_type_anti_affinity_required = false // single instance
  az_spread_preferred                  = false // single instance
  az_spread_required                   = false // single instance
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_server" {
  source                               = "../kube_workload_utility"
  workload_name                        = "argo-server"
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  az_spread_preferred                  = var.sla_target >= 2
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_events_controller" {
  source                               = "../kube_workload_utility"
  workload_name                        = "argo-events-controller"
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  host_anti_affinity_required          = false // single instance
  instance_type_anti_affinity_required = false // single instance
  az_spread_preferred                  = false // single instance
  az_spread_required                   = false // single instance
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_webhook" {
  source                               = "../kube_workload_utility"
  workload_name                        = "argo-webhook"
  host_anti_affinity_required          = var.sla_target >= 2
  instance_type_anti_affinity_required = var.sla_target == 3
  az_spread_preferred                  = var.sla_target >= 2
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

/***************************************
* Kubernetes Namespace
***************************************/

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name
}

/***************************************
* Vault IdP Setup
***************************************/

resource "vault_identity_oidc_key" "argo" {
  name               = "argo"
  allowed_client_ids = ["*"]
  rotation_period    = 60 * 60 * 8
  verification_ttl   = 60 * 60 * 24
}

data "vault_identity_group" "rbac_groups" {
  for_each   = toset(["rbac-superusers", "rbac-admins", "rbac-readers", "rbac-restricted-readers"])
  group_name = each.key
}

resource "vault_identity_oidc_assignment" "argo" {
  name      = "argo"
  group_ids = [for group in data.vault_identity_group.rbac_groups : group.id]
}

resource "vault_identity_oidc_client" "argo" {
  name = "argo"
  key  = vault_identity_oidc_key.argo.name
  redirect_uris = [
    "https://${var.argo_domain}/oauth2/callback"
  ]
  assignments = [
    vault_identity_oidc_assignment.argo.name
  ]
  id_token_ttl     = 60 * 60 * 8
  access_token_ttl = 60 * 60 * 8
}

resource "vault_identity_oidc_scope" "groups" {
  name        = "groups"
  template    = "{\"groups\": {{identity.entity.groups.names}}}" // This MUST be this exact string (not JSON-encoded)
  description = "Groups scope"
}

resource "vault_identity_oidc_provider" "argo" {
  name          = "argo"
  https_enabled = true
  issuer_host   = var.vault_domain
  allowed_client_ids = [
    vault_identity_oidc_client.argo.client_id
  ]
  scopes_supported = [
    vault_identity_oidc_scope.groups.name
  ]
}

/***************************************
* S3 Artifact Repository
***************************************/

resource "random_id" "bucket_name" {
  byte_length = 8
  prefix      = "argo-"
}

module "artifact_bucket" {
  source      = "../aws_s3_private_bucket"
  bucket_name = random_id.bucket_name.hex
  description = "Artifact repository for Argo"

  intelligent_transitions_enabled = true
}

data "aws_iam_policy_document" "argo" {
  statement {
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject"
    ]
    resources = ["${module.artifact_bucket.bucket_arn}/*"]
  }
  statement {
    effect = "Allow"
    actions = [
      "s3:ListBucket"
    ]
    resources = [module.artifact_bucket.bucket_arn]
  }
  statement {
    effect = "Allow"
    actions = [
      "s3:GetBucketLocation"
    ]
    resources = ["arn:aws:s3:::*"]
  }
}

module "aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.argo_server.metadata[0].name
  service_account_namespace = local.namespace
  iam_policy_json           = data.aws_iam_policy_document.argo.json
  ip_allow_list             = var.aws_iam_ip_allow_list
}

resource "kubernetes_config_map" "artifacts" {
  metadata {
    name      = "artifact-repositories" # Must be named this
    namespace = local.namespace
    labels    = module.util_controller.labels
    annotations = {
      "workflows.argoproj.io/default-artifact-repository" = "s3"
    }
  }
  data = {
    s3 = yamlencode({
      s3 = {
        endpoint = "s3.amazonaws.com"
        bucket   = module.artifact_bucket.bucket_name
        region   = data.aws_region.current.name
      }
    })
  }
}

module "sync_artifact_config_map" {
  source = "../kube_sync_config_map"

  config_map_name      = kubernetes_config_map.artifacts.metadata[0].name
  config_map_namespace = kubernetes_config_map.artifacts.metadata[0].namespace
}

/***************************************
* Database Backend
***************************************/

module "database" {
  source = "../kube_pg_cluster"

  pg_cluster_namespace                 = local.namespace
  pg_initial_storage_gb                = 2
  pg_instances                         = var.sla_target >= 2 ? 2 : 1
  pg_smart_shutdown_timeout            = 2
  aws_iam_ip_allow_list                = var.aws_iam_ip_allow_list
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  burstable_nodes_enabled              = true
  backups_force_delete                 = true
  monitoring_enabled                   = var.monitoring_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = var.sla_target == 3

  pg_minimum_cpu_millicores        = var.pg_minimum_cpu_millicores
  pg_maximum_cpu_millicores        = var.pg_maximum_cpu_millicores
  pg_minimum_cpu_update_millicores = var.pg_minimum_cpu_update_millicores
  pg_minimum_memory_mb             = var.pg_minimum_memory_mb
  pg_maximum_memory_mb             = var.pg_maximum_memory_mb
  pgbouncer_minimum_cpu_millicores = var.pgbouncer_minimum_cpu_millicores
  pgbouncer_maximum_cpu_millicores = var.pgbouncer_maximum_cpu_millicores
  pgbouncer_minimum_memory_mb      = var.pgbouncer_minimum_memory_mb
  pgbouncer_maximum_memory_mb      = var.pgbouncer_maximum_memory_mb

  pg_recovery_mode_enabled = var.db_recovery_mode_enabled
  pg_recovery_directory    = var.db_recovery_directory
  pg_recovery_target_time  = var.db_recovery_target_time
  vpa_enabled              = var.vpa_enabled
}

/***************************************
* Argo Workflows
***************************************/

resource "kubernetes_service_account" "argo_controller" {
  metadata {
    name      = "${local.name}-controller"
    namespace = local.namespace
    labels    = module.util_controller.labels
  }
}

resource "kubernetes_service_account" "argo_server" {
  metadata {
    name      = "${local.name}-server"
    namespace = local.namespace
    labels    = module.util_controller.labels
  }
}

resource "kubernetes_secret" "sso_info" {
  metadata {
    name      = "argo-server-sso"
    namespace = local.namespace
    labels    = module.util_server.labels
  }
  data = {
    client-id     = vault_identity_oidc_client.argo.client_id
    client-secret = vault_identity_oidc_client.argo.client_secret
  }
}

resource "helm_release" "argo" {
  namespace       = local.namespace
  name            = "argo"
  repository      = "https://argoproj.github.io/argo-helm"
  chart           = "argo-workflows"
  version         = var.argo_workflows_helm_version
  recreate_pods   = false
  atomic          = true
  force_update    = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      fullnameOverride = "argo"

      workflow = {
        serviceAccount = {
          create = true
        }
        rbac = {
          create = true
        }
      }

      useStaticCredentials = false
      artifactRepository = {
        archiveLogs = true
        s3 = {
          endpoint = "s3.amazonaws.com"
          bucket   = module.artifact_bucket.bucket_name
          region   = data.aws_region.current.name
        }
      }

      controller = {
        clusterWorkflowTemplates = {
          enabled = false
        }
        serviceAccount = {
          create = false
          name   = kubernetes_service_account.argo_controller.metadata[0].name
        }
        configMap = {
          create = true
          name   = local.configmap_name
        }
        persistence = {
          archive           = true
          archiveTTL        = var.workflow_archive_ttl
          nodeStatusOffLoad = true # Helps to circumvent etcd limits on workload sizes
          postgresql = {
            host      = module.database.pooler_rw_service_name
            port      = module.database.pooler_rw_service_port
            database  = module.database.database
            tableName = "argo_workflows"
            ssl       = true
            sslMode   = "require"
            userNameSecret = {
              name = module.database.superuser_creds_secret
              key  = "username"
            }
            passwordSecret = {
              name = module.database.superuser_creds_secret
              key  = "password"
            }
          }
        }

        deploymentAnnotations = {
          "configmap.reloader.stakater.com/reload" = local.configmap_name
          "secret.reloader.stakater.com/reload"    = "${kubernetes_secret.sso_info.metadata[0].name},${module.database.superuser_creds_secret}"
        }

        logging = {
          format = "json"
          level  = var.log_level
        }

        podLabels = merge(
          module.util_controller.labels,
          {
            customizationHash = md5(join("", [
              for filename in sort(fileset(path.module, "kustomize_workflows/*")) : filesha256(filename)
            ]))
          }
        )
        priorityClassName = module.constants.cluster_important_priority_class_name
        replicas          = 1
        tolerations       = module.util_controller.tolerations
        pdb = {
          enabled = false # We enable below
        }
        resources = {
          requests = {
            memory = "50Mi"
            cpu    = "100m"
          }
          limits = {
            memory = "${floor(50 * 1.3)}Mi"
          }
        }
      }

      executor = {
        resources = {
          requests = {
            memory = "50Mi"
            cpu    = "10m"
          }
          limits = {
            memory = "70Mi"
          }
        }
      }

      server = {
        serviceAccount = {
          create = false
          name   = kubernetes_service_account.argo_server.metadata[0].name
        }
        authModes = ["sso", "client"]
        sso = {
          enabled     = true
          issuer      = vault_identity_oidc_provider.argo.issuer
          redirectUrl = "https://${var.argo_domain}/oauth2/callback"
          clientId = {
            name = kubernetes_secret.sso_info.metadata[0].name
            key  = "client-id"
          }
          clientSecret = {
            name = kubernetes_secret.sso_info.metadata[0].name
            key  = "client-secret"
          }
          rbac = {
            enabled = true
          }
          scopes        = ["openid", "groups"]
          sessionExpiry = "8h"
        }
        deploymentAnnotations = {
          "configmap.reloader.stakater.com/reload" = local.configmap_name
          "secret.reloader.stakater.com/reload"    = "${kubernetes_secret.sso_info.metadata[0].name},${module.database.superuser_creds_secret}"
        }
        logging = {
          format = "json"
          level  = var.log_level
        }
        podLabels = module.util_server.labels

        replicas                  = 2
        priorityClassName         = module.constants.cluster_important_priority_class_name
        tolerations               = module.util_server.tolerations
        affinity                  = module.util_server.affinity
        topologySpreadConstraints = module.util_server.topology_spread_constraints
        pdb = {
          enabled = false # We enable below
        }
        resources = {
          requests = {
            memory = "50Mi"
            cpu    = "100m"
          }
          limits = {
            memory = "${floor(50 * 1.3)}Mi"
          }
        }

      }
    })
  ]

  depends_on = [module.database]
}

module "ingress" {
  count  = var.ingress_enabled ? 1 : 0
  source = "../kube_ingress"

  namespace = local.namespace
  name      = "argo-server"

  domains = [var.argo_domain]
  ingress_configs = [{
    service      = "argo-server"
    service_port = 2746
  }]

  rate_limiting_enabled          = true
  cross_origin_isolation_enabled = true
  permissions_policy_enabled     = true
  csp_enabled                    = true

  depends_on = [helm_release.argo]
}


resource "kubectl_manifest" "vpa_controller" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "argo-controller"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "controller"
          minAllowed = {
            memory = "50Mi"
          }
        }]
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "argo-workflow-controller"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.argo]
}

resource "kubectl_manifest" "pdb_controller" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "argo-controller"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_controller.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.argo]
}

resource "kubectl_manifest" "vpa_server" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "argo-server"
      namespace = local.namespace
      labels    = module.util_server.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "argo-server"
          minAllowed = {
            memory = "50Mi"
          }
        }]
      }
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "argo-server"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.argo]
}

resource "kubectl_manifest" "pdb_server" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "argo-server"
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
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.argo]
}

module "image_cache" {
  source = "../kube_node_image_cache"
  images = [
    {
      registry   = "quay.io"
      repository = "argoproj/argoexec"
      tag        = "v3.5.11"
    }
  ]
}

/***************************************
* Argo Events
***************************************/

resource "helm_release" "argo_events" {
  namespace       = local.namespace
  name            = "argo-events"
  repository      = "https://argoproj.github.io/argo-helm"
  chart           = "argo-events"
  version         = var.argo_events_helm_version
  recreate_pods   = false
  atomic          = true
  force_update    = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride     = "argo-events"
      createAggregateRoles = true

      controller = {

        // This is required until the patch is merged upstream
        // https://github.com/argoproj/argo-events/pull/3381
        image = {
          repository = "${module.constants.images.argo-events.registry}/${module.constants.images.argo-events.repository}"
          tag        = module.constants.images.argo-events.tag
        }

        podLabels = merge(
          module.util_events_controller.labels,
          {
            customizationHash = md5(join("", [
              for filename in sort(fileset(path.module, "kustomize_events/*")) : filesha256(filename)
            ]))
          }
        )
        podLabels         = module.util_events_controller.labels
        priorityClassName = module.constants.cluster_important_priority_class_name
        replicas          = 1
        tolerations       = module.util_events_controller.tolerations
        pdb = {
          enabled = false # Enabled below
        }
        resources = {
          requests = {
            memory = "50Mi"
            cpu    = "100m"
          }
          limits = {
            memory = "80Mi"
          }
        }
      }

      webhook = {
        enabled = true
        podLabels = merge(
          module.util_webhook.labels,
          {
            customizationHash = md5(join("", [
              for filename in sort(fileset(path.module, "kustomize_events/*")) : filesha256(filename)
            ]))
          }
        )
        priorityClassName         = module.constants.cluster_important_priority_class_name
        replicas                  = var.sla_target >= 2 ? 2 : 1
        tolerations               = module.util_webhook.tolerations
        affinity                  = module.util_webhook.affinity
        topologySpreadConstraints = module.util_webhook.topology_spread_constraints
        pdb = {
          enabled = false # Enabled below
        }
        resources = {
          requests = {
            memory = "50Mi"
            cpu    = "100m"
          }
          limits = {
            memory = "80Mi"
          }
        }
      }
    })
  ]

  postrender {
    binary_path = "${path.module}/kustomize_events/kustomize.sh"
  }
}

resource "kubectl_manifest" "vpa_events_controller" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "argo-events-controller-manager"
      namespace = local.namespace
      labels    = module.util_events_controller.labels
    }
    spec = {
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "argo-events-controller-manager"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.argo_events]
}

resource "kubectl_manifest" "pdb_events_controller" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "argo-events-controller-manager"
      namespace = local.namespace
      labels    = module.util_events_controller.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_events_controller.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.argo_events]
}

resource "kubectl_manifest" "vpa_webhook" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "events-webhook"
      namespace = local.namespace
      labels    = module.util_webhook.labels
    }
    spec = {
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "events-webhook"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.argo_events]
}

resource "kubectl_manifest" "pdb_webhook" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "events-webhook"
      namespace = local.namespace
      labels    = module.util_webhook.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_webhook.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.argo_events]
}

/***************************************
* Argo RBAC
***************************************/

// This is required to view logs from argo-events
// See https://github.com/argoproj/argo-events/issues/2176
resource "kubernetes_cluster_role" "argo_pods_viewer" {
  metadata {
    name   = "argo-pods-viewer"
    labels = module.util_server.labels
  }
  rule {
    api_groups = [""]
    verbs      = ["get", "list", "watch"]
    resources  = ["pods", "pods/log", "events"]
  }
}

resource "kubernetes_cluster_role" "argo_pods_deleter" {
  metadata {
    name   = "argo-pods-deleter"
    labels = module.util_server.labels
  }
  rule {
    api_groups = [""]
    verbs      = ["delete"]
    resources  = ["pods"]
  }
}

resource "time_rotating" "token_rotation" {
  rotation_days = 7
}

resource "kubernetes_service_account" "superuser" {
  metadata {
    name      = "argo-superuser"
    namespace = local.namespace
    labels    = module.util_server.labels
    annotations = {
      "workflows.argoproj.io/rbac-rule"                  = "'rbac-superusers' in groups"
      "workflows.argoproj.io/rbac-rule-precedence"       = "100"
      "workflows.argoproj.io/service-account-token.name" = "argo-superuser-${md5(time_rotating.token_rotation.id)}"
    }
  }
}

resource "kubernetes_cluster_role_binding" "superuser_binding" {
  metadata {
    name   = "argo-superuser"
    labels = module.util_server.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.superuser.metadata[0].name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "argo-admin" // This is a built in role in the chart
  }
  depends_on = [helm_release.argo]
}

resource "kubernetes_cluster_role_binding" "superuser_events_binding" {
  metadata {
    name   = "argo-events-superuser"
    labels = module.util_server.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.superuser.metadata[0].name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "argo-events-aggregate-to-admin" // This is a built in role in the chart
  }
  depends_on = [helm_release.argo_events]
}

resource "kubernetes_cluster_role_binding" "superuser_pods_binding" {
  metadata {
    name   = "argo-pods-superuser"
    labels = module.util_server.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.superuser.metadata[0].name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.argo_pods_viewer.metadata[0].name
  }
  depends_on = [helm_release.argo_events]
}

resource "kubernetes_cluster_role_binding" "superuser_pods_delete_binding" {
  metadata {
    name   = "argo-pods-delete-superuser"
    labels = module.util_server.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.superuser.metadata[0].name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.argo_pods_deleter.metadata[0].name
  }
  depends_on = [helm_release.argo_events]
}

resource "kubernetes_secret" "superuser_token" {
  metadata {
    name      = "argo-superuser-${md5(time_rotating.token_rotation.id)}"
    namespace = local.namespace
    labels    = module.util_server.labels
    annotations = {
      "kubernetes.io/service-account.name" = kubernetes_service_account.superuser.metadata[0].name
    }
  }
  type = "kubernetes.io/service-account-token"
}

resource "kubernetes_service_account" "admin" {
  metadata {
    name      = "argo-admin"
    namespace = local.namespace
    labels    = module.util_server.labels
    annotations = {
      "workflows.argoproj.io/rbac-rule"                  = "'rbac-admins' in groups"
      "workflows.argoproj.io/rbac-rule-precedence"       = "99"
      "workflows.argoproj.io/service-account-token.name" = "argo-admin-${md5(time_rotating.token_rotation.id)}"
    }
  }
}

resource "kubernetes_cluster_role_binding" "admin_binding" {
  metadata {
    name   = "argo-admin"
    labels = module.util_server.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.admin.metadata[0].name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "argo-edit" // This is a built in role in the chart
  }
  depends_on = [helm_release.argo]
}

resource "kubernetes_cluster_role_binding" "admin_events_binding" {
  metadata {
    name   = "argo-events-admin"
    labels = module.util_server.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.admin.metadata[0].name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "argo-events-aggregate-to-edit" // This is a built in role in the chart
  }
  depends_on = [helm_release.argo_events]
}

resource "kubernetes_cluster_role_binding" "admin_pod_delete_binding" {
  metadata {
    name   = "argo-pods-delete-admin"
    labels = module.util_server.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.admin.metadata[0].name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.argo_pods_deleter.metadata[0].name
  }
  depends_on = [helm_release.argo_events]
}

resource "kubernetes_secret" "admin_token" {
  metadata {
    name      = "argo-admin-${md5(time_rotating.token_rotation.id)}"
    namespace = local.namespace
    labels    = module.util_server.labels
    annotations = {
      "kubernetes.io/service-account.name" = kubernetes_service_account.admin.metadata[0].name
    }
  }
  type = "kubernetes.io/service-account-token"
}

resource "kubernetes_service_account" "reader" {
  metadata {
    name      = "argo-reader"
    namespace = local.namespace
    labels    = module.util_server.labels
    annotations = {
      "workflows.argoproj.io/rbac-rule"                  = "'rbac-readers' in groups or 'rbac-restricted-readers' in groups"
      "workflows.argoproj.io/rbac-rule-precedence"       = "98"
      "workflows.argoproj.io/service-account-token.name" = "argo-reader-${md5(time_rotating.token_rotation.id)}"
    }
  }
}

resource "kubernetes_cluster_role_binding" "reader_binding" {
  metadata {
    name   = "argo-reader"
    labels = module.util_server.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.reader.metadata[0].name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "argo-view" // This is a built in role in the chart
  }
  depends_on = [helm_release.argo]
}

resource "kubernetes_cluster_role_binding" "reader_events_binding" {
  metadata {
    name   = "argo-events-reader"
    labels = module.util_server.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.reader.metadata[0].name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "argo-events-aggregate-to-view" // This is a built in role in the chart
  }
  depends_on = [helm_release.argo_events]
}

resource "kubernetes_secret" "reader_token" {
  metadata {
    name      = "argo-reader-${md5(time_rotating.token_rotation.id)}"
    namespace = local.namespace
    labels    = module.util_server.labels
    annotations = {
      "kubernetes.io/service-account.name" = kubernetes_service_account.reader.metadata[0].name
    }
  }
  type = "kubernetes.io/service-account-token"
}

/***************************************
* Argo Test Workflow
***************************************/

# These define our workflow scripts
resource "kubernetes_config_map" "test_scripts" {
  count = var.test_workflow_enabled ? 1 : 0
  metadata {
    name      = "test-scripts"
    labels    = module.test_workflow[0].labels
    namespace = local.namespace
  }
  data = {
    "test.sh" = file("${path.module}/scripts/test.sh")
  }
}

module "test_workflow" {
  count  = var.test_workflow_enabled ? 1 : 0
  source = "../wf_spec"

  name                        = "test"
  namespace                   = local.namespace
  burstable_nodes_enabled     = true
  arm_nodes_enabled           = true
  panfactum_scheduler_enabled = true
  active_deadline_seconds     = 60 * 60

  entrypoint = "test"
  default_resources = {
    requests = {
      memory = "100Mi"
      cpu    = "100m"
    }
    limits = {
      memory = "100Mi"
    }
  }
  default_container_image = "${module.constants.images.devShell.registry}/${module.constants.images.devShell.repository}:${module.constants.images.devShell.tag}"
  arguments = {
    parameters = [
      {
        name        = "message"
        description = "A message for the container to print."
        default     = "Hello World!"
      }
    ]
  }
  templates = [
    {
      name        = "test"
      tolerations = module.test_workflow[0].tolerations
      volumes     = module.test_workflow[0].volumes
      container = merge(module.test_workflow[0].container_defaults, {
        command = ["/scripts/test.sh", "{{workflow.parameters.message}}"]
      })
    }
  ]

  config_map_mounts = {
    "${kubernetes_config_map.test_scripts[0].metadata[0].name}" = {
      mount_path = "/scripts"
    }
  }
}

resource "kubectl_manifest" "test_workflow_template" {
  count = var.test_workflow_enabled ? 1 : 0

  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "WorkflowTemplate"
    metadata = {
      name      = "test"
      namespace = local.namespace
      labels    = module.test_workflow[0].labels
    }
    spec = module.test_workflow[0].workflow_spec
  })

  server_side_apply = true
  force_conflicts   = true
}




