terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
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

data "pf_kube_labels" "labels" {
  module = "kube_service"
}

module "nlb_common" {
  count  = var.load_balancer_class == "service.k8s.aws/nlb" && var.type == "LoadBalancer" ? 1 : 0
  source = "../kube_nlb_common_resources"

  name_prefix = "${var.name}-"
}

resource "kubectl_manifest" "service" {
  yaml_body = yamlencode({
    apiVersion = "v1"
    kind       = "Service"
    metadata = {
      name      = var.name
      namespace = var.namespace
      labels = merge(
        data.pf_kube_labels.labels.labels,
        var.extra_labels,
      )
      annotations = merge(
        length(var.public_domain_names) > 0 ? {
          "external-dns.alpha.kubernetes.io/hostname" = join(",", var.public_domain_names)
        } : null,
        var.load_balancer_class == "service.k8s.aws/nlb" && var.type == "LoadBalancer" ? module.nlb_common[0].annotations : null,
        var.extra_annotations
      )
    }
    spec = merge(
      {
        type                  = var.type
        internalTrafficPolicy = var.internal_traffic_policy
        ipFamilies            = ["IPv4"]
        ipFamilyPolicy        = "SingleStack"
        selector              = var.match_labels

        ports = [for name, config in var.ports : {
          name       = name
          port       = config.service_port == null ? config.pod_port : config.service_port
          targetPort = config.pod_port
          protocol   = config.protocol
        }]

        publishNotReadyAddresses = var.headless_enabled
      },
      var.service_ip != null ? {
        clusterIP  = var.service_ip
        clusterIPs = [var.service_ip]
      } : null,
      var.headless_enabled ? {
        clusterIP  = "None"
        clusterIPs = ["None"]
      } : null,
      var.type == "LoadBalancer" ? {
        loadBalancerClass     = "service.k8s.aws/nlb"
        externalTrafficPolicy = var.external_traffic_policy
      } : null
    )
  })

  force_conflicts   = true
  server_side_apply = true
}