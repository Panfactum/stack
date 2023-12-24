terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
  }
}

resource "kubernetes_manifest" "webhook_cert" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = var.secret_name
      namespace = var.namespace
    }
    spec = {
      secretName = var.secret_name
      commonName = var.common_name
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
        "server auth"
      ], var.usages)))

      // rotate every 8 hours with a 16 hour buffer period in case something goes
      // wrong
      duration    = "24h0m0s"
      renewBefore = "16h0m0s"

      privateKey = {
        algorithm      = "ECDSA"
        size           = 256
        rotationPolicy = "Always"
      }

      issuerRef = {
        name  = "internal"
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

