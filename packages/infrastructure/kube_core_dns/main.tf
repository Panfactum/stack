// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.5"
    }
  }
}

locals {
  name      = "core-dns"
  namespace = "kube-system" // This must be deployed in the kube-system namespace per convention
}

module "constants" {
  source = "../kube_constants"
}

/***********************************************
* CoreDNS RBAC
************************************************/

resource "kubernetes_cluster_role" "core_dns" {
  metadata {
    name   = local.name
    labels = module.core_dns.labels
  }

  # Required for CoreDNS
  rule {
    api_groups = [""]
    resources  = ["endpoints", "services", "pods", "namespaces"]
    verbs      = ["list", "watch"]
  }
  rule {
    api_groups = ["discovery.k8s.io"]
    resources  = ["endpointslices"]
    verbs      = ["list", "watch"]
  }

  # Required for the authenticating proxy
  rule {
    api_groups = ["authorization.k8s.io"]
    resources  = ["subjectaccessreviews"]
    verbs      = ["create"]
  }
}

resource "kubernetes_cluster_role_binding" "core_dns" {
  metadata {
    name   = local.name
    labels = module.core_dns.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.core_dns.service_account_name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.core_dns.metadata[0].name
  }
}

/***********************************************
* CoreDNS Deployment
************************************************/
resource "kubernetes_config_map" "config" {
  metadata {
    name      = local.name
    namespace = local.namespace
    labels    = module.core_dns.labels
  }
  data = {
    Corefile = file("${path.module}/Corefile")
  }
}

module "metrics_cert" {
  count  = var.monitoring_enabled ? 1 : 0
  source = "../kube_internal_cert"

  service_names = ["core-dns"]
  secret_name   = "core-dns-metrics-certs"
  namespace     = local.namespace
}

module "core_dns" {
  source    = "../kube_deployment"
  namespace = local.namespace
  name      = local.name
  extra_pod_annotations = {
    "linkerd.io/inject" = "disabled"
  }

  replicas                             = 2
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  instance_type_anti_affinity_required = true // If DNS goes down, the cluster is borked so ensure this won't be affected by spot scale-in
  az_spread_preferred                  = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  priority_class_name                  = "system-cluster-critical"
  dns_policy                           = "Default"
  max_surge                            = "0%" // Don't allow surges since instance type anti affinity is required
  containers = concat(
    [
      {
        name             = "coredns"
        image_registry   = "docker.io"
        image_repository = "coredns/coredns"
        image_tag        = var.core_dns_image_version
        command = [
          "/coredns",
          "-conf",
          "/etc/coredns/Corefile"
        ]
        image_prepull_enabled = false // This is deployed before Kyverno is available
        image_pin_enabled     = false // This is deployed before Kyverno is available
        linux_capabilities    = ["NET_BIND_SERVICE"]
        liveness_probe_port   = "8080"
        liveness_probe_type   = "HTTP"
        liveness_probe_route  = "/health"
        readiness_probe_type  = "HTTP"
        readiness_probe_port  = "8181"
        readiness_probe_route = "/ready"
        minimum_memory        = 30
        ports = {
          dns = {
            port     = 53
            protocol = "UDP"
          }
          dns-tcp = {
            port = 53
          }
          raw-metrics = {
            port              = 9153
            expose_on_service = false
          }
          dns-readyz = {
            port              = 8181
            expose_on_service = false
          }
          dns-livez = {
            port              = 8080
            expose_on_service = false
          }
        }
      }
    ],
    var.monitoring_enabled ? [
      {
        name             = "proxy"
        image_registry   = "quay.io"
        image_registry   = "quay.io"
        image_repository = "brancz/kube-rbac-proxy"
        image_tag        = "v0.17.1"

        # Note we don't need a config because
        # prometheus is authorized to `get` the `/metrics` non-resource url
        # See https://github.com/brancz/kube-rbac-proxy/tree/master/examples/non-resource-url
        command = [
          "/usr/local/bin/kube-rbac-proxy",
          "--secure-listen-address=:4353",
          "--upstream=http://127.0.0.1:9153",
          "--proxy-endpoints-port=8888",
          "--tls-cert-file=/etc/metrics-certs/tls.crt",
          "--tls-private-key-file=/etc/metrics-certs/tls.key",
          "--client-ca-file=/etc/internal-ca/ca.crt"
        ]
        liveness_probe_port   = "8888"
        liveness_probe_type   = "HTTP"
        liveness_probe_route  = "/healthz"
        liveness_probe_scheme = "HTTPS"
        minimum_memory        = 10
        ports = {
          metrics = {
            port = 4353
          }
          rbac-healthz = {
            port              = 8888
            expose_on_service = false
          }
        }
      }
    ] : []
  )

  config_map_mounts = merge({
    "${kubernetes_config_map.config.metadata[0].name}" = {
      mount_path = "/etc/coredns"
    }
    }, var.monitoring_enabled ? {
    internal-ca = {
      mount_path = "/etc/internal-ca"
    }
  } : {})
  secret_mounts = merge({}, var.monitoring_enabled ? {
    "${module.metrics_cert[0].secret_name}" = {
      mount_path = "/etc/metrics-certs"
    }
  } : {})

  service_ip   = var.service_ip
  service_name = "kube-dns" // By convention, this must be available at kube-system/kube-dns

  vpa_enabled = var.vpa_enabled

  extra_pod_labels = {
    "k8s-app" = "kube-dns"
  }

  depends_on = [module.metrics_cert]
}

resource "kubectl_manifest" "service_monitor" {
  count = var.monitoring_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "core-dns"
      namespace = local.namespace
      labels    = module.core_dns.labels
    }
    spec = {
      endpoints = [{
        honorLabels = true
        interval    = "60s"
        port        = "metrics"
        path        = "/metrics"

        # We have to scrape via HTTPS b/c we cannot have a linkerd sidecar
        # running on the pod without disrupting UDP traffic
        scheme = "https"
        tlsConfig = {
          caFile     = "/etc/prometheus/identity-certs/ca.crt"
          certFile   = "/etc/prometheus/identity-certs/tls.crt"
          keyFile    = "/etc/prometheus/identity-certs/tls.key"
          serverName = "core-dns.${local.namespace}"
        }
      }]
      jobLabel = "core-dns"
      namespaceSelector = {
        matchNames = [local.namespace]
      }
      selector = {
        matchLabels = module.core_dns.match_labels
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [module.core_dns]
}

resource "kubectl_manifest" "monitoring_rules" {
  count = var.monitoring_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "PrometheusRule"
    metadata = {
      name      = "core-dns"
      namespace = local.namespace
      labels    = module.core_dns.labels
    }
    spec = yamldecode(file("${path.module}/rules.yaml"))
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.service_monitor]
}

resource "kubernetes_config_map" "dashboard" {
  count = var.monitoring_enabled ? 1 : 0
  metadata {
    name   = "core-dns-dashboard"
    labels = merge(module.core_dns.labels, { "grafana_dashboard" = "1" })
  }
  data = {
    "coredns.json" = file("${path.module}/dashboard.json")
  }
}
