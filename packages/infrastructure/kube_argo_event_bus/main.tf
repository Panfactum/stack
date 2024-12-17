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
  default_resources = {
    requests = {
      memory = "100Mi"
      cpu    = "100m"
    }
    limits = {
      memory = "130Mi"
    }
  }
}

data "aws_region" "current" {}

data "pf_kube_labels" "labels" {
  module = "kube_argo_event_bus"
}

module "util" {
  source                               = "../kube_workload_utility"
  workload_name                        = "argo-event-bus"
  instance_type_anti_affinity_required = var.instance_type_anti_affinity_required
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  az_spread_required                   = true // stateful workload
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

/***************************************
* Message Broker
***************************************/

module "nats" {
  source            = "../kube_nats"
  minimum_memory_mb = 100
  log_level = "debug"

  namespace = var.namespace
}

/***************************************
* Event Bus
***************************************/

resource "kubectl_manifest" "event_bus" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "EventBus"
    metadata = {
      name      = "default"
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      jetstreamExotic = {
        url = "tls://${module.nats.host}:${module.nats.client_port}"
        tls = {
          caCertSecret = {
            name = module.nats.admin_creds_secret
            key  = "ca.crt"
          }
          clientCertSecret = {
            name = module.nats.admin_creds_secret
            key  = "tls.crt"
          }
          clientKeySecret = {
            name = module.nats.admin_creds_secret
            key  = "tls.key"
          }
        }
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true

  depends_on = [module.nats]
}
