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
      source  = "hashicorp/aws"
      version = "5.70.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

locals {
  path_prefix = replace(var.path_prefix, "////", "/") # //// required because // triggers regex matching
  proxy_path  = replace("${var.path_prefix}/oauth2", "////", "/")
}

data "pf_kube_labels" "labels" {
  module = "kube_vault_proxy"
}

module "pull_through" {
  source = "../aws_ecr_pull_through_cache_addresses"

  pull_through_cache_enabled = var.pull_through_cache_enabled
}

resource "random_id" "oauth2_proxy" {
  byte_length = 8
  prefix      = "oauth2-proxy-"
}

module "util" {
  source = "../kube_workload_utility"

  workload_name                 = random_id.oauth2_proxy.hex
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = var.instance_type_spread_required
  az_spread_preferred           = var.az_spread_preferred
  extra_labels                  = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

/***************************************
* Vault IdP Setup
***************************************/

resource "vault_identity_oidc_key" "oidc" {
  name               = random_id.oauth2_proxy.hex
  allowed_client_ids = ["*"]
  rotation_period    = 60 * 60 * 8
  verification_ttl   = 60 * 60 * 24
}

data "vault_identity_group" "rbac_groups" {
  for_each   = var.allowed_vault_roles
  group_name = each.key
}

resource "vault_identity_oidc_assignment" "oidc" {
  name      = random_id.oauth2_proxy.hex
  group_ids = [for group in data.vault_identity_group.rbac_groups : group.id]
}

resource "vault_identity_oidc_client" "oidc" {
  name = random_id.oauth2_proxy.hex
  key  = vault_identity_oidc_key.oidc.name
  redirect_uris = [
    "https://${var.domain}${local.proxy_path}/callback",
  ]
  assignments = [
    vault_identity_oidc_assignment.oidc.name
  ]
  id_token_ttl     = 60 * 60 * 8
  access_token_ttl = 60 * 60 * 8
}

resource "vault_identity_oidc_provider" "oidc" {
  name = random_id.oauth2_proxy.hex

  https_enabled = true
  issuer_host   = var.vault_domain
  allowed_client_ids = [
    vault_identity_oidc_client.oidc.client_id
  ]
  scopes_supported = [
    "profile"
  ]
}

/***************************************
* Proxy
***************************************/
resource "random_password" "cookie_secret" {
  length  = 32
  special = false
}

resource "kubernetes_secret" "oauth2_proxy" {
  metadata {
    name      = "oauth2-proxy"
    namespace = var.namespace
    labels    = module.util.labels
  }
  data = {
    cookie-secret = random_password.cookie_secret.result
    client-id     = vault_identity_oidc_client.oidc.client_id
    client-secret = vault_identity_oidc_client.oidc.client_secret
  }
}

resource "helm_release" "oauth2_proxy" {
  namespace       = var.namespace
  name            = random_id.oauth2_proxy.hex
  repository      = "https://oauth2-proxy.github.io/manifests"
  chart           = "oauth2-proxy"
  version         = var.oauth2_proxy_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = false
  wait_for_jobs   = false
  max_history     = 5

  values = [
    yamlencode({
      config = {
        cookieName     = "${var.namespace}-oauth2-proxy"
        existingSecret = kubernetes_secret.oauth2_proxy.metadata[0].name
      }
      extraArgs = flatten(concat(
        [
          "--provider", "oidc",
          "--provider-display-name", "Vault",
          "--redirect-url", "https://${var.domain}${local.proxy_path}/callback",
          "--oidc-issuer-url", vault_identity_oidc_provider.oidc.issuer,
          "--cookie-secure", "true",
          "--cookie-domain", var.domain,
          "--cookie-path", local.path_prefix,
          "--scope", "openid profile",
          "--silence-ping-logging"
        ],
        [for domain in var.allowed_email_domains : ["--email-domain", domain]]
      ))

      image = {
        repository = "${module.pull_through.quay_registry}/oauth2-proxy/oauth2-proxy"
      }
      labels = module.util.labels
      podLabels = merge(
        module.util.labels,
        {
          customizationHash = md5(join("", [
            for filename in sort(fileset(path.module, "kustomize/*")) : filesha256("${path.module}/${filename}")
          ]))
        }
      )
      podAnnotations = {
        "config.linkerd.io/proxy-memory-request" = "5Mi" # We can use lower requests / limits here b/c this will never receive much traffic
        "config.linkerd.io/proxy-memory-limit"   = "20Mi"
      }
      replicaCount = 2
      podDisruptionBudget = {
        enabled = false
      }
      tolerations               = module.util.tolerations
      affinity                  = module.util.affinity
      topologySpreadConstraints = module.util.topology_spread_constraints
      resources = {
        requests = {
          memory = "100Mi"
        }
        limits = {
          memory = "130Mi"
        }
      }
    })
  ]

  dynamic "postrender" {
    for_each = var.panfactum_scheduler_enabled ? ["enabled"] : []
    content {
      binary_path = "${path.module}/kustomize/kustomize.sh"
      args        = [random_id.oauth2_proxy.hex]
    }
  }

  timeout = 60
}

resource "kubectl_manifest" "pdb" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = random_id.oauth2_proxy.hex
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util.match_labels
      }
      maxUnavailable = 1
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.oauth2_proxy]
}

resource "kubectl_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = random_id.oauth2_proxy.hex
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = random_id.oauth2_proxy.hex
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.oauth2_proxy]
}

/***************************************
* Ingress
***************************************/

module "ingress" {
  source = "../kube_ingress"

  namespace = var.namespace
  name      = "oauth2-proxy"
  domains   = [var.domain]
  ingress_configs = [{
    service      = random_id.oauth2_proxy.hex
    service_port = 80
    path_prefix  = local.proxy_path
  }]

  rate_limiting_enabled          = true
  cross_origin_isolation_enabled = true
  permissions_policy_enabled     = true
  csp_enabled                    = true
  csp_style_src                  = "'self' 'unsafe-inline'"

  depends_on = [
    helm_release.oauth2_proxy
  ]
}
