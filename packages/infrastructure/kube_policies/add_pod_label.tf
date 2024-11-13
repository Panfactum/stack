
locals {
  rule_add_pod_label = [
    {
      name  = "add-pod-label"
      match = local.match_any_pod_create
      mutate = {
        patchStrategicMerge = {
          metadata = {
            labels = {
              "+(panfactum.com/kyverno-mutated)" = "true"
            }
          }
        }
      }
    }
  ]
}