// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
  }
}

locals {

  name      = "ingress-nginx"
  namespace = module.namespace.namespace

  nginx_selector = {
    "app.kubernetes.io/component" = "controller"
    "app.kubernetes.io/instance"  = "ingress-nginx"
    "app.kubernetes.io/name"      = "ingress-nginx"
  }

  // This has to be THIS name in order for it to
  // replace the self-generated cert secret from the helm chart
  webhook_secret = "ingress-nginx-admission"

  ingress_secret = "ingress-nginx-tls"

  // Number of seconds to wait for data before terminating connections;
  // Used for both upstream and downstream logic
  nginx_base_timeout = var.ingress_timeout

  //
  // If the deregistered target stays healthy and an existing connection is not idle, the load balancer can continue to send traffic to the target.
  // Number of seconds it takes to stop receiving connections from the NLB
  // (even though you can set this to < 5 minutes, there appears to be a consistent floor of about 5 minutes)
  // https://github.com/kubernetes-sigs/aws-load-balancer-controller/issues/2366#issuecomment-1118312709
  deregistration_buffer = 300

  csp_config = {
    default-src = [
      "'self'"
    ]
    connect-src     = ["'self'", "ws:"]
    base-uri        = ["'self'"]
    font-src        = ["'self'", "https:", "data:"]
    form-action     = ["'self'"]
    frame-ancestors = ["'self'"]
    img-src = [
      "'self'",
      "data:"
    ]
    object-src = ["'none'"]
    script-src = [
      "'self'",
      "'unsafe-inline'", # Added for grafana
      "'unsafe-eval'"    # Added for grafana
    ]
    style-src = ["'self'", "https:", "'unsafe-inline'"]
  }

  // TODO: Modularize since used in Bastion
  nlb_common_annotations = {
    "service.beta.kubernetes.io/aws-load-balancer-type"                            = "external"
    "service.beta.kubernetes.io/aws-load-balancer-backend-protocol"                = "tcp"
    "service.beta.kubernetes.io/aws-load-balancer-scheme"                          = "internet-facing"
    "service.beta.kubernetes.io/aws-load-balancer-nlb-target-type"                 = "ip"
    "service.beta.kubernetes.io/aws-load-balancer-healthcheck-unhealthy-threshold" = "2"
    "service.beta.kubernetes.io/aws-load-balancer-healthcheck-healthy-threshold"   = "2"
    "service.beta.kubernetes.io/aws-load-balancer-healthcheck-timeout"             = "2"
    "service.beta.kubernetes.io/aws-load-balancer-healthcheck-interval"            = "5"
    "service.beta.kubernetes.io/aws-load-balancer-target-group-attributes" = join(",", [

      // Ensures a client always connects to the same backing server; important
      // for both performance and rate-limiting
      "stickiness.enabled=true",
      "stickiness.type=source_ip",

      // Preserve the client IP even when routing through the LB
      "preserve_client_ip.enabled=true",

      // This needs to be SHORTER than it takes for the NGINX pod to terminate as incoming connections
      // will only be stopped when this delay is met
      "deregistration_delay.timeout_seconds=${local.deregistration_delay}",
      "deregistration_delay.connection_termination.enabled=true"
    ])
    //TODO: "service.beta.kubernetes.io/aws-load-balancer-attributes" = "access_logs.s3.enabled=true,access_logs.s3.bucket=my-access-log-bucket,access_logs.s3.prefix=my-app"
  }
}

module "labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

module "constants" {
  source         = "../constants"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

module "namespace" {
  source               = "../kube_namespace"
  namespace            = local.name
  linkerd_inject       = false
  loadbalancer_enabled = true
  environment          = var.environment
  pf_root_module       = var.pf_root_module
  region               = var.region
  is_local             = var.is_local
  extra_tags           = var.extra_tags
}

/***********************************************
* NGINX
************************************************/

module "webhook_cert" {
  source         = "../kube_internal_cert"
  service_names  = ["ingress-nginx-controller-admission"]
  secret_name    = local.webhook_secret
  namespace      = local.namespace
  labels         = module.labels.kube_labels
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

resource "kubernetes_manifest" "ingress_cert" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = local.ingress_secret
      namespace = local.namespace
    }
    spec = {
      secretName = local.ingress_secret
      dnsNames = flatten([for domain in var.ingress_domains : [
        domain
      ]])

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

resource "kubernetes_secret" "dhparam" {
  metadata {
    name      = "ingress-nginx-dhparam"
    namespace = local.namespace
    labels = merge(
      module.labels.kube_labels,
      {
        "app.kubernetes.io/name"    = "ingress-nginx"
        "app.kubernetes.io/part-of" = "ingress-nginx"
      }
    )
  }
  data = {
    "dhparam.pem" = var.dhparam
  }
}

resource "random_id" "ingress_name" {
  byte_length = 8
  prefix      = "nginx-ingress-"
}

resource "helm_release" "nginx_ingress" {
  namespace       = local.namespace
  name            = "ingress-nginx"
  repository      = "https://kubernetes.github.io/ingress-nginx"
  chart           = "ingress-nginx"
  version         = var.nginx_ingress_helm_version
  recreate_pods   = false
  force_update    = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 3

  values = [
    yamlencode({
      commonLabels = merge(module.labels.kube_labels,
        {
          customizationHash = md5(join("", [for filename in sort(fileset(path.module, "nginx_kustomize/*")) : filesha256(filename)]))
        }
      )
      controller = {
        image = {
          tag = var.nginx_ingress_version
        }

        replicaCount = var.min_replicas

        annotations = {
          // Required b/c the webhook certificate doesn't automatically renew
          "reloader.stakater.com/auto" = "true"
        }

        podAnnotations = {
          // Attach the service mesh sidecar
          "linkerd.io/inject" = "enabled"
        }

        // standard security headers
        addHeaders = {
          "X-Frame-Options"        = "SAMEORIGIN"
          "X-Content-Type-Options" = "nosniff"
          "X-XSS-Protection"       = "1"
          "Referrer-Policy"        = "no-referrer"

          // TODO: These items should be configured per-ingress rather than globally
          // This is possible by using the configuration snippet annotation
          // This MUST be done before we serve HTML sites through the ingress architecture
          // It is temporarily disabled as it was blocking development
          #          "Content-Security-Policy" = join("; ", concat(
          #            [for directive, config in local.csp_config: "${directive} ${join(" ", config)}"],
          #            ["upgrade-insecure-requests"]
          #          ))
          #          "Cross-Origin-Opener-Policy" =  "same-origin-allow-popups"
          #          "Cross-Origin-Resource-Policy" = "cross-origin"
        }

        extraArgs = {
          // Used so that we don't have to specify a secret on each ingress resource
          default-ssl-certificate = "${local.namespace}/${local.ingress_secret}"
        }

        // See https://kubernetes.github.io/ingress-nginx/deploy/hardening-guide/
        config = {

          // Sets up tracing (TODO)
          // enable-opentracing = "true"
          // opentracing-trust-incoming-span = "true"

          // Enable client-ip preservation
          proxy-add-original-uri-header = "true"
          use-forwarded-headers         = "true"
          use-proxy-protocol            = "true"
          enable-real-ip                = "true"
          proxy-real-ip-cidr            = "0.0.0.0/0"

          // Use HTTP/2
          use-http2 = "true"

          // Enable compression
          enable-brotli = "true"

          // Disable buffering
          proxy-buffering         = "off"
          proxy-request-buffering = "off"

          // Set buffering windows in case the buffering gets enabled
          proxy-buffer-size    = "64k"
          proxy-buffers-number = "16"

          // Logging
          log-format-escape-json                = "true"
          enable-access-log-for-default-backend = "true"
          log-format-upstream                   = file("${path.module}/nginx_log_format.txt")

          // Disable IPv6 for security
          disable-ipv6     = "true"
          disable-ipv6-dns = "true"

          // WAF
          enable-modsecurity  = "false" # TODO: enable
          modsecurity-snippet = file("${path.module}/modsecurity.txt")

          // Rate limiting
          limit-req-status-code  = "429"
          limit-conn-status-code = "429"

          // Timeouts and performance
          keep-alive                 = "${local.nginx_base_timeout}"
          client-header-timeout      = "${local.nginx_base_timeout}"
          client-body-timeout        = "${local.nginx_base_timeout}"
          proxy-body-size            = "10m"
          proxy-connect-timeout      = "${local.nginx_base_timeout}"
          proxy-read-timeout         = "${local.nginx_base_timeout}"
          proxy-send-timeout         = "${local.nginx_base_timeout}"
          proxy-next-upstream-timout = "${ceil(local.nginx_base_timeout * 2)}"
          load-balance               = "ewma"

          // SSL setup
          ssl-ciphers            = "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384"
          ssl-protocols          = var.enable_tls_1_2 ? "TLSv1.2 TLSv1.3" : "TLSv1.3"
          ssl-session-cache      = "true"
          ssl-session-cache-size = "100m"
          ssl-session-tickets    = "true"
          ssl-session-timeout    = "120m"
          ssl-dh-param           = "${local.namespace}/${kubernetes_secret.dhparam.metadata[0].name}" // https://kubernetes.github.io/ingress-nginx/examples/customization/ssl-dh-param/
          enable-ocsp            = "true"

          // HSTS setup
          hsts                    = "true"
          hsts-include-subdomains = "true"
          hsts-max-age            = "${10 * 365 * 24 * 60 * 60}"
          hsts-preload            = "true"

          // Hide identifying headers for security
          hide-headers = "server,x-powered-by"

          //
          http-snippet = file("${path.module}/nginx_status_snippet.txt")
        }
        service = {
          name              = local.name
          loadBalancerClass = "service.k8s.aws/nlb"
          annotations = merge(local.nlb_common_annotations, {
            "service.beta.kubernetes.io/aws-load-balancer-name"           = random_id.ingress_name.hex,
            "service.beta.kubernetes.io/aws-load-balancer-proxy-protocol" = "*"
          })
        }
        metrics = {
          enabled  = true
          port     = 10254
          portName = "metrics"
        }

        tolerations = module.constants.spot_node_toleration_helm
        affinity = {
          podAntiAffinity = {
            requiredDuringSchedulingIgnoredDuringExecution = [{
              labelSelector = {
                matchExpressions = [
                  {
                    key      = "app.kubernetes.io/component"
                    operator = "In"
                    values   = ["controller"]
                  },
                  {
                    key      = "app.kubernetes.io/instance"
                    operator = "In"
                    values   = ["ingress-nginx"]
                  }
                ]
              }
              topologyKey = "kubernetes.io/hostname"
            }]
          }
        }

        updateStrategy = {
          type = "RollingUpdate"
          rollingUpdate = {
            maxSurge       = "50%"
            maxUnavailable = 0
          }
        }
        minReadySeconds = 30
        minAvailable    = "50%"
        topologySpreadConstraints = [
          {
            maxSkew           = 1
            topologyKey       = "topology.kubernetes.io/zone"
            whenUnsatisfiable = "DoNotSchedule"
            labelSelector = {
              matchLabels = local.nginx_selector
            }
          },
          {
            maxSkew           = 1
            topologyKey       = "kubernetes.io/hostname"
            whenUnsatisfiable = "DoNotSchedule"
            labelSelector = {
              matchLabels = local.nginx_selector
            }
          }
        ]

        // We need to change these from the defaults
        // so that they are more responsive;
        // in particular, the readiness probe took way too
        // long in stopping incoming traffic
        livenessProbe = {
          failureThreshold = 3
          periodSeconds    = 10
        }
        readinessProbe = {
          failureThreshold = 1
          periodSeconds    = 1
        }

        // See https://medium.com/codecademy-engineering/kubernetes-nginx-and-zero-downtime-in-production-2c910c6a5ed8
        lifecycle = {
          preStop = {
            exec = {
              // The pod MUST not be killed prior to the deregistration delay elapsing or connections will be forwarded
              // to a non-existent / killed pod
              command = ["/bin/sh", "-c", "sleep ${local.deregistration_delay}; /usr/local/openresty/nginx/sbin/nginx -c /etc/nginx/nginx.conf -s quit; while pgrep -x nginx; do sleep 1; done"]
            }
          }
        }
        terminationGracePeriodSeconds = local.deregistration_delay + local.nginx_base_timeout * 3

        allowSnippetAnnotations = true
        priorityClassName       = module.constants.cluster_important_priority_class_name
        ingressClassResource = {
          enabled = true
          default = false
          name    = "nginx"
        }
        admissionWebhooks = {
          annotations = {
            "cert-manager.io/inject-ca-from" = "${local.namespace}/${local.webhook_secret}"
          }
          certificate = "/etc/nginx-ingress/tls.crt"
          key         = "/etc/nginx-ingress/tls.key"
          patch = {
            enabled = false
          }
        }
        resources = {
          requests = {
            cpu    = "200m"
            memory = "500M"
          }
        }
        extraVolumeMounts = [
          {
            mountPath = "/etc/nginx-ingress/tls.crt"
            subPath   = "tls.crt"
            name      = "webhook-cert"
            readOnly  = true
          },
          {
            mountPath = "/etc/nginx-ingress/tls.key"
            subPath   = "tls.key"
            name      = "webhook-cert"
            readOnly  = true
          }
        ]
      }
    })
  ]

  # TODO: re-enable this patch if we enable horizontal autoscaling in the future
  #  postrender {
  #    binary_path = "${path.module}/nginx_kustomize/kustomize.sh"
  #    args = [
  #      local.namespace,
  #      "ingress-nginx-controller",
  #      var.min_replicas,
  #      var.kube_config_context
  #    ]
  #  }

  timeout    = 30 * 60
  depends_on = [module.webhook_cert]
}

resource "kubernetes_service" "nginx_healthcheck" {
  metadata {
    name      = "nginx-healthcheck"
    namespace = local.namespace
    labels    = module.labels.kube_labels
  }
  spec {
    type = "ClusterIP"
    port {
      port        = 80
      target_port = "metrics"
      protocol    = "TCP"
    }
    selector = local.nginx_selector
  }
  depends_on = [helm_release.nginx_ingress]
}

resource "kubernetes_service" "nginx_status" {
  metadata {
    name      = "nginx-status"
    namespace = local.namespace
    labels    = module.labels.kube_labels
  }
  spec {
    type = "ClusterIP"
    port {
      port        = 18080
      target_port = 18080
      protocol    = "TCP"
    }
    selector = local.nginx_selector
  }
  depends_on = [helm_release.nginx_ingress]
}

resource "kubernetes_manifest" "vpa_nginx" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "ingress-nginx-controller"
      namespace = local.namespace
      labels    = module.labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "ingress-nginx-controller"
      }
    }
  }
}