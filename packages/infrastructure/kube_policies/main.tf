terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
}

data "pf_kube_labels" "labels" {
  module = "kube_policies"
}


locals {
  match_any_pod = {
    any = [
      {
        resources = {
          kinds      = ["Pod"]
          operations = ["CREATE", "UPDATE"]
        }
      }
    ]
  }
  match_any_pod_create = {
    any = [
      {
        resources = {
          kinds      = ["Pod"]
          operations = ["CREATE"]
        }
      }
    ]
  }
}

resource "kubectl_manifest" "panfactum_policies" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "ClusterPolicy"
    metadata = {
      name   = "pf-pod-policies"
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      // The order here is EXTREMELY important. Do not change unless you know what you are doing.
      rules = [for rule in concat(
        local.rule_cilium_test,
        local.rule_node_image_cache,
        local.rule_use_pull_through_image_cache,
        local.rule_use_panfactum_scheduler,
        local.rule_add_default_tolerations,
        local.rule_add_extra_tolerations_if_burstable_toleration,
        local.rule_add_extra_tolerations_if_controller_toleration,
        local.rule_add_environment_variables,
        local.rule_add_pod_label
      ) : rule if rule != null]


      webhookConfiguration = {
        // By default, the webhook should not fail if the pod mutations cannot be applied
        // as this can end up in a dead-locked cluster
        failurePolicy = "Ignore"

        // This can sometimes exceed the context deadline which can cause issues
        timeoutSeconds = 30
      }
    }
  })

  force_new         = true
  force_conflicts   = true
  server_side_apply = true
}


