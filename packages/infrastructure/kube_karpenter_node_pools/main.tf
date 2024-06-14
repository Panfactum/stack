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
  }
}

locals {
  name = "karpenter"

  // (1) <2GB of memory is not efficient as each node requires about 1GB of memory just for the
  // base kubernetes utilities and controllers that must run on each node
  // (2) If monitoring has been deployed, this gets even worse as we have monitoring systems
  // deployed on each node. As a result, increase the minimum node size even further to improve
  // efficiency
  min_instance_memory = var.monitoring_enabled ? 2500 : 2500 // TODO: For now keep it low as we experiment

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
      key      = "kubernetes.io/os"
      operator = "In"
      values   = ["linux"]
    },
    {
      key      = "karpenter.k8s.aws/instance-memory"
      operator = "Gt"
      values   = [tostring(local.min_instance_memory)]
    }
  ]

  burstable_requirements = [
    {
      key      = "karpenter.k8s.aws/instance-category"
      operator = "In"
      values   = ["t"]
    },
    {
      key      = "karpenter.k8s.aws/instance-generation"
      operator = "Gt"
      values   = ["2"]
    },
    {
      key      = "kubernetes.io/os"
      operator = "In"
      values   = ["linux"]
    },
    {
      key      = "karpenter.k8s.aws/instance-memory"
      operator = "Gt"
      values   = [tostring(local.min_instance_memory)]
    }
  ]

  spot_taints = [
    {
      key    = "spot"
      value  = "true"
      effect = "NoSchedule"
    }
  ]

  burstable_taints = concat(
    local.spot_taints,
    [
      {
        key    = "burstable"
        value  = "true"
        effect = "NoSchedule"
      }
    ]
  )

  arm_taints = [
    {
      key    = "arm64"
      value  = "true"
      effect = "NoSchedule"
    }
  ]

  disruption_policy = {
    consolidationPolicy = "WhenUnderutilized"
    expireAfter         = "24h"
  }

  node_class_template = {
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

  # For some reason some settings have to be set in the NodePool
  # configuration in order to take effect
  kubelet = {
    maxPods = 110
  }
}

module "util" {
  source = "../kube_workload_utility"

  # generate: common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

module "constants" {
  source = "../kube_constants"
}

module "node_settings_burstable" {
  source = "../kube_node_settings"

  cluster_name           = var.cluster_name
  cluster_endpoint       = var.cluster_endpoint
  cluster_dns_service_ip = var.cluster_dns_service_ip
  is_spot                = true

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

module "node_settings_spot" {
  source = "../kube_node_settings"

  cluster_name           = var.cluster_name
  cluster_endpoint       = var.cluster_endpoint
  cluster_dns_service_ip = var.cluster_dns_service_ip
  cluster_ca_data        = var.cluster_ca_data
  is_spot                = true

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

module "node_settings" {
  source = "../kube_node_settings"

  cluster_name           = var.cluster_name
  cluster_endpoint       = var.cluster_endpoint
  cluster_dns_service_ip = var.cluster_dns_service_ip
  cluster_ca_data        = var.cluster_ca_data
  is_spot                = false

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

/********************************************************************************************************************
* Node Class
*********************************************************************************************************************/


resource "kubernetes_manifest" "default_node_class" {
  manifest = {
    apiVersion = "karpenter.k8s.aws/v1beta1"
    kind       = "EC2NodeClass"
    metadata = {
      name   = "default"
      labels = module.util.labels
    }
    spec = local.node_class_template
  }
}

resource "kubernetes_manifest" "spot_node_class" {
  manifest = {
    apiVersion = "karpenter.k8s.aws/v1beta1"
    kind       = "EC2NodeClass"
    metadata = {
      name   = "spot"
      labels = module.util.labels
    }
    spec = merge(
      local.node_class_template,
      {
        userData = module.node_settings_spot.user_data
      }
    )
  }
}


resource "kubernetes_manifest" "burstable_node_class" {
  manifest = {
    apiVersion = "karpenter.k8s.aws/v1beta1"
    kind       = "EC2NodeClass"
    metadata = {
      name   = "burstable"
      labels = module.util.labels
    }
    spec = merge(
      local.node_class_template,
      {
        userData = module.node_settings_burstable.user_data
      }
    )
  }
}


/********************************************************************************************************************
* Node Pools
*********************************************************************************************************************/

resource "kubernetes_manifest" "burstable_node_pool" {
  manifest = {
    apiVersion = "karpenter.sh/v1beta1"
    kind       = "NodePool"
    metadata = {
      name   = "burstable"
      labels = module.util.labels
    }
    spec = {
      template = {
        metadata = {
          labels = merge(module.util.labels, {
            "panfactum.com/class" = "burstable"
          })
        }
        spec = {
          nodeClassRef = {
            apiVersion = "karpenter.k8s.aws/v1beta1"
            kind       = "EC2NodeClass"
            name       = "burstable"
          }
          taints = local.burstable_taints
          startupTaints = [
            module.constants.cilium_taint
          ]
          kubelet = local.kubelet
          requirements = concat(
            local.burstable_requirements,
            [
              {
                key = "karpenter.sh/capacity-type"
                operator : "In"
                values : ["spot"]
              },
              {
                key      = "kubernetes.io/arch"
                operator = "In"
                values   = ["amd64"]
              },
            ]
          )
        }
      }
      disruption = local.disruption_policy

      weight = 10
    }
  }
  depends_on = [kubernetes_manifest.burstable_node_class]
}


resource "kubernetes_manifest" "burstable_arm_node_pool" {
  manifest = {
    apiVersion = "karpenter.sh/v1beta1"
    kind       = "NodePool"
    metadata = {
      name   = "burstable-arm"
      labels = module.util.labels
    }
    spec = {
      template = {
        metadata = {
          labels = merge(module.util.labels, {
            "panfactum.com/class" = "burstable"
          })
        }
        spec = {
          nodeClassRef = {
            apiVersion = "karpenter.k8s.aws/v1beta1"
            kind       = "EC2NodeClass"
            name       = "burstable"
          }
          taints = concat(
            local.burstable_taints,
            local.arm_taints
          )
          startupTaints = [
            module.constants.cilium_taint
          ]
          kubelet = local.kubelet
          requirements = concat(
            local.burstable_requirements,
            [
              {
                key = "karpenter.sh/capacity-type"
                operator : "In"
                values : ["spot"]
              },
              {
                key      = "kubernetes.io/arch"
                operator = "In"
                values   = ["arm64"]
              },
            ]
          )
        }
      }
      disruption = local.disruption_policy

      weight = 10
    }
  }
  depends_on = [kubernetes_manifest.burstable_node_class]
}


resource "kubernetes_manifest" "spot_node_pool" {
  manifest = {
    apiVersion = "karpenter.sh/v1beta1"
    kind       = "NodePool"
    metadata = {
      name   = "spot"
      labels = module.util.labels
    }
    spec = {
      template = {
        metadata = {
          labels = merge(module.util.labels, {
            "panfactum.com/class" = "spot"
          })
        }
        spec = {
          nodeClassRef = {
            apiVersion = "karpenter.k8s.aws/v1beta1"
            kind       = "EC2NodeClass"
            name       = "spot"
          }
          taints = local.spot_taints
          startupTaints = [
            module.constants.cilium_taint
          ]
          kubelet = local.kubelet
          requirements = concat(
            local.shared_requirements,
            [
              {
                key = "karpenter.sh/capacity-type"
                operator : "In"
                values : ["spot"]
              },
              {
                key      = "kubernetes.io/arch"
                operator = "In"
                values   = ["amd64"]
              },
            ]
          )
        }
      }
      disruption = local.disruption_policy

      weight = 10
    }
  }
  depends_on = [kubernetes_manifest.spot_node_class]
}

resource "kubernetes_manifest" "spot_arm_node_pool" {
  manifest = {
    apiVersion = "karpenter.sh/v1beta1"
    kind       = "NodePool"
    metadata = {
      name   = "spot-arm"
      labels = module.util.labels
    }
    spec = {
      template = {
        metadata = {
          labels = merge(module.util.labels, {
            "panfactum.com/class" = "spot"
          })
        }
        spec = {
          nodeClassRef = {
            apiVersion = "karpenter.k8s.aws/v1beta1"
            kind       = "EC2NodeClass"
            name       = "spot"
          }
          taints = concat(
            local.spot_taints,
            local.arm_taints
          )
          startupTaints = [
            module.constants.cilium_taint
          ]
          kubelet = local.kubelet
          requirements = concat(
            local.shared_requirements,
            [
              {
                key = "karpenter.sh/capacity-type"
                operator : "In"
                values : ["spot"]
              },
              {
                key      = "kubernetes.io/arch"
                operator = "In"
                values   = ["arm64"]
              },
            ]
          )
        }
      }
      disruption = local.disruption_policy

      weight = 10
    }
  }
  depends_on = [kubernetes_manifest.spot_node_class]
}

resource "kubernetes_manifest" "on_demand_arm_node_pool" {
  manifest = {
    apiVersion = "karpenter.sh/v1beta1"
    kind       = "NodePool"
    metadata = {
      name   = "on-demand-arm"
      labels = module.util.labels
    }
    spec = {
      template = {
        metadata = {
          labels = merge(module.util.labels, {
            "panfactum.com/class" = "worker"
          })
        }
        spec = {
          nodeClassRef = {
            apiVersion = "karpenter.k8s.aws/v1beta1"
            kind       = "EC2NodeClass"
            name       = "default"
          }
          taints = local.arm_taints
          startupTaints = [
            module.constants.cilium_taint
          ]
          kubelet = local.kubelet
          requirements = concat(
            local.shared_requirements,
            [
              {
                key = "karpenter.sh/capacity-type"
                operator : "In"
                values : ["on-demand"]
              },
              {
                key      = "kubernetes.io/arch"
                operator = "In"
                values   = ["arm64"]
              },
            ]
          )
        }
      }
      disruption = local.disruption_policy

      // This should have the lowest preference
      weight = 1
    }
  }
  depends_on = [kubernetes_manifest.default_node_class]
}


resource "kubernetes_manifest" "on_demand_node_pool" {
  manifest = {
    apiVersion = "karpenter.sh/v1beta1"
    kind       = "NodePool"
    metadata = {
      name   = "on-demand"
      labels = module.util.labels
    }
    spec = {
      template = {
        metadata = {
          labels = merge(module.util.labels, {
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
          kubelet = local.kubelet
          requirements = concat(
            local.shared_requirements,
            [
              {
                key = "karpenter.sh/capacity-type"
                operator : "In"
                values : ["on-demand"]
              },
              {
                key      = "kubernetes.io/arch"
                operator = "In"
                values   = ["amd64"]
              },
            ]
          )
        }
      }
      disruption = local.disruption_policy

      // This should have the lowest preference
      weight = 1
    }
  }
  depends_on = [kubernetes_manifest.default_node_class]
}

