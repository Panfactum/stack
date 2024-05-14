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
  }
}

locals {

  name      = "argo"
  namespace = module.namespace.namespace

  controller_submodule = "controller"
  controller_match = {
    id = random_id.controller_id.hex
  }

  server_submodule = "server"
  server_match = {
    id = random_id.server_id.hex
  }

  argo_domains = [for domain in var.environment_domains : "argo.${domain}"]
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
* Argo Deployment
***************************************/

resource "kubernetes_secret" "sso_info" {
  metadata {
    name      = "argo-server-sso"
    namespace = local.namespace
    labels    = module.server_labels.kube_labels
  }
  data = {
    client-id     = "FILL IN (from vault when in module)"
    client-secret = "FILL IN (from vault when in module)"
  }
}

resource "helm_release" "argo" {
  namespace       = local.namespace
  name            = "argo"
  repository      = "https://argoproj.github.io/argo-helm"
  chart           = "argo-workflows"
  version         = var.argo_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({

      images = {
        tag = var.argo_image_tag
      }
      singleNamespace = false

      workflow = {
        serviceAccount = {
          create = true
        }
        rbac = {
          create = true // Creates a ServiceAccount so that pods can complete workflows successfully (report status back to argo)
        }
      }

      controller = {
        clusterWorkflowTemplates = {
          enabled = false
        }
        deploymentAnnotations = {
          "reloader.stakater.com/auto" = "true"
        }
        image = {
          registry = var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"
        }
        #initialDelay = "" // TODO: https://github.com/argoproj/argo/issues/4107 https://github.com/argoproj/argo-workflows/pull/4224
        logging = {
          format = "json"
          level  = "debug" // TODO: set to reasonable default based on log volume
        }
        pdb = {
          enabled        = true
          maxUnavailable = 1
        }
        #persistence = {} // TODO: Look into Postgres config for this
        podAnnotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }
        podLabels = module.controller_labels.kube_labels
        #podSecurityContext = {} // TODO
        #priorityClassName = "" // TODO
        replicas = 2
        #resourceRateLimit = {} // TODO
        #resources = {} // TODO
        #tolerations = [] // TODO
        topologySpreadConstraints = module.controller_constants.topology_spread_zone_preferred
        workflowNamespaces        = [] // TODO: Looks like in a multiNamespace set up for this chart you have to enumerate the active namespaces, look into this more
      }


      // TODO: Main Container and Executor
      executor = {
        image = {
          registry = var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"
        }
        # resources = {} // TODO
        # securityContext = {} // TODO
      }

      server = {
        authModes = ["sso"]
        deploymentAnnotations = {
          "reloader.stakater.com/auto" = "true"
        }
        image = {
          registry = var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"
        }
        logging = {
          format = "json"
          level  = "debug" // TODO: set to blah blah blah
        }
        pdb = {
          enabled        = true
          maxUnavailable = 1
        }
        podAnnotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }
        podLabels = module.server_labels.kube_labels
        #podSecurityContext = {} // TODO
        #priorityClassName = "" // TODO
        replicas = 3
        #resources = {} // TODO
        sso = { // TODO: Maybe add session expiry
          enabled     = true
          issuer      = "https://<your_vault_url>/v1/identity/oidc/provider/default" // Fill in from vault when in module
          redirectUrl = "https://<your_argo_domain>/oauth2/callback"                 // Defined as your argo domain /oauth2/callback, is also an input into the vault OIDC App, so maybe a local
          rbac = {
            enabled = true
          }
          scopes = ["groups"]
        }
        #tolerations = [] // TODO
        topologySpreadConstraints = module.server_constants.topology_spread_zone_preferred
      }
    })
  ]
  depends_on = [kubernetes_secret.sso_info]
}

resource "kubernetes_service_account" "admin" { // TODO: Come back and tie in vault groups when ready
  metadata {
    name      = "argo-admin"
    namespace = local.namespace
    annotations = {
      "workflows.argoproj.io/rbac-rule" : "'superusers' in groups" // Just set to true for this to be the default permissions on sign in
      "workflows.argoproj.io/rbac-rule-precedence" : "0"
    }
  }
}

resource "kubernetes_role_binding" "admin_binding" {
  metadata {
    name      = "argo-admin"
    namespace = local.namespace
  }
  subject {
    kind      = "ServiceAccount"
    name      = "argo-admin"
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "argo-argo-workflows-admin" // This is a built in role in the chart
  }
}

resource "kubernetes_secret" "admin_token" {
  metadata {
    name      = "${kubernetes_service_account.admin.metadata[0].name}.service-account-token"
    namespace = local.namespace
    annotations = {
      "kubernetes.io/service-account.name" = kubernetes_service_account.admin.metadata[0].name
    }
  }
  type = "kubernetes.io/service-account-token"
}

/***************************************
* Argo Autoscaling
***************************************/

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
        name       = "vault-csi-provider" // TODO: Grab name and fill in
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
        name       = "vault" // TODO: Grab name and fill in
      }
    }
  }
  depends_on = [helm_release.argo]
}

/***************************************
* Argo Ingress
***************************************/

module "ingress" {
  count  = var.ingress_enabled ? 1 : 0
  source = "../kube_ingress"

  namespace = local.namespace
  name      = "argo"
  ingress_configs = [{
    domains      = local.argo_domains
    service      = "argo-argo-workflows-server" // TODO: Naming was unclear for the resources but wasn't focused on renaming the resources to eliminate the stutter, maybe update in the chart then change here?
    service_port = 2746
  }]
  // TODO: Have Jack configure as needed
  rate_limiting_enabled          = true
  cross_origin_isolation_enabled = false
  cross_origin_opener_policy     = "same-origin-allow-popups"
  permissions_policy_enabled     = true
  csp_enabled                    = false

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


