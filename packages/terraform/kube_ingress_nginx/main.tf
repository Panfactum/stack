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
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
  }
}

locals {

  name      = "ingress-nginx"
  namespace = module.namespace.namespace

  plugin_name = "panfactum-plugin-lua"

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
  nginx_base_timeout = var.ingress_timeout_seconds

  // Number of seconds it takes to stop receiving connections from the NLB; there is an inherent delay
  // before the NLB will stop sending new connections even though it is marked as de-registering
  // https://github.com/kubernetes-sigs/aws-load-balancer-controller/issues/2366#issuecomment-1118312709
  deregistration_buffer = 60

  // The base timeout is simply for time between individual packets.
  // This multiplies that base timeout to get the max timeout for an entire request
  timeout_multiplier = 1.5

  request_timeout = ceil(local.nginx_base_timeout * local.timeout_multiplier)

  // Needs to account for BOTH the de-registration buffer AND the finishing
  // time for any requests that were received during that buffer window before actually
  // terminating any active connections
  deregistration_delay = local.request_timeout + local.deregistration_buffer

  // The actual time for the NGINX pods to shutdown which accounts for the de-registration
  // delay AND the extra ten second delay for the controller to exit
  termination_grace_period = local.deregistration_delay + 10
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
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
  source          = "../constants"
  matching_labels = local.nginx_selector
  environment     = var.environment
  pf_root_module  = var.pf_root_module
  region          = var.region
  is_local        = var.is_local
  extra_tags      = var.extra_tags
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
* Certs
************************************************/

module "webhook_cert" {
  source         = "../kube_internal_cert"
  service_names  = ["ingress-nginx-controller-admission"]
  secret_name    = local.webhook_secret
  namespace      = local.namespace
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
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

/***********************************************
* Ingress Controller
************************************************/

module "nlb_common" {
  source = "../kube_nlb_common_resources"

  name_prefix = "nginx-"

  // Should be the same as the termination grace period seconds (minus the controller exit time)
  deregistration_delay_seconds = local.deregistration_buffer + ceil(local.nginx_base_timeout * 1.5)

  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

resource "kubernetes_config_map" "plugin" {
  metadata {
    name      = local.name
    namespace = local.namespace
  }
  data = {
    plugin = file("${path.module}/plugin.lua")
  }
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
  wait            = false
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      commonLabels = module.labels.kube_labels,

      controller = {
        image = {
          registry = var.pull_through_cache_enabled ? module.pull_through[0].kubernetes_registry : "registry.k8s.io"
        }

        replicaCount = var.min_replicas

        annotations = {
          // Required b/c the webhook certificate doesn't automatically renew
          "reloader.stakater.com/auto" = "true"
        }

        podAnnotations = {
          // Attach the service mesh sidecar
          "linkerd.io/inject" = "enabled"

          // Ensure the proxy
          // remains active as long as the controller is active
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"

          // Ensure the pods are restarted when the plugin code changes
          "panfactum.com/plugin-hash" = filemd5("${path.module}/plugin.lua")

          // Forces a reload if the kustomization fails
          customizationHash = md5(join("", [for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)]))
        }

        extraArgs = {
          // Allows the container to keep receiving traffic due to
          // the NLB taking a few seconds to completely disconnect
          shutdown-grace-period = local.deregistration_buffer
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

          // Disable buffering so that packets get sent as soon as possible
          // and aren't held in nginx memory for longer than necessary
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
          enable-modsecurity  = "false" # TODO: consider enabling when the modsecurity situations stabalizes
          modsecurity-snippet = file("${path.module}/modsecurity.txt")

          // Rate limiting
          limit-req-status-code  = "429"
          limit-conn-status-code = "429"

          // Timeouts and performance
          keep-alive              = "60"
          proxy-connect-timeout   = "60"                          // time to wait on a successful connection to an upstream server
          client-header-timeout   = "${local.nginx_base_timeout}" // time for client to send the entire header request header
          client-body-timeout     = "${local.nginx_base_timeout}" // time between successive reads of request from client (not the entire request)
          proxy-read-timeout      = "${local.nginx_base_timeout}" // time between successive reads of response from the upstream server (not the entire response)
          proxy-send-timeout      = "${local.nginx_base_timeout}" // time between successive sends of requests to the upstream server (not the entire request)
          worker-shutdown-timeout = "${local.request_timeout}"    // time that nginx gets to shutdown a worker once receiving SIGQUIT; should be slightly higher than the request timeout

          // Use the service-based upstreams
          // https://linkerd.io/2.15/tasks/using-ingress/
          // https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#service-upstream
          service-upstream           = "true"
          proxy-stream-next-upstream = "false"

          // Size limits
          proxy-body-size = "10m" // maximum size of client request body
          load-balance    = "ewma"

          // SSL setup
          ssl-ciphers            = "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384"
          ssl-protocols          = var.tls_1_2_enabled ? "TLSv1.2 TLSv1.3" : "TLSv1.3"
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
          hide-headers = "server,x-powered-by,x-aspnet-version,x-aspnetmvc-version"

          // Provides a status endpoint
          http-snippet = file("${path.module}/nginx_status_snippet.txt")
        }
        service = {
          name              = local.name
          loadBalancerClass = "service.k8s.aws/nlb"
          annotations = merge(module.nlb_common.annotations, {
            "service.beta.kubernetes.io/aws-load-balancer-proxy-protocol" = "*"
          })
        }
        metrics = {
          enabled  = true
          port     = 10254
          portName = "metrics"
        }


        updateStrategy = {
          type = "RollingUpdate"
          rollingUpdate = {
            maxSurge       = "50%"
            maxUnavailable = 0
          }
        }
        minReadySeconds = 10
        minAvailable    = "67%"

        tolerations               = module.constants.burstable_node_toleration_helm
        affinity                  = module.constants.pod_anti_affinity_helm
        topologySpreadConstraints = module.constants.topology_spread_zone_strict

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

        terminationGracePeriodSeconds = local.termination_grace_period

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
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
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
          },
          {
            mountPath = "/etc/nginx/lua/plugins/panfactum/main.lua"
            subPath   = "plugin"
            name      = local.name
            readOnly  = true
          }
        ]
        extraVolumes = [
          {
            name = local.name
            configMap = {
              name = local.name
            }
          }
        ]
      }
    })
  ]

  // The helm chart doesn't allow enabling plugins for some reason
  // so we manually inject the "plugins" field into the configmap
  postrender {
    binary_path = "${path.module}/kustomize/kustomize.sh"
  }

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