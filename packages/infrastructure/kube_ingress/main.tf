terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
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

  csp_config = {
    // Fetch directives
    connect-src      = var.csp_connect_src
    default-src      = var.csp_default_src
    fenced-frame-src = var.csp_fenced_frame_src
    font-src         = var.csp_font_src
    frame-src        = var.csp_frame_src
    img-src          = var.csp_img_src
    manifest-src     = var.csp_manifest_src
    media-src        = var.csp_media_src
    object-src       = var.csp_object_src
    script-src       = var.csp_script_src
    script-src-elem  = var.csp_script_src_elem
    style-src        = var.csp_style_src
    style-src-elem   = var.csp_style_src_elem
    style-src-attr   = var.csp_style_src_attr
    worker-src       = var.csp_worker_src

    // Document Directives
    base-uri = var.csp_base_uri
    sandbox  = var.csp_sandbox

    // Navigation Directives
    form-action     = var.csp_form_action
    frame-ancestors = var.csp_frame_ancestors

    // Reporting Directives
    report-uri = var.csp_report_uri
    report-to  = var.csp_report_to
  }

  permissions_policy_config = {
    accelerometer                   = var.permissions_policy_accelerometer
    ambient-light-sensor            = var.permissions_policy_ambient_light_sensor
    autoplay                        = var.permissions_policy_autoplay
    battery                         = var.permissions_policy_battery
    bluetooth                       = var.permissions_policy_bluetooth
    camera                          = var.permissions_policy_camera
    display-capture                 = var.permissions_policy_display_capture
    document-domain                 = var.permissions_policy_document_domain
    encrypted-media                 = var.permissions_policy_encrypted_media
    execution-while-not-rendered    = var.permissions_policy_execution_while_not_rendered
    execution-while-out-of-viewport = var.permissions_policy_execution_while_out_of_viewport
    fullscreen                      = var.permissions_policy_fullscreen
    gamepad                         = var.permissions_policy_gamepad
    geolocation                     = var.permissions_policy_geolocation
    gyroscope                       = var.permissions_policy_gyroscope
    hid                             = var.permissions_policy_hid
    identity-credentials-get        = var.permissions_policy_identity_credentials_get
    idle-detection                  = var.permissions_policy_idle_detection
    local-fonts                     = var.permissions_policy_local_fonts
    magnetometer                    = var.permissions_policy_magnetometer
    microphone                      = var.permissions_policy_microphone
    midi                            = var.permissions_policy_midi
    otp-credentials                 = var.permissions_policy_otp_credentials
    payment                         = var.permissions_policy_payment
    picture-in-picture              = var.permissions_policy_picture_in_picture
    publickey-credentials-create    = var.permissions_policy_publickey_credentials_create
    publickey-credentials-get       = var.permissions_policy_publickey_credentials_get
    screen-wake-lock                = var.permissions_policy_screen_wake_lock
    serial                          = var.permissions_policy_serial
    speaker-selection               = var.permissions_policy_speaker_selection
    storage-access                  = var.permissions_policy_storage_access
    usb                             = var.permissions_policy_usb
    web-share                       = var.permissions_policy_web_share
    window-management               = var.permissions_policy_window_management
    xr-spatial-tracking             = var.permissions_policy_xr_spatial_tracking
  }

  domains         = tolist(toset(flatten([for config in var.ingress_configs : config.domains])))
  subdomains      = [for domain in local.domains : "*.${domain}"]
  sibling_domains = [for domain in local.domains : "*.${join(".", slice(split(".", domain), 1, length(split(".", domain))))}"]

  urls                = [for domain in local.domains : "https://${domain}"]
  subdomain_urls      = [for domain in local.subdomains : "https://${domain}"]
  sibling_domain_urls = [for domain in local.sibling_domains : "https://${domain}"]

  cdn_subdomains      = { for domain in local.domains : domain => substr(sha256(domain), 0, 12) }      // We need a random subdomain for each ingress domain to be used when the CDN is enabled
  cdn_ingress_domains = tolist(toset([for config in local.cdn_origin_configs : config.origin_domain])) // Domains for the ingresses when the CDN is enabled

  all_domains = var.cdn_mode_enabled ? concat(local.cdn_ingress_domains, local.domains) : local.domains // Includes the new domains required when CDN is enabled

  cors_allowed_headers = join(", ", tolist(toset(var.cors_allowed_headers)))
  cors_allowed_methods = join(", ", tolist(toset(var.cors_allowed_methods)))
  cors_exposed_headers = join(", ", tolist(toset(var.cors_exposed_headers)))
  cors_allowed_origins = tolist(toset(concat(
    var.cors_allowed_origins_self ? local.urls : [],
    var.cors_allowed_origins_subdomains ? local.subdomain_urls : [],
    var.cors_allowed_origins_sibling_domains ? local.sibling_domain_urls : [],
    var.cors_extra_allowed_origins
  )))
  cors_allowed_origin_regex_list = [for origin in local.cors_allowed_origins :
    replace(replace(replace(origin, "/", "\\/"), ".", "\\."), "*", ".+")
  ]

  common_annotations = merge(
    {
      // Adds security headers
      "nginx.ingress.kubernetes.io/configuration-snippet" = templatefile("${path.module}/snippet.txt", {
        csp_enabled  = var.csp_enabled
        csp_override = var.csp_override
        csp_non_html = var.csp_non_html
        csp = join("; ", concat(
          [for directive, config in local.csp_config : "${directive} ${config}" if config != null],
          ["upgrade-insecure-requests"]
        ))

        permissions_policy_enabled  = var.permissions_policy_enabled
        permissions_policy_override = var.permissions_policy_override
        permissions_policy          = join(", ", [for directive, config in local.permissions_policy_config : "${directive}=${replace(config, "\"", "\\\"")}"])

        cross_origin_isolation_enabled = var.cross_origin_isolation_enabled
        cross_origin_opener_policy     = var.cross_origin_opener_policy
        cross_origin_resource_policy   = var.cross_origin_resource_policy
        cross_origin_embedder_policy   = var.cross_origin_embedder_policy

        x_content_type_options_enabled = var.x_content_type_options_enabled
        referrer_policy                = var.referrer_policy
        x_xss_protection               = var.x_xss_protection
        x_frame_options                = var.x_frame_options

        extra_response_headers      = var.extra_response_headers
        extra_configuration_snippet = var.extra_configuration_snippet

        cors_enabled           = var.cors_enabled && !var.cors_native_handling_enabled
        cors_origin_regex      = var.cors_allowed_origins_any ? ".+" : join("|", local.cors_allowed_origin_regex_list)
        cors_allowed_methods   = local.cors_allowed_methods
        cors_allowed_headers   = local.cors_allowed_headers
        cors_exposed_headers   = local.cors_exposed_headers
        cors_max_age_seconds   = tostring(var.cors_max_age_seconds)
        cors_allow_credentials = var.cors_allow_credentials
      })

      // Since we use regex in all our ingress routing, this MUST be set to true
      "nginx.ingress.kubernetes.io/use-regex" = "true"

    },
    // Enable native CORS handling
    var.cors_native_handling_enabled ? {
      "nginx.ingress.kubernetes.io/enable-cors"            = var.cors_enabled ? "true" : "false",
      "nginx.ingress.kubernetes.io/cors-allow-methods"     = local.cors_allowed_methods
      "nginx.ingress.kubernetes.io/cors-expose-headers"    = local.cors_exposed_headers
      "nginx.ingress.kubernetes.io/cors-allow-headers"     = local.cors_allowed_headers
      "nginx.ingress.kubernetes.io/cors-max-age"           = tostring(var.cors_max_age_seconds)
      "nginx.ingress.kubernetes.io/cors-allow-origin"      = join(", ", local.cors_allowed_origins)
      "nginx.ingress.kubernetes.io/cors-allow-credentials" = tostring(var.cors_allow_credentials)
    } : null,
    // very basic DOS protection via rate-limiting (https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#rate-limiting)
    var.rate_limiting_enabled == false ? null : {
      "nginx.ingress.kubernetes.io/limit-connections"      = "60"
      "nginx.ingress.kubernetes.io/limit-rps"              = "60"
      "nginx.ingress.kubernetes.io/limit-rpm"              = "1000"
      "nginx.ingress.kubernetes.io/limit-burst-multiplier" = "3"
      "nginx.ingress.kubernetes.io/limit-whitelist"        = join(", ", [])
    },
    var.extra_annotations
  )

  rewrite_configs = flatten([for config in var.ingress_configs : [for rewrite_rule in config.rewrite_rules : merge(config, rewrite_rule)]])

  # This is a helper so we can transform var.ingress_configs into a map
  ingress_config_ids = [for config in var.ingress_configs : substr(sha256("${config.path_prefix}${join("", config.domains)}${config.service}${config.service_port}"), 0, 12)]

  ingress_configs = { for i, config in var.ingress_configs : local.ingress_config_ids[i] => {
    external_dns_hostnames = tolist(toset(config.domains))
    tls_hosts              = tolist(toset(config.domains))
    rule_hosts             = tolist(toset(config.domains))
    path_prefix            = config.path_prefix
    remove_prefix          = config.remove_prefix
    service                = config.service
    service_port           = config.service_port
    permanent_redirect_url = config.permanent_redirect_url
    temporary_redirect_url = config.temporary_redirect_url
  } }

  ingress_configs_with_cdn = { for i, config in var.ingress_configs : local.ingress_config_ids[i] => {
    external_dns_hostnames = toset(tolist([for domain in config.domains : "${local.cdn_subdomains[domain]}.${domain}"]))
    tls_hosts              = tolist(toset([for domain in config.domains : "${local.cdn_subdomains[domain]}.${domain}"]))
    rule_hosts             = tolist(toset(config.domains))
    path_prefix            = config.path_prefix
    remove_prefix          = config.remove_prefix
    service                = config.service
    service_port           = config.service_port
    permanent_redirect_url = config.permanent_redirect_url
    temporary_redirect_url = config.temporary_redirect_url
  } }


  cdn_default_allowed_methods             = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
  cdn_default_cached_methods              = ["GET", "HEAD"]
  cdn_default_min_ttl                     = 0 // These TTL settings ensure that the origin cache headers are respected: https://github.com/hashicorp/terraform-provider-aws/issues/19382
  cdn_default_default_ttl                 = 86400
  cdn_default_max_ttl                     = 31536000
  cdn_default_cookies_in_cache_key        = []
  cdn_default_headers_in_cache_key        = []
  cdn_default_query_strings_in_cache_key  = []
  cdn_default_cookies_not_forwarded       = []
  cdn_default_headers_not_forwarded       = []
  cdn_default_query_strings_not_forwarded = []
  cdn_default_compression_enabled         = true
  cdn_default_viewer_protocol_policy      = "redirect-to-https"

  cdn_default_cache_behavor = {
    allowed_methods             = local.cdn_default_allowed_methods
    cached_methods              = local.cdn_default_cached_methods
    min_ttl                     = local.cdn_default_min_ttl
    default_ttl                 = local.cdn_default_default_ttl
    max_ttl                     = local.cdn_default_max_ttl
    cookies_in_cache_key        = local.cdn_default_cookies_in_cache_key
    headers_in_cache_key        = local.cdn_default_headers_in_cache_key
    query_strings_in_cache_key  = local.cdn_default_query_strings_in_cache_key
    cookies_not_forwarded       = local.cdn_default_cookies_not_forwarded
    headers_not_forwarded       = local.cdn_default_headers_not_forwarded
    query_strings_not_forwarded = local.cdn_default_query_strings_not_forwarded
    compression_enabled         = local.cdn_default_compression_enabled
    viewer_protocol_policy      = local.cdn_default_viewer_protocol_policy
  }

  cdn_path_match_behavior = {}

  cdn_configs = { for i, config in var.ingress_configs : local.ingress_config_ids[i] => config.cdn }

  cdn_origin_configs = [for name, config in local.ingress_configs_with_cdn : {
    origin_id              = substr(sha256("${join("", config.rule_hosts)}${config.service}${config.service_port}${config.path_prefix}"), 0, 12)
    domains                = config.rule_hosts
    path_prefix            = config.path_prefix
    default_cache_behavior = local.cdn_configs[name] != null ? merge(local.cdn_default_cache_behavor, lookup(local.cdn_configs[name], "default_cache_behavior", {})) : local.cdn_default_cache_behavor
    path_match_behavior    = local.cdn_configs[name] != null ? { for path, behavior in lookup(local.cdn_configs[name], "path_match_behavior", {}) : path => merge(local.cdn_default_cache_behavor, behavior) } : {}
    origin_domain          = "${local.cdn_subdomains[config.rule_hosts[0]]}.${config.rule_hosts[0]}"
    extra_origin_headers   = local.cdn_configs[name] != null ? merge({}, lookup(local.cdn_configs[name], "extra_origin_headers", {})) : {}
  }]
}

module "util" {
  source        = "../kube_workload_utility"
  workload_name = var.name

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

/********************************************************************************************************************
* Kubernetes Resources
*********************************************************************************************************************/

resource "kubectl_manifest" "ingress_cert" {
  yaml_body = yamlencode({
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = var.name
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      secretName = "${var.name}-tls"
      dnsNames   = local.all_domains

      // We don't rotate this as frequently to both respect
      // the rate limits: https://letsencrypt.org/docs/rate-limits/
      // and to avoid getting the 30 day renewal reminders
      duration    = "2160h0m0s"
      renewBefore = "720h0m0s"

      privateKey = {
        rotationPolicy = "Always"
      }

      issuerRef = {
        name  = "public"
        kind  = "ClusterIssuer"
        group = "cert-manager.io"
      }
    }
  })

  force_conflicts   = true
  server_side_apply = true

  wait_for {
    field {
      key   = "status.conditions.[0].status"
      value = "True"
    }
  }
}

resource "kubectl_manifest" "ingress" {
  for_each = var.cdn_mode_enabled ? local.ingress_configs_with_cdn : local.ingress_configs
  yaml_body = yamlencode({
    apiVersion = "networking.k8s.io/v1"
    kind       = "Ingress"
    metadata = {
      name      = each.key
      namespace = var.namespace
      labels    = module.util.labels
      annotations = { for k, v in merge(
        local.common_annotations,
        {
          // https://kubernetes.github.io/ingress-nginx/examples/affinity/cookie/
          "nginx.ingress.kubernetes.io/session-cookie-name"              = each.key               // Each ingress will get it's own session cookie name as its value is dependent on the set of upstream hosts
          "nginx.ingress.kubernetes.io/session-cookie-path"              = each.value.path_prefix // Since we use regex patterns, we need to manually set this for sticky sessions to work
          "nginx.ingress.kubernetes.io/affinity"                         = "cookie"
          "nginx.ingress.kubernetes.io/affinity-mode"                    = "balanced"
          "nginx.ingress.kubernetes.io/session-cookie-secure"            = "true"
          "nginx.ingress.kubernetes.io/session-cookie-max-age"           = "3600"
          "nginx.ingress.kubernetes.io/session-cookie-change-on-failure" = "true"
          "nginx.ingress.kubernetes.io/session-cookie-samesite"          = "Strict"
        },

        // When the CDN is enabled, the `host` fields in the ingress will no longer match the user-provided domains
        // so we need to manually configure external-dns rather than let it automatically configure itself.
        {
          "external-dns.alpha.kubernetes.io/ingress-hostname-source" = "annotation-only",
          "external-dns.alpha.kubernetes.io/hostname"                = join(",", each.value.external_dns_hostnames)
        },

        // Redirects
        {
          "nginx.ingress.kubernetes.io/temporal-redirect"  = each.value.temporary_redirect_url
          "nginx.ingress.kubernetes.io/permanent-redirect" = each.value.permanent_redirect_url
        },

        // Strips the path_prefix (e.g., api.panfactum.com/payroll/health -> /health)
        each.value.remove_prefix ? { "nginx.ingress.kubernetes.io/rewrite-target" = "/$2" } : {}
      ) : k => v if v != null }
    }
    spec = {
      ingressClassName = "nginx"
      tls = [{
        hosts      = each.value.tls_hosts
        secretName = "${var.name}-tls"
      }]
      rules = [for config in [for domain in each.value.rule_hosts : {
        domain       = domain
        path_prefix  = each.value.path_prefix
        service      = each.value.service
        service_port = each.value.service_port
        }] :
        {
          host = config.domain,
          http = {
            paths = [{
              pathType = "Prefix"
              path     = "${config.path_prefix}(/|$)*(.*)"
              backend = {
                service = {
                  name = config.service
                  port = {
                    number = config.service_port
                  }
                }
              }
            }]
          }
        }
      ]
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.ingress_cert]
}

resource "random_id" "rewrite_id" {
  count       = length(local.rewrite_configs)
  prefix      = "${var.name}-rewrite-"
  byte_length = 8
}

## TODO: Update for CDN
resource "kubectl_manifest" "ingress_rewrites" {
  count = length(local.rewrite_configs)
  yaml_body = yamlencode({
    apiVersion = "networking.k8s.io/v1"
    kind       = "Ingress"
    metadata = {
      name      = random_id.rewrite_id[count.index].hex
      namespace = var.namespace
      labels    = module.util.labels
      annotations = merge(
        local.common_annotations,
        {
          "nginx.ingress.kubernetes.io/rewrite-target" = local.rewrite_configs[count.index].path_rewrite
        }
      )
    }
    spec = {
      ingressClassName = "nginx"
      tls = [{
        hosts      = tolist(toset(local.rewrite_configs[count.index].domains))
        secretName = "${var.name}-tls"
      }]
      rules = [for domain in tolist(toset(local.rewrite_configs[count.index].domains)) :
        {
          host = domain,
          http = {
            paths = [{
              pathType = "Prefix"
              path     = local.rewrite_configs[count.index].path_regex
              backend = {
                service = {
                  name = local.rewrite_configs[count.index].service
                  port = {
                    number = local.rewrite_configs[count.index].service_port
                  }
                }
              }
            }]
          }
        }
      ]
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.ingress_cert]
}

