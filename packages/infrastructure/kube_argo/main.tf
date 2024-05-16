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
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.10.0"
    }
  }
}

data "aws_region" "current" {}

locals {

  name      = "argo"
  namespace = module.namespace.namespace

  controller_match = {
    id = random_id.controller_id.hex
  }

  server_match = {
    id = random_id.server_id.hex
  }

  events_controller_match = {
    id = random_id.events_controller_id.hex
  }

  webhook_match = {
    id = random_id.webhook_id.hex
  }

  configmap_name = "argo-controller"
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

resource "random_id" "controller_id" {
  byte_length = 8
  prefix      = "argo-controller-"
}

resource "random_id" "server_id" {
  byte_length = 8
  prefix      = "argo-"
}

resource "random_id" "events_controller_id" {
  byte_length = 8
  prefix      = "argo-events-controller-"
}

resource "random_id" "webhook_id" {
  byte_length = 8
  prefix      = "argo-webhook-"
}

module "controller_labels" {
  source = "../kube_labels"

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.controller_match)
}

module "server_labels" {
  source = "../kube_labels"

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.server_match)
}

module "events_controller_labels" {
  source = "../kube_labels"

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.events_controller_match)
}

module "webhook_labels" {
  source = "../kube_labels"

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.webhook_match)
}

module "controller_constants" {
  source = "../constants"

  matching_labels = local.controller_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.controller_match)
}

module "server_constants" {
  source = "../constants"

  matching_labels = local.server_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.server_match)
}

module "events_controller_constants" {
  source = "../constants"

  matching_labels = local.events_controller_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.events_controller_match)
}

module "webhook_constants" {
  source = "../constants"

  matching_labels = local.webhook_match

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.webhook_match)
}

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
* Vault IdP Setup
***************************************/

resource "vault_identity_oidc_key" "argo" {
  name               = "argo"
  allowed_client_ids = ["*"]
  rotation_period    = 60 * 60 * 8
  verification_ttl   = 60 * 60 * 24
}

data "vault_identity_group" "rbac_groups" {
  for_each   = toset(["rbac-superusers", "rbac-admins", "rbac-readers"])
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
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.argo.json
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

resource "kubernetes_config_map" "artifacts" {
  metadata {
    name      = "artifact-repositories" # Must be named this
    namespace = local.namespace
    labels    = module.controller_labels.kube_labels
    annotations = {
      "workflows.argoproj.io/default-artifact-repository"       = "s3"
      "reflector.v1.k8s.emberstack.com/reflection-allowed"      = "true"
      "reflector.v1.k8s.emberstack.com/reflection-auto-enabled" = "true"
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

/***************************************
* Database Backend
***************************************/

module "database" {
  source = "../kube_pg_cluster"

  eks_cluster_name            = var.eks_cluster_name
  pg_cluster_namespace        = local.namespace
  pg_storage_gb               = 10
  pg_memory_mb                = 1000
  pg_cpu_millicores           = 250
  pg_instances                = 2
  pg_shutdown_timeout         = 30
  aws_iam_ip_allow_list       = var.aws_iam_ip_allow_list
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  burstable_instances_enabled = true
  backups_enabled             = var.workflow_archive_backups_enabled
  backups_force_delete        = true

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
* Argo Workflows
***************************************/

resource "kubernetes_service_account" "argo_controller" {
  metadata {
    name      = "${local.name}-controller"
    namespace = local.namespace
    labels    = module.controller_labels.kube_labels
  }
}

resource "kubernetes_service_account" "argo_server" {
  metadata {
    name      = "${local.name}-server"
    namespace = local.namespace
    labels    = module.controller_labels.kube_labels
  }
}

resource "kubernetes_secret" "sso_info" {
  metadata {
    name      = "argo-server-sso"
    namespace = local.namespace
    labels    = module.server_labels.kube_labels
  }
  data = {
    client-id     = vault_identity_oidc_client.argo.client_id
    client-secret = vault_identity_oidc_client.argo.client_secret
  }
}

resource "kubernetes_secret" "postgres_creds" {
  metadata {
    name      = "argo-postgres-creds"
    namespace = local.namespace
    labels    = module.controller_labels.kube_labels
  }
  data = {
    username = module.database.superuser_username
    password = module.database.superuser_password
  }
}

resource "helm_release" "argo" {
  namespace       = local.namespace
  name            = "argo"
  repository      = "https://argoproj.github.io/argo-helm"
  chart           = "argo-workflows"
  version         = var.argo_workflows_helm_version
  recreate_pods   = false
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
            tableName = "argo_workflows"
            ssl       = true
            sslMode   = "require"
            userNameSecret = {
              name = kubernetes_secret.postgres_creds.metadata[0].name
              key  = "username"
            }
            passwordSecret = {
              name = kubernetes_secret.postgres_creds.metadata[0].name
              key  = "password"
            }
          }
        }

        deploymentAnnotations = {
          "configmap.reloader.stakater.com/reload" = local.configmap_name
          "secret.reloader.stakater.com/reload"    = "${kubernetes_secret.sso_info.metadata[0].name},${kubernetes_secret.postgres_creds.metadata[0].name}"
        }
        image = {
          registry = var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"
        }

        logging = {
          format = "json"
          level  = var.log_level
        }

        podAnnotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }
        podLabels         = module.controller_labels.kube_labels
        priorityClassName = module.controller_constants.cluster_important_priority_class_name
        replicas          = 1
        tolerations       = module.controller_constants.burstable_node_toleration_helm
        pdb = {
          enabled        = true
          maxUnavailable = 1
        }
        resources = {
          requests = {
            memory = "100Mi"
            cpu    = "100m"
          }
          limits = {
            memory = "130Mi"
          }
        }
      }

      executor = {
        image = {
          registry = var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"
        }
        resources = {
          requests = {
            memory = "100Mi"
            cpu    = "100m"
          }
          limits = {
            memory = "130Mi"
          }
        }
      }

      server = {
        serviceAccount = {
          create = false
          name   = kubernetes_service_account.argo_server.metadata[0].name
        }
        authModes = ["sso"]
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
          "secret.reloader.stakater.com/reload"    = "${kubernetes_secret.sso_info.metadata[0].name},${kubernetes_secret.postgres_creds.metadata[0].name}"
        }
        image = {
          registry = var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"
        }
        logging = {
          format = "json"
          level  = var.log_level
        }

        podAnnotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }
        podLabels = module.server_labels.kube_labels

        replicas                  = 2
        priorityClassName         = module.server_constants.cluster_important_priority_class_name
        tolerations               = module.server_constants.burstable_node_toleration_helm
        affinity                  = module.server_constants.pod_anti_affinity_helm
        topologySpreadConstraints = module.server_constants.topology_spread_zone_preferred
        pdb = {
          enabled        = true
          maxUnavailable = 1
        }
        resources = {
          requests = {
            memory = "100Mi"
            cpu    = "100m"
          }
          limits = {
            memory = "130Mi"
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
  ingress_configs = [{
    domains      = [var.argo_domain]
    service      = "argo-server"
    service_port = 2746
  }]

  rate_limiting_enabled          = true
  cross_origin_isolation_enabled = true
  permissions_policy_enabled     = true
  csp_enabled                    = true

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate

  depends_on = [helm_release.argo]
}


resource "kubernetes_manifest" "vpa_controller" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "argo-controller"
      namespace = local.namespace
      labels    = module.controller_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "argo-workflow-controller"
      }
    }
  }
  depends_on = [helm_release.argo]
}

resource "kubernetes_manifest" "vpa_server" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "argo-server"
      namespace = local.namespace
      labels    = module.server_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "argo-server"
      }
    }
  }
  depends_on = [helm_release.argo]
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
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      fullnameOverride     = "argo-events"
      createAggregateRoles = true

      global = {
        image = {
          repository = "${var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"}/argoproj/argo-events"
        }
      }

      configs = {
        jetstream = {
          versions = [{
            version              = "default"
            natsImage            = "${var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"}/library/nats:${var.event_bus_nats_version}"
            metricsExporterImage = "${var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"}/natsio/prometheus-nats-exporter:${var.event_bus_prometheus_nats_exporter_version}"
            configReloaderImage  = "${var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"}/natsio/nats-server-config-reloader:${var.event_bus_nats_server_config_reloader_version}"
            startCommand         = "/nats-server"
          }]
        }
      }

      controller = {
        podAnnotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }
        podLabels         = module.events_controller_labels.kube_labels
        priorityClassName = module.events_controller_constants.cluster_important_priority_class_name
        replicas          = 1
        tolerations       = module.events_controller_constants.burstable_node_toleration_helm
        pdb = {
          enabled        = true
          maxUnavailable = 1
          labels         = module.events_controller_labels.kube_labels
        }
        resources = {
          requests = {
            memory = "100Mi"
            cpu    = "100m"
          }
          limits = {
            memory = "130Mi"
          }
        }
      }

      webhook = {
        enabled = true
        podAnnotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }
        podLabels                 = module.webhook_labels.kube_labels
        priorityClassName         = module.webhook_constants.cluster_important_priority_class_name
        replicas                  = 2
        tolerations               = module.webhook_constants.burstable_node_toleration_helm
        affinity                  = module.webhook_constants.pod_anti_affinity_helm
        topologySpreadConstraints = module.webhook_constants.topology_spread_zone_preferred
        pdb = {
          enabled        = true
          maxUnavailable = 1
          labels         = module.webhook_labels.kube_labels
        }
        resources = {
          requests = {
            memory = "100Mi"
            cpu    = "100m"
          }
          limits = {
            memory = "130Mi"
          }
        }
      }
    })
  ]
}

resource "kubernetes_manifest" "vpa_events_controller" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "argo-events-controller-manager"
      namespace = local.namespace
      labels    = module.events_controller_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "argo-events-controller-manager"
      }
    }
  }
  depends_on = [helm_release.argo_events]
}

resource "kubernetes_manifest" "vpa_webhook" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "events-webhook"
      namespace = local.namespace
      labels    = module.server_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "events-webhook"
      }
    }
  }
  depends_on = [helm_release.argo_events]
}

/***************************************
* Argo RBAC
***************************************/

resource "time_rotating" "token_rotation" {
  rotation_days = 7
}

resource "kubernetes_service_account" "superuser" {
  metadata {
    name      = "argo-superuser"
    namespace = local.namespace
    labels    = module.server_labels.kube_labels
    annotations = {
      "workflows.argoproj.io/rbac-rule"                  = "'rbac-superusers' in groups"
      "workflows.argoproj.io/rbac-rule-precedence"       = "0"
      "workflows.argoproj.io/service-account-token.name" = "argo-superuser-${md5(time_rotating.token_rotation.id)}"
    }
  }
}

resource "kubernetes_cluster_role_binding" "superuser_binding" {
  metadata {
    name   = "argo-superuser"
    labels = module.server_labels.kube_labels
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
    labels = module.server_labels.kube_labels
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

resource "kubernetes_secret" "superuser_token" {
  metadata {
    name      = "argo-superuser-${md5(time_rotating.token_rotation.id)}"
    namespace = local.namespace
    labels    = module.server_labels.kube_labels
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
    labels    = module.server_labels.kube_labels
    annotations = {
      "workflows.argoproj.io/rbac-rule"                  = "'rbac-admins' in groups"
      "workflows.argoproj.io/rbac-rule-precedence"       = "1"
      "workflows.argoproj.io/service-account-token.name" = "argo-admin-${md5(time_rotating.token_rotation.id)}"
    }
  }
}

resource "kubernetes_cluster_role_binding" "admin_binding" {
  metadata {
    name   = "argo-admin"
    labels = module.server_labels.kube_labels
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
    labels = module.server_labels.kube_labels
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

resource "kubernetes_secret" "admin_token" {
  metadata {
    name      = "argo-admin-${md5(time_rotating.token_rotation.id)}"
    namespace = local.namespace
    labels    = module.server_labels.kube_labels
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
    labels    = module.server_labels.kube_labels
    annotations = {
      "workflows.argoproj.io/rbac-rule"                  = "'rbac-readers' in groups"
      "workflows.argoproj.io/rbac-rule-precedence"       = "2"
      "workflows.argoproj.io/service-account-token.name" = "argo-reader-${md5(time_rotating.token_rotation.id)}"
    }
  }
}

resource "kubernetes_cluster_role_binding" "reader_binding" {
  metadata {
    name   = "argo-reader"
    labels = module.server_labels.kube_labels
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
    labels = module.server_labels.kube_labels
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
    labels    = module.server_labels.kube_labels
    annotations = {
      "kubernetes.io/service-account.name" = kubernetes_service_account.reader.metadata[0].name
    }
  }
  type = "kubernetes.io/service-account-token"
}

