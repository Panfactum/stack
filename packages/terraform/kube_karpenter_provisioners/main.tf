// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
  }
}

locals {
  name = "karpenter"

  shared_requirements = [
    {
      key      = "karpenter.k8s.aws/instance-category"
      operator = "In"
      values   = ["c", "m", "r"]
    },
    {
      key      = "karpenter.k8s.aws/instance-generation"
      operator = "Gt"
      values   = ["5"]
    },
    {
      key      = "kubernetes.io/arch"
      operator = "In"
      values   = ["amd64"]
    },
    {
      key      = "kubernetes.io/os"
      operator = "In"
      values   = ["linux"]
    }
  ]
}

module "constants" {
  source       = "../constants"
  app          = var.app
  environment  = var.environment
  module       = var.module
  region       = var.region
  version_tag  = var.version_tag
  version_hash = var.version_hash
  is_local     = var.is_local
}

module "node_settings" {
  source           = "../kube_node_settings"
  cluster_name     = var.eks_cluster_name
  cluster_endpoint = var.eks_cluster_endpoint
  cluster_ca_data  = var.eks_cluster_ca_data
  app              = var.app
  environment      = var.environment
  module           = var.module
  region           = var.region
  version_tag      = var.version_tag
  version_hash     = var.version_hash
  is_local         = var.is_local
}

/********************************************************************************************************************
* Node Template
*********************************************************************************************************************/

resource "kubernetes_manifest" "default_node_template" {
  manifest = {
    apiVersion = "karpenter.k8s.aws/v1alpha1"
    kind       = "AWSNodeTemplate"
    metadata = {
      name = "default"
    }
    spec = {
      amiFamily = "AL2"
      subnetSelector = {
        "karpenter.sh/discovery" = var.eks_cluster_name
      }
      securityGroupSelector = {
        "karpenter.sh/discovery" = var.eks_cluster_name
      }
      metadataOptions = {
        httpEndpoint            = "enabled"
        httpProtocolIPv6        = "disabled"
        httpPutResponseHopLimit = 1 // don't allow pods to access the node roles
        httpTokens              = "required"
      }
      userData = module.node_settings.user_data
      blockDeviceMappings = [
        {
          deviceName = "/dev/xvda"
          ebs = {
            volumeSize          = "25Gi" // includes temp storage
            encrypted           = true
            deleteOnTermination = true
            volumeType          = "gp3"
          }
        },
        {
          deviceName = "/dev/xvdb"
          ebs = {
            volumeSize          = "40Gi"
            encrypted           = true
            deleteOnTermination = true
            volumeType          = "gp3"
          }
        }
      ]
    }
  }
}


/********************************************************************************************************************
* Provisioners
*********************************************************************************************************************/

resource "kubernetes_manifest" "spot_provisioner" {
  manifest = {
    apiVersion = "karpenter.sh/v1alpha5"
    kind       = "Provisioner"
    metadata = {
      name = "spot"
    }
    spec = {
      providerRef = {
        name = kubernetes_manifest.default_node_template.manifest.metadata.name
      }
      weight = 10
      consolidation = {
        enabled = true
      }
      ttlSecondsUntilExpired = 60 * 60 * 24 * 7
      startupTaints = [
        module.constants.cilium_taint
      ]
      taints = [
        {
          key    = "spot"
          value  = "true"
          effect = "NoSchedule"
        }
      ]
      requirements = concat(
        local.shared_requirements,
        [{
          key = "karpenter.sh/capacity-type"
          operator : "In"
          values : ["spot"]
        }]
      )
      labels = {
        "node.kubernetes.io/class" = "spot"
      }
    }
  }
}

resource "kubernetes_manifest" "on_demand_provisioner" {
  manifest = {
    apiVersion = "karpenter.sh/v1alpha5"
    kind       = "Provisioner"
    metadata = {
      name = "on-demand"
    }
    spec = {
      providerRef = {
        name = kubernetes_manifest.default_node_template.manifest.metadata.name
      }
      weight = 1
      consolidation = {
        enabled = true
      }
      ttlSecondsUntilExpired = 60 * 60 * 8 // we want to recycle these more frequently to move to spot nodes
      startupTaints = [
        module.constants.cilium_taint
      ]
      requirements = concat(
        local.shared_requirements,
        [{
          key = "karpenter.sh/capacity-type"
          operator : "In"
          values : ["on-demand"]
        }]
      )
      labels = {
        "node.kubernetes.io/class" = "worker"
      }
    }
  }
}
