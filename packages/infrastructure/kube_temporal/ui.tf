/***************************************
* Vault OIDC Authentication
***************************************/

resource "vault_identity_oidc_key" "temporal" {
  name               = "${local.name}-temporal-ui"
  allowed_client_ids = ["*"]
  rotation_period    = 60 * 60 * 8
  verification_ttl   = 60 * 60 * 24
}

data "vault_identity_group" "rbac_groups" {
  for_each   = var.allowed_vault_roles
  group_name = each.key
}

resource "vault_identity_oidc_assignment" "temporal" {
  name      = "${local.name}-temporal-ui"
  group_ids = [for group in data.vault_identity_group.rbac_groups : group.id]
}

resource "vault_identity_oidc_client" "temporal" {
  name = "${local.name}-temporal-ui"
  key  = vault_identity_oidc_key.temporal.name
  redirect_uris = [
    "https://${var.ingress_domains[0]}/auth/sso/callback",
  ]
  assignments = [
    vault_identity_oidc_assignment.temporal.name
  ]
  id_token_ttl     = 60 * 60 * 8
  access_token_ttl = 60 * 60 * 8
}

resource "vault_identity_oidc_provider" "temporal" {
  name = "${local.name}-temporal-ui"

  https_enabled = true
  issuer_host   = var.vault_domain
  allowed_client_ids = [
    vault_identity_oidc_client.temporal.client_id
  ]
  scopes_supported = [
    "profile"
  ]
}

/***************************************
* Temporal Web UI
***************************************/

module "ui" {
  source = "../kube_deployment"

  name         = "${local.name}-ui"
  namespace    = local.namespace
  replicas     = data.pf_metadata.metadata.sla_target >= 2 ? 2 : 1
  service_name = "temporal-ui"

  # Scheduling
  az_spread_preferred                  = data.pf_metadata.metadata.sla_target >= 2
  instance_type_anti_affinity_required = data.pf_metadata.metadata.sla_target == 3
  spot_nodes_enabled                   = var.spot_nodes_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  arm_nodes_enabled                    = var.arm_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled

  containers = [
    {
      name             = "ui"
      image_registry   = "index.docker.io"
      image_repository = "temporalio/ui"
      image_tag        = "2.20.0"
      command          = [] # use default entrypoint
      ports = {
        http = {
          port              = 8080
          service_port      = 8080
          protocol          = "TCP"
          expose_on_service = true
        }
      }
      env = {
        TEMPORAL_ADDRESS          = "temporal-frontend.${local.namespace}.svc.cluster.local:7233"
        TEMPORAL_NAMESPACE        = "default"
        TEMPORAL_PERMIT_WRITE_API = "true"
        TEMPORAL_CORS_ORIGINS     = length(var.ingress_domains) > 0 ? "https://${var.ingress_domains[0]}" : ""
        TEMPORAL_UI_PORT          = "8080" # Override Kubernetes-injected TEMPORAL_UI_PORT=tcp://... from the temporal-ui service

        # Vault OIDC authentication
        TEMPORAL_AUTH_ENABLED       = "true"
        TEMPORAL_AUTH_TYPE          = "oidc"
        TEMPORAL_AUTH_PROVIDER_URL  = vault_identity_oidc_provider.temporal.issuer
        TEMPORAL_AUTH_CLIENT_ID     = vault_identity_oidc_client.temporal.client_id
        TEMPORAL_AUTH_CLIENT_SECRET = vault_identity_oidc_client.temporal.client_secret
        TEMPORAL_AUTH_CALLBACK_URL  = "https://${var.ingress_domains[0]}/auth/sso/callback"
        TEMPORAL_AUTH_SCOPES        = "openid,profile"
      }
      minimum_memory        = 128
      minimum_cpu           = 50
      read_only             = false # UI server may write temp files
      liveness_probe_port   = 8080
      liveness_probe_type   = "HTTP"
      liveness_probe_route  = "/"
      readiness_probe_port  = 8080
      readiness_probe_type  = "HTTP"
      readiness_probe_route = "/"
    }
  ]

  tmp_directories = {
    "ui-config" = {
      mount_path = "/home/ui-server/config"
      size_mb    = 5
    }
  }

  vpa_enabled                         = var.vpa_enabled
  voluntary_disruptions_enabled       = var.voluntary_disruptions_enabled
  voluntary_disruption_window_enabled = var.voluntary_disruption_window_enabled
  voluntary_disruption_window_seconds = var.voluntary_disruption_window_seconds

  depends_on = [module.frontend]
}

module "ingress" {
  count  = var.ingress_enabled ? 1 : 0
  source = "../kube_ingress"

  name      = "${local.name}-ui"
  namespace = local.namespace
  domains   = var.ingress_domains

  ingress_configs = [
    {
      service      = "temporal-ui"
      service_port = 8080
      cdn = {
        path_match_behavior = {
          "/_app/immutable/*" = {
            caching_enabled            = true
            min_ttl                    = 31536000
            default_ttl                = 31536000
            max_ttl                    = 31536000
            cookies_in_cache_key       = []
            headers_in_cache_key       = []
            query_strings_in_cache_key = []
          }
        }
      }
    }
  ]

  cdn_mode_enabled = var.cdn_mode_enabled

  depends_on = [module.ui]
}

module "cdn" {
  count  = var.ingress_enabled && var.cdn_mode_enabled ? 1 : 0
  source = "../kube_aws_cdn"
  providers = {
    aws.global = aws.global
  }

  name           = "temporal-ui"
  origin_configs = module.ingress[0].cdn_origin_configs
}
