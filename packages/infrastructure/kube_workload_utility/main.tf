terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
  }
}

locals {

  match_labels = var.match_labels != null ? var.match_labels : tomap({
    id = random_id.match_id.hex
  })

  // Node Preferences
  node_affinity = {
    preferred = {
      spot = {
        weight = 25
        preference = {
          matchExpressions = [
            {
              key      = "panfactum.com/class"
              operator = "In"
              values   = ["spot"]
            }
          ]
        }
      }
      burstable = {
        weight = 50
        preference = {
          matchExpressions = [
            {
              key      = "panfactum.com/class"
              operator = "In"
              values   = ["burstable"]
            }
          ]
        }
      }
      arm = {
        weight = 25
        preference = {
          matchExpressions = [
            {
              key      = "kubernetes.io/arch"
              operator = "In"
              values   = ["arm64"]
            }
          ]
        }
      }
    }
    required = {
      nodeSelectorTerms = {
        matchExpressions = concat(
          var.controller_node_required ? [
            {
              key      = "panfactum.com/class"
              operator = "In"
              values   = ["controller"]
            }
          ] : [],
          [for key, value in var.node_requirements : {
            key      = key
            operator = "In"
            values   = [value]
          }]
        )
      }
    }
  }

  // Pod Anti-Affinity
  pod_anti_affinity = {
    required = {
      host = {
        topologyKey = "kubernetes.io/hostname"
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
      zone = {
        topologyKey = "topology.kubernetes.io/zone"
        labelSelector = {
          matchLabels = local.match_labels
        }
      }
    }
    preferred = {
      instance_type = {
        weight = 100
        podAffinityTerm = {
          topologyKey = "node.kubernetes.io/instance-type"
          labelSelector = {
            matchLabels = local.match_labels
          }
        }
      }
    }
  }

  // Affinity
  affinity = { for k, v in {
    nodeAffinity = { for k, v in {
      preferredDuringSchedulingIgnoredDuringExecution = concat(
        (var.prefer_burstable_nodes_enabled && var.burstable_nodes_enabled) ? [local.node_affinity.preferred.burstable] : [],
        (var.prefer_spot_nodes_enabled && var.spot_nodes_enabled) ? [local.node_affinity.preferred.spot] : [],
        (var.prefer_arm_nodes_enabled && var.arm_nodes_enabled) ? [local.node_affinity.preferred.arm] : [],
        [for k, v in var.node_preferences : {
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
        }]
      )
      requiredDuringSchedulingIgnoredDuringExecution = length(local.node_affinity.required.nodeSelectorTerms.matchExpressions) != 0 ? local.node_affinity.required : null
    } : k => v if v != null }
    podAntiAffinity = { for k, v in {
      requiredDuringSchedulingIgnoredDuringExecution = (var.host_anti_affinity_required || var.instance_type_anti_affinity_required) ? concat(
        var.host_anti_affinity_required ? [local.pod_anti_affinity.required.host] : [],
        var.instance_type_anti_affinity_required ? [local.pod_anti_affinity.required.instance_type] : [],
        var.zone_anti_affinity_required ? [local.pod_anti_affinity.required.zone] : []
      ) : null
      preferredDuringSchedulingIgnoredDuringExecution = var.instance_type_anti_affinity_preferred ? concat(
        var.instance_type_anti_affinity_preferred ? [local.pod_anti_affinity.preferred.instance_type] : [],
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

  // Labels
  # Note there are 3 replaces for key and values b/c they must start and end with an alpha-numeric character
  sanitized_labels = {
    for k, v in var.extra_tags : replace(replace(replace(k, "/[^-a-zA-Z0-9_./]/", "."), "/^[^a-zA-Z0-9](.*)/", "$1"), "/(.*)[^a-zA-Z0-9]$/", "$1") => replace(replace(replace(v, "/[^-a-zA-Z0-9_.]/", "."), "/^[^a-zA-Z0-9](.*)/", "$1"), "/(.*)[^a-zA-Z0-9]$/", "$1")
  }

  labels = merge(
    local.sanitized_labels,
    {
      "panfactum.com/root-module"   = var.pf_root_module,
      "panfactum.com/module"        = var.pf_module,
      "panfactum.com/environment"   = var.environment,
      "panfactum.com/region"        = var.region,
      "panfactum.com/local"         = var.is_local ? "true" : "false"
      "panfactum.com/stack-version" = var.pf_stack_version
      "panfactum.com/stack-commit"  = var.pf_stack_commit
    },
    var.workload_name != null ? {
      "panfactum.com/workload" = var.workload_name
    } : null,
    var.lifetime_evictions_enabled ? null : {
      "panfactum.com/prevent-lifetime-eviction" = "true"
    },
    var.panfactum_scheduler_enabled ? {
      "panfactum.com/scheduler" = "true"
    } : null,
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
  burstable_node_tolerations = [
    local.spot_node_toleration,
    {
      key      = "burstable"
      operator = "Equal"
      value    = "true"
      effect   = "NoSchedule"
    }
  ]
  tolerations = concat(
    var.burstable_nodes_enabled ? local.burstable_node_tolerations : var.spot_nodes_enabled ? [local.spot_node_toleration] : [],
    var.arm_nodes_enabled ? [local.arm_node_toleration] : [],
    var.extra_tolerations
  )

  // Topology Spread
  topology_spread_zone = {
    maxSkew           = 1
    topologyKey       = "topology.kubernetes.io/zone"
    whenUnsatisfiable = var.topology_spread_strict ? "DoNotSchedule" : "ScheduleAnyway"
    labelSelector = {
      matchLabels = local.match_labels
    }
  }

  topology_spread_constraints = var.topology_spread_enabled ? [
    local.topology_spread_zone
  ] : []
}

resource "random_id" "match_id" {
  prefix      = var.workload_name != null ? "${var.workload_name}-" : ""
  byte_length = 8
}

