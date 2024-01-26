terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.5.1"
    }
  }
}

locals {
  cors_envs   = ["dev", "ops", "prod"]
  common_annotations = merge({
    // Since we use regex in all our ingress routing, this MUST be set to true
    "nginx.ingress.kubernetes.io/use-regex" = "true"

    // Enable CORS handling
    "nginx.ingress.kubernetes.io/enable-cors"         = "true",
    "nginx.ingress.kubernetes.io/cors-allow-methods"  = "GET,HEAD,POST,OPTIONS,PUT,PATCH,DELETE"
    "nginx.ingress.kubernetes.io/cors-expose-headers" = "*"
    "nginx.ingress.kubernetes.io/cors-allow-headers" = join(", ", [
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
    ])
    "nginx.ingress.kubernetes.io/cors-max-age" = "${60 * 60 * 24}"
    "nginx.ingress.kubernetes.io/cors-allow-origin" = join(", ", tolist(toset(flatten([
      [for config in var.ingress_configs : [for domain in config.domains : [
        "https://${domain}",
        "https://*.${domain}",

        // This allows any sibling domains of the ingress
        // For example, api.jack.panfactum.com would allow requests from *.jack.panfactum.com
        "https://*.${join(".", slice(split(".", domain), 1, length(split(".", domain))))}",
      ]]],

      // Main websites TODO: Make website domain configurable
      [for env in local.cors_envs : [
        "https://${env}.panfactum.com",
        "https://*.${env}.panfactum.com",
      ]],
      "https://*.panfactum.com",
      "https://*.panfactum.com",
      "https://panfactum.com",
    ]))))
    }, var.enable_ratelimiting ? {
    // very basic DOS protection via rate-limiting (https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#rate-limiting)
    "nginx.ingress.kubernetes.io/limit-connections"      = "60"
    "nginx.ingress.kubernetes.io/limit-rps"              = "60"
    "nginx.ingress.kubernetes.io/limit-rpm"              = "1000"
    "nginx.ingress.kubernetes.io/limit-burst-multiplier" = "3"
    "nginx.ingress.kubernetes.io/limit-whitelist"        = join(", ", [])
  } : null)

  rewrite_configs = flatten([for config in var.ingress_configs : [for rewrite_rule in config.rewrite_rules : merge(config, rewrite_rule)]])

}

module "kube_labels" {
  source = "../../modules/kube_labels"
  app = var.app
  environment = var.environment
  module = var.module
  region = var.region
  version_tag = var.version_tag
  version_hash = var.version_hash
  is_local = var.is_local
}

/********************************************************************************************************************
* Kubernetes Resources
*********************************************************************************************************************/

resource "random_id" "ingress_id" {
  count       = length(var.ingress_configs)
  prefix      = "${var.ingress_name}-"
  byte_length = 8
}

resource "kubernetes_manifest" "ingress_cert" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = var.ingress_name
      namespace = var.namespace
    }
    spec = {
      secretName = "${var.ingress_name}-tls"
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
      labels    = module.kube_labels.kube_labels
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
        secretName = "${var.ingress_name}-tls"
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
  prefix      = "${var.ingress_name}-rewrite-"
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
      labels    = module.kube_labels.kube_labels
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
        secretName = "${var.ingress_name}-tls"
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

