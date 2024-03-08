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

  all_roles = toset([for domain, config in var.dns_zones : config.record_manager_role_arn])
  config = { for role in local.all_roles : role => {
    labels           = merge(module.kube_labels.kube_labels, { role : sha1(role) })
    included_domains = [for domain, config in var.dns_zones : domain if config.record_manager_role_arn == role]
    excluded_domains = [for domain, config in var.dns_zones : domain if config.record_manager_role_arn != role && length(regexall(".+\\..+\\..+", domain)) > 0] // never exclude apex domains
  } }

}

module "kube_labels" {
  source = "../kube_labels"
  additional_labels = {
    service = local.name
  }
  app          = var.app
  environment  = var.environment
  module       = var.module
  region       = var.region
  version_tag  = var.version_tag
  version_hash = var.version_hash
  is_local     = var.is_local
}

module "constants" {
  for_each        = local.config
  source          = "../constants"
  matching_labels = each.value.labels
  app             = var.app
  environment     = var.environment
  module          = var.module
  region          = var.region
  version_tag     = var.version_tag
  version_hash    = var.version_hash
  is_local        = var.is_local
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
  for_each                  = local.config
  source                    = "../kube_sa_auth_aws"
  service_account           = kubernetes_service_account.external_dns[each.key].metadata[0].name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.permissions[each.key].json
  ip_allow_list             = var.ip_allow_list
  app                       = var.app
  environment               = var.environment
  module                    = var.module
  region                    = var.region
  version_tag               = var.version_tag
  version_hash              = var.version_hash
  is_local                  = var.is_local
}


/***************************************
* Kubernetes Resources
***************************************/

module "namespace" {
  source            = "../kube_namespace"
  namespace         = local.name
  admin_groups      = ["system:admins"]
  reader_groups     = ["system:readers"]
  bot_reader_groups = ["system:bot-readers"]
  app               = var.app
  environment       = var.environment
  module            = var.module
  region            = var.region
  version_tag       = var.version_tag
  version_hash      = var.version_hash
  is_local          = var.is_local
}

resource "helm_release" "external_dns" {
  for_each        = local.config
  namespace       = local.namespace
  name            = random_id.ids[each.key].hex
  repository      = "https://charts.bitnami.com/bitnami"
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
      commonAnnotations = {
        "reloader.stakater.com/auto" = "true"
      }
      logLevel  = "info"
      logFormat = "json"
      image = {
        tag = var.external_dns_version
      }
      aws = {
        region        = data.aws_region.main.name
        assumeRoleArn = each.key
      }
      sources = ["service", "ingress"]

      replicaCount = 2
      affinity = merge(
        module.constants[each.key].controller_node_affinity_helm,
        module.constants[each.key].pod_anti_affinity_helm
      )

      priorityClassName = module.constants[each.key].cluster_important_priority_class_name
      service = {
        enabled = true
        ports = {
          http = 7979
        }
      }
      serviceAccount = {
        create = false
        name   = kubernetes_service_account.external_dns[each.key].metadata[0].name
      }
      domainFilters  = each.value.included_domains
      excludeDomains = each.value.excluded_domains
      policy         = "upsert-only"
      txtOwnerId     = random_id.ids[each.key].hex
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
