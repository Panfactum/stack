terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.10.1"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.9.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.5.1"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "2.41.0"
    }
  }
}

locals {

  name      = "prometheus"
  namespace = module.namespace.namespace

  grafana_domain = "grafana.${var.environment_domain}"

  all_groups = toset(concat(var.admin_groups, var.reader_groups, var.editor_groups))
  oauth_redirect_uris = [
    "https://${local.grafana_domain}/login/azuread",
    "https://${local.grafana_domain}/"
  ]
}

module "constants" {
  source = "../constants"
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

/***************************************
* Namespace
***************************************/

module "namespace" {
  source            = "../kube_namespace"
  namespace         = local.name
  admin_groups      = ["system:admins"]
  reader_groups     = ["system:readers"]
  bot_reader_groups = ["system:bot-readers"]
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

/***************************************
* Prometheus Stack
***************************************/
resource "time_rotating" "grafana_admin_pw" {
  rotation_days = 90
}

resource "random_password" "grafana_admin_pw" {
  length  = 32
  special = false
  keepers = {
    time = time_rotating.grafana_admin_pw.id
  }
}

resource "kubernetes_secret" "grafana_creds" {
  metadata {
    name      = "grafana-creds"
    namespace = local.namespace
  }
  data = {
    admin-user     = "admin"
    admin-password = random_password.grafana_admin_pw.result
  }
}

resource "helm_release" "prometheus_stack" {
  namespace       = local.namespace
  name            = "prometheus"
  repository      = "https://prometheus-community.github.io/helm-charts"
  chart           = "kube-prometheus-stack"
  version         = var.kube_prometheus_stack_version
  recreate_pods   = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({

      commonLabels = {
        customizationHash = md5(join("", [for filename in fileset(path.module, "prometheus_kustomize/*") : filesha256(filename)]))
      }

      crds = {
        enabled = true
      }

      //////////////////////////////////////////////////////////
      // Prometheus Operator
      //////////////////////////////////////////////////////////
      prometheusOperator = {
        enabled = true

        tls = {
          enabled = true // Must be enabled for webhooks to work
        }

        verticalPodAutoscaler = {
          enabled = var.vpa_enabled
        }

        priorityClassName = module.constants.cluster_important_priority_class_name

        // Use our custom certificates
        admissionWebhooks = {
          patch = {
            enabled = false
          }
          certManager = {
            enabled = true
            admissionCert = {
              duration = "24h"
            }
            issuerRef = {
              name = "internal"
              kind = "ClusterIssuer"
            }
          }
        }
      }

      //////////////////////////////////////////////////////////
      // Prometheus Node exporter sub-chart
      //////////////////////////////////////////////////////////
      prometheus-node-exporter = {
        priorityClassName = "system-node-critical"
      }

      //////////////////////////////////////////////////////////
      // Grafana
      //////////////////////////////////////////////////////////
      grafana = {
        enabled = true
        admin = {
          existingSecret = kubernetes_secret.grafana_creds.metadata[0].name
          userKey        = "admin-user"
          passwordKey    = "admin-password"
        }
        "grafana.ini" = {
          server = {
            domain   = local.grafana_domain
            root_url = "https://${local.grafana_domain}/"
          }
          "auth.azuread" = {
            name                       = "Azure AD"
            enabled                    = true
            allow_sign_up              = true
            auto_login                 = true
            client_id                  = module.oauth_app.application_id
            client_secret              = module.oauth_app.client_secret
            scopes                     = "openid profile email"
            auth_url                   = "https://login.microsoftonline.com/${var.azuread_tenant_id}/oauth2/v2.0/authorize"
            token_url                  = "https://login.microsoftonline.com/${var.azuread_tenant_id}/oauth2/v2.0/token"
            allowed_grousp             = join(" ", [for group in data.azuread_group.groups : group.object_id])
            allowed_organizations      = var.azuread_tenant_id
            role_attribute_strict      = false
            allow_assign_grafana_admin = true
            skip_org_role_sync         = false
            use_pkce                   = true
          }
        }
        ingress = {
          enabled = false // We use our custom ingress below
        }
      }

    })
  ]

  postrender {
    binary_path = "${path.module}/prometheus_kustomize/kustomize.sh"
  }
}

/***************************************
* AAD Login for Grafana
***************************************/

data "azuread_group" "groups" {
  for_each         = toset(local.all_groups)
  display_name     = each.key
  security_enabled = true
}

module "oauth_app" {
  source                  = "../aad_oauth_application"
  display_name            = "grafana-${var.environment}-${var.region}"
  description             = "Used to authenticate users to grafana in the ${var.environment} environment in ${var.region}"
  redirect_uris           = local.oauth_redirect_uris
  admin_role_value        = "GrafanaAdmin"
  editor_role_value       = "Editor"
  reader_role_value       = "Viewer"
  admin_group_object_ids  = [for group in var.admin_groups : data.azuread_group.groups[group].object_id]
  editor_group_object_ids = [for group in var.editor_groups : data.azuread_group.groups[group].object_id]
  reader_group_object_ids = [for group in var.reader_groups : data.azuread_group.groups[group].object_id]
  aad_sp_object_owners    = var.aad_sp_object_owners
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

/***************************************
* Grafana Ingress
***************************************/

module "ingress" {
  source       = "../kube_ingress"
  namespace    = local.namespace
  ingress_name = "grafana"
  ingress_configs = [{
    domains      = [local.grafana_domain]
    service      = "prometheus-grafana"
    service_port = 80
  }]
  depends_on = [helm_release.prometheus_stack]
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}
