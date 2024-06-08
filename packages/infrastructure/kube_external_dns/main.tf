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
      source  = "hashicorp/aws"
      version = "5.39.1"
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

  name      = "external-dns"
  namespace = module.namespace.namespace

  all_roles = toset([for domain, config in var.route53_zones : config.record_manager_role_arn])
  config = { for role in local.all_roles : role => {
    labels           = { role : sha1(role) }
    zone_ids         = [for domain, config in var.route53_zones : config.zone_id if config.record_manager_role_arn == role]
    included_domains = [for domain, config in var.route53_zones : domain if config.record_manager_role_arn == role]
    excluded_domains = [for domain, config in var.route53_zones : domain if config.record_manager_role_arn != role && alltrue([for includedDomain, config in var.route53_zones : !endswith(includedDomain, domain) if config.record_manager_role_arn == role])] // never exclude an ancestor of an included domain
  } }

}

resource "random_id" "ids" {
  for_each    = local.config
  prefix      = "${local.name}-"
  byte_length = 8
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "util" {
  for_each = local.config
  source   = "../kube_workload_utility"

  workload_name                         = "external-dns"
  match_labels                          = { id = random_id.ids[each.key].hex }
  burstable_nodes_enabled               = true
  arm_nodes_enabled                     = true
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

/***************************************
* AWS Permissions
***************************************/

data "aws_region" "main" {}

data "aws_iam_policy_document" "permissions" {
  for_each = local.config
  statement {
    effect    = "Allow"
    actions   = ["sts:AssumeRole"]
    resources = [each.key]
  }
}

resource "kubernetes_service_account" "external_dns" {
  for_each = local.config
  metadata {
    name      = random_id.ids[each.key].hex
    namespace = local.namespace
    labels    = module.util[each.key].labels
  }
}

module "aws_permissions" {
  for_each = local.config
  source   = "../kube_sa_auth_aws"

  service_account           = kubernetes_service_account.external_dns[each.key].metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.permissions[each.key].json
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
* Kubernetes Resources
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
      podLabels    = module.util[each.key].labels
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
        repository = "${var.pull_through_cache_enabled ? module.pull_through[0].kubernetes_registry : "registry.k8s.io"}/external-dns/external-dns"
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
        enabled          = var.monitoring_enabled
        namespace        = local.namespace
        additionalLabels = module.util[each.key].labels
        interval         = "60s"
      }

      // Provider configuration
      provider = {
        name = "aws"
      }
      extraArgs = concat(
        [
          "--aws-assume-role=${each.key}"
        ],
        [for domain in each.value.included_domains : "--domain-filter=${domain}"],
        [for domain in each.value.excluded_domains : "--exclude-domains=${domain}"],
        [for zone_id in each.value.zone_ids : "--zone-id-filter=${zone_id}"]
      )
      env = [
        { name = "AWS_REGION", value = data.aws_region.main.name }
      ]
      sources    = ["service", "ingress"]
      policy     = "upsert-only"
      txtOwnerId = random_id.ids[each.key].hex
      txtPrefix  = "external-dns-"
    })
  ]
  depends_on = [module.aws_permissions]
}

resource "kubernetes_config_map" "dashboard" {
  count = var.monitoring_enabled ? 1 : 0
  metadata {
    name   = "external-dns-dashboard"
    labels = { "grafana_dashboard" = "1" }
  }
  data = {
    "external-dns.json" = file("${path.module}/dashboard.json")
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
