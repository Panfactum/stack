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
    aws = {
      source  = "hashicorp/aws"
      version = "5.70.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
  }
}

locals {
  name    = "karpenter"
  version = 2

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
    consolidationPolicy = "WhenEmptyOrUnderutilized"
    consolidateAfter    = "10s"
    budgets             = []
  }

  expire_after = "24h"

  node_class_template = {
    amiFamily                  = "Bottlerocket"
    subnetSelectorTerms        = [for subnet in data.aws_subnet.node_subnets : { id = subnet.id }]
    securityGroupSelectorTerms = [{ id = var.node_security_group_id }]
    instanceProfile            = var.node_instance_profile
    amiSelectorTerms = [{
      alias = "bottlerocket@latest"
    }]

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
    # For some reason some settings have to be set in the NodeClass
    # configuration in order to take effect
    kubelet = {
      maxPods = 110
    }
  }
}

module "util" {
  source = "../kube_workload_utility"

  # pf-generate: set_vars
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

  # pf-generate: pass_vars
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

  # pf-generate: pass_vars
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

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

data "aws_subnet" "node_subnets" {
  for_each = var.node_subnets
  vpc_id   = var.node_vpc_id
  filter {
    name   = "tag:Name"
    values = [each.value]
  }
}

/********************************************************************************************************************
* Node Class
*********************************************************************************************************************/

resource "random_id" "default_node_class_name" {
  byte_length = 4
  prefix      = "default-"
  keepers = {
    version = local.version
  }
  lifecycle {
    create_before_destroy = true
  }
}
resource "kubectl_manifest" "default_node_class" {
  yaml_body = yamlencode({
    apiVersion = "karpenter.k8s.aws/v1"
    kind       = "EC2NodeClass"
    metadata = {
      name   = random_id.default_node_class_name.hex
      labels = module.util.labels
    }
    spec = local.node_class_template
  })
  server_side_apply = true
  force_conflicts   = true
  lifecycle {
    create_before_destroy = true
  }
}

resource "random_id" "spot_node_class_name" {
  byte_length = 4
  prefix      = "spot-"
  keepers = {
    version = local.version
  }
  lifecycle {
    create_before_destroy = true
  }
}
resource "kubectl_manifest" "spot_node_class" {
  yaml_body = yamlencode({
    apiVersion = "karpenter.k8s.aws/v1"
    kind       = "EC2NodeClass"
    metadata = {
      name   = random_id.spot_node_class_name.hex
      labels = module.util.labels
    }
    spec = merge(
      local.node_class_template,
      {
        userData = module.node_settings_spot.user_data
      }
    )
  })
  server_side_apply = true
  force_conflicts   = true
  lifecycle {
    create_before_destroy = true
  }
}

resource "random_id" "burstable_node_class_name" {
  byte_length = 4
  prefix      = "burstable-"
  keepers = {
    version = local.version
  }
  lifecycle {
    create_before_destroy = true
  }
}
resource "kubectl_manifest" "burstable_node_class" {
  yaml_body = yamlencode({
    apiVersion = "karpenter.k8s.aws/v1"
    kind       = "EC2NodeClass"
    metadata = {
      name   = random_id.burstable_node_class_name.hex
      labels = module.util.labels
    }
    spec = merge(
      local.node_class_template,
      {
        userData = module.node_settings_burstable.user_data
      }
    )
  })
  server_side_apply = true
  force_conflicts   = true
  lifecycle {
    create_before_destroy = true
  }
}


/********************************************************************************************************************
* Node Pools
*********************************************************************************************************************/

resource "random_id" "burstable_node_pool_name" {
  byte_length = 4
  prefix      = "burstable-"
  keepers = {
    version = local.version
  }
  lifecycle {
    create_before_destroy = true
  }
}
resource "kubectl_manifest" "burstable_node_pool" {
  yaml_body = yamlencode({
    apiVersion = "karpenter.sh/v1"
    kind       = "NodePool"
    metadata = {
      name   = random_id.burstable_node_pool_name.hex
      labels = module.util.labels
    }
    spec = {
      template = {
        metadata = {
          labels = merge(var.node_labels, {
            "panfactum.com/class" = "burstable"
          })
        }
        spec = {
          nodeClassRef = {
            group = "karpenter.k8s.aws"
            kind  = "EC2NodeClass"
            name  = kubectl_manifest.burstable_node_class.name
          }
          taints = local.burstable_taints
          startupTaints = [
            module.constants.cilium_taint
          ]
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
          terminationGracePeriod = "2m0s"
          expireAfter            = local.expire_after
        }
      }
      disruption = local.disruption_policy

      weight = 10
    }
  })
  server_side_apply = true
  force_conflicts   = true
  lifecycle {
    create_before_destroy = true
  }
}

resource "random_id" "burstable_arm_node_pool_name" {
  byte_length = 4
  prefix      = "burstable-arm-"
  keepers = {
    version = local.version
  }
  lifecycle {
    create_before_destroy = true
  }
}
resource "kubectl_manifest" "burstable_arm_node_pool" {
  yaml_body = yamlencode({
    apiVersion = "karpenter.sh/v1"
    kind       = "NodePool"
    metadata = {
      name   = random_id.burstable_arm_node_pool_name.hex
      labels = module.util.labels
    }
    spec = {
      template = {
        metadata = {
          labels = merge(var.node_labels, {
            "panfactum.com/class" = "burstable"
          })
        }
        spec = {
          nodeClassRef = {
            group = "karpenter.k8s.aws"
            kind  = "EC2NodeClass"
            name  = kubectl_manifest.burstable_node_class.name
          }
          taints = concat(
            local.burstable_taints,
            local.arm_taints
          )
          startupTaints = [
            module.constants.cilium_taint
          ]
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
          terminationGracePeriod = "2m0s"
          expireAfter            = local.expire_after
        }
      }
      disruption = local.disruption_policy

      weight = 10
    }
  })
  server_side_apply = true
  force_conflicts   = true
  lifecycle {
    create_before_destroy = true
  }
}

resource "random_id" "spot_node_pool_name" {
  byte_length = 4
  prefix      = "spot-"
  keepers = {
    version = local.version
  }
  lifecycle {
    create_before_destroy = true
  }
}
resource "kubectl_manifest" "spot_node_pool" {
  yaml_body = yamlencode({
    apiVersion = "karpenter.sh/v1"
    kind       = "NodePool"
    metadata = {
      name   = random_id.spot_node_pool_name.hex
      labels = module.util.labels
    }
    spec = {
      template = {
        metadata = {
          labels = merge(var.node_labels, {
            "panfactum.com/class" = "spot"
          })
        }
        spec = {
          nodeClassRef = {
            group = "karpenter.k8s.aws"
            kind  = "EC2NodeClass"
            name  = kubectl_manifest.spot_node_class.name
          }
          taints = local.spot_taints
          startupTaints = [
            module.constants.cilium_taint
          ]
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
          terminationGracePeriod = "2m0s"
          expireAfter            = local.expire_after
        }
      }
      disruption = local.disruption_policy

      weight = 10
    }
  })
  server_side_apply = true
  force_conflicts   = true
  lifecycle {
    create_before_destroy = true
  }
}

resource "random_id" "spot_arm_node_pool_name" {
  byte_length = 4
  prefix      = "spot-arm-"
  keepers = {
    version = local.version
  }
  lifecycle {
    create_before_destroy = true
  }
}
resource "kubectl_manifest" "spot_arm_node_pool" {
  yaml_body = yamlencode({
    apiVersion = "karpenter.sh/v1"
    kind       = "NodePool"
    metadata = {
      name   = random_id.spot_arm_node_pool_name.hex
      labels = module.util.labels
    }
    spec = {
      template = {
        metadata = {
          labels = merge(var.node_labels, {
            "panfactum.com/class" = "spot"
          })
        }
        spec = {
          nodeClassRef = {
            group = "karpenter.k8s.aws"
            kind  = "EC2NodeClass"
            name  = kubectl_manifest.spot_node_class.name
          }
          taints = concat(
            local.spot_taints,
            local.arm_taints
          )
          startupTaints = [
            module.constants.cilium_taint
          ]
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
          terminationGracePeriod = "2m0s"
          expireAfter            = local.expire_after
        }
      }
      disruption = local.disruption_policy

      weight = 10
    }
  })
  server_side_apply = true
  force_conflicts   = true
  lifecycle {
    create_before_destroy = true
  }
}

resource "random_id" "on_demand_arm_node_pool_name" {
  byte_length = 4
  prefix      = "on-demand-arm-"
  keepers = {
    version = local.version
  }
  lifecycle {
    create_before_destroy = true
  }
}
resource "kubectl_manifest" "on_demand_arm_node_pool" {
  yaml_body = yamlencode({
    apiVersion = "karpenter.sh/v1"
    kind       = "NodePool"
    metadata = {
      name   = random_id.on_demand_arm_node_pool_name.hex
      labels = module.util.labels
    }
    spec = {
      template = {
        metadata = {
          labels = merge(var.node_labels, {
            "panfactum.com/class" = "worker"
          })
        }
        spec = {
          nodeClassRef = {
            group = "karpenter.k8s.aws"
            kind  = "EC2NodeClass"
            name  = kubectl_manifest.default_node_class.name
          }
          taints = local.arm_taints
          startupTaints = [
            module.constants.cilium_taint
          ]
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
          terminationGracePeriod = "1h0m0s"
          expireAfter            = local.expire_after
        }
      }
      disruption = local.disruption_policy

      // This should have the lowest preference
      weight = 1
    }
  })
  server_side_apply = true
  force_conflicts   = true
  lifecycle {
    create_before_destroy = true
  }
}

resource "random_id" "on_demand_node_pool_name" {
  byte_length = 4
  prefix      = "on-demand-"
  keepers = {
    version = local.version
  }
  lifecycle {
    create_before_destroy = true
  }
}
resource "kubectl_manifest" "on_demand_node_pool" {
  yaml_body = yamlencode({
    apiVersion = "karpenter.sh/v1"
    kind       = "NodePool"
    metadata = {
      name   = random_id.on_demand_node_pool_name.hex
      labels = module.util.labels
    }
    spec = {
      template = {
        metadata = {
          labels = merge(var.node_labels, {
            "panfactum.com/class" = "worker"
          })
        }
        spec = {
          nodeClassRef = {
            group = "karpenter.k8s.aws"
            kind  = "EC2NodeClass"
            name  = kubectl_manifest.default_node_class.name
          }
          startupTaints = [
            module.constants.cilium_taint
          ]
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
          terminationGracePeriod = "1h0m0s"
          expireAfter            = local.expire_after
        }
      }
      disruption = local.disruption_policy

      // This should have the lowest preference
      weight = 1
    }
  })
  server_side_apply = true
  force_conflicts   = true
  lifecycle {
    create_before_destroy = true
  }
}

