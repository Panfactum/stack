output "spot_node_toleration_helm" {
  value = [{
    key      = "spot"
    operator = "Equal"
    value    = "true"
    effect   = "NoSchedule"
  }]
}

output "cilium_taint" {
  value = {
    key    = "node.cilium.io/agent-not-ready"
    value  = "true"
    effect = "NoSchedule"
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

output "spot_node_preferences" {
  value = {
    "node.kubernetes.io/class" = {
      weight   = 1
      operator = "In"
      values   = ["spot"]
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

output "topology_spread_zone" {
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

output "ci_uid" {
  value = 1001
}
