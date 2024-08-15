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
  source = "github.com/Panfactum/stack.git//packages/infrastructure/kube_argo_event_source?ref=704512d8ba8e8a6464546b0fedc93720c27de1d9" #pf-update

  name        = local.event_source_name
  namespace   = local.namespace
  vpa_enabled = true
  replicas = 2

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
        deleteHookOnFinish = true
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

module "ingress" {
  source =   "github.com/Panfactum/stack.git//packages/infrastructure/kube_ingress?ref=704512d8ba8e8a6464546b0fedc93720c27de1d9" # pf-update

  namespace = local.namespace
  name      = "${local.event_source_name}-webhook"
  ingress_configs = [{
    domains      = [var.webhook_domain]
    service      = "${local.event_source_name}-eventsource-svc"
    service_port = 12000
  }]
  rate_limiting_enabled          = true

  # These are unnecessary here b/c no browser access
  cross_origin_isolation_enabled = false
  permissions_policy_enabled     = false
  csp_enabled                    = false

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
