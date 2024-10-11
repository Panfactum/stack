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
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
  }
}

locals {
  name      = "external-dns-cloudflare"
  namespace = var.namespace

  config = { for domain in var.cloudflare_zones : domain => {
    labels = { domain : sha1(domain) }

    included_domains = [domain]
    excluded_domains = [for excluded_domain in var.cloudflare_zones : excluded_domain if excluded_domain != domain]
  } }
}

resource "random_id" "ids" {
  for_each    = local.config
  prefix      = "${local.name}-"
  byte_length = 8
}

module "pull_through" {
  source                     = "../../aws_ecr_pull_through_cache_addresses"
  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "util" {
  for_each = local.config
  source   = "../../kube_workload_utility"

  workload_name                 = "external-dns"
  match_labels                  = { id = random_id.ids[each.key].hex }
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = false
  az_spread_preferred           = false

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
  source = "../../kube_constants"
}

resource "kubernetes_service_account" "external_dns" {
  for_each = local.config
  metadata {
    name      = random_id.ids[each.key].hex
    namespace = local.namespace
    labels    = module.util[each.key].labels
  }
}

resource "helm_release" "external_dns" {
  for_each        = local.config
  namespace       = local.namespace
  name            = random_id.ids[each.key].hex
  repository      = "https://kubernetes-sigs.github.io/external-dns"
  chart           = "external-dns"
  version         = var.external_dns_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      nameOverride = random_id.ids[each.key].hex
      commonLabels = module.util[each.key].labels
      podLabels = merge(
        module.util[each.key].labels,
        {
          customizationHash = md5(join("", [
            for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
          ]))
        }
      )
      deploymentAnnotations = {
        "reloader.stakater.com/auto" = "true"
      }
      serviceAccount = {
        create = false
        name   = kubernetes_service_account.external_dns[each.key].metadata[0].name
      }
      logLevel  = var.log_level
      logFormat = "json"
      image = {
        repository = "${module.pull_through.kubernetes_registry}/external-dns/external-dns"
      }

      tolerations       = module.util[each.key].tolerations
      priorityClassName = module.constants.cluster_important_priority_class_name

      resources = {
        requests = {
          memory = "100Mi"
        }
        limits = {
          memory = "130Mi"
        }
      }

      // For the metrics server
      service = {
        enabled = true
        ports = {
          http = 7979
        }
      }

      // Monitoring
      serviceMonitor = {
        enabled   = var.monitoring_enabled
        namespace = local.namespace
        interval  = "60s"
      }

      // Provider configuration
      provider = {
        name = "cloudflare"
      }

      domainFilters = each.value.included_domains
      excludeDomains = each.value.excluded_domains

      extraArgs = []

      env = [
        { name = "CF_API_TOKEN", value = var.cloudflare_api_token }
      ]

      sources    = ["service", "ingress"]
      policy     = "upsert-only"
      txtOwnerId = random_id.ids[each.key].hex
      txtPrefix  = "external-dns-"
    })
  ]

  dynamic "postrender" {
    for_each = var.panfactum_scheduler_enabled ? ["enabled"] : []
    content {
      binary_path = "${path.module}/kustomize/kustomize.sh"
      args        = [random_id.ids[each.key].hex]
    }
  }
}

resource "kubectl_manifest" "vpa" {
  for_each = var.vpa_enabled ? local.config : {}
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = random_id.ids[each.key].hex
      namespace = local.namespace
      labels    = module.util[each.key].labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "external-dns"
          minAllowed = {
            memory = "100Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = random_id.ids[each.key].hex
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.external_dns]
}

resource "kubectl_manifest" "pdb" {
  for_each = local.config
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${local.name}-${random_id.ids[each.key].hex}"
      namespace = local.namespace
      labels    = module.util[each.key].labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = { id = random_id.ids[each.key].hex }
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.external_dns]
}

resource "kubernetes_config_map" "dashboard" {
  count = var.monitoring_enabled ? 1 : 0
  metadata {
    name   = "${local.name}-dashboard"
    labels = { "grafana_dashboard" = "1" }
  }
  data = {
    "external-dns.json" = file("${path.module}/dashboard.json")
  }
}