output "spot_node_toleration_helm" {
  value = [{
    key      = "spot"
    operator = "Equal"
    value    = "true"
    effect   = "NoSchedule"
  }]
}

output "burstable_node_toleration_helm" {
  value = [
    {
      key      = "spot"
      operator = "Equal"
      value    = "true"
      effect   = "NoSchedule"
    },
    {
      key      = "burstable"
      operator = "Equal"
      value    = "true"
      effect   = "NoSchedule"
    }
  ]
}

output "cilium_taint" {
  value = {
    key    = "node.cilium.io/agent-not-ready"
    value  = "true"
    effect = "NoSchedule"
  }
}

output "burstable_node_affinity_helm" {
  value = {
    nodeAffinity = {
      preferredDuringSchedulingIgnoredDuringExecution = [local.prefer_burstable]
    }
  }
}

output "spot_node_affinity_helm" {
  value = {
    nodeAffinity = {
      preferredDuringSchedulingIgnoredDuringExecution = [local.prefer_spot]
    }
  }
}

output "controller_node_affinity_helm" {
  value = {
    nodeAffinity = {
      preferredDuringSchedulingIgnoredDuringExecution = [local.prefer_controller]
    }
  }
}

output "controller_node_with_spot_affinity_helm" {
  value = {
    nodeAffinity = {
      preferredDuringSchedulingIgnoredDuringExecution = [
        local.prefer_controller,
        local.prefer_spot
      ]
    }
  }
}

output "controller_node_with_burstable_affinity_helm" {
  value = {
    nodeAffinity = {
      preferredDuringSchedulingIgnoredDuringExecution = [
        local.prefer_controller,
        local.prefer_burstable,
        local.prefer_spot
      ]
    }
  }
}

output "pod_anti_affinity_helm" {
  value = {
    podAntiAffinity = {
      requiredDuringSchedulingIgnoredDuringExecution = [{
        topologyKey = "kubernetes.io/hostname"
        labelSelector = {
          matchLabels = var.matching_labels
        }
      }]
    }
  }
}

output "pod_anti_affinity_instance_type_helm" {
  value = {
    podAntiAffinity = {
      requiredDuringSchedulingIgnoredDuringExecution = [{
        topologyKey = "node.kubernetes.io/instance-type"
        labelSelector = {
          matchLabels = var.matching_labels
        }
      }]
    }
  }
}

output "pod_anti_affinity_preferred_instance_type_helm" {
  value = {
    podAntiAffinity = {
      requiredDuringSchedulingIgnoredDuringExecution = [{
        topologyKey = "kubernetes.io/hostname"
        labelSelector = {
          matchLabels = var.matching_labels
        }
      }]
      preferredDuringSchedulingIgnoredDuringExecution = [
        {
          weight = 100
          podAffinityTerm = {
            labelSelector = {
              matchLabels = var.matching_labels
            }
            topologyKey = "node.kubernetes.io/instance-type"
          }
        }
      ]
    }
  }
}

output "spot_node_preferences" {
  value = {
    "panfactum.com/class" = {
      weight   = 1
      operator = "In"
      values   = ["spot"]
    }
  }
}

output "burstable_node_preferences" {
  value = {
    "panfactum.com/class" = {
      weight   = 1
      operator = "In"
      values   = ["burstable"]
    }
  }
}


output "database_priority_class_name" {
  value = "database"
}

output "default_priority_class_name" {
  value = "default"
}

output "cluster_important_priority_class_name" {
  value = "cluster-important"
}

output "topology_spread_zone_strict" {
  value = [
    {
      maxSkew           = 1
      topologyKey       = "topology.kubernetes.io/zone"
      whenUnsatisfiable = "DoNotSchedule"
      labelSelector = {
        matchLabels = var.matching_labels
      }
    }
  ]
}

output "topology_spread_zone_preferred" {
  value = [
    {
      maxSkew           = 1
      topologyKey       = "topology.kubernetes.io/zone"
      whenUnsatisfiable = "ScheduleAnyway"
      labelSelector = {
        matchLabels = var.matching_labels
      }
    }
  ]
}

output "ci_uid" {
  value = 1001
}

output "disable_lifetime_eviction_label" {
  value = {
    "panfactum.com/prevent-lifetime-eviction" = "true"
  }
}
