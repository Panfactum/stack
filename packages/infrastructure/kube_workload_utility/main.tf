terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.4"
    }
  }
}

locals {

  match_labels = var.match_labels != null ? var.match_labels : tomap({
    id = random_id.match_id.hex
  })

  // Pod Anti-Affinity
  pod_anti_affinity = {
    required = {
      host = {
        topologyKey = "kubernetes.io/hostname"
        labelSelector = {
          matchLabels = local.match_labels
        }
      }
      zone = {
        topologyKey = "topology.kubernetes.io/zone"
        labelSelector = {
          matchLabels = local.match_labels
        }
      }
      instance_type = {
        topologyKey = "node.kubernetes.io/instance-type"
        labelSelector = {
          matchLabels = local.match_labels
        }
      }
    }
  }

  // Affinity
  node_preferences = merge(
    var.node_preferences,
    // Normally, node preferences should not be used as they are treated as requirements by Karpenter and thus
    // decrease scheduling efficiency. However, due to interplay between the bin-packing scheduler and Karpenter,
    // it actually improves efficiency to prefer scheduling controller-enabled workloads on controller nodes if possible.
    // This is b/c the controller nodes are not automatically scaled.
    var.controller_nodes_enabled ? {
      "panfactum.com/class" = {
        weight = 100
        values = ["controller"]
      }
    } : null
  )
  node_requirements = merge(
    var.node_requirements,
    var.controller_nodes_required ? {
      "panfactum.com/class" = ["controller"]
    } : null
  )
  affinity = { for k, v in {
    nodeAffinity = { for k, v in {
      preferredDuringSchedulingIgnoredDuringExecution = length(local.node_preferences) > 0 ? [for k, v in local.node_preferences : {
        weight = v.weight
        preference = {
          matchExpressions = [
            {
              key      = k
              operator = "In"
              values   = v.values
            }
          ]
        }
        }
      ] : null
      requiredDuringSchedulingIgnoredDuringExecution = length(local.node_requirements) > 0 ? {
        nodeSelectorTerms = [{
          matchExpressions = [for key, value in local.node_requirements : {
            key      = key
            operator = "In"
            values   = value
          }]
        }]
      } : null
    } : k => v if v != null }
    podAntiAffinity = { for k, v in {
      requiredDuringSchedulingIgnoredDuringExecution = (var.host_anti_affinity_required || var.az_anti_affinity_required || var.instance_type_anti_affinity_required) ? concat(
        var.host_anti_affinity_required ? [local.pod_anti_affinity.required.host] : [],
        var.az_anti_affinity_required ? [local.pod_anti_affinity.required.zone] : [],
        var.instance_type_anti_affinity_required ? [local.pod_anti_affinity.required.instance_type] : []
      ) : null
    } : k => v if v != null }
    podAffinity = length(keys(var.pod_affinity_match_labels)) != 0 ? {
      preferredDuringSchedulingIgnoredDuringExecution = [
        {
          weight = 100
          podAffinityTerm = {
            labelSelector = {
              matchLabels = var.pod_affinity_match_labels
            }
            topologyKey = "kubernetes.io/hostname"
          }
        }
      ]
      requiredDuringSchedulingIgnoredDuringExecution = []
    } : {}
  } : k => v if length(keys(v)) != 0 }


  labels = merge(
    var.extra_labels,
    var.workload_name != null ? {
      "panfactum.com/workload" = var.workload_name
    } : null,
    {
      "panfactum.com/prevent-lifetime-eviction"  = var.lifetime_evictions_enabled ? "false" : "true",
      "panfactum.com/scheduler-enabled"          = var.panfactum_scheduler_enabled ? "true" : "false",
      "panfactum.com/pull-through-cache-enabled" = var.pull_through_cache_enabled ? "true" : "false",
      "panfactum.com/arm64-enabled"              = var.arm_nodes_enabled || var.controller_nodes_required || var.controller_nodes_enabled ? "true" : "false",
      "panfactum.com/burstable-enabled"          = var.burstable_nodes_enabled || var.controller_nodes_required || var.controller_nodes_enabled ? "true" : "false",
      "panfactum.com/spot-enabled"               = var.spot_nodes_enabled || var.burstable_nodes_enabled || var.controller_nodes_required || var.controller_nodes_required ? "false" : "false",
      "panfactum.com/controller-enabled"         = var.controller_nodes_enabled || var.controller_nodes_required ? "true" : "false"
    },
    local.match_labels
  )


  // Tolerations
  spot_node_toleration = {
    key      = "spot"
    operator = "Equal"
    value    = "true"
    effect   = "NoSchedule"
  }
  arm_node_toleration = {
    key      = "arm64"
    operator = "Equal"
    value    = "true"
    effect   = "NoSchedule"
  }
  burstable_node_toleration = {
    key      = "burstable"
    operator = "Equal"
    value    = "true"
    effect   = "NoSchedule"
  }
  controller_node_toleration = {
    key      = "controller"
    operator = "Equal"
    value    = "true"
    effect   = "NoSchedule"
  }
  cilium_toleration = {
    key      = module.constants.cilium_taint.key
    operator = "Exists"
    effect   = module.constants.cilium_taint.effect
  }
  linkerd_toleration = {
    key      = module.constants.linkerd_taint.key
    operator = "Exists"
    effect   = module.constants.linkerd_taint.effect
  }
  tolerations = concat(
    var.burstable_nodes_enabled ? [local.burstable_node_toleration] : [],
    var.spot_nodes_enabled ? [local.spot_node_toleration] : [],
    var.arm_nodes_enabled ? [local.arm_node_toleration] : [],
    var.controller_nodes_enabled || var.controller_nodes_required ? [local.controller_node_toleration] : [],
    var.linkerd_required ? [] : [local.linkerd_toleration],
    var.cilium_required ? [] : [local.cilium_toleration],
    [for toleration in var.extra_tolerations : { for k, v in toleration : k => v if v != null }]
  )

  // Topology Spread
  topology_spread_zone = {
    maxSkew           = 1
    topologyKey       = "topology.kubernetes.io/zone"
    whenUnsatisfiable = var.az_spread_required ? "DoNotSchedule" : "ScheduleAnyway"
    labelSelector = {
      matchLabels = local.match_labels
    }
  }

  topology_spread_constraints = concat(
    var.az_spread_preferred || var.az_spread_required ? [local.topology_spread_zone] : [],
  )
}

resource "random_id" "match_id" {
  prefix      = var.workload_name != null ? "${var.workload_name}-" : ""
  byte_length = 8
}

module "constants" {
  source = "../kube_constants"
}

