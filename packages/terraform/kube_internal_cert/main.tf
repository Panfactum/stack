// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
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

resource "kubernetes_manifest" "cert" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = var.secret_name
      namespace = var.namespace
      labels    = module.labels.kube_labels
    }
    spec = {
      secretName = var.secret_name
      secretTemplate = {
        annotations = {
          // This allows for the secret to have its ca data directly injected into webhooks
          "cert-manager.io/allow-direct-injection" = "true"
        }
      }
      commonName = var.common_name == null ? (length(var.service_names) == 0 ? "default" : "${var.service_names[0]}.${var.namespace}.svc") : var.common_name
      dnsNames = length(var.service_names) == 0 ? ["default"] : flatten([for service in var.service_names : [
        service,
        "${service}.${var.namespace}",
        "${service}.${var.namespace}.svc",
        "${service}.${var.namespace}.svc.cluster.local"
      ]])
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
        algorithm      = "ECDSA"
        size           = 256
        rotationPolicy = var.private_key_rotation_enabled ? "Always" : "Never"
        encoding       = var.private_key_encoding
      }

      issuerRef = {
        name  = var.cluster_issuer_name == null ? (var.is_ca ? "internal-ca" : "internal") : var.cluster_issuer_name
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

