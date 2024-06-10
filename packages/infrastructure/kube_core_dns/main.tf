// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "4.0.5"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
  }
}

locals {
  name      = "core-dns"
  namespace = "kube-system" // This must be deployed in the kube-system namespace per convention
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "constants" {
  source = "../kube_constants"
}

/***********************************************
* CoreDNS RBAC
************************************************/

resource "kubernetes_service_account" "core_dns" {
  metadata {
    name      = local.name
    namespace = local.namespace
    labels    = module.core_dns.labels
  }
}

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
    name      = kubernetes_service_account.core_dns.metadata[0].name
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

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

module "core_dns" {
  source          = "../kube_deployment"
  namespace       = local.namespace
  name            = local.name
  service_account = kubernetes_service_account.core_dns.metadata[0].name
  pod_annotations = {
    "linkerd.io/inject" = "disabled"
  }

  min_replicas                          = 2
  max_replicas                          = 2
  burstable_nodes_enabled               = true
  arm_nodes_enabled                     = true
  instance_type_anti_affinity_preferred = var.enhanced_ha_enabled
  topology_spread_strict                = true
  topology_spread_enabled               = var.enhanced_ha_enabled
  priority_class_name                   = "system-cluster-critical"
  dns_policy                            = "Default"
  containers = concat(
    [
      {
        name    = "coredns"
        image   = "${var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"}/coredns/coredns"
        version = var.core_dns_image_version
        command = [
          "/coredns",
          "-conf",
          "/etc/coredns/Corefile"
        ]
        linux_capabilities   = ["NET_BIND_SERVICE"]
        liveness_check_port  = "8080"
        liveness_check_type  = "HTTP"
        liveness_check_route = "/health"
        ready_check_type     = "HTTP"
        ready_check_port     = "8181"
        ready_check_route    = "/ready"
        minimum_memory       = 30
      }
    ],
    var.monitoring_enabled ? [
      {
        name    = "proxy"
        image   = "${var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"}/brancz/kube-rbac-proxy"
        version = "v0.17.1"
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
        liveness_check_port   = "8888"
        liveness_check_type   = "HTTP"
        liveness_check_route  = "/healthz"
        liveness_check_scheme = "HTTPS"
        minimum_memory        = 10
      }
    ] : []
  )

  config_map_mounts = merge({
    "${kubernetes_config_map.config.metadata[0].name}" = "/etc/coredns"
    }, var.monitoring_enabled ? {
    internal-ca = "/etc/internal-ca"
  } : {})
  secret_mounts = merge({}, var.monitoring_enabled ? {
    "${module.metrics_cert[0].secret_name}" = "/etc/metrics-certs"
  } : {})

  vpa_enabled = var.vpa_enabled

  # generate: pass_common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, {
    "k8s-app" = "kube-dns"
  })

  depends_on = [module.metrics_cert]
}

resource "kubernetes_service" "core_dns" {
  metadata {
    // By convention, this must be available at kube-system/kube-dns
    name      = "kube-dns"
    namespace = local.namespace
    labels    = module.core_dns.labels
  }
  spec {
    cluster_ip              = var.service_ip
    cluster_ips             = [var.service_ip]
    internal_traffic_policy = "Cluster"
    ip_families             = ["IPv4"]
    ip_family_policy        = "SingleStack"
    selector                = module.core_dns.match_labels
    port {
      name        = "dns"
      port        = 53
      protocol    = "UDP"
      target_port = 53
    }
    port {
      name        = "dns-tcp"
      port        = 53
      protocol    = "TCP"
      target_port = 53
    }
    port {
      name        = "metrics"
      port        = 4353
      protocol    = "TCP"
      target_port = 4353
    }
  }

  depends_on = [module.core_dns]
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
  depends_on        = [kubernetes_service.core_dns]
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
