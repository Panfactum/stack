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
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
  }
}

locals {

  name      = "external-dns"
  namespace = module.namespace.namespace

  all_roles = toset([for domain, config in var.route53_zones : config.record_manager_role_arn])
  config = { for role in local.all_roles : role => {
    labels           = merge(module.kube_labels.kube_labels, { role : sha1(role) })
    included_domains = [for domain, config in var.route53_zones : domain if config.record_manager_role_arn == role]
    excluded_domains = [for domain, config in var.route53_zones : domain if config.record_manager_role_arn != role && length(regexall(".+\\..+\\..+", domain)) > 0] // never exclude apex domains
  } }

}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "kube_labels" {
  source = "../kube_labels"

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
  for_each = local.config
  source   = "../constants"

  matching_labels = each.value.labels

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

resource "random_id" "ids" {
  for_each    = local.config
  prefix      = "${local.name}-"
  byte_length = 8
}

resource "kubernetes_service_account" "external_dns" {
  for_each = local.config
  metadata {
    name      = random_id.ids[each.key].hex
    namespace = local.namespace
    labels    = module.kube_labels.kube_labels
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
  recreate_pods   = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      nameOverride = random_id.ids[each.key].hex
      commonLabels = each.value.labels
      podLabels    = each.value.labels
      podAnnotations = {
        "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
      }
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

      affinity = merge(
        module.constants[each.key].controller_node_with_burstable_affinity_helm,
        module.constants[each.key].pod_anti_affinity_helm
      )
      tolerations       = module.constants[each.key].burstable_node_toleration_helm
      priorityClassName = module.constants[each.key].cluster_important_priority_class_name

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


      // Provider configuration
      provider = {
        name = "aws"
      }
      extraArgs = concat(
        [
          "--aws-assume-role=${each.key}"
        ],
        [for domain in each.value.included_domains : "--domain-filter=${domain}"],
        [for domain in each.value.excluded_domains : "--exclude-domains=${domain}"]
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

resource "kubernetes_manifest" "vpa" {
  for_each = var.vpa_enabled ? local.config : {}
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = random_id.ids[each.key].hex
      namespace = local.namespace
      labels    = each.value.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "external-dns"
          minAllowed = {
            memory = "25Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = random_id.ids[each.key].hex
      }
    }
  }
}

resource "kubernetes_manifest" "pdb" {
  for_each = local.config
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${local.name}-pdb-${each.value.labels.role}"
      namespace = local.namespace
      labels    = each.value.labels
    }
    spec = {
      selector = {
        matchLabels = each.value.labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.external_dns]
}
