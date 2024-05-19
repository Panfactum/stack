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
  }
}

locals {

  name      = "core-dns"
  namespace = module.namespace.namespace
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "labels" {
  source = "../kube_labels"

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

module "constants" {
  source = "../constants"

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

module "namespace" {
  source = "../kube_namespace"

  namespace      = local.name
  linkerd_inject = false

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

/***********************************************
* CoreDNS RBAC
************************************************/

resource "kubernetes_service_account" "core_dns" {
  metadata {
    name      = local.name
    namespace = local.namespace
    labels    = module.labels.kube_labels
  }
}

resource "kubernetes_cluster_role" "core_dns" {
  metadata {
    name   = local.name
    labels = module.labels.kube_labels
  }
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
}

resource "kubernetes_cluster_role_binding" "core_dns" {
  metadata {
    name   = local.name
    labels = module.labels.kube_labels
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
    labels    = module.labels.kube_labels
  }
  data = {
    Corefile = file("${path.module}/Corefile")
  }
}

module "core_dns" {
  source          = "../kube_deployment"
  namespace       = module.namespace.namespace
  service_name    = local.name
  service_account = kubernetes_service_account.core_dns.metadata[0].name

  min_replicas                = 2
  max_replicas                = 2
  burstable_instances_enabled = true
  priority_class_name         = "system-cluster-critical"
  dns_policy                  = "Default"
  containers = [
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
      minimum_memory       = 10
    }
  ]

  config_map_mounts = {
    "${kubernetes_config_map.config.metadata[0].name}" = "/etc/coredns"
  }

  vpa_enabled = var.vpa_enabled

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

resource "kubernetes_service" "core_dns" {
  metadata {
    name      = local.name
    namespace = local.namespace
    labels    = module.labels.kube_labels
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
      port        = 9153
      protocol    = "TCP"
      target_port = 9153
    }
  }

  depends_on = [module.core_dns]
}
