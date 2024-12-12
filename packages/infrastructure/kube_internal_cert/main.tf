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

locals {
  localhost_sans = var.include_localhost ? ["localhost"] : []
}

data "pf_kube_labels" "labels" {
  module = "kube_internal_cert"
}

resource "kubectl_manifest" "cert" {
  yaml_body = yamlencode({
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = var.secret_name
      namespace = var.namespace
      labels    = merge(data.pf_kube_labels.labels.labels, var.extra_labels)
    }
    spec = {
      secretName = var.secret_name
      secretTemplate = {
        annotations = {
          // This allows for the secret to have its ca data directly injected into webhooks
          "cert-manager.io/allow-direct-injection" = "true"
        }
        labels = merge(data.pf_kube_labels.labels.labels, var.extra_labels)
      }
      commonName = var.common_name == null ? (length(var.service_names) == 0 ? "default" : "${var.service_names[0]}.${var.namespace}.svc") : var.common_name
      dnsNames = var.sans_enabled ? (length(var.service_names) == 0 ? concat([var.common_name == null ? "default" : var.common_name], local.localhost_sans) : concat(
        flatten([for service in var.service_names : [
          service,
          "${service}.${var.namespace}",
          "${service}.${var.namespace}.svc",
          "${service}.${var.namespace}.svc.cluster.local"
        ]]),
        !var.include_subdomains ? [] : flatten([for service in var.service_names : [
          "*.${service}",
          "*.${service}.${var.namespace}",
          "*.${service}.${var.namespace}.svc",
          "*.${service}.${var.namespace}.svc.cluster.local"
        ]]),
        local.localhost_sans
      )) : []
      ipAddresses = var.sans_enabled && var.include_localhost ? ["127.0.0.1"] : []
      subject = {
        organizations = length(var.service_names) == 0 ? ["default"] : var.service_names
      }
      usages = tolist(toset(concat([
        "key encipherment",
        "digital signature",
        "server auth",
        "client auth"
      ], var.is_ca ? ["cert sign", "crl sign"] : [], var.usages)))


      duration    = var.duration
      renewBefore = var.renew_before

      isCA = var.is_ca

      privateKey = {
        algorithm      = var.private_key_algorithm
        size           = var.private_key_algorithm == "ECDSA" ? 256 : 4096
        rotationPolicy = var.private_key_rotation_enabled ? "Always" : "Never"
        encoding       = var.private_key_encoding
      }

      issuerRef = {
        name  = var.issuer_name == null ? (var.is_ca ? "internal-ca" : (var.private_key_algorithm == "ECDSA" ? "internal" : "internal-rsa")) : var.issuer_name
        kind  = var.use_cluster_issuer ? "ClusterIssuer" : "Issuer"
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

