#################################################
## DO NOT USE AS DEMO. THIS IS INCOMPLETE
##################################################

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
  }
}

data "aws_region" "current" {}

locals {
  event_bus_match = {
    id = random_id.event_bus_id.hex
  }
}

resource "random_id" "event_bus_id" {
  byte_length = 8
  prefix      = "argo-event-bus-"
}

module "event_bus" {
  source = "../kube_argo_event_bus"

  namespace = local.namespace

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

resource "kubernetes_manifest" "event_source_test" {
  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "EventSource"
    metadata = {
      name      = "webhook"
      namespace = local.namespace
      labels    = module.controller_labels.kube_labels
    }
    spec = {
      service = {
        ports = [
          {
            port = 12000
            targetPort = 12000
          }]
      }
      webhook = {
        example = {
          port = "12000"
          endpoint = "/example"
          method = "POST"
        }
      }
    }
  }
  depends_on = [module.event_bus]
}

resource "kubernetes_manifest" "event_trigger_test" {
  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "Sensor"
    metadata = {
      name      = "webhook"
      namespace = local.namespace
      labels    = module.controller_labels.kube_labels
    }
    spec = {
      dependencies = [{
        name = "test-dep"
        eventSourceName = "webhook"
        eventName = "example"
      }]
      triggers = [{
        template ={
          name = "test"
          log = {
            intervalSeconds = 1
          }
        }
      }]

    }
  }
  depends_on = [module.event_bus]
}

