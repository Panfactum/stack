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
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
  }
}

locals {
  namespace      = module.namespace.namespace
  webhook_secret = "kube-fledged-webhook"
  customization_hash = md5(join("", [
    for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
  ]))
}

module "pull_through" {
  source                     = "../aws_ecr_pull_through_cache_addresses"
  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "util_controller" {
  source                                = "../kube_workload_utility"
  workload_name                         = "kube-fledged-controller"
  burstable_nodes_enabled               = true
  arm_nodes_enabled                     = true
  panfactum_scheduler_enabled           = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_preferred = false
  topology_spread_enabled               = false

  # pf-generate: set_vars
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

module "util_webhook" {
  source                                = "../kube_workload_utility"
  workload_name                         = "kube-fledged-webhook"
  burstable_nodes_enabled               = true
  arm_nodes_enabled                     = true
  panfactum_scheduler_enabled           = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_preferred = false
  topology_spread_enabled               = false

  # pf-generate: set_vars
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

module "namespace" {
  source = "../kube_namespace"

  namespace = "kube-fledged"

  # pf-generate: pass_vars
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
* kube-fledged
***************************************/

module "webhook_cert" {
  source = "../kube_internal_cert"

  service_names = ["kube-fledged-webhook-server"]
  common_name   = "kube-fledged-webhook-server.${local.namespace}.svc"
  secret_name   = local.webhook_secret
  namespace     = local.namespace

  # pf-generate: pass_vars_no_extra_tags
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  # end-generate

  extra_tags = module.util_webhook.labels
}

resource "helm_release" "kube_fledged" {
  namespace       = local.namespace
  name            = "kubefledged-charts"
  repository      = "https://senthilrch.github.io/kubefledged-charts"
  chart           = "kube-fledged"
  version         = var.kube_fledged_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = false
  wait_for_jobs   = false
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = "kube-fledged"
      image = {
        kubefledgedControllerRepository    = "${module.pull_through.docker_hub_registry}/senthilrch/kubefledged-controller"
        kubefledgedCRIClientRepository     = "${module.pull_through.docker_hub_registry}/senthilrch/kubefledged-cri-client"
        kubefledgedWebhookServerRepository = "${module.pull_through.docker_hub_registry}/senthilrch/kubefledged-webhook-server"
        busyboxImageRepository             = "${module.pull_through.docker_hub_registry}/senthilrch/busybox"
      }
      args = {
        controllerImageCacheRefreshFrequency = "3m"
        controllerLogLevel                   = var.log_level
        webhookServerLogLevel                = var.log_level
        webhookServerPort                    = 8443
        webhookServerCertFile                = "/etc/webhook-certs/tls.crt"
        webhookServerKeyFile                 = "/etc/webhook-certs/tls.key"
      }
      webhookService = {
        targetPort = 8443
      }
      resources = {
        requests = {
          cpu    = "50m"
          memory = "100Mi"
        }
        limits = {
          memory = "130Mi"
        }
      }
      tolerations = module.util_controller.tolerations
      affinity    = module.util_controller.affinity
      securityContext = {
        capabilities = {
          drop = ["ALL"]
        }
        readOnlyRootFilesystem = true
        runAsNonRoot           = true
        runAsUser              = 1000
      }

      ingress = {
        annotations = {
          hash = local.customization_hash # This is just used to trigger a helm re-render
        }
      }
    })
  ]

  postrender {
    binary_path = "${path.module}/kustomize/kustomize.sh"
    args = [
      module.util_controller.scheduler_name,
      jsonencode(module.util_controller.labels),
      jsonencode(module.util_webhook.labels)
    ]
  }

  depends_on = [module.webhook_cert]
}

resource "kubectl_manifest" "vpa_controller" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "kube-fledged-controller"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "kube-fledged-controller"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.kube_fledged]
}

resource "kubectl_manifest" "vpa_webhook" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "kube-fledged-webhook"
      namespace = local.namespace
      labels    = module.util_webhook.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "kube-fledged-webhook-server"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.kube_fledged]
}
