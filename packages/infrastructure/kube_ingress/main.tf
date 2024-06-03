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

  domains         = flatten([for config in var.ingress_configs : [for domain in config.domains : "https://${domain}"]])
  subdomains      = flatten([for config in var.ingress_configs : [for domain in config.domains : "https://*.${domain}"]])
  sibling_domains = flatten([for config in var.ingress_configs : [for domain in config.domains : "https://*.${join(".", slice(split(".", domain), 1, length(split(".", domain))))}"]])

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
        permissions_policy          = join(", ", [for directive, config in local.permissions_policy_config : "${directive}=${config}"])

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
      })

      // Since we use regex in all our ingress routing, this MUST be set to true
      "nginx.ingress.kubernetes.io/use-regex" = "true"

      // Enable CORS handling
      "nginx.ingress.kubernetes.io/enable-cors"         = var.cors_enabled ? "true" : "false",
      "nginx.ingress.kubernetes.io/cors-allow-methods"  = "GET,HEAD,POST,OPTIONS,PUT,PATCH,DELETE"
      "nginx.ingress.kubernetes.io/cors-expose-headers" = var.cors_exposed_headers
      "nginx.ingress.kubernetes.io/cors-allow-headers" = join(", ", concat(var.cors_extra_allowed_headers, [
        "DNT",
        "Keep-Alive",
        "User-Agent",
        "X-Requested-With",
        "If-Modified-Since",
        "Cache-Control",
        "Content-Disposition",
        "Content-Type",
        "Range",
        "Authorization",
        "Cookies",
        "Referrer",
        "Accept",
        "sec-ch-ua",
        "sec-ch-ua-mobile",
        "sec-ch-ua-platform",
        "X-Suggested-File-Name",
        "Cookie"
      ]))
      "nginx.ingress.kubernetes.io/cors-max-age" = "${var.cors_max_age_seconds}"
      "nginx.ingress.kubernetes.io/cors-allow-origin" = join(", ", tolist(toset(concat(
        var.cors_allowed_origins_self ? local.domains : [],
        var.cors_allowed_origins_subdomains ? local.subdomains : [],
        var.cors_allowed_origins_sibling_domains ? local.sibling_domains : [],
        var.cors_extra_allowed_origins
      ))))
    },
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
}

module "util" {
  source        = "../kube_workload_utility"
  workload_name = var.name

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

/********************************************************************************************************************
* Kubernetes Resources
*********************************************************************************************************************/

resource "random_id" "ingress_id" {
  count       = length(var.ingress_configs)
  prefix      = "${var.name}-"
  byte_length = 8
}

resource "kubernetes_manifest" "ingress_cert" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = var.name
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      secretName = "${var.name}-tls"
      dnsNames   = tolist(toset(flatten([for config in var.ingress_configs : config.domains])))

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
  }
  wait {
    condition {
      type   = "Ready"
      status = "True"
    }
  }
}

resource "kubernetes_manifest" "ingress" {
  count = (length(var.ingress_configs))
  manifest = {
    apiVersion = "networking.k8s.io/v1"
    kind       = "Ingress"
    metadata = {
      name      = random_id.ingress_id[count.index].hex
      namespace = var.namespace
      labels    = module.util.labels
      annotations = merge(
        local.common_annotations,
        {
          // https://kubernetes.github.io/ingress-nginx/examples/affinity/cookie/
          "nginx.ingress.kubernetes.io/session-cookie-name"              = random_id.ingress_id[count.index].hex        // Each ingress will get it's own session cookie name as its value is dependent on the set of upstream hosts
          "nginx.ingress.kubernetes.io/session-cookie-path"              = var.ingress_configs[count.index].path_prefix // Since we use regex patterns, we need to manually set this for sticky sessions to work
          "nginx.ingress.kubernetes.io/affinity"                         = "cookie"
          "nginx.ingress.kubernetes.io/affinity-mode"                    = "balanced"
          "nginx.ingress.kubernetes.io/session-cookie-secure"            = "true"
          "nginx.ingress.kubernetes.io/session-cookie-max-age"           = "3600"
          "nginx.ingress.kubernetes.io/session-cookie-change-on-failure" = "true"
          "nginx.ingress.kubernetes.io/session-cookie-samesite"          = "Strict"
        },

        // Strips the path_prefix (e.g., api.panfactum.com/payroll/health -> /health)
        var.ingress_configs[count.index].remove_prefix ? { "nginx.ingress.kubernetes.io/rewrite-target" = "/$2" } : {}
      )
    }
    spec = {
      ingressClassName = "nginx"
      tls = [{
        hosts      = tolist(toset(var.ingress_configs[count.index].domains))
        secretName = "${var.name}-tls"
      }]
      rules = [for domain in tolist(toset(var.ingress_configs[count.index].domains)) :
        {
          host = domain,
          http = {
            paths = [{
              pathType = "Prefix"
              path     = "${var.ingress_configs[count.index].path_prefix}(/|$)*(.*)"
              backend = {
                service = {
                  name = var.ingress_configs[count.index].service
                  port = {
                    number = var.ingress_configs[count.index].service_port
                  }
                }
              }
            }]
          }
        }
      ]
    }
  }
  depends_on = [kubernetes_manifest.ingress_cert]
}

resource "random_id" "rewrite_id" {
  count       = length(local.rewrite_configs)
  prefix      = "${var.name}-rewrite-"
  byte_length = 8
}

resource "kubernetes_manifest" "ingress_rewrites" {
  count = length(local.rewrite_configs)
  manifest = {
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
  }
  depends_on = [kubernetes_manifest.ingress_cert]
}

