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

module "kube_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

module "constants" {
  source         = "../constants"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

module "node_settings" {
  source           = "../kube_node_settings"
  cluster_name     = var.cluster_name
  cluster_endpoint = var.cluster_endpoint
  cluster_ca_data  = var.cluster_ca_data
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

/********************************************************************************************************************
* Node Class
*********************************************************************************************************************/

resource "kubernetes_manifest" "default_node_class" {
  manifest = {
    apiVersion = "karpenter.k8s.aws/v1beta1"
    kind       = "EC2NodeClass"
    metadata = {
      name   = "default"
      labels = module.kube_labels.kube_labels
    }
    spec = {
      amiFamily = "Bottlerocket"
      subnetSelectorTerms = [
        {
          tags = {
            "karpenter.sh/discovery" = var.cluster_name
          }
        }
      ]
      securityGroupSelectorTerms = [
        {
          tags = {
            "karpenter.sh/discovery" = var.cluster_name
          }
        }
      ]
      instanceProfile = var.node_instance_profile

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
* Node Pools
*********************************************************************************************************************/

resource "kubernetes_manifest" "spot_node_pool" {
  manifest = {
    apiVersion = "karpenter.sh/v1beta1"
    kind       = "NodePool"
    metadata = {
      name   = "spot"
      labels = module.kube_labels.kube_labels
    }
    spec = {
      template = {
        metadata = {
          labels = merge(module.kube_labels.kube_labels, {
            "panfactum.com/class" = "spot"
          })
        }
        spec = {
          nodeClassRef = {
            apiVersion = "karpenter.k8s.aws/v1beta1"
            kind       = "EC2NodeClass"
            name       = "default"
          }
          taints = [
            {
              key    = "spot"
              value  = "true"
              effect = "NoSchedule"
            }
          ]
          startupTaints = [
            module.constants.cilium_taint
          ]
          requirements = concat(
            local.shared_requirements,
            [{
              key = "karpenter.sh/capacity-type"
              operator : "In"
              values : ["spot"]
            }]
          )
        }
      }
      disruption = {
        consolidationPolicy = "WhenUnderutilized"
        expireAfter         = "${24 * 7}h"
      }

      // This should be the preference over on demand nodes
      weight = 10
    }
  }
}


resource "kubernetes_manifest" "on_demand_node_pool" {
  manifest = {
    apiVersion = "karpenter.sh/v1beta1"
    kind       = "NodePool"
    metadata = {
      name   = "on-demand"
      labels = module.kube_labels.kube_labels
    }
    spec = {
      template = {
        metadata = {
          labels = merge(module.kube_labels.kube_labels, {
            "panfactum.com/class" = "worker"
          })
        }
        spec = {
          nodeClassRef = {
            apiVersion = "karpenter.k8s.aws/v1beta1"
            kind       = "EC2NodeClass"
            name       = "default"
          }
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
        }
      }
      disruption = {
        consolidationPolicy = "WhenUnderutilized"
        expireAfter         = "${24 * 7}h"
      }

      // This should have the lowest preference
      weight = 1
    }
  }
}

