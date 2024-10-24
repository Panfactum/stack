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
      version = "5.70.0"
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
}