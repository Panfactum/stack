locals {
  event_source_name = "cicd"
}

resource "random_password" "webhook_token" {
  length = 32
}

resource "kubernetes_secret" "github_event_source" {
  metadata {
    name = "event-source-github"
    namespace = local.namespace
  }
  data = {
    token = var.github_token
    secret = random_password.webhook_token.result
  }
}

module "event_source" {
  source = "${var.pf_module_source}kube_argo_event_source${var.pf_module_ref}"

  name        = local.event_source_name
  namespace   = local.namespace
  replicas = 2

  instance_type_anti_affinity_required = false // You probably want to leave this as true, but we disable this for cost savings

  event_source_spec = {
    service = {
      ports = [
        {
          name = "default"
          port = 12000
          targetPort = 12000
        }
      ]
    }
    github = {
      default = {
        active = true
        repositories = [
          {
            owner = "panfactum"
            names = ["stack"]
          }
        ]
        webhook = {
          endpoint = "/push"
          port = "12000"
          method = "POST"
          url = "https://${var.webhook_domain}"
        }
        events = ["*"]
        apiToken = {
          name = kubernetes_secret.github_event_source.metadata[0].name
          key = "token"
        }
        webhookSecret = {
          name = kubernetes_secret.github_event_source.metadata[0].name
          key = "secret"
        }
      }
    }
  }
  depends_on = [module.event_bus]
}

module "ingress" {
  source = "${var.pf_module_source}kube_ingress${var.pf_module_ref}"

  namespace = local.namespace
  name      = "${local.event_source_name}-webhook"
  domains = [var.webhook_domain]
  ingress_configs = [
    {
      service      = "${local.event_source_name}-eventsource-svc"
      service_port = 12000
    }
  ]
  rate_limiting_enabled = true

  # These are unnecessary here b/c no browser access
  cross_origin_isolation_enabled = false
  permissions_policy_enabled     = false
  csp_enabled                    = false
}
